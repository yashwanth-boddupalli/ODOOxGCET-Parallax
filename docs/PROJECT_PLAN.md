# Project Plan — StockSense

This document outlines the planned development phases for the StockSense inventory management system. Each phase builds on the previous one and will be completed incrementally.

---

## Development Phases

| Phase | Name                            | Description                                                          | Status      |
| ----- | ------------------------------- | -------------------------------------------------------------------- | ----------- |
| 1     | **Repository Setup**            | Project structure, Git workflow, documentation, `.gitignore`         | ✅ Complete |
| 2     | **Frontend Foundation**         | Initialize React + Vite, routing, layout shell, design system        | ⬜ Planned  |
| 3     | **Dashboard**                   | Overview page with KPIs, charts, and inventory health summary        | ⬜ Planned  |
| 4     | **Product Management**          | Product catalog — CRUD, categories, attributes, search               | ⬜ Planned  |
| 5     | **Receipts**                    | Inbound stock receiving and purchase order tracking                   | ⬜ Planned  |
| 6     | **Delivery Orders**             | Outbound shipment management and dispatch tracking                   | ⬜ Planned  |
| 7     | **Internal Transfers**          | Stock movement between warehouses and locations                      | ⬜ Planned  |
| 8     | **Inventory Adjustments**       | Manual corrections, write-offs, and cycle counts                     | ⬜ Planned  |
| 9     | **Stock Ledger**                | Complete, auditable history of every stock movement                  | ⬜ Planned  |
| 10    | **Warehouses & Alerts**         | Multi-warehouse config and low-stock alert system                    | ⬜ Planned  |
| 11    | **Backend / Database Integration** | API layer, Supabase integration, authentication, data persistence | ⬜ Planned  |
| 12    | **Testing & Final Demo**        | End-to-end testing, polish, performance tuning, demo preparation     | ⬜ Planned  |

---

## Phase Details

### Phase 1 — Repository Setup ✅

- Initialize Git repository and connect to GitHub
- Create project directory structure (`frontend/`, `backend/`, `database/`, `docs/`)
- Write `.gitignore`, `.env.example`, and `README.md`
- Document Git workflow and project plan
- Create initial commit

### Phase 2 — Frontend Foundation

- Set up React with Vite
- Configure routing (React Router)
- Build layout shell (sidebar, header, content area)
- Establish design tokens and base styles

### Phase 3 — Dashboard

- Design and implement the main dashboard page
- Display key inventory metrics and KPIs
- Add placeholder charts and summary cards

### Phase 4 — Product Management

- Product listing with search and filters
- Product detail view
- Add / edit / delete product forms

### Phase 5 — Receipts

- Receipts listing page
- Create and manage inbound receipts
- Update stock on receipt confirmation

### Phase 6 — Delivery Orders

- Delivery orders listing page
- Create and manage outbound deliveries
- Reduce stock on delivery confirmation

### Phase 7 — Internal Transfers

- Transfer listing page
- Create transfers between warehouses / locations
- Adjust stock across locations on confirmation

### Phase 8 — Inventory Adjustments

- Adjustment listing page
- Manual stock corrections and write-offs
- Audit trail for adjustments

### Phase 9 — Stock Ledger

- Full transaction history per product
- Filterable, sortable ledger view
- Export capabilities

### Phase 10 — Warehouses & Alerts

- Warehouse and location management
- Configurable low-stock thresholds
- Alert notifications for low inventory

### Phase 11 — Backend / Database Integration

- Set up Supabase project and tables
- Build API layer and data-access functions
- Connect frontend to live data
- Implement authentication

### Phase 12 — Testing & Final Demo

- End-to-end manual and automated testing
- Performance optimization
- UI polish and responsiveness
- Final demo preparation

---

> This plan is a living document and may be adjusted as the project evolves.
