// Core-logic smoke test (no Electron, no API key). Run: node --experimental-strip-types smoke.ts
import { buildICS } from './src/calendar/ics.ts'
import { CATEGORIES, CATEGORY_MAP } from './src/rules/taxonomy.ts'
import { extractJson } from './src/llm/LLMProvider.ts'
import { readFileSync } from 'fs'

let pass = 0
let fail = 0
function ok(name: string, cond: boolean) {
  if (cond) { pass++; console.log('  ✓', name) }
  else { fail++; console.log('  ✗', name) }
}

console.log('1) ICS with advance-reminder VALARM')
const ics = buildICS(
  {
    summary: '[自動·待確認] NVIDIA DLI 說明會',
    startISO: '2026-07-02T20:00:00',
    endISO: '2026-07-02T21:00:00',
    timeZone: 'Asia/Taipei',
    reminders: [1440, 60],
    sourceNote: '來源：104 信件。不需要可刪。'
  },
  '20260620T000000Z'
)
ok('has VEVENT', ics.includes('BEGIN:VEVENT'))
ok('has TZID start', ics.includes('DTSTART;TZID=Asia/Taipei:20260702T200000'))
ok('has 1-day reminder', ics.includes('TRIGGER:-PT1440M'))
ok('has 1-hour reminder', ics.includes('TRIGGER:-PT60M'))
ok('two VALARM blocks', (ics.match(/BEGIN:VALARM/g) || []).length === 2)

console.log('2) Taxonomy')
ok('11 categories', CATEGORIES.length === 11)
ok('ACTION_EVENT mapped', CATEGORY_MAP['ACTION_EVENT'].zh === '含日期可排程')

console.log('3) extractJson tolerant parser')
ok('strips fences', (extractJson<{ a: number }>('```json\n{"a":1}\n```')).a === 1)
ok('finds embedded', (extractJson<{ b: string }>('here: {"b":"x"} end')).b === 'x')

console.log('4) Sample fixtures')
const fx = JSON.parse(readFileSync('./fixtures/sample_inbox.json', 'utf-8'))
ok('8 sample threads', fx.length === 8)
ok('has human-request thread', fx.some((t: any) => t.id === 't_human_request'))

console.log(`\nRESULT: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
