# BrandX POS — Multi-Branch Clothes Shop Management System

A full-stack Point of Sale (POS) system for clothes shops with multi-branch support, built with:

- **Backend**: Django 5 + Django REST Framework + MySQL
- **Frontend**: Angular 19 (Standalone + Signals)
- **AI**: Groq (llama3-8b-8192) for financial analysis

---

## Architecture

```
BrandX/
├── backend/          # Django REST API
│   └── apps/
│       ├── authentication/   # JWT auth, user roles (admin/manager/guest)
│       ├── products/         # Catalog, variants, colors, sizes, barcodes
│       ├── inventory/        # Stock items (FIFO), adjustments, valuation
│       ├── vendors/          # Vendor management, financial tracking
│       ├── customers/        # Credit/installment customers, plans
│       ├── sales/            # POS sales (cash/credit/installment), receipts
│       └── ai_analysis/      # Groq AI financial analysis
└── frontend/         # Angular 19 web app
    └── src/app/
        ├── core/             # Services, guards, interceptors, models
        ├── features/         # Lazy-loaded pages (dashboard, pos, products...)
        └── layout/           # Main layout with Material sidenav
```

---

## Features

### Sales
- **Cash** sales with change calculator
- **Credit** sales with credit limit enforcement
- **Installment** plans with down payment, monthly tracking, overdue alerts
- PDF receipt generation (thermal 85mm format)

### Products & Inventory
- Products with variants (color × size combinations)
- Barcode generation (Code128) per product/variant
- Stock tracking with vendor linkage, import/production/expiry dates
- FIFO stock deduction on sales
- Inventory valuation (cost + retail + potential profit)

### Financial Management
- Vendor balance tracking (purchase/payment/return)
- Customer credit/installment balance tracking
- Dashboard stats (today/month/year + by sale type)
- AI-powered financial analysis via Groq API

### Users & Roles
- **Admin**: Full access including user management and settings
- **Manager**: Product, inventory, vendor, customer, sales management
- **Guest**: POS only (cash sales)

---

## Setup

### Prerequisites
- Python 3.11+
- Node.js 20+
- MySQL 8+

---

### 1. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate       # Windows
# source venv/bin/activate  # Linux/Mac

# Install dependencies
pip install -r requirements.txt

# Configure environment
copy .env.example .env      # Then edit .env with your settings
# or use the existing .env which has default values

# Create database
mysql -u root -p159632 -e "CREATE DATABASE IF NOT EXISTS brandx CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Run migrations
python manage.py migrate

# Create superuser (admin account)
python manage.py createsuperuser

# Load initial data (optional)
python manage.py shell -c "
from apps.products.models import Color, Size
Color.objects.get_or_create(name='Black', defaults={'hex_code': '#000000'})
Color.objects.get_or_create(name='White', defaults={'hex_code': '#FFFFFF'})
Color.objects.get_or_create(name='Red', defaults={'hex_code': '#FF0000'})
for name in ['XS', 'S', 'M', 'L', 'XL', 'XXL']:
    Size.objects.get_or_create(name=name, defaults={'size_type': 'letter'})
print('Initial data loaded.')
"

# Start development server
python manage.py runserver
```

Backend API runs at: **http://localhost:8000**

---

### 2. Frontend Setup (Angular 19)

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm start
```

Frontend runs at: **http://localhost:4200**

Default login after creating superuser:
- Username: as created in `createsuperuser`
- Password: as created in `createsuperuser`



---

## Environment Variables (backend/.env)

| Variable | Description | Default |
|----------|-------------|---------|
| `SECRET_KEY` | Django secret key | (set in .env) |
| `DB_NAME` | MySQL database name | `brandx` |
| `DB_USER` | MySQL user | `root` |
| `DB_PASSWORD` | MySQL password | `159632` |
| `DB_HOST` | MySQL host | `localhost` |
| `DB_PORT` | MySQL port | `3306` |
| `GROQ_API_KEY` | Groq API key for AI | optional |
| `CORS_ALLOWED_ORIGINS` | Allowed CORS origins | `http://localhost:4200` |

Get a free Groq API key at: https://console.groq.com

---

## API Endpoints

| Module | Base URL | Description |
|--------|----------|-------------|
| Auth | `/api/auth/` | Login, logout, user management |
| Products | `/api/products/` | Products, variants, categories, colors, sizes |
| Inventory | `/api/inventory/` | Stock items, adjustments, valuation |
| Vendors | `/api/vendors/` | Vendor CRUD, transactions |
| Customers | `/api/customers/` | Customer CRUD, installment plans |
| Sales | `/api/sales/` | Sales, receipts, dashboard stats |
| AI | `/api/ai/` | Financial analysis, dashboard |

---

## Tech Stack Details

| Layer | Technology |
|-------|-----------|
| Backend API | Django 5 + DRF 3.15 |
| Auth | JWT (SimpleJWT) — 8h access, 7d refresh |
| Database | MySQL 8 (via mysqlclient) |
| Barcodes | python-barcode (Code128) |
| PDF Receipts | ReportLab (thermal 85mm) |
| AI | Groq (llama3-8b-8192) + rule-based fallback |
| Web Frontend | Angular 19 Standalone + Angular Material |
| State (Web) | Angular Signals |

