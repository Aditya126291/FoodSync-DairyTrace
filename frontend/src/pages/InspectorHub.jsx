import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ClipboardCheck,
  FileText,
  Fingerprint,
  FlaskConical,
  GitBranch,
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
} from 'lucide-react';
import SecurityInspectionForm from '../components/SecurityInspectionForm';
import LineageGraph from '../components/LineageGraph';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import {
  Alert,
  Badge,
  EmptyState,
  PageHeader,
  SectionCard,
  Spinner,
  StatTile,
  StatusBadge,
  TabPanel,
  Tabs,
} from '../components/ui';
import { formatDate, formatDateTime, formatQuantity, humanize, unitFor } from '../utils/format';

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
    <SectionCard
      title="QMS Complaint &amp; Safety Inbox"
      description="Consumer and staff incident reports filed from scanned batch passports and the AI Complaint Copilot."
      count={complaints.length}
      actions={
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="btn btn-secondary btn-sm"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      }
    >
      {error && (
        <div className="mb-4">
          <Alert tone="danger">{error}</Alert>
        </div>
      )}

      {urgentCount > 0 && (
        <div className="mb-4">
          <Alert tone="warn">
            {urgentCount} critical/high severity {urgentCount === 1 ? 'report' : 'reports'} awaiting QA triage and root-cause verification.
          </Alert>
        </div>
      )}

      {loading && complaints.length === 0 ? (
        <Spinner label="Loading complaint reports…" />
      ) : complaints.length ? (
        <div className="space-y-3">
          {complaints.map((item) => {
            const batchId = item.batchId || item.batchLotNumber;
            const sev = item.severity || 'Medium';
            const safetyFlag = ['Critical', 'High'].includes(sev);

            return (
              <article
                key={item.id}
                className={`card p-4 transition ${
                  safetyFlag ? 'border-amber-200 bg-amber-50/20' : ''
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold text-ink-900">
                        {item.complaintNumber}
                        <span className="font-normal text-ink-500"> · Batch {batchId}</span>
                      </h3>
                      <Badge tone={sev === 'Critical' ? 'danger' : sev === 'High' ? 'warn' : 'neutral'}>
                        {sev}
                      </Badge>
                      {safetyFlag && (
                        <Badge tone="danger" icon={MessageSquareWarning}>
                          Safety Review
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-ink-500">
                      Filed on {formatDate(item.createdAt || item.dateReported)} · Source: {item.source || 'Consumer'}
                      {item.customerName ? ` (${item.customerName})` : ''}
                    </p>
                  </div>

                  <span className="badge badge-neutral text-xs">{item.status || 'Under review'}</span>
                </div>

                <p className="mt-3 text-sm leading-relaxed text-ink-700 line-clamp-2">
                  {item.defectSummary || item.description || item.detailedDescription || 'No complaint details entered.'}
                </p>

                {(item.riskAssessment || item.rootCause || item.analysisSummary || item.detailedDescription) && (
                  <details className="mt-3 rounded-control border border-ink-200 bg-ink-50/70 px-3 py-2">
                    <summary className="cursor-pointer text-xs font-semibold text-brand-800">View incident details and assessment</summary>
                    <div className="space-y-2 pt-2 text-xs leading-relaxed text-ink-700">
                      {item.detailedDescription && <p>{item.detailedDescription}</p>}
                      {(item.riskAssessment || item.rootCause || item.analysisSummary) && (
                        <p className="rounded-control bg-brand-50 p-2 text-brand-950">
                          <span className="font-bold">Assessment: </span>
                          {item.riskAssessment || item.rootCause || item.analysisSummary}
                        </p>
                      )}
                    </div>
                  </details>
                )}

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 pt-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {onSelectBatch && (
                      <button
                        type="button"
                        onClick={() => onSelectBatch(batchId)}
                        className="btn btn-secondary btn-sm"
                      >
                        Audit Batch {batchId}
                      </button>
                    )}

                    {isQA && onSafetyAction && (
                      <button
                        type="button"
                        onClick={() =>
                          onSafetyAction(
                            batchId,
                            `Complaint ${item.complaintNumber}: ${
                              item.defectSummary || item.detailedDescription || item.description || 'Quality non-compliance'
                            }`
                          )
                        }
                        className="btn btn-danger-soft btn-sm"
                      >
                        <ShieldAlert className="h-3.5 w-3.5 text-red-600" />
                        Recall Batch
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={item.status || 'Under review'}
                      disabled={busyId === item.id}
                      onChange={(e) => onUpdateStatus?.(item, e.target.value)}
                      className="field min-h-[34px] py-1 text-xs"
                      aria-label="Change complaint status"
                    >
                      <option value="Under review">Under review</option>
                      <option value="Investigation opened">Investigation opened</option>
                      <option value="Recall triggered">Recall triggered</option>
                      <option value="Resolved">Resolved</option>
                    </select>

                    {isQA && onDeleteComplaint && (
                      <button
                        type="button"
                        disabled={busyId === item.id}
                        onClick={() => onDeleteComplaint(item)}
                        className="btn btn-ghost btn-sm text-red-700"
                        title="Delete complaint"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={ClipboardCheck}
          title="No incident complaints recorded"
        >
          No customer or plant incidents are registered for this view.
        </EmptyState>
      )}
    </SectionCard>
  );
}

export default function InspectorHub({
  batches = [],
  links = [],
  distributions = [],
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

  // Tabs: when batch selected: 'journey' | 'quality' | 'deliveries' | 'inspections' | 'complaints' | 'recalls'
  const [batchTab, setBatchTab] = useState('journey');
  // Tabs: when no batch selected: 'overview' | 'complaints' | 'activity'
  const [dashboardTab, setDashboardTab] = useState('overview');

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
    lab_name: 'DairyTrace Central QA Lab, Pune',
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
      setHistoryError(error.message || 'Could not load batch history.');
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
      setComplaintError(error.message || 'Complaint reports could not be loaded.');
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
      onNotify?.(`Complaint ${complaint.complaintNumber} marked "${status}".`);
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
      onNotify?.(`Complaint ${complaint.complaintNumber} deleted.`);
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
        setHistoryError('Recent audit activity could not be loaded.')
      );
  }, [auditRefreshVersion]);

  useEffect(() => {
    loadComplaints();
  }, [auditRefreshVersion]);

  // Debounced search
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
          if (!found?.length) {
            setSearchError('No batches match that code or serial number.');
          }
        }
      } catch (error) {
        if (active) setSearchError(error.message || 'Search failed.');
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
    onSelectBatch?.(id);
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
      onNotify?.(`Quality test certificate attached to ${selectedBatch.id}.`);
    } catch (err) {
      onNotify?.(err.message || 'Could not add quality record.', 'error');
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
      onNotify?.(`Store delivery record created for ${selectedBatch.id}.`);
    } catch (err) {
      onNotify?.(err.message || 'Could not add dispatch record.', 'error');
    }
  };

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

  const visibleComplaints = selectedBatch
    ? globalComplaints.filter(
        (complaint) => (complaint.batchId || complaint.batchLotNumber) === selectedBatch.id
      )
    : globalComplaints;

  const urgentComplaintsCount = visibleComplaints.filter((c) =>
    ['Critical', 'High'].includes(c.severity)
  ).length;

  // Batch-level tabs configuration
  const batchTabs = [
    { id: 'journey', label: 'Supply Chain Journey', icon: GitBranch },
    { id: 'inspections', label: 'Physical Audits', icon: ClipboardCheck, count: inspections.length },
    { id: 'quality', label: 'Lab Tests & Certificates', icon: FlaskConical, count: quality.length },
    { id: 'deliveries', label: 'Retail Deliveries', icon: Store, count: relatedDeliveries.length },
    {
      id: 'complaints',
      label: 'QMS Complaints',
      icon: MessageSquareWarning,
      count: visibleComplaints.length,
      alert: urgentComplaintsCount > 0,
    },
    { id: 'recalls', label: 'Recall History', icon: ShieldAlert, count: recalls.length },
  ];

  // Dashboard-level tabs configuration
  const dashboardTabs = [
    { id: 'overview', label: 'Plant Lineage & Batches', icon: GitBranch },
    {
      id: 'complaints',
      label: 'Global Complaint Inbox',
      icon: MessageSquareWarning,
      count: globalComplaints.length,
      alert: globalComplaints.some((c) => ['Critical', 'High'].includes(c.severity)),
    },
    {
      id: 'activity',
      label: 'Recent Audit & Regulatory Activity',
      icon: ShieldCheck,
      count: globalInspections.length + globalRecalls.length,
    },
  ];

  return (
    <div className="min-h-screen bg-canvas text-ink-800">
      <main className="container-wide space-y-6 py-6 sm:py-8">
        {/* Workspace Page Header */}
        <div className="card card-pad flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="eyebrow">
                {isQA ? 'QA Officer Workspace' : 'Field Inspector Workspace'}
              </span>
              <span className="badge badge-safe">
                {user?.full_name || 'Staff'} · {user?.role === 'QA_OFFICER' ? 'QA Officer' : 'Inspector'}
              </span>
            </div>
            <h1 className="page-title text-2xl sm:text-3xl mt-1">
              {selectedBatch ? `Batch Audit · ${selectedBatch.id}` : 'Staff Traceability & Audit Console'}
            </h1>
            <p className="muted mt-1 max-w-3xl">
              {selectedBatch
                ? `Verifying supply genealogy, tamper checks, lab purity tests, and store distributions for ${selectedBatch.id}.`
                : 'Search or select any batch to audit physical integrity, trace milk-to-paneer genealogy, review customer complaints, or simulate recalls.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {selectedBatch && (
              <button
                type="button"
                onClick={() => {
                  setSelectedBatch(null);
                  onClearBatch?.();
                }}
                className="btn btn-secondary btn-sm"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                All Batches Overview
              </button>
            )}

            {isQA ? (
              <button
                type="button"
                onClick={onOpenCreateBatch}
                className="btn btn-primary btn-sm"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Batch / Link Milk
              </button>
            ) : (
              <span className="badge badge-neutral text-xs">
                <Lock className="h-3 w-3 text-ink-500" />
                Auditor Clearance (Read-Only)
              </span>
            )}
          </div>
        </div>

        {/* Search & Fast Batch Selector */}
        <div className="card card-pad">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="section-title text-base font-bold">Search Batch Registry</h2>
              <p className="muted text-xs">Enter a batch code, SKU, or serial number, or pick a batch chip below:</p>
            </div>
          </div>

          <div className="relative mt-3">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search batches (e.g. MILK-101, PAN-201)…"
              className="field pl-10"
              aria-label="Search batch registry"
            />
            <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-ink-400" />

            {(matches.length > 0 || searching) && (
              <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-card border border-ink-200 bg-white p-2 shadow-pop">
                {searching && <p className="p-3 text-xs text-ink-500">Searching batch registry…</p>}
                {matches.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => chooseBatch(b)}
                    className="flex w-full items-center justify-between rounded-control p-2.5 text-left text-xs hover:bg-brand-50"
                  >
                    <div>
                      <strong className="font-mono text-ink-900">{b.id}</strong>
                      <span className="ml-2 text-ink-500">· {b.product_type === 'MILK' ? 'Raw Milk' : 'Paneer'}</span>
                      <p className="text-[11px] text-ink-500">{b.facility_name}</p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-brand-700" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {searchError && query.trim().length >= 2 && !matches.length && (
            <div className="mt-3">
              <Alert tone="neutral">{searchError}</Alert>
            </div>
          )}

          {/* Quick Active Registry Strip */}
          {batches.length > 0 && (
            <div className="mt-4 border-t border-ink-100 pt-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-ink-500">
                  Recent batches <span className="font-normal">· {batches.length} total</span>
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
              {batches.slice(0, 6).map((b) => {
                const isSelected = selectedBatch?.id === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => chooseBatch(b)}
                    className={`badge transition ${
                      isSelected
                        ? 'border-brand-800 bg-brand-800 text-white font-bold'
                        : b.status === 'RECALLED'
                        ? 'badge-danger hover:border-red-400'
                        : b.status === 'QUARANTINED'
                        ? 'badge-warn hover:border-amber-400'
                        : 'badge-neutral hover:border-brand-600'
                    }`}
                  >
                    {b.product_type === 'MILK' ? (
                      <Milk className="h-3 w-3" />
                    ) : (
                      <Package className="h-3 w-3" />
                    )}
                    <span className="font-mono">{b.id}</span>
                  </button>
                );
              })}
              {batches.length > 6 && (
                <details id="all-batches-list" className="w-full pt-1">
                  <summary className="cursor-pointer text-xs font-semibold text-brand-800">Show all {batches.length} batches</summary>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {batches.slice(6).map((b) => (
                      <button key={b.id} type="button" onClick={() => chooseBatch(b)} className="badge badge-neutral transition hover:border-brand-600">
                        {b.product_type === 'MILK' ? <Milk className="h-3 w-3" /> : <Package className="h-3 w-3" />}
                        <span className="font-mono">{b.id}</span>
                      </button>
                    ))}
                  </div>
                </details>
              )}
              </div>
            </div>
          )}
        </div>

        {/* CONDITIONAL: Batch Selected View VS Root Dashboard View */}
        {selectedBatch ? (
          <div className="space-y-6">
            {/* Selected Batch Summary Tile Header */}
            <div className="card card-pad">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="badge badge-neutral">
                      {selectedBatch.product_type === 'MILK' ? 'Fresh Raw Milk' : 'Malai Paneer'}
                    </span>
                    <StatusBadge status={selectedBatch.status} />
                  </div>
                  <h2 className="page-title text-2xl sm:text-3xl mt-2 font-mono font-bold text-ink-900">
                    {selectedBatch.id}
                  </h2>
                  <p className="muted mt-1 text-sm">{selectedBatch.facility_name}</p>
                </div>

                {/* Quick Action Buttons for This Batch */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenComplaintWorkspace?.(selectedBatch.id)}
                    className="btn btn-secondary btn-sm"
                  >
                    <FlaskConical className="h-3.5 w-3.5 text-brand-800" />
                    Complaint / Copilot
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormOpen((v) => !v)}
                    className="btn btn-primary btn-sm"
                  >
                    <ClipboardCheck className="h-3.5 w-3.5" />
                    Record Security Check
                  </button>

                  <button
                    type="button"
                    onClick={() => onViewPassport?.(selectedBatch.id)}
                    className="btn btn-secondary btn-sm"
                  >
                    Public Passport
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenRecall?.(selectedBatch.id)}
                    className="btn btn-danger-soft btn-sm"
                  >
                    <ShieldAlert className="h-3.5 w-3.5 text-red-600" />
                    {isQA ? 'Simulate / Recall' : 'Blast Radius'}
                  </button>
                </div>
              </div>

              {/* Stat Tiles Grid */}
              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 border-t border-ink-100 pt-5">
                <StatTile
                  icon={Milk}
                  label="Production Date"
                  value={formatDate(selectedBatch.production_date)}
                  hint={`Best before ${formatDate(selectedBatch.expiry_date)}`}
                />
                <StatTile
                  icon={Package}
                  label="Stock Volume"
                  value={formatQuantity(selectedBatch.remaining_quantity ?? selectedBatch.initial_quantity, selectedBatch.product_type)}
                  hint={`Initial: ${formatQuantity(selectedBatch.initial_quantity, selectedBatch.product_type)}`}
                />
                <StatTile
                  icon={Store}
                  label="Retail Distributions"
                  value={`${relatedDeliveries.length} ${relatedDeliveries.length === 1 ? 'store' : 'stores'}`}
                  hint="Downstream recipients"
                />
                <StatTile
                  icon={ShieldCheck}
                  label="Audited Safety Status"
                  value={selectedBatch.status}
                  tone={selectedBatch.status === 'RECALLED' ? 'danger' : selectedBatch.status === 'QUARANTINED' ? 'warn' : 'safe'}
                />
              </div>
            </div>

            {/* Security Inspection Form Modal / Inline Drawer */}
            {formOpen && (
              <div className="card card-pad border-brand-300 ring-2 ring-brand-600/10">
                <SecurityInspectionForm
                  key={selectedBatch.id}
                  batch={selectedBatch}
                  onCancel={() => setFormOpen(false)}
                  onSubmitted={async () => {
                    setFormOpen(false);
                    await Promise.all([
                      loadHistory(selectedBatch.id),
                      api.getInspections().then((checks) => setGlobalInspections(checks || [])),
                      onRefreshBatches?.(),
                    ]);
                    onNotify?.('Security check recorded and signed into batch audit log.');
                  }}
                />
              </div>
            )}

            {/* TAB NAVIGATION FOR SELECTED BATCH */}
            <Tabs
              tabs={batchTabs}
              value={batchTab}
              onChange={setBatchTab}
              label="Batch Audit Sections"
            />

            {/* TAB 1: Supply Chain Journey */}
            <TabPanel id="journey" value={batchTab}>
              <LineageGraph
                batches={batches}
                links={links}
                distributions={distributions}
                selectedBatchId={selectedBatch.id}
                onSelectBatch={(id) => chooseBatch(id)}
                onOpenRecallModal={onOpenRecall}
                onViewPassport={onViewPassport}
                compact={false}
              />
            </TabPanel>

            {/* TAB 2: Physical Inspections */}
            <TabPanel id="inspections" value={batchTab}>
              <SectionCard
                title="Physical Security Checks &amp; Storage Conditions"
                description="Tamper seal verification, digital temperature/humidity telemetry, and immutable SHA-256 evidence."
                count={inspections.length}
                actions={
                  <button
                    type="button"
                    onClick={() => setFormOpen(true)}
                    className="btn btn-primary btn-sm"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Record Inspection
                  </button>
                }
              >
                {loadingDetails ? (
                  <Spinner label="Loading inspection records…" />
                ) : inspections.length ? (
                  <div className="space-y-3">
                    {inspections.map((check) => (
                      <article
                        key={check.id}
                        className={`card p-4 ${
                          check.verdict === 'PASSED'
                            ? 'border-emerald-200 bg-emerald-50/30'
                            : 'border-amber-200 bg-amber-50/40'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-bold text-ink-900">
                                {humanize(check.verdict)} · Physical Check #{check.id}
                              </h3>
                              <Badge tone={check.verdict === 'PASSED' ? 'safe' : 'warn'}>
                                Seal: {check.tamper_seal_condition}
                              </Badge>
                            </div>
                            <p className="mt-1 text-xs text-ink-500">
                              Inspector: {check.inspector_name} · {formatDateTime(check.created_at)}
                            </p>
                          </div>
                          <span className="font-mono text-xs text-ink-500">
                            Measured: {check.actual_quantity} {unitFor(selectedBatch.product_type)}
                          </span>
                        </div>

                        <div className="mt-3 grid gap-2 text-xs text-ink-700 sm:grid-cols-3 border-t border-ink-100 pt-2">
                          <span className="flex items-center gap-1">
                            <Thermometer className="h-3.5 w-3.5 text-brand-700" />
                            {check.temperature_c}°C · {check.humidity_percent}% humidity
                          </span>
                          <span>
                            {check.cold_chain_compliant ? 'Cold chain compliant' : 'Cold chain not compliant'}
                          </span>
                          <span className="truncate font-mono" title={check.record_sha256 || ''}>
                            <Fingerprint className="h-3.5 w-3.5 text-brand-700 mr-1 inline" />
                            SHA-256: {check.record_sha256 ? `${check.record_sha256.slice(0, 16)}…` : 'Recorded'}
                          </span>
                        </div>

                        {check.notes && <p className="mt-2 text-xs text-ink-600">{check.notes}</p>}

                        {check.evidence_url && (
                          <div className="mt-2">
                            <button
                              type="button"
                              onClick={() =>
                                api
                                  .openEvidence(check.evidence_url)
                                  .catch((e) => onNotify?.(e.message, 'error'))
                              }
                              className="text-xs font-semibold text-brand-800 underline hover:text-brand-950"
                            >
                              View photographic evidence
                            </button>
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={ClipboardCheck}
                    title="No physical inspections recorded"
                    action={
                      <button
                        type="button"
                        onClick={() => setFormOpen(true)}
                        className="btn btn-primary btn-sm"
                      >
                        Record first security check
                      </button>
                    }
                  >
                    Perform a physical seal inspection to verify cold-chain integrity and record SHA-256 evidence.
                  </EmptyState>
                )}
              </SectionCard>
            </TabPanel>

            {/* TAB 3: Quality Lab Tests & Certificates */}
            <TabPanel id="quality" value={batchTab}>
              <SectionCard
                title="Lab Quality Tests &amp; Purity Certificates"
                description="Evidence-linked compositional metrics (Fat, SNF, Acidity) and NABL chemical sign-offs."
                count={quality.length}
                actions={
                  isQA && (
                    <button
                      type="button"
                      onClick={() => setQualityFormOpen((v) => !v)}
                      className="btn btn-primary btn-sm"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {qualityFormOpen ? 'Cancel' : 'Add Quality Record'}
                    </button>
                  )
                }
              >
                {/* Form to attach new lab record */}
                {isQA && qualityFormOpen && (
                  <form
                    onSubmit={handleAddQualityRecord}
                    className="mb-5 card p-4 border-brand-200 bg-brand-50/40 space-y-3"
                  >
                    <h3 className="section-title text-sm font-bold text-brand-950">
                      Attach Quality Test Certificate ({selectedBatch.id})
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <div>
                        <label className="label text-xs">Laboratory Name</label>
                        <input
                          type="text"
                          required
                          value={newQuality.lab_name}
                          onChange={(e) => setNewQuality({ ...newQuality, lab_name: e.target.value })}
                          className="field text-xs min-h-[38px]"
                        />
                      </div>
                      <div>
                        <label className="label text-xs">Trust Classification</label>
                        <select
                          value={newQuality.trust_level}
                          onChange={(e) => setNewQuality({ ...newQuality, trust_level: e.target.value })}
                          className="field text-xs min-h-[38px]"
                        >
                          <option value="VERIFIED">VERIFIED (NABL Chemist Sign-Off)</option>
                          <option value="DOCUMENT_CHECKED">DOCUMENT_CHECKED (Lab Certificate)</option>
                          <option value="SUPPLIER_ENTERED">SUPPLIER_ENTERED (Collection Desk)</option>
                        </select>
                      </div>
                      <div>
                        <label className="label text-xs">Fat %</label>
                        <input
                          type="number"
                          step="0.1"
                          required
                          value={newQuality.fat_percentage}
                          onChange={(e) => setNewQuality({ ...newQuality, fat_percentage: e.target.value })}
                          className="field text-xs min-h-[38px]"
                        />
                      </div>
                      <div>
                        <label className="label text-xs">SNF %</label>
                        <input
                          type="number"
                          step="0.1"
                          required
                          value={newQuality.snf_percentage}
                          onChange={(e) => setNewQuality({ ...newQuality, snf_percentage: e.target.value })}
                          className="field text-xs min-h-[38px]"
                        />
                      </div>
                      <div>
                        <label className="label text-xs">Acidity %</label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={newQuality.acidity}
                          onChange={(e) => setNewQuality({ ...newQuality, acidity: e.target.value })}
                          className="field text-xs min-h-[38px]"
                        />
                      </div>
                      <div>
                        <label className="label text-xs">Adulterant Screen</label>
                        <select
                          value={newQuality.adulterant_test}
                          onChange={(e) => setNewQuality({ ...newQuality, adulterant_test: e.target.value })}
                          className="field text-xs min-h-[38px]"
                        >
                          <option value="NEGATIVE">NEGATIVE (Passed standard)</option>
                          <option value="SUSPECTED">SUSPECTED (Anomalous)</option>
                          <option value="POSITIVE">POSITIVE (Failed standard)</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex justify-end pt-2">
                      <button type="submit" className="btn btn-primary btn-sm">
                        Save Lab Record
                      </button>
                    </div>
                  </form>
                )}

                {loadingDetails ? (
                  <Spinner label="Loading lab quality records…" />
                ) : quality.length ? (
                  <div className="space-y-3">
                    {quality.map((q) => (
                      <article key={q.id} className="card p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <h4 className="text-sm font-bold text-ink-900">{q.lab_name}</h4>
                            <p className="text-xs text-ink-500 mt-0.5">
                              Tested on {formatDateTime(q.test_date)}
                            </p>
                          </div>
                          <Badge tone={q.trust_level === 'VERIFIED' ? 'safe' : q.trust_level === 'DOCUMENT_CHECKED' ? 'info' : 'warn'}>
                            {humanize(q.trust_level)}
                          </Badge>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs font-semibold text-ink-800">
                          <span>Fat: {q.fat_percentage}%</span>
                          <span>SNF: {q.snf_percentage}%</span>
                          <span>Acidity: {q.acidity}%</span>
                          <span className={q.adulterant_test === 'NEGATIVE' ? 'text-emerald-700' : 'text-red-700'}>
                            Adulterant: {q.adulterant_test}
                          </span>
                        </div>
                        {q.contaminant_details && (
                          <p className="mt-2 text-xs text-ink-600">{q.contaminant_details}</p>
                        )}
                      </article>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={FlaskConical}
                    title="No quality test certificates recorded"
                  >
                    {isQA
                      ? 'Add a laboratory test certificate to certify compositional quality.'
                      : 'No lab certificates have been submitted for this batch.'}
                  </EmptyState>
                )}
              </SectionCard>
            </TabPanel>

            {/* TAB 4: Retail Deliveries */}
            <TabPanel id="deliveries" value={batchTab}>
              <SectionCard
                title="Store &amp; Distributor Dispatches"
                description="Downstream distribution points carrying this batch or products crafted from it."
                count={relatedDeliveries.length}
                actions={
                  isQA && (
                    <button
                      type="button"
                      onClick={() => setDispatchFormOpen((v) => !v)}
                      className="btn btn-primary btn-sm"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {dispatchFormOpen ? 'Cancel' : 'Dispatch to Store'}
                    </button>
                  )
                }
              >
                {/* Form to record dispatch */}
                {isQA && dispatchFormOpen && (
                  <form
                    onSubmit={handleCreateDispatch}
                    className="mb-5 card p-4 border-brand-200 bg-brand-50/40 space-y-3"
                  >
                    <h3 className="section-title text-sm font-bold text-brand-950">
                      Record Store Dispatch ({selectedBatch.id})
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <label className="label text-xs">Store / Retailer</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Retailer D (Baner)"
                          value={newDispatch.destination_name}
                          onChange={(e) => setNewDispatch({ ...newDispatch, destination_name: e.target.value })}
                          className="field text-xs min-h-[38px]"
                        />
                      </div>
                      <div>
                        <label className="label text-xs">Location</label>
                        <input
                          type="text"
                          required
                          value={newDispatch.location}
                          onChange={(e) => setNewDispatch({ ...newDispatch, location: e.target.value })}
                          className="field text-xs min-h-[38px]"
                        />
                      </div>
                      <div>
                        <label className="label text-xs">Quantity (kg / L)</label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={newDispatch.quantity_dispatched}
                          onChange={(e) => setNewDispatch({ ...newDispatch, quantity_dispatched: e.target.value })}
                          className="field text-xs min-h-[38px]"
                        />
                      </div>
                      <div>
                        <label className="label text-xs">Contact Phone</label>
                        <input
                          type="text"
                          required
                          value={newDispatch.contact_phone}
                          onChange={(e) => setNewDispatch({ ...newDispatch, contact_phone: e.target.value })}
                          className="field text-xs min-h-[38px]"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end pt-2">
                      <button type="submit" className="btn btn-primary btn-sm">
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
                        className="card flex items-center justify-between p-3"
                      >
                        <div className="flex items-center gap-3">
                          <Store className="h-5 w-5 text-brand-700 shrink-0" />
                          <div>
                            <p className="text-sm font-semibold text-ink-900">{delivery.destination_name}</p>
                            <p className="text-xs text-ink-500">
                              {delivery.location} · Dispatched {delivery.quantity_dispatched} kg · Batch {delivery.batch_id}
                            </p>
                          </div>
                        </div>
                        <span className="font-mono text-xs text-ink-600">{delivery.contact_phone}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={Store}
                    title="No retail dispatches recorded"
                  >
                    No downstream store or distributor shipments have been registered for this batch yet.
                  </EmptyState>
                )}
              </SectionCard>
            </TabPanel>

            {/* TAB 5: QMS Complaints Bound to Batch */}
            <TabPanel id="complaints" value={batchTab}>
              <ComplaintInbox
                complaints={visibleComplaints}
                loading={complaintLoading}
                error={complaintError}
                isQA={isQA}
                onRefresh={loadComplaints}
                onSelectBatch={(id) => chooseBatch(id)}
                onUpdateStatus={handleUpdateComplaintStatus}
                onDeleteComplaint={handleDeleteComplaint}
                onSafetyAction={(bId, reason) => onOpenRecall?.(bId, reason)}
                busyId={busyComplaintId}
              />
            </TabPanel>

            {/* TAB 6: Recalls & Statutory Notices */}
            <TabPanel id="recalls" value={batchTab}>
              <SectionCard
                title="Recall Audit Log &amp; Regulatory Notices"
                description="Statutory FSSAI recalls, blast radius simulations, and public safety alerts."
                count={recalls.length}
                actions={
                  <button
                    type="button"
                    onClick={() => onOpenRecall?.(selectedBatch.id)}
                    className="btn btn-danger-soft btn-sm"
                  >
                    <ShieldAlert className="h-3.5 w-3.5 text-red-600" />
                    Simulate / Issue Recall
                  </button>
                }
              >
                {recalls.length ? (
                  <div className="space-y-3">
                    {recalls.map((event) => (
                      <article key={event.id} className="card p-4 border-red-200 bg-red-50/40">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-red-700" />
                            <h4 className="text-sm font-bold text-red-950">
                              Recall Notice #{event.id} · {event.severity}
                            </h4>
                          </div>
                          {isQA && onOpenFssaiNotice && (
                            <button
                              type="button"
                              onClick={() => onOpenFssaiNotice(event.id)}
                              className="btn btn-secondary btn-sm"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              Export FSSAI Notice
                            </button>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-red-800">
                          Issued on {formatDateTime(event.created_at)} · Initiated by {event.initiated_by}
                        </p>
                        <p className="mt-2 text-xs text-ink-800">{event.reason}</p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={ShieldCheck}
                    title="No recalls on this batch"
                  >
                    This batch has zero recorded recalls and is fully cleared in our regulatory registry.
                  </EmptyState>
                )}
              </SectionCard>
            </TabPanel>
          </div>
        ) : (
          /* ROOT DASHBOARD (NO SPECIFIC BATCH SELECTED) */
          <div className="space-y-6">
            <Tabs
              tabs={dashboardTabs}
              value={dashboardTab}
              onChange={setDashboardTab}
              label="Staff Dashboard Overview"
            />

            <TabPanel id="overview" value={dashboardTab}>
              <LineageGraph
                batches={batches}
                links={links}
                distributions={distributions}
                selectedBatchId={batches[0]?.id || 'MILK-101'}
                onSelectBatch={(id) => chooseBatch(id)}
                onOpenRecallModal={onOpenRecall}
                onViewPassport={onViewPassport}
                compact={false}
              />
            </TabPanel>

            <TabPanel id="complaints" value={dashboardTab}>
              <ComplaintInbox
                complaints={visibleComplaints}
                loading={complaintLoading}
                error={complaintError}
                isQA={isQA}
                onRefresh={loadComplaints}
                onSelectBatch={(id) => chooseBatch(id)}
                onUpdateStatus={handleUpdateComplaintStatus}
                onDeleteComplaint={handleDeleteComplaint}
                onSafetyAction={(bId, reason) => onOpenRecall?.(bId, reason)}
                busyId={busyComplaintId}
              />
            </TabPanel>

            <TabPanel id="activity" value={dashboardTab}>
              <SectionCard
                title="Recent Inspections &amp; Statutory Recalls"
                description="Live log of physical field checks and food safety events across all facility vats."
                count={globalInspections.length + globalRecalls.length}
              >
                {globalInspections.length || globalRecalls.length ? (
                  <div className="space-y-3">
                    {globalRecalls.map((event) => (
                      <article key={`global-recall-${event.id}`} className="card p-4 border-red-200 bg-red-50/40">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-red-700" />
                            <strong className="text-sm font-bold text-red-950">
                              Statutory Recall Event #{event.id} · Batch {event.root_batch_id}
                            </strong>
                          </div>
                          {isQA && onOpenFssaiNotice && (
                            <button
                              type="button"
                              onClick={() => onOpenFssaiNotice(event.id)}
                              className="btn btn-secondary btn-sm"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              FSSAI Notice
                            </button>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-red-800">
                          {formatDateTime(event.created_at)} · {event.initiated_by}
                        </p>
                        <p className="mt-1 text-xs text-ink-800">{event.reason}</p>
                      </article>
                    ))}

                    {globalInspections.slice(0, 8).map((chk) => (
                      <article key={`global-chk-${chk.id}`} className="card p-3.5 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <ClipboardCheck className="h-5 w-5 text-brand-700 shrink-0" />
                          <div>
                            <p className="text-xs font-bold text-ink-900">
                              Batch {chk.batch_id} · {humanize(chk.verdict)}
                            </p>
                            <p className="text-[11px] text-ink-500">
                              {chk.inspector_name} · {formatDateTime(chk.created_at)} · Seal: {chk.tamper_seal_condition}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => chooseBatch(chk.batch_id)}
                          className="btn btn-secondary btn-sm"
                        >
                          Audit Batch
                        </button>
                      </article>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={ClipboardCheck}
                    title="No recent audit activity"
                  >
                    No physical inspections or statutory recall events are logged yet.
                  </EmptyState>
                )}
              </SectionCard>
            </TabPanel>
          </div>
        )}
      </main>
    </div>
  );
}
