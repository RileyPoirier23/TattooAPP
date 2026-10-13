#!/usr/bin/env bash
# Starts the site for a Codespaces preview (port 3000). Data is kept in ./data inside the codespace.
set -e
cd "$(dirname "$0")/.."
export PORT=3000
export DATA_DIR="${DATA_DIR:-$PWD/data}"
export ADMIN_EMAIL="${ADMIN_EMAIL:-admin@example.com}"
export ADMIN_PASSWORD="${ADMIN_PASSWORD:-preview-password}"
# Links in emails and the site's own address should point at the codespace's forwarded URL.
if [ -n "$CODESPACE_NAME" ] && [ -n "$GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN" ]; then
  export APP_URL="https://$CODESPACE_NAME-3000.$GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN"
fi
[ -f dist/server.js ] || npm run build
nohup node dist/server.js > /tmp/inkspace-preview.log 2>&1 &
echo "InkSpace is starting on port 3000 (log: /tmp/inkspace-preview.log)."
