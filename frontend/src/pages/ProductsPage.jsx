import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../components/common/PageHeader';
import { StatusBadge } from '../components/common/StatusBadge';
import { EmptyState } from '../components/common/EmptyState';
import { ProductFormModal } from '../components/forms/ProductFormModal';
import { useAsync, useWorkspace } from '../app/useWorkspace';
import { listCategories, listProducts } from '../api';
import { downloadCsv } from '../lib/csv';
import { formatMoney, formatQty } from '../lib/format';
import { Plus, Search, Download, Loader2, Pencil } from 'lucide-react';

const csvColumns = [
  { key: 'name', label: 'Product' },
  { key: 'sku', label: 'SKU' },
  { key: 'category', label: 'Category' },
  { key: 'stock', label: 'Current Stock' },
  { key: 'unit', label: 'Unit' },
  { key: 'minStock', label: 'Min Reorder Threshold' },
  { key: 'price', label: 'Unit Price' },
  { key: 'warehouse', label: 'Primary Warehouse' },
  { key: 'status', label: 'Status' },
];

export const ProductsPage = () => {
  const { warehouseId, activeWarehouse, version, openAddProduct, isManager } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const search = params.get('q') || '';
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [editing, setEditing] = useState(null);

  const products = useAsync(() => listProducts({ warehouseId }), [warehouseId, version]);
  const categoryList = useAsync(listCategories, [version]);
  const categories = ['All', ...(categoryList.data || []).map((c) => c.name)];

  const setSearch = (value) => setParams(value ? { q: value } : {}, { replace: true });

  const needle = search.toLowerCase();
  const filtered = (products.data || []).filter((p) => {
    const matchCat = selectedCategory === 'All' || p.category === selectedCategory;
    const matchSearch = p.name.toLowerCase().includes(needle) || p.sku.toLowerCase().includes(needle);
    return matchCat && matchSearch;
  });

  return (
    <div className="dashboard-container">
      <PageHeader
        title="Products Catalog"
        description={`Central master catalog of all SKU records, unit values, and stock${activeWarehouse ? ` held at ${activeWarehouse.name}` : ' across all warehouses'}.`}
        actions={
          <>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => downloadCsv('stocksense-products', filtered, csvColumns)}
              disabled={!filtered.length}
            >
              <Download size={14} /> Export CSV
            </button>
            <button className="btn btn-primary btn-sm" onClick={openAddProduct}>
              <Plus size={15} /> Add Product
            </button>
          </>
        }
      />

      <div className="content-card">
        <div className="card-header">
          <div className="search-box-compact" style={{ width: '320px', maxWidth: '100%' }}>
            <Search size={15} className="text-muted" />
            <input
              type="text"
              placeholder="Search product name or SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="filter-pills-group" style={{ flexWrap: 'wrap' }}>
            {categories.map((cat) => (
              <button
                key={cat}
                className={`filter-pill ${selectedCategory === cat ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {products.error && (
          <div style={{ padding: '14px 22px 0' }}>
            <div className="form-alert error">Couldn’t load products: {products.error.message}</div>
          </div>
        )}

        {products.loading && !products.data ? (
          <div className="loading-block"><Loader2 size={16} className="spin" /> Loading products…</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={products.data?.length ? 'No products match' : 'No products yet'}
            description={products.data?.length ? 'Try a different search or category.' : 'Add your first product to start tracking stock.'}
            actionText={products.data?.length ? 'Clear Filters' : 'Add Product'}
            onAction={products.data?.length ? () => { setSearch(''); setSelectedCategory('All'); } : openAddProduct}
          />
        ) : (
          <div className="table-responsive-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th>SKU</th>
                  <th>Category</th>
                  <th>Current Stock</th>
                  <th>Min Reorder Threshold</th>
                  <th>Unit Price</th>
                  <th>Primary Warehouse</th>
                  <th>Status</th>
                  {isManager && <th style={{ textAlign: 'right' }}>Action</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <span className="table-product-name">{item.name}</span>
                    </td>
                    <td>
                      <span className="table-sku-pill">{item.sku}</span>
                    </td>
                    <td>{item.category}</td>
                    <td className="nowrap">
                      <strong>{formatQty(item.stock)} {item.unit}</strong>
                    </td>
                    <td className="nowrap" style={{ color: 'var(--text-muted)' }}>{formatQty(item.minStock)} {item.unit}</td>
                    <td>{formatMoney(item.price)}</td>
                    <td>{item.warehouse || '—'}</td>
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                    {isManager && (
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn btn-secondary btn-sm" title="Edit product" aria-label={`Edit ${item.name}`}
                          onClick={() => setEditing(item)}>
                          <Pencil size={13} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && <ProductFormModal product={editing} onClose={() => setEditing(null)} />}
    </div>
  );
};
