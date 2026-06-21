import { promises as fs } from 'fs'
import path from 'path'
import { app } from 'electron'
import { DEFAULT_SETTINGS, type AppSettings, type TriageRun } from '../src/types'

const ud = () => app.getPath('userData')
const settingsFile = () => path.join(ud(), 'settings.json')
const processedFile = () => path.join(ud(), 'processed.json')
const runsDir = () => path.join(ud(), 'runs')

export async function loadSettings(): Promise<AppSettings> {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(await fs.readFile(settingsFile(), 'utf-8')) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export async function saveSettings(s: AppSettings): Promise<void> {
  await fs.writeFile(settingsFile(), JSON.stringify(s, null, 2), 'utf-8')
}

export async function loadProcessed(): Promise<string[]> {
  try {
    return JSON.parse(await fs.readFile(processedFile(), 'utf-8'))
  } catch {
    return []
  }
}

export async function saveProcessed(ids: string[]): Promise<void> {
  await fs.writeFile(processedFile(), JSON.stringify([...new Set(ids)], null, 2), 'utf-8')
}

export async function saveRun(run: TriageRun): Promise<void> {
  await fs.mkdir(runsDir(), { recursive: true })
  const day = run.startedAt.slice(0, 10)
  await fs.writeFile(path.join(runsDir(), `${day}.json`), JSON.stringify(run, null, 2), 'utf-8')
  await fs.writeFile(path.join(ud(), 'last_run.json'), JSON.stringify(run, null, 2), 'utf-8')
}

export async function loadLastRun(): Promise<TriageRun | null> {
  try {
    return JSON.parse(await fs.readFile(path.join(ud(), 'last_run.json'), 'utf-8'))
  } catch {
    return null
  }
}

export const paths = {
  userData: ud,
  drafts: () => path.join(ud(), 'drafts'),
  calendar: () => path.join(ud(), 'calendar')
}
