# StockSense database (Supabase)

There is no separate API server. The React app talks to Supabase directly:

- **Postgres** holds the data. Row Level Security decides who can read or change what.
- **Auth** handles sign-up, sign-in and password reset.
- **Database functions (RPC)** do every stock change inside one transaction: the stock engine.

```
supabase/
  migrations/   schema, security, views, stock engine, dashboard functions (run in order)
  seed.sql      demo data (6 months of history; final stock matches the original mock data)
  setup.sql     GENERATED: all migrations + seed in one file, for the SQL editor
  tests/        33 tests that run the SQL in PGlite (an in-process Postgres) — no Docker needed
```

## 1. Set up a new Supabase project (about 5 minutes)

1. **Create the database.** In the Supabase dashboard, open **SQL Editor → New query**, paste the whole of
   [`setup.sql`](setup.sql) and click **Run**. It runs once on an empty project.
   (With the Supabase CLI instead: `supabase link` then `supabase db push`, and run `seed.sql` for demo data.)
2. **Tell Auth where the app lives.** Go to **Authentication → URL Configuration**:
   - *Site URL*: your Vercel URL, e.g. `https://stocksense.vercel.app`
   - *Redirect URLs*: add `https://stocksense.vercel.app/**` and `http://localhost:5173/**`
   Without this, confirmation and reset emails link to the wrong place.
3. **Show the reset code in the email.** Go to **Authentication → Emails → Reset Password**. Make sure the
   template contains `{{ .Token }}`, so people can type the 6-digit code on the Forgot Password page.
   The link (`{{ .ConfirmationURL }}`) keeps working too. For example:
   ```html
   <h2>Reset your StockSense password</h2>
   <p>Your code is <strong>{{ .Token }}</strong> (valid for a short time, one use).</p>
   <p>Or <a href="{{ .ConfirmationURL }}">click here to choose a new password</a>.</p>
   ```
4. **Sign up in the app.** The **first account becomes the manager**; everyone after that joins as staff. A manager
   can change roles in *Settings → Team & Access*.

The frontend already contains this project's URL and publishable key (`frontend/src/lib/supabase.js`).
Publishable keys are designed to be public: RLS protects the data. **Never** put the secret / `service_role`
key in the frontend or in git. To point the app at a different project, set `VITE_SUPABASE_URL` and
`VITE_SUPABASE_PUBLISHABLE_KEY` (see `frontend/.env.example`).

## 2. How stock changes (the rules the database enforces)

Every movement is a move **from one location to another**. Real places are `INTERNAL` locations; the virtual
**Vendors**, **Customers** and **Inventory Adjustment** locations are the other side of each move.

| Document | From → To | Effect |
|---|---|---|
| Receipt (`PO-…`) | Vendors → warehouse | + stock |
| Delivery (`DO-…`) | warehouse → Customers | − stock |
| Internal transfer (`TR-…`) | location → location | total unchanged |
| Adjustment (`ADJ-…`) | warehouse ↔ Inventory Adjustment | counted − system quantity |
| New product with opening stock (`INIT-sku`) | Inventory Adjustment → warehouse | + stock |

Lifecycle: `DRAFT` → (Mark Ready) → `READY`, or `WAITING` if a delivery or transfer lacks stock → (Validate) → `DONE`.
Anything except `DONE` can be `CANCELLED`. The UI shows these as Pending / In Progress / Completed / Cancelled.

Guarantees:
- **One transaction per action.** `validate_operation` locks every affected stock row (always in the same order,
  so two validations can't deadlock), re-checks availability, writes the ledger and updates stock. If anything
  fails, nothing changes.
- **Stock in a real location never goes negative.** This is checked in the engine and by a `CHECK` constraint.
- **The ledger (`stock_moves`) is append-only.** Triggers reject `UPDATE`, `DELETE` and `TRUNCATE`, even for the owner.
- **Completed documents can't be edited.** Partial validation can create a backorder for the rest.
- **Clients can't write stock tables.** They can only call the functions. Staff can't change master data.
  Stock-reducing adjustments by staff need a manager (a Settings switch).

## 3. Run the tests

```bash
cd supabase/tests
npm install
npm test          # 33 tests: permissions, every operation, rollback, ledger integrity, seed, dashboard
npm run bundle    # regenerate setup.sql after changing a migration or the seed
```

PGlite has a single connection, so the tests can't race two validations against each other. That guarantee
comes from the row locks in `_validate_operation` (`SELECT … FOR UPDATE` in a fixed order) plus the
non-negative `CHECK`.

## 4. API used by the frontend

See [`docs/API_CONTRACT.md`](../docs/API_CONTRACT.md) for every view and function, its parameters and its return shape.
