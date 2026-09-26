# StockSense — Backend Design (Supabase)

> The Phase 0 draft planned a Spring Boot + MySQL server. The team chose **Supabase** instead (it was already
> the plan in `docs/PROJECT_PLAN.md` and `.env.example`), so that design was replaced by this one.

## Architecture

```
Browser (React + Vite, hosted on Vercel)
   │  supabase-js (publishable key + user's JWT)
   ▼
Supabase
   ├── Auth ............ sign-up / sign-in / password reset (email code or link)
   ├── PostgREST ....... exposes views + RPC functions, enforces RLS per request
   └── Postgres
         ├── tables ....... master data, stock_quants, operations, stock_moves (ledger)
         ├── RLS .......... read: active users · write master data: managers · stock: functions only
         ├── views ........ rows shaped like the frontend's original mock data
         └── functions .... stock engine + dashboard/analytics/low-stock queries
```

No server to deploy or keep running: the database *is* the backend. Business rules live next to the data, so
they apply however the data is reached.

## Data model

| Table | Purpose |
|---|---|
| `profiles` | one per auth user: name, role (`MANAGER`/`STAFF`), job title, home warehouse, active |
| `warehouses` | name, code, address, capacity (for the utilisation bar) |
| `locations` | `INTERNAL` places inside a warehouse (each has one default "Stock"), plus the virtual `VENDOR`, `CUSTOMER` and `INVENTORY_LOSS` locations |
| `categories` | name and chart colour |
| `products` | name, SKU (unique ignoring case), category, unit, price, primary warehouse, archived |
| `reorder_rules` | min quantity (low-stock threshold), optional fixed reorder quantity |
| `stock_quants` | quantity per product per internal location, `CHECK (quantity >= 0)`; written only by the engine |
| `operations` + `operation_lines` | receipts / deliveries / transfers / adjustments and their products |
| `stock_moves` | **append-only ledger**: every change as from → to, who, when, reference |
| `reference_sequences` | gap-free `PO-2026-0001` style numbering |
| `app_settings` | workspace name, default warehouse, reorder multiplier, sign-off rule, target buffer, time zone |

Quantities are `numeric(15,3)` (kg and litres work); money is `numeric(15,2)`.

## Decisions (made with the go-ahead to use judgement)

| Topic | Decision | Why |
|---|---|---|
| Backend | Supabase: Postgres + Auth + RPC | The team's own plan; no server to host |
| Stock integrity | Every change goes through one `SECURITY DEFINER` function per action, which locks quants in a fixed order, then writes the ledger and quants together | All-or-nothing, and no deadlocks between concurrent validations |
| Statuses | 5 internal states; the UI's 4 labels come from a mapping (`DRAFT`/`WAITING` → Pending, `READY` → In Progress, `DONE` → Completed, `CANCELLED` → Cancelled) | Keeps the UI's badges and adds "waiting for stock" |
| Row shape | Views return one row per document line, in the mock field names | The existing table components work unchanged |
| Dates | `date` in the mock's `yyyy-MM-dd HH:mm` (app time zone) plus `date_iso` | Display as before; machines get ISO |
| Quantity sign | `+` into stock, `−` out (the mock showed deliveries as positive) | The table already colours negatives red |
| Opening stock | Recorded as an `INITIAL` ledger move, not a column | The ledger stays the single source of truth |
| Products | Archived, never deleted; a blank SKU is generated | History stays intact; the Add Product modal didn't require a SKU |
| Roles | First sign-up = manager; staff can operate but not edit master data | From the product brief |
| Negative adjustments | Staff need manager sign-off (Settings switch, on by default) | The Settings page already had this checkbox |
| Pagination | Tables fetch up to 1,000 rows and page on the client (10 per page) | The UI already paginated client-side; enough for this scale |
| Real-time / WebSocket | Not added | The UI has no live channel; "Sync Data" reloads everything |
| GMROI | Shown as n/a | There's no cost price to compute it honestly |
| Supabase keys | URL + publishable key committed in `frontend/src/lib/supabase.js` | Requested; publishable keys are public by design and RLS protects the data |

## Files

```
supabase/migrations/20260926000001_schema.sql              tables, constraints, triggers, profile trigger
supabase/migrations/20260926000002_security.sql            RLS policies and grants
supabase/migrations/20260926000003_views.sql               read views in the UI's shapes
supabase/migrations/20260926000004_stock_engine.sql        stock engine + write RPCs
supabase/migrations/20260926000005_insights.sql            dashboard, analytics, low stock, reorder
supabase/migrations/20260926000006_reference_data_and_grants.sql
supabase/seed.sql, supabase/setup.sql (generated), supabase/tests/*

frontend/src/lib/supabase.js      client
frontend/src/api/index.js         every query, mapped to the UI field names
frontend/src/auth/*               AuthProvider, guards, auth layout
frontend/src/pages/auth/*         Login, Sign up, Forgot password (code), Reset password (link)
frontend/src/app/useWorkspace.js  active warehouse, refresh signal, toasts, modals; useAsync
frontend/src/components/forms/*   Add/Edit Product, New Operation, Operation drawer, Warehouse/Location
vercel.json                       build from /frontend, SPA rewrites
```

## Verification

- `supabase/tests`: **33 tests pass**, covering sign-up roles, anonymous lockout, staff limits, direct-write denial, all
  four operations, the steel story ledger, WAITING vs READY, full rollback on insufficient stock, backorders,
  invalid transitions, input validation, sign-off, the append-only ledger, the non-negative check, quant = ledger
  consistency, seed totals, dashboard shapes, bulk reorder, and profile backfill, and a project without automatic table grants.
- The frontend builds (`vite build`) and passes `oxlint` with no warnings.
- Not covered by automated tests: truly concurrent validations (PGlite has one connection), and an end-to-end
  browser run against the hosted project (the schema has to be applied there first).
