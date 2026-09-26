import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { createDb, signUp, asUser, asAnon, call } from './db.js';

const rejectsWith = (promise, code, pattern) =>
  assert.rejects(promise, (err) => {
    assert.equal(err.code, code, `expected ${code}, got ${err.code}: ${err.message}`);
    if (pattern) assert.match(err.message, pattern);
    return true;
  });

const num = (v) => Number(v);

// A small world: two warehouses, one category, a manager and a staff member.
async function world() {
  const db = await createDb();
  const manager = await signUp(db, 'manager@test.local', 'Maya Manager');
  const staff = await signUp(db, 'staff@test.local', 'Sam Staff');
  const main = await call(db, manager, `public.create_warehouse('Main Store', 'MAIN', 'Plot 1', 1000)`);
  const second = await call(db, manager, `public.create_warehouse('Second Store', 'SEC', 'Plot 2', null)`);
  const rack = await call(db, manager, `public.create_location($1, 'Production Rack')`, [main]);
  await asUser(db, manager, `insert into public.categories (name) values ('Metals'), ('Electronics')`);
  const steel = await call(db, manager,
    `public.create_product(p_name => 'Steel', p_sku => 'stl-1', p_category => 'metals', p_unit => 'kg', p_min_stock => 10)`);
  const mainStock = (await db.query(`select id from public.locations where warehouse_id = $1 and is_default`, [main])).rows[0].id;
  const secondStock = (await db.query(`select id from public.locations where warehouse_id = $1 and is_default`, [second])).rows[0].id;
  return { db, manager, staff, main, second, rack, steel, mainStock, secondStock };
}

const qty = async (db, productId, locationId) =>
  num((await db.query(`select coalesce((select quantity from public.stock_quants where product_id = $1 and location_id = $2), 0) as q`,
    [productId, locationId])).rows[0].q);

const moveCount = async (db) => num((await db.query(`select count(*) as n from public.stock_moves`)).rows[0].n);

const stateOf = async (db, id) => (await db.query(`select state from public.operations where id = $1`, [id])).rows[0].state;

async function op(w, user, type, payload) {
  return call(w.db, user, `public.create_operation($1, $2::jsonb)`, [type, JSON.stringify(payload)]);
}
async function receive(w, productId, quantity, extra = {}) {
  const id = await op(w, w.manager, 'RECEIPT', { warehouseId: w.main, lines: [{ productId, quantity }], ...extra });
  await call(w.db, w.manager, `public.confirm_operation($1)`, [id]);
  await call(w.db, w.manager, `public.validate_operation($1)`, [id]);
  return id;
}

// ---------------------------------------------------------------------------
describe('accounts and permissions', () => {
  let w;
  before(async () => { w = await world(); });

  test('first sign-up becomes MANAGER, later ones STAFF, names come from metadata', async () => {
    const rows = (await w.db.query(`select email, role, full_name from public.profiles order by created_at`)).rows;
    assert.deepEqual(rows.map((r) => r.role), ['MANAGER', 'STAFF']);
    assert.equal(rows[0].full_name, 'Maya Manager');
  });

  test('anonymous visitors cannot read anything', async () => {
    await assert.rejects(asAnon(w.db, `select * from public.products`), /permission denied/);
    await assert.rejects(asAnon(w.db, `select * from public.v_product_rows`), /permission denied/);
    await assert.rejects(asAnon(w.db, `select public.dashboard_kpis('30d', null)`), /permission denied/);
  });

  test('staff can read but not change master data', async () => {
    const rows = (await asUser(w.db, w.staff, `select * from public.v_product_rows`)).rows;
    assert.equal(rows.length, 1);
    await rejectsWith(call(w.db, w.staff, `public.create_product(p_name => 'X', p_category => 'Metals')`), 'PT403');
    await rejectsWith(call(w.db, w.staff, `public.create_warehouse('X', 'X')`), 'PT403');
    // Direct UPDATE is silently filtered by RLS: nothing changes.
    await asUser(w.db, w.staff, `update public.products set price = 999 where id = $1`, [w.steel]);
    assert.equal(num((await w.db.query(`select price from public.products where id = $1`, [w.steel])).rows[0].price), 0);
  });

  test('nobody writes stock tables directly', async () => {
    await assert.rejects(
      asUser(w.db, w.manager, `insert into public.stock_quants (product_id, location_id, quantity) values ($1, $2, 5)`, [w.steel, w.mainStock]),
      /permission denied/);
    await assert.rejects(
      asUser(w.db, w.manager, `update public.operations set state = 'DONE'`), /permission denied/);
  });

  test('users edit their own name but not their role', async () => {
    await asUser(w.db, w.staff, `update public.profiles set full_name = 'Samuel' where id = $1`, [w.staff]);
    assert.equal((await w.db.query(`select full_name from public.profiles where id = $1`, [w.staff])).rows[0].full_name, 'Samuel');
    await assert.rejects(asUser(w.db, w.staff, `update public.profiles set role = 'MANAGER' where id = $1`, [w.staff]), /permission denied/);
  });

  test('the last active manager cannot be demoted or deactivated', async () => {
    await rejectsWith(call(w.db, w.manager, `public.set_user_access($1, 'STAFF', null)`, [w.manager]), 'PT409');
    await rejectsWith(call(w.db, w.manager, `public.set_user_access($1, null, false)`, [w.manager]), 'PT409');
    await rejectsWith(call(w.db, w.staff, `public.set_user_access($1, 'MANAGER', null)`, [w.staff]), 'PT403');
  });

  test('deactivated users are locked out', async () => {
    const temp = await signUp(w.db, 'temp@test.local', 'Temp');
    await call(w.db, w.manager, `public.set_user_access($1, null, false)`, [temp]);
    const rows = (await asUser(w.db, temp, `select * from public.products`)).rows;
    assert.equal(rows.length, 0);
    await rejectsWith(op(w, temp, 'RECEIPT', { warehouseId: w.main, lines: [{ productId: w.steel, quantity: 1 }] }), 'PT403');
  });
});

