@echo off
REM Unified launcher for Windows.
REM Usage:
REM   scripts\run.bat           - start the scheduler
REM   scripts\run.bat once      - post one item and exit
REM   scripts\run.bat doctor    - validate .env
REM   scripts\run.bat find-ig   - print IG_USER_ID given a page token

cd /d "%~dp0.."

if not exist .venv (
  echo No virtualenv found. Run scripts\setup.bat first.
  pause
  exit /b 1
)

call .venv\Scripts\activate.bat

if "%1"=="" goto run
if "%1"=="run" goto run
if "%1"=="once" goto once
if "%1"=="doctor" goto doctor
if "%1"=="find-ig" goto findig
echo Unknown command: %1
exit /b 2

:run
python -m src.main
goto end

:once
python -m src.main once
goto end

:doctor
python -m scripts.doctor
goto end

:findig
shift
python -m scripts.find_ig_user_id %*
goto end

:end
