#!/usr/bin/env bash
# deploy.sh — idempotent FVCE stack deploy.
# Run on the NAS (UGREEN box / wherever docker compose lives) — typically:
#
#     ssh you@nas 'cd /srv/fvce && ./deploy.sh'
#
# What it does:
#   1. Validates docker compose + .env exist (refuses to run otherwise)
#   2. Fetches and shows what changed since last deploy; bails if nothing new
#      (use --force to redeploy current HEAD anyway)
#   3. Pulls the branch (default: main)
#   4. Rebuilds and restarts the stack (docker compose up -d --build)
#   5. Streams startup logs for ~15s so you see if it came up healthy
#
# Flags:
#   --branch <name>   git branch to deploy (default: main)
#   --force           rebuild even if HEAD didn't move
#   --no-pull         skip git fetch/pull (rebuild current tree as-is)
#   --logs <seconds>  how long to tail logs at the end (default: 15)
#   -h | --help       show this help and exit

set -Eeuo pipefail

BRANCH="main"
FORCE=0
DO_PULL=1
LOG_SECONDS=15

while [[ $# -gt 0 ]]; do
  case "$1" in
    --branch)     BRANCH="$2"; shift 2 ;;
    --force)      FORCE=1; shift ;;
    --no-pull)    DO_PULL=0; shift ;;
    --logs)       LOG_SECONDS="$2"; shift 2 ;;
    -h|--help)    sed -n '2,/^set -E/p' "$0" | sed -E 's/^# ?//;/^set -E/d'; exit 0 ;;
    *)            echo "unknown flag: $1" >&2; exit 2 ;;
  esac
done

# --- 1. preflight -----------------------------------------------------------

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker not installed on this host" >&2
  exit 1
fi
if ! docker compose version >/dev/null 2>&1; then
  echo "ERROR: 'docker compose' plugin missing. Install with:" >&2
  echo "  curl -fsSL https://get.docker.com | sh" >&2
  exit 1
fi
if [[ ! -f .env ]]; then
  echo "ERROR: .env missing in $(pwd)." >&2
  echo "  cp .env.example .env  &&  \$EDITOR .env" >&2
  exit 1
fi
if [[ ! -f docker-compose.yml ]]; then
  echo "ERROR: docker-compose.yml missing in $(pwd) — wrong directory?" >&2
  exit 1
fi

CYAN=$'\033[36m'; YEL=$'\033[33m'; NC=$'\033[0m'
say() { printf '%s==>%s %s\n' "$CYAN" "$NC" "$*"; }

# --- 2. show what's about to change ----------------------------------------

OLD_REV="$(git rev-parse HEAD)"
say "current HEAD: $OLD_REV"

if [[ $DO_PULL -eq 1 ]]; then
  say "fetching origin/${BRANCH}…"
  git fetch --quiet origin "$BRANCH"
  NEW_REV="$(git rev-parse "origin/${BRANCH}")"

  if [[ "$OLD_REV" == "$NEW_REV" ]] && [[ $FORCE -eq 0 ]]; then
    say "${YEL}already at origin/${BRANCH} (${NEW_REV:0:8}); nothing to deploy.${NC}"
    say "use --force to rebuild current tree anyway."
    exit 0
  fi

  if [[ "$OLD_REV" != "$NEW_REV" ]]; then
    say "incoming commits:"
    git --no-pager log --oneline "$OLD_REV..$NEW_REV" | sed 's/^/    /'
    say "incoming files:"
    git --no-pager diff --stat "$OLD_REV..$NEW_REV" | tail -n 20 | sed 's/^/    /'
    say "checking out ${BRANCH}…"
    git checkout --quiet "$BRANCH"
    say "fast-forwarding…"
    git merge --quiet --ff-only "origin/${BRANCH}"
  fi
else
  say "--no-pull set; rebuilding current tree (${OLD_REV:0:8})"
fi

# --- 3. build + start -------------------------------------------------------

say "building images and (re)starting services…"
docker compose up -d --build

# --- 4. health check --------------------------------------------------------

say "service status:"
docker compose ps

if [[ "$LOG_SECONDS" =~ ^[0-9]+$ ]] && [[ "$LOG_SECONDS" -gt 0 ]]; then
  say "tailing logs for ${LOG_SECONDS}s (Ctrl-C to stop early — deploy is already done)…"
  timeout "$LOG_SECONDS" docker compose logs --tail=20 -f portal dispatcher || true
fi

# Confirm portal responds on its mapped port.
PORTAL_PORT="${PORTAL_PORT:-$(awk -F= '/^PORTAL_PORT=/{print $2}' .env 2>/dev/null)}"
PORTAL_PORT="${PORTAL_PORT:-8080}"
if command -v curl >/dev/null 2>&1; then
  say "probing portal on http://127.0.0.1:${PORTAL_PORT}/login …"
  for i in 1 2 3 4 5; do
    if curl -fsS -o /dev/null --max-time 3 "http://127.0.0.1:${PORTAL_PORT}/login"; then
      say "portal is responding ✓"
      break
    fi
    if [[ $i -eq 5 ]]; then
      say "${YEL}portal did not respond after 5 tries — check 'docker compose logs portal'${NC}"
    fi
    sleep 2
  done
fi

say "done. portal http://<host>:${PORTAL_PORT}  ·  portainer https://<host>:${PORTAINER_PORT:-9443}"
