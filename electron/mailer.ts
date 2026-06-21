import nodemailer from 'nodemailer'
import type { GmailCreds } from './keyloader'
import { assertNeverSend } from '../src/rules/hardRules'

// The ONLY place this app sends mail. HARD CONSTRAINT: recipient must be the
// authenticated account itself (self-notification digest). Any other recipient
// trips assertNeverSend() — the program-layer backstop to "never send on the
// user's behalf to others", even if some future caller passes a bad recipient.
// The ONLY send path. `to` is an independent argument so the guard is REAL and
// reachable: any caller passing a non-self recipient trips assertNeverSend().
export async function sendOnlyToSelf(creds: GmailCreds, to: string, subject: string, text: string): Promise<void> {
  if (!creds?.user) throw new Error('no gmail creds')
  if (to !== creds.user) assertNeverSend() // reachable guard, not dead code
  const transport = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: creds.user, pass: creds.pass }
  })
  await transport.sendMail({ from: creds.user, to, subject, text })
}

export async function sendSelfDigest(creds: GmailCreds, subject: string, text: string): Promise<void> {
  return sendOnlyToSelf(creds, creds.user, subject, text)
}
