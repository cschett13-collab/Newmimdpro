#!/usr/bin/env bash
# install-on-nas.sh — one-shot deploy of the Zenvy Telegram bot on the UGREEN
# NAS (or any Docker host). Idempotent — safe to re-run after .env edits.
#
# What it does:
#   1. Verify Docker is installed.
#   2. Pick a deploy dir (override with ZENVY_DIR=/some/path).
#   3. Download docker-compose.yml from the repo.
#   4. Write .env with the Telegram token (override with TELEGRAM_BOT_TOKEN=...).
#   5. Probe the tailnet for an Ollama host and wire OLLAMA_HOST to it.
#   6. docker compose pull && docker compose up -d, tail logs until "Application started".
#
# Usage (paste this whole line into the NAS shell):
#   curl -fsSL https://raw.githubusercontent.com/cschett13-collab/Newmimdpro/claude/local-dev-setup-L2uDR/zenvy-ai/install-on-nas.sh | bash
#
# Override the default Ollama target (auto-discovery skipped):
#   OLLAMA_HOST=http://pc:11434 curl -fsSL ... | bash
set -euo pipefail

say()  { printf "\n\033[1;36m==> %s\033[0m\n" "$*"; }
warn() { printf "\n\033[1;33m!! %s\033[0m\n" "$*"; }
fail() { printf "\n\033[1;31mXX %s\033[0m\n" "$*" >&2; exit 1; }

# 0. Sanity checks
command -v docker >/dev/null 2>&1 || fail "Docker missing. Install it from UGOS App Center first."
docker info >/dev/null 2>&1 || fail "Docker daemon not running. Start it from the UGOS Docker app."

# 1. Pick deploy dir
ZENVY_DIR="${ZENVY_DIR:-}"
if [[ -z "$ZENVY_DIR" ]]; then
    for candidate in /volume1/docker/zenvy /volume2/docker/zenvy "$HOME/zenvy"; do
        parent=$(dirname "$candidate")
        if [[ -d "$parent" ]] || [[ "$candidate" == "$HOME/zenvy" ]]; then
            ZENVY_DIR="$candidate"
            break
        fi
    done
fi
say "Deploy directory: $ZENVY_DIR"
mkdir -p "$ZENVY_DIR/data" && cd "$ZENVY_DIR"

# 2. Pull docker-compose.yml
BRANCH="${ZENVY_BRANCH:-claude/local-dev-setup-L2uDR}"
say "Fetching docker-compose.yml (branch: $BRANCH)"
curl -fsSL -o docker-compose.yml \
    "https://raw.githubusercontent.com/cschett13-collab/Newmimdpro/${BRANCH}/zenvy-ai/docker-compose.yml"

# 3. Decide OLLAMA_HOST (env override OR auto-probe the tailnet)
if [[ -z "${OLLAMA_HOST:-}" ]]; then
    say "Probing tailnet for an Ollama server (pc, goblin, then any 100.x peer)"
    OLLAMA_HOST=""
    for h in pc goblin; do
        if curl -fsS --max-time 2 "http://${h}:11434/api/tags" >/dev/null 2>&1; then
            OLLAMA_HOST="http://${h}:11434"; break
        fi
    done
    if [[ -z "$OLLAMA_HOST" ]] && command -v tailscale >/dev/null 2>&1; then
        while IFS= read -r ip; do
            [[ -z "$ip" ]] && continue
            if curl -fsS --max-time 2 "http://${ip}:11434/api/tags" >/dev/null 2>&1; then
                OLLAMA_HOST="http://${ip}:11434"; break
            fi
        done < <(tailscale status 2>/dev/null | awk 'NR>1 && $1 ~ /^100\./ {print $1}')
    fi
    if [[ -z "$OLLAMA_HOST" ]]; then
        warn "No Ollama found on the tailnet — defaulting OLLAMA_HOST=http://pc:11434. Edit .env later when the PC is up."
        OLLAMA_HOST="http://pc:11434"
    else
        say "Found Ollama at $OLLAMA_HOST"
    fi
fi

# 4. Write .env (only if not already there; rerun-safe)
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-8445345314:AAH4xmLykfd4innz9Lm7IPdCoCwSpagl9Z8}"
if [[ ! -f .env ]]; then
    say "Writing .env"
    cat > .env <<EOF
TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
AUTHORIZED_USER_IDS=

ZENVY_TIER=free
OLLAMA_HOST=${OLLAMA_HOST}
CHAT_MODEL=llama3.1:8b
CODER_MODEL=qwen2.5-coder:7b
REASONING_MODEL=deepseek-r1:8b
FAST_MODEL=mistral:7b

# Cloud fallback (uncomment + fill, then set ZENVY_TIER=pro to enable)
# ZENVY_API_URL=https://api.groq.com/openai/v1
# ZENVY_API_KEY=gsk_YOUR_KEY
# ZENVY_PRO_CHAT_MODEL=moonshotai/kimi-k2-instruct
# ZENVY_PRO_FAST_MODEL=llama-3.1-8b-instant
EOF
    chmod 600 .env
else
    say ".env already exists — leaving it alone. Update OLLAMA_HOST manually if needed."
fi

# 5. Pull + start
say "Pulling image and starting the bot"
docker compose pull
docker compose up -d

# 6. Tail logs until "Application started" or 60s elapse
say "Waiting for the bot to come online…"
deadline=$(( $(date +%s) + 60 ))
while [[ $(date +%s) -lt $deadline ]]; do
    if docker compose logs --no-color bot 2>/dev/null | grep -q "Application started"; then
        say "Bot is live. DM @codyx_zenvy_bot on Telegram now."
        docker compose logs --tail 8 bot
        exit 0
    fi
    sleep 2
done

warn "Timed out waiting for 'Application started'. Showing last logs:"
docker compose logs --tail 30 bot
exit 1
