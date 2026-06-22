import path from 'path'
import { app, BrowserWindow, ipcMain, shell, Tray, Menu, Notification } from 'electron'
import { IPC } from '../src/ipc/channels'
import type { AppSettings, LLMProviderId } from '../src/types'
import { createProvider } from '../src/llm'
import { loadSettings, saveSettings, loadLastRun } from './state'
import { getKey, setKey, hasKey } from './secrets'
import { readGeminiKey, readGmailCreds, writeGmailCreds, writeGeminiKey, hardenSecrets } from './keyloader'
import { runTriage, getMailProvider } from './triage'
import { listAppCalendar, confirmAppCalendarEvent, removeAppCalendarEvent } from '../src/calendar/appCalendar'
import { readConfig, writeConfig } from '../src/config/localConfig'
import { applySchedule } from './scheduler'
import { startReminderScheduler } from './reminders'

let win: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false
let notifiedHide = false

function showWindow(): void {
  if (win) { win.show(); win.focus() } else createWindow()
}

// Tray: navigation-only (open / run read-only triage / quit). NEVER any send/delete action.
function createTray(): void {
  const iconPath = path.join(app.getAppPath(), 'build', 'icon.ico')
  try {
    tray = new Tray(iconPath)
  } catch {
    return // tray icon missing → skip; app still works
  }
  tray.setToolTip('郵件小幫手')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '開啟小幫手', click: showWindow },
      {
        label: '立即整理收件匣',
        click: async () => { if (win) runTriage(win, await settingsWithKeys()) }
      },
      { type: 'separator' },
      { label: '結束', click: () => { isQuitting = true; app.quit() } }
    ])
  )
  tray.on('click', showWindow)
}

async function settingsWithKeys(): Promise<AppSettings> {
  const s = await loadSettings()
  s.hasGeminiKey = (await hasKey('gemini')) || (await readGeminiKey()) !== null
  s.hasClaudeKey = await hasKey('anthropic')
  return s
}

function createWindow(): void {
  win = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1000,
    minHeight: 680,
    backgroundColor: '#08090a',
    autoHideMenuBar: true,
    title: 'Auto Email Assistant',
    icon: path.join(app.getAppPath(), 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      sandbox: false,
      contextIsolation: true
    }
  })
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    win.loadURL(devUrl)
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  // Close → hide to tray (keep running so scheduled auto-triage still fires).
  // Only when a tray actually exists — otherwise let close quit normally so the
  // user is never trapped with a hidden window and no way back.
  win.on('close', (e) => {
    if (isQuitting || !tray) return
    e.preventDefault()
    win?.hide()
    if (!notifiedHide && Notification.isSupported()) {
      notifiedHide = true
      new Notification({ title: '郵件小幫手', body: '仍在背景執行，會依排程自動整理。要完全結束請用系統匣圖示。' }).show()
    }
  })
}

function registerIpc(): void {
  ipcMain.handle(IPC.getSettings, () => settingsWithKeys())

  ipcMain.handle(IPC.saveSettings, async (_e, patch: Partial<AppSettings>) => {
    const cur = await loadSettings()
    const next = { ...cur, ...patch }
    await saveSettings(next)
    // Mirror headless-relevant settings into the shared config the daemon reads.
    await writeConfig({
      ...(await readConfig()),
      provider: next.provider,
      geminiModel: next.geminiModel,
      jarvisBridgeEnabled: next.jarvisBridgeEnabled,
      digestEnabled: next.digestEnabled,
      localScanRoots: next.localScanRoots,
      vipSenders: next.vipSenders
    })
    applySchedule(next, () => win && runTriage(win, next))
    return settingsWithKeys()
  })

  ipcMain.handle(IPC.saveSecrets, async (_e, s: { gmailAddress?: string; gmailAppPassword?: string; geminiKey?: string }) => {
    if (s.gmailAddress && s.gmailAppPassword) await writeGmailCreds(s.gmailAddress, s.gmailAppPassword)
    if (s.geminiKey) await writeGeminiKey(s.geminiKey)
    return { ok: true }
  })

  ipcMain.handle(IPC.setKey, async (_e, { name, value }: { name: 'gemini' | 'anthropic'; value: string }) => {
    await setKey(name, value)
    return { ok: true }
  })

  ipcMain.handle(IPC.testProvider, async (_e, id: LLMProviderId) => {
    const s = await loadSettings()
    if (id === 'gemini') {
      let key = await getKey('gemini')
      if (!key) key = await readGeminiKey()
      if (!key) return { ok: false, detail: 'Gemini 金鑰未設定' }
      return createProvider('gemini', key, s.geminiModel, s.geminiRpm).testConnection()
    }
    const key = await getKey('anthropic')
    if (key) return createProvider('claude', key, s.claudeModel).testConnection()
    const { ClaudeCliProvider } = await import('../src/llm/claudeCli')
    return new ClaudeCliProvider().testConnection()
  })

  ipcMain.handle(IPC.listThreads, async () => {
    const s = await loadSettings()
    const mail = await getMailProvider(s)
    return mail.listThreads({ maxResults: 40 })
  })

  ipcMain.handle(IPC.listCalendar, () => listAppCalendar())
  ipcMain.handle(IPC.confirmCalendar, (_e, id: string) => confirmAppCalendarEvent(id))
  ipcMain.handle(IPC.removeCalendar, (_e, id: string) => removeAppCalendarEvent(id))
  ipcMain.handle(IPC.getConfig, () => readConfig())
  ipcMain.handle(IPC.saveConfig, async (_e, patch) => {
    const next = { ...(await readConfig()), ...patch }
    await writeConfig(next)
    return next
  })

  ipcMain.handle(IPC.runTriage, async () => {
    const s = await settingsWithKeys()
    return runTriage(win, s)
  })

  ipcMain.handle(IPC.lastRun, () => loadLastRun())
  ipcMain.handle(IPC.openPath, (_e, p: string) => shell.openPath(p))
  ipcMain.handle(IPC.revealPath, (_e, p: string) => shell.showItemInFolder(p))
  // Navigation-only: open external links (onboarding guides) in the system browser.
  // Restricted to http(s) so it can't be coerced into launching local executables.
  ipcMain.handle(IPC.openExternal, (_e, url: string) => {
    if (/^https?:\/\//i.test(url)) return shell.openExternal(url)
  })
}

app.whenReady().then(async () => {
  app.setAppUserModelId('io.leeunhn.autoemailassistant') // Windows: required for notifications/Action Center
  hardenSecrets() // lock pre-existing plaintext secret files to the current user (best-effort)
  registerIpc()
  createWindow()
  createTray()
  const s = await loadSettings()
  applySchedule(s, () => win && runTriage(win, s))
  startReminderScheduler(() => win) // fire calendar alarms before events
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
    else showWindow()
  })
})

app.on('before-quit', () => { isQuitting = true })

app.on('window-all-closed', () => {
  // With close-to-tray the window is hidden, not destroyed, so this normally won't
  // fire from the user. Quit when genuinely quitting OR when there's no tray to
  // restore from (otherwise a closed window with no tray would leave a zombie).
  if (process.platform !== 'darwin' && (isQuitting || !tray)) app.quit()
})

app.on('quit', () => { tray?.destroy() })
