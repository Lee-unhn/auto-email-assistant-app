import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import { writeJsonAtomic } from '../util/atomicWrite'

// Durable task queue ("Sheet-as-DB" concept). Ingest is LLM-free → never fails;
// processing reads pending tasks, retries failures across runs → tasks never lost.
// Two backends behind one interface: LocalTaskStore (JSON, zero setup) and
// SheetTaskStore (Google Apps Script webhook → a real Google Sheet you can watch).

export type TaskStatus = 'pending' | 'done' | 'failed' | 'skipped'

export interface Task {
  id: string // = messageId (stable, dedup key)
  from: string
  subject: string
  body: string
  date: string
  status: TaskStatus
  attempts: number
  category?: string
  result?: string
  error?: string
  createdAt: string
  updatedAt: string
}

export interface NewTask {
  id: string
  from: string
  subject: string
  body: string
  date: string
}

export interface TaskStore {
  upsertPending(items: NewTask[]): Promise<number> // returns # newly added
  list(status?: TaskStatus): Promise<Task[]>
  update(id: string, patch: Partial<Task>): Promise<void>
}

// ── Local JSON backend ──────────────────────────────────────────────
export class LocalTaskStore implements TaskStore {
  private file: string
  constructor(file?: string) {
    this.file = file || path.join(os.homedir(), '.auto-email-assistant-tasks.json')
  }
  private async read(): Promise<Task[]> {
    try {
      return JSON.parse(await fs.readFile(this.file, 'utf-8')).tasks ?? []
    } catch {
      return []
    }
  }
  private async write(tasks: Task[]): Promise<void> {
    await writeJsonAtomic(this.file, { tasks })
  }
  async upsertPending(items: NewTask[]): Promise<number> {
    const tasks = await this.read()
    const have = new Set(tasks.map((t) => t.id))
    const now = new Date().toISOString()
    let added = 0
    for (const it of items) {
      if (have.has(it.id)) continue
      tasks.push({ ...it, status: 'pending', attempts: 0, createdAt: now, updatedAt: now })
      added++
    }
    if (added) await this.write(tasks)
    return added
  }
  async list(status?: TaskStatus): Promise<Task[]> {
    const tasks = await this.read()
    return status ? tasks.filter((t) => t.status === status) : tasks
  }
  async update(id: string, patch: Partial<Task>): Promise<void> {
    const tasks = await this.read()
    const i = tasks.findIndex((t) => t.id === id)
    if (i < 0) return
    tasks[i] = { ...tasks[i], ...patch, updatedAt: new Date().toISOString() }
    await this.write(tasks)
  }
}

// ── Google Sheet backend (via Apps Script web app) ──────────────────
// Deploy google-sheet-task-db.gs as a web app, paste its /exec URL here.
export class SheetTaskStore implements TaskStore {
  private url: string
  private mirror: LocalTaskStore
  constructor(url: string) {
    this.url = url
    this.mirror = new LocalTaskStore() // keep a local mirror for resilience
  }
  private async call(method: 'GET' | 'POST', payload?: unknown, query = ''): Promise<any> {
    const res = await fetch(this.url + query, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: method === 'POST' ? JSON.stringify(payload) : undefined
    })
    if (!res.ok) throw new Error(`Sheet ${method} ${res.status}`)
    return res.json()
  }
  async upsertPending(items: NewTask[]): Promise<number> {
    const r = await this.call('POST', { action: 'upsertPending', items })
    await this.mirror.upsertPending(items)
    return r.added ?? 0
  }
  async list(status?: TaskStatus): Promise<Task[]> {
    const r = await this.call('GET', undefined, `?action=list${status ? `&status=${status}` : ''}`)
    return (r.tasks ?? []) as Task[]
  }
  async update(id: string, patch: Partial<Task>): Promise<void> {
    await this.call('POST', { action: 'update', id, patch })
    await this.mirror.update(id, patch)
  }
}

export function makeStore(sheetUrl?: string): TaskStore {
  return sheetUrl ? new SheetTaskStore(sheetUrl) : new LocalTaskStore()
}
