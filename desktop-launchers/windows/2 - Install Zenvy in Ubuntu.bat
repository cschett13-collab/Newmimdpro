@echo off
REM Runs the Linux installer inside WSL Ubuntu. Idempotent — safe to re-run.
REM Pre-filled with your Telegram bot token so install writes .env automatically.

where wsl >nul 2>&1
if errorlevel 1 (
    echo WSL is not installed yet.
    echo Run "1 - Install WSL and Ubuntu.bat" first, then reboot.
    pause
    exit /b 1
)

set TELEGRAM_BOT_TOKEN=8445345314:AAH4xmLykfd4innz9Lm7IPdCoCwSpagl9Z8

echo Running Zenvy installer inside Ubuntu. Type your Ubuntu password if prompted.
echo This downloads ~400 MB initially (a tiny model) so first run is fast.
echo A larger model (llama3.1:8b, ~5 GB) downloads in the background after.
echo.

wsl -d Ubuntu -- bash -c "TELEGRAM_BOT_TOKEN=%TELEGRAM_BOT_TOKEN% curl -fsSL https://raw.githubusercontent.com/cschett13-collab/Newmimdpro/claude/local-dev-setup-L2uDR/wsl-setup/install-zenvy.sh | TELEGRAM_BOT_TOKEN=%TELEGRAM_BOT_TOKEN% bash"

echo.
echo If you saw "Done." above, you're ready.
echo Next: double-click "3 - Start Zenvy Bot.bat" to bring your bot online.
pause
