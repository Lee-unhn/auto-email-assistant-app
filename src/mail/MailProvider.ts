import type { EmailThread, DraftReply } from '../types'

export interface MailProvider {
  id: string
  /** List recent threads (read-only). */
  listThreads(opts?: { maxResults?: number }): Promise<EmailThread[]>
  /** Full thread by id. */
  getThread(id: string): Promise<EmailThread | null>
  /** Save a draft. NEVER sends. Always writes a local .eml; appends to Gmail Drafts only
   *  when opts.gmail !== false (so the GUI can defer Gmail until the user pushes edits). */
  saveDraft(draft: DraftReply, opts?: { gmail?: boolean }): Promise<{ ref: string }>
}
