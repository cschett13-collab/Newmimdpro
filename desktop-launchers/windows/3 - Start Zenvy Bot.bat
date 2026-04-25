@echo off
REM Starts the Python Zenvy Telegram bot inside WSL Ubuntu.
REM Keep this window open — closing it stops the bot.

where wsl >nul 2>&1
if errorlevel 1 (
    echo WSL is not installed. Run "1 - Install WSL and Ubuntu.bat" first.
    pause
    exit /b 1
)

echo Starting Zenvy bot...
echo Keep this window open. Press Ctrl+C to stop the bot.
echo Once it says "Application started", DM your bot on Telegram.
echo.

wsl -d Ubuntu -- bash -ic "bash ~/zenvy/wsl-setup/start-bot.sh"

echo.
echo Bot stopped. Run this .bat again to bring it back online.
pause
