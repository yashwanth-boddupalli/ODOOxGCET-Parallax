-- Dashboard, analytics and low-stock read functions, plus reordering.
-- Every function takes an optional p_warehouse_id (the header's "Active facility").
-- Historical stock is rebuilt from the ledger: stock at time T = stock now - net moves after T.

-- ---------------------------------------------------------------------------
-- Small helpers
-- ---------------------------------------------------------------------------
create function public._fmt_num(p numeric)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select rtrim(to_char(round(coalesce(p, 0), 3), 'FM999,999,999,999,990.999'), '.');
$$;

create function public._fmt_change(p_now numeric, p_before numeric)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when coalesce(p_before, 0) = 0 and coalesce(p_now, 0) = 0 then '0%'
    when coalesce(p_before, 0) = 0 then '+100%'
    else (case when p_now >= p_before then '+' else '' end)
         || to_char(round((p_now - p_before) / p_before * 100, 1), 'FM999999990.0') || '%'
  end;
$$;

create function public._normalize_range(p_range text)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v text := lower(trim(coalesce(p_range, '30d')));
begin
  return case v
    when 'today' then 'today'
    when 'last 7 days' then '7d'
    when 'last 30 days' then '30d'
    when 'this quarter' then 'quarter'
    when '7d' then '7d'
    when '30d' then '30d'
    when 'quarter' then 'quarter'
    else null
  end;
end;
$$;

create function public._range_start(p_range text)
returns timestamptz
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_tz text := public.app_time_zone();
  v_local timestamp := now() at time zone v_tz;
begin
  case public._normalize_range(p_range)
    when 'today'   then return date_trunc('day', v_local) at time zone v_tz;
    when '7d'      then return now() - interval '7 days';
    when '30d'     then return now() - interval '30 days';
    when 'quarter' then return date_trunc('quarter', v_local) at time zone v_tz;
    else raise exception using errcode = 'PT400', message = 'range must be today, 7d, 30d or quarter';
  end case;
end;
$$;

-- Units currently in real locations (optionally one warehouse, optionally one product).
create function public._stock_now(p_warehouse_id bigint, p_product_id bigint default null)
returns numeric
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(sum(q.quantity), 0)
  from public.stock_quants q
  join public.locations l on l.id = q.location_id
  where l.type = 'INTERNAL'
    and (p_warehouse_id is null or l.warehouse_id = p_warehouse_id)
    and (p_product_id is null or q.product_id = p_product_id);
$$;

-- Net units that entered the scope after p_since (entering minus leaving).
create function public._net_since(p_since timestamptz, p_warehouse_id bigint, p_product_id bigint default null)
returns numeric
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(sum(
      case when d.type = 'INTERNAL' and (p_warehouse_id is null or d.warehouse_id = p_warehouse_id) then m.quantity else 0 end
    - case when s.type = 'INTERNAL' and (p_warehouse_id is null or s.warehouse_id = p_warehouse_id) then m.quantity else 0 end
  ), 0)
  from public.stock_moves m
  join public.locations s on s.id = m.source_location_id
  join public.locations d on d.id = m.destination_location_id
  where m.performed_at > p_since
    and (p_product_id is null or m.product_id = p_product_id);
$$;

-- ---------------------------------------------------------------------------
-- Sidebar badges and header bell
-- ---------------------------------------------------------------------------
create function public.dashboard_summary(p_warehouse_id bigint default null)
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'productsCount', (select count(*) from public.products where not archived),
    'pendingReceipts', (
      select count(*) from public.operations o
      join public.locations d on d.id = o.destination_location_id
      where o.type = 'RECEIPT' and o.state in ('DRAFT', 'WAITING', 'READY')
        and (p_warehouse_id is null or d.warehouse_id = p_warehouse_id)),
    'pendingDeliveries', (
      select count(*) from public.operations o
      join public.locations s on s.id = o.source_location_id
      where o.type = 'DELIVERY' and o.state in ('DRAFT', 'WAITING', 'READY')
        and (p_warehouse_id is null or s.warehouse_id = p_warehouse_id)),
    'lowStockCount', (
      select count(*) from public.product_rows(p_warehouse_id)
      where not archived and status <> 'In Stock'),
    'alertsCount', (
      select count(*) from public.product_rows(p_warehouse_id)
      where not archived and status <> 'In Stock'),
    'workspaceName', (select workspace_name from public.app_settings where id = 1)
  );
