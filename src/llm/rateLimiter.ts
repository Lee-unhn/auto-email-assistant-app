// Global rate limiter for free-tier LLM quotas. Enforces a sliding-window RPM
// cap + a minimum gap between request starts, serialized through a promise chain
// (effective concurrency 1). One shared instance fronts ALL Gemini calls so
// bursts across agents/emails can't exceed the quota.

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export class RateLimiter {
  private windowMs = 60_000
  private maxInWindow: number
  private minGapMs: number
  private hist: number[] = []
  private last = 0
  private chain: Promise<unknown> = Promise.resolve()

  constructor(rpm: number) {
    this.maxInWindow = Math.max(1, rpm)
    this.minGapMs = Math.ceil(this.windowMs / this.maxInWindow)
  }

  configure(rpm: number): void {
    if (rpm && rpm > 0) {
      this.maxInWindow = rpm
      this.minGapMs = Math.ceil(this.windowMs / rpm)
    }
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    const slot = this.chain.then(() => this.acquire())
    this.chain = slot.catch(() => undefined)
    await slot
    return fn()
  }

  private prune(): void {
    const cut = Date.now() - this.windowMs
    while (this.hist.length && this.hist[0] < cut) this.hist.shift()
  }

  private async acquire(): Promise<void> {
    if (this.last) {
      const gap = Date.now() - this.last
      if (gap < this.minGapMs) await sleep(this.minGapMs - gap)
    }
    this.prune()
    if (this.hist.length >= this.maxInWindow) {
      const wait = this.windowMs - (Date.now() - this.hist[0]) + 50
      if (wait > 0) await sleep(wait)
      this.prune()
    }
    const t = Date.now()
    this.hist.push(t)
    this.last = t
  }
}

// Shared singleton — every GeminiProvider instance configures + uses this one.
export const geminiLimiter = new RateLimiter(10)

// Parse Gemini's 429 "retryDelay":"42s" hint (ms), capped.
export function parseRetryDelayMs(msg: string): number | null {
  const m = msg.match(/retryDelay"?\s*:?\s*"?(\d+(?:\.\d+)?)s/i)
  if (!m) return null
  return Math.min(60_000, Math.round(parseFloat(m[1]) * 1000))
}
