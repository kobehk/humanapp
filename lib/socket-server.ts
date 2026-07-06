import { Server as SocketIOServer } from 'socket.io'
import { Server as HttpServer } from 'http'
import { v4 as uuidv4 } from 'uuid'
import type { ServerToClientEvents, ClientToServerEvents, Prompt, AnswerType, RestoredState, Report } from './types'
import { saveReport, isUserBanned } from './data-store'

const CREDITS_MAX = 6
const CREDITS_REFILL_AMOUNT = 2
const CREDITS_REFILL_INTERVAL = 10 * 60 * 1000
const THINKING_COST = 2
const NORMAL_COST = 1
const ANSWER_REWARD = 1
const PROMPT_TIMEOUT = 120_000
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
  const intervals = Math.floor((now - user.lastRefillAt) / CREDITS_REFILL_INTERVAL)
  if (intervals > 0 && user.credits < CREDITS_MAX) {
    return {
      ...user,
      credits: Math.min(CREDITS_MAX, user.credits + intervals * CREDITS_REFILL_AMOUNT),
      lastRefillAt: user.lastRefillAt + intervals * CREDITS_REFILL_INTERVAL,
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

function getOnlineCounts() {
  let human = 0, ai = 0
  userState.forEach((user) => {
    if (!user.socketId) return // offline
    if (user.isLarping || user.assignedPromptId) ai++
    else human++
  })
  const total = human + ai
  return { total, human, ai }
}

function broadcastOnlineCount() {
  io?.emit('online_count', getOnlineCounts())
}

function tryAssignPrompt(userId: string) {
  if (activeAssignments.has(userId)) return
  if (promptQueue.length === 0) {
    waitingLarpers.add(userId)
    return
  }
  const queued = promptQueue.shift()!
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
    if (u) userState.set(userId, { ...u, assignedPromptId: null })
    // Notify answerer
    emitToUser(userId, (s) => s?.emit('prompt_expired'))
    // Re-queue the prompt so another larper can pick it up
    const original = promptRegistry.get(queued.id)
    if (original) {
      const timeout = setTimeout(() => {
        const idx = promptQueue.findIndex((p) => p.id === queued.id)
        if (idx !== -1) promptQueue.splice(idx, 1)
        promptRegistry.delete(queued.id)
        const askerUser = userState.get(original.askerUserId)
        if (askerUser) {
          userState.set(original.askerUserId, { ...askerUser, pendingPromptId: null })
          emitToUser(original.askerUserId, (s) => s?.emit('error', '等待超时，无人回答'))
        }
      }, PROMPT_TIMEOUT)
      promptQueue.push({ ...original, timeout })
      tryDispatchToWaitingLarper()
    }
  }, timeoutMs)
  activeAssignmentTimeouts.set(userId, assignmentTimer)

  emitToUser(userId, (s) => s?.emit('prompt_assigned', queued))
}

function tryDispatchToWaitingLarper() {
  if (promptQueue.length === 0) return
  for (const userId of waitingLarpers) {
    if (!activeAssignments.has(userId)) {
      const user = userState.get(userId)
      if (!user?.socketId) continue
      tryAssignPrompt(userId)
      return
    }
  }
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
      }
    }
  }, EVICT_INTERVAL)

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
            return p ? { id: p.id, text: p.text, answerType: p.answerType } : null
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

      const timeout = setTimeout(() => {
        const idx = promptQueue.findIndex((p) => p.id === promptId)
        if (idx !== -1) promptQueue.splice(idx, 1)
        promptRegistry.delete(promptId)
        const u = userState.get(userId)
        if (u) userState.set(userId, { ...u, pendingPromptId: null })
        emitToUser(userId, (s) => s?.emit('error', '等待超时，无人回答'))
      }, PROMPT_TIMEOUT)

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

      const idx = promptQueue.findIndex((p) => p.id === user.pendingPromptId)
      if (idx !== -1) {
        clearTimeout(promptQueue[idx].timeout)
        promptQueue.splice(idx, 1)
      }
      promptRegistry.delete(user.pendingPromptId)
      userState.set(userId, { ...user, pendingPromptId: null })
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

      promptRegistry.delete(promptId)
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
        waitingLarpers.delete(userId)
        userState.set(userId, { ...user, isLarping: false })
        broadcastOnlineCount()
        return
      }

      // Case 2: has an assigned prompt — put it back
      if (user.assignedPromptId) {
        const promptId = user.assignedPromptId
        // Clear assignment timeout
        const timer = activeAssignmentTimeouts.get(userId)
        if (timer) { clearTimeout(timer); activeAssignmentTimeouts.delete(userId) }
        const original = promptRegistry.get(promptId)
        if (original) {
          const timeout = setTimeout(() => {
            const idx = promptQueue.findIndex((p) => p.id === promptId)
            if (idx !== -1) promptQueue.splice(idx, 1)
            promptRegistry.delete(promptId)
            const askerUser = userState.get(original.askerUserId)
            if (askerUser) {
              userState.set(original.askerUserId, { ...askerUser, pendingPromptId: null })
              emitToUser(original.askerUserId, (s) => s?.emit('error', '等待超时，无人回答'))
            }
          }, PROMPT_TIMEOUT)
          promptQueue.push({ ...original, timeout })
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
      console.log('[report]', report)
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
      }

      broadcastOnlineCount()
    })
  })

  return io
}
