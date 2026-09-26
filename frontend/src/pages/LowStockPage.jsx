import React from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { mockProducts } from '../data/mockProducts';
import { AlertTriangle, RefreshCw, Send } from 'lucide-react';

export const LowStockPage = () => {
  const lowStockProducts = mockProducts.filter((p) => p.status === 'Low Stock' || p.stock < 35);

  return (
    <div className="dashboard-container">
      <PageHeader
        title="Low Stock Alerts & Reorders"
        description="SKUs requiring immediate replenishment to avoid stockouts and maintain SLA safety thresholds."
        actions={
          <button className="btn btn-primary btn-sm">
            <Send size={14} /> Generate Bulk Purchase Orders
          </button>
        }
      />

      {/* Warning banner */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        padding: '16px 20px',
        borderRadius: 'var(--radius-lg)',
        backgroundColor: '#fffbeb',
        border: '1px solid #fde68a',
        color: '#92400e'
      }}>
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: 'var(--radius-full)',
          backgroundColor: '#fef3c7',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <AlertTriangle size={20} color="#d97706" />
        </div>
        <div style={{ flex: 1 }}>
          <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#b45309' }}>
            Attention: 17 SKUs have dropped below safety buffer thresholds
          </h4>
          <p style={{ fontSize: '13px', marginTop: '2px', color: '#92400e' }}>
            5 products are projected to encounter zero availability within 72 hours based on recent 30-day velocity.
          </p>
        </div>
      </div>

      <div className="content-card">
        <div className="card-header">
          <div className="card-title-group">
            <h2 className="card-title">Critical Stock List</h2>
            <span className="card-subtitle">Items filtered by available inventory ≤ safety reorder point</span>
          </div>
        </div>

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
                  <td>
                    <span style={{ color: 'var(--rose)', fontWeight: 700 }}>
                      {p.stock} units
                    </span>
                  </td>
                  <td>{p.minStock} units</td>
                  <td>
                    <strong style={{ color: '#2563eb' }}>+{p.minStock * 3} units</strong>
                  </td>
                  <td>{p.warehouse}</td>
                  <td>
                    <button className="btn btn-outline-primary btn-sm">
                      <RefreshCw size={13} /> Reorder
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
