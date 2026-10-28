import React from 'react';
import { LayoutDashboard, LogOut, ShieldCheck, UserCheck } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { Logo } from './ui';

export default function Navbar({
  onNavigateDashboard,
  onLogout,
  activeView = 'dashboard',
}) {
  const { user, isQA } = useAuth();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-ink-200/80 bg-white/95 backdrop-blur-xl print:hidden">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:h-[72px] sm:px-6 lg:px-8">
        <Logo onClick={onNavigateDashboard} subtitle="Staff Traceability & Audit Workspace" />

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {activeView !== 'dashboard' && (
            <button
              type="button"
              onClick={onNavigateDashboard}
              className="btn btn-secondary btn-sm"
            >
              <LayoutDashboard className="h-3.5 w-3.5 text-brand-800" />
              <span>Dashboard</span>
            </button>
          )}

          {user && (
            <div className="flex items-center gap-2.5 rounded-control border border-ink-200 bg-white px-3 py-1.5 shadow-sm">
              <span
                className={`grid h-7 w-7 place-items-center rounded-control text-xs font-bold ${
                  isQA
                    ? 'bg-amber-100 text-amber-900 border border-amber-200'
                    : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                }`}
              >
                {isQA ? <ShieldCheck className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
              </span>
              <div className="hidden text-left sm:block">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-ink-900">{user.full_name}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
                      isQA
                        ? 'bg-amber-100 text-amber-900 border border-amber-200'
                        : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                    }`}
                  >
                    {isQA ? 'QA Officer' : 'Inspector'}
                  </span>
                </div>
                {user.organisation && (
                  <span className="block text-[10px] text-ink-500 truncate max-w-[180px]">
                    {user.organisation}
                  </span>
                )}
              </div>
              <span
                className={`sm:hidden rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                  isQA ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'
                }`}
              >
                {isQA ? 'QA' : 'INSP'}
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={onLogout}
            aria-label="Sign out of staff session"
            className="btn btn-secondary btn-sm text-red-700 hover:border-red-300 hover:bg-red-50 hover:text-red-900"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
