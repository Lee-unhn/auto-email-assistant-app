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
          <div className="muted">選一封郵件查看。</div>
        ) : (
          <>
            <div className="card">
              <div style={{ fontSize: 15, fontWeight: 600 }}>{thread.messages[0]?.subject}</div>
              <div className="meta" style={{ marginTop: 4 }}>
                {thread.messages[0]?.from} · {new Date(thread.messages[0]?.date ?? '').toLocaleString()}
              </div>
              <div style={{ marginTop: 12, color: 'var(--fg-2)', whiteSpace: 'pre-wrap', fontSize: 13 }}>
                {thread.messages[0]?.body}
              </div>
            </div>

            {outcome ? (
              <>
                <div className="section-title">分類</div>
                <div className="card">
                  <CategoryBadge category={outcome.classification.category} />
                  <span className="meta" style={{ marginLeft: 10 }}>
                    信心 {Math.round(outcome.classification.confidence * 100)}% ·{' '}
                    {outcome.classification.needsCollaboration ? '需協作' : '單一 agent'}
                  </span>
                  <div style={{ marginTop: 8, color: 'var(--fg-2)' }}>{outcome.classification.reason}</div>
                  {outcome.flagNote && (
                    <div style={{ marginTop: 10, color: 'var(--warn)' }}>⚠ {outcome.flagNote}</div>
                  )}
                  {outcome.conflictNote && (
                    <div style={{ marginTop: 10, color: 'var(--danger)', fontWeight: 600 }}>⚠ 時段衝突：{outcome.conflictNote}</div>
                  )}
                </div>

                {outcome.events && outcome.events.length > 0 && (
                  <>
                    <div className="section-title">行事曆事件（{outcome.events.length} 筆 · 已寫進私密行事曆）</div>
                    {outcome.events.map((ev, i) => (
                      <div className="card" key={i} style={{ marginBottom: 8 }}>
                        <div style={{ fontWeight: 600 }}>{ev.summary}</div>
                        <div className="meta" style={{ marginTop: 4 }}>
                          {ev.startISO} → {ev.endISO} ({ev.timeZone}) · 提前提醒{' '}
                          {ev.reminders.map((m) => `${m}分`).join(' / ')}
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {outcome.draft && (
                  <>
                    <div className="section-title">回覆草稿（永不自動寄出）</div>
                    <div className="card">
                      <div className="meta">主旨：{outcome.draft.subject} · 收件：{outcome.draft.to.join(', ')}</div>
                      <textarea className="draft" defaultValue={outcome.draft.body} style={{ marginTop: 8 }} />
                      {outcome.draftPath && (
                        <div className="row" style={{ marginTop: 8 }}>
                          <button className="btn sm" onClick={() => window.api.revealPath(outcome.draftPath!)}>
                            在資料夾顯示 .eml
                          </button>
                          <span className="meta">由你本人確認後再寄。</span>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {outcome.materials && outcome.materials.length > 0 && (
                  <>
                    <div className="section-title">找到的材料（本機 + 網路）</div>
                    <div className="card scrollbox">
                      {outcome.materials.map((m, i) => (
                        <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid var(--border-soft)' }}>
                          <div>
                            <span className="chip" style={{ marginRight: 8 }}>{m.source}</span>
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
              <div className="card muted" style={{ marginTop: 16 }}>尚未分流。點上方「執行分流」。</div>
            )}

            <div className="section-title">Agent 軌跡</div>
            <AgentPanel events={trail} title="🤝 此郵件的 agent 協作" />
          </>
        )}
      </div>
    </div>
  )
}
