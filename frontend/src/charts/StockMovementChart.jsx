import React, { useState } from 'react';
import { formatCompact, formatQty, formatSignedQty } from '../lib/format';

// data: [{ time, stock, capacity, optimal }] from dashboard_stock_movement (real units)
export const StockMovementChart = ({ data = [], range = 'today', onRangeChange, loading = false }) => {
  const [hoveredPoint, setHoveredPoint] = useState(null);

  // SVG viewBox coordinates
  const width = 400;
  const height = 180;
  const padding = { top: 20, right: 20, bottom: 30, left: 40 };

  const target = data.find((d) => d.optimal !== null && d.optimal !== undefined)?.optimal ?? null;
  const values = [...data.map((d) => d.stock), ...(target !== null ? [target] : [])];
  const rawMin = values.length ? Math.min(...values) : 0;
  const rawMax = values.length ? Math.max(...values) : 1;
  // Give the line some headroom so a flat day doesn't sit on the axis.
  const pad = (rawMax - rawMin) * 0.2 || Math.max(rawMax * 0.05, 1);
  const minStock = Math.max(0, rawMin - pad);
  const maxStock = rawMax + pad;
  const yFor = (v) => padding.top + (1 - (v - minStock) / (maxStock - minStock)) * (height - padding.top - padding.bottom);

  const points = data.map((d, index) => ({
    ...d,
    x: padding.left + (index / Math.max(data.length - 1, 1)) * (width - padding.left - padding.right),
    y: yFor(d.stock),
  }));

  const linePath = points.reduce((acc, curr, idx) => (idx === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`), '');
  const areaPath = points.length
    ? `${linePath} L ${points[points.length - 1].x} ${height - padding.bottom} L ${points[0].x} ${height - padding.bottom} Z`
    : '';
  const ticks = [0.2, 0.4, 0.6, 0.8].map((f) => minStock + (maxStock - minStock) * f);
  const labelEvery = Math.ceil(points.length / 8);

  const current = data.length ? data[data.length - 1].stock : 0;
  const margin = target ? ((current - target) / target) * 100 : null;
  const hovered = hoveredPoint !== null ? points[hoveredPoint] : null;

  return (
    <div className="content-card">
      <div className="card-header">
        <div className="card-title-group">
          <h2 className="card-title">Stock Movement</h2>
          <span className="card-subtitle">Inventory level over time vs the target buffer</span>
        </div>

        <div className="card-actions">
          <div className="chart-legend-row">
            <div className="legend-item">
              <span className="legend-indicator circle" style={{ backgroundColor: '#2563eb' }} />
              <span>Available Level</span>
            </div>
            {target !== null && (
              <div className="legend-item">
                <span className="legend-indicator" style={{ backgroundColor: '#f59e0b', height: '2px' }} />
                <span>Target ({formatCompact(target)})</span>
              </div>
            )}
          </div>
          {onRangeChange && (
            <div className="timeframe-select-pill">
              {[['today', 'Today'], ['7d', '7D'], ['30d', '30D']].map(([key, label]) => (
                <button key={key} className={`timeframe-pill-btn ${range === key ? 'active' : ''}`} onClick={() => onRangeChange(key)}>
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card-body">
        {points.length < 2 ? (
          <div className="chart-empty">{loading ? 'Loading stock levels…' : 'Not enough history to draw a trend yet.'}</div>
        ) : (
          <div className="svg-chart-container" style={{ position: 'relative' }}>
            <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg">
              <defs>
                <linearGradient id="stockGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Horizontal Grid lines */}
              {ticks.map((val) => (
                <g key={val}>
                  <line x1={padding.left} y1={yFor(val)} x2={width - padding.right} y2={yFor(val)} className="grid-line" />
                  <text x={padding.left - 6} y={yFor(val) + 3} textAnchor="end" fontSize="10" fill="#94a3b8">
                    {formatCompact(val)}
                  </text>
                </g>
              ))}

              {/* Target buffer threshold line */}
              {target !== null && (
                <line x1={padding.left} y1={yFor(target)} x2={width - padding.right} y2={yFor(target)} className="threshold-line" />
              )}

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
                  {(i % labelEvery === 0 || i === points.length - 1) && (
                    <text x={pt.x} y={height - 10} textAnchor="middle" fontSize="10.5" fill="#94a3b8">
                      {pt.time}
                    </text>
                  )}
                </g>
              ))}
            </svg>

            {/* Interactive Tooltip Card */}
            {hovered && (
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
                gap: '12px',
                whiteSpace: 'nowrap'
              }}>
                <span>Time: <strong>{hovered.time}</strong></span>
                <span>Stock: <strong>{formatQty(hovered.stock)} units</strong></span>
                {target !== null && (
                  <span>vs target: <strong style={{ color: '#38bdf8' }}>{formatSignedQty(hovered.stock - target)}</strong></span>
                )}
              </div>
            )}
          </div>
        )}

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: '12px',
          borderTop: '1px solid var(--border-subtle)',
          fontSize: '12px',
          color: 'var(--text-muted)',
          gap: '10px',
          flexWrap: 'wrap'
        }}>
          <span>Current Level: <strong style={{ color: 'var(--text-primary)' }}>{formatQty(current)} units</strong></span>
          <span>Target Buffer: <strong style={{ color: '#d97706' }}>{target !== null ? `${formatQty(target)} units` : 'Not set'}</strong></span>
          <span>
            Safety Margin:{' '}
            <strong style={{ color: margin === null ? 'var(--text-muted)' : margin >= 0 ? 'var(--emerald)' : 'var(--rose)' }}>
              {margin === null ? '—' : `${margin >= 0 ? '+' : ''}${margin.toFixed(1)}%`}
            </strong>
          </span>
        </div>
      </div>
    </div>
  );
};
