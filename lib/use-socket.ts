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
  const [lastRefillAt, setLastRefillAt] = useState(Date.now())
  const [onlineCount, setOnlineCount] = useState({ total: 0, human: 0, ai: 0 })
  const [assignedPrompt, setAssignedPrompt] = useState<Prompt | null>(null)
  const [answerHistory, setAnswerHistory] = useState<ReceivedAnswer[]>([])
  const [pendingPrompt, setPendingPrompt] = useState<{ id: string; text: string; answerType: AnswerType } | null>(null)
  const [isLarping, setIsLarping] = useState(false)

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
        const cached = userId ? loadHistoryCache(userId) : []
        const merged = [...cached, answer]
        setAnswerHistory(merged)
        setPendingPrompt(null)
        if (userId) saveHistoryCache(userId, merged)
      } else if (state.pendingPrompt) {
        setPendingPrompt(state.pendingPrompt)
        // keep existing history, just don't add to it while waiting
      } else {
        setPendingPrompt(null)
        if (userId) {
          const cached = loadHistoryCache(userId)
          setAnswerHistory(cached)
        }
      }
    })

    socket.on('credits_update', ({ credits, lastRefillAt }) => {
      setCredits(credits)
      setLastRefillAt(lastRefillAt)
    })
    socket.on('online_count', setOnlineCount)
    socket.on('prompt_assigned', (prompt) => {
      setAssignedPrompt(prompt)
    })
    socket.on('prompt_expired', () => {
      setAssignedPrompt(null)
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
      setAnswerHistory(next)
      setPendingPrompt(null)
      const userId = userIdRef.current
      if (userId) saveHistoryCache(userId, next)
    })

    return () => { socket.disconnect() }
  }, [])

  const submitPrompt = useCallback((text: string, answerType: AnswerType, thinking: boolean) => {
    socketRef.current?.emit('submit_prompt', { text, answerType, thinking })
    setPendingPrompt({ id: '', text, answerType })
  }, [])

  const cancelPrompt = useCallback(() => {
    socketRef.current?.emit('cancel_prompt')
    setPendingPrompt(null)
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
  }
}
