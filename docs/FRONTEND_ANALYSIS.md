# StockSense — Frontend Analysis (Phase 0)

> Scope: the original frontend as committed in `4eb5545` (2026-09-26), before it was connected to Supabase.
> This is a historical snapshot. For how the app works now, see `BACKEND_PLAN.md`, `API_CONTRACT.md` and `CONTRACT_GAPS.md`.
> Legend: **[SEEN]** = read directly in code · **[INFERRED]** = my interpretation, needs confirmation.

---

## 1. Git history

```
*   14f6e59 Merge pull request #2 from yashwanth-boddupalli/develop      (main)
|\
| * 4eb5545 feat: build StockSense frontend dashboard                     (develop)
* | 22fecff Merge pull request #1 from yashwanth-boddupalli/develop
|\|
| *   4512c8f merge: reconcile StockSense project structure with GitHub repository
| |\
| |/
|/|
* | f618ab2 Initial commit                     (GitHub-generated, 1-line README)
 /
* 5321d7f chore: initialize StockSense project structure
```

| Commit | Author | What it did |
|---|---|---|
| `5321d7f` | bandarupallymanideep-oss | Created the skeleton: root `README.md`, `.env.example`, `.gitignore`, placeholder READMEs in `backend/`, `database/`, `frontend/`, plus `docs/GIT_WORKFLOW.md` and `docs/PROJECT_PLAN.md`. |
| `f618ab2` | yashwanth-boddupalli | GitHub "Initial commit" (one-line README). |
| `4512c8f` | bandarupallymanideep-oss | Merge that reconciled the two root histories. |
| `4eb5545` | bandarupallymanideep-oss | **The entire frontend** in one commit: 47 files, about 5,900 lines. |
| `22fecff`, `14f6e59` | yashwanth-boddupalli | PR merges of `develop` into `main`. |

**Findings**
- [SEEN] `main` and `develop` currently point at identical trees (`git diff develop main` is empty).
- [SEEN] The frontend arrived as a single commit, so there is no history showing features growing, abandoned or half-built. "Finished vs in progress" can only be read from the code itself (see §4).
- [SEEN] There is no backend code, database schema, API client, `.env` file, mockup, or design note beyond the two docs.
- [SEEN] `backend/README.md` and `database/README.md` say "Development begins in **Phase 11**".
- [SEEN] `docs/PROJECT_PLAN.md` Phase 11 reads "API layer, **Supabase** integration, authentication". `.env.example` has only `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_APP_NAME`, `VITE_APP_ENV`. **This conflicts with the fixed Spring Boot + MySQL stack in `BACKEND_SPEC.md`** (see CONTRACT_GAPS G-01).
- [SEEN] `docs/GIT_WORKFLOW.md`: feature branches off `main`, merged through PRs; commit prefixes `feat:`, `fix:`, `docs:`, `chore:`. In practice the team has been pushing to `develop` and PR-ing `develop → main`.
- [SEEN] No TODO or FIXME comments anywhere. The only "not real yet" markers are UI strings: "Add New Product (Mock)", "Save Product (Local Mock)", "Preferences saved (Mock)".

---

## 2. Project setup

### 2.1 `frontend/package.json` [SEEN]

| Dependency | Version | What it implies for the backend |
|---|---|---|
| `react`, `react-dom` | ^19.2.8 | – |
| `react-router-dom` | ^7.18.4 | Client-side routes under `/`; nothing backend-related. |
| `lucide-react` | ^1.48.0 | Icons. KPI objects carry an `icon` **name string** (e.g. `"Package"`) that `KpiCard` maps to an icon component. |
| `vite` / `@vitejs/plugin-react` | ^8.3.0 / ^6.1.1 | Dev server on the default port **5173** (per frontend README). |
| `oxlint` | ^1.81.0 | Linter only. |

**Not present:** no HTTP client (axios), data-fetching library (react-query/SWR), state manager, form or validation library, date library, chart library (all charts are hand-drawn SVG), socket client, or MSW.
→ The backend is free to choose the transport details. The frontend will need `fetch` calls added (see CONTRACT_GAPS).

### 2.2 Vite config [SEEN]
`vite.config.js` contains only `plugins: [react()]`: **no proxy, no `server.port`, no aliases, and no `import.meta.env` usage anywhere in `src/`**. The backend must therefore allow CORS from `http://localhost:5173`, or the frontend must later add a proxy or `VITE_API_URL`.

