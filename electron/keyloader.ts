import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'

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
  await fs.writeFile(path.join(SECRETS, 'gmail_smtp.env'), `GMAIL_ADDRESS=${user}\nGMAIL_APP_PASSWORD=${pass}\n`, 'utf-8')
}
export async function writeGeminiKey(key: string): Promise<void> {
  await ensureSecretsDir()
  await fs.writeFile(path.join(SECRETS, 'gemini_api_key.env'), `GEMINI_API_KEY=${key}\n`, 'utf-8')
}

export async function readGmailCreds(): Promise<GmailCreds | null> {
  const m = await parseEnv(path.join(SECRETS, 'gmail_smtp.env'))
  if (!m) return null
  const user = pick(m, ['GMAIL_ADDRESS', 'GMAIL_USER', 'GMAIL_EMAIL', 'EMAIL', 'SMTP_USER', 'SMTP_USERNAME', 'USER', 'USERNAME'])
  const pass = pick(m, ['GMAIL_APP_PASSWORD', 'APP_PASSWORD', 'GMAIL_PASSWORD', 'SMTP_PASS', 'SMTP_PASSWORD', 'PASSWORD', 'PASS'])
  if (!user || !pass) return null
  return { user, pass }
}
