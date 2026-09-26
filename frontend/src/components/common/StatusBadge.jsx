import React from 'react';

/**
 * StatusBadge Component for operations, orders and inventory statuses
 * @param {'Completed' | 'Pending' | 'In Progress' | 'Cancelled' | 'In Stock' | 'Low Stock'} status
 */
export const StatusBadge = ({ status }) => {
  const normalized = status ? status.toLowerCase().replace(/\s+/g, '-') : 'pending';

  return (
    <span className={`status-badge ${normalized}`} role="status">
      <span className="badge-dot" aria-hidden="true" />
      <span>{status}</span>
    </span>
  );
};

export const OperationBadge = ({ operation }) => {
  const normalized = operation ? operation.toLowerCase().replace(/\s+/g, '-') : 'receipt';
  
  return (
    <span className={`operation-badge ${normalized}`}>
      {operation}
    </span>
  );
};
