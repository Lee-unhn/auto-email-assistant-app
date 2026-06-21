import type { Classification, EmailMessage } from '../types'
import { isVip } from './vip'

// Zero-LLM heuristic pre-filter. SAFETY MODEL: this is an ALLOW-LIST OF BULK NOISE,
// never a down-ranker. It can only ever return a NOISE_*/SELF_AUTOMATED verdict, and a
// hard safety gate forces anything that looks security/finance/calendar/VIP back to the
// full LLM classifier (returns null). It keys off structural metadata (sender, subject),
// never treats body text as a routing command (prompt-injection safe).

const SECURITY = ['驗證碼', '登入', '密碼', '帳號', '安全', '異常', '盜', 'security', 'password', 'passcode', '2fa', 'otp', 'verify', 'verification', 'authenticate', 'sign in', 'sign-in', 'suspicious', 'unauthorized', 'recovery']
const FINANCE = ['付款', '發票', '收據', '交易', '帳單', '退款', '轉帳', '匯款', '訂單', '繳費', 'invoice', 'payment', 'billing', 'receipt', 'refund', 'transaction', 'statement', 'charge', 'order', 'wire', 'paid']
const CALENDAR = ['會議', '預約', '截止', '邀請', '行程', '面試', '報名', '出席', 'meeting', 'invite', 'invitation', 'deadline', 'schedule', 'rsvp', 'appointment', 'interview', 'calendar', 'webinar', 'register']

const SOCIAL = ['linkedin.com', 'facebook.com', 'facebookmail.com', 'instagram.com', 'youtube.com', 'twitter.com', 'x.com', 'threads.net', 'tiktok.com', 'reddit.com', 'pinterest.com', 'discord.com', 'medium.com']
const JOB = ['indeed.com', 'glassdoor.com', '104.com.tw', '1111.com.tw', '518.com.tw', 'cakeresume.com', 'yourator.co', 'linkedin.com']
const ESP = ['mailchimp', 'sendgrid.net', 'mailgun', 'substack.com', 'beehiiv.com', 'mktomail.com', 'sparkpostmail.com', 'amazonses.com', 'hubspotemail.net', 'mailerlite', 'sendinblue', 'mcsv.net', 'mcdlv.net']

function addrOf(from: string): string {
  const m = from.match(/<([^>]+)>/)
  return (m ? m[1] : from).trim().toLowerCase()
}
function hit(text: string, words: string[]): boolean {
  const t = text.toLowerCase()
  return words.some((w) => t.includes(w))
}
function domainIn(domain: string, list: string[]): boolean {
  return list.some((d) => domain === d || domain.endsWith('.' + d))
}

export function preFilter(
  msg: EmailMessage | undefined,
  opts: { selfAddress?: string; vipSenders?: string[] }
): Classification | null {
  if (!msg) return null
  const addr = addrOf(msg.from || '')
  const domain = addr.split('@')[1] || ''
  const haystack = (msg.subject || '') + ' ' + (msg.body || '').slice(0, 500)

  // ── SAFETY GATE — never pre-filter these; force the full LLM look ──
  if (hit(haystack, SECURITY) || hit(haystack, FINANCE) || hit(haystack, CALENDAR)) return null
  if (isVip(msg.from || '', opts.vipSenders)) return null

  const mk = (category: Classification['category'], confidence: number, reason: string): Classification =>
    ({ category, confidence, reason, needsCollaboration: false, urgency: 'low' })

  if (opts.selfAddress && addr === opts.selfAddress.toLowerCase()) return mk('SELF_AUTOMATED', 0.97, '自寄信')
  if (/(^|[._-])(no-?reply|do-?not-?reply|notifications?|mailer-daemon|bounce)([._-]|@)/.test(addr)) return mk('NOISE_MARKETING', 0.85, 'no-reply 寄件者')
  if (domainIn(domain, SOCIAL)) return mk('NOISE_SOCIAL', 0.82, '社群平台網域')
  if (domainIn(domain, JOB)) return mk('NOISE_JOB', 0.8, '求職平台網域')
  if (ESP.some((e) => domain.includes(e))) return mk('NOISE_MARKETING', 0.78, '行銷 ESP 寄件') // <0.8 → advisory, still goes to LLM

  return null // no confident match → full LLM classify
}

// Confidence at/above which a pre-filter verdict is trusted enough to skip the LLM.
export const PREFILTER_SKIP = 0.8
