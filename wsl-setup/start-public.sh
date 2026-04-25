#!/usr/bin/env bash
# Starts Ollama + Next.js + Cloudflare Tunnel.
# The tunnel prints a public https://*.trycloudflare.com URL — share it.
# Press Ctrl+C in this window to stop the tunnel (Ollama + Next.js keep running).
set -euo pipefail

DEST="${ZENVY_PATH:-$HOME/zenvy}"
PORT="${PORT:-3000}"

cd "$DEST"

echo "[1/3] Ollama"
if ! pgrep -x ollama >/dev/null 2>&1; then
    nohup ollama serve >/tmp/ollama.log 2>&1 &
    sleep 3
fi
echo "      ok (pid $(pgrep -x ollama | head -1))"

echo "[2/3] Next.js dev server on :$PORT"
if ! curl -fsS "http://localhost:$PORT/" >/dev/null 2>&1; then
    nohup npm run dev >/tmp/next.log 2>&1 &
    # Wait for Next to start responding (up to 60s)
    for i in {1..60}; do
        if curl -fsS "http://localhost:$PORT/login" >/dev/null 2>&1; then
            break
        fi
        sleep 1
    done
fi
echo "      ok"

echo "[3/3] Cloudflare Tunnel — your public URL is below:"
echo "      (Ctrl+C here when you're done — the bot keeps running locally)"
echo
exec cloudflared tunnel --url "http://localhost:$PORT"
