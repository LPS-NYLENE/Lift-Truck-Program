@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0save-server.ps1"
echo.
echo The inspection sheet stopped. Leave this window open while you use Save Excel.
pause
