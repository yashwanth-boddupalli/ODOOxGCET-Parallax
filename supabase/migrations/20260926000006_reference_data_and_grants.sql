-- Reference data every environment needs, and function permissions.

-- Virtual counterparts used by the stock engine.
insert into public.locations (warehouse_id, name, code, type) values
  (null, 'Vendors',              'VIRTUAL/VENDORS',    'VENDOR'),
  (null, 'Customers',            'VIRTUAL/CUSTOMERS',  'CUSTOMER'),
  (null, 'Inventory Adjustment', 'VIRTUAL/ADJUSTMENT', 'INVENTORY_LOSS');

insert into public.app_settings (id) values (1);

-- Anyone who signed up before this schema existed gets a profile now; the oldest
-- account becomes the manager (same rule as the sign-up trigger).
insert into public.profiles (id, email, full_name, role, job_title)
select
  u.id,
  coalesce(u.email, ''),
  coalesce(nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''), split_part(coalesce(u.email, ''), '@', 1)),
  case when row_number() over (order by u.created_at, u.id) = 1 then 'MANAGER' else 'STAFF' end::public.app_role,
  case when row_number() over (order by u.created_at, u.id) = 1 then 'Inventory Manager' else 'Warehouse Staff' end
from auth.users u
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Table permissions for signed-in users, stated explicitly so the setup works
-- even on projects that don't auto-grant new tables to the API roles.
-- RLS (see 000002) still decides which rows each user can see or change.
-- ---------------------------------------------------------------------------
grant usage on schema public to authenticated;
grant select on
  public.warehouses, public.locations, public.profiles, public.categories, public.products,
  public.reorder_rules, public.stock_quants, public.operations, public.operation_lines,
  public.stock_moves, public.app_settings
to authenticated;
grant insert, update on public.categories to authenticated;
grant update on public.products, public.warehouses, public.locations, public.app_settings to authenticated;
grant insert, update, delete on public.reorder_rules to authenticated;
grant update (full_name, job_title, default_warehouse_id) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Function permissions
-- Start from nothing, then open exactly the API the app uses.
-- Internal helpers (prefixed "_") stay private to the database.
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

-- Used inside RLS policies and views, so callers need them.
grant execute on function
  public.is_active_user(),
  public.is_manager(),
  public.app_time_zone(),
  public.display_time(timestamptz),
  public.operation_label(public.operation_type),
  public.move_label(public.move_type),
  public.status_label(public.operation_state),
  public.stock_status(numeric, numeric),
  public.product_rows(bigint)
to authenticated;

-- Read-only helpers the dashboard functions call with the caller's rights.
grant execute on function
  public._fmt_num(numeric),
  public._fmt_change(numeric, numeric),
  public._normalize_range(text),
  public._range_start(text),
  public._stock_now(bigint, bigint),
  public._net_since(timestamptz, bigint, bigint)
to authenticated;

-- Read API
grant execute on function
  public.dashboard_summary(bigint),
  public.dashboard_kpis(text, bigint),
  public.dashboard_activity(text, bigint),
  public.dashboard_stock_movement(text, bigint),
  public.dashboard_categories(bigint),
  public.dashboard_fast_moving(int, int, bigint),
  public.dashboard_performance(int, bigint),
  public.analytics_kpis(bigint),
  public.low_stock_rows(bigint),
  public.low_stock_summary(bigint)
to authenticated;

-- Write API (each function checks the caller's role itself)
grant execute on function
  public.create_product(text, text, text, bigint, numeric, text, bigint, numeric, numeric, text, numeric),
  public.update_product(bigint, jsonb),
  public.set_product_archived(bigint, boolean),
  public.create_warehouse(text, text, text, numeric),
  public.create_location(bigint, text, text),
  public.create_operation(text, jsonb),
  public.update_operation(bigint, jsonb),
  public.confirm_operation(bigint),
  public.check_availability(bigint),
  public.validate_operation(bigint, jsonb, boolean),
  public.cancel_operation(bigint),
  public.update_settings(jsonb),
  public.set_user_access(uuid, text, boolean),
  public.reorder_product(bigint, numeric),
  public.reorder_low_stock(bigint)
to authenticated;
