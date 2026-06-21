import type { LLMProviderId } from '../types'

export interface LLMRequest {
  system: string
  user: string
  json?: boolean // ask for strict JSON output
  useWebSearch?: boolean
  maxTokens?: number
}

export interface Grounding {
  title: string
  url: string
  snippet: string
}

export interface LLMResult {
  text: string
  grounding: Grounding[]
}

export interface LLMProvider {
  id: LLMProviderId
  model: string
  complete(req: LLMRequest): Promise<LLMResult>
  testConnection(): Promise<{ ok: boolean; detail: string }>
}

// Tolerant JSON extractor — strips code fences / prose around a JSON object.
export function extractJson<T = unknown>(text: string): T {
  let t = text.trim()
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) t = fence[1].trim()
  const first = t.search(/[[{]/)
  const lastObj = t.lastIndexOf('}')
  const lastArr = t.lastIndexOf(']')
  const last = Math.max(lastObj, lastArr)
  if (first >= 0 && last > first) t = t.slice(first, last + 1)
  return JSON.parse(t) as T
}
