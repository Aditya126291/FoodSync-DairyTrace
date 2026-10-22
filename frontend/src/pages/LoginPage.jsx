import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  Lock,
  Milk,
  ShieldCheck,
  Terminal,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

export default function LoginPage({ onSuccess, onBackHome }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setError('Enter both your staff email address and password.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const user = await login(cleanEmail, password);
      onSuccess?.(user);
    } catch (err) {
      setError(err.message || 'Invalid email or password.');
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemoAccount = (demoEmail, demoPass) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError('');
  };

  return (
    <div className="min-h-screen bg-[#faf8f2] text-stone-800 flex flex-col justify-between">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-8">
        <button
          type="button"
          onClick={onBackHome}
          className="flex items-center gap-3 text-left rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
        >
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-900 text-white shadow-sm">
            <Milk className="h-5 w-5" />
          </span>
          <span>
            <strong className="block font-display text-lg font-bold tracking-tight text-stone-900">
              DairyTrace
            </strong>
            <span className="block text-xs font-medium text-stone-500">
              Authorized Staff &amp; Regulatory Portal
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={onBackHome}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3.5 text-xs font-bold text-stone-700 shadow-sm transition hover:bg-stone-50"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to QR Scanner
        </button>
      </header>

      <main className="mx-auto grid w-full max-w-5xl items-center gap-8 px-4 py-6 sm:px-8 md:grid-cols-[1.05fr_.95fr]">
        {/* Left: Login Card */}
        <section className="rounded-3xl border border-stone-200/90 bg-white p-6 shadow-xl shadow-stone-900/5 sm:p-8">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-900 text-white">
              <Lock className="h-5 w-5" />
            </span>
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-emerald-800">
                Staff Authentication
              </span>
              <h1 className="font-display text-2xl font-bold text-stone-950">
                Sign in to Audit &amp; QMS
              </h1>
            </div>
          </div>

          <p className="mt-3 text-sm leading-6 text-stone-600">
            Sign in with your assigned FSSAI Inspector or Dairy QA Officer credentials. Roles are enforced by signed JWT tokens and verified on every API call.
          </p>

          {error && (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="staff-email"
                className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-stone-700"
              >
                Official Email Address
              </label>
              <input
                id="staff-email"
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="inspector@dairytrace.demo"
                className="min-h-11 w-full rounded-xl border border-stone-300 bg-[#faf9f5] px-3.5 py-2.5 text-sm font-medium text-stone-900 outline-none transition focus:border-emerald-700 focus:bg-white focus:ring-2 focus:ring-emerald-700/15"
              />
            </div>

            <div>
              <label
                htmlFor="staff-password"
                className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-stone-700"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="staff-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="min-h-11 w-full rounded-xl border border-stone-300 bg-[#faf9f5] pl-3.5 pr-11 py-2.5 text-sm font-medium text-stone-900 outline-none transition focus:border-emerald-700 focus:bg-white focus:ring-2 focus:ring-emerald-700/15"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-2.5 rounded-lg p-1.5 text-stone-500 hover:bg-stone-100 hover:text-stone-800"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-900 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-950 disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                <>
                  <KeyRound className="h-4 w-4" />
                  Sign In to Staff Workspace
                </>
              )}
            </button>
          </form>

          {/* Demo Helper for Hackathon Judges */}
          <div className="mt-6 rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-900">
                Tech4Food 2026 Jury Evaluation Accounts
              </span>
              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                Pre-seeded DB
              </span>
            </div>
            <p className="mt-1 text-xs text-stone-600">
              Click a seeded role below to populate credentials for live RBAC verification:
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => fillDemoAccount('inspector@dairytrace.demo', 'Inspect@2026')}
                className="flex flex-col items-start rounded-xl border border-stone-200 bg-white p-3 text-left transition hover:border-emerald-600 hover:bg-emerald-50/40"
              >
                <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-stone-900">
                  <UserCheck className="h-3.5 w-3.5 text-emerald-700" />
                  Priya Nair · INSPECTOR
                </span>
                <span className="mt-1 font-mono text-[11px] text-stone-600">
                  inspector@dairytrace.demo
                </span>
                <span className="mt-0.5 text-[10px] text-stone-500">
                  Audit, lineage, log inspections &amp; review complaints (no recall execution)
                </span>
              </button>

              <button
                type="button"
                onClick={() => fillDemoAccount('qa@dairytrace.demo', 'QaOfficer@2026')}
                className="flex flex-col items-start rounded-xl border border-stone-200 bg-white p-3 text-left transition hover:border-emerald-600 hover:bg-emerald-50/40"
              >
                <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-stone-900">
                  <ShieldCheck className="h-3.5 w-3.5 text-amber-700" />
                  Vikram Patil · QA_OFFICER
                </span>
                <span className="mt-1 font-mono text-[11px] text-stone-600">
                  qa@dairytrace.demo
                </span>
                <span className="mt-0.5 text-[10px] text-stone-500">
                  Full QA clearance: create batches, link milk→paneer, execute recalls &amp; FSSAI notices
                </span>
              </button>
            </div>
          </div>
        </section>

        {/* Right: Role & Provisioning Policy Explanation */}
        <aside className="space-y-4">
          <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
            <h2 className="font-display text-lg font-bold text-stone-900">
              Role-Based Access Control (RBAC)
            </h2>
            <p className="text-xs sm:text-sm leading-6 text-stone-600">
              Unlike open prototypes where any visitor can toggle roles in the browser, DairyTrace enforces strict separation of duties at the database and API layer:
            </p>

            <div className="space-y-3 text-xs">
              <div className="rounded-2xl border border-stone-200 bg-[#faf9f5] p-3.5">
                <strong className="text-stone-900 block">Public Consumer (No Login Required)</strong>
                <p className="mt-1 text-stone-600 leading-relaxed">
                  Scan any pack QR on the landing page to view its safety status, purity metrics, and farm origin breakdown, or file an AI-assisted safety complaint bound to that batch.
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3.5">
                <strong className="text-emerald-950 block">FSSAI / Field Inspector (INSPECTOR)</strong>
                <p className="mt-1 text-stone-700 leading-relaxed">
                  Scan or search any batch, inspect milk-to-paneer genealogy, log tamper-evident physical security checks (SHA-256 + photo evidence), simulate blast radius, and triage complaints. Cannot execute recalls or delete records.
                </p>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-3.5">
                <strong className="text-amber-950 block">Dairy QA Officer (QA_OFFICER)</strong>
                <p className="mt-1 text-stone-700 leading-relaxed">
                  All Inspector capabilities plus creating raw milk &amp; paneer batches, attaching NABL lab quality certificates, linking milk-to-paneer vats, executing official recalls, and exporting statutory FSSAI Schedule-I recall notices.
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-stone-900 p-4 text-stone-200 text-xs space-y-1.5">
              <div className="flex items-center gap-2 text-emerald-300 font-bold">
                <Terminal className="h-4 w-4" />
                <span>Admin CLI Account Provisioning Only</span>
              </div>
              <p className="text-stone-300 leading-relaxed text-[11px]">
                There is no public sign-up endpoint. Staff accounts are provisioned exclusively by system administrators via CLI:
              </p>
              <code className="block rounded-lg bg-black/50 px-2.5 py-1.5 font-mono text-[11px] text-emerald-200 overflow-x-auto">
                python -m app.manage create-user --email ... --role INSPECTOR
              </code>
            </div>
          </div>
        </aside>
      </main>

      <footer className="border-t border-stone-200/70 bg-white/60 px-4 py-4 text-center text-xs text-stone-500">
        DairyTrace Security &amp; Audit Service · Signed HS256 JWT Session · Brute-Force Lockout Enabled
      </footer>
    </div>
  );
}
