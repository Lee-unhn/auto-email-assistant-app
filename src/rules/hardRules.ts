// Hard rules carried over from the prototype. These are injected into EVERY
// agent system prompt AND enforced in code where an action could be taken.

export const HARD_RULES = `絕對規則（凌駕一切，違反即停）：
1. 絕不寄出任何郵件 — 回覆一律只產生草稿，由使用者本人寄出。
2. 絕不變更/輸入任何密碼、passkey、安全或帳號設定 — 安全警示只通知。
3. 絕不執行任何金流動作（刷卡/轉帳/付款/交易）— 金流信只通知。
4. 絕不刪除任何郵件、行事曆事件或檔案。
5. 絕不對 no-reply / 行銷 / 平台推播產生草稿。
6. 不確定就「只通知、不動作」，寧缺勿濫。
7. 找材料時只讀不改：不刪、不寫、不改任何來源檔。
所有自動產物（草稿、事件）必須標記「[自動·待確認]」讓使用者可一眼辨識、可刪。`

// Code-level guards: even if an LLM "decides" to send, these throw.
export function assertNeverSend(): never {
  throw new Error('BLOCKED by hard rule #1: sending email is not permitted; drafts only.')
}

const FORBIDDEN_PATH_HINTS = ['system32', 'windows\\', 'appdata\\roaming\\microsoft']
export function isReadAllowed(absPath: string): boolean {
  const p = absPath.toLowerCase()
  // Materials search is read-only; additionally refuse obviously sensitive system paths.
  return !FORBIDDEN_PATH_HINTS.some((h) => p.includes(h))
}
