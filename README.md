# BrandX — Clothes Shop CRM / POS

An existing retail CRM/POS being incrementally migrated to a multi-store platform.
**Multi-store enforcement and Platform Admin are not implemented yet.** Do not
onboard independent stores until the security acceptance gates pass.
See [ARCHITECTURE_AUDIT.md](./ARCHITECTURE_AUDIT.md) for findings and agreed decisions.

- **Backend**: Django 5 + Django REST Framework + PostgreSQL 17 (SQLite supported for tests; MySQL retained temporarily for source-data transfer)
- **Frontend**: Angular 19 (Standalone + Signals + Angular Material)
- **Languages**: O'zbekcha / Русский (UI only — no English)

---

## Features

- **PIN login** — employees sign in with a numeric PIN (no username/password UI).
  PINs are hashed, attempts are counted and repeated failures trigger a temporary
  lockout. Employees are created only by the owner.
- **Roles** — `owner`, `manager`, `cashier`, enforced on the API.
- **Products** — name, category, barcode (scanner or manual, unique,
  auto-generatable), cost & selling price, stock, size, colour, description,
  photo, active flag. Variants (colour × size) with their own barcode and stock.
- **POS** — search by name or barcode, scan to add to cart, cash / card / mixed
  payment, automatic **change** calculation, atomic checkout that updates stock.
- **Sales** — history with filters (today / yesterday / week / month / custom,
  cashier, payment method), detail view, receipt re-print.
- **Receipts** — thermal 80 mm PDF (`/api/sales/{id}/receipt_pdf/`), RU/UZ labels.
- **Returns** — return goods from a sale; stock goes back and the sale status is
  updated without deleting history.
- **Inventory** — goods receipts (kirim) and a full stock-movement trail
  (purchase / sale / return / adjustment / inventory).
- **Finance** — income & expense entries; owner-only profit (revenue, COGS,
  gross, expenses, net).
- **Reports** — Excel (`.xlsx`) and CSV exports for sales, stock, receipts,
  finance and the financial summary.
- **Dashboard** — period selector, revenue, sales count, units sold, cash/card
  split, average ticket, top products, simple sales chart, low-stock list.
- **Audit log** — WHO / WHAT / WHEN for important actions (secrets are never
  logged).
- **Admin panel** — Django admin reachable with the same PIN, available in
  O‘zbekcha / Русский.
- **Modern UI** — one design system across every screen, **light / dark / system**
  themes, collapsible sidebar, toasts, skeleton loaders, empty states, and a
  keyboard-first POS (`F2` search, `Enter` scan/add, `F4` pay).

---

## Architecture

```
brandx/
├── backend/                     # Django REST API
│   └── apps/
│       ├── authentication/      # PIN login, users, roles, permissions
│       ├── products/            # categories, products, variants, colours, sizes
│       ├── inventory/           # receipts, stock movements, valuation
│       ├── sales/               # POS checkout, receipts, returns, dashboard
│       ├── finance/             # income / expense
│       ├── reports/             # Excel / CSV exports
│       ├── audit/               # audit log
│       ├── customers/           # simple customer records
│       ├── vendors/             # (installed, no UI)
│       └── ai_analysis/         # (installed, no UI)
├── frontend/                    # Angular 19 web app
│   └── src/app/
│       ├── core/                # services, guards, interceptors, i18n, models
│       ├── features/            # pos, dashboard, products, stock, sales, ...
│       └── layout/              # compact role-aware sidebar
├── docker-compose.yml
├── verify_e2e.py                # end-to-end smoke test
└── IMPLEMENTATION_REPORT.md     # what was changed and why
```

---

## Quick start (Docker, recommended)

Runs PostgreSQL + Django + Angular (nginx). Set `.env` credentials first.
**Existing MySQL installation? Follow the migration procedure below before starting
or recreating the backend.** The existing MySQL volume is retained, not converted.
Seeding and automatic credential resets are disabled by default.

```bash
cd brandx
# Create .env from .env.example and set SECRET_KEY, DB_PASSWORD and other values.
# Fresh installation only; existing installations must complete transfer first.
docker compose up --build -d
```