// ---------------------------------------------------------------------------
describe('products', () => {
  let w;
  before(async () => { w = await world(); });

  test('Add Product modal payload (names, string quantity) creates stock through the ledger', async () => {
    const id = await call(w.db, w.manager, `public.create_product(p_name => $1, p_sku => $2, p_category => $3, p_initial_stock => $4, p_warehouse => $5)`,
      ['Barcode Scanner', 'ELC-SC-901', 'Electronics', '50', 'main store']);
    assert.equal(await qty(w.db, id, w.mainStock), 50);
    const move = (await w.db.query(`select move_type, reference, quantity from public.stock_moves where product_id = $1`, [id])).rows;
    assert.deepEqual(move.map((m) => [m.move_type, m.reference, num(m.quantity)]), [['INITIAL', 'INIT-ELC-SC-901', 50]]);
  });

  test('SKUs are unique regardless of case', async () => {
    await rejectsWith(call(w.db, w.manager, `public.create_product(p_name => 'Dup', p_sku => 'STL-1', p_category => 'Metals')`), 'PT409', /already exists/);
    await rejectsWith(call(w.db, w.manager, `public.update_product($1, '{"sku":"elc-sc-901"}'::jsonb)`, [w.steel]), 'PT409');
  });

  test('a blank SKU is generated from the category', async () => {
    const id = await call(w.db, w.manager, `public.create_product(p_name => 'Copper wire', p_sku => '', p_category => 'Metals')`);
    const sku = (await w.db.query(`select sku from public.products where id = $1`, [id])).rows[0].sku;
    assert.match(sku, /^MET-\d{6}$/);
  });

  test('bad input is rejected with a readable message', async () => {
    await rejectsWith(call(w.db, w.manager, `public.create_product(p_name => 'Neg', p_category => 'Metals', p_initial_stock => -1, p_warehouse => 'Main Store')`), 'PT400', /negative/);
    await rejectsWith(call(w.db, w.manager, `public.create_product(p_name => 'NoCat', p_category => 'Nope')`), 'PT400', /Category/);
    await rejectsWith(call(w.db, w.manager, `public.create_product(p_name => ' ', p_category => 'Metals')`), 'PT400', /name/);
  });

  test('archived products keep their history and leave the catalogue', async () => {
    await call(w.db, w.manager, `public.set_product_archived($1, true)`, [w.steel]);
    const row = (await asUser(w.db, w.manager, `select archived from public.v_product_rows where id = $1`, [w.steel])).rows[0];
    assert.equal(row.archived, true);
    await rejectsWith(op(w, w.manager, 'RECEIPT', { warehouseId: w.main, lines: [{ productId: w.steel, quantity: 1 }] }), 'PT400', /archived/);
    await call(w.db, w.manager, `public.set_product_archived($1, false)`, [w.steel]);
  });
});

