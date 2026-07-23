import { Server as SocketIOServer } from 'socket.io'
import { Server as HttpServer } from 'http'
import { v4 as uuidv4 } from 'uuid'
import type { ServerToClientEvents, ClientToServerEvents, Prompt, AnswerType, RestoredState, Report } from './types'
import { saveReport, isUserBanned } from './data-store'
import { generateAIAnswer, generateAIQuestion } from './ai-fallback'

const CREDITS_MAX = 6
const CREDITS_REFILL_AMOUNT = 2
const CREDITS_REFILL_INTERVAL = 10 * 60 * 1000
const THINKING_COST = 2
const NORMAL_COST = 1
const ANSWER_REWARD = 1
const HUMAN_WAIT_TIMEOUT = 60_000
const AI_DELAY_MIN = 5_000
const AI_DELAY_MAX = 30_000
const ASSIGNMENT_TIMEOUT = 60_000

// Persistent user state keyed by userId (survives reconnect)
interface UserState {
  credits: number
  lastRefillAt: number
  pendingPromptId: string | null   // prompt this user submitted, waiting for answer
  assignedPromptId: string | null  // prompt this user is answering
  isLarping: boolean
  socketId: string | null          // current socket, null if disconnected
  disconnectedAt: number | null    // timestamp when last disconnected
  pendingAnswer: PendingAnswer | null
}

interface PendingAnswer {
  promptId: string
  content: string
  answeredAt: number
  promptText: string
  answerType: AnswerType
}

interface QueuedPrompt extends Prompt {
  timeout: ReturnType<typeof setTimeout>
}

let io: SocketIOServer<ClientToServerEvents, ServerToClientEvents> | null = null

const userState = new Map<string, UserState>()        // userId -> UserState
const socketToUser = new Map<string, string>()         // socketId -> userId
const promptQueue: QueuedPrompt[] = []
const activeAssignments = new Map<string, string>()    // userId -> promptId (answering)
const activeAssignmentTimeouts = new Map<string, ReturnType<typeof setTimeout>>() // userId -> timeout
const promptRegistry = new Map<string, Prompt>()       // promptId -> Prompt
const waitingLarpers = new Set<string>()               // userIds waiting for a prompt
const promptAnswerers = new Map<string, string>()      // promptId -> answerer userId
const waitingLarperAITimers = new Map<string, ReturnType<typeof setTimeout>>() // userId -> AI question timer
const fallbackAnswerTimers = new Map<string, ReturnType<typeof setTimeout>>() // promptId -> delayed AI answer

function getOrCreateUser(userId: string, socketId: string): UserState {
  let user = userState.get(userId)
  if (!user) {
    user = {
      credits: CREDITS_MAX,
      lastRefillAt: Date.now(),
      pendingPromptId: null,
      assignedPromptId: null,
      isLarping: false,
      socketId,
      disconnectedAt: null,
      pendingAnswer: null,
    }
    userState.set(userId, user)
  } else {
    user.socketId = socketId
    userState.set(userId, user)
  }
  return user
}

function refillCredits(user: UserState): UserState {
  const now = Date.now()
  // Refill time starts when the balance first drops below the cap, rather than
  // accumulating while the user is already full.
  if (user.credits >= CREDITS_MAX) {
    return { ...user, lastRefillAt: now }
  }
  const intervals = Math.floor((now - user.lastRefillAt) / CREDITS_REFILL_INTERVAL)
  if (intervals > 0) {
    const credits = Math.min(CREDITS_MAX, user.credits + intervals * CREDITS_REFILL_AMOUNT)
    return {
      ...user,
      credits,
      lastRefillAt: credits >= CREDITS_MAX
        ? now
        : user.lastRefillAt + intervals * CREDITS_REFILL_INTERVAL,
    }
  }
  return user
}

function emitToUser(userId: string, fn: (socket: ReturnType<SocketIOServer['sockets']['sockets']['get']>) => void) {
  if (!io) return
  const user = userState.get(userId)
  if (!user?.socketId) return
  const socket = io.sockets.sockets.get(user.socketId)
  if (socket) fn(socket)
}

// Returns count of online larpers (larping or assigned)
function getOnlineLarperCount(): number {
  let count = 0
  userState.forEach((user) => {
    if (user.socketId && (user.isLarping || user.assignedPromptId)) count++
  })
  return count
}

