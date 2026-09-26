import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getMyProfile } from '../api';
import { AuthContext } from './useAuth';

// Where Supabase email links (confirm sign-up, reset password) send people back to.
const redirectTo = (path) => `${window.location.origin}${path}`;

// Friendlier wording for the errors people actually hit.
function friendly(error) {
  const message = error?.message || 'Something went wrong. Please try again.';
  if (/invalid login credentials/i.test(message)) return 'That email and password don’t match an account.';
  if (/email not confirmed/i.test(message)) return 'Please confirm your email first — check your inbox for the link.';
  if (/rate limit|too many/i.test(message)) return 'Too many attempts. Please wait a minute and try again.';
  if (/token has expired|invalid.*otp|otp.*invalid|expired/i.test(message)) return 'That code is invalid or has expired. Request a new one.';
  if (/password should be at least/i.test(message)) return 'Password must be at least 8 characters.';
  if (/failed to fetch|network/i.test(message)) return 'Can’t reach the server. Check your connection and try again.';
  return message;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recoveryMode, setRecoveryMode] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    // Don't call Supabase inside this callback (it can deadlock); just record state.
    const { data: listener } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true);
      if (event === 'SIGNED_OUT') {
        setProfile(null);
        setRecoveryMode(false);
      }
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user?.id;

  const refreshProfile = useCallback(async () => {
    if (!userId) return null;
    try {
      const next = await getMyProfile(userId);
      setProfile(next);
      return next;
    } catch {
      // The database may not be set up yet; the app shows a notice instead of crashing.
      setProfile(null);
      return null;
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return undefined;
    let alive = true;
    getMyProfile(userId).then(
      (next) => alive && setProfile(next),
      // The database may not be set up yet; the app shows a notice instead of crashing.
      () => alive && setProfile(null),
    );
    return () => {
      alive = false;
    };
  }, [userId]);

  const value = useMemo(() => ({
    session,
    user: session?.user ?? null,
    profile,
    isManager: profile?.role === 'MANAGER',
    loading,
    recoveryMode,
    refreshProfile,

    async signIn(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw new Error(friendly(error));
    },

    // Returns { needsConfirmation } — true when Supabase emails a confirmation link first.
    async signUp({ fullName, email, password }) {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: fullName.trim() }, emailRedirectTo: redirectTo('/dashboard') },
      });
      if (error) throw new Error(friendly(error));
      return { needsConfirmation: !data.session };
    },

    async resendConfirmation(email) {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: { emailRedirectTo: redirectTo('/dashboard') },
      });
      if (error) throw new Error(friendly(error));
    },

    // Sends the reset email (it contains both a one-time code and a link).
    async requestPasswordReset(email) {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: redirectTo('/reset-password'),
      });
      if (error) throw new Error(friendly(error));
    },

    // Exchanges the emailed code for a short recovery session.
    async verifyResetCode(email, code) {
      const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'recovery' });
      if (error) throw new Error(friendly(error));
    },

    async updatePassword(password) {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw new Error(friendly(error));
      setRecoveryMode(false);
    },

    async signOut() {
      await supabase.auth.signOut();
    },
  }), [session, profile, loading, recoveryMode, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
