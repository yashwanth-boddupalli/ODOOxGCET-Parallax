import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, DatabaseZap } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { TopHeader } from './TopHeader';
import { ProductFormModal } from '../forms/ProductFormModal';
import { OperationFormModal } from '../forms/OperationFormModal';
import { OperationDrawer } from '../forms/OperationDrawer';
import { WarehouseFormModal } from '../forms/WarehouseFormModal';
import { WorkspaceContext, useAsync } from '../../app/useWorkspace';
import { useAuth } from '../../auth/useAuth';
import { getDashboardSummary, getSettings, listWarehouses } from '../../api';

const WAREHOUSE_KEY = 'stocksense.activeWarehouse';

const readStoredWarehouse = () => {
  try {
    return localStorage.getItem(WAREHOUSE_KEY) || '';
  } catch {
    return '';
  }
};

// The database hasn't been created in this Supabase project yet.
const isMissingSchema = (error) =>
  Boolean(error) && /schema cache|does not exist|PGRST20[25]|42P01/i.test(`${error.code} ${error.message}`);

export const AppLayout = () => {
  const { profile, isManager } = useAuth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Bumping `version` tells every page to reload its data after a change.
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  const [warehouseId, setWarehouseIdState] = useState(readStoredWarehouse);
  const setWarehouseId = useCallback((id) => {
    const next = id ? String(id) : '';
    setWarehouseIdState(next);
    try {
      localStorage.setItem(WAREHOUSE_KEY, next);
    } catch {
      // Storage can be blocked (private mode); the choice then lasts for this visit only.
    }
  }, []);

  const warehouses = useAsync(listWarehouses, [version]);
  const settings = useAsync(getSettings, [version]);
  const summary = useAsync(() => getDashboardSummary(warehouseId), [version, warehouseId]);

  const [toast, setToast] = useState(null);
  const notify = useCallback((message, kind = 'success') => setToast({ message, kind, at: Date.now() }), []);
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  // One modal at a time; the document drawer can sit on top of a page.
  const [modal, setModal] = useState(null);
  const [documentId, setDocumentId] = useState(null);
  const closeModal = useCallback(() => setModal(null), []);

  const warehouseList = useMemo(() => warehouses.data || [], [warehouses.data]);
  // Forget a stored warehouse that no longer exists.
  const activeWarehouseId = warehouseList.some((w) => String(w.id) === warehouseId) ? warehouseId : '';

  const value = useMemo(() => ({
    warehouses: warehouseList,
    warehouseId: activeWarehouseId,
    activeWarehouse: warehouseList.find((w) => String(w.id) === activeWarehouseId) || null,
    setWarehouseId,
    settings: settings.data || null,
    summary: summary.data || null,
    profile,
    isManager,
    version,
    refresh,
    notify,
    openAddProduct: () => setModal({ kind: 'product' }),
    openCreateOperation: (type) => setModal({ kind: 'operation', type }),
    openAddWarehouse: () => setModal({ kind: 'warehouse', mode: 'warehouse' }),
    openAddLocation: (warehouse) => setModal({ kind: 'warehouse', mode: 'location', warehouse }),
    openOperation: (id) => setDocumentId(id),
  }), [warehouseList, activeWarehouseId, setWarehouseId, settings.data, summary.data, profile, isManager, version, refresh, notify]);

  const setupNeeded = isMissingSchema(warehouses.error) || isMissingSchema(settings.error);

  return (
    <WorkspaceContext.Provider value={value}>
      <div className="app-shell">
        <div
          className={`mobile-overlay ${isMobileMenuOpen ? 'active' : ''}`}
          onClick={() => setIsMobileMenuOpen(false)}
        />

        <Sidebar
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          isMobileOpen={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
        />

        <div className={`app-main ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
          <TopHeader onOpenMobileMenu={() => setIsMobileMenuOpen(true)} />

          <main className="page-viewport">
            {setupNeeded && (
              <div className="setup-banner" role="alert">
                <DatabaseZap size={22} />
                <div>
                  <h4>The StockSense database isn’t set up in this Supabase project yet</h4>
                  <p>
                    Open the Supabase dashboard → SQL Editor, paste <code>supabase/setup.sql</code> from the repo and run
                    it once. Then refresh this page.
                  </p>
                </div>
              </div>
            )}
            {!setupNeeded && profile && !profile.active && (
              <div className="setup-banner" role="alert">
                <AlertTriangle size={22} />
                <div>
                  <h4>Your account is deactivated</h4>
                  <p>Ask an inventory manager to re-activate it in Settings → Team &amp; Access.</p>
                </div>
              </div>
            )}
            <Outlet context={{ onOpenAddProduct: value.openAddProduct }} />
          </main>
        </div>

        {modal?.kind === 'product' && <ProductFormModal onClose={closeModal} />}
        {modal?.kind === 'operation' && <OperationFormModal type={modal.type} onClose={closeModal} />}
        {modal?.kind === 'warehouse' && (
          <WarehouseFormModal mode={modal.mode} warehouse={modal.warehouse} onClose={closeModal} />
        )}
        {documentId && <OperationDrawer documentId={documentId} onClose={() => setDocumentId(null)} />}

        {toast && (
          <div className="toast" role="status" key={toast.at}>
            {toast.kind === 'error' ? (
              <AlertTriangle size={18} color="#fb7185" />
            ) : (
              <CheckCircle2 size={18} color="#10b981" />
            )}
            <span>{toast.message}</span>
          </div>
        )}
      </div>
    </WorkspaceContext.Provider>
  );
};
