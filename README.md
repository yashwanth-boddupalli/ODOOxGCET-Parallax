# StockSense

**StockSense** is an intelligent inventory management system built for the **Odoo × GCET Hyderabad Hackathon**. It provides real-time visibility into stock levels, streamlines warehouse operations, and surfaces actionable insights — all through a clean, modern interface.

---

## Project Structure

```
StockSense/
├── frontend/    → User-facing application (React + Vite)
├── backend/     → Server-side logic and API layer
├── database/    → Schema definitions and migration scripts
├── docs/        → Project documentation and workflow guides
├── .gitignore
├── .env.example → Environment variable template (no secrets)
└── README.md
```

| Directory    | Purpose                                                |
| ------------ | ------------------------------------------------------ |
| `frontend/`  | UI components, pages, routing, and client-side state   |
| `backend/`   | API endpoints, business logic, and server utilities    |
| `database/`  | Table schemas, seed data, and migration files          |
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

> **Phase 1 — Repository Setup** ✅  
> The project is currently in the initial setup phase. Features and modules will be developed incrementally across subsequent phases. See [`docs/PROJECT_PLAN.md`](docs/PROJECT_PLAN.md) for the full roadmap.

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

## License

This project was created for the Odoo × GCET Hyderabad Hackathon.
