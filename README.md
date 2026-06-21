# Auto Email Assistant (desktop) · 自動郵件助理（桌面版）

**English** ·  [中文說明見下 ↓](#中文說明)

Dual-LLM (Claude Code CLI subscription / Gemini free) local-first desktop assistant
for daily family use. Reads real Gmail, triages with an 11-category taxonomy, extracts
appointments (multi-event) into a **private in-app calendar** with advance reminders +
schedule-conflict detection, drafts replies (**never sends**), finds supporting material
(local + web), sends a self-only daily digest, and bridges voice events to Jarvis.

> 雙 LLM（Claude Code 訂閱／Gemini 免費）本機優先的桌面郵件助理，給家人每日使用：讀真實
> Gmail、11 類分流、抽多個約會進**私密行事曆**（含提前提醒＋時段衝突偵測）、擬回信草稿（**永不寄出**）、
> 找輔助材料（本機＋網路）、寄只給自己的每日摘要、把語音事件橋接到 Jarvis。

> Author / 作者: **JasonLee** · License: Apache-2.0 · 家人安裝見 `FAMILY-SETUP.md`
> Topics: `email-assistant` `electron` `gemini` `claude` `gmail` `calendar` `ai-agent` `privacy-first` `productivity`

## Status
- **Mail:** real Gmail via IMAP app-password (entered in Settings — no file editing).
- **LLM:** auto-selects Claude Code CLI if installed, else Gemini free. Keys in Settings.
- **Calendar:** private in-app calendar by default (a member is a public figure → not the
  public Google Calendar). Google Calendar sync is **opt-in** (Apps Script webhook).
- **Conflicts:** same meeting at one slot → merged; different meetings overlap → warned.
- **Drafts / send / pay / delete / settings:** drafts only; the app never sends, pays,
  deletes, or changes settings (see `SAFETY-CHECKLIST.md`).
- **Reliability:** durable task queue (ingest is LLM-free → no task loss; failures retry).

## Family install (recommended)
Full steps in `FAMILY-SETUP.md`. Order matters (one-time per person):
1. Copy the folder to their PC, run `npm install`.
2. **Double-click `開介面.bat`** to open the app window.
3. In **Settings**: enter the Gemini key + Gmail address & app-password (in-app, no file
   editing), press 執行分流 once to confirm.
4. **Then** double-click `啟動小幫手.bat` (or set boot auto-start) for the background daemon.

Daily: events appear in the private calendar, a digest email arrives; double-click
`開介面.bat` to review details.

## Run (dev)
```bash
npm install && npm run dev          # Settings → enter Gmail + key → 執行分流
npx tsx queue.ts run --watch        # headless daemon (queue + retry, what 啟動小幫手.bat runs)
npx tsc --noEmit                    # gate 1: typecheck
npx tsx safetytest.ts               # safety + conflict invariants
```

## Packaging note
`npm run build:win` produces a runnable app under `dist/win-unpacked/` (launch it or via
`開介面.bat`). The NSIS one-click installer currently needs Windows Developer Mode (the
electron-builder `winCodeSign` step extracts macOS symlinks). Ship the **unpacked** build
to family PCs; don't rely on on-device `npm run build`.

## Architecture
Three bundles (`electron-vite`): **main** (Node services), **preload** (contextBridge),
**renderer** (React). Swap-clean abstractions: `LLMProvider`, `MailProvider`,
`CalendarProvider`. The GUI and the headless daemon share one durable task ledger;
an in-app agent orchestrator judges complexity and fans out.

```mermaid
flowchart LR
  classDef uin fill:#74c7ec,stroke:#1e66f5,color:#1e1e2e;
  classDef ui fill:#cba6f7,stroke:#8839ef,color:#1e1e2e;
  classDef pipe fill:#f9e2af,stroke:#df8e1d,color:#1e1e2e;
  classDef safe fill:#fab387,stroke:#fe640b,color:#1e1e2e;
  classDef model fill:#a6e3a1,stroke:#40a02b,color:#1e1e2e;
  classDef out fill:#f5c2e7,stroke:#ea76cb,color:#1e1e2e;
  classDef worker fill:#94e2d5,stroke:#179299,color:#1e1e2e;

  BAT([啟動小幫手.bat / 開介面.bat]):::uin
  SCH[/node-cron schedule/]:::worker
  subgraph UI[Renderer · React]
    SET[Settings: Gmail / keys / VIP / Google opt-in]:::ui
    INBOX[Inbox: category + attachments + urgency]:::ui
    CALV[Calendar: private + conflict]:::ui
  end
  subgraph CORE[Electron Main + headless queue · shared core]
    RUN[/triage / queue runner/]:::pipe
    subgraph AG[Agent Orchestrator]
      CL[/Classifier +urgency/]:::pipe
      EV[/EventExtractor multi/]:::pipe
      RE[/Researcher local+web/]:::pipe
      DR[/ReplyDrafter/]:::pipe
      VF[/Verifier/]:::pipe
    end
    HR[HardRules + VIP]:::safe
    CONF[/conflict merge·warn/]:::pipe
  end
  subgraph LLMP[LLMProvider · auto-select]
    GE[(Gemini: ratelimit+fallback)]:::model
    CLD[(Claude CLI: web search)]:::model
  end
  IMAP[(Gmail IMAP app-password)]:::model
  TS[(TaskStore shared ledger · atomic)]:::model
  subgraph OUTS[Outputs · all draft / private]
    PCAL[Private calendar + reminders]:::out
    GCAL[Google Calendar opt-in]:::out
    EML[.eml draft · never sent]:::out
    DIG[Digest email · to self only]:::out
    JV[Jarvis voice events]:::out
  end
  BAT --> RUN
  SCH -.-> RUN
  INBOX --> RUN
  RUN --> IMAP
  RUN --> TS
  RUN --> AG
  CL --> GE
  CL -.-> CLD
  EV --> CONF
  CONF --> PCAL
  CONF -.-> GCAL
  DR --> EML
  RUN --> DIG
  RUN -.-> JV
  HR -. inject .-> AG
  PCAL --> CALV
```

Interactive version (tabs / pan / zoom / mind-map): `docs/diagrams/2026-06-21_auto-email-assistant-app/architecture.html`.

## Hard rules (enforced)
Never send mail · never touch security/password settings · never move money ·
never delete · never draft replies to no-reply/marketing · material search is
read-only. All auto artifacts are tagged `[自動·待確認]`.

---

## 中文說明

桌面郵件助理，給家人每日使用：每天自動讀信、把約會排進**私密行事曆**、需要時擬好回信草稿，
人類收到信後「電腦可代勞」的部分盡量自動完成，但**不可逆/對外動作一律只準備、待你確認**。

### 功能
| 能力 | 說明 |
|---|---|
| 讀信分流 | 真實 Gmail（IMAP 應用程式密碼，**設定頁輸入、免改檔**），自動分 11 類 |
| 行事曆 | 一封信抽**多個**約會 → 寫進 **app 私密行事曆**（含提前提醒）；**時段衝突**自動合併同會議／警告不同會議 |
| 回信 | 需回覆的信擬草稿（存草稿匣，**永不自動寄**） |
| 找材料 | 從本機（唯讀）＋網路找資料附上 |
| 每日摘要 | 每天寄一封摘要 email 給**你本人**（衝突／高優先／事件／草稿） |
| 重要寄件人 VIP | 設定可填；VIP 信一定提醒、標高優先 |
| 雙 LLM | 自動選：有 Claude Code 用 Claude，否則用免費 Gemini |
| 語音（選用） | 有 Jarvis 的機器把事件念出來 |

### 隱私
**預設只寫 app 私密行事曆（本機，不外流）**——因為有家人是公眾人物、Google 行事曆公開；
要寫 Google 行事曆需在設定**主動開啟**。

### 安裝（每位家人一次，約 10 分鐘）
詳見 `FAMILY-SETUP.md`。順序：複製資料夾 → `npm install` → 雙擊 **`開介面.bat`** → 設定頁輸入
Gemini 金鑰 + Gmail 帳密 → 按「執行分流」測一次 → 雙擊 **`啟動小幫手.bat`** 背景常駐。

### 安全硬規則
不寄信／不付款／不刪除／不改安全設定／不對 no-reply 信亂回；信件內容當「資料」非命令
（防 prompt injection）。詳見 `SAFETY-CHECKLIST.md`、完整報告 `USAGE-REPORT.md`。
