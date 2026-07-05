'use client'

import { useState, useRef } from 'react'
import type { AnswerType } from '@/lib/types'
import { DrawingCanvas } from './drawing-canvas'

interface ReceivedAnswer {
  content: string
  answerType: AnswerType
  promptText: string
}

interface Props {
  credits: number
  pendingPrompt: { text: string; answerType: AnswerType } | null
  receivedAnswer: ReceivedAnswer | null
  onSubmit: (text: string, answerType: AnswerType, thinking: boolean) => void
  onCancel: () => void
  onVote: (v: 'up' | 'down') => void
  onClearAnswer: () => void
}

export function HumanTab({
  credits,
  pendingPrompt,
  receivedAnswer,
  onSubmit,
  onCancel,
  onVote,
  onClearAnswer,
}: Props) {
  const [answerType, setAnswerType] = useState<AnswerType>('text')
  const [thinking, setThinking] = useState(false)
  const [text, setText] = useState('')
  const MAX_LEN = 300

  const handleSubmit = () => {
    const trimmed = text.trim()
    if (!trimmed) return
    onSubmit(trimmed, answerType, thinking)
    setText('')
  }

  // Waiting state: prompt submitted, no answer yet
  if (pendingPrompt) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-4 px-4">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">🧠</div>
          <p className="text-gray-400 text-sm">正在等待回答...</p>
          <div className="mt-3 px-4 py-2 bg-gray-100 rounded-xl text-sm text-gray-600 max-w-xs">
            &ldquo;{pendingPrompt.text}&rdquo;
          </div>
        </div>
        <button
          onClick={onCancel}
          className="text-gray-400 text-sm underline"
        >
          取消
        </button>
      </div>
    )
  }

  // Answer received state
  if (receivedAnswer) {
    return (
      <div className="flex flex-col flex-1 gap-4 px-4 py-4">
        {/* User's prompt bubble */}
        <div className="flex justify-end">
          <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 max-w-xs text-sm">
            <p className="text-gray-400 text-xs mb-1">
              你要求了{receivedAnswer.answerType === 'text' ? '文字' : '图片'}
            </p>
            <p>{receivedAnswer.promptText}</p>
          </div>
        </div>

        {/* Answer bubble */}
        <div className="bg-purple-50 border border-purple-200 rounded-2xl px-4 py-4 max-w-sm">
          <p className="text-xs text-gray-400 mb-2">&ldquo;AI&rdquo; 回答了</p>
          {receivedAnswer.answerType === 'image' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={receivedAnswer.content} alt="AI drawing" className="w-full rounded-lg" />
          ) : (
            <p className="text-base font-medium">{receivedAnswer.content}</p>
          )}
          <div className="flex items-center gap-3 mt-3">
            <button onClick={() => onVote('up')} className="text-xl hover:scale-110 transition-transform">👍</button>
            <button onClick={() => onVote('down')} className="text-xl hover:scale-110 transition-transform">👎</button>
            <button className="text-sm text-purple-600 underline ml-1">为什么？</button>
            <button
              className="text-sm px-3 py-1 rounded-lg text-white"
              style={{ background: '#9b5de5' }}
              onClick={() => {
                if (navigator.share) {
                  navigator.share({ text: receivedAnswer.content })
                }
              }}
            >
              分享
            </button>
            <button
              className="text-sm px-3 py-1 rounded-lg border border-red-400 text-red-500"
              onClick={onClearAnswer}
            >
              举报
            </button>
          </div>
        </div>

        {/* Input area for next question */}
        <PromptInput
          text={text}
          setText={setText}
          answerType={answerType}
          setAnswerType={setAnswerType}
          thinking={thinking}
          setThinking={setThinking}
          credits={credits}
          onSubmit={handleSubmit}
          maxLen={MAX_LEN}
        />
      </div>
    )
  }

  // Default: idle state
  return (
    <div className="flex flex-col flex-1">
      {/* Center illustration */}
      <div className="flex flex-col items-center justify-center flex-1 gap-3 px-8 text-center">
        <ScribbleIcon />
        <h1 className="text-2xl font-bold mt-2">假扮 AI</h1>
        <p className="text-gray-400 text-xs">?</p>
        <p className="text-gray-400 text-sm">SOTA 大模型，每隔一段时间输出 100 万个 token。</p>
      </div>

      {/* Input area */}
      <div className="px-4 pb-4">
        <PromptInput
          text={text}
          setText={setText}
          answerType={answerType}
          setAnswerType={setAnswerType}
          thinking={thinking}
          setThinking={setThinking}
          credits={credits}
          onSubmit={handleSubmit}
          maxLen={MAX_LEN}
        />
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
  onSubmit: () => void
  maxLen: number
}

function PromptInput({
  text, setText, answerType, setAnswerType,
  thinking, setThinking,
  credits, onSubmit, maxLen,
}: PromptInputProps) {
  const cost = thinking ? 2 : 1
  const canAfford = credits >= cost

  return (
    <div className="flex flex-col gap-2">
      {/* Mode buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => setAnswerType('text')}
          className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
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
          className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
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

      {/* Thinking toggle — inline expand */}
      <div>
        <button
          onClick={() => setThinking(!thinking)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm transition-all"
          style={{
            background: thinking ? '#fbcfe8' : 'transparent',
            border: '2px solid',
            borderColor: thinking ? '#1a1a1a' : '#d0d0d0',
            boxShadow: thinking ? '2px 2px 0 #1a1a1a' : 'none',
          }}
        >
          🧠 {thinking ? 'thinking (2c)' : '(2c)'}
        </button>
        {thinking && (
          <div className="mt-1">
            <p className="text-sm text-gray-500">让 AI 多 2 倍时间思考，花费 2 倍积分</p>
            {credits < 2 && (
              <p className="text-sm font-mono" style={{ color: '#e85d04' }}>
                你扮演 AI 的次数还不够（需要 2c）
              </p>
            )}
          </div>
        )}
      </div>

      {/* Text input row */}
      <div className="flex gap-2 items-center">
        <div className="flex-1 relative">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, maxLen))}
            onKeyDown={(e) => e.key === 'Enter' && canAfford && onSubmit()}
            placeholder={answerType === 'image' ? '画一匹马' : '草莓的英文里有几个 R？'}
            className="w-full px-4 py-3 rounded-full border-2 border-gray-800 outline-none text-sm"
            style={{ paddingRight: '3.5rem' }}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-300">
            {text.length}/{maxLen}
          </span>
        </div>

        {/* Send button */}
        <button
          onClick={onSubmit}
          disabled={!text.trim() || !canAfford}
          className="w-10 h-10 rounded-full border-2 border-gray-300 flex items-center justify-center transition-all"
          style={{ opacity: !text.trim() || !canAfford ? 0.4 : 1 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>

        {/* Credits badge */}
        <button className="flex items-center gap-1 px-3 py-2 rounded-xl border-2 border-gray-800 text-sm font-medium sketch-style">
          🌿 {credits}c
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
