// Deterministic quote/signature stripper. Gives the agents the LATEST message's NEW
// content instead of the entire quoted thread — which (a) stops re-extracting stale or
// cancelled events buried in quoted history, (b) stops mis-attributing quoted first-person
// commitments, (c) cuts tokens 4-5x on deep replies. Falls back to the original if
// stripping would leave nothing (never lose content on an unusual format).

const REPLY_MARKERS: RegExp[] = [
  /\n[ \t]*On\b.{0,220}\bwrote:[ \t]*\n/i, // Gmail/Apple "On <date>, <name> wrote:"
  /\n[ \t]*-{2,}\s*Original Message\s*-{2,}/i, // Outlook
  /\n[ \t]*From:.+\n(?:.*\n)?(?:Sent|Date):.+\n/i, // Outlook header block
  /\n[ \t]*寄件者[:：].+\n/, // 中文 Outlook
  /\n.{0,80}於.{0,120}寫道[:：][ \t]*\n/, // 中文 "於 ... 寫道："
  /\n.{0,80}寫道[:：][ \t]*\n/,
  /\n[ \t]*_{5,}[ \t]*\n/ // ____ separator
]

export function cleanBody(body: string): string {
  if (!body) return ''
  const t = body.replace(/\r\n/g, '\n')
  let cut = t.length
  for (const re of REPLY_MARKERS) {
    const m = t.match(re)
    if (m && m.index !== undefined && m.index < cut) cut = m.index
  }
  let out = t.slice(0, cut)
  // drop quoted (>) lines
  out = out.split('\n').filter((l) => !/^\s*>/.test(l)).join('\n')
  // drop a trailing signature block introduced by a "-- " delimiter line
  const sig = out.search(/\n-{2}[ \t]*\n/)
  if (sig >= 0) out = out.slice(0, sig)
  out = out.replace(/\n{3,}/g, '\n\n').trim()
  return out || body.trim()
}
