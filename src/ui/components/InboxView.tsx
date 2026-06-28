import { useState, useEffect } from 'react'
import type { AgentEvent, EmailThread, ThreadOutcome, TriageRun } from '../../types'
import type { ThreadStatus, StatusKind } from '../../state/threadStatus'
import { bucketOf, BUCKET_LABEL, type Bucket } from '../../rules/taxonomy'
import { CategoryBadge } from './CategoryBadge'
import { AgentPanel } from './AgentPanel'
import { Icon } from './Icon'

interface Props {
  threads: EmailThread[]
  run: TriageRun | null
  liveTrails: Record<string, AgentEvent[]>
}

const ORDER: Bucket[] = ['act', 'watch', 'skip']

// effective status now (a snooze whose time has passed reads as open again)
function effStatus(s: ThreadStatus | undefined): StatusKind {
  if (!s) return 'open'
  if (s.status === 'snoozed' && s.snoozedUntil && new Date(s.snoozedUntil).getTime() <= Date.now()) return 'open'
  return s.status
}
const plusDays = (n: number) => { const d = new Date(); d.setHours(8, 0, 0, 0); d.setDate(d.getDate() + n); return d.toISOString() }

export function InboxView({ threads, run, liveTrails }: Props) {
  const [sel, setSel] = useState<string | null>(threads[0]?.id ?? null)
  const [filter, setFilter] = useState<Bucket | null>(null)
  const [copied, setCopied] = useState(false)
  const [pushed, setPushed] = useState(false)
  const [draftEdits, setDraftEdits] = useState<Record<string, string>>({})
  const outcomeOf = (id: string): ThreadOutcome | undefined => run?.outcomes.find((o) => o.threadId === id)
  const thread = threads.find((t) => t.id === sel) ?? null
  const outcome = sel ? outcomeOf(sel) : undefined
  const trail = (sel && liveTrails[sel]?.length ? liveTrails[sel] : outcome?.agentTrail) ?? []
  // Controlled draft text so the user's in-app edits are kept (and copied), not silently lost.
  const editedDraft = sel && outcome?.draft ? draftEdits[sel] ?? outcome.draft.body : ''

  // Persistent per-thread user state (handled / snoozed) — keyed by Message-ID.
  const [statuses, setStatuses] = useState<Record<string, ThreadStatus>>({})
  useEffect(() => { window.api.getThreadStatuses().then(setStatuses) }, [run])
  const midOf = (t: EmailThread) => t.messages[0]?.id ?? t.id
  const statusOf = (t: EmailThread) => effStatus(statuses[midOf(t)])
  const setStatus = async (t: EmailThread, patch: Partial<ThreadStatus>) => { setStatuses(await window.api.setThreadStatus(midOf(t), patch)); setSel(null) }

  // group OPEN threads into the 3 priority buckets (handled/snoozed are hidden)
  const groups: Record<Bucket, EmailThread[]> = { act: [], watch: [], skip: [] }
  let hidden = 0
  for (const t of threads) {
    if (statusOf(t) !== 'open') { hidden++; continue }
    const o = outcomeOf(t.id)
    const b = o ? bucketOf(o.classification.category, o.classification.urgency) : 'act'
    groups[b].push(t)
  }
  const replyOpen = groups.act.filter((t) => outcomeOf(t.id)?.classification.category === 'ACTION_REPLY').length
  const eventCount = run?.outcomes.reduce((n, o) => n + (o.events?.length ?? 0), 0) ?? 0
  const watchCount = groups.watch.length
  const actNeeds = replyOpen + eventCount + watchCount

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%' }}>
      {run && (
        <div className="today">
          <div className="today-head">
            <Icon name="sparkles" size={18} />
            <span>今天整理了 {run.outcomes.length} 封信</span>
          </div>
          {actNeeds === 0 ? (
            <div className="today-stats"><span className="muted">今天沒有需要你處理的信，都已自動歸類好了。</span></div>
          ) : (
            <div className="today-stats">
              <button className={`stat ${filter === 'act' ? 'on' : ''}`} onClick={() => setFilter(filter === 'act' ? null : 'act')}>
                <Icon name="mail" size={15} /> {replyOpen} 等你回覆 · {eventCount} 個行程
              </button>
              <button className={`stat ${filter === 'watch' ? 'on' : ''}`} onClick={() => setFilter(filter === 'watch' ? null : 'watch')}>
                <Icon name="alert" size={15} /> {watchCount} 要留意
              </button>
              <span className="muted" style={{ fontSize: 12 }}>其餘 {groups.skip.length} 封已歸到可略過{hidden ? ` · 已處理/延後 ${hidden}` : ''}</span>
            </div>
          )}
        </div>
      )}

      <div className="thread-grid">
        <div className="thread-list">
          {!run ? (
            threads.map((t) => <ThreadRow key={t.id} t={t} sel={sel} onSel={setSel} outcome={outcomeOf(t.id)} />)
          ) : (
            ORDER.filter((b) => !filter || b === filter).map((b) => {
              const items = groups[b]
              if (!items.length) return null
              const collapsed = b === 'skip' && !filter
              const body = items.map((t) => <ThreadRow key={t.id} t={t} sel={sel} onSel={setSel} outcome={outcomeOf(t.id)} />)
              return (
                <div key={b}>
                  <div className="thread-group-label">{BUCKET_LABEL[b]}（{items.length}）</div>
                  {collapsed ? (
                    <details><summary className="group-toggle">已自動分類，點開查看</summary>{body}</details>
                  ) : body}
                </div>
              )
            })
          )}
        </div>

        <div className="detail">
          {!thread ? (
            <div className="empty-state">
              <Icon name="inbox" size={26} />
              <div>選一封郵件查看</div>
              <div className="hint">點左側任一封信，這裡會顯示它是什麼、要不要回、有沒有行程。</div>
            </div>
          ) : (
            <>
              <div className="row" style={{ gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                <button className="btn sm" onClick={() => setStatus(thread, { status: 'handled' })}><Icon name="check" size={14} /> 標為已處理</button>
                <button className="btn sm" onClick={() => setStatus(thread, { status: 'snoozed', snoozedUntil: plusDays(1) })}><Icon name="clock" size={14} /> 明天再說</button>
                <button className="btn sm" onClick={() => setStatus(thread, { status: 'snoozed', snoozedUntil: plusDays(7) })}>下週再說</button>
              </div>
              {outcome ? (
                <>
                  <div className="section-title" style={{ marginTop: 0 }}>這封信是什麼</div>
                  <div className="card">
                    <span className="row" style={{ gap: 8 }}>
                      <CategoryBadge category={outcome.classification.category} />
                      {outcome.classification.urgency === 'high' && <span className="badge danger"><Icon name="alert" size={13} /> 高優先</span>}
                    </span>
                    <div style={{ marginTop: 8, color: 'var(--fg-2)' }}>{outcome.classification.reason}</div>
                    {outcome.flagNote && <div style={{ marginTop: 10, color: 'var(--warn-text)' }}><Icon name="alert" size={13} /> {outcome.flagNote}</div>}
                    {outcome.conflictNote && <div style={{ marginTop: 10, color: 'var(--danger-text)', fontWeight: 590 }}><Icon name="alert" size={13} /> 時段衝突：{outcome.conflictNote}</div>}
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
                      <div className="meta" style={{ marginTop: -2 }}>在「行事曆」分頁可以確認或移除這些行程。</div>
                    </>
                  )}

                  {outcome.draft && (
                    <>
                      <div className="section-title">回覆草稿（要你按下寄出才會送）</div>
                      <div className="card">
                        <div className="meta">主旨：{outcome.draft.subject} · 收件：{outcome.draft.to.join(', ')}</div>
                        <textarea
                          className="draft"
                          style={{ marginTop: 8 }}
                          value={editedDraft}
                          onChange={(e) => sel && setDraftEdits((m) => ({ ...m, [sel]: e.target.value }))}
                        />
                        <div className="row" style={{ marginTop: 8, flexWrap: 'wrap' }}>
                          <button className="btn sm" onClick={() => { navigator.clipboard?.writeText(editedDraft); setCopied(true); setTimeout(() => setCopied(false), 1500) }}>
                            <Icon name="copy" size={14} /> {copied ? '已複製（含你的修改）' : '複製草稿'}
                          </button>
                          <button className="btn sm" onClick={() => { window.api.pushDraftToGmail({ ...outcome.draft!, body: editedDraft }); setPushed(true); setTimeout(() => setPushed(false), 2500) }}>
                            <Icon name="mail" size={14} /> {pushed ? '已存到 Gmail 草稿匣' : '存到 Gmail 草稿匣'}
                          </button>
                        </div>
                        <div className="meta" style={{ marginTop: 6 }}>你的修改不會自動進 Gmail —— 按上面「存到 Gmail 草稿匣」會把<b>目前這個版本</b>存進去，再到 Gmail 按寄出。</div>
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
                <div className="empty-state" style={{ marginTop: 4 }}>
                  <Icon name="sparkles" size={26} />
                  <div>還沒整理這封信</div>
                  <div className="hint">點上方「重新整理」，就會分析這封信並擬好需要的草稿。</div>
                </div>
              )}

              <details className="folddetail">
                <summary>看原文</summary>
                <div className="card" style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 15, fontWeight: 590 }}>{thread.messages[0]?.subject}</div>
                  <div className="meta" style={{ marginTop: 4 }}>{thread.messages[0]?.from} · {new Date(thread.messages[0]?.date ?? '').toLocaleString()}</div>
                  <div className="mail-body">{thread.messages[0]?.body}</div>
                  {thread.messages[0]?.attachments?.length ? (
                    <div className="meta" style={{ marginTop: 10 }}><Icon name="paperclip" size={13} style={{ verticalAlign: '-2px' }} /> {thread.messages[0].attachments.length} 個附件：{thread.messages[0].attachments.map((a) => a.filename).join('、')}</div>
                  ) : null}
                </div>
              </details>

              <details className="folddetail">
                <summary>小幫手怎麼處理的？</summary>
                <div style={{ marginTop: 8 }}><AgentPanel events={trail} title="處理過程" /></div>
              </details>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function ThreadRow({ t, sel, onSel, outcome }: { t: EmailThread; sel: string | null; onSel: (id: string) => void; outcome?: ThreadOutcome }) {
  const m = t.messages[0]
  return (
    <div
      className={`thread-item ${sel === t.id ? 'sel' : ''} ${outcome?.classification.urgency === 'high' ? 'vip' : ''}`}
      role="button"
      tabIndex={0}
      aria-pressed={sel === t.id}
      onClick={() => onSel(t.id)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSel(t.id) } }}
    >
      <div className="subj">{m?.subject}</div>
      <div className="from">{m?.from}</div>
      {outcome && (
        <div style={{ marginTop: 7 }}>
          <CategoryBadge category={outcome.classification.category} />
        </div>
      )}
    </div>
  )
}
