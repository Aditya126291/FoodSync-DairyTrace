import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileImage,
  Fingerprint,
  LoaderCircle,
  Lock,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Alert, Badge, Field } from './ui';
import { formatDate } from '../utils/format';

const initialForm = (batch) => ({
  tamper_seal_condition: 'INTACT',
  seal_serial_number: '',
  packaging_status: 'NORMAL',
  expected_quantity: Number(batch.initial_quantity || 0),
  actual_quantity: batch.initial_quantity != null ? String(batch.initial_quantity) : '',
  temperature_c: '',
  humidity_percent: '',
  cold_chain_compliant: false,
  verdict: 'PASSED',
  notes: '',
  evidence: null,
});

export default function SecurityInspectionForm({ batch, onCancel, onSubmitted }) {
  const { user } = useAuth();
  const [form, setForm] = useState(() => initialForm(batch));
  const [step, setStep] = useState('form');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [filePreview, setFilePreview] = useState('');

  const inspectorIdentity = user
    ? `${user.full_name} (${user.role === 'QA_OFFICER' ? 'QA Officer' : 'Inspector'})`
    : 'Authenticated Staff';

  useEffect(() => {
    if (!form.evidence) {
      setFilePreview('');
      return undefined;
    }
    const url = URL.createObjectURL(form.evidence);
    setFilePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [form.evidence]);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const openPreview = (event) => {
    event.preventDefault();
    if (form.actual_quantity === '' || Number(form.actual_quantity) < 0) {
      setError('Actual measured quantity must be greater than or equal to 0.');
      return;
    }
    if (form.temperature_c === '' || Number(form.temperature_c) < -50 || Number(form.temperature_c) > 100) {
      setError('Temperature must be between -50°C and 100°C.');
      return;
    }
    if (Number(form.humidity_percent) < 0 || Number(form.humidity_percent) > 100) {
      setError('Humidity must be between 0% and 100%.');
      return;
    }
    if (form.evidence && form.evidence.size > 10 * 1024 * 1024) {
      setError('Choose a photo that is 10 MB or smaller.');
      return;
    }
    setError('');
    setStep('review');
  };

  const commit = async () => {
    setSubmitting(true);
    setError('');
    try {
      await api.submitInspection(batch.id, form);
      onSubmitted?.();
    } catch (submitError) {
      setError(
        submitError.message ||
          'The security check could not be saved. Check your connection and try again.'
      );
      setSubmitting(false);
    }
  };

  const stamp = new Date().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <section className="card overflow-hidden shadow-card" aria-labelledby="inspection-title">
      <div className="flex items-start justify-between gap-4 border-b border-ink-200 bg-canvas p-5 sm:p-6">
        <div className="flex gap-3.5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-control bg-brand-800 text-white shadow-sm">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <span className="eyebrow">Tamper-Evident Physical Audit</span>
            <h2 id="inspection-title" className="section-title text-xl mt-0.5">
              Security check · {batch.id}
            </h2>
            <p className="muted mt-1 text-xs sm:text-sm">
              Record physical seal integrity, storage measurements, and photographic evidence signed by your token.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close security check"
          className="-mr-2 -mt-1 rounded-control p-2 text-ink-500 hover:bg-ink-100 hover:text-ink-900"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="p-5 sm:p-7">
        {step === 'form' ? (
          <form onSubmit={openPreview} className="space-y-6">
            {/* Locked Batch Details */}
            <div className="space-y-2">
              <span className="eyebrow">1. Batch Metadata (Locked from Registry)</span>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-card border border-ink-200 bg-canvas p-3 text-xs">
                  <span className="block text-ink-500 font-semibold">Batch ID</span>
                  <span className="font-mono font-bold text-ink-900 mt-0.5 block">{batch.id}</span>
                </div>
                <div className="rounded-card border border-ink-200 bg-canvas p-3 text-xs">
                  <span className="block text-ink-500 font-semibold">Product Type</span>
                  <span className="font-bold text-ink-900 mt-0.5 block">
                    {batch.product_type === 'MILK' ? 'Raw Milk' : 'Paneer'}
                  </span>
                </div>
                <div className="rounded-card border border-ink-200 bg-canvas p-3 text-xs">
                  <span className="block text-ink-500 font-semibold">Facility</span>
                  <span className="font-semibold text-ink-900 mt-0.5 block truncate">{batch.facility_name}</span>
                </div>
                <div className="rounded-card border border-ink-200 bg-canvas p-3 text-xs">
                  <span className="block text-ink-500 font-semibold">Manufacture Date</span>
                  <span className="font-semibold text-ink-900 mt-0.5 block">{formatDate(batch.production_date)}</span>
                </div>
                <div className="rounded-card border border-ink-200 bg-canvas p-3 text-xs">
                  <span className="block text-ink-500 font-semibold">Expiry Date</span>
                  <span className="font-semibold text-ink-900 mt-0.5 block">{formatDate(batch.expiry_date)}</span>
                </div>
                <div className="rounded-card border border-brand-200 bg-brand-50/50 p-3 text-xs">
                  <span className="block text-brand-900 font-semibold">Signed Inspector</span>
                  <span className="font-bold text-brand-950 mt-0.5 block truncate">{inspectorIdentity}</span>
                </div>
              </div>
            </div>

            {/* Physical Integrity */}
            <div className="space-y-2 pt-2">
              <span className="eyebrow">2. Physical Integrity &amp; Package Condition</span>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Tamper Seal Condition" htmlFor="seal-cond">
                  <select
                    id="seal-cond"
                    required
                    className="field font-semibold"
                    value={form.tamper_seal_condition}
                    onChange={(e) => update('tamper_seal_condition', e.target.value)}
                  >
                    <option value="INTACT">INTACT (Normal security seal)</option>
                    <option value="BROKEN">BROKEN (Tampering / broken wire)</option>
                    <option value="SUSPICIOUS">SUSPICIOUS (Resealed / scratched)</option>
                    <option value="NA">NOT APPLICABLE</option>
                  </select>
                </Field>

                <Field label="Seal Serial Number" htmlFor="seal-serial" optional>
                  <input
                    id="seal-serial"
                    className="field font-mono"
                    value={form.seal_serial_number}
                    maxLength={100}
                    onChange={(e) => update('seal_serial_number', e.target.value)}
                    placeholder="e.g. SL-99210"
                  />
                </Field>

                <Field label="Packaging Status" htmlFor="pack-status">
                  <select
                    id="pack-status"
                    required
                    className="field font-semibold"
                    value={form.packaging_status}
                    onChange={(e) => update('packaging_status', e.target.value)}
                  >
                    <option value="NORMAL">NORMAL (Clean and sealed)</option>
                    <option value="DAMAGED">DAMAGED (Punctured or leaking)</option>
                    <option value="RESEALED">RESEALED (Secondary tape)</option>
                  </select>
                </Field>

                <Field label="Actual Measured Quantity" htmlFor="actual-qty">
                  <div className="relative">
                    <input
                      id="actual-qty"
                      required
                      type="number"
                      min="0"
                      step="0.01"
                      className="field pr-12 font-bold"
                      value={form.actual_quantity}
                      onChange={(e) => update('actual_quantity', e.target.value)}
                      placeholder={`Expected: ${form.expected_quantity}`}
                    />
                    <span className="absolute right-3.5 top-3 text-xs font-bold text-ink-500">
                      {batch.product_type === 'MILK' ? 'L' : 'kg'}
                    </span>
                  </div>
                </Field>
              </div>
            </div>

            {/* Storage Conditions */}
            <div className="space-y-2 pt-2">
              <span className="eyebrow">3. Storage &amp; Cold Chain Telemetry</span>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Temperature at Check (°C)" htmlFor="temp-check">
                  <input
                    id="temp-check"
                    required
                    type="number"
                    min="-50"
                    max="100"
                    step="0.1"
                    className="field font-semibold"
                    value={form.temperature_c}
                    onChange={(e) => update('temperature_c', e.target.value)}
                    placeholder="e.g. 4.0"
                  />
                </Field>

                <Field label="Humidity (%)" htmlFor="humidity-check">
                  <input
                    id="humidity-check"
                    required
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    className="field font-semibold"
                    value={form.humidity_percent}
                    onChange={(e) => update('humidity_percent', e.target.value)}
                    placeholder="0–100"
                  />
                </Field>

                <div className="sm:col-span-2">
                  <label className="flex items-center gap-3 rounded-card border border-ink-200 bg-canvas p-3.5 text-xs font-semibold text-ink-800 cursor-pointer">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded accent-brand-800"
                      checked={form.cold_chain_compliant}
                      onChange={(e) => update('cold_chain_compliant', e.target.checked)}
                    />
                    <span>Cold chain was continuous (&lt; 4°C maintained without interruption)</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Verdict and Evidence */}
            <div className="space-y-2 pt-2">
              <span className="eyebrow">4. Inspector Verdict &amp; Evidence</span>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Final Verdict" htmlFor="verdict">
                  <select
                    id="verdict"
                    required
                    className="field font-bold"
                    value={form.verdict}
                    onChange={(e) => update('verdict', e.target.value)}
                  >
                    <option value="PASSED">PASSED (Cleared for distribution)</option>
                    <option value="FLAGGED">FLAGGED (Under investigation)</option>
                    <option value="REJECTED">REJECTED (Place on quarantine hold)</option>
                  </select>
                </Field>

                <Field label="Notes &amp; Observations" htmlFor="notes" optional className="sm:col-span-2">
                  <textarea
                    id="notes"
                    rows={2}
                    maxLength={5000}
                    className="field"
                    value={form.notes}
                    onChange={(e) => update('notes', e.target.value)}
                    placeholder="Describe sensory observations, temperature log deviations, or seal integrity details…"
                  />
                </Field>

                <div className="sm:col-span-2">
                  <label className="label text-xs">
                    Photo Evidence <span className="font-normal text-ink-500">(Optional · up to 10 MB)</span>
                  </label>
                  <label className="card flex cursor-pointer items-center gap-3 border-dashed border-ink-300 bg-canvas p-4 transition hover:border-brand-600 hover:bg-brand-50/20">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-control bg-white text-brand-800 shadow-sm">
                      {form.evidence ? <FileImage className="h-5 w-5" /> : <Upload className="h-5 w-5" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-ink-900">
                        {form.evidence?.name || 'Attach photo of seal, vat, or packaging'}
                      </span>
                      <span className="block text-[11px] text-ink-500">
                        JPEG, PNG, or WebP formats supported
                      </span>
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      onChange={(e) => update('evidence', e.target.files?.[0] || null)}
                    />
                  </label>

                  {filePreview && (
                    <div className="mt-2 flex items-center gap-3">
                      <img
                        src={filePreview}
                        alt="Evidence preview"
                        className="h-16 w-16 rounded-card border border-ink-200 object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => update('evidence', null)}
                        className="text-xs font-semibold text-red-700 hover:underline"
                      >
                        Remove photo
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {error && <Alert tone="danger">{error}</Alert>}

            <div className="flex flex-col-reverse justify-between gap-3 border-t border-ink-100 pt-4 sm:flex-row sm:items-center">
              <span className="text-xs text-ink-500">Timestamp: {stamp}</span>
              <button type="submit" className="btn btn-primary">
                Review Inspection <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </form>
        ) : (
          /* Step 2: Review & Submit */
          <div className="space-y-5">
            <div className="alert alert-safe">
              <CheckCircle2 className="h-5 w-5 text-brand-700 shrink-0" />
              <div className="text-xs">
                <strong>Review Inspection Before Signing:</strong> This will create an immutable, cryptographic audit log entry for batch <strong>{batch.id}</strong> signed by <strong>{inspectorIdentity}</strong>.
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 text-xs">
              <div className="card p-3">
                <span className="text-ink-500 block">Tamper Seal</span>
                <span className="font-bold text-ink-900 mt-0.5 block">{form.tamper_seal_condition}</span>
              </div>
              <div className="card p-3">
                <span className="text-ink-500 block">Seal Serial</span>
                <span className="font-bold text-ink-900 mt-0.5 block">{form.seal_serial_number || 'None'}</span>
              </div>
              <div className="card p-3">
                <span className="text-ink-500 block">Packaging</span>
                <span className="font-bold text-ink-900 mt-0.5 block">{form.packaging_status}</span>
              </div>
              <div className="card p-3">
                <span className="text-ink-500 block">Measured Quantity</span>
                <span className="font-bold text-ink-900 mt-0.5 block">
                  {form.actual_quantity} / {form.expected_quantity} {batch.product_type === 'MILK' ? 'L' : 'kg'}
                </span>
              </div>
              <div className="card p-3">
                <span className="text-ink-500 block">Temperature &amp; Humidity</span>
                <span className="font-bold text-ink-900 mt-0.5 block">
                  {form.temperature_c}°C · {form.humidity_percent}%
                </span>
              </div>
              <div className="card p-3">
                <span className="text-ink-500 block">Cold Chain</span>
                <span className="font-bold text-ink-900 mt-0.5 block">
                  {form.cold_chain_compliant ? 'Continuous compliant' : 'Deviation detected'}
                </span>
              </div>
              <div className="card p-3">
                <span className="text-ink-500 block">Final Verdict</span>
                <Badge tone={form.verdict === 'PASSED' ? 'safe' : form.verdict === 'FLAGGED' ? 'warn' : 'danger'}>
                  {form.verdict}
                </Badge>
              </div>
              <div className="card p-3">
                <span className="text-ink-500 block">Photo Attachment</span>
                <span className="font-bold text-ink-900 mt-0.5 block truncate">{form.evidence?.name || 'None'}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-card bg-canvas border border-ink-200 p-3 text-xs text-ink-600">
              <Fingerprint className="h-4 w-4 text-brand-800 shrink-0" />
              <span>A SHA-256 fingerprint will be computed and stored in the tamper-evident audit ledger.</span>
            </div>

            {error && <Alert tone="danger">{error}</Alert>}

            <div className="flex justify-between gap-3 border-t border-ink-100 pt-4">
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  setError('');
                  setStep('form');
                }}
                className="btn btn-secondary"
              >
                <ArrowLeft className="h-4 w-4" /> Edit
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={commit}
                className="btn btn-primary"
              >
                {submitting ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" /> Signing Inspection…
                  </>
                ) : (
                  <>
                    Sign &amp; Save Inspection <CheckCircle2 className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
