import React from 'react';
import { ChevronLeft, FlaskConical, Milk, MoreHorizontal, Plus, RotateCcw } from 'lucide-react';

export default function Navbar({
  currentView,
  setCurrentView,
  onOpenCreateBatchModal,
  onOpenComplaintModal,
  onReloadPitchScenario,
  isRefreshing,
}) {
  const isPassport = currentView === 'passport';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-stone-200/80 bg-[#fffdf9]/95 backdrop-blur-xl print:hidden">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:h-20 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => setCurrentView('dashboard')}
          aria-label={isPassport ? 'Back to DairyTrace workspace' : 'DairyTrace workspace home'}
          className="group flex min-w-0 items-center gap-3 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-800 text-white shadow-sm transition duration-200 group-hover:-rotate-3 group-hover:scale-105">
            <Milk className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-display text-xl font-semibold tracking-tight text-stone-900">DairyTrace</span>
            <span className="block text-[11px] font-medium text-stone-500">{isPassport ? 'Product information' : 'Farm to your table'}</span>
          </span>
        </button>

        {isPassport ? (
          <button
            type="button"
            onClick={() => setCurrentView('dashboard')}
            className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-stone-600 transition hover:bg-stone-100 hover:text-stone-900"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Workspace</span>
            <span className="sm:hidden">Back</span>
          </button>
        ) : (
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onOpenComplaintModal}
              aria-label="Raise complaint or forensic lab report"
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-stone-300 bg-white px-3 text-sm font-semibold text-stone-700 shadow-sm transition hover:border-emerald-600 hover:bg-emerald-50 hover:text-emerald-900 sm:px-3.5"
            >
              <FlaskConical className="h-4 w-4 text-emerald-800" />
              <span className="hidden sm:inline">Complaints &amp; Reports</span>
              <span className="sm:hidden">Complaints</span>
            </button>

            <button
              type="button"
              onClick={onOpenCreateBatchModal}
              aria-label="Add a batch"
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-800 px-3 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-900 sm:px-4"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add batch</span>
              <span className="sm:hidden">Add</span>
            </button>

            <details className="relative">
              <summary className="flex min-h-10 cursor-pointer list-none items-center justify-center gap-1 rounded-xl px-2.5 text-sm font-semibold text-stone-600 transition hover:bg-stone-100 hover:text-stone-900 [&::-webkit-details-marker]:hidden">
                <MoreHorizontal className="h-5 w-5" />
                <span className="hidden sm:inline">More</span>
                <span className="sr-only sm:hidden">Workspace options</span>
              </summary>
              <div className="absolute right-0 top-12 z-50 w-56 rounded-xl border border-stone-200 bg-white p-1.5 shadow-lg">
                <button
                  type="button"
                  onClick={onReloadPitchScenario}
                  disabled={isRefreshing}
                  aria-label="Reset sample dairy batches"
                  className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-semibold text-stone-700 transition hover:bg-stone-50 disabled:opacity-60"
                >
                  <RotateCcw className={`h-4 w-4 text-stone-500 ${isRefreshing ? 'animate-spin' : ''}`} />
                  Reset demo data
                </button>
              </div>
            </details>
          </div>
        )}
      </div>
    </header>
  );
}
