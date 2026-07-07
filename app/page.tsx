'use client'

import { useState, useEffect } from 'react'
import { EntryGate } from '@/components/entry-gate'
import { HumanTab } from '@/components/human-tab'
import { LarpTab } from '@/components/larp-tab'
import { AdSlot } from '@/components/ad-slot'
import { useSocket } from '@/lib/use-socket'
import type { ReceivedAnswer } from '@/lib/use-socket'
import type { Tab } from '@/lib/types'

const CONSENT_KEY = 'jiaban_consented'
const TAB_KEY = 'jiaban_tab'

export default function Home() {
  const [consented, setConsented] = useState<boolean | null>(null)
  const [tab, setTab] = useState<Tab>('human')
  const [showBanner, setShowBanner] = useState(true)
  const [showExportModal, setShowExportModal] = useState(false)

  const {
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
  } = useSocket()

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY)
    setConsented(stored === 'true')
    const savedTab = localStorage.getItem(TAB_KEY)
    if (savedTab === 'larp' || savedTab === 'human') setTab(savedTab as Tab)
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
    <div className="h-dvh flex overflow-hidden" style={{ background: '#e8e8e8' }}>
      {/* Left ad column — PC only */}
      <div className="flex-1 hidden md:flex items-start justify-end pt-4 pr-4">
        <div className="sticky top-4 w-[160px]">
          <AdSlot className="min-h-[250px]" />
        </div>
      </div>

      {/* Center content */}
      <div
        className="flex flex-col relative w-full md:w-[620px] md:flex-none overflow-hidden"
        style={{ background: '#f9f9f9' }}
      >
      {!consented && <EntryGate onEnter={handleEnter} />}

      {/* Tabs */}
      <div className="flex items-center border-b-2 border-gray-200" style={{ background: '#f0f0f0' }}>
        <button
          onClick={() => { setTab('human'); localStorage.setItem(TAB_KEY, 'human') }}
          className="flex-1 py-4 text-base font-medium transition-colors"
          style={{
            background: tab === 'human' ? '#c8dfc8' : '#f0f0f0',
          }}
        >
          普通人
        </button>
        <button
          onClick={() => { setTab('larp'); localStorage.setItem(TAB_KEY, 'larp') }}
          className="flex-1 py-4 text-base font-medium transition-colors"
          style={{
            background: tab === 'larp' ? '#e8e0f0' : '#f8f8f8',
          }}
        >
          扮演 AI
        </button>

        <div
          className="shrink-0 flex flex-col items-center px-2 py-1 mx-2 rounded border border-gray-800 leading-tight"
          style={{ background: '#fde68a', color: '#1a1a1a' }}
        >
          <span className="text-[10px] opacity-60">积分</span>
          <span className="text-xs font-mono font-bold">{credits}/6</span>
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

      {/* Site header — only when there's chat history */}
      {answerHistory.length > 0 && <div className="flex items-center px-4 py-3 border-b border-gray-200" style={{ background: '#f0f0f0' }}>
        <div className="flex items-center gap-2 flex-1">
          <ScribbleHeaderIcon />
          <span className="text-base font-bold tracking-tight">假扮 AI</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowExportModal(true)}
            className="px-3 py-1.5 text-xs rounded-lg border-2 border-gray-800 font-medium"
            style={{ boxShadow: '2px 2px 0 #1a1a1a', background: '#fff' }}
          >
            导出图片
          </button>
          <button
            onClick={() => { if (confirm('确定清空所有对话历史？')) clearHistory() }}
            className="px-3 py-1.5 text-xs rounded-lg border-2 border-gray-300 font-medium text-gray-500"
          >
            清空
          </button>
        </div>
      </div>}

      {/* Tab content */}
      <div className="flex flex-col flex-1 min-h-0">
        {tab === 'human' ? (
          <HumanTab
            credits={credits}
            lastRefillAt={lastRefillAt}
            pendingPrompt={pendingPrompt}
            answerHistory={answerHistory}
            onSubmit={submitPrompt}
            onCancel={cancelPrompt}
            onVote={(promptId, v) => vote(promptId, v)}
            onReport={report}
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

      {/* Mobile ad slot — above footer */}
      <div className="md:hidden border-t border-gray-200 px-2 py-2">
        <AdSlot className="min-h-[50px]" />
      </div>

      {/* Footer */}
      <div className="text-center py-3 text-xs text-gray-400 border-t border-gray-100">
        <p>
          {onlineCount.total} 人在线（{onlineCount.human} 普通人 · {onlineCount.ai} AI）
        </p>
        <p className="mt-0.5">人类会犯错，这正是人类独特的地方</p>
      </div>

      {/* Export modal */}
      {showExportModal && (
        <ExportModal
          answerHistory={answerHistory}
          onClose={() => setShowExportModal(false)}
        />
      )}
      </div>{/* end center content */}

      {/* Right ad column — PC only */}
      <div className="flex-1 hidden md:flex items-start justify-start pt-4 pl-4">
        <div className="sticky top-4 w-[160px]">
          <AdSlot className="min-h-[250px]" />
        </div>
      </div>
    </div>
  )
}

function ScribbleHeaderIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M60 20 C40 20, 20 35, 25 55 C30 75, 50 80, 70 75 C90 70, 100 55, 95 40 C90 25, 75 15, 60 20 Z" stroke="#1a1a1a" strokeWidth="2.5" fill="none" />
      <path d="M45 45 C50 40, 60 38, 70 42 C80 46, 85 55, 80 65 C75 75, 60 78, 50 72 C40 66, 38 55, 45 45 Z" stroke="#1a1a1a" strokeWidth="2" fill="none" />
      <path d="M55 52 C58 48, 65 47, 70 52 C75 57, 73 65, 68 68 C63 71, 56 69, 53 64 C50 59, 52 56, 55 52 Z" stroke="#1a1a1a" strokeWidth="1.5" fill="none" />
    </svg>
  )
}

function ExportModal({ answerHistory, onClose }: { answerHistory: ReceivedAnswer[]; onClose: () => void }) {
  const imageAnswers = answerHistory.filter(a => a.answerType === 'image')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleExport = () => {
    const toExport = imageAnswers.filter(a => selected.has(a.promptId))
    toExport.forEach((item, i) => {
      const link = document.createElement('a')
      link.href = item.content
      link.download = `jiaban-ai-${i + 1}.png`
      link.click()
    })
    onClose()
  }

  return (
    <div
      className="absolute inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl p-5 w-[90%] max-w-sm flex flex-col gap-4"
        style={{ border: '2px solid #1a1a1a', boxShadow: '4px 4px 0 #1a1a1a', maxHeight: '80vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="font-bold text-base">选择图片导出</span>
          <button onClick={onClose} className="text-gray-400 text-xl leading-none">×</button>
        </div>

        {imageAnswers.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">历史记录中暂无图片答案</p>
        ) : (
          <>
            <div className="overflow-y-auto flex flex-col gap-3" style={{ maxHeight: '50vh' }}>
              {imageAnswers.map(item => (
                <div
                  key={item.promptId}
                  onClick={() => toggle(item.promptId)}
                  className="flex gap-3 items-start p-2 rounded-xl cursor-pointer border-2 transition-all"
                  style={{
                    borderColor: selected.has(item.promptId) ? '#1a1a1a' : '#e5e7eb',
                    background: selected.has(item.promptId) ? '#fde68a22' : '#fff',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.content} alt={item.promptText} className="w-20 h-14 object-cover rounded-lg border border-gray-200 shrink-0" />
                  <div className="flex flex-col gap-1 min-w-0">
                    <p className="text-xs text-gray-500 leading-snug line-clamp-3">{item.promptText}</p>
                    <div
                      className="w-5 h-5 rounded border-2 flex items-center justify-center shrink-0"
                      style={{ borderColor: selected.has(item.promptId) ? '#1a1a1a' : '#d0d0d0', background: selected.has(item.promptId) ? '#1a1a1a' : '#fff' }}
                    >
                      {selected.has(item.promptId) && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={handleExport}
              disabled={selected.size === 0}
              className="w-full py-3 rounded-xl text-sm font-medium text-white transition-all"
              style={{ background: selected.size > 0 ? '#1a1a1a' : '#d0d0d0' }}
            >
              导出 {selected.size > 0 ? `${selected.size} 张` : ''}图片
            </button>
          </>
        )}
      </div>
    </div>
  )
}
