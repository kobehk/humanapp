'use client'

import { useState, useRef, useEffect } from 'react'
import type { AnswerType } from '@/lib/types'
import { DrawingCanvas } from './drawing-canvas'

interface ReceivedAnswer {
  promptId: string
  content: string
  answerType: AnswerType
  promptText: string
  receivedAt: number
}

interface Props {
  credits: number
  lastRefillAt: number
  pendingPrompt: { text: string; answerType: AnswerType } | null
  answerHistory: ReceivedAnswer[]
  onSubmit: (text: string, answerType: AnswerType, thinking: boolean) => void
  onCancel: () => void
  onVote: (promptId: string, v: 'up' | 'down') => void
  onReport: (promptId: string, answerContent: string, promptText: string) => void
}

export function HumanTab({
  credits,
  lastRefillAt,
  pendingPrompt,
  answerHistory,
  onSubmit,
  onCancel,
  onVote,
  onReport,
}: Props) {
  const [answerType, setAnswerType] = useState<AnswerType>('text')
  const [thinking, setThinking] = useState(false)
  const [text, setText] = useState('')
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set())
  const MAX_LEN = 300
  const bottomRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom when new answer arrives
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [answerHistory.length, pendingPrompt])

  const handleSubmit = () => {
    const trimmed = text.trim()
    if (!trimmed) return
    onSubmit(trimmed, answerType, thinking)
    setText('')
  }

  const hasHistory = answerHistory.length > 0

  // Chat + input layout
  if (hasHistory || pendingPrompt) {
    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Scrollable chat area */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
          {answerHistory.map((item) => (
            <AnswerPair
              key={item.promptId}
              item={item}
              reported={reportedIds.has(item.promptId)}
              onVote={(v: 'up' | 'down') => onVote(item.promptId, v)}
              onReport={(promptId, content, promptText) => {
                onReport(promptId, content, promptText)
                setReportedIds((prev) => new Set(prev).add(promptId))
              }}
            />
          ))}

          {/* Pending bubble */}
          {pendingPrompt && (
            <div className="flex flex-col gap-2">
              <div className="flex justify-end">
                <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 max-w-xs text-sm">
                  <p className="text-gray-400 text-xs mb-1">
                    {pendingPrompt.answerType === 'text' ? '要求用文字作答' : '要求用图片作答'}
                  </p>
                  <p>{pendingPrompt.text}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <span className="animate-pulse">🧠</span>
                <span>正在等待回答...</span>
                <button onClick={onCancel} className="text-xs underline ml-1">取消</button>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input area pinned to bottom */}
        <div className="px-4 pb-4 pt-2 border-t border-gray-100">
          <PromptInput
            text={text}
            setText={setText}
            answerType={answerType}
            setAnswerType={setAnswerType}
            thinking={thinking}
            setThinking={setThinking}
            credits={credits}
            lastRefillAt={lastRefillAt}
            onSubmit={handleSubmit}
            maxLen={MAX_LEN}
            disabled={!!pendingPrompt}
          />
        </div>
      </div>
    )
  }

  // Default: idle state
  return (
    <div className="flex flex-col flex-1">
      <div className="flex flex-col items-center justify-center flex-1 gap-3 px-8 text-center">
        <ScribbleIcon />
        <h1 className="text-2xl font-bold mt-2">假扮 AI</h1>
        <p className="text-gray-400 text-xs">?</p>
        <p className="text-gray-400 text-sm">SOTA 大模型，每隔一段时间输出 100 万个 token。</p>
      </div>
      <div className="px-4 pb-4">
        <PromptInput
          text={text}
          setText={setText}
          answerType={answerType}
          setAnswerType={setAnswerType}
          thinking={thinking}
          setThinking={setThinking}
          credits={credits}
          lastRefillAt={lastRefillAt}
          onSubmit={handleSubmit}
          maxLen={MAX_LEN}
        />
      </div>
    </div>
  )
}

