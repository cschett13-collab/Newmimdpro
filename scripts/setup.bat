@echo off
REM One-shot setup for Windows. Double-click this, or run from cmd/PowerShell.

cd /d "%~dp0.."

where python >nul 2>&1
if errorlevel 1 (
  echo Python is required. Install Python 3.10+ from https://www.python.org/downloads/
  echo During install, tick "Add Python to PATH".
  pause
  exit /b 1
)

if not exist .venv (
  echo Creating virtualenv...
  python -m venv .venv
)

call .venv\Scripts\activate.bat
python -m pip install --upgrade pip >nul
python -m pip install -r requirements.txt
if errorlevel 1 (
  echo Dependency install failed.
  pause
  exit /b 1
)

if not exist .env (
  copy /Y .env.example .env >nul
  echo.
  echo Created .env - open it in Notepad and fill in the values:
  echo   %cd%\.env
)

echo.
echo Done. Next steps:
echo   1. Fill in .env (IG token + IG user id, and a HighLevel webhook or token).
echo   2. Edit content\queue.json with your real image/video URLs + captions.
echo   3. Validate:        scripts\run.bat doctor
echo   4. Post one now:    scripts\run.bat once
echo   5. Start scheduler: scripts\run.bat
pause
