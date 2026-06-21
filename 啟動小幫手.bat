@echo off
chcp 65001 >nul
title 郵件小幫手
echo.
echo   郵件小幫手 啟動中...
echo   （每天自動讀信、排日程、擬草稿；不會自動寄信）
echo.
cd /d "%~dp0"
start "" /min powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-assistant.ps1"
echo   已在背景開始運作，這個視窗可以直接關閉。
echo   要停止：到工作管理員結束「powershell / node」即可。
echo.
timeout /t 6 >nul
