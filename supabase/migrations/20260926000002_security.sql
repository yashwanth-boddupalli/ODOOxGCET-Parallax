-- Row Level Security.
-- Rules (from the product brief):
--   * Everyone signed in (and active) can read everything.
--   * MANAGER edits master data (warehouses, locations, categories, products, settings).
--   * Stock tables and operation documents are never written directly by clients;
--     they change only through the SECURITY DEFINER functions in the stock engine.
--   * Anonymous visitors see nothing.

-- ---------------------------------------------------------------------------
-- Helpers used by policies and functions
-- ---------------------------------------------------------------------------
create function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active);
$$;

create function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select role = 'MANAGER' from public.profiles where id = auth.uid() and active), false);
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
alter table public.warehouses          enable row level security;
alter table public.locations           enable row level security;
alter table public.profiles            enable row level security;
alter table public.categories          enable row level security;
alter table public.products            enable row level security;
alter table public.reorder_rules       enable row level security;
alter table public.stock_quants        enable row level security;
alter table public.operations          enable row level security;
alter table public.operation_lines     enable row level security;
alter table public.stock_moves         enable row level security;
alter table public.reference_sequences enable row level security;
alter table public.app_settings        enable row level security;

-- ---------------------------------------------------------------------------
-- Read access: any active signed-in user
-- (select ...) wrappers let Postgres evaluate the helper once per query.
-- ---------------------------------------------------------------------------
create policy "active users can read" on public.warehouses      for select to authenticated using ((select public.is_active_user()));
create policy "active users can read" on public.locations       for select to authenticated using ((select public.is_active_user()));
create policy "active users can read" on public.profiles        for select to authenticated using ((select public.is_active_user()) or id = (select auth.uid()));
create policy "active users can read" on public.categories      for select to authenticated using ((select public.is_active_user()));
create policy "active users can read" on public.products        for select to authenticated using ((select public.is_active_user()));
create policy "active users can read" on public.reorder_rules   for select to authenticated using ((select public.is_active_user()));
create policy "active users can read" on public.stock_quants    for select to authenticated using ((select public.is_active_user()));
create policy "active users can read" on public.operations      for select to authenticated using ((select public.is_active_user()));
create policy "active users can read" on public.operation_lines for select to authenticated using ((select public.is_active_user()));
create policy "active users can read" on public.stock_moves     for select to authenticated using ((select public.is_active_user()));
create policy "active users can read" on public.app_settings    for select to authenticated using ((select public.is_active_user()));
-- reference_sequences: no policies at all -> only the engine touches it.

-- ---------------------------------------------------------------------------
-- Master data writes: managers only
-- (Creating products and warehouses normally goes through RPCs so that
--  initial stock and default locations are created in the same transaction.)
-- ---------------------------------------------------------------------------
create policy "managers can insert" on public.categories for insert to authenticated with check ((select public.is_manager()));
create policy "managers can update" on public.categories for update to authenticated using ((select public.is_manager())) with check ((select public.is_manager()));

create policy "managers can update" on public.products for update to authenticated using ((select public.is_manager())) with check ((select public.is_manager()));

create policy "managers can insert" on public.reorder_rules for insert to authenticated with check ((select public.is_manager()));
create policy "managers can update" on public.reorder_rules for update to authenticated using ((select public.is_manager())) with check ((select public.is_manager()));
create policy "managers can delete" on public.reorder_rules for delete to authenticated using ((select public.is_manager()));

create policy "managers can update" on public.warehouses for update to authenticated using ((select public.is_manager())) with check ((select public.is_manager()));
create policy "managers can update" on public.locations  for update to authenticated using ((select public.is_manager())) with check ((select public.is_manager()));

create policy "managers can update" on public.app_settings for update to authenticated using ((select public.is_manager())) with check ((select public.is_manager()));

-- Users may edit their own profile (columns limited by the grants below).
create policy "users can update own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Table privileges (defence in depth on top of RLS)
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;

-- Profiles: only the harmless columns are self-editable; role/active change via RPC.
revoke insert, update, delete, truncate on public.profiles from authenticated;
grant update (full_name, job_title, default_warehouse_id) on public.profiles to authenticated;

-- Stock and documents: read-only for clients.
revoke insert, update, delete, truncate on public.stock_quants    from authenticated;
revoke insert, update, delete, truncate on public.stock_moves     from authenticated;
revoke insert, update, delete, truncate on public.operations      from authenticated;
revoke insert, update, delete, truncate on public.operation_lines from authenticated;
revoke all on public.reference_sequences from authenticated;

-- Deleting master data is not allowed (products are archived instead).
revoke delete, truncate on public.products, public.categories, public.warehouses, public.locations, public.app_settings from authenticated;
