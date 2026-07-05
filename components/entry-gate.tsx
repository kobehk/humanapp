'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Props {
  onEnter: () => void
}

export function EntryGate({ onEnter }: Props) {
  const [check1, setCheck1] = useState(false)
  const [check2, setCheck2] = useState(false)
  const [showWelcome, setShowWelcome] = useState(false)

  const handleEnter = () => {
    if (check1 && check2) setShowWelcome(true)
  }

  if (showWelcome) {
    return <WelcomeModal onGotIt={onEnter} />
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.3)' }}>
      <div className="bg-white rounded-2xl p-8 w-full max-w-sm mx-4 shadow-xl">
        <div className="text-center mb-6">
          <span className="text-5xl">💀</span>
          <h2 className="text-2xl font-bold mt-3">进入前须知</h2>
          <p className="text-gray-500 text-sm mt-2">您必须年满 13 岁才能继续。</p>
        </div>

        <label className="flex items-start gap-3 border-2 border-gray-200 rounded-xl p-4 mb-3 cursor-pointer hover:bg-gray-50 transition-colors">
          <input
            type="checkbox"
            checked={check1}
            onChange={(e) => setCheck1(e.target.checked)}
            className="mt-1 w-4 h-4 flex-shrink-0"
          />
          <span className="text-sm">
            我已年满 13 岁，并同意遵守{' '}
            <Link href="/code-of-conduct" className="text-purple-600 underline">
              行为准则
            </Link>
          </span>
        </label>

        <label className="flex items-start gap-3 border-2 border-gray-200 rounded-xl p-4 mb-6 cursor-pointer hover:bg-gray-50 transition-colors">
          <input
            type="checkbox"
            checked={check2}
            onChange={(e) => setCheck2(e.target.checked)}
            className="mt-1 w-4 h-4 flex-shrink-0"
          />
          <span className="text-sm">
            我同意{' '}
            <Link href="/terms-of-service" className="text-purple-600 underline">
              服务条款
            </Link>
            {' '}和{' '}
            <Link href="/privacy-policy" className="text-purple-600 underline">
              隐私政策
            </Link>
          </span>
        </label>

        <button
          onClick={handleEnter}
          disabled={!check1 || !check2}
          className="w-full py-4 rounded-xl text-lg font-medium transition-all"
          style={{
            background: check1 && check2 ? '#1a1a1a' : '#e5e5e5',
            color: check1 && check2 ? '#fff' : '#999',
            cursor: check1 && check2 ? 'pointer' : 'not-allowed',
          }}
        >
          进入网站
        </button>
      </div>
    </div>
  )
}

function WelcomeModal({ onGotIt }: { onGotIt: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto py-8" style={{ background: 'rgba(0,0,0,0.3)' }}>
      <div className="bg-white rounded-2xl p-8 w-full max-w-sm mx-4 shadow-xl">
        <h2 className="text-2xl font-bold mb-3">假扮 AI</h2>
        <p className="text-gray-500 text-sm mb-5">
          在 AI 夺走人类工作的世界里，用假扮 AI 来夺走 AI 的工作。
        </p>

        <ul className="space-y-3 text-sm mb-6">
          {[
            '每次文字或图片提问消耗 1 积分。',
            '切换到「扮演 AI」标签并回答别人的问题来赚取积分。',
            '积分不足时自动补充（每 10 分钟补充 2 积分）。',
            '提交后可以取消，但对方接单后就无法取消了。',
            '请友善对待他人，仇恨言论、链接和不文明行为将导致封禁。',
          ].map((item, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-gray-400 flex-shrink-0">·</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <button
          onClick={onGotIt}
          className="w-full py-4 rounded-xl text-lg font-medium"
          style={{ background: '#fde68a', color: '#1a1a1a', cursor: 'pointer' }}
        >
          知道了
        </button>
      </div>
    </div>
  )
}
