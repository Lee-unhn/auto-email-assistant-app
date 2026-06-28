import type { AgentEvent, AppSettings, DraftReply, EmailThread, LLMProviderId, TriageRun } from '../types'
import type { CalEvent } from '../calendar/appCalendar'
import type { LocalConfig } from '../config/localConfig'
import type { ThreadStatus } from '../state/threadStatus'

// IPC channel names — single source shared by preload + renderer.
export const IPC = {
  getSettings: 'settings:get',
  saveSettings: 'settings:save',
  setKey: 'secrets:setKey',
  testProvider: 'llm:test',
  listThreads: 'mail:list',
  listCalendar: 'calendar:list',
  confirmCalendar: 'calendar:confirm',
  removeCalendar: 'calendar:remove',
  getThreadStatuses: 'thread:statuses',
  setThreadStatus: 'thread:setStatus',
  pushDraftToGmail: 'draft:pushToGmail',
  getConfig: 'config:get',
  saveConfig: 'config:save',
  saveSecrets: 'secrets:saveFiles',
  runTriage: 'triage:run',
  lastRun: 'triage:last',
  openPath: 'shell:openPath',
  revealPath: 'shell:reveal',
  openExternal: 'shell:openExternal',
  agentEvent: 'evt:agent', // main → renderer (live)
  triageProgress: 'evt:progress' // main → renderer (live)
} as const

// Typed surface exposed on window.api by preload.
export interface AppApi {
  getSettings(): Promise<AppSettings>
  saveSettings(s: Partial<AppSettings>): Promise<AppSettings>
  setKey(name: 'gemini' | 'anthropic', value: string): Promise<{ ok: boolean }>
  testProvider(id: LLMProviderId): Promise<{ ok: boolean; detail: string }>
  listThreads(): Promise<EmailThread[]>
  listCalendar(): Promise<CalEvent[]>
  confirmCalendar(id: string): Promise<void>
  removeCalendar(id: string): Promise<void>
  getThreadStatuses(): Promise<Record<string, ThreadStatus>>
  setThreadStatus(id: string, patch: Partial<ThreadStatus>): Promise<Record<string, ThreadStatus>>
  pushDraftToGmail(draft: DraftReply): Promise<{ ref: string }>
  getConfig(): Promise<LocalConfig>
  saveConfig(patch: Partial<LocalConfig>): Promise<LocalConfig>
  saveSecrets(s: { gmailAddress?: string; gmailAppPassword?: string; geminiKey?: string }): Promise<{ ok: boolean }>
  runTriage(): Promise<TriageRun>
  lastRun(): Promise<TriageRun | null>
  openPath(p: string): Promise<void>
  revealPath(p: string): Promise<void>
  openExternal(url: string): Promise<void>
  onAgentEvent(cb: (e: AgentEvent & { threadId: string }) => void): () => void
  onProgress(cb: (p: { done: number; total: number; subject: string }) => void): () => void
}
