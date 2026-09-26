import React from 'react';
import { TrendingUp, CheckCircle, ShieldCheck } from 'lucide-react';
import { formatCompact } from '../lib/format';

const lastValue = (data, key) => [...data].reverse().find((d) => d[key] !== null && d[key] !== undefined)?.[key] ?? null;
const firstValue = (data, key) => data.find((d) => d[key] !== null && d[key] !== undefined)?.[key] ?? null;

// data: [{ month, turnover, fulfillment, accuracy, volume }] from dashboard_performance
export const InventoryPerformanceChart = ({ data = [], loading = false }) => {
  const width = 800;
  const height = 180;
  const padding = { top: 20, right: 30, bottom: 35, left: 40 };
  const plotHeight = height - padding.top - padding.bottom;

  // Scales come from the data (turnover line and volume bars share the plot area).
  const maxTurnover = Math.max(1, ...data.map((d) => d.turnover ?? 0)) * 1.25;
  const maxVolume = Math.max(1, ...data.map((d) => d.volume ?? 0));
  const yFor = (t) => padding.top + (1 - t / maxTurnover) * plotHeight;

  const points = data.map((d, index) => ({
    ...d,
    x: padding.left + (index / Math.max(data.length - 1, 1)) * (width - padding.left - padding.right),
    y: d.turnover === null ? null : yFor(d.turnover),
  }));
  const drawn = points.filter((p) => p.y !== null);
  const linePath = drawn.reduce((acc, curr, idx) => (idx === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`), '');

  const turnover = lastValue(data, 'turnover');
  const turnoverStart = firstValue(data, 'turnover');
  const turnoverChange = turnover !== null && turnoverStart ? ((turnover - turnoverStart) / turnoverStart) * 100 : null;
  const fulfillment = lastValue(data, 'fulfillment');
  const accuracy = lastValue(data, 'accuracy');
  const firstMonth = data[0]?.month;

  return (
    <div className="content-card chart-full-width">
      <div className="card-header">
        <div className="card-title-group">
          <h2 className="card-title">Inventory Performance & Velocity ({data.length || 6}-Month Trend)</h2>
          <span className="card-subtitle">
            Inventory turnover, on-time delivery rate, and units moved per month
          </span>
        </div>

        <div className="card-actions">
          <div className="chart-legend-row">
            <div className="legend-item">
              <span className="legend-indicator" style={{ backgroundColor: '#2563eb' }} />
              <span>Turnover Velocity (x/yr)</span>
            </div>
            <div className="legend-item">
              <span className="legend-indicator" style={{ backgroundColor: '#10b981' }} />
              <span>Monthly Volume (Units)</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card-body">
        {/* Top 3 KPI Strips */}
        <div className="perf-metrics-strip">
          <div className="perf-metric-mini">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <TrendingUp size={14} color="#2563eb" />
              <span className="perf-metric-title">Annualized Turnover</span>
            </div>
            <span className="perf-metric-val">{turnover === null ? '—' : `${turnover}x`}</span>
            <span className="perf-metric-sub">
              {turnoverChange === null
                ? 'Shipped units ÷ average stock, per year'
                : `${turnoverChange >= 0 ? '+' : ''}${turnoverChange.toFixed(1)}% vs ${firstMonth}`}
            </span>
          </div>

          <div className="perf-metric-mini">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle size={14} color="#059669" />
              <span className="perf-metric-title">Order Fulfillment Rate</span>
            </div>
            <span className="perf-metric-val">{fulfillment === null ? '—' : `${fulfillment}%`}</span>
            <span className="perf-metric-sub">Deliveries shipped on or before their scheduled date</span>
          </div>

          <div className="perf-metric-mini">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={14} color="#4f46e5" />
              <span className="perf-metric-title">Stock Audit Accuracy</span>
            </div>
            <span className="perf-metric-val">{accuracy === null ? '—' : `${accuracy}%`}</span>
            <span className="perf-metric-sub">100% minus adjusted units as a share of stock</span>
          </div>
        </div>

        {/* SVG Multi-axis chart */}
        {data.length === 0 ? (
          <div className="chart-empty">{loading ? 'Loading performance…' : 'No history yet.'}</div>
        ) : (
          <div className="svg-chart-container">
            <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" style={{ height: '200px' }}>
              <defs>
                <linearGradient id="volumeBarGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#93c5fd" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#dbeafe" stopOpacity="0.3" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              {[0.25, 0.5, 0.75].map((f) => {
                const val = maxTurnover * f;
                return (
                  <g key={f}>
                    <line x1={padding.left} y1={yFor(val)} x2={width - padding.right} y2={yFor(val)} className="grid-line" />
                    <text x={padding.left - 8} y={yFor(val) + 4} textAnchor="end" fontSize="11" fill="#94a3b8">
                      {val.toFixed(1)}x
                    </text>
                  </g>
                );
              })}

              {/* Volume background bars */}
              {points.map((pt) => {
                const barHeight = ((pt.volume ?? 0) / maxVolume) * plotHeight;
                return (
                  <g key={`bar-${pt.month}`}>
                    <rect x={pt.x - 22} y={height - padding.bottom - barHeight} width="44" height={barHeight} rx="4" fill="url(#volumeBarGrad)">
                      <title>{`${pt.month}: ${formatCompact(pt.volume)} units moved`}</title>
                    </rect>
                  </g>
                );
              })}

              {/* Turnover Line */}
              <path d={linePath} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" />

              {/* Nodes and Labels */}
              {points.map((pt) => (
                <g key={pt.month}>
                  {pt.y !== null && (
                    <>
                      <circle cx={pt.x} cy={pt.y} r="5" fill="#ffffff" stroke="#2563eb" strokeWidth="3" />
                      <text x={pt.x} y={pt.y - 10} textAnchor="middle" fontSize="11" fontWeight="600" fill="#1e293b">
                        {pt.turnover}x
                      </text>
                    </>
                  )}
                  <text x={pt.x} y={height - 12} textAnchor="middle" fontSize="12" fontWeight="500" fill="#64748b">
                    {pt.month}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        )}
      </div>
    </div>
  );
};