### 2.3 Folder structure [SEEN]
```
frontend/src/
  App.jsx            routes
  main.jsx           entry
  components/common  DataTable, EmptyState, KpiCard, PageHeader, StatusBadge(+OperationBadge)
  components/layout  AppLayout (includes the Add Product modal), Sidebar, TopHeader
  charts/            5 SVG chart components, each importing its own mock array
  pages/             11 pages
  data/              4 mock files (the only data source in the app)
  styles/            5 plain CSS files
```
Naming: PascalCase components as named exports, `mockXxx` camelCase arrays, kebab-case routes.

---

## 3. How the frontend talks to a backend

### 3.1 API layer — **none exists** [SEEN]
A full-text search of `src/` for `fetch(`, `axios`, `localStorage`, `sessionStorage`, `import.meta.env`, `VITE_`, `token`, `login`, `logout`, `supabase`, `WebSocket` and `http(s)://` found **zero matches** in JS/JSX. The only hits were inside the bundled `react.svg` / `vite.svg` files.

All data comes from static imports:

| Mock source | Exported names | Imported by |
|---|---|---|
| `data/mockKpis.js` | `mockKpis` | DashboardPage |
| `data/mockOperations.js` | `mockOperations` | DashboardPage, ReceiptsPage, DeliveryOrdersPage, InternalTransfersPage, InventoryAdjustmentsPage, StockLedgerPage |
| `data/mockProducts.js` | `mockProducts`, `mockWarehouses` | ProductsPage, LowStockPage, WarehousesPage, TopHeader |
| `data/mockCharts.js` | `mockActivityData`, `mockStockMovement`, `mockCategoryData`, `mockFastMovingProducts`, `mockPerformanceData` | the 5 chart components |

Beyond these files, there is a lot of **hard-coded data inside JSX**: sidebar badges, the user name, analytics KPIs, chart summary strips, the low-stock banner text, category pill lists, and warehouse dropdown options. The per-page tables in §4 list each one.

### 3.2 Auth [SEEN]
- There are no login, signup, OTP, profile or logout screens and no route guards.
- The user is hard-coded: "Yashwanth B", initials "YB", role label "Operations Lead" (`Sidebar.jsx:113-118`, `TopHeader.jsx:130-133`).
- [INFERRED] Auth has to be designed from the spec appendix, because the frontend offers nothing to match.

### 3.3 Errors [SEEN]
The code never displays or parses a server error. The only feedback UI is a success toast in `AppLayout` (`toastMessage` string). → The appendix error shape `{ status, error, message, fieldErrors }` is free to adopt.

### 3.4 Pagination, search, filters [SEEN]
All of this happens **on the client** over the full array:
- `DataTable`: page size **5**, a free-text search over `product`, `sku`, `warehouse`, `user` and `reference` (case-insensitive `includes`), and operation-type tabs `All | Receipt | Delivery | Internal Transfer | Adjustment`.
- `ProductsPage`: search over `name` and `sku`, plus category pills.
- [INFERRED] Server-side equivalents: `q`, `type`, `category`, `page`, `size`.

### 3.5 Null-safety constraints the backend must respect [SEEN]
These expressions **crash on `null`/`undefined`**, so the backend must always send these fields with the right type:

| Code | Field | Must be |
|---|---|---|
| `DataTable.jsx:22-26` `.toLowerCase()` | `product`, `sku`, `warehouse`, `user`, `reference` | non-null string (use `""` if unknown) |
| `DataTable.jsx:128-130` | `quantity` | number |
| `ProductsPage.jsx:17` `.toLowerCase()` | `name`, `sku` | non-null string |
| `ProductsPage.jsx:91` `price.toFixed(2)` | `price` | **number** (not a string) |
| `WarehousesPage.jsx:49,71` `parseInt(wh.capacity)` and `width: wh.capacity` | `capacity` | **string ending in `%`**, e.g. `"88%"` |
| `WarehousesPage.jsx:89` `.toLocaleString()` | `totalItems` | number |
| `TopCategoriesChart.jsx:75` `.toLocaleString()` | `count` | number |
| `TopHeader.jsx:14` `mockWarehouses[0].name` | warehouses list | **non-empty** array |

---

## 4. Screens

Routes (`App.jsx`): `/` redirects to `/dashboard`, and any unknown path also goes to `/dashboard`. Every route renders inside `AppLayout` (sidebar, top header, Add Product modal, toast).

### 4.1 Page-by-page table

