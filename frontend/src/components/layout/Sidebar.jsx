import React from 'react';
import { NavLink } from 'react-router-dom';
import { useWorkspace } from '../../app/useWorkspace';
import { formatCompact, initialsOf } from '../../lib/format';
import {
  LayoutDashboard,
  Package,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  SlidersHorizontal,
  FileSpreadsheet,
  Warehouse,
  AlertTriangle,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Boxes
} from 'lucide-react';

export const Sidebar = ({ isCollapsed, onToggleCollapse, isMobileOpen, onCloseMobile }) => {
  const { summary, profile } = useWorkspace();
  // Badges hide themselves when the count is zero or not loaded yet.
  const badge = (n) => (n ? formatCompact(n) : undefined);

  const navSections = [
    {
      title: 'Main',
      items: [
        { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }
      ]
    },
    {
      title: 'Inventory',
      items: [
        { path: '/products', label: 'Products', icon: Package, badge: badge(summary?.productsCount) },
        { path: '/receipts', label: 'Receipts', icon: ArrowDownLeft, badge: badge(summary?.pendingReceipts) },
        { path: '/delivery-orders', label: 'Delivery Orders', icon: ArrowUpRight, badge: badge(summary?.pendingDeliveries) },
        { path: '/internal-transfers', label: 'Internal Transfers', icon: ArrowLeftRight },
        { path: '/inventory-adjustments', label: 'Adjustments', icon: SlidersHorizontal },
        { path: '/stock-ledger', label: 'Stock Ledger', icon: FileSpreadsheet },
        { path: '/warehouses', label: 'Warehouses', icon: Warehouse }
      ]
    },
    {
      title: 'Insights',
      items: [
        { path: '/low-stock', label: 'Low Stock', icon: AlertTriangle, badge: badge(summary?.lowStockCount), alertBadge: true },
        { path: '/analytics', label: 'Analytics', icon: BarChart3 }
      ]
    },
    {
      title: 'System',
      items: [
        { path: '/settings', label: 'Settings', icon: Settings }
      ]
    }
  ];

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}>
      <div className="sidebar-header">
        <NavLink to="/dashboard" className="brand-wrapper" onClick={onCloseMobile}>
          <div className="brand-icon">
            <Boxes size={22} strokeWidth={2.3} />
          </div>
          {!isCollapsed && (
            <div className="brand-text">
              <span className="brand-name">StockSense</span>
              <span className="brand-badge">Inventory Hub</span>
            </div>
          )}
        </NavLink>

        <button 
          className="sidebar-toggle-btn"
          onClick={onToggleCollapse}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <nav className="sidebar-nav">
        {navSections.map((section) => (
          <div key={section.title} className="nav-section">
            <span className="section-title">{section.title}</span>
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={onCloseMobile}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon className="nav-item-icon" size={18} />
                  <span className="nav-item-label">{item.label}</span>
                  {item.badge && (
                    <span 
                      className="nav-item-badge" 
                      style={item.alertBadge ? { background: '#f59e0b', color: '#000000' } : undefined}
                    >
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-profile-summary">
          <div className="user-avatar" title={profile ? `${profile.fullName} - ${profile.jobTitle}` : ''}>
            {initialsOf(profile?.fullName)}
          </div>
          <div className="user-meta">
            <span className="user-name">{profile?.fullName || 'Signed in'}</span>
            <span className="user-role">{profile?.jobTitle || (profile?.role === 'MANAGER' ? 'Inventory Manager' : 'Warehouse Staff')}</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
