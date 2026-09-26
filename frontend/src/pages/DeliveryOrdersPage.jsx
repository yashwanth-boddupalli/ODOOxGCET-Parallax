import React from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { DataTable } from '../components/common/DataTable';
import { mockOperations } from '../data/mockOperations';
import { Plus, Download } from 'lucide-react';

export const DeliveryOrdersPage = () => {
  const deliveries = mockOperations.filter((op) => op.operation === 'Delivery');

  return (
    <div className="dashboard-container">
      <PageHeader
        title="Delivery Orders"
        description="Manage outbound customer dispatches, packing lists, and shipping carriers."
        actions={
          <>
            <button className="btn btn-secondary btn-sm">
              <Download size={14} /> Export Deliveries
            </button>
            <button className="btn btn-primary btn-sm">
              <Plus size={15} /> New Delivery Order
            </button>
          </>
        }
      />

      <DataTable 
        operations={deliveries}
        title="Outbound Shipments & Dispatches"
        subtitle="Live status of orders prepared, packed, or fulfilled"
      />
    </div>
  );
};
