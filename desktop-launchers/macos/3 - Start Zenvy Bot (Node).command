#!/usr/bin/env bash
# Starts the Node/TypeScript Zenvy Telegram bot locally.
# Requires: Node 20+, repo cloned on this machine, .env configured in zenvy-node/.
# EDIT THIS path to match where you cloned the repo:
ZENVY_PATH="$HOME/Newmimdpro/zenvy-node"

if [[ ! -f "$ZENVY_PATH/package.json" ]]; then
    echo "Could not find Zenvy at $ZENVY_PATH"
    echo "Edit this .command file and set ZENVY_PATH to your clone location."
    read -n 1 -s -r -p "Press any key to close..."
    exit 1
fi

cd "$ZENVY_PATH"
echo "Starting Zenvy bot (Node) — Ctrl+C to stop."
npm start
read -n 1 -s -r -p "Press any key to close..."
