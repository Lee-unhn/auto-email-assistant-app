import path from 'path'
import { app, BrowserWindow } from 'electron'
import type { AgentEvent, AppSettings, ThreadOutcome, TriageRun } from '../src/types'
import { createProvider } from '../src/llm'
import { SampleMailProvider } from '../src/mail/sample'
import { ImapMailProvider } from '../src/mail/imap'
import type { MailProvider } from '../src/mail/MailProvider'
import { orchestrate } from '../src/agents/orchestrator'
import { addAppCalendarEvent } from '../src/calendar/appCalendar'
import { postCalendarEvent } from '../src/calendar/appsScript'
import { readConfig } from '../src/config/localConfig'
import { IPC } from '../src/ipc/channels'
import { getKey } from './secrets'
import { readGeminiKey, readGmailCreds } from './keyloader'
import { saveRun, paths } from './state'
import { makeStore } from '../src/queue/taskStore'
import { localScan } from './localScan'

function fixturesDir(): string {
  return app.isPackaged ? path.join(process.resourcesPath, 'fixtures') : path.join(app.getAppPath(), 'fixtures')
}

export async function getMailProvider(settings: AppSettings): Promise<MailProvider> {
  if (settings.mailSource === 'gmail' || settings.mailSource === 'imap') {
    const creds = await readGmailCreds()
    if (!creds) {
      throw new Error('Gmail 帳密未設定（~/.claude/secrets/gmail_smtp.env 需 address + app password），或改用樣本來源。')
    }
    return new ImapMailProvider(creds.user, creds.pass, paths.drafts())
  }
  return new SampleMailProvider(fixturesDir(), paths.drafts())
}

