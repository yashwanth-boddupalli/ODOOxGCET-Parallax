import React, { useState } from 'react';
import { StatusBadge, OperationBadge } from './StatusBadge';
import { EmptyState } from './EmptyState';
import { Search, ChevronLeft, ChevronRight, MoreHorizontal, Loader2, AlertCircle } from 'lucide-react';
import { useWorkspace } from '../../app/useWorkspace';
import { formatQty } from '../../lib/format';

const TYPE_TABS = ['All', 'Receipt', 'Delivery', 'Internal Transfer', 'Adjustment'];
const STATUS_TABS = ['All', 'Pending', 'In Progress', 'Completed', 'Cancelled'];

// Page numbers to show: first, last, and the neighbours of the current page.
function pageWindow(current, total) {
  const pages = new Set([1, total, current - 1, current, current + 1]);
  const list = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out = [];
  list.forEach((p, i) => {
    if (i > 0 && p - list[i - 1] > 1) out.push(`gap-${p}`);
    out.push(p);
  });
  return out;
}

export const DataTable = ({
  operations = [],
  title = 'Recent Inventory Operations',
  subtitle = 'Auditable live record of stock movement across warehouses',
  filterBy = 'operation', // 'operation' tabs by type; 'status' tabs by status
  loading = false,
  error = null,
  itemsPerPage = 10,
}) => {
  const { openOperation } = useWorkspace();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);

  const filterTabs = filterBy === 'status' ? STATUS_TABS : TYPE_TABS;
  const needle = searchTerm.toLowerCase();

  // Filtering
  const filteredData = operations.filter((item) => {
    const matchesTab = activeFilter === 'All' || item[filterBy] === activeFilter;
    const matchesSearch =
      item.product.toLowerCase().includes(needle) ||
      item.sku.toLowerCase().includes(needle) ||
      item.warehouse.toLowerCase().includes(needle) ||
      item.user.toLowerCase().includes(needle) ||
      item.reference.toLowerCase().includes(needle);
    return matchesTab && matchesSearch;
  });

  // Pagination
  const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;
  const page = Math.min(currentPage, totalPages);
  const paginatedData = filteredData.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  return (
    <div className="content-card operations-section">
      <div className="card-header">
        <div className="card-title-group">
          <h2 className="card-title">{title}</h2>
          <span className="card-subtitle">{subtitle}</span>
        </div>

        <div className="card-actions">
          <div className="search-box-compact">
            <Search size={15} className="text-muted" />
            <input
              type="text"
              placeholder="Search product, SKU, user..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>
      </div>

      <div style={{ padding: '14px 22px 0' }}>
        <div className="filter-toolbar">
          <div className="filter-pills-group" role="tablist">
            {filterTabs.map((tab) => (
              <button
                key={tab}
                role="tab"
                aria-selected={activeFilter === tab}
                className={`filter-pill ${activeFilter === tab ? 'active' : ''}`}
                onClick={() => {
                  setActiveFilter(tab);
                  setCurrentPage(1);
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          <span style={{ fontSize: '12.5px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            {loading && <Loader2 size={13} className="spin" />}
            Showing {filteredData.length} records
          </span>
        </div>
      </div>

      {error && (
        <div style={{ padding: '0 22px 14px' }}>
          <div className="form-alert error">
            <AlertCircle size={16} />
            <div>Couldn’t load operations: {error.message}</div>
          </div>
        </div>
      )}

      {loading && operations.length === 0 ? (
        <div className="loading-block">
          <Loader2 size={16} className="spin" /> Loading operations…
        </div>
      ) : paginatedData.length > 0 ? (
        <div className="table-responsive-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Operation & Ref</th>
                <th>Product & SKU</th>
                <th>Warehouse</th>
                <th>Quantity</th>
                <th>Status</th>
                <th>Date / Time</th>
                <th>Responsible</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <OperationBadge operation={item.operation} />
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {item.reference}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="table-product-cell">
                      <span className="table-product-name">{item.product}</span>
                      <span className="table-sku-pill" style={{ alignSelf: 'flex-start', marginTop: '2px' }}>
                        {item.sku}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                      {item.warehouse}
                    </span>
                  </td>
                  <td>
                    <span style={{
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      color: item.quantity < 0 ? 'var(--rose)' : 'var(--text-primary)'
                    }}>
                      {item.quantity > 0 ? `+${formatQty(item.quantity)}` : formatQty(item.quantity)} {item.unit}
                    </span>
                  </td>
                  <td>
                    <StatusBadge status={item.status} />
                  </td>
                  <td>
                    <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {item.date}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
                      {item.user || '—'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      title={item.documentId ? 'View Details' : 'Opening balance — no document'}
                      aria-label={`View details of ${item.reference}`}
                      disabled={!item.documentId}
                      onClick={() => openOperation(item.documentId)}
                    >
                      <MoreHorizontal size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title={operations.length ? 'No operations found' : 'Nothing here yet'}
          description={
            operations.length
              ? `No activity matched the search term "${searchTerm}" and filter "${activeFilter}".`
              : 'Operations will appear here as soon as they are created.'
          }
          actionText={operations.length ? 'Clear Filters' : undefined}
          onAction={() => {
            setSearchTerm('');
            setActiveFilter('All');
          }}
        />
      )}

      {totalPages > 1 && (
        <div className="table-footer">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="pagination-controls">
            <button
              className="pagination-btn"
              disabled={page === 1}
              onClick={() => setCurrentPage(Math.max(1, page - 1))}
            >
              <ChevronLeft size={14} /> Previous
            </button>

            {pageWindow(page, totalPages).map((p) =>
              typeof p === 'string' ? (
                <span key={p} style={{ padding: '0 4px', color: 'var(--text-muted)' }}>…</span>
              ) : (
                <button
                  key={p}
                  className={`pagination-btn ${page === p ? 'active' : ''}`}
                  onClick={() => setCurrentPage(p)}
                >
                  {p}
                </button>
              ),
            )}

            <button
              className="pagination-btn"
              disabled={page === totalPages}
              onClick={() => setCurrentPage(Math.min(totalPages, page + 1))}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
