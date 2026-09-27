import React from 'react';
import { formatQty, formatSignedQty } from '../lib/format';

// data: [{ day, inbound, outbound, total }] from dashboard_activity
export const InventoryActivityChart = ({ data = [], range = '7d', onRangeChange, loading = false }) => {
  // Scale bars to the busiest day so real volumes always fit.
  const maxVal = Math.max(1, ...data.flatMap((d) => [d.inbound, d.outbound])) * 1.1;
  const dense = data.length > 10;
  const totalIn = data.reduce((sum, d) => sum + d.inbound, 0);
  const totalOut = data.reduce((sum, d) => sum + d.outbound, 0);

  return (
    <div className="content-card">
      <div className="card-header">
        <div className="card-title-group">
          <h2 className="card-title">Inventory Activity</h2>
          <span className="card-subtitle">Inbound receipts vs outbound deliveries over time</span>
        </div>

        <div className="card-actions">
          <div className="chart-legend-row" style={{ marginRight: '8px' }}>
            <div className="legend-item">
              <span className="legend-indicator" style={{ backgroundColor: 'var(--primary)' }} />
              <span>Inbound</span>
            </div>
            <div className="legend-item">
              <span className="legend-indicator" style={{ backgroundColor: 'var(--emerald)' }} />
              <span>Outbound</span>
            </div>
          </div>

          <div className="timeframe-select-pill">
            <button
              className={`timeframe-pill-btn ${range === '7d' ? 'active' : ''}`}
              onClick={() => onRangeChange?.('7d')}
            >
              7 Days
            </button>
            <button
              className={`timeframe-pill-btn ${range === '30d' ? 'active' : ''}`}
              onClick={() => onRangeChange?.('30d')}
            >
              30 Days
            </button>
          </div>
        </div>
      </div>

      <div className="card-body">
        {data.length === 0 ? (
          <div className="chart-empty">{loading ? 'Loading activity…' : 'No receipts or deliveries yet.'}</div>
        ) : (
          <div className={`activity-bars-group ${dense ? 'dense' : ''}`}>
            {data.map((item, index) => {
              const inboundHeight = Math.round((item.inbound / maxVal) * 170);
              const outboundHeight = Math.round((item.outbound / maxVal) * 170);
              // In the 30-day view, label every 5th day (counting back from today).
              const showLabel = !dense || (data.length - 1 - index) % 5 === 0;

              return (
                <div key={item.date || item.day} className="activity-day-col">
                  <div className="bars-pair">
                    {/* Inbound Bar */}
                    <div
                      className="bar-pillar inbound"
                      style={{ height: `${inboundHeight}px` }}
                      aria-label={`${item.day} Inbound: ${item.inbound} units`}
                    >
                      <div className="bar-tooltip">
                        {item.day} in: +{formatQty(item.inbound)}
                      </div>
                    </div>

                    {/* Outbound Bar */}
                    <div
                      className="bar-pillar outbound"
                      style={{ height: `${outboundHeight}px` }}
                      aria-label={`${item.day} Outbound: ${item.outbound} units`}
                    >
                      <div className="bar-tooltip">
                        {item.day} out: -{formatQty(item.outbound)}
                      </div>
                    </div>
                  </div>

                  <span className={`day-label ${showLabel ? '' : 'hidden'}`}>{item.day}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Supporting Summary Banner */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: '16px',
          fontSize: '12.5px',
          color: 'var(--text-secondary)',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          <div>
            Total Inbound: <strong style={{ color: 'var(--primary)' }}>{formatQty(totalIn)} units</strong>
          </div>
          <div>
            Total Outbound: <strong style={{ color: 'var(--emerald)' }}>{formatQty(totalOut)} units</strong>
          </div>
          <div>
            Net Inventory Change: <strong style={{ color: 'var(--text-primary)' }}>{formatSignedQty(totalIn - totalOut)} units</strong>
          </div>
        </div>
      </div>
    </div>
  );
};
