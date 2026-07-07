'use client'

import { useState, useEffect, useRef } from 'react'
import type { Prompt } from '@/lib/types'
import { DrawingCanvas } from './drawing-canvas'
import type { GalleryItem } from '@/lib/types'
import { loadGallery, addGalleryItem } from '@/lib/gallery-store'

const ANSWER_TIME = 60
const ANSWER_TIME_THINKING = 120

type IdleView = 'default' | 'draw' | 'gallery'

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
  const [waitElapsed, setWaitElapsed] = useState(0)
  const [showDrawCanvas, setShowDrawCanvas] = useState(false)
  const [idleView, setIdleView] = useState<IdleView>('default')
  const [gallery, setGallery] = useState<GalleryItem[]>([])
  const answerStartRef = useRef<number>(0)
  const waitStartRef = useRef<number>(0)

  // Answer countdown — wall-clock based so it survives background/foreground
  useEffect(() => {
    if (!assignedPrompt) return
    const total = assignedPrompt.thinking ? ANSWER_TIME_THINKING : ANSWER_TIME
    answerStartRef.current = Date.now()
    setTimeLeft(total)
    setAnswer('')
    setShowDrawCanvas(assignedPrompt.answerType === 'image')

    const tick = () => {
      const elapsed = Math.floor((Date.now() - answerStartRef.current) / 1000)
      setTimeLeft(Math.max(0, total - elapsed))
    }
    const id = setInterval(tick, 1000)
    const onVisible = () => { if (!document.hidden) tick() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [assignedPrompt])

  // Waiting elapsed — wall-clock based
  useEffect(() => {
    if (!isLarping || assignedPrompt) return
    waitStartRef.current = Date.now()
    setWaitElapsed(0)
    const tick = () => setWaitElapsed(Math.floor((Date.now() - waitStartRef.current) / 1000))
    const id = setInterval(tick, 1000)
    const onVisible = () => { if (!document.hidden) tick() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [isLarping, assignedPrompt])

  const openGallery = () => {
    setIdleView('gallery')
    setGallery(loadGallery())
  }

  const handleTextSubmit = () => {
    if (!assignedPrompt || !answer.trim()) return
    onSubmitAnswer(assignedPrompt.id, answer.trim())
    setAnswer('')
  }

  const handleDrawSubmit = (dataUrl: string) => {
    if (!assignedPrompt) return
    addGalleryItem({ id: assignedPrompt.id, dataUrl, promptText: assignedPrompt.text, savedAt: Date.now() })
    onSubmitAnswer(assignedPrompt.id, dataUrl)
  }

  // --- Idle: free-draw view ---
  if (!isLarping && idleView === 'draw') {
    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        <DrawingCanvas onBack={() => setIdleView('default')} />
      </div>
    )
  }

  // --- Idle: gallery view ---
  if (!isLarping && idleView === 'gallery') {
    return (
      <div className="flex flex-col flex-1 overflow-hidden" style={{ background: '#f9f9f9' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <span className="text-xl font-bold">画廊</span>
          <button
            onClick={() => setIdleView('default')}
            className="px-4 py-2 text-sm border-2 border-gray-800 rounded-lg"
            style={{ boxShadow: '2px 2px 0 #1a1a1a' }}
          >
            返回
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {gallery.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <span className="text-5xl">🖼️</span>
              <p className="text-gray-400 text-sm">还没有画作，快去扮演 AI 回答图片问题吧</p>
            </div>
          )}
          {gallery.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {gallery.map((item) => (
                <div key={item.id} className="flex flex-col gap-1 rounded-xl overflow-hidden border border-gray-200 bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.dataUrl} alt={item.promptText} className="w-full aspect-video object-cover" />
                  <p className="text-xs text-gray-500 px-2 pb-2 leading-snug">{item.promptText}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // --- Idle: default view ---
  if (!isLarping) {
    return (
      <div className="flex flex-col gap-4 px-4 py-6 flex-1 min-h-0 overflow-y-auto">
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

        <button
          onClick={() => setIdleView('draw')}
          className="w-full py-4 rounded-xl text-lg border-2 border-gray-800 font-medium"
          style={{ boxShadow: '3px 3px 0 #1a1a1a' }}
        >
          随手画
        </button>

        <button
          onClick={openGallery}
          className="w-full py-4 rounded-xl text-lg border-2 border-gray-800 font-medium"
          style={{ boxShadow: '3px 3px 0 #1a1a1a' }}
        >
          查看画廊
        </button>
      </div>
    )
  }

  // --- Larping: waiting for prompt ---
  if (!assignedPrompt) {
    const mins = Math.floor(waitElapsed / 60).toString().padStart(2, '0')
    const secs = (waitElapsed % 60).toString().padStart(2, '0')
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-4 px-4 text-center">
        <div className="text-5xl animate-pulse">⏳</div>
        <p className="text-gray-500">等待提问中...</p>
        <p className="text-2xl font-mono font-bold text-gray-700 tabular-nums">{mins}:{secs}</p>
        <p className="text-xs text-gray-400">当有人提问时，系统会自动分配给你</p>
        <button onClick={onSkip} className="text-gray-400 text-sm underline mt-4">
          停止扮演
        </button>
      </div>
    )
  }

  // --- Larping: answering ---
  const totalTime = assignedPrompt.thinking ? ANSWER_TIME_THINKING : ANSWER_TIME
  const timerPct = (timeLeft / totalTime) * 100
  const timerColor = timeLeft > 20 ? '#22c55e' : timeLeft > 10 ? '#f59e0b' : '#ef4444'

  if (assignedPrompt.answerType === 'image') {
    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Timer bar at top */}
        <div className="flex items-center gap-3 px-4 pt-3 pb-1">
          <div className="flex-1 bg-gray-100 rounded-full h-2">
            <div className="h-2 rounded-full transition-all duration-1000" style={{ width: `${timerPct}%`, background: timerColor }} />
          </div>
          <span className="text-sm font-mono font-bold" style={{ color: timerColor }}>{timeLeft}s</span>
        </div>
        {/* Prompt label */}
        <div className="px-4 py-2">
          <div className="border-2 border-gray-800 rounded-xl px-3 py-2" style={{ boxShadow: '2px 2px 0 #1a1a1a' }}>
            <p className="text-xs text-gray-400 mb-0.5">用图片回答：</p>
            <p className="text-sm font-medium">{assignedPrompt.text}</p>
            {assignedPrompt.thinking && (
              <span className="mt-1 inline-block text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-600">🧠 思考模式</span>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <DrawingCanvas onSubmit={handleDrawSubmit} onBack={onSkip} title="作画" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-4 flex-1 min-h-0 overflow-y-auto">
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
        <p className="text-xs text-gray-400 mb-1">用文字回答：</p>
        <p className="text-lg font-medium">{assignedPrompt.text}</p>
        {assignedPrompt.thinking && (
          <span className="mt-2 inline-block text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-600">
            🧠 思考模式
          </span>
        )}
      </div>

      {/* Answer input */}
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
    </div>
  )
}
