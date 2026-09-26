# Database

The schema, migrations and seed data live in [`../supabase`](../supabase/README.md):

- `supabase/migrations/` — tables, security (RLS), views, the stock engine and dashboard functions
- `supabase/seed.sql` — demo data
- `supabase/setup.sql` — everything in one file for the Supabase SQL editor
- `supabase/tests/` — 33 tests that run the SQL in PGlite
