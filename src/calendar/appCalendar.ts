import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import type { ExtractedEvent } from '../types'
import { writeJsonAtomic } from '../util/atomicWrite'

// App-internal PRIVATE calendar (local JSON, never leaves the machine).
// This is the DEFAULT calendar target — keeps private events local when a Google
// Calendar may be public/shared. Google Calendar sync is opt-in & separate.
export interface CalEvent {
  id: string
  summary: string
  startISO: string
  endISO: string
  timeZone: string
  reminders: number[]
  description: string
  source: string
  createdAt: string
}

const FILE = path.join(os.homedir(), '.auto-email-assistant-calendar.json')

async function read(): Promise<CalEvent[]> {
  try {
    return JSON.parse(await fs.readFile(FILE, 'utf-8')).events ?? []
  } catch {
    return []
  }
}
async function write(events: CalEvent[]): Promise<void> {
  await writeJsonAtomic(FILE, { events })
}

// ── time-overlap + same-meeting heuristics ──────────────────────────
export function overlaps(a: { startISO: string; endISO: string }, b: { startISO: string; endISO: string }): boolean {
  const as = new Date(a.startISO).getTime(), bs = new Date(b.startISO).getTime()
  let ae = new Date(a.endISO).getTime(), be = new Date(b.endISO).getTime()
  if ([as, bs, ae, be].some((n) => Number.isNaN(n))) return false
  // Give zero-duration (deadline/point) events a 1-min window so they still
  // participate in conflict/merge detection instead of never overlapping.
  if (ae <= as) ae = as + 60_000
  if (be <= bs) be = bs + 60_000
  return as < be && ae > bs
}

function norm(s: string): string {
  return s.replace(/\[自動[^\]]*\]/g, '').replace(/[\s\p{P}\p{S}]/gu, '').toLowerCase()
}

// Same meeting? (handles LLM rewording like 與/跟, sub-phrases, etc.)
export function sameMeeting(a: string, b: string): boolean {
  const x = norm(a), y = norm(b)
  if (!x || !y) return false
  if (x === y) return true
  // very short titles (晨會 vs 晨跑) → require exact match, no fuzzy merge
  if (x.length < 4 || y.length < 4) return false
  if (x.includes(y) || y.includes(x)) return true
  const sa = new Set(x), sb = new Set(y)
  let inter = 0
  for (const c of sa) if (sb.has(c)) inter++
  const jaccard = inter / (sa.size + sb.size - inter)
  return jaccard >= 0.7
}

export type AddStatus = 'added' | 'merged' | 'conflict'

// Add with conflict awareness:
//  - overlapping + same meeting → MERGE (no duplicate; union reminders)
//  - overlapping + different meeting → ADD but report conflicts (caller notifies)
//  - no overlap → ADD
export async function addAppCalendarEvent(
  ev: ExtractedEvent,
  source = 'email'
): Promise<{ status: AddStatus; event: CalEvent; conflicts: CalEvent[] }> {
  const events = await read()
  const overlapping = events.filter((e) => overlaps(ev, e))
  const same = overlapping.find((e) => sameMeeting(e.summary, ev.summary))
  if (same) {
    // merge reminders (union) into the existing record; keep the longer summary
    const merged = Array.from(new Set([...same.reminders, ...ev.reminders])).sort((a, b) => b - a)
    same.reminders = merged
    if (ev.summary.length > same.summary.length) same.summary = ev.summary
    await write(events)
    return { status: 'merged', event: same, conflicts: [] }
  }
  const rec: CalEvent = {
    id: `${Date.now()}-${Math.abs((Math.random() * 1e9) | 0).toString(36)}`,
    summary: ev.summary,
    startISO: ev.startISO,
    endISO: ev.endISO,
    timeZone: ev.timeZone,
    reminders: ev.reminders,
    description: ev.sourceNote,
    source,
    createdAt: new Date().toISOString()
  }
  events.push(rec)
  await write(events)
  // overlapping (and not same) = genuine schedule conflicts
  return { status: overlapping.length ? 'conflict' : 'added', event: rec, conflicts: overlapping }
}

// Merge existing same-meeting duplicates already in the calendar. Returns # merged.
export async function reconcileCalendar(): Promise<number> {
  const events = (await read()).sort((a, b) => a.startISO.localeCompare(b.startISO))
  const kept: CalEvent[] = []
  let merged = 0
  for (const e of events) {
    const hit = kept.find((k) => overlaps(k, e) && sameMeeting(k.summary, e.summary))
    if (hit) {
      hit.reminders = Array.from(new Set([...hit.reminders, ...e.reminders])).sort((a, b) => b - a)
      if (e.summary.length > hit.summary.length) hit.summary = e.summary
      merged++
      continue
    }
    kept.push(e)
  }
  if (merged) await write(kept)
  return merged
}

// List genuine conflicts (overlapping, different meetings) for warnings/UI.
export async function listConflicts(): Promise<Array<[CalEvent, CalEvent]>> {
  const events = await listAppCalendar()
  const out: Array<[CalEvent, CalEvent]> = []
  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      if (overlaps(events[i], events[j]) && !sameMeeting(events[i].summary, events[j].summary)) {
        out.push([events[i], events[j]])
      }
    }
  }
  return out
}

export async function listAppCalendar(): Promise<CalEvent[]> {
  const events = await read()
  return events.sort((a, b) => a.startISO.localeCompare(b.startISO))
}

export async function upcoming(withinDays = 14, fromISO?: string): Promise<CalEvent[]> {
  const now = fromISO ? new Date(fromISO) : new Date()
  const until = new Date(now.getTime() + withinDays * 86400000)
  return (await listAppCalendar()).filter((e) => {
    const t = new Date(e.startISO)
    return t >= now && t <= until
  })
}
