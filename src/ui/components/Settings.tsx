import { useEffect, useState } from 'react'
import type { AppSettings, LLMProviderId } from '../../types'
import type { LocalConfig } from '../../config/localConfig'
import { Icon } from './Icon'

interface Props {
  settings: AppSettings
  onSave: (patch: Partial<AppSettings>) => Promise<void>
}

// cron "m h * * *" ↔ "HH:MM" so non-technical users pick a time, not write cron.
function cronToTime(cron: string): string {
  const p = (cron || '').trim().split(/\s+/)
  const m = Number(p[0]), h = Number(p[1])
  if (Number.isFinite(h) && Number.isFinite(m)) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  return '08:07'
}
function timeToCron(t: string): string {
  const [h, m] = t.split(':').map(Number)
  return `${m || 0} ${h || 0} * * *`
}

export function Settings({ settings, onSave }: Props) {
  const [gemKey, setGemKey] = useState('')
  const [antKey, setAntKey] = useState('')
  const [gmailAddr, setGmailAddr] = useState('')
  const [gmailPass, setGmailPass] = useState('')
  const [saved, setSaved] = useState('')
  const [test, setTest] = useState<Record<string, string>>({})
  const [s, setS] = useState(settings)
  const [cfg, setCfg] = useState<LocalConfig>({})
  useEffect(() => { window.api.getConfig().then(setCfg) }, [])
  const patchCfg = (p: Partial<LocalConfig>) => { const next = { ...cfg, ...p }; setCfg(next); window.api.saveConfig(p) }

  const patch = (p: Partial<AppSettings>) => {
    const next = { ...s, ...p }
    setS(next)
    onSave(p)
  }

  const saveKey = async (name: 'gemini' | 'anthropic', value: string) => {
    if (!value) return
    await window.api.setKey(name, value)
    // also write the on-disk key file so the background daemon (not Electron) can read it
    if (name === 'gemini') await window.api.saveSecrets({ geminiKey: value })
    await onSave({})
    if (name === 'gemini') setGemKey('')
    else setAntKey('')
    setSaved('✓ 已儲存'); setTimeout(() => setSaved(''), 2000)
  }

  const saveGmail = async () => {
    if (!gmailAddr || !gmailPass) return
    await window.api.saveSecrets({ gmailAddress: gmailAddr, gmailAppPassword: gmailPass })
    await onSave({})
    setGmailPass('')
    setSaved('✓ Gmail 已儲存'); setTimeout(() => setSaved(''), 2000)
  }

  const doTest = async (id: LLMProviderId) => {
    setTest((t) => ({ ...t, [id]: '測試中…' }))
    const r = await window.api.testProvider(id)
    setTest((t) => ({ ...t, [id]: (r.ok ? '✅ ' : '❌ ') + r.detail }))
  }

  return (
    <div style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {saved && <span className="badge ok">{saved}</span>}
      <div className="card">
        <div className="section-title" style={{ marginTop: 0 }}>AI 金鑰（加密存在你的電腦，不會上傳）</div>
        <div className="grid2">
          <div>
            <label className="meta">Gemini API Key {settings.hasGeminiKey && '· 已設定 ✓'}</label>
            <div className="row" style={{ marginTop: 6 }}>
              <input className="field" type="password" placeholder="AIza…" value={gemKey} onChange={(e) => setGemKey(e.target.value)} />
              <button className="btn sm" onClick={() => saveKey('gemini', gemKey)}>存</button>
              <button className="btn sm" onClick={() => doTest('gemini')}>測試</button>
            </div>
            {test.gemini && <div className="meta" style={{ marginTop: 6 }}>{test.gemini}</div>}
          </div>
          <div>
            <label className="meta">Anthropic (Claude) API Key {settings.hasClaudeKey && '· 已設定 ✓'}</label>
            <div className="row" style={{ marginTop: 6 }}>
              <input className="field" type="password" placeholder="sk-ant-…" value={antKey} onChange={(e) => setAntKey(e.target.value)} />
              <button className="btn sm" onClick={() => saveKey('anthropic', antKey)}>存</button>
              <button className="btn sm" onClick={() => doTest('claude')}>測試</button>
            </div>
            {test.claude && <div className="meta" style={{ marginTop: 6 }}>{test.claude}</div>}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="section-title" style={{ marginTop: 0 }}>郵件來源</div>
        <select className="field" value={s.mailSource} onChange={(e) => patch({ mailSource: e.target.value as AppSettings['mailSource'] })}>
          <option value="gmail">我的 Gmail（讀信、把草稿存到 Gmail 草稿匣，不會自動寄）</option>
          <option value="sample">範例信（內建，免帳密，先試用）</option>
        </select>
        {s.mailSource === 'gmail' && (
          <div style={{ marginTop: 12 }}>
            <label className="meta">Gmail 地址</label>
            <input className="field" style={{ marginTop: 4 }} placeholder="you@gmail.com" value={gmailAddr} onChange={(e) => setGmailAddr(e.target.value)} />
            <label className="meta" style={{ marginTop: 8, display: 'block' }}>Gmail 應用程式密碼（16 碼；留空＝不變更）</label>
            <div className="row" style={{ marginTop: 4 }}>
              <input className="field" type="password" placeholder="xxxx xxxx xxxx xxxx" value={gmailPass} onChange={(e) => setGmailPass(e.target.value)} />
              <button className="btn sm" onClick={saveGmail}>存</button>
            </div>
            <div className="meta" style={{ marginTop: 6 }}>先在 Google 帳號開「兩步驟驗證」→ 建立應用程式密碼貼上即可（不必手動編輯任何檔案）。</div>
          </div>
        )}
        <div className="meta" style={{ marginTop: 8 }}>
          要搜尋的資料夾（用逗號分隔）
        </div>
        <input
          className="field"
          style={{ marginTop: 6 }}
          value={s.localScanRoots.join(', ')}
          onChange={(e) => patch({ localScanRoots: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })}
        />
        <div className="meta" style={{ marginTop: 10 }}>重要寄件人 VIP（逗號分隔；這些人的信一定提醒、標高優先）</div>
        <input
          className="field"
          style={{ marginTop: 6 }}
          placeholder="boss@company.com, mom@gmail.com"
          value={s.vipSenders.join(', ')}
          onChange={(e) => patch({ vipSenders: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })}
        />
      </div>

      <div className="card">
        <div className="section-title" style={{ marginTop: 0 }}>行事曆</div>
        <div className="meta">預設：含日期的事項自動寫進 <b>app 私密行事曆</b>（只存本機，不外流；在「行事曆」分頁看）。</div>
        <label className="row" style={{ gap: 6, marginTop: 10 }}>
          <input type="checkbox" checked={s.remindersEnabled} onChange={(e) => patch({ remindersEnabled: e.target.checked })} />
          <span>事件前跳鬧鐘提醒（依各事件設定的提前提醒時間，App 開著才會響）</span>
        </label>
        <label className="row" style={{ gap: 6, marginTop: 10 }}>
          <input type="checkbox" checked={!!cfg.googleCalendarEnabled} onChange={(e) => patchCfg({ googleCalendarEnabled: e.target.checked })} />
          <span>同時寫進 Google 行事曆（預設關閉）</span>
        </label>
        <div style={{ color: 'var(--warn-text)', fontSize: 12, marginTop: 6 }}>
          ⚠ 若你的 Google 行事曆是公開/共用的，私人行程會被外部看到。確定需要再開啟。
        </div>
        {cfg.googleCalendarEnabled && (
          <input className="field" style={{ marginTop: 8 }} placeholder="貼上你的 Google 行事曆連結網址"
            value={cfg.calendarWebhook ?? ''} onChange={(e) => patchCfg({ calendarWebhook: e.target.value })} />
        )}
      </div>

      <div className="card">
        <div className="section-title" style={{ marginTop: 0 }}>自動整理（App 開著才會跑）</div>
        <label className="row" style={{ gap: 6 }}>
          <input type="checkbox" checked={s.scheduleEnabled} onChange={(e) => patch({ scheduleEnabled: e.target.checked })} />
          <span>每天自動整理收件匣</span>
        </label>
        <div className="row" style={{ gap: 8, marginTop: 10 }}>
          <span className="meta">每天</span>
          <input className="field" type="time" style={{ maxWidth: 130 }} value={cronToTime(s.scheduleCron)} onChange={(e) => patch({ scheduleCron: timeToCron(e.target.value) })} />
          <span className="meta">自動整理一次</span>
        </div>
        <label className="row" style={{ gap: 6, marginTop: 12 }}>
          <input type="checkbox" checked={s.digestEnabled} onChange={(e) => patch({ digestEnabled: e.target.checked })} />
          <span>每次整理後，寄一封「每日摘要」給我自己（只寄給自己）</span>
        </label>
        <label className="row" style={{ gap: 6, marginTop: 10 }}>
          <input type="checkbox" checked={s.notifyEnabled} onChange={(e) => patch({ notifyEnabled: e.target.checked })} />
          <span>整理完成時跳桌面通知（只顯示數量，不含信件內容）</span>
        </label>
        <label className="row" style={{ gap: 6, marginTop: 10 }}>
          <input type="checkbox" checked={s.jarvisBridgeEnabled} onChange={(e) => patch({ jarvisBridgeEnabled: e.target.checked })} />
          <span>把重要事項念出來（需先安裝語音模組）</span>
        </label>
        {s.jarvisBridgeEnabled && (
          <input className="field" style={{ marginTop: 6 }} placeholder="語音事件資料夾（留空＝使用預設）"
            value={s.jarvisEventsDir} onChange={(e) => patch({ jarvisEventsDir: e.target.value })} />
        )}
      </div>

      <details className="folddetail">
        <summary>進階設定（AI 模型、查詢上限）</summary>
        <div className="card" style={{ marginTop: 8 }}>
          <div className="grid2">
            <div>
              <label className="meta">Gemini 模型</label>
              <input className="field" style={{ marginTop: 6 }} value={s.geminiModel} onChange={(e) => patch({ geminiModel: e.target.value })} />
            </div>
            <div>
              <label className="meta">Claude 模型</label>
              <input className="field" style={{ marginTop: 6 }} value={s.claudeModel} onChange={(e) => patch({ claudeModel: e.target.value })} />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label className="meta">Gemini 每分鐘查詢上限（免費帳號約 10）</label>
            <input className="field" style={{ marginTop: 6, maxWidth: 140 }} type="number" min={1} value={s.geminiRpm}
              onChange={(e) => patch({ geminiRpm: Math.max(1, Number(e.target.value) || 10) })} />
          </div>
        </div>
      </details>

      <button className="btn" style={{ alignSelf: 'flex-start' }} onClick={() => onSave({ onboarded: false })}>
        <Icon name="refresh" size={14} /> 重新執行設定精靈
      </button>
    </div>
  )
}
