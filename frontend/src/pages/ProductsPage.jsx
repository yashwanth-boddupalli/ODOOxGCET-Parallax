import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { PageHeader } from '../components/common/PageHeader';
import { StatusBadge } from '../components/common/StatusBadge';
import { mockProducts } from '../data/mockProducts';
import { Plus, Search, Download } from 'lucide-react';

export const ProductsPage = () => {
  const { onOpenAddProduct } = useOutletContext() || {};
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const categories = ['All', 'Electronics', 'Accessories', 'Industrial', 'Apparel'];

  const filtered = mockProducts.filter((p) => {
    const matchCat = selectedCategory === 'All' || p.category === selectedCategory;
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="dashboard-container">
      <PageHeader
        title="Products Catalog"
        description="Central master catalog of all SKU records, unit values, and warehouse allocations."
        actions={
          <>
            <button className="btn btn-secondary btn-sm">
              <Download size={14} /> Export CSV
            </button>
            <button className="btn btn-primary btn-sm" onClick={onOpenAddProduct}>
              <Plus size={15} /> Add Product
            </button>
          </>
        }
      />

      <div className="content-card">
        <div className="card-header">
          <div className="search-box-compact" style={{ width: '320px' }}>
            <Search size={15} className="text-muted" />
            <input 
              type="text" 
              placeholder="Search product name or SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="filter-pills-group">
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
                  <td>
                    <strong>{item.stock} units</strong>
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>{item.minStock} units</td>
                  <td>${item.price.toFixed(2)}</td>
                  <td>{item.warehouse}</td>
                  <td>
                    <StatusBadge status={item.status} />
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
