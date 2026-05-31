# Zenvy on your mesh — start here

Three machines, two commands, one bot you can drive from your phone.

```
   phone ──── Tailscale ──── pc ────── (Claude Code + Ollama)
                  │
                  └────── nas ──────── (Zenvy bot 24/7, talks to pc:11434)
```

## Run these two commands (then your phone takes over)

### 1. On the PC where Claude Code lives
Open WSL Ubuntu (or your Linux/macOS shell) and paste:
```bash
curl -fsSL https://raw.githubusercontent.com/cschett13-collab/Newmimdpro/claude/local-dev-setup-L2uDR/zenvy-ai/install-on-pc.sh | bash
```
What it does: installs Tailscale with `--ssh`, rebinds Ollama to listen on
`0.0.0.0:11434` so the NAS can reach it, prints your Tailscale name.

### 2. On the UGREEN NAS
SSH into the NAS (or open its Terminal app) and paste:
```bash
curl -fsSL https://raw.githubusercontent.com/cschett13-collab/Newmimdpro/claude/local-dev-setup-L2uDR/zenvy-ai/install-on-nas.sh | bash
```
What it does: writes `docker-compose.yml` + `.env` to `/volume1/docker/zenvy`,
auto-discovers your PC's Ollama over the tailnet, pulls the prebuilt image
from `ghcr.io/cschett13-collab/zenvy-ai:latest`, brings the bot up, waits for
`Application started`.

### 3. On your phone (2 minutes, no command line)
- Install **Tailscale** (App Store / Play Store), sign in with the same Google
  account you used on the PC + NAS.
- Install **Termius** (App Store / Play Store). New host → address = `pc` →
  connect. Tailscale handles auth — no SSH key needed.
- In the Termius shell type `claude`. You're driving Claude Code on your PC
  from your phone over the cell network.

## Verification (run after step 2)
```bash
tailscale status                          # PC + NAS + phone all online
curl http://pc:11434/api/tags             # from NAS — lists PC's models
bash zenvy-ai/scan-llms.sh pc goblin      # finds all LLMs on the mesh
```
Then DM `@codyx_zenvy_bot` on Telegram → real model answers.

## Companion docs (deeper detail per topic)
- `REMOTE-ACCESS.md` — Tailscale per-device install + Termius walkthrough
- `UGREEN-NAS-SETUP.md` — manual NAS deploy if the one-liner fails
- `scan-llms.sh` — LAN + tailnet LLM scanner, emits ready `.env` lines
- `docker-compose.tailscale.yml` — sidecar if UGOS doesn't have a Tailscale app

## When the PC sleeps
Bot returns errors until the PC wakes. To stay online 24/7, sign up at
console.groq.com (free), uncomment the cloud-fallback block in
`/volume1/docker/zenvy/.env`, set `ZENVY_TIER=pro`, run
`docker compose restart bot`. Bot now answers via hosted Kimi K2.
