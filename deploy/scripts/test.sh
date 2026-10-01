#!/usr/bin/env bash
# ===========================================================================
# BrandX - run the full test suite inside Docker (isolated, no production data).
#
# Steps:
#   1. Build the PRODUCTION backend image.
#   2. Start an ephemeral PostgreSQL (tmpfs, discarded on exit).
#   3. Verify there are no missing migrations.
#   4. Run Django system checks.
#   5. Run the Django test suite.
#   6. Tear everything down.
#
# Usage: ./deploy/scripts/test.sh
# ===========================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$DEPLOY_DIR/docker-compose.test.yml"

# docker compose wrapper, always scoped to the disposable test project.
compose() {
  docker compose -f "$COMPOSE_FILE" "$@"
}

# Always clean up, even on failure.
cleanup() {
  echo
  echo "==> Tearing down the test stack ..."
  compose down -v --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "==> Building the production backend image ..."
compose build

echo
echo "==> Starting ephemeral PostgreSQL ..."
compose up -d postgres-test

echo
echo "==> Checking for missing migrations ..."
compose run --rm --no-deps tests makemigrations --check --dry-run

echo
echo "==> Running Django system checks ..."
compose run --rm --no-deps tests check

echo
echo "==> Running the Django test suite ..."
compose run --rm tests test apps --noinput --verbosity=1

echo
echo "==> All tests passed. ✅"