// ---------------------------------------------------------------------------
describe('stock engine', () => {
  let w;
  before(async () => { w = await world(); });

  test('receipt: Vendor -> Main adds stock and numbers the document', async () => {
    const id = await op(w, w.staff, 'RECEIPT', { warehouseId: w.main, partnerName: 'Tata Steel', lines: [{ productId: w.steel, quantity: 100 }] });
    assert.equal(await stateOf(w.db, id), 'DRAFT');
    assert.equal(await call(w.db, w.staff, `public.confirm_operation($1)`, [id]), 'READY');
    await call(w.db, w.staff, `public.validate_operation($1)`, [id]);
    assert.equal(await stateOf(w.db, id), 'DONE');
    assert.equal(await qty(w.db, w.steel, w.mainStock), 100);
    const ref = (await w.db.query(`select reference from public.operations where id = $1`, [id])).rows[0].reference;
    assert.match(ref, /^PO-\d{4}-0001$/);
  });

  test('transfer: total unchanged, stock moves between locations', async () => {
    const id = await op(w, w.staff, 'TRANSFER', { sourceLocationId: w.mainStock, destinationLocationId: w.rack, lines: [{ productId: w.steel, quantity: 100 }] });
    await call(w.db, w.staff, `public.confirm_operation($1)`, [id]);
    await call(w.db, w.staff, `public.validate_operation($1)`, [id]);
    assert.equal(await qty(w.db, w.steel, w.mainStock), 0);
    assert.equal(await qty(w.db, w.steel, w.rack), 100);
  });

  test('delivery: Internal -> Customer removes stock', async () => {
    const id = await op(w, w.staff, 'DELIVERY', { locationId: w.rack, lines: [{ productId: w.steel, quantity: 20 }] });
    await call(w.db, w.staff, `public.confirm_operation($1)`, [id]);
    await call(w.db, w.staff, `public.validate_operation($1)`, [id]);
    assert.equal(await qty(w.db, w.steel, w.rack), 80);
  });

  test('adjustment: counted 77 of 80 writes off 3 and records the system quantity', async () => {
    const id = await op(w, w.manager, 'ADJUSTMENT', { locationId: w.rack, reason: 'Damaged', lines: [{ productId: w.steel, countedQuantity: 77 }] });
    await call(w.db, w.manager, `public.confirm_operation($1)`, [id]);
    await call(w.db, w.manager, `public.validate_operation($1)`, [id]);
    assert.equal(await qty(w.db, w.steel, w.rack), 77);
    const line = (await w.db.query(`select system_quantity, quantity from public.operation_lines where operation_id = $1`, [id])).rows[0];
    assert.equal(num(line.system_quantity), 80);
    assert.equal(num(line.quantity), 3);
  });

  test('the ledger tells the steel story: +100, move, -20, -3', async () => {
    const rows = (await asUser(w.db, w.manager,
      `select operation, quantity from public.v_ledger_rows where product_id = $1 order by performed_at, id`, [w.steel])).rows;
    assert.deepEqual(rows.map((r) => [r.operation, num(r.quantity)]),
      [['Receipt', 100], ['Internal Transfer', 100], ['Delivery', -20], ['Adjustment', -3]]);
  });

  test('delivery beyond stock waits, and cannot be validated', async () => {
    const id = await op(w, w.staff, 'DELIVERY', { locationId: w.rack, lines: [{ productId: w.steel, quantity: 1000 }] });
    assert.equal(await call(w.db, w.staff, `public.confirm_operation($1)`, [id]), 'WAITING');
    await rejectsWith(call(w.db, w.staff, `public.validate_operation($1)`, [id]), 'PT409', /Ready/);
  });

  test('insufficient stock at validation rolls back every line', async () => {
    const copper = await call(w.db, w.manager, `public.create_product(p_name => 'Copper', p_sku => 'CU-1', p_category => 'Metals', p_initial_stock => 10, p_warehouse => 'Main Store')`);
    await receive(w, w.steel, 50);                                    // main: steel 50, copper 10
    // Both lines are available when confirmed...
    const big = await op(w, w.staff, 'DELIVERY', { warehouseId: w.main,
      lines: [{ productId: w.steel, quantity: 40 }, { productId: copper, quantity: 10 }] });
    assert.equal(await call(w.db, w.staff, `public.confirm_operation($1)`, [big]), 'READY');
    // ...then another delivery takes the copper first.
    const small = await op(w, w.staff, 'DELIVERY', { warehouseId: w.main, lines: [{ productId: copper, quantity: 5 }] });
    await call(w.db, w.staff, `public.confirm_operation($1)`, [small]);
    await call(w.db, w.staff, `public.validate_operation($1)`, [small]);

    const movesBefore = await moveCount(w.db);
    await rejectsWith(call(w.db, w.staff, `public.validate_operation($1)`, [big]), 'PT409', /Not enough stock for CU-1/);
    assert.equal(await moveCount(w.db), movesBefore, 'no ledger rows written');
    assert.equal(await qty(w.db, w.steel, w.mainStock), 50, 'steel line rolled back');
    assert.equal(await qty(w.db, copper, w.mainStock), 5);
    assert.equal(await stateOf(w.db, big), 'READY');
    assert.equal(await call(w.db, w.staff, `public.check_availability($1)`, [big]), 'WAITING');
  });

  test('partial validation creates a backorder for the remainder', async () => {
    const id = await op(w, w.staff, 'DELIVERY', { warehouseId: w.main, lines: [{ productId: w.steel, quantity: 30 }] });
    await call(w.db, w.staff, `public.confirm_operation($1)`, [id]);
    const lineId = (await w.db.query(`select id from public.operation_lines where operation_id = $1`, [id])).rows[0].id;
    const result = await call(w.db, w.staff, `public.validate_operation($1, $2::jsonb, true)`,
      [id, JSON.stringify([{ lineId, doneQuantity: 12 }])]);
    assert.ok(result.backorderId);
    assert.match(result.backorderReference, /^DO-/);
    assert.equal(await qty(w.db, w.steel, w.mainStock), 38);
    const bo = (await w.db.query(`select o.state, o.backorder_of_id, l.quantity from public.operations o join public.operation_lines l on l.operation_id = o.id where o.id = $1`, [result.backorderId])).rows[0];
    assert.equal(num(bo.quantity), 18);
    assert.equal(num(bo.backorder_of_id), id);
    assert.equal(bo.state, 'READY');
  });

  test('invalid status changes are rejected', async () => {
    const done = (await w.db.query(`select id from public.operations where state = 'DONE' limit 1`)).rows[0].id;
    await rejectsWith(call(w.db, w.staff, `public.cancel_operation($1)`, [done]), 'PT409', /already completed/);
    await rejectsWith(call(w.db, w.staff, `public.confirm_operation($1)`, [done]), 'PT409');
    await rejectsWith(call(w.db, w.staff, `public.update_operation($1, '{"notes":"x"}'::jsonb)`, [done]), 'PT409', /can no longer be edited/);

    const draft = await op(w, w.staff, 'RECEIPT', { warehouseId: w.main, lines: [{ productId: w.steel, quantity: 1 }] });
    await rejectsWith(call(w.db, w.staff, `public.validate_operation($1)`, [draft]), 'PT409', /Ready/);
    assert.equal(await call(w.db, w.staff, `public.cancel_operation($1)`, [draft]), 'CANCELLED');
    await rejectsWith(call(w.db, w.staff, `public.confirm_operation($1)`, [draft]), 'PT409');
  });

  test('document input is validated', async () => {
    await rejectsWith(op(w, w.staff, 'RECEIPT', { warehouseId: w.main, lines: [] }), 'PT400', /at least one/);
    await rejectsWith(op(w, w.staff, 'RECEIPT', { warehouseId: w.main, lines: [{ productId: w.steel, quantity: 0 }] }), 'PT400', /greater than zero/);
    await rejectsWith(op(w, w.staff, 'RECEIPT', { lines: [{ productId: w.steel, quantity: 1 }] }), 'PT400', /warehouse/);
    await rejectsWith(op(w, w.staff, 'TRANSFER', { sourceWarehouseId: w.main, destinationWarehouseId: w.main, lines: [{ productId: w.steel, quantity: 1 }] }), 'PT400', /different/);
    await rejectsWith(op(w, w.staff, 'RECEIPT', { warehouseId: w.main,
      lines: [{ productId: w.steel, quantity: 1 }, { productId: w.steel, quantity: 2 }] }), 'PT400', /only once/);
  });

  test('staff need manager sign-off to reduce stock by adjustment (Settings switch)', async () => {
    const id = await op(w, w.staff, 'ADJUSTMENT', { warehouseId: w.main, lines: [{ productId: w.steel, countedQuantity: 1 }] });
    await call(w.db, w.staff, `public.confirm_operation($1)`, [id]);
    await rejectsWith(call(w.db, w.staff, `public.validate_operation($1)`, [id]), 'PT403', /sign-off/);
    assert.equal(await stateOf(w.db, id), 'READY');

    await call(w.db, w.manager, `public.update_settings('{"requireManagerSignoffOnNegativeAdjustments": false}'::jsonb)`);
    await call(w.db, w.staff, `public.validate_operation($1)`, [id]);
    assert.equal(await qty(w.db, w.steel, w.mainStock), 1);
  });

  test('the ledger is append-only and stock can never go negative, even for the database owner', async () => {
    await assert.rejects(w.db.query(`update public.stock_moves set quantity = 1`), /append-only/);
    await assert.rejects(w.db.query(`delete from public.stock_moves`), /append-only/);
    await assert.rejects(w.db.query(`update public.stock_quants set quantity = -1`), /stock_quants_non_negative/);
  });

  test('every quant equals what the ledger says went in minus what went out', async () => {
    const mismatches = (await w.db.query(`
      with flows as (
        select product_id, destination_location_id as location_id, quantity from public.stock_moves
        union all
        select product_id, source_location_id, -quantity from public.stock_moves
      ),
      ledger as (
        select f.product_id, f.location_id, sum(f.quantity) as qty
        from flows f join public.locations l on l.id = f.location_id and l.type = 'INTERNAL'
        group by 1, 2
      )
      select * from ledger full join public.stock_quants q using (product_id, location_id)
      where coalesce(ledger.qty, 0) <> coalesce(q.quantity, 0)`)).rows;
    assert.deepEqual(mismatches, []);
  });
});

