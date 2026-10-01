#!/bin/sh
set -e

echo "==> Waiting for MySQL at ${DB_HOST:-db}:${DB_PORT:-3306} ..."
python - <<'PY'
import sys, time
import MySQLdb
from decouple import config

host = config('DB_HOST', default='db')
port = int(config('DB_PORT', default=3306))
user = config('DB_USER', default='brandx')
password = config('DB_PASSWORD', default='brandx')
name = config('DB_NAME', default='brandx')

for attempt in range(1, 61):
    try:
        MySQLdb.connect(host=host, port=port, user=user, passwd=password, db=name)
        print(f'MySQL is ready (attempt {attempt}).')
        sys.exit(0)
    except Exception as exc:  # noqa: BLE001
        print(f'  ... not ready ({exc})')
        time.sleep(2)

print('MySQL did not become ready in time.', file=sys.stderr)
sys.exit(1)
PY

echo "==> Running migrations ..."
python manage.py migrate --noinput

echo "==> Ensuring default admin user exists ..."
python manage.py create_admin \
  --username "${DJANGO_ADMIN_USERNAME:-admin}" \
  --password "${DJANGO_ADMIN_PASSWORD:-1}" \
  --pin "${DJANGO_ADMIN_PIN:-0808}"

if [ "${SEED_DATA:-true}" = "true" ]; then
  echo "==> Seeding starter categories / colours / sizes ..."
  python manage.py seed_data
fi

echo "==> Collecting static files ..."
python manage.py collectstatic --noinput >/dev/null

echo "==> Starting gunicorn on 0.0.0.0:8000 ..."
exec gunicorn brandx_api.wsgi:application \
  --bind 0.0.0.0:8000 \
  --workers "${GUNICORN_WORKERS:-3}" \
  --timeout 120 \
  --access-logfile - \
  --error-logfile -
