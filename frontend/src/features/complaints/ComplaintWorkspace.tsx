import React, { useEffect, useState } from 'react';
import { ArrowLeft, LoaderCircle, Lock, Milk, ShieldAlert, Sparkles } from 'lucide-react';
import { api } from '../../api';
import { useAuth } from '../../auth/AuthContext';
import { ComplaintStoreProvider, useAppDispatch } from './store';
import { setLockedContext } from './complaintSlice';
import { setEngine } from './copilotSlice';
import { fetchComplaintBatchContext, type BatchComplaintContext } from './api';
import { ComplaintForm } from './ComplaintForm';
import { Copilot } from './Copilot';
import './complaints.css';

interface WorkspaceProps {
  batchId: string;
  mode: 'consumer' | 'staff';
  onBack: () => void;
  onInitiateRecall?: (batchId: string, reason: string) => void;
}

function ComplaintWorkspaceInner({
  batchId,
  mode,
  onBack,
  onInitiateRecall,
}: WorkspaceProps) {
  const dispatch = useAppDispatch();
  const { user, isStaff, isQA } = useAuth();
  const [contextData, setContextData] = useState<BatchComplaintContext | null>(null);
  const [otherReports, setOtherReports] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [aiMode, setAiMode] = useState<'groq' | 'rule-based'>('rule-based');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError('');

    Promise.all([
      fetchComplaintBatchContext(batchId),
      api.getHealth().catch(() => ({ ai_mode: 'rule-based' })),
    ])
      .then(([ctx, health]) => {
        if (!active) return;
        setContextData(ctx);
        setOtherReports(ctx.otherReports || 0);
        const engineMode = health?.ai_mode === 'groq' ? 'groq' : 'rule-based';
        setAiMode(engineMode);
        dispatch(setEngine(engineMode));
        const defaultSource =
          mode === 'staff' && user?.role
            ? user.role === 'QA_OFFICER'
              ? 'QA Officer'
              : 'Inspector'
            : 'Consumer';
        dispatch(
          setLockedContext({
            locked: ctx.locked,
            defaultSource,
            defaultCustomerName: mode === 'staff' && user?.full_name ? user.full_name : '',
            defaultStrengthGrade: ctx.defaults?.strengthGrade || '',
          })
        );
      })
      .catch((err) => {
        if (!active) return;
        setLoadError(
          err?.status === 404
            ? `Batch "${batchId}" was not found. Complaints can only be filed for a valid scanned batch.`
            : err?.message || 'Could not load scanned batch context.'
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [batchId, mode, user, dispatch]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf8f2] flex flex-col items-center justify-center p-6 text-stone-600 gap-3">
        <LoaderCircle className="h-7 w-7 animate-spin text-emerald-800" />
        <p className="text-sm font-semibold">
          Binding complaint workspace to scanned batch <strong>{batchId}</strong>…
        </p>
      </div>
    );
  }

  if (loadError || !contextData) {
    return (
      <div className="min-h-screen bg-[#faf8f2] flex items-center justify-center p-6">
        <div
          role="alert"
          className="max-w-md rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-sm"
        >
          <ShieldAlert className="mx-auto h-10 w-10 text-rose-700" />
          <h2 className="mt-3 font-display text-xl font-bold text-stone-900">
            Scanned Batch Required
          </h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">{loadError}</p>
          <button
            type="button"
            onClick={onBack}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-950"
          >
            <ArrowLeft className="h-4 w-4" />
            Return
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf8f2] pb-14">
      {/* Bound Batch Context Subheader */}
      <div className="border-b border-stone-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3.5 text-xs font-bold text-stone-700 transition hover:bg-stone-50"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {mode === 'staff' ? `Back to Batch ${contextData.batchId} Audit` : `Back to ${contextData.batchId} Passport`}
            </button>

            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-1.5 text-xs font-bold text-emerald-950">
              <Lock className="h-3.5 w-3.5 text-emerald-800" />
              <span>Bound to Scanned Batch: {contextData.batchId}</span>
              <span className="text-emerald-700 font-medium">
                · {contextData.locked.productName} ({contextData.locked.originatingSite})
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-[#faf9f5] px-3 py-1 text-xs font-semibold text-stone-700">
              <Sparkles className="h-3.5 w-3.5 text-emerald-700" />
              AI Mode: {aiMode === 'groq' ? 'Groq LangGraph LLM' : 'Rule-based Regex Fallback'}
            </span>

            {isStaff && isQA && onInitiateRecall && (
              <button
                type="button"
                onClick={() =>
                  onInitiateRecall(
                    contextData.batchId,
                    `Escalated from QMS Complaint Workspace for batch ${contextData.batchId}`
                  )
                }
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-rose-700 px-3.5 text-xs font-bold text-white hover:bg-rose-800 transition"
              >
                <ShieldAlert className="h-3.5 w-3.5" />
                Simulate / Run Recall
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Exact Two-Panel Complaint Form + AI Copilot Layout */}
      <main className="dt-complaint-shell">
        <ComplaintForm
          batchId={contextData.batchId}
          otherReports={otherReports}
          isStaff={Boolean(isStaff && mode === 'staff')}
          isQA={Boolean(isQA && mode === 'staff')}
          onComplaintCommitted={(_num, updatedOtherCount) => {
            setOtherReports(updatedOtherCount);
          }}
        />
        <Copilot batchId={contextData.batchId} />
      </main>
    </div>
  );
}

export default function ComplaintWorkspace(props: WorkspaceProps) {
  return (
    <ComplaintStoreProvider>
      <ComplaintWorkspaceInner {...props} />
    </ComplaintStoreProvider>
  );
}
