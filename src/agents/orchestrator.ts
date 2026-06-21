import type { AgentEvent, Classification, EmailThread, ThreadOutcome } from '../types'
import { FLAGS } from '../rules/taxonomy'
import { AgentCtx } from './types'
import { classify } from './classifier'
import { extractEvents } from './eventExtractor'
import { research } from './researcher'
import { draftReply } from './replyDrafter'
import { verify } from './verifier'

// The orchestrator JUDGES complexity and decides whether to collaborate:
//   - noise / self / info  → Classifier only (cheap, single agent)
//   - flags                → Classifier only, mark notify-only (never act)
//   - ACTION_EVENT         → + EventExtractor
//   - ACTION_REPLY/MATERIAL→ fan out: Researcher (+EventExtractor if dated) → ReplyDrafter → Verifier → synthesize
export async function orchestrate(thread: EmailThread, ctx: AgentCtx, pre?: Classification): Promise<ThreadOutcome> {
  const trail: AgentEvent[] = []
  // Record into the per-thread trail AND forward to the live UI sink (ctx.emit).
  const localCtx: AgentCtx = {
    ...ctx,
    emit: (e) => {
      trail.push({ ...e, ts: Date.now() })
      ctx.emit(e)
    }
  }
  localCtx.emit({ agent: 'Orchestrator', status: 'start', message: '評估郵件…' })

  const subject = thread.messages[0]?.subject ?? '(no subject)'
  const from = thread.messages[0]?.from ?? ''
  // Use a precomputed classification when provided (zero-LLM pre-filter or batch classify);
  // otherwise classify this email on its own (the proven per-email fallback path).
  const classification = pre ?? await classify(thread, localCtx)
  if (pre) localCtx.emit({ agent: 'Classifier', status: 'done', message: `${pre.category}（${pre.confidence >= 0.8 && pre.reason.length < 12 ? '規則' : '批次'}）` })
  const outcome: ThreadOutcome = { threadId: thread.id, subject, from, classification, agentTrail: trail }

  const cat = classification.category

  // LLM failed to classify (confidence 0 = fallback, e.g. Gemini free-tier 429).
  // Do NOT silently skip — surface it so a real task can't vanish under throttling.
  if (classification.confidence === 0) {
    outcome.flagNote = '分類失敗（可能 LLM 限流/額度用罄）— 此信未處理，建議稍後重跑或改用 Claude 模式'
    localCtx.emit({ agent: 'Orchestrator', status: 'error', message: '分類失敗 → 標記待處理（不靜默略過）' })
    return outcome
  }

  if (cat.startsWith('NOISE') || cat === 'SELF_AUTOMATED' || cat.startsWith('INFO')) {
    localCtx.emit({ agent: 'Orchestrator', status: 'skip', message: '單一 agent 足夠：略過/旗標，不動作' })
    return outcome
  }

  if (FLAGS.includes(cat)) {
    outcome.flagNote = `${cat === 'FLAG_SECURITY' ? '安全' : '金流'}：只通知，不處理。${classification.reason}`
    localCtx.emit({ agent: 'Orchestrator', status: 'done', message: '升級為通知（不採取任何動作）' })
    return outcome
  }

  if (cat === 'ACTION_EVENT') {
    const evs = await extractEvents(thread, localCtx)
    if (evs.length) outcome.events = evs
    localCtx.emit({ agent: 'Orchestrator', status: 'done', message: evs.length ? `建 ${evs.length} 個事件（待確認）` : '無可建事件' })
    return outcome
  }

  // ACTION_REPLY or ACTION_MATERIAL → collaborate
  localCtx.emit({ agent: 'Orchestrator', status: 'start', message: '複雜信 → 派出 Researcher + Drafter + Verifier 協作' })

  const [materials, evs] = await Promise.all([research(thread, localCtx), extractEvents(thread, localCtx)])
  outcome.materials = materials
  if (evs.length) outcome.events = evs

  if (cat === 'ACTION_REPLY' || cat === 'ACTION_MATERIAL') {
    // ACTION_MATERIAL = a content/deliverable request → the draft IS the work product
    // (analysis, summary, etc.), composed from the gathered materials.
    const draft = await draftReply(thread, materials, localCtx)
    if (draft) {
      const verdict = await verify({ draft, event: evs[0] }, localCtx)
      if (!verdict.ok && verdict.issues.length) {
        draft.body = `※ 複核提醒：${verdict.issues.join('；')}\n\n${draft.body}`
      }
      outcome.draft = draft
    }
  }

  localCtx.emit({ agent: 'Orchestrator', status: 'done', message: '協作完成，產物待你確認' })
  return outcome
}
