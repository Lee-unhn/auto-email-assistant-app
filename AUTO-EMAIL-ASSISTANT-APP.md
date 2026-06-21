# 📧 Auto Email Assistant (desktop app)

> 雙 LLM（Gemini/Claude 可切換）獨立 .exe 桌面郵件助理。讀信 → 分流 → 抽日期建 .ics（含提前提醒）→ 草擬回信（不寄）→ 找材料（本機+web）→ agent 協作。介面用 open-design `linear-app` 系統。
> Author: Lee-unhn｜建立 2026-06-20
> 前身：`G:\claude專案資料夾\auto-email-assistant`（MCP 排程代理原型，邏輯 v0 來源）。

---

## 最新狀態（2026-06-21，多 agent 巡查+硬化+介面重設計後）
- **介面 v2（上網找參考 + 三 agent 對照審查後）**：參考 Linear/Raycast（暗色優先）、Superhuman（分流收件匣／every click is a failure）、Triage（卡片）、暗色 design-system token 規則。① **WCAG AA 對比修正**（--meta、膠囊文字、focus ring 由透明改實心、暗色去 drop-shadow、字重 590、警告色加亮）；② **今日摘要橫幅 + 三層分組收件匣**（要回覆有行程／要留意／可略過收合，點摘要數字可篩選）；③ **卡片一鍵動作**（複製草稿 + 草稿已存 Gmail 提示）與**行事曆「待你確認」可結案**（確認/移除按鈕，新增 `confirmed` 欄位 + IPC `calendar:confirm/remove`）；④ **預設自動整理**（scheduleEnabled 預設 true，主按鈕降級為「重新整理」）、進階設定（模型/RPM）與處理過程**收合**、cron 改**時間選擇器**；⑤ **emoji → 內聯 SVG 圖示**（Icon.tsx，currentColor，更接近 Linear）。gate：tsc 0／build 綠／safety 6/6／conflict 邏輯不變。
- **介面重設計（UIUX/美術 agent + open-design linear-app）**：套用完整 Linear 設計語言（cv01/ss03 字體、510 字重、亮度階梯層次、半透明白邊框、accent 只用在主要按鈕/選取、自訂捲軸、空狀態、focus ring）。**所有後台/開發字樣移出介面**——刪掉側欄「硬規則」區塊、agent 類別名（Classifier/Orchestrator…→分類/統籌…）、狀態英文（start/done→進行中/完成）、分類英文 ID、`[自動·待確認]` 前綴（改成「待你確認」標籤）、IMAP/app-password/safeStorage/RPM/cron/Jarvis 路徑等 jargon 全換成非技術使用者看得懂的話。這些規則仍在程式層強制執行（後台），只是不顯示在前端。
- **行事曆預設＝app 私密 JSON 行事曆**（不是 .ics；.ics 已退役）；Google 為 opt-in。多事件抽取（一信多約會）+ **時段衝突判別**（同會議合併／不同警告）。
- 真 Gmail（IMAP app-password，**app 內輸入免改檔**）；雙 LLM 自動選（Claude CLI／Gemini）。
- 耐用佇列 + **GUI 與 daemon 共用單一 messageId 帳本**（不重複處理）；關鍵寫入皆原子化。
- 安全：唯一 send 出口鎖本人（assertNeverSend 可達真守衛）；無寄信/刪除/金流/設定路徑；信件當資料。
- gate：tsc 0 / build 綠 / safetytest 6/6 / 多 agent 兩輪驗證。詳見 README、SAFETY-CHECKLIST、SETUP-GUIDE、本檔。
- 後續（非阻擋）：installer 簽章（現用 unpacked exe+開介面.bat）、P1 安全強化（openPath 白名單/sandbox:true/webhook token）、附件解析、VIP urgency。

## 外部系統整合 DO/DON'T（打包 / 通知 / 系統匣）— 2026-06-21（§3.2 先讀文件再動手）

> 來源：electron-builder Win 設定（DevOps agent 實讀 docs/issues 整理）、Electron Notification / Tray 官方 API 文件。

**electron-builder（Windows 打包）**
- DO：`zip` 目標**繞過 winCodeSign**（不需 Developer Mode/admin，今天就能 build）→ 交付最穩。
- DO：`build/icon.ico` 放多尺寸（**256 必備** + 128/64/48/32/16），electron-builder 自動套用（installer + exe），`buildResources: build` 已指。圖示源**不可含個資**。
- DO：`new BrowserWindow({ icon })` 明指,讓 dev 模式視窗也有圖示。
- DON'T：別期待 `nsis`/`portable` 在無 Developer Mode 下成功——winCodeSign 解 macOS symlink 需權限（這就是目前卡點）。要 portable：先清 `%LOCALAPPDATA%\electron-builder\Cache\winCodeSign` + `USE_HARD_LINKS=false`，否則一次提權 build。
- DON'T：`zip`/`portable` **不支援自動更新**；自動更新需 `nsis` + 簽章（已延後）。
- 重要：改 `appId` 會改 app 身分與 userData 路徑、且更新會視為不同 app——**首次散布前改好**（已改 `io.leeunhn.autoemailassistant`）。

