import type { EmailThread, ExtractedEvent } from '../types'
import { extractJson } from '../llm'
import { AgentCtx, threadText } from './types'

interface RawEvent extends Partial<ExtractedEvent> {}

function normalize(e: RawEvent): ExtractedEvent | null {
  if (!e || !e.startISO || !e.summary) return null
  // Drop events with an unparseable date — otherwise they silently bypass
  // conflict detection (overlaps() would see NaN and never flag them).
  if (Number.isNaN(Date.parse(e.startISO))) return null
  const endValid = e.endISO && !Number.isNaN(Date.parse(e.endISO))
  return {
    summary: e.summary.startsWith('[自動') ? e.summary : `[自動·待確認] ${e.summary}`,
    startISO: e.startISO,
    endISO: endValid ? (e.endISO as string) : e.startISO,
    timeZone: e.timeZone ?? 'Asia/Taipei',
    reminders: e.reminders?.length ? e.reminders : [1440, 60],
    sourceNote: e.sourceNote ?? '由 auto-email-assistant 從信件自動建立。不需要可刪。',
    location: typeof e.location === 'string' && e.location.trim() ? e.location.trim() : undefined
  }
}

// Extract ALL clearly-schedulable events from one email (meetings, info sessions,
// deadlines, appointments, dinners). Returns [] if none. Handles "weekly schedule"
// emails that contain several items.
export async function extractEvents(thread: EmailThread, ctx: AgentCtx): Promise<ExtractedEvent[]> {
  ctx.emit({ agent: 'EventExtractor', status: 'start', message: '抽取所有日期/時間…' })
  const system = `你是行事曆事件抽取器。今天是 ${ctx.today}（Asia/Taipei）。抽出信中「所有明確、可排程」的事件（會議、說明會、截止日、約診、聚餐等）。一封信可能有多個（如「一週行程」）。沒有任何明確日期就回空陣列 []。`
  const user = `從郵件抽出所有事件。每個 summary 前綴「[自動·待確認]」。startISO/endISO 用本地牆鐘時間不帶時區（例 2026-07-02T20:00:00）。reminders 用分鐘陣列（預設 [1440,60]）。sourceNote 寫來源寄件人+主旨+「不需要可刪」。location 填實體地點或地址（用於估算車程）；線上會議或無地點就留空字串。\n\n郵件：\n${threadText(
    thread.messages
  )}\n\n只回 JSON 陣列：[{"summary","startISO","endISO","timeZone":"Asia/Taipei","reminders":[1440,60],"sourceNote","location":""}, ...]（沒有則回 []）`
  try {
    const r = await ctx.llm.complete({ system, user, json: true, maxTokens: 1500 })
    const parsed = extractJson<any>(r.text)
    const raw: RawEvent[] = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.events) ? parsed.events : []
    const events = raw.map(normalize).filter((e): e is ExtractedEvent => e !== null).slice(0, 15)
    ctx.emit({
      agent: 'EventExtractor',
      status: events.length ? 'done' : 'skip',
      message: events.length ? `抽到 ${events.length} 個事件` : '無明確日期'
    })
    return events
  } catch (e: any) {
    ctx.emit({ agent: 'EventExtractor', status: 'error', message: e?.message ?? 'extract failed' })
    return []
  }
}
