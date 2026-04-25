@echo off
REM ONE-TIME — installs WSL2 and Ubuntu. Must run as Administrator.
REM After it finishes, REBOOT, then open Ubuntu from the Start menu to finish setup.

net session >nul 2>&1
if errorlevel 1 (
    echo This script must be run as Administrator.
    echo Right-click this file and choose "Run as administrator".
    pause
    exit /b 1
)

echo Installing WSL2 + Ubuntu (this takes a few minutes)...
wsl --install -d Ubuntu
if errorlevel 1 (
    echo Install failed. If you already have WSL, run:  wsl --install -d Ubuntu
    pause
    exit /b 1
)

echo.
echo ============================================================
echo   DONE. REBOOT YOUR PC NOW.
echo   After reboot, open "Ubuntu" from the Start menu.
echo   Pick a username + password, then close that window and
echo   double-click "2 - Install Zenvy in Ubuntu.bat".
echo ============================================================
pause
