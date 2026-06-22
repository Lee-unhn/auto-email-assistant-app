import type { EmailThread, EmailMessage } from '../types'

// Pure thread grouping: collapse separately-fetched messages that belong to the same
// conversation (shared References root / In-Reply-To) into one EmailThread, newest first
// (so messages[0] is the LATEST message — the one to act on). Pure + no IMAP, so it's
// unit-testable on its own.
export interface BuiltMessage {
  msg: EmailMessage
  key: string // thread root: references[0] || inReplyTo || own messageId
  dateMs: number
}

export function groupIntoThreads(built: BuiltMessage[]): EmailThread[] {
  const byKey = new Map<string, BuiltMessage[]>()
  for (const b of built) {
    const arr = byKey.get(b.key)
    if (arr) arr.push(b)
    else byKey.set(b.key, [b])
  }
  const threads = [...byKey.values()].map((arr) => {
    arr.sort((a, b) => b.dateMs - a.dateMs) // newest first
    return { id: arr[0].msg.id, messages: arr.map((a) => a.msg), latest: arr[0].dateMs }
  })
  threads.sort((a, b) => b.latest - a.latest) // newest thread first
  return threads.map(({ id, messages }) => ({ id, messages }))
}
