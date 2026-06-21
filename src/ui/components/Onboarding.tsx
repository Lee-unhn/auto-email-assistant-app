import { useEffect, useState } from 'react'
import type { AppSettings } from '../../types'
import { Icon } from './Icon'

type Step = 'welcome' | 'ai' | 'gemini' | 'gmail' | 'done'
const STEPS: { key: Step; label: string }[] = [
  { key: 'welcome', label: '歡迎' },
  { key: 'ai', label: 'AI' },
  { key: 'gmail', label: 'Gmail' },
  { key: 'done', label: '完成' }
]

interface Props {
  settings: AppSettings
  onSave: (p: Partial<AppSettings>) => Promise<void>
  onRun: () => void
}

export function Onboarding({ onSave, onRun }: Props) {
  const [step, setStep] = useState<Step>('welcome')
  const [claude, setClaude] = useState<'checking' | 'yes' | 'no'>('checking')
  const [gemKey, setGemKey] = useState('')
  const [gemTest, setGemTest] = useState('')
  const [busy, setBusy] = useState(false)
  const [addr, setAddr] = useState('')
  const [pass, setPass] = useState('')
  const [gmailSaved, setGmailSaved] = useState(false)

  useEffect(() => {
    if (step !== 'ai') return
    setClaude('checking')
    window.api.testProvider('claude').then((r) => setClaude(r.ok ? 'yes' : 'no')).catch(() => setClaude('no'))
  }, [step])

  const finish = async (run: boolean) => { await onSave({ onboarded: true }); if (run) onRun() }
  const stepIdx = STEPS.findIndex((s) => s.key === (step === 'gemini' ? 'ai' : step))

  const saveGemini = async () => {
    if (!gemKey) return
    setBusy(true); setGemTest('測試中…')
    try {
      await window.api.setKey('gemini', gemKey)
      await window.api.saveSecrets({ geminiKey: gemKey })
      const r = await window.api.testProvider('gemini')
      setGemTest((r.ok ? '✓ ' : '✗ ') + r.detail)
      if (r.ok) { setGemKey(''); setStep('gmail') }
    } finally { setBusy(false) }
  }
  const saveGmail = async () => {
    if (!addr || !pass) return
    setBusy(true)
    try {
      await window.api.saveSecrets({ gmailAddress: addr, gmailAppPassword: pass })
      await onSave({ mailSource: 'gmail' })
      setPass(''); setGmailSaved(true)
    } finally { setBusy(false) }
  }

  return (
    <div className="onb-wrap">
      <div className="onb-card" role="dialog" aria-label="設定精靈">
        <div className="onb-steps">
          {STEPS.map((s, i) => (
            <span key={s.key} className={`onb-dot ${i === stepIdx ? 'on' : ''} ${i < stepIdx ? 'past' : ''}`}>{s.label}</span>
          ))}
        </div>

        {step === 'welcome' && (
          <div className="onb-body">
            <div className="onb-logo"><div className="dot" /></div>
            <h1>嗨,我是你的郵件小幫手</h1>
            <p>我會幫你把收件匣整理好、把該回的信先擬成草稿、把有日期的事寫進行事曆。</p>
            <p className="muted"><Icon name="shield" size={14} style={{ verticalAlign: '-2px' }} /> 我不會自動寄信,也不會動你的帳號設定。</p>
            <div className="onb-actions">
              <button className="btn primary" onClick={() => setStep('ai')}>開始設定（約 2 分鐘）</button>
              <button className="btn" onClick={() => onSave({ onboarded: true, mailSource: 'sample' })}>先逛逛,之後再設定</button>
            </div>
          </div>
        )}

        {step === 'ai' && (
          <div className="onb-body">
            <h1>AI 大腦</h1>
            {claude === 'checking' && <p className="muted" aria-live="polite">正在檢查你的電腦…</p>}
            {claude === 'yes' && (
              <>
                <p><span className="badge ok"><Icon name="check" size={13} /> 偵測到 Claude</span></p>
                <p>太好了,不用金鑰就能用 —— 我會直接用你電腦上的 Claude。</p>
                <div className="onb-actions">
                  <button className="btn primary" onClick={async () => { await onSave({ provider: 'claude' }); setStep('gmail') }}>下一步</button>
                </div>
              </>
            )}
            {claude === 'no' && (
              <>
                <p>沒偵測到 Claude,沒關係 —— 我們用 Google 的免費 AI（Gemini）,申請只要 1 分鐘。</p>
                <div className="onb-actions">
                  <button className="btn primary" onClick={async () => { await onSave({ provider: 'gemini' }); setStep('gemini') }}>去拿免費金鑰</button>
                  <button className="btn" onClick={() => setStep('ai')}>我有 Claude,重新偵測</button>
                </div>
              </>
            )}
          </div>
        )}

        {step === 'gemini' && (
          <div className="onb-body">
            <h1>拿一把免費的 AI 鑰匙（Gemini）</h1>
            <ol className="onb-list">
              <li>點下面按鈕,開啟 Google AI Studio。</li>
              <li>用 Google 帳號登入,按「Create API key」。</li>
              <li>把那串文字（開頭 <code>AIza…</code>）複製貼到下面。</li>
            </ol>
            <button className="btn sm" onClick={() => window.api.openExternal('https://aistudio.google.com/apikey')}><Icon name="search" size={14} /> 開啟 Google AI Studio</button>
            <div className="row" style={{ marginTop: 10 }}>
              <input className="field" type="password" placeholder="AIza…" value={gemKey} onChange={(e) => setGemKey(e.target.value)} />
              <button className="btn primary" disabled={busy || !gemKey} onClick={saveGemini}>儲存並測試</button>
            </div>
            {gemTest && <div className="meta" style={{ marginTop: 6 }}>{gemTest}</div>}
            <div className="meta" style={{ marginTop: 8 }}>金鑰會加密存在你自己的電腦,不會上傳。</div>
            <div className="onb-actions"><button className="btn" onClick={() => setStep('gmail')}>先跳過</button></div>
          </div>
        )}

        {step === 'gmail' && (
          <div className="onb-body">
            <h1>連上你的 Gmail</h1>
            <p className="muted">我只會「讀信」和「把草稿存進你的 Gmail 草稿匣」,<b>永遠不會替你寄出</b>。</p>
            <ol className="onb-list">
              <li>先到 Google 帳號開「兩步驟驗證」,再建立一組「應用程式密碼」（16 碼）。</li>
              <li>把 Gmail 地址和那組 16 碼填到下面。</li>
            </ol>
            <button className="btn sm" onClick={() => window.api.openExternal('https://myaccount.google.com/apppasswords')}><Icon name="search" size={14} /> 教我怎麼開應用程式密碼</button>
            <input className="field" style={{ marginTop: 10 }} placeholder="you@gmail.com" value={addr} onChange={(e) => setAddr(e.target.value)} />
            <div className="row" style={{ marginTop: 8 }}>
              <input className="field" type="password" placeholder="xxxx xxxx xxxx xxxx" value={pass} onChange={(e) => setPass(e.target.value)} />
              <button className="btn primary" disabled={busy || !addr || !pass} onClick={saveGmail}>儲存</button>
            </div>
            {gmailSaved && <div className="meta" style={{ marginTop: 6 }}><span className="badge ok"><Icon name="check" size={13} /> Gmail 已連上</span></div>}
            <div className="onb-actions">
              <button className="btn primary" onClick={() => setStep('done')}>下一步</button>
              <button className="btn" onClick={async () => { await onSave({ mailSource: 'sample' }); setStep('done') }}>先用範例信試用</button>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="onb-body">
            <div className="onb-logo"><Icon name="check" size={30} /></div>
            <h1>都好了,來試跑一次</h1>
            <p className="muted">設定隨時可在「設定」裡修改。</p>
            <div className="onb-actions">
              <button className="btn primary" onClick={() => finish(true)}><Icon name="sparkles" size={15} /> 先試一次（整理收件匣）</button>
              <button className="btn" onClick={() => finish(false)}>直接進收件匣</button>
            </div>
          </div>
        )}

        {step !== 'welcome' && step !== 'done' && (
          <button className="onb-skip" onClick={() => finish(false)}>之後再設定</button>
        )}
      </div>
    </div>
  )
}
