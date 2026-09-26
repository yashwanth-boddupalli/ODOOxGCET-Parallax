# StockSense — API Contract (Supabase)

The frontend talks to Supabase directly through `supabase-js`. All calls are wrapped in
[`frontend/src/api/index.js`](../frontend/src/api/index.js), which maps database `snake_case` to the exact
camelCase field names the original mock data used, so the components didn't change how they read data.

- **Reads**: views (`from('v_…').select()`) and read functions (`rpc(...)`). Every view uses
  `security_invoker`, so the caller's Row Level Security applies.
- **Writes**: only through RPC functions. Clients have no write access to stock or document tables.
- **Auth**: Supabase Auth. Signed-out (anon) callers can read nothing.
- **Errors**: functions raise SQLSTATE `PTxyz`, which PostgREST returns as HTTP status `xyz`. The readable text is in
  `error.message`. `PT400` bad input · `PT401` not signed in · `PT403` not allowed · `PT404` not found ·
  `PT409` conflict (status transition, not enough stock, duplicate SKU).
- **Warehouse scope**: every read function takes `p_warehouse_id` (null = all), fed by the header's Active Facility selector.

Roles: **MANAGER** can do everything. **STAFF** can read everything and create, confirm, validate and cancel operations,
but can't change master data, settings or users, and can't validate stock-reducing adjustments while manager sign-off is on.

---

## Auth (Supabase Auth, called from `src/auth/AuthProvider.jsx`)

| Screen | Call |
|---|---|
| Sign up | `auth.signUp({ email, password, options: { data: { full_name } } })`. A trigger creates the profile; the first profile becomes `MANAGER`. |
| Sign in | `auth.signInWithPassword({ email, password })` |
| Forgot password | `auth.resetPasswordForEmail(email)` → `auth.verifyOtp({ email, token, type: 'recovery' })` → `auth.updateUser({ password })` |
| Reset link | Lands on `/reset-password` with a recovery session → `auth.updateUser({ password })` |
| Sign out | `auth.signOut()` |

## Tables clients may write directly

| Table | Who | What |
|---|---|---|
| `profiles` | the user themself | `full_name`, `job_title`, `default_warehouse_id` only (column grants) |
| `categories` | managers | insert, update |
| `products`, `reorder_rules`, `warehouses`, `locations`, `app_settings` | managers | update (creating products and warehouses goes through RPC) |

## Read views

| View | One row per | Fields (UI name ← column) | Used by |
|---|---|---|---|
| `v_product_rows` (= `product_rows(p_warehouse_id)`) | product | `id, name, sku, category, categoryId←category_id, stock, minStock←min_stock, reorderQty, price, unit, warehouse, warehouseId, status` (`In Stock`/`Low Stock`/`Out of Stock`), `archived` | Products, search, forms |
| `v_operation_rows` | document **line** | `id, documentId, productId, product, sku, operation` (`Receipt`/`Delivery`/`Internal Transfer`/`Adjustment`), `type, state, status` (`Pending`/`In Progress`/`Completed`/`Cancelled`), `warehouse` (`"A -> B"` for transfers), `quantity` (signed), `unit, date` (`yyyy-MM-dd HH:mm`), `dateIso, user←responsible, reference, partnerName` | Dashboard table, 4 operation pages, drawer |
| `v_operation_documents` | document | `reference, type, operation, state, status, source, destination` (labels + ids + types), `partner_name, reason, notes, scheduled_date, responsible, backorder_of, date, validated_at` | Drawer, search |
| `v_ledger_rows` | stock move (DONE only) | same shape as operation rows, plus `sourceLocation, destinationLocation`; `operation` can be `Initial Stock` | Stock Ledger |
| `v_warehouse_cards` | warehouse | `id, name, code, location←address, capacity` (`"88%"`), `capacityPercent, capacityUnits, totalItems, activeManagers` | Warehouses, header selector |
| `v_locations` | location | `id, name, code, type, warehouseId, warehouse, isDefault, label` | Operation forms, warehouse cards |
| `v_stock_levels` | product × location with stock | `productId, locationId, location, warehouseId, quantity` | "available at source" hints |
| `profiles` | user | `id, full_name, email, role, job_title, default_warehouse_id, active` | Header, sidebar, Team tab |
| `app_settings` | (single row) | `workspace_name, default_warehouse_id, reorder_multiplier, require_signoff_negative_adjustments, stock_target_units, time_zone` | Settings |

## Read functions (all return JSON in the original mock shapes)

