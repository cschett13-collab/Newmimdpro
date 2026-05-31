#!/usr/bin/env bash
# cloudflare-mailgun-dns.sh
#
# One-shot creator for the five DNS records Mailgun requires on the
# `mg.<your-domain>` sending subdomain. Writes via Cloudflare's REST API
# so you don't have to click through the dashboard.
#
# Usage:
#   CF_API_TOKEN=...  MAILGUN_DKIM_PUBLIC_KEY="k=rsa; p=MIIBIj..."  \
#     scripts/cloudflare-mailgun-dns.sh foxvalleyclientengine.com
#
# Required env vars:
#   CF_API_TOKEN              Cloudflare API token. Create at
#                             https://dash.cloudflare.com/profile/api-tokens
#                             with "Zone:DNS:Edit" on the target zone.
#   MAILGUN_DKIM_PUBLIC_KEY   The full DKIM TXT value Mailgun shows for
#                             s1._domainkey.mg.<domain>. Include the
#                             leading "k=rsa; p=..."  Do NOT include
#                             surrounding quotes.
#
# Optional env vars:
#   MAILGUN_SUBDOMAIN         Defaults to "mg".
#   MAILGUN_DKIM_SELECTOR     Defaults to "s1".
#   MAILGUN_REGION            "us" (default) or "eu" — picks the SPF include
#                             and tracking CNAME target.
#   DMARC_REPORT_EMAIL        If set, also creates a _dmarc TXT pointing
#                             rua reports at this address.
#   SKIP_DMARC=1              Don't create the DMARC record at all.
#   DRY_RUN=1                 Print the records without calling Cloudflare.

set -euo pipefail

usage() {
    sed -n '2,/^$/p' "$0" | sed 's/^# \{0,1\}//'
    exit 64
}

