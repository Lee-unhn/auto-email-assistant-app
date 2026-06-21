import os from 'os'
import path from 'path'
import { promises as fs } from 'fs'
import { BrowserWindow, Notification } from 'electron'
import { listAppCalendar } from '../src/calendar/appCalendar'
import { writeJsonAtomic } from '../src/util/atomicWrite'
import { loadSettings } from './state'

// Fires a desktop "alarm" notification before each calendar event, at every
// configured lead time (reminders[] minutes). Tracks which (event,lead) pairs have
// already fired so it never repeats. Checks once a minute.

const FIRED_FILE = path.join(os.homedir(), '.auto-email-assistant-reminders.json')
let fired: Set<string> | null = null

async function loadFired(): Promise<Set<string>> {
  if (fired) return fired
  try { fired = new Set<string>(JSON.parse(await fs.readFile(FIRED_FILE, 'utf-8'))) }
  catch { fired = new Set<string>() }
  return fired
}

const clean = (s: string) => s.replace(/^\[自動[^\]]*\]\s*/, '')

async function tick(getWin: () => BrowserWindow | null): Promise<void> {
  const settings = await loadSettings()
  if (!settings.remindersEnabled) return
  if (!Notification.isSupported()) return

  const events = await listAppCalendar()
  const now = Date.now()
  const set = await loadFired()
  let changed = false

  for (const e of events) {
    const start = new Date(e.startISO).getTime()
    if (Number.isNaN(start)) continue
    const leads = e.reminders?.length ? e.reminders : [0]
    for (const m of leads) {
      const trigger = start - m * 60_000
      const key = `${e.id}:${m}`
      // Fire once when the lead time is reached, up to 2 min after the event start
      // (so a closed-then-reopened app still surfaces a just-missed alarm, but old
      // past events never spam on startup).
      if (now >= trigger && now < start + 120_000 && !set.has(key)) {
        set.add(key)
        changed = true
        const minsLeft = Math.round((start - now) / 60_000)
        const when = e.startISO.slice(11, 16)
        const title = clean(e.summary)
        const body = minsLeft > 0 ? `${minsLeft} 分鐘後（${when}）：${title}` : `現在（${when}）：${title}`
        const n = new Notification({ title: '⏰ 行事曆提醒', body })
        n.on('click', () => { const w = getWin(); if (w) { w.show(); w.focus() } })
        n.show()
      }
    }

    // Travel-time "leave by" alarm: fire (travelMin + 10 min buffer) before start.
    if (typeof e.travelMin === 'number' && e.travelMin > 0) {
      const lead = e.travelMin + 10
      const trigger = start - lead * 60_000
      const key = `${e.id}:leave`
      if (now >= trigger && now < start + 120_000 && !set.has(key)) {
        set.add(key)
        changed = true
        const where = clean(e.location || e.summary)
        const n = new Notification({ title: '🚗 該出發了', body: `到「${where}」約需 ${e.travelMin} 分鐘車程（${e.startISO.slice(11, 16)} 開始）` })
        n.on('click', () => { const w = getWin(); if (w) { w.show(); w.focus() } })
        n.show()
      }
    }
  }

  // Prune fired keys for events that are well in the past (keep the file small).
  if (set.size > 500) { fired = new Set([...set].slice(-300)); changed = true }
  if (changed) await saveFired()
}

async function saveFired(): Promise<void> {
  if (fired) await writeJsonAtomic(FIRED_FILE, [...fired])
}

export function startReminderScheduler(getWin: () => BrowserWindow | null): void {
  setTimeout(() => { tick(getWin).catch(() => {}) }, 5_000) // shortly after launch
  setInterval(() => { tick(getWin).catch(() => {}) }, 60_000) // every minute
}
