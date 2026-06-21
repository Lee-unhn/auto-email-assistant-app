# Auto Email Assistant — 常駐啟動器
# 同時拉起：① 郵件 watcher（讀新信→執行任務）② Jarvis 語音 consumer（念事件）
# 兩者掛掉自動重啟。log 在 ~/.auto-email-assistant-realrun/logs/
# 用法： powershell -ExecutionPolicy Bypass -File run-assistant.ps1 [intervalSec] [provider]
param(
  [string]$IntervalSec = "300",
  [string]$Provider = "auto"  # auto = 有 Claude Code 就用 claude，否則 gemini（家人電腦多半沒 claude）
)
$ErrorActionPreference = "Continue"
if ($Provider -eq "auto") {
  if (Get-Command claude -ErrorAction SilentlyContinue) { $Provider = "claude" } else { $Provider = "gemini" }
}
$app = $PSScriptRoot                       # 不寫死路徑：用本檔所在目錄
$jarvis = "C:\dev\jarvis"
$jarvisPy = Join-Path $jarvis ".venv\Scripts\python.exe"
$hasJarvis = Test-Path $jarvisPy           # 家人電腦多半沒 Jarvis → 跳過語音，不 crash-loop
$log = Join-Path $env:USERPROFILE ".auto-email-assistant-realrun\logs"
New-Item -ItemType Directory -Force $log | Out-Null

function Spawn-Watcher {
  # queue 模式為預設：耐用佇列 + 失敗重試（家人無人看管也不丟信）
  Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c npx tsx queue.ts run --watch --interval $IntervalSec --provider $Provider 1>> `"$log\watcher.log`" 2>&1" `
    -WorkingDirectory $app -WindowStyle Hidden -PassThru
}
function Spawn-Voice {
  Start-Process -FilePath "$jarvis\.venv\Scripts\python.exe" `
    -ArgumentList "-X utf8 src\email_events.py --watch" `
    -WorkingDirectory $jarvis -WindowStyle Hidden `
    -RedirectStandardOutput "$log\voice.log" -RedirectStandardError "$log\voice.err.log" -PassThru
}

function Log($m) { "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $m | Out-File -Append "$log\daemon.log" -Encoding utf8 }

$w = Spawn-Watcher
$v = if ($hasJarvis) { Spawn-Voice } else { $null }
Log "daemon up — watcher pid $($w.Id), voice $(if($hasJarvis){"pid $($v.Id)"}else{'(略過：本機無 Jarvis)'}), interval ${IntervalSec}s, provider $Provider"

while ($true) {
  Start-Sleep -Seconds 30
  if ($w.HasExited) { Log "watcher exited ($($w.ExitCode)) → restart"; $w = Spawn-Watcher }
  if ($hasJarvis -and $v.HasExited) { Log "voice exited ($($v.ExitCode)) → restart"; $v = Spawn-Voice }
}
