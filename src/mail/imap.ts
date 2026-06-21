import { promises as fs } from 'fs'
import path from 'path'
import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import type { EmailThread, DraftReply } from '../types'
import type { MailProvider } from './MailProvider'

// Real Gmail via IMAP app-password (read) + IMAP APPEND to Drafts (never sends).
export class ImapMailProvider implements MailProvider {
  id = 'gmail-imap'
  private user: string
  private pass: string
  private draftsDir: string
  constructor(user: string, pass: string, draftsDir: string) {
    this.user = user
    this.pass = pass
    this.draftsDir = draftsDir
  }

  private newClient(): ImapFlow {
    return new ImapFlow({
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
      auth: { user: this.user, pass: this.pass },
      logger: false // never log mail/credentials
    })
  }

  private async toThread(uid: string, source: Buffer): Promise<EmailThread> {
    const p = await simpleParser(source)
    return {
      id: uid,
      messages: [
        {
          id: p.messageId ?? uid,
          from: p.from?.text ?? '',
          to: (p.to && 'value' in p.to ? p.to.value : []).map((a) => a.address ?? '').filter(Boolean),
          subject: p.subject ?? '(no subject)',
          date: (p.date ?? new Date()).toISOString(),
          snippet: (p.text ?? '').replace(/\s+/g, ' ').slice(0, 160),
          body: (p.text ?? '').slice(0, 8000)
        }
      ]
    }
  }

  async listThreads(opts?: { maxResults?: number }): Promise<EmailThread[]> {
    const c = this.newClient()
    await c.connect()
    const out: EmailThread[] = []
    const lock = await c.getMailboxLock('INBOX')
    try {
      const uids = (await c.search({ seen: false }, { uid: true })) || []
      const recent = uids.slice(-(opts?.maxResults ?? 15))
      if (recent.length) {
        for await (const msg of c.fetch(recent.join(','), { uid: true, source: true }, { uid: true })) {
          if (msg.source) out.push(await this.toThread(String(msg.uid), msg.source))
        }
      }
    } finally {
      lock.release()
      await c.logout()
    }
    // Skip the assistant's own digest self-notifications (avoid a feedback loop).
    return out.filter((t) => !/郵件助理摘要|auto-email-assistant/i.test(t.messages[0]?.subject ?? '')).reverse()
  }

  async getThread(id: string): Promise<EmailThread | null> {
    const c = this.newClient()
    await c.connect()
    const lock = await c.getMailboxLock('INBOX')
    try {
      const msg = await c.fetchOne(id, { source: true }, { uid: true })
      if (!msg || !msg.source) return null
      return await this.toThread(id, msg.source)
    } finally {
      lock.release()
      await c.logout()
    }
  }

  async saveDraft(draft: DraftReply): Promise<{ ref: string }> {
    // build RFC822 (lazy import keeps module loadable under both Node ESM and esbuild)
    const MailComposer = (await import('nodemailer/lib/mail-composer/index.js')).default
    const mime = await new MailComposer({
      from: this.user,
      to: draft.to.join(', '),
      subject: draft.subject,
      text: draft.body,
      inReplyTo: draft.replyToMessageId || undefined
    }).compile().build()

    // local copy too
    await fs.mkdir(this.draftsDir, { recursive: true })
    const safe = draft.subject.replace(/[^\p{L}\p{N} _-]/gu, '_').slice(0, 60) || 'draft'
    const local = path.join(this.draftsDir, `${Date.now()}_${safe}.eml`)
    await fs.writeFile(local, mime)

    // APPEND to Gmail Drafts (never sent). Find the \Drafts special-use folder.
    const c = this.newClient()
    await c.connect()
    let target = '[Gmail]/Drafts'
    try {
      const boxes = await c.list()
      const d = boxes.find((b) => b.specialUse === '\\Drafts')
      if (d) target = d.path
      await c.append(target, mime, ['\\Draft'])
    } finally {
      await c.logout()
    }
    return { ref: `${target} (Gmail Drafts) + ${local}` }
  }
}
