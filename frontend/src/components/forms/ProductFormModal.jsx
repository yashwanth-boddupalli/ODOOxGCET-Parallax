import React, { useState } from 'react';
import { Archive, Box } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Alert, Field } from '../common/FormControls';
import { createProduct, listCategories, setProductArchived, updateProduct } from '../../api';
import { useAsync, useWorkspace } from '../../app/useWorkspace';

const UNITS = ['pcs', 'kg', 'g', 'l', 'm', 'box', 'pack', 'roll'];

// Without `product`: the Add Product modal. With `product`: edit it (managers only).
// Stock is never edited here — it only changes through receipts, deliveries and adjustments.
export const ProductFormModal = ({ product, onClose }) => {
  const { warehouses, warehouseId, settings, isManager, notify, refresh } = useWorkspace();
  const categories = useAsync(listCategories, []);
  const editing = Boolean(product);
  const [form, setForm] = useState({
    name: product?.name ?? '',
    sku: product?.sku ?? '',
    categoryId: product?.categoryId ?? '',
    unit: product?.unit ?? 'pcs',
    initialStock: '0',
    warehouseId: product ? product.warehouseId ?? '' : warehouseId || settings?.defaultWarehouseId || warehouses[0]?.id || '',
    price: product ? String(product.price) : '',
    minStock: product ? String(product.minStock) : '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const categoryId = form.categoryId || categories.data?.[0]?.id || '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (editing) {
        await updateProduct(product.id, {
          name: form.name,
          sku: form.sku,
          categoryId: Number(categoryId),
          unit: form.unit,
          price: Number(form.price || 0),
          minStock: Number(form.minStock || 0),
          warehouseId: form.warehouseId ? Number(form.warehouseId) : null,
        });
        notify(`Product "${form.name.trim()}" updated.`);
      } else {
        await createProduct({ ...form, categoryId });
        notify(`Product "${form.name.trim()}" added to the catalog.`);
      }
      refresh();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleArchive = async () => {
    setBusy(true);
    try {
      await setProductArchived(product.id, true);
      notify(`"${product.name}" archived. Its history stays in the ledger.`);
      refresh();
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal
      icon={Box}
      title={editing ? `Edit ${product.name}` : 'Add New Product'}
      subtitle={editing
        ? 'Stock levels change only through operations, so they are not editable here.'
        : 'Opening stock is recorded in the ledger as an Initial Stock move.'}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          {editing && (
            <button type="button" className="btn btn-danger" onClick={handleArchive} disabled={busy}>
              <Archive size={14} /> Archive
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="product-form" className="btn btn-primary" disabled={busy || !isManager}>
            {busy ? 'Saving…' : editing ? 'Save Changes' : 'Save Product'}
          </button>
        </>
      }
    >
      <form id="product-form" className="form-grid" onSubmit={handleSubmit}>
        {!isManager && <Alert kind="warning">Only inventory managers can add or edit products.</Alert>}
        <Alert kind="error">{error}</Alert>

        <Field label="Product Name" htmlFor="pf-name" required>
          <input id="pf-name" className="form-input" required placeholder="e.g. Wireless Barcode Scanner 2.4G"
            value={form.name} onChange={set('name')} autoFocus />
        </Field>

        <div className="form-row">
          <Field label="SKU Code" htmlFor="pf-sku" hint={editing ? 'Must stay unique' : 'Leave blank to generate one'}>
            <input id="pf-sku" className="form-input" placeholder="e.g. ELC-SC-901" value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value.toUpperCase() })} />
          </Field>
          <Field label="Category" htmlFor="pf-category" required>
            <select id="pf-category" className="form-select" value={categoryId} onChange={set('categoryId')}>
              {(categories.data || []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="form-row">
          <Field label="Unit Price ($)" htmlFor="pf-price">
            <input id="pf-price" className="form-input" type="number" min="0" step="0.01" placeholder="0.00"
              value={form.price} onChange={set('price')} />
          </Field>
          <Field label="Unit of Measure" htmlFor="pf-unit">
            <select id="pf-unit" className="form-select" value={form.unit} onChange={set('unit')}>
              {[...new Set([...UNITS, form.unit])].map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </Field>
        </div>

        <div className="form-row">
          {!editing && (
            <Field label="Initial Stock Units" htmlFor="pf-stock">
              <input id="pf-stock" className="form-input" type="number" min="0" step="any"
                value={form.initialStock} onChange={set('initialStock')} />
            </Field>
          )}
          <Field label="Min Reorder Threshold" htmlFor="pf-min" hint="Alert when stock falls to this">
            <input id="pf-min" className="form-input" type="number" min="0" step="any" placeholder="0"
              value={form.minStock} onChange={set('minStock')} />
          </Field>
          {editing && (
            <Field label="Primary Warehouse" htmlFor="pf-warehouse">
              <select id="pf-warehouse" className="form-select" value={form.warehouseId} onChange={set('warehouseId')}>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </Field>
          )}
        </div>

        {!editing && (
          <Field label="Target Warehouse" htmlFor="pf-warehouse">
            <select id="pf-warehouse" className="form-select" value={form.warehouseId} onChange={set('warehouseId')}>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </Field>
        )}
      </form>
    </Modal>
  );
};
