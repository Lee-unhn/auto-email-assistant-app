import type { EmailThread, DraftReply } from '../types'
import type { MailProvider } from './MailProvider'

// Skeleton for the wire-later real Gmail path. The UI exposes a "Connect Gmail"
// button that will drive the OAuth flow; until then every call explains the gate.
const NOT_CONNECTED =
  'Gmail 尚未連接。v1 使用樣本信來源；真實 Gmail 需要 Google Cloud OAuth client（設定 → 連接 Gmail）。'

export class GmailProvider implements MailProvider {
  id = 'gmail'
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(private tokenStorePath: string) {}

  async listThreads(): Promise<EmailThread[]> {
    throw new Error(NOT_CONNECTED)
  }
  async getThread(): Promise<EmailThread | null> {
    throw new Error(NOT_CONNECTED)
  }
  async saveDraft(_draft: DraftReply): Promise<{ ref: string }> {
    throw new Error(NOT_CONNECTED)
  }
}