// ---------------------------------------------------------------------------
describe('seed data and read API', () => {
  let db;
  let user;
  before(async () => {
    db = await createDb({ seed: true });
    user = await signUp(db, 'viewer@test.local', 'Vera Viewer');
  });

  test('final stock matches the original mock data', async () => {
    const rows = (await asUser(db, user, `select sku, stock, status from public.v_product_rows order by sku`)).rows;
    const bySku = Object.fromEntries(rows.map((r) => [r.sku, [num(r.stock), r.status]]));
    assert.deepEqual(bySku, {
      'ACC-CH-441': [210, 'In Stock'], 'ACC-PE-220': [65, 'In Stock'], 'APP-WF-008': [450, 'In Stock'],
      'ELC-AU-302': [82, 'In Stock'], 'ELC-MN-505': [18, 'Low Stock'], 'ELC-NB-109': [148, 'In Stock'],
      'EQP-SC-889': [12, 'Low Stock'], 'IND-SN-012': [94, 'In Stock'], 'RAW-ST-012': [77, 'In Stock'],
    });
  });

  test('first sign-up after seeding is a manager assigned to the default warehouse', async () => {
    const p = (await db.query(`select p.role, w.name from public.profiles p join public.warehouses w on w.id = p.default_warehouse_id where p.id = $1`, [user])).rows[0];
    assert.deepEqual([p.role, p.name], ['MANAGER', 'Main Central Hub']);
  });

  test('operation rows never contain nulls in the fields the table searches', async () => {
    const bad = (await asUser(db, user, `
      select count(*) as n from public.v_operation_rows
      where product is null or sku is null or warehouse is null or responsible is null
         or reference is null or date is null or quantity is null`)).rows[0].n;
    assert.equal(num(bad), 0);
    const statuses = (await asUser(db, user, `select distinct status from public.v_operation_rows order by 1`)).rows.map((r) => r.status);
    assert.deepEqual(statuses, ['Cancelled', 'Completed', 'In Progress', 'Pending']);
  });

  test('dashboard functions return the mock shapes for every range and scope', async () => {
    const kpis = await call(db, user, `public.dashboard_kpis('Last 30 Days', null)`);
    assert.deepEqual(kpis.map((k) => k.id), ['total-products', 'stock-available', 'pending-orders', 'low-stock']);
    for (const k of kpis) {
      for (const key of ['label', 'value', 'numericValue', 'change', 'isPositive', 'timeframe', 'badge', 'icon', 'color']) {
        assert.ok(key in k, `${k.id} has ${key}`);
      }
    }
    for (const range of ['today', '7d', '30d', 'quarter']) {
      for (const wh of [null, 1]) {
        await call(db, user, `public.dashboard_kpis($1, $2)`, [range, wh]);
        await call(db, user, `public.dashboard_stock_movement($1, $2)`, [range, wh]);
      }
    }
    const activity = await call(db, user, `public.dashboard_activity('7d', null)`);
    assert.equal(activity.length, 7);
    assert.ok(activity.every((d) => typeof d.day === 'string' && typeof d.inbound === 'number'));
    assert.equal((await call(db, user, `public.dashboard_activity('30d', 2)`)).length, 30);
    assert.equal((await call(db, user, `public.dashboard_performance(6, null)`)).length, 6);
    assert.ok((await call(db, user, `public.dashboard_categories(null)`)).length >= 5);
    assert.equal((await call(db, user, `public.dashboard_fast_moving(30, 6, null)`)).length, 6);
    const analytics = await call(db, user, `public.analytics_kpis(null)`);
    assert.ok(analytics.inventoryValuation > 0);
    assert.equal(analytics.gmroi, null);
    await rejectsWith(call(db, user, `public.dashboard_kpis('yesterday', null)`), 'PT400');
  });

  test('warehouse cards give capacity as a percent string', async () => {
    const rows = (await asUser(db, user, `select name, capacity, total_items from public.v_warehouse_cards order by id`)).rows;
    assert.equal(rows.length, 4);
    assert.ok(rows.every((r) => /^\d+%$/.test(r.capacity)));
  });

  test('bulk reorder drafts one receipt per warehouse and does not duplicate open ones', async () => {
    const low = (await asUser(db, user, `select id, recommended_qty from public.low_stock_rows(null)`)).rows;
    assert.equal(low.length, 2);
    const created = await call(db, user, `public.reorder_low_stock(null)`);
    assert.equal(created.length, 2);                   // Main Central Hub + North Logistics Depot
    assert.ok(created.every((c) => /^PO-/.test(c.reference)));
    assert.deepEqual(await call(db, user, `public.reorder_low_stock(null)`), []);
  });
});

