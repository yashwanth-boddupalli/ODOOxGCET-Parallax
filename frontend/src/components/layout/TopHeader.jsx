import React, { useState } from 'react';
import { 
  Menu, 
  Search, 
  Bell, 
  Warehouse, 
  ChevronDown, 
  Plus, 
  HelpCircle 
} from 'lucide-react';
import { mockWarehouses } from '../../data/mockProducts';

export const TopHeader = ({ onOpenMobileMenu, onAddProductClick }) => {
  const [selectedWarehouse, setSelectedWarehouse] = useState(mockWarehouses[0].name);
  const [showWarehouseMenu, setShowWarehouseMenu] = useState(false);

  return (
    <header className="top-header">
      <div className="header-left">
        <button 
          className="mobile-menu-trigger" 
          onClick={onOpenMobileMenu}
          aria-label="Open navigation menu"
        >
          <Menu size={20} />
        </button>

        <div className="global-search-bar">
          <Search size={16} className="text-muted" />
          <input 
            type="text" 
            className="search-input" 
            placeholder="Search inventory, SKUs, warehouses, orders..."
            aria-label="Search StockSense"
          />
          <kbd className="search-shortcut">Ctrl K</kbd>
        </div>
      </div>

      <div className="header-right">
        {/* Active Warehouse Selector */}
        <div style={{ position: 'relative' }}>
          <button 
            className="warehouse-selector"
            onClick={() => setShowWarehouseMenu(!showWarehouseMenu)}
            aria-expanded={showWarehouseMenu}
            aria-haspopup="true"
          >
            <span className="status-indicator-dot" />
            <Warehouse size={15} />
            <span>{selectedWarehouse}</span>
            <ChevronDown size={14} />
          </button>

          {showWarehouseMenu && (
            <div style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '6px',
              backgroundColor: '#ffffff',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-dropdown)',
              width: '260px',
              zIndex: 60,
              overflow: 'hidden'
            }}>
              <div style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', background: '#f8fafc', borderBottom: '1px solid var(--border-subtle)' }}>
                Select Active Facility
              </div>
              {mockWarehouses.map((wh) => (
                <button
                  key={wh.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    width: '100%',
                    padding: '8px 12px',
                    textAlign: 'left',
                    fontSize: '13px',
                    borderBottom: '1px solid #f1f5f9',
                    backgroundColor: selectedWarehouse === wh.name ? '#eff6ff' : '#ffffff',
                    color: selectedWarehouse === wh.name ? 'var(--primary)' : 'var(--text-primary)'
                  }}
                  onClick={() => {
                    setSelectedWarehouse(wh.name);
                    setShowWarehouseMenu(false);
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{wh.name}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{wh.location}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Quick Add Action */}
        <button 
          className="btn btn-primary btn-sm"
          onClick={onAddProductClick}
          title="Add New Stock Product"
        >
          <Plus size={16} />
          <span>Add Product</span>
        </button>

        {/* Notification Bell */}
        <button 
          className="header-action-btn"
          aria-label="View notifications (4 new)"
          title="Alerts and notifications"
        >
          <Bell size={18} />
          <span className="notification-count-badge">4</span>
        </button>

        <button 
          className="header-action-btn"
          aria-label="Documentation and help"
          title="Help & Documentation"
        >
          <HelpCircle size={18} />
        </button>

        <div className="header-divider" />

        {/* User Pill */}
        <button className="header-user-btn" aria-label="User profile settings">
          <div className="header-avatar">YB</div>
          <span className="header-user-name">Yashwanth B</span>
        </button>
      </div>
    </header>
  );
};
