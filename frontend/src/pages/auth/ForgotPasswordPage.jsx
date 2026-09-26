import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, KeyRound, Lock, Mail } from 'lucide-react';
import { AuthLayout } from '../../auth/AuthLayout';
import { useAuth } from '../../auth/useAuth';
import { Alert, Field, IconInput, PasswordInput, StrengthMeter, SubmitButton } from '../../components/common/FormControls';

const RESEND_SECONDS = 60;

// Two steps: 1) email -> we send a one-time code, 2) code + new password.
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
      setNotice(`If ${email.trim()} has an account, a reset code is on its way.`);
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
          <p className="auth-subtitle">Enter your account email and we’ll send you a one-time code.</p>
          <form className="auth-form form-grid" onSubmit={sendCode} noValidate>
            <Alert kind="error">{error}</Alert>
            <Field label="Email" htmlFor="fp-email">
              <IconInput id="fp-email" icon={Mail} type="email" autoComplete="email" placeholder="you@company.com"
                value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
            </Field>
            <SubmitButton busy={busy} busyText="Sending…" disabled={!email.trim()}>
              Send reset code
            </SubmitButton>
          </form>
        </>
      ) : (
        <>
          <h1 className="auth-title">Enter your code</h1>
          <p className="auth-subtitle">
            Check <strong>{email.trim()}</strong> for the code, then choose a new password. You can also just click
            the link in that email.
          </p>
          <form className="auth-form form-grid" onSubmit={resetPassword} noValidate>
            <Alert kind="info">{!error && notice}</Alert>
            <Alert kind="error">{error}</Alert>
            <Field
              label="Verification code"
              htmlFor="fp-code"
              aside={
                <button type="button" className="link-button" onClick={sendCode} disabled={cooldown > 0 || busy}>
                  {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                </button>
              }
            >
              <IconInput id="fp-code" icon={KeyRound} className="code-input" inputMode="numeric"
                autoComplete="one-time-code" placeholder="••••••" maxLength={8}
                value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoFocus />
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
            <button type="button" className="btn btn-secondary btn-block" onClick={() => { setStep(1); setError(''); }}>
              Use a different email
            </button>
          </form>
        </>
      )}
    </AuthLayout>
  );
};