$$;

-- ---------------------------------------------------------------------------
-- KPI cards (exact mockKpis shape)
-- ---------------------------------------------------------------------------
create function public.dashboard_kpis(p_range text default '30d', p_warehouse_id bigint default null)
returns jsonb
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_range text := public._normalize_range(p_range);
  v_start timestamptz := public._range_start(p_range);
  v_week_ago timestamptz := now() - interval '7 days';
  v_timeframe text;
  v_products int;
  v_products_before int;
  v_categories int;
  v_stock numeric;
  v_stock_before numeric;
  v_in_stock_rate numeric;
  v_pending int;
  v_pending_before int;
  v_ready int;
  v_low int;
  v_low_before int;
  v_critical int;
  v_low_delta int;
begin
  v_timeframe := case v_range
    when 'today' then 'vs start of day'
    when '7d' then 'vs 7 days ago'
    when '30d' then 'vs last month'
    else 'vs start of quarter' end;

  -- Products and categories
  select count(*), count(*) filter (where created_at <= v_start), count(distinct category_id)
  into v_products, v_products_before, v_categories
  from public.products where not archived;

  -- Stock on hand
  v_stock := public._stock_now(p_warehouse_id);
  v_stock_before := v_stock - public._net_since(v_start, p_warehouse_id);
  select case when count(*) = 0 then 0 else count(*) filter (where stock > 0) * 100.0 / count(*) end
  into v_in_stock_rate
  from public.product_rows(p_warehouse_id) where not archived;

  -- Open deliveries now vs a week ago
  select
    count(*) filter (where o.state in ('DRAFT', 'WAITING', 'READY')),
    count(*) filter (where o.state = 'READY'),
    count(*) filter (where o.created_at <= v_week_ago and (
      o.state in ('DRAFT', 'WAITING', 'READY')
      or (o.state = 'DONE' and o.validated_at > v_week_ago)
      or (o.state = 'CANCELLED' and o.updated_at > v_week_ago)))
  into v_pending, v_ready, v_pending_before
  from public.operations o
  join public.locations s on s.id = o.source_location_id
  where o.type = 'DELIVERY'
    and (p_warehouse_id is null or s.warehouse_id = p_warehouse_id);

  -- Low stock now vs at the start of the range
  select
    count(*) filter (where status <> 'In Stock'),
    count(*) filter (where stock <= 0 or (min_stock > 0 and stock <= min_stock * 0.5)),
    count(*) filter (where created_at <= v_start
      and public.stock_status(stock - public._net_since(v_start, p_warehouse_id, id), min_stock) <> 'In Stock')
  into v_low, v_critical, v_low_before
  from public.product_rows(p_warehouse_id) where not archived;
  v_low_delta := v_low - v_low_before;

  return jsonb_build_array(
    jsonb_build_object(
      'id', 'total-products', 'label', 'Total Products',
      'value', public._fmt_num(v_products), 'numericValue', v_products,
      'change', public._fmt_change(v_products, v_products_before),
      'isPositive', v_products >= v_products_before,
      'timeframe', v_timeframe,
      'badge', v_categories || ' Active Categories',
      'icon', 'Package', 'color', 'blue'),
    jsonb_build_object(
      'id', 'stock-available', 'label', 'Stock Available',
      'value', public._fmt_num(v_stock), 'numericValue', v_stock,
      'change', public._fmt_change(v_stock, v_stock_before),
      'isPositive', v_stock >= v_stock_before,
      'timeframe', v_timeframe,
      'badge', to_char(round(v_in_stock_rate, 1), 'FM990.0') || '% In-Stock Rate',
      'icon', 'Boxes', 'color', 'emerald'),
    jsonb_build_object(
      'id', 'pending-orders', 'label', 'Pending Orders',
      'value', public._fmt_num(v_pending), 'numericValue', v_pending,
      'change', public._fmt_change(v_pending, v_pending_before),
      -- Fewer open orders is good news.
      'isPositive', v_pending <= v_pending_before,
      'timeframe', 'vs last week',
      'badge', v_ready || ' Ready for Dispatch',
      'icon', 'Truck', 'color', 'indigo'),
    jsonb_build_object(
      'id', 'low-stock', 'label', 'Low Stock Items',
      'value', public._fmt_num(v_low), 'numericValue', v_low,
      'change', case when v_low_delta > 0 then '+' || v_low_delta || ' items'
                     when v_low_delta < 0 then v_low_delta || ' items'
                     else 'No change' end,
      'isPositive', v_low_delta < 0 or v_low = 0,
      'timeframe', 'requires reorder',
      'badge', v_critical || ' Critical Threshold',
      'icon', 'AlertTriangle', 'color', 'amber')
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Inbound receipts vs outbound deliveries per day (mockActivityData shape)
-- ---------------------------------------------------------------------------
create function public.dashboard_activity(p_range text default '7d', p_warehouse_id bigint default null)
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  with params as (
    select public.app_time_zone() as tz,
           case when public._normalize_range(p_range) = '30d' then 30 else 7 end as n
  ),
  days as (
    select ((now() at time zone p.tz)::date - g.i) as day, p.tz, p.n
    from params p, generate_series(0, (select n from params) - 1) as g (i)
  ),
  moves as (
    select (m.performed_at at time zone (select tz from params))::date as day,
           sum(m.quantity) filter (where m.move_type = 'RECEIPT'
             and (p_warehouse_id is null or d.warehouse_id = p_warehouse_id)) as inbound,
           sum(m.quantity) filter (where m.move_type = 'DELIVERY'
             and (p_warehouse_id is null or s.warehouse_id = p_warehouse_id)) as outbound
    from public.stock_moves m
    join public.locations s on s.id = m.source_location_id
    join public.locations d on d.id = m.destination_location_id
    where m.move_type in ('RECEIPT', 'DELIVERY')
      and m.performed_at >= now() - interval '31 days'
    group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'day', case when days.n = 30 then to_char(days.day, 'Mon DD') else to_char(days.day, 'Dy') end,
      'date', days.day,
      'inbound', coalesce(moves.inbound, 0),
      'outbound', coalesce(moves.outbound, 0),
      'total', coalesce(moves.inbound, 0) + coalesce(moves.outbound, 0)
    ) order by days.day), '[]'::jsonb)
  from days
  left join moves on moves.day = days.day;
