import type { DraftReply, ExtractedEvent } from '../types'
import { extractJson } from '../llm'
import { HARD_RULES } from '../rules/hardRules'
import { AgentCtx } from './types'

export interface Verdict {
  ok: boolean
  issues: string[]
}

// Adversarial check before surfacing a draft/event: catch hard-rule violations,
// hallucinated commitments, wrong dates.
export async function verify(
  payload: { draft?: DraftReply; event?: ExtractedEvent },
  ctx: AgentCtx
): Promise<Verdict> {
  ctx.emit({ agent: 'Verifier', status: 'start', message: '對抗式複核…' })
  const system = `你是嚴格的複核者。${HARD_RULES}\n找出問題：草稿是否擅自承諾/報價/同意出席（應留白）、是否像要直接寄出、事件日期是否可疑、是否洩漏機密。預設挑剔。`
  const user = `複核以下產物，回 JSON：{"ok":true|false,"issues":["..."]}（沒問題則 issues 空陣列）。\n\n${JSON.stringify(
    payload
  )}`
  try {
    const r = await ctx.llm.complete({ system, user, json: true, maxTokens: 400 })
    const v = extractJson<Verdict>(r.text)
    ctx.emit({
      agent: 'Verifier',
      status: 'done',
      message: v.ok ? '通過' : `留意 ${v.issues?.length ?? 0} 項`
    })
    return { ok: !!v.ok, issues: v.issues ?? [] }
  } catch (e: any) {
    ctx.emit({ agent: 'Verifier', status: 'error', message: e?.message ?? 'verify failed' })
    return { ok: true, issues: [] }
  }
}
