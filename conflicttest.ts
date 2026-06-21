// Verify conflict/merge logic + clean existing duplicates in the real calendar.
import { overlaps, sameMeeting, reconcileCalendar, listConflicts, listAppCalendar } from './src/calendar/appCalendar.ts'

async function main() {
  console.log('— 邏輯測試 —')
  console.log('  同會議(與/跟):', sameMeeting('[自動·待確認] 占暉與OC會議 (Maillsa, Otto)', '[自動·待確認] 占暉跟OC會議 (Maillsa, Otto)'), '(應 true→合併)')
  console.log('  不同會議    :', sameMeeting('六赫茲週會', '牙醫複診'), '(應 false→衝突)')
  console.log('  同時段重疊  :', overlaps({ startISO: '2026-06-22T09:00:00', endISO: '2026-06-22T10:00:00' }, { startISO: '2026-06-22T09:30:00', endISO: '2026-06-22T10:30:00' }), '(應 true)')

  console.log('— 清理現有重複 —')
  const m = await reconcileCalendar()
  console.log('  合併重複會議:', m, '筆')

  const conf = await listConflicts()
  console.log('  現存時段衝突(不同會議重疊):', conf.length, '組')
  for (const [a, b] of conf) console.log(`    ⚠ ${a.startISO}「${a.summary}」 vs 「${b.summary}」`)

  console.log('  行事曆事件數:', (await listAppCalendar()).length)
  process.exit(0)
}
main().catch((e) => { console.error('ERR', e?.message ?? e); process.exit(1) })
