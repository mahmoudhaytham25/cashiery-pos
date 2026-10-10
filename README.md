# Cashiery — POS & Inventory Management System

[![CI](https://github.com/mahmoudhaytham25/cashiery-pos/actions/workflows/ci.yml/badge.svg)](https://github.com/mahmoudhaytham25/cashiery-pos/actions/workflows/ci.yml)

A full-stack point-of-sale and inventory management web application with dual roles: a cashier interface for day-to-day sales and a manager dashboard for inventory control and reporting.

## Features

**Cashier interface**
- Barcode/SKU product search and cart management
- Checkout flow with transaction logging

**Manager dashboard**
- Product & inventory management (CRUD, stock levels)
- Low-stock alerts
- Sales summaries and full transaction log
- Cashier user registration

**Platform**
- JWT authentication with role-based access (`cashier` / `admin`)
- Passwords hashed with bcrypt
- REST API backed by PostgreSQL

## Architecture

```
React Frontend (port 3000)  →  Express REST API (port 5000)  →  PostgreSQL
                                    ├─ /api/auth          — login, registration
                                    ├─ /api/products      — product & stock CRUD
                                    └─ /api/transactions  — checkout & sales history
```

## Stack

React · Node.js (Express) · PostgreSQL · JWT · bcrypt

## Getting Started

### Run with Docker (quickest start)

```bash
docker compose up --build
```

- Frontend: http://localhost:3000 · Backend API: http://localhost:5001 (host port is 5001 because macOS AirPlay Receiver occupies :5000; override with `BACKEND_PORT`)
- PostgreSQL seeds itself from `backend/database/schema.sql` automatically — but only on first boot of a fresh data volume. To re-seed: `docker compose down -v && docker compose up --build`.
- First run: register via the app's sign-up form (or `POST /api/auth/register`). The very first account is created as `admin` automatically — registration is admin-gated afterwards.
- `JWT_SECRET` is required by the backend and falls back to a dev-only value in `docker-compose.yml`. For anything real, set it via `JWT_SECRET=your-secret docker compose up` or a `.env` file at the repo root.
- DB credentials default to dev values; override with `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`.

### Prerequisites (local dev)
- Node.js 16+
- PostgreSQL

### Backend
```bash
cd backend
npm install
cp .env.example .env   # fill in your DB credentials and JWT secret
psql -d your_db -f database/schema.sql
npm start              # http://localhost:5000
```

### Frontend
```bash
cd frontend
npm install
npm start              # http://localhost:3000
```

## License

See [LICENSE](LICENSE).
