import React, { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Plus, SlidersHorizontal, Trash2 } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Alert, Field } from '../common/FormControls';
import { confirmOperation, createOperation, listLocations, listProducts, listStockLevels } from '../../api';
import { useAsync, useWorkspace } from '../../app/useWorkspace';
import { formatQty, formatSignedQty, toNumber } from '../../lib/format';

const TYPES = {
  RECEIPT: {
    title: 'Create Receipt',
    subtitle: 'Receive goods from a vendor into a warehouse.',
    icon: ArrowDownLeft,
    partner: 'Vendor',
    partnerPlaceholder: 'e.g. Apex Components Pvt Ltd',
  },
  DELIVERY: {
    title: 'New Delivery Order',
    subtitle: 'Ship goods from a warehouse to a customer.',
    icon: ArrowUpRight,
    partner: 'Customer',
    partnerPlaceholder: 'e.g. Reliance Retail',
  },
  TRANSFER: {
    title: 'Transfer Stock',
    subtitle: 'Move stock between warehouses or racks. Total stock stays the same.',
    icon: ArrowLeftRight,
  },
  ADJUSTMENT: {
    title: 'New Inventory Adjustment',
    subtitle: 'Enter what you physically counted. The difference is written to the ledger.',
    icon: SlidersHorizontal,
  },
};

const REASONS = ['Cycle count', 'Damaged', 'Expired', 'Lost / stolen', 'Found', 'Other'];

let lineKey = 0;
const newLine = () => ({ key: ++lineKey, productId: '', quantity: '' });

