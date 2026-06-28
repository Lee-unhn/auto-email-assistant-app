import type { DraftReply, EmailThread, Material } from '../types'
import { extractJson } from '../llm'
import { HARD_RULES } from '../rules/hardRules'
import { AgentCtx, threadText } from './types'

export async function draftReply(
  thread: EmailThread,
  materials: Material[],
  ctx: AgentCtx
): Promise<DraftReply | null> {
  ctx.emit({ agent: 'ReplyDrafter', status: 'start', message: '撰寫回覆草稿（不寄）…' })
  // messages are newest-first after thread grouping → [0] is the latest message; reply to that sender.
  const last = thread.messages[0]
  const matBlock = materials.length
    ? `\n\n可引用的材料：\n${materials.map((m) => `- ${m.title} (${m.source}) ${m.ref} ${m.snippet}`.trim()).join('\n')}`
    : ''
  const system = `你替使用者撰寫務實、繁體中文的私人郵件回覆草稿。語氣專業友善、簡潔、不浮誇、不用 emoji。${HARD_RULES}\n你只產生草稿；永遠不寄出。\n若來信是請你「產出內容/分析/整理/草稿」（而非單純回覆），就在草稿正文裡**直接、完整地完成該內容**（善用提供的材料），不要只說「我會處理」。\n若涉及需要使用者本人決定的事（報價、承諾、出席、寄送對象），用「待確認」留白讓使用者填。`
  const user = `根據這封來信撰寫回覆草稿。主旨用「Re: 原主旨」並前綴「[自動草稿]」。${matBlock}\n\n來信：\n${threadText(
    thread.messages
  )}\n\n只回 JSON：{"subject","body"}`
  try {
    const r = await ctx.llm.complete({ system, user, json: true, maxTokens: 1200 })
    const d = extractJson<{ subject: string; body: string }>(r.text)
    const draft: DraftReply = {
      to: [last.from],
      subject: d.subject?.startsWith('[自動草稿]') ? d.subject : `[自動草稿] Re: ${last.subject}`,
      body: d.body ?? '',
      replyToMessageId: last.id
    }
    ctx.emit({ agent: 'ReplyDrafter', status: 'done', message: `草稿完成（${draft.body.length} 字）` })
    return draft
  } catch (e: any) {
    ctx.emit({ agent: 'ReplyDrafter', status: 'error', message: e?.message ?? 'draft failed' })
    return null
  }
}
