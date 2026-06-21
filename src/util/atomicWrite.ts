import { promises as fs } from 'fs'

// Crash-safe JSON write: write to .tmp then atomic rename. A kill mid-write leaves
// the previous file intact (no truncation / silent empty-reset).
export async function writeJsonAtomic(file: string, obj: unknown): Promise<void> {
  const tmp = `${file}.tmp`
  await fs.writeFile(tmp, JSON.stringify(obj, null, 2), 'utf-8')
  await fs.rename(tmp, file)
}
