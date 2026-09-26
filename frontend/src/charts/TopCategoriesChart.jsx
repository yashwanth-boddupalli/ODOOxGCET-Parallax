import React from 'react';
import { formatCompact, formatQty } from '../lib/format';

// data: [{ name, percentage, count, color }] from dashboard_categories
export const TopCategoriesChart = ({ data = [], loading = false }) => {
  // SVG Donut calculation
  const radius = 60;
  const circumference = 2 * Math.PI * radius;

  // Each slice starts where the previous ones end (running sum of percentages).
  const categoriesWithOffsets = data.map((cat, i) => ({
    ...cat,
    offset: data.slice(0, i).reduce((sum, c) => sum + c.percentage, 0),
  }));
  const totalUnits = data.reduce((sum, c) => sum + c.count, 0);

  return (
    <div className="content-card">
      <div className="card-header">
        <div className="card-title-group">
          <h2 className="card-title">Top Categories</h2>
          <span className="card-subtitle">Distribution of stock on hand across categories</span>
        </div>
      </div>

      <div className="card-body">
        {data.length === 0 ? (
          <div className="chart-empty">{loading ? 'Loading categories…' : 'No stock on hand yet.'}</div>
        ) : (
          <div className="category-chart-layout">
            {/* Donut Chart */}
            <div className="donut-wrapper">
              <svg viewBox="0 0 160 160" className="donut-svg">
                {categoriesWithOffsets.map((cat) => (
                  <circle
                    key={cat.name}
                    cx="80"
                    cy="80"
                    r={radius}
                    fill="transparent"
                    stroke={cat.color}
                    strokeWidth="20"
                    strokeDasharray={`${(cat.percentage / 100) * circumference} ${circumference}`}
                    strokeDashoffset={-((cat.offset / 100) * circumference)}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dasharray 0.3s ease' }}
                  />
                ))}
              </svg>

              <div className="donut-center-info">
                <span className="donut-center-number">{formatCompact(totalUnits)}</span>
                <span className="donut-center-text">Units on hand</span>
              </div>
            </div>

            {/* Category List */}
            <div className="category-legend-list">
              {data.map((cat) => (
                <div key={cat.name} className="category-row-item">
                  <div className="cat-label-group">
                    <span className="cat-color-dot" style={{ backgroundColor: cat.color }} />
                    <span className="cat-name">{cat.name}</span>
                  </div>
                  <div className="cat-stats">
                    <span className="cat-percentage">{cat.percentage}%</span>
                    <span className="cat-count">({formatQty(cat.count)} units)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
