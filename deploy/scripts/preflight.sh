#!/usr/bin/env bash
# ===========================================================================
# BrandX - preflight checks. Run this on the server BEFORE the first deploy.
# It verifies the Docker tooling and reports which host ports are already in
# use, so the BrandX port never collides with the Telegram bot.
# ===========================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$DEPLOY_DIR/.env.prod"

echo "==> Docker tooling"
if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker is not installed." >&2
  exit 1
fi
docker --version
docker compose version

echo
echo "==> Ports currently listening on this host"
if command -v ss >/dev/null 2>&1; then
  ss -tulpn 2>/dev/null | grep -E 'LISTEN' || echo "(no listening ports reported)"
elif command -v netstat >/dev/null 2>&1; then
  netstat -tulpn 2>/dev/null | grep -E 'LISTEN' || echo "(no listening ports reported)"
else
  echo "Neither 'ss' nor 'netstat' is available; skipping the port scan."
fi

echo
if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  PORT="$(grep -E '^BRANDX_HTTP_PORT=' "$ENV_FILE" | cut -d= -f2 | tr -d '[:space:]')"
  BIND="$(grep -E '^BRANDX_HTTP_BIND=' "$ENV_FILE" | cut -d= -f2 | tr -d '[:space:]')"
  PORT="${PORT:-8080}"
  BIND="${BIND:-127.0.0.1}"
  echo "==> BrandX will publish ${BIND}:${PORT} -> web:80"

  if command -v ss >/dev/null 2>&1 && ss -tulpn 2>/dev/null | grep -q ":${PORT} "; then
    echo "WARNING: port ${PORT} is already in use. Choose another BRANDX_HTTP_PORT." >&2
  else
    echo "Port ${PORT} looks free."
  fi
else
  echo "NOTE: ${ENV_FILE} does not exist yet."
  echo "      Create it with: cp deploy/.env.prod.example deploy/.env.prod"
fi

echo
echo "==> Preflight finished."
