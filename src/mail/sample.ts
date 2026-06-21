import { promises as fs } from 'fs'
import path from 'path'
import type { EmailThread, DraftReply } from '../types'
import type { MailProvider } from './MailProvider'

// v1 mail source: reads bundled JSON fixtures + any .eml dropped in the folder.
// Drafts are written as .eml files to <userData>/drafts — never sent.
export class SampleMailProvider implements MailProvider {
  id = 'sample'
  constructor(private fixturesDir: string, private draftsDir: string) {}

  private async load(): Promise<EmailThread[]> {
    const jsonPath = path.join(this.fixturesDir, 'sample_inbox.json')
    const raw = await fs.readFile(jsonPath, 'utf-8')
    return JSON.parse(raw) as EmailThread[]
  }

  async listThreads(opts?: { maxResults?: number }): Promise<EmailThread[]> {
    const all = await this.load()
    return opts?.maxResults ? all.slice(0, opts.maxResults) : all
  }

  async getThread(id: string): Promise<EmailThread | null> {
    const all = await this.load()
    return all.find((t) => t.id === id) ?? null
  }

  async saveDraft(draft: DraftReply): Promise<{ ref: string }> {
    await fs.mkdir(this.draftsDir, { recursive: true })
    const safe = draft.subject.replace(/[^\p{L}\p{N} _-]/gu, '_').slice(0, 60) || 'draft'
    const file = path.join(this.draftsDir, `${Date.now()}_${safe}.eml`)
    const eml =
      `To: ${draft.to.join(', ')}\r\n` +
      `Subject: ${draft.subject}\r\n` +
      `X-Reply-To-Message-Id: ${draft.replyToMessageId}\r\n` +
      `X-Auto-Generated: auto-email-assistant (DRAFT — not sent)\r\n` +
      `Content-Type: text/plain; charset=utf-8\r\n\r\n` +
      draft.body
    await fs.writeFile(file, eml, 'utf-8')
    return { ref: file }
  }
}
