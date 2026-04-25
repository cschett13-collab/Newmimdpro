#!/usr/bin/env bash
# Starts the local Ollama server (the engine that runs your local AI models).
# Install Ollama first: https://ollama.com/download/mac
if ! command -v ollama >/dev/null 2>&1; then
    echo "Ollama is not installed. Install from https://ollama.com/download/mac"
    read -n 1 -s -r -p "Press any key to close..."
    exit 1
fi

ollama serve &
echo "Ollama started in the background (PID $!)."
echo "You can close this window."
sleep 2
