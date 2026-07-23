'use client'

import { useEffect, useRef, useState } from 'react'
import type { Prompt } from '@/lib/types'
import type { ReceivedAnswer } from '@/lib/use-socket'

const STORAGE_KEY = 'jiaban_notif_enabled'

function sendNotification(title: string, body: string) {
  // fix 6: re-check live permission before calling new Notification()
  // The user may have revoked permission in browser settings after enabling in-app
  if (Notification.permission !== 'granted') return
  new Notification(title, { body, icon: '/favicon.ico' })
}

export function useNotifications(
  answerHistory: ReceivedAnswer[],
  assignedPrompt: Prompt | null,
  freshlyAssignedPromptId: string | null,
) {
  // fix 5 (permission): lazy-init from live browser state to avoid a flash of the toggle button
  // when the user has already denied permission
  const [permission, setPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) return Notification.permission
    return 'default'
  })
  const [enabled, setEnabled] = useState(false)

  const prevHistoryLen = useRef(answerHistory.length)
  const prevPromptId = useRef<string | null>(assignedPrompt?.id ?? null)
  // fix 8: track previous enabled value to detect transitions
  const prevEnabledRef = useRef(false)

  useEffect(() => {
    if (!('Notification' in window)) return
    const timer = window.setTimeout(() => {
      setPermission(Notification.permission)
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === 'true' && Notification.permission === 'granted') setEnabled(true)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  const toggle = async () => {
    if (!('Notification' in window)) return
    if (enabled) {
      setEnabled(false)
      localStorage.setItem(STORAGE_KEY, 'false')
      return
    }
    let perm = Notification.permission
    if (perm === 'default') {
      perm = await Notification.requestPermission()
      setPermission(perm)
    }
    if (perm === 'granted') {
      setEnabled(true)
      localStorage.setItem(STORAGE_KEY, 'true')
    }
  }

  // fix 8: when notifications are re-enabled, sync the cursor to current history length
  // so we don't flood the user with notifications for answers they already saw
  useEffect(() => {
    if (enabled && !prevEnabledRef.current) {
      prevHistoryLen.current = answerHistory.length
    }
    prevEnabledRef.current = enabled
  }, [enabled, answerHistory.length])

  // Notify when a new answer arrives (human tab)
  useEffect(() => {
    const prev = prevHistoryLen.current
    prevHistoryLen.current = answerHistory.length
    if (!enabled || answerHistory.length <= prev) return
    if (!document.hidden) return
    const latest = answerHistory[answerHistory.length - 1]
    sendNotification('收到回复', latest.promptText)
  }, [answerHistory, enabled])

  // Notify when a new prompt is assigned (larp tab)
  // fix 5: only fire for freshly-assigned prompts (prompt_assigned event),
  // not for prompts restored from a previous session (restore_state event)
  useEffect(() => {
    const currentId = assignedPrompt?.id ?? null
    prevPromptId.current = currentId
    if (!enabled || currentId === null || currentId !== freshlyAssignedPromptId) return
    if (!document.hidden) return
    sendNotification('有新问题', assignedPrompt?.text ?? '')
  }, [assignedPrompt, enabled, freshlyAssignedPromptId])

  return { enabled, toggle, permission, supported: typeof window !== 'undefined' && 'Notification' in window }
}
