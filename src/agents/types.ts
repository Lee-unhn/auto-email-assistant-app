import type { LLMProvider } from '../llm'
import type { AgentEvent, AppSettings, Material } from '../types'

export interface AgentCtx {
  llm: LLMProvider
  emit: (e: Omit<AgentEvent, 'ts'>) => void
  settings: AppSettings
  today: string // YYYY-MM-DD local
  // injected by main process (filesystem access stays out of the agent modules)
  localScan: (keywords: string[], roots: string[]) => Promise<Material[]>
}

export function threadText(messages: { from: string; subject: string; date: string; body: string }[]): string {
  return messages
    .map((m) => `From: ${m.from}\nDate: ${m.date}\nSubject: ${m.subject}\n\n${m.body}`)
    .join('\n\n---\n\n')
}
