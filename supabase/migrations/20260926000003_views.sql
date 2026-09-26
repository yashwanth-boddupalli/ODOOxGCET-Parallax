-- Read models shaped like the frontend's mock data (mockProducts, mockOperations,
-- mockWarehouses). All views use security_invoker so the caller's RLS applies.

-- ---------------------------------------------------------------------------
-- Display helpers
-- ---------------------------------------------------------------------------
create function public.app_time_zone()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select time_zone from public.app_settings where id = 1), 'Asia/Kolkata');
$$;

-- The UI shows "2026-09-26 10:45" (no seconds, local time).
create function public.display_time(p_ts timestamptz)
returns text
language sql
stable
set search_path = public, pg_temp
as $$
  select to_char(p_ts at time zone public.app_time_zone(), 'YYYY-MM-DD HH24:MI');
$$;

create function public.operation_label(p_type public.operation_type)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case p_type
    when 'RECEIPT'    then 'Receipt'
    when 'DELIVERY'   then 'Delivery'
    when 'TRANSFER'   then 'Internal Transfer'
    when 'ADJUSTMENT' then 'Adjustment'
  end;
$$;

create function public.move_label(p_type public.move_type)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case p_type
    when 'INITIAL'    then 'Initial Stock'
    when 'RECEIPT'    then 'Receipt'
    when 'DELIVERY'   then 'Delivery'
    when 'TRANSFER'   then 'Internal Transfer'
    when 'ADJUSTMENT' then 'Adjustment'
  end;
$$;

-- The UI knows four statuses; the engine has five (DRAFT and WAITING both read "Pending").
create function public.status_label(p_state public.operation_state)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case p_state
    when 'DRAFT'     then 'Pending'
    when 'WAITING'   then 'Pending'
    when 'READY'     then 'In Progress'
    when 'DONE'      then 'Completed'
    when 'CANCELLED' then 'Cancelled'
  end;
$$;

-- "Low Stock" uses <= because the Low Stock page says "inventory <= safety reorder point".
create function public.stock_status(p_stock numeric, p_min numeric)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when p_stock <= 0 then 'Out of Stock'
    when p_min > 0 and p_stock <= p_min then 'Low Stock'
    else 'In Stock'
  end;
$$;

-- ---------------------------------------------------------------------------
-- Locations with a human label ("Main Central Hub", "Main Central Hub / Production Rack")
-- ---------------------------------------------------------------------------
create view public.v_locations
with (security_invoker = true) as
select
  l.id,
  l.name,
  l.code,
  l.type,
  l.warehouse_id,
  coalesce(w.name, '') as warehouse,
  l.is_default,
  l.active,
  case
    when l.warehouse_id is null then l.name
    when l.is_default then w.name
    else w.name || ' / ' || l.name
  end as label
from public.locations l
left join public.warehouses w on w.id = l.warehouse_id;

-- ---------------------------------------------------------------------------
-- Products (mockProducts shape). Pass a warehouse id to scope the stock figure.
-- ---------------------------------------------------------------------------
create function public.product_rows(p_warehouse_id bigint default null)
returns table (
  id           bigint,
  name         text,
  sku          text,
  category     text,
  category_id  bigint,
  stock        numeric,
  min_stock    numeric,
  reorder_qty  numeric,
  price        numeric,
  unit         text,
  warehouse    text,
  warehouse_id bigint,
  status       text,
  archived     boolean,
  created_at   timestamptz
)
language sql
stable
set search_path = public, pg_temp
as $$
  select
    p.id,
    p.name,
    p.sku,
    c.name,
    p.category_id,
    coalesce(s.qty, 0),
    coalesce(r.min_qty, 0),
    r.reorder_qty,
    p.price,
    p.unit,
    coalesce(w.name, ''),
    p.primary_warehouse_id,
    public.stock_status(coalesce(s.qty, 0), coalesce(r.min_qty, 0)),
    p.archived,
    p.created_at
  from public.products p
  join public.categories c on c.id = p.category_id
  left join public.reorder_rules r on r.product_id = p.id
  left join public.warehouses w on w.id = p.primary_warehouse_id
  left join lateral (
    select sum(q.quantity) as qty
    from public.stock_quants q
    join public.locations l on l.id = q.location_id
    where q.product_id = p.id
      and l.type = 'INTERNAL'
      and (p_warehouse_id is null or l.warehouse_id = p_warehouse_id)
  ) s on true;
$$;

create view public.v_product_rows
with (security_invoker = true) as
select * from public.product_rows(null);

-- Stock per product per location (product detail, operation forms).
create view public.v_stock_levels
with (security_invoker = true) as
select
  q.product_id,
  p.name as product,
  p.sku,
  p.unit,
  q.location_id,
  l.label as location,
  l.warehouse_id,
  l.warehouse,
  q.quantity
from public.stock_quants q
join public.products p on p.id = q.product_id
join public.v_locations l on l.id = q.location_id
where q.quantity > 0;

-- ---------------------------------------------------------------------------
-- Warehouses (mockWarehouses shape)
-- ---------------------------------------------------------------------------
create view public.v_warehouse_cards
with (security_invoker = true) as
select
  w.id,
  w.name,
  w.code,
  w.address as location,
  coalesce(t.total, 0) as total_items,
  w.capacity_units,
  case when w.capacity_units is null then null
       else round(coalesce(t.total, 0) / w.capacity_units * 100, 1) end as capacity_percent,
  -- The UI needs a string like "88%" (it uses it as a CSS width).
  (case when w.capacity_units is null then 0
        else round(coalesce(t.total, 0) / w.capacity_units * 100) end)::int::text || '%' as capacity,
  coalesce(m.cnt, 0)::int as active_managers,
  w.active,
  w.created_at
