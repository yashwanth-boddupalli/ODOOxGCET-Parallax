import React from 'react';
import { OperationListPage } from './OperationListPage';

export const ReceiptsPage = () => (
  <OperationListPage
    type="RECEIPT"
    title="Inbound Receipts"
    description="Receive incoming shipments from vendors and suppliers into warehouse locations."
    createLabel="Create Receipt"
    exportLabel="Export Receipts"
    exportName="stocksense-receipts"
    tableTitle="Pending & Processed Receipts"
    tableSubtitle="Inbound shipments awaiting inspection or already added to stock"
  />
);
