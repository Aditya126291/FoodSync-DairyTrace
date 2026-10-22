import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, ChevronDown, ClipboardCheck, Fingerprint, FlaskConical, MessageSquareWarning, PackageCheck, QrCode, RefreshCw, Search, ShieldAlert, ShieldCheck, Store, Thermometer, TriangleAlert } from 'lucide-react';
import QrScanner from '../components/QrScanner';
import SecurityInspectionForm from '../components/SecurityInspectionForm';
import LineageGraph from '../components/LineageGraph';
import { api } from '../api';
import { extractBatchId } from '../utils/qr';

const statusNames = { ACTIVE: 'Active', QUARANTINED: 'On hold', RECALLED: 'Recalled' };
const prettyDate = (value) => value ? new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Not recorded';

function Section({ title, subtitle, count, children, defaultOpen = false }) {
  return <details open={defaultOpen} className="group overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
    <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 sm:px-5 [&::-webkit-details-marker]:hidden"><span><span className="block text-sm font-bold text-stone-900">{title}</span>{subtitle && <span className="mt-1 block text-xs text-stone-500">{subtitle}</span>}</span><span className="flex items-center gap-3"><span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-600">{count}</span><ChevronDown className="h-4 w-4 text-stone-500 transition group-open:rotate-180" /></span></summary>
    <div className="border-t border-stone-100 p-4 sm:p-5">{children}</div>
  </details>;
}

function ComplaintInbox({ complaints, loading, error, onRefresh, onSelectBatch, onMarkReview, onSafetyAction, busyId = null }) {
  const urgentCount = complaints.filter((item) => item.safety_alert_recommended && item.status !== 'RECALL_TRIGGERED').length;
  return <Section title="Complaint inbox" subtitle="Reports submitted from product passports and the safety team ledger" count={`${complaints.length} reports`} defaultOpen={urgentCount > 0}>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-stone-500">{urgentCount ? `${urgentCount} report${urgentCount === 1 ? '' : 's'} recommend a safety review.` : 'New reports appear here for inspector review.'}</p><button type="button" onClick={onRefresh} disabled={loading} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-stone-300 px-3 text-xs font-bold text-stone-700 hover:bg-stone-50 disabled:opacity-60"><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />Refresh inbox</button></div>
    {error && <p role="alert" className="mb-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    {loading && complaints.length === 0 ? <p className="rounded-xl bg-stone-50 p-4 text-sm text-stone-500">Loading complaint reports…</p> : complaints.length ? <div className="space-y-3">{complaints.map((item) => {
      const safetyFlag = item.safety_alert_recommended || item.severity === 'CRITICAL' || ['POSITIVE', 'SUSPECTED'].includes(item.adulterant_status);
      const severityTone = item.severity === 'CRITICAL' ? 'border-rose-200 bg-rose-50 text-rose-800' : item.severity === 'MAJOR' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-stone-200 bg-stone-50 text-stone-700';
      return <article key={item.id} className={`rounded-2xl border p-4 ${safetyFlag ? 'border-amber-200 bg-amber-50/20' : 'border-stone-200 bg-white'}`}>
        <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-bold text-stone-900">{item.complaint_ref} <span className="font-medium text-stone-500">· Batch {item.batch_id}</span></h3><span className={`rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase ${severityTone}`}>{item.severity}</span>{safetyFlag && <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800"><MessageSquareWarning className="h-3 w-3" />Safety review</span>}</div><p className="mt-1 text-xs text-stone-500">{item.complaint_category} · {item.reporter_name} · {prettyDate(item.created_at)}</p></div><span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase text-stone-600">{item.status.replaceAll('_', ' ')}</span></div>
        <p className="mt-3 text-sm leading-6 text-stone-700">{item.description}</p>{item.adulterant_findings && <p className="mt-2 text-xs text-stone-600"><strong>Contamination details:</strong> {item.adulterant_findings}</p>}
        <div className="mt-3 flex flex-wrap gap-2">{item.batch_exists !== false && <button type="button" onClick={() => onSelectBatch(item.batch_id)} className="min-h-9 rounded-lg border border-stone-300 px-3 text-xs font-bold text-stone-700 hover:bg-stone-50">Open batch audit</button>}{item.status === 'OPEN' && <button type="button" disabled={busyId === item.id} onClick={() => onMarkReview(item)} className="min-h-9 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-900 disabled:opacity-60">{busyId === item.id ? 'Updating…' : 'Mark under review'}</button>}{safetyFlag && item.batch_exists !== false && item.status !== 'RECALL_TRIGGERED' && <button type="button" onClick={() => onSafetyAction(item)} className="min-h-9 rounded-lg bg-rose-800 px-3 text-xs font-bold text-white hover:bg-rose-900">Preview safety action</button>}{item.batch_exists === false && <span className="self-center text-xs text-rose-700">Batch ID is not in the current registry.</span>}</div>
      </article>;
    })}</div> : !error && <p className="rounded-xl bg-stone-50 p-4 text-sm text-stone-600">No complaint reports are recorded yet.</p>}
  </Section>;
}