// ---------------------------------------------------------------------------
describe('setup on a project that already has users', () => {
  test('existing accounts get profiles and the oldest becomes manager', async () => {
    const db = await createDb({ usersBeforeSetup: [
      { email: 'first@test.local', fullName: 'First Person' },
      { email: 'second@test.local', fullName: '' },
    ] });
    const rows = (await db.query(`select email, full_name, role from public.profiles order by email`)).rows;
    assert.deepEqual(rows.map((r) => [r.email, r.full_name, r.role]), [
      ['first@test.local', 'First Person', 'MANAGER'],
      ['second@test.local', 'second', 'STAFF'],
    ]);
    // New sign-ups after that are staff.
    const later = await signUp(db, 'third@test.local', 'Third');
    assert.equal((await db.query(`select role from public.profiles where id = $1`, [later])).rows[0].role, 'STAFF');
  });
});

// ---------------------------------------------------------------------------
describe('projects without automatic table grants', () => {
  test('the app still works because the migrations grant exactly what it needs', async () => {
    const db = await createDb({ defaultGrants: false });
    const manager = await signUp(db, 'm@test.local', 'Mia');
    const wh = await call(db, manager, `public.create_warehouse('Main', 'MAIN')`);
    await asUser(db, manager, `insert into public.categories (name) values ('Tools')`);
    const product = await call(db, manager, `public.create_product(p_name => 'Hammer', p_category => 'Tools', p_initial_stock => 5, p_warehouse_id => $1)`, [wh]);
    await asUser(db, manager, `update public.profiles set job_title = 'Lead' where id = $1`, [manager]);
    const id = await call(db, manager, `public.create_operation('DELIVERY', $1::jsonb)`,
      [JSON.stringify({ warehouseId: wh, lines: [{ productId: product, quantity: 2 }] })]);
    await call(db, manager, `public.confirm_operation($1)`, [id]);
    await call(db, manager, `public.validate_operation($1)`, [id]);
    const row = (await asUser(db, manager, `select stock from public.v_product_rows where id = $1`, [product])).rows[0];
    assert.equal(num(row.stock), 3);
    const ledger = (await asUser(db, manager, `select count(*) as n from public.v_ledger_rows`)).rows[0];
    assert.equal(num(ledger.n), 2);
    assert.equal((await call(db, manager, `public.dashboard_kpis('7d', null)`)).length, 4);
    await assert.rejects(asAnon(db, `select * from public.v_product_rows`), /permission denied/);
  });
});
