// Non-destructive: confirms the daemon can READ the creds the GUI writes (the
// onboarding bridge's daemon half). Does NOT write/overwrite anything. No values printed.
import { readGmailCreds, readGeminiKey } from './electron/keyloader.ts'
async function main() {
  const g = await readGmailCreds()
  const k = await readGeminiKey()
  console.log('Gmail 帳密 daemon 可讀:', !!g, '| Gemini 金鑰 daemon 可讀:', !!k)
  console.log('（GUI saveSecrets 寫同一組檔，故「app 內輸入 = 背景跑得動」的 bridge 成立）')
  process.exit(0)
}
main().catch((e) => { console.error(e?.message ?? e); process.exit(1) })
