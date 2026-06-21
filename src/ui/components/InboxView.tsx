import { useState } from 'react'
import type { AgentEvent, EmailThread, ThreadOutcome, TriageRun } from '../../types'
import { CategoryBadge } from './CategoryBadge'
import { AgentPanel } from './AgentPanel'

interface Props {
  threads: EmailThread[]
  run: TriageRun | null
  liveTrails: Record<string, AgentEvent[]>
}

export function InboxView({ threads, run, liveTrails }: Props) {
  const [sel, setSel] = useState<string | null>(threads[0]?.id ?? null)
  const outcomeOf = (id: string): ThreadOutcome | undefined => run?.outcomes.find((o) => o.threadId === id)
  const thread = threads.find((t) => t.id === sel) ?? null
  const outcome = sel ? outcomeOf(sel) : undefined
  const trail = (sel && liveTrails[sel]?.length ? liveTrails[sel] : outcome?.agentTrail) ?? []

  return (
    <div className="thread-grid">
      <div className="thread-list">
        {threads.map((t) => {
          const o = outcomeOf(t.id)
          const m = t.messages[0]
          return (
            <div key={t.id} className={`thread-item ${sel === t.id ? 'sel' : ''}`} onClick={() => setSel(t.id)}>
              <div className="subj">{m?.subject}</div>
              <div className="from">{m?.from}</div>
              {o && (
                <div style={{ marginTop: 7 }}>
                  <CategoryBadge category={o.classification.category} />
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="detail">
        {!thread ? (
          <div className="empty-state">
            <div className="ico">📭</div>
            <div>選一封郵件查看</div>
            <div className="hint">點左側任一封信，這裡會顯示它是什麼、要不要回、有沒有行程。</div>
          </div>
        ) : (
          <>
            <div className="card">
              <div style={{ fontSize: 15, fontWeight: 590 }}>{thread.messages[0]?.subject}</div>
              <div className="meta" style={{ marginTop: 4 }}>
                {thread.messages[0]?.from} · {new Date(thread.messages[0]?.date ?? '').toLocaleString()}
              </div>
              <div style={{ marginTop: 12, color: 'var(--fg-2)', whiteSpace: 'pre-wrap', fontSize: 13 }}>
                {thread.messages[0]?.body}
              </div>
              {thread.messages[0]?.attachments?.length ? (
                <div className="meta" style={{ marginTop: 10 }}>
                  📎 {thread.messages[0].attachments.length} 個附件：{thread.messages[0].attachments.map((a) => a.filename).join('、')}
                </div>
              ) : null}
            </div>

            {outcome ? (
              <>
                <div className="section-title">這封信是什麼</div>
                <div className="card">
                  <span className="row" style={{ gap: 8 }}>
                    <CategoryBadge category={outcome.classification.category} />
                    {outcome.classification.urgency === 'high' && <span className="badge danger">🔴 高優先</span>}
                  </span>
                  <div style={{ marginTop: 8, color: 'var(--fg-2)' }}>{outcome.classification.reason}</div>
                  {outcome.flagNote && (
                    <div style={{ marginTop: 10, color: 'var(--warn)' }}>⚠ {outcome.flagNote}</div>
                  )}
                  {outcome.conflictNote && (
                    <div style={{ marginTop: 10, color: 'var(--danger)', fontWeight: 590 }}>⚠ 時段衝突：{outcome.conflictNote}</div>
                  )}
                </div>

                {outcome.events && outcome.events.length > 0 && (
                  <>
                    <div className="section-title">行事曆（已加 {outcome.events.length} 筆到你的私人行事曆）</div>
                    {outcome.events.map((ev, i) => (
                      <div className="card" key={i} style={{ marginBottom: 8 }}>
                        <div style={{ fontWeight: 590, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span>{ev.summary.replace(/^\[自動[^\]]*\]\s*/, '')}</span>
                          <span className="badge warn">待你確認</span>
                        </div>
                        <div className="meta" style={{ marginTop: 4 }}>
                          {ev.startISO.slice(0, 16).replace('T', ' ')} → {ev.endISO.slice(11, 16)} · 提前提醒{' '}
                          {ev.reminders.map((m) => (m >= 60 ? `${m / 60} 小時前` : `${m} 分鐘前`)).join('、')}
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {outcome.draft && (
                  <>
                    <div className="section-title">回覆草稿（要你按下寄出才會送）</div>
                    <div className="card">
                      <div className="meta">主旨：{outcome.draft.subject} · 收件：{outcome.draft.to.join(', ')}</div>
                      <textarea className="draft" defaultValue={outcome.draft.body} style={{ marginTop: 8 }} />
                      {outcome.draftPath && (
                        <div className="row" style={{ marginTop: 8 }}>
                          <button className="btn sm" onClick={() => window.api.revealPath(outcome.draftPath!)}>
                            打開草稿檔
                          </button>
                          <span className="meta">由你本人確認後再寄。</span>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {outcome.materials && outcome.materials.length > 0 && (
                  <>
                    <div className="section-title">相關資料（電腦裡＋網路上）</div>
                    <div className="card scrollbox">
                      {outcome.materials.map((m, i) => (
                        <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid var(--border-soft)' }}>
                          <div>
                            <span className="chip" style={{ marginRight: 8 }}>{(({ local: '電腦', web: '網路', drive: '雲端' } as Record<string, string>)[m.source]) ?? m.source}</span>
                            {m.ref?.startsWith('http') ? (
                              <a className="link" href={m.ref} target="_blank" rel="noreferrer">{m.title}</a>
                            ) : m.ref ? (
                              <a className="link" onClick={() => window.api.revealPath(m.ref)}>{m.title}</a>
                            ) : (
                              <b>{m.title}</b>
                            )}
                          </div>
                          {m.snippet && <div className="meta" style={{ marginTop: 2 }}>{m.snippet}</div>}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="empty-state" style={{ marginTop: 16 }}>
                <div className="ico">⚡</div>
                <div>還沒整理這封信</div>
                <div className="hint">點上方「整理收件匣」，就會分析這封信並擬好需要的草稿。</div>
              </div>
            )}

            <div className="section-title">處理過程</div>
            <AgentPanel events={trail} title="處理過程" />
          </>
        )}
      </div>
    </div>
  )
}
