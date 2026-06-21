import { spawn } from 'child_process'
import type { LLMProvider, LLMRequest, LLMResult } from './LLMProvider'

// "Claude mode" backed by the Claude Code CLI subscription (`claude -p`), the same
// way Jarvis's brain works — no Anthropic API key needed, no extra cost.
// Full prompt goes via stdin (no long/escaped args). Web search not supported here.
export class ClaudeCliProvider implements LLMProvider {
  id = 'claude' as const
  model = 'claude-code-cli'
  private cwd: string
  constructor(cwd?: string) {
    this.cwd = cwd || process.cwd()
  }

  private run(prompt: string, opts: { webSearch?: boolean; timeoutMs?: number } = {}): Promise<string> {
    const timeoutMs = opts.timeoutMs ?? 180_000
    const args = ['-p', '--output-format', 'text']
    if (opts.webSearch) args.push('--allowedTools', 'WebSearch', 'WebFetch')
    return new Promise((resolve, reject) => {
      const child = spawn('claude', args, { cwd: this.cwd, shell: true })
      let out = ''
      let err = ''
      const timer = setTimeout(() => {
        child.kill()
        reject(new Error('claude CLI timeout'))
      }, timeoutMs)
      child.stdout.on('data', (d) => (out += d))
      child.stderr.on('data', (d) => (err += d))
      child.on('error', (e) => {
        clearTimeout(timer)
        reject(e)
      })
      child.on('close', (code) => {
        clearTimeout(timer)
        if (code === 0) resolve(out.trim())
        else reject(new Error(`claude CLI exit ${code}: ${err.trim().slice(0, 200)}`))
      })
      child.stdin.write(prompt)
      child.stdin.end()
    })
  }

  async complete(req: LLMRequest): Promise<LLMResult> {
    const prompt =
      `${req.system}\n\n` +
      (req.json ? '只用合法 JSON 回覆：不要任何前後文字、不要 code fence。\n\n' : '') +
      (req.useWebSearch ? '請用 WebSearch 查證，並在最後附 Sources 連結清單。\n\n' : '') +
      req.user
    const text = await this.run(prompt, {
      webSearch: req.useWebSearch,
      timeoutMs: req.useWebSearch ? 300_000 : req.maxTokens && req.maxTokens > 1500 ? 240_000 : 180_000
    })
    return { text, grounding: extractLinks(text) }
  }

  async testConnection(): Promise<{ ok: boolean; detail: string }> {
    try {
      const t = await this.run('回覆單一詞：pong', { timeoutMs: 60_000 })
      return { ok: /pong/i.test(t), detail: `claude-cli: ${t.slice(0, 40)}` }
    } catch (e: any) {
      return { ok: false, detail: e?.message ?? String(e) }
    }
  }
}

// Pull markdown links [title](url) out of CLI output (esp. the Sources list) → grounding.
function extractLinks(text: string): { title: string; url: string; snippet: string }[] {
  const out: { title: string; url: string; snippet: string }[] = []
  const seen = new Set<string>()
  const re = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (seen.has(m[2])) continue
    seen.add(m[2])
    out.push({ title: m[1], url: m[2], snippet: '' })
    if (out.length >= 5) break
  }
  return out
}
