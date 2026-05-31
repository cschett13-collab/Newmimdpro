# Remote Access — Claude Code + Zenvy + LLMs from anywhere

Goal: from your **phone** or any device, reach the **Claude Code** terminal
on your PC, and let the **NAS bot** talk to every LLM on the PC and the
"data goblin" — without opening any ports on your router.

The trick: put every device on a private encrypted mesh with **Tailscale**.
Free for personal use, takes ~10 min, no router config.

```
                  Tailscale tailnet (encrypted, private DNS)
   phone <----> nas <----> pc <----> goblin
                           |
                       Claude Code + Ollama + LM Studio
```

---

## Phase 1 — Tailscale on every device

Sign in to all of them with the **same Google account** (cschett13@gmail.com).
That puts every device on one tailnet so they can see each other.

### PC (Windows-native Claude Code)
1. Download: https://tailscale.com/download/windows
2. Run installer → "Sign in" → use Google.
3. In the Tailscale tray menu, hover the device name → copy the `100.x.y.z`.

### PC (if Claude Code lives inside WSL Ubuntu)
Open Ubuntu and run:
```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up --ssh
```
The `--ssh` flag lets you SSH in from your phone with **zero key setup** —
Tailscale handles auth via your Google login. Click the URL it prints to
authorize the device.

### UGREEN NAS
- **Option A** (cleanest, if your UGOS App Center has Tailscale): install it
  there, sign in.
- **Option B** (always works, runs as a sidecar container):
  ```bash
  cd /volume1/docker/zenvy
  docker compose -f docker-compose.yml -f docker-compose.tailscale.yml up -d
  ```
  Watch logs for an auth URL: `docker logs zenvy-tailscale` → click → sign in.

### data-goblin
Same as the PC — match its OS. If it's a Linux box:
```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up --ssh
```

### Phone
- iOS: App Store → "Tailscale"
- Android: Play Store → "Tailscale"
- Sign in with the same Google account. Now your phone can resolve `pc`,
  `nas`, `goblin` by name.

### Name your machines
Go to https://login.tailscale.com/admin/machines → rename them to
`pc`, `nas`, `goblin` (lowercase, no spaces). Configs use names, not IPs.

---

## Phase 2 — SSH into the PC from your phone

You want to land in a terminal where `claude` works.

### Pick a phone terminal app
- **iOS / Android: Termius** (free) — https://termius.com
- Alternatives: Blink Shell (iOS, paid), JuiceSSH (Android)

### Set up the host in Termius
- New Host → **Address:** `pc` → **Username:** your PC's username
- **No password / key needed** if you used `tailscale up --ssh` — Tailscale's
  ACL auth grants you in via the Google identity on your phone.

### Land in Claude Code
After SSH:
```bash
claude --version    # confirms install
cd ~/projects/hello
claude
```
You're now driving Claude Code on your PC, from your phone, over the cell network.

### If Claude lives in WSL but you SSH'd into Windows
Add this to your Windows SSH default command so it drops you straight into
Ubuntu:
```powershell
# Run once on the PC in PowerShell as admin:
New-ItemProperty -Path "HKLM:\SOFTWARE\OpenSSH" -Name DefaultShell -Value "C:\Windows\System32\wsl.exe" -PropertyType String -Force
```
Or, simpler: install Tailscale **inside WSL** (see Phase 1 above) so SSH
lands directly in Ubuntu.

---

## Phase 3 — Wire every LLM into the NAS bot

### 3a. Make Ollama listen on the tailnet (not just localhost)
On every machine running Ollama, set `OLLAMA_HOST=0.0.0.0:11434` and
restart Ollama.

- **Windows:** System Properties → Environment Variables → New →
  `OLLAMA_HOST` = `0.0.0.0:11434` → restart Ollama from the tray.
- **Linux/Mac:** `echo 'export OLLAMA_HOST=0.0.0.0:11434' >> ~/.bashrc`
  then `pkill ollama && nohup ollama serve >/tmp/ollama.log 2>&1 &`.

### 3b. Discover what's running
SSH into the NAS:
```bash
ssh nas
cd /volume1/docker/zenvy/src/zenvy-ai
bash scan-llms.sh pc goblin
```
This probes the PC and goblin over the tailnet and prints `.env` lines for
every server it finds.

### 3c. Edit `/volume1/docker/zenvy/.env`
Paste in the lines the scanner gave you. Recommended setup:
```env
ZENVY_TIER=free
OLLAMA_HOST=http://pc:11434
CHAT_MODEL=llama3.1:8b
CODER_MODEL=qwen2.5-coder:7b
REASONING_MODEL=deepseek-r1:8b
FAST_MODEL=mistral:7b
```

Then:
```bash
docker compose restart bot
docker compose logs -f bot
```

### 3d. Smoke test
DM `@codyx_zenvy_bot` on Telegram → ask it something. A real model on your
PC should answer (no more 0.5b stub responses).

---

## Phase 4 — Keep the bot alive when the PC sleeps

Add a cloud fallback so the bot still answers when your PC is off:

```env
# Append to /volume1/docker/zenvy/.env
ZENVY_TIER=pro
ZENVY_API_URL=https://api.groq.com/openai/v1
ZENVY_API_KEY=gsk_YOUR_KEY        # from https://console.groq.com
ZENVY_PRO_CHAT_MODEL=moonshotai/kimi-k2-instruct
ZENVY_PRO_FAST_MODEL=llama-3.1-8b-instant
```

`docker compose restart bot` — bot now serves answers via Groq when the PC
is down, and you can flip back to `ZENVY_TIER=free` when you wake the PC up.

---

## Verification checklist

- [ ] `tailscale status` on PC, NAS, phone shows everyone online
- [ ] From phone Termius: `ssh pc` → land in shell → `claude --version` works
- [ ] From NAS: `curl http://pc:11434/api/tags` returns JSON model list
- [ ] `bash scan-llms.sh pc goblin` from the NAS lists every Ollama
- [ ] DM `@codyx_zenvy_bot` → coherent reply (not the tiny stub model)

---

## Common snags

| Symptom | Fix |
|---|---|
| `ssh: connect to host pc port 22: Connection refused` | sshd isn't running on the PC OR Tailscale SSH not enabled. Run `sudo tailscale up --ssh` inside WSL, or enable OpenSSH Server in Windows Optional Features. |
| `curl http://pc:11434` hangs from the NAS | Ollama still bound to `127.0.0.1`. Re-do step 3a and restart Ollama. |
| Tailscale device shows offline | Re-launch the Tailscale app on that device, or `sudo tailscale up` again. |
| Phone resolves `pc` but SSH fails | Username mismatch. In Termius set the username to your actual PC user (run `whoami` on the PC to confirm). |
