import { promises as fs } from 'fs'
import path from 'path'
import type { ExtractedEvent } from '../types'

// Real, OAuth-free calendar output: an .ics file with a VALARM per advance reminder.
// Importable into Google Calendar / Outlook / Apple Calendar.

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

// Format a local wall-clock ISO ("2026-07-02T20:00:00") as a floating local time
// stamp with TZID. We keep it simple/portable using local datetime + TZID param.
function fmtLocal(iso: string): string {
  const d = new Date(iso)
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  )
}

function fmtUtcStamp(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T` +
    `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  )
}

function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

export function buildICS(ev: ExtractedEvent, nowUtcStamp: string): string {
  const uid = `${Date.now()}-${Math.abs(hash(ev.summary + ev.startISO))}@auto-email-assistant`
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//auto-email-assistant//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${nowUtcStamp}`,
    `DTSTART;TZID=${ev.timeZone}:${fmtLocal(ev.startISO)}`,
    `DTEND;TZID=${ev.timeZone}:${fmtLocal(ev.endISO)}`,
    `SUMMARY:${esc(ev.summary)}`,
    `DESCRIPTION:${esc(ev.sourceNote)}`
  ]
  for (const min of ev.reminders) {
    lines.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${esc(ev.summary)}`,
      `TRIGGER:-PT${min}M`,
      'END:VALARM'
    )
  }
  lines.push('END:VEVENT', 'END:VCALENDAR')
  return lines.join('\r\n')
}

export async function writeICS(dir: string, ev: ExtractedEvent): Promise<string> {
  await fs.mkdir(dir, { recursive: true })
  const ics = buildICS(ev, fmtUtcStamp(new Date()))
  const safe = ev.summary.replace(/[^\p{L}\p{N} _-]/gu, '_').slice(0, 60) || 'event'
  const file = path.join(dir, `${fmtLocal(ev.startISO)}_${safe}.ics`)
  await fs.writeFile(file, ics, 'utf-8')
  return file
}

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return h
}
