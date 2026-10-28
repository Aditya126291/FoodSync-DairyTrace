import React, { useState } from 'react';
import {
  ArrowLeft,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  Lock,
  ShieldCheck,
  Terminal,
  UserCheck,
} from 'lucide-react';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import { Alert, Field } from '../components/ui';
import { useAuth } from '../auth/AuthContext';
import { DEMO_ACCOUNTS, DEMO_MODE } from '../config';

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
      setError(err.message || 'Invalid email address or password.');
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
    <div className="flex min-h-screen flex-col bg-canvas text-ink-800">
      <PublicHeader subtitle="Staff &amp; Regulatory Portal" onHome={onBackHome}>
        <button
          type="button"
          onClick={onBackHome}
          className="btn btn-secondary btn-sm"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Scanner
        </button>
      </PublicHeader>

      <main className="container-page flex-1 py-8 sm:py-12">
        <div className="mx-auto grid max-w-5xl items-start gap-8 md:grid-cols-12 lg:gap-12">
          {/* Left: Login Form Card */}
          <div className="card card-pad md:col-span-7">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-control bg-brand-800 text-white shadow-sm">
                <Lock className="h-5 w-5" />
              </span>
              <div>
                <p className="eyebrow">Staff Authentication</p>
                <h1 className="section-title text-xl font-bold">Sign In to Workspace</h1>
              </div>
            </div>

            <p className="muted mt-3">
              Enter your official credentials. Access privileges and audit permissions are enforced by signed cryptographic JWT sessions.
            </p>

            {error && (
              <div className="mt-4">
                <Alert tone="danger" onClose={() => setError('')}>
                  {error}
                </Alert>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <Field label="Official Email Address" htmlFor="staff-email">
                <input
                  id="staff-email"
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. inspector@dairytrace.demo"
                  className="field"
                />
              </Field>

              <Field label="Password" htmlFor="staff-password">
                <div className="relative">
                  <input
                    id="staff-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter account password"
                    className="field pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2 top-2 rounded-control p-2 text-ink-500 hover:bg-ink-100 hover:text-ink-800"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>

              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primary btn-lg mt-2 w-full"
              >
                {submitting ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  <>
                    <KeyRound className="h-4 w-4" />
                    Sign In
                  </>
                )}
              </button>
            </form>

            {/* Demo Quick-Fill Accounts */}
            {DEMO_MODE && DEMO_ACCOUNTS && DEMO_ACCOUNTS.length > 0 && (
              <div className="mt-8 rounded-card border border-brand-200 bg-brand-50/50 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-brand-900">
                    Evaluation Demo Accounts
                  </span>
                  <span className="badge badge-safe">Pre-seeded DB</span>
                </div>
                <p className="mt-1 text-xs text-ink-600">
                  Select a role below to auto-populate test credentials:
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {DEMO_ACCOUNTS.map((acc) => (
                    <button
                      key={acc.email}
                      type="button"
                      onClick={() => fillDemoAccount(acc.email, acc.password)}
                      className="card flex flex-col items-start p-3 text-left transition hover:border-brand-600 hover:bg-brand-50/40"
                    >
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-ink-900">
                        {acc.role === 'QA_OFFICER' ? (
                          <ShieldCheck className="h-3.5 w-3.5 text-amber-700" />
                        ) : (
                          <UserCheck className="h-3.5 w-3.5 text-brand-700" />
                        )}
                        {acc.name} · {acc.title}
                      </span>
                      <span className="mt-1 font-mono text-[11px] text-ink-600">
                        {acc.email}
                      </span>
                      <span className="mt-1 text-[11px] text-ink-500 leading-tight">
                        {acc.summary}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Security & Role Information */}
          <div className="space-y-4 md:col-span-5">
            <div className="card card-pad space-y-4">
              <h2 className="section-title text-base font-bold">
                Role-Based Separation of Duties
              </h2>
              <p className="muted text-xs leading-relaxed">
                DairyTrace enforces non-repudiation and strict privilege segregation at the API and database levels:
              </p>

              <div className="space-y-3 text-xs">
                <div className="rounded-card border border-ink-200 bg-canvas p-3">
                  <strong className="block font-semibold text-ink-900">
                    Inspector (Field / FSSAI)
                  </strong>
                  <p className="mt-0.5 text-ink-600 leading-relaxed">
                    Audit raw milk and finished paneer batches, inspect supplier lineage, record tamper-evident physical inspections, and review public consumer complaints.
                  </p>
                </div>

                <div className="rounded-card border border-amber-200 bg-amber-50/50 p-3">
                  <strong className="block font-semibold text-amber-950">
                    QA Officer (Plant Quality Assurance)
                  </strong>
                  <p className="mt-0.5 text-amber-900 leading-relaxed">
                    All Inspector privileges, plus batch creation, NABL certificate linking, milk-to-paneer vat blending, official recall execution, and statutory FSSAI notice export.
                  </p>
                </div>
              </div>

              <div className="rounded-card bg-ink-900 p-4 text-xs text-white">
                <div className="flex items-center gap-2 font-bold text-brand-300">
                  <Terminal className="h-4 w-4" />
                  <span>Administrative Provisioning</span>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-300">
                  Self-registration is disabled for security. New staff accounts are provisioned via the administrative CLI:
                </p>
                <code className="mt-2 block overflow-x-auto rounded bg-black/40 p-2 font-mono text-[10px] text-brand-200">
                  python -m app.manage create-user --email ... --role INSPECTOR
                </code>
              </div>
            </div>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