from public.warehouses w
left join lateral (
  select sum(q.quantity) as total
  from public.stock_quants q
  join public.locations l on l.id = q.location_id
  where l.warehouse_id = w.id
) t on true
left join lateral (
  select count(*) as cnt
  from public.profiles pr
  where pr.default_warehouse_id = w.id and pr.active
) m on true;

-- ---------------------------------------------------------------------------
-- Operation documents (header only, with labels)
-- ---------------------------------------------------------------------------
create view public.v_operation_documents
with (security_invoker = true) as
select
  o.id,
  o.reference,
  o.type,
  public.operation_label(o.type) as operation,
  o.state,
  public.status_label(o.state) as status,
  o.source_location_id,
  src.label as source,
  src.type as source_type,
  src.warehouse_id as source_warehouse_id,
  o.destination_location_id,
  dst.label as destination,
  dst.type as destination_type,
  dst.warehouse_id as destination_warehouse_id,
  o.partner_name,
  o.reason,
  o.notes,
  o.scheduled_date,
  o.responsible_id,
  o.responsible_name as responsible,
  o.backorder_of_id,
  coalesce(bo.reference, '') as backorder_of,
  (select count(*) from public.operation_lines x where x.operation_id = o.id)::int as line_count,
  public.display_time(coalesce(o.validated_at, o.created_at)) as date,
  coalesce(o.validated_at, o.created_at) as date_iso,
  o.created_at,
  o.validated_at
from public.operations o
join public.v_locations src on src.id = o.source_location_id
join public.v_locations dst on dst.id = o.destination_location_id
left join public.operations bo on bo.id = o.backorder_of_id;

-- ---------------------------------------------------------------------------
-- Operation rows: one row per document line (mockOperations shape).
-- quantity is signed: + into stock, - out of stock.
-- ---------------------------------------------------------------------------
create view public.v_operation_rows
with (security_invoker = true) as
select
  ln.id,
  d.id as document_id,
  ln.product_id,
  p.name as product,
  p.sku,
  d.operation,
  d.type,
  d.state,
  d.status,
  case d.type
    when 'RECEIPT'  then d.destination
    when 'TRANSFER' then d.source || ' -> ' || d.destination
    else d.source
  end as warehouse,
  case d.type
    -- Adjustments show the difference; before validation, against current stock.
    when 'ADJUSTMENT' then coalesce(ln.counted_quantity, 0) - coalesce(ln.system_quantity, cur.quantity, 0)
    when 'DELIVERY'   then -(case when d.state = 'DONE' then ln.done_quantity else ln.quantity end)
    else                   (case when d.state = 'DONE' then ln.done_quantity else ln.quantity end)
  end as quantity,
  ln.quantity as planned_quantity,
  ln.done_quantity,
  ln.counted_quantity,
  ln.system_quantity,
  p.unit,
  d.date,
  d.date_iso,
  d.responsible,
  d.reference,
  d.partner_name,
  d.scheduled_date,
  d.source_warehouse_id,
  d.destination_warehouse_id,
  d.created_at
from public.operation_lines ln
join public.v_operation_documents d on d.id = ln.operation_id
join public.products p on p.id = ln.product_id
left join public.stock_quants cur
  on cur.product_id = ln.product_id and cur.location_id = d.source_location_id;

-- ---------------------------------------------------------------------------
-- Ledger rows (the Stock Ledger page): completed moves only.
-- ---------------------------------------------------------------------------
create view public.v_ledger_rows
with (security_invoker = true) as
select
  m.id,
  m.move_type as type,
  public.move_label(m.move_type) as operation,
  m.product_id,
  p.name as product,
  p.sku,
  case
    when src.type = 'INTERNAL' and dst.type = 'INTERNAL' then src.label || ' -> ' || dst.label
    when dst.type = 'INTERNAL' then dst.label
    else src.label
  end as warehouse,
  case
    when src.type <> 'INTERNAL' and dst.type = 'INTERNAL' then m.quantity
    when src.type = 'INTERNAL' and dst.type <> 'INTERNAL' then -m.quantity
    else m.quantity
  end as quantity,
  p.unit,
  'Completed'::text as status,
  public.display_time(m.performed_at) as date,
  m.performed_at as date_iso,
  m.performed_by_name as responsible,
  m.reference,
  src.label as source_location,
  dst.label as destination_location,
  src.warehouse_id as source_warehouse_id,
  dst.warehouse_id as destination_warehouse_id,
  m.operation_id as document_id,
  m.performed_at
from public.stock_moves m
join public.products p on p.id = m.product_id
join public.v_locations src on src.id = m.source_location_id
join public.v_locations dst on dst.id = m.destination_location_id;

revoke all on public.v_locations, public.v_product_rows, public.v_stock_levels,
  public.v_warehouse_cards, public.v_operation_documents, public.v_operation_rows,
  public.v_ledger_rows from anon;
grant select on public.v_locations, public.v_product_rows, public.v_stock_levels,
  public.v_warehouse_cards, public.v_operation_documents, public.v_operation_rows,
  public.v_ledger_rows to authenticated;
