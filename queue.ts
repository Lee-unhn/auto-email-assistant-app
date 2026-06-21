// Decoupled task queue runner — the "Sheet-as-DB" reliability pattern.
//   ingest : read new unread → store as pending tasks (NO LLM → never fails)
//   process: take pending tasks → run pipeline → done / retry-on-fail (no loss)
//   run    : ingest + one process pass     |  add --watch to loop
//
//   npx tsx queue.ts ingest
//   npx tsx queue.ts process --provider claude --limit 6
//   npx tsx queue.ts run --provider gemini            # gemini failures stay pending
//   npx tsx queue.ts run --watch --interval 120 --provider claude
//   ...add --sheet "https://script.google.com/.../exec" to use a Google Sheet DB
import os from 'os'
import path from 'path'
import { promises as fs } from 'fs'
import { readGeminiKey, readGmailCreds } from './electron/keyloader.ts'
import { ImapMailProvider } from './src/mail/imap.ts'
import { GeminiProvider } from './src/llm/gemini.ts'
import { ClaudeCliProvider } from './src/llm/claudeCli.ts'
import { orchestrate } from './src/agents/orchestrator.ts'
import { addAppCalendarEvent } from './src/calendar/appCalendar.ts'
import { postCalendarEvent } from './src/calendar/appsScript.ts'
import { readConfig } from './src/config/localConfig.ts'
import { localScan } from './electron/localScan.ts'
import { emitRunToJarvis } from './src/bridge/jarvisBridge.ts'
import { makeStore, type Task, type TaskStore } from './src/queue/taskStore.ts'
import { isVip } from './src/rules/vip.ts'
import { DEFAULT_SETTINGS, type AgentEvent, type ThreadOutcome, type TriageRun } from './src/types.ts'

const OUT = path.join(os.homedir(), '.auto-email-assistant-realrun')
const MAX_ATTEMPTS = 3

const argv = process.argv.slice(2)
const mode = (argv[0] || 'run').toLowerCase()
const has = (f: string) => argv.includes(f)
const val = (f: string, d: string) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d }
const PROVIDER = val('--provider', 'claude').toLowerCase()
const LIMIT = parseInt(val('--limit', '8'), 10)
const SHEET_FLAG = val('--sheet', '')
const CAL_FLAG = val('--calendar', '')
const INTERVAL = Math.max(15, parseInt(val('--interval', '120'), 10)) * 1000

async function makeLLM(provider: string) {
  if (provider === 'gemini') { const k = await readGeminiKey(); if (!k) throw new Error('no gemini key'); return new GeminiProvider(k) }
  return new ClaudeCliProvider(os.tmpdir())
}

async function ingest(store: TaskStore, creds: { user: string; pass: string }): Promise<number> {
  const mail = new ImapMailProvider(creds.user, creds.pass, path.join(OUT, 'drafts'))
  const threads = await mail.listThreads({ maxResults: 30 })
  const added = await store.upsertPending(
    threads.map((t) => {
      const m = t.messages[0]
      return { id: m.id, from: m.from, subject: m.subject, body: m.body, date: m.date }
    })
  )
  console.log(`[ingest] 讀 ${threads.length} 封 → 新增 ${added} 個 pending 任務（無 LLM，零失敗）`)
  return added
}

