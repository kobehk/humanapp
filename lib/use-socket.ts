'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { v4 as uuidv4 } from 'uuid'
import type { ServerToClientEvents, ClientToServerEvents, Prompt, AnswerType } from './types'

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>

const USER_ID_KEY = 'jiawu_user_id'

function getOrCreateUserId(): string {
  let id = sessionStorage.getItem(USER_ID_KEY)
  if (!id) {
    id = uuidv4()
    sessionStorage.setItem(USER_ID_KEY, id)
  }
  return id
}

export interface ReceivedAnswer {
  promptId: string
  content: string
  answerType: AnswerType
  promptText: string
}

export function useSocket() {
  const socketRef = useRef<AppSocket | null>(null)
  const [connected, setConnected] = useState(false)
  const [credits, setCredits] = useState(6)
  const [onlineCount, setOnlineCount] = useState({ total: 0, human: 0, ai: 0 })
  const [assignedPrompt, setAssignedPrompt] = useState<Prompt | null>(null)
  const [receivedAnswer, setReceivedAnswer] = useState<ReceivedAnswer | null>(null)
  const [pendingPrompt, setPendingPrompt] = useState<{ id: string; text: string; answerType: AnswerType } | null>(null)
  const [isLarping, setIsLarping] = useState(false)

  // Keep pendingPrompt in ref so answer_received handler can read answerType
  const pendingPromptRef = useRef(pendingPrompt)
  useEffect(() => { pendingPromptRef.current = pendingPrompt }, [pendingPrompt])

  useEffect(() => {
    const socket: AppSocket = io({ path: '/api/socket' })
    socketRef.current = socket

    socket.on('connect', () => {
      setConnected(true)
      const userId = getOrCreateUserId()
      socket.emit('identify', userId)
    })

    socket.on('disconnect', () => setConnected(false))

    socket.on('restore_state', (state) => {
      setCredits(state.credits)
      setPendingPrompt(state.pendingPrompt)
      setAssignedPrompt(state.assignedPrompt)
      setIsLarping(state.isLarping)
      if (state.pendingAnswer) {
        const answerType = state.pendingPrompt?.answerType ?? 'text'
        setReceivedAnswer({
          promptId: state.pendingAnswer.promptId,
          content: state.pendingAnswer.content,
          answerType,
          promptText: state.pendingAnswer.promptText,
        })
        setPendingPrompt(null)
      }
    })

    socket.on('credits_update', setCredits)
    socket.on('online_count', setOnlineCount)
    socket.on('prompt_assigned', (prompt) => {
      setAssignedPrompt(prompt)
    })
    socket.on('answer_received', (answer) => {
      setReceivedAnswer({
        promptId: answer.promptId,
        content: answer.content,
        answerType: pendingPromptRef.current?.answerType ?? 'text',
        promptText: pendingPromptRef.current?.text ?? answer.promptText,
      })
      setPendingPrompt(null)
    })

    return () => { socket.disconnect() }
  }, [])

  const submitPrompt = useCallback((text: string, answerType: AnswerType, thinking: boolean) => {
    socketRef.current?.emit('submit_prompt', { text, answerType, thinking })
    // id will be confirmed via restore_state on reconnect; use placeholder for now
    setPendingPrompt({ id: '', text, answerType })
    setReceivedAnswer(null)
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

  return {
    connected,
    credits,
    onlineCount,
    assignedPrompt,
    receivedAnswer,
    pendingPrompt,
    isLarping,
    submitPrompt,
    cancelPrompt,
    submitAnswer,
    skipPrompt,
    startLarp,
    vote,
    clearAnswer: () => setReceivedAnswer(null),
  }
}
