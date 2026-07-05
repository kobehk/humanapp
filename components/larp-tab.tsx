'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { Prompt } from '@/lib/types'
import { DrawingCanvas } from './drawing-canvas'

const ANSWER_TIME = 60

interface Props {
  assignedPrompt: Prompt | null
  onSubmitAnswer: (promptId: string, content: string) => void
  onSkip: () => void
  onStartLarp: () => void
  isLarping: boolean
}

export function LarpTab({ assignedPrompt, onSubmitAnswer, onSkip, onStartLarp, isLarping }: Props) {
  const [answer, setAnswer] = useState('')
  const [timeLeft, setTimeLeft] = useState(ANSWER_TIME)
  const [showDrawCanvas, setShowDrawCanvas] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (assignedPrompt) {
      setTimeLeft(ANSWER_TIME)
      setAnswer('')
      setShowDrawCanvas(assignedPrompt.answerType === 'image')
      intervalRef.current = setInterval(() => {
        setTimeLeft((t) => t <= 1 ? 0 : t - 1)
      }, 1000)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [assignedPrompt])

  // Trigger skip when timer hits 0
  useEffect(() => {
    if (timeLeft === 0 && assignedPrompt) {
      onSkip()
    }
  }, [timeLeft, assignedPrompt, onSkip])

  const handleTextSubmit = () => {
    if (!assignedPrompt || !answer.trim()) return
    clearInterval(intervalRef.current!)
    onSubmitAnswer(assignedPrompt.id, answer.trim())
    setAnswer('')
  }

  const handleDrawSubmit = (dataUrl: string) => {
    if (!assignedPrompt) return
    clearInterval(intervalRef.current!)
    onSubmitAnswer(assignedPrompt.id, dataUrl)
  }

  if (!isLarping) {
    return (
      <div className="flex flex-col gap-4 px-4 py-6">
        <div className="border-2 border-gray-200 rounded-2xl p-6 text-center">
          <h2 className="text-2xl font-bold mb-2">变身机器</h2>
          <p className="text-gray-500 text-sm mb-3">
            你有 60 秒来完成一个请求，否则会被关掉
          </p>
          <p className="text-xs text-gray-400 mb-1">每回答一个提问 +1 积分</p>
          <p className="text-xs text-gray-400">积分上限为 6</p>
        </div>

        <button
          onClick={onStartLarp}
          className="w-full py-4 rounded-xl text-lg font-medium"
          style={{ background: '#f9a8d4', border: '2px solid #1a1a1a', boxShadow: '3px 3px 0 #1a1a1a' }}
        >
          开始扮演
        </button>

        <button className="w-full py-4 rounded-xl text-lg border-2 border-gray-800 font-medium"
          style={{ boxShadow: '3px 3px 0 #1a1a1a' }}>
          随手画
        </button>

        <button className="w-full py-4 rounded-xl text-lg border-2 border-gray-800 font-medium"
          style={{ boxShadow: '3px 3px 0 #1a1a1a' }}>
          查看画廊
        </button>
      </div>
    )
  }

  if (!assignedPrompt) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-4 px-4 text-center">
        <div className="text-5xl animate-pulse">⏳</div>
        <p className="text-gray-500">等待提问中...</p>
        <p className="text-xs text-gray-400">当有人提问时，系统会自动分配给你</p>
        <button onClick={onSkip} className="text-gray-400 text-sm underline mt-4">
          停止扮演
        </button>
      </div>
    )
  }

  const timerPct = (timeLeft / ANSWER_TIME) * 100
  const timerColor = timeLeft > 20 ? '#22c55e' : timeLeft > 10 ? '#f59e0b' : '#ef4444'

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      {/* Timer bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-gray-100 rounded-full h-2">
          <div
            className="h-2 rounded-full transition-all duration-1000"
            style={{ width: `${timerPct}%`, background: timerColor }}
          />
        </div>
        <span className="text-sm font-mono font-bold" style={{ color: timerColor }}>
          {timeLeft}s
        </span>
      </div>

      {/* Prompt display */}
      <div className="border-2 border-gray-800 rounded-2xl p-4" style={{ boxShadow: '3px 3px 0 #1a1a1a' }}>
        <p className="text-xs text-gray-400 mb-1">
          {assignedPrompt.answerType === 'image' ? '用图片回答：' : '用文字回答：'}
        </p>
        <p className="text-lg font-medium">{assignedPrompt.text}</p>
        {assignedPrompt.thinking && (
          <span className="mt-2 inline-block text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-600">
            🧠 思考模式
          </span>
        )}
      </div>

      {/* Answer input */}
      {assignedPrompt.answerType === 'image' ? (
        <DrawingCanvas
          onSubmit={handleDrawSubmit}
          onCancel={onSkip}
        />
      ) : (
        <div className="flex flex-col gap-2">
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value.slice(0, 500))}
            placeholder="像 AI 一样回答..."
            className="w-full px-4 py-3 rounded-xl border-2 border-gray-800 outline-none text-sm resize-none"
            rows={4}
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={onSkip}
              className="flex-1 py-3 border-2 border-gray-300 rounded-xl text-sm hover:bg-gray-50"
            >
              跳过
            </button>
            <button
              onClick={handleTextSubmit}
              disabled={!answer.trim()}
              className="flex-2 px-6 py-3 rounded-xl text-sm font-medium text-white transition-all"
              style={{
                background: answer.trim() ? '#1a1a1a' : '#d0d0d0',
                flex: 2,
              }}
            >
              提交回答
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
