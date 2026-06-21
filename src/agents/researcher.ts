import type { EmailThread, Material } from '../types'
import { extractJson } from '../llm'
import { AgentCtx, threadText } from './types'

// Material-finder: local filesystem (read-only, injected) + web via the LLM's
// native search grounding. Returns deduped materials.
export async function research(thread: EmailThread, ctx: AgentCtx): Promise<Material[]> {
  ctx.emit({ agent: 'Researcher', status: 'start', message: '擷取關鍵字 + 找材料（本機 + web）…' })
  const materials: Material[] = []

  // 1) keywords
  let keywords: string[] = []
  try {
    const kwR = await ctx.llm.complete({
      system: '你抽取檢索關鍵字。',
      user: `從這封郵件抽 2-5 個檢索關鍵字（中英皆可），只回 JSON 陣列：\n${threadText(thread.messages)}`,
      json: true,
      maxTokens: 200
    })
    keywords = extractJson<string[]>(kwR.text).slice(0, 5)
  } catch {
    keywords = [thread.messages[0]?.subject ?? '']
  }

  // 2) local scan (injected fs helper)
  try {
    const local = await ctx.localScan(keywords, ctx.settings.localScanRoots)
    materials.push(...local.slice(0, 5))
    ctx.emit({ agent: 'Researcher', status: 'done', message: `本機命中 ${local.length} 筆（kw: ${keywords.join(', ')}）` })
  } catch (e: any) {
    ctx.emit({ agent: 'Researcher', status: 'error', message: `本機檢索失敗：${e?.message ?? e}` })
  }

  // 3) web via native search
  try {
    ctx.emit({ agent: 'Researcher', status: 'start', message: 'web 查證中…' })
    const webR = await ctx.llm.complete({
      system: '你用網路搜尋找權威來源，回繁中摘要並附連結。',
      user: `針對這封郵件的需求找 2-3 個有用的網路資源（含 URL）。需求：\n${threadText(thread.messages)}`,
      useWebSearch: true,
      maxTokens: 800
    })
    for (const g of webR.grounding.slice(0, 3)) {
      materials.push({ title: g.title, source: 'web', ref: g.url, snippet: g.snippet })
    }
    if (webR.grounding.length === 0 && webR.text.trim()) {
      materials.push({ title: 'Web 摘要', source: 'web', ref: '', snippet: webR.text.trim().slice(0, 400) })
    }
    ctx.emit({ agent: 'Researcher', status: 'done', message: `web 命中 ${webR.grounding.length} 筆` })
  } catch (e: any) {
    ctx.emit({ agent: 'Researcher', status: 'error', message: `web 檢索失敗：${e?.message ?? e}` })
  }

  return materials
}
