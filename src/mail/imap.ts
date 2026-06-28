import { promises as fs } from 'fs'
import path from 'path'
import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import type { EmailThread, DraftReply } from '../types'
import type { MailProvider } from './MailProvider'
import { groupIntoThreads, type BuiltMessage } from './threadGroup'

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

  // Build one message + its thread key (References root / In-Reply-To / own Message-ID).
  private async toBuilt(uid: string, source: Buffer): Promise<BuiltMessage> {
    const p = await simpleParser(source)
    const attachments = (p.attachments ?? [])
      .filter((a) => a.contentDisposition !== 'inline' || a.filename)
      .map((a) => ({ filename: a.filename ?? '(未命名)', type: a.contentType ?? '', size: a.size ?? 0 }))
    const to = (p.to && 'value' in p.to ? p.to.value : []).map((a) => a.address ?? '').filter(Boolean)
    const cc = (p.cc && 'value' in p.cc ? p.cc.value : []).map((a) => a.address ?? '').filter(Boolean)
    const self = this.user.toLowerCase()
    const refs = Array.isArray(p.references) ? p.references : p.references ? [p.references] : []
    const key = (refs[0] || p.inReplyTo || p.messageId || uid).trim()
    const date = p.date ?? new Date()
    return {
      key,
      dateMs: date.getTime(),
      msg: {
        id: p.messageId ?? uid,
        from: p.from?.text ?? '',
        to,
        ...(cc.length ? { cc } : {}),
        addressedToMe: to.some((a) => a.toLowerCase() === self),
        subject: p.subject ?? '(no subject)',
        date: date.toISOString(),
        snippet: (p.text ?? '').replace(/\s+/g, ' ').slice(0, 160),
        body: (p.text ?? '').slice(0, 8000),
        ...(attachments.length ? { attachments } : {})
      }
    }
  }

  async listThreads(opts?: { maxResults?: number }): Promise<EmailThread[]> {
    const c = this.newClient()
    await c.connect()
    const built: BuiltMessage[] = []
    const lock = await c.getMailboxLock('INBOX')
    try {
      const uids = (await c.search({ seen: false }, { uid: true })) || []
      const recent = uids.slice(-(opts?.maxResults ?? 15))
      if (recent.length) {
        for await (const msg of c.fetch(recent.join(','), { uid: true, source: true }, { uid: true })) {
          if (msg.source) built.push(await this.toBuilt(String(msg.uid), msg.source))
        }
      }
    } finally {
      lock.release()
      await c.logout()
    }
    // Group same-conversation messages into one thread (newest first), then skip the
    // assistant's own digest self-notifications (avoid a feedback loop).
    return groupIntoThreads(built).filter((t) => !/郵件助理摘要|auto-email-assistant/i.test(t.messages[0]?.subject ?? ''))
  }

  async getThread(id: string): Promise<EmailThread | null> {
    const c = this.newClient()
    await c.connect()
    const lock = await c.getMailboxLock('INBOX')
    try {
      const msg = await c.fetchOne(id, { source: true }, { uid: true })
      if (!msg || !msg.source) return null
      const b = await this.toBuilt(id, msg.source)
      return { id: b.msg.id, messages: [b.msg] }
    } finally {
      lock.release()
      await c.logout()
    }
  }

  async saveDraft(draft: DraftReply, opts?: { gmail?: boolean }): Promise<{ ref: string }> {
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

    // Gmail append is deferred when gmail===false (GUI saves the user's EDITED version on
    // demand, avoiding a stale Gmail draft); the headless daemon leaves it default (append).
    if (opts?.gmail === false) return { ref: local }

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
