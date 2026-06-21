import type { EmailThread, DraftReply } from '../types'

export interface MailProvider {
  id: string
  /** List recent threads (read-only). */
  listThreads(opts?: { maxResults?: number }): Promise<EmailThread[]>
  /** Full thread by id. */
  getThread(id: string): Promise<EmailThread | null>
  /** Save a draft. NEVER sends — writes locally (sample) or to Gmail Drafts (gmail). */
  saveDraft(draft: DraftReply): Promise<{ ref: string }>
}
