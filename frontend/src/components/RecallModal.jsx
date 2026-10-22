import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Phone,
  FileText,
  X,
  RefreshCw,
  CheckCircle,
  Package,
  Milk,
  Store,
  Lock,
} from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';

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
  const [reason, setReason] = useState(
    'Elevated Aflatoxin M1 detected (0.78 ug/kg > FSSAI safe limit 0.50 ug/kg)'
  );
  const [severity, setSeverity] = useState('CRITICAL');
  const [confirmBatchInput, setConfirmBatchInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [blastRadius, setBlastRadius] = useState(null);
  const [executedEvent, setExecutedEvent] = useState(null);
  const [actionError, setActionError] = useState('');

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
        err.message || 'The safety impact preview could not be loaded. Try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    if (!isQA) {
      setActionError('Only a QA Officer can execute an official food recall.');
      return;
    }
    if (confirmBatchInput.trim().toUpperCase() !== targetBatchId.toUpperCase()) {
      setActionError(`Type "${targetBatchId}" in the confirmation box before issuing the recall.`);
      return;
    }
    setLoading(true);
    setActionError('');
    try {
      const res = await api.executeRecall({
        batch_id: targetBatchId,
        reason,
        severity,
      });
      setExecutedEvent(res.recall_event);
      if (onRecallExecuted) {
        onRecallExecuted(res);
      }
    } catch (err) {
      setActionError(err.message || 'The safety action could not be saved. Try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && initialBatchId) {
      const cleanId = initialBatchId;
      setTargetBatchId(cleanId);
      setConfirmBatchInput(cleanId);
      const startingReason =
        initialReason ||
        'Elevated Aflatoxin M1 detected (0.78 ug/kg > FSSAI safe limit 0.50 ug/kg)';
      setReason(startingReason);
      setExecutedEvent(null);
      setActionError('');
      handleSimulate(cleanId, startingReason);
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

  if (!isOpen) return null;

  const isConfirmMatch =
    confirmBatchInput.trim().toUpperCase() === targetBatchId.toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white border border-stone-200 rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Clean Header */}
        <div className="bg-red-50/80 border-b border-red-200/80 p-5 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-red-600 flex items-center justify-center text-white shadow-sm">
              <ShieldAlert className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold text-stone-900 tracking-tight">
                  Smart Recall Blast-Radius Simulation &amp; Execution
                </h3>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-200">
                  BFS Graph Engine · FSSAI Schedule I
                </span>
              </div>
              <p className="text-xs sm:text-sm text-stone-600">
                Instantly trace affected paneer packs, co-input milk vats, and retail stores while protecting safe, unrelated dairy batches.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-stone-500 hover:text-stone-900 hover:bg-white/80 transition-colors"
            aria-label="Close recall modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {actionError && (
            <p
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800"
            >
              {actionError}
            </p>
          )}

          {/* Batch Selection & Reason Form */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-2xl bg-[#FAF7F2] border border-stone-200/90">
            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wide mb-1.5">
                Batch to Check / Flag
              </label>
              <select
                value={targetBatchId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setTargetBatchId(nextId);
                  setConfirmBatchInput(nextId);
                  setExecutedEvent(null);
                  handleSimulate(nextId);
                }}
                className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2 text-sm font-bold text-stone-900 focus:outline-none focus:border-red-500"
              >
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.id} ({b.product_type === 'MILK' ? 'Milk' : 'Paneer'} —{' '}
                    {b.facility_name.split(' ')[0]})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wide mb-1.5">
                Safety Alert Classification
              </label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2 text-sm font-semibold text-stone-900 focus:outline-none focus:border-red-500"
              >
                <option value="CRITICAL">Class I: Urgent Health Risk</option>
                <option value="MAJOR">Class II: Quality Non-Compliance</option>
                <option value="PRECAUTIONARY">Class III: Precautionary Hold</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wide mb-1.5">
                Verified Actor (From JWT Token)
              </label>
              <div className="w-full bg-stone-100 border border-stone-200 rounded-xl px-3 py-2 text-xs font-bold text-stone-700 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-800 shrink-0" />
                <span className="truncate">
                  {user ? `${user.full_name} (${user.role})` : 'Authenticated Staff'}
                </span>
              </div>
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wide mb-1.5">
                Reason for Safety Check or Recall
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="flex-1 bg-white border border-stone-300 rounded-xl px-3.5 py-2 text-sm text-stone-900 focus:outline-none focus:border-red-500"
                />
                <button
                  type="button"
                  onClick={() => handleSimulate(targetBatchId)}
                  disabled={loading}
                  className="px-4 py-2 bg-white hover:bg-stone-100 border border-stone-300 rounded-xl text-xs font-bold text-stone-800 flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  Update Preview
                </button>
              </div>

              {/* Quick Reason Presets */}
              <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                <span className="text-xs text-stone-500 font-medium">Common Reasons:</span>
                <button
                  type="button"
                  onClick={() =>
                    setReason(
                      'Elevated Aflatoxin M1 detected (0.78 ug/kg > FSSAI safe limit 0.50 ug/kg)'
                    )
                  }
                  className="text-xs px-2.5 py-1 rounded-lg bg-white hover:bg-stone-100 text-stone-700 border border-stone-200 font-medium"
                >
                  Aflatoxin M1 Above Limit
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setReason('Antibiotic residue detected above permissible dairy limit')
                  }
                  className="text-xs px-2.5 py-1 rounded-lg bg-white hover:bg-stone-100 text-stone-700 border border-stone-200 font-medium"
                >
                  Antibiotic Residue
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setReason('Cold-chain temperature excursion during transit')
                  }
                  className="text-xs px-2.5 py-1 rounded-lg bg-white hover:bg-stone-100 text-stone-700 border border-stone-200 font-medium"
                >
                  Cold-Chain Issue
                </button>
              </div>
            </div>
          </div>

          {/* Impact Preview */}
          {blastRadius && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-red-600" />
                  Recall Impact Summary for{' '}
                  <span className="text-red-700">{blastRadius.root_batch}</span>
                </h4>
                <span className="text-xs text-stone-500 font-medium">
                  Non-destructive BFS simulation preview
                </span>
              </div>

              {/* 4 Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-4 rounded-xl bg-red-50/70 border border-red-200 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-100 text-red-700 flex items-center justify-center flex-shrink-0">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] text-red-800 font-bold block uppercase">
                      Paneer to Recall
                    </span>
                    <span className="text-lg font-extrabold text-stone-900">
                      {blastRadius.affected_product_batches.length}{' '}
                      {blastRadius.affected_product_batches.length === 1 ? 'Batch' : 'Batches'}
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center flex-shrink-0">
                    <Milk className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] text-amber-900 font-bold block uppercase">
                      Milk Co-Inputs to Hold
                    </span>
                    <span className="text-lg font-extrabold text-stone-900">
                      {blastRadius.co_input_batches_for_review.length}{' '}
                      {blastRadius.co_input_batches_for_review.length === 1 ? 'Batch' : 'Batches'}
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-sky-50/70 border border-sky-200 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-800 flex items-center justify-center flex-shrink-0">
                    <Store className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] text-sky-900 font-bold block uppercase">
                      Stores to Alert
                    </span>
                    <span className="text-lg font-extrabold text-stone-900">
                      {blastRadius.compromised_retail_destinations.length}{' '}
                      {blastRadius.compromised_retail_destinations.length === 1
                        ? 'Store'
                        : 'Stores'}
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center flex-shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] text-emerald-900 font-bold block uppercase">
                      Safe &amp; Untouched
                    </span>
                    <span className="text-lg font-extrabold text-emerald-900">
                      {safePaneerBatches.length} Paneer{' '}
                      {safePaneerBatches.length === 1 ? 'Batch' : 'Batches'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Detailed Lists */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left Column: Affected Products & Co-Inputs */}
                <div className="space-y-3">
                  <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-stone-200/90">
                    <span className="text-xs font-bold text-red-700 uppercase tracking-wide flex items-center gap-1.5 mb-2.5">
                      <Package className="w-4 h-4" />
                      Finished Products to Withdraw ({blastRadius.affected_product_batches.length})
                    </span>
                    <div className="space-y-2">
                      {blastRadius.affected_product_batches.map((batchId) => (
                        <div
                          key={batchId}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-red-200 text-xs"
                        >
                          <div>
                            <span className="font-bold text-stone-900">{batchId}</span>
                            <span className="text-stone-500 ml-2">
                              Made using {targetBatchId}
                            </span>
                          </div>
                          <span className="px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 font-bold text-[11px]">
                            Recall Pack
                          </span>
                        </div>
                      ))}
                      {blastRadius.affected_product_batches.length === 0 && (
                        <p className="text-xs text-stone-500 italic">
                          No downstream paneer batches were made from this batch.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-stone-200/90">
                    <span className="text-xs font-bold text-amber-800 uppercase tracking-wide flex items-center gap-1.5 mb-2.5">
                      <Milk className="w-4 h-4" />
                      Blended Milk Batches to Hold for Re-Testing
                    </span>
                    <div className="space-y-2">
                      {blastRadius.co_input_batches_for_review.map((coId) => (
                        <div
                          key={coId}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-amber-200 text-xs"
                        >
                          <div>
                            <span className="font-bold text-stone-900">{coId}</span>
                            <span className="text-stone-500 ml-2">
                              Mixed in the same vat as {targetBatchId}
                            </span>
                          </div>
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[11px]">
                            Place on Hold
                          </span>
                        </div>
                      ))}
                      {blastRadius.co_input_batches_for_review.length === 0 && (
                        <p className="text-xs text-stone-500 italic">
                          No other milk batches were mixed with this batch.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Column: Retail Stores to Notify */}
                <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-stone-200/90 flex flex-col">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-xs font-bold text-stone-800 uppercase tracking-wide flex items-center gap-1.5">
                      <Store className="w-4 h-4 text-emerald-700" />
                      Retail Stores Holding Affected Stock
                    </span>
                    <span className="text-xs font-bold text-stone-700 bg-white px-2.5 py-0.5 rounded-md border border-stone-200">
                      Total:{' '}
                      {blastRadius.total_retail_units_at_risk ??
                        blastRadius.total_retail_units ??
                        (blastRadius.compromised_retail_destinations || []).reduce(
                          (acc, d) => acc + (Number(d.quantity_dispatched) || 0),
                          0
                        )}{' '}
                      kg
                    </span>
                  </div>

                  <div className="space-y-2.5 overflow-y-auto max-h-56 pr-1">
                    {blastRadius.compromised_retail_destinations.map((dest, idx) => (
                      <div
                        key={dest.id || idx}
                        className="p-3 rounded-xl bg-white border border-stone-200/90 text-xs space-y-2"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="font-bold text-stone-900 block">
                              {dest.destination_name}
                            </span>
                            <span className="text-stone-500">{dest.location}</span>
                          </div>
                          <span className="text-red-800 font-bold bg-red-50 px-2.5 py-0.5 rounded-lg border border-red-200 text-xs">
                            {dest.quantity_dispatched} kg
                          </span>
                        </div>

                        <div className="pt-2 border-t border-stone-100 flex items-center justify-between">
                          <span className="text-stone-600">
                            Batch: <strong className="text-stone-900">{dest.batch_id}</strong>
                          </span>
                          <a
                            href={`tel:${dest.contact_phone}`}
                            className="flex items-center gap-1 text-red-700 hover:text-red-800 font-bold"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            {dest.contact_phone}
                          </a>
                        </div>
                      </div>
                    ))}
                    {blastRadius.compromised_retail_destinations.length === 0 && (
                      <p className="text-xs text-stone-500 italic">
                        No retail store deliveries affected.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Confirmation input for QA Officer */}
          {isQA && !executedEvent && (
            <div className="p-4 rounded-2xl border border-red-200 bg-red-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <label
                  htmlFor="confirm-recall-batch"
                  className="text-xs font-bold text-red-900 block"
                >
                  Confirm Batch Code to Authorize Statutory Recall
                </label>
                <p className="text-[11px] text-red-800/80">
                  Type <strong>{targetBatchId}</strong> to confirm irreversible recall &amp; quarantine status updates.
                </p>
              </div>
              <input
                id="confirm-recall-batch"
                type="text"
                value={confirmBatchInput}
                onChange={(e) => setConfirmBatchInput(e.target.value)}
                placeholder={targetBatchId}
                className="w-full sm:w-44 rounded-xl border border-red-300 bg-white px-3 py-1.5 text-sm font-bold uppercase text-stone-900 focus:border-red-600 focus:outline-none"
              />
            </div>
          )}

          {/* Confirmation Banner when Executed */}
          {executedEvent && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-700 flex-shrink-0 mt-0.5" />
              <div>
                <h5 className="text-sm font-bold text-emerald-900">
                  Safety Recall Confirmed &amp; Updated Across All Records
                </h5>
                <p className="text-xs text-emerald-800 mt-0.5 leading-relaxed">
                  Affected batches are now marked <strong>Recalled</strong>, blended milk batches are placed <strong>On Hold</strong>, and the Customer QR Passport now displays an immediate safety notice.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-[#FAF7F2] border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-stone-600 font-medium">
            {executedEvent ? (
              <span className="text-emerald-800 font-bold flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-700" />
                Official Recall Notice #{executedEvent.id} Generated
              </span>
            ) : isQA ? (
              <span>
                Unaffected control batches (such as PAN-303) remain safe and active.
              </span>
            ) : (
              <span className="text-amber-900 font-semibold">
                Inspector Mode: Blast-radius preview only. QA Officer clearance is required to execute recalls or export FSSAI notices.
              </span>
            )}
          </div>

          {isQA ? (
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              {executedEvent && (
                <button
                  type="button"
                  onClick={() => onOpenFssaiNotice(executedEvent.id)}
                  className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-white hover:bg-stone-100 text-stone-800 border border-stone-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                >
                  <FileText className="w-4 h-4 text-amber-700" />
                  View FSSAI Recall Report
                </button>
              )}

              <button
                type="button"
                onClick={handleExecute}
                disabled={loading || !blastRadius || !isConfirmMatch}
                className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-1.5 transition-colors"
              >
                <ShieldAlert className="w-4 h-4 stroke-[2.2]" />
                {executedEvent ? 'Re-Issue Recall' : 'Confirm & Issue Recall'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-stone-300 bg-white text-xs font-bold text-stone-700 hover:bg-stone-100"
            >
              Close Simulation
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