function getOnlineCounts() {
  let human = 0, ai = 0
  userState.forEach((user) => {
    if (!user.socketId) return // offline
    if (user.isLarping || user.assignedPromptId) ai++
    else human++
  })
  const total = human + ai
  if (total < 10) {
    const pad = 10 - total + Math.floor(Math.random() * 6)
    const padAi = Math.floor(pad * 0.6)
    const padHuman = pad - padAi
    return { total: total + pad, human: human + padHuman, ai: ai + padAi }
  }
  return { total, human, ai }
}

function broadcastOnlineCount() {
  io?.emit('online_count', getOnlineCounts())
}

function tryAssignPrompt(userId: string) {
  if (activeAssignments.has(userId)) return
  // Find first prompt not submitted by this user
  const idx = promptQueue.findIndex(p => p.askerUserId !== userId)
  if (idx === -1) {
    waitingLarpers.add(userId)
    scheduleAIQuestion(userId)
    return
  }
  cancelAIQuestion(userId)
  const [queued] = promptQueue.splice(idx, 1)
  clearTimeout(queued.timeout)
  activeAssignments.set(userId, queued.id)
  waitingLarpers.delete(userId)

  const user = userState.get(userId)
  if (user) {
    userState.set(userId, { ...user, assignedPromptId: queued.id })
  }

  // Start assignment timeout — re-queue if answerer doesn't respond
  const timeoutMs = queued.thinking ? ASSIGNMENT_TIMEOUT * 2 : ASSIGNMENT_TIMEOUT
  const assignmentTimer = setTimeout(() => {
    if (activeAssignments.get(userId) !== queued.id) return
    activeAssignments.delete(userId)
    activeAssignmentTimeouts.delete(userId)
    const u = userState.get(userId)
    if (u) userState.set(userId, { ...u, assignedPromptId: null, isLarping: false })
    // Notify answerer
    emitToUser(userId, (s) => s?.emit('prompt_expired', { continueLarping: false }))
    // Re-queue the prompt so another larper can pick it up (skip AI-generated prompts)
    const original = promptRegistry.get(queued.id)
    if (original && original.askerUserId !== 'ai') {
      const timeout = scheduleAIFallback(original)
      promptQueue.push({ ...original, timeout })
      tryDispatchToWaitingLarper()
    } else if (original) {
      promptRegistry.delete(original.id)
    }
  }, timeoutMs)
  activeAssignmentTimeouts.set(userId, assignmentTimer)

  emitToUser(userId, (s) => s?.emit('prompt_assigned', queued))
  emitToUser(queued.askerUserId, (s) => s?.emit('prompt_claimed', { promptId: queued.id }))
}

function tryDispatchToWaitingLarper() {
  if (promptQueue.length === 0) return
  for (const userId of waitingLarpers) {
    if (!activeAssignments.has(userId)) {
      const user = userState.get(userId)
      if (!user?.socketId) continue
      tryAssignPrompt(userId)
      if (activeAssignments.has(userId)) return  // fix 4: only stop if actually assigned
    }
  }
}

function scheduleAIFallback(prompt: Prompt, waitMs = HUMAN_WAIT_TIMEOUT): ReturnType<typeof setTimeout> {
  return setTimeout(() => {
    const idx = promptQueue.findIndex(p => p.id === prompt.id)
    if (idx === -1) return
    clearTimeout(promptQueue[idx].timeout)
    promptQueue.splice(idx, 1)

    const delay = AI_DELAY_MIN + Math.random() * (AI_DELAY_MAX - AI_DELAY_MIN)
    const answerTimer = setTimeout(async () => {
      fallbackAnswerTimers.delete(prompt.id)
      if (!promptRegistry.has(prompt.id)) return
      const askerUser = userState.get(prompt.askerUserId)
      if (!askerUser || askerUser.pendingPromptId !== prompt.id) {
        promptRegistry.delete(prompt.id)
        return
      }

      if (prompt.answerType === 'image') {
        promptRegistry.delete(prompt.id)
        userState.set(prompt.askerUserId, { ...askerUser, pendingPromptId: null })
        emitToUser(prompt.askerUserId, s => s?.emit('error', '暂无画手在线，请稍后再试'))
      } else {
        const aiContent = await generateAIAnswer(prompt.text)
        const latest = userState.get(prompt.askerUserId)
        if (!latest || latest.pendingPromptId !== prompt.id || !promptRegistry.has(prompt.id)) return
        promptRegistry.delete(prompt.id)
        userState.set(prompt.askerUserId, { ...latest, pendingPromptId: null })
        const answer = { promptId: prompt.id, content: aiContent, answeredAt: Date.now(), promptText: prompt.text, answerType: prompt.answerType }
        const current = userState.get(prompt.askerUserId)
        if (current?.socketId) {
          emitToUser(prompt.askerUserId, s => s?.emit('answer_received', answer))
        } else if (current) {
          userState.set(prompt.askerUserId, { ...current, pendingAnswer: answer })
        }
      }
    }, delay)
    fallbackAnswerTimers.set(prompt.id, answerTimer)
  }, waitMs)
}