| Service | URL |
|---------|-----|
| Web app | http://localhost:4200 |
| API     | http://localhost:8000/api |
| Django admin | http://localhost:8000/admin |

Existing installations retain their accounts until the later store/role migration.
Fresh installations have no automatic account: explicitly run `create_admin` with
operator-chosen credentials if testing the current single-store version. This
command still creates a technical Owner, not the planned Platform Admin.

The **Django admin** at http://localhost:8000/admin uses the same **PIN login**
(the standard username/password form is replaced by a PIN pad, with the same
rate limiting). The admin UI is available in **O‘zbekcha / Русский** — switch the
language in the top bar, and it opens in the employee's saved language after PIN
login. Section and model names (Mahsulotlar / Товары, Sotuvlar / Продажи, …) are
translated too. Only staff accounts (owner) can sign in to the admin.

Override before first start by copying `.env.example` to `.env`
(`DJANGO_ADMIN_PIN`, `DJANGO_ADMIN_PASSWORD`, ports, DB credentials).

Useful commands:

```bash
docker compose logs -f backend   # follow backend logs
docker compose down              # stop
# NEVER use down -v on installations containing customer data.
# verify_e2e.py writes fixtures: use only a disposable development installation.
```

---

## PostgreSQL migration — preserve existing data

The source MySQL and media volumes must remain untouched. PostgreSQL uses a new
`postgres_data` volume. The `legacy-mysql` profile retains the original MySQL
service. **Do not run `down -v`, overwrite credentials, flush the source, or use
production data with `verify_e2e.py`.** PostgreSQL 17 is supported through 2029;
apply current minor releases.

1. Schedule maintenance; stop all application/background writes. Take a verified
   native MySQL backup and a separate media backup to protected storage. Record
   source database name, code version and `showmigrations` state. A successful
   archive export is not a replacement for a recoverable backup.
2. Use the **same code and migration schema** for export/import. Do this database
   transfer before future Store-schema migrations; applying different schemas to
   source/target causes manifest validation to fail. Keep source and target
   credentials in separate private environment files; never reuse new PostgreSQL
   credentials for the old MySQL service.
3. With Django configured against the source (`DB_ENGINE=django.db.backends.mysql`,
   original DB_HOST/PORT/NAME/USER/PASSWORD), run:

   ```bash
   python manage.py transfer_database export --file /protected/path/brandx-transfer.json \
     --confirm-source-writes-frozen
   ```

   The archive is created exclusively (refuses overwrite) with mode 0600. It
   contains customer data and password/PIN hashes: do not commit, publish or send
   it in chat. Store it outside web-accessible media directories.
4. Start an isolated PostgreSQL target with explicit environment credentials and
   `BOOTSTRAP_ADMIN=false`, `SEED_DATA=false`. Run migrations against this target:

   ```bash
   python manage.py migrate --noinput
   python manage.py transfer_database import --file /protected/path/brandx-transfer.json
   python manage.py transfer_database verify --file /protected/path/brandx-transfer.json
   ```

   Import refuses any nonempty transferred table. It preserves primary keys,
   natural auth permission references, monetary snapshots and model relationships,
   checks constraints and resets PostgreSQL sequences inside a transaction.
   Model row counts and canonical serialized SHA-256 digests must match; a
   mismatch rolls back the import. Sessions/JWT tokens are intentionally excluded;
   users must sign in again. Rotate SECRET_KEY at controlled cutover to invalidate
   old JWTs, which might otherwise still be cryptographically valid.
5. Verify media paths/files, source/target row counts, timestamps, receipt totals,
   PIN/password login, new-ID allocation, stock/POS/return and financial exports on
   the target. Run the full PostgreSQL suite below. Compare financial totals before
   and after. Do not resume writes until operator approval.
6. Switch the application DB configuration only after checks pass. Keep MySQL
   read-only as the rollback source and keep backups. Once PostgreSQL accepts new
   writes, switching back to the stale MySQL source would lose those writes:
   reconciliation or a new migration is required, not a blind rollback.

For large databases this archive implementation holds records in memory; rehearse
with a representative copy before scheduling production cutover. No live source
backup/transfer/cutover has been executed by this update.

