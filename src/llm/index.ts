import type { LLMProviderId } from '../types'
import type { LLMProvider } from './LLMProvider'
import { GeminiProvider } from './gemini'
import { ClaudeProvider } from './claude'

export * from './LLMProvider'

export function createProvider(id: LLMProviderId, apiKey: string, model?: string, rpm?: number): LLMProvider {
  if (id === 'gemini') return new GeminiProvider(apiKey, model, rpm)
  return new ClaudeProvider(apiKey, model)
}
