import React, { useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from './store';
import { applyPatch, resetForm } from './complaintSlice';
import { processComplaint, uploadComplaint, type AiResponse } from './api';
import { addMessage, resetChat, setAiResult, setProcessing } from './copilotSlice';

interface CopilotProps {
  batchId: string;
}

export function Copilot({ batchId }: CopilotProps) {
  const dispatch = useAppDispatch();
  const [draft, setDraft] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const { messages, processing, risk, rootCause, capaRecommendations, engine, missingFields } =
    useAppSelector((s) => s.copilot);
  const form = useAppSelector((s) => s.complaint.form);
  const status = useAppSelector((s) => s.complaint.status);

  const hasFormContent = Boolean(
    form.productName ||
      form.customerName ||
      form.batchLotNumber ||
      form.defectSummary ||
      form.detailedDescription ||
      messages.length > 1
  );

  const isComplaintSaved = status === 'Saved';
  const effectiveBatchId = form.batchLotNumber || batchId;

  const applyAiResult = (result: AiResponse) => {
    const patchWithRisk = {
      ...result.patch,
      ...(result.risk && !result.patch?.riskAssessment ? { riskAssessment: result.risk } : {}),
    };
    dispatch(applyPatch(patchWithRisk));
    dispatch(setAiResult(result));
    dispatch(addMessage({ id: crypto.randomUUID(), role: 'assistant', text: result.message }));
  };

  const submit = async () => {
    const text = draft.trim();
    if (!text || processing) return;
    dispatch(addMessage({ id: crypto.randomUUID(), role: 'user', text }));
    setDraft('');
    dispatch(setProcessing(true));
    try {
      applyAiResult(await processComplaint(effectiveBatchId, text, form));
    } catch (error) {
      dispatch(
        addMessage({
          id: crypto.randomUUID(),
          role: 'assistant',
          text: error instanceof Error ? error.message : 'Something went wrong.',
        })
      );
    } finally {
      dispatch(setProcessing(false));
    }
  };

  const upload = async (file?: File) => {
    if (!file || processing) return;
    if (file.size > 10 * 1024 * 1024) {
      dispatch(
        addMessage({
          id: crypto.randomUUID(),
          role: 'assistant',
          text: 'This file is larger than the 10 MB upload limit.',
        })
      );
      return;
    }
    dispatch(
      addMessage({
        id: crypto.randomUUID(),
        role: 'user',
        text: `Uploaded complaint document: ${file.name}`,
      })
    );
    dispatch(setProcessing(true));
    try {
      applyAiResult(await uploadComplaint(effectiveBatchId, file, form));
    } catch (error) {
      dispatch(
        addMessage({
          id: crypto.randomUUID(),
          role: 'assistant',
          text:
            error instanceof Error ? error.message : 'The document could not be processed.',
        })
      );
    } finally {
      dispatch(setProcessing(false));
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  // Interactive Quick Action Pill Handlers (Dairy-relabeled)
  const handleSummarize = () => {
    dispatch(
      addMessage({ id: crypto.randomUUID(), role: 'user', text: 'Summarize the complaint' })
    );
    const summaryText =
      `📋 DAIRY COMPLAINT EXECUTIVE SUMMARY:\n` +
      `• Reporter / Source: ${form.customerName || 'Pending identification'}${
        form.complaintSource ? ` (${form.complaintSource})` : ''
      }\n` +
      `• Product: ${form.productName || 'Dairy Product'}${
        form.strengthGrade ? ` (${form.strengthGrade})` : ''
      }\n` +
      `• Batch Number: ${form.batchLotNumber || effectiveBatchId}\n` +
      `• Affected Quantity: ${form.affectedQuantity || 'Not specified'}\n` +
      `• Incident Summary: ${
        form.defectSummary || form.detailedDescription || 'Quality deviation under evaluation'
      }\n` +
      `• Initial Triage: ${form.severity || 'Medium'} Severity | ${
        form.priority || 'High'
      } Priority`;
    dispatch(addMessage({ id: crypto.randomUUID(), role: 'assistant', text: summaryText }));
  };

  const handleCapa = () => {
    dispatch(addMessage({ id: crypto.randomUUID(), role: 'user', text: 'CAPA recommendation' }));
    const capaText =
      capaRecommendations.length > 0
        ? `🔧 RECOMMENDED CAPA ACTIONS:\n` +
          capaRecommendations.map((c, i) => `${i + 1}. ${c}`).join('\n')
        : `🔧 RECOMMENDED CAPA ACTIONS:\n` +
          `1. Immediate Containment: Place batch ${
            form.batchLotNumber || effectiveBatchId
          } and connected downstream paneer lots on QA quarantine hold.\n` +
          `2. Root Cause Audit: Review collection centre lactometer/MBRT logs, pasteurization HTST records, and reefer cold-chain logs.\n` +
          `3. Preventive Action: Enforce rapid adulterant & mycotoxin screening at intake and verify vacuum-pack seal integrity.`;
    dispatch(addMessage({ id: crypto.randomUUID(), role: 'assistant', text: capaText }));
  };

  const handleRisk = () => {
    dispatch(
      addMessage({ id: crypto.randomUUID(), role: 'user', text: 'AI risk classification' })
    );
    const riskText =
      `🛡️ AI RISK CLASSIFICATION:\n` +
      `• Severity Level: ${form.severity || 'High'}\n` +
      `• Priority Level: ${form.priority || 'High'}\n` +
      `• Triage Assessment: ${
        risk ||
        form.riskAssessment ||
        'Potential dairy safety/quality deviation requiring mandatory QA containment and batch genealogy check.'
      }`;
    dispatch(addMessage({ id: crypto.randomUUID(), role: 'assistant', text: riskText }));
  };

  const handleRootCause = () => {
    dispatch(
      addMessage({ id: crypto.randomUUID(), role: 'user', text: 'Root cause recommendation' })
    );
    const rcText =
      `🔬 ROOT CAUSE RECOMMENDATION:\n` +
      `• Scientific Hypothesis: ${
        rootCause ||
        'Potential cold-chain temperature excursion, raw milk intake contamination, or primary packaging seal failure.'
      }\n\n` +
      `• Recommended Dairy QA Investigation Plan:\n` +
      `  1. Inspect primary vacuum packaging seals and cold-storage temperature logs.\n` +
      `  2. Conduct NABL laboratory re-testing on retained batch samples (${
        form.batchLotNumber || effectiveBatchId
      }).\n` +
      `  3. Trace upstream milk collection centres and co-input vats via the Smart Recall Engine.`;
    dispatch(addMessage({ id: crypto.randomUUID(), role: 'assistant', text: rcText }));
  };

  const handleFileAnother = () => {
    dispatch(resetForm());
    dispatch(resetChat());
  };

  return (
    <aside className="dt-copilot-card">
      <header className="dt-copilot-header">
        <div className="dt-sparkle">✦</div>
        <div>
          <h2>DairyTrace AI Copilot</h2>
          <p>Drop complaint files or paste text below.</p>
        </div>
        <span
          className={`dt-engine-badge ${engine === 'groq' ? 'dt-engine-groq' : 'dt-engine-rules'}`}
          title={
            engine === 'groq'
              ? 'LangGraph + Groq LLM structured extraction active'
              : 'Deterministic rule-based regex extractor active (set GROQ_API_KEY to enable LLM)'
          }
        >
          <span className="dt-online" />
          {engine === 'groq' ? 'Groq AI' : 'Rule-based AI'}
        </span>
      </header>

      <div
        className={`dt-upload-zone ${dragging ? 'dragging' : ''}`}
        role="button"
        tabIndex={0}
        onClick={() => fileInput.current?.click()}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') fileInput.current?.click();
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void upload(event.dataTransfer.files[0]);
        }}
      >
        <input
          ref={fileInput}
          className="dt-file-input"
          type="file"
          accept=".pdf,.docx,.txt,.eml,application/pdf,text/plain,message/rfc822"
          onChange={(event) => void upload(event.target.files?.[0])}
        />
        <strong>⇧ Drag &amp; drop a complaint or lab document</strong>
        <span>or click to browse</span>
        <small>PDF, DOCX, TXT, EML · Max file size: 10 MB</small>
      </div>

      <div className="dt-chat-log">
        {messages.map((message) => (
          <div className={`dt-message ${message.role}`} key={message.id}>
            {message.text}
          </div>
        ))}
        {processing && (
          <div className="dt-message assistant">
            <span className="dt-typing">AI is processing complaint details…</span>
          </div>
        )}
      </div>

      {missingFields.length > 0 && (
        <div className="dt-missing-banner">
          <strong>Fields still needed for complete QMS triage:</strong>{' '}
          {missingFields.join(', ')}
        </div>
      )}

      {hasFormContent && (
        <div className="dt-quick-actions-container">
          <span className="dt-quick-actions-label">⚡ Select Quick Action:</span>
          <div className="dt-quick-actions-grid">
            <button type="button" className="dt-action-pill" onClick={handleSummarize}>
              📝 Summarize complaint
            </button>
            <button type="button" className="dt-action-pill" onClick={handleRisk}>
              🛡️ AI risk classification
            </button>
            <button type="button" className="dt-action-pill" onClick={handleRootCause}>
              🔬 Root cause recommendation
            </button>
            <button type="button" className="dt-action-pill" onClick={handleCapa}>
              🔧 CAPA recommendation
            </button>

            {isComplaintSaved && (
              <button
                type="button"
                className="dt-action-pill dt-action-pill-reset"
                onClick={handleFileAnother}
              >
                🔄 File another complaint
              </button>
            )}
          </div>
        </div>
      )}

      <div className="dt-chat-composer">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder="Type a message, paste a complaint, or request a targeted field edit (e.g. 'change affected quantity to 14 packs')…"
        />
        <button
          type="button"
          className="dt-send"
          onClick={() => void submit()}
          disabled={!draft.trim() || processing}
          aria-label="Send message to AI Copilot"
        >
          ✓
        </button>
      </div>
      <p className="dt-powered">
        YOUR TEXT IS PROCESSED BY AN AI SERVICE · LANGGRAPH COPILOT · VERIFY BEFORE COMMIT
      </p>
    </aside>
  );
}
