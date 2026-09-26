import React from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { DataTable } from '../components/common/DataTable';
import { mockOperations } from '../data/mockOperations';
import { Download, Filter } from 'lucide-react';

export const StockLedgerPage = () => {
  return (
    <div className="dashboard-container">
      <PageHeader
        title="Stock Ledger"
        description="Immutable chronological audit trail of all inventory events, stock additions, and deductions."
        actions={
          <>
            <button className="btn btn-secondary btn-sm">
              <Filter size={14} /> Filter Range
            </button>
            <button className="btn btn-primary btn-sm">
              <Download size={14} /> Download Ledger
            </button>
          </>
        }
      />

      <DataTable 
        operations={mockOperations}
        title="Chronological Stock Ledger"
        subtitle="Complete sequence of inventory transactions with unit valuations"
      />
    </div>
  );
};
