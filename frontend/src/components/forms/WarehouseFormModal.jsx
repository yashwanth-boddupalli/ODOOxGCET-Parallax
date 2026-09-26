import React, { useState } from 'react';
import { MapPin, Warehouse } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Alert, Field } from '../common/FormControls';
import { createLocation, createWarehouse } from '../../api';
import { useWorkspace } from '../../app/useWorkspace';

// mode "warehouse": add a facility (it gets a default "Stock" location automatically).
// mode "location": add a rack / bay / bin inside an existing warehouse.
export const WarehouseFormModal = ({ mode = 'warehouse', warehouse, onClose }) => {
  const { isManager, notify, refresh } = useWorkspace();
  const [form, setForm] = useState({ name: '', code: '', address: '', capacityUnits: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const isLocation = mode === 'location';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (isLocation) {
        await createLocation(warehouse.id, form.name);
        notify(`Location "${form.name.trim()}" added to ${warehouse.name}.`);
      } else {
        await createWarehouse(form);
        notify(`Warehouse "${form.name.trim()}" created.`);
      }
      refresh();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      icon={isLocation ? MapPin : Warehouse}
      title={isLocation ? `Add Location to ${warehouse.name}` : 'Add Warehouse'}
      subtitle={isLocation ? 'A rack, bay, zone or bin that can hold stock.' : 'A default “Stock” location is created for you.'}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" form="warehouse-form" className="btn btn-primary" disabled={busy || !isManager}>
            {busy ? 'Saving…' : isLocation ? 'Add Location' : 'Create Warehouse'}
          </button>
        </>
      }
    >
      <form id="warehouse-form" className="form-grid" onSubmit={handleSubmit}>
        {!isManager && <Alert kind="warning">Only inventory managers can change warehouses.</Alert>}
        <Alert kind="error">{error}</Alert>

        <Field label={isLocation ? 'Location Name' : 'Warehouse Name'} htmlFor="wf-name" required>
          <input id="wf-name" className="form-input" required autoFocus
            placeholder={isLocation ? 'e.g. Rack B2' : 'e.g. East Distribution Center'}
            value={form.name} onChange={set('name')} />
        </Field>

        {!isLocation && (
          <>
            <div className="form-row">
              <Field label="Code" htmlFor="wf-code" required hint="Short unique code">
                <input id="wf-code" className="form-input" required placeholder="e.g. DC-HYD-05"
                  value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
              </Field>
              <Field label="Capacity (units)" htmlFor="wf-capacity" hint="Used for the utilization bar">
                <input id="wf-capacity" className="form-input" type="number" min="1" placeholder="e.g. 5000"
                  value={form.capacityUnits} onChange={set('capacityUnits')} />
              </Field>
            </div>
            <Field label="Address / Area" htmlFor="wf-address">
              <input id="wf-address" className="form-input" placeholder="e.g. Uppal Industrial Area, Hyderabad"
                value={form.address} onChange={set('address')} />
            </Field>
          </>
        )}
      </form>
    </Modal>
  );
};
