import React, { useState } from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { StatusBadge } from '../components/common/StatusBadge';
import { EmptyState } from '../components/common/EmptyState';
import { useAsync, useWorkspace } from '../app/useWorkspace';
import { getLowStockSummary, listLowStock, reorderLowStock, reorderProduct } from '../api';
import { formatQty } from '../lib/format';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Send } from 'lucide-react';

export const LowStockPage = () => {
  const { warehouseId, version, refresh, notify, openOperation, settings } = useWorkspace();
  const rows = useAsync(() => listLowStock(warehouseId), [warehouseId, version]);
  const summary = useAsync(() => getLowStockSummary(warehouseId), [warehouseId, version]);
  const [busyId, setBusyId] = useState(null);

  const lowStockProducts = rows.data || [];
  const s = summary.data;

  const handleReorder = async (product) => {
    setBusyId(product.id);
    try {
      const id = await reorderProduct(product.id);
      notify(`Draft receipt created for ${formatQty(product.recommendedQty)} × ${product.name}.`);
      refresh();
      openOperation(id);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleBulk = async () => {
    setBusyId('bulk');
    try {
      const created = await reorderLowStock(warehouseId);
      notify(created.length
        ? `${created.length} draft receipt${created.length > 1 ? 's' : ''} created: ${created.map((c) => c.reference).join(', ')}.`
        : 'Every low-stock product already has an open receipt.');
      refresh();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="dashboard-container">
      <PageHeader
        title="Low Stock Alerts & Reorders"
        description="SKUs at or below their reorder level. Reordering drafts a receipt you can review before it arrives."
        actions={
          <button className="btn btn-primary btn-sm" onClick={handleBulk} disabled={!lowStockProducts.length || busyId === 'bulk'}>
            {busyId === 'bulk' ? <Loader2 size={14} className="spin" /> : <Send size={14} />} Generate Bulk Purchase Orders
          </button>
        }
      />

      {/* Warning banner */}
      {s && (s.totalCount > 0 ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          padding: '16px 20px',
          borderRadius: 'var(--radius-lg)',
          backgroundColor: 'var(--amber-light)',
          border: '1px solid var(--amber-border)',
          color: 'var(--amber-deep)'
        }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--amber-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <AlertTriangle size={20} style={{ color: 'var(--amber)' }} />
          </div>
          <div style={{ flex: 1 }}>
            <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--amber-strong)' }}>
              Attention: {s.totalCount} SKU{s.totalCount === 1 ? ' has' : 's have'} dropped to or below the reorder threshold
              {s.outOfStockCount > 0 && ` (${s.outOfStockCount} out of stock)`}
            </h4>
            <p style={{ fontSize: '13px', marginTop: '2px', color: 'var(--amber-deep)' }}>
              {s.projectedStockouts72h > 0
                ? `${s.projectedStockouts72h} product${s.projectedStockouts72h === 1 ? ' is' : 's are'} projected to run out within 72 hours at the last 30 days’ shipping rate.`
                : 'None are projected to run out within 72 hours at the last 30 days’ shipping rate.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="form-alert success" style={{ padding: '14px 18px' }}>
          <CheckCircle2 size={18} />
          <div><strong>All good.</strong> Every product is above its reorder threshold.</div>
        </div>
      ))}

      <div className="content-card">
        <div className="card-header">
          <div className="card-title-group">
            <h2 className="card-title">Critical Stock List</h2>
            <span className="card-subtitle">
              Items with available inventory ≤ reorder point · recommended quantity refills to {settings?.reorderMultiplier || 3}× the minimum
            </span>
          </div>
        </div>

        {rows.loading && !rows.data ? (
          <div className="loading-block"><Loader2 size={16} className="spin" /> Checking stock levels…</div>
        ) : lowStockProducts.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="Nothing to reorder" description="Products appear here when their stock reaches the minimum set on the product." />
        ) : (
          <div className="table-responsive-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product & SKU</th>
                  <th>Category</th>
                  <th>Available Stock</th>
                  <th>Reorder Level</th>
                  <th>Recommended PO Quantity</th>
                  <th>Warehouse</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {lowStockProducts.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="table-product-cell">
                        <span className="table-product-name">{p.name}</span>
                        <span className="table-sku-pill" style={{ alignSelf: 'flex-start', marginTop: '2px' }}>
                          {p.sku}
                        </span>
                      </div>
                    </td>
                    <td>{p.category}</td>
                    <td className="nowrap">
                      <span style={{ color: 'var(--rose)', fontWeight: 700 }}>
                        {formatQty(p.stock)} {p.unit}
                      </span>
                      {p.daysOfCover !== null && (
                        <div className="muted" style={{ fontSize: 11.5 }}>≈ {p.daysOfCover} days of cover</div>
                      )}
                    </td>
                    <td className="nowrap">{formatQty(p.minStock)} {p.unit}</td>
                    <td className="nowrap">
                      <strong style={{ color: 'var(--primary)' }}>+{formatQty(p.recommendedQty)} {p.unit}</strong>
                    </td>
                    <td>{p.warehouse || '—'}</td>
                    <td><StatusBadge status={p.status} /></td>
                    <td>
                      <button className="btn btn-outline-primary btn-sm" onClick={() => handleReorder(p)} disabled={busyId === p.id}>
                        <RefreshCw size={13} className={busyId === p.id ? 'spin' : ''} /> Reorder
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
