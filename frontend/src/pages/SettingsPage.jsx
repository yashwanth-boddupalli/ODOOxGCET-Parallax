import React, { useState } from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { Save, CheckCircle } from 'lucide-react';

export const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState('general');
  const [saved, setSaved] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="dashboard-container">
      <PageHeader
        title="System Settings"
        description="Configure warehouse topology defaults, automated replenishment thresholds, and role access."
      />

      <div className="content-card">
        <div className="card-header">
          <div className="filter-pills-group" role="tablist">
            <button 
              className={`filter-pill ${activeTab === 'general' ? 'active' : ''}`}
              onClick={() => setActiveTab('general')}
            >
              General Configuration
            </button>
            <button 
              className={`filter-pill ${activeTab === 'notifications' ? 'active' : ''}`}
              onClick={() => setActiveTab('notifications')}
            >
              Alerts & Reorders
            </button>
            <button 
              className={`filter-pill ${activeTab === 'facilities' ? 'active' : ''}`}
              onClick={() => setActiveTab('facilities')}
            >
              Facility Defaults
            </button>
          </div>

          {saved && (
            <span style={{ fontSize: '13px', color: 'var(--emerald)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle size={15} /> Preferences saved (Mock)
            </span>
          )}
        </div>

        <div className="card-body">
          <form onSubmit={handleSave} style={{ maxWidth: '640px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Application Workspace Name
              </label>
              <input
                type="text"
                defaultValue="StockSense Enterprise"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '13.5px'
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Default Primary Facility
                </label>
                <select
                  defaultValue="Main Central Hub"
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

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Default Reorder Buffer Multiplier
                </label>
                <select
                  defaultValue="3x"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '13.5px',
                    background: '#ffffff'
                  }}
                >
                  <option>2x Min Stock</option>
                  <option>3x Min Stock (Recommended)</option>
                  <option>5x Min Stock</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Audit Logging & Stock Ledger Strategy
              </label>
              <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                All transactions (Receipts, Deliveries, Transfers, Adjustments) are appended immutably to the Stock Ledger.
              </p>
              <div style={{ display: 'flex', gap: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                  <input type="checkbox" defaultChecked /> Require manager sign-off on negative adjustments
                </label>
              </div>
            </div>

            <div style={{ paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
              <button type="submit" className="btn btn-primary">
                <Save size={15} /> Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
