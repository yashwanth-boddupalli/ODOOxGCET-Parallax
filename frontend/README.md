# StockSense Frontend

User-facing inventory operations dashboard built with **React** and **Vite** for the Odoo × GCET Hyderabad Hackathon.

## Architecture

```
frontend/
├── src/
│   ├── components/
│   │   ├── common/      # Reusable UI elements (KpiCard, DataTable, StatusBadge, EmptyState, PageHeader)
│   │   └── layout/      # Shell architecture (Sidebar, TopHeader, AppLayout)
│   ├── charts/          # Custom SVG visualizations (Activity, StockMovement, Categories, FastMoving, Performance)
│   ├── pages/           # Application route pages (Dashboard, Products, Receipts, Deliveries, etc.)
│   ├── data/            # Structured mock datasets (KPIs, Charts, Operations, Products, Warehouses)
│   ├── styles/          # Vanilla CSS design system (tokens, layout, components, dashboard, charts)
│   ├── App.jsx          # Route configuration
│   └── main.jsx         # Entry point
```

## Available Scripts

- `npm run dev` — Starts local development server on `http://localhost:5173/`
- `npm run build` — Compiles production bundle
- `npm run lint` — Runs Oxlint verification
