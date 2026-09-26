import React from 'react';
import { Plus, Download } from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { DataTable } from '../components/common/DataTable';
import { useAsync, useWorkspace } from '../app/useWorkspace';
import { listOperationRows } from '../api';
import { downloadCsv, operationCsvColumns } from '../lib/csv';

// Shared body of the Receipts, Delivery Orders, Internal Transfers and Adjustments pages.
export const OperationListPage = ({ type, title, description, createLabel, exportLabel, exportName, tableTitle, tableSubtitle }) => {
  const { warehouseId, version, openCreateOperation } = useWorkspace();
  const rows = useAsync(() => listOperationRows({ type, warehouseId }), [type, warehouseId, version]);

  return (
    <div className="dashboard-container">
      <PageHeader
        title={title}
        description={description}
        actions={
          <>
            {exportLabel && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => downloadCsv(exportName, rows.data || [], operationCsvColumns)}
                disabled={!rows.data?.length}
              >
                <Download size={14} /> {exportLabel}
              </button>
            )}
            <button className="btn btn-primary btn-sm" onClick={() => openCreateOperation(type)}>
              <Plus size={15} /> {createLabel}
            </button>
          </>
        }
      />

      <DataTable
        operations={rows.data || []}
        loading={rows.loading}
        error={rows.error}
        filterBy="status"
        title={tableTitle}
        subtitle={tableSubtitle}
      />
    </div>
  );
};
