import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import { PublicOnly, RequireAuth } from './auth/guards';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/auth/LoginPage';
import { SignupPage } from './pages/auth/SignupPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
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
import './styles/forms.css';
import './styles/auth.css';
import './styles/app.css';
import './styles/assistant.css';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Signed-out pages */}
          <Route element={<PublicOnly />}>
            <Route path="login" element={<LoginPage />} />
            <Route path="signup" element={<SignupPage />} />
          </Route>
          {/* Password reset signs the user in part-way, so it can't bounce signed-in users */}
          <Route path="forgot-password" element={<ForgotPasswordPage />} />
          <Route path="reset-password" element={<ResetPasswordPage />} />

          {/* The app itself: signed-in users only */}
          <Route element={<RequireAuth />}>
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
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