$$;

-- ---------------------------------------------------------------------------
-- Stock level over time (mockStockMovement shape; values in units, not thousands)
-- ---------------------------------------------------------------------------
create function public.dashboard_stock_movement(p_range text default 'today', p_warehouse_id bigint default null)
returns jsonb
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_tz text := public.app_time_zone();
  v_local timestamp := now() at time zone v_tz;
  v_range text := coalesce(public._normalize_range(p_range), 'today');
  v_now_stock numeric := public._stock_now(p_warehouse_id);
  v_capacity numeric;
  v_target numeric;
  v_points jsonb;
begin
  select sum(capacity_units) into v_capacity
  from public.warehouses
  where active and (p_warehouse_id is null or id = p_warehouse_id);
  v_target := (select stock_target_units from public.app_settings where id = 1);

  with ticks as (
    -- Today: every 2 hours up to now. Otherwise: end of each day.
    select t, label from (
      select (date_trunc('day', v_local) + make_interval(hours => 2 * g)) at time zone v_tz as t,
             to_char(date_trunc('day', v_local) + make_interval(hours => 2 * g), 'HH24:MI') as label
      from generate_series(0, 11) g
      where v_range = 'today'
      union all
      select (d::date + 1)::timestamp at time zone v_tz,
             to_char(d, 'Mon DD')
      from generate_series(
             v_local::date - (case when v_range = '30d' then 29 when v_range = 'quarter' then 89 else 6 end),
             v_local::date - 1, interval '1 day') d
      where v_range <> 'today'
    ) x
    where t < now()
    union all
    select now(), to_char(v_local, case when v_range = 'today' then 'HH24:MI' else 'Mon DD' end)
  )
  select jsonb_agg(jsonb_build_object(
      'time', label,
      'stock', v_now_stock - public._net_since(t, p_warehouse_id),
      'capacity', v_capacity,
      'optimal', v_target
    ) order by t)
  into v_points
  from ticks;

  return coalesce(v_points, '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- Units on hand per category (mockCategoryData shape)
-- ---------------------------------------------------------------------------
create function public.dashboard_categories(p_warehouse_id bigint default null)
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  with per_category as (
    select r.category_id, sum(r.stock) as units
    from public.product_rows(p_warehouse_id) r
    where not r.archived
    group by r.category_id
  ),
  total as (select sum(units) as units from per_category)
  select coalesce(jsonb_agg(jsonb_build_object(
      'name', c.name,
      'count', pc.units,
      'percentage', round(pc.units / t.units * 100, 1),
      'color', c.color
    ) order by pc.units desc), '[]'::jsonb)
  from per_category pc
  join public.categories c on c.id = pc.category_id
  cross join total t
  where pc.units > 0;
$$;

-- ---------------------------------------------------------------------------
-- Best-selling products (mockFastMovingProducts shape)
-- velocity = sell-through: units shipped / (units shipped + units still on hand)
-- ---------------------------------------------------------------------------
create function public.dashboard_fast_moving(
  p_days int default 30,
  p_limit int default 6,
  p_warehouse_id bigint default null
)
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  with shipped as (
    select m.product_id,
           sum(m.quantity) filter (where m.performed_at > now() - make_interval(days => p_days)) as moved,
           sum(m.quantity) filter (where m.performed_at <= now() - make_interval(days => p_days)) as moved_before
    from public.stock_moves m
    join public.locations s on s.id = m.source_location_id
    where m.move_type = 'DELIVERY'
      and m.performed_at > now() - make_interval(days => 2 * p_days)
      and (p_warehouse_id is null or s.warehouse_id = p_warehouse_id)
    group by m.product_id
  ),
  ranked as (
    select r.id, r.name, r.sku, r.stock, sh.moved, sh.moved_before
    from shipped sh
    join public.product_rows(p_warehouse_id) r on r.id = sh.product_id
    where sh.moved > 0
    order by sh.moved desc
    limit p_limit
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', id,
      'name', name,
      'sku', sku,
      'unitsMoved', moved,
      'stockLevel', stock,
      'velocity', round(moved / (moved + stock) * 100) || '%',
      'trend', case when coalesce(moved_before, 0) = 0 then 'New'
                    else public._fmt_change(moved, moved_before) end
    ) order by moved desc), '[]'::jsonb)
  from ranked;
