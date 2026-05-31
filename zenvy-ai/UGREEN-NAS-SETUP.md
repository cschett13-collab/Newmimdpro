# Zenvy on a UGREEN NAS

Architecture:

```
  Telegram <--> UGREEN NAS (Docker: zenvy-bot, 24/7)
                  |
                  +---LAN---> Your PC (Ollama / LM Studio, on-demand)
                  |
                  +---internet---> Cloud fallback (Groq / OpenRouter) — optional
```

The NAS is the always-on brain (sips power, never sleeps). Your PC handles
the heavy LLM work when it's awake. If the PC sleeps, the bot can fall back
to a free cloud key.

---

## One-time setup (15 minutes)

### 1. On your PC — expose Ollama to the LAN
By default Ollama only listens on `127.0.0.1`, so the NAS can't reach it.
Tell it to listen on every interface:

**Linux/Mac:**
```bash
echo 'export OLLAMA_HOST=0.0.0.0:11434' >> ~/.bashrc
source ~/.bashrc
systemctl --user restart ollama  # or:  pkill ollama && ollama serve &
```

**Windows:**
- Set system env var: `OLLAMA_HOST=0.0.0.0:11434`
- Quit Ollama from the tray, relaunch it.

Verify from another device on your LAN:
```bash
curl http://PC_LAN_IP:11434/api/tags
```
Should return JSON listing your models. Find your PC's LAN IP with `ipconfig` (Windows) or `hostname -I` (Linux).

### 2. On the NAS — install Docker
UGREEN UGOS ships with the Docker app. Open **App Center -> Docker -> Install**.
If you flashed TrueNAS Scale or Unraid, Docker is already there.

### 3. On the NAS — find your LLM servers (optional)
SSH into the NAS:
```bash
ssh admin@NAS_LAN_IP
```
Then:
```bash
curl -fsSL https://raw.githubusercontent.com/cschett13-collab/Newmimdpro/claude/local-dev-setup-L2uDR/zenvy-ai/scan-llms.sh | bash
```
Prints every Ollama / LM Studio / oobabooga server on your network so you
know which IP to point the bot at.

### 4. On the NAS — deploy the bot
The container image is prebuilt on GitHub Actions (linux/amd64 + linux/arm64),
so the NAS just pulls it — no compile, no waiting:

```bash
mkdir -p /volume1/docker/zenvy && cd /volume1/docker/zenvy
curl -fsSL -o docker-compose.yml \
  https://raw.githubusercontent.com/cschett13-collab/Newmimdpro/claude/local-dev-setup-L2uDR/zenvy-ai/docker-compose.yml
```

(If `/volume1/docker` doesn't exist on your UGREEN model, use the actual
docker-share path — check **Docker app -> Settings -> Default share**.)

### 5. Create your `.env` on the NAS
```bash
cat > /volume1/docker/zenvy/.env <<'EOF'
TELEGRAM_BOT_TOKEN=8445345314:AAH4xmLykfd4innz9Lm7IPdCoCwSpagl9Z8
AUTHORIZED_USER_IDS=

# Point to your PC's Ollama (use the LAN IP you confirmed in step 1)
ZENVY_TIER=free
OLLAMA_HOST=http://192.168.1.50:11434
CHAT_MODEL=llama3.1:8b
CODER_MODEL=qwen2.5-coder:7b
REASONING_MODEL=deepseek-r1:8b
FAST_MODEL=mistral:7b
EOF
chmod 600 /volume1/docker/zenvy/.env
```

### 6. Pull + start
```bash
cd /volume1/docker/zenvy
docker compose up -d
docker compose logs -f bot
```
Wait for `Application started`. **DM @codyx_zenvy_bot on Telegram — done.**

---

## Day-to-day

| What you want | Command |
|---|---|
| See live logs | `docker compose logs -f bot` |
| Restart after `.env` change | `docker compose restart bot` |
| Stop everything | `docker compose down` |
| Pull a code update | `docker compose pull && docker compose up -d` |

---

## Cloud fallback (when your PC is asleep)

Sign up at https://console.groq.com (Google login, free), create an API key, then add to `.env`:

```
ZENVY_TIER=pro
ZENVY_API_URL=https://api.groq.com/openai/v1
ZENVY_API_KEY=gsk_YOUR_KEY
ZENVY_PRO_CHAT_MODEL=moonshotai/kimi-k2-instruct
ZENVY_PRO_CODER_MODEL=qwen-2.5-coder-32b
ZENVY_PRO_REASONING_MODEL=deepseek-r1-distill-llama-70b
ZENVY_PRO_FAST_MODEL=llama-3.1-8b-instant
```

`docker compose restart bot` — now the bot uses hosted Kimi K2, free tier.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `curl http://PC_IP:11434/api/tags` from NAS hangs | Windows firewall is blocking. Add an inbound rule for TCP 11434. |
| Bot logs: `connection refused` | Ollama isn't listening on `0.0.0.0`. Re-check step 1. |
| Bot logs: `model not found` | The model name in `.env` isn't pulled on the PC. Run `ollama pull <model>` on the PC. |
| Telegram polling errors | Check `TELEGRAM_BOT_TOKEN` and that no other instance of the bot is running. |
