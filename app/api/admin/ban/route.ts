import { NextRequest, NextResponse } from 'next/server'
import { banUser, loadBans } from '@/lib/data-store'

function checkAuth(req: NextRequest) {
  const token = req.headers.get('x-admin-token')
  return token === process.env.ADMIN_TOKEN
}

// POST /api/admin/ban  body: { userId, reason }
export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { userId, reason } = await req.json()
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  banUser(userId, reason ?? '')
  return NextResponse.json({ ok: true, expiresAt: Date.now() + 24 * 60 * 60 * 1000 })
}

// GET /api/admin/ban  — list active bans
export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now = Date.now()
  const active = loadBans().filter((b) => b.expiresAt > now)
  return NextResponse.json(active)
}