$$;

-- ---------------------------------------------------------------------------
-- Monthly performance (mockPerformanceData shape)
--   turnover    annualised: units shipped / average stock, scaled to a year
--   fulfillment % of deliveries validated on or before their scheduled date
--   accuracy    100 - adjustment units as % of average stock
--   volume      all units moved (receipts, deliveries, transfers, adjustments)
-- ---------------------------------------------------------------------------
create function public.dashboard_performance(p_months int default 6, p_warehouse_id bigint default null)
returns jsonb
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_tz text := public.app_time_zone();
  v_now_stock numeric := public._stock_now(p_warehouse_id);
  v_month date;
  v_start timestamptz;
  v_end timestamptz;
  v_days numeric;
  v_stock_start numeric;
  v_stock_end numeric;
  v_avg numeric;
  v_outbound numeric;
  v_adjusted numeric;
  v_volume numeric;
  v_done int;
  v_on_time int;
  v_result jsonb := '[]'::jsonb;
begin
  for v_month in
    select generate_series(
      date_trunc('month', now() at time zone v_tz)::date - make_interval(months => p_months - 1),
      date_trunc('month', now() at time zone v_tz)::date,
      interval '1 month')::date
  loop
    v_start := v_month::timestamp at time zone v_tz;
    v_end := least((v_month + interval '1 month')::timestamp at time zone v_tz, now());
    v_days := greatest(extract(epoch from v_end - v_start) / 86400, 1);

    v_stock_start := v_now_stock - public._net_since(v_start, p_warehouse_id);
    v_stock_end := v_now_stock - public._net_since(v_end, p_warehouse_id);
    v_avg := (v_stock_start + v_stock_end) / 2;

    select
      coalesce(sum(m.quantity) filter (where m.move_type = 'DELIVERY'), 0),
      coalesce(sum(m.quantity) filter (where m.move_type = 'ADJUSTMENT'), 0),
      coalesce(sum(m.quantity) filter (where m.move_type <> 'INITIAL'), 0)
    into v_outbound, v_adjusted, v_volume
    from public.stock_moves m
    join public.locations s on s.id = m.source_location_id
    join public.locations d on d.id = m.destination_location_id
    where m.performed_at >= v_start and m.performed_at < v_end
      and (p_warehouse_id is null
           or (s.type = 'INTERNAL' and s.warehouse_id = p_warehouse_id)
           or (d.type = 'INTERNAL' and d.warehouse_id = p_warehouse_id));

    select count(*),
           count(*) filter (where o.scheduled_date is null
                            or (o.validated_at at time zone v_tz)::date <= o.scheduled_date)
    into v_done, v_on_time
    from public.operations o
    join public.locations s on s.id = o.source_location_id
    where o.type = 'DELIVERY' and o.state = 'DONE'
      and o.validated_at >= v_start and o.validated_at < v_end
      and (p_warehouse_id is null or s.warehouse_id = p_warehouse_id);

    v_result := v_result || jsonb_build_array(jsonb_build_object(
      'month', to_char(v_month, 'Mon'),
      'turnover', case when v_avg > 0 then round(v_outbound / v_avg * 365 / v_days, 1) end,
      'fulfillment', case when v_done > 0 then round(v_on_time * 100.0 / v_done, 1) end,
      'accuracy', case when v_avg > 0 then greatest(round(100 - v_adjusted / v_avg * 100, 1), 0) end,
      'volume', v_volume));
  end loop;
  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Analytics page KPI strip
