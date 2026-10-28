import React, { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  FileSearch,
  FlaskConical,
  KeyRound,
  LayoutDashboard,
  Leaf,
  LogOut,
  QrCode,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import QrScanner from '../components/QrScanner';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import { Alert, Badge } from '../components/ui';
import { useAuth } from '../auth/AuthContext';
import { extractBatchId } from '../utils/qr';
import { DEMO_BATCHES, DEMO_MODE } from '../config';

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
      setScanError('Please enter or scan a valid DairyTrace batch code (for example: PAN-201 or MILK-101).');
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
    <div className="flex min-h-screen flex-col bg-canvas text-ink-800">
      {/* Top Header */}
      <PublicHeader subtitle="Farm-to-Pack Dairy Traceability">
        <div className="flex items-center gap-2.5">
          <span className="hidden items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 py-1 text-xs font-medium text-ink-600 md:inline-flex">
            <ShieldCheck className="h-3.5 w-3.5 text-brand-700" />
            NABL Accredited &amp; FSSAI Compliant
          </span>

          {isAuthenticated && user ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenStaffDashboard}
                className="btn btn-primary btn-sm"
              >
                <LayoutDashboard className="h-3.5 w-3.5" />
                <span>Staff Portal ({isQA ? 'QA Officer' : 'Inspector'})</span>
              </button>
              <button
                type="button"
                onClick={logout}
                className="btn btn-secondary btn-sm"
                title="Sign out of staff session"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onStaffLoginClick}
              className="btn btn-secondary btn-sm"
            >
              <KeyRound className="h-3.5 w-3.5 text-brand-800" />
              <span>Staff Login</span>
            </button>
          )}
        </div>
      </PublicHeader>

      {/* Main Content */}
      <main className="container-wide flex-1 py-6 sm:py-10">
        <div className="grid items-start gap-7 lg:grid-cols-12 lg:gap-10">
          {/* Left Column: Hero banner & 3-Step Flow */}
          <div className="space-y-7 lg:col-span-7">
            {/* Visual Hero Card with Background Photo */}
            <div className="relative overflow-hidden rounded-2xl border border-ink-200 bg-ink-900 shadow-card">
              <img
                src="/dairytrace-farm-hero.jpg"
                alt="Dairy farm cows grazing in pasture"
                className="h-64 w-full object-cover opacity-40 sm:h-[22rem]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/60 to-transparent" />
                <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-9">
                <div className="inline-flex items-center gap-2 self-start rounded-full bg-brand-800/90 px-3 py-1 text-xs font-semibold text-white shadow-sm backdrop-blur">
                  <Sparkles className="h-3.5 w-3.5 text-brand-200" />
                  Farm-to-Pack Transparency
                </div>
                <h1 className="mt-3 font-display text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl">
                  Know where your dairy comes from.
                </h1>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-200 sm:text-base">
                  Check the origin, quality checks and safety status behind every pack of milk and paneer.
                </p>
              </div>
            </div>

            {/* If Staff logged in, show an informational banner */}
            {isAuthenticated && user && (
              <div className="alert alert-safe">
                <ShieldCheck className="h-5 w-5 text-brand-700" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-brand-950">
                    Logged in as {user.full_name} ({user.role === 'QA_OFFICER' ? 'QA Officer' : 'Inspector'})
                  </p>
                  <p className="text-xs text-brand-800">
                    Scanning a batch opens the comprehensive Staff Audit, Lineage graph, and recall operations console.
                  </p>
                </div>
              </div>
            )}

            {/* 3-Step How It Works Flow */}
            <section aria-labelledby="how-it-works-heading">
              <h2 id="how-it-works-heading" className="eyebrow mb-4">
                How DairyTrace Works
              </h2>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="card p-5 transition-shadow hover:shadow-pop">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-800 ring-1 ring-brand-200">
                    <QrCode className="h-5 w-5" />
                  </div>
                  <h3 className="mt-3 text-sm font-bold text-ink-900">1. Scan or Enter Code</h3>
                  <p className="mt-1 text-xs leading-relaxed text-ink-600">
                    Scan the QR code on your product packaging, or enter the batch code printed near the expiry date.
                  </p>
                </div>

                <div className="card p-5 transition-shadow hover:shadow-pop">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-800 ring-1 ring-brand-200">
                    <FlaskConical className="h-5 w-5" />
                  </div>
                  <h3 className="mt-3 text-sm font-bold text-ink-900">2. Inspect Quality &amp; Origin</h3>
                  <p className="mt-1 text-xs leading-relaxed text-ink-600">
                    Review village milk collection points, fat/SNF lab tests, cold chain records, and FSSAI clearance.
                  </p>
                </div>

                <div className="card p-5 transition-shadow hover:shadow-pop">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-800 ring-1 ring-brand-200">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <h3 className="mt-3 text-sm font-bold text-ink-900">3. Verified Safety</h3>
                  <p className="mt-1 text-xs leading-relaxed text-ink-600">
                    Peace of mind backed by cryptographic provenance. Consumers can also file instant safety reports.
                  </p>
                </div>
              </div>
            </section>
          </div>

          {/* Right Column: QR Scanner & Direct Code Lookup */}
          <div className="space-y-5 lg:col-span-5">
            <div>
              <p className="eyebrow">
                {isAuthenticated ? 'Staff Mode' : 'Instant Verification'}
              </p>
              <h2 className="section-title mt-1 text-xl sm:text-2xl">
                {isAuthenticated ? 'Scan for Audit & Lineage' : 'Inspect Your Dairy Batch'}
              </h2>
              <p className="muted mt-1 text-sm">
                Scan the pack QR code or enter the batch number below.
              </p>
            </div>

            {/* Camera / Image QR Scanner */}
            <QrScanner
              title="Pack QR Scanner"
              description="Use your camera or upload a photo of the pack QR code."
              onScan={submitValue}
            />

            {/* Direct manual code lookup card */}
            <div className="card p-5">
              <form onSubmit={handleManualSubmit} className="space-y-3">
                <label
                  htmlFor="manual-batch-input"
                  className="label text-xs uppercase tracking-wider"
                >
                  Direct Batch Code Lookup
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    id="manual-batch-input"
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="e.g. PAN-201 or MILK-101"
                    className="field uppercase placeholder:normal-case font-semibold"
                  />
                  <button
                    type="submit"
                    disabled={loading || !manualCode.trim()}
                    className="btn btn-primary sm:shrink-0"
                  >
                    <span>{isAuthenticated ? 'Audit Batch' : 'View Passport'}</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </form>

              {/* Sample demo batch quick clicks */}
              {DEMO_MODE && DEMO_BATCHES && DEMO_BATCHES.length > 0 && (
                <div className="mt-4 border-t border-ink-100 pt-3">
                  <p className="mb-2 text-xs font-semibold text-ink-500">
                    Try a sample batch:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {DEMO_BATCHES.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => {
                          setManualCode(b.id);
                          submitValue(b.id);
                        }}
                        className="rounded-lg border border-ink-200 bg-canvas px-2.5 py-1 text-xs font-medium text-ink-700 transition hover:border-brand-600 hover:bg-brand-50 hover:text-brand-900"
                      >
                        <span className="font-bold">{b.id}</span> · {b.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Scan or Lookup Alerts */}
            {(scanError || error) && (
              <Alert tone="danger" onClose={() => setScanError('')}>
                {scanError || error}
              </Alert>
            )}

            {loading && (
              <Alert tone="info">
                Fetching cryptographic batch passport from DairyTrace…
              </Alert>
            )}
          </div>
        </div>
      </main>

      {/* Public Footer */}
      <PublicFooter />
    </div>
  );
}
