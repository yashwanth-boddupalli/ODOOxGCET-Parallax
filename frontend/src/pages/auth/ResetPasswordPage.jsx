import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, ShieldAlert } from 'lucide-react';
import { AuthLayout } from '../../auth/AuthLayout';
import { PageLoader } from '../../auth/guards';
import { useAuth } from '../../auth/useAuth';
import { Alert, Field, PasswordInput, StrengthMeter, SubmitButton } from '../../components/common/FormControls';

// Landing page for the "Reset password" link in the email. Supabase signs the
// user in with a short recovery session; here they pick a new password.
export const ResetPasswordPage = () => {
  const { session, loading, updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (loading) return <PageLoader label="Checking your reset link…" />;

  if (!session) {
    return (
      <AuthLayout>
        <div className="auth-state-icon warning">
          <ShieldAlert size={26} />
        </div>
        <h1 className="auth-title">This link has expired</h1>
        <p className="auth-subtitle">Reset links work once and only for a short time. Request a new code instead.</p>
        <div className="auth-form form-grid">
          <Link to="/forgot-password" className="btn btn-primary btn-block">Get a new code</Link>
          <Link to="/login" className="btn btn-secondary btn-block">Back to sign in</Link>
        </div>
      </AuthLayout>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 8) return setError('Use at least 8 characters.');
    if (password !== confirm) return setError('The two passwords don’t match.');
    setError('');
    setBusy(true);
    try {
      await updatePassword(password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout>
      <h1 className="auth-title">Choose a new password</h1>
      <p className="auth-subtitle">For {session.user.email}. You’ll stay signed in afterwards.</p>
      <form className="auth-form form-grid" onSubmit={handleSubmit} noValidate>
        <Alert kind="error">{error}</Alert>
        <Field label="New password" htmlFor="rp-password">
          <PasswordInput id="rp-password" icon={Lock} autoComplete="new-password" placeholder="Create a new password"
            value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
          <StrengthMeter password={password} />
        </Field>
        <Field label="Confirm new password" htmlFor="rp-confirm">
          <PasswordInput id="rp-confirm" icon={Lock} autoComplete="new-password" placeholder="Type it again"
            value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        <SubmitButton busy={busy} busyText="Saving…" disabled={!password}>Save password</SubmitButton>
      </form>
    </AuthLayout>
  );
};
