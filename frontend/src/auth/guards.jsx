import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Boxes } from 'lucide-react';
import { useAuth } from './useAuth';

export function PageLoader({ label = 'Loading your workspace…' }) {
  return (
    <div className="page-loader" role="status">
      <div className="brand-icon">
        <Boxes size={22} strokeWidth={2.3} />
      </div>
      <span>{label}</span>
    </div>
  );
}

// App pages: signed-in users only. Remembers where they were headed.
export function RequireAuth() {
  const { session, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader />;
  if (!session) return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}

// Login / sign-up pages: bounce signed-in users to the app.
export function PublicOnly() {
  const { session, loading, recoveryMode } = useAuth();
  if (loading) return <PageLoader />;
  if (session && !recoveryMode) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
