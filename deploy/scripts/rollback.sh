#!/usr/bin/env bash
# ===========================================================================
# BrandX - roll back to the images tagged :previous by deploy.sh.
#
#   1. Re-tag brandx-{backend,web}:previous  ->  :prod
#   2. Recreate the stack from those images
#
# The database is NOT rolled back automatically (migrations may be one-way).
# Restore a dump from .deploy/backups/ manually if required.
#
# Usage: ./deploy/scripts/rollback.sh
# ===========================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$DEPLOY_DIR/docker-compose.prod.yml"
ENV_FILE="$DEPLOY_DIR/.env.prod"

compose() {
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found." >&2
  exit 1
fi

for image in brandx-backend:previous brandx-web:previous; do
  if ! docker image inspect "$image" >/dev/null 2>&1; then
    echo "ERROR: image '$image' not found; nothing to roll back to." >&2
    exit 1
  fi
done

echo "==> Restoring the previous images ..."
docker tag brandx-backend:previous brandx-backend:prod
docker tag brandx-web:previous brandx-web:prod

echo "==> Recreating the stack ..."
compose up -d --remove-orphans

echo
echo "==> Rollback finished. ✅"
compose ps
