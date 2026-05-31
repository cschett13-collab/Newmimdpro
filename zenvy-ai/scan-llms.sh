#!/usr/bin/env bash
# scan-llms.sh — find every LLM server on your LAN.
# Looks for Ollama (11434), LM Studio (1234), oobabooga (5000), and llama.cpp (8080)
# on every device in your subnet. Prints a list of "IP:PORT -> server type".
#
# Usage:
#   bash scan-llms.sh                  # auto-detect subnet
#   bash scan-llms.sh 192.168.1        # scan a specific /24
#
# Requires: curl, awk. (Pre-installed on UGREEN UGOS, macOS, Linux.)
set -euo pipefail

PREFIX="${1:-}"
if [[ -z "$PREFIX" ]]; then
    PREFIX=$(ip -4 route show default 2>/dev/null | awk '{print $3}' | head -1 | awk -F. '{print $1"."$2"."$3}')
    [[ -z "$PREFIX" ]] && { echo "Can't auto-detect subnet. Pass it: bash scan-llms.sh 192.168.1"; exit 1; }
fi

echo "Scanning $PREFIX.1-254 for LLM servers (Ollama / LM Studio / oobabooga / llama.cpp)..."
echo

probe() {
    local ip="$1" port="$2" path="$3" name="$4"
    if curl -fsS --max-time 1 "http://${ip}:${port}${path}" >/dev/null 2>&1; then
        echo "  ${name}  -> http://${ip}:${port}"
    fi
}

for i in $(seq 1 254); do
    ip="${PREFIX}.${i}"
    (
        probe "$ip" 11434 "/api/tags" "Ollama       "
        probe "$ip" 1234  "/v1/models" "LM Studio    "
        probe "$ip" 5000  "/v1/models" "oobabooga    "
        probe "$ip" 8080  "/v1/models" "llama.cpp    "
    ) &
done
wait

echo
echo "Done. Copy the URL of the server you want into your zenvy-ai .env file."
echo "  Ollama       -> OLLAMA_HOST=http://IP:11434"
echo "  LM Studio    -> ZENVY_TIER=pro and ZENVY_API_URL=http://IP:1234/v1"
echo "  oobabooga    -> ZENVY_TIER=pro and ZENVY_API_URL=http://IP:5000/v1"
echo "  llama.cpp    -> ZENVY_TIER=pro and ZENVY_API_URL=http://IP:8080/v1"
