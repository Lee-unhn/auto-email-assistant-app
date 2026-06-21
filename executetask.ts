// Execute the newest real unread emails as tasks (Claude mode), showing full output.
// Safe-by-design: the pipeline only DOES reversible work (classify / .ics / draft /
// research). Irreversible actions (send/pay/delete/settings) are never auto-done —
// they're prepared as drafts/flags for the user to confirm.
// Run: npx tsx executetask.ts [claude|gemini]
import os from 'os'
import path from 'path'
import { promises as fs } from 'fs'
import { readGeminiKey, readGmailCreds } from './electron/keyloader.ts'
import { ImapMailProvider } from './src/mail/imap.ts'
import { GeminiProvider } from './src/llm/gemini.ts'
import { ClaudeCliProvider } from './src/llm/claudeCli.ts'
import { orchestrate } from './src/agents/orchestrator.ts'
import { addAppCalendarEvent } from './src/calendar/appCalendar.ts'
import { localScan } from './electron/localScan.ts'
import { emitRunToJarvis } from './src/bridge/jarvisBridge.ts'
import { DEFAULT_SETTINGS, type AgentEvent, type ThreadOutcome, type TriageRun } from './src/types.ts'

const OUT = path.join(os.homedir(), '.auto-email-assistant-realrun')

async function main() {
  const useClaude = (process.argv[2] || 'claude').toLowerCase() === 'claude'
  const key = await readGeminiKey()
  const creds = await readGmailCreds()
  if (!creds) { console.log('✗ 找不到 Gmail 帳密'); process.exit(2) }
  if (!useClaude && !key) { console.log('✗ 找不到 Gemini 金鑰'); process.exit(2) }

  const mail = new ImapMailProvider(creds.user, creds.pass, path.join(OUT, 'drafts'))
  const llm = useClaude ? new ClaudeCliProvider(os.tmpdir()) : new GeminiProvider(key!)
  console.log(`引擎：${useClaude ? 'Claude CLI' : 'Gemini'}。讀取最新未讀…\n`)
  const threads = await mail.listThreads({ maxResults: 4 })

  const today = new Date().toISOString().slice(0, 10)
  const outcomes: ThreadOutcome[] = []
  const stats: Record<string, number> = {}
  for (const t of threads) {
    const m = t.messages[0]
    console.log('═'.repeat(70))
    console.log(`信件：${m.subject}`)
    console.log(`寄件：${m.from}`)
    console.log(`內容：${m.body.replace(/\s+/g, ' ').slice(0, 220)}…\n`)
    const trail: AgentEvent[] = []
    const ctx = { llm, settings: DEFAULT_SETTINGS, today, localScan, emit: (e: Omit<AgentEvent, 'ts'>) => trail.push({ ...e, ts: Date.now() }) }
    const o = await orchestrate(t, ctx)
    outcomes.push(o)
    stats[o.classification.category] = (stats[o.classification.category] ?? 0) + 1

    console.log(`▸ 分類：${o.classification.category}（${Math.round(o.classification.confidence * 100)}%）— ${o.classification.reason}`)
    console.log(`▸ 協作 agents：${[...new Set(trail.map((e) => e.agent))].join(' → ')}`)
    if (o.flagNote) console.log(`⚠ 旗標（只通知不動作）：${o.flagNote}`)
    if (o.events?.length) {
      for (const ev of o.events) {
        await addAppCalendarEvent(ev)
        console.log(`📅 建事件：${ev.summary} @ ${ev.startISO}（提前 ${ev.reminders.join('/')} 分）`)
      }
    }
    if (o.materials?.length) {
      console.log(`🔎 找到材料 ${o.materials.length} 筆：`)
      for (const mat of o.materials) console.log(`   - [${mat.source}] ${mat.title} ${mat.ref}`.slice(0, 140))
    }
    if (o.draft) {
      await fs.mkdir(path.join(OUT, 'drafts'), { recursive: true })
      const safe = (o.draft.subject || 'draft').replace(/[^\p{L}\p{N} _-]/gu, '_').slice(0, 50)
      const fp = path.join(OUT, 'drafts', `${Date.now()}_${safe}.eml`)
      await fs.writeFile(fp, `To: ${o.draft.to.join(', ')}\r\nSubject: ${o.draft.subject}\r\n\r\n${o.draft.body}`, 'utf-8')
      console.log(`✍ 草稿（未寄，待你確認）→ ${fp}`)
      console.log('────── 草稿全文 ──────')
      console.log(o.draft.body)
      console.log('──────────────────────')
    }
    console.log('')
  }

  const run: TriageRun = { startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), provider: useClaude ? 'claude' : 'gemini', outcomes, stats }
  const n = await emitRunToJarvis(run)
  console.log('═'.repeat(70))
  console.log(`完成。事件已送 Jarvis：${n}。分類統計：${Object.entries(stats).map(([k, v]) => `${k} ${v}`).join(' / ')}`)
  process.exit(0)
}

main().catch((e) => { console.error('ERROR:', e?.message ?? e); process.exit(1) })
