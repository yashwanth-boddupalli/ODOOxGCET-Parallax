import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { PageHeader } from '../components/common/PageHeader';
import { KpiCard } from '../components/common/KpiCard';
import { DataTable } from '../components/common/DataTable';
import { InventoryActivityChart } from '../charts/InventoryActivityChart';
import { StockMovementChart } from '../charts/StockMovementChart';
import { TopCategoriesChart } from '../charts/TopCategoriesChart';
import { FastMovingProducts } from '../charts/FastMovingProducts';
import { InventoryPerformanceChart } from '../charts/InventoryPerformanceChart';
import { mockKpis } from '../data/mockKpis';
import { mockOperations } from '../data/mockOperations';
import { 
  Calendar, 
  RotateCw, 
  Plus, 
  Download
} from 'lucide-react';

export const DashboardPage = () => {
  const { onOpenAddProduct } = useOutletContext() || {};
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState('Last 30 Days');
  const [showDateMenu, setShowDateMenu] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const dateOptions = ['Today', 'Last 7 Days', 'Last 30 Days', 'This Quarter'];

  return (
    <div className="dashboard-container">
      {/* Dashboard Top Header */}
      <PageHeader
        title="Inventory Overview"
        description="Comprehensive real-time telemetry across warehouse facilities, inbound receiving, and dispatch velocity."
        actions={
          <>
            {/* Date Range Selector Pill with Dropdown */}
            <div style={{ position: 'relative' }}>
              <button 
                className="btn btn-secondary btn-sm"
                onClick={() => setShowDateMenu(!showDateMenu)}
                title="Change Date Range"
              >
                <Calendar size={15} className="text-muted" />
                <span>{dateRange}</span>
              </button>

              {showDateMenu && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '4px',
                  backgroundColor: '#ffffff',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-dropdown)',
                  zIndex: 60,
                  minWidth: '150px',
                  overflow: 'hidden'
                }}>
                  {dateOptions.map((opt) => (
                    <button
                      key={opt}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '8px 12px',
                        fontSize: '12.5px',
                        fontWeight: dateRange === opt ? 600 : 400,
                        backgroundColor: dateRange === opt ? '#eff6ff' : '#ffffff',
                        color: dateRange === opt ? 'var(--primary)' : 'var(--text-primary)',
                        borderBottom: '1px solid #f1f5f9'
                      }}
                      onClick={() => {
                        setDateRange(opt);
                        setShowDateMenu(false);
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Refresh Button */}
            <button 
              className="btn btn-secondary btn-sm"
              onClick={handleRefresh}
              title="Refresh Telemetry Metrics"
              disabled={isRefreshing}
            >
              <RotateCw 
                size={14} 
                style={{
                  transition: 'transform 0.6s ease',
                  transform: isRefreshing ? 'rotate(360deg)' : 'none'
                }} 
              />
              <span>{isRefreshing ? 'Syncing...' : 'Sync Data'}</span>
            </button>

            {/* Export Summary */}
            <button className="btn btn-secondary btn-sm" title="Export Ledger Snapshot">
              <Download size={14} />
              <span>Export</span>
            </button>

            {/* Add Product Primary CTA */}
            <button 
              className="btn btn-primary btn-sm"
              onClick={onOpenAddProduct}
            >
              <Plus size={15} />
              <span>Add Product</span>
            </button>
          </>
        }
      />

      {/* Row 1: KPI Cards Grid */}
      <section aria-label="Key Performance Indicators">
        <div className="kpi-grid">
          {mockKpis.map((kpi) => (
            <KpiCard key={kpi.id} item={kpi} />
          ))}
        </div>
      </section>

      {/* Row 2: Primary Visualizations (Inbound vs Outbound Activity & Stock Movement Curve) */}
      <section aria-label="Inventory Movement and Activity Trends" className="charts-grid-two-col">
        <InventoryActivityChart />
        <StockMovementChart />
      </section>

      {/* Row 3: Secondary Breakdown (Category Donut & Fast Moving Products) */}
      <section aria-label="Category Distribution and Fast Moving SKUs" className="charts-grid-secondary">
        <TopCategoriesChart />
        <FastMovingProducts />
      </section>

      {/* Row 4: Longitudinal Performance (6-Month Fulfillment & Turnover Velocity) */}
      <section aria-label="Long-Term Operational Performance" className="chart-full-width">
        <InventoryPerformanceChart />
      </section>

      {/* Row 5: Detailed Auditable Operations Table */}
      <section aria-label="Live Operations Ledger">
        <DataTable operations={mockOperations} />
      </section>
    </div>
  );
};