-- ---------------------------------------------------------------------------
create function public.analytics_kpis(p_warehouse_id bigint default null)
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  with rows as (
    select * from public.product_rows(p_warehouse_id) where not archived
  ),
  shipped_30 as (
    select coalesce(sum(m.quantity), 0) as units
    from public.stock_moves m
    join public.locations s on s.id = m.source_location_id
    where m.move_type = 'DELIVERY' and m.performed_at > now() - interval '30 days'
      and (p_warehouse_id is null or s.warehouse_id = p_warehouse_id)
  ),
  dead as (
    -- In stock but not shipped for 90 days.
    select coalesce(sum(r.stock * r.price), 0) as value
    from rows r
    where r.stock > 0 and not exists (
      select 1 from public.stock_moves m
      where m.product_id = r.id and m.move_type = 'DELIVERY'
        and m.performed_at > now() - interval '90 days')
  ),
  totals as (
    select coalesce(sum(stock * price), 0) as valuation, coalesce(sum(stock), 0) as units from rows
  )
  select jsonb_build_object(
    'inventoryValuation', round(t.valuation, 2),
    'totalUnits', t.units,
    'unitsShipped30d', s.units,
    'averageDaysOnHand', case when s.units > 0 then round(t.units / (s.units / 30.0), 1) end,
    -- No cost price is stored, so GMROI can't be computed honestly.
    'gmroi', null,
    'deadStockValue', round(d.value, 2),
    'deadStockPercent', case when t.valuation > 0 then round(d.value / t.valuation * 100, 2) else 0 end
  )
  from totals t, shipped_30 s, dead d;
$$;

-- ---------------------------------------------------------------------------
-- Low stock
-- ---------------------------------------------------------------------------
create function public.low_stock_rows(p_warehouse_id bigint default null)
returns table (
  id              bigint,
  name            text,
  sku             text,
  category        text,
  stock           numeric,
  min_stock       numeric,
  recommended_qty numeric,
  unit            text,
  warehouse       text,
  warehouse_id    bigint,
  status          text,
  days_of_cover   numeric
)
language sql
stable
set search_path = public, pg_temp
as $$
  select
    r.id, r.name, r.sku, r.category, r.stock, r.min_stock,
    -- Enough to reach min x multiplier (Settings), unless the rule fixes a reorder qty.
    greatest(coalesce(r.reorder_qty, r.min_stock * coalesce(s.reorder_multiplier, 3) - r.stock), 1),
    r.unit, r.warehouse, r.warehouse_id, r.status,
    case when o.daily > 0 then round(r.stock / o.daily, 1) end
  from public.product_rows(p_warehouse_id) r
  left join public.app_settings s on s.id = 1
  left join lateral (
    select sum(m.quantity) / 30.0 as daily
    from public.stock_moves m
    where m.product_id = r.id and m.move_type = 'DELIVERY'
      and m.performed_at > now() - interval '30 days'
  ) o on true
  where not r.archived and r.status <> 'In Stock'
  order by (r.status = 'Out of Stock') desc, r.stock / nullif(r.min_stock, 0) nulls first, r.name;
