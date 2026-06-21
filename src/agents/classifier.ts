import type { Classification, EmailThread } from '../types'
import { extractJson } from '../llm'
import { HARD_RULES } from '../rules/hardRules'
import { TAXONOMY_PROMPT, ACTIONABLE } from '../rules/taxonomy'
import { AgentCtx, threadText } from './types'

export async function classify(thread: EmailThread, ctx: AgentCtx): Promise<Classification> {
  ctx.emit({ agent: 'Classifier', status: 'start', message: '分類郵件意圖…' })
  const system = `你是郵件分流分類器。${HARD_RULES}\n\n分類類別：\n${TAXONOMY_PROMPT}`
  const user = `把這封郵件歸到唯一最適類別。判斷 needsCollaboration（是否需要多 agent 協作：真人請求、需要查證或撰寫回覆、需要找材料時為 true；單純通知/噪音為 false）。\n\n郵件：\n${threadText(
    thread.messages
  )}\n\n只回 JSON：{"category":"<ID>","confidence":0..1,"reason":"一句中文","needsCollaboration":true|false}`
  try {
    const r = await ctx.llm.complete({ system, user, json: true, maxTokens: 400 })
    const c = extractJson<Classification>(r.text)
    if (!c.category) throw new Error('no category')
    // belt-and-suspenders: actionable categories imply collaboration is at least considered
    if (ACTIONABLE.includes(c.category) && c.category !== 'ACTION_EVENT') c.needsCollaboration = true
    ctx.emit({ agent: 'Classifier', status: 'done', message: `${c.category} (${Math.round((c.confidence ?? 0) * 100)}%)` })
    return c
  } catch (e: any) {
    ctx.emit({ agent: 'Classifier', status: 'error', message: e?.message ?? 'classify failed' })
    return { category: 'INFO_SYS', confidence: 0, reason: 'fallback (分類失敗)', needsCollaboration: false }
  }
}
