import { useEffect, useState } from 'react'
import type { CalEvent } from '../../calendar/appCalendar'

function ov(a: CalEvent, b: CalEvent): boolean {
  const as = +new Date(a.startISO), bs = +new Date(b.startISO)
  let ae = +new Date(a.endISO), be = +new Date(b.endISO)
  if ([as, bs, ae, be].some((n) => Number.isNaN(n))) return false
  if (ae <= as) ae = as + 60000
  if (be <= bs) be = bs + 60000
  return as < be && ae > bs
}
const norm = (s: string) => s.replace(/\[自動[^\]]*\]/g, '').replace(/[\s\p{P}\p{S}]/gu, '').toLowerCase()
function sameMeeting(a: string, b: string): boolean {
  const x = norm(a), y = norm(b)
  if (!x || !y) return false
  if (x === y) return true
  if (x.length < 4 || y.length < 4) return false
  if (x.includes(y) || y.includes(x)) return true
  const sa = new Set(x), sb = new Set(y)
  let i = 0
  for (const c of sa) if (sb.has(c)) i++
  return i / (sa.size + sb.size - i) >= 0.7
}

export function CalendarView() {
  const [events, setEvents] = useState<CalEvent[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    window.api.listCalendar().then((e) => { setEvents(e); setLoading(false) })
  }, [])

  const cutoff = Date.now() - 12 * 3600_000
  const upcoming = events.filter((e) => new Date(e.startISO).getTime() >= cutoff)
  // client-side conflict detection: overlapping + different meeting
  const conflictIds = new Set<string>()
  for (let i = 0; i < upcoming.length; i++)
    for (let j = i + 1; j < upcoming.length; j++)
      if (ov(upcoming[i], upcoming[j]) && !sameMeeting(upcoming[i].summary, upcoming[j].summary)) {
        conflictIds.add(upcoming[i].id)
        conflictIds.add(upcoming[j].id)
      }
  const groups: Record<string, CalEvent[]> = {}
  for (const e of upcoming) {
    const day = e.startISO.slice(0, 10)
    ;(groups[day] ||= []).push(e)
  }
  const days = Object.keys(groups).sort()

  return (
    <div style={{ maxWidth: 760 }}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <span className="badge"><span className="swatch" style={{ background: '#27a644' }} />私密 · 只存本機</span>
        <span className="meta">{events.length} 個事件 · 顯示近期</span>
      </div>
      {loading ? (
        <div className="muted">載入中…</div>
      ) : !days.length ? (
        <div className="card muted">目前沒有近期事件。分流郵件後,含日期的事項會自動排進這裡(私密,不會上 Google)。</div>
      ) : (
        days.map((day) => (
          <div key={day} style={{ marginBottom: 14 }}>
            <div className="section-title" style={{ marginTop: 0 }}>{day}</div>
            {groups[day].map((e) => (
              <div className="card" key={e.id} style={{ marginBottom: 8, borderColor: conflictIds.has(e.id) ? 'var(--danger)' : undefined }}>
                <div style={{ fontWeight: 600 }}>
                  {conflictIds.has(e.id) && <span style={{ color: 'var(--danger)' }}>⚠ 衝突 </span>}
                  {e.summary}
                </div>
                <div className="meta" style={{ marginTop: 4 }}>
                  {e.startISO.slice(11, 16)}–{e.endISO.slice(11, 16)} ({e.timeZone}) · 提前提醒 {e.reminders.map((m) => (m >= 60 ? `${m / 60}h` : `${m}m`)).join(' / ')} · 來源 {e.source}
                </div>
                {e.description && <div className="meta" style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{e.description.slice(0, 200)}</div>}
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  )
}
