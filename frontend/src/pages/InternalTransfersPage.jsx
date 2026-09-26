import React from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { DataTable } from '../components/common/DataTable';
import { mockOperations } from '../data/mockOperations';
import { Plus } from 'lucide-react';

export const InternalTransfersPage = () => {
  const transfers = mockOperations.filter((op) => op.operation === 'Internal Transfer');

  return (
    <div className="dashboard-container">
      <PageHeader
        title="Internal Transfers"
        description="Reallocate inventory between warehouses, bays, zones, and picking bins."
        actions={
          <button className="btn btn-primary btn-sm">
            <Plus size={15} /> Transfer Stock
          </button>
        }
      />

      <DataTable 
        operations={transfers}
        title="Active Inter-Facility Transfers"
        subtitle="Stock movement requests between facilities and storage zones"
      />
    </div>
  );
};
