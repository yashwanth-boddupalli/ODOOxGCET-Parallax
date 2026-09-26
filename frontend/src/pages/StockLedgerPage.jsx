import React, { useState } from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { DataTable } from '../components/common/DataTable';
import { useAsync, useWorkspace } from '../app/useWorkspace';
import { listLedger } from '../api';
import { downloadCsv, operationCsvColumns } from '../lib/csv';
import { Download, Filter, X } from 'lucide-react';

const ledgerCsvColumns = [
  ...operationCsvColumns.filter((c) => c.key !== 'status'),
  { key: 'sourceLocation', label: 'From' },
  { key: 'destinationLocation', label: 'To' },
];

export const StockLedgerPage = () => {
  const { warehouseId, version } = useWorkspace();
  const [showFilter, setShowFilter] = useState(false);
  const [range, setRange] = useState({ from: '', to: '' });
  const ledger = useAsync(() => listLedger({ warehouseId, ...range }), [warehouseId, range.from, range.to, version]);
  const filtered = Boolean(range.from || range.to);

  return (
    <div className="dashboard-container">
      <PageHeader
        title="Stock Ledger"
        description="Immutable chronological audit trail of every completed stock movement. Entries can never be edited or deleted."
        actions={
          <>
            <button className={`btn btn-sm ${filtered ? 'btn-outline-primary' : 'btn-secondary'}`} onClick={() => setShowFilter(!showFilter)}>
              <Filter size={14} /> {filtered ? `${range.from || '…'} → ${range.to || 'today'}` : 'Filter Range'}
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => downloadCsv('stocksense-ledger', ledger.data || [], ledgerCsvColumns)}
              disabled={!ledger.data?.length}
            >
              <Download size={14} /> Download Ledger
            </button>
          </>
        }
      />

      {showFilter && (
        <div className="content-card">
          <div className="date-filter">
            <div className="form-field">
              <label className="form-label" htmlFor="ledger-from">From</label>
              <input id="ledger-from" type="date" className="form-input" value={range.from}
                max={range.to || undefined} onChange={(e) => setRange({ ...range, from: e.target.value })} />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="ledger-to">To</label>
              <input id="ledger-to" type="date" className="form-input" value={range.to}
                min={range.from || undefined} onChange={(e) => setRange({ ...range, to: e.target.value })} />
            </div>
            {filtered && (
              <button className="btn btn-secondary" onClick={() => setRange({ from: '', to: '' })}>
                <X size={14} /> Clear
              </button>
            )}
          </div>
        </div>
      )}

      <DataTable
        operations={ledger.data || []}
        loading={ledger.loading}
        error={ledger.error}
        title="Chronological Stock Ledger"
        subtitle="Every unit in and out, with who did it and where it went"
      />
    </div>
  );
};
