# StockSense Frontend

User-facing inventory operations dashboard built with **React** and **Vite** for the Odoo × GCET Hyderabad Hackathon.
Data, sign-in and all stock logic come from **Supabase** (see [`../supabase`](../supabase/README.md)).

## Architecture

```
frontend/
├── src/
│   ├── api/             # Every Supabase query, mapped to the fields the UI uses
│   ├── app/             # Workspace context (active warehouse, refresh, toasts, modals) + useAsync
│   ├── auth/            # AuthProvider, route guards, sign-in page layout
│   ├── components/
│   │   ├── common/      # KpiCard, DataTable, StatusBadge, EmptyState, PageHeader, Modal, form controls
│   │   ├── forms/       # Add/Edit Product, New Operation, Operation details drawer, Warehouse/Location
│   │   └── layout/      # Shell (Sidebar, TopHeader, AppLayout)
│   ├── charts/          # Custom SVG visualizations fed by dashboard functions
│   ├── lib/             # Supabase client, formatting, CSV export
│   ├── pages/           # Route pages (Dashboard, Products, Receipts, …) and pages/auth (Login, Sign up, Reset)
│   ├── styles/          # Vanilla CSS design system (tokens, layout, components, charts, forms, auth, app)
│   ├── App.jsx          # Route configuration
│   └── main.jsx         # Entry point
```

## Available Scripts

- `npm run dev` — Starts local development server on `http://localhost:5173/`
- `npm run build` — Compiles production bundle
- `npm run lint` — Runs Oxlint verification

## Configuration

The Supabase URL and publishable key are set in `src/lib/supabase.js`. To use a different project, override them
with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `frontend/.env` (see `.env.example`).
