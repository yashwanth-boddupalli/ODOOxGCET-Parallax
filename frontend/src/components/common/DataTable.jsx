import React, { useState } from 'react';
import { StatusBadge, OperationBadge } from './StatusBadge';
import { EmptyState } from './EmptyState';
import { Search, ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';

export const DataTable = ({
  operations = [],
  title = 'Recent Inventory Operations',
  subtitle = 'Auditable live record of stock movement across warehouses'
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const filterTabs = ['All', 'Receipt', 'Delivery', 'Internal Transfer', 'Adjustment'];

  // Filtering
  const filteredData = operations.filter((item) => {
    const matchesTab = activeFilter === 'All' || item.operation === activeFilter;
    const matchesSearch =
      item.product.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.warehouse.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.reference.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesTab && matchesSearch;
  });

  // Pagination
  const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;
  const paginatedData = filteredData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

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

          <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
            Showing {filteredData.length} records
          </span>
        </div>
      </div>

      {paginatedData.length > 0 ? (
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
                      color: item.quantity < 0 ? 'var(--rose)' : 'var(--text-primary)' 
                    }}>
                      {item.quantity > 0 ? `+${item.quantity}` : item.quantity} {item.unit}
                    </span>
                  </td>
                  <td>
                    <StatusBadge status={item.status} />
                  </td>
                  <td>
                    <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                      {item.date}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
                      {item.user}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn btn-secondary btn-sm" title="View Details">
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
          title="No operations found"
          description={`No activity matched the search term "${searchTerm}" and filter "${activeFilter}".`}
          actionText="Clear Filters"
          onAction={() => {
            setSearchTerm('');
            setActiveFilter('All');
          }}
        />
      )}

      {totalPages > 1 && (
        <div className="table-footer">
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <div className="pagination-controls">
            <button
              className="pagination-btn"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft size={14} /> Previous
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                className={`pagination-btn ${currentPage === page ? 'active' : ''}`}
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </button>
            ))}

            <button
              className="pagination-btn"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
