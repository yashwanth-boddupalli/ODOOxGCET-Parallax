import React, { useState } from 'react';
import { mockStockMovement } from '../data/mockCharts';

export const StockMovementChart = () => {
  const [hoveredPoint, setHoveredPoint] = useState(null);

  // SVG viewBox coordinates: 400 width x 200 height
  const width = 400;
  const height = 180;
  const padding = { top: 20, right: 20, bottom: 30, left: 35 };

  const minStock = 250;
  const maxStock = 300;

  // Map data to SVG coordinates
  const points = mockStockMovement.map((d, index) => {
    const x = padding.left + (index / (mockStockMovement.length - 1)) * (width - padding.left - padding.right);
    const y = padding.top + (1 - (d.stock - minStock) / (maxStock - minStock)) * (height - padding.top - padding.bottom);
    return { ...d, x, y };
  });

  // SVG Line path
  const linePath = points.reduce((acc, curr, idx) => {
    return idx === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`;
  }, '');

  // SVG Area path (for gradient fill)
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padding.bottom} L ${points[0].x} ${height - padding.bottom} Z`;

  // Optimal threshold y coordinate
  const thresholdY = padding.top + (1 - (280 - minStock) / (maxStock - minStock)) * (height - padding.top - padding.bottom);

  return (
    <div className="content-card">
      <div className="card-header">
        <div className="card-title-group">
          <h2 className="card-title">Stock Movement</h2>
          <span className="card-subtitle">Real-time inventory levels vs target buffer capacity</span>
        </div>

        <div className="card-actions">
          <div className="chart-legend-row">
            <div className="legend-item">
              <span className="legend-indicator circle" style={{ backgroundColor: '#2563eb' }} />
              <span>Available Level</span>
            </div>
            <div className="legend-item">
              <span className="legend-indicator" style={{ backgroundColor: '#f59e0b', height: '2px' }} />
              <span>Target (280k)</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card-body">
        <div className="svg-chart-container">
          <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg">
            <defs>
              <linearGradient id="stockGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563eb" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid lines */}
            {[260, 270, 280, 290].map((val) => {
              const yVal = padding.top + (1 - (val - minStock) / (maxStock - minStock)) * (height - padding.top - padding.bottom);
              return (
                <g key={val}>
                  <line 
                    x1={padding.left} 
                    y1={yVal} 
                    x2={width - padding.right} 
                    y2={yVal} 
                    className="grid-line" 
                  />
                  <text 
                    x={padding.left - 6} 
                    y={yVal + 3} 
                    textAnchor="end" 
                    fontSize="10" 
                    fill="#94a3b8"
                  >
                    {val}k
                  </text>
                </g>
              );
            })}

            {/* Target buffer threshold line */}
            <line 
              x1={padding.left} 
              y1={thresholdY} 
              x2={width - padding.right} 
              y2={thresholdY} 
              className="threshold-line" 
            />

            {/* Area Fill */}
            <path d={areaPath} className="area-fill" />

            {/* Line Curve */}
            <path d={linePath} className="stock-line" />

            {/* Interactive Data Points */}
            {points.map((pt, i) => (
              <g key={i}>
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={hoveredPoint === i ? 6 : 4}
                  className="data-point"
                  onMouseEnter={() => setHoveredPoint(i)}
                  onMouseLeave={() => setHoveredPoint(null)}
                />
                <text
                  x={pt.x}
                  y={height - 10}
                  textAnchor="middle"
                  fontSize="10.5"
                  fill="#94a3b8"
                >
                  {pt.time}
                </text>
              </g>
            ))}
          </svg>

          {/* Interactive Tooltip Card */}
          {hoveredPoint !== null && (
            <div style={{
              position: 'absolute',
              top: '12px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: '#0f172a',
              color: '#ffffff',
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12px',
              boxShadow: 'var(--shadow-md)',
              display: 'flex',
              gap: '12px'
            }}>
              <span>Time: <strong>{points[hoveredPoint].time}</strong></span>
              <span>Stock: <strong>{points[hoveredPoint].stock}k units</strong></span>
              <span>Buffer: <strong style={{ color: '#38bdf8' }}>+4k above target</strong></span>
            </div>
          )}
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: '12px',
          borderTop: '1px solid var(--border-subtle)',
          fontSize: '12px',
          color: 'var(--text-muted)'
        }}>
          <span>Current Level: <strong style={{ color: 'var(--text-primary)' }}>284.5k units</strong></span>
          <span>Target Buffer: <strong style={{ color: '#d97706' }}>280k units</strong></span>
          <span>Safety Margin: <strong style={{ color: 'var(--emerald)' }}>+1.6%</strong></span>
        </div>
      </div>
    </div>
  );
};
