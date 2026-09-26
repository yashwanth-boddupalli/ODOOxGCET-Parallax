import React from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { InventoryPerformanceChart } from '../charts/InventoryPerformanceChart';
import { TopCategoriesChart } from '../charts/TopCategoriesChart';
import { FastMovingProducts } from '../charts/FastMovingProducts';
import { TrendingUp } from 'lucide-react';

export const AnalyticsPage = () => {
  return (
    <div className="dashboard-container">
      <PageHeader
        title="Inventory Analytics & Intelligence"
        description="Comprehensive analytics covering inventory holding costs, SKU velocity distribution, and fill-rate metrics."
      />

      <div className="kpi-grid">
        <div className="kpi-card color-blue">
          <span className="kpi-label">Total Inventory Valuation</span>
          <div className="kpi-value">$3,842,600</div>
          <span className="trend-badge positive">
            <TrendingUp size={13} /> +4.2% capital efficiency
          </span>
        </div>

        <div className="kpi-card color-emerald">
          <span className="kpi-label">Average Days on Hand (DOH)</span>
          <div className="kpi-value">18.4 Days</div>
          <span className="trend-badge positive">
            -2.6 days (faster throughput)
          </span>
        </div>

        <div className="kpi-card color-indigo">
          <span className="kpi-label">Gross Margin Return on Inventory (GMROI)</span>
          <div className="kpi-value">3.4x</div>
          <span className="trend-badge positive">
            Top tier retail benchmark
          </span>
        </div>

        <div className="kpi-card color-amber">
          <span className="kpi-label">Dead Stock Risk Valuation</span>
          <div className="kpi-value">$14,200</div>
          <span className="trend-badge negative">
            0.36% of active capital
          </span>
        </div>
      </div>

      <InventoryPerformanceChart />

      <div className="charts-grid-secondary">
        <TopCategoriesChart />
        <FastMovingProducts />
      </div>
    </div>
  );
};
