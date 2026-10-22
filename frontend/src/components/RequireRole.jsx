import React, { useEffect } from 'react';
import { LoaderCircle, ShieldAlert } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

export default function RequireRole({
  roles = ['INSPECTOR', 'QA_OFFICER'],
  onUnauthenticated,
  children,
}) {
  const { user, role, loading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      onUnauthenticated?.();
    }
  }, [loading, isAuthenticated, onUnauthenticated]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf8f2] flex flex-col items-center justify-center p-6 text-stone-600 gap-3">
        <LoaderCircle className="h-7 w-7 animate-spin text-emerald-800" />
        <p className="text-sm font-semibold">Verifying staff credentials with DairyTrace security server…</p>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  if (roles.length > 0 && !roles.includes(role)) {
    return (
      <div className="min-h-screen bg-[#faf8f2] flex items-center justify-center p-6">
        <div
          role="alert"
          className="max-w-md rounded-3xl border border-amber-200 bg-white p-8 text-center shadow-sm"
        >
          <ShieldAlert className="mx-auto h-10 w-10 text-amber-700" />
          <h2 className="mt-3 font-display text-xl font-bold text-stone-900">
            QA Officer Clearance Required
          </h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            Your account is signed in as <strong>{role}</strong>. This action requires{' '}
            <strong>{roles.join(' or ')}</strong> privileges.
          </p>
        </div>
      </div>
    );
  }

  return children;
}
