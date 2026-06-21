// Emit sample Jarvis events WITHOUT any LLM/Gemini call (doesn't burn quota).
// Proves the producer side of the bridge. Run: npx tsx bridgetest.ts
import { emitEvent, eventsFromRun, defaultEventsDir } from './src/bridge/jarvisBridge.ts'
import type { TriageRun } from './src/types.ts'

async function main() {
  const run: TriageRun = {
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    provider: 'gemini',
    stats: { FLAG_SECURITY: 1, ACTION_EVENT: 1 },
    outcomes: [
      {
        threadId: 't1',
        subject: '【玉山證券】定期變更登入密碼提醒通知',
        from: 'esun@esunsec.com.tw',
        classification: { category: 'FLAG_SECURITY', confidence: 0.9, reason: '安全警示', needsCollaboration: false },
        flagNote: '安全：只通知，不處理。帳戶逾一年未變更密碼。',
        agentTrail: []
      },
      {
        threadId: 't2',
        subject: 'NVIDIA DLI 線上開課說明會',
        from: '104news@ms1.104.com.tw',
        classification: { category: 'ACTION_EVENT', confidence: 0.9, reason: '含日期', needsCollaboration: false },
        event: { summary: '[自動·待確認] NVIDIA DLI 說明會', startISO: '2026-07-02T20:00:00', endISO: '2026-07-02T21:00:00', timeZone: 'Asia/Taipei', reminders: [1440, 60], sourceNote: '' },
        agentTrail: []
      }
    ]
  }
  const dir = defaultEventsDir()
  const evs = eventsFromRun(run)
  for (const ev of evs) await emitEvent(ev, dir)
  console.log(`✓ emitted ${evs.length} events → ${dir}`)
  for (const e of evs) console.log(`  [${e.urgency}/${e.type}] ${e.speak}`)
  process.exit(0)
}
main()
