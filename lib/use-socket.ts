'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { v4 as uuidv4 } from 'uuid'
import type { ServerToClientEvents, ClientToServerEvents, Prompt, AnswerType } from './types'

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>

const USER_ID_KEY = 'jiaban_user_id'
const historyCacheKey = (uid: string) => `jiaban_history_${uid}`
const HISTORY_TTL = 60 * 60 * 1000 // 1 hour — matches privacy policy retention

function pruneExpired(history: ReceivedAnswer[]): ReceivedAnswer[] {
  const cutoff = Date.now() - HISTORY_TTL
  return history.filter((a) => a.receivedAt > cutoff)
}

function getOrCreateUserId(): string {
  let id = sessionStorage.getItem(USER_ID_KEY)
  if (!id) {
    id = uuidv4()
    sessionStorage.setItem(USER_ID_KEY, id)
  }
  return id
}

function saveHistoryCache(userId: string, history: ReceivedAnswer[]) {
  try { sessionStorage.setItem(historyCacheKey(userId), JSON.stringify(history)) } catch {}
}

function loadHistoryCache(userId: string): ReceivedAnswer[] {
  try {
    const raw = sessionStorage.getItem(historyCacheKey(userId))
    const parsed: ReceivedAnswer[] = raw ? (JSON.parse(raw) as ReceivedAnswer[]) : []
    const pruned = pruneExpired(parsed)
    if (pruned.length !== parsed.length) {
      saveHistoryCache(userId, pruned)
    }
    return pruned
  } catch { return [] }
}

function clearHistoryCache(userId: string) {
  try { sessionStorage.removeItem(historyCacheKey(userId)) } catch {}
}

export interface ReceivedAnswer {
  promptId: string
  content: string
  answerType: AnswerType
  promptText: string
  receivedAt: number
}

