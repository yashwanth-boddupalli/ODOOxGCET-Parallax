import React, { useEffect } from 'react';
import { X } from 'lucide-react';

function useEscape(onClose) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
}

const Header = ({ icon: Icon, title, subtitle, onClose, children }) => (
  <div className="modal-header">
    <div className="modal-title-group">
      {Icon && (
        <div className="modal-icon">
          <Icon size={18} />
        </div>
      )}
      <div style={{ minWidth: 0 }}>
        <h3 className="modal-title">{title}</h3>
        {subtitle && <div className="modal-subtitle">{subtitle}</div>}
      </div>
      {children}
    </div>
    <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
      <X size={18} />
    </button>
  </div>
);

// Centered dialog. Clicking the backdrop closes it (unless busy).
export const Modal = ({ icon, title, subtitle, onClose, footer, size = 'md', children, busy = false }) => {
  const close = busy ? undefined : onClose;
  useEscape(close);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close?.()}>
      <div className={`modal-panel size-${size}`} role="dialog" aria-modal="true" aria-label={title}>
        <Header icon={icon} title={title} subtitle={subtitle} onClose={close} />
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
};

// Right-hand panel for document details.
export const Drawer = ({ icon, title, subtitle, badge, onClose, footer, children }) => {
  useEscape(onClose);
  return (
    <>
      <div className="drawer-backdrop" onMouseDown={onClose} />
      <aside className="drawer-panel" role="dialog" aria-modal="true" aria-label={title}>
        <Header icon={icon} title={title} subtitle={subtitle} onClose={onClose}>
          {badge}
        </Header>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </aside>
    </>
  );
};
