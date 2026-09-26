-- Stock engine and write API.
--
-- Layout:
--   _private helpers (prefixed with "_") do the work and take the acting user
--   as a parameter so the seed script can reuse them.
--   Public RPCs check who is calling, then delegate to a helper.
--
-- Every RPC runs in one transaction (PostgREST wraps each call), so any
-- RAISE rolls back everything the call did.
--
-- Error codes: PostgREST turns SQLSTATE 'PTxyz' into HTTP status xyz, and
-- supabase-js exposes the message as error.message.
--   PT400 bad input · PT401 not signed in · PT403 not allowed
--   PT404 not found · PT409 conflict (state, stock, duplicate)

-- ---------------------------------------------------------------------------
-- Caller checks
-- ---------------------------------------------------------------------------
create function public._require_user()
returns public.profiles
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v public.profiles;
begin
  select * into v from public.profiles where id = auth.uid();
  if not found then
    raise exception using errcode = 'PT401', message = 'Please sign in to continue.';
  end if;
  if not v.active then
    raise exception using errcode = 'PT403', message = 'Your account has been deactivated.';
  end if;
  return v;
end;
$$;

create function public._require_manager()
returns public.profiles
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v public.profiles := public._require_user();
begin
  if v.role <> 'MANAGER' then
    raise exception using errcode = 'PT403', message = 'Only inventory managers can do this.';
  end if;
  return v;
end;
$$;

-- ---------------------------------------------------------------------------
-- Lookups
-- ---------------------------------------------------------------------------
create function public._virtual_location(p_type public.location_type)
returns bigint
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_id bigint;
begin
  select id into v_id from public.locations where type = p_type and warehouse_id is null;
  if v_id is null then
    raise exception using errcode = 'PT409', message = format('Virtual location %s is missing', p_type);
  end if;
  return v_id;
end;
$$;

-- A real location, given either directly or as "the default location of a warehouse".
create function public._internal_location(p_location_id bigint, p_warehouse_id bigint, p_what text)
returns bigint
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_id bigint;
begin
  if p_location_id is not null then
    select id into v_id from public.locations
    where id = p_location_id and type = 'INTERNAL' and active;
    if v_id is null then
      raise exception using errcode = 'PT400', message = format('%s location not found', p_what);
    end if;
  elsif p_warehouse_id is not null then
    select l.id into v_id
    from public.locations l
    join public.warehouses w on w.id = l.warehouse_id
    where l.warehouse_id = p_warehouse_id and l.is_default and l.active and w.active;
    if v_id is null then
      raise exception using errcode = 'PT400', message = format('%s warehouse not found', p_what);
    end if;
  else
    raise exception using errcode = 'PT400', message = format('Choose a %s warehouse', lower(p_what));
  end if;
  return v_id;
end;
$$;

-- Accepts an id or a name/code (the Add Product modal sends names).
create function public._resolve_warehouse(p_id bigint, p_name text)
returns bigint
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_id bigint;
begin
  if p_id is not null then
    select id into v_id from public.warehouses where id = p_id;
  elsif nullif(trim(p_name), '') is not null then
    select id into v_id from public.warehouses
    where lower(name) = lower(trim(p_name)) or upper(code) = upper(trim(p_name));
  else
    return null;
  end if;
  if v_id is null then
    raise exception using errcode = 'PT400', message = format('Warehouse "%s" not found', coalesce(p_name, p_id::text));
  end if;
  return v_id;
end;
$$;

create function public._resolve_category(p_id bigint, p_name text)
returns bigint
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_id bigint;
begin
  if p_id is not null then
    select id into v_id from public.categories where id = p_id;
  elsif nullif(trim(p_name), '') is not null then
    select id into v_id from public.categories where lower(name) = lower(trim(p_name));
  else
    raise exception using errcode = 'PT400', message = 'Choose a category';
  end if;
  if v_id is null then
    raise exception using errcode = 'PT400', message = format('Category "%s" not found', coalesce(p_name, p_id::text));
  end if;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Document numbers: PO-2026-0001, DO-..., TR-..., ADJ-...
-- The UPDATE row lock serialises concurrent callers, so numbers never repeat.
-- ---------------------------------------------------------------------------
create function public._next_reference(p_type public.operation_type, p_at timestamptz)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_prefix text := case p_type
    when 'RECEIPT' then 'PO' when 'DELIVERY' then 'DO'
    when 'TRANSFER' then 'TR' else 'ADJ' end;
  v_year int := extract(year from p_at at time zone public.app_time_zone())::int;
  v_n int;
