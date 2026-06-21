import type { AgentEvent } from '../../types'

const tagCls: Record<AgentEvent['status'], string> = {
  start: 'tag-start',
  done: 'tag-done',
  skip: 'tag-skip',
  error: 'tag-error'
}

// Friendly labels so internal agent/status names never reach the screen.
const NAME: Record<string, string> = {
  Orchestrator: '統籌',
  Classifier: '分類',
  EventExtractor: '抓日期',
  Researcher: '找資料',
  ReplyDrafter: '寫草稿',
  Verifier: '複查',
  Calendar: '行事曆',
  Draft: '草稿',
  Digest: '摘要',
  JarvisBridge: '語音通知'
}
const STATUS: Record<AgentEvent['status'], string> = {
  start: '進行中',
  done: '完成',
  skip: '略過',
  error: '未完成'
}

export function AgentPanel({ events, title }: { events: AgentEvent[]; title?: string }) {
  return (
    <div className="card agent-panel">
      <div className="section-title" style={{ marginTop: 0 }}>{title ?? '處理過程'}</div>
      {events.length === 0 ? (
        <div className="empty-state" style={{ padding: '28px 16px' }}>
          <div className="ico">🤝</div>
          <div className="hint">整理收件匣後，這裡會顯示處理進度。</div>
        </div>
      ) : (
        <div className="scrollbox">
          {events.map((e, i) => (
            <div className="agent-row" key={i}>
              <span className="agent-name">{NAME[e.agent] ?? e.agent}</span>
              <span className={tagCls[e.status]}>{STATUS[e.status]}</span>
              <span className="muted">{e.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
