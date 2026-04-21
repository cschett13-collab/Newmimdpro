#!/usr/bin/env bash
# Unified launcher. Usage:
#   ./scripts/run.sh           # start the scheduler loop
#   ./scripts/run.sh once      # post one item and exit
#   ./scripts/run.sh doctor    # validate .env and ping IG/HL
#   ./scripts/run.sh find-ig   # print IG_USER_ID given a page token

set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -d .venv ]; then
  echo "No virtualenv found. Run ./scripts/setup.sh first." >&2
  exit 1
fi

# shellcheck disable=SC1091
source .venv/bin/activate

cmd="${1:-run}"
case "$cmd" in
  run)       exec python -m src.main ;;
  once)     exec python -m src.main once ;;
  doctor)   exec python -m scripts.doctor ;;
  find-ig)  shift; exec python -m scripts.find_ig_user_id "$@" ;;
  webui)    exec python -m webui.app ;;
  *) echo "Unknown command: $cmd" >&2; exit 2 ;;
esac
