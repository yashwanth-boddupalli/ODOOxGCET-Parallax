-- StockSense demo data.
-- Safe to run once on an empty database (it does nothing if products exist).
-- Everything goes through the stock engine, so quants and ledger always agree.
-- Final stock levels match the frontend's original mock data.

begin;

-- Run one document through the full lifecycle at a given time.
create function pg_temp.seed_done(p_type text, p_payload jsonb, p_at timestamptz)
returns bigint
language plpgsql
as $$
declare
  v_id bigint;
begin
  v_id := public._create_operation(p_type::public.operation_type, p_payload, null, p_at);
  perform public._confirm_operation(v_id);
  perform public._validate_operation(v_id, null, null, false, true, p_at);
  return v_id;
end;
$$;

do $$
declare
  v_people text[] := array['Alex Rivera', 'Sarah Chen', 'David Kumar', 'Marcus Vance', 'Elena Rostova'];
  v_vendors text[] := array['Apex Components Pvt Ltd', 'Deccan Electronics', 'Hyderabad Textiles Co.', 'Sri Venkateswara Traders'];
  v_customers text[] := array['Reliance Retail', 'Croma Stores', 'Infosys Campus Ops', 'Amazon Fulfilment IN', 'Metro Cash & Carry'];

  v_main bigint; v_north bigint; v_south bigint; v_west bigint;
  v_main_stock bigint; v_rack bigint; v_south_stock bigint; v_west_stock bigint;
  v_start timestamptz := now() - interval '26 weeks';

  v_p record;
  v_idx int := 0;
  v_w int;
  v_s numeric;
  v_r numeric; v_d1 numeric; v_d2 numeric; v_k numeric;
  v_weeks jsonb;
  v_ev jsonb;
  v_base timestamptz;
  v_id bigint;
  v_steel bigint;
  v_warehouse bigint;