### Isolated PostgreSQL verification

After building the backend image, this starts an ephemeral PostgreSQL instance
without production volumes, media mounts or published ports:

```bash
docker compose -p brandx-verification -f docker-compose.test.yml up \
  --abort-on-container-exit --exit-code-from tests
```

## Local development

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env            # then edit DB settings
python manage.py migrate
python manage.py seed_data      # starter categories / colours / sizes
python manage.py create_admin   # owner account (admin / 1, PIN 0808)
python manage.py runserver
```

Runs at http://localhost:8000.

### Frontend

```bash
cd frontend
npm install
npm start
```

Runs at http://localhost:4200 (proxies `/api` to the backend).

---

## Environment variables (backend)

| Variable | Description | Default |
|----------|-------------|---------|
| `SECRET_KEY` | Django secret key | (set in .env) |
| `DB_ENGINE` | `django.db.backends.postgresql`; mysql for transfer source, sqlite3 for tests | postgresql |
| `DB_NAME` | Database name (or `:memory:` for SQLite) | `brandx` |
| `DB_USER` | Database user | Must be supplied for Compose |
| `DB_PASSWORD` | Database password | Must be supplied for Compose |
| `DB_HOST` / `DB_PORT` | Database host / port | `localhost` / `5432`; Compose `postgres` / `5432` |
| `BOOTSTRAP_ADMIN` / `SEED_DATA` | Explicit bootstrap/seed (keep false for import) | `false` |
| `PIN_MAX_ATTEMPTS` | Failed PIN attempts before lockout | `5` |
| `PIN_LOCKOUT_SECONDS` | Lockout duration (seconds) | `300` |
| `DJANGO_ADMIN_PIN` | Owner login PIN | `0808` |
| `DJANGO_ADMIN_PASSWORD` | Owner technical password | `1` |

---

## API endpoints

| Module | Base URL | Description |
|--------|----------|-------------|
| Auth | `/api/auth/` | `login/pin/`, `login/`, `logout/`, `users/` |
| Products | `/api/products/` | products, variants, categories, colours, sizes, `search/` |
| Inventory | `/api/inventory/` | `receipts/`, `movements/`, `valuation/` |
| Sales | `/api/sales/` | sales, `returns/`, `receipt_pdf/`, `return_items/`, `dashboard/` |
| Finance | `/api/finance/` | income / expense entries + `summary/` |
| Reports | `/api/reports/` | `sales/`, `stock/`, `receipts/`, `finance/`, `financial-summary/` |
| Audit | `/api/audit/` | audit log (read-only) |
| Customers | `/api/customers/` | simple customer records |

---

## Tests

```bash
# Backend unit tests (SQLite, no MySQL needed)
cd brandx
docker compose run --rm --no-deps --entrypoint sh \
  -v "$(pwd)/backend:/app" \
  -e DB_ENGINE=django.db.backends.sqlite3 -e DB_NAME=:memory: \
  backend -c "python manage.py test apps"

# End-to-end (stack must be running)
python3 verify_e2e.py
```

Current verification: **120 tests passed on PostgreSQL 17.11 and SQLite**
(2026-10-01), including 5 transfer-integrity/rollback tests. Existing migrations
apply on PostgreSQL; `makemigrations --check --dry-run` reports no changes.
The earlier single-store E2E run passed 46 checks, but has **not** been rerun for
this architecture update. Multi-store security tests are pending.

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Backend API | Django 5 + DRF |
| Auth | PIN login → JWT (SimpleJWT) |
| Database | PostgreSQL 17 (SQLite for fast tests; MySQL source adapter temporarily retained) |
| Barcodes | python-barcode (Code128) |
| Receipts | ReportLab (thermal 80 mm PDF) |
| Exports | openpyxl (`.xlsx`) + CSV (UTF-8 BOM) |
| Frontend | Angular 19 Standalone + Angular Material |
| i18n | Lightweight custom `TranslationService` (RU / UZ) |
| Theming | CSS custom-property design system + dark mode |

See [IMPLEMENTATION_REPORT.md](./IMPLEMENTATION_REPORT.md) for the full list of
changes, removals, permissions and remaining items.