function AnswerPair({
  item,
  reported,
  onVote,
  onReport,
}: {
  item: ReceivedAnswer
  reported: boolean
  onVote: (v: 'up' | 'down') => void
  onReport: (promptId: string, content: string, promptText: string) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      {/* User prompt bubble */}
      <div className="flex justify-end">
        <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 max-w-xs text-sm">
          <p className="text-gray-400 text-xs mb-1">
            {item.answerType === 'text' ? '要求用文字作答' : '要求用图片作答'}
          </p>
          <p>{item.promptText}</p>
        </div>
      </div>

      {/* Answer bubble */}
      <div className="bg-purple-50 border border-purple-200 rounded-2xl px-4 py-4 max-w-sm">
        <p className="text-xs text-gray-400 mb-2">&ldquo;AI&rdquo; 回答了</p>
        {item.answerType === 'image' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.content} alt="AI drawing" className="w-full rounded-lg" />
        ) : (
          <p className="text-base font-medium">{item.content}</p>
        )}
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          <button onClick={() => onVote('up')} className="text-xl hover:scale-110 transition-transform">👍</button>
          <button onClick={() => onVote('down')} className="text-xl hover:scale-110 transition-transform">👎</button>
          <button
            className="text-sm px-3 py-1 rounded-lg text-white"
            style={{ background: '#9b5de5' }}
            onClick={() => {
              if (navigator.share) navigator.share({ text: item.content })
            }}
          >
            分享
          </button>
          <button
            className="text-sm px-3 py-1 rounded-lg border disabled:opacity-40"
            style={{ borderColor: reported ? '#d0d0d0' : '#f87171', color: reported ? '#d0d0d0' : '#ef4444' }}
            disabled={reported}
            onClick={() => onReport(item.promptId, item.content, item.promptText)}
          >
            {reported ? '已举报' : '举报'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface PromptInputProps {
  text: string
  setText: (v: string) => void
  answerType: AnswerType
  setAnswerType: (v: AnswerType) => void
  thinking: boolean
  setThinking: (v: boolean) => void
  credits: number
  lastRefillAt: number
  onSubmit: () => void
  maxLen: number
  disabled?: boolean
}

const REFILL_INTERVAL = 10 * 60 * 1000
const REFILL_AMOUNT = 2
const CREDITS_MAX = 6

function PromptInput({
  text, setText, answerType, setAnswerType,
  thinking, setThinking,
  credits, lastRefillAt, onSubmit, maxLen, disabled,
}: PromptInputProps) {
  const cost = thinking ? 2 : 1
  const canAfford = credits >= cost

  const [secsToRefill, setSecsToRefill] = useState(0)

  useEffect(() => {
    if (credits >= CREDITS_MAX) { setSecsToRefill(0); return }
    const calc = () => {
      const elapsed = Date.now() - lastRefillAt
      const msToNext = REFILL_INTERVAL - (elapsed % REFILL_INTERVAL)
      setSecsToRefill(Math.ceil(msToNext / 1000))
    }
    calc()
    const id = setInterval(calc, 1000)
    return () => clearInterval(id)
  }, [credits, lastRefillAt])

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button
          onClick={() => setAnswerType('text')}
          disabled={disabled}
          className="px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-40"
          style={{
            background: answerType === 'text' ? '#fde68a' : 'transparent',
            border: '2px solid',
            borderColor: answerType === 'text' ? '#1a1a1a' : '#d0d0d0',
            boxShadow: answerType === 'text' ? '2px 2px 0 #1a1a1a' : 'none',
          }}
        >
          写点什么
        </button>
        <button
          onClick={() => setAnswerType('image')}
          disabled={disabled}
          className="px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-40"
          style={{
            background: answerType === 'image' ? '#fbcfe8' : 'transparent',
            border: '2px solid',
            borderColor: answerType === 'image' ? '#1a1a1a' : '#d0d0d0',
            boxShadow: answerType === 'image' ? '2px 2px 0 #1a1a1a' : 'none',
          }}
        >
          画点什么
        </button>
      </div>

      <div>
        <button
          onClick={() => setThinking(!thinking)}
          disabled={disabled}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm transition-all disabled:opacity-40"
          style={{
            background: thinking ? '#fbcfe8' : 'transparent',
            border: '2px solid',
            borderColor: thinking ? '#1a1a1a' : '#d0d0d0',
            boxShadow: thinking ? '2px 2px 0 #1a1a1a' : 'none',
          }}
        >
          🧠 {thinking ? 'thinking (2积分)' : '(2积分)'}
        </button>
        {thinking && (
          <p className="text-sm text-gray-500 mt-1">让 AI 多 2 倍时间思考，花费 2 倍积分</p>
        )}
      </div>

      {!canAfford && (
        <p className="text-sm" style={{ color: '#e85d04' }}>
          积分不足（需要 {cost} 积分）
          {secsToRefill > 0 && <>，{secsToRefill} 秒后补充 {REFILL_AMOUNT} 积分</>}
          ，去扮演 AI 回答问题可以获得积分
        </p>
      )}

      <div className="flex gap-2 items-center">
        <div className="flex-1 relative">
          <input
            type="text"
            value={text}
            disabled={disabled}
            onChange={(e) => setText(e.target.value.slice(0, maxLen))}
            onKeyDown={(e) => e.key === 'Enter' && canAfford && !disabled && onSubmit()}
            placeholder={disabled ? '等待回答中...' : answerType === 'image' ? '画一匹马' : '草莓的英文里有几个 R？'}
            className="w-full px-4 py-3 rounded-full border-2 border-gray-800 outline-none text-sm disabled:opacity-40"
            style={{ paddingRight: '3.5rem' }}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-300">
            {text.length}/{maxLen}
          </span>
        </div>

        <button
          onClick={onSubmit}
          disabled={!text.trim() || !canAfford || disabled}
          className="w-10 h-10 rounded-full border-2 border-gray-300 flex items-center justify-center transition-all"
          style={{ opacity: !text.trim() || !canAfford || disabled ? 0.4 : 1 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>

        <button className="flex items-center gap-1 px-3 py-2 rounded-xl border-2 border-gray-800 text-sm font-medium sketch-style">
          🌿 {credits} 积分
        </button>
      </div>
    </div>
  )
}

function ScribbleIcon() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M60 20 C40 20, 20 35, 25 55 C30 75, 50 80, 70 75 C90 70, 100 55, 95 40 C90 25, 75 15, 60 20 Z"
        stroke="#1a1a1a" strokeWidth="2.5" fill="none"
      />
      <path
        d="M45 45 C50 40, 60 38, 70 42 C80 46, 85 55, 80 65 C75 75, 60 78, 50 72 C40 66, 38 55, 45 45 Z"
        stroke="#1a1a1a" strokeWidth="2" fill="none"
      />
      <path
        d="M55 52 C58 48, 65 47, 70 52 C75 57, 73 65, 68 68 C63 71, 56 69, 53 64 C50 59, 52 56, 55 52 Z"
        stroke="#1a1a1a" strokeWidth="1.5" fill="none"
      />
    </svg>
  )
}
