import type { ExtractedEvent } from '../types'

// Auto-write an event into the user's Google Calendar via their Apps Script webhook
// (zero OAuth / zero Google Cloud). Returns ok + the created event link if available.
export async function postCalendarEvent(
  url: string,
  ev: ExtractedEvent
): Promise<{ ok: boolean; link?: string; error?: string }> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: ev.summary,
        startISO: ev.startISO,
        endISO: ev.endISO,
        timeZone: ev.timeZone,
        reminders: ev.reminders,
        description: ev.sourceNote
      })
    })
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` }
    const j: any = await res.json()
    return { ok: !!j.ok, link: j.url || j.htmlLink, error: j.error }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) }
  }
}
