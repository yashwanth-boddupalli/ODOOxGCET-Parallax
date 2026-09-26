# Backend

StockSense has no separate API server. The backend is **Supabase**: Postgres with Row Level Security,
Supabase Auth, and database functions that do every stock change in one transaction.

Everything lives in [`../supabase`](../supabase/README.md): migrations, seed data, tests and setup steps.