export const OperationFormModal = ({ type, onClose }) => {
  const config = TYPES[type];
  const { warehouseId, settings, notify, refresh, openOperation } = useWorkspace();
  const products = useAsync(() => listProducts(), []);
  const locations = useAsync(() => listLocations(), []);
  const stock = useAsync(() => listStockLevels(), []);

  // Default to the active warehouse's main location (or the workspace default).
  const defaultLocationId = useMemo(() => {
    const list = locations.data || [];
    const wh = warehouseId || settings?.defaultWarehouseId;
    return (list.find((l) => l.warehouseId === Number(wh) && l.isDefault) || list.find((l) => l.isDefault) || list[0])?.id || '';
  }, [locations.data, warehouseId, settings]);

  const [form, setForm] = useState({
    partnerName: '',
    locationId: '',
    destinationLocationId: '',
    scheduledDate: '',
    reason: REASONS[0],
    notes: '',
  });
  const [lines, setLines] = useState([newLine()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const locationId = form.locationId || defaultLocationId;
  const destinationLocationId =
    form.destinationLocationId || (locations.data || []).find((l) => l.id !== Number(locationId))?.id || '';

  const productById = useMemo(() => new Map((products.data || []).map((p) => [p.id, p])), [products.data]);
  const onHand = (productId, locId) =>
    (stock.data || []).find((s) => s.productId === Number(productId) && s.locationId === Number(locId))?.quantity || 0;

  const updateLine = (key, patch) => setLines(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const removeLine = (key) => setLines(lines.length > 1 ? lines.filter((l) => l.key !== key) : lines);

  const isAdjustment = type === 'ADJUSTMENT';
  const filledLines = lines.filter((l) => l.productId && l.quantity !== '');

  const buildPayload = () => {
    const payloadLines = filledLines.map((l) =>
      isAdjustment
        ? { productId: Number(l.productId), countedQuantity: toNumber(l.quantity) }
        : { productId: Number(l.productId), quantity: toNumber(l.quantity) });
    const common = { notes: form.notes, scheduledDate: form.scheduledDate || null, lines: payloadLines };
    switch (type) {
      case 'RECEIPT':
      case 'DELIVERY':
        return { ...common, locationId: Number(locationId), partnerName: form.partnerName };
      case 'TRANSFER':
        return { ...common, sourceLocationId: Number(locationId), destinationLocationId: Number(destinationLocationId) };
      default:
        return { ...common, locationId: Number(locationId), reason: form.reason };
    }
  };

  const submit = async (confirmNow) => {
    setError('');
    if (!filledLines.length) return setError('Add at least one product with a quantity.');
    if (type === 'TRANSFER' && Number(locationId) === Number(destinationLocationId)) {
      return setError('Choose two different locations for a transfer.');
    }
    setBusy(true);
    try {
      const id = await createOperation(type, buildPayload());
      if (confirmNow) await confirmOperation(id);
      notify(`${config.title.replace(/^(Create|New) /, '')} saved${confirmNow ? ' and marked ready' : ' as draft'}.`);
      refresh();
      onClose();
      openOperation(id);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const locationOptions = (locations.data || []).map((l) => (
    <option key={l.id} value={l.id}>{l.label}</option>
  ));

  const lineHint = (line) => {
    if (!line.productId) return null;
    const p = productById.get(Number(line.productId));
    const available = onHand(line.productId, locationId);
    if (isAdjustment) {
      if (line.quantity === '') return { text: `System quantity here: ${formatQty(available)} ${p?.unit || ''}` };
      const diff = toNumber(line.quantity) - available;
      return { text: `System ${formatQty(available)} → counted ${formatQty(line.quantity)} = ${formatSignedQty(diff)} ${p?.unit || ''}`, warn: diff < 0 };
    }
    if (type === 'RECEIPT') return { text: `Currently ${formatQty(available)} ${p?.unit || ''} at this location` };
    const short = toNumber(line.quantity) > available;
    return {
      text: short
        ? `Only ${formatQty(available)} ${p?.unit || ''} available — the document will wait for stock`
        : `${formatQty(available)} ${p?.unit || ''} available at source`,
      warn: short,
    };
  };

  return (
    <Modal
      icon={config.icon}
      title={config.title}
      subtitle={config.subtitle}
      onClose={onClose}
      busy={busy}
      size="lg"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <span className="spacer" />
          <button type="button" className="btn btn-secondary" onClick={() => submit(false)} disabled={busy}>
            Save as Draft
          </button>
          <button type="button" className="btn btn-primary" onClick={() => submit(true)} disabled={busy}>
            {busy ? 'Saving…' : 'Save & Mark Ready'}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Alert kind="error">{error || products.error?.message || locations.error?.message}</Alert>

        {config.partner && (
          <div className="form-row">
            <Field label={config.partner} htmlFor="of-partner">
              <input id="of-partner" className="form-input" placeholder={config.partnerPlaceholder}
                value={form.partnerName} onChange={set('partnerName')} autoFocus />
            </Field>
            <Field label="Scheduled Date" htmlFor="of-date">
              <input id="of-date" className="form-input" type="date" value={form.scheduledDate} onChange={set('scheduledDate')} />
            </Field>
          </div>
        )}

        {type === 'TRANSFER' ? (
          <div className="form-row">
            <Field label="From" htmlFor="of-from" required>
              <select id="of-from" className="form-select" value={locationId} onChange={set('locationId')}>{locationOptions}</select>
            </Field>
            <Field label="To" htmlFor="of-to" required>
              <select id="of-to" className="form-select" value={destinationLocationId} onChange={set('destinationLocationId')}>
                {locationOptions}
              </select>
            </Field>
          </div>
        ) : (
          <div className="form-row">
            <Field
              label={type === 'RECEIPT' ? 'Receive Into' : type === 'DELIVERY' ? 'Ship From' : 'Counted At'}
              htmlFor="of-location"
              required
            >
              <select id="of-location" className="form-select" value={locationId} onChange={set('locationId')}>{locationOptions}</select>
            </Field>
            {isAdjustment ? (
              <Field label="Reason" htmlFor="of-reason">
                <select id="of-reason" className="form-select" value={form.reason} onChange={set('reason')}>
                  {REASONS.map((r) => <option key={r}>{r}</option>)}
                </select>
              </Field>
            ) : !config.partner ? null : <div />}
          </div>
        )}

        <div>
          <div className="form-label-row" style={{ marginBottom: 8 }}>
            <span className="form-label">Products</span>
            <span className="form-hint">{isAdjustment ? 'Counted quantity' : 'Quantity'}</span>
          </div>
          <div className="line-editor">
            {lines.map((line) => {
              const hint = lineHint(line);
              return (
                <div key={line.key} className="line-row">
                  <select className="form-select" value={line.productId} aria-label="Product"
                    onChange={(e) => updateLine(line.key, { productId: e.target.value })}>
                    <option value="">Select a product…</option>
                    {(products.data || []).map((p) => (
                      <option key={p.id} value={p.id}>{p.name} · {p.sku}</option>
                    ))}
                  </select>
                  <input className="form-input" type="number" min="0" step="any" aria-label="Quantity"
                    placeholder={isAdjustment ? 'Counted' : 'Qty'} value={line.quantity}
                    onChange={(e) => updateLine(line.key, { quantity: e.target.value })} />
                  <button type="button" className="icon-button" onClick={() => removeLine(line.key)}
                    disabled={lines.length === 1} aria-label="Remove line" title="Remove line">
                    <Trash2 size={15} />
                  </button>
                  {hint && <span className={`line-meta ${hint.warn ? 'warn' : ''}`}>{hint.text}</span>}
                </div>
              );
            })}
          </div>
          <button type="button" className="btn btn-outline-primary btn-sm" style={{ marginTop: 10 }}
            onClick={() => setLines([...lines, newLine()])}>
            <Plus size={14} /> Add product
          </button>
        </div>

        <Field label="Notes" htmlFor="of-notes">
          <textarea id="of-notes" className="form-textarea" rows={2} placeholder="Optional"
            value={form.notes} onChange={set('notes')} />
        </Field>
      </div>
    </Modal>
  );
};
