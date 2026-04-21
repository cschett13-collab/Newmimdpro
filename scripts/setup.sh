#!/usr/bin/env bash
# One-shot setup for Mac / Linux.
# Creates a venv, installs deps, and copies .env.example -> .env if needed.

set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required. Install Python 3.10+ from python.org first." >&2
  exit 1
fi

if [ ! -d .venv ]; then
  echo "Creating virtualenv..."
  python3 -m venv .venv
fi

# shellcheck disable=SC1091
source .venv/bin/activate
pip install --upgrade pip >/dev/null
pip install -r requirements.txt

if [ ! -f .env ]; then
  cp .env.example .env
  echo
  echo "Created .env - now open it in a text editor and fill in the values:"
  echo "  $(pwd)/.env"
fi

echo
echo "Done. Next steps:"
echo "  1. Fill in .env (IG token + IG user id, and a HighLevel webhook or token)."
echo "  2. Edit content/queue.json with your real image/video URLs + captions."
echo "  3. Validate with: ./scripts/run.sh doctor"
echo "  4. Post one item now:   ./scripts/run.sh once"
echo "  5. Start the scheduler: ./scripts/run.sh"
