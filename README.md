# Auto Email Assistant (desktop)

Dual-LLM (Claude Code CLI subscription / Gemini free) local-first desktop assistant
for daily family use. Reads real Gmail, triages with an 11-category taxonomy, extracts
appointments (multi-event) into a **private in-app calendar** with advance reminders +
schedule-conflict detection, drafts replies (**never sends**), finds supporting material
(local + web), sends a self-only daily digest, and bridges voice events to Jarvis.

> Author: JasonLee · License: Apache-2.0 · See `FAMILY-SETUP.md` to set up a family member.

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
