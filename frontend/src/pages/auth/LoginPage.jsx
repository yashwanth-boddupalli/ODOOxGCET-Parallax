import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Lock, Mail } from 'lucide-react';
import { AuthLayout } from '../../auth/AuthLayout';
import { useAuth } from '../../auth/useAuth';
import { Alert, Field, IconInput, PasswordInput, SubmitButton } from '../../components/common/FormControls';

export const LoginPage = () => {
  const { signIn, resendConfirmation } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(location.state?.notice || '');

  const unconfirmed = /confirm your email/i.test(error);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    try {
      await signIn(email, password);
      const target = location.state?.from?.pathname || '/dashboard';
      navigate(target, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    try {
      await resendConfirmation(email);
      setError('');
      setNotice(`We sent a new confirmation link to ${email}.`);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <AuthLayout>
      <h1 className="auth-title">Welcome back</h1>
      <p className="auth-subtitle">Sign in to your StockSense workspace.</p>

      <form className="auth-form form-grid" onSubmit={handleSubmit} noValidate>
        <Alert kind="success">{notice}</Alert>
        <Alert kind="error">
          {error}
          {unconfirmed && email && (
            <>
              {' '}
              <button type="button" className="link-button" onClick={handleResend}>
                Resend the link
              </button>
            </>
          )}
        </Alert>

        <Field label="Email" htmlFor="login-email">
          <IconInput
            id="login-email"
            icon={Mail}
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
        </Field>

        <Field
          label="Password"
          htmlFor="login-password"
          aside={
            <Link to="/forgot-password" className="link-button" state={{ email }}>
              Forgot password?
            </Link>
          }
        >
          <PasswordInput
            id="login-password"
            icon={Lock}
            autoComplete="current-password"
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>

        <SubmitButton busy={busy} busyText="Signing in…" disabled={!email || !password}>
          Sign in
        </SubmitButton>
      </form>

      <p className="auth-footer-text">
        New to StockSense? <Link to="/signup">Create an account</Link>
      </p>
    </AuthLayout>
  );
};
