#!/usr/bin/env bash
# Bootstraps Zenvy AI inside WSL Ubuntu (or any Debian/Ubuntu box).
# Sets up: Ollama + Node + Python + cloudflared + Zenvy code + venv + initial model.
# If TELEGRAM_BOT_TOKEN is set in env, also writes zenvy-ai/.env so the Telegram
# bot is one command away from running.
# Idempotent — safe to re-run.
set -euo pipefail

REPO_URL="https://github.com/cschett13-collab/Newmimdpro.git"
BRANCH="claude/local-dev-setup-L2uDR"
DEST="$HOME/zenvy"
INITIAL_MODEL="${INITIAL_MODEL:-qwen2.5:0.5b}"   # default tiny so first run is fast
LARGER_MODEL="${LARGER_MODEL:-llama3.1:8b}"      # background-pulled after

echo "==> System packages"
sudo apt-get update -qq
sudo apt-get install -y -qq curl git python3 python3-venv python3-pip build-essential ca-certificates zstd

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

echo "==> Set up zenvy-ai Python venv"
cd "$DEST/zenvy-ai"
python3 -m venv venv
venv/bin/pip install --quiet --upgrade pip
venv/bin/pip install --quiet -r requirements.txt

echo "==> Generate web .env.local if missing"
cd "$DEST"
if [[ ! -f "$DEST/.env.local" ]]; then
    npm run setup
fi

echo "==> Start Ollama (background) so we can pull a model"
if ! pgrep -x ollama >/dev/null 2>&1; then
    nohup ollama serve >/tmp/ollama.log 2>&1 &
    sleep 3
fi

echo "==> Pull initial model (small, fast): $INITIAL_MODEL"
ollama pull "$INITIAL_MODEL"

echo "==> Pull larger model in background: $LARGER_MODEL"
nohup ollama pull "$LARGER_MODEL" >>/tmp/ollama.log 2>&1 &

# Write zenvy-ai/.env if the user supplied a TELEGRAM_BOT_TOKEN
if [[ -n "${TELEGRAM_BOT_TOKEN:-}" ]]; then
    echo "==> Writing zenvy-ai/.env (TELEGRAM_BOT_TOKEN provided)"
    cat > "$DEST/zenvy-ai/.env" <<EOF
TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN
ZENVY_TIER=free
OLLAMA_HOST=http://localhost:11434
CHAT_MODEL=$INITIAL_MODEL
CODER_MODEL=$INITIAL_MODEL
REASONING_MODEL=$INITIAL_MODEL
FAST_MODEL=$INITIAL_MODEL
AUTHORIZED_USER_IDS=${AUTHORIZED_USER_IDS:-}
ZENVY_DB_PATH=$DEST/zenvy-ai/zenvy.db
EOF
    chmod 600 "$DEST/zenvy-ai/.env"
fi

cat <<EOF

==> Done.

To start your Telegram bot now:
   bash $DEST/wsl-setup/start-bot.sh

To make a public web chat URL instead (or in addition):
   bash $DEST/wsl-setup/start-public.sh

Optional:
   - Larger model is downloading in /tmp/ollama.log — check with: tail -f /tmp/ollama.log
   - Pull more models: ollama pull qwen2.5-coder:7b deepseek-r1:8b mistral:7b
   - Once the larger model is pulled, swap it in:
       sed -i "s/^CHAT_MODEL=.*/CHAT_MODEL=$LARGER_MODEL/" $DEST/zenvy-ai/.env
EOF
