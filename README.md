# StockSense

**StockSense** is an intelligent inventory management system built for the **Odoo × GCET Hyderabad Hackathon**. It provides real-time visibility into stock levels, streamlines warehouse operations, and surfaces actionable insights — all through a clean, modern interface.

---

## Project Structure

```
StockSense/
├── frontend/    → User-facing application (React + Vite)
├── supabase/    → Backend: Postgres schema, security, stock engine, seed, tests
├── backend/     → Pointer to supabase/ (there is no separate server)
├── database/    → Pointer to supabase/
├── docs/        → Project documentation and workflow guides
├── vercel.json  → Vercel build + single-page-app routing
├── .gitignore
├── .env.example → Environment variable template (no secrets)
└── README.md
```

| Directory    | Purpose                                                |
| ------------ | ------------------------------------------------------ |
| `frontend/`  | UI components, pages, routing, and client-side state   |
| `supabase/`  | Tables, Row Level Security, stock engine functions, dashboard queries, seed data, tests |
| `docs/`      | Git workflow guide, project plan, and design documents |

---

## Core Features

| Module                   | Description                                          |
| ------------------------ | ---------------------------------------------------- |
| **Dashboard**            | At-a-glance overview of inventory health and KPIs    |
| **Products**             | Product catalog with categories and attributes       |
| **Receipts**             | Inbound stock receiving and purchase order tracking  |
| **Delivery Orders**      | Outbound shipment management and dispatch tracking   |
| **Internal Transfers**   | Stock movement between warehouses and locations      |
| **Inventory Adjustments**| Manual corrections, write-offs, and cycle counts     |
| **Stock Ledger**         | Complete, auditable history of every stock movement  |
| **Warehouses**           | Multi-warehouse configuration and location hierarchy |
| **Low Stock Alerts**     | Configurable thresholds and automated notifications  |
| **Search & Filters**     | Global search with advanced filtering and sorting    |

---

## Development Status

> **Frontend + Supabase backend** ✅  
> Every page reads live data from Supabase. Sign-in, operations (receipts, deliveries, transfers, adjustments), the
> stock ledger, low-stock reordering, analytics and settings are all connected. See
> [`supabase/README.md`](supabase/README.md) for how the database works and [`docs/`](docs/) for the design notes.

---

## Team Development

This project follows a **feature-branch workflow**:

1. Developers create feature branches from `main` (e.g., `feature/frontend-dashboard`).
2. Work is committed in focused, descriptive commits.
3. Completed features are merged into `main` via **Pull Requests**.
4. `main` should always remain stable and deployable.

For detailed branching rules and example commands, see [`docs/GIT_WORKFLOW.md`](docs/GIT_WORKFLOW.md).

---

## Getting Started

```bash
# 1. Clone the repository
git clone https://github.com/yashwanth-boddupalli/ODOOxGCET-Parallax.git
cd ODOOxGCET-Parallax

# 2. Create your environment file
cp .env.example .env
# Fill in the required values in .env

# 3. Start developing on a feature branch
git checkout -b feature/your-feature-name
```

---

## Running StockSense

### 1. Database (once per Supabase project)

Open the Supabase dashboard → **SQL Editor**, paste [`supabase/setup.sql`](supabase/setup.sql) and run it. Then set
the Auth URL configuration and the reset-email template as described in
[`supabase/README.md`](supabase/README.md#1-set-up-a-new-supabase-project-about-5-minutes).

### 2. Frontend (local)

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

The app already points at the StockSense Supabase project (`jfbrettpstcrbdjvcpkb`). To use another one, copy `frontend/.env.example` to
`frontend/.env` and fill in that project's URL and **publishable** key.

The **first person to sign up becomes the manager**. Later sign-ups join as staff; a manager can change roles in
*Settings → Team & Access*.

### 3. Deploy (Vercel)

Import the repository in Vercel. Either Root Directory setting works: with the repo root, `vercel.json` builds
`frontend/`; with `frontend`, `frontend/vercel.json` applies. Both send every path to `index.html`, so links like
`/reset-password` work. No environment variables are needed. Add the deployed URL in Supabase → Authentication →
URL Configuration. Vercel deploys production from the production branch (usually `main`), so merge `develop` to
release.

### Tests

```bash
cd supabase/tests && npm install && npm test    # database: 33 tests
cd frontend && npm run lint && npm run build    # frontend: lint + production build
```

---

## License

This project was created for the Odoo × GCET Hyderabad Hackathon.
