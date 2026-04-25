#!/usr/bin/env bash
# Zenvy AI (Node) — install deps and register a systemd service.
# Tested on Ubuntu 22.04+/Debian 12. Requires Node 20+.
set -euo pipefail

INSTALL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_USER="${SUDO_USER:-${USER}}"

if [[ $EUID -eq 0 ]]; then
    echo "Run as a regular user (the script uses sudo where needed), not root." >&2
    exit 1
fi

if ! command -v node >/dev/null 2>&1; then
    echo "Node.js not found. Install Node 20+ first (https://nodejs.org)." >&2
    exit 1
fi

echo "==> Installing npm deps"
cd "$INSTALL_DIR"
npm install --silent

if [[ ! -f "$INSTALL_DIR/.env" ]]; then
    cp "$INSTALL_DIR/.env.example" "$INSTALL_DIR/.env"
    chmod 600 "$INSTALL_DIR/.env"
    echo "==> Created .env — EDIT IT before starting"
fi

echo "==> Installing systemd unit: zenvy-node.service"
NODE_PATH="$(command -v node)"
NPX_PATH="$(command -v npx)"
sudo tee /etc/systemd/system/zenvy-node.service >/dev/null <<EOF
[Unit]
Description=Zenvy AI — Telegraf-based Telegram agent system (Node)
After=network-online.target ollama.service
Wants=ollama.service

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$INSTALL_DIR
EnvironmentFile=$INSTALL_DIR/.env
ExecStart=$NPX_PATH tsx $INSTALL_DIR/src/index.ts
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload

cat <<EOF

==> Done.

Next:
  1. Edit $INSTALL_DIR/.env and set TELEGRAM_BOT_TOKEN + OWNER_TELEGRAM_ID
     (your Telegram user ID — DM @userinfobot to get it)
  2. sudo systemctl enable --now zenvy-node
  3. journalctl -u zenvy-node -f

Manual run (without systemd):
  cd $INSTALL_DIR
  set -a; source .env; set +a
  npm start
EOF