export async function runTriage(win: BrowserWindow | null, settings: AppSettings): Promise<TriageRun> {
  let llm
  if (settings.provider === 'gemini') {
    let apiKey = await getKey('gemini')
    if (!apiKey) apiKey = await readGeminiKey()
    if (!apiKey) throw new Error('Gemini API key 未設定。請到「設定」輸入金鑰（Google AI Studio）。')
    llm = createProvider('gemini', apiKey, settings.geminiModel, settings.geminiRpm)
  } else {
    // Claude mode: API key if present, otherwise the Claude Code CLI subscription (claude -p).
    const apiKey = await getKey('anthropic')
    if (apiKey) {
      llm = createProvider('claude', apiKey, settings.claudeModel)
    } else {
      const { ClaudeCliProvider } = await import('../src/llm/claudeCli')
      llm = new ClaudeCliProvider()
    }
  }
  const mail = await getMailProvider(settings)
  const cfg = await readConfig()

  // Single shared ledger with the headless daemon (keyed by messageId) → no double-processing.
  const store = makeStore(cfg.sheetUrl || undefined)
  const known = new Set((await store.list()).map((t) => t.id))
  const threads = await mail.listThreads({ maxResults: 40 })
  const fresh = threads.filter((t) => !known.has(t.messages[0]?.id ?? t.id))
  await store.upsertPending(
    fresh.map((t) => {
      const m = t.messages[0]
      return { id: m.id, from: m.from, subject: m.subject, body: m.body, date: m.date }
    })
  )

  const run: TriageRun = {
    startedAt: new Date().toISOString(),
    provider: settings.provider,
    outcomes: [],
    stats: {}
  }

  const emit = (threadId: string, e: Omit<AgentEvent, 'ts'>) =>
    win?.webContents.send(IPC.agentEvent, { ...e, ts: Date.now(), threadId })

  const today = new Date().toISOString().slice(0, 10)
  let done = 0
  for (const thread of fresh) {
    win?.webContents.send(IPC.triageProgress, {
      done,
      total: fresh.length,
      subject: thread.messages[0]?.subject ?? ''
    })
    const ctx = {
      llm,
      settings,
      today,
      localScan,
      emit: (e: Omit<AgentEvent, 'ts'>) => emit(thread.id, e)
    }
    let outcome: ThreadOutcome
    try {
      outcome = await orchestrate(thread, ctx)
    } catch (e: any) {
      outcome = {
        threadId: thread.id,
        subject: thread.messages[0]?.subject ?? '',
        from: thread.messages[0]?.from ?? '',
        classification: { category: 'INFO_SYS', confidence: 0, reason: `orchestrate error: ${e?.message}`, needsCollaboration: false },
        agentTrail: []
      }
    }

    // Calendar: write each event to the app's PRIVATE calendar; Google only if opted in.
    if (outcome.events?.length) {
      const conflictMsgs: string[] = []
      let merged = 0
      for (const ev of outcome.events) {
        try {
          const res = await addAppCalendarEvent(ev)
          if (res.status === 'merged') merged++
          if (res.status === 'conflict') {
            conflictMsgs.push(`「${ev.summary}」(${ev.startISO}) 與「${res.conflicts.map((c) => c.summary).join('、')}」時段重疊`)
          }
          if (cfg.googleCalendarEnabled && cfg.calendarWebhook && res.status !== 'merged') {
            const r = await postCalendarEvent(cfg.calendarWebhook, ev)
            if (!r.ok) emit(thread.id, { agent: 'Calendar', status: 'error', message: `Google 同步失敗：${r.error}` })
          }
        } catch (e: any) {
          emit(thread.id, { agent: 'Calendar', status: 'error', message: `行事曆寫入失敗：${e?.message}` })
        }
      }
      if (conflictMsgs.length) outcome.conflictNote = conflictMsgs.join('；')
      emit(thread.id, {
        agent: 'Calendar',
        status: conflictMsgs.length ? 'error' : 'done',
        message: `行事曆 +${outcome.events.length} 筆${merged ? `（合併 ${merged}）` : ''}${conflictMsgs.length ? ` · ⚠衝突 ${conflictMsgs.length}` : ''}`
      })
    }
    if (outcome.draft) {
      try {
        const { ref } = await mail.saveDraft(outcome.draft)
        outcome.draftPath = ref
      } catch (e: any) {
        emit(thread.id, { agent: 'Draft', status: 'error', message: `草稿存檔失敗：${e?.message}` })
      }
    }

    run.outcomes.push(outcome)
    run.stats[outcome.classification.category] = (run.stats[outcome.classification.category] ?? 0) + 1
    // mark done in the shared ledger immediately (crash-safe, no end-of-run batch)
    await store.update(thread.messages[0]?.id ?? thread.id, { status: 'done', category: outcome.classification.category })
    done++
  }

  run.finishedAt = new Date().toISOString()
  win?.webContents.send(IPC.triageProgress, { done, total: fresh.length, subject: '完成' })
  await saveRun(run)

  // Daily-digest self-notification (only to the user's own address).
  if (settings.digestEnabled) {
    try {
      const creds = await readGmailCreds()
      if (creds) {
        const { buildDigestText } = await import('../src/notify/digest')
        const { sendSelfDigest } = await import('./mailer')
        const { subject, text } = buildDigestText(run)
        await sendSelfDigest(creds, subject, text)
      }
    } catch (e: any) {
      win?.webContents.send(IPC.agentEvent, { agent: 'Digest', status: 'error', message: e?.message ?? 'digest failed', ts: Date.now(), threadId: '' })
    }
  }

  // Emit events to Jarvis (voice/notification surface) — decoupled JSON queue.
  if (settings.jarvisBridgeEnabled) {
    try {
      const { emitRunToJarvis } = await import('../src/bridge/jarvisBridge')
      const n = await emitRunToJarvis(run, settings.jarvisEventsDir || undefined)
      win?.webContents.send(IPC.agentEvent, { agent: 'JarvisBridge', status: 'done', message: `已送 ${n} 個事件給 Jarvis`, ts: Date.now(), threadId: '' })
    } catch (e: any) {
      win?.webContents.send(IPC.agentEvent, { agent: 'JarvisBridge', status: 'error', message: e?.message ?? 'bridge failed', ts: Date.now(), threadId: '' })
    }
  }
  return run
}
