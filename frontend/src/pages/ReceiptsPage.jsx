import React from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { DataTable } from '../components/common/DataTable';
import { mockOperations } from '../data/mockOperations';
import { Plus, Download } from 'lucide-react';

export const ReceiptsPage = () => {
  const receipts = mockOperations.filter((op) => op.operation === 'Receipt');

  return (
    <div className="dashboard-container">
      <PageHeader
        title="Inbound Receipts"
        description="Receive incoming shipments from vendors and suppliers into warehouse locations."
        actions={
          <>
            <button className="btn btn-secondary btn-sm">
              <Download size={14} /> Export Receipts
            </button>
            <button className="btn btn-primary btn-sm">
              <Plus size={15} /> Create Receipt
            </button>
          </>
        }
      />

      <DataTable 
        operations={receipts}
        title="Pending & Processed Receipts"
        subtitle="Inbound shipments awaiting inspection or already added to stock"
      />
    </div>
  );
};
