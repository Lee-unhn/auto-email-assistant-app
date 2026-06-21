@echo off
chcp 65001 >nul
title 郵件小幫手 介面
cd /d "%~dp0"
echo   開啟郵件小幫手介面...（第一次可能需要建置，請稍候）
if exist "dist\win-unpacked\Auto Email Assistant.exe" (
  start "" "dist\win-unpacked\Auto Email Assistant.exe"
) else (
  if not exist "out\renderer\index.html" call npm run build
  start "" cmd /c "npm run preview"
)
