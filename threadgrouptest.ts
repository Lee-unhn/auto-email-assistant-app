import { groupIntoThreads, type BuiltMessage } from './src/mail/threadGroup'
import type { EmailMessage } from './src/types'

const mk = (id: string, subject: string, dateMs: number): EmailMessage =>
  ({ id, from: 'x@y.com', to: ['me@gmail.com'], subject, date: new Date(dateMs).toISOString(), snippet: '', body: subject })
const b = (id: string, key: string, dateMs: number): BuiltMessage => ({ msg: mk(id, id, dateMs), key, dateMs })

let pass = 0, fail = 0
const check = (n: string, c: boolean) => { c ? pass++ : fail++; console.log(`  ${c ? '✓' : '✗'} ${n}`) }

// two messages in same thread (shared root R1) + one standalone
const built: BuiltMessage[] = [
  b('m1', 'R1', 1000),
  b('m2', 'R1', 3000), // newer reply in same thread
  b('m3', 'R2', 2000)
]
const threads = groupIntoThreads(built)

check('合併成 2 串(同 root 併一起)', threads.length === 2)
const t1 = threads.find((t) => t.messages.some((m) => m.id === 'm1'))!
check('同串含兩封', t1.messages.length === 2)
check('messages[0] 是最新一封(m2)', t1.messages[0].id === 'm2')
check('串排序:最新的串在前', threads[0].messages[0].id === 'm2') // m2@3000 is newest overall
check('獨立信自成一串', threads.find((t) => t.messages.length === 1 && t.messages[0].id === 'm3') !== undefined)

console.log(`\nRESULT: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