// When a larper is waiting but there are no human questioners online, have AI generate a question for them
const AI_QUESTION_DELAY_MIN = 15_000
const AI_QUESTION_DELAY_MAX = 40_000

function scheduleAIQuestion(userId: string) {
  cancelAIQuestion(userId)
  const delay = AI_QUESTION_DELAY_MIN + Math.random() * (AI_QUESTION_DELAY_MAX - AI_QUESTION_DELAY_MIN)
  const timer = setTimeout(async () => {
    waitingLarperAITimers.delete(userId)
    // Only proceed if still waiting and not yet assigned
    if (!waitingLarpers.has(userId)) return
    if (activeAssignments.has(userId)) return
    // If a real human has queued a prompt in the meantime, let normal flow handle it
    if (promptQueue.length > 0) {
      tryAssignPrompt(userId)
      return
    }
    // fix 2: catch errors so the user doesn't get stuck in waitingLarpers forever
    let question: string
    try {
      question = await generateAIQuestion()
    } catch {
      if (waitingLarpers.has(userId)) scheduleAIQuestion(userId)
      return
    }
    // Re-check after async call
    if (!waitingLarpers.has(userId)) return
    if (activeAssignments.has(userId)) return

    const promptId = `ai-${Date.now()}-${userId}`
    const prompt: Prompt = {
      id: promptId,
      text: question,
      answerType: 'text',
      thinking: false,
      submittedAt: Date.now(),
      askerUserId: 'ai',
    }
    promptRegistry.set(promptId, prompt)
    activeAssignments.set(userId, promptId)
    waitingLarpers.delete(userId)
    const user = userState.get(userId)
    if (user) userState.set(userId, { ...user, assignedPromptId: promptId })

    // fix 3: AI prompts also need an assignment timeout so a disconnect doesn't leak state
    const assignmentTimer = setTimeout(() => {
      if (activeAssignments.get(userId) !== promptId) return
      activeAssignments.delete(userId)
      activeAssignmentTimeouts.delete(userId)
      promptRegistry.delete(promptId)
      const u = userState.get(userId)
      if (u) userState.set(userId, { ...u, assignedPromptId: null })
      emitToUser(userId, (s) => s?.emit('prompt_expired', { continueLarping: true }))
      if (u?.isLarping) tryAssignPrompt(userId)
    }, ASSIGNMENT_TIMEOUT)
    activeAssignmentTimeouts.set(userId, assignmentTimer)

    emitToUser(userId, (s) => s?.emit('prompt_assigned', prompt))
  }, delay)
  waitingLarperAITimers.set(userId, timer)
}

function cancelAIQuestion(userId: string) {
  const t = waitingLarperAITimers.get(userId)
  if (t) { clearTimeout(t); waitingLarperAITimers.delete(userId) }
}

