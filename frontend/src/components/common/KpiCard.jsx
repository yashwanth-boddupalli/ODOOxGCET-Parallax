import React from 'react';
import { 
  Package, 
  Boxes, 
  Truck, 
  AlertTriangle, 
  ArrowUpRight, 
  ArrowDownRight,
  Layers
} from 'lucide-react';

const iconMap = {
  Package,
  Boxes,
  Truck,
  AlertTriangle,
  Layers
};

export const KpiCard = ({ item }) => {
  const IconComponent = iconMap[item.icon] || Package;

  return (
    <div className={`kpi-card color-${item.color}`}>
      <div className="kpi-top-row">
        <span className="kpi-label">{item.label}</span>
        <div className={`kpi-icon-box ${item.color}`} aria-hidden="true">
          <IconComponent size={20} />
        </div>
      </div>

      <div>
        <div className="kpi-value">{item.value}</div>
        <div className="kpi-trend-row">
          <span className={`trend-badge ${item.isPositive ? 'positive' : 'negative'}`}>
            {item.isPositive ? (
              <ArrowUpRight size={13} strokeWidth={2.5} />
            ) : (
              <ArrowDownRight size={13} strokeWidth={2.5} />
            )}
            {item.change}
          </span>
          <span className="kpi-timeframe">{item.timeframe}</span>
        </div>
      </div>

      {item.badge && (
        <span className="kpi-pill-badge">
          {item.badge}
        </span>
      )}
    </div>
  );
};
