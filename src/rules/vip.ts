// VIP / important senders — mail from these is always surfaced (never silently
// skipped) and marked high-urgency, even if otherwise classified as noise.
export function isVip(from: string, vipSenders: string[] | undefined): boolean {
  if (!vipSenders?.length) return false
  const f = (from || '').toLowerCase()
  return vipSenders.some((v) => v && f.includes(v.trim().toLowerCase()))
}
