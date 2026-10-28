import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Phone,
  FileText,
  RefreshCw,
  CheckCircle,
  Package,
  Milk,
  Store,
  Lock,
  AlertTriangle,
} from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Alert, Badge, Modal } from './ui';

const STANDARD_RECALL_REASONS = [
  'Elevated Aflatoxin M1 detected (> 0.50 µg/kg statutory limit)',
  'Microbial pathogen screen positive (Salmonella / E. coli)',
  'Chemical adulterant screen positive (Urea / Detergent / Neutralizer)',
  'Severe cold-chain failure (Temperature > 10°C exceeding 4 hours)',
  'Foreign physical matter detected in packaging',
];

export default function RecallModal({
  isOpen,
  onClose,
  initialBatchId = 'MILK-101',
  initialReason = '',
  batches = [],
  onRecallExecuted,
  onOpenFssaiNotice,
}) {
  const { user, isQA } = useAuth();
  const [targetBatchId, setTargetBatchId] = useState(initialBatchId);
  const [reason, setReason] = useState(initialReason || STANDARD_RECALL_REASONS[0]);
  const [severity, setSeverity] = useState('CRITICAL');
  const [confirmBatchInput, setConfirmBatchInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [blastRadius, setBlastRadius] = useState(null);
  const [executedEvent, setExecutedEvent] = useState(null);
  const [actionError, setActionError] = useState('');
  const requestInFlight = useRef(false);

  const handleSimulate = async (batchIdToUse, reasonOverride) => {
    const bId = batchIdToUse || targetBatchId;
    const reasonToUse = reasonOverride || reason;
    setLoading(true);
    setActionError('');
    try {
      const res = await api.simulateRecall({
        batch_id: bId,
        reason: reasonToUse,
      });
      setBlastRadius(res);
    } catch (err) {
      setActionError(
        err.message || 'Safety impact preview could not be loaded.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    if (!isQA) {
      setActionError('Only an authorized QA Officer can execute an official food recall.');
      return;
    }
    if (confirmBatchInput.trim().toUpperCase() !== targetBatchId.toUpperCase()) {
      setActionError(`Type "${targetBatchId}" in the confirmation box before issuing recall.`);
      return;
    }
    if (requestInFlight.current || isExecuting) return;

    requestInFlight.current = true;
    setIsExecuting(true);
    setActionError('');
    try {
      const res = await api.executeRecall({
        batch_id: targetBatchId,
        reason,
        severity,
      });
      setExecutedEvent(res.recall_event);
      onRecallExecuted?.(res);
    } catch (err) {
      setActionError(err.message || 'Could not execute the safety recall.');
    } finally {
      setIsExecuting(false);
      requestInFlight.current = false;
    }
  };

  useEffect(() => {
    if (isOpen && initialBatchId) {
      setTargetBatchId(initialBatchId);
      setConfirmBatchInput('');
      const startingReason = initialReason || STANDARD_RECALL_REASONS[0];
      setReason(startingReason);
      setExecutedEvent(null);
      setActionError('');
      handleSimulate(initialBatchId, startingReason);
    }
  }, [initialBatchId, initialReason, isOpen]);

  // Calculate unaffected safe paneer batches to highlight targeted precision
  const safePaneerBatches = useMemo(() => {
    if (!blastRadius) return [];
    const compromisedSet = new Set([
      blastRadius.root_batch,
      ...(blastRadius.affected_product_batches || []),
    ]);
    return batches.filter(
      (b) => b.product_type === 'PANEER' && !compromisedSet.has(b.id)
    );
  }, [batches, blastRadius]);

  const isConfirmMatch =
    confirmBatchInput.trim().toUpperCase() === targetBatchId.toUpperCase();

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Smart Recall Blast-Radius Simulation &amp; Execution"
      description="Graph-based impact tracing to withdraw compromised packs and protect safe dairy batches."
      icon={ShieldAlert}
      tone="danger"
      size="xl"
      dismissable={!isExecuting}
    >
      <div className="space-y-6">
        {actionError && (
          <Alert tone="danger" onClose={() => setActionError('')}>
            {actionError}
          </Alert>
        )}

        {/* Target Batch & Reason Configuration */}
        <div className="card p-4 sm:p-5 border-red-200 bg-red-50/20 space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <span className="eyebrow text-red-700">Root Compromised Batch</span>
              <div className="flex items-center gap-2">
                <select
                  value={targetBatchId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setTargetBatchId(nextId);
                    setConfirmBatchInput('');
                    handleSimulate(nextId);
                  }}
                  className="field max-w-xs font-mono font-bold text-sm"
                  disabled={loading || isExecuting || Boolean(executedEvent)}
                >
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.id} · {b.product_type === 'MILK' ? 'Raw Milk' : 'Paneer'} ({b.facility_name})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => handleSimulate(targetBatchId)}
                  disabled={loading || isExecuting}
                  className="btn btn-secondary btn-sm"
                  title="Re-run simulation"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <span className="eyebrow text-red-700">Severity Level</span>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                disabled={isExecuting || Boolean(executedEvent)}
                className="field text-sm font-bold min-h-[44px]"
              >
                <option value="CRITICAL">CRITICAL (Class I — Immediate Public Health Hazard)</option>
                <option value="HIGH">HIGH (Class II — Potential Health Risk)</option>
                <option value="MEDIUM">MEDIUM (Class III — Quality Deviation)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label text-xs">Regulatory Reason &amp; Laboratory Findings</label>
            <div className="space-y-2">
              <select
                onChange={(e) => {
                  if (e.target.value) setReason(e.target.value);
                }}
                disabled={isExecuting || Boolean(executedEvent)}
                className="field text-xs text-ink-700"
                value={STANDARD_RECALL_REASONS.includes(reason) ? reason : ''}
              >
                <option value="">-- Choose standard regulatory reason or enter below --</option>
                {STANDARD_RECALL_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>

              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={isExecuting || Boolean(executedEvent)}
                className="field text-xs"
                placeholder="Describe lab test results, adulterant thresholds, or customer illness reports…"
                rows={2}
              />
            </div>
          </div>
        </div>

        {/* Blast Radius Simulation Results */}
        {loading ? (
          <Spinner label="Tracing supply-chain graph &amp; calculating blast radius…" />
        ) : blastRadius ? (
          <div className="space-y-4">
            {/* Impact Metric Tiles */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="card p-4 border-red-200 bg-red-50/50">
                <span className="text-xs font-semibold text-red-800 uppercase block">
                  Downstream Batches At Risk
                </span>
                <p className="mt-1 text-2xl font-bold text-red-950 font-mono">
                  {blastRadius.affected_product_batches?.length || 0}
                </p>
                <span className="text-[11px] text-red-700 block mt-0.5">
                  Paneer lots made from this milk
                </span>
              </div>

              <div className="card p-4 border-red-200 bg-red-50/50">
                <span className="text-xs font-semibold text-red-800 uppercase block">
                  Stores To Notify
                </span>
                <p className="mt-1 text-2xl font-bold text-red-950 font-mono">
                  {(blastRadius.compromised_retail_destinations || blastRadius.affected_retailers || []).length}
                </p>
                <span className="text-[11px] text-red-700 block mt-0.5">
                  Retail points holding stock
                </span>
              </div>

              <div className="card p-4 border-emerald-200 bg-emerald-50/50">
                <span className="text-xs font-semibold text-emerald-800 uppercase block">
                  Protected Safe Batches
                </span>
                <p className="mt-1 text-2xl font-bold text-emerald-950 font-mono">
                  {safePaneerBatches.length}
                </p>
                <span className="text-[11px] text-emerald-700 block mt-0.5">
                  Zero contamination risk
                </span>
              </div>
            </div>

            {/* Affected Retailers List */}
            {(blastRadius.compromised_retail_destinations || blastRadius.affected_retailers || []).length > 0 && (
              <div className="card p-4 space-y-2">
                <h4 className="text-xs font-bold text-ink-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Store className="h-4 w-4 text-red-600" />
                  Retail Outlets Holding Recalled Batches:
                </h4>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(blastRadius.compromised_retail_destinations || blastRadius.affected_retailers || []).map((r, idx) => {
                    const storeName = r.destination_name || r.retailer_name;
                    const phone = r.contact_phone || r.phone;
                    return (
                      <div
                        key={idx}
                        className="rounded-control border border-red-200 bg-red-50/30 p-2.5 text-xs flex items-center justify-between"
                      >
                        <div>
                          <strong className="block text-ink-900">{storeName}</strong>
                          <span className="text-ink-500">
                            {r.location} · Batch {r.batch_id}
                            {r.quantity_dispatched ? ` (${r.quantity_dispatched} kg)` : ''}
                          </span>
                        </div>
                        {phone && (
                          <a
                            href={`tel:${phone}`}
                            className="btn btn-secondary btn-sm text-[11px]"
                          >
                            <Phone className="h-3 w-3" />
                            Call
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : null}

        {/* Execution & Confirmation Step */}
        {!executedEvent ? (
          <div className="card p-5 border-red-300 bg-red-50/20 space-y-4">
            <div>
              <h4 className="text-sm font-bold text-red-950 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-red-600" />
                Statutory Execution Confirmation
              </h4>
              <p className="muted text-xs mt-1">
                This action immediately marks the batch as <strong className="text-red-700">RECALLED</strong>, locks its public passport, flags downstream retailers, and generates an official FSSAI Schedule I notice.
              </p>
            </div>

            {isQA ? (
              <div className="space-y-3">
                <div>
                  <label className="label text-xs">
                    To confirm, please type <strong className="font-mono text-red-700">{targetBatchId}</strong>:
                  </label>
                  <input
                    type="text"
                    value={confirmBatchInput}
                    onChange={(e) => setConfirmBatchInput(e.target.value)}
                    placeholder={`Type ${targetBatchId} here`}
                    className="field uppercase text-sm font-mono max-w-sm"
                    disabled={isExecuting}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isExecuting}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleExecute}
                    disabled={!isConfirmMatch || isExecuting}
                    className="btn btn-danger"
                  >
                    {isExecuting ? 'Executing Recall…' : 'Execute Official Recall'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="alert alert-warn">
                <Lock className="h-4 w-4" />
                <div className="text-xs">
                  <strong>Inspector View Only:</strong> You can simulate blast-radiuses and identify stores to call. Only a plant <strong>QA Officer</strong> can sign off on statutory recall execution.
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="card p-6 border-emerald-300 bg-emerald-50/30 text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
              <CheckCircle className="h-6 w-6" />
            </div>
            <div>
              <h3 className="section-title text-emerald-950">
                Official Recall #{executedEvent.id} Issued Successfully
              </h3>
              <p className="muted text-xs mt-1">
                Root batch <strong className="font-mono">{executedEvent.root_batch_id}</strong> is now locked. Public consumers scanning this QR code are instructed to return packaging immediately.
              </p>
            </div>

            <div className="flex justify-center gap-3 pt-2">
              {onOpenFssaiNotice && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenFssaiNotice(executedEvent.id);
                  }}
                  className="btn btn-primary"
                >
                  <FileText className="h-4 w-4" />
                  Export FSSAI Schedule I Notice
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
