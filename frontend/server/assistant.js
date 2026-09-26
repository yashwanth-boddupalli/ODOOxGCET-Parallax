// StockSense AI assistant (server side).
//
// Answers questions about live inventory data. The model never sees the database
// directly: it asks for data through the read-only "tools" below, and every tool
// runs as the signed-in user (their JWT), so Row Level Security applies exactly
// as it does in the app. The Groq API key stays on the server.
//
// Plain ESM + fetch, so the same file can later run in a Supabase Edge Function
// or a Vercel function without changes.
import { createClient } from '@supabase/supabase-js';
import { DEFAULT_SUPABASE_PUBLISHABLE_KEY, DEFAULT_SUPABASE_URL } from '../src/lib/supabaseConfig.js';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'openai/gpt-oss-120b';
const FALLBACK_MODEL = 'openai/gpt-oss-20b'; // used if the main model is rate-limited
const MAX_TOOL_ROUNDS = 6;
const MAX_TOOL_RESULT_CHARS = 9000;
const MAX_HISTORY = 12;
const TIME_ZONE = 'Asia/Kolkata';

export class AssistantError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// ---------------------------------------------------------------------------
// Tools the model can call (OpenAI-style function definitions)
// ---------------------------------------------------------------------------
const warehouseParam = {
  type: 'string',
  description: 'Optional warehouse name to limit results to. Omit to use the warehouse selected in the app (or all).',
};
const dateParam = (what) => ({ type: 'string', description: `${what} date, YYYY-MM-DD (inclusive)` });

