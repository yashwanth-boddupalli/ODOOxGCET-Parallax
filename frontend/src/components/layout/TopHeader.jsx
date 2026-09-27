import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Bell,
  Boxes,
  Check,
  ChevronDown,
  ClipboardList,
  HelpCircle,
  Loader2,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
  Warehouse,
} from 'lucide-react';
import { useWorkspace } from '../../app/useWorkspace';
import { useAuth } from '../../auth/useAuth';
import { useTheme } from '../../theme/theme';
import { listLowStock, searchEverything } from '../../api';
import { formatQty, initialsOf } from '../../lib/format';

// Close a dropdown when clicking anywhere else.
function useClickAway(onAway) {
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => ref.current && !ref.current.contains(e.target) && onAway();
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onAway]);
  return ref;
}

const GlobalSearch = () => {
  const navigate = useNavigate();
  const { openOperation } = useWorkspace();
  const inputRef = useRef(null);
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const ref = useClickAway(() => setOpen(false));

  // Ctrl/Cmd + K focuses the search, as the hint promises.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Debounced search.
  useEffect(() => {
    if (term.trim().length < 2) return undefined;
    let alive = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchEverything(term);
        if (alive) setResults(data);
      } catch {
        if (alive) setResults({ products: [], operations: [], warehouses: [] });
      } finally {
        if (alive) setLoading(false);
      }
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [term]);

  const go = (fn) => {
    fn();
    setOpen(false);
    setTerm('');
    setResults(null);
  };

  const showResults = open && term.trim().length >= 2;
  const empty = results && !results.products.length && !results.operations.length && !results.warehouses.length;

  return (
    <div className="dropdown-anchor" ref={ref}>
      <div className="global-search-bar">
        <Search size={16} className="text-muted" />
        <input
          ref={inputRef}
          type="text"
          className="search-input"
          placeholder="Search inventory, SKUs, warehouses, orders..."
          aria-label="Search StockSense"
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
        />
        {loading ? <Loader2 size={14} className="spin text-muted" /> : <kbd className="search-shortcut">Ctrl K</kbd>}
      </div>

      {showResults && (
        <div className="dropdown-menu align-left search-results">
          {!results && <div className="dropdown-empty">Searching…</div>}
          {empty && <div className="dropdown-empty">No matches for “{term.trim()}”.</div>}
          {results?.products.length > 0 && <div className="dropdown-heading">Products</div>}
          {results?.products.map((p) => (
            <button key={`p${p.id}`} className="dropdown-item" onClick={() => go(() => navigate(`/products?q=${encodeURIComponent(p.sku)}`))}>
              <Boxes size={15} className="text-muted" />
              <span className="item-main">
                <span className="item-title">{p.name}</span>
                <span className="item-sub">{p.sku} · {formatQty(p.stock)} {p.unit} · {p.status}</span>
              </span>
            </button>
          ))}
          {results?.operations.length > 0 && <div className="dropdown-heading">Documents</div>}
          {results?.operations.map((o) => (
            <button key={`o${o.id}`} className="dropdown-item" onClick={() => go(() => openOperation(o.id))}>
              <ClipboardList size={15} className="text-muted" />
              <span className="item-main">
                <span className="item-title">{o.reference}</span>
                <span className="item-sub">{o.operation} · {o.status}{o.partner_name ? ` · ${o.partner_name}` : ''}</span>
              </span>
            </button>
          ))}
          {results?.warehouses.length > 0 && <div className="dropdown-heading">Warehouses</div>}
          {results?.warehouses.map((w) => (
            <button key={`w${w.id}`} className="dropdown-item" onClick={() => go(() => navigate('/warehouses'))}>
              <Warehouse size={15} className="text-muted" />
              <span className="item-main">
                <span className="item-title">{w.name}</span>
                <span className="item-sub">{w.code} · {w.location}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const WarehouseSelector = () => {
  const { warehouses, activeWarehouse, setWarehouseId } = useWorkspace();
  const [open, setOpen] = useState(false);
  const ref = useClickAway(() => setOpen(false));

  const choose = (id) => {
    setWarehouseId(id);
    setOpen(false);
  };

  return (
    <div className="dropdown-anchor" ref={ref}>
      <button className="warehouse-selector" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="true">
        <span className="status-indicator-dot" />
        <Warehouse size={15} />
        <span>{activeWarehouse?.name || 'All Warehouses'}</span>
        <ChevronDown size={14} />
      </button>

      {open && (
        <div className="dropdown-menu" style={{ width: 260 }}>
          <div className="dropdown-heading">Select Active Facility</div>
          <button className={`dropdown-item ${!activeWarehouse ? 'active' : ''}`} onClick={() => choose('')}>
            <span className="item-main">
              <span className="item-title">All Warehouses</span>
              <span className="item-sub">Combined view of every facility</span>
            </span>
          </button>
          {warehouses.map((wh) => (
            <button key={wh.id} className={`dropdown-item ${activeWarehouse?.id === wh.id ? 'active' : ''}`} onClick={() => choose(wh.id)}>
              <span className="item-main">
                <span className="item-title">{wh.name}</span>
                <span className="item-sub">{wh.location}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const AlertsBell = () => {
  const navigate = useNavigate();
  const { summary, warehouseId } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(null);
  const ref = useClickAway(() => setOpen(false));
  const count = summary?.alertsCount || 0;

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next) {
      setItems(null);
      try {
        setItems(await listLowStock(warehouseId));
      } catch {
        setItems([]);
      }
    }
  };

  return (
    <div className="dropdown-anchor" ref={ref}>
      <button className="header-action-btn" onClick={toggle}
        aria-label={`View notifications (${count} new)`} title="Alerts and notifications">
        <Bell size={18} />
        {count > 0 && <span className="notification-count-badge">{count > 99 ? '99+' : count}</span>}
      </button>
      {open && (
        <div className="dropdown-menu">
          <div className="dropdown-heading">Stock alerts</div>
          {!items && <div className="dropdown-empty">Loading…</div>}
          {items?.length === 0 && <div className="dropdown-empty">All products are above their reorder level.</div>}
          {items?.slice(0, 6).map((p) => (
            <button key={p.id} className="dropdown-item" onClick={() => { setOpen(false); navigate('/low-stock'); }}>
              <AlertTriangle size={15} color={p.status === 'Out of Stock' ? '#e11d48' : '#d97706'} />
              <span className="item-main">
                <span className="item-title">{p.name}</span>
                <span className="item-sub">{p.status}: {formatQty(p.stock)} of min {formatQty(p.minStock)} {p.unit} · {p.warehouse || 'No warehouse'}</span>
              </span>
            </button>
          ))}
          {items?.length > 0 && (
            <button className="dropdown-item" style={{ justifyContent: 'center', color: 'var(--primary)', fontWeight: 600 }}
              onClick={() => { setOpen(false); navigate('/low-stock'); }}>
              View all alerts
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const THEME_OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', sub: 'Match your device setting', icon: Monitor },
];

const ThemeMenu = () => {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useClickAway(() => setOpen(false));
  const current = THEME_OPTIONS.find((o) => o.value === theme);
  const CurrentIcon = current.icon;

  const choose = (value) => {
    setTheme(value);
    setOpen(false);
  };

  return (
    <div className="dropdown-anchor" ref={ref}>
      <button className="header-action-btn" onClick={() => setOpen(!open)}
        aria-label={`Change theme (current: ${current.label})`} title="Change theme" aria-expanded={open} aria-haspopup="true">
        <CurrentIcon size={18} />
      </button>
      {open && (
        <div className="dropdown-menu" style={{ width: 220 }}>
          <div className="dropdown-heading">Theme</div>
          {THEME_OPTIONS.map(({ value, label, sub, icon: Icon }) => (
            <button key={value} className={`dropdown-item ${theme === value ? 'active' : ''}`} onClick={() => choose(value)}>
              <Icon size={15} className={theme === value ? undefined : 'text-muted'} />
              <span className="item-main">
                <span className="item-title">{label}</span>
                {sub && <span className="item-sub">{sub}</span>}
              </span>
              {theme === value && <Check size={15} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const UserMenu = () => {
  const navigate = useNavigate();
  const { profile, user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useClickAway(() => setOpen(false));
  const name = profile?.fullName || user?.email || '';

  const handleSignOut = async () => {
    setOpen(false);
    await signOut();
    navigate('/login', { replace: true, state: { notice: 'You have been signed out.' } });
  };

  return (
    <div className="dropdown-anchor" ref={ref}>
      <button className="header-user-btn" aria-label="User profile settings" onClick={() => setOpen(!open)}>
        <div className="header-avatar">{initialsOf(name)}</div>
        <span className="header-user-name">{name}</span>
        <ChevronDown size={14} className="text-muted" />
      </button>
      {open && (
        <div className="dropdown-menu" style={{ width: 260 }}>
          <div className="user-menu-head">
            <div className="header-avatar">{initialsOf(name)}</div>
            <div className="item-main" style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <strong style={{ fontSize: 13.5 }}>{name}</strong>
              <span className="muted" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</span>
              {profile && (
                <span style={{ marginTop: 4 }}>
                  <span className={`role-pill ${profile.role === 'STAFF' ? 'staff' : ''}`}>
                    {profile.role === 'MANAGER' ? 'Manager' : 'Staff'}
                  </span>
                </span>
              )}
            </div>
          </div>
          <button className="dropdown-item" onClick={() => { setOpen(false); navigate('/settings?tab=profile'); }}>
            <Settings size={15} className="text-muted" /> Profile &amp; settings
          </button>
          <button className="dropdown-item danger" onClick={handleSignOut}>
            <LogOut size={15} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
};

export const TopHeader = ({ onOpenMobileMenu }) => {
  const { openAddProduct } = useWorkspace();
  return (
    <header className="top-header">
      <div className="header-left">
        <button className="mobile-menu-trigger" onClick={onOpenMobileMenu} aria-label="Open navigation menu">
          <Menu size={20} />
        </button>
        <GlobalSearch />
      </div>

      <div className="header-right">
        <WarehouseSelector />

        <button className="btn btn-primary btn-sm" onClick={openAddProduct} title="Add New Stock Product">
          <Plus size={16} />
          <span>Add Product</span>
        </button>

        <AlertsBell />

        <a
          className="header-action-btn"
          aria-label="Documentation and help"
          title="Help & Documentation"
          href="https://github.com/yashwanth-boddupalli/ODOOxGCET-Parallax#readme"
          target="_blank"
          rel="noreferrer"
        >
          <HelpCircle size={18} />
        </a>

        <div className="header-divider" />

        <ThemeMenu />
        <UserMenu />
      </div>
    </header>
  );
};
