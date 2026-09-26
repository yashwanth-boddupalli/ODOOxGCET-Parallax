import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../components/common/PageHeader';
import { Alert, Field } from '../components/common/FormControls';
import { useAsync, useWorkspace } from '../app/useWorkspace';
import { useAuth } from '../auth/useAuth';
import { listProfiles, setUserAccess, updateMyProfile, updateSettings } from '../api';
import { initialsOf } from '../lib/format';
import { Save, CheckCircle, Loader2 } from 'lucide-react';

const TABS = [
  { id: 'general', label: 'General Configuration' },
  { id: 'notifications', label: 'Alerts & Reorders' },
  { id: 'facilities', label: 'Facility Defaults' },
  { id: 'team', label: 'Team & Access' },
  { id: 'profile', label: 'My Profile' },
];

const TIME_ZONES = ['Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Europe/London', 'America/New_York', 'UTC'];

// Workspace-wide settings. Remounted with fresh values whenever they change.
const WorkspaceSettingsForm = ({ tab, settings }) => {
  const { warehouses, isManager, refresh, notify } = useWorkspace();
  const [form, setForm] = useState({
    workspaceName: settings.workspaceName,
    timeZone: settings.timeZone,
    reorderMultiplier: String(settings.reorderMultiplier),
    requireManagerSignoffOnNegativeAdjustments: settings.requireManagerSignoffOnNegativeAdjustments,
    stockTargetUnits: settings.stockTargetUnits === '' ? '' : String(settings.stockTargetUnits),
    defaultWarehouseId: settings.defaultWarehouseId ? String(settings.defaultWarehouseId) : '',
  });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await updateSettings({
        workspaceName: form.workspaceName,
        timeZone: form.timeZone,
        reorderMultiplier: Number(form.reorderMultiplier),
        requireManagerSignoffOnNegativeAdjustments: form.requireManagerSignoffOnNegativeAdjustments,
        stockTargetUnits: form.stockTargetUnits,
        defaultWarehouseId: form.defaultWarehouseId ? Number(form.defaultWarehouseId) : null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      notify('Settings saved.');
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="form-grid" style={{ maxWidth: '640px' }}>
      {!isManager && <Alert kind="info">Only inventory managers can change workspace settings. You can view them here.</Alert>}
      <Alert kind="error">{error}</Alert>

      {tab === 'general' && (
        <>
          <Field label="Application Workspace Name" htmlFor="st-name">
            <input id="st-name" className="form-input" value={form.workspaceName} onChange={set('workspaceName')} disabled={!isManager} />
          </Field>
          <Field label="Time Zone" htmlFor="st-tz" hint="Dates in tables and charts use this time zone">
            <select id="st-tz" className="form-select" value={form.timeZone} onChange={set('timeZone')} disabled={!isManager}>
              {[...new Set([form.timeZone, ...TIME_ZONES])].map((tz) => <option key={tz}>{tz}</option>)}
            </select>
          </Field>
          <div>
            <span className="form-label">Audit Logging & Stock Ledger Strategy</span>
            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
              All transactions (Receipts, Deliveries, Transfers, Adjustments) are appended immutably to the Stock Ledger.
              The database refuses edits and deletes on ledger entries.
            </p>
          </div>
        </>
      )}

      {tab === 'notifications' && (
        <>
          <div className="form-row">
            <Field label="Default Reorder Buffer Multiplier" htmlFor="st-mult" hint="Reorders refill stock to this many times the minimum">
              <select id="st-mult" className="form-select" value={form.reorderMultiplier} onChange={set('reorderMultiplier')} disabled={!isManager}>
                <option value="2">2x Min Stock</option>
                <option value="3">3x Min Stock (Recommended)</option>
                <option value="5">5x Min Stock</option>
              </select>
            </Field>
            <Field label="Target Stock Buffer (units)" htmlFor="st-target" hint="The target line on the Stock Movement chart">
              <input id="st-target" className="form-input" type="number" min="1" placeholder="Not set"
                value={form.stockTargetUnits} onChange={set('stockTargetUnits')} disabled={!isManager} />
            </Field>
          </div>
          <label className="form-check">
            <input
              type="checkbox"
              checked={form.requireManagerSignoffOnNegativeAdjustments}
              onChange={(e) => setForm({ ...form, requireManagerSignoffOnNegativeAdjustments: e.target.checked })}
              disabled={!isManager}
            />
            <span>
              <strong>Require manager sign-off on negative adjustments</strong>
              <br />
              <span className="muted">Staff can record counts, but only a manager can validate one that reduces stock.</span>
            </span>
          </label>
        </>
      )}

      {tab === 'facilities' && (
        <Field label="Default Primary Facility" htmlFor="st-wh" hint="Used for new products, reorders and new team members">
          <select id="st-wh" className="form-select" value={form.defaultWarehouseId} onChange={set('defaultWarehouseId')} disabled={!isManager}>
            <option value="">No default</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </Field>
      )}

      {isManager && (
        <div style={{ paddingTop: '12px', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? <Loader2 size={15} className="spin" /> : <Save size={15} />} Save Changes
          </button>
          {saved && (
            <span style={{ fontSize: '13px', color: 'var(--emerald)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle size={15} /> Preferences saved
            </span>
          )}
        </div>
      )}
    </form>
  );
};

const TeamTab = () => {
  const { isManager, notify, version, refresh } = useWorkspace();
  const { user, refreshProfile } = useAuth();
  const people = useAsync(listProfiles, [version]);
  const [error, setError] = useState('');

  const change = async (person, patch) => {
    setError('');
    try {
      await setUserAccess(person.id, patch);
      notify(`${person.fullName || person.email} updated.`);
      refresh();
      if (person.id === user.id) refreshProfile();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="form-grid">
      <Alert kind="info">
        New people join by signing up. The first account became the manager; everyone after starts as staff.
        Staff can create and validate operations; managers also manage products, warehouses, settings and the team.
      </Alert>
      <Alert kind="error">{error || people.error?.message}</Alert>
      <table className="compact-table">
        <thead>
          <tr>
            <th>Person</th>
            <th>Role</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {(people.data || []).map((p) => (
            <tr key={p.id}>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="header-avatar">{initialsOf(p.fullName || p.email)}</div>
                  <div className="table-product-cell">
                    <span className="table-product-name">{p.fullName || '—'}{p.id === user.id && ' (you)'}</span>
                    <span className="table-product-ref">{p.email}</span>
                  </div>
                </div>
              </td>
              <td>
                {isManager ? (
                  <select className="form-select" style={{ width: 130 }} value={p.role} aria-label={`Role for ${p.fullName}`}
                    onChange={(e) => change(p, { role: e.target.value })}>
                    <option value="MANAGER">Manager</option>
                    <option value="STAFF">Staff</option>
                  </select>
                ) : (
                  <span className={`role-pill ${p.role === 'STAFF' ? 'staff' : ''}`}>{p.role === 'MANAGER' ? 'Manager' : 'Staff'}</span>
                )}
              </td>
              <td>
                {isManager && p.id !== user.id ? (
                  <label className="form-check">
                    <input type="checkbox" checked={p.active} onChange={(e) => change(p, { active: e.target.checked })} />
                    Active
                  </label>
                ) : (
                  <span className={p.active ? 'text-emerald' : 'text-rose'}>{p.active ? 'Active' : 'Deactivated'}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const ProfileTab = () => {
  const { user, profile, refreshProfile } = useAuth();
  const { warehouses, notify, refresh } = useWorkspace();
  const [form, setForm] = useState({
    fullName: profile?.fullName || '',
    jobTitle: profile?.jobTitle || '',
    defaultWarehouseId: profile?.defaultWarehouseId ? String(profile.defaultWarehouseId) : '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await updateMyProfile(user.id, { ...form, defaultWarehouseId: form.defaultWarehouseId ? Number(form.defaultWarehouseId) : null });
      await refreshProfile();
      refresh();
      notify('Profile updated.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="form-grid" style={{ maxWidth: '640px' }}>
      <Alert kind="error">{error}</Alert>
      <div className="form-row">
        <Field label="Full Name" htmlFor="pr-name" required>
          <input id="pr-name" className="form-input" required value={form.fullName} onChange={set('fullName')} />
        </Field>
        <Field label="Job Title" htmlFor="pr-title">
          <input id="pr-title" className="form-input" placeholder="e.g. Operations Lead" value={form.jobTitle} onChange={set('jobTitle')} />
        </Field>
      </div>
      <div className="form-row">
        <Field label="Email" htmlFor="pr-email" hint="Used to sign in">
          <input id="pr-email" className="form-input" value={user?.email || ''} disabled />
        </Field>
        <Field label="Home Warehouse" htmlFor="pr-wh" hint="Counts you as staff on that warehouse’s card">
          <select id="pr-wh" className="form-select" value={form.defaultWarehouseId} onChange={set('defaultWarehouseId')}>
            <option value="">None</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </Field>
      </div>
      <div style={{ paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? <Loader2 size={15} className="spin" /> : <Save size={15} />} Save Profile
        </button>
      </div>
    </form>
  );
};

export const SettingsPage = () => {
  const { settings } = useWorkspace();
  const { profile } = useAuth();
  const [params, setParams] = useSearchParams();
  const activeTab = TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'general';
  const workspaceTab = ['general', 'notifications', 'facilities'].includes(activeTab);

  return (
    <div className="dashboard-container">
      <PageHeader
        title="System Settings"
        description="Configure workspace defaults, automated replenishment thresholds, and who can do what."
      />

      <div className="content-card">
        <div className="card-header">
          <div className="filter-pills-group" role="tablist" style={{ flexWrap: 'wrap' }}>
            {TABS.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                className={`filter-pill ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setParams({ tab: tab.id }, { replace: true })}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="card-body">
          {workspaceTab && !settings && (
            <div className="loading-block"><Loader2 size={16} className="spin" /> Loading settings…</div>
          )}
          {workspaceTab && settings && (
            <WorkspaceSettingsForm key={`${activeTab}-${JSON.stringify(settings)}`} tab={activeTab} settings={settings} />
          )}
          {activeTab === 'team' && <TeamTab />}
          {activeTab === 'profile' && <ProfileTab key={profile ? `${profile.id}-${profile.fullName}` : 'loading'} />}
        </div>
      </div>
    </div>
  );
};
