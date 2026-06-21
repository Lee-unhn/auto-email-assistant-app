# 任務佇列（Sheet-as-DB）— 可靠度層

## 為什麼
直接「讀信即用 LLM 分類」時,Gemini 免費 429 會讓任務**靜默消失**。解法:**解耦**。

```
讀信(無 LLM,零失敗) ──→ [DB 佇列: pending] ──→ 處理(LLM,可重試) ──→ done
                                  ▲                        │ 失敗
                                  └──────── 留 pending ─────┘ (不丟失,下輪重試)
```

| 解到 | 沒解到 |
|---|---|
| ✅ 任務遺失（入庫不碰 LLM）| ❌ Gemini 每日總額度(RPD)不會變大 |
| ✅ 間歇 429（pending 重試到成功）| （任務多過當日額度→排隊到隔天 / 改 Claude）|
| ✅ 爆量（入庫零成本，處理控速）| |
| ✅ 可換引擎救卡住的（gemini 卡 → claude 清）| |

## 決策（2026-06-21）
**正式用本地 JSON**（零設定、快、私密、離線）。**Google Sheet 為備案**，只有以下情況才提出啟用：
① 想用手機/遠端看任務+狀態 ② 想在試算表手動勾完成/取消 ③ 多台機器共用佇列。
啟用零改程式：部署 `.gs` → 加 `--sheet "<url>"`。

## 後端（二選一）
- **本地 JSON**（預設，零設定）:`~/.auto-email-assistant-tasks.json`
- **Google Sheet**（可視化儀表板）:部署 `google-sheet-task-db.gs`（檔內有步驟）→ 拿 `/exec` 網址 → 加 `--sheet "<url>"`。任務+狀態直接在試算表看。

## 指令
```bash
npx tsx queue.ts ingest                                   # 只讀信入庫（無 LLM）
npx tsx queue.ts process --provider claude --limit 8      # 處理 pending
npx tsx queue.ts run --provider gemini                    # ingest + process 一次
npx tsx queue.ts run --watch --interval 120 --provider claude   # 常駐
npx tsx queue.ts run --sheet "https://script.google.com/.../exec"  # 用 Sheet DB
```
失敗任務留 `pending` 重試,滿 3 次轉 `failed`（仍在庫,不消失）。

## 欄位（DB schema）
`id(=messageId) · from · subject · body · status(pending/done/failed/skipped) · attempts · category · result · error · date · createdAt · updatedAt`

## 與既有的關係
- `watch.ts` = 無佇列的即時/間隔執行（簡單）；`queue.ts` = 加耐用佇列（可靠，建議搭 Gemini 用）。
- 處理階段沿用同一 orchestrator（分類→.ics/草稿/材料）+ Jarvis 事件橋 + 硬規則（不寄/不刪/只準備不可逆動作）。
