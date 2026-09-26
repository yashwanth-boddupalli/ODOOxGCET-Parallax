import React from 'react';
import { mockPerformanceData } from '../data/mockCharts';
import { TrendingUp, CheckCircle, ShieldCheck } from 'lucide-react';

export const InventoryPerformanceChart = () => {
  const width = 800;
  const height = 180;
  const padding = { top: 20, right: 30, bottom: 35, left: 40 };

  const minTurnover = 4.0;
  const maxTurnover = 7.0;

  // Points for turnover rate curve
  const points = mockPerformanceData.map((d, index) => {
    const x = padding.left + (index / (mockPerformanceData.length - 1)) * (width - padding.left - padding.right);
    const y = padding.top + (1 - (d.turnover - minTurnover) / (maxTurnover - minTurnover)) * (height - padding.top - padding.bottom);
    return { ...d, x, y };
  });

  const linePath = points.reduce((acc, curr, idx) => {
    return idx === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`;
  }, '');

  return (
    <div className="content-card chart-full-width">
      <div className="card-header">
        <div className="card-title-group">
          <h2 className="card-title">Inventory Performance & Velocity (H1 Trend)</h2>
          <span className="card-subtitle">
            Longitudinal inventory turnover ratio, order fulfillment SLA, and warehouse throughput
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
            <span className="perf-metric-val">6.2x</span>
            <span className="perf-metric-sub">+29.1% improvement from Jan</span>
          </div>

          <div className="perf-metric-mini">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle size={14} color="#059669" />
              <span className="perf-metric-title">Order Fulfillment Rate</span>
            </div>
            <span className="perf-metric-val">99.2%</span>
            <span className="perf-metric-sub">Surpassed 98.5% SLA benchmark</span>
          </div>

          <div className="perf-metric-mini">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={14} color="#4f46e5" />
              <span className="perf-metric-title">Stock Audit Accuracy</span>
            </div>
            <span className="perf-metric-val">99.8%</span>
            <span className="perf-metric-sub">Across 4 facilities (Zero critical drift)</span>
          </div>
        </div>

        {/* SVG Multi-axis chart */}
        <div className="svg-chart-container">
          <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" style={{ height: '200px' }}>
            <defs>
              <linearGradient id="volumeBarGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#93c5fd" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#dbeafe" stopOpacity="0.3" />
              </linearGradient>
            </defs>

            {/* Grid Lines */}
            {[4.5, 5.5, 6.5].map((val) => {
              const yVal = padding.top + (1 - (val - minTurnover) / (maxTurnover - minTurnover)) * (height - padding.top - padding.bottom);
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
                    x={padding.left - 8} 
                    y={yVal + 4} 
                    textAnchor="end" 
                    fontSize="11" 
                    fill="#94a3b8"
                  >
                    {val}x
                  </text>
                </g>
              );
            })}

            {/* Volume background bars */}
            {points.map((pt) => {
              const barHeight = ((pt.volume - 15000) / 15000) * (height - padding.top - padding.bottom);
              const barY = height - padding.bottom - barHeight;
              return (
                <rect
                  key={pt.month}
                  x={pt.x - 22}
                  y={barY}
                  width="44"
                  height={barHeight}
                  rx="4"
                  fill="url(#volumeBarGrad)"
                />
              );
            })}

            {/* Turnover Line */}
            <path 
              d={linePath} 
              fill="none" 
              stroke="#2563eb" 
              strokeWidth="3" 
              strokeLinecap="round" 
            />

            {/* Nodes and Labels */}
            {points.map((pt) => (
              <g key={pt.month}>
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r="5"
                  fill="#ffffff"
                  stroke="#2563eb"
                  strokeWidth="3"
                />
                <text
                  x={pt.x}
                  y={pt.y - 10}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="600"
                  fill="#1e293b"
                >
                  {pt.turnover}x
                </text>
                <text
                  x={pt.x}
                  y={height - 12}
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight="500"
                  fill="#64748b"
                >
                  {pt.month}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>
    </div>
  );
};
