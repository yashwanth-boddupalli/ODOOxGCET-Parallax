import React from 'react';
import { Inbox } from 'lucide-react';

export const EmptyState = ({ 
  icon: Icon = Inbox, 
  title = 'No items found', 
  description = 'There are no records matching your current filter criteria.',
  actionText,
  onAction
}) => {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <Icon size={28} />
      </div>
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-desc">{description}</p>
      {actionText && (
        <button className="btn btn-primary btn-sm" onClick={onAction}>
          {actionText}
        </button>
      )}
    </div>
  );
};
