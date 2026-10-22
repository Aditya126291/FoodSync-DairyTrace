import React, { useState } from 'react';
import {
  ArrowRight,
  FlaskConical,
  KeyRound,
  LayoutDashboard,
  Leaf,
  LogOut,
  Milk,
  QrCode,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import QrScanner from '../components/QrScanner';
import { useAuth } from '../auth/AuthContext';
import { extractBatchId } from '../utils/qr';

const DEMO_BATCHES = [
  { id: 'PAN-201', label: 'PAN-201 · Malai Paneer (Blended)' },
  { id: 'MILK-101', label: 'MILK-101 · Shirur Raw Milk' },
  { id: 'PAN-303', label: 'PAN-303 · Safe Control Paneer' },
];

export default function LandingPage({
  onScanBatch,
  onStaffLoginClick,
  onOpenStaffDashboard,
  loading,
  error,
}) {
  const { user, isAuthenticated, isQA, logout } = useAuth();
  const [scanError, setScanError] = useState('');
  const [manualCode, setManualCode] = useState('');

  const submitValue = (rawValue) => {
    const batchId = extractBatchId(rawValue);
    if (!batchId) {
      setScanError('Enter or scan a valid DairyTrace batch code (for example PAN-201 or MILK-101).');
      return;
    }
    setScanError('');
    onScanBatch(batchId);
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    submitValue(manualCode);
  };

  return (
    <div className="min-h-screen overflow-hidden bg-[#faf8f2] text-stone-800 flex flex-col justify-between">
      {/* Top Header */}
      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-5 sm:px-8 lg:px-12">
        <a href="/" className="flex items-center gap-3" aria-label="DairyTrace home">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-900 text-white shadow-lg shadow-emerald-950/10">
            <Milk className="h-5 w-5" />
          </span>
          <span>
            <strong className="block font-display text-xl font-bold tracking-tight text-stone-900">
              DairyTrace
            </strong>
            <span className="text-xs font-medium text-stone-500">
              Farm-to-Paneer Traceability &amp; Smart Recall
            </span>
          </span>
        </a>

        <div className="flex items-center gap-2.5">
          <span className="hidden items-center gap-1.5 rounded-full border border-stone-200 bg-white/90 px-3 py-1.5 text-[11px] font-semibold text-stone-600 md:inline-flex">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" />
            Tech4Food 2026 · Simulated Sample Dataset
          </span>

          {isAuthenticated && user ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenStaffDashboard}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-900 px-3.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-950"
              >
                <LayoutDashboard className="h-3.5 w-3.5" />
                <span>Staff Dashboard ({isQA ? 'QA Officer' : 'Inspector'})</span>
              </button>
              <button
                type="button"
                onClick={logout}
                className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-stone-300 bg-white px-3 text-xs font-bold text-stone-700 hover:bg-stone-50"
                title="Sign out of staff mode"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onStaffLoginClick}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-stone-300 bg-white/90 px-3.5 text-xs font-bold text-stone-800 shadow-sm transition hover:border-emerald-700 hover:bg-emerald-50/60 hover:text-emerald-950"
            >
              <KeyRound className="h-3.5 w-3.5 text-emerald-800" />
              <span>Staff login</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto grid w-full max-w-7xl items-start gap-10 px-4 pb-16 pt-2 sm:px-8 lg:grid-cols-[1.02fr_.98fr] lg:gap-12 lg:px-12">
        {/* Left Column: Value Proposition & 3-Step Flow */}
        <section className="panel-enter space-y-6">
          <div className="welcome-hero relative overflow-hidden rounded-3xl border border-stone-200/90 shadow-md">
            <div className="welcome-hero__wash inset-0 flex h-full flex-col justify-between p-6 sm:p-8">
              <div className="welcome-hero__content space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-900/95 px-3 py-1 text-xs font-bold text-emerald-50 shadow-sm">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
                  Every batch has a history
                </div>

                <h1 className="max-w-lg font-display text-3xl font-bold leading-[1.1] tracking-tight text-stone-950 sm:text-4xl lg:text-[2.85rem]">
                  Trace your dairy from{' '}
                  <span className="text-emerald-800">village collection</span> to retail pack.
                </h1>

                <p className="max-w-md text-sm leading-6 text-stone-700 sm:text-base">
                  Scan any milk or paneer QR code to inspect its farm origins, NABL laboratory quality checks, and real-time FSSAI safety status.
                </p>
              </div>

              {isAuthenticated && user && (
                <div className="mt-6 inline-flex flex-wrap items-center gap-2 self-start rounded-2xl border border-emerald-300 bg-emerald-50/95 px-3.5 py-2 text-xs font-bold text-emerald-950 shadow-sm">
                  <ShieldCheck className="h-4 w-4 text-emerald-800" />
                  <span>
                    Staff Scanner Mode Active ({user.full_name} · {user.role}): Scanning opens the full Batch Audit &amp; Genealogy view.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 3-Step Explainer */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-stone-200/90 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-emerald-800">
                <QrCode className="h-4 w-4 shrink-0" />
                <span>1. Scan Pack QR</span>
              </div>
              <p className="mt-1.5 text-xs leading-5 text-stone-600">
                Use your camera, upload a QR label image, or enter the batch code printed on the pack.
              </p>
            </div>

            <div className="rounded-2xl border border-stone-200/90 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-emerald-800">
                <Leaf className="h-4 w-4 shrink-0" />
                <span>2. Verify Origin</span>
              </div>
              <p className="mt-1.5 text-xs leading-5 text-stone-600">
                See contributing village milk centres, fat/SNF test results, and 3-tier verification badges.
              </p>
            </div>

            <div className="rounded-2xl border border-stone-200/90 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-emerald-800">
                <FlaskConical className="h-4 w-4 shrink-0" />
                <span>3. Report or Audit</span>
              </div>
              <p className="mt-1.5 text-xs leading-5 text-stone-600">
                File an AI-assisted safety report bound to the scanned batch, or trace downstream recalls.
              </p>
            </div>
          </div>
        </section>

        {/* Right Column: Single QR Scanner + Manual Batch Code Fallback */}
        <section className="panel-enter space-y-4" aria-label="Scan a dairy product">
          <div className="flex items-center justify-between px-1">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[.16em] text-emerald-800">
                {isAuthenticated ? 'Staff Batch Scanner' : 'Public Product Scanner'}
              </p>
              <h2 className="mt-0.5 font-display text-2xl font-bold text-stone-900">
                {isAuthenticated
                  ? 'Scan QR to open Batch Audit'
                  : 'Scan QR to open Product Passport'}
              </h2>
            </div>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-900">
              {isAuthenticated ? 'Routes to /staff/batch/:id' : 'Routes to /passport/:id'}
            </span>
          </div>

          <QrScanner
            title="Scan your DairyTrace QR code"
            description="Hold the pack QR code steady in the camera frame, or upload a QR image from demo-qr/images."
            onScan={submitValue}
          />

          {/* Manual Batch ID Fallback */}
          <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
            <form onSubmit={handleManualSubmit} className="space-y-3">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="manual-batch-input"
                  className="text-xs font-bold uppercase tracking-wider text-stone-700"
                >
                  Camera unavailable? Enter batch code manually
                </label>
                <span className="text-[11px] font-medium text-stone-500">
                  Direct lookup fallback
                </span>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id="manual-batch-input"
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="e.g. PAN-201, MILK-101, PAN-303"
                  className="min-h-11 flex-1 rounded-xl border border-stone-300 bg-[#faf9f5] px-3.5 py-2 text-sm font-bold uppercase text-stone-900 placeholder:font-normal placeholder:normal-case focus:border-emerald-700 focus:bg-white focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-900 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-950 disabled:opacity-60"
                >
                  <span>{isAuthenticated ? 'Open Batch Audit' : 'Open Passport'}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </form>

            {/* Quick Demo Batch Chips */}
            <div className="mt-3.5 flex flex-wrap items-center gap-1.5 pt-3 border-t border-stone-100">
              <span className="text-[11px] font-bold text-stone-500 mr-1">
                Sample Demo Batches:
              </span>
              {DEMO_BATCHES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setManualCode(item.id);
                    submitValue(item.id);
                  }}
                  className="rounded-lg border border-stone-200 bg-[#faf9f5] px-2.5 py-1 text-xs font-bold text-stone-700 transition hover:border-emerald-600 hover:bg-emerald-50 hover:text-emerald-900"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {(scanError || error) && (
            <p
              role="alert"
              className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800"
            >
              {scanError || error}
            </p>
          )}

          {loading && (
            <div
              className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900"
              role="status"
            >
              Verifying batch record with DairyTrace database…
            </div>
          )}
        </section>
      </main>

      <footer className="border-t border-stone-200/70 bg-white/60 px-4 py-4 text-center text-xs text-stone-500">
        DairyTrace · Evidence-Linked Dairy Traceability &amp; Smart Recall Engine · Team FoodSync (Tech4Food 2026)
      </footer>
    </div>
  );
}
