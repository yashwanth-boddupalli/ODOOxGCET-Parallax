import React from 'react';
import { OperationListPage } from './OperationListPage';

export const InternalTransfersPage = () => (
  <OperationListPage
    type="TRANSFER"
    title="Internal Transfers"
    description="Reallocate inventory between warehouses, bays, zones, and picking bins."
    createLabel="Transfer Stock"
    exportLabel="Export Transfers"
    exportName="stocksense-transfers"
    tableTitle="Active Inter-Facility Transfers"
    tableSubtitle="Stock movement requests between facilities and storage zones"
  />
);