| Function | Returns | Used by |
|---|---|---|
| `dashboard_summary(p_warehouse_id)` | `{ productsCount, pendingReceipts, pendingDeliveries, lowStockCount, alertsCount, workspaceName }` | Sidebar badges, bell |
| `dashboard_kpis(p_range, p_warehouse_id)` | 4 × `{ id, label, value, numericValue, change, isPositive, timeframe, badge, icon, color }` with ids `total-products`, `stock-available`, `pending-orders`, `low-stock`. `p_range`: `today`/`7d`/`30d`/`quarter` (or the UI labels) | KPI cards |
| `dashboard_activity(p_range, p_warehouse_id)` | `[{ day, date, inbound, outbound, total }]` for 7 or 30 days | Inventory Activity |
| `dashboard_stock_movement(p_range, p_warehouse_id)` | `[{ time, stock, capacity, optimal }]`, 2-hourly for today or daily; values in units | Stock Movement |
| `dashboard_categories(p_warehouse_id)` | `[{ name, percentage, count, color }]` (units on hand) | Top Categories |
| `dashboard_fast_moving(p_days, p_limit, p_warehouse_id)` | `[{ id, name, sku, velocity: "53%", unitsMoved, stockLevel, trend: "+6.3%" }]` | Fast Moving Products |
| `dashboard_performance(p_months, p_warehouse_id)` | `[{ month, turnover, fulfillment, accuracy, volume }]` (null when there's no data) | Performance chart |
| `analytics_kpis(p_warehouse_id)` | `{ inventoryValuation, totalUnits, unitsShipped30d, averageDaysOnHand, gmroi: null, deadStockValue, deadStockPercent }` | Analytics |
| `low_stock_rows(p_warehouse_id)` | rows `{ id, name, sku, category, stock, min_stock, recommended_qty, unit, warehouse, status, days_of_cover }` | Low Stock, bell |
| `low_stock_summary(p_warehouse_id)` | `{ totalCount, lowStockCount, outOfStockCount, criticalCount, projectedStockouts72h }` | Low Stock banner |

Metric definitions: `supabase/migrations/20260926000005_insights.sql` (each function has a comment).

## Write functions (RPC)

| Function | Who | What |
|---|---|---|
| `create_product(p_name, p_sku?, p_category? \| p_category_id?, p_initial_stock?, p_warehouse? \| p_warehouse_id?, p_price?, p_min_stock?, p_unit?, p_reorder_qty?)` → id | manager | Blank SKU → generated (`ELE-000042`). Duplicate SKU (any case) → `PT409`. Opening stock → `INITIAL` ledger move. |
| `update_product(p_id, p_payload)` | manager | payload keys: `name, sku, categoryId, price, minStock, reorderQty, unit, warehouseId` |
| `set_product_archived(p_id, p_archived)` | manager | archive instead of delete |
| `create_warehouse(p_name, p_code, p_address?, p_capacity_units?)` → id | manager | also creates its default "Stock" location |
| `create_location(p_warehouse_id, p_name, p_code?)` → id | manager | racks, bays, bins |
| `create_operation(p_type, p_payload)` → id | any | `p_type`: `RECEIPT`/`DELIVERY`/`TRANSFER`/`ADJUSTMENT`. Payload: `lines: [{ productId, quantity }]` (adjustments use `countedQuantity`), plus `warehouseId`/`locationId` (transfers: `sourceLocationId`/`sourceWarehouseId` and `destinationLocationId`/`destinationWarehouseId`), `partnerName, scheduledDate, reason, notes, responsibleId` |
| `update_operation(p_id, p_payload)` | any | only before `DONE`/`CANCELLED` |
| `confirm_operation(p_id)` → state | any | `DRAFT` → `READY` or `WAITING` |
| `check_availability(p_id)` → state | any | re-checks `WAITING`/`READY` |
| `validate_operation(p_id, p_lines?, p_create_backorder = true)` → `{ id, state, backorderId, backorderReference }` | any¹ | **The stock engine.** `p_lines: [{ lineId, doneQuantity }]` for partial validation. |
| `cancel_operation(p_id)` → state | any | anything except `DONE` |
| `reorder_product(p_product_id, p_quantity?)` → id | any | drafts a receipt for the recommended quantity |
| `reorder_low_stock(p_warehouse_id?)` → `[{ id, reference }]` | any | one draft receipt per warehouse; skips products already on an open receipt |
| `update_settings(p_payload)` | manager | `workspaceName, timeZone, reorderMultiplier (2/3/5), requireManagerSignoffOnNegativeAdjustments, stockTargetUnits, defaultWarehouseId` |
| `set_user_access(p_user_id, p_role?, p_active?)` | manager | the last active manager can't be removed |

¹ Staff validating an adjustment that reduces stock get `PT403` while *Require manager sign-off* is on.
