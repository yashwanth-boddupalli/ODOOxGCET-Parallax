// All data access goes through this file. Each function returns plain objects in
// the same shape the original mock data used (mockProducts, mockOperations, ...),
// so the pages and components didn't need to change how they read fields.
import { supabase } from '../lib/supabase';
import { toNumber } from '../lib/format';

const ROW_LIMIT = 1000; // tables paginate on the client; this caps one fetch

// Turn a Supabase response into data, or throw an Error with a readable message.
function unwrap({ data, error }) {
  if (error) {
    const err = new Error(error.message || 'Something went wrong. Please try again.');
    err.code = error.code;
    throw err;
  }
  return data;
}

const rpc = async (name, args = {}) => unwrap(await supabase.rpc(name, args));
const scope = (warehouseId) => (warehouseId ? Number(warehouseId) : null);

// ---------------------------------------------------------------------------
// Mappers (database snake_case -> UI camelCase)
// ---------------------------------------------------------------------------
const toProduct = (r) => ({
  id: r.id,
  name: r.name ?? '',
  sku: r.sku ?? '',
  category: r.category ?? '',
  categoryId: r.category_id,
  stock: toNumber(r.stock),
  minStock: toNumber(r.min_stock),
  reorderQty: r.reorder_qty === null ? null : toNumber(r.reorder_qty),
  price: toNumber(r.price),
  unit: r.unit ?? 'pcs',
  warehouse: r.warehouse ?? '',
  warehouseId: r.warehouse_id,
  status: r.status ?? 'In Stock',
  archived: Boolean(r.archived),
});

const toOperationRow = (r) => ({
  id: r.id,
  documentId: r.document_id,
  productId: r.product_id,
  product: r.product ?? '',
  sku: r.sku ?? '',
  operation: r.operation ?? '',
  type: r.type,
  state: r.state,
  warehouse: r.warehouse ?? '',
  quantity: toNumber(r.quantity),
  unit: r.unit ?? '',
  status: r.status ?? '',
  date: r.date ?? '',
  dateIso: r.date_iso,
  user: r.responsible ?? '',
  reference: r.reference ?? '',
  partnerName: r.partner_name ?? '',
});

const toLedgerRow = (r) => ({
  id: r.id,
  documentId: r.document_id,
  productId: r.product_id,
  product: r.product ?? '',
  sku: r.sku ?? '',
  operation: r.operation ?? '',
  type: r.type,
  warehouse: r.warehouse ?? '',
  quantity: toNumber(r.quantity),
  unit: r.unit ?? '',
  status: r.status ?? 'Completed',
  date: r.date ?? '',
  dateIso: r.date_iso,
  user: r.responsible ?? '',
  reference: r.reference ?? '',
  sourceLocation: r.source_location ?? '',
  destinationLocation: r.destination_location ?? '',
});

const toWarehouse = (r) => ({
  id: r.id,
  name: r.name ?? '',
  code: r.code ?? '',
  location: r.location ?? '',
  capacity: r.capacity ?? '0%',
  capacityPercent: r.capacity_percent === null ? null : toNumber(r.capacity_percent),
  capacityUnits: r.capacity_units === null ? null : toNumber(r.capacity_units),
  totalItems: toNumber(r.total_items),
  activeManagers: toNumber(r.active_managers),
});

const toLocation = (r) => ({
  id: r.id,
  name: r.name,
  code: r.code,
  type: r.type,
  warehouseId: r.warehouse_id,
  warehouse: r.warehouse ?? '',
  isDefault: r.is_default,
  label: r.label ?? r.name,
});

const toLowStock = (r) => ({
  id: r.id,
  name: r.name ?? '',
  sku: r.sku ?? '',
  category: r.category ?? '',
  stock: toNumber(r.stock),
  minStock: toNumber(r.min_stock),
  recommendedQty: toNumber(r.recommended_qty),
  unit: r.unit ?? 'pcs',
  warehouse: r.warehouse ?? '',
  warehouseId: r.warehouse_id,
  status: r.status,
  daysOfCover: r.days_of_cover === null ? null : toNumber(r.days_of_cover),
});

const toProfile = (r) => ({
  id: r.id,
  fullName: r.full_name ?? '',
  email: r.email ?? '',
  role: r.role,
  jobTitle: r.job_title ?? '',
  defaultWarehouseId: r.default_warehouse_id,
  active: r.active,
});

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------
export async function getMyProfile(userId) {
  const data = unwrap(await supabase.from('profiles').select('*').eq('id', userId).maybeSingle());
  return data ? toProfile(data) : null;
}

export async function listProfiles() {
  const data = unwrap(await supabase.from('profiles').select('*').order('full_name'));
  return data.map(toProfile);
}

export async function updateMyProfile(userId, { fullName, jobTitle, defaultWarehouseId }) {
  unwrap(await supabase.from('profiles')
    .update({ full_name: fullName, job_title: jobTitle, default_warehouse_id: defaultWarehouseId || null })
    .eq('id', userId));
}