begin
  insert into public.reference_sequences (prefix, year) values (v_prefix, v_year)
  on conflict do nothing;

  update public.reference_sequences
  set next_value = next_value + 1
  where prefix = v_prefix and year = v_year
  returning next_value - 1 into v_n;

  return format('%s-%s-%s', v_prefix, v_year, lpad(v_n::text, 4, '0'));
end;
$$;

-- ---------------------------------------------------------------------------
-- Quant locking and the single place where stock changes
-- ---------------------------------------------------------------------------

-- Make sure the quant row exists, then lock it. Returns the quantity on hand.
create function public._lock_quant(p_product_id bigint, p_location_id bigint)
returns numeric
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_qty numeric;
begin
  insert into public.stock_quants (product_id, location_id, quantity)
  values (p_product_id, p_location_id, 0)
  on conflict do nothing;

  select quantity into v_qty
  from public.stock_quants
  where product_id = p_product_id and location_id = p_location_id
  for update;

  return v_qty;
end;
$$;

-- Moves stock and writes the ledger row. Callers must already hold the locks
-- (see _validate_operation) so that locks are always taken in the same order.
create function public._apply_move(
  p_product_id bigint,
  p_source_id bigint,
  p_destination_id bigint,
  p_quantity numeric,
  p_move_type public.move_type,
  p_reference text,
  p_operation_id bigint,
  p_line_id bigint,
  p_user_id uuid,
  p_user_name text,
  p_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_source public.v_locations;
  v_destination public.v_locations;
  v_available numeric;
  v_sku text;
begin
  if p_quantity is null or p_quantity <= 0 then
    return;
  end if;

  select * into v_source from public.v_locations where id = p_source_id;
  select * into v_destination from public.v_locations where id = p_destination_id;

  if v_source.type = 'INTERNAL' then
    v_available := public._lock_quant(p_product_id, p_source_id);
    if v_available < p_quantity then
      select sku into v_sku from public.products where id = p_product_id;
      raise exception using errcode = 'PT409', message = format(
        'Not enough stock for %s at %s: %s available, %s requested',
        v_sku, v_source.label, trim_scale(v_available), trim_scale(p_quantity));
    end if;
    update public.stock_quants
    set quantity = quantity - p_quantity, updated_at = p_at
    where product_id = p_product_id and location_id = p_source_id;
  end if;

  if v_destination.type = 'INTERNAL' then
    perform public._lock_quant(p_product_id, p_destination_id);
    update public.stock_quants
    set quantity = quantity + p_quantity, updated_at = p_at
    where product_id = p_product_id and location_id = p_destination_id;
  end if;

  insert into public.stock_moves (
    operation_id, operation_line_id, product_id, source_location_id, destination_location_id,
    quantity, move_type, reference, performed_by, performed_by_name, performed_at)
  values (
    p_operation_id, p_line_id, p_product_id, p_source_id, p_destination_id,
    p_quantity, p_move_type, p_reference, p_user_id, coalesce(p_user_name, ''), p_at);
end;
$$;

-- READY if every line can be served from the source location, otherwise WAITING.
-- Receipts and adjustments are always READY (nothing leaves a real location up front).
create function public._availability_state(p_operation_id bigint)
returns public.operation_state
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_op public.operations;
begin
  select * into v_op from public.operations where id = p_operation_id;
  if v_op.type in ('RECEIPT', 'ADJUSTMENT') then
    return 'READY';
  end if;

  if exists (
    select 1
    from public.operation_lines ln
    left join public.stock_quants q
      on q.product_id = ln.product_id and q.location_id = v_op.source_location_id
    where ln.operation_id = p_operation_id
      and ln.quantity > coalesce(q.quantity, 0)
  ) then
    return 'WAITING';
  end if;
  return 'READY';
end;
$$;

-- ---------------------------------------------------------------------------
-- Operation documents
-- ---------------------------------------------------------------------------

-- Where stock comes from and goes to, per document type.
create function public._operation_locations(
  p_type public.operation_type,
  p_payload jsonb,
  out o_source bigint,
  out o_destination bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  case p_type
    when 'RECEIPT' then       -- Vendor -> Internal
      o_source := public._virtual_location('VENDOR');
      o_destination := public._internal_location(
        (p_payload ->> 'locationId')::bigint, (p_payload ->> 'warehouseId')::bigint, 'Destination');
    when 'DELIVERY' then      -- Internal -> Customer
      o_source := public._internal_location(
        (p_payload ->> 'locationId')::bigint, (p_payload ->> 'warehouseId')::bigint, 'Source');
      o_destination := public._virtual_location('CUSTOMER');
    when 'TRANSFER' then      -- Internal -> Internal
      o_source := public._internal_location(
        (p_payload ->> 'sourceLocationId')::bigint, (p_payload ->> 'sourceWarehouseId')::bigint, 'Source');
      o_destination := public._internal_location(
        (p_payload ->> 'destinationLocationId')::bigint, (p_payload ->> 'destinationWarehouseId')::bigint, 'Destination');
      if o_source = o_destination then
        raise exception using errcode = 'PT400', message = 'Source and destination must be different locations';
      end if;
    when 'ADJUSTMENT' then    -- Internal <-> Inventory adjustment (direction decided on validation)
      o_source := public._internal_location(
        (p_payload ->> 'locationId')::bigint, (p_payload ->> 'warehouseId')::bigint, 'Adjustment');
      o_destination := public._virtual_location('INVENTORY_LOSS');
  end case;
end;
$$;

create function public._insert_lines(p_operation_id bigint, p_type public.operation_type, p_lines jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_line jsonb;
  v_product_id bigint;
  v_qty numeric;
begin
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception using errcode = 'PT400', message = 'Add at least one product line';
  end if;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_product_id := (v_line ->> 'productId')::bigint;
    if not exists (select 1 from public.products where id = v_product_id and not archived) then
      raise exception using errcode = 'PT400', message = 'Unknown or archived product on a line';
    end if;

    begin
      if p_type = 'ADJUSTMENT' then
        v_qty := (v_line ->> 'countedQuantity')::numeric;
        if v_qty is null or v_qty < 0 then
          raise exception using errcode = 'PT400', message = 'Counted quantity must be zero or more';
        end if;
        insert into public.operation_lines (operation_id, product_id, quantity, counted_quantity)
        values (p_operation_id, v_product_id, 0, v_qty);
      else
        v_qty := (v_line ->> 'quantity')::numeric;
        if v_qty is null or v_qty <= 0 then
          raise exception using errcode = 'PT400', message = 'Quantity must be greater than zero';
        end if;
        insert into public.operation_lines (operation_id, product_id, quantity)
        values (p_operation_id, v_product_id, v_qty);
      end if;
    exception when unique_violation then
      raise exception using errcode = 'PT400', message = 'Each product can appear only once per document';
    end;
  end loop;
end;
$$;

create function public._create_operation(
  p_type public.operation_type,
  p_payload jsonb,
  p_user_id uuid,
  p_at timestamptz default now()
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_locations record;
  v_responsible uuid := coalesce((p_payload ->> 'responsibleId')::uuid, p_user_id);
  v_id bigint;
begin
  select * into v_locations from public._operation_locations(p_type, p_payload);

  insert into public.operations (
    reference, type, state, source_location_id, destination_location_id,
    partner_name, reason, notes, scheduled_date,
    responsible_id, responsible_name, created_by, created_at, updated_at)
  values (
    public._next_reference(p_type, p_at), p_type, 'DRAFT',
    v_locations.o_source, v_locations.o_destination,
    coalesce(trim(p_payload ->> 'partnerName'), ''),
    coalesce(trim(p_payload ->> 'reason'), ''),
    coalesce(trim(p_payload ->> 'notes'), ''),
    nullif(p_payload ->> 'scheduledDate', '')::date,
    v_responsible,
    coalesce((select full_name from public.profiles where id = v_responsible),
             nullif(p_payload ->> 'responsibleName', ''), ''),
    p_user_id, p_at, p_at)
  returning id into v_id;

  perform public._insert_lines(v_id, p_type, p_payload -> 'lines');
  return v_id;
end;
$$;

create function public._lock_operation(p_operation_id bigint)
returns public.operations
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_op public.operations;
begin
  select * into v_op from public.operations where id = p_operation_id for update;
  if not found then
    raise exception using errcode = 'PT404', message = 'Document not found';
  end if;
  return v_op;
end;
$$;

create function public._update_operation(p_operation_id bigint, p_payload jsonb)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_op public.operations := public._lock_operation(p_operation_id);
  v_locations record;
  v_responsible uuid;
begin
  if v_op.state in ('DONE', 'CANCELLED') then
    raise exception using errcode = 'PT409', message = format(
      '%s is %s and can no longer be edited', v_op.reference, lower(public.status_label(v_op.state)));
  end if;

  select * into v_locations from public._operation_locations(v_op.type, p_payload);
  v_responsible := coalesce((p_payload ->> 'responsibleId')::uuid, v_op.responsible_id);

  update public.operations set
    source_location_id      = v_locations.o_source,
    destination_location_id = v_locations.o_destination,
    partner_name            = coalesce(trim(p_payload ->> 'partnerName'), partner_name),
    reason                  = coalesce(trim(p_payload ->> 'reason'), reason),
    notes                   = coalesce(trim(p_payload ->> 'notes'), notes),
    scheduled_date          = case when p_payload ? 'scheduledDate'
                                   then nullif(p_payload ->> 'scheduledDate', '')::date
                                   else scheduled_date end,
    responsible_id          = v_responsible,
    responsible_name        = coalesce((select full_name from public.profiles where id = v_responsible), responsible_name)
  where id = p_operation_id;

  if p_payload ? 'lines' then
    delete from public.operation_lines where operation_id = p_operation_id;
    perform public._insert_lines(p_operation_id, v_op.type, p_payload -> 'lines');
  end if;

  -- A confirmed document is re-checked against current stock.
  if v_op.state in ('WAITING', 'READY') then
    update public.operations set state = public._availability_state(p_operation_id)
    where id = p_operation_id;
  end if;
  return p_operation_id;
end;
$$;

create function public._confirm_operation(p_operation_id bigint)
returns public.operation_state
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_op public.operations := public._lock_operation(p_operation_id);
  v_state public.operation_state;
begin
  if v_op.state <> 'DRAFT' then
    raise exception using errcode = 'PT409', message = format(
      'Only pending drafts can be confirmed (%s is %s)', v_op.reference, lower(v_op.state::text));
  end if;
  v_state := public._availability_state(p_operation_id);
  update public.operations set state = v_state where id = p_operation_id;
  return v_state;
end;
$$;

create function public._check_availability(p_operation_id bigint)
returns public.operation_state
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_op public.operations := public._lock_operation(p_operation_id);
  v_state public.operation_state;
begin
  if v_op.state not in ('WAITING', 'READY') then
    raise exception using errcode = 'PT409', message = format(
      'Availability can only be checked on confirmed documents (%s is %s)', v_op.reference, lower(v_op.state::text));
  end if;
  v_state := public._availability_state(p_operation_id);
  update public.operations set state = v_state where id = p_operation_id;
  return v_state;
end;
$$;

create function public._cancel_operation(p_operation_id bigint)
returns public.operation_state
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_op public.operations := public._lock_operation(p_operation_id);
begin
  if v_op.state in ('DONE', 'CANCELLED') then
    raise exception using errcode = 'PT409', message = format(
      '%s is already %s', v_op.reference, lower(public.status_label(v_op.state)));
  end if;
  update public.operations set state = 'CANCELLED' where id = p_operation_id;
  return 'CANCELLED';
end;
$$;

-- The heart of the engine. Moves stock for a READY document and marks it DONE.
--   p_lines: optional [{lineId, doneQuantity}] for partial validation
--   p_create_backorder: put the undelivered remainder on a new document
--   p_can_signoff: whether the caller may approve stock-reducing adjustments
-- Returns the backorder's id, or null.
create function public._validate_operation(
  p_operation_id bigint,
  p_user_id uuid,
  p_lines jsonb,
  p_create_backorder boolean,
  p_can_signoff boolean,
  p_at timestamptz default now()
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_op public.operations := public._lock_operation(p_operation_id);
  v_user_name text;
  v_line jsonb;
  v_row record;
  v_ln public.operation_lines;
  v_system numeric;
  v_diff numeric;
  v_needs_signoff boolean;
  v_backorder_id bigint;
begin
  if v_op.state <> 'READY' then
    raise exception using errcode = 'PT409', message = format(
      'Only documents that are Ready can be validated (%s is %s)', v_op.reference, lower(v_op.state::text));
  end if;

  v_user_name := coalesce((select full_name from public.profiles where id = p_user_id), v_op.responsible_name, '');

  -- 1. Decide how much of each line is being done.
  if v_op.type <> 'ADJUSTMENT' then
    if p_lines is not null and jsonb_typeof(p_lines) = 'array' then
      for v_line in select * from jsonb_array_elements(p_lines) loop
        update public.operation_lines
        set done_quantity = (v_line ->> 'doneQuantity')::numeric
        where id = (v_line ->> 'lineId')::bigint and operation_id = p_operation_id;
        if not found then
          raise exception using errcode = 'PT400', message = 'A line does not belong to this document';
        end if;
      end loop;
    else
      update public.operation_lines set done_quantity = quantity where operation_id = p_operation_id;
    end if;

    if not exists (select 1 from public.operation_lines where operation_id = p_operation_id and done_quantity > 0) then
      raise exception using errcode = 'PT400', message = 'Nothing to validate: every done quantity is zero';
    end if;
  end if;

  -- 2. Lock every quant this document touches, always in (product, location)
  --    order, so two validations can never deadlock each other.
  for v_row in
    select ln.product_id, loc.id as location_id
    from public.operation_lines ln
    cross join (values (v_op.source_location_id), (v_op.destination_location_id)) as loc (id)
    join public.locations l on l.id = loc.id and l.type = 'INTERNAL'
    where ln.operation_id = p_operation_id
    order by ln.product_id, loc.id
  loop
    perform public._lock_quant(v_row.product_id, v_row.location_id);
  end loop;

  -- 3. Move the stock.
  if v_op.type = 'ADJUSTMENT' then
    v_needs_signoff := not p_can_signoff
      and coalesce((select require_signoff_negative_adjustments from public.app_settings where id = 1), true);

    for v_ln in select * from public.operation_lines where operation_id = p_operation_id order by id loop
      select quantity into v_system from public.stock_quants
      where product_id = v_ln.product_id and location_id = v_op.source_location_id;
      v_diff := v_ln.counted_quantity - v_system;

      if v_diff < 0 and v_needs_signoff then
        raise exception using errcode = 'PT403',
          message = 'Manager sign-off is required for adjustments that reduce stock';
      end if;

      update public.operation_lines
      set system_quantity = v_system, quantity = abs(v_diff), done_quantity = abs(v_diff)
      where id = v_ln.id;

      if v_diff < 0 then
        perform public._apply_move(v_ln.product_id, v_op.source_location_id, v_op.destination_location_id,
          -v_diff, 'ADJUSTMENT', v_op.reference, p_operation_id, v_ln.id, p_user_id, v_user_name, p_at);
      elsif v_diff > 0 then
        perform public._apply_move(v_ln.product_id, v_op.destination_location_id, v_op.source_location_id,
          v_diff, 'ADJUSTMENT', v_op.reference, p_operation_id, v_ln.id, p_user_id, v_user_name, p_at);
      end if;
    end loop;
  else
    for v_ln in
      select * from public.operation_lines
      where operation_id = p_operation_id and done_quantity > 0
      order by id
    loop
      perform public._apply_move(v_ln.product_id, v_op.source_location_id, v_op.destination_location_id,
        v_ln.done_quantity, v_op.type::text::public.move_type, v_op.reference,
        p_operation_id, v_ln.id, p_user_id, v_user_name, p_at);
    end loop;

    -- 4. Optional backorder for whatever was not done.
    if p_create_backorder and exists (
      select 1 from public.operation_lines
      where operation_id = p_operation_id and done_quantity < quantity
    ) then
      insert into public.operations (
        reference, type, state, source_location_id, destination_location_id,
        partner_name, reason, notes, scheduled_date, responsible_id, responsible_name,
        created_by, backorder_of_id, created_at, updated_at)
      values (
        public._next_reference(v_op.type, p_at), v_op.type, 'DRAFT',
        v_op.source_location_id, v_op.destination_location_id,
        v_op.partner_name, v_op.reason, v_op.notes, v_op.scheduled_date,
        v_op.responsible_id, v_op.responsible_name, p_user_id, p_operation_id, p_at, p_at)
      returning id into v_backorder_id;

      insert into public.operation_lines (operation_id, product_id, quantity)
      select v_backorder_id, product_id, quantity - done_quantity
      from public.operation_lines
      where operation_id = p_operation_id and done_quantity < quantity;

      update public.operations
      set state = public._availability_state(v_backorder_id)
      where id = v_backorder_id;
    end if;
  end if;

  update public.operations set state = 'DONE', validated_at = p_at where id = p_operation_id;
  return v_backorder_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Products
-- ---------------------------------------------------------------------------
create function public._create_product(
  p_name text,
  p_sku text,
  p_category text,
  p_category_id bigint,
  p_initial_stock numeric,
  p_warehouse text,
  p_warehouse_id bigint,
  p_price numeric,
  p_min_stock numeric,
  p_unit text,
  p_reorder_qty numeric,
  p_user_id uuid,
  p_at timestamptz default now()
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_category_id bigint := public._resolve_category(p_category_id, p_category);
  v_warehouse_id bigint := public._resolve_warehouse(p_warehouse_id, p_warehouse);
  v_sku text := upper(trim(coalesce(p_sku, '')));
  v_prefix text;
  v_product_id bigint;
  v_location_id bigint;
  v_initial numeric := coalesce(p_initial_stock, 0);
begin
  if nullif(trim(p_name), '') is null then
    raise exception using errcode = 'PT400', message = 'Product name is required';
  end if;
  if v_initial < 0 then
    raise exception using errcode = 'PT400', message = 'Initial stock cannot be negative';
  end if;
  if coalesce(p_price, 0) < 0 then
    raise exception using errcode = 'PT400', message = 'Price cannot be negative';
  end if;
  if coalesce(p_min_stock, 0) < 0 then
    raise exception using errcode = 'PT400', message = 'Minimum stock cannot be negative';
  end if;

  -- Blank SKU: generate one from the category, e.g. ELE-000042.
  if v_sku = '' then
    select upper(left(regexp_replace(name, '[^A-Za-z]', '', 'g'), 3)) into v_prefix
    from public.categories where id = v_category_id;
    v_prefix := coalesce(nullif(v_prefix, ''), 'PRD');
    loop
      v_sku := v_prefix || '-' || lpad(nextval('public.product_sku_seq')::text, 6, '0');
      exit when not exists (select 1 from public.products where upper(sku) = v_sku);
    end loop;
  elsif exists (select 1 from public.products where upper(sku) = v_sku) then
    raise exception using errcode = 'PT409', message = format('SKU %s already exists', v_sku);
  end if;

  if v_warehouse_id is null and v_initial > 0 then
    v_warehouse_id := (select default_warehouse_id from public.app_settings where id = 1);
    if v_warehouse_id is null then
      raise exception using errcode = 'PT400', message = 'Choose a warehouse for the initial stock';
    end if;
  end if;

  insert into public.products (name, sku, category_id, unit, price, primary_warehouse_id, created_at, updated_at)
  values (p_name, v_sku, v_category_id, coalesce(nullif(trim(p_unit), ''), 'pcs'),
          coalesce(p_price, 0), v_warehouse_id, p_at, p_at)
  returning id into v_product_id;

  insert into public.reorder_rules (product_id, min_qty, reorder_qty)
  values (v_product_id, coalesce(p_min_stock, 0), p_reorder_qty);

  -- Opening balance goes through the ledger like any other stock change.
  if v_initial > 0 then
    v_location_id := public._internal_location(null, v_warehouse_id, 'Initial stock');
    perform public._lock_quant(v_product_id, v_location_id);
    perform public._apply_move(v_product_id, public._virtual_location('INVENTORY_LOSS'), v_location_id,
      v_initial, 'INITIAL', 'INIT-' || v_sku, null, null, p_user_id,
      coalesce((select full_name from public.profiles where id = p_user_id), ''), p_at);
  end if;

  return v_product_id;
end;
$$;

create function public.create_product(
  p_name text,
  p_sku text default null,
  p_category text default null,
  p_category_id bigint default null,
  p_initial_stock numeric default 0,
  p_warehouse text default null,
  p_warehouse_id bigint default null,
  p_price numeric default 0,
  p_min_stock numeric default 0,
  p_unit text default 'pcs',
  p_reorder_qty numeric default null
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user public.profiles := public._require_manager();
begin
  return public._create_product(p_name, p_sku, p_category, p_category_id, p_initial_stock,
    p_warehouse, p_warehouse_id, p_price, p_min_stock, p_unit, p_reorder_qty, v_user.id, now());
end;
$$;

-- p_payload keys (all optional): name, sku, categoryId | category, price, minStock,
-- reorderQty, unit, warehouseId | warehouse
create function public.update_product(p_id bigint, p_payload jsonb)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user public.profiles := public._require_manager();
  v_sku text := upper(trim(p_payload ->> 'sku'));
begin
  if not exists (select 1 from public.products where id = p_id) then
    raise exception using errcode = 'PT404', message = 'Product not found';
  end if;
  if v_sku is not null and exists (select 1 from public.products where upper(sku) = v_sku and id <> p_id) then
    raise exception using errcode = 'PT409', message = format('SKU %s already exists', v_sku);
  end if;
  if (p_payload ->> 'price')::numeric < 0 or (p_payload ->> 'minStock')::numeric < 0 then
    raise exception using errcode = 'PT400', message = 'Price and minimum stock cannot be negative';
  end if;

  update public.products set
    name        = coalesce(nullif(trim(p_payload ->> 'name'), ''), name),
    sku         = coalesce(nullif(v_sku, ''), sku),
    category_id = case when p_payload ? 'categoryId' or p_payload ? 'category'
                       then public._resolve_category((p_payload ->> 'categoryId')::bigint, p_payload ->> 'category')
                       else category_id end,
    price       = coalesce((p_payload ->> 'price')::numeric, price),
    unit        = coalesce(nullif(trim(p_payload ->> 'unit'), ''), unit),
    primary_warehouse_id = case when p_payload ? 'warehouseId' or p_payload ? 'warehouse'
                       then public._resolve_warehouse((p_payload ->> 'warehouseId')::bigint, p_payload ->> 'warehouse')
                       else primary_warehouse_id end
  where id = p_id;

  if p_payload ? 'minStock' or p_payload ? 'reorderQty' then
    insert into public.reorder_rules (product_id, min_qty, reorder_qty)
    values (p_id, coalesce((p_payload ->> 'minStock')::numeric, 0), (p_payload ->> 'reorderQty')::numeric)
    on conflict (product_id) do update set
      min_qty     = coalesce((p_payload ->> 'minStock')::numeric, public.reorder_rules.min_qty),
      reorder_qty = case when p_payload ? 'reorderQty' then (p_payload ->> 'reorderQty')::numeric
                         else public.reorder_rules.reorder_qty end;
  end if;
  return p_id;
end;
$$;

-- Products are archived, never deleted, so their history stays intact.
create function public.set_product_archived(p_id bigint, p_archived boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user public.profiles := public._require_manager();
begin
  update public.products set archived = p_archived where id = p_id;
  if not found then
    raise exception using errcode = 'PT404', message = 'Product not found';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Warehouses and locations
-- ---------------------------------------------------------------------------
create function public._create_warehouse(p_name text, p_code text, p_address text, p_capacity_units numeric)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id bigint;
begin
  if nullif(trim(p_name), '') is null or nullif(trim(p_code), '') is null then
    raise exception using errcode = 'PT400', message = 'Warehouse name and code are required';
  end if;
  if exists (select 1 from public.warehouses where lower(name) = lower(trim(p_name))) then
    raise exception using errcode = 'PT409', message = format('A warehouse named "%s" already exists', trim(p_name));
  end if;
  if exists (select 1 from public.warehouses where upper(code) = upper(trim(p_code))) then
    raise exception using errcode = 'PT409', message = format('Warehouse code %s is already used', upper(trim(p_code)));
  end if;

  insert into public.warehouses (name, code, address, capacity_units)
  values (trim(p_name), upper(trim(p_code)), coalesce(trim(p_address), ''), p_capacity_units)
  returning id into v_id;

  -- Every warehouse gets a default location so documents can just name the warehouse.
  insert into public.locations (warehouse_id, name, code, type, is_default)
  values (v_id, 'Stock', upper(trim(p_code)) || '/STOCK', 'INTERNAL', true);
  return v_id;
end;
$$;

create function public.create_warehouse(
  p_name text,
  p_code text,
  p_address text default '',
  p_capacity_units numeric default null
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user public.profiles := public._require_manager();
begin
  return public._create_warehouse(p_name, p_code, p_address, p_capacity_units);
end;
$$;

create function public._create_location(p_warehouse_id bigint, p_name text, p_code text)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_wh public.warehouses;
  v_id bigint;
begin
  select * into v_wh from public.warehouses where id = p_warehouse_id;
  if not found then
    raise exception using errcode = 'PT404', message = 'Warehouse not found';
  end if;
  if nullif(trim(p_name), '') is null then
    raise exception using errcode = 'PT400', message = 'Location name is required';
  end if;
  if exists (select 1 from public.locations where warehouse_id = p_warehouse_id and lower(name) = lower(trim(p_name))) then
    raise exception using errcode = 'PT409', message = format('%s already has a location named "%s"', v_wh.name, trim(p_name));
  end if;

  insert into public.locations (warehouse_id, name, code, type)
  values (p_warehouse_id, trim(p_name),
          coalesce(nullif(upper(trim(p_code)), ''),
                   v_wh.code || '/' || upper(regexp_replace(trim(p_name), '\s+', '-', 'g'))),
          'INTERNAL')
  returning id into v_id;
  return v_id;
end;
$$;

create function public.create_location(p_warehouse_id bigint, p_name text, p_code text default null)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user public.profiles := public._require_manager();
begin
  return public._create_location(p_warehouse_id, p_name, p_code);
end;
$$;

-- ---------------------------------------------------------------------------
-- Public operation RPCs (any active user: staff create and validate operations)
-- ---------------------------------------------------------------------------
create function public.create_operation(p_type text, p_payload jsonb)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user public.profiles := public._require_user();
begin
  return public._create_operation(upper(p_type)::public.operation_type, p_payload, v_user.id, now());
end;
$$;

create function public.update_operation(p_id bigint, p_payload jsonb)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user public.profiles := public._require_user();
begin
  return public._update_operation(p_id, p_payload);
end;
$$;

create function public.confirm_operation(p_id bigint)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user public.profiles := public._require_user();
begin
  return public._confirm_operation(p_id)::text;
end;
$$;

create function public.check_availability(p_id bigint)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user public.profiles := public._require_user();
begin
  return public._check_availability(p_id)::text;
end;
$$;

create function public.validate_operation(
  p_id bigint,
  p_lines jsonb default null,
  p_create_backorder boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user public.profiles := public._require_user();
  v_backorder_id bigint;
begin
  v_backorder_id := public._validate_operation(
    p_id, v_user.id, p_lines, p_create_backorder, v_user.role = 'MANAGER', now());
  return jsonb_build_object(
    'id', p_id,
    'state', 'DONE',
    'backorderId', v_backorder_id,
    'backorderReference', (select reference from public.operations where id = v_backorder_id));
end;
$$;

create function public.cancel_operation(p_id bigint)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user public.profiles := public._require_user();
begin
  return public._cancel_operation(p_id)::text;
end;
$$;

-- ---------------------------------------------------------------------------
-- Settings and users
-- ---------------------------------------------------------------------------
-- p_payload keys: workspaceName, defaultWarehouseId | defaultWarehouse, reorderMultiplier,
-- requireManagerSignoffOnNegativeAdjustments, stockTargetUnits, timeZone
create function public.update_settings(p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user public.profiles := public._require_manager();
  v_multiplier int := (p_payload ->> 'reorderMultiplier')::int;
begin
  if v_multiplier is not null and v_multiplier not in (2, 3, 5) then
    raise exception using errcode = 'PT400', message = 'Reorder multiplier must be 2, 3 or 5';
  end if;
  if p_payload ? 'timeZone' and not exists (select 1 from pg_timezone_names where name = p_payload ->> 'timeZone') then
    raise exception using errcode = 'PT400', message = 'Unknown time zone';
  end if;

  update public.app_settings set
    workspace_name = coalesce(nullif(trim(p_payload ->> 'workspaceName'), ''), workspace_name),
    default_warehouse_id = case when p_payload ? 'defaultWarehouseId' or p_payload ? 'defaultWarehouse'
      then public._resolve_warehouse((p_payload ->> 'defaultWarehouseId')::bigint, p_payload ->> 'defaultWarehouse')
      else default_warehouse_id end,
    reorder_multiplier = coalesce(v_multiplier, reorder_multiplier),
    require_signoff_negative_adjustments = coalesce(
      (p_payload ->> 'requireManagerSignoffOnNegativeAdjustments')::boolean, require_signoff_negative_adjustments),
    stock_target_units = case when p_payload ? 'stockTargetUnits'
      then nullif(p_payload ->> 'stockTargetUnits', '')::numeric else stock_target_units end,
    time_zone = coalesce(p_payload ->> 'timeZone', time_zone)
  where id = 1;
end;
$$;

-- Managers change roles and deactivate accounts. The last manager can't be removed.
create function public.set_user_access(p_user_id uuid, p_role text default null, p_active boolean default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user public.profiles := public._require_manager();
  v_target public.profiles;
  v_new_role public.app_role;
begin
  select * into v_target from public.profiles where id = p_user_id for update;
  if not found then
    raise exception using errcode = 'PT404', message = 'User not found';
  end if;
  v_new_role := coalesce(upper(p_role)::public.app_role, v_target.role);

  if v_target.role = 'MANAGER' and v_target.active
     and (v_new_role <> 'MANAGER' or p_active is false)
     and (select count(*) from public.profiles where role = 'MANAGER' and active) = 1 then
    raise exception using errcode = 'PT409', message = 'There must always be at least one active manager';
  end if;

  update public.profiles
  set role = v_new_role, active = coalesce(p_active, active)
  where id = p_user_id;
end;
$$;
