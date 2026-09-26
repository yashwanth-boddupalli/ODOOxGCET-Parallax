import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Mail, MailCheck, User } from 'lucide-react';
import { AuthLayout } from '../../auth/AuthLayout';
import { useAuth } from '../../auth/useAuth';
import { Alert, Field, IconInput, PasswordInput, StrengthMeter, SubmitButton } from '../../components/common/FormControls';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const SignupPage = () => {
  const { signUp, resendConfirmation } = useAuth();
  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirm: '' });
  const [touched, setTouched] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [resent, setResent] = useState(false);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const blur = (key) => () => setTouched({ ...touched, [key]: true });

  const errors = {
    fullName: !form.fullName.trim() ? 'Enter your name' : '',
    email: !EMAIL_PATTERN.test(form.email.trim()) ? 'Enter a valid email address' : '',
    password: form.password.length < 8 ? 'Use at least 8 characters' : '',
    confirm: form.confirm !== form.password ? 'Passwords don’t match' : '',
  };
  const valid = Object.values(errors).every((v) => !v);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({ fullName: true, email: true, password: true, confirm: true });
    if (!valid) return;
    setError('');
    setBusy(true);
    try {
      const { needsConfirmation } = await signUp(form);
      // With confirmation off, Supabase signs the user straight in and the router moves on.
      if (needsConfirmation) setSentTo(form.email.trim());
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    try {
      await resendConfirmation(sentTo);
      setResent(true);
    } catch (err) {
      setError(err.message);
    }
  };

  if (sentTo) {
    return (
      <AuthLayout>
        <div className="auth-state-icon success">
          <MailCheck size={26} />
        </div>
        <h1 className="auth-title">Check your inbox</h1>
        <p className="auth-subtitle">
          We sent a confirmation link to <strong>{sentTo}</strong>. Open it to activate your account, then sign in.
        </p>
        <div className="auth-form form-grid">
          <Alert kind="success">{resent && 'A fresh link is on its way.'}</Alert>
          <Alert kind="error">{error}</Alert>
          <Link to="/login" className="btn btn-primary btn-block">Back to sign in</Link>
          <button type="button" className="btn btn-secondary btn-block" onClick={handleResend} disabled={resent}>
            Didn’t get it? Resend email
          </button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h1 className="auth-title">Create your account</h1>
      <p className="auth-subtitle">The first person to sign up becomes the workspace manager.</p>

      <form className="auth-form form-grid" onSubmit={handleSubmit} noValidate>
        <Alert kind="error">{error}</Alert>

        <Field label="Full name" htmlFor="su-name" error={touched.fullName && errors.fullName}>
          <IconInput id="su-name" icon={User} autoComplete="name" placeholder="Priya Sharma"
            value={form.fullName} onChange={set('fullName')} onBlur={blur('fullName')} autoFocus />
        </Field>

        <Field label="Work email" htmlFor="su-email" error={touched.email && errors.email}>
          <IconInput id="su-email" icon={Mail} type="email" autoComplete="email" placeholder="you@company.com"
            value={form.email} onChange={set('email')} onBlur={blur('email')} />
        </Field>

        <Field label="Password" htmlFor="su-password" error={touched.password && form.password && errors.password}>
          <PasswordInput id="su-password" icon={Lock} autoComplete="new-password" placeholder="Create a password"
            value={form.password} onChange={set('password')} onBlur={blur('password')} />
          <StrengthMeter password={form.password} />
        </Field>

        <Field label="Confirm password" htmlFor="su-confirm" error={touched.confirm && errors.confirm}>
          <PasswordInput id="su-confirm" icon={Lock} autoComplete="new-password" placeholder="Type it again"
            value={form.confirm} onChange={set('confirm')} onBlur={blur('confirm')} />
        </Field>

        <SubmitButton busy={busy} busyText="Creating account…">Create account</SubmitButton>
      </form>

      <p className="auth-footer-text">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </AuthLayout>
  );
};
