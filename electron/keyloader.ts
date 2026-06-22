import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileP = promisify(execFile)

// Lock a secret file down to the current OS user only. The headless daemon reads
// these same files as the same user, so this keeps it working while removing
// other-user / inherited (Administrators, Users) read access on a shared PC.
async function hardenFile(file: string): Promise<void> {
  try {
    if (process.platform === 'win32') {
      const user = os.userInfo().username
      // /inheritance:r removes inherited ACEs; /grant:r leaves only this user with full control.
      await execFileP('icacls', [file, '/inheritance:r', '/grant:r', `${user}:F`], { windowsHide: true })
    } else {
      await fs.chmod(file, 0o600)
    }
  } catch { /* best-effort hardening; never block on it */ }
}

// One-time hardening of any pre-existing plaintext secret files (call on startup).
export async function hardenSecrets(): Promise<void> {
  for (const f of ['gmail_smtp.env', 'gemini_api_key.env']) {
    const fp = path.join(SECRETS, f)
    try { await fs.access(fp); await hardenFile(fp) } catch { /* file may not exist */ }
  }
}

// Reads ONLY the two specific secret files this app needs, at runtime.
// Never logs or returns values to anywhere but the in-process caller.
// Tolerant of common variable names so we don't have to inspect the files.
const SECRETS = path.join(os.homedir(), '.claude', 'secrets')

async function parseEnv(file: string): Promise<Record<string, string> | null> {
  try {
    const txt = await fs.readFile(file, 'utf-8')
    const m: Record<string, string> = {}
    for (const raw of txt.split(/\r?\n/)) {
      const s = raw.trim()
      if (!s || s.startsWith('#')) continue
      const i = s.indexOf('=')
      if (i < 0) {
        m.__bare__ = s
        continue
      }
      const k = s.slice(0, i).trim()
      let v = s.slice(i + 1).trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
      m[k] = v
    }
    return m
  } catch {
    return null
  }
}

function pick(m: Record<string, string> | null, names: string[]): string | undefined {
  if (!m) return undefined
  for (const n of names) if (m[n]) return m[n]
  return undefined
}

export async function readGeminiKey(): Promise<string | null> {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY
  const m = await parseEnv(path.join(SECRETS, 'gemini_api_key.env'))
  return pick(m, ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GEMINI_KEY', 'API_KEY']) ?? m?.__bare__ ?? null
}

export interface GmailCreds {
  user: string
  pass: string
}

async function ensureSecretsDir(): Promise<void> {
  await fs.mkdir(SECRETS, { recursive: true })
}

// Written by the in-app Settings fields so a non-technical user never
// edits files. keyloader (used by BOTH the GUI and the headless daemon) reads
// these, so entering creds once in the app makes the background runner work too.
export async function writeGmailCreds(user: string, pass: string): Promise<void> {
  await ensureSecretsDir()
  const file = path.join(SECRETS, 'gmail_smtp.env')
  await fs.writeFile(file, `GMAIL_ADDRESS=${user}\nGMAIL_APP_PASSWORD=${pass}\n`, 'utf-8')
  await hardenFile(file) // lock to current user (full mailbox creds)
}
export async function writeGeminiKey(key: string): Promise<void> {
  await ensureSecretsDir()
  const file = path.join(SECRETS, 'gemini_api_key.env')
  await fs.writeFile(file, `GEMINI_API_KEY=${key}\n`, 'utf-8')
  await hardenFile(file)
}

export async function readGmailCreds(): Promise<GmailCreds | null> {
  const m = await parseEnv(path.join(SECRETS, 'gmail_smtp.env'))
  if (!m) return null
  const user = pick(m, ['GMAIL_ADDRESS', 'GMAIL_USER', 'GMAIL_EMAIL', 'EMAIL', 'SMTP_USER', 'SMTP_USERNAME', 'USER', 'USERNAME'])
  const pass = pick(m, ['GMAIL_APP_PASSWORD', 'APP_PASSWORD', 'GMAIL_PASSWORD', 'SMTP_PASS', 'SMTP_PASSWORD', 'PASSWORD', 'PASS'])
  if (!user || !pass) return null
  return { user, pass }
}