| Route / page | Purpose | Data shown (source) | Forms / fields | Buttons / actions | Filters | States | Status |
|---|---|---|---|---|---|---|---|
| **Layout: Sidebar** | Navigation | Nav badges hard-coded: Products `14.8k`, Receipts `6`, Delivery Orders `38`, Low Stock `17`; user `Yashwanth B / Operations Lead` | – | Collapse toggle | – | – | UI done, data hard-coded |
| **Layout: TopHeader** | Global bar | Warehouse selector from `mockWarehouses` (name + location); bell badge `4`; user pill | Global search input (not wired, `Ctrl K` hint) | Warehouse select (local state only), Add Product, Bell, Help, User | Active facility | – | Selector not wired to data |
| **Layout: Add Product modal** | Create product | – | `name` (required), `sku` (optional!), `category` select [Electronics, Apparel, Industrial, Accessories], `initialStock` number (default `"50"`), `warehouse` select [Main Central Hub, North Logistics Depot, South Fulfillment Center, West Coast Facility] | Cancel, "Save Product (Local Mock)" shows a toast only | – | – | **Mock** |
| `/dashboard` | Overview | KPI cards (`mockKpis`), 5 charts, operations table (`mockOperations`) | – | Date range [Today, Last 7 Days, Last 30 Days, This Quarter] (state only), "Sync Data" (spinner only), Export (no handler), Add Product | Date range (unused) | – | Presentational |
| `/products` | Catalog | `mockProducts`: name, sku, category, stock, minStock, price, warehouse, status | Search | Export CSV (no handler), Add Product | Category pills [All, Electronics, Accessories, Industrial, Apparel] | none | Read-only list |
| `/receipts` | Inbound | `mockOperations` where `operation === 'Receipt'` | – | Export Receipts, Create Receipt (**no handler, no form**) | DataTable tabs + search | EmptyState | List only |
| `/delivery-orders` | Outbound | `operation === 'Delivery'` | – | Export Deliveries, New Delivery Order (**no form**) | same | same | List only |
| `/internal-transfers` | Moves between facilities | `operation === 'Internal Transfer'` | – | Transfer Stock (**no form**) | same | same | List only |
| `/inventory-adjustments` | Counts and write-offs | `operation === 'Adjustment'` | – | New Adjustment (**no form**) | same | same | List only |
| `/stock-ledger` | Audit trail | **all** `mockOperations` (including Pending and Cancelled rows) | – | Filter Range, Download Ledger (no handlers) | same | same | List only |
| `/warehouses` | Facilities | `mockWarehouses` cards: name, code, location, capacity %, totalItems, activeManagers ("staff") | – | Add Warehouse (**no form**) | – | – | Read-only |
| `/low-stock` | Replenishment | `mockProducts` filtered by `status === 'Low Stock' \|\| stock < 35`; recommended PO = `minStock * 3`; banner text hard-coded ("17 SKUs", "5 products … 72 hours") | – | Generate Bulk Purchase Orders, per-row Reorder (no handlers) | – | – | Read-only |
| `/analytics` | Insights | 4 **hard-coded** KPIs: Total Inventory Valuation `$3,842,600`, Avg Days on Hand `18.4`, GMROI `3.4x`, Dead Stock Risk `$14,200`; plus the Performance, Categories and Fast Moving charts | – | – | – | – | Presentational |
| `/settings` | Config | Tabs [General Configuration, Alerts & Reorders, Facility Defaults]; **every tab renders the same form** | Workspace name (text, default "StockSense Enterprise"), Default Primary Facility (select of 4 names), Default Reorder Buffer Multiplier [2x, 3x (Recommended), 5x], "Require manager sign-off on negative adjustments" (checkbox, checked) | Save Changes (toast "Preferences saved (Mock)") | – | – | **Mock**, uncontrolled inputs |

### 4.2 Charts (dashboard and analytics)

| Component | Mock shape [SEEN] | Other hard-coded values [SEEN] |
|---|---|---|
| `InventoryActivityChart` | `{ day:'Mon', inbound, outbound, total }` ×7 | 7d/30d toggle (state only); fixed `maxVal = 250`; footer totals `935 / 820 / +115` hard-coded |
| `StockMovementChart` | `{ time:'08:00', stock, capacity, optimal }` ×7, stock in **thousands** | y-axis fixed at 250–300k; target 280k; footer "284.5k / 280k / +1.6%" |
| `TopCategoriesChart` | `{ name, percentage, count, color }` | centre label "14.8k Total Items" |
| `FastMovingProducts` | `{ id, name, sku, velocity:'94%', unitsMoved, stockLevel, trend:'+14%' }` | title says "past 30 days" |
| `InventoryPerformanceChart` | `{ month:'Jan', turnover, fulfillment, accuracy, volume }` ×6 | strip values 6.2x / 99.2% / 99.8% hard-coded; y-axis fixed at 4–7x; volume bars assume 15k–30k |

