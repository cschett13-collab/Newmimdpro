#!/usr/bin/env bash
# scan-llms.sh — find every LLM server reachable from this machine.
#
# Scans for Ollama (11434), LM Studio (1234), oobabooga (5000), and llama.cpp
# (8080) on every device in the LAN /24, the Tailscale tailnet, and any
# hostnames you pass directly. Prints ready-to-paste `.env` lines for each
# server it finds.
#
# Usage:
#   bash scan-llms.sh                       # scan local /24 + Tailscale peers
#   bash scan-llms.sh 192.168.1             # scan a specific /24
#   bash scan-llms.sh pc nas goblin         # probe specific hostnames
#   bash scan-llms.sh --no-tailscale        # skip the Tailscale sweep
#
# Requires: curl. (Optional: tailscale CLI for the tailnet sweep.)
set -euo pipefail

SKIP_TAILSCALE=0
TARGETS=()
PREFIX=""

for arg in "$@"; do
    case "$arg" in
        --no-tailscale) SKIP_TAILSCALE=1 ;;
        *.*.*) PREFIX="$arg" ;;       # looks like a /24 like 192.168.1
        *) TARGETS+=("$arg") ;;       # treat as hostname
    esac
done

probe() {
    local host="$1" port="$2" path="$3" name="$4" envkey="$5"
    if curl -fsS --max-time 1 "http://${host}:${port}${path}" >/dev/null 2>&1; then
        printf "  %-12s http://%s:%s    -> %s=http://%s:%s\n" \
            "$name" "$host" "$port" "$envkey" "$host" "$port"
    fi
}

probe_all() {
    local h="$1"
    probe "$h" 11434 "/api/tags"   "Ollama"     "OLLAMA_HOST"
    probe "$h" 1234  "/v1/models"  "LM Studio"  "ZENVY_API_URL (set ZENVY_TIER=pro)"
    probe "$h" 5000  "/v1/models"  "oobabooga"  "ZENVY_API_URL (set ZENVY_TIER=pro)"
    probe "$h" 8080  "/v1/models"  "llama.cpp"  "ZENVY_API_URL (set ZENVY_TIER=pro)"
}

# 1. Build the list of hosts to scan.
HOSTS=()

# Local subnet (auto-detect or use explicit prefix).
if [[ -z "$PREFIX" ]]; then
    PREFIX=$(ip -4 route show default 2>/dev/null | awk '{print $3}' | head -1 | awk -F. '{print $1"."$2"."$3}' || true)
fi
if [[ -n "$PREFIX" ]]; then
    echo "Scanning local subnet $PREFIX.1-254..."
    for i in $(seq 1 254); do HOSTS+=("${PREFIX}.${i}"); done
fi

# Tailscale peers (uses the tailscale CLI if available).
if [[ "$SKIP_TAILSCALE" -eq 0 ]] && command -v tailscale >/dev/null 2>&1; then
    echo "Including Tailscale peers from \`tailscale status\`..."
    while IFS= read -r ip; do
        [[ -n "$ip" ]] && HOSTS+=("$ip")
    done < <(tailscale status 2>/dev/null | awk 'NR>1 && $1 ~ /^100\./ {print $1}')
fi

# Explicit hostnames the user passed.
for t in "${TARGETS[@]}"; do HOSTS+=("$t"); done

if [[ "${#HOSTS[@]}" -eq 0 ]]; then
    echo "No targets to scan. Pass a /24 (192.168.1) or hostnames (pc nas goblin)."
    exit 1
fi

echo

# 2. Probe each host in parallel, throttled to keep things tidy.
MAX_PARALLEL=64
running=0
for h in "${HOSTS[@]}"; do
    probe_all "$h" &
    (( ++running >= MAX_PARALLEL )) && { wait -n 2>/dev/null || wait; running=$((running-1)); }
done
wait

cat <<'EOF'

Done. Copy a line above into zenvy-ai/.env on the NAS, then:
  cd /volume1/docker/zenvy && docker compose restart bot

Tip: prefer Tailscale hostnames (e.g. http://pc:11434) over raw 100.x.y.z
IPs — they survive across reboots and node migrations.
EOF
