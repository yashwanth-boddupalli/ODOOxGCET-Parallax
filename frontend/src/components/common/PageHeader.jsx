import React from 'react';

export const PageHeader = ({ title, description, actions, children }) => {
  return (
    <header className="page-header">
      <div className="page-title-group">
        <h1 className="page-title">{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {(actions || children) && (
        <div className="page-actions-group">
          {actions}
          {children}
        </div>
      )}
    </header>
  );
};