### 4.3 Status and enum values [SEEN]

| Concept | Values used in code / CSS |
|---|---|
| Operation type (`operation`) | `Receipt`, `Delivery`, `Internal Transfer`, `Adjustment` |
| Operation status | `Completed`, `In Progress`, `Pending`, `Cancelled` (British spelling; the CSS classes `.completed/.in-progress/.pending/.cancelled` exist) |
| Product status | `In Stock`, `Low Stock` (no CSS class for either; **no "Out of Stock" value exists**) |
| Reference prefixes | `PO-2026-0812` (receipt), `DO-2026-1144` (delivery), `TR-2026-0422` (transfer), `ADJ-2026-0091` (adjustment) |
| Operation id | `OP-8941` |
| Product id | `PRD-001` |
| Warehouse id / code | `WHS-01` / `HUB-MUM-01` |
| Unit | `pcs` (on operations only; products have no unit field) |
| Date format | `"2026-09-26 10:45"` (**not ISO-8601**: space separator, no seconds, no zone) |
| KPI colours | `blue`, `emerald`, `indigo`, `amber` |
| KPI icons | `Package`, `Boxes`, `Truck`, `AlertTriangle`, `Layers` |
| Currency | `$`, hard-coded in the JSX |

**`id` usage:** every `id` is used only as a React `key`. Nothing routes or links by id, so the backend may use numeric ids. [SEEN]

---

## 5. Implied domain model

| Entity | Fields (from mocks/forms) | Notes |
|---|---|---|
| **Product** | id, name, sku, category *(name)*, stock *(total)*, minStock, price, warehouse *(primary warehouse name)*, status | [SEEN] one stock number and one warehouse per product. [INFERRED] `stock` should be the sum over all internal locations and `status` derived from `stock` vs `minStock`. `unit` has to be added (operations show `pcs`). |
| **Category** | name | [SEEN] only as a string. Lists are inconsistent: pills omit `Equipment`, the modal omits `Equipment`, and chart names differ ("Electronics & Computing"). [INFERRED] a table with `name` and `color` (the donut needs a colour). |
| **Warehouse** | id, name, code, location *(address text)*, capacity *(% string)*, totalItems, activeManagers | [INFERRED] `capacity` % = stock ÷ a stored capacity figure; `activeManagers` = users assigned to that warehouse. |
| **Location** (below warehouse) | – | [SEEN] not modelled. The transfers page mentions "bays, zones, and picking bins". [INFERRED] follow the appendix: every warehouse gets one default internal location, plus virtual Vendor, Customer and Inventory Loss locations. The UI only ever shows warehouse names. |
| **Operation** (document row) | id, product, sku, operation *(type)*, warehouse *(one name, or `"A -> B"` for transfers)*, quantity *(signed)*, unit, status, date, user *(display name)*, reference | [SEEN] **one product per row**. [INFERRED] a document can have many lines, and each list row is one line. |
| **Ledger entry** | same shape as Operation | [SEEN] the Stock Ledger reuses `mockOperations`. [INFERRED] ledger rows are stock moves (DONE only), so Pending and Cancelled rows should not appear there. |
| **User** | display name, initials, role label ("Operations Lead") | [SEEN] hard-coded. [INFERRED] the appendix roles `MANAGER`/`STAFF` plus a free-text job title. |
| **Settings** | workspaceName, defaultWarehouse, reorderMultiplier (2/3/5), requireManagerSignoffForNegativeAdjustments | [SEEN] form fields. |
| **KPI** | id, label, value *(formatted)*, numericValue, change, isPositive, timeframe, badge, icon, color | [SEEN] a presentational shape. |
| **Alert / notification** | – | [SEEN] only a bell count `4`. [INFERRED] low-stock alerts. |

Relationships [INFERRED]: Product → Category (many-to-one); Product → primary Warehouse (many-to-one); stock per (Product, Location); Operation → lines → Product; Operation → source and destination Location; Operation → responsible User; Stock move → Operation line.
