#!/usr/bin/env bash
# Starts the Zenvy Telegram bot (zenvy-ai/bot.py).
# Foreground process — Ctrl+C to stop. Telegram polling so no public IP needed.
set -euo pipefail

DEST="${ZENVY_PATH:-$HOME/zenvy}"
cd "$DEST/zenvy-ai"

if [[ ! -f .env ]]; then
    echo ".env not found at $DEST/zenvy-ai/.env"
    echo "Re-run install-zenvy.sh with TELEGRAM_BOT_TOKEN set, or edit .env manually."
    exit 1
fi

if ! pgrep -x ollama >/dev/null 2>&1; then
    echo "Starting Ollama..."
    nohup ollama serve >/tmp/ollama.log 2>&1 &
    sleep 3
fi

echo "Starting Zenvy Telegram bot — DM your bot on Telegram and send /start"
echo "Press Ctrl+C here to stop."
echo
exec venv/bin/python bot.py
