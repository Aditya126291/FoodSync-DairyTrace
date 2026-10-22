import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, FileImage, Fingerprint, LoaderCircle, ShieldCheck, Upload, X } from 'lucide-react';
import { api } from '../api';

const initialForm = (batch) => ({
  tamper_seal_condition: 'INTACT', seal_serial_number: '', packaging_status: 'NORMAL',
  expected_quantity: Number(batch.initial_quantity || 0), actual_quantity: '',
  temperature_c: '', humidity_percent: '', cold_chain_compliant: false,
  verdict: 'PASSED', notes: '', inspector_name: sessionStorage.getItem('dairytrace.inspectorName') || '', evidence: null,
});

const fieldClass = 'min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-stone-900 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10';
const labelClass = 'mb-1.5 block text-sm font-semibold text-stone-700';

function ReadonlyField({ label, value }) {
  return <div><span className={labelClass}>{label}</span><div className="flex min-h-11 items-center rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-sm font-medium text-stone-700">{value || 'Not recorded'}</div></div>;
}

export default function SecurityInspectionForm({ batch, onCancel, onSubmitted }) {
  const [form, setForm] = useState(() => initialForm(batch));
  const [step, setStep] = useState('form');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [filePreview, setFilePreview] = useState('');

  useEffect(() => {
    if (!form.evidence) { setFilePreview(''); return undefined; }
    const url = URL.createObjectURL(form.evidence);
    setFilePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [form.evidence]);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const openPreview = (event) => {
    event.preventDefault();
    if (Number(form.humidity_percent) < 0 || Number(form.humidity_percent) > 100) {
      setError('Humidity must be between 0% and 100%.');
      return;
    }
    if (form.evidence && form.evidence.size > 10 * 1024 * 1024) {
      setError('Choose a photo that is 10 MB or smaller.');
      return;
    }
    setError('');
    sessionStorage.setItem('dairytrace.inspectorName', form.inspector_name.trim());
    setStep('review');
  };

  const commit = async () => {
    setSubmitting(true);
    setError('');
    try {
      await api.submitInspection(batch.id, form);
      onSubmitted?.();
    } catch (submitError) {
      setError(submitError.message || 'The security check could not be saved. Check your connection and try again.');
      setSubmitting(false);
    }
  };

  const stamp = new Date().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  const options = (values) => values.map(([value, label]) => <option key={value} value={value}>{label}</option>);

  return (
    <section className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm" aria-labelledby="inspection-title">
      <div className="flex items-start justify-between gap-4 border-b border-stone-100 bg-[#fbfaf6] p-5 sm:p-6">
        <div className="flex gap-3.5"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-900 text-white"><ShieldCheck className="h-5 w-5" /></span><div><p className="text-xs font-bold uppercase tracking-[.16em] text-emerald-800">Manual audit</p><h2 id="inspection-title" className="mt-1 font-display text-xl font-semibold text-stone-900">Security check · {batch.id}</h2><p className="mt-1 text-sm text-stone-600">Record what you can see and measure at the product.</p></div></div>
        <button type="button" onClick={onCancel} aria-label="Close security check" className="rounded-xl p-2 text-stone-500 hover:bg-stone-100"><X className="h-5 w-5" /></button>
      </div>

      <div className="p-5 sm:p-7">
        {step === 'form' ? (
          <form onSubmit={openPreview} className="space-y-7">
            <section><div className="mb-4"><h3 className="text-sm font-bold text-stone-900">Batch details</h3><p className="mt-1 text-xs text-stone-500">Loaded from the batch record and locked for this check.</p></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <ReadonlyField label="Batch ID" value={batch.id} /><ReadonlyField label="Product" value={batch.product_type === 'MILK' ? 'Fresh milk' : 'Paneer'} /><ReadonlyField label="Origin / facility" value={batch.facility_name} /><ReadonlyField label="Manufactured" value={new Date(batch.production_date).toLocaleDateString()} /><ReadonlyField label="Expires" value={batch.expiry_date ? new Date(batch.expiry_date).toLocaleDateString() : 'Not recorded'} /><ReadonlyField label="Batch signature" value="Not recorded" />
            </div></section>

            <section><div className="mb-4"><h3 className="text-sm font-bold text-stone-900">Physical integrity</h3></div><div className="grid gap-4 sm:grid-cols-2">
              <div><label className={labelClass}>Tamper seal condition</label><select required className={fieldClass} value={form.tamper_seal_condition} onChange={(e) => update('tamper_seal_condition', e.target.value)}>{options([['INTACT','Intact'],['BROKEN','Broken'],['SUSPICIOUS','Suspicious'],['NA','Not applicable']])}</select></div>
              <div><label className={labelClass}>Seal serial number <span className="font-normal text-stone-500">(optional)</span></label><input className={fieldClass} value={form.seal_serial_number} maxLength="100" onChange={(e) => update('seal_serial_number', e.target.value)} placeholder="Read from the package" /></div>
              <div><label className={labelClass}>Packaging status</label><select required className={fieldClass} value={form.packaging_status} onChange={(e) => update('packaging_status', e.target.value)}>{options([['NORMAL','Normal'],['DAMAGED','Damaged'],['RESEALED','Resealed']])}</select></div>
              <div><label className={labelClass}>Expected quantity</label><input className={`${fieldClass} bg-stone-50`} readOnly value={`${form.expected_quantity} ${batch.product_type === 'MILK' ? 'L' : 'kg'}`} /></div>
              <div><label className={labelClass}>Actual quantity received</label><div className="relative"><input required type="number" min="0" step="0.01" className={`${fieldClass} pr-14`} value={form.actual_quantity} onChange={(e) => update('actual_quantity', e.target.value)} placeholder="Enter quantity" /><span className="absolute right-3.5 top-3 text-sm text-stone-500">{batch.product_type === 'MILK' ? 'L' : 'kg'}</span></div></div>
            </div></section>

            <section><div className="mb-4"><h3 className="text-sm font-bold text-stone-900">Storage conditions</h3></div><div className="grid gap-4 sm:grid-cols-2">
              <div><label className={labelClass}>Temperature at check (°C)</label><input required type="number" min="-50" max="100" step="0.1" className={fieldClass} value={form.temperature_c} onChange={(e) => update('temperature_c', e.target.value)} placeholder="e.g. 4.0" /></div>
              <div><label className={labelClass}>Humidity (%)</label><input required type="number" min="0" max="100" step="0.1" className={fieldClass} value={form.humidity_percent} onChange={(e) => update('humidity_percent', e.target.value)} placeholder="0–100" /></div>
              <label className="flex min-h-12 items-center gap-3 rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-3 text-sm text-stone-700 sm:col-span-2"><input type="checkbox" className="h-5 w-5 rounded accent-emerald-800" checked={form.cold_chain_compliant} onChange={(e) => update('cold_chain_compliant', e.target.checked)} />Cold chain was maintained during storage and transport</label>
            </div></section>

            <section><div className="mb-4"><h3 className="text-sm font-bold text-stone-900">Verdict and evidence</h3></div><div className="grid gap-4 sm:grid-cols-2">
              <div><label className={labelClass}>Inspection verdict</label><select required className={fieldClass} value={form.verdict} onChange={(e) => update('verdict', e.target.value)}>{options([['PASSED','Passed'],['FLAGGED','Flagged for review'],['REJECTED','Rejected / quarantine']])}</select></div>
              <div><label className={labelClass}>Inspector name / ID</label><input required minLength="1" maxLength="100" className={fieldClass} value={form.inspector_name} onChange={(e) => update('inspector_name', e.target.value)} placeholder="Your name or staff ID" /></div>
              <div className="sm:col-span-2"><label className={labelClass}>Notes or discrepancies <span className="font-normal text-stone-500">(optional)</span></label><textarea rows="3" maxLength="5000" className={fieldClass} value={form.notes} onChange={(e) => update('notes', e.target.value)} placeholder="Describe any damage, unusual smell, broken seals, or other observations…" /></div>
              <div className="sm:col-span-2"><label className={labelClass}>Photo evidence <span className="font-normal text-stone-500">(optional · JPEG, PNG, or WebP, up to 10 MB)</span></label><label className="flex min-h-20 cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-4 py-4 transition hover:border-emerald-600 hover:bg-emerald-50/40"><span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-emerald-800 shadow-sm">{form.evidence ? <FileImage className="h-5 w-5" /> : <Upload className="h-5 w-5" />}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-stone-800">{form.evidence?.name || 'Add a photo of the package or seal'}</span><span className="mt-1 block text-xs text-stone-500">Choose an image from this device</span></span><input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => update('evidence', e.target.files?.[0] || null)} /></label>{filePreview && <div className="mt-3 flex items-center gap-3"><img src={filePreview} alt="Selected evidence preview" className="h-16 w-16 rounded-xl border border-stone-200 object-cover" /><button type="button" onClick={() => update('evidence', null)} className="text-sm font-semibold text-rose-700">Remove photo</button></div>}</div>
            </div></section>

            {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
            <div className="flex flex-col-reverse justify-between gap-3 border-t border-stone-100 pt-5 sm:flex-row"><p className="text-xs text-stone-500">Inspector timestamp: {stamp}</p><button type="submit" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-900 px-5 text-sm font-bold text-white transition hover:bg-emerald-950">Review inspection <ArrowRight className="h-4 w-4" /></button></div>
          </form>
        ) : (
          <div className="panel-enter space-y-6">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4"><div className="flex items-center gap-2 font-bold text-emerald-950"><CheckCircle2 className="h-5 w-5" /> Review before saving</div><p className="mt-1 text-sm text-emerald-900/80">This creates a permanent inspection log for {batch.id}.</p></div>
            <dl className="grid gap-3 sm:grid-cols-2">{[
              ['Tamper seal',form.tamper_seal_condition],['Seal serial',form.seal_serial_number || 'Not provided'],['Packaging',form.packaging_status],['Quantity',`${form.actual_quantity} / ${form.expected_quantity} ${batch.product_type === 'MILK' ? 'L' : 'kg'}`],['Temperature',`${form.temperature_c} °C`],['Humidity',`${form.humidity_percent}%`],['Cold chain',form.cold_chain_compliant ? 'Confirmed' : 'Not confirmed'],['Verdict',form.verdict],['Inspector',form.inspector_name],['Timestamp',stamp],['Notes',form.notes || 'None'],['Photo',form.evidence?.name || 'None'],
            ].map(([label,value]) => <div key={label} className="rounded-xl border border-stone-200 p-3"><dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</dt><dd className="mt-1 break-words text-sm font-semibold text-stone-800">{value}</dd></div>)}</dl>
            <div className="flex items-center gap-2 rounded-xl bg-stone-50 px-4 py-3 text-xs text-stone-600"><Fingerprint className="h-4 w-4 shrink-0" />A SHA-256 record fingerprint will be generated when this inspection is saved.</div>
            {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
            <div className="flex flex-col-reverse justify-between gap-3 border-t border-stone-100 pt-5 sm:flex-row"><button type="button" disabled={submitting} onClick={() => { setError(''); setStep('form'); }} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-stone-300 px-5 text-sm font-bold text-stone-700 disabled:opacity-50"><ArrowLeft className="h-4 w-4" /> Edit details</button><button type="button" disabled={submitting} onClick={commit} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-900 px-5 text-sm font-bold text-white transition hover:bg-emerald-950 disabled:opacity-60">{submitting ? <><LoaderCircle className="h-4 w-4 animate-spin" /> Saving check…</> : <>Save inspection <CheckCircle2 className="h-4 w-4" /></>}</button></div>
          </div>
        )}
      </div>
    </section>
  );
}
