import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ClipboardCheck,
  FileText,
  Fingerprint,
  FlaskConical,
  Lock,
  MessageSquareWarning,
  Milk,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Store,
  Thermometer,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import SecurityInspectionForm from '../components/SecurityInspectionForm';
import LineageGraph from '../components/LineageGraph';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';

const statusNames = { ACTIVE: 'Active', QUARANTINED: 'On hold', RECALLED: 'Recalled' };
const prettyDate = (value) =>
  value
    ? new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
    : 'Not recorded';

function Section({ title, subtitle, count, action, children, defaultOpen = false }) {
  return (
    <details
      open={defaultOpen}
      className="group overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm"
    >
      <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 sm:px-5 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block text-sm font-bold text-stone-900">{title}</span>
          {subtitle && <span className="mt-1 block text-xs text-stone-500">{subtitle}</span>}
        </span>
        <span className="flex items-center gap-2.5">
          {action}
          <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-600">
            {count}
          </span>
          <ChevronDown className="h-4 w-4 text-stone-500 transition group-open:rotate-180" />
        </span>
      </summary>
      <div className="border-t border-stone-100 p-4 sm:p-5">{children}</div>
    </details>
  );
}

function ComplaintInbox({
  complaints,
  loading,
  error,
  isQA,
  onRefresh,
  onSelectBatch,
  onUpdateStatus,
  onDeleteComplaint,
  onSafetyAction,
  busyId = null,
}) {
  const urgentCount = complaints.filter(
    (item) =>
      ['Critical', 'High'].includes(item.severity) &&
      !['Recall triggered', 'Resolved'].includes(item.status)
  ).length;

  return (
    <Section
      title="QMS Complaint & Safety Inbox"
      subtitle="Consumer and staff reports filed from scanned batch passports and the AI Complaint Copilot"
      count={`${complaints.length} ${complaints.length === 1 ? 'report' : 'reports'}`}
      defaultOpen={ true }
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-stone-500">
          {urgentCount
            ? `${urgentCount} high/critical report${urgentCount === 1 ? '' : 's'} awaiting safety review.`
            : 'All submitted complaints and forensic lab extractions appear here.'}
        </p>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-stone-300 px-3 text-xs font-bold text-stone-700 hover:bg-stone-50 disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh inbox
        </button>
      </div>

      {error && (
        <p role="alert" className="mb-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">
          {error}
        </p>
      )}

      {loading && complaints.length === 0 ? (
        <p className="rounded-xl bg-stone-50 p-4 text-sm text-stone-500">
          Loading complaint reports…
        </p>
      ) : complaints.length ? (
        <div className="space-y-3">
          {complaints.map((item) => {
            const batchId = item.batchId || item.batchLotNumber;
            const sev = item.severity || 'Medium';
            const safetyFlag = ['Critical', 'High'].includes(sev);
            const severityTone =
              sev === 'Critical'
                ? 'border-rose-200 bg-rose-50 text-rose-800'
                : sev === 'High'
                ? 'border-amber-200 bg-amber-50 text-amber-800'
                : 'border-stone-200 bg-stone-50 text-stone-700';

            return (
              <article
                key={item.id}
                className={`rounded-2xl border p-4 ${
                  safetyFlag ? 'border-amber-200 bg-amber-50/20' : 'border-stone-200 bg-white'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold text-stone-900">
                        {item.complaintNumber}{' '}
                        <span className="font-medium text-stone-500">· Batch {batchId}</span>
                      </h3>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase ${severityTone}`}
                      >
                        {sev}
                      </span>
                      {safetyFlag && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                          <MessageSquareWarning className="h-3 w-3" />
                          Safety review
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-stone-500">
                      {item.complaintType || 'Quality Deviation'} ·{' '}
                      {item.customerName || 'Anonymous'} ({item.complaintSource || 'Consumer'}) ·{' '}
                      {item.complaintDate || prettyDate(item.createdAt)}
                    </p>
                  </div>
                  <span className="rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[10px] font-bold uppercase text-stone-700">
                    {item.status}
                  </span>
                </div>

                <p className="mt-2.5 text-sm font-semibold text-stone-800">
                  {item.defectSummary || item.detailedDescription}
                </p>
                {item.detailedDescription &&
                  item.detailedDescription !== item.defectSummary && (
                    <p className="mt-1 text-xs leading-5 text-stone-600">
                      {item.detailedDescription}
                    </p>
                  )}

                {(item.riskAssessment || item.rootCause) && (
                  <div className="mt-2.5 rounded-xl bg-stone-50 p-2.5 text-xs text-stone-700 space-y-1 border border-stone-200/70">
                    {item.riskAssessment && (
                      <p>
                        <strong>Risk Assessment:</strong> {item.riskAssessment}
                      </p>
                    )}
                    {item.rootCause && (
                      <p>
                        <strong>Root Cause Hypothesis:</strong> {item.rootCause}
                      </p>
                    )}
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {batchId && (
                    <button
                      type="button"
                      onClick={() => onSelectBatch(batchId)}
                      className="min-h-9 rounded-lg border border-stone-300 bg-white px-3 text-xs font-bold text-stone-700 hover:bg-stone-50"
                    >
                      Open batch {batchId} audit
                    </button>
                  )}

                  {item.status === 'Committed' && (
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => onUpdateStatus(item, 'Under review')}
                      className="min-h-9 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-900 hover:bg-emerald-100 disabled:opacity-60"
                    >
                      {busyId === item.id ? 'Updating…' : 'Mark Under review'}
                    </button>
                  )}

                  {item.status !== 'Resolved' && (
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => onUpdateStatus(item, 'Resolved')}
                      className="min-h-9 rounded-lg border border-stone-200 bg-stone-100 px-3 text-xs font-bold text-stone-700 hover:bg-stone-200 disabled:opacity-60"
                    >
                      Mark Resolved
                    </button>
                  )}

                  {safetyFlag && item.status !== 'Recall triggered' && batchId && (
                    <button
                      type="button"
                      onClick={() =>
                        onSafetyAction(
                          batchId,
                          item.defectSummary || item.detailedDescription || 'Complaint safety alert'
                        )
                      }
                      className="min-h-9 rounded-lg bg-rose-800 px-3 text-xs font-bold text-white hover:bg-rose-900"
                    >
                      {isQA ? 'Simulate / Run Recall' : 'Simulate Blast Radius'}
                    </button>
                  )}

                  {isQA && (
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => onDeleteComplaint(item)}
                      className="ml-auto inline-flex min-h-9 items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                      title="Delete complaint record (QA Officer only)"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        !error && (
          <p className="rounded-xl bg-stone-50 p-4 text-sm text-stone-600">
            No complaint reports are recorded for this view yet.
          </p>
        )
      )}
    </Section>
  );
}

export default function InspectorHub({
  batches,
  links,
  distributions,
  initialBatchId,
  auditRefreshVersion = 0,
  onSelectBatch,
  onClearBatch,
  onOpenCreateBatch,
  onOpenRecall,
  onOpenComplaintWorkspace,
  onOpenFssaiNotice,
  onViewPassport,
  onRefreshBatches,
  onNotify,
}) {
  const { user, isQA } = useAuth();
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [qualityFormOpen, setQualityFormOpen] = useState(false);
  const [dispatchFormOpen, setDispatchFormOpen] = useState(false);
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

  // Inline QA Quality Record form state
  const [newQuality, setNewQuality] = useState({
    lab_name: 'FoodSync Central QA Lab, Pune',
    fat_percentage: 4.6,
    snf_percentage: 8.7,
    acidity: 0.14,
    adulterant_test: 'NEGATIVE',
    trust_level: 'VERIFIED',
    contaminant_details: 'Compositional and adulterant parameters verified.',
  });

  // Inline QA Dispatch form state
  const [newDispatch, setNewDispatch] = useState({
    destination_name: '',
    destination_type: 'RETAILER',
    location: 'Pune, MH',
    quantity_dispatched: 25,
    contact_phone: '+91-9822011199',
  });

  const loadHistory = async (batchId) => {
    if (!batchId) return;
    setLoadingDetails(true);
    setHistoryError('');
    try {
      const [checks, recallEvents, qualityRecords] = await Promise.all([
        api.getInspections(batchId),
        api.getRecallHistory(),
        api.getQualityRecords(batchId),
      ]);
      setInspections(checks || []);
      setRecalls(
        (recallEvents || []).filter((event) => {
          let affected = event.affected_batches || [];
          if (!affected.length) {
            try {
              affected = JSON.parse(event.affected_batches_json || '[]');
            } catch {
              affected = [];
            }
          }
          return event.root_batch_id === batchId || affected.includes(batchId);
        })
      );
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
      setGlobalComplaints((await api.getComplaints()) || []);
    } catch (error) {
      setComplaintError(
        error.message || 'Complaint reports could not be loaded. Check your connection and retry.'
      );
    } finally {
      setComplaintLoading(false);
    }
  };

  const handleUpdateComplaintStatus = async (complaint, status) => {
    setBusyComplaintId(complaint.id);
    setComplaintError('');
    try {
      await api.updateComplaintStatus(complaint.id, status);
      await loadComplaints();
      onNotify(`Complaint ${complaint.complaintNumber} marked "${status}".`);
    } catch (error) {
      setComplaintError(error.message || 'Could not update this complaint.');
    } finally {
      setBusyComplaintId(null);
    }
  };

  const handleDeleteComplaint = async (complaint) => {
    if (!isQA) return;
    setBusyComplaintId(complaint.id);
    setComplaintError('');
    try {
      await api.deleteComplaint(complaint.id);
      await loadComplaints();
      onNotify(`Complaint ${complaint.complaintNumber} deleted.`);
    } catch (error) {
      setComplaintError(error.message || 'Could not delete this complaint.');
    } finally {
      setBusyComplaintId(null);
    }
  };

  useEffect(() => {
    if (!initialBatchId) {
      setSelectedBatch(null);
      return;
    }
    const existing = batches.find((batch) => batch.id === initialBatchId);
    if (existing) {
      setSelectedBatch(existing);
    } else {
      api
        .getBatch(initialBatchId)
        .then(setSelectedBatch)
        .catch((error) => setSearchError(error.message || 'Batch not found.'));
    }
    setQuery('');
  }, [batches, initialBatchId]);

  useEffect(() => {
    if (!selectedBatch?.id) return;
    loadHistory(selectedBatch.id);
  }, [selectedBatch?.id, auditRefreshVersion]);

  useEffect(() => {
    Promise.all([api.getInspections(), api.getRecallHistory()])
      .then(([checks, recallEvents]) => {
        setGlobalInspections(checks || []);
        setGlobalRecalls(recallEvents || []);
      })
      .catch(() =>
        setHistoryError('Recent audit activity could not be loaded. Check your connection.')
      );
  }, [auditRefreshVersion]);

  useEffect(() => {
    loadComplaints();
  }, [auditRefreshVersion]);

  useEffect(() => {
    const search = query.trim();
    if (search.length < 2) {
      setMatches([]);
      setSearchError('');
      return undefined;
    }
    let active = true;
    const timer = setTimeout(async () => {
      setSearching(true);
      setSearchError('');
      try {
        const found = await api.lookupBatches(search);
        if (active) {
          setMatches(found || []);
          if (!found?.length)
            setSearchError('No batches match that ID, SKU, or serial number.');
        }
      } catch (error) {
        if (active)
          setSearchError(error.message || 'Search failed. Check your connection and retry.');
      } finally {
        if (active) setSearching(false);
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  const chooseBatch = (batchOrId) => {
    const batchObj =
      typeof batchOrId === 'string'
        ? batches.find((item) => item.id === batchOrId)
        : batchOrId;
    const id = typeof batchOrId === 'string' ? batchOrId : batchOrId?.id;
    if (!id) return;
    if (batchObj) setSelectedBatch(batchObj);
    setQuery('');
    setMatches([]);
    setSearchError('');
    setFormOpen(false);
    setQualityFormOpen(false);
    setDispatchFormOpen(false);
    onSelectBatch(id);
  };

  const handleAddQualityRecord = async (e) => {
    e.preventDefault();
    if (!selectedBatch) return;
    try {
      await api.addQualityRecord({
        batch_id: selectedBatch.id,
        lab_name: newQuality.lab_name,
        fat_percentage: Number(newQuality.fat_percentage),
        snf_percentage: Number(newQuality.snf_percentage),
        acidity: Number(newQuality.acidity),
        adulterant_test: newQuality.adulterant_test,
        trust_level: newQuality.trust_level,
        contaminant_details: newQuality.contaminant_details,
      });
      setQualityFormOpen(false);
      await loadHistory(selectedBatch.id);
      onNotify(`Quality record attached to ${selectedBatch.id}.`);
    } catch (err) {
      onNotify(err.message || 'Could not add quality record.', 'error');
    }
  };

  const handleCreateDispatch = async (e) => {
    e.preventDefault();
    if (!selectedBatch) return;
    try {
      await api.createDistribution({
        batch_id: selectedBatch.id,
        destination_name: newDispatch.destination_name,
        destination_type: newDispatch.destination_type,
        location: newDispatch.location,
        quantity_dispatched: Number(newDispatch.quantity_dispatched),
        contact_phone: newDispatch.contact_phone,
      });
      setDispatchFormOpen(false);
      setNewDispatch((prev) => ({ ...prev, destination_name: '' }));
      await onRefreshBatches?.();
      onNotify(`Dispatch record added for ${selectedBatch.id}.`);
    } catch (err) {
      onNotify(err.message || 'Could not add dispatch record.', 'error');
    }
  };

  const relevantRecallIds = useMemo(() => recalls.map((event) => event.id), [recalls]);
  const safetyTone =
    selectedBatch?.status === 'RECALLED'
      ? 'rose'
      : selectedBatch?.status === 'QUARANTINED'
      ? 'amber'
      : 'emerald';
  const safetyStyle =
    safetyTone === 'rose'
      ? { border: 'border-rose-200', bg: 'bg-rose-50', text: 'text-rose-800' }
      : safetyTone === 'amber'
      ? { border: 'border-amber-200', bg: 'bg-amber-50', text: 'text-amber-800' }
      : { border: 'border-emerald-200', bg: 'bg-emerald-50', text: 'text-emerald-800' };

  const relatedDeliveries = useMemo(() => {
    if (!selectedBatch) return [];
    const connectedIds = new Set([
      selectedBatch.id,
      ...links
        .filter((link) => link.parent_batch_id === selectedBatch.id)
        .map((link) => link.child_batch_id),
    ]);
    return distributions.filter((item) => connectedIds.has(item.batch_id));
  }, [selectedBatch, links, distributions]);

  const SafetyIcon =
    safetyTone === 'rose'
      ? ShieldAlert
      : safetyTone === 'amber'
      ? TriangleAlert
      : ShieldCheck;

  const visibleComplaints = selectedBatch
    ? globalComplaints.filter(
        (complaint) =>
          (complaint.batchId || complaint.batchLotNumber) === selectedBatch.id
      )
    : globalComplaints;

  return (
    <div className="min-h-screen bg-[#faf8f2] text-stone-800">
      <main className="mx-auto max-w-7xl space-y-7 px-4 py-7 sm:px-7 sm:py-9 lg:px-10">
        {/* Staff Workspace Header Banner */}
        <section className="flex flex-col justify-between gap-5 rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:flex-row sm:items-end sm:p-7">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-extrabold uppercase tracking-[.17em] text-emerald-800">
                {isQA ? 'QA Officer Workspace' : 'Field Inspector Workspace'}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${
                  isQA
                    ? 'bg-amber-100 text-amber-900 border border-amber-200'
                    : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                }`}
              >
                {user?.role || 'STAFF'}
              </span>
            </div>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-stone-950">
              {selectedBatch
                ? `Batch Audit · ${selectedBatch.id}`
                : 'DairyTrace Staff Dashboard & Audit Hub'}
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-stone-600">
              {selectedBatch
                ? `Inspecting milk-to-paneer genealogy, NABL lab records, retail deliveries, and QMS complaints for ${selectedBatch.id}.`
                : 'Select or search any batch to audit its full genealogy, log tamper-evident inspections, review AI complaints, or simulate recalls.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {selectedBatch && onClearBatch && (
              <button
                type="button"
                onClick={() => {
                  setSelectedBatch(null);
                  onClearBatch();
                }}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-4 text-xs font-bold text-stone-700 hover:bg-stone-50"
              >
                <ArrowLeft className="h-4 w-4" />
                All Batches Overview
              </button>
            )}

            {isQA ? (
              <button
                type="button"
                onClick={onOpenCreateBatch}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-900 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-950"
              >
                <Plus className="h-4 w-4" />
                Add Batch / Link Milk
              </button>
            ) : (
              <span
                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 px-3.5 text-xs font-semibold text-stone-600"
                title="Creating batches and executing recalls require QA_OFFICER role"
              >
                <Lock className="h-3.5 w-3.5 text-stone-400" />
                Inspector Read &amp; Audit Clearance
              </span>
            )}
          </div>
        </section>

        {/* Search & Batch Lookup */}
        <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-900">
                <Search className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-base font-bold text-stone-900">
                  Find or select any batch
                </h2>
                <p className="mt-0.5 text-xs sm:text-sm text-stone-600">
                  Search by batch ID, SKU, or serial number, or pick a batch pill below to open its full audit.
                </p>
              </div>
            </div>
          </div>

          <div className="relative mt-4">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-h-12 w-full rounded-xl border border-stone-300 bg-[#faf9f5] pl-11 pr-4 text-sm outline-none focus:border-emerald-700 focus:bg-white focus:ring-2 focus:ring-emerald-700/10"
              placeholder="Search by batch ID (e.g. MILK-101, PAN-201), SKU, or serial number…"
              aria-label="Search batches by ID, SKU, or serial number"
            />
            <Search className="absolute left-4 top-3.5 h-4 w-4 text-stone-400" />

            {(matches.length > 0 || searching) && (
              <div className="absolute z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-2xl border border-stone-200 bg-white p-2 shadow-xl">
                {searching && (
                  <p className="px-3 py-2 text-sm text-stone-500">Searching batches…</p>
                )}
                {matches.map((batch) => (
                  <button
                    key={batch.id}
                    type="button"
                    onClick={() => chooseBatch(batch)}
                    className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left hover:bg-emerald-50"
                  >
                    <span>
                      <strong className="block text-sm text-stone-900">
                        {batch.id}{' '}
                        <span className="font-normal text-stone-500">
                          · {batch.product_type === 'MILK' ? 'Fresh milk' : 'Paneer'}
                        </span>
                      </strong>
                      <span className="mt-0.5 block text-xs text-stone-500">
                        {batch.facility_name}
                        {batch.sku ? ` · SKU ${batch.sku}` : ''}
                        {batch.serial_number ? ` · Serial ${batch.serial_number}` : ''}
                      </span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-emerald-800" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {searchError && !matches.length && query.trim().length >= 2 && (
            <p role="status" className="mt-3 rounded-xl bg-stone-50 px-3 py-2 text-sm text-stone-600">
              {searchError}
            </p>
          )}

          {/* Quick Batch Registry Strip */}
          {batches.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2 pt-3 border-t border-stone-100">
              <span className="text-xs font-bold text-stone-500 mr-1">
                Active Registry ({batches.length}):
              </span>
              {batches.map((b) => {
                const isSelected = selectedBatch?.id === b.id;
                const badgeTone =
                  b.status === 'RECALLED'
                    ? 'border-rose-300 bg-rose-50 text-rose-800'
                    : b.status === 'QUARANTINED'
                    ? 'border-amber-300 bg-amber-50 text-amber-800'
                    : 'border-stone-200 bg-[#faf9f5] text-stone-800';
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => chooseBatch(b)}
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                      isSelected
                        ? 'border-emerald-800 bg-emerald-900 text-white shadow-sm'
                        : `${badgeTone} hover:border-emerald-600`
                    }`}
                  >
                    {b.product_type === 'MILK' ? (
                      <Milk className="h-3.5 w-3.5" />
                    ) : (
                      <Package className="h-3.5 w-3.5" />
                    )}
                    <span>{b.id}</span>
                    {b.status !== 'ACTIVE' && (
                      <span className="rounded px-1 text-[9px] uppercase bg-black/10">
                        {b.status}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {selectedBatch ? (
          <div className="space-y-5 panel-enter">
            {/* Selected Batch Hero & Context Actions */}
            <section
              className={`rounded-3xl border ${safetyStyle.border} bg-white p-5 shadow-sm sm:p-7`}
            >
              <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-stone-700">
                      {selectedBatch.product_type === 'MILK' ? 'Fresh Raw Milk' : 'Malai Paneer'}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full ${safetyStyle.bg} px-3 py-1 text-xs font-bold ${safetyStyle.text}`}
                    >
                      <SafetyIcon className="h-3.5 w-3.5" />
                      {statusNames[selectedBatch.status] || selectedBatch.status}
                    </span>
                  </div>
                  <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-stone-950">
                    {selectedBatch.id}
                  </h2>
                  <p className="mt-1 text-sm text-stone-600">{selectedBatch.facility_name}</p>
                </div>

                {/* Bound Batch Context Actions */}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenComplaintWorkspace?.(selectedBatch.id)}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-stone-300 bg-white px-4 text-sm font-bold text-stone-800 hover:border-emerald-600 hover:bg-emerald-50 hover:text-emerald-950 transition"
                  >
                    <FlaskConical className="h-4 w-4 text-emerald-800" />
                    Log complaint / AI Copilot
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormOpen((v) => !v)}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-900 px-4 text-sm font-bold text-white hover:bg-emerald-950"
                  >
                    <ClipboardCheck className="h-4 w-4" />
                    Record security check
                  </button>

                  <button
                    type="button"
                    onClick={() => onViewPassport(selectedBatch.id)}
                    className="min-h-11 rounded-xl border border-stone-300 px-4 text-sm font-bold text-stone-700 hover:bg-stone-50"
                  >
                    Public passport
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenRecall(selectedBatch.id)}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-bold text-rose-800 hover:bg-rose-100"
                  >
                    <ShieldAlert className="h-4 w-4" />
                    {isQA ? 'Simulate / Execute recall' : 'Simulate blast radius'}
                  </button>
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl bg-[#faf9f5] p-3.5">
                  <span className="text-xs text-stone-500">Production date</span>
                  <strong className="mt-1 block text-sm text-stone-900">
                    {prettyDate(selectedBatch.production_date)}
                  </strong>
                </div>
                <div className="rounded-2xl bg-[#faf9f5] p-3.5">
                  <span className="text-xs text-stone-500">Expiry date</span>
                  <strong className="mt-1 block text-sm text-stone-900">
                    {prettyDate(selectedBatch.expiry_date)}
                  </strong>
                </div>
                <div className="rounded-2xl bg-[#faf9f5] p-3.5">
                  <span className="text-xs text-stone-500">Initial / Remaining Quantity</span>
                  <strong className="mt-1 block text-sm text-stone-900">
                    {Number(selectedBatch.initial_quantity || 0).toLocaleString()} /{' '}
                    {Number(selectedBatch.remaining_quantity ?? selectedBatch.initial_quantity ?? 0).toLocaleString()}{' '}
                    {selectedBatch.product_type === 'MILK' ? 'L' : 'kg'}
                  </strong>
                </div>
                <div className="rounded-2xl bg-[#faf9f5] p-3.5">
                  <span className="text-xs text-stone-500">Audit Access Level</span>
                  <strong className="mt-1 block text-sm text-emerald-900">
                    {isQA ? 'QA Officer (Full Write + Recall)' : 'Inspector (Audit + Inspection)'}
                  </strong>
                </div>
              </div>

              {(selectedBatch.sku || selectedBatch.serial_number) && (
                <p className="mt-3 text-xs text-stone-500">
                  {selectedBatch.sku && `SKU ${selectedBatch.sku}`}
                  {selectedBatch.sku && selectedBatch.serial_number && ' · '}
                  {selectedBatch.serial_number && `Serial ${selectedBatch.serial_number}`}
                </p>
              )}
            </section>

            {formOpen && (
              <SecurityInspectionForm
                key={selectedBatch.id}
                batch={selectedBatch}
                onCancel={() => setFormOpen(false)}
                onSubmitted={async () => {
                  setFormOpen(false);
                  await loadHistory(selectedBatch.id);
                  onNotify('Security check saved to the batch audit history.');
                }}
              />
            )}

            {/* Hero Milk -> Paneer Lineage Graph */}
            <LineageGraph
              batches={batches}
              links={links}
              distributions={distributions}
              selectedBatchId={selectedBatch.id}
              onSelectBatch={(id) => chooseBatch(id)}
              onOpenRecallModal={onOpenRecall}
              onViewPassport={onViewPassport}
            />

            {/* Complaints bound to this batch */}
            <ComplaintInbox
              complaints={visibleComplaints}
              loading={complaintLoading}
              error={complaintError}
              isQA={isQA}
              onRefresh={loadComplaints}
              onSelectBatch={(id) => chooseBatch(id)}
              onUpdateStatus={handleUpdateComplaintStatus}
              onDeleteComplaint={handleDeleteComplaint}
              onSafetyAction={(bId, reason) => onOpenRecall(bId, reason)}
              busyId={busyComplaintId}
            />

            <div className="grid gap-4 lg:grid-cols-2">
              {/* Quality Checks + QA Add Quality Record */}
              <Section
                title="Quality checks & lab certificates"
                subtitle="3-tier evidence records (Supplier-entered, Document-checked, Verified)"
                count={`${quality.length} ${quality.length === 1 ? 'record' : 'records'}`}
                defaultOpen={true}
              >
                {isQA && (
                  <div className="mb-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setQualityFormOpen((v) => !v)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-900 hover:bg-emerald-100"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {qualityFormOpen ? 'Cancel' : 'Add Quality Record'}
                    </button>
                  </div>
                )}

                {isQA && qualityFormOpen && (
                  <form
                    onSubmit={handleAddQualityRecord}
                    className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3 text-xs"
                  >
                    <strong className="block text-emerald-950 text-xs uppercase tracking-wider">
                      Attach Lab Quality Record ({selectedBatch.id})
                    </strong>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block font-semibold text-stone-700 mb-1">Lab Name</label>
                        <input
                          type="text"
                          required
                          value={newQuality.lab_name}
                          onChange={(e) =>
                            setNewQuality({ ...newQuality, lab_name: e.target.value })
                          }
                          className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-stone-700 mb-1">
                          Trust Classification
                        </label>
                        <select
                          value={newQuality.trust_level}
                          onChange={(e) =>
                            setNewQuality({ ...newQuality, trust_level: e.target.value })
                          }
                          className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 font-semibold"
                        >
                          <option value="VERIFIED">VERIFIED (NABL Chemist)</option>
                          <option value="DOCUMENT_CHECKED">DOCUMENT_CHECKED (COA)</option>
                          <option value="SUPPLIER_ENTERED">SUPPLIER_ENTERED</option>
                        </select>
                      </div>
                      <div>
                        <label className="block font-semibold text-stone-700 mb-1">Fat %</label>
                        <input
                          type="number"
                          step="0.1"
                          required
                          value={newQuality.fat_percentage}
                          onChange={(e) =>
                            setNewQuality({ ...newQuality, fat_percentage: e.target.value })
                          }
                          className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-stone-700 mb-1">SNF %</label>
                        <input
                          type="number"
                          step="0.1"
                          required
                          value={newQuality.snf_percentage}
                          onChange={(e) =>
                            setNewQuality({ ...newQuality, snf_percentage: e.target.value })
                          }
                          className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-stone-700 mb-1">Acidity %</label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={newQuality.acidity}
                          onChange={(e) =>
                            setNewQuality({ ...newQuality, acidity: e.target.value })
                          }
                          className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-stone-700 mb-1">
                          Adulterant Screen
                        </label>
                        <select
                          value={newQuality.adulterant_test}
                          onChange={(e) =>
                            setNewQuality({ ...newQuality, adulterant_test: e.target.value })
                          }
                          className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 font-semibold"
                        >
                          <option value="NEGATIVE">NEGATIVE (Pass)</option>
                          <option value="SUSPECTED">SUSPECTED</option>
                          <option value="POSITIVE">POSITIVE (Fail)</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="rounded-lg bg-emerald-800 px-3.5 py-1.5 font-bold text-white hover:bg-emerald-900"
                      >
                        Save Quality Record
                      </button>
                    </div>
                  </form>
                )}

                {loadingDetails ? (
                  <p className="text-sm text-stone-500">Loading quality details…</p>
                ) : quality.length ? (
                  <div className="space-y-3">
                    {quality.map((record) => (
                      <article
                        key={record.id}
                        className="rounded-xl border border-stone-200 p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <h3 className="text-sm font-bold text-stone-900">
                              {record.lab_name}
                            </h3>
                            <p className="mt-1 text-xs text-stone-500">
                              {prettyDate(record.test_date)}
                            </p>
                          </div>
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 border border-emerald-200">
                            {record.trust_level?.replaceAll('_', ' ')}
                          </span>
                        </div>
                        <p className="mt-3 text-sm font-semibold text-stone-700">
                          Fat {record.fat_percentage}% · SNF {record.snf_percentage}% · Acidity{' '}
                          {record.acidity}% · Adulterant{' '}
                          <span
                            className={
                              record.adulterant_test === 'NEGATIVE'
                                ? 'text-emerald-700'
                                : 'text-rose-700'
                            }
                          >
                            {record.adulterant_test}
                          </span>
                        </p>
                        {record.contaminant_details && (
                          <p className="mt-1 text-xs text-stone-500">
                            {record.contaminant_details}
                          </p>
                        )}
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl bg-stone-50 p-4 text-sm text-stone-600">
                    No lab quality record is attached to this batch yet.
                  </p>
                )}
              </Section>

              {/* Deliveries + QA Dispatch Form */}
              <Section
                title="Retail & distributor deliveries"
                subtitle="Downstream stores holding this batch or paneer crafted from it"
                count={`${relatedDeliveries.length} ${
                  relatedDeliveries.length === 1 ? 'delivery' : 'deliveries'
                }`}
                defaultOpen={true}
              >
                {isQA && (
                  <div className="mb-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setDispatchFormOpen((v) => !v)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-900 hover:bg-emerald-100"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {dispatchFormOpen ? 'Cancel' : 'Dispatch to Store'}
                    </button>
                  </div>
                )}

                {isQA && dispatchFormOpen && (
                  <form
                    onSubmit={handleCreateDispatch}
                    className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3 text-xs"
                  >
                    <strong className="block text-emerald-950 text-xs uppercase tracking-wider">
                      Record Store Dispatch ({selectedBatch.id})
                    </strong>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block font-semibold text-stone-700 mb-1">
                          Store / Distributor Name
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Retailer D (Baner)"
                          value={newDispatch.destination_name}
                          onChange={(e) =>
                            setNewDispatch({ ...newDispatch, destination_name: e.target.value })
                          }
                          className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-stone-700 mb-1">Location</label>
                        <input
                          type="text"
                          required
                          value={newDispatch.location}
                          onChange={(e) =>
                            setNewDispatch({ ...newDispatch, location: e.target.value })
                          }
                          className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-stone-700 mb-1">
                          Quantity Dispatched
                        </label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={newDispatch.quantity_dispatched}
                          onChange={(e) =>
                            setNewDispatch({
                              ...newDispatch,
                              quantity_dispatched: e.target.value,
                            })
                          }
                          className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-stone-700 mb-1">
                          Contact Phone
                        </label>
                        <input
                          type="text"
                          required
                          value={newDispatch.contact_phone}
                          onChange={(e) =>
                            setNewDispatch({ ...newDispatch, contact_phone: e.target.value })
                          }
                          className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="rounded-lg bg-emerald-800 px-3.5 py-1.5 font-bold text-white hover:bg-emerald-900"
                      >
                        Save Dispatch
                      </button>
                    </div>
                  </form>
                )}

                {relatedDeliveries.length ? (
                  <div className="space-y-2">
                    {relatedDeliveries.map((delivery) => (
                      <div
                        key={delivery.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 p-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Store className="h-4 w-4 shrink-0 text-emerald-800" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-stone-800">
                              {delivery.destination_name}
                            </p>
                            <p className="text-xs text-stone-500">
                              {delivery.location} · {delivery.quantity_dispatched} kg · Batch{' '}
                              {delivery.batch_id}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs font-mono text-stone-500">
                          {delivery.contact_phone}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl bg-stone-50 p-4 text-sm text-stone-600">
                    No delivery has been recorded for this batch or connected products.
                  </p>
                )}
              </Section>

              {/* Security & Audit History */}
              <div className="lg:col-span-2">
                <Section
                  title="Security inspections & recall audit log"
                  subtitle="Tamper-evident SHA-256 physical inspections and statutory recall events"
                  count={`${inspections.length + relevantRecallIds.length} events`}
                  defaultOpen={true}
                >
                  {historyError && (
                    <p
                      role="alert"
                      className="mb-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-800"
                    >
                      {historyError}
                    </p>
                  )}
                  {loadingDetails ? (
                    <p className="text-sm text-stone-500">Loading audit history…</p>
                  ) : inspections.length || recalls.length ? (
                    <div className="space-y-3">
                      {inspections.map((inspection) => (
                        <article
                          key={`inspection-${inspection.id}`}
                          className={`rounded-xl border p-4 ${
                            inspection.verdict === 'PASSED'
                              ? 'border-emerald-200 bg-emerald-50/40'
                              : 'border-amber-200 bg-amber-50/50'
                          }`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-bold text-stone-900">
                                {inspection.verdict.replaceAll('_', ' ')} · Physical Security Check
                              </p>
                              <p className="mt-1 text-xs text-stone-500">
                                Verified Actor: {inspection.inspector_name} ·{' '}
                                {prettyDate(inspection.created_at)}
                              </p>
                            </div>
                            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-stone-600 border border-stone-200">
                              Seal {inspection.tamper_seal_condition.toLowerCase()}
                            </span>
                          </div>
                          <div className="mt-3 grid gap-2 text-xs text-stone-600 sm:grid-cols-3">
                            <span>
                              <Thermometer className="mr-1 inline h-3.5 w-3.5" />
                              {inspection.temperature_c}°C · {inspection.humidity_percent}% humidity
                            </span>
                            <span>
                              {inspection.cold_chain_compliant
                                ? 'Cold chain confirmed'
                                : 'Cold chain not confirmed'}
                            </span>
                            <span className="truncate font-mono" title={inspection.record_sha256}>
                              <Fingerprint className="mr-1 inline h-3.5 w-3.5" />
                              SHA-256: {inspection.record_sha256?.slice(0, 18)}…
                            </span>
                          </div>
                          {inspection.notes && (
                            <p className="mt-3 text-sm text-stone-700">{inspection.notes}</p>
                          )}
                          {inspection.evidence_url && (
                            <button
                              type="button"
                              onClick={() =>
                                api
                                  .openEvidence(inspection.evidence_url)
                                  .catch((e) => onNotify(e.message, 'error'))
                              }
                              className="mt-3 inline-flex text-xs font-bold text-emerald-800 underline"
                            >
                              View authenticated photo evidence
                            </button>
                          )}
                        </article>
                      ))}

                      {recalls.map((event) => (
                        <article
                          key={`recall-${event.id}`}
                          className="rounded-xl border border-rose-200 bg-rose-50/70 p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-sm font-bold text-rose-900">
                              <AlertTriangle className="h-4 w-4" />
                              Statutory Recall Event #{event.id} · {event.severity}
                            </div>
                            {isQA && onOpenFssaiNotice && (
                              <button
                                type="button"
                                onClick={() => onOpenFssaiNotice(event.id)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 py-1 text-xs font-bold text-rose-900 hover:bg-rose-50"
                              >
                                <FileText className="h-3.5 w-3.5" />
                                Export FSSAI Notice
                              </button>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-rose-800">
                            {prettyDate(event.created_at)} · Initiated by {event.initiated_by}
                          </p>
                          <p className="mt-2 text-sm text-rose-900">{event.reason}</p>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-xl bg-stone-50 p-4 text-sm text-stone-600">
                      No manual inspection or recall events are recorded for this batch yet.
                    </p>
                  )}
                </Section>
              </div>
            </div>
          </div>
        ) : (
          /* Staff Dashboard Overview (No Specific Batch Selected Yet) */
          <div className="space-y-6">
            {/* Supply-Chain Genealogy Overview */}
            <LineageGraph
              batches={batches}
              links={links}
              distributions={distributions}
              selectedBatchId={batches[0]?.id || 'MILK-101'}
              onSelectBatch={(id) => chooseBatch(id)}
              onOpenRecallModal={onOpenRecall}
              onViewPassport={onViewPassport}
            />

            {/* Global Complaint Inbox */}
            <ComplaintInbox
              complaints={visibleComplaints}
              loading={complaintLoading}
              error={complaintError}
              isQA={isQA}
              onRefresh={loadComplaints}
              onSelectBatch={(id) => chooseBatch(id)}
              onUpdateStatus={handleUpdateComplaintStatus}
              onDeleteComplaint={handleDeleteComplaint}
              onSafetyAction={(bId, reason) => onOpenRecall(bId, reason)}
              busyId={busyComplaintId}
            />

            {/* Recent Safety & Recall Activity */}
            <Section
              title="Recent safety & recall activity across all batches"
              subtitle="Latest physical inspections and statutory recall notices"
              count={`${globalInspections.length + globalRecalls.length} events`}
              defaultOpen={true}
            >
              {historyError && (
                <p
                  role="alert"
                  className="mb-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-800"
                >
                  {historyError}
                </p>
              )}
              {globalInspections.length || globalRecalls.length ? (
                <div className="space-y-2">
                  {[
                    ...globalInspections
                      .slice(0, 6)
                      .map((event) => ({ ...event, event_type: 'inspection' })),
                    ...globalRecalls
                      .slice(0, 6)
                      .map((event) => ({ ...event, event_type: 'recall' })),
                  ]
                    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                    .slice(0, 8)
                    .map((event) => (
                      <div
                        key={`${event.event_type}-${event.id}`}
                        className="flex min-h-14 w-full items-center justify-between gap-4 rounded-xl border border-stone-200 px-4 py-3 hover:bg-stone-50"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            chooseBatch(event.batch_id || event.root_batch_id)
                          }
                          className="flex-1 text-left"
                        >
                          <strong className="block text-sm text-stone-900">
                            {event.event_type === 'recall'
                              ? `Statutory Recall #${event.id} · ${event.root_batch_id} (${event.severity})`
                              : `${
                                  event.verdict?.replaceAll('_', ' ') || 'Inspection'
                                } · Batch ${event.batch_id}`}
                          </strong>
                          <span className="mt-0.5 block text-xs text-stone-500">
                            {event.event_type === 'recall'
                              ? `${event.reason} · by ${event.initiated_by}`
                              : `By ${event.inspector_name}`}
                            {' · '}
                            {prettyDate(event.created_at)}
                          </span>
                        </button>

                        <div className="flex items-center gap-2">
                          {event.event_type === 'recall' && isQA && onOpenFssaiNotice && (
                            <button
                              type="button"
                              onClick={() => onOpenFssaiNotice(event.id)}
                              className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-900 hover:bg-amber-100"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              FSSAI Notice
                            </button>
                          )}
                          <ArrowRight className="h-4 w-4 shrink-0 text-emerald-800" />
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="rounded-xl bg-stone-50 p-4 text-sm text-stone-600">
                  No inspection or recall activity is recorded yet.
                </p>
              )}
            </Section>
          </div>
        )}
      </main>
    </div>
  );
}
