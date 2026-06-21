import { promises as fs } from 'fs'
import path from 'path'
import { app } from 'electron'
import { DEFAULT_SETTINGS, type AppSettings, type TriageRun } from '../src/types'
import { writeJsonAtomic } from '../src/util/atomicWrite'

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
  await writeJsonAtomic(settingsFile(), s)
}

export async function loadProcessed(): Promise<string[]> {
  try {
    return JSON.parse(await fs.readFile(processedFile(), 'utf-8'))
  } catch {
    return []
  }
}

export async function saveProcessed(ids: string[]): Promise<void> {
  await writeJsonAtomic(processedFile(), [...new Set(ids)])
}

export async function saveRun(run: TriageRun): Promise<void> {
  await fs.mkdir(runsDir(), { recursive: true })
  const day = run.startedAt.slice(0, 10)
  await writeJsonAtomic(path.join(runsDir(), `${day}.json`), run)
  await writeJsonAtomic(path.join(ud(), 'last_run.json'), run)
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