**目前建置配方（2026-06-21，未開 Developer Mode）**
- winCodeSign 解 macOS symlink 在無 Dev Mode/admin 下會錯,**但 `electron-builder --win dir`(只 staging 不簽章)仍會成功產出 `dist/win-unpacked/`**(symlink 錯誤對 dir 非致命)。`zip`/`nsis`/`portable` 需簽章步驟 → 會被擋。
- **交付 zip 配方**:`npm run build` → `npx electron-builder --win dir` → `Compress-Archive dist/win-unpacked/* → dist/AutoEmailAssistant-win-x64.zip`(~112MB)。解壓後雙擊 `Auto Email Assistant.exe` 即可。`build/icon.ico` 已套用為 exe/視窗圖示。
- 要 electron-builder 直接出 zip/nsis/portable:需 Lee 一次「開 Developer Mode」或「提權 build」(系統設定,Claude 不自行改)。config 已就緒。

**Electron Notification（主行程）**
- DO：主行程建 `new Notification({title, body, silent})` 後**必須 `.show()`**；先測 `Notification.isSupported()`。
- DO：Windows 要 `app.setAppUserModelId(appId)` 否則不進 Action Center。
- DON'T：通知文字**不放主旨/寄件人/OTP/任何 PII**（共用螢幕會外洩）——只放通用字樣如「3 件待確認」。
- DON'T：通知/動作按鈕**不可**觸發寄信/刪除/確認等不可逆動作；click 只做「開啟視窗」。

**Electron Tray（系統匣）**
- DO：保留 `Tray` 參考避免 GC；Windows 用 ICO；`setToolTip` + `setContextMenu(Menu.buildFromTemplate)`；click → `win.show()/focus`。
- DO：app 結束 `tray.destroy()`。
- DON'T：tray 選單**只導航**（顯示/結束/開設定），**不放任何寄信/刪除/送出**的破壞性動作。

---

## 行事曆提醒 + 車程估算 DO/DON'T（2026-06-21，§3.2）

**提醒（鬧鐘）**:`electron/reminders.ts` 每分鐘掃 app 行事曆,到各事件提前提醒分鐘數就跳桌面通知;已 fire 的記在 `~/.auto-email-assistant-reminders.json`(不重複)。**App 開著才會響**(關窗縮系統匣仍算開)。`remindersEnabled` 可關。

**車程「該出發了」(免費 OSM,免金鑰)**
- DO：地理編碼用 **Nominatim**(`nominatim.openstreetmap.org`)→ 必帶 `User-Agent`、低頻(我們快取 `~/.auto-email-assistant-geocache.json`,遠低於 1 req/s 政策)。
- DO：車程用 **OSRM 公共車伺服器**(`routing.openstreetmap.de/routed-car`)→ 座標是 `lon,lat` 順序。失敗自動退回 haversine/30km·h 粗估。
- DO：出發地 = 設定 `homeAddress`(geocode);沒填才用 **ip-api**(免金鑰,城市級粗估)。目的地 = EventExtractor 抽的 `location`。
- DON'T：別把地址送到 OSM 以外端點;別公開(只本機用途);線上會議/無地點不估。
- DON'T：別每分鐘呼叫路徑服務 → 車程在「事件加入時算一次」存 `CalEvent.travelMin`,排程器只讀不重算。
- 限制:OSRM 公共伺服器無 SLA、不含即時路況(估值為一般車程);要更準/即時路況才考慮付費 Google(屆時報價)。

## 0. Phase 完成度

