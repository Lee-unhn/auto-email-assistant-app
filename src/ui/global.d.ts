import type { AppApi } from '../ipc/channels'

declare global {
  interface Window {
    api: AppApi
  }
}

export {}