[[ "${1:-}" == "-h" || "${1:-}" == "--help" || $# -ne 1 ]] && usage

ZONE_NAME="$1"
SUBDOMAIN="${MAILGUN_SUBDOMAIN:-mg}"
SELECTOR="${MAILGUN_DKIM_SELECTOR:-s1}"
REGION="${MAILGUN_REGION:-us}"
SEND_DOMAIN="${SUBDOMAIN}.${ZONE_NAME}"

: "${CF_API_TOKEN:?CF_API_TOKEN is required (Zone:DNS:Edit token)}"
: "${MAILGUN_DKIM_PUBLIC_KEY:?MAILGUN_DKIM_PUBLIC_KEY is required (paste from Mailgun)}"

if [[ "$REGION" == "eu" ]]; then
    SPF_INCLUDE="mailgun.org"  # same include for both regions
    TRACK_TARGET="eu.mailgun.org"
else
    SPF_INCLUDE="mailgun.org"
    TRACK_TARGET="mailgun.org"
fi

CF_API="https://api.cloudflare.com/client/v4"

have() { command -v "$1" >/dev/null 2>&1; }
have curl || { echo "curl is required" >&2; exit 1; }
have jq   || { echo "jq is required (apt install jq / brew install jq)" >&2; exit 1; }

cf() {
    # $1=method, $2=path, $3=optional JSON body
    local method="$1" path="$2" body="${3:-}"
    if [[ -n "$body" ]]; then
        curl -sS -X "$method" "${CF_API}${path}" \
            -H "Authorization: Bearer ${CF_API_TOKEN}" \
            -H "Content-Type: application/json" \
            --data "$body"
    else
        curl -sS -X "$method" "${CF_API}${path}" \
            -H "Authorization: Bearer ${CF_API_TOKEN}"
    fi
}

if [[ -n "${DRY_RUN:-}" ]]; then
    echo ">>> DRY_RUN — skipping zone lookup and writes; printing planned records:"
    ZONE_ID="DRYRUN"
else
    echo ">>> resolving zone id for ${ZONE_NAME}"
    ZONE_ID="$(cf GET "/zones?name=${ZONE_NAME}" | jq -r '.result[0].id // empty')"
    if [[ -z "$ZONE_ID" ]]; then
        echo "could not find Cloudflare zone '${ZONE_NAME}'." >&2
        echo "double-check the token has Zone:Read for this zone, and the domain is in CF." >&2
        exit 2
    fi
    echo "    zone id: ${ZONE_ID}"
fi

# Records to upsert. Format: TYPE|NAME|CONTENT|PRIORITY|PROXIED
# PRIORITY is "" except for MX. PROXIED is "false" for everything (proxy
# breaks SMTP and Mailgun open-tracking).
records=(
    "TXT|${SEND_DOMAIN}|v=spf1 include:${SPF_INCLUDE} ~all||false"
    "TXT|${SELECTOR}._domainkey.${SEND_DOMAIN}|${MAILGUN_DKIM_PUBLIC_KEY}||false"
    "MX|${SEND_DOMAIN}|mxa.${TRACK_TARGET}|10|false"
    "MX|${SEND_DOMAIN}|mxb.${TRACK_TARGET}|10|false"
    "CNAME|email.${SEND_DOMAIN}|${TRACK_TARGET}||false"
)

if [[ -z "${SKIP_DMARC:-}" ]]; then
    if [[ -n "${DMARC_REPORT_EMAIL:-}" ]]; then
        dmarc_value="v=DMARC1; p=none; rua=mailto:${DMARC_REPORT_EMAIL}; fo=1"
    else
        dmarc_value="v=DMARC1; p=none"
    fi
    records+=("TXT|_dmarc.${ZONE_NAME}|${dmarc_value}||false")
fi

upsert() {
    local type="$1" name="$2" content="$3" priority="$4" proxied="$5"

    # Build JSON. jq -n keeps quoting safe for the DKIM key.
    local body
    if [[ "$type" == "MX" ]]; then
        body="$(jq -n \
            --arg type "$type" --arg name "$name" --arg content "$content" \
            --argjson priority "${priority:-10}" --argjson proxied "$proxied" \
            '{type:$type,name:$name,content:$content,priority:$priority,ttl:1,proxied:$proxied}')"
    else
        body="$(jq -n \
            --arg type "$type" --arg name "$name" --arg content "$content" \
            --argjson proxied "$proxied" \
            '{type:$type,name:$name,content:$content,ttl:1,proxied:$proxied}')"
    fi

    if [[ -n "${DRY_RUN:-}" ]]; then
        echo "DRY_RUN ${type} ${name} -> ${content}"
        return
    fi

    # Look for an existing record we should update vs. create.
    # MX uses content as the discriminator; TXT/CNAME usually unique by name+type.
    local existing_id
    if [[ "$type" == "MX" ]]; then
        existing_id="$(cf GET "/zones/${ZONE_ID}/dns_records?type=${type}&name=${name}" \
            | jq -r --arg c "$content" '.result[] | select(.content==$c) | .id' \
            | head -n1)"
    else
        existing_id="$(cf GET "/zones/${ZONE_ID}/dns_records?type=${type}&name=${name}" \
            | jq -r '.result[0].id // empty')"
    fi

    local resp
    if [[ -n "$existing_id" ]]; then
        echo ">>> updating ${type} ${name}"
        resp="$(cf PUT "/zones/${ZONE_ID}/dns_records/${existing_id}" "$body")"
    else
        echo ">>> creating ${type} ${name}"
        resp="$(cf POST "/zones/${ZONE_ID}/dns_records" "$body")"
    fi

    if [[ "$(jq -r '.success' <<<"$resp")" != "true" ]]; then
        echo "FAILED for ${type} ${name}:" >&2
        jq '.errors' <<<"$resp" >&2
        exit 1
    fi
}

for rec in "${records[@]}"; do
    IFS='|' read -r type name content priority proxied <<<"$rec"
    upsert "$type" "$name" "$content" "$priority" "$proxied"
done

echo
echo "done. wait ~30s, then click 'Verify DNS settings' in Mailgun."
echo "    domain: ${SEND_DOMAIN}"
