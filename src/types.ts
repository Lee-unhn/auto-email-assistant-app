// Shared types — pure (no Node imports) so both main and renderer can import.

export type LLMProviderId = 'gemini' | 'claude'

export interface Attachment {
  filename: string
  type: string
  size: number
}

export interface EmailMessage {
  id: string
  from: string
  to: string[]
  subject: string
  date: string // ISO
  snippet: string
  body: string // plain text
  attachments?: Attachment[]
}

export interface EmailThread {
  id: string
  messages: EmailMessage[]
}

export type Category =
  | 'ACTION_EVENT'
  | 'ACTION_REPLY'
  | 'ACTION_MATERIAL'
  | 'FLAG_SECURITY'
  | 'FLAG_FINANCE'
  | 'INFO_BANK'
  | 'INFO_SYS'
  | 'NOISE_JOB'
  | 'NOISE_SOCIAL'
  | 'NOISE_MARKETING'
  | 'SELF_AUTOMATED'

export interface Classification {
  category: Category
  confidence: number // 0..1
  reason: string
  needsCollaboration: boolean
  urgency?: 'high' | 'normal' | 'low' // piggybacks the classifier call (no extra LLM call)
}

export interface ExtractedEvent {
  summary: string
  startISO: string // local wall time, no offset (paired with timeZone)
  endISO: string
  timeZone: string
  reminders: number[] // minutes before start
  sourceNote: string
}

export interface DraftReply {
  to: string[]
  subject: string
  body: string
  replyToMessageId: string
}

export interface Material {
  title: string
  source: 'local' | 'web' | 'drive'
  ref: string // path or url
  snippet: string
}

export interface AgentEvent {
  ts: number
  agent: string
  status: 'start' | 'done' | 'skip' | 'error'
  message: string
}

export interface ThreadOutcome {
  threadId: string
  subject: string
  from: string
  classification: Classification
  events?: ExtractedEvent[]
  draft?: DraftReply
  materials?: Material[]
  flagNote?: string
  conflictNote?: string
  icsPath?: string
  draftPath?: string
  agentTrail: AgentEvent[]
}

export interface TriageRun {
  startedAt: string
  finishedAt?: string
  provider: LLMProviderId
  outcomes: ThreadOutcome[]
  stats: Record<string, number>
}

export interface AppSettings {
  provider: LLMProviderId
  hasGeminiKey: boolean
  hasClaudeKey: boolean
  geminiModel: string
  geminiRpm: number
  claudeModel: string
  mailSource: 'sample' | 'gmail' | 'imap'
  localScanRoots: string[]
  scheduleCron: string
  scheduleEnabled: boolean
  digestEnabled: boolean
  notifyEnabled: boolean
  jarvisBridgeEnabled: boolean
  jarvisEventsDir: string
  vipSenders: string[]
  theme: string
  onboarded: boolean // first-run wizard completed/skipped
}

export const DEFAULT_SETTINGS: AppSettings = {
  provider: 'gemini',
  hasGeminiKey: false,
  hasClaudeKey: false,
  geminiModel: 'gemini-2.5-flash',
  geminiRpm: 10,
  claudeModel: 'claude-haiku-4-5-20251001',
  mailSource: 'gmail',
  localScanRoots: [], // default: no foreign-drive scan (user enables their own roots in Settings)
  scheduleCron: '7 8 * * *',
  scheduleEnabled: true, // proactive by default — the assistant runs daily without the user pressing a button
  digestEnabled: true,
  notifyEnabled: true, // generic desktop toast on triage complete (no PII in text)
  jarvisBridgeEnabled: false, // default off (voice module is opt-in, requires Jarvis installed)
  jarvisEventsDir: '',
  vipSenders: [],
  theme: 'linear-app',
  onboarded: false
}
