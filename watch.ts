// Email watcher — polls Gmail at an interval, runs the pipeline on each NEW unread
// (idempotent via a processed-id file), writes .ics / local drafts, emits Jarvis
// events. Claude mode by default (no free-tier quota wall → short intervals OK).
//
//   npx tsx watch.ts                      # poll every 120s, Claude mode
//   npx tsx watch.ts --interval 30        # faster (Claude has no per-min quota)
//   npx tsx watch.ts --provider gemini    # Gemini (mind free RPD)
//   npx tsx watch.ts --once               # one pass then exit
//   npx tsx watch.ts --once --dry         # list new unread only (no LLM) — cheap check
//
// Safe-by-design: only reversible work is auto-done; send/pay/delete/settings never.
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
const STATE = path.join(os.homedir(), '.auto-email-assistant-watch.json')

const argv = process.argv.slice(2)
const has = (f: string) => argv.includes(f)
const val = (f: string, d: string) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d }
const DRY = has('--dry')
const ONCE = has('--once')
const INTERVAL = Math.max(15, parseInt(val('--interval', '120'), 10)) * 1000
const PROVIDER = val('--provider', 'claude').toLowerCase()

async function loadProcessed(): Promise<Set<string>> {
  try { return new Set(JSON.parse(await fs.readFile(STATE, 'utf-8')).ids) } catch { return new Set() }
}
async function saveProcessed(s: Set<string>) {
  await fs.writeFile(STATE, JSON.stringify({ ids: [...s].slice(-500) }, null, 2), 'utf-8')
}

async function makeLLM() {
  if (PROVIDER === 'gemini') {
    const k = await readGeminiKey(); if (!k) throw new Error('no gemini key')
    return new GeminiProvider(k)
  }
  return new ClaudeCliProvider(os.tmpdir())
}

async function pass(creds: { user: string; pass: string }, processed: Set<string>): Promise<number> {
  const mail = new ImapMailProvider(creds.user, creds.pass, path.join(OUT, 'drafts'))
  const threads = await mail.listThreads({ maxResults: 20 })
  const fresh = threads.filter((t) => !processed.has(t.messages[0]?.id ?? t.id))
  if (!fresh.length) { console.log(`[${new Date().toLocaleTimeString()}] 無新信`); return 0 }
  console.log(`[${new Date().toLocaleTimeString()}] 新信 ${fresh.length} 封`)
  if (DRY) {
    for (const t of fresh) console.log(`   • ${t.messages[0].subject}`)
    return fresh.length
  }
  const llm = await makeLLM()
  const today = new Date().toISOString().slice(0, 10)
  const outcomes: ThreadOutcome[] = []
  const stats: Record<string, number> = {}
  for (const t of fresh) {
    const trail: AgentEvent[] = []
    const ctx = { llm, settings: DEFAULT_SETTINGS, today, localScan, emit: (e: Omit<AgentEvent, 'ts'>) => trail.push({ ...e, ts: Date.now() }) }
    const o = await orchestrate(t, ctx)
    outcomes.push(o)
    stats[o.classification.category] = (stats[o.classification.category] ?? 0) + 1
    let arts = ''
    if (o.events?.length) { for (const ev of o.events) await addAppCalendarEvent(ev); arts += ` +${o.events.length}cal` }
    if (o.draft) {
      await fs.mkdir(path.join(OUT, 'drafts'), { recursive: true })
      const safe = (o.draft.subject || 'draft').replace(/[^\p{L}\p{N} _-]/gu, '_').slice(0, 50)
      await fs.writeFile(path.join(OUT, 'drafts', `${Date.now()}_${safe}.eml`), `To: ${o.draft.to.join(', ')}\r\nSubject: ${o.draft.subject}\r\n\r\n${o.draft.body}`, 'utf-8')
      arts += ' draft'
    }
    console.log(`   ▸ [${o.classification.category}] ${t.messages[0].subject.slice(0, 44)}${arts ? ' →' + arts : ''}`)
    processed.add(t.messages[0]?.id ?? t.id)
  }
  const run: TriageRun = { startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), provider: PROVIDER === 'gemini' ? 'gemini' : 'claude', outcomes, stats }
  const n = await emitRunToJarvis(run)
  console.log(`   🔊 ${n} 事件→Jarvis`)
  await saveProcessed(processed)
  return fresh.length
}

async function main() {
  const creds = await readGmailCreds()
  if (!creds) { console.log('✗ 找不到 Gmail 帳密'); process.exit(2) }
  const processed = await loadProcessed()
  console.log(`watcher 啟動：引擎 ${PROVIDER} · 間隔 ${INTERVAL / 1000}s · 已知 ${processed.size} 封 · dry=${DRY}`)
  if (ONCE) { await pass(creds, processed); process.exit(0) }
  // poll loop
  for (;;) {
    try { await pass(creds, processed) } catch (e: any) { console.log('  error:', e?.message ?? e) }
    await new Promise((r) => setTimeout(r, INTERVAL))
  }
}

main().catch((e) => { console.error('ERROR:', e?.message ?? e); process.exit(1) })
