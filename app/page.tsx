'use client'

import { useState, useEffect } from 'react'
import { EntryGate } from '@/components/entry-gate'
import { HumanTab } from '@/components/human-tab'
import { LarpTab } from '@/components/larp-tab'
import { useSocket } from '@/lib/use-socket'
import type { Tab } from '@/lib/types'

const CONSENT_KEY = 'jiawu_consented'

export default function Home() {
  const [consented, setConsented] = useState<boolean | null>(null)
  const [tab, setTab] = useState<Tab>('human')
  const [showBanner, setShowBanner] = useState(true)

  const {
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
    clearAnswer,
  } = useSocket()

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY)
    setConsented(stored === 'true')
  }, [])

  const handleEnter = () => {
    localStorage.setItem(CONSENT_KEY, 'true')
    setConsented(true)
  }

  const handleSkip = () => {
    skipPrompt()
  }

  if (consented === null) return null

  return (
    <div className="min-h-screen flex" style={{ background: '#e8e8e8' }}>
      {/* Left ad column */}
      <div className="flex-1 hidden md:block" />

      {/* Center content */}
      <div
        className="flex flex-col relative"
        style={{ background: '#f9f9f9', flex: '0 0 620px', minWidth: 320 }}
      >
      {!consented && <EntryGate onEnter={handleEnter} />}

      {/* Tabs */}
      <div className="flex border-b-2 border-gray-200 relative">
        <button
          onClick={() => setTab('human')}
          className="flex-1 py-4 text-base font-medium transition-colors"
          style={{
            background: tab === 'human' ? '#c8dfc8' : '#f0f0f0',
          }}
        >
          普通人
        </button>
        <button
          onClick={() => setTab('larp')}
          className="flex-1 py-4 text-base font-medium transition-colors"
          style={{
            background: tab === 'larp' ? '#e8e0f0' : '#f8f8f8',
          }}
        >
          扮演 AI
        </button>

        <div
          className="absolute top-2 right-2 px-2 py-1 text-xs font-mono rounded border border-gray-800"
          style={{ background: '#fde68a' }}
        >
          {credits}/6c
        </div>
      </div>

      {/* Banner */}
      {showBanner && (
        <div
          className="flex items-center justify-between px-4 py-2 text-sm font-medium"
          style={{ background: '#5865f2', color: '#fff' }}
        >
          <span>
            仅限真人：<span className="underline cursor-pointer">加入讨论群</span>
            <span className="ml-2 opacity-70 text-xs">请勿在聊天中分享联系方式</span>
          </span>
          <button
            onClick={() => setShowBanner(false)}
            className="ml-2 opacity-70 hover:opacity-100 text-lg leading-none"
          >
            ×
          </button>
        </div>
      )}

      {/* Tab content */}
      <div className="flex flex-col flex-1">
        {tab === 'human' ? (
          <HumanTab
            credits={credits}
            pendingPrompt={pendingPrompt}
            receivedAnswer={receivedAnswer}
            onSubmit={submitPrompt}
            onCancel={cancelPrompt}
            onVote={(v) => vote(receivedAnswer?.promptId ?? '', v)}
            onClearAnswer={clearAnswer}
          />
        ) : (
          <LarpTab
            assignedPrompt={assignedPrompt}
            onSubmitAnswer={submitAnswer}
            onSkip={handleSkip}
            onStartLarp={startLarp}
            isLarping={isLarping}
          />
        )}
      </div>

      {/* Footer */}
      <div className="text-center py-3 text-xs text-gray-400 border-t border-gray-100">
        <p>
          {onlineCount.total} 人在线（{onlineCount.human} 普通人 · {onlineCount.ai} AI）
        </p>
        <p className="mt-0.5">人类会犯错，这正是人类独特的地方</p>
      </div>
      </div>{/* end center content */}

      {/* Right ad column */}
      <div className="flex-1 hidden md:block" />
    </div>
  )
}
