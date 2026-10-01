#!/usr/bin/env bash
# ===========================================================================
# BrandX - backup the PostgreSQL database and uploaded media before a deploy.
#
# Writes to <repo>/backups/ (git-ignored). Safe to run while the stack is up.
# Archives contain customer data: treat them as secrets.
#
# Usage: ./deploy/scripts/backup.sh
# ===========================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_DIR="$(cd "$DEPLOY_DIR/.." && pwd)"
COMPOSE_FILE="$DEPLOY_DIR/docker-compose.prod.yml"
ENV_FILE="$DEPLOY_DIR/.env.prod"
BACKUP_DIR="${BACKUP_DIR:-$REPO_DIR/backups}"

compose() {
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found." >&2
  exit 1
fi

if ! compose ps --status running --services 2>/dev/null | grep -q '^postgres$'; then
  echo "WARNING: the 'postgres' service is not running - skipping the database dump." >&2
else
  mkdir -p "$BACKUP_DIR"
  TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

  echo "==> Dumping PostgreSQL ..."
  # Credentials are read from the container's own environment (no secrets on the CLI).
  compose exec -T postgres sh -c \
    'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' \
    > "$BACKUP_DIR/db-$TIMESTAMP.dump"
  echo "    -> $BACKUP_DIR/db-$TIMESTAMP.dump"

  echo "==> Archiving uploaded media ..."
  docker run --rm \
    -v brandx_prod_media_data:/data:ro \
    -v "$BACKUP_DIR":/backup \
    alpine:3.20 \
    tar -czf "/backup/media-$TIMESTAMP.tar.gz" -C /data .
  echo "    -> $BACKUP_DIR/media-$TIMESTAMP.tar.gz"

  echo
  echo "==> Backup finished."
fi
