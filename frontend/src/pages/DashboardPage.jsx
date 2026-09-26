import React, { useState } from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { KpiCard } from '../components/common/KpiCard';
import { DataTable } from '../components/common/DataTable';
import { InventoryActivityChart } from '../charts/InventoryActivityChart';
import { StockMovementChart } from '../charts/StockMovementChart';
import { TopCategoriesChart } from '../charts/TopCategoriesChart';
import { FastMovingProducts } from '../charts/FastMovingProducts';
import { InventoryPerformanceChart } from '../charts/InventoryPerformanceChart';
import { useAsync, useWorkspace } from '../app/useWorkspace';
import {
  getActivity,
  getCategoryBreakdown,
  getFastMoving,
  getKpis,
  getPerformance,
  getStockMovement,
  listOperationRows,
} from '../api';
import { downloadCsv, operationCsvColumns } from '../lib/csv';
import {
  Calendar,
  RotateCw,
  Plus,
  Download
} from 'lucide-react';

const dateOptions = [
  { label: 'Today', value: 'today' },
  { label: 'Last 7 Days', value: '7d' },
  { label: 'Last 30 Days', value: '30d' },
  { label: 'This Quarter', value: 'quarter' },
];

const KpiSkeleton = () => (
  <div className="kpi-card" aria-hidden="true">
    <div className="skeleton" style={{ height: 14, width: '55%' }} />
    <div className="skeleton" style={{ height: 30, width: '40%' }} />
    <div className="skeleton" style={{ height: 12, width: '70%' }} />
  </div>
);

export const DashboardPage = () => {
  const { warehouseId, activeWarehouse, version, refresh, openAddProduct } = useWorkspace();
  const [dateRange, setDateRange] = useState('30d');
  const [showDateMenu, setShowDateMenu] = useState(false);
  const [activityRange, setActivityRange] = useState('7d');
  const [movementRange, setMovementRange] = useState('today');

  const scopeDeps = [warehouseId, version];
  const kpis = useAsync(() => getKpis(dateRange, warehouseId), [dateRange, ...scopeDeps]);
  const activity = useAsync(() => getActivity(activityRange, warehouseId), [activityRange, ...scopeDeps]);
  const movement = useAsync(() => getStockMovement(movementRange, warehouseId), [movementRange, ...scopeDeps]);
  const categories = useAsync(() => getCategoryBreakdown(warehouseId), scopeDeps);
  const fastMoving = useAsync(() => getFastMoving(warehouseId), scopeDeps);
  const performance = useAsync(() => getPerformance(warehouseId), scopeDeps);
  const operations = useAsync(() => listOperationRows({ warehouseId }), scopeDeps);

  const isRefreshing = kpis.loading || operations.loading;
  const rangeLabel = dateOptions.find((o) => o.value === dateRange)?.label;

  return (
    <div className="dashboard-container">
      {/* Dashboard Top Header */}
      <PageHeader
        title="Inventory Overview"
        description={`Live telemetry across ${activeWarehouse ? activeWarehouse.name : 'all warehouse facilities'}: inbound receiving, stock levels, and dispatch velocity.`}
        actions={
          <>
            {/* Date Range Selector Pill with Dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowDateMenu(!showDateMenu)}
                title="Change the KPI comparison range"
              >
                <Calendar size={15} className="text-muted" />
                <span>{rangeLabel}</span>
              </button>

              {showDateMenu && (
                <div className="dropdown-menu" style={{ minWidth: 150, width: 'auto' }}>
                  {dateOptions.map((opt) => (
                    <button
                      key={opt.value}
                      className={`dropdown-item ${dateRange === opt.value ? 'active' : ''}`}
                      onClick={() => {
                        setDateRange(opt.value);
                        setShowDateMenu(false);
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Refresh Button */}
            <button
              className="btn btn-secondary btn-sm"
              onClick={refresh}
              title="Reload every figure from the database"
              disabled={isRefreshing}
            >
              <RotateCw size={14} className={isRefreshing ? 'spin' : ''} />
              <span>{isRefreshing ? 'Syncing...' : 'Sync Data'}</span>
            </button>

            {/* Export Summary */}
            <button
              className="btn btn-secondary btn-sm"
              title="Export the operations table as CSV"
              onClick={() => downloadCsv('stocksense-operations', operations.data || [], operationCsvColumns)}
              disabled={!operations.data?.length}
            >
              <Download size={14} />
              <span>Export</span>
            </button>

            {/* Add Product Primary CTA */}
            <button className="btn btn-primary btn-sm" onClick={openAddProduct}>
              <Plus size={15} />
              <span>Add Product</span>
            </button>
          </>
        }
      />

      {/* Row 1: KPI Cards Grid */}
      <section aria-label="Key Performance Indicators">
        <div className="kpi-grid">
          {kpis.data
            ? kpis.data.map((kpi) => <KpiCard key={kpi.id} item={kpi} />)
            : [0, 1, 2, 3].map((i) => <KpiSkeleton key={i} />)}
        </div>
      </section>

      {/* Row 2: Primary Visualizations (Inbound vs Outbound Activity & Stock Movement Curve) */}
      <section aria-label="Inventory Movement and Activity Trends" className="charts-grid-two-col">
        <InventoryActivityChart data={activity.data} range={activityRange} onRangeChange={setActivityRange} loading={activity.loading} />
        <StockMovementChart data={movement.data} range={movementRange} onRangeChange={setMovementRange} loading={movement.loading} />
      </section>

      {/* Row 3: Secondary Breakdown (Category Donut & Fast Moving Products) */}
      <section aria-label="Category Distribution and Fast Moving SKUs" className="charts-grid-secondary">
        <TopCategoriesChart data={categories.data} loading={categories.loading} />
        <FastMovingProducts data={fastMoving.data} loading={fastMoving.loading} />
      </section>

      {/* Row 4: Longitudinal Performance (6-Month Fulfillment & Turnover Velocity) */}
      <section aria-label="Long-Term Operational Performance" className="chart-full-width">
        <InventoryPerformanceChart data={performance.data} loading={performance.loading} />
      </section>

      {/* Row 5: Detailed Auditable Operations Table */}
      <section aria-label="Live Operations Ledger">
        <DataTable operations={operations.data || []} loading={operations.loading} error={operations.error} />
      </section>
    </div>
  );
};
