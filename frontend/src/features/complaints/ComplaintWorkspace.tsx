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
      <div className="min-h-screen bg-canvas flex flex-col items-center justify-center p-6 text-ink-600 gap-3">
        <LoaderCircle className="h-7 w-7 animate-spin text-brand-800" />
        <p className="text-sm font-semibold">
          Binding complaint workspace to scanned batch <strong>{batchId}</strong>…
        </p>
      </div>
    );
  }

  if (loadError || !contextData) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center p-6">
        <div
          role="alert"
          className="max-w-md rounded-card border border-red-200 bg-white p-8 text-center shadow-card"
        >
          <ShieldAlert className="mx-auto h-10 w-10 text-red-700" />
          <h2 className="mt-3 font-display text-xl font-bold text-ink-900">
            Scanned Batch Required
          </h2>
          <p className="mt-2 text-sm leading-6 text-ink-600">{loadError}</p>
          <button
            type="button"
            onClick={onBack}
            className="mt-5 btn btn-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Return
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas pb-14 text-ink-800">
      {/* Bound Batch Context Subheader */}
      <div className="border-b border-ink-200 bg-canvas/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="btn btn-secondary btn-sm"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {mode === 'staff' ? `Back to Batch ${contextData.batchId} Audit` : `Back to ${contextData.batchId} Passport`}
            </button>

            <div className="badge badge-safe py-1 px-3 text-xs flex items-center gap-2">
              <Lock className="h-3.5 w-3.5 text-brand-800" />
              <span>Bound to Scanned Batch: {contextData.batchId}</span>
              <span className="text-brand-800/80 font-normal">
                · {contextData.locked.productName} ({contextData.locked.originatingSite})
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="badge badge-neutral py-1 px-3 text-xs flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-brand-700" />
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
                className="btn btn-danger btn-sm"
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
