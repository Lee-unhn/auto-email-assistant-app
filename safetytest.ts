// Encodes the safety + conflict-correctness invariants the verifiers flagged.
import { sendOnlyToSelf } from './electron/mailer.ts'
import { overlaps, sameMeeting } from './src/calendar/appCalendar.ts'

let pass = 0, fail = 0
const ok = (n: string, c: boolean) => { c ? pass++ : fail++; console.log(`  ${c ? '✓' : '✗'} ${n}`) }

async function main() {
  // 1) self-send guard is REAL (reachable) — non-self recipient must throw, no send
  let blocked = false
  try { await sendOnlyToSelf({ user: 'me@gmail.com', pass: 'x' }, 'evil@x.com', 's', 't') }
  catch (e: any) { blocked = /BLOCKED by hard rule/.test(String(e?.message)) }
  ok('mailer 阻擋寄給非本人 (assertNeverSend 真的觸發)', blocked)

  // 2) conflict detection robust to point/dirty dates
  ok('零時長同時段事件會重疊(可合併/警告)', overlaps({ startISO: '2026-06-22T09:00:00', endISO: '2026-06-22T09:00:00' }, { startISO: '2026-06-22T09:00:00', endISO: '2026-06-22T09:00:00' }))
  ok('髒日期不 crash、回 false', overlaps({ startISO: 'garbage', endISO: 'x' }, { startISO: '2026-06-22T09:00:00', endISO: '2026-06-22T10:00:00' }) === false)
  ok('真重疊仍偵測', overlaps({ startISO: '2026-06-22T09:00:00', endISO: '2026-06-22T10:00:00' }, { startISO: '2026-06-22T09:30:00', endISO: '2026-06-22T10:30:00' }))

  // 3) merge heuristic: same merges, short different does NOT false-merge
  ok('同會議(與/跟)合併', sameMeeting('占暉與OC會議', '占暉跟OC會議'))
  ok('短標題不誤合 (晨會 vs 晨跑)', sameMeeting('晨會', '晨跑') === false)

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`)
  process.exit(fail ? 1 : 0)
}
main().catch((e) => { console.error('ERR', e?.message ?? e); process.exit(1) })
