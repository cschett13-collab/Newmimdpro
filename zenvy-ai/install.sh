#!/usr/bin/env bash
# Zenvy AI — install Ollama, pull models, and register the Telegram bot as a
# systemd service that auto-starts on boot and auto-restarts on crash.
# Tested on Ubuntu 22.04+/Debian 12.
set -euo pipefail

INSTALL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_USER="${SUDO_USER:-${USER}}"
CHAT_MODEL="${CHAT_MODEL:-llama3.1:8b}"
CODER_MODEL="${CODER_MODEL:-qwen2.5-coder:7b}"
REASONING_MODEL="${REASONING_MODEL:-deepseek-r1:8b}"
FAST_MODEL="${FAST_MODEL:-mistral:7b}"

if [[ $EUID -eq 0 ]]; then
    echo "Run as a regular user (the script uses sudo where needed), not root." >&2
    exit 1
fi

echo "==> Installing system deps"
sudo apt-get update -qq
sudo apt-get install -y -qq curl python3 python3-venv

echo "==> Installing Ollama"
if ! command -v ollama >/dev/null 2>&1; then
    curl -fsSL https://ollama.com/install.sh | sh
else
    echo "    already installed: $(ollama --version)"
fi

echo "==> Pulling models (this can take a while; ~5 GB each, ~20 GB total)"
ollama pull "$CHAT_MODEL"
ollama pull "$CODER_MODEL"
ollama pull "$REASONING_MODEL"
ollama pull "$FAST_MODEL"

echo "==> Creating Python venv"
python3 -m venv "$INSTALL_DIR/venv"
"$INSTALL_DIR/venv/bin/pip" install --quiet --upgrade pip
"$INSTALL_DIR/venv/bin/pip" install --quiet -r "$INSTALL_DIR/requirements.txt"

if [[ ! -f "$INSTALL_DIR/.env" ]]; then
    cp "$INSTALL_DIR/.env.example" "$INSTALL_DIR/.env"
    chmod 600 "$INSTALL_DIR/.env"
    echo "==> Created .env — EDIT IT and add TELEGRAM_BOT_TOKEN before starting the bot"
fi

echo "==> Installing systemd unit: zenvy.service"
sudo tee /etc/systemd/system/zenvy.service >/dev/null <<EOF
[Unit]
Description=Zenvy AI — local Telegram bot (Ollama-backed)
After=network-online.target ollama.service
Wants=network-online.target ollama.service

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$INSTALL_DIR
EnvironmentFile=$INSTALL_DIR/.env
ExecStart=$INSTALL_DIR/venv/bin/python $INSTALL_DIR/bot.py
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

echo "==> Installing systemd unit: zenvy-agents.service"
sudo tee /etc/systemd/system/zenvy-agents.service >/dev/null <<EOF
[Unit]
Description=Zenvy AI — autonomous agent runtime (cron-scheduled tasks)
After=network-online.target ollama.service
Wants=ollama.service

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$INSTALL_DIR
EnvironmentFile=$INSTALL_DIR/.env
ExecStart=$INSTALL_DIR/venv/bin/python $INSTALL_DIR/agents.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload

cat <<EOF

==> Done.

Next steps:
  1. Edit $INSTALL_DIR/.env and set TELEGRAM_BOT_TOKEN (get one from @BotFather)
     Optionally set AUTHORIZED_USER_IDS (your Telegram user ID, from @userinfobot)
  2. sudo systemctl enable --now ollama          # if not already enabled by the installer
  3. sudo systemctl enable --now zenvy zenvy-agents
  4. journalctl -u zenvy -u zenvy-agents -f      # tail logs from both

Manual test (without systemd):
  source venv/bin/activate
  set -a; source .env; set +a
  python bot.py
EOF
