import React, { useState } from 'react';
import { mockActivityData } from '../data/mockCharts';

export const InventoryActivityChart = () => {
  const [viewMode, setViewMode] = useState('7d');
  const maxVal = 250; // Reference maximum for 100% height calculation

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
              <span className="legend-indicator" style={{ backgroundColor: '#2563eb' }} />
              <span>Inbound</span>
            </div>
            <div className="legend-item">
              <span className="legend-indicator" style={{ backgroundColor: '#059669' }} />
              <span>Outbound</span>
            </div>
          </div>

          <div className="timeframe-select-pill">
            <button 
              className={`timeframe-pill-btn ${viewMode === '7d' ? 'active' : ''}`}
              onClick={() => setViewMode('7d')}
            >
              7 Days
            </button>
            <button 
              className={`timeframe-pill-btn ${viewMode === '30d' ? 'active' : ''}`}
              onClick={() => setViewMode('30d')}
            >
              30 Days
            </button>
          </div>
        </div>
      </div>

      <div className="card-body">
        <div className="activity-bars-group">
          {mockActivityData.map((item) => {
            const inboundHeight = Math.round((item.inbound / maxVal) * 170);
            const outboundHeight = Math.round((item.outbound / maxVal) * 170);

            return (
              <div key={item.day} className="activity-day-col">
                <div className="bars-pair">
                  {/* Inbound Bar */}
                  <div 
                    className="bar-pillar inbound" 
                    style={{ height: `${inboundHeight}px` }}
                    aria-label={`${item.day} Inbound: ${item.inbound} units`}
                  >
                    <div className="bar-tooltip">
                      Inbound: +{item.inbound}
                    </div>
                  </div>

                  {/* Outbound Bar */}
                  <div 
                    className="bar-pillar outbound" 
                    style={{ height: `${outboundHeight}px` }}
                    aria-label={`${item.day} Outbound: ${item.outbound} units`}
                  >
                    <div className="bar-tooltip">
                      Outbound: -{item.outbound}
                    </div>
                  </div>
                </div>

                <span className="day-label">{item.day}</span>
              </div>
            );
          })}
        </div>

        {/* Supporting Summary Banner */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: '16px',
          fontSize: '12.5px',
          color: 'var(--text-secondary)'
        }}>
          <div>
            Total Inbound: <strong style={{ color: '#2563eb' }}>935 units</strong>
          </div>
          <div>
            Total Outbound: <strong style={{ color: '#059669' }}>820 units</strong>
          </div>
          <div>
            Net Inventory Gain: <strong style={{ color: 'var(--text-primary)' }}>+115 units</strong>
          </div>
        </div>
      </div>
    </div>
  );
};
