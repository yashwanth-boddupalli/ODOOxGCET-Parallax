import React from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { mockWarehouses } from '../data/mockProducts';
import { Warehouse, Plus, MapPin, Users, Package } from 'lucide-react';

export const WarehousesPage = () => {
  return (
    <div className="dashboard-container">
      <PageHeader
        title="Warehouses & Facilities"
        description="Physical facility topology, capacity utilization, and facility management."
        actions={
          <button className="btn btn-primary btn-sm">
            <Plus size={15} /> Add Warehouse
          </button>
        }
      />

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: '20px'
      }}>
        {mockWarehouses.map((wh) => (
          <div key={wh.id} className="content-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--primary-light)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Warehouse size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>{wh.name}</h3>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{wh.code}</span>
                </div>
              </div>

              <span style={{
                fontSize: '12px',
                fontWeight: 700,
                color: parseInt(wh.capacity) > 85 ? 'var(--amber)' : 'var(--emerald)',
                backgroundColor: parseInt(wh.capacity) > 85 ? 'var(--amber-light)' : 'var(--emerald-light)',
                padding: '3px 8px',
                borderRadius: 'var(--radius-full)'
              }}>
                {wh.capacity} Capacity
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              <MapPin size={14} className="text-muted" />
              <span>{wh.location}</span>
            </div>

            {/* Capacity Progress Bar */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', marginBottom: '4px', color: 'var(--text-muted)' }}>
                <span>Storage Utilization</span>
                <span><strong>{wh.capacity}</strong></span>
              </div>
              <div style={{ width: '100%', height: '6px', backgroundColor: '#e2e8f0', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                <div style={{
                  width: wh.capacity,
                  height: '100%',
                  backgroundColor: parseInt(wh.capacity) > 85 ? 'var(--amber)' : 'var(--primary)',
                  borderRadius: 'var(--radius-full)'
                }} />
              </div>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: '12px',
              borderTop: '1px solid var(--border-subtle)',
              fontSize: '12.5px'
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                <Package size={14} className="text-muted" />
                <strong>{wh.totalItems.toLocaleString()}</strong> items
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                <Users size={14} className="text-muted" />
                <strong>{wh.activeManagers}</strong> staff
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
