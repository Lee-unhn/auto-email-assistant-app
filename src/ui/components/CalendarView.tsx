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
        <div className="empty-state">
          <div className="ico">🗓</div>
          <div>目前沒有近期行程</div>
          <div className="hint">整理收件匣後，信裡有日期的事項會自動排到這裡（只存這台電腦，不會外流）。</div>
        </div>
      ) : (
        days.map((day) => (
          <div key={day} style={{ marginBottom: 14 }}>
            <div className="section-title" style={{ marginTop: 0 }}>{day}</div>
            {groups[day].map((e) => (
              <div className={`card${conflictIds.has(e.id) ? ' conflict' : ''}`} key={e.id} style={{ marginBottom: 8 }}>
                <div style={{ fontWeight: 590, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {conflictIds.has(e.id) && <span className="badge danger">⚠ 時段衝突</span>}
                  <span>{e.summary.replace(/^\[自動[^\]]*\]\s*/, '')}</span>
                  <span className="badge warn">待你確認</span>
                </div>
                <div className="meta" style={{ marginTop: 5 }}>
                  {e.startISO.slice(11, 16)}–{e.endISO.slice(11, 16)} · 提前提醒 {e.reminders.map((m) => (m >= 60 ? `${m / 60} 小時前` : `${m} 分鐘前`)).join('、')}
                </div>
                {e.description && <div className="meta" style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{e.description.replace(/^由 auto-email-assistant[^\n]*\n?/, '').slice(0, 200)}</div>}
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  )
}
