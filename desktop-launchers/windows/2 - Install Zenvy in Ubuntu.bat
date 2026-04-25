@echo off
REM Runs the Linux installer inside WSL Ubuntu. Idempotent — safe to re-run.
where wsl >nul 2>&1
if errorlevel 1 (
    echo WSL is not installed yet.
    echo Run "1 - Install WSL and Ubuntu.bat" first, then reboot.
    pause
    exit /b 1
)

echo Running Zenvy installer inside Ubuntu. Type your Ubuntu password if prompted.
echo This downloads ~5 GB of model weights — be patient.
echo.

wsl -d Ubuntu -- bash -c "curl -fsSL https://raw.githubusercontent.com/cschett13-collab/Newmimdpro/claude/local-dev-setup-L2uDR/wsl-setup/install-zenvy.sh | INITIAL_MODEL=llama3.1:8b bash"

echo.
echo If you saw "Done." above, you're ready.
echo Next: edit ~/zenvy/.env.local in Ubuntu (instructions in the README),
echo       then double-click "3 - Start Zenvy Public.bat".
pause
