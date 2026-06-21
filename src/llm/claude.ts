import Anthropic from '@anthropic-ai/sdk'
import type { LLMProvider, LLMRequest, LLMResult, Grounding } from './LLMProvider'

// Claude provider — premium toggle. Uses Anthropic's server-side web_search tool
// for the material-finder agent.
export class ClaudeProvider implements LLMProvider {
  id = 'claude' as const
  model: string
  private client: Anthropic

  constructor(apiKey: string, model = 'claude-haiku-4-5-20251001') {
    this.client = new Anthropic({ apiKey })
    this.model = model
  }

  async complete(req: LLMRequest): Promise<LLMResult> {
    const system = req.json
      ? `${req.system}\n\nRespond with valid JSON only — no prose, no code fences.`
      : req.system
    const msg = await this.client.messages.create({
      model: this.model,
      max_tokens: req.maxTokens ?? 2048,
      system,
      messages: [{ role: 'user', content: req.user }],
      tools: req.useWebSearch
        ? ([{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }] as any)
        : undefined
    })
    const text = msg.content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('\n')
    const grounding: Grounding[] = []
    for (const b of msg.content as any[]) {
      if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) {
        for (const r of b.content) {
          if (r.url) grounding.push({ title: r.title ?? r.url, url: r.url, snippet: r.encrypted_content ? '' : (r.page_age ?? '') })
        }
      }
    }
    return { text, grounding }
  }

  async testConnection(): Promise<{ ok: boolean; detail: string }> {
    try {
      const r = await this.complete({ system: 'You are a ping.', user: 'Reply with the single word: pong', maxTokens: 16 })
      return { ok: /pong/i.test(r.text), detail: `${this.model}: ${r.text.trim().slice(0, 40)}` }
    } catch (e: any) {
      return { ok: false, detail: e?.message ?? String(e) }
    }
  }
}
