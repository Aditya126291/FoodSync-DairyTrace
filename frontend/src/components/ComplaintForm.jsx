import React, { useState } from 'react';
import { AlertCircle, LoaderCircle, Send, X } from 'lucide-react';
import { api } from '../api';

const inputClass = 'min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-stone-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10';
const labelClass = 'mb-1.5 block text-sm font-semibold text-stone-700';

export default function ComplaintForm({ batch, onClose, onSubmitted }) {
  const [form, setForm] = useState({
    reporter_name: '',
    facility_or_store: '',
    complaint_category: 'Packaging / Tamper Seal Issue',
    severity: 'MAJOR',
    adulterant_status: 'SUSPECTED',
    adulterant_findings: '',
    description: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const result = await api.createComplaint({
        ...form,
        batch_id: batch.id,
        product_name: batch.product_name,
        reporter_role: 'Customer / Retailer',
        intake_mode: 'MANUAL',
        record_quality_check: false,
      });
      onSubmitted?.(result);
    } catch (requestError) {
      setError(requestError.message || 'We could not send the report. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-stone-950/50 p-4 backdrop-blur-sm" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="complaint-title" className="my-auto max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-stone-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-stone-100 bg-[#fbfaf6] p-5 sm:p-6">
          <div><p className="text-xs font-bold uppercase tracking-[.16em] text-emerald-800">Product feedback</p><h2 id="complaint-title" className="mt-1 font-display text-2xl font-semibold text-stone-950">Report a concern</h2><p className="mt-1 text-sm text-stone-600">Your report will be linked to batch {batch.id} for the safety team to review.</p></div>
          <button type="button" onClick={onClose} aria-label="Close report form" className="rounded-xl p-2 text-stone-500 hover:bg-stone-100"><X className="h-5 w-5" /></button>
        </header>
        <form onSubmit={submit} className="space-y-5 p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className={labelClass} htmlFor="complaint-name">Your name</label><input id="complaint-name" required maxLength="120" className={inputClass} value={form.reporter_name} onChange={(e) => update('reporter_name', e.target.value)} placeholder="Name" /></div>
            <div><label className={labelClass} htmlFor="complaint-place">Store or purchase location</label><input id="complaint-place" required maxLength="140" className={inputClass} value={form.facility_or_store} onChange={(e) => update('facility_or_store', e.target.value)} placeholder="Store, town, or facility" /></div>
            <div><label className={labelClass} htmlFor="complaint-category">What is the concern about?</label><select id="complaint-category" className={inputClass} value={form.complaint_category} onChange={(e) => update('complaint_category', e.target.value)}><option>Packaging / Tamper Seal Issue</option><option>Cold-Chain / Storage Excursion</option><option>Microbial / Spoilage / Sourness</option><option>Chemical / Mycotoxin Contaminant</option><option>Compositional Non-Compliance (Fat/SNF)</option><option>Other Quality / Safety Concern</option></select></div>
            <div><label className={labelClass} htmlFor="complaint-severity">How urgent does it seem?</label><select id="complaint-severity" className={inputClass} value={form.severity} onChange={(e) => update('severity', e.target.value)}><option value="PRECAUTIONARY">Something to check</option><option value="MAJOR">Needs prompt review</option><option value="CRITICAL">Possible immediate safety risk</option></select></div>
            <div><label className={labelClass} htmlFor="complaint-adulterant">Contamination concern</label><select id="complaint-adulterant" className={inputClass} value={form.adulterant_status} onChange={(e) => update('adulterant_status', e.target.value)}><option value="SUSPECTED">Not sure / suspected</option><option value="POSITIVE">A test indicated contamination</option><option value="NEGATIVE">No contamination reported</option></select></div>
            <div><label className={labelClass} htmlFor="complaint-findings">Test or contamination details <span className="font-normal text-stone-500">(optional)</span></label><input id="complaint-findings" maxLength="2000" className={inputClass} value={form.adulterant_findings} onChange={(e) => update('adulterant_findings', e.target.value)} placeholder="For example, lab result or unusual odor" /></div>
            <div className="sm:col-span-2"><label className={labelClass} htmlFor="complaint-description">What happened?</label><textarea id="complaint-description" required minLength="5" maxLength="5000" rows="4" className={inputClass} value={form.description} onChange={(e) => update('description', e.target.value)} placeholder="Describe what you noticed and when…" /></div>
          </div>
          {error && <p role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
          <div className="flex flex-col-reverse justify-between gap-3 border-t border-stone-100 pt-4 sm:flex-row sm:items-center"><p className="text-xs text-stone-500">Batch ID: <strong>{batch.id}</strong> · Your report goes to the inspector inbox.</p><div className="flex gap-2"><button type="button" onClick={onClose} className="min-h-11 rounded-xl border border-stone-300 px-4 text-sm font-bold text-stone-700">Cancel</button><button disabled={submitting} type="submit" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-900 px-4 text-sm font-bold text-white disabled:opacity-60">{submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{submitting ? 'Sending…' : 'Send report'}</button></div></div>
        </form>
      </section>
    </div>
  );
}
