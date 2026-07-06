import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import type { Report } from './types'

const DATA_DIR = join(process.cwd(), 'data')
const REPORTS_FILE = join(DATA_DIR, 'reports.json')
const BANS_FILE = join(DATA_DIR, 'bans.json')

export interface Ban {
  userId: string
  bannedAt: number
  expiresAt: number
  reason: string       // promptId that triggered the ban
}

function ensureDataDir() {
  mkdirSync(DATA_DIR, { recursive: true })
}

export function loadReports(): Report[] {
  try {
    return JSON.parse(readFileSync(REPORTS_FILE, 'utf-8'))
  } catch {
    return []
  }
}

export function saveReport(report: Report) {
  ensureDataDir()
  const all = loadReports()
  all.push(report)
  writeFileSync(REPORTS_FILE, JSON.stringify(all, null, 2), 'utf-8')
}

export function loadBans(): Ban[] {
  try {
    return JSON.parse(readFileSync(BANS_FILE, 'utf-8'))
  } catch {
    return []
  }
}

export function isUserBanned(userId: string): boolean {
  const now = Date.now()
  return loadBans().some((b) => b.userId === userId && b.expiresAt > now)
}

export function banUser(userId: string, reason: string) {
  ensureDataDir()
  const bans = loadBans()
  const ban: Ban = {
    userId,
    bannedAt: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 1 day
    reason,
  }
  // replace existing ban for same user if any
  const idx = bans.findIndex((b) => b.userId === userId)
  if (idx !== -1) bans[idx] = ban
  else bans.push(ban)
  writeFileSync(BANS_FILE, JSON.stringify(bans, null, 2), 'utf-8')
}
