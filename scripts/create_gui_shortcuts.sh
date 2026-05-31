#!/usr/bin/env bash
# create_gui_shortcuts.sh — drop FVCE shortcuts onto the Pop!_OS workstation.
#
# Writes two .desktop entries into ~/.local/share/applications (visible in
# the Activities launcher and pinnable to the dock):
#
#   FVCE Portal             -> opens the Next.js portal in xdg's default browser
#   FVCE Server Management  -> opens Portainer (HTTPS, self-signed)
#
# Override the targets via env vars before running, or accept the defaults.
# After running, the icons appear within a few seconds; if not, log out and
# back in (some shells cache the application list).
#
# Usage:
#   NAS_IP=192.168.1.50 PORTAL_PORT=8080 PORTAINER_PORT=9443 \
#       bash scripts/create_gui_shortcuts.sh
#
# Defaults assume the portal and Portainer run on the same host (typical
# single-NAS deployment). Adjust if the portal runs on a different machine.

set -euo pipefail

NAS_IP="${NAS_IP:-127.0.0.1}"
PORTAL_HOST="${PORTAL_HOST:-$NAS_IP}"
PORTAL_PORT="${PORTAL_PORT:-8080}"
PORTAL_SCHEME="${PORTAL_SCHEME:-http}"
PORTAINER_HOST="${PORTAINER_HOST:-$NAS_IP}"
PORTAINER_PORT="${PORTAINER_PORT:-9443}"

APPS_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
mkdir -p "$APPS_DIR"

PORTAL_URL="${PORTAL_SCHEME}://${PORTAL_HOST}:${PORTAL_PORT}"
PORTAINER_URL="https://${PORTAINER_HOST}:${PORTAINER_PORT}"

PORTAL_FILE="${APPS_DIR}/fvce-portal.desktop"
PORTAINER_FILE="${APPS_DIR}/fvce-server-management.desktop"

cat > "$PORTAL_FILE" <<EOF
[Desktop Entry]
Type=Application
Version=1.0
Name=FVCE Portal
GenericName=Fox Valley Client Engine
Comment=Open the FVCE client portal dashboard
Exec=xdg-open ${PORTAL_URL}
Icon=web-browser
Terminal=false
Categories=Network;WebBrowser;Office;
StartupNotify=true
Keywords=fvce;portal;dashboard;crm;
EOF

cat > "$PORTAINER_FILE" <<EOF
[Desktop Entry]
Type=Application
Version=1.0
Name=FVCE Server Management
GenericName=Portainer
Comment=Open the Portainer Docker management UI on the NAS
Exec=xdg-open ${PORTAINER_URL}
Icon=utilities-system-monitor
Terminal=false
Categories=System;Network;
StartupNotify=true
Keywords=fvce;portainer;docker;nas;server;
EOF

chmod 644 "$PORTAL_FILE" "$PORTAINER_FILE"

# Refresh the desktop database so the new entries show up immediately.
if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database "$APPS_DIR" >/dev/null 2>&1 || true
fi

echo "Created:"
echo "  $PORTAL_FILE       -> $PORTAL_URL"
echo "  $PORTAINER_FILE  -> $PORTAINER_URL"
echo
echo "Search 'FVCE' in your Activities launcher to find them."
