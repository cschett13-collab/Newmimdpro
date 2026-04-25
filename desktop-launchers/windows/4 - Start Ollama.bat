@echo off
REM Starts the local Ollama server (the engine that runs your local AI models).
REM Requires Ollama to be installed: https://ollama.com/download/windows
where ollama >nul 2>&1
if errorlevel 1 (
    echo Ollama is not installed. Install from https://ollama.com/download/windows
    pause
    exit /b 1
)

start "Ollama" /B ollama serve
echo Ollama started in the background.
echo You can close this window.
timeout /t 3 >nul
