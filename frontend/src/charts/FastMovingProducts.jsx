import React from 'react';
import { mockFastMovingProducts } from '../data/mockCharts';
import { Flame } from 'lucide-react';

export const FastMovingProducts = () => {
  return (
    <div className="content-card">
      <div className="card-header">
        <div className="card-title-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 className="card-title">Fast Moving Products</h2>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: '#fef3c7',
              color: '#b45309',
              fontSize: '11px',
              fontWeight: 700
            }}>
              <Flame size={12} fill="#b45309" />
              High Velocity
            </span>
          </div>
          <span className="card-subtitle">Highest inventory dispatch velocity over past 30 days</span>
        </div>
      </div>

      <div className="card-body">
        <div className="fast-moving-list">
          {mockFastMovingProducts.map((prod, index) => (
            <div key={prod.id} className="fast-product-card">
              <div className="fast-product-left">
                <span className={`product-rank ${index < 3 ? `top-${index + 1}` : ''}`}>
                  {index + 1}
                </span>

                <div className="product-details">
                  <span className="product-title">{prod.name}</span>
                  <div className="product-sub-meta">
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{prod.sku}</span>
                    <span>•</span>
                    <span>In Stock: <strong>{prod.stockLevel}</strong></span>
                  </div>
                </div>
              </div>

              <div className="fast-product-right">
                <div className="velocity-bar-group">
                  <div className="velocity-track">
                    <div 
                      className="velocity-fill" 
                      style={{ width: prod.velocity }}
                    />
                  </div>
                  <span className="velocity-label">
                    {prod.velocity} velocity ({prod.unitsMoved} units)
                  </span>
                </div>

                <span className="product-turnover-tag">
                  {prod.trend}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
