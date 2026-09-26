import React from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { DataTable } from '../components/common/DataTable';
import { mockOperations } from '../data/mockOperations';
import { Plus } from 'lucide-react';

export const InventoryAdjustmentsPage = () => {
  const adjustments = mockOperations.filter((op) => op.operation === 'Adjustment');

  return (
    <div className="dashboard-container">
      <PageHeader
        title="Inventory Adjustments"
        description="Record physical cycle counts, write-offs, damaged items, and reconciliation audits."
        actions={
          <button className="btn btn-primary btn-sm">
            <Plus size={15} /> New Adjustment
          </button>
        }
      />

      <DataTable 
        operations={adjustments}
        title="Audit Adjustments Log"
        subtitle="Manual corrections and reconciliations verified by warehouse managers"
      />
    </div>
  );
};
