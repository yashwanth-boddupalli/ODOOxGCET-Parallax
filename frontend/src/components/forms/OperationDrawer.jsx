import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, ClipboardList, Loader2, RefreshCw, XCircle } from 'lucide-react';
import { Drawer } from '../common/Modal';
import { Alert } from '../common/FormControls';
import { OperationBadge, StatusBadge } from '../common/StatusBadge';
import { cancelOperation, checkAvailability, confirmOperation, getOperation, validateOperation } from '../../api';
import { useAsync, useWorkspace } from '../../app/useWorkspace';
import { formatQty, formatSignedQty, toNumber } from '../../lib/format';

const Meta = ({ label, children }) => (
  <div className="meta-item">
    <span className="meta-label">{label}</span>
    <span className="meta-value">{children || '—'}</span>
  </div>
);

export const OperationDrawer = ({ documentId, onClose }) => {
  const { notify, refresh, isManager, settings } = useWorkspace();
  const doc = useAsync(() => getOperation(documentId), [documentId]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [partial, setPartial] = useState(false);
  const [done, setDone] = useState({});
  const [backorder, setBackorder] = useState(true);

  const d = doc.data;
  const isAdjustment = d?.type === 'ADJUSTMENT';

  const run = async (label, action, message) => {
    setError('');
    setBusy(label);
    try {
      const result = await action();
      notify(typeof message === 'function' ? message(result) : message);
      refresh();
      doc.reload();
      setPartial(false);
      setConfirmCancel(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  const handleValidate = () => {
    const lines = partial
      ? d.lines.map((l) => ({ lineId: l.id, doneQuantity: toNumber(done[l.id] ?? l.plannedQuantity) }))
      : null;
    run('validate', () => validateOperation(d.id, lines, backorder), (res) =>
      res?.backorderReference
        ? `${d.reference} validated. Backorder ${res.backorderReference} created for the rest.`
        : `${d.reference} validated — stock and ledger updated.`);
  };

  const negativeAdjustment = isAdjustment && d?.lines.some((l) => l.quantity < 0);
  const needsSignoff = negativeAdjustment && !isManager && settings?.requireManagerSignoffOnNegativeAdjustments;

  const footer = d && !['DONE', 'CANCELLED'].includes(d.state) && (
    <>
      {confirmCancel ? (
        <>
          <span className="muted" style={{ fontSize: 13 }}>Cancel {d.reference}?</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setConfirmCancel(false)} disabled={!!busy}>
            Keep it
          </button>
          <button type="button" className="btn btn-danger btn-sm" disabled={!!busy}
            onClick={() => run('cancel', () => cancelOperation(d.id), `${d.reference} cancelled.`)}>
            {busy === 'cancel' ? 'Cancelling…' : 'Yes, cancel'}
          </button>
        </>
      ) : (
        <button type="button" className="btn btn-danger" onClick={() => setConfirmCancel(true)} disabled={!!busy}>
          <XCircle size={15} /> Cancel
        </button>
      )}
      <span className="spacer" />
      {d.state === 'DRAFT' && (
        <button type="button" className="btn btn-primary" disabled={!!busy}
          onClick={() => run('confirm', () => confirmOperation(d.id), (state) =>
            state === 'WAITING' ? `${d.reference} is waiting for stock.` : `${d.reference} is ready to validate.`)}>
          {busy === 'confirm' ? 'Checking stock…' : 'Mark as Ready'}
        </button>
      )}
      {d.state === 'WAITING' && (
        <button type="button" className="btn btn-secondary" disabled={!!busy}
          onClick={() => run('check', () => checkAvailability(d.id), (state) =>
            state === 'READY' ? `Stock is available — ${d.reference} is ready.` : 'Still not enough stock.')}>
          <RefreshCw size={14} /> {busy === 'check' ? 'Checking…' : 'Check Availability'}
        </button>
      )}
      {d.state === 'READY' && (
        <button type="button" className="btn btn-success" onClick={handleValidate} disabled={!!busy || needsSignoff}>
          <CheckCircle2 size={15} /> {busy === 'validate' ? 'Validating…' : 'Validate'}
        </button>
      )}
    </>
  );

  return (
    <Drawer
      icon={ClipboardList}
      title={d?.reference || 'Loading…'}
      subtitle={d?.operation || ''}
      badge={d && <StatusBadge status={d.status} />}
      onClose={onClose}
      footer={footer}
    >
      {doc.loading && !d && (
        <div className="loading-block"><Loader2 size={16} className="spin" /> Loading document…</div>
      )}
      <Alert kind="error">{error || doc.error?.message}</Alert>

      {d && (
        <div className="form-grid">
          {d.state === 'WAITING' && (
            <Alert kind="warning">Not enough stock at the source yet. Receive more, then use “Check Availability”.</Alert>
          )}
          {d.state === 'DONE' && (
            <Alert kind="success">Completed {d.date}. Stock levels and the ledger were updated in one step.</Alert>
          )}
          {d.state === 'CANCELLED' && <Alert kind="info">This document was cancelled. It never moved any stock.</Alert>}
          {needsSignoff && d.state === 'READY' && (
            <Alert kind="warning">This count reduces stock, so a manager has to validate it (see Settings).</Alert>
          )}

          <div className="route-strip">
            <OperationBadge operation={d.operation} />
            <span className={`route-node ${d.sourceType !== 'INTERNAL' ? 'virtual' : ''}`}>{d.source}</span>
            <ArrowRight size={15} className="muted" />
            <span className={`route-node ${d.destinationType !== 'INTERNAL' ? 'virtual' : ''}`}>{d.destination}</span>
          </div>

          <div className="meta-grid">
            {d.type === 'RECEIPT' && <Meta label="Vendor">{d.partnerName}</Meta>}
            {d.type === 'DELIVERY' && <Meta label="Customer">{d.partnerName}</Meta>}
            {isAdjustment && <Meta label="Reason">{d.reason}</Meta>}
            <Meta label="Responsible">{d.responsible}</Meta>
            <Meta label="Scheduled">{d.scheduledDate}</Meta>
            <Meta label={d.state === 'DONE' ? 'Validated' : 'Created'}>{d.date}</Meta>
            {d.backorderOf && <Meta label="Backorder of">{d.backorderOf}</Meta>}
            {d.notes && <Meta label="Notes">{d.notes}</Meta>}
          </div>

          <div>
            <div className="form-label-row">
              <h4 className="section-heading">Products</h4>
              {d.state === 'READY' && !isAdjustment && (
                <label className="form-check">
                  <input type="checkbox" checked={partial} onChange={(e) => setPartial(e.target.checked)} />
                  Validate partial quantities
                </label>
              )}
            </div>
            <table className="compact-table">
              <thead>
                <tr>
                  <th>Product</th>
                  {isAdjustment ? (
                    <>
                      <th className="num">System</th>
                      <th className="num">Counted</th>
                      <th className="num">Difference</th>
                    </>
                  ) : (
                    <>
                      <th className="num">Planned</th>
                      <th className="num">{partial ? 'Doing now' : 'Done'}</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {d.lines.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <div className="table-product-cell">
                        <span className="table-product-name">{l.product}</span>
                        <span className="table-product-ref">{l.sku}</span>
                      </div>
                    </td>
                    {isAdjustment ? (
                      <>
                        <td className="num">{l.systemQuantity === null ? '—' : formatQty(l.systemQuantity)}</td>
                        <td className="num">{formatQty(l.countedQuantity)} {l.unit}</td>
                        <td className={`num ${l.quantity < 0 ? 'text-rose' : l.quantity > 0 ? 'text-emerald' : ''}`}>
                          <strong>{formatSignedQty(l.quantity)}</strong>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="num">{formatQty(l.plannedQuantity)} {l.unit}</td>
                        <td className="num">
                          {partial ? (
                            <input className="form-input qty-input" type="number" min="0" step="any"
                              value={done[l.id] ?? l.plannedQuantity}
                              onChange={(e) => setDone({ ...done, [l.id]: e.target.value })}
                              aria-label={`Quantity to validate for ${l.product}`} />
                          ) : (
                            formatQty(l.doneQuantity)
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {partial && (
              <label className="form-check" style={{ marginTop: 10 }}>
                <input type="checkbox" checked={backorder} onChange={(e) => setBackorder(e.target.checked)} />
                Create a backorder for anything not done now
              </label>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
};
