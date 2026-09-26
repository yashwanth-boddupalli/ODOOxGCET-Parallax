import React from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { InventoryPerformanceChart } from '../charts/InventoryPerformanceChart';
import { TopCategoriesChart } from '../charts/TopCategoriesChart';
import { FastMovingProducts } from '../charts/FastMovingProducts';
import { useAsync, useWorkspace } from '../app/useWorkspace';
import { getAnalyticsKpis, getCategoryBreakdown, getFastMoving, getPerformance } from '../api';
import { formatMoney, formatQty } from '../lib/format';
import { TrendingUp } from 'lucide-react';

const Tile = ({ color, label, value, badge, tone = 'positive' }) => (
  <div className={`kpi-card color-${color}`}>
    <span className="kpi-label">{label}</span>
    <div className="kpi-value">{value}</div>
    <span className={`trend-badge ${tone}`} style={{ alignSelf: 'flex-start' }}>{badge}</span>
  </div>
);

export const AnalyticsPage = () => {
  const { warehouseId, version } = useWorkspace();
  const deps = [warehouseId, version];
  const kpis = useAsync(() => getAnalyticsKpis(warehouseId), deps);
  const performance = useAsync(() => getPerformance(warehouseId), deps);
  const categories = useAsync(() => getCategoryBreakdown(warehouseId), deps);
  const fastMoving = useAsync(() => getFastMoving(warehouseId), deps);
  const k = kpis.data;

  return (
    <div className="dashboard-container">
      <PageHeader
        title="Inventory Analytics & Intelligence"
        description="Inventory value, days on hand, slow movers and SKU velocity — computed live from the stock ledger."
      />

      <div className="kpi-grid">
        <Tile
          color="blue"
          label="Total Inventory Valuation"
          value={k ? formatMoney(k.inventoryValuation, 0) : '—'}
          badge={<><TrendingUp size={13} /> {k ? `${formatQty(k.totalUnits)} units at unit price` : 'Loading…'}</>}
        />
        <Tile
          color="emerald"
          label="Average Days on Hand (DOH)"
          value={k?.averageDaysOnHand != null ? `${k.averageDaysOnHand} Days` : '—'}
          badge={k ? `${formatQty(k.unitsShipped30d)} units shipped in 30 days` : 'Loading…'}
          tone="neutral"
        />
        <Tile
          color="indigo"
          label="Gross Margin Return on Inventory (GMROI)"
          value={k?.gmroi != null ? `${k.gmroi}x` : 'n/a'}
          badge="Needs cost prices on products"
          tone="neutral"
        />
        <Tile
          color="amber"
          label="Dead Stock Risk Valuation"
          value={k ? formatMoney(k.deadStockValue, 0) : '—'}
          badge={k ? `${k.deadStockPercent}% of stock value · no sales in 90 days` : 'Loading…'}
          tone={k && k.deadStockValue > 0 ? 'negative' : 'positive'}
        />
      </div>

      <InventoryPerformanceChart data={performance.data} loading={performance.loading} />

      <div className="charts-grid-secondary">
        <TopCategoriesChart data={categories.data} loading={categories.loading} />
        <FastMovingProducts data={fastMoving.data} loading={fastMoving.loading} />
      </div>
    </div>
  );
};
