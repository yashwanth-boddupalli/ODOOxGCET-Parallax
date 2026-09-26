# StockSense — Gaps & Risks (status after the Supabase integration)

Phase 0 found 38 gaps between the original mock-only frontend (commit `4eb5545`) and a real backend.
Once Supabase was chosen and the frontend was wired to it, most were fixed. This file tracks what changed and what is still open.

## Still open

| ID | Area | Issue | Suggested next step |
|---|---|---|---|
| O-1 | Deployment | The schema isn't applied to the hosted Supabase project yet. Until it is, the app shows a "database isn't set up" banner. | Run `supabase/setup.sql` in the SQL editor (see `supabase/README.md`). |
| O-2 | Auth emails | Reset emails only show a typeable code if the *Reset Password* template contains `{{ .Token }}`. Links also need the Vercel URL in *URL Configuration*. | Two dashboard settings (see `supabase/README.md` §1). |
| O-3 | Scale | Tables fetch up to 1,000 rows and paginate on the client. | Move search, filters and paging into the query (`range()` + `count`) once history grows. |
| O-4 | Analytics | GMROI needs a cost price, which isn't stored, so it shows "n/a". | Add `cost_price` to products if margin reporting matters. |
| O-5 | Concurrency testing | Row locking is designed in but can't be exercised in PGlite. | A two-connection test against a real Postgres (Supabase branch or local CLI). |
| O-6 | Currency | Money shows as `$` everywhere, while the facilities are in Hyderabad. | Add a currency setting if needed. |
| O-7 | Bundle size | One 600 kB JS chunk (mostly supabase-js + React). | Lazy-load routes with `React.lazy` if first load feels slow. |
| O-8 | Git workflow doc | `docs/GIT_WORKFLOW.md` describes `feature/*` → `main`; the team pushes to `develop`. | Update the doc to match. |

## Resolved

| Phase 0 ID | Was | Now |
|---|---|---|
| G-01 | Supabase (repo plan) vs Spring Boot (spec) | Supabase chosen; the backend lives in `supabase/` |
| G-02 | No API client or base URL | `src/lib/supabase.js` + `src/api/index.js` |
| G-03 | No auth screens; user hard-coded | Login, Sign up, Forgot password (code), Reset password (link); route guard; real name and role in the header and sidebar; sign-out menu |
| G-07 | 4 UI statuses vs 5 engine states | `status_label()` mapping; rows carry both `status` and `state` |
| G-08 | No CSS for In Stock / Low Stock; no Out of Stock | Added in `styles/app.css`; the database returns `Out of Stock` |
| G-09 | Deliveries shown as positive | Quantities are signed (`−` out of stock) |
| G-10 | "Internal Transfer" badge unstyled | `.operation-badge.internal-transfer` added |
| G-11 | Non-ISO dates | `date` keeps the display format; `date_iso` added |
| G-12, G-13 | Chart axes hard-coded (and negative SVG heights) | Every chart scales from its data and has an empty state |
| G-14 | Inconsistent warehouse names | Names come from the database |
| G-15, G-16 | Category and warehouse lists hard-coded | Loaded from `categories` / `v_warehouse_cards` |
| G-17, G-18 | Low-stock magic number `35` and a fixed `×3` | `low_stock_rows()` uses reorder rules and the Settings multiplier |
| G-19 – G-21 | SKU optional; string stock; no price, min or unit fields | SKU is generated when blank; numbers validated; price, min stock and unit added to the modal |
| G-22, G-23 | Settings select started on the wrong option; all tabs showed the same form | Controlled form per tab, saved with `update_settings`; Team & Access and My Profile tabs added |
| G-24 | Create / Validate buttons did nothing | New Operation modal (all 4 types, multi-line) and a document drawer with Mark Ready / Check Availability / Validate (partial + backorder) / Cancel |
| G-25 | Warehouse selector not shared | Workspace context; every page and dashboard call is scoped |
| G-26 | Date range, 7d/30d toggle and Sync did nothing | Wired to the dashboard functions; Sync reloads everything |
| G-27 | Client-side paging rendered every page number | Compact page range, 10 per page (see O-3) |
| G-28 | Ledger showed pending and cancelled operations | `v_ledger_rows` = completed moves only |
| G-29 – G-32 | Search, bell, exports and reorder buttons not wired | Global search (Ctrl K), low-stock bell, CSV export on every list, reorder and bulk reorder |
| G-33 | Hard-coded numbers in the sidebar, charts and banners | All computed live |
| G-34 | No error UI | Readable messages in forms and toasts; the database returns human messages |
| G-35 – G-38 | Model limits (GMROI, capacity, staff count, one product per row) | Capacity and home-warehouse fields added; multi-line documents; GMROI → O-4 |
