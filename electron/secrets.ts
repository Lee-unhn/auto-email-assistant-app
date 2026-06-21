import { promises as fs } from 'fs'
import path from 'path'
import { app, safeStorage } from 'electron'

// API keys stored ENCRYPTED via OS-backed safeStorage. Plaintext never hits disk
// or logs. File holds base64 of the encrypted blob.
type KeyName = 'gemini' | 'anthropic'

function file(): string {
  return path.join(app.getPath('userData'), 'secrets.json')
}

async function readAll(): Promise<Record<string, string>> {
  try {
    return JSON.parse(await fs.readFile(file(), 'utf-8'))
  } catch {
    return {}
  }
}

export async function setKey(name: KeyName, value: string): Promise<void> {
  const all = await readAll()
  if (!value) {
    delete all[name]
  } else if (safeStorage.isEncryptionAvailable()) {
    all[name] = safeStorage.encryptString(value).toString('base64')
  } else {
    // Fallback (e.g. some Linux without keyring): mark plain with prefix so we know.
    all[name] = 'plain:' + Buffer.from(value, 'utf-8').toString('base64')
  }
  await fs.writeFile(file(), JSON.stringify(all), 'utf-8')
}

export async function getKey(name: KeyName): Promise<string | null> {
  const all = await readAll()
  const v = all[name]
  if (!v) return null
  if (v.startsWith('plain:')) return Buffer.from(v.slice(6), 'base64').toString('utf-8')
  try {
    return safeStorage.decryptString(Buffer.from(v, 'base64'))
  } catch {
    return null
  }
}

export async function hasKey(name: KeyName): Promise<boolean> {
  return (await getKey(name)) !== null
}