export function useSocket() {
  const socketRef = useRef<AppSocket | null>(null)
  const userIdRef = useRef<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [credits, setCredits] = useState(6)
  const [lastRefillAt, setLastRefillAt] = useState(0)
  const [onlineCount, setOnlineCount] = useState({ total: 0, human: 0, ai: 0 })
  const [assignedPrompt, setAssignedPrompt] = useState<Prompt | null>(null)
  const [answerHistory, setAnswerHistory] = useState<ReceivedAnswer[]>([])
  const [pendingPrompt, setPendingPrompt] = useState<{ id: string; text: string; answerType: AnswerType; claimed: boolean } | null>(null)
  const [isLarping, setIsLarping] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  // fix 5: tracks only prompts from prompt_assigned events (not restore_state)
  // so the notification hook can suppress spurious reconnect notifications
  const [freshlyAssignedPromptId, setFreshlyAssignedPromptId] = useState<string | null>(null)

  const pendingPromptRef = useRef(pendingPrompt)
  useEffect(() => { pendingPromptRef.current = pendingPrompt }, [pendingPrompt])

  // Keep history in ref so callbacks can append without stale closure
  const answerHistoryRef = useRef(answerHistory)
  useEffect(() => { answerHistoryRef.current = answerHistory }, [answerHistory])

  useEffect(() => {
    const socket: AppSocket = io({ path: '/api/socket' })
    socketRef.current = socket

    socket.on('connect', () => {
      setConnected(true)
      const userId = getOrCreateUserId()
      userIdRef.current = userId
      socket.emit('identify', userId)
    })

    socket.on('disconnect', () => setConnected(false))

    socket.on('restore_state', (state) => {
      const userId = userIdRef.current
      const cached = userId ? loadHistoryCache(userId) : []
      setCredits(state.credits)
      setLastRefillAt(state.lastRefillAt)
      setAssignedPrompt(state.assignedPrompt)
      setIsLarping(state.isLarping)

      if (state.pendingAnswer) {
        const answerType = state.pendingAnswer.answerType ?? state.pendingPrompt?.answerType ?? 'text'
        const answer: ReceivedAnswer = {
          promptId: state.pendingAnswer.promptId,
          content: state.pendingAnswer.content,
          answerType,
          promptText: state.pendingAnswer.promptText,
          receivedAt: state.pendingAnswer.answeredAt ?? Date.now(),
        }
        const merged = [...cached.filter((item) => item.promptId !== answer.promptId), answer]
        answerHistoryRef.current = merged
        setAnswerHistory(merged)
        setPendingPrompt(null)
        if (userId) saveHistoryCache(userId, merged)
      } else if (state.pendingPrompt) {
        setPendingPrompt(state.pendingPrompt)
        answerHistoryRef.current = cached
        setAnswerHistory(cached)
      } else {
        setPendingPrompt(null)
        answerHistoryRef.current = cached
        setAnswerHistory(cached)
      }
    })

    socket.on('credits_update', ({ credits, lastRefillAt }) => {
      setCredits(credits)
      setLastRefillAt(lastRefillAt)
    })
    socket.on('online_count', setOnlineCount)
    socket.on('prompt_assigned', (prompt) => {
      setAssignedPrompt(prompt)
      setFreshlyAssignedPromptId(prompt.id)  // fix 5: mark as fresh (not a restore)
    })
    socket.on('prompt_claimed', ({ promptId }) => {
      setPendingPrompt((current) => current
        ? { ...current, id: promptId, claimed: true }
        : current)
    })
    socket.on('prompt_cancelled', () => {
      setPendingPrompt(null)
    })
    socket.on('prompt_expired', ({ continueLarping }) => {
      setAssignedPrompt(null)
      setIsLarping(continueLarping)
    })
    socket.on('error', (message) => {
      setErrorMessage(message)
      const userId = userIdRef.current
      if (userId) socket.emit('identify', userId)
    })
    socket.on('answer_received', (answer) => {
      const received: ReceivedAnswer = {
        promptId: answer.promptId,
        content: answer.content,
        answerType: pendingPromptRef.current?.answerType ?? 'text',
        promptText: pendingPromptRef.current?.text ?? answer.promptText,
        receivedAt: Date.now(),
      }
      const next = [...pruneExpired(answerHistoryRef.current), received]
      answerHistoryRef.current = next
      setAnswerHistory(next)
      setPendingPrompt(null)
      const userId = userIdRef.current
      if (userId) saveHistoryCache(userId, next)
    })

    return () => { socket.disconnect() }
  }, [])

  const submitPrompt = useCallback((text: string, answerType: AnswerType, thinking: boolean) => {
    socketRef.current?.emit('submit_prompt', { text, answerType, thinking })
    setErrorMessage(null)
    setPendingPrompt({ id: '', text, answerType, claimed: false })
  }, [])

  const cancelPrompt = useCallback(() => {
    if (pendingPromptRef.current?.claimed) return
    socketRef.current?.emit('cancel_prompt')
  }, [])

  const submitAnswer = useCallback((promptId: string, content: string) => {
    socketRef.current?.emit('submit_answer', { promptId, content })
    setAssignedPrompt(null)
  }, [])

  const skipPrompt = useCallback(() => {
    socketRef.current?.emit('skip_prompt')
    setAssignedPrompt(null)
    setIsLarping(false)
  }, [])

  const startLarp = useCallback(() => {
    setErrorMessage(null)
    socketRef.current?.emit('start_larp')
    setIsLarping(true)
  }, [])

  const vote = useCallback((promptId: string, v: 'up' | 'down') => {
    socketRef.current?.emit('vote', { promptId, vote: v })
  }, [])

  const report = useCallback((promptId: string, answerContent: string, promptText: string) => {
    socketRef.current?.emit('report', { promptId, answerContent, promptText })
  }, [])

  const clearHistory = useCallback(() => {
    setAnswerHistory([])
    if (userIdRef.current) clearHistoryCache(userIdRef.current)
  }, [])

  return {
    connected,
    credits,
    lastRefillAt,
    onlineCount,
    assignedPrompt,
    freshlyAssignedPromptId,
    answerHistory,
    pendingPrompt,
    isLarping,
    submitPrompt,
    cancelPrompt,
    submitAnswer,
    skipPrompt,
    startLarp,
    vote,
    report,
    clearHistory,
    errorMessage,
    clearError: () => setErrorMessage(null),
  }
}
