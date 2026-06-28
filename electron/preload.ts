import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type AppApi } from '../src/ipc/channels'

const api: AppApi = {
  getSettings: () => ipcRenderer.invoke(IPC.getSettings),
  saveSettings: (s) => ipcRenderer.invoke(IPC.saveSettings, s),
  setKey: (name, value) => ipcRenderer.invoke(IPC.setKey, { name, value }),
  testProvider: (id) => ipcRenderer.invoke(IPC.testProvider, id),
  listThreads: () => ipcRenderer.invoke(IPC.listThreads),
  listCalendar: () => ipcRenderer.invoke(IPC.listCalendar),
  confirmCalendar: (id) => ipcRenderer.invoke(IPC.confirmCalendar, id),
  removeCalendar: (id) => ipcRenderer.invoke(IPC.removeCalendar, id),
  getThreadStatuses: () => ipcRenderer.invoke(IPC.getThreadStatuses),
  setThreadStatus: (id, patch) => ipcRenderer.invoke(IPC.setThreadStatus, { id, patch }),
  pushDraftToGmail: (draft) => ipcRenderer.invoke(IPC.pushDraftToGmail, draft),
  getConfig: () => ipcRenderer.invoke(IPC.getConfig),
  saveConfig: (patch) => ipcRenderer.invoke(IPC.saveConfig, patch),
  saveSecrets: (s) => ipcRenderer.invoke(IPC.saveSecrets, s),
  runTriage: () => ipcRenderer.invoke(IPC.runTriage),
  lastRun: () => ipcRenderer.invoke(IPC.lastRun),
  openPath: (p) => ipcRenderer.invoke(IPC.openPath, p),
  revealPath: (p) => ipcRenderer.invoke(IPC.revealPath, p),
  openExternal: (url) => ipcRenderer.invoke(IPC.openExternal, url),
  onAgentEvent: (cb) => {
    const h = (_e: unknown, d: any) => cb(d)
    ipcRenderer.on(IPC.agentEvent, h)
    return () => ipcRenderer.removeListener(IPC.agentEvent, h)
  },
  onProgress: (cb) => {
    const h = (_e: unknown, d: any) => cb(d)
    ipcRenderer.on(IPC.triageProgress, h)
    return () => ipcRenderer.removeListener(IPC.triageProgress, h)
  }
}

contextBridge.exposeInMainWorld('api', api)
