import React from 'react';
import { OperationListPage } from './OperationListPage';

export const DeliveryOrdersPage = () => (
  <OperationListPage
    type="DELIVERY"
    title="Delivery Orders"
    description="Manage outbound customer dispatches. Stock leaves the warehouse when an order is validated."
    createLabel="New Delivery Order"
    exportLabel="Export Deliveries"
    exportName="stocksense-deliveries"
    tableTitle="Outbound Shipments & Dispatches"
    tableSubtitle="Live status of orders prepared, packed, or fulfilled"
  />
);
