import React from 'react';
import { mockCategoryData } from '../data/mockCharts';

// Pre-calculate cumulative offsets purely outside render
const categoriesWithOffsets = (() => {
  let runningTotal = 0;
  return mockCategoryData.map((cat) => {
    const currentOffset = runningTotal;
    runningTotal += cat.percentage;
    return {
      ...cat,
      offset: currentOffset
    };
  });
})();

export const TopCategoriesChart = () => {
  // SVG Donut calculation
  // Radius = 60, Circumference = 2 * PI * 60 ≈ 377
  const radius = 60;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="content-card">
      <div className="card-header">
        <div className="card-title-group">
          <h2 className="card-title">Top Categories</h2>
          <span className="card-subtitle">Distribution of stock across key inventory sectors</span>
        </div>
      </div>

      <div className="card-body">
        <div className="category-chart-layout">
          {/* Donut Chart */}
          <div className="donut-wrapper">
            <svg viewBox="0 0 160 160" className="donut-svg">
              {categoriesWithOffsets.map((cat) => {
                const strokeDasharray = `${(cat.percentage / 100) * circumference} ${circumference}`;
                const strokeDashoffset = -((cat.offset / 100) * circumference);

                return (
                  <circle
                    key={cat.name}
                    cx="80"
                    cy="80"
                    r={radius}
                    fill="transparent"
                    stroke={cat.color}
                    strokeWidth="20"
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dasharray 0.3s ease' }}
                  />
                );
              })}
            </svg>

            <div className="donut-center-info">
              <span className="donut-center-number">14.8k</span>
              <span className="donut-center-text">Total Items</span>
            </div>
          </div>

          {/* Category List */}
          <div className="category-legend-list">
            {mockCategoryData.map((cat) => (
              <div key={cat.name} className="category-row-item">
                <div className="cat-label-group">
                  <span className="cat-color-dot" style={{ backgroundColor: cat.color }} />
                  <span className="cat-name">{cat.name}</span>
                </div>
                <div className="cat-stats">
                  <span className="cat-percentage">{cat.percentage}%</span>
                  <span className="cat-count">({cat.count.toLocaleString()} units)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
