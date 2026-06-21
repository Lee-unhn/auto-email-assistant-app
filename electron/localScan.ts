import { promises as fs } from 'fs'
import path from 'path'
import type { Material } from '../src/types'
import { isReadAllowed } from '../src/rules/hardRules'

// Read-only, bounded local filesystem search for the Researcher agent.
// Matches keywords against file names and the head of small text files.
const TEXT_EXT = new Set(['.md', '.txt', '.json', '.ts', '.tsx', '.js', '.py', '.html', '.csv', '.yml', '.yaml'])
const SKIP_DIR = new Set(['node_modules', '.git', '.venv', '__pycache__', 'dist', 'out', 'build', '_heavy'])
const MAX_DEPTH = 4
const MAX_FILES = 4000
const MAX_HITS = 8

export async function localScan(keywords: string[], roots: string[]): Promise<Material[]> {
  const kws = keywords.map((k) => k.toLowerCase()).filter((k) => k.length >= 2)
  if (!kws.length) return []
  const hits: Material[] = []
  let scanned = 0

  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > MAX_DEPTH || hits.length >= MAX_HITS || scanned >= MAX_FILES) return
    if (!isReadAllowed(dir)) return
    let entries: import('fs').Dirent[]
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (hits.length >= MAX_HITS || scanned >= MAX_FILES) return
      const full = path.join(dir, e.name)
      if (e.isDirectory()) {
        if (SKIP_DIR.has(e.name) || e.name.startsWith('.')) continue
        await walk(full, depth + 1)
      } else if (e.isFile()) {
        scanned++
        const lname = e.name.toLowerCase()
        const ext = path.extname(lname)
        const nameHit = kws.find((k) => lname.includes(k))
        if (nameHit) {
          hits.push({ title: e.name, source: 'local', ref: full, snippet: `檔名命中「${nameHit}」` })
          continue
        }
        if (TEXT_EXT.has(ext)) {
          try {
            const stat = await fs.stat(full)
            if (stat.size > 512 * 1024) continue // skip large files
            const head = (await fs.readFile(full, 'utf-8')).slice(0, 4000).toLowerCase()
            const k = kws.find((kw) => head.includes(kw))
            if (k) {
              const idx = head.indexOf(k)
              hits.push({
                title: e.name,
                source: 'local',
                ref: full,
                snippet: '…' + head.slice(Math.max(0, idx - 40), idx + 80).replace(/\s+/g, ' ') + '…'
              })
            }
          } catch {
            /* unreadable — skip */
          }
        }
      }
    }
  }

  for (const r of roots) {
    if (hits.length >= MAX_HITS) break
    await walk(r, 0).catch(() => undefined)
  }
  return hits
}