async function processTasks(store: TaskStore, calendarWebhook: string, googleOn: boolean, provider: string, settings: typeof DEFAULT_SETTINGS, jarvisOn: boolean): Promise<void> {
  const pending = (await store.list('pending')).slice(0, LIMIT)
  if (!pending.length) { console.log('[process] 無 pending 任務'); return }
  console.log(`[process] 處理 ${pending.length} 個 pending（引擎 ${provider}）…`)
  const llm = await makeLLM(provider)
  const today = new Date().toISOString().slice(0, 10)
  const outcomes: ThreadOutcome[] = []
  let done = 0, retry = 0, failed = 0
  for (const task of pending) {
    const thread = { id: task.id, messages: [{ id: task.id, from: task.from, to: [], subject: task.subject, date: task.date, snippet: '', body: task.body }] }
    const trail: AgentEvent[] = []
    const ctx = { llm, settings, today, localScan, emit: (e: Omit<AgentEvent, 'ts'>) => trail.push({ ...e, ts: Date.now() }) }
    try {
      const o = await orchestrate(thread, ctx)
      if (o.classification.confidence === 0) throw new Error('classify fallback (可能限流)')
      if (isVip(o.from, settings.vipSenders)) {
        o.classification.urgency = 'high'
        if (!o.flagNote && !o.events?.length && !o.draft) o.flagNote = 'VIP 寄件人 — 已標示需你看'
      }
      // success — persist artifacts
      if (o.events?.length) {
        const conflictMsgs: string[] = []
        for (const ev of o.events) {
          const res = await addAppCalendarEvent(ev) // private app calendar (default)
          const tag = res.status === 'merged' ? '合併重複會議' : res.status === 'conflict' ? '⚠時段衝突' : '已寫進'
          console.log(`    📅 ${tag}：${ev.summary} @ ${ev.startISO}`)
          if (res.status === 'conflict') {
            conflictMsgs.push(`「${ev.summary}」(${ev.startISO}) 與「${res.conflicts.map((c) => c.summary).join('、')}」時段重疊`)
          }
          if (googleOn && res.status !== 'merged') {
            const r = await postCalendarEvent(calendarWebhook, ev)
            if (!r.ok) console.log(`      ↳ Google 同步失敗(${r.error})`)
          }
        }
        if (conflictMsgs.length) { o.conflictNote = conflictMsgs.join('；'); console.log(`    ⚠ 衝突：${o.conflictNote}`) }
      }
      if (o.draft) {
        await fs.mkdir(path.join(OUT, 'drafts'), { recursive: true })
        const safe = (o.draft.subject || 'draft').replace(/[^\p{L}\p{N} _-]/gu, '_').slice(0, 50)
        await fs.writeFile(path.join(OUT, 'drafts', `${Date.now()}_${safe}.eml`), `To: ${o.draft.to.join(', ')}\r\nSubject: ${o.draft.subject}\r\n\r\n${o.draft.body}`, 'utf-8')
      }
      outcomes.push(o)
      const summary = `${o.classification.category}${o.events?.length ? ` +${o.events.length}event` : ''}${o.draft ? ' +draft' : ''}${o.flagNote ? ' +flag' : ''}`
      await store.update(task.id, { status: 'done', category: o.classification.category, result: summary, error: '' })
      done++
      console.log(`  ✓ done  [${o.classification.category}] ${task.subject.slice(0, 40)}`)
    } catch (e: any) {
      const attempts = task.attempts + 1
      const status = attempts >= MAX_ATTEMPTS ? 'failed' : 'pending'
      await store.update(task.id, { status, attempts, error: String(e?.message ?? e).slice(0, 120) })
      if (status === 'failed') { failed++; console.log(`  ✗ failed (${attempts}/${MAX_ATTEMPTS}) ${task.subject.slice(0, 40)}`) }
      else { retry++; console.log(`  ↻ retry-later (${attempts}/${MAX_ATTEMPTS}) ${task.subject.slice(0, 40)} — 留 pending 不丟失`) }
    }
  }
  if (outcomes.length && jarvisOn) {
    const run: TriageRun = { startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), provider: provider === 'gemini' ? 'gemini' : 'claude', outcomes, stats: {} }
    await emitRunToJarvis(run)
  }
  console.log(`[process] done ${done} · retry-later ${retry} · failed ${failed}`)
}

async function counts(store: TaskStore) {
  const all = await store.list()
  const by: Record<string, number> = {}
  for (const t of all) by[t.status] = (by[t.status] ?? 0) + 1
  console.log(`[db] 任務總數 ${all.length} → ${Object.entries(by).map(([k, v]) => `${k} ${v}`).join(' / ') || '空'}`)
}

async function main() {
  const creds = await readGmailCreds()
  if (!creds) { console.log('✗ 找不到 Gmail 帳密'); process.exit(2) }
  const cfg = await readConfig()
  const sheet = SHEET_FLAG || cfg.sheetUrl || ''
  const cal = CAL_FLAG || cfg.calendarWebhook || ''
  const googleOn = !!cfg.googleCalendarEnabled && !!cal // Google 只有「開啟」且有網址才寫
  // Honor GUI-written settings (single shared source); CLI flag wins if given.
  const provider = has('--provider') ? PROVIDER : (cfg.provider || PROVIDER)
  const effSettings = {
    ...DEFAULT_SETTINGS,
    localScanRoots: cfg.localScanRoots ?? DEFAULT_SETTINGS.localScanRoots,
    jarvisBridgeEnabled: cfg.jarvisBridgeEnabled ?? DEFAULT_SETTINGS.jarvisBridgeEnabled,
    digestEnabled: cfg.digestEnabled ?? DEFAULT_SETTINGS.digestEnabled,
    vipSenders: cfg.vipSenders ?? DEFAULT_SETTINGS.vipSenders
  }
  const jarvisOn = effSettings.jarvisBridgeEnabled
  const store = makeStore(sheet || undefined)
  console.log(`佇列後端：${sheet ? 'Google Sheet' : '本地 JSON'} · 引擎 ${provider} · 行事曆：app 私密${googleOn ? ' + Google(已開啟)' : '（Google 關閉）'} · Jarvis ${jarvisOn ? '開' : '關'} · mode ${mode}`)
  const once = async () => { if (mode === 'ingest' || mode === 'run') await ingest(store, creds); if (mode === 'process' || mode === 'run') await processTasks(store, cal, googleOn, provider, effSettings, jarvisOn); await counts(store) }
  if (has('--watch')) { for (;;) { try { await once() } catch (e: any) { console.log('error:', e?.message ?? e) } await new Promise((r) => setTimeout(r, INTERVAL)) } }
  else { await once(); process.exit(0) }
}

main().catch((e) => { console.error('ERROR:', e?.message ?? e); process.exit(1) })
