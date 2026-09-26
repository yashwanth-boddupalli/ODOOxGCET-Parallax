import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopHeader } from './TopHeader';
import { X, CheckCircle2, Box } from 'lucide-react';

export const AppLayout = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Quick product form mock state
  const [productForm, setProductForm] = useState({
    name: '',
    sku: '',
    category: 'Electronics',
    initialStock: '50',
    warehouse: 'Main Central Hub'
  });

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  const handleAddProductSubmit = (e) => {
    e.preventDefault();
    setShowAddProductModal(false);
    setToastMessage(`Product "${productForm.name || 'New Item'}" added to mock catalog.`);
    setTimeout(() => setToastMessage(null), 3500);
    setProductForm({
      name: '',
      sku: '',
      category: 'Electronics',
      initialStock: '50',
      warehouse: 'Main Central Hub'
    });
  };

  return (
    <div className="app-shell">
      {/* Mobile Backdrop */}
      <div 
        className={`mobile-overlay ${isMobileMenuOpen ? 'active' : ''}`}
        onClick={() => setIsMobileMenuOpen(false)}
      />

      {/* Sidebar */}
      <Sidebar 
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className={`app-main ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <TopHeader 
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          onAddProductClick={() => setShowAddProductModal(true)}
        />

        <main className="page-viewport">
          <Outlet context={{ onOpenAddProduct: () => setShowAddProductModal(true) }} />
        </main>
      </div>

      {/* Add Product Modal (UI Demonstration) */}
      {showAddProductModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.5)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: 'var(--radius-lg)',
            width: '100%',
            maxWidth: '520px',
            boxShadow: 'var(--shadow-dropdown)',
            overflow: 'hidden',
            border: '1px solid var(--border-subtle)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '18px 22px',
              borderBottom: '1px solid var(--border-subtle)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--primary-light)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Box size={18} />
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Add New Product (Mock)</h3>
              </div>
              <button 
                onClick={() => setShowAddProductModal(false)}
                style={{ color: 'var(--text-muted)', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddProductSubmit} style={{ padding: '22px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                    Product Name
                  </label>
                  <input 
                    type="text"
                    required
                    placeholder="e.g. Wireless Barcode Scanner 2.4G"
                    value={productForm.name}
                    onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                      fontSize: '13.5px'
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                      SKU Code
                    </label>
                    <input 
                      type="text"
                      placeholder="e.g. ELC-SC-901"
                      value={productForm.sku}
                      onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-subtle)',
                        fontSize: '13.5px'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                      Category
                    </label>
                    <select
                      value={productForm.category}
                      onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-subtle)',
                        fontSize: '13.5px',
                        background: '#ffffff'
                      }}
                    >
                      <option>Electronics</option>
                      <option>Apparel</option>
                      <option>Industrial</option>
                      <option>Accessories</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                      Initial Stock Units
                    </label>
                    <input 
                      type="number"
                      value={productForm.initialStock}
                      onChange={(e) => setProductForm({ ...productForm, initialStock: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-subtle)',
                        fontSize: '13.5px'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                      Target Warehouse
                    </label>
                    <select
                      value={productForm.warehouse}
                      onChange={(e) => setProductForm({ ...productForm, warehouse: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-subtle)',
                        fontSize: '13.5px',
                        background: '#ffffff'
                      }}
                    >
                      <option>Main Central Hub</option>
                      <option>North Logistics Depot</option>
                      <option>South Fulfillment Center</option>
                      <option>West Coast Facility</option>
                    </select>
                  </div>
                </div>
              </div>

              <div style={{
                marginTop: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '10px'
              }}>
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setShowAddProductModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Product (Local Mock)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Feedback Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          backgroundColor: '#0f172a',
          color: '#ffffff',
          padding: '12px 18px',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-dropdown)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '13.5px',
          zIndex: 110,
          animation: 'fadeIn 0.2s ease'
        }}>
          <CheckCircle2 size={18} color="#10b981" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
