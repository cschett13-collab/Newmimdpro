#!/usr/bin/env bash
# Stops the Zenvy stack (Next.js + Ollama). Cloudflare Tunnel is in the foreground
# and is stopped with Ctrl+C in its own window.
set -euo pipefail

echo "Stopping Next.js dev server..."
pkill -f "next dev" 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true

echo "Stopping Ollama..."
pkill -x ollama 2>/dev/null || true

sleep 1
echo "Done."
