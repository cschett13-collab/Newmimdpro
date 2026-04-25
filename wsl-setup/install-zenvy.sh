#!/usr/bin/env bash
# Bootstraps Zenvy AI inside WSL Ubuntu (or any Debian/Ubuntu box).
# Idempotent — safe to re-run.
set -euo pipefail

REPO_URL="https://github.com/cschett13-collab/Newmimdpro.git"
BRANCH="claude/local-dev-setup-L2uDR"
DEST="$HOME/zenvy"
INITIAL_MODEL="${INITIAL_MODEL:-llama3.1:8b}"

echo "==> System packages"
sudo apt-get update -qq
sudo apt-get install -y -qq curl git python3 python3-venv build-essential ca-certificates zstd

echo "==> Node.js (NodeSource 20.x if not present)"
if ! command -v node >/dev/null 2>&1; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y -qq nodejs
fi
node --version

echo "==> Ollama"
if ! command -v ollama >/dev/null 2>&1; then
    curl -fsSL https://ollama.com/install.sh | sh
fi
ollama --version

echo "==> cloudflared"
if ! command -v cloudflared >/dev/null 2>&1; then
    curl -L -o /tmp/cloudflared.deb \
        https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
    sudo dpkg -i /tmp/cloudflared.deb
fi
cloudflared --version

echo "==> Clone repo to $DEST"
if [[ -d "$DEST/.git" ]]; then
    git -C "$DEST" fetch origin
    git -C "$DEST" checkout "$BRANCH"
    git -C "$DEST" pull --ff-only
else
    git clone -b "$BRANCH" "$REPO_URL" "$DEST"
fi

echo "==> Install Next.js portal deps"
cd "$DEST"
npm install --silent

echo "==> Generate .env.local if missing"
if [[ ! -f "$DEST/.env.local" ]]; then
    npm run setup
fi

echo "==> Start Ollama (background) so we can pull a model"
if ! pgrep -x ollama >/dev/null 2>&1; then
    nohup ollama serve >/tmp/ollama.log 2>&1 &
    sleep 3
fi

echo "==> Pull initial model: $INITIAL_MODEL (this can take a while)"
ollama pull "$INITIAL_MODEL"

cat <<EOF

==> Done.

Next steps (in this Ubuntu shell):
  1. Edit $DEST/.env.local
       - PORTAL_ADMIN_EMAIL  + PORTAL_ADMIN_PASSWORD (your owner login)
       - OWNER_EMAILS=<same email>   (gives you unlimited mode in /api/chat)
       - LOCAL_CHAT_MODEL=$INITIAL_MODEL  (or any model you've pulled)
  2. Make Zenvy public:  bash $DEST/wsl-setup/start-public.sh
  3. Share the printed https://*.trycloudflare.com URL with anyone.

Optional later:
  - Pull more models:  ollama pull qwen2.5-coder:7b deepseek-r1:8b mistral:7b
  - Run the Telegram bot too:  bash $DEST/zenvy-node/install.sh
EOF
