# Cashiery — POS & Inventory Management System

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

### Prerequisites
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

See [LICENSE.txt](LICENSE.txt).