export const setUserAccess = (userId, { role = null, active = null }) =>
  rpc('set_user_access', { p_user_id: userId, p_role: role, p_active: active });

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------
export async function listProducts({ warehouseId, includeArchived = false } = {}) {
  let query = supabase.rpc('product_rows', { p_warehouse_id: scope(warehouseId) }).select('*');
  if (!includeArchived) query = query.eq('archived', false);
  const data = unwrap(await query.order('name').limit(ROW_LIMIT));
  return data.map(toProduct);
}

export async function listCategories() {
  const data = unwrap(await supabase.from('categories').select('id, name, color').order('name'));
  return data;
}

export async function createCategory(name, color) {
  unwrap(await supabase.from('categories').insert({ name, color }));
}

// Matches the Add Product modal: category and warehouse may be ids or names.
export const createProduct = (form) =>
  rpc('create_product', {
    p_name: form.name,
    p_sku: form.sku || null,
    p_category_id: form.categoryId ? Number(form.categoryId) : null,
    p_category: form.category || null,
    p_initial_stock: toNumber(form.initialStock),
    p_warehouse_id: form.warehouseId ? Number(form.warehouseId) : null,
    p_price: toNumber(form.price),
    p_min_stock: toNumber(form.minStock),
    p_unit: form.unit || 'pcs',
  });

export const updateProduct = (id, payload) => rpc('update_product', { p_id: id, p_payload: payload });
export const setProductArchived = (id, archived) =>
  rpc('set_product_archived', { p_id: id, p_archived: archived });

// ---------------------------------------------------------------------------
// Warehouses and locations
// ---------------------------------------------------------------------------
export async function listWarehouses() {
  const data = unwrap(await supabase.from('v_warehouse_cards').select('*').eq('active', true).order('name'));
  return data.map(toWarehouse);
}

export async function listLocations({ type = 'INTERNAL' } = {}) {
  let query = supabase.from('v_locations').select('*').eq('active', true);
  if (type) query = query.eq('type', type);
  const data = unwrap(await query.order('label'));
  return data.map(toLocation);
}

export async function listStockLevels({ productIds } = {}) {
  let query = supabase.from('v_stock_levels').select('*');
  if (productIds?.length) query = query.in('product_id', productIds);
  const data = unwrap(await query.limit(ROW_LIMIT));
  return data.map((r) => ({
    productId: r.product_id,
    locationId: r.location_id,
    location: r.location,
    warehouseId: r.warehouse_id,
    quantity: toNumber(r.quantity),
  }));
}

export const createWarehouse = ({ name, code, address, capacityUnits }) =>
  rpc('create_warehouse', {
    p_name: name,
    p_code: code,
    p_address: address || '',
    p_capacity_units: capacityUnits ? toNumber(capacityUnits) : null,
  });

export const createLocation = (warehouseId, name) =>
  rpc('create_location', { p_warehouse_id: warehouseId, p_name: name, p_code: null });

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------
export const OPERATION_TYPES = {
  RECEIPT: { label: 'Receipt', prefix: 'PO' },
  DELIVERY: { label: 'Delivery', prefix: 'DO' },
  TRANSFER: { label: 'Internal Transfer', prefix: 'TR' },
  ADJUSTMENT: { label: 'Adjustment', prefix: 'ADJ' },
};

const byWarehouse = (query, warehouseId) =>
  warehouseId
    ? query.or(`source_warehouse_id.eq.${Number(warehouseId)},destination_warehouse_id.eq.${Number(warehouseId)}`)
    : query;

export async function listOperationRows({ type, warehouseId } = {}) {
  let query = supabase.from('v_operation_rows').select('*');
  if (type) query = query.eq('type', type);
  query = byWarehouse(query, warehouseId);
  const data = unwrap(await query.order('date_iso', { ascending: false }).order('id', { ascending: false }).limit(ROW_LIMIT));
  return data.map(toOperationRow);
}

export async function getOperation(id) {
  const header = unwrap(await supabase.from('v_operation_documents').select('*').eq('id', id).maybeSingle());
  if (!header) throw new Error('Document not found');
  const lines = unwrap(await supabase.from('v_operation_rows').select('*').eq('document_id', id).order('id'));
  return {
    id: header.id,
    reference: header.reference,
    type: header.type,
    operation: header.operation,
    state: header.state,
    status: header.status,
    source: header.source,
    sourceLocationId: header.source_location_id,
    sourceType: header.source_type,
    destination: header.destination,
    destinationLocationId: header.destination_location_id,
    destinationType: header.destination_type,
    partnerName: header.partner_name ?? '',
    reason: header.reason ?? '',
    notes: header.notes ?? '',
    scheduledDate: header.scheduled_date,
    responsible: header.responsible ?? '',
    backorderOf: header.backorder_of ?? '',
    date: header.date,
    validatedAt: header.validated_at,
    lines: lines.map((r) => ({
      ...toOperationRow(r),
      plannedQuantity: toNumber(r.planned_quantity),
      doneQuantity: toNumber(r.done_quantity),
      countedQuantity: r.counted_quantity === null ? null : toNumber(r.counted_quantity),
      systemQuantity: r.system_quantity === null ? null : toNumber(r.system_quantity),
    })),
  };
}