$$;

create function public.low_stock_summary(p_warehouse_id bigint default null)
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  with r as (
    select p.*,
      (select sum(m.quantity) / 30.0 from public.stock_moves m
       where m.product_id = p.id and m.move_type = 'DELIVERY'
         and m.performed_at > now() - interval '30 days') as daily
    from public.product_rows(p_warehouse_id) p
    where not p.archived
  )
  select jsonb_build_object(
    'totalCount', count(*) filter (where status <> 'In Stock'),
    'lowStockCount', count(*) filter (where status = 'Low Stock'),
    'outOfStockCount', count(*) filter (where status = 'Out of Stock'),
    'criticalCount', count(*) filter (where stock <= 0 or (min_stock > 0 and stock <= min_stock * 0.5)),
    -- Will run out within 72 hours at the last 30 days' shipping rate.
    'projectedStockouts72h', count(*) filter (where stock > 0 and daily > 0 and stock / daily < 3)
  )
  from r;
$$;

-- Draft a receipt for one product (the Low Stock page's "Reorder" button).
create function public.reorder_product(p_product_id bigint, p_quantity numeric default null)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user public.profiles := public._require_user();
  v_row record;
  v_warehouse_id bigint;
  v_qty numeric;
begin
  select r.*, s.reorder_multiplier, s.default_warehouse_id
  into v_row
  from public.product_rows(null) r
  left join public.app_settings s on s.id = 1
  where r.id = p_product_id and not r.archived;
  if not found then
    raise exception using errcode = 'PT404', message = 'Product not found';
  end if;

  v_qty := coalesce(p_quantity,
    greatest(coalesce(v_row.reorder_qty, v_row.min_stock * coalesce(v_row.reorder_multiplier, 3) - v_row.stock), 1));
  v_warehouse_id := coalesce(v_row.warehouse_id, v_row.default_warehouse_id,
    (select min(id) from public.warehouses where active));

  return public._create_operation('RECEIPT', jsonb_build_object(
    'warehouseId', v_warehouse_id,
    'notes', 'Reorder raised from Low Stock alerts',
    'lines', jsonb_build_array(jsonb_build_object('productId', p_product_id, 'quantity', v_qty))
  ), v_user.id, now());
end;
$$;

-- "Generate Bulk Purchase Orders": one draft receipt per warehouse for every
-- low-stock product that isn't already on an open receipt.
create function public.reorder_low_stock(p_warehouse_id bigint default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user public.profiles := public._require_user();
  v_group record;
  v_id bigint;
  v_created jsonb := '[]'::jsonb;
  v_fallback bigint := coalesce(
    (select default_warehouse_id from public.app_settings where id = 1),
    (select min(id) from public.warehouses where active));
begin
  for v_group in
    select coalesce(l.warehouse_id, v_fallback) as warehouse_id,
           jsonb_agg(jsonb_build_object('productId', l.id, 'quantity', l.recommended_qty)) as lines
    from public.low_stock_rows(p_warehouse_id) l
    where not exists (
      select 1 from public.operation_lines ln
      join public.operations o on o.id = ln.operation_id
      where ln.product_id = l.id and o.type = 'RECEIPT' and o.state in ('DRAFT', 'WAITING', 'READY'))
    group by coalesce(l.warehouse_id, v_fallback)
  loop
    v_id := public._create_operation('RECEIPT', jsonb_build_object(
      'warehouseId', v_group.warehouse_id,
      'notes', 'Bulk reorder raised from Low Stock alerts',
      'lines', v_group.lines), v_user.id, now());
    v_created := v_created || jsonb_build_array(jsonb_build_object(
      'id', v_id, 'reference', (select reference from public.operations where id = v_id)));
  end loop;
  return v_created;
end;
$$;
