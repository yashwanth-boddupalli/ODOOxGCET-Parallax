import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Info, Loader2, TriangleAlert } from 'lucide-react';

export const Field = ({ label, htmlFor, required, hint, error, aside, children }) => (
  <div className="form-field">
    {(label || aside) && (
      <div className="form-label-row">
        {label && (
          <label className="form-label" htmlFor={htmlFor}>
            {label}
            {required && <span className="required">*</span>}
          </label>
        )}
        {aside}
      </div>
    )}
    {children}
    {error ? <span className="form-error-text">{error}</span> : hint && <span className="form-hint">{hint}</span>}
  </div>
);

export const IconInput = ({ icon: Icon, className = '', ...props }) => (
  <div className="input-wrap">
    {Icon && <Icon size={16} className="input-icon" aria-hidden="true" />}
    <input className={`form-input ${Icon ? 'with-icon' : ''} ${className}`} {...props} />
  </div>
);

export const PasswordInput = ({ icon: Icon, ...props }) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className="input-wrap">
      {Icon && <Icon size={16} className="input-icon" aria-hidden="true" />}
      <input
        className={`form-input with-action ${Icon ? 'with-icon' : ''}`}
        type={visible ? 'text' : 'password'}
        {...props}
      />
      <button
        type="button"
        className="input-action"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        title={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
};

const alertIcons = { error: AlertCircle, success: CheckCircle2, info: Info, warning: TriangleAlert };

export const Alert = ({ kind = 'info', children }) => {
  // Hide when there's nothing to say (e.g. an empty error string plus a false condition).
  const hasContent = React.Children.toArray(children).some((c) => c !== '' && c !== false && c !== null);
  if (!hasContent) return null;
  const Icon = alertIcons[kind];
  return (
    <div className={`form-alert ${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <Icon size={16} />
      <div>{children}</div>
    </div>
  );
};

export const SubmitButton = ({ busy, children, busyText, className = 'btn btn-primary btn-block', ...props }) => (
  <button type="submit" className={className} disabled={busy || props.disabled} {...props}>
    {busy && <Loader2 size={16} className="spin" />}
    <span>{busy ? busyText || children : children}</span>
  </button>
);

// 0-3: length, mixed case, and a digit or symbol.
const passwordStrength = (password) => {
  if (!password) return 0;
  let score = password.length >= 8 ? 1 : 0;
  if (score && /[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (score && /[\d\W_]/.test(password)) score += 1;
  return score;
};

const strengthLabels = ['Too short', 'Weak', 'Good', 'Strong'];

export const StrengthMeter = ({ password }) => {
  const level = passwordStrength(password);
  if (!password) return <span className="form-hint">At least 8 characters.</span>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div className={`strength-meter level-${level}`} aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <span className="form-hint">Password strength: {strengthLabels[level]}</span>
    </div>
  );
};
