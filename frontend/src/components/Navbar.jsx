import React from 'react';
import { LayoutDashboard, LogOut, Milk, ShieldCheck, UserCheck } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

export default function Navbar({
  onNavigateDashboard,
  onLogout,
  activeView = 'dashboard',
}) {
  const { user, isQA } = useAuth();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-stone-200/90 bg-[#fffdf9]/95 backdrop-blur-xl print:hidden">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:h-20 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onNavigateDashboard}
          aria-label="DairyTrace staff dashboard home"
          className="group flex min-w-0 items-center gap-3 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-900 text-white shadow-sm transition duration-200 group-hover:-rotate-3 group-hover:scale-105">
            <Milk className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-display text-xl font-bold tracking-tight text-stone-900">
              DairyTrace
            </span>
            <span className="block text-[11px] font-medium text-stone-500">
              Staff Traceability &amp; Audit Workspace
            </span>
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {activeView !== 'dashboard' && (
            <button
              type="button"
              onClick={onNavigateDashboard}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 text-xs font-bold text-stone-700 shadow-sm transition hover:bg-stone-50 hover:text-stone-950"
            >
              <LayoutDashboard className="h-3.5 w-3.5 text-emerald-800" />
              <span>Dashboard</span>
            </button>
          )}

          {user && (
            <div className="flex items-center gap-2.5 rounded-2xl border border-stone-200 bg-white px-3 py-1.5 shadow-sm">
              <span
                className={`grid h-7 w-7 place-items-center rounded-xl text-xs font-bold ${
                  isQA
                    ? 'bg-amber-100 text-amber-900 border border-amber-200'
                    : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                }`}
              >
                {isQA ? <ShieldCheck className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
              </span>
              <div className="hidden text-left sm:block">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-stone-900">{user.full_name}</span>
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
                  <span className="block text-[10px] text-stone-500 truncate max-w-[180px]">
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
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3 text-xs font-bold text-stone-700 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-800"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
