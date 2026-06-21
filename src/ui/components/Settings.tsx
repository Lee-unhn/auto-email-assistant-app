import { useEffect, useState } from 'react'
import type { AppSettings, LLMProviderId } from '../../types'
import type { LocalConfig } from '../../config/localConfig'

interface Props {
  settings: AppSettings
  onSave: (patch: Partial<AppSettings>) => Promise<void>
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
      {saved && <div style={{ color: 'var(--success)', fontWeight: 600 }}>{saved}</div>}
      <div className="card">
        <div className="section-title" style={{ marginTop: 0 }}>LLM 金鑰（加密存於本機 safeStorage，永不上傳/記錄）</div>
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
        <div className="section-title" style={{ marginTop: 0 }}>模型</div>
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
          <label className="meta">Gemini 每分鐘請求上限 RPM（免費約 10；付費可調高）</label>
          <input className="field" style={{ marginTop: 6, maxWidth: 140 }} type="number" min={1} value={s.geminiRpm}
            onChange={(e) => patch({ geminiRpm: Math.max(1, Number(e.target.value) || 10) })} />
        </div>
      </div>

      <div className="card">
        <div className="section-title" style={{ marginTop: 0 }}>郵件來源</div>
        <select className="field" value={s.mailSource} onChange={(e) => patch({ mailSource: e.target.value as AppSettings['mailSource'] })}>
          <option value="gmail">真實 Gmail（IMAP app-password，讀取+草稿存 Drafts，不寄）</option>
          <option value="sample">樣本（內建範例信，免帳密）</option>
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
          本機材料掃描範圍（逗號分隔）
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
          <input type="checkbox" checked={!!cfg.googleCalendarEnabled} onChange={(e) => patchCfg({ googleCalendarEnabled: e.target.checked })} />
          <span>同時寫進 Google 行事曆（預設關閉）</span>
        </label>
        <div style={{ color: 'var(--warn)', fontSize: 12, marginTop: 6 }}>
          ⚠ 若你的 Google 行事曆是公開的（例如公眾人物），私人行程會被外部看到。確定需要再開啟。
        </div>
        {cfg.googleCalendarEnabled && (
          <input className="field" style={{ marginTop: 8 }} placeholder="Google 行事曆 Apps Script /exec 網址（見 google-calendar.gs）"
            value={cfg.calendarWebhook ?? ''} onChange={(e) => patchCfg({ calendarWebhook: e.target.value })} />
        )}
      </div>

      <div className="card">
        <div className="section-title" style={{ marginTop: 0 }}>排程（app 開啟時生效）</div>
        <div className="row">
          <input className="field" style={{ maxWidth: 180 }} value={s.scheduleCron} onChange={(e) => patch({ scheduleCron: e.target.value })} />
          <label className="row" style={{ gap: 6 }}>
            <input type="checkbox" checked={s.scheduleEnabled} onChange={(e) => patch({ scheduleEnabled: e.target.checked })} />
            <span>啟用每日自動分流</span>
          </label>
        </div>
        <div className="meta" style={{ marginTop: 6 }}>cron 格式（分 時 日 月 週）。預設 7 8 * * * = 每日 08:07。</div>
        <label className="row" style={{ gap: 6, marginTop: 10 }}>
          <input type="checkbox" checked={s.digestEnabled} onChange={(e) => patch({ digestEnabled: e.target.checked })} />
          <span>每次分流後寄「每日摘要」email 給我本人（只寄給自己，不寄他人）</span>
        </label>
        <label className="row" style={{ gap: 6, marginTop: 10 }}>
          <input type="checkbox" checked={s.jarvisBridgeEnabled} onChange={(e) => patch({ jarvisBridgeEnabled: e.target.checked })} />
          <span>送事件給 Jarvis（語音/通知面）— 安全/金流/截止/草稿</span>
        </label>
        <input className="field" style={{ marginTop: 6 }} placeholder="Jarvis 事件資料夾（留空＝預設 ~/.jarvis-events/inbox）"
          value={s.jarvisEventsDir} onChange={(e) => patch({ jarvisEventsDir: e.target.value })} />
      </div>
    </div>
  )
}