export function initSocket(httpServer: HttpServer) {
  if (io) return io

  io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin: '*' },
    path: '/api/socket',
  })

  // Evict users offline for more than 24 hours with no pending state
  const EVICT_INTERVAL = 60 * 60 * 1000      // check every hour
  const EVICT_THRESHOLD = 24 * 60 * 60 * 1000
  setInterval(() => {
    const now = Date.now()
    for (const [userId, user] of userState) {
      if (user.socketId) continue
      if (user.pendingAnswer) continue
      if (user.disconnectedAt && now - user.disconnectedAt > EVICT_THRESHOLD) {
        userState.delete(userId)
        // fix 7: also clean up any lingering assignment state to prevent memory leak
        const promptId = activeAssignments.get(userId)
        if (promptId) {
          const t = activeAssignmentTimeouts.get(userId)
          if (t) clearTimeout(t)
          activeAssignmentTimeouts.delete(userId)
          activeAssignments.delete(userId)
          const p = promptRegistry.get(promptId)
          if (p?.askerUserId === 'ai') promptRegistry.delete(promptId)
        }
      }
    }
  }, EVICT_INTERVAL)

  // Keep connected clients' credit balances current without requiring a reload
  // or another user action after the refill countdown reaches zero.
  setInterval(() => {
    for (const [userId, current] of userState) {
      if (!current.socketId) continue
      const next = refillCredits(current)
      userState.set(userId, next)
      if (next.credits !== current.credits) {
        emitToUser(userId, (s) => s?.emit('credits_update', {
          credits: next.credits,
          lastRefillAt: next.lastRefillAt,
        }))
      }
    }
  }, 1000)

  io.on('connection', (socket) => {
    // Client must call identify immediately after connecting
    socket.on('identify', (userId: string) => {
      // Clean up any previous socket mapping for this user
      const prevUser = userState.get(userId)
      if (prevUser?.socketId) {
        socketToUser.delete(prevUser.socketId)
      }

      socketToUser.set(socket.id, userId)
      let user = getOrCreateUser(userId, socket.id)
      user = refillCredits(user)
      user = { ...user, disconnectedAt: null }
      userState.set(userId, user)

      // Build restored state
      const pendingPrompt = user.pendingPromptId
        ? (() => {
            const p = promptRegistry.get(user.pendingPromptId)
            const claimed = [...activeAssignments.values()].includes(user.pendingPromptId!)
            return p ? { id: p.id, text: p.text, answerType: p.answerType, claimed } : null
          })()
        : null

      const assignedPrompt = user.assignedPromptId
        ? promptRegistry.get(user.assignedPromptId) ?? null
        : null

      const restored: RestoredState = {
        credits: user.credits,
        lastRefillAt: user.lastRefillAt,
        pendingPrompt,
        assignedPrompt,
        isLarping: user.isLarping,
        pendingAnswer: user.pendingAnswer,
      }

      socket.emit('restore_state', restored)
      socket.emit('online_count', getOnlineCounts())

      // Clear delivered answer
      if (user.pendingAnswer) {
        userState.set(userId, { ...user, pendingAnswer: null })
      }

      // Re-register in waitingLarpers if was larping but not yet assigned
      if (user.isLarping && !user.assignedPromptId) {
        tryAssignPrompt(userId)
      }

      broadcastOnlineCount()
    })

    socket.on('submit_prompt', ({ text, answerType, thinking }) => {
      const userId = socketToUser.get(socket.id)
      if (!userId) return
      let user = userState.get(userId)
      if (!user) return

      if (isUserBanned(userId)) {
        socket.emit('error', '你已被封禁，1天内无法提问或回答')
        return
      }

      user = refillCredits(user)
      const cost = thinking ? THINKING_COST : NORMAL_COST
      if (user.credits < cost) {
        socket.emit('error', '积分不足')
        return
      }
      if (user.pendingPromptId) {
        socket.emit('error', '请等待当前问题回答完毕')
        return
      }

      user = { ...user, credits: user.credits - cost }
      socket.emit('credits_update', { credits: user.credits, lastRefillAt: user.lastRefillAt })

      const promptId = uuidv4()
      const prompt: Prompt = {
        id: promptId,
        text,
        answerType: answerType as AnswerType,
        thinking,
        submittedAt: Date.now(),
        askerUserId: userId,
      }

      // No larpers online — skip the human-wait window and fall back to AI immediately
      const noLarpers = getOnlineLarperCount() === 0 && waitingLarpers.size === 0
      const waitMs = noLarpers ? 0 : HUMAN_WAIT_TIMEOUT
      const timeout = scheduleAIFallback(prompt, waitMs)

      promptQueue.push({ ...prompt, timeout })
      promptRegistry.set(promptId, prompt)
      user = { ...user, pendingPromptId: promptId }
      userState.set(userId, user)

      tryDispatchToWaitingLarper()
    })

    socket.on('cancel_prompt', () => {
      const userId = socketToUser.get(socket.id)
      if (!userId) return
      const user = userState.get(userId)
      if (!user?.pendingPromptId) return
      const isAssigned = [...activeAssignments.values()].includes(user.pendingPromptId)
      if (isAssigned) {
        socket.emit('error', '问题已被接单，无法取消')
        return
      }

      const idx = promptQueue.findIndex((p) => p.id === user.pendingPromptId)
      if (idx !== -1) {
        clearTimeout(promptQueue[idx].timeout)
        promptQueue.splice(idx, 1)
      }
      const answerTimer = fallbackAnswerTimers.get(user.pendingPromptId)
      if (answerTimer) {
        clearTimeout(answerTimer)
        fallbackAnswerTimers.delete(user.pendingPromptId)
      }
      promptRegistry.delete(user.pendingPromptId)
      userState.set(userId, { ...user, pendingPromptId: null })
      socket.emit('prompt_cancelled')
    })

    socket.on('submit_answer', ({ promptId, content }) => {
      const userId = socketToUser.get(socket.id)
      if (!userId) return
      if (activeAssignments.get(userId) !== promptId) return

      // Clear assignment timeout
      const timer = activeAssignmentTimeouts.get(userId)
      if (timer) { clearTimeout(timer); activeAssignmentTimeouts.delete(userId) }

      promptAnswerers.set(promptId, userId)
      // Clean up after 1 hour — report window is unlikely to exceed this
      setTimeout(() => promptAnswerers.delete(promptId), 60 * 60 * 1000)
      const originalPrompt = promptRegistry.get(promptId)

      // Deliver to asker (online or store for later)
      if (originalPrompt) {
        const askerUserId = originalPrompt.askerUserId
        if (askerUserId !== 'ai') {
          const askerUser = userState.get(askerUserId)
          if (askerUser) {
            const answer = {
              promptId,
              content,
              answeredAt: Date.now(),
              promptText: originalPrompt.text,
              answerType: originalPrompt.answerType,
            }
            if (askerUser.socketId) {
              emitToUser(askerUserId, (s) => s?.emit('answer_received', answer))
            } else {
              // Asker offline — store for delivery on reconnect
              userState.set(askerUserId, { ...askerUser, pendingAnswer: answer })
            }
            userState.set(askerUserId, { ...userState.get(askerUserId)!, pendingPromptId: null })
          }
        }
        // For AI-generated prompts, just clean up the registry — no delivery needed
        promptRegistry.delete(promptId)
      }
      activeAssignments.delete(userId)
      let user = userState.get(userId)
      if (user) {
        user = refillCredits(user)
        user = { ...user, credits: Math.min(CREDITS_MAX, user.credits + ANSWER_REWARD), assignedPromptId: null }
        userState.set(userId, user)
        socket.emit('credits_update', { credits: user.credits, lastRefillAt: user.lastRefillAt })
        if (user.isLarping) {
          tryAssignPrompt(userId)
        }
      }

      broadcastOnlineCount()
    })

    socket.on('skip_prompt', () => {
      const userId = socketToUser.get(socket.id)
      if (!userId) return
      const user = userState.get(userId)
      if (!user) return

      // Case 1: waiting but not yet assigned
      if (waitingLarpers.has(userId) && !user.assignedPromptId) {
        cancelAIQuestion(userId)
        waitingLarpers.delete(userId)
        userState.set(userId, { ...user, isLarping: false })
        broadcastOnlineCount()
        return
      }

      // Case 2: has an assigned prompt — put it back (unless it's AI-generated)
      if (user.assignedPromptId) {
        const promptId = user.assignedPromptId
        // Clear assignment timeout
        const timer = activeAssignmentTimeouts.get(userId)
        if (timer) { clearTimeout(timer); activeAssignmentTimeouts.delete(userId) }
        const original = promptRegistry.get(promptId)
        if (original && original.askerUserId !== 'ai') {
          const timeout = scheduleAIFallback(original)
          promptQueue.push({ ...original, timeout })
          // fix 1: keep registry entry alive so the next larper's answer can be delivered
        } else if (original) {
          // AI-generated prompt: clean up immediately, no one is waiting for the answer
          promptRegistry.delete(promptId)
        }
        activeAssignments.delete(userId)
        waitingLarpers.delete(userId)
        userState.set(userId, { ...user, assignedPromptId: null, isLarping: false })
        broadcastOnlineCount()
        tryDispatchToWaitingLarper()
      }
    })

    socket.on('start_larp', () => {
      const userId = socketToUser.get(socket.id)
      if (!userId) return
      const user = userState.get(userId)
      if (!user) return

      if (isUserBanned(userId)) {
        socket.emit('error', '你已被封禁，1天内无法提问或回答')
        return
      }

      userState.set(userId, { ...user, isLarping: true })
      tryAssignPrompt(userId)
      broadcastOnlineCount()
    })

    socket.on('vote', () => { /* future: persist votes */ })

    socket.on('report', ({ promptId, answerContent, promptText }) => {
      const userId = socketToUser.get(socket.id)
      if (!userId) return
      const report: Report = {
        promptId,
        promptText,
        answerContent,
        reportedAt: Date.now(),
        reporterUserId: userId,
        answererUserId: promptAnswerers.get(promptId) ?? '',
      }
      saveReport(report)
    })

    socket.on('disconnect', () => {
      const userId = socketToUser.get(socket.id)
      if (!userId) return
      socketToUser.delete(socket.id)

      const user = userState.get(userId)
      if (user) {
        userState.set(userId, { ...user, socketId: null, disconnectedAt: Date.now() })
        // Remove from waiting set — will re-add on reconnect if still larping
        waitingLarpers.delete(userId)
        cancelAIQuestion(userId)
      }

      broadcastOnlineCount()
    })
  })

  return io
}
