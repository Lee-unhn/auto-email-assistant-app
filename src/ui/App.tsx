import { useEffect, useRef, useState } from 'react'
import type { AgentEvent, AppSettings, EmailThread, TriageRun } from '../types'
import { CATEGORY_MAP } from '../rules/taxonomy'
import { InboxView } from './components/InboxView'
import { CalendarView } from './components/CalendarView'
import { Settings } from './components/Settings'

function friendlyError(m: string): { msg: string; toSettings: boolean } {
  if (/(gmail|帳密|app[\s-]?password)/i.test(m) && /(未設定|找不到|no gmail)/i.test(m))
    return { msg: '還沒設定 Gmail —— 請到「設定 → 郵件來源」輸入你的 Gmail 與應用程式密碼。', toSettings: true }
  if (/(key|金鑰)/i.test(m) && /(未設定|找不到|no .*key)/i.test(m))
    return { msg: '還沒設定 AI 金鑰 —— 請到「設定」輸入 Gemini 金鑰。', toSettings: true }
  if (/(imap|auth|login|connect|econn|535|invalid cred)/i.test(m))
    return { msg: 'Gmail 連線失敗 —— 請確認帳號與應用程式密碼正確、網路正常。', toSettings: true }
  return { msg: '有點小狀況，請稍後再試一次。', toSettings: false }
}

export function App() {
  const [view, setView] = useState<'inbox' | 'calendar' | 'settings'>('inbox')
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [threads, setThreads] = useState<EmailThread[]>([])
  const [run, setRun] = useState<TriageRun | null>(null)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number; subject: string } | null>(null)
  const [error, setError] = useState<{ msg: string; toSettings: boolean } | null>(null)
  const [liveTrails, setLiveTrails] = useState<Record<string, AgentEvent[]>>({})
  const liveRef = useRef<Record<string, AgentEvent[]>>({})

  useEffect(() => {
    window.api.getSettings().then(setSettings)
    window.api.listThreads().then(setThreads)
    window.api.lastRun().then(setRun)
    const offE = window.api.onAgentEvent((e) => {
      const next = { ...liveRef.current }
      next[e.threadId] = [...(next[e.threadId] ?? []), e]
      liveRef.current = next
      setLiveTrails(next)
    })
    const offP = window.api.onProgress((p) => setProgress(p))
    return () => {
      offE()
      offP()
    }
  }, [])

  const saveSettings = async (patch: Partial<AppSettings>) => {
    const s = await window.api.saveSettings(patch)
    setSettings(s)
  }

  const runTriage = async () => {
    setRunning(true)
    liveRef.current = {}
    setLiveTrails({})
    setProgress({ done: 0, total: threads.length, subject: '啟動…' })
    try {
      const r = await window.api.runTriage()
      setRun(r)
    } catch (e: any) {
      setError(friendlyError(String(e?.message ?? e)))
    } finally {
      setRunning(false)
      setProgress(null)
    }
  }

  if (!settings) return <div style={{ padding: 24 }} className="muted">載入中…</div>

  const stats = run?.stats ?? {}

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="dot" />
          <div>
            <h1>郵件小幫手</h1>
            <small>你的私人郵件小幫手</small>
          </div>
        </div>
        <button className={`nav-btn ${view === 'inbox' ? 'active' : ''}`} aria-current={view === 'inbox' ? 'page' : undefined} onClick={() => setView('inbox')}><span aria-hidden="true">📥</span> 收件匣</button>
        <button className={`nav-btn ${view === 'calendar' ? 'active' : ''}`} aria-current={view === 'calendar' ? 'page' : undefined} onClick={() => setView('calendar')}><span aria-hidden="true">📅</span> 行事曆</button>
        <button className={`nav-btn ${view === 'settings' ? 'active' : ''}`} aria-current={view === 'settings' ? 'page' : undefined} onClick={() => setView('settings')}><span aria-hidden="true">⚙</span> 設定</button>

        <div className="side-label">AI 模型</div>
        <div style={{ padding: '0 6px' }}>
          <div className="seg" role="radiogroup" aria-label="AI 模型">
            <button role="radio" aria-checked={settings.provider === 'gemini'} className={settings.provider === 'gemini' ? 'on' : ''} onClick={() => saveSettings({ provider: 'gemini' })}>Gemini</button>
            <button role="radio" aria-checked={settings.provider === 'claude'} className={settings.provider === 'claude' ? 'on' : ''} onClick={() => saveSettings({ provider: 'claude' })}>Claude</button>
          </div>
          <div className="meta" style={{ marginTop: 8 }}>
            {settings.provider === 'gemini'
              ? settings.hasGeminiKey ? '✓ Gemini 金鑰已設定' : '⚠ 請先到設定輸入金鑰'
              : settings.hasClaudeKey ? '✓ Claude 金鑰已設定' : 'ℹ 將使用你的 Claude 訂閱'}
          </div>
        </div>

        <div className="spacer" />
        <div className="meta" style={{ padding: '0 8px 4px', lineHeight: 1.6 }}>
          只幫你整理、擬草稿，不會自動寄信。
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <h2>{view === 'inbox' ? '收件匣' : view === 'calendar' ? '行事曆（只存本機）' : '設定'}</h2>
          {view === 'inbox' && (
            <>
              <div className="spacer" style={{ flex: 1 }} />
              {run && (
                <div className="chips">
                  {Object.entries(stats).map(([k, v]) => (
                    <span className="chip" key={k}>{CATEGORY_MAP[k as keyof typeof CATEGORY_MAP]?.zh ?? k} <b>{v}</b></span>
                  ))}
                </div>
              )}
              <button className="btn primary" disabled={running} onClick={runTriage}>
                {running ? '整理中…' : '▶ 整理收件匣'}
              </button>
            </>
          )}
        </div>

        {error && (
          <div role="alert" style={{ margin: '10px 18px 0', padding: '10px 14px', background: 'var(--danger-soft)', border: '1px solid rgba(220,38,38,0.4)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <span><span aria-hidden="true">⚠</span> {error.msg}</span>
            <span style={{ whiteSpace: 'nowrap' }}>
              {error.toSettings && <button className="btn sm" style={{ marginRight: 8 }} onClick={() => { setView('settings'); setError(null) }}>前往設定</button>}
              <button className="btn sm" onClick={() => setError(null)}>關閉</button>
            </span>
          </div>
        )}
        {progress && (
          <div style={{ padding: '0 18px' }}>
            <div className="progress" style={{ marginTop: 10 }}>
              <div style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 5}%` }} />
            </div>
            <div className="meta" style={{ margin: '6px 0' }}>{progress.done}/{progress.total} · {progress.subject}</div>
          </div>
        )}

        <div className="content">
          {view === 'inbox' ? (
            <InboxView threads={threads} run={run} liveTrails={liveTrails} />
          ) : view === 'calendar' ? (
            <CalendarView />
          ) : (
            <Settings settings={settings} onSave={saveSettings} />
          )}
        </div>
      </main>
    </div>
  )
}
