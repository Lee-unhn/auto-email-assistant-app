import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'

// Per-machine config (one family member per PC). Holds the Apps Script webhook URLs
// Lee sets up once per person. No secrets here (keys stay in safeStorage / ~/.claude).
export interface LocalConfig {
  // Default calendar = the app's own PRIVATE local calendar (always on).
  googleCalendarEnabled?: boolean // opt-in: only when true (and webhook set) do we write to Google Calendar
  calendarWebhook?: string // Google Calendar Apps Script /exec URL (only used when googleCalendarEnabled)
  sheetUrl?: string // optional Sheet-as-DB backend
  // Mirror of GUI settings the HEADLESS daemon must honor (single shared source).
  provider?: 'gemini' | 'claude'
  geminiModel?: string
  jarvisBridgeEnabled?: boolean
  digestEnabled?: boolean
  localScanRoots?: string[]
}

const FILE = path.join(os.homedir(), '.auto-email-assistant-config.json')

export async function readConfig(): Promise<LocalConfig> {
  try {
    return JSON.parse(await fs.readFile(FILE, 'utf-8'))
  } catch {
    return {}
  }
}

export async function writeConfig(cfg: LocalConfig): Promise<void> {
  await fs.writeFile(FILE, JSON.stringify(cfg, null, 2), 'utf-8')
}

export const configPath = FILE
