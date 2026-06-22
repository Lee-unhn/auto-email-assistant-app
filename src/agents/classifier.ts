import type { Classification, EmailThread } from '../types'
import { extractJson } from '../llm'
import { HARD_RULES } from '../rules/hardRules'
import { TAXONOMY_PROMPT, ACTIONABLE, CATEGORY_MAP } from '../rules/taxonomy'
import { cleanBody } from '../rules/cleanBody'
import { AgentCtx, threadText } from './types'

export async function classify(thread: EmailThread, ctx: AgentCtx): Promise<Classification> {
  ctx.emit({ agent: 'Classifier', status: 'start', message: '分類郵件意圖…' })
  const system = `你是郵件分流分類器。${HARD_RULES}\n\n分類類別：\n${TAXONOMY_PROMPT}`
  const m0 = thread.messages[0]
  const addrHint = m0?.addressedToMe === false ? '\n（注意：你不在收件人 To，可能只是副本(CC)或群發 — 多半不需你親自回覆，needsCollaboration 傾向 false。）' : ''
  const user = `把這封郵件歸到唯一最適類別。判斷 needsCollaboration（真人請求/需查證/需撰寫回覆/需找材料為 true；單純通知/噪音為 false）。判斷 urgency（需盡快處理、有近期截止或真人等回覆為 "high"；一般 "normal"；純噪音/行銷 "low"）。${addrHint}\n\n郵件：\n${threadText(
    thread.messages
  )}\n\n只回 JSON：{"category":"<ID>","confidence":0..1,"reason":"一句中文","needsCollaboration":true|false,"urgency":"high|normal|low"}`
  try {
    const r = await ctx.llm.complete({ system, user, json: true, maxTokens: 400 })
    const c = extractJson<Classification>(r.text)
    if (!c.category) throw new Error('no category')
    // belt-and-suspenders: actionable categories imply collaboration is at least considered
    if (ACTIONABLE.includes(c.category) && c.category !== 'ACTION_EVENT') c.needsCollaboration = true
    if (!c.urgency) c.urgency = 'normal'
    ctx.emit({ agent: 'Classifier', status: 'done', message: `${c.category} (${Math.round((c.confidence ?? 0) * 100)}%)` })
    return c
  } catch (e: any) {
    ctx.emit({ agent: 'Classifier', status: 'error', message: e?.message ?? 'classify failed' })
    return { category: 'INFO_SYS', confidence: 0, reason: 'fallback (分類失敗)', needsCollaboration: false }
  }
}

// Classify MANY emails in ONE LLM call (array in → JSON array out), to collapse the
// per-email classify calls that dominate wall-time on a 10-RPM free tier. Returns one
// Classification per input thread, aligned by index. THROWS on any shape/validity
// mismatch so the caller can fall back to per-email classify (never silently degrade).
export async function batchClassify(threads: EmailThread[], ctx: AgentCtx): Promise<Classification[]> {
  const system = `你是郵件分流分類器。${HARD_RULES}\n\n分類類別：\n${TAXONOMY_PROMPT}`
  const items = threads.map((t, i) => {
    const m = t.messages[0]
    return { i, from: m?.from ?? '', subject: m?.subject ?? '', addressedToMe: m?.addressedToMe ?? true, body: cleanBody(m?.body ?? '').slice(0, 800) }
  })
  const user = `把下列每封郵件各歸到唯一最適類別，逐封獨立判斷（每封只看自己的內容）。判斷 needsCollaboration 與 urgency（規則同單封）。addressedToMe=false 代表你只是副本/群發，多半不需親自回覆（needsCollaboration 傾向 false）。\n只回 JSON 陣列，長度與順序必須與輸入完全一致：\n[{"i":0,"category":"<ID>","confidence":0..1,"reason":"一句中文","needsCollaboration":true|false,"urgency":"high|normal|low"}, ...]\n\n郵件們（JSON）：\n${JSON.stringify(items)}`

  const r = await ctx.llm.complete({ system, user, json: true, maxTokens: Math.min(8000, 120 * threads.length) })
  const arr = extractJson<any[]>(r.text)
  if (!Array.isArray(arr) || arr.length !== threads.length) throw new Error('batch shape mismatch')

  return threads.map((_, i) => {
    const item = arr.find((a) => a?.i === i) ?? arr[i]
    if (!item || !item.category || !(item.category in CATEGORY_MAP)) throw new Error(`batch item ${i} invalid`)
    const c: Classification = {
      category: item.category,
      confidence: typeof item.confidence === 'number' ? item.confidence : 0.5,
      reason: item.reason ?? '',
      needsCollaboration: !!item.needsCollaboration,
      urgency: item.urgency ?? 'normal'
    }
    if (ACTIONABLE.includes(c.category) && c.category !== 'ACTION_EVENT') c.needsCollaboration = true
    return c
  })
}
