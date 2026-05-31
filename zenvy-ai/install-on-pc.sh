#!/usr/bin/env bash
# install-on-pc.sh — one-shot setup for the PC that hosts Claude Code + LLMs.
#
# Run inside the same shell where `claude --version` works. Handles WSL Ubuntu,
# native Linux, and macOS. Native Windows users: open WSL Ubuntu first and run
# this inside that.
#
# What it does:
#   1. Detect WSL vs native, print the situation.
#   2. Install Tailscale and bring it up with --ssh (zero-key SSH).
#   3. Rebind any local Ollama to 0.0.0.0:11434 so the NAS can reach it.
#   4. Print the device's Tailscale name + LAN IP so you can paste them back.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/cschett13-collab/Newmimdpro/claude/local-dev-setup-L2uDR/zenvy-ai/install-on-pc.sh | bash
set -euo pipefail

say()  { printf "\n\033[1;36m==> %s\033[0m\n" "$*"; }
warn() { printf "\n\033[1;33m!! %s\033[0m\n" "$*"; }
fail() { printf "\n\033[1;31mXX %s\033[0m\n" "$*" >&2; exit 1; }

# ----- 1. Detect environment ------------------------------------------------
say "Detecting environment"
KERNEL=$(uname -s)
case "$KERNEL" in
    Linux)
        if grep -qi microsoft /proc/version 2>/dev/null; then
            ENV="wsl"; say "Linux on WSL — Claude Code runs in this Ubuntu."
        else
            ENV="linux"; say "Native Linux."
        fi
        ;;
    Darwin) ENV="mac"; say "macOS." ;;
    *) fail "Unsupported kernel: $KERNEL. Run this inside WSL Ubuntu or a Linux/macOS shell." ;;
esac

# ----- 2. Tailscale ---------------------------------------------------------
if command -v tailscale >/dev/null 2>&1; then
    say "Tailscale already installed: $(tailscale version | head -1)"
else
    say "Installing Tailscale"
    case "$ENV" in
        wsl|linux) curl -fsSL https://tailscale.com/install.sh | sh ;;
        mac)
            if command -v brew >/dev/null 2>&1; then brew install --cask tailscale
            else fail "Install Homebrew (https://brew.sh) or grab Tailscale from tailscale.com/download/mac."; fi
            ;;
    esac
fi

say "Bringing Tailscale up with --ssh (no SSH keys needed — auth via your Google login)"
if [[ "$ENV" == "wsl" ]]; then
    # WSL needs userspace networking to avoid kernel module headaches.
    sudo tailscale up --ssh --accept-routes || warn "If this hung: 'sudo tailscale down', then retry. WSL2 sometimes needs a restart of the Tailscale service."
else
    sudo tailscale up --ssh
fi

# ----- 3. Ollama: bind to 0.0.0.0 so the NAS can reach it -------------------
if command -v ollama >/dev/null 2>&1; then
    say "Reconfiguring Ollama to listen on the tailnet (0.0.0.0:11434)"
    case "$ENV" in
        wsl|linux)
            if ! grep -q "OLLAMA_HOST=0.0.0.0" ~/.bashrc 2>/dev/null; then
                echo 'export OLLAMA_HOST=0.0.0.0:11434' >> ~/.bashrc
            fi
            export OLLAMA_HOST=0.0.0.0:11434
            pkill -x ollama 2>/dev/null || true
            sleep 1
            nohup ollama serve >/tmp/ollama.log 2>&1 &
            sleep 2
            ;;
        mac)
            launchctl setenv OLLAMA_HOST 0.0.0.0:11434
            pkill -x ollama 2>/dev/null || true
            sleep 1
            nohup ollama serve >/tmp/ollama.log 2>&1 &
            ;;
    esac
    if curl -fsS --max-time 3 http://localhost:11434/api/tags >/dev/null 2>&1; then
        say "Ollama responding on :11434"
    else
        warn "Ollama didn't come up. Check /tmp/ollama.log."
    fi
else
    warn "Ollama not found. Skipping that step — install from https://ollama.com if you want local models."
fi

# ----- 4. Report --------------------------------------------------------------
say "Final state"
TS_HOST=$(tailscale status --self --json 2>/dev/null | grep -oE '"HostName":"[^"]+"' | head -1 | sed 's/"HostName":"//;s/"//')
TS_IP=$(tailscale ip --4 2>/dev/null | head -1 || echo "(unknown)")
LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || ipconfig getifaddr en0 2>/dev/null || echo "(unknown)")

cat <<EOF

Tailscale hostname : ${TS_HOST:-(check the admin console)}
Tailscale IPv4     : ${TS_IP}
LAN IPv4           : ${LAN_IP}
Ollama models      :
$(command -v ollama >/dev/null 2>&1 && ollama list 2>/dev/null | sed 's/^/  /' || echo "  (ollama not installed)")

NEXT — on the NAS, run:
  curl -fsSL https://raw.githubusercontent.com/cschett13-collab/Newmimdpro/claude/local-dev-setup-L2uDR/zenvy-ai/install-on-nas.sh | bash

NEXT — on your phone:
  1) install Tailscale, sign in with the same Google account
  2) install Termius, add host "${TS_HOST:-pc}", connect, run \`claude\`
EOF
