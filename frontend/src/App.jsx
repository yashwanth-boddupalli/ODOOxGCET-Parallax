import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { ProductsPage } from './pages/ProductsPage';
import { ReceiptsPage } from './pages/ReceiptsPage';
import { DeliveryOrdersPage } from './pages/DeliveryOrdersPage';
import { InternalTransfersPage } from './pages/InternalTransfersPage';
import { InventoryAdjustmentsPage } from './pages/InventoryAdjustmentsPage';
import { StockLedgerPage } from './pages/StockLedgerPage';
import { WarehousesPage } from './pages/WarehousesPage';
import { LowStockPage } from './pages/LowStockPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { SettingsPage } from './pages/SettingsPage';

// Import design system styles
import './styles/index.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/dashboard.css';
import './styles/charts.css';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          {/* Default redirect to /dashboard */}
          <Route index element={<Navigate to="/dashboard" replace />} />
          
          {/* Main Modules */}
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="receipts" element={<ReceiptsPage />} />
          <Route path="delivery-orders" element={<DeliveryOrdersPage />} />
          <Route path="internal-transfers" element={<InternalTransfersPage />} />
          <Route path="inventory-adjustments" element={<InventoryAdjustmentsPage />} />
          <Route path="stock-ledger" element={<StockLedgerPage />} />
          <Route path="warehouses" element={<WarehousesPage />} />
          <Route path="low-stock" element={<LowStockPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="settings" element={<SettingsPage />} />

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
