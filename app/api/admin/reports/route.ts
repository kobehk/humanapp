import { NextRequest, NextResponse } from 'next/server'
import { loadReports } from '@/lib/data-store'
import { loadBans } from '@/lib/data-store'

function checkAuth(req: NextRequest) {
  const token = req.headers.get('x-admin-token')
  return token === process.env.ADMIN_TOKEN
}

// GET /api/admin/reports — list all reports with current ban status
export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const reports = loadReports()
  const bans = loadBans()
  const now = Date.now()
  const activeBans = new Set(bans.filter((b) => b.expiresAt > now).map((b) => b.userId))

  const data = reports.map((r) => ({
    ...r,
    reporterBanned: activeBans.has(r.reporterUserId),
  }))

  return NextResponse.json(data)
}
