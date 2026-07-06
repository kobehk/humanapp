'use client'

import { useState, useEffect, useCallback } from 'react'

const TOKEN_KEY = 'jiaban_ui_pref_v2'

interface ReportItem {
  promptId: string
  promptText: string
  answerContent: string
  reportedAt: number
  reporterUserId: string
  answererUserId: string
  reporterBanned: boolean
}

interface BanItem {
  userId: string
  bannedAt: number
  expiresAt: number
  reason: string
}

export default function AdminPage() {
  const [token, setToken] = useState('')
  const [authed, setAuthed] = useState(false)
  const [reports, setReports] = useState<ReportItem[]>([])
  const [bans, setBans] = useState<BanItem[]>([])
  const [error, setError] = useState('')
  const [banningId, setBanningId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = useCallback(async (t: string) => {
    const [rRes, bRes] = await Promise.all([
      fetch('/api/admin/reports', { headers: { 'x-admin-token': t } }),
      fetch('/api/admin/ban', { headers: { 'x-admin-token': t } }),
    ])
    if (!rRes.ok) return false
    setReports(await rRes.json())
    if (bRes.ok) setBans(await bRes.json())
    return true
  }, [])

  // Restore session on mount
  useEffect(() => {
    const saved = sessionStorage.getItem(TOKEN_KEY)
    if (!saved) return
    setToken(saved)
    fetchData(saved).then((ok) => {
      if (ok) setAuthed(true)
      else sessionStorage.removeItem(TOKEN_KEY)
    })
  }, [fetchData])

  async function login() {
    const ok = await fetchData(token)
    if (!ok) { setError('Token 错误'); return }
    sessionStorage.setItem(TOKEN_KEY, token)
    setAuthed(true)
    setError('')
  }

  async function refresh() {
    setRefreshing(true)
    await fetchData(token)
    setRefreshing(false)
  }

  async function handleBan(userId: string, reason: string) {
    setBanningId(userId)
    await fetch('/api/admin/ban', {
      method: 'POST',
      headers: { 'x-admin-token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, reason }),
    })
    await fetchData(token)
    setBanningId(null)
  }

  const activeBanSet = new Set(bans.filter(b => b.expiresAt > Date.now()).map(b => b.userId))

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f0f0f0' }}>
        <div className="bg-white rounded-2xl p-8 shadow-sm w-80 flex flex-col gap-4">
          <h1 className="text-xl font-bold">管理后台</h1>
          <input
            type="password"
            placeholder="Admin Token"
            value={token}
            onChange={e => setToken(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && login()}
            className="border-2 border-gray-200 rounded-xl px-4 py-2 outline-none focus:border-gray-800"
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            onClick={login}
            className="bg-gray-900 text-white rounded-xl py-2 font-medium"
          >
            登录
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6" style={{ background: '#f0f0f0' }}>
      <div className="max-w-3xl mx-auto flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">举报列表</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">{reports.length} 条举报 · {activeBanSet.size} 个封禁中</span>
            <button
              onClick={refresh}
              disabled={refreshing}
              className="text-sm px-3 py-1.5 rounded-xl border-2 border-gray-800 font-medium disabled:opacity-40"
            >
              {refreshing ? '刷新中...' : '刷新'}
            </button>
          </div>
        </div>

        {reports.length === 0 && (
          <p className="text-gray-400 text-center py-12">暂无举报</p>
        )}

        {[...reports].reverse().map((r) => (
          <div key={r.promptId + r.reportedAt} className="bg-white rounded-2xl p-5 flex flex-col gap-3 shadow-sm">
            <div className="text-xs text-gray-400">{new Date(r.reportedAt).toLocaleString('zh-CN')}</div>

            <div className="flex gap-2 items-start">
              <span className="text-xs text-gray-400 mt-0.5 w-8 shrink-0">问题</span>
              <p className="text-sm">{r.promptText}</p>
            </div>

            <div className="flex gap-2 items-start">
              <span className="text-xs text-gray-400 mt-0.5 w-8 shrink-0">回答</span>
              <div className="text-sm flex-1">
                {r.answerContent.startsWith('data:image') ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.answerContent} alt="answer" className="max-w-xs rounded-lg border" />
                ) : (
                  <p>{r.answerContent}</p>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-1 border-t border-gray-100 flex-wrap">
              <div className="flex flex-col gap-1 flex-1">
                <span className="text-xs text-gray-400">回答者 <code className="bg-gray-100 px-1 rounded">{r.answererUserId || '未知'}</code></span>
                <div className="flex gap-2">
                  {r.answererUserId ? (
                    activeBanSet.has(r.answererUserId) ? (
                      <span className="text-xs text-orange-500 px-3 py-1 rounded-lg border border-orange-200">已封禁</span>
                    ) : (
                      <button
                        disabled={banningId === r.answererUserId}
                        onClick={() => handleBan(r.answererUserId, r.promptId)}
                        className="text-xs px-3 py-1 rounded-lg border-2 border-red-400 text-red-500 disabled:opacity-40"
                      >
                        {banningId === r.answererUserId ? '处理中...' : '封禁回答者 1天'}
                      </button>
                    )
                  ) : (
                    <span className="text-xs text-gray-300">无法封禁（答题者未记录）</span>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-xs text-gray-400">举报者 <code className="bg-gray-100 px-1 rounded">{r.reporterUserId}</code></span>
                <div className="flex gap-2">
                  {activeBanSet.has(r.reporterUserId) ? (
                    <span className="text-xs text-orange-500 px-3 py-1 rounded-lg border border-orange-200">已封禁</span>
                  ) : (
                    <button
                      disabled={banningId === r.reporterUserId}
                      onClick={() => handleBan(r.reporterUserId, r.promptId)}
                      className="text-xs px-3 py-1 rounded-lg border border-gray-300 text-gray-500 disabled:opacity-40"
                    >
                      {banningId === r.reporterUserId ? '处理中...' : '封禁举报者 1天'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