export const createOperation = (type, payload) => rpc('create_operation', { p_type: type, p_payload: payload });
export const updateOperation = (id, payload) => rpc('update_operation', { p_id: id, p_payload: payload });
export const confirmOperation = (id) => rpc('confirm_operation', { p_id: id });
export const checkAvailability = (id) => rpc('check_availability', { p_id: id });
export const cancelOperation = (id) => rpc('cancel_operation', { p_id: id });
export const validateOperation = (id, lines = null, createBackorder = true) =>
  rpc('validate_operation', { p_id: id, p_lines: lines, p_create_backorder: createBackorder });

// ---------------------------------------------------------------------------
// Ledger
// ---------------------------------------------------------------------------
export async function listLedger({ warehouseId, from, to } = {}) {
  let query = byWarehouse(supabase.from('v_ledger_rows').select('*'), warehouseId);
  if (from) query = query.gte('performed_at', new Date(`${from}T00:00:00`).toISOString());
  if (to) query = query.lt('performed_at', new Date(new Date(`${to}T00:00:00`).getTime() + 86_400_000).toISOString());
  const data = unwrap(await query.order('performed_at', { ascending: false }).order('id', { ascending: false }).limit(ROW_LIMIT));
  return data.map(toLedgerRow);
}

// ---------------------------------------------------------------------------
// Dashboard, analytics, low stock
// ---------------------------------------------------------------------------
export const getDashboardSummary = (warehouseId) => rpc('dashboard_summary', { p_warehouse_id: scope(warehouseId) });
export const getKpis = (range, warehouseId) => rpc('dashboard_kpis', { p_range: range, p_warehouse_id: scope(warehouseId) });
export const getActivity = (range, warehouseId) => rpc('dashboard_activity', { p_range: range, p_warehouse_id: scope(warehouseId) });
export const getStockMovement = (range, warehouseId) =>
  rpc('dashboard_stock_movement', { p_range: range, p_warehouse_id: scope(warehouseId) });
export const getCategoryBreakdown = (warehouseId) => rpc('dashboard_categories', { p_warehouse_id: scope(warehouseId) });
export const getFastMoving = (warehouseId) =>
  rpc('dashboard_fast_moving', { p_days: 30, p_limit: 6, p_warehouse_id: scope(warehouseId) });
export const getPerformance = (warehouseId) =>
  rpc('dashboard_performance', { p_months: 6, p_warehouse_id: scope(warehouseId) });
export const getAnalyticsKpis = (warehouseId) => rpc('analytics_kpis', { p_warehouse_id: scope(warehouseId) });

export async function listLowStock(warehouseId) {
  const data = unwrap(await supabase.rpc('low_stock_rows', { p_warehouse_id: scope(warehouseId) }).select('*'));
  return data.map(toLowStock);
}
export const getLowStockSummary = (warehouseId) => rpc('low_stock_summary', { p_warehouse_id: scope(warehouseId) });
export const reorderProduct = (productId, quantity = null) =>
  rpc('reorder_product', { p_product_id: productId, p_quantity: quantity });
export const reorderLowStock = (warehouseId) => rpc('reorder_low_stock', { p_warehouse_id: scope(warehouseId) });

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
export async function getSettings() {
  const r = unwrap(await supabase.from('app_settings').select('*').eq('id', 1).maybeSingle());
  if (!r) return null;
  return {
    workspaceName: r.workspace_name,
    defaultWarehouseId: r.default_warehouse_id,
    reorderMultiplier: r.reorder_multiplier,
    requireManagerSignoffOnNegativeAdjustments: r.require_signoff_negative_adjustments,
    stockTargetUnits: r.stock_target_units === null ? '' : toNumber(r.stock_target_units),
    timeZone: r.time_zone,
  };
}

export const updateSettings = (payload) => rpc('update_settings', { p_payload: payload });

// ---------------------------------------------------------------------------
// Global search (header)
// ---------------------------------------------------------------------------
export async function searchEverything(term) {
  const q = term.replace(/[%,()]/g, ' ').trim();
  if (q.length < 2) return { products: [], operations: [], warehouses: [] };
  const like = `%${q}%`;
  const [products, operations, warehouses] = await Promise.all([
    supabase.from('v_product_rows').select('*').eq('archived', false).or(`name.ilike.${like},sku.ilike.${like}`).limit(5),
    supabase.from('v_operation_documents').select('id, reference, operation, status, partner_name, date')
      .or(`reference.ilike.${like},partner_name.ilike.${like}`).order('created_at', { ascending: false }).limit(5),
    supabase.from('v_warehouse_cards').select('*').or(`name.ilike.${like},code.ilike.${like},location.ilike.${like}`).limit(5),
  ]);
  return {
    products: unwrap(products).map(toProduct),
    operations: unwrap(operations),
    warehouses: unwrap(warehouses).map(toWarehouse),
  };
}
