// Headless REAL-inbox triage proof. Reads your real Gmail (IMAP, read-only),
// runs the existing agent pipeline on Gemini, writes .ics + LOCAL .eml drafts.
// Does NOT write to your Gmail account (no Drafts append here) and never sends.
// Run: node --experimental-strip-types realrun.ts
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
import { buildDigestText } from './src/notify/digest.ts'
import { sendSelfDigest } from './electron/mailer.ts'
import { emitRunToJarvis } from './src/bridge/jarvisBridge.ts'
import { DEFAULT_SETTINGS, type AgentEvent, type ThreadOutcome, type TriageRun } from './src/types.ts'

const OUT = path.join(os.homedir(), '.auto-email-assistant-realrun')

async function main() {
  const useClaude = (process.argv[2] || 'gemini').toLowerCase() === 'claude'
  const key = await readGeminiKey()
  const creds = await readGmailCreds()
  if (!useClaude && !key) {
    console.log('✗ 找不到 Gemini 金鑰（~/.claude/secrets/gemini_api_key.env）'); process.exit(2)
  }
  if (!creds) {
    console.log('✗ 找不到 Gmail 帳密（~/.claude/secrets/gmail_smtp.env 需有 address + app password）'); process.exit(2)
  }
  const mode = useClaude ? 'Claude CLI（訂閱版 claude -p）' : 'Gemini'
  console.log(`✓ 金鑰/設定載入（值不顯示）。引擎：${mode}。連線 IMAP 讀取真實未讀信…\n`)

  const mail = new ImapMailProvider(creds.user, creds.pass, path.join(OUT, 'drafts'))
  const llm = useClaude ? new ClaudeCliProvider(os.tmpdir()) : new GeminiProvider(key!)
  const threads = await mail.listThreads({ maxResults: 6 })
  console.log(`讀到 ${threads.length} 封真實未讀信。開始分流（${mode}）…\n`)

  const today = new Date().toISOString().slice(0, 10)
  const rows: string[] = []
  const outcomes: ThreadOutcome[] = []
  const stats: Record<string, number> = {}
  let events = 0, drafts = 0
  for (const t of threads) {
    const trail: AgentEvent[] = []
    const ctx = {
      llm,
      settings: DEFAULT_SETTINGS,
      today,
      localScan,
      emit: (e: Omit<AgentEvent, 'ts'>) => trail.push({ ...e, ts: Date.now() })
    }
    const o = await orchestrate(t, ctx)
    outcomes.push(o)
    stats[o.classification.category] = (stats[o.classification.category] ?? 0) + 1
    let arts = ''
    if (o.events?.length) {
      for (const ev of o.events) await addAppCalendarEvent(ev)
      events += o.events.length; arts += ` +${o.events.length}cal`
    }
    if (o.draft) {
      // LOCAL draft only in this proof (does not touch your Gmail account)
      await fs.mkdir(path.join(OUT, 'drafts'), { recursive: true })
      const safe = (o.draft.subject || 'draft').replace(/[^\p{L}\p{N} _-]/gu, '_').slice(0, 50)
      await fs.writeFile(path.join(OUT, 'drafts', `${Date.now()}_${safe}.eml`),
        `To: ${o.draft.to.join(', ')}\r\nSubject: ${o.draft.subject}\r\n\r\n${o.draft.body}`, 'utf-8')
      drafts++; arts += ` draft✓`
    }
    if (o.materials?.length) arts += ` mat:${o.materials.length}`
    const agents = new Set(trail.map((e) => e.agent)).size
    const conf = Math.round(o.classification.confidence * 100)
    const mark = o.classification.confidence === 0 ? ' ⚠FALLBACK' : ''
    rows.push(`• [${o.classification.category} ${conf}%${mark}] ${t.messages[0].subject.slice(0, 44)}  →${arts || ' (略過)'}  (agents:${agents})`)
  }

  console.log('=== 真實收件匣分流結果 ===')
  console.log(rows.join('\n'))
  console.log(`\n事件 ${events} · 本地草稿 ${drafts} · 產物在 ${OUT}`)

  // Send the daily digest to self (proves the notification channel).
  const run: TriageRun = {
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    provider: useClaude ? 'claude' : 'gemini',
    outcomes,
    stats
  }
  const dg = buildDigestText(run)
  await sendSelfDigest(creds, dg.subject, dg.text)
  console.log(`\n📧 摘要 email 已寄給你本人（${creds.user.replace(/(.{2}).*(@.*)/, '$1***$2')}）：${dg.subject}`)

  // Emit events to Jarvis (語音面) — full-pipeline test.
  const n = await emitRunToJarvis(run)
  console.log(`🔊 已送 ${n} 個事件給 Jarvis（~/.jarvis-events/inbox/）— 跑 jarvis email_events.py --watch 可念出`)
  process.exit(0)
}

main().catch((e) => { console.error('ERROR:', e?.message ?? e); process.exit(1) })
