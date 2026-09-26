-- StockSense schema: master data, stock, operations and the append-only ledger.
-- Quantities use numeric(15,3) so kg / litres work as well as pieces.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('MANAGER', 'STAFF');

-- INTERNAL = a real place that holds stock; the other three are virtual
-- counterparts so every stock change can be written as "from -> to".
create type public.location_type as enum ('INTERNAL', 'VENDOR', 'CUSTOMER', 'INVENTORY_LOSS');

create type public.operation_type as enum ('RECEIPT', 'DELIVERY', 'TRANSFER', 'ADJUSTMENT');

create type public.operation_state as enum ('DRAFT', 'WAITING', 'READY', 'DONE', 'CANCELLED');

create type public.move_type as enum ('INITIAL', 'RECEIPT', 'DELIVERY', 'TRANSFER', 'ADJUSTMENT');

-- ---------------------------------------------------------------------------
-- Shared trigger: keep updated_at current
-- ---------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Warehouses and locations
-- ---------------------------------------------------------------------------
create table public.warehouses (
  id             bigint generated always as identity primary key,
  name           text not null check (length(trim(name)) > 0),
  code           text not null check (length(trim(code)) > 0),
  address        text not null default '',
  capacity_units numeric(15,3) check (capacity_units is null or capacity_units > 0),
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index warehouses_name_key on public.warehouses (lower(name));
create unique index warehouses_code_key on public.warehouses (upper(code));
create trigger warehouses_updated_at before update on public.warehouses
  for each row execute function public.set_updated_at();

create table public.locations (
  id           bigint generated always as identity primary key,
  warehouse_id bigint references public.warehouses (id) on delete restrict,
  name         text not null check (length(trim(name)) > 0),
  code         text not null,
  type         public.location_type not null,
  is_default   boolean not null default false,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  -- Real locations belong to a warehouse; virtual ones never do.
  constraint locations_internal_has_warehouse
    check ((type = 'INTERNAL') = (warehouse_id is not null))
);
create unique index locations_code_key on public.locations (upper(code));
create unique index locations_warehouse_name_key on public.locations (warehouse_id, lower(name))
  where warehouse_id is not null;
create unique index locations_one_default_per_warehouse on public.locations (warehouse_id)
  where is_default;
-- Exactly one Vendors / Customers / Inventory Adjustment location.
create unique index locations_one_per_virtual_type on public.locations (type)
  where warehouse_id is null;

-- ---------------------------------------------------------------------------
-- Users (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                   uuid primary key references auth.users (id) on delete cascade,
  full_name            text not null default '',
  email                text not null default '',
  role                 public.app_role not null default 'STAFF',
  job_title            text not null default '',
  default_warehouse_id bigint references public.warehouses (id) on delete set null,
  active               boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Every new auth user gets a profile. The very first one becomes MANAGER.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role public.app_role := 'STAFF';
begin
  -- Serialise concurrent sign-ups so two people can't both be "first".
  perform pg_advisory_xact_lock(hashtext('stocksense.first_user'));
  if not exists (select 1 from public.profiles) then
    v_role := 'MANAGER';
  end if;

  insert into public.profiles (id, email, full_name, role, job_title, default_warehouse_id)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(coalesce(new.email, ''), '@', 1)),
    v_role,
    case when v_role = 'MANAGER' then 'Inventory Manager' else 'Warehouse Staff' end,
    -- app_settings is created later in the migrations, so look it up defensively.
    (select s.default_warehouse_id from public.app_settings s where s.id = 1)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------------
create table public.categories (
  id         bigint generated always as identity primary key,
  name       text not null check (length(trim(name)) > 0),
  color      text not null default '#64748b' check (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index categories_name_key on public.categories (lower(name));
create trigger categories_updated_at before update on public.categories
  for each row execute function public.set_updated_at();

create sequence public.product_sku_seq;

create table public.products (
  id                   bigint generated always as identity primary key,
  name                 text not null check (length(trim(name)) > 0),
  sku                  text not null check (length(trim(sku)) > 0),
  category_id          bigint not null references public.categories (id) on delete restrict,
  unit                 text not null default 'pcs' check (length(trim(unit)) > 0),
  price                numeric(15,2) not null default 0 check (price >= 0),
  primary_warehouse_id bigint references public.warehouses (id) on delete set null,
  archived             boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
-- SKUs are unique regardless of case.
create unique index products_sku_key on public.products (upper(sku));
create index products_category_idx on public.products (category_id);
create index products_name_idx on public.products (lower(name));

-- Store SKUs trimmed and upper-case so lookups are predictable.
create function public.normalize_product()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.sku  := upper(trim(new.sku));
  new.name := trim(new.name);
  new.unit := trim(new.unit);
  return new;
end;
$$;
create trigger products_normalize before insert or update on public.products
  for each row execute function public.normalize_product();
create trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();

create table public.reorder_rules (
  product_id  bigint primary key references public.products (id) on delete cascade,
  min_qty     numeric(15,3) not null default 0 check (min_qty >= 0),
  reorder_qty numeric(15,3) check (reorder_qty is null or reorder_qty > 0),
  updated_at  timestamptz not null default now()
);
create trigger reorder_rules_updated_at before update on public.reorder_rules
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Stock on hand: one row per product per INTERNAL location.
-- Only the stock engine functions write here.
-- ---------------------------------------------------------------------------
create table public.stock_quants (
  product_id  bigint not null references public.products (id) on delete restrict,
  location_id bigint not null references public.locations (id) on delete restrict,
  quantity    numeric(15,3) not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (product_id, location_id),
  -- Last line of defence: stock in a real place can never go negative.
  constraint stock_quants_non_negative check (quantity >= 0)
);
create index stock_quants_location_idx on public.stock_quants (location_id);

-- ---------------------------------------------------------------------------
-- Operation documents (receipts, deliveries, transfers, adjustments)
-- ---------------------------------------------------------------------------
create table public.operations (
  id                      bigint generated always as identity primary key,
  reference               text not null unique,
  type                    public.operation_type not null,
  state                   public.operation_state not null default 'DRAFT',
  source_location_id      bigint not null references public.locations (id),
  destination_location_id bigint not null references public.locations (id),
  partner_name            text not null default '',
  reason                  text not null default '',
  notes                   text not null default '',
  scheduled_date          date,
  responsible_id          uuid references public.profiles (id) on delete set null,
  -- Name snapshot so the history still reads correctly if a user is removed.
  responsible_name        text not null default '',
  created_by              uuid references public.profiles (id) on delete set null,
  backorder_of_id         bigint references public.operations (id),
  validated_at            timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint operations_distinct_locations check (source_location_id <> destination_location_id)
);
create index operations_type_state_idx on public.operations (type, state);
create index operations_created_at_idx on public.operations (created_at desc);
create index operations_scheduled_idx on public.operations (scheduled_date);
create trigger operations_updated_at before update on public.operations
  for each row execute function public.set_updated_at();

create table public.operation_lines (
  id               bigint generated always as identity primary key,
  operation_id     bigint not null references public.operations (id) on delete cascade,
  product_id       bigint not null references public.products (id),
  -- Planned quantity. For adjustments it becomes |counted - system| on validation.
  quantity         numeric(15,3) not null default 0 check (quantity >= 0),
  done_quantity    numeric(15,3) not null default 0 check (done_quantity >= 0),
  -- Adjustments only: what was physically counted, and what the system said.
  counted_quantity numeric(15,3) check (counted_quantity is null or counted_quantity >= 0),
  system_quantity  numeric(15,3),
  constraint operation_lines_one_row_per_product unique (operation_id, product_id)
);
create index operation_lines_product_idx on public.operation_lines (product_id);

-- ---------------------------------------------------------------------------
-- Ledger: every stock change, never edited or deleted.
-- ---------------------------------------------------------------------------
create table public.stock_moves (
  id                      bigint generated always as identity primary key,
  operation_id            bigint references public.operations (id),
  operation_line_id       bigint references public.operation_lines (id),
  product_id              bigint not null references public.products (id),
  source_location_id      bigint not null references public.locations (id),
  destination_location_id bigint not null references public.locations (id),
  quantity                numeric(15,3) not null check (quantity > 0),
  move_type               public.move_type not null,
  reference               text not null,
  -- No FK on purpose: removing a user must never require editing the ledger.
  performed_by            uuid,
  performed_by_name       text not null default '',
  performed_at            timestamptz not null default now(),
  constraint stock_moves_distinct_locations check (source_location_id <> destination_location_id)
);
create index stock_moves_product_time_idx on public.stock_moves (product_id, performed_at);
create index stock_moves_time_idx on public.stock_moves (performed_at);
create index stock_moves_operation_idx on public.stock_moves (operation_id);

create function public.prevent_ledger_change()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'stock_moves is append-only; record a new adjustment instead'
    using errcode = 'PT409';
end;
$$;
create trigger stock_moves_no_update before update or delete on public.stock_moves
  for each row execute function public.prevent_ledger_change();
create trigger stock_moves_no_truncate before truncate on public.stock_moves
  for each statement execute function public.prevent_ledger_change();

-- ---------------------------------------------------------------------------
-- Gap-free document numbers per prefix and year (PO-2026-0001 ...)
-- ---------------------------------------------------------------------------
create table public.reference_sequences (
  prefix     text not null,
  year       int  not null,
  next_value int  not null default 1,
  primary key (prefix, year)
);

-- ---------------------------------------------------------------------------
-- App settings (single row)
-- ---------------------------------------------------------------------------
create table public.app_settings (
  id                                   smallint primary key default 1 check (id = 1),
  workspace_name                       text not null default 'StockSense',
  default_warehouse_id                 bigint references public.warehouses (id) on delete set null,
  reorder_multiplier                   int not null default 3 check (reorder_multiplier in (2, 3, 5)),
  require_signoff_negative_adjustments boolean not null default true,
  stock_target_units                   numeric(15,3) check (stock_target_units is null or stock_target_units > 0),
  time_zone                            text not null default 'Asia/Kolkata',
  updated_at                           timestamptz not null default now()
);
create trigger app_settings_updated_at before update on public.app_settings
  for each row execute function public.set_updated_at();