| Phase | 內容 | 完成度 | 證據 |
|---|---|---|---|
| P1 Scaffold | Electron+Vite+React+TS+Tailwind v4，三 bundle 出得了 | ✅ 100% | `npm run build` 綠燈 |
| P2 雙 LLM | LLMProvider 抽象 + Gemini/Claude 實作 + Settings 金鑰/切換/測試 | ✅ 100% | `src/llm/*`、Settings 測試鈕 |
| P3 規則+來源 | taxonomy/hardRules 移植 + SampleMailProvider + 8 樣本信 | ✅ 100% | smoke 11/11、fixtures |
| P4 Agent 協作 | 5 角色 + Orchestrator 判斷複雜度 + AgentPanel 即時 | ✅ 100% | `src/agents/*`、UI |
| P5 行事曆+草稿 | .ics(VALARM 提前提醒) + .eml 草稿(不寄) | ✅ 100% | smoke ICS 測試 |
| P6 材料檢索 | 本機唯讀掃描(G:\+C:\dev) + web(LLM native search) | ✅ 100% | `electron/localScan.ts`、researcher |
| P7 UI/美術 | open-design linear-app 主題、深色精緻 | ✅ 100% | `theme.css`、dev 啟動驗證 |
| P8 排程+state | node-cron + JSON state/processed/run/last_run | ✅ 100% | `electron/scheduler.ts`、`state.ts` |
| P9 打包 .exe | electron-builder portable/unpacked | ✅ exe / 🟡 安裝檔 | `dist\win-unpacked\*.exe` 可跑；NSIS 待 dev mode |
| **P10 真實 Gmail+Gemini** | IMAP app-password 讀信 + APPEND 草稿 + Gemini live + backoff | ✅ **100%** | `realrun.ts` 對真實收件匣跑通：6 封真信分類正確、產 1 個 .ics（見下） |

---

## 1. 技術棧
Electron 33 · React 18 · TypeScript · Vite 5 · electron-vite · Tailwind v4 · electron-builder。
LLM SDK：`@google/generative-ai`、`@anthropic-ai/sdk`。`node-cron` 排程。金鑰 `safeStorage` 加密。狀態存 JSON（捨棄 sqlite 避免原生模組打包風險）。

## 2. 架構（三 bundle）
- **main**（Node 服務）：triage runner、agents 編排、localScan、ics、secrets、scheduler、state。
- **preload**：contextBridge 暴露 `window.api`（IPC 邊界，renderer 不碰 Node/金鑰）。
- **renderer**：React UI（Sidebar/InboxView/AgentPanel/Settings）。
- 視覺架構圖（最新）：`docs/diagrams/2026-06-21_auto-email-assistant-app/architecture.html`（含真 Gmail/私密行事曆/衝突判別/佇列/Jarvis 橋）；baseline：`2026-06-20_..._預設圖/`。

## 3. 三個可換抽象
| 抽象 | 介面 | 實作 |
|---|---|---|
| `LLMProvider` | `complete({system,user,json?,useWebSearch?})` | Gemini(預設·search grounding) / Claude(web_search) |
| `MailProvider` | `listThreads/getThread/saveDraft` | Sample(v1) / Gmail(骨架) |
| `CalendarProvider` | `.ics` | ics.ts（VALARM 提前提醒） |

## 4. Agent 協作（判斷複雜度）
Orchestrator：噪音/通知→只 Classifier；FLAG→只通知不動作；ACTION_EVENT→+EventExtractor；ACTION_REPLY/MATERIAL→fan out Researcher+EventExtractor+ReplyDrafter+Verifier 再 synthesize。即時軌跡串到 AgentPanel。

## 🚫 硬規則（移植，凌駕一切）
不寄信(只存 .eml 草稿) · 不碰密碼/passkey/安全設定 · 不動金流 · 不刪任何東西 · 不對 no-reply 信亂回 · 材料檢索唯讀 · 自動產物標 `[自動·待確認]` · 金鑰加密永不 log/公開 · 公開署名用 Lee-unhn。

## 5. 啟動 / 打包 / 測試
```bash
npm install
npm run dev          # 開發（Electron 視窗）
npm run build:win    # 打包 → dist/（NSIS 安裝檔 + portable .exe）
node --experimental-strip-types smoke.ts   # 核心邏輯測試（免金鑰）
```
首用：Settings 貼 Gemini 金鑰(Google AI Studio)→測試→Inbox→執行分流。

## 6. heavy_dirs
無（純前端+服務，無大模型/資料集）。

