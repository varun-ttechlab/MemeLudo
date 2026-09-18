@echo off
title Star Wars Ludo Server
cd /d "%~dp0"

:: Try node from PATH first, fallback to full path
where node >nul 2>nul
if %errorlevel% equ 0 (
    node server.js
) else (
    "C:\Program Files\nodejs\node.exe" server.js
)

echo.
echo Server exited. Press any key to close.
pause >nul
