import type { TriageRun } from '../types'

// Pure: build a self-notification digest from a triage run.
export function buildDigestText(run: TriageRun): { subject: string; text: string } {
  const conflicts = run.outcomes.filter((o) => o.conflictNote)
  const high = run.outcomes.filter((o) => o.classification?.urgency === 'high')
  const flags = run.outcomes.filter((o) => o.flagNote)
  const events = run.outcomes.flatMap((o) => o.events ?? [])
  const drafts = run.outcomes.filter((o) => o.draft)
  const L: string[] = []
  L.push(`郵件助理摘要 · ${run.startedAt.slice(0, 16).replace('T', ' ')} · 引擎 ${run.provider}`)
  L.push('')
  if (conflicts.length) {
    L.push('⚠⚠ 行事曆時段衝突（請優先處理，避免會議重疊耽誤工作）：')
    for (const c of conflicts) L.push(`  • ${c.conflictNote}`)
    L.push('')
  }
  if (high.length) {
    L.push('🔴 高優先（需盡快看）：')
    for (const h of high) L.push(`  • ${h.subject}（${h.from}）`)
    L.push('')
  }
  if (flags.length) {
    L.push('⚠ 需你親自看（只通知，未動作）：')
    for (const f of flags) L.push(`  • ${f.subject} — ${f.flagNote}`)
    L.push('')
  }
  if (events.length) {
    L.push('📅 已建行事曆事件（待確認，含提前提醒）：')
    for (const ev of events) L.push(`  • ${ev.summary} @ ${ev.startISO}`)
    L.push('')
  }
  if (drafts.length) {
    L.push('✍ 待你確認的回信草稿（已存草稿，未寄）：')
    for (const d of drafts) L.push(`  • ${d.subject}`)
    L.push('')
  }
  L.push('分類統計：' + Object.entries(run.stats).map(([k, v]) => `${k} ${v}`).join(' / '))
  L.push('')
  L.push('（本信由 auto-email-assistant 自動寄給你本人作為摘要通知；回覆此信不會被處理。）')
  return {
    subject: `📧 郵件助理摘要 ${run.startedAt.slice(0, 10)} · ${conflicts.length ? `⚠衝突${conflicts.length} · ` : ''}${high.length ? `🔴高優先${high.length} · ` : ''}事件${events.length}/旗標${flags.length}/草稿${drafts.length}`,
    text: L.join('\n')
  }
}