## 7. 真實資料里程碑（2026-06-20）
- **真 Gmail（IMAP app-password）讀取跑通** — `electron/keyloader.ts` 讀 `~/.claude/secrets/gemini_api_key.env` + `gmail_smtp.env`（只讀特定檔、值不外洩）。`src/mail/imap.ts` IMAP 讀 INBOX 未讀 + APPEND 草稿到 Gmail Drafts（不寄）。
- **Gemini live 跑通** — 預設模型改 `gemini-2.5-flash`（2.0-flash 該金鑰被 429）；**關閉 2.5 thinking**（否則 thinking 吃光 output budget 害長信分類失敗）；加 429 backoff + 呼叫間隔。
- **實測**（`realrun.ts`，唯讀+本地產物）：6 封真信 → 玉山改密碼=FLAG_SECURITY(只通知)、PSMF=ACTION_EVENT→`.ics✓`、其餘 NOISE 正確。產物在 `~/.auto-email-assistant-realrun/`。
- GUI app 也已接：`mailSource` 預設 `gmail`，`runTriage`/`listThreads` 走 `getMailProvider` + keyloader fallback，免在 Settings 貼金鑰即可跑。
- **Claude 模式（無 API key）✅**：`src/llm/claudeCli.ts` 用 Claude Code 訂閱 `claude -p`（prompt 走 stdin，仿 jarvis brain.py），無需 Anthropic API key、零額外成本。provider='claude' 時若無 key 自動走 CLI。**實測（2026-06-21）真實收件匣 6/6 高信心無 fallback**（比 Gemini 免費更穩；PSMF 週報正確判為 SELF_AUTOMATED）；摘要 email + Jarvis 2 事件全跑通。`npx tsx realrun.ts claude` 可重測。
- **任務佇列 Sheet-as-DB（2026-06-21）**：解耦 讀信(無 LLM 零失敗)→DB 佇列(pending)→處理(可重試)。失敗留 pending 重試,不消失。解任務遺失/間歇429,但不放大 Gemini 日 RPD。`src/queue/taskStore.ts`(Local JSON / Google Sheet 雙後端)、`queue.ts`(ingest/process/run/--watch/--sheet)、`google-sheet-task-db.gs`(Apps Script 後端)、`QUEUE.md`。
- **任務執行 + 即時/間隔讀取（2026-06-21）**：`ACTION_MATERIAL` 已改為產出實際交付物（草稿正文）。實證 自寄任務信「三家公司分析+求職建議」→ 產出完整分析草稿（本地、未寄、其中一家查無資料時誠實標待確認）。讀取：`watch.ts`（`--interval`/`--provider claude`/`--once`/`--dry`，idempotent）；`executetask.ts` 詳細執行器。**執行邊界**：只自動做安全可逆動作，寄信/金流/刪除/設定一律只準備+待確認。Claude CLI 無 web grounding，強網路查證走 Gemini 模式。

## 8. v2 Roadmap（Chief of Staff 裁決排序，2026-06-20）
> CoS 裁決：**否決**「挖 GitHub repos + 自動 loop 完成所有功能」的開放式迴圈（VDrama over-engineering 教訓，且先前一封真信都沒處理過）。先把真實資料跑穩，再加東西。
- **P1 ✅ 完成（2026-06-20）**：全域 RateLimiter（滑動視窗 RPM + 最小間隔 + 並發 1）+ 尊重 429 `retryDelay` + **模型 fallback 鏈**（2.5-flash 當日用罄→`gemini-flash-latest`，實測為獨立額度桶）+ 自寄摘要過濾（斷回饋迴圈）+ 設定頁可調 RPM。`src/llm/rateLimiter.ts`、`gemini.ts`。
  - **免費當日配額是天花板**：同日多次實測把多個模型的 free RPD 用罄→真跑會 fallback。解法：等每日重置 / 加付費 Gemini key（RPD 大增）。限流器只解每分鐘爆量，解不了「日配額用完」。乾淨 6/6 跑已在耗盡前驗過。
- **P2（待決策）**：自動寄信（需 per-send 確認設計）＋真 Google Calendar 寫入（需 OAuth client，人類關卡）。
- **語音/通話 → 委派 Jarvis ✅ 事件橋完成（2026-06-20）**。本 app 當事件產生者，Jarvis 當語音面；**不重做語音**。解耦 JSON 佇列 `~/.jarvis-events/inbox/` → Jarvis `src/email_events.py` 念出（用其 index-tts/edge-tts）+ corpus 記錄。產生端 `src/bridge/jarvisBridge.ts`，分流後自動 emit（security/finance/deadline/draft/summary）。契約見 [BRIDGE.md](BRIDGE.md)。已驗：3 事件 emit → Jarvis dry 正確讀出；speak 匯入 OK。
- **打電話給使用者**：Twilio（付費，觸發 AI Cost Guard：號碼 ~$1-2/月 + 通話 ~$0.013-0.02/分；用前報價）。**最後做**。
- **發訊息給使用者**：免費優先走 Jarvis 既有 Discord/Email adapter，或 hermes-agent gateway。
- **GitHub 功能挖礦**：保留為「有明確驗收標準 + 人類檢查點」的受控任務，不開放式自動 loop。
- 其他：真 Calendar 寫入、macOS 打包、冪等升級 Gmail label `🤖AutoTriaged`、Claude 路徑需 Anthropic API key（目前只有 Gemini 金鑰）。
