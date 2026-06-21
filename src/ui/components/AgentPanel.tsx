import type { AgentEvent } from '../../types'

const tagCls: Record<AgentEvent['status'], string> = {
  start: 'tag-start',
  done: 'tag-done',
  skip: 'tag-skip',
  error: 'tag-error'
}

export function AgentPanel({ events, title }: { events: AgentEvent[]; title?: string }) {
  return (
    <div className="card agent-panel">
      <div className="section-title" style={{ marginTop: 0 }}>{title ?? '🤝 Agent 協作即時軌跡'}</div>
      {events.length === 0 ? (
        <div className="meta">尚無事件。執行分流後，各 agent 的決策會即時顯示於此。</div>
      ) : (
        <div className="scrollbox">
          {events.map((e, i) => (
            <div className="agent-row" key={i}>
              <span className="agent-name">{e.agent}</span>
              <span className={tagCls[e.status]}>{e.status}</span>
              <span className="muted">{e.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
