#!/usr/bin/env bash
# ===========================================================================
# BrandX - one-command production deploy.
#
#   1. (optional) git pull --ff-only
#   2. run the Dockerized test suite
#   3. back up the database + media
#   4. tag the running images as :previous (for rollback)
#   5. build the new images
#   6. recreate the stack and wait until every service is healthy
#   7. remove dangling images
#
# Usage:
#   ./deploy/scripts/deploy.sh                 # full flow
#   ./deploy/scripts/deploy.sh --pull          # git pull first
#   ./deploy/scripts/deploy.sh --skip-tests
#   ./deploy/scripts/deploy.sh --skip-backup
#   ./deploy/scripts/deploy.sh --skip-tests --skip-backup
# ===========================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_DIR="$(cd "$DEPLOY_DIR/.." && pwd)"
COMPOSE_FILE="$DEPLOY_DIR/docker-compose.prod.yml"
ENV_FILE="$DEPLOY_DIR/.env.prod"

SKIP_TESTS=0
SKIP_BACKUP=0
GIT_PULL=0
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-180}"

usage() {
  sed -n '2,19p' "$0" | sed 's/^# \{0,1\}//'
}

for arg in "$@"; do
  case "$arg" in
    --skip-tests)  SKIP_TESTS=1 ;;
    --skip-backup) SKIP_BACKUP=1 ;;
    --pull)        GIT_PULL=1 ;;
    -h|--help)     usage; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

compose() {
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found." >&2
  echo "       cp deploy/.env.prod.example deploy/.env.prod   # then edit it" >&2
  exit 1
fi

cd "$REPO_DIR"

# ---------------------------------------------------------------------------
# 1. Update the source (optional).
# ---------------------------------------------------------------------------
if [ "$GIT_PULL" -eq 1 ]; then
  echo "==> Updating the source tree (git pull --ff-only) ..."
  git pull --ff-only
fi

# ---------------------------------------------------------------------------
# 2. Tests must pass before anything is deployed.
# ---------------------------------------------------------------------------
if [ "$SKIP_TESTS" -eq 1 ]; then
  echo "==> Skipping tests (--skip-tests)."
else
  echo "==> Running the test suite ..."
  "$SCRIPT_DIR/test.sh"
fi

# ---------------------------------------------------------------------------
# 3. Back up the current data.
# ---------------------------------------------------------------------------
if [ "$SKIP_BACKUP" -eq 1 ]; then
  echo "==> Skipping backup (--skip-backup)."
else
  echo "==> Backing up the database and media ..."
  "$SCRIPT_DIR/backup.sh"
fi

# ---------------------------------------------------------------------------
# 4. Keep the previous images so rollback.sh can restore them.
# ---------------------------------------------------------------------------
if docker image inspect brandx-backend:prod >/dev/null 2>&1; then
  docker tag brandx-backend:prod brandx-backend:previous
  echo "==> Tagged current backend image as brandx-backend:previous"
fi
if docker image inspect brandx-web:prod >/dev/null 2>&1; then
  docker tag brandx-web:prod brandx-web:previous
  echo "==> Tagged current web image as brandx-web:previous"
fi

# ---------------------------------------------------------------------------
# 5. Build the new images.
# ---------------------------------------------------------------------------
echo "==> Building images ..."
compose build

# ---------------------------------------------------------------------------
# 6. Recreate the stack.
# ---------------------------------------------------------------------------
echo "==> Starting the stack ..."
compose up -d --remove-orphans

# ---------------------------------------------------------------------------
# 7. Wait until every service reports healthy.
# ---------------------------------------------------------------------------
service_state() {
  local cid
  cid="$(compose ps -q "$1" 2>/dev/null || true)"
  if [ -z "$cid" ]; then
    echo "missing"
    return
  fi
  docker inspect --format \
    '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' \
    "$cid"
}

echo "==> Waiting for services to become healthy (timeout ${HEALTH_TIMEOUT}s) ..."
deadline=$(( $(date +%s) + HEALTH_TIMEOUT ))
while :; do
  all_ok=1
  line=""
  for svc in postgres backend web; do
    state="$(service_state "$svc")"
    line="$line  $svc=$state"
    case "$state" in
      healthy|running) ;;
      *) all_ok=0 ;;
    esac
  done
  echo "    $line"
  [ "$all_ok" -eq 1 ] && break
  if [ "$(date +%s)" -ge "$deadline" ]; then
    echo "ERROR: services did not become healthy in time." >&2
    compose ps
    exit 1
  fi
  sleep 5
done

# ---------------------------------------------------------------------------
# 8. Clean up dangling images (frees disk space; never touches named volumes).
# ---------------------------------------------------------------------------
echo "==> Pruning dangling images ..."
docker image prune -f >/dev/null 2>&1 || true

# ---------------------------------------------------------------------------
# Done.
# ---------------------------------------------------------------------------
HTTP_PORT="$(grep -E '^BRANDX_HTTP_PORT=' "$ENV_FILE" | cut -d= -f2 | tr -d '[:space:]')"
HTTP_BIND="$(grep -E '^BRANDX_HTTP_BIND=' "$ENV_FILE" | cut -d= -f2 | tr -d '[:space:]')"
HTTP_PORT="${HTTP_PORT:-8080}"
HTTP_BIND="${HTTP_BIND:-127.0.0.1}"

echo
echo "==> Deploy finished. ✅"
echo "    Stack:  $(compose ps --services | tr '\n' ' ')"
echo "    Web:    http://${HTTP_BIND}:${HTTP_PORT}/"
compose ps
