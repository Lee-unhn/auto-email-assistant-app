// Verify the private app calendar store (no LLM).
import { addAppCalendarEvent, listAppCalendar } from './src/calendar/appCalendar.ts'
async function main() {
  const r1 = await addAppCalendarEvent({ summary: '[自動·待確認] 測試會議', startISO: '2026-07-02T20:00:00', endISO: '2026-07-02T21:00:00', timeZone: 'Asia/Taipei', reminders: [1440, 60], sourceNote: '測試來源' })
  const r2 = await addAppCalendarEvent({ summary: '[自動·待確認] 測試會議', startISO: '2026-07-02T20:00:00', endISO: '2026-07-02T21:00:00', timeZone: 'Asia/Taipei', reminders: [1440, 60], sourceNote: '測試來源' })
  console.log('first add:', r1.status, '| duplicate add:', r2.status, '(應為 merged=合併成功)')
  const all = await listAppCalendar()
  console.log('app 私密行事曆事件數:', all.length)
  process.exit(0)
}
main().catch((e) => { console.error('ERR', e?.message ?? e); process.exit(1) })
