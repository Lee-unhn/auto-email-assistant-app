import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import type { TriageRun } from '../types'

// Email app = event PRODUCER. Jarvis = voice/notification SURFACE.
// Contract: drop one JSON file per event into a shared inbox dir. Jarvis's
// consumer (jarvis/src/email_events.py) reads, speaks via its own TTS, archives.
// Decoupled + durable: queues safely whether Jarvis is running or not.

export interface JarvisEvent {
  id: string
  ts: string // ISO
  source: 'auto-email-assistant'
  type: 'security' | 'finance' | 'deadline' | 'draft_pending' | 'summary' | 'conflict'
  urgency: 'high' | 'normal'
  title: string
  detail: string
  speak: string // ready-to-speak zh-TW line (Jarvis just voices it)
}

export function defaultEventsDir(): string {
  return path.join(os.homedir(), '.jarvis-events', 'inbox')
}

function rid(): string {
  return Math.abs((Date.now() ^ Math.floor(Math.random() * 1e9)) | 0).toString(36)
}

export async function emitEvent(ev: JarvisEvent, dir: string): Promise<string> {
  await fs.mkdir(dir, { recursive: true })
  const file = path.join(dir, `${ev.ts.replace(/[:.]/g, '-')}_${ev.id}.json`)
  await fs.writeFile(file, JSON.stringify(ev, null, 2), 'utf-8')
  return file
}

// Translate a triage run into Jarvis events. Only surfaces what's worth a voice
// nudge: security/finance flags (high), deadlines, pending drafts, + a summary.
export function eventsFromRun(run: TriageRun): JarvisEvent[] {
  const now = () => new Date().toISOString()
  const out: JarvisEvent[] = []
  for (const o of run.outcomes) {
    if (o.conflictNote) {
      out.push({
        id: rid(),
        ts: now(),
        source: 'auto-email-assistant',
        type: 'conflict',
        urgency: 'high',
        title: '行事曆時段衝突',
        detail: o.conflictNote,
        speak: `注意，行程衝突。${o.conflictNote}。請確認避免會議重疊耽誤工作。`
      })
    }
    if (o.flagNote) {
      const fin = o.classification.category === 'FLAG_FINANCE'
      out.push({
        id: rid(),
        ts: now(),
        source: 'auto-email-assistant',
        type: fin ? 'finance' : 'security',
        urgency: 'high',
        title: o.subject,
        detail: o.flagNote,
        speak: `提醒，有一封需要你親自確認的${fin ? '金流' : '安全'}信件：${o.subject}。${o.flagNote}`
      })
    } else if (o.events?.length) {
      for (const ev of o.events) {
        out.push({
          id: rid(),
          ts: now(),
          source: 'auto-email-assistant',
          type: 'deadline',
          urgency: 'normal',
          title: ev.summary,
          detail: `${ev.startISO} (${ev.timeZone})`,
          speak: `行事曆有新的待確認事項：${ev.summary}，時間 ${ev.startISO}。已幫你建好提前提醒。`
        })
      }
    } else if (o.draft) {
      out.push({
        id: rid(),
        ts: now(),
        source: 'auto-email-assistant',
        type: 'draft_pending',
        urgency: 'normal',
        title: o.subject,
        detail: '草稿已備妥，待你確認寄出',
        speak: `有一封回信草稿幫你寫好了，主旨「${o.subject}」，存在草稿匣等你確認。`
      })
    }
  }
  const flags = out.filter((e) => e.urgency === 'high').length
  const events = out.filter((e) => e.type === 'deadline').length
  const drafts = out.filter((e) => e.type === 'draft_pending').length
  out.push({
    id: rid(),
    ts: now(),
    source: 'auto-email-assistant',
    type: 'summary',
    urgency: 'normal',
    title: '郵件分流完成',
    detail: `flags ${flags} / events ${events} / drafts ${drafts}`,
    speak: `郵件分流跑完了。${flags} 件需要你看、${events} 個新行事曆事項、${drafts} 封草稿待確認。`
  })
  return out
}

export async function emitRunToJarvis(run: TriageRun, dir?: string): Promise<number> {
  const target = dir || defaultEventsDir()
  const evs = eventsFromRun(run)
  for (const ev of evs) await emitEvent(ev, target)
  return evs.length
}