begin
  if exists (select 1 from public.products) then
    raise notice 'Seed skipped: products already exist';
    return;
  end if;

  perform setseed(0.42);  -- same "random" history every time

  -- Warehouses (names and addresses from the original mockWarehouses)
  v_main  := public._create_warehouse('Main Central Hub',         'HUB-MUM-01', 'Hyderabad Central Logistics Park', 400);
  v_north := public._create_warehouse('North Logistics Depot',    'DEP-DEL-02', 'Secunderabad Industrial Zone', 160);
  v_south := public._create_warehouse('South Fulfillment Center', 'FUL-BLR-03', 'Gachibowli Gateway Area', 750);
  v_west  := public._create_warehouse('West Coast Facility',      'FAC-BOM-04', 'Kukatpally Depot Complex', 180);
  v_rack  := public._create_location(v_main, 'Production Rack', null);
  select id into v_main_stock  from public.locations where warehouse_id = v_main  and is_default;
  select id into v_south_stock from public.locations where warehouse_id = v_south and is_default;
  select id into v_west_stock  from public.locations where warehouse_id = v_west  and is_default;

  update public.app_settings
  set workspace_name = 'StockSense Enterprise', default_warehouse_id = v_main, stock_target_units = 1100
  where id = 1;

  insert into public.categories (name, color) values
    ('Electronics',   '#2563eb'),
    ('Accessories',   '#6366f1'),
    ('Industrial',    '#f59e0b'),
    ('Apparel',       '#059669'),
    ('Equipment',     '#0ea5e9'),
    ('Raw Materials', '#64748b');

  -- Products. "target" = stock today; "weekly" = typical units shipped per week.
  create temp table seed_products (
    name text, sku text, category text, min_stock numeric, price numeric,
    warehouse_id bigint, unit text, target numeric, weekly numeric, id bigint
  ) on commit drop;
  insert into seed_products values
    ('UltraBook Pro 15" M2',           'ELC-NB-109', 'Electronics', 30,  1299.00, v_main,  'pcs', 148, 40, null),
    ('Pro Wireless Earbuds Gen 2',     'ELC-AU-302', 'Electronics', 25,   179.00, v_west,  'pcs',  82, 32, null),
    ('USB-C Fast Charging Hub 100W',   'ACC-CH-441', 'Accessories', 50,    69.50, v_south, 'pcs', 210, 30, null),
    ('Precision Ergonomic Mouse',      'ACC-PE-220', 'Accessories', 20,    89.00, v_main,  'pcs',  65, 25, null),
    ('Studio Monitor 27" 4K HDR',      'ELC-MN-505', 'Electronics', 20,   499.00, v_north, 'pcs',  18, 12, null),
    ('Industrial Smart Sensor Hub v3', 'IND-SN-012', 'Industrial',  15,   245.00, v_north, 'pcs',  94, 10, null),
    ('Thermal Barcode Scanner Pro',    'EQP-SC-889', 'Equipment',   15,   320.00, v_main,  'pcs',  12,  6, null),
    ('High-Vis Warehouse Vest (L)',    'APP-WF-008', 'Apparel',     100,   24.00, v_south, 'pcs', 450, 45, null);

  for v_p in select * from seed_products loop
    update seed_products
    set id = public._create_product(v_p.name, v_p.sku, v_p.category, null, 0, null, v_p.warehouse_id,
                                    v_p.price, v_p.min_stock, v_p.unit, null, null, v_start - interval '2 days')
    where sku = v_p.sku;
  end loop;

  -- History. Work backwards from today's target so the replay never oversells:
  -- per week: a receipt, two deliveries, and every 5th week a small damage write-off.
  -- Each product uses slightly different weekdays so every day has some activity.
  for v_p in select * from seed_products order by sku loop
    v_idx := v_idx + 1;
    v_s := v_p.target;
    v_weeks := '[]'::jsonb;
    for v_w in 1..25 loop
      v_d1 := round(v_p.weekly * (0.35 + random() * 0.35));
      v_d2 := round(v_p.weekly * (0.35 + random() * 0.35));
      v_k := case when v_w % 5 = 0 then 1 + floor(random() * 2) else 0 end;
      v_s := v_s + v_k + v_d2 + v_d1;                 -- stock right after the week's receipt
      -- Restock whenever stock would sit well above its normal level, keeping it near target.
      v_r := case when v_w % 4 = 0 or v_s > greatest(v_p.target, v_p.weekly * 2) * 1.25
                  then greatest(round(v_s - greatest(v_p.target, v_p.weekly * 2) * (0.6 + random() * 0.4)), 0)
                  else 0 end;
      v_s := v_s - v_r;                               -- stock at the start of the week
      v_weeks := jsonb_build_array(jsonb_build_object('w', v_w, 'r', v_r, 'd1', v_d1, 'd2', v_d2, 'k', v_k)) || v_weeks;
    end loop;

    -- Opening stock 26 weeks ago.
    if v_s > 0 then
      perform pg_temp.seed_done('RECEIPT', jsonb_build_object(
        'warehouseId', v_p.warehouse_id, 'partnerName', v_vendors[1 + v_idx % 4],
        'responsibleName', v_people[1 + v_idx % 5], 'notes', 'Opening stock',
        'lines', jsonb_build_array(jsonb_build_object('productId', v_p.id, 'quantity', v_s))),
        v_start + make_interval(hours => 9, mins => v_idx * 7));
    end if;

    -- Replay forwards (oldest week first).
    for v_ev in select * from jsonb_array_elements(v_weeks) loop
      v_w := (v_ev ->> 'w')::int;
      v_base := date_trunc('day', now()) - make_interval(days => v_w * 7)
                + make_interval(hours => 9, mins => v_idx * 37);

      if (v_ev ->> 'r')::numeric > 0 then
        perform pg_temp.seed_done('RECEIPT', jsonb_build_object(
          'warehouseId', v_p.warehouse_id, 'partnerName', v_vendors[1 + (v_w + v_idx) % 4],
          'responsibleName', v_people[1 + (v_w + v_idx) % 5],
          'lines', jsonb_build_array(jsonb_build_object('productId', v_p.id, 'quantity', (v_ev ->> 'r')::numeric))),
          v_base + make_interval(days => 1 + v_idx % 2));
      end if;

      if (v_ev ->> 'd1')::numeric > 0 then
        perform pg_temp.seed_done('DELIVERY', jsonb_build_object(
          'warehouseId', v_p.warehouse_id, 'partnerName', v_customers[1 + (v_w + v_idx) % 5],
          'responsibleName', v_people[1 + (v_w + v_idx + 1) % 5],
          -- Roughly one delivery in twelve ships a day late.
          'scheduledDate', ((v_base + make_interval(days => 2 + v_idx % 3))::date - case when random() < 0.08 then 1 else 0 end)::text,
          'lines', jsonb_build_array(jsonb_build_object('productId', v_p.id, 'quantity', (v_ev ->> 'd1')::numeric))),
          v_base + make_interval(days => 2 + v_idx % 3, hours => 3));
      end if;

      if (v_ev ->> 'd2')::numeric > 0 then
        perform pg_temp.seed_done('DELIVERY', jsonb_build_object(
          'warehouseId', v_p.warehouse_id, 'partnerName', v_customers[1 + (v_w + v_idx + 2) % 5],
          'responsibleName', v_people[1 + (v_w + v_idx + 2) % 5],
          'scheduledDate', ((v_base + make_interval(days => 4 + v_idx % 2))::date)::text,
          'lines', jsonb_build_array(jsonb_build_object('productId', v_p.id, 'quantity', (v_ev ->> 'd2')::numeric))),
          v_base + make_interval(days => 4 + v_idx % 2, hours => 5));
      end if;

      if (v_ev ->> 'k')::numeric > 0 then
        perform pg_temp.seed_done('ADJUSTMENT', jsonb_build_object(
          'warehouseId', v_p.warehouse_id, 'reason', 'Damaged in handling',
          'responsibleName', v_people[1 + (v_w + v_idx + 3) % 5],
          'lines', jsonb_build_array(jsonb_build_object('productId', v_p.id,
            'countedQuantity', public._stock_now(v_p.warehouse_id, v_p.id) - (v_ev ->> 'k')::numeric))),
          v_base + make_interval(days => 6, hours => 6));
      end if;
    end loop;
  end loop;

  -- A completed inter-warehouse transfer (total stock unchanged).
  select id into v_id from seed_products where sku = 'ACC-CH-441';
  perform pg_temp.seed_done('TRANSFER', jsonb_build_object(
    'sourceWarehouseId', v_south, 'destinationWarehouseId', v_main, 'responsibleName', 'David Kumar',
    'lines', jsonb_build_array(jsonb_build_object('productId', v_id, 'quantity', 20))),
    date_trunc('day', now()) - interval '1 day' + interval '15 hours');

  -- Today's activity: in and out again, so today's totals don't change.
  select id into v_id from seed_products where sku = 'ELC-AU-302';
  perform pg_temp.seed_done('RECEIPT', jsonb_build_object('warehouseId', v_west, 'partnerName', 'Deccan Electronics',
    'responsibleName', 'Alex Rivera', 'lines', jsonb_build_array(jsonb_build_object('productId', v_id, 'quantity', 12))),
    now() - interval '3 hours');
  perform pg_temp.seed_done('DELIVERY', jsonb_build_object('warehouseId', v_west, 'partnerName', 'Croma Stores',
    'responsibleName', 'Sarah Chen', 'scheduledDate', (now()::date)::text,
    'lines', jsonb_build_array(jsonb_build_object('productId', v_id, 'quantity', 12))),
    now() - interval '1 hour');

  -- The steel story from the brief: +100 -> move to the rack -> -20 -> -3 damaged. Ends at 77 kg.
  v_steel := public._create_product('Steel Rod 12mm', 'RAW-ST-012', 'Raw Materials', null, 0, null, v_main,
                                    0.95, 50, 'kg', null, null, now() - interval '10 days');
  perform pg_temp.seed_done('RECEIPT', jsonb_build_object('warehouseId', v_main, 'partnerName', 'Tata Steel Ltd',
    'responsibleName', 'Elena Rostova', 'lines', jsonb_build_array(jsonb_build_object('productId', v_steel, 'quantity', 100))),
    now() - interval '4 days');
  perform pg_temp.seed_done('TRANSFER', jsonb_build_object('sourceLocationId', v_main_stock, 'destinationLocationId', v_rack,
    'responsibleName', 'Marcus Vance', 'lines', jsonb_build_array(jsonb_build_object('productId', v_steel, 'quantity', 100))),
    now() - interval '3 days');
  perform pg_temp.seed_done('DELIVERY', jsonb_build_object('locationId', v_rack, 'partnerName', 'Metro Cash & Carry',
    'responsibleName', 'Sarah Chen', 'scheduledDate', ((now() - interval '2 days')::date)::text,
    'lines', jsonb_build_array(jsonb_build_object('productId', v_steel, 'quantity', 20))),
    now() - interval '2 days');
  perform pg_temp.seed_done('ADJUSTMENT', jsonb_build_object('locationId', v_rack, 'reason', 'Damaged',
    'responsibleName', 'David Kumar', 'lines', jsonb_build_array(jsonb_build_object('productId', v_steel, 'countedQuantity', 77))),
    now() - interval '1 day');

  -- Open documents so every status shows up in the UI.
  select id into v_id from seed_products where sku = 'ACC-PE-220';      -- Pending receipt
  perform public._create_operation('RECEIPT', jsonb_build_object('warehouseId', v_main, 'partnerName', 'Apex Components Pvt Ltd',
    'responsibleName', 'Elena Rostova', 'scheduledDate', ((now() + interval '2 days')::date)::text,
    'lines', jsonb_build_array(jsonb_build_object('productId', v_id, 'quantity', 150))), null, now() - interval '50 minutes');

  select id into v_id from seed_products where sku = 'ELC-MN-505';      -- Waiting for stock
  v_id := public._create_operation('DELIVERY', jsonb_build_object('warehouseId', v_north, 'partnerName', 'Infosys Campus Ops',
    'responsibleName', 'Sarah Chen', 'scheduledDate', ((now() + interval '1 day')::date)::text,
    'lines', jsonb_build_array(jsonb_build_object('productId', v_id, 'quantity', 45))), null, now() - interval '40 minutes');
  perform public._confirm_operation(v_id);

  select id into v_id from seed_products where sku = 'IND-SN-012';      -- Ready to ship
  v_id := public._create_operation('DELIVERY', jsonb_build_object('warehouseId', v_north, 'partnerName', 'Reliance Retail',
    'responsibleName', 'Sarah Chen', 'scheduledDate', ((now() + interval '1 day')::date)::text,
    'lines', jsonb_build_array(jsonb_build_object('productId', v_id, 'quantity', 25))), null, now() - interval '30 minutes');
  perform public._confirm_operation(v_id);

  select id into v_id from seed_products where sku = 'EQP-SC-889';      -- Ready transfer
  v_id := public._create_operation('TRANSFER', jsonb_build_object('sourceWarehouseId', v_main, 'destinationWarehouseId', v_west,
    'responsibleName', 'Alex Rivera', 'lines', jsonb_build_array(jsonb_build_object('productId', v_id, 'quantity', 5))),
    null, now() - interval '20 minutes');
  perform public._confirm_operation(v_id);

  select id into v_id from seed_products where sku = 'APP-WF-008';      -- Cancelled count
  v_id := public._create_operation('ADJUSTMENT', jsonb_build_object('warehouseId', v_south, 'reason', 'Cycle count',
    'responsibleName', 'David Kumar', 'lines', jsonb_build_array(jsonb_build_object('productId', v_id, 'countedQuantity', 500))),
    null, now() - interval '10 minutes');
  perform public._cancel_operation(v_id);
end;
$$;

commit;