export default function InspectorHub({ batches, links, distributions, initialBatchId, auditRefreshVersion = 0, onSelectBatch, onOpenCreateBatch, onOpenRecall, onOpenComplaint, onViewPassport, onNotify }) {
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [quality, setQuality] = useState([]);
  const [inspections, setInspections] = useState([]);
  const [recalls, setRecalls] = useState([]);
  const [globalInspections, setGlobalInspections] = useState([]);
  const [globalRecalls, setGlobalRecalls] = useState([]);
  const [globalComplaints, setGlobalComplaints] = useState([]);
  const [complaintLoading, setComplaintLoading] = useState(false);
  const [complaintError, setComplaintError] = useState('');
  const [busyComplaintId, setBusyComplaintId] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [historyError, setHistoryError] = useState('');

  const loadHistory = async (batchId) => {
    if (!batchId) return;
    setLoadingDetails(true);
    setHistoryError('');
    try {
      const [checks, recallEvents, qualityRecords] = await Promise.all([
        api.getInspections(batchId), api.getRecallHistory(), api.getQualityRecords(batchId),
      ]);
      setInspections(checks || []);
      setRecalls((recallEvents || []).filter((event) => {
        let affected = [];
        try { affected = JSON.parse(event.affected_batches_json || '[]'); } catch { /* older event payload */ }
        return event.root_batch_id === batchId || affected.includes(batchId);
      }));
      setQuality(qualityRecords || []);
    } catch (error) {
      setHistoryError(error.message || 'Could not load inspection history.');
      setInspections([]);
      setRecalls([]);
      setQuality([]);
    } finally {
      setLoadingDetails(false);
    }
  };

  const loadComplaints = async () => {
    setComplaintLoading(true);
    setComplaintError('');
    try {
      setGlobalComplaints(await api.getComplaints() || []);
    } catch (error) {
      setComplaintError(error.message || 'Complaint reports could not be loaded. Check your connection and retry.');
    } finally {
      setComplaintLoading(false);
    }
  };

  const markComplaintUnderReview = async (complaint) => {
    setBusyComplaintId(complaint.id);
    setComplaintError('');
    try {
      await api.updateComplaintStatus(complaint.id, 'UNDER_REVIEW');
      await loadComplaints();
      onNotify('Complaint marked under review.');
    } catch (error) {
      setComplaintError(error.message || 'Could not update this complaint.');
    } finally {
      setBusyComplaintId(null);
    }
  };

  useEffect(() => {
    if (!initialBatchId) return;
    const existing = batches.find((batch) => batch.id === initialBatchId);
    if (existing) setSelectedBatch(existing);
    else api.getBatch(initialBatchId).then(setSelectedBatch).catch((error) => setSearchError(error.message || 'Batch not found.'));
    setQuery('');
  }, [batches, initialBatchId]);

  useEffect(() => {
    if (!selectedBatch?.id) return;
    loadHistory(selectedBatch.id);
  }, [selectedBatch?.id]);

  useEffect(() => {
    Promise.all([api.getInspections(), api.getRecallHistory()])
      .then(([checks, recallEvents]) => {
        setGlobalInspections(checks || []);
        setGlobalRecalls(recallEvents || []);
      })
      .catch(() => setHistoryError('Recent audit activity could not be loaded. Check your connection.'));
  }, []);

  useEffect(() => { loadComplaints(); }, [auditRefreshVersion]);

  useEffect(() => {
    const search = query.trim();
    if (search.length < 2) { setMatches([]); setSearchError(''); return undefined; }
    let active = true;
    const timer = setTimeout(async () => {
      setSearching(true);
      setSearchError('');
      try {
        const found = await api.lookupBatches(search);
        if (active) {
          setMatches(found || []);
          if (!found?.length) setSearchError('No batches match that ID, SKU, or serial number.');
        }
      } catch (error) {
        if (active) setSearchError(error.message || 'Search failed. Check your connection and retry.');
      } finally { if (active) setSearching(false); }
    }, 280);
    return () => { active = false; clearTimeout(timer); };
  }, [query]);

  const chooseBatch = (batch) => {
    setSelectedBatch(batch);
    setQuery('');
    setMatches([]);
    setSearchError('');
    setFormOpen(false);
    onSelectBatch(batch.id);
  };

  const handleScan = async (raw) => {
    const id = extractBatchId(raw);
    if (!id) { setSearchError('That QR code is not a DairyTrace product code.'); return; }
    setSearching(true);
    setSearchError('');
    try {
      const found = await api.lookupBatches(id);
      const exact = found.find((batch) => batch.id.toLowerCase() === id.toLowerCase());
      if (exact) chooseBatch(exact);
      else if (found.length === 1) chooseBatch(found[0]);
      else if (found.length > 1) setMatches(found);
      else setSearchError(`Batch ${id} was not found. Check the code and scan again.`);
    } catch (error) { setSearchError(error.message || 'Could not check this batch. Check your connection.'); }
    finally { setSearching(false); }
  };

  const relevantRecallIds = useMemo(() => recalls.map((event) => event.id), [recalls]);
  const safetyTone = selectedBatch?.status === 'RECALLED' ? 'rose' : selectedBatch?.status === 'QUARANTINED' ? 'amber' : 'emerald';
  const safetyStyle = safetyTone === 'rose'
    ? { border: 'border-rose-200', bg: 'bg-rose-50', text: 'text-rose-800' }
    : safetyTone === 'amber'
      ? { border: 'border-amber-200', bg: 'bg-amber-50', text: 'text-amber-800' }
      : { border: 'border-emerald-200', bg: 'bg-emerald-50', text: 'text-emerald-800' };
  const relatedDeliveries = useMemo(() => {
    if (!selectedBatch) return [];
    const connectedIds = new Set([
      selectedBatch.id,
      ...links.filter((link) => link.parent_batch_id === selectedBatch.id).map((link) => link.child_batch_id),
    ]);
    return distributions.filter((item) => connectedIds.has(item.batch_id));
  }, [selectedBatch, links, distributions]);
  const safetyIcon = safetyTone === 'rose' ? ShieldAlert : safetyTone === 'amber' ? TriangleAlert : ShieldCheck;
  const SafetyIcon = safetyIcon;
  const visibleComplaints = selectedBatch
    ? globalComplaints.filter((complaint) => complaint.batch_id === selectedBatch.id)
    : globalComplaints;

  return (
    <div className="min-h-screen bg-[#faf8f2] text-stone-800">
      <main className="mx-auto max-w-7xl space-y-7 px-4 py-7 sm:px-7 sm:py-9 lg:px-10">
        <section className="flex flex-col justify-between gap-5 rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:flex-row sm:items-end sm:p-7">
          <div><p className="text-xs font-bold uppercase tracking-[.17em] text-emerald-800">Inspector workspace</p><h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-stone-950">Batch audit hub</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">Scan a product or look up a batch to review its journey, quality, deliveries, and inspection history in one place.</p></div>
          <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setScanOpen((value) => !value)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-stone-300 bg-white px-4 text-sm font-bold text-stone-800 hover:bg-stone-50"><QrCode className="h-4 w-4 text-emerald-800" /> Scan QR</button></div>
        </section>

        {scanOpen && <QrScanner title="Scan a batch QR" description="Scan a DairyTrace passport code or upload an image of the label." onScan={handleScan} onClose={() => setScanOpen(false)} />}

        <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-900"><Search className="h-5 w-5" /></span><div><h2 className="text-base font-bold text-stone-900">Find any batch</h2><p className="mt-1 text-sm text-stone-600">Search by batch ID, SKU, or serial number. Select a result to open its audit.</p></div></div>
          <div className="relative mt-4"><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} className="min-h-12 w-full rounded-xl border border-stone-300 bg-[#faf9f5] pl-11 pr-4 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10" placeholder="e.g. PAN-201 or scan a product QR" aria-label="Search batches by ID, SKU, or serial number" /><Search className="absolute left-4 top-3.5 h-4 w-4 text-stone-400" />
            {(matches.length > 0 || searching) && <div className="absolute z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-2xl border border-stone-200 bg-white p-2 shadow-xl">{searching && <p className="px-3 py-2 text-sm text-stone-500">Searching batches…</p>}{matches.map((batch) => <button key={batch.id} type="button" onClick={() => chooseBatch(batch)} className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left hover:bg-emerald-50"><span><strong className="block text-sm text-stone-900">{batch.id} <span className="font-normal text-stone-500">· {batch.product_type === 'MILK' ? 'Fresh milk' : 'Paneer'}</span></strong><span className="mt-0.5 block text-xs text-stone-500">{batch.facility_name}{batch.sku ? ` · SKU ${batch.sku}` : ''}{batch.serial_number ? ` · Serial ${batch.serial_number}` : ''}</span></span><ArrowRight className="h-4 w-4 shrink-0 text-emerald-800" /></button>)}</div>}
          </div>
          {searchError && !matches.length && query.trim().length >= 2 && <p role="status" className="mt-3 rounded-xl bg-stone-50 px-3 py-2 text-sm text-stone-600">{searchError}</p>}
          {searchError && matches.length > 0 && <p role="alert" className="mt-3 text-sm text-rose-700">{searchError}</p>}
        </section>

        {selectedBatch ? (
          <div className="space-y-4 panel-enter">
            <section className={`rounded-3xl border ${safetyStyle.border} bg-white p-5 shadow-sm sm:p-7`}>
              <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
                <div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-stone-700">{selectedBatch.product_type === 'MILK' ? 'Fresh milk' : 'Paneer'}</span><span className={`inline-flex items-center gap-1.5 rounded-full ${safetyStyle.bg} px-3 py-1 text-xs font-bold ${safetyStyle.text}`}><SafetyIcon className="h-3.5 w-3.5" />{statusNames[selectedBatch.status] || selectedBatch.status}</span></div><h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-stone-950">{selectedBatch.id}</h2><p className="mt-1 text-sm text-stone-600">{selectedBatch.facility_name}</p></div>
                <div className="flex flex-wrap gap-2"><button type="button" onClick={() => onOpenComplaint?.(selectedBatch.id)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-stone-300 bg-white px-4 text-sm font-bold text-stone-800 hover:border-emerald-600 hover:bg-emerald-50 hover:text-emerald-950 transition"><FlaskConical className="h-4 w-4 text-emerald-800" /> Log complaint / report</button><button type="button" onClick={() => setFormOpen(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-900 px-4 text-sm font-bold text-white hover:bg-emerald-950"><ClipboardCheck className="h-4 w-4" /> Record security check</button><button type="button" onClick={() => onViewPassport(selectedBatch.id)} className="min-h-11 rounded-xl border border-stone-300 px-4 text-sm font-bold text-stone-700 hover:bg-stone-50">Public passport</button><button type="button" onClick={() => onOpenRecall(selectedBatch.id)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-bold text-rose-800 hover:bg-rose-100"><ShieldAlert className="h-4 w-4" /> Safety action</button></div>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-2xl bg-[#faf9f5] p-3.5"><span className="text-xs text-stone-500">Production date</span><strong className="mt-1 block text-sm text-stone-900">{prettyDate(selectedBatch.production_date)}</strong></div><div className="rounded-2xl bg-[#faf9f5] p-3.5"><span className="text-xs text-stone-500">Expiry date</span><strong className="mt-1 block text-sm text-stone-900">{prettyDate(selectedBatch.expiry_date)}</strong></div><div className="rounded-2xl bg-[#faf9f5] p-3.5"><span className="text-xs text-stone-500">Quantity</span><strong className="mt-1 block text-sm text-stone-900">{Number(selectedBatch.initial_quantity || 0).toLocaleString()} {selectedBatch.product_type === 'MILK' ? 'L' : 'kg'}</strong></div><div className="rounded-2xl bg-[#faf9f5] p-3.5"><span className="text-xs text-stone-500">Digital signature</span><strong className="mt-1 block text-sm text-stone-900">Not recorded</strong></div></div>
              {(selectedBatch.sku || selectedBatch.serial_number) && <p className="mt-3 text-xs text-stone-500">{selectedBatch.sku && `SKU ${selectedBatch.sku}`}{selectedBatch.sku && selectedBatch.serial_number && ' · '}{selectedBatch.serial_number && `Serial ${selectedBatch.serial_number}`}</p>}
            </section>

            <ComplaintInbox complaints={visibleComplaints} loading={complaintLoading} error={complaintError} onRefresh={loadComplaints} onSelectBatch={(id) => { const batch = batches.find((item) => item.id === id); if (batch) chooseBatch(batch); }} onMarkReview={markComplaintUnderReview} onSafetyAction={(complaint) => onOpenRecall(complaint.batch_id, complaint.adulterant_findings || complaint.description)} busyId={busyComplaintId} />

            {formOpen && <SecurityInspectionForm key={selectedBatch.id} batch={selectedBatch} onCancel={() => setFormOpen(false)} onSubmitted={async () => { setFormOpen(false); await loadHistory(selectedBatch.id); onNotify('Security check saved to the batch audit history.'); }} />}

            <div className="grid gap-4 lg:grid-cols-2">
              <Section title="Journey" subtitle="Connected milk inputs, products, and stores" count="Batch connections">
                <LineageGraph batches={batches} links={links} distributions={distributions} selectedBatchId={selectedBatch.id} compact onSelectBatch={(id) => { const batch = batches.find((item) => item.id === id); if (batch) chooseBatch(batch); }} onOpenRecallModal={onOpenRecall} onViewPassport={onViewPassport} />
              </Section>
              <Section title="Quality checks" subtitle="Lab tests recorded for this batch" count={`${quality.length} ${quality.length === 1 ? 'record' : 'records'}`}>
                {loadingDetails ? <p className="text-sm text-stone-500">Loading quality details…</p> : quality.length ? <div className="space-y-3">{quality.map((record) => <article key={record.id} className="rounded-xl border border-stone-200 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-sm font-bold text-stone-900">{record.lab_name}</h3><p className="mt-1 text-xs text-stone-500">{prettyDate(record.test_date)}</p></div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">{record.trust_level?.replaceAll('_',' ')}</span></div><p className="mt-3 text-sm text-stone-600">Fat {record.fat_percentage}% · SNF {record.snf_percentage}% · Acidity {record.acidity}% · Adulterant {record.adulterant_test?.toLowerCase()}</p></article>)}</div> : <p className="rounded-xl bg-stone-50 p-4 text-sm text-stone-600">No lab quality record is attached to this batch yet.</p>}
              </Section>
              <Section title="Deliveries" subtitle="Where this batch or its products were sent" count={`${relatedDeliveries.length} ${relatedDeliveries.length === 1 ? 'delivery' : 'deliveries'}`}>
                {relatedDeliveries.length ? <div className="space-y-2">{relatedDeliveries.map((delivery) => <div key={delivery.id} className="flex items-center gap-3 rounded-xl border border-stone-200 p-3"><Store className="h-4 w-4 shrink-0 text-emerald-800" /><div className="min-w-0"><p className="truncate text-sm font-semibold text-stone-800">{delivery.destination_name}</p><p className="text-xs text-stone-500">{delivery.location} · {delivery.quantity_dispatched} units · Batch {delivery.batch_id}</p></div></div>)}</div> : <p className="rounded-xl bg-stone-50 p-4 text-sm text-stone-600">No delivery has been recorded for this batch or connected products.</p>}
              </Section>
              <Section title="Security & audit history" subtitle="Manual inspections, tamper flags, and recall activity" count={`${inspections.length + relevantRecallIds.length} events`}>
                {historyError && <p role="alert" className="mb-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{historyError}</p>}
                {loadingDetails ? <p className="text-sm text-stone-500">Loading audit history…</p> : inspections.length || recalls.length ? <div className="space-y-3">
                  {inspections.map((inspection) => <article key={`inspection-${inspection.id}`} className={`rounded-xl border p-4 ${inspection.verdict === 'PASSED' ? 'border-emerald-200 bg-emerald-50/40' : 'border-amber-200 bg-amber-50/50'}`}><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-bold text-stone-900">{inspection.verdict.replaceAll('_',' ')} · Security check</p><p className="mt-1 text-xs text-stone-500">{inspection.inspector_name} · {prettyDate(inspection.created_at)}</p></div><span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-stone-600">Seal {inspection.tamper_seal_condition.toLowerCase()}</span></div><div className="mt-3 grid gap-2 text-xs text-stone-600 sm:grid-cols-3"><span><Thermometer className="mr-1 inline h-3.5 w-3.5" />{inspection.temperature_c}°C · {inspection.humidity_percent}% humidity</span><span>{inspection.cold_chain_compliant ? 'Cold chain confirmed' : 'Cold chain not confirmed'}</span><span className="truncate"><Fingerprint className="mr-1 inline h-3.5 w-3.5" />{inspection.record_sha256?.slice(0,16)}…</span></div>{inspection.notes && <p className="mt-3 text-sm text-stone-700">{inspection.notes}</p>}{inspection.evidence_url && <a className="mt-3 inline-flex text-sm font-semibold text-emerald-800 underline" href={api.getEvidenceUrl(inspection.evidence_url)} target="_blank" rel="noreferrer">View photo evidence</a>}</article>)}
                  {recalls.map((event) => <article key={`recall-${event.id}`} className="rounded-xl border border-rose-200 bg-rose-50/70 p-4"><div className="flex items-center gap-2 text-sm font-bold text-rose-900"><AlertTriangle className="h-4 w-4" />Safety / recall event · {event.severity}</div><p className="mt-1 text-xs text-rose-800">{prettyDate(event.created_at)} · initiated by {event.initiated_by}</p><p className="mt-2 text-sm text-rose-900">{event.reason}</p></article>)}
                </div> : <p className="rounded-xl bg-stone-50 p-4 text-sm text-stone-600">No manual inspection or recall events are recorded for this batch.</p>}
              </Section>
            </div>
          </div>
        ) : (
          <>
          <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-900"><PackageCheck className="h-6 w-6" /></span><h2 className="mt-4 font-display text-2xl font-semibold text-stone-900">Choose a batch to inspect</h2><p className="mt-2 max-w-xl text-sm leading-6 text-stone-600">Search by code above, choose a matching result, or scan a product QR to open its complete audit.</p></div><div className="grid grid-cols-2 gap-3"><div className="rounded-2xl bg-[#faf9f5] p-4"><span className="text-xs text-stone-500">Batches with safety flags</span><strong className="mt-1 block text-2xl text-stone-900">{batches.filter((batch) => batch.status === 'RECALLED' || batch.status === 'QUARANTINED').length}</strong></div><div className="rounded-2xl bg-[#faf9f5] p-4"><span className="text-xs text-stone-500">Recent audit events</span><strong className="mt-1 block text-2xl text-stone-900">{globalInspections.length + globalRecalls.length}</strong></div></div></div></section>
          <ComplaintInbox complaints={visibleComplaints} loading={complaintLoading} error={complaintError} onRefresh={loadComplaints} onSelectBatch={(id) => { const batch = batches.find((item) => item.id === id); if (batch) chooseBatch(batch); }} onMarkReview={markComplaintUnderReview} onSafetyAction={(complaint) => onOpenRecall(complaint.batch_id, complaint.adulterant_findings || complaint.description)} busyId={busyComplaintId} />
          <Section title="Recent safety activity" subtitle="Latest checks and recall events across batches" count={`${globalInspections.length + globalRecalls.length} events`}>
            {historyError && <p role="alert" className="mb-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{historyError}</p>}
            {globalInspections.length || globalRecalls.length ? <div className="space-y-2">{[...globalInspections.slice(0, 6).map((event) => ({ ...event, event_type: 'inspection' })), ...globalRecalls.slice(0, 6).map((event) => ({ ...event, event_type: 'recall' }))].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 8).map((event) => <button type="button" key={`${event.event_type}-${event.id}`} onClick={() => { const batch = batches.find((item) => item.id === event.batch_id || item.id === event.root_batch_id); if (batch) chooseBatch(batch); }} className="flex min-h-14 w-full items-center justify-between gap-4 rounded-xl border border-stone-200 px-4 py-3 text-left hover:bg-stone-50"><span><strong className="block text-sm text-stone-900">{event.event_type === 'recall' ? 'Safety / recall event' : `${event.verdict?.replaceAll('_', ' ') || 'Inspection'} · ${event.batch_id}`}</strong><span className="mt-1 block text-xs text-stone-500">{event.batch_id || event.root_batch_id} · {prettyDate(event.created_at)}</span></span><ArrowRight className="h-4 w-4 shrink-0 text-emerald-800" /></button>)}</div> : <p className="rounded-xl bg-stone-50 p-4 text-sm text-stone-600">No inspection or recall activity is recorded yet.</p>}
          </Section>
          </>
        )}
      </main>
    </div>
  );
}
