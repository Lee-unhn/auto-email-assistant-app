# Email app → Jarvis 事件橋

> 郵件 app = 事件**產生者**；Jarvis = 語音/通知**面**。解耦 JSON 佇列，Jarvis 沒開也不掉事件。
> （架構裁決：CoS — 不在郵件 app 重做語音，Jarvis 已有 index-tts/edge-tts。）

## 資料流
```
auto-email-assistant (Node)                Jarvis (Python)
  triage 完成 → eventsFromRun()              email_events.py --watch
     → 寫 JSON 檔                             → 讀 inbox/*.json
        ~/.jarvis-events/inbox/*.json  ───►   → speak.speak(ev.speak)  (Jarvis TTS)
                                              → corpus.log_turn(source="email")
                                              → 移到 ~/.jarvis-events/processed/
```

## 事件契約（JSON，每事件一檔）
```json
{
  "id": "abc123", "ts": "2026-06-20T13:00:00.000Z",
  "source": "auto-email-assistant",
  "type": "security | finance | deadline | draft_pending | summary",
  "urgency": "high | normal",
  "title": "原信主旨 / 事件標題",
  "detail": "細節",
  "speak": "已寫好、可直接念出的繁中句子"
}
```
- `speak` 由產生端寫好 → Jarvis **純發聲**，不需再思考（最低耦合）。
- 目錄可改：env `JARVIS_EVENTS_DIR`（兩端共用）或 app 設定「Jarvis 事件資料夾」。

## 產生端（郵件 app，自動）
每次分流後若設定開啟「送事件給 Jarvis」，自動 emit：
- `FLAG_SECURITY` / `FLAG_FINANCE` → `high`
- `ACTION_EVENT`（截止/會議）→ `deadline`
- 待確認草稿 → `draft_pending`
- 一個 `summary` 收尾
程式：`src/bridge/jarvisBridge.ts`。

## 消費端（Jarvis）
```powershell
cd C:\dev\jarvis
.\.venv\Scripts\python.exe -X utf8 src\email_events.py --watch        # 常駐念出新事件
.\.venv\Scripts\python.exe -X utf8 src\email_events.py --once --dry   # 只印不發聲（測試）
```
程式：`C:\dev\jarvis\src\email_events.py`（用 Jarvis 自己的 `speak.py` + `corpus`）。
可日後加進 `gateway.py` 的管道清單，跟 Web/Discord/Telegram 一起常駐。

## 測試（不碰 Gemini、不發聲）
```bash
# 產生端
npx tsx bridgetest.ts
# 消費端（dry）
C:\dev\jarvis\.venv\Scripts\python.exe -X utf8 C:\dev\jarvis\src\email_events.py --dry
```
已驗：3 事件 emit → Jarvis 端 dry 正確讀出 security/deadline/summary 三句。

## 安全
- 事件只在本機檔案佇列（不經網路）。
- 真正發聲走 Jarvis 既有 TTS；不可逆動作仍只在郵件 app 內以草稿/待確認呈現，Jarvis 只「念通知」，不執行動作。
