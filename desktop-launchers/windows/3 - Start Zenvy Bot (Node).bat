@echo off
REM Starts the Node/TypeScript Zenvy Telegram bot locally.
REM Requires: Node 20+, repo cloned on this machine, .env configured in zenvy-node\.
REM EDIT THIS path to match where you cloned the repo:
set ZENVY_PATH=C:\Newmimdpro\zenvy-node

if not exist "%ZENVY_PATH%\package.json" (
    echo Could not find Zenvy at %ZENVY_PATH%
    echo Edit this .bat and set ZENVY_PATH to your clone location.
    pause
    exit /b 1
)

cd /d "%ZENVY_PATH%"
echo Starting Zenvy bot (Node) — Ctrl+C to stop.
npm start
pause