const TOOLS = [
  {
    name: 'get_overview',
    description:
      'Headline KPIs: total products, units in stock, pending deliveries, low-stock count, each with change vs an earlier point; plus counts of pending receipts/deliveries. Use for general "how are we doing" questions.',
    parameters: {
      type: 'object',
      properties: {
        range: { type: 'string', enum: ['today', '7d', '30d', 'quarter'], description: 'Comparison window (default 30d)' },
        warehouse: warehouseParam,
      },
      additionalProperties: false,
    },
  },
  {
    name: 'search_products',
    description:
      'Find products by name or SKU (partial match), category or stock status. Returns stock on hand, minimum (reorder) level, unit price, unit, primary warehouse and status.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Part of a product name or SKU' },
        category: { type: 'string' },
        status: { type: 'string', enum: ['In Stock', 'Low Stock', 'Out of Stock'] },
        warehouse: warehouseParam,
        limit: { type: 'integer', minimum: 1, maximum: 50 },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_product_stock',
    description: 'Where one product is stocked: quantity per warehouse/location, total, reorder level and status. Give a SKU or (part of) its name.',
    parameters: {
      type: 'object',
      properties: { product: { type: 'string', description: 'SKU or product name' } },
      required: ['product'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_low_stock',
    description: 'Products at or below their reorder level (or out of stock), with recommended reorder quantity and days of cover, plus a summary.',
    parameters: { type: 'object', properties: { warehouse: warehouseParam }, additionalProperties: false },
  },
  {
    name: 'list_operations',
    description:
      'Receipts (incoming from vendors), deliveries (outgoing to customers), internal transfers and inventory adjustments, newest first. One row per product line. quantity is signed (+ into stock, - out). Statuses: Pending, In Progress (ready), Completed, Cancelled.',
    parameters: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['RECEIPT', 'DELIVERY', 'TRANSFER', 'ADJUSTMENT'] },
        status: { type: 'string', enum: ['Pending', 'In Progress', 'Completed', 'Cancelled'] },
        product: { type: 'string', description: 'Part of a product name or SKU' },
        partner: { type: 'string', description: 'Part of a vendor or customer name' },
        reference: { type: 'string', description: 'Document reference such as PO-2026-0012' },
        from: dateParam('Start'),
        to: dateParam('End'),
        warehouse: warehouseParam,
        limit: { type: 'integer', minimum: 1, maximum: 100 },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_stock_movements',
    description:
      'The stock ledger: completed movements only (what actually moved, when, where, by whom), optionally for one product and date range. Includes totals in and out.',
    parameters: {
      type: 'object',
      properties: {
        product: { type: 'string', description: 'Part of a product name or SKU' },
        from: dateParam('Start'),
        to: dateParam('End'),
        warehouse: warehouseParam,
        limit: { type: 'integer', minimum: 1, maximum: 100 },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_warehouses',
    description: 'All warehouses with address, units stored, capacity utilisation, staff count and their storage locations.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_analytics',
    description:
      'Deeper analytics. activity_7d / activity_30d: units received vs shipped per day. fast_movers: best sellers (30 days). monthly_performance: turnover, on-time delivery %, count accuracy %, volume (6 months). valuation: inventory value, days on hand, dead stock. categories: units on hand per category.',
    parameters: {
      type: 'object',
      properties: {
        report: {
          type: 'string',
          enum: ['activity_7d', 'activity_30d', 'fast_movers', 'monthly_performance', 'valuation', 'categories'],
        },
        warehouse: warehouseParam,
      },
      required: ['report'],
      additionalProperties: false,
    },
  },
];

// Models often send null for "not given"; Groq validates strictly, so optional
// parameters accept null too.
for (const tool of TOOLS) {
  const required = new Set(tool.parameters.required || []);
  for (const [key, schema] of Object.entries(tool.parameters.properties)) {
    // Some schema objects (e.g. warehouseParam) are shared between tools: convert once.
    if (required.has(key) || Array.isArray(schema.type)) continue;
    schema.type = [schema.type, 'null'];
    if (schema.enum) schema.enum = [...schema.enum, null];
  }
}

// Short labels shown in the chat under an answer ("Checked low stock").
const describe = (name, args) => {
  switch (name) {
    case 'get_overview': return 'Checked dashboard KPIs';
    case 'search_products': return args.query ? `Searched products for “${args.query}”` : 'Looked up products';
    case 'get_product_stock': return `Checked stock of ${args.product}`;
    case 'get_low_stock': return 'Checked low-stock alerts';
    case 'list_operations': return `Looked up ${args.type ? args.type.toLowerCase() + 's' : 'operations'}`;
    case 'get_stock_movements': return args.product ? `Read the ledger for ${args.product}` : 'Read the stock ledger';
    case 'get_warehouses': return 'Checked warehouses';
    case 'get_analytics': return `Ran ${String(args.report || '').replace(/_/g, ' ')} report`;
    default: return name;
  }
};

// ---------------------------------------------------------------------------
// Tool implementations (all read-only, all through the user's own session)
// ---------------------------------------------------------------------------
const num = (v) => (v === null || v === undefined ? v : Number(v));
const clampLimit = (v, def, max) => Math.min(Math.max(Number(v) || def, 1), max);
const like = (s) => `%${String(s).replace(/[%,()*]/g, ' ').trim()}%`;
const dayStart = (d) => new Date(`${d}T00:00:00+05:30`).toISOString();
const dayEnd = (d) => new Date(new Date(`${d}T00:00:00+05:30`).getTime() + 86_400_000).toISOString();

function unwrap({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

function createTools(db, defaultWarehouseId) {
  let warehouseCache;
  const warehouses = async () => {
    warehouseCache ??= unwrap(await db.from('v_warehouse_cards').select('id, name, code'));
    return warehouseCache;
  };
  // Warehouse named by the model, else the one selected in the app, else all.
  const scope = async (name) => {
    if (!name) return defaultWarehouseId || null;
    const needle = name.toLowerCase();
    const match = (await warehouses()).find(
      (w) => w.name.toLowerCase().includes(needle) || w.code.toLowerCase() === needle);
    if (!match) throw new Error(`No warehouse matches "${name}"`);
    return match.id;
  };
  const byWarehouse = (query, id) =>
    id ? query.or(`source_warehouse_id.eq.${id},destination_warehouse_id.eq.${id}`) : query;

  const findProduct = async (text) => {
    const exact = unwrap(await db.from('v_product_rows').select('*').ilike('sku', text.trim()).limit(1));
    if (exact.length) return exact[0];
    const byName = unwrap(await db.from('v_product_rows').select('*')
      .or(`name.ilike.${like(text)},sku.ilike.${like(text)}`).eq('archived', false).limit(5));
    if (!byName.length) throw new Error(`No product matches "${text}"`);
    return byName[0];
  };

  const productRow = (p) => ({
    name: p.name, sku: p.sku, category: p.category, stock: num(p.stock), unit: p.unit,
    min_stock: num(p.min_stock), price: num(p.price), primary_warehouse: p.warehouse, status: p.status,
  });

  return {
    async get_overview({ range = '30d', warehouse }) {
      const id = await scope(warehouse);
      const [kpis, summary] = await Promise.all([
        unwrap(await db.rpc('dashboard_kpis', { p_range: range, p_warehouse_id: id })),
        unwrap(await db.rpc('dashboard_summary', { p_warehouse_id: id })),
      ]);
      return {
        range,
        kpis: kpis.map((k) => ({ metric: k.label, value: k.value, change: k.change, compared: k.timeframe, note: k.badge })),
        pending_receipts: summary.pendingReceipts,
        pending_deliveries: summary.pendingDeliveries,
      };
    },

    async search_products({ query, category, status, warehouse, limit }) {
      const id = await scope(warehouse);
      let q = db.rpc('product_rows', { p_warehouse_id: id }).select('*').eq('archived', false);
      if (query) q = q.or(`name.ilike.${like(query)},sku.ilike.${like(query)}`);
      if (category) q = q.ilike('category', like(category));
      if (status) q = q.eq('status', status);
      const rows = unwrap(await q.order('name').limit(clampLimit(limit, 25, 50)));
      return { count: rows.length, stock_scope: id ? 'selected warehouse' : 'all warehouses', products: rows.map(productRow) };
    },

    async get_product_stock({ product }) {
      const p = await findProduct(product);
      const levels = unwrap(await db.from('v_stock_levels').select('location, warehouse, quantity').eq('product_id', p.id));
      return { ...productRow(p), by_location: levels.map((l) => ({ location: l.location, quantity: num(l.quantity) })) };
    },

    async get_low_stock({ warehouse }) {
      const id = await scope(warehouse);
      const [rows, summary] = await Promise.all([
        unwrap(await db.rpc('low_stock_rows', { p_warehouse_id: id }).select('*')),
        unwrap(await db.rpc('low_stock_summary', { p_warehouse_id: id })),
      ]);
      return {
        summary,
        products: rows.map((r) => ({
          name: r.name, sku: r.sku, stock: num(r.stock), unit: r.unit, min_stock: num(r.min_stock),
          recommended_reorder: num(r.recommended_qty), warehouse: r.warehouse, status: r.status,
          days_of_cover: num(r.days_of_cover),
        })),
      };
    },

    async list_operations({ type, status, product, partner, reference, from, to, warehouse, limit }) {
      const id = await scope(warehouse);
      let q = db.from('v_operation_rows')
        .select('reference, operation, product, sku, warehouse, quantity, unit, status, date, responsible, partner_name, scheduled_date',
          { count: 'exact' });
      if (type) q = q.eq('type', type);
      if (status) q = q.eq('status', status);
      if (product) q = q.or(`product.ilike.${like(product)},sku.ilike.${like(product)}`);
      if (partner) q = q.ilike('partner_name', like(partner));
      if (reference) q = q.ilike('reference', like(reference));
      if (from) q = q.gte('date_iso', dayStart(from));
      if (to) q = q.lt('date_iso', dayEnd(to));
      q = byWarehouse(q, id);
      const { data, error, count } = await q.order('date_iso', { ascending: false }).limit(clampLimit(limit, 20, 100));
      if (error) throw new Error(error.message);
      return { total_matching: count, showing: data.length, rows: data.map((r) => ({ ...r, quantity: num(r.quantity) })) };
    },

    async get_stock_movements({ product, from, to, warehouse, limit }) {
      const id = await scope(warehouse);
      let q = db.from('v_ledger_rows')
        .select('reference, operation, product, sku, quantity, unit, date, responsible, source_location, destination_location',
          { count: 'exact' });
      if (product) q = q.or(`product.ilike.${like(product)},sku.ilike.${like(product)}`);
      if (from) q = q.gte('performed_at', dayStart(from));
      if (to) q = q.lt('performed_at', dayEnd(to));
      q = byWarehouse(q, id);
      const { data, error, count } = await q.order('performed_at', { ascending: false }).limit(clampLimit(limit, 30, 100));
      if (error) throw new Error(error.message);
      const rows = data.map((r) => ({ ...r, quantity: num(r.quantity) }));
      const totalIn = rows.filter((r) => r.quantity > 0 && r.operation !== 'Internal Transfer').reduce((s, r) => s + r.quantity, 0);
      const totalOut = rows.filter((r) => r.quantity < 0).reduce((s, r) => s - r.quantity, 0);
      return { total_matching: count, showing: rows.length, units_in_shown: totalIn, units_out_shown: totalOut, rows };
    },

    async get_warehouses() {
      const [cards, locations] = await Promise.all([
        unwrap(await db.from('v_warehouse_cards').select('*').eq('active', true)),
        unwrap(await db.from('v_locations').select('name, warehouse, is_default').eq('type', 'INTERNAL')),
      ]);
      return cards.map((w) => ({
        name: w.name, code: w.code, address: w.location, units_stored: num(w.total_items),
        capacity_used: w.capacity_units ? w.capacity : 'no capacity set', staff: w.active_managers,
        locations: locations.filter((l) => l.warehouse === w.name).map((l) => l.name),
      }));
    },

    async get_analytics({ report, warehouse }) {
      const id = await scope(warehouse);
      switch (report) {
        case 'activity_7d':
        case 'activity_30d':
          return unwrap(await db.rpc('dashboard_activity', { p_range: report.endsWith('30d') ? '30d' : '7d', p_warehouse_id: id }))
            .map(({ day, date, inbound, outbound }) => ({ day, date, units_received: inbound, units_shipped: outbound }));
        case 'fast_movers':
          return unwrap(await db.rpc('dashboard_fast_moving', { p_days: 30, p_limit: 10, p_warehouse_id: id }));
        case 'monthly_performance':
          return unwrap(await db.rpc('dashboard_performance', { p_months: 6, p_warehouse_id: id }));
        case 'valuation':
          return unwrap(await db.rpc('analytics_kpis', { p_warehouse_id: id }));
        case 'categories':
          return unwrap(await db.rpc('dashboard_categories', { p_warehouse_id: id }));
        default:
          throw new Error(`Unknown report ${report}`);
      }
    },
  };
}

// Some models write SKUs with non-breaking hyphens (EQP‑SC‑889); normalise them so
// copied SKUs match the database.
const tidy = (text) => (text || '').replace(/[‐‑‒]/g, '-').trim();

// ---------------------------------------------------------------------------
// Conversation loop
// ---------------------------------------------------------------------------
function systemPrompt({ userName, role, warehouseName }) {
  const now = new Date().toLocaleString('en-IN', {
    timeZone: TIME_ZONE, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  return [
    'You are the StockSense Assistant, built into an inventory management app.',
    `Today is ${now} (${TIME_ZONE}). You are helping ${userName || 'a team member'} (${role === 'MANAGER' ? 'inventory manager' : 'warehouse staff'}).`,
    `Warehouse selected in the app: ${warehouseName || 'All warehouses'}. Tools default to it unless the user names another warehouse.`,
    '',
    'How to answer:',
    '- Always get numbers from the tools; they read live data. Never guess or invent figures, products, dates or names.',
    '- If the tools return nothing relevant, say so plainly.',
    '- Keep answers short and scannable: a one-line answer first, then a small table or bullet list if helpful. Use Markdown.',
    '- Mention units (pcs, kg …) and dates. Money is in US dollars ($).',
    '- "Pending" means not confirmed or waiting for stock; "In Progress" means ready to validate; only "Completed" moved stock.',
    '- You are read-only. If asked to create, change or delete something, explain where to do it in the app (for example: Receipts page → Create Receipt; Low Stock page → Reorder) instead.',
    '- For questions unrelated to this inventory, briefly say you can only help with StockSense data.',
  ].join('\n');
}

// toolChoice 'none' keeps the tool list (needed once tool results are in the chat) but asks for a plain answer.
async function callGroq({ apiKey, model, messages, toolChoice = 'auto' }) {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      tools: TOOLS.map((t) => ({ type: 'function', function: t })),
      tool_choice: toolChoice,
      temperature: 0.2,
      max_tokens: 1400,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new AssistantError(res.status === 429 ? 429 : 502, body?.error?.message || `AI service error (${res.status})`);
    // A malformed tool call is usually fixed by simply asking again.
    err.retryable = res.status === 429 || res.status === 413 || res.status >= 500
      || /tool call validation|failed to call a function/i.test(err.message);
    throw err;
  }
  return body.choices[0].message;
}

// Main model first; if it's rate-limited, try the smaller one once.
async function complete(opts) {
  try {
    return await callGroq(opts);
  } catch (err) {
    if (!err.retryable) throw err;
    // Rate limits: switch to the smaller model. Bad tool call: just try again.
    const retryModel = err.status === 429 && opts.model !== FALLBACK_MODEL ? FALLBACK_MODEL : opts.model;
    return callGroq({ ...opts, model: retryModel });
  }
}

/**
 * @param {object} args
 * @param {{role:'user'|'assistant', content:string}[]} args.messages  chat so far (text only)
 * @param {string} args.accessToken  the signed-in user's Supabase JWT
 * @param {string|number|null} args.warehouseId  warehouse selected in the app
 * @param {{GROQ_API_KEY?:string, GROQ_MODEL?:string, VITE_SUPABASE_URL?:string, VITE_SUPABASE_PUBLISHABLE_KEY?:string}} args.env
 * @returns {Promise<{reply:string, steps:{tool:string,label:string,ok:boolean}[], model:string}>}
 */
export async function answerQuestion({ messages, accessToken, warehouseId, env, dbClient }) {
  const apiKey = env.GROQ_API_KEY;
  if (!apiKey) throw new AssistantError(503, 'The assistant is not configured: add GROQ_API_KEY to frontend/.env.local and restart the dev server.');
  if (!Array.isArray(messages) || !messages.length) throw new AssistantError(400, 'Ask a question first.');

  const history = messages
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
  if (history[history.length - 1]?.role !== 'user') throw new AssistantError(400, 'The last message must be a question.');

  // Every query runs as this user, so RLS decides what the assistant may see.
  const db = dbClient || createClient(
    env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL,
    env.VITE_SUPABASE_PUBLISHABLE_KEY || DEFAULT_SUPABASE_PUBLISHABLE_KEY,
    {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );

  let profile = null;
  if (!dbClient) {
    if (!accessToken) throw new AssistantError(401, 'Please sign in to use the assistant.');
    const { data, error } = await db.auth.getUser(accessToken);
    if (error || !data?.user) throw new AssistantError(401, 'Your session has expired. Please sign in again.');
    profile = unwrap(await db.from('profiles').select('full_name, role, active').eq('id', data.user.id).maybeSingle());
    if (profile && !profile.active) throw new AssistantError(403, 'Your account is deactivated.');
  }

  const tools = createTools(db, warehouseId ? Number(warehouseId) : null);
  let warehouseName = null;
  if (warehouseId) {
    const wh = unwrap(await db.from('v_warehouse_cards').select('name').eq('id', Number(warehouseId)).maybeSingle());
    warehouseName = wh?.name || null;
  }

  const model = env.GROQ_MODEL || DEFAULT_MODEL;
  const convo = [
    { role: 'system', content: systemPrompt({ userName: profile?.full_name, role: profile?.role, warehouseName }) },
    ...history,
  ];
  const steps = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const msg = await complete({ apiKey, model, messages: convo });
    const calls = msg.tool_calls || [];
    if (!calls.length) {
      return { reply: tidy(msg.content) || 'I could not find an answer to that.', steps, model };
    }
    // Send back only the fields the API accepts (drop provider extras like "reasoning").
    convo.push({ role: 'assistant', content: msg.content || '', tool_calls: calls });

    for (const call of calls) {
      const name = call.function?.name;
      let args = {};
      let result;
      let ok = true;
      try {
        const parsed = JSON.parse(call.function?.arguments || '{}') || {};
        args = Object.fromEntries(Object.entries(parsed).filter(([, v]) => v !== null && v !== ''));
        if (!tools[name]) throw new Error(`Unknown tool ${name}`);
        result = await tools[name](args);
      } catch (err) {
        ok = false;
        result = { error: err.message };
      }
      steps.push({ tool: name, label: describe(name, args), ok });
      let content = JSON.stringify(result);
      if (content.length > MAX_TOOL_RESULT_CHARS) {
        content = `${content.slice(0, MAX_TOOL_RESULT_CHARS)} …(truncated; ask for a narrower filter)`;
      }
      convo.push({ role: 'tool', tool_call_id: call.id, content });
    }
  }

  // Too many lookups: ask for a final answer from what it has.
  const final = await complete({ apiKey, model, messages: convo, toolChoice: 'none' });
  return { reply: tidy(final.content) || 'I could not finish that lookup. Try a more specific question.', steps, model };
}
