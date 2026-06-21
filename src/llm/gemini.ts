import { GoogleGenerativeAI } from '@google/generative-ai'
import type { LLMProvider, LLMRequest, LLMResult, Grounding } from './LLMProvider'
import { geminiLimiter, parseRetryDelayMs } from './rateLimiter'

// Gemini provider — default (free-tier per AI Cost Guard). Uses Gemini's built-in
// Google Search grounding for the material-finder agent.
export class GeminiProvider implements LLMProvider {
  id = 'gemini' as const
  model: string
  private client: GoogleGenerativeAI
  // On daily-quota exhaustion of the primary, fall through to another model that
  // has a separate quota bucket (confirmed: flash-latest answers when 2.5 is 429'd).
  private fallbacks = ['gemini-flash-latest', 'gemini-2.0-flash-lite']

  constructor(apiKey: string, model = 'gemini-2.5-flash', rpm?: number) {
    this.client = new GoogleGenerativeAI(apiKey)
    this.model = model
    if (rpm) geminiLimiter.configure(rpm)
  }

  async complete(req: LLMRequest): Promise<LLMResult> {
    // Layer 1: global rate limiter (sliding-window RPM + min gap) fronts every call.
    // Layer 2: retry on 429/503 honoring retryDelay. Layer 3: model fallback chain.
    const seen = new Set<string>()
    const chain = [this.model, ...this.fallbacks].filter((m) => (seen.has(m) ? false : (seen.add(m), true)))
    const delays = [2000, 6000]
    let lastErr: unknown
    for (const m of chain) {
      for (let attempt = 0; attempt <= delays.length; attempt++) {
        try {
          return await geminiLimiter.run(() => this.once(req, m))
        } catch (e: any) {
          lastErr = e
          const msg = String(e?.message ?? e)
          const retryable = /429|503|quota|rate|overloaded|UNAVAILABLE|RESOURCE_EXHAUSTED/i.test(msg)
          if (!retryable) throw e // genuine error — don't burn other models
          if (attempt === delays.length) break // this model exhausted → next model
          await new Promise((r) => setTimeout(r, parseRetryDelayMs(msg) ?? delays[attempt]))
        }
      }
    }
    throw lastErr
  }

  private async once(req: LLMRequest, modelName = this.model): Promise<LLMResult> {
    const genConfig: any = {
      maxOutputTokens: req.maxTokens ?? 2048,
      responseMimeType: req.json && !req.useWebSearch ? 'application/json' : 'text/plain'
    }
    // gemini-2.5-* "thinking" consumes the output budget and can starve the answer
    // on longer inputs — disable it for deterministic, token-bounded agent calls.
    if (modelName.includes('2.5')) genConfig.thinkingConfig = { thinkingBudget: 0 }
    const model = this.client.getGenerativeModel({
      model: modelName,
      systemInstruction: req.system,
      // Search grounding and forced-JSON mime can't combine; prefer search when asked.
      tools: req.useWebSearch ? ([{ googleSearch: {} }] as any) : undefined,
      generationConfig: genConfig
    })
    const result = await model.generateContent(req.user)
    const resp = result.response
    const text = resp.text()
    const grounding: Grounding[] = []
    const chunks = (resp.candidates?.[0] as any)?.groundingMetadata?.groundingChunks ?? []
    for (const c of chunks) {
      if (c.web?.uri) grounding.push({ title: c.web.title ?? c.web.uri, url: c.web.uri, snippet: '' })
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
