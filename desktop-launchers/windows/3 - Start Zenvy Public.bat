@echo off
REM Starts Ollama + Next.js + Cloudflare Tunnel in WSL Ubuntu.
REM A public https://*.trycloudflare.com URL prints in this window — share it.
REM Press Ctrl+C in this window to stop the tunnel (the bot keeps running).

where wsl >nul 2>&1
if errorlevel 1 (
    echo WSL is not installed. Run "1 - Install WSL and Ubuntu.bat" first.
    pause
    exit /b 1
)

echo Bringing Zenvy AI online...
echo Your public URL will print below in ~10 seconds.
echo Share that URL with anyone — they can chat with your bot at /chat
echo.

wsl -d Ubuntu -- bash -ic "bash ~/zenvy/wsl-setup/start-public.sh"

echo.
echo Tunnel stopped. Run this .bat again to bring it back online.
pause
