import React from 'react';
import { OperationListPage } from './OperationListPage';

export const InventoryAdjustmentsPage = () => (
  <OperationListPage
    type="ADJUSTMENT"
    title="Inventory Adjustments"
    description="Record physical cycle counts, write-offs, damaged items, and reconciliation audits."
    createLabel="New Adjustment"
    exportLabel="Export Adjustments"
    exportName="stocksense-adjustments"
    tableTitle="Audit Adjustments Log"
    tableSubtitle="Counted quantity vs system quantity; the difference is posted to the ledger"
  />
);
