# BrandX — Clothes Shop CRM / POS

A simple, fast point-of-sale and back-office system for a single clothes shop.

- **Backend**: Django 5 + Django REST Framework + MySQL (SQLite supported for tests)
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

Runs MySQL + Django + Angular (nginx) together, applies migrations, seeds starter
data and creates the owner account.

```bash
cd brandx
docker compose up --build -d
```

| Service | URL |
|---------|-----|
| Web app | http://localhost:4200 |
| API     | http://localhost:8000/api |
| Django admin | http://localhost:8000/admin |

**Login (PIN):** `0808`
Owner password (technical fallback): `admin` / `1`

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
docker compose down -v           # stop and wipe the database volume
python3 verify_e2e.py            # end-to-end smoke test against the stack
```

---

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
| `DB_ENGINE` | `django.db.backends.mysql` or `...sqlite3` | mysql |
| `DB_NAME` | Database name (or `:memory:` for SQLite) | `brandx` |
| `DB_USER` | MySQL user | `root` |
| `DB_PASSWORD` | MySQL password | `159632` |
| `DB_HOST` / `DB_PORT` | MySQL host / port | `localhost` / `3306` |
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

Unit suite: **111 tests, OK**. E2E smoke test: **46 checks, ALL PASSED**.

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Backend API | Django 5 + DRF |
| Auth | PIN login → JWT (SimpleJWT) |
| Database | MySQL 8 (SQLite for tests) |
| Barcodes | python-barcode (Code128) |
| Receipts | ReportLab (thermal 80 mm PDF) |
| Exports | openpyxl (`.xlsx`) + CSV (UTF-8 BOM) |
| Frontend | Angular 19 Standalone + Angular Material |
| i18n | Lightweight custom `TranslationService` (RU / UZ) |
| Theming | CSS custom-property design system + dark mode |

See [IMPLEMENTATION_REPORT.md](./IMPLEMENTATION_REPORT.md) for the full list of
changes, removals, permissions and remaining items.
