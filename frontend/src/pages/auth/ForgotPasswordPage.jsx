import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, KeyRound, Lock, Mail, MailCheck } from 'lucide-react';
import { AuthLayout } from '../../auth/AuthLayout';
import { useAuth } from '../../auth/useAuth';
import { Alert, Field, IconInput, PasswordInput, StrengthMeter, SubmitButton } from '../../components/common/FormControls';

const RESEND_SECONDS = 60;

// Two steps: 1) email -> Supabase sends a reset email, 2) the person clicks the link in it
// (lands on /reset-password). If the email template also shows a code, it can be typed here instead.
export const ForgotPasswordPage = () => {
  const { requestPasswordReset, verifyResetCode, updatePassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState(location.state?.email || '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [showCode, setShowCode] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const sendCode = async (e) => {
    e?.preventDefault();
    setError('');
    setBusy(true);
    try {
      await requestPasswordReset(email);
      setStep(2);
      setCooldown(RESEND_SECONDS);
      // Same message whether or not the account exists, so emails can't be probed.
      setNotice(`If ${email.trim()} has an account, a reset email is on its way.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async (e) => {
    e.preventDefault();
    if (password.length < 8) return setError('Use at least 8 characters for the new password.');
    if (password !== confirm) return setError('The two passwords don’t match.');
    setError('');
    setBusy(true);
    try {
      await verifyResetCode(email, code);
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
      <Link to="/login" className="auth-back">
        <ArrowLeft size={15} /> Back to sign in
      </Link>

      <div className="auth-steps" aria-hidden="true">
        <span className="done" />
        <span className={step === 2 ? 'done' : ''} />
      </div>

      {step === 1 ? (
        <>
          <h1 className="auth-title">Reset your password</h1>
          <p className="auth-subtitle">Enter your account email and we’ll send you a link to choose a new password.</p>
          <form className="auth-form form-grid" onSubmit={sendCode} noValidate>
            <Alert kind="error">{error}</Alert>
            <Field label="Email" htmlFor="fp-email">
              <IconInput id="fp-email" icon={Mail} type="email" autoComplete="email" placeholder="you@company.com"
                value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
            </Field>
            <SubmitButton busy={busy} busyText="Sending…" disabled={!email.trim()}>
              Send reset link
            </SubmitButton>
          </form>
        </>
      ) : (
        <>
          <div className="auth-state-icon info">
            <MailCheck size={26} />
          </div>
          <h1 className="auth-title">Check your email</h1>
          <p className="auth-subtitle">
            {notice || `We sent a reset link to ${email.trim()}.`} Open the link in this browser to choose a new
            password. It works once and expires after a while.
          </p>

          <div className="auth-form form-grid">
            <Alert kind="error">{!showCode && error}</Alert>
            <button type="button" className="btn btn-secondary btn-block" onClick={sendCode} disabled={cooldown > 0 || busy}>
              {cooldown > 0 ? `Didn’t get it? Resend in ${cooldown}s` : 'Didn’t get it? Resend email'}
            </button>
            <button type="button" className="btn btn-secondary btn-block" onClick={() => { setStep(1); setError(''); setShowCode(false); }}>
              Use a different email
            </button>
            {!showCode && (
              <button type="button" className="link-button" style={{ alignSelf: 'center' }} onClick={() => setShowCode(true)}>
                Got a 6-digit code instead?
              </button>
            )}
          </div>

          {showCode && (
            <form className="auth-form form-grid" onSubmit={resetPassword} noValidate>
              <Alert kind="error">{error}</Alert>
              <Field label="Verification code" htmlFor="fp-code">
                <IconInput id="fp-code" icon={KeyRound} className="code-input" inputMode="numeric"
                  autoComplete="one-time-code" placeholder="••••••" maxLength={8}
                  value={code} onChange={(e) => setCode(e.target.value.replace(/D/g, ''))} autoFocus />
              </Field>
              <Field label="New password" htmlFor="fp-password">
                <PasswordInput id="fp-password" icon={Lock} autoComplete="new-password" placeholder="Create a new password"
                  value={password} onChange={(e) => setPassword(e.target.value)} />
                <StrengthMeter password={password} />
              </Field>
              <Field label="Confirm new password" htmlFor="fp-confirm">
                <PasswordInput id="fp-confirm" icon={Lock} autoComplete="new-password" placeholder="Type it again"
                  value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </Field>
              <SubmitButton busy={busy} busyText="Updating…" disabled={code.length < 6 || !password}>
                Update password
              </SubmitButton>
            </form>
          )}
        </>
      )}
    </AuthLayout>
  );
};
