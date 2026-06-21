# Auto Email Assistant — 完整使用報告與說明
> 2026-06-21 · 給家人每日使用的雙 LLM 桌面郵件助理 · 多 agent 兩輪驗證後

---

## 1. 驗證結論

**裁決：GO-WITH-NOTES**（可交付家人使用；下列為非阻擋的後續事項）。

| 客觀 gate | 結果 |
|---|---|
| `tsc --noEmit` | ✅ exit 0 |
| `npm run build`（三 bundle） | ✅ 綠 |
| `safetytest.ts`（安全+衝突不變式） | ✅ 6/6 |
| `conflicttest.ts`（合併/衝突邏輯） | ✅ 通過 |
| 多 agent 驗證 | ✅ 兩輪（第二輪 4 gate 全 pass） |

第一輪巡查抓到真 bug（typecheck 紅的 `ev` 未定義）與 9 項缺口；全部 P0 已修，第二輪確認解決。

---

## 2. 它幫家人做什麼（自動）

人類收到信後「電腦可操作的部分」盡量自動完成：

| 能力 | 行為 |
|---|---|
| 讀信分流 | 每封自動分 11 類（求職/社群/行銷/銀行/安全/金流/需回覆/需材料/含日期…） |
| 行事曆 | 一封信抽**多個**約會 → 寫進 **app 私密行事曆**（含提前提醒）。**時段衝突**：同會議自動合併、不同會議發警告 |
| 回信 | 需回覆的信草擬草稿（存草稿匣，**永不自動寄**） |
| 找材料 | 需要時從本機（唯讀）+ 網路找資料附上 |
| 每日摘要 | 每天寄一封摘要 email 給本人（衝突/需看/事件/草稿） |
| 語音（選用） | 有 Jarvis 的機器把事件念出來 |

**隱私關鍵**：因有家人是公眾人物、Google 行事曆公開，**預設只寫 app 私密行事曆（本機，不外流）**；Google 行事曆要在設定「主動開啟」才連線。

---

## 3. 家人怎麼操作（極簡）

設定好後家人**幾乎不用動**：
- 每天：行事曆自動出現行程、收到一封摘要 email。
- 想看細節：**雙擊 `開介面.bat`** → 「📅 行事曆（私密）」看行程、「📥 收件匣分流」看分類與草稿。
- 回信：草稿在 Gmail 草稿匣，本人按寄出。

---

## 4. 你的一次性設定（每位家人約 10 分鐘）

> 順序重要：先開介面設金鑰 → 再啟動背景。詳見 `FAMILY-SETUP.md`。

1. 複製整個資料夾到他的電腦，跑一次 `npm install`。
2. 雙擊 **`開介面.bat`** 開介面。
3. 「設定」頁輸入（**app 內，免改檔**）：免費 Gemini 金鑰；郵件來源選真實 Gmail → 填 Gmail 地址 + 應用程式密碼（Google 帳號開兩步驟驗證後產生）。按「執行分流」測一次。
4. 雙擊 **`啟動小幫手.bat`**（或設開機自動 schtasks）→ 背景每日自動跑。

引擎自動判斷：有 Claude Code 用 Claude，否則用免費 Gemini（佇列+重試吸收免費限流）。

---

## 5. 安全護欄（程式層保證，非僅口頭）

| 絕不自動 | 保證方式 |
|---|---|
| 寄信給他人 | 唯一 SMTP 出口鎖本人，非本人收件觸發 `assertNeverSend()`（已測會 throw） |
| 付款/交易 | 無任何金流 API |
| 刪除 | 無 delete/trash 呼叫；IMAP 只讀+存草稿 |
| 改帳號安全設定 | 無此類操作碼 |
| 照做信裡的指令 | 信件內容當「資料」而非命令；即使 LLM 被注入，也無對應工具可寄/刪/付 |

驗證程序見 `SAFETY-CHECKLIST.md`。

---

## 6. 多 agent 巡查/驗證做了什麼

- **巡查**（7 agent）：Chief of Staff 定範圍+驗收標準+停止條件 → UX/架構/安全/功能/GitHub重用 5 維度審查 → 統整成有界 P0 清單（明確排除「挖 repo 加功能、OAuth、UI 重設計」等過度工程）。
- **驗證**（兩輪，各 5-6 agent）：對抗式查核每個 gate、實跑 tsc/build/test。第一輪找到並修：`ev` bug、死碼安全守衛、雙帳本重複處理、非原子寫入、髒日期繞過衝突偵測、家人 onboarding 死路等。第二輪 4 gate 全 pass。

---

## 7. 已知限制 / 後續（非阻擋）

| 項 | 說明 |
|---|---|
| 正式安裝檔 | NSIS 簽章需 Windows 開發者模式；現用 unpacked exe + `開介面.bat`。**交付前確認每台家人機已備好 unpacked build**，勿依賴現場 build |
| 金鑰儲存 | app-password/Gemini key 明文存 `~/.claude/secrets/*.env`（daemon 需讀）；建議限制該資料夾 ACL 僅本人 |
| P1 安全強化 | openPath 白名單 / `sandbox:true` / webhook token（縱深防禦，hard-rule 護欄已在） |
| 功能 | 附件解析、VIP/重要寄件人 urgency 排序（P2，需你決定範圍） |
| 真機點擊驗證 | code+gate 層已驗；交付前建議一台家人機實跑一次 開介面→設金鑰→背景讀到 |

---

## 8. 指令 / 檔案速查

```
開介面.bat            開 GUI（設定、檢視）
啟動小幫手.bat        背景常駐（每日自動跑）
npx tsx queue.ts run --watch     背景 daemon 本體（佇列+重試）
npx tsx safetytest.ts            安全/衝突不變式測試
npx tsc --noEmit                 typecheck
npm run build:win                打包 → dist/win-unpacked/
```
文件：`README.md`（總覽）、`FAMILY-SETUP.md`（家人安裝）、`SAFETY-CHECKLIST.md`（安全）、`QUEUE.md`（佇列）、`BRIDGE.md`（Jarvis 橋）、架構圖 `docs/diagrams/2026-06-21_.../architecture.html`。
