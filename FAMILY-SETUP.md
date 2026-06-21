# 家人版安裝清單（一人一台，你幫他們設定一次）

目標：家人零操作 —— 每天自動讀信 → 自動排進他們的 Google 行事曆 → 每天收一封摘要 email，要看細節再開 app。

## 每位家人的電腦，你做這幾步（約 10 分鐘）

> **順序很重要**：先開介面設定金鑰，再啟動背景常駐。否則背景沒有金鑰會空轉。

1. **放程式**：把 `auto-email-assistant-app` 整個資料夾複製到那台電腦（需裝 Node 20+），在資料夾裡執行一次 `npm install`。
2. **開介面**：雙擊 **`開介面.bat`**（第一次會自動建置一下）→ 出現 app 視窗。
3. **在「設定」頁輸入（全部 app 內完成，不必編輯任何檔案）**：
   - **AI 金鑰**：他的免費 Gemini 金鑰（aistudio.google.com → Get API key）貼進「Gemini API Key」→ 按「存」。（家人電腦多半沒 Claude Code，用免費 Gemini；佇列+重試會吸收免費限流。）
   - **Gmail**：把郵件來源設「真實 Gmail」→ 填他的 Gmail 地址 + **應用程式密碼**（他的 Google 帳號 → 安全性 → 開兩步驟驗證 → 應用程式密碼 → 16 碼）→ 按「存」。
   - 按「▶ 執行分流」測一次，看到收件匣分類出現即成功。
   - （進階備援：這些其實是寫到 `~/.claude/secrets/gmail_smtp.env`、`gemini_api_key.env`，你也可手動編輯，但**不需要**。）
4. **行事曆（預設＝app 私密行事曆，無需任何設定）**
   - 預設：含日期的事項自動排進 **app 內建私密行事曆**（只存本機、不外流），在 app「行事曆」分頁看。**私人行程只留本機、不外流。**
   - **（選用）同時寫進 Google 行事曆** —— 只有「不介意公開/非公開行事曆」的家人才開：
     - 用他的 Google 帳號到 script.google.com → 貼 `google-calendar.gs` → 時區 Asia/Taipei → 部署網頁應用程式（執行身分=我、僅限自己）→ 授權 → 複製 /exec 網址
     - app「設定 → 行事曆」勾「同時寫進 Google 行事曆」並貼上網址（預設是關的；不勾就完全不碰 Google）
5. **開機自動跑**（讓他完全不用管）
   - 一次性指令（你在他電腦執行一次）：
     ```
     schtasks /create /tn AutoEmailAssistant /tr "powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File C:\dev\auto-email-assistant-app\run-assistant.ps1" /sc onlogon /rl limited /f
     ```
   - 或不設開機自動，請他**雙擊 `啟動小幫手.bat`** 即可。
   - ⚠ schtasks 指令裡的路徑要換成該電腦上 `run-assistant.ps1` 的實際完整路徑。

## 家人平常怎麼用
- **什麼都不用做**：每天自動讀信 → 行事曆自動出現事件（含提前提醒）→ 每天收一封摘要 email。
- **想看細節**：雙擊 **`開介面.bat`** → 「📅 行事曆（私密）」看行程、「📥 收件匣分流」看分類與待確認草稿。
- **回信草稿**：存在他的 Gmail 草稿匣，由他本人按寄出（系統永不自動寄）。

## 安全（對家人特別重要）
系統只自動做安全可逆的事（分類、建行事曆、擬草稿、查資料）。**永不自動：寄信、付款、刪除、改設定**——這些只會準備好等本人確認。信件內容當資料看待，不會執行信裡的指令。

## 引擎自動判斷
`run-assistant.ps1` 會自己偵測：這台有 Claude Code 就用 Claude，沒有就用 Gemini。所以同一套在你的電腦（Claude）和家人電腦（Gemini）都直接能跑。
