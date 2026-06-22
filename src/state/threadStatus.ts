import os from 'os'
import path from 'path'
import { promises as fs } from 'fs'
import { writeJsonAtomic } from '../util/atomicWrite'

// Per-thread USER-action state (distinct from the processing ledger in queue/taskStore).
// Keyed by RFC Message-ID (stable across runs). Lets the user mark a thread handled or
// snooze it, and powers the "awaiting your reply" aging tracker. Local JSON, never leaves.
export type StatusKind = 'open' | 'handled' | 'snoozed'

export interface ThreadStatus {
  status: StatusKind
  snoozedUntil?: string // ISO; while in the future the thread is hidden
  updatedAt: string
}

const FILE = path.join(os.homedir(), '.auto-email-assistant-threadstatus.json')

export async function getThreadStatuses(): Promise<Record<string, ThreadStatus>> {
  try { return JSON.parse(await fs.readFile(FILE, 'utf-8')) } catch { return {} }
}

export async function setThreadStatus(id: string, patch: Partial<ThreadStatus>): Promise<Record<string, ThreadStatus>> {
  const all = await getThreadStatuses()
  const prev: ThreadStatus = all[id] ?? { status: 'open', updatedAt: '' }
  all[id] = { ...prev, ...patch, updatedAt: new Date().toISOString() }
  await writeJsonAtomic(FILE, all)
  return all
}

// Effective status now: a snooze whose time has passed reads as 'open' again.
export function effectiveStatus(s: ThreadStatus | undefined, nowMs = Date.now()): StatusKind {
  if (!s) return 'open'
  if (s.status === 'snoozed' && s.snoozedUntil && new Date(s.snoozedUntil).getTime() <= nowMs) return 'open'
  return s.status
}
