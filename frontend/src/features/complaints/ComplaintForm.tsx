import React, { useEffect, useState, type ChangeEvent } from 'react';
import { useAppDispatch, useAppSelector } from './store';
import { markSaved, resetForm, updateField } from './complaintSlice';
import { commitComplaintToDb, fetchSavedComplaints, updateSavedComplaintInDb } from './api';
import { addMessage, resetChat } from './copilotSlice';
import { LOCKED_FIELD_KEYS, type ComplaintForm as ComplaintFormType, type LockedBatchContext } from './types';
import { SavedComplaintsModal } from './SavedComplaintsModal';

type FieldProps = {
  label: string;
  field: keyof ComplaintFormType;
  type?: 'text' | 'date';
  placeholder?: string;
  locked?: boolean;
};

function Field({ label, field, type = 'text', placeholder, locked = false }: FieldProps) {
  const dispatch = useAppDispatch();
  const form = useAppSelector((s) => s.complaint.form);
  const changed = useAppSelector((s) => s.complaint.changedFields.includes(field));
  const isLockedField = locked || LOCKED_FIELD_KEYS.includes(field as keyof LockedBatchContext);

  return (
    <label className="dt-field">
      <span className="dt-field-label">
        <span>{label}</span>
        {isLockedField && <em className="dt-locked-tag">🔒 Locked from QR</em>}
        {!isLockedField && changed && <em className="dt-ai-tag">✦ AI updated</em>}
      </span>
      <input
        className={isLockedField ? 'dt-input-locked' : changed ? 'ai-updated' : ''}
        type={type}
        value={form[field]}
        readOnly={isLockedField}
        placeholder={placeholder}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          if (!isLockedField) {
            dispatch(updateField({ field, value: e.target.value }));
          }
        }}
      />
    </label>
  );
}

function SelectField({
  label,
  field,
  options,
}: {
  label: string;
  field: 'severity' | 'priority';
  options: string[];
}) {
  const dispatch = useAppDispatch();
  const rawValue = useAppSelector((s) => s.complaint.form[field]) || '';
  const changed = useAppSelector((s) => s.complaint.changedFields.includes(field));

  const matchedOption =
    options.find((opt) => opt.toLowerCase() === rawValue.toLowerCase()) ||
    options.find((opt) => rawValue.toLowerCase().includes(opt.toLowerCase())) ||
    (rawValue.toLowerCase().includes('critical') || rawValue.toLowerCase().includes('mycotoxin')
      ? 'Critical'
      : '') ||
    (rawValue.toLowerCase().includes('high') || rawValue.toLowerCase().includes('urgent')
      ? 'High'
      : '');

  return (
    <label className="dt-field">
      <span className="dt-field-label">
        <span>{label}</span>
        {changed && <em className="dt-ai-tag">✦ AI updated</em>}
      </span>
      <select
        className={changed ? 'ai-updated' : ''}
        value={matchedOption}
        onChange={(e) => dispatch(updateField({ field, value: e.target.value }))}
      >
        <option value="">Select…</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

interface ComplaintFormProps {
  batchId: string;
  otherReports: number;
  isStaff: boolean;
  isQA: boolean;
  onComplaintCommitted?: (recordNumber: string, otherCount: number) => void;
}

export function ComplaintForm({
  batchId,
  otherReports,
  isStaff,
  isQA,
  onComplaintCommitted,
}: ComplaintFormProps) {
  const dispatch = useAppDispatch();
  const form = useAppSelector((s) => s.complaint.form);
  const status = useAppSelector((s) => s.complaint.status);
  const activeSavedDbId = useAppSelector((s) => s.complaint.activeSavedDbId);
  const lastSavedNumber = useAppSelector((s) => s.complaint.lastSavedNumber);
  const changedFields = useAppSelector((s) => s.complaint.changedFields);
  const { risk, rootCause, capaRecommendations } = useAppSelector((s) => s.copilot);

  const [savedModalOpen, setSavedModalOpen] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [saving, setSaving] = useState(false);

  const refreshCount = async () => {
    if (!isStaff) return;
    try {
      const records = await fetchSavedComplaints();
      setSavedCount(records.length);
    } catch {
      // Ignore if public consumer
    }
  };

  useEffect(() => {
    void refreshCount();
  }, [isStaff]);

  const handleSaveOrUpdate = async () => {
    if (activeSavedDbId && !isStaff) {
      dispatch(resetForm());
      dispatch(resetChat());
      return;
    }

    const narrative = `${form.defectSummary} ${form.detailedDescription}`.trim();
    if (narrative.length < 5) {
      dispatch(
        addMessage({
          id: crypto.randomUUID(),
          role: 'assistant',
          text: '⚠️ Cannot save: Please enter or extract a defect summary or detailed description of the issue first (or paste your report into the AI Copilot on the right).',
        })
      );
      return;
    }

    setSaving(true);
    try {
      const effectiveBatchId = form.batchLotNumber || batchId;
      const effectiveRisk = form.riskAssessment || risk;
      if (activeSavedDbId && isStaff) {
        const updatedRecord = await updateSavedComplaintInDb(
          activeSavedDbId,
          effectiveBatchId,
          form,
          effectiveRisk,
          rootCause,
          capaRecommendations
        );
        void refreshCount();
        dispatch(
          markSaved({ id: updatedRecord.id, complaintNumber: updatedRecord.complaintNumber })
        );
        dispatch(
          addMessage({
            id: crypto.randomUUID(),
            role: 'assistant',
            text: `📝 Record No. ${updatedRecord.complaintNumber} updated successfully in the DairyTrace QMS Database!`,
          })
        );
        onComplaintCommitted?.(updatedRecord.complaintNumber, otherReports);
      } else {
        const savedRecord = await commitComplaintToDb(
          effectiveBatchId,
          form,
          effectiveRisk,
          rootCause,
          capaRecommendations
        );
        void refreshCount();
        dispatch(
          markSaved({ id: savedRecord.id, complaintNumber: savedRecord.complaintNumber })
        );

        const productInfo = savedRecord.productName
          ? `${savedRecord.productName} (Batch: ${savedRecord.batchLotNumber || effectiveBatchId})`
          : `Batch ${effectiveBatchId}`;

        const flagNote = savedRecord.autoFlagged
          ? `\n\n🚨 Multi-Reporter Safety Signal: This batch has reached 3+ independent reports and has been automatically flagged "Under review" in the Staff Audit Inbox.`
          : savedRecord.otherReports && savedRecord.otherReports > 0
          ? `\n\nℹ️ Note: ${savedRecord.otherReports} other open report(s) are also logged on this batch.`
          : '';

        const ledgerHint = isStaff
          ? 'You can view or edit saved complaints anytime in 📁 Saved Complaints, or click "🔄 File another complaint" in Quick Actions.'
          : 'Your reference number has been recorded for food safety inspection. Click "🔄 File another complaint" in Quick Actions to submit another report.';

        dispatch(
          addMessage({
            id: crypto.randomUUID(),
            role: 'assistant',
            text: `✅ Saved to DairyTrace QMS Database! ${productInfo} assigned Record No. ${savedRecord.complaintNumber}.${flagNote}\n\n${ledgerHint}`,
          })
        );
        onComplaintCommitted?.(
          savedRecord.complaintNumber,
          savedRecord.otherReports ?? otherReports
        );
      }
    } catch (error) {
      dispatch(
        addMessage({
          id: crypto.randomUUID(),
          role: 'assistant',
          text:
            error instanceof Error
              ? `❌ ${error.message}`
              : 'Could not save complaint to database.',
        })
      );
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    dispatch(resetForm());
    dispatch(
      addMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        text: '↻ Editable form fields have been reset. Scanned batch identification remains locked.',
      })
    );
  };

  const effectiveRootCause =
    rootCause ||
    (form.defectSummary || form.detailedDescription
      ? 'Cold-chain temperature excursion, raw milk intake deviation, or primary package seal failure under investigation.'
      : '');

  const effectiveCapas =
    capaRecommendations.length > 0
      ? capaRecommendations
      : form.defectSummary || form.detailedDescription
      ? [
          `Immediate Containment: Place batch ${form.batchLotNumber || batchId} on QA hold and verify downstream paneer links.`,
          'Root Cause Audit: Review collection centre lactometer/MBRT logs, pasteurization HTST charts, and cold-chain telemetry.',
          'Preventive Action: Tighten supplier intake screening and packaging seal integrity checks.',
        ]
      : [];

  return (
    <section className="dt-form-card">
      <header className="dt-form-header">
        <div>
          <h1>Log Dairy Quality &amp; Safety Complaint</h1>
          <p>
            DairyTrace QMS &amp; Consumer Safety Module · Scanned Batch{' '}
            <strong>{form.batchLotNumber || batchId}</strong>
          </p>
        </div>
        <div className="dt-header-actions">
          {otherReports > 0 && (
            <span className="dt-other-reports-pill" title="Independent open reports logged against this batch">
              ⚠️ {otherReports} other open {otherReports === 1 ? 'report' : 'reports'} on this batch
            </span>
          )}
          <span className={`dt-status-pill ${status === 'Saved' ? 'dt-status-saved' : ''}`}>
            {status === 'Saved' && lastSavedNumber ? `Saved · ${lastSavedNumber}` : status}
          </span>
          {isStaff && (
            <button
              type="button"
              className="dt-ledger-btn"
              onClick={() => setSavedModalOpen(true)}
            >
              📁 Saved Complaints ({savedCount})
            </button>
          )}
        </div>
      </header>

      <FormSection title="Reporter details" summary="Source and contact information">
        <Field
          label="Complaint Source"
          field="complaintSource"
          placeholder="e.g., Consumer, Retailer A (Kothrud), Inspector, Lab (NABL)"
        />
        <Field
          label="Reporter / Customer Name"
          field="customerName"
          placeholder="Awaiting AI extraction or enter name…"
        />
      </FormSection>

      <FormSection title="Product and batch" summary="Verified product details from this QR code">
        <Field
          label="Dairy Product Name"
          field="productName"
          locked
          placeholder="Locked from scanned batch"
        />
        <Field
          label="Pack Size / Fat & SNF Grade"
          field="strengthGrade"
          placeholder="e.g., 200 g pack / Fat 4.5%, SNF 8.6%"
        />
        <Field
          label="Batch / Lot Number"
          field="batchLotNumber"
          locked
          placeholder="Locked from scanned batch"
        />
        <Field
          label="Affected Quantity (Packs / Litres)"
          field="affectedQuantity"
          placeholder="e.g., 14 packs or 600 L"
        />
        <Field
          label="Manufacturing / Collection Date"
          field="manufacturingDate"
          locked
          placeholder="Locked from scanned batch"
        />
        <Field
          label="Expiry / Best Before Date"
          field="expiryDate"
          locked
          placeholder="Locked from scanned batch"
        />
      </FormSection>

      <FormSection title="Facility and impact" summary="Origin site and affected material">
        <Field
          label="Originating Dairy Facility / Plant"
          field="originatingSite"
          locked
          placeholder="Locked from scanned batch"
        />
        <Field
          label="Impacted Material / Packaging"
          field="impactedMaterial"
          placeholder="e.g., vacuum pouch seal, downstream paneer vat"
        />
      </FormSection>

      <FormSection title="What happened?" summary="Describe the issue and when it occurred" open>
        <Field
          label="Complaint Type"
          field="complaintType"
          placeholder="e.g., Spoilage / Sourness, Chemical / Mycotoxin Contaminant"
        />
        <Field
          label="Complaint Date"
          field="complaintDate"
          placeholder="e.g., 22 October 2026"
        />
        <label className="dt-field dt-field-wide">
          <span className="dt-field-label">
            <span>Structured Defect Summary</span>
            {changedFields.includes('defectSummary') && (
              <em className="dt-ai-tag">✦ AI updated</em>
            )}
          </span>
          <textarea
            className={changedFields.includes('defectSummary') ? 'ai-updated' : ''}
            value={form.defectSummary}
            placeholder="AI will synthesize the complaint into a formal dairy QMS defect summary…"
            onChange={(e) =>
              dispatch(updateField({ field: 'defectSummary', value: e.target.value }))
            }
          />
        </label>
        <label className="dt-field dt-field-wide">
          <span className="dt-field-label">
            <span>Detailed Incident Description</span>
            {changedFields.includes('detailedDescription') && (
              <em className="dt-ai-tag">✦ AI updated</em>
            )}
          </span>
          <textarea
            className={changedFields.includes('detailedDescription') ? 'ai-updated' : ''}
            value={form.detailedDescription}
            placeholder="Full narrative of the observation, lab metrics (Fat %, SNF %, Aflatoxin M1), or store shelf findings…"
            onChange={(e) =>
              dispatch(updateField({ field: 'detailedDescription', value: e.target.value }))
            }
          />
        </label>
      </FormSection>

      <FormSection title="Assessment and actions" summary="Severity, risk review, and AI recommendations">
        <SelectField
          label="Initial Severity"
          field="severity"
          options={['Low', 'Medium', 'High', 'Critical', 'Needs QA Review']}
        />
        <SelectField
          label="Priority"
          field="priority"
          options={['Low', 'Medium', 'High', 'Urgent', 'Needs QA Review']}
        />
        <label className="dt-field dt-field-wide">
          <span className="dt-field-label">
            <span>AI Risk Assessment &amp; Triage Rationale</span>
            {(changedFields.includes('riskAssessment') || Boolean(risk)) && (
              <em className="dt-ai-tag">✦ AI evaluated</em>
            )}
          </span>
          <textarea
            className={changedFields.includes('riskAssessment') ? 'ai-updated' : ''}
            value={form.riskAssessment || risk || ''}
            placeholder="AI risk classification and food-safety impact evaluation…"
            onChange={(e) =>
              dispatch(updateField({ field: 'riskAssessment', value: e.target.value }))
            }
          />
        </label>

        {/* Live Root Cause & CAPA Panel visible to both Consumers and Staff */}
        <div className="dt-field-wide dt-insight-panel">
          <div className="dt-insight-section">
            <strong>🔬 Root Cause Hypothesis:</strong>
            <p>
              {effectiveRootCause ||
                'Paste a complaint or upload a lab report in the AI Copilot to generate a scientific root cause hypothesis.'}
            </p>
          </div>
          <div className="dt-insight-section">
            <strong>🔧 CAPA (Corrective &amp; Preventive Action) Recommendations:</strong>
            {effectiveCapas.length > 0 ? (
              <ol className="dt-capa-list">
                {effectiveCapas.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ol>
            ) : (
              <p>
                CAPA containment and preventive recommendations will appear here once complaint details are entered or extracted.
              </p>
            )}
          </div>
        </div>
      </FormSection>

      <div className="dt-form-actions">
        <button type="button" className="dt-secondary" onClick={handleReset}>
          ↻ Reset form
        </button>
        <button
          type="button"
          className="dt-primary"
          disabled={saving}
          onClick={() => void handleSaveOrUpdate()}
        >
          {saving
            ? 'Saving to QMS…'
            : activeSavedDbId && isStaff
            ? '✓ Update saved record'
            : activeSavedDbId && !isStaff
            ? '🔄 File another complaint'
            : '▣ Save complaint'}
        </button>
      </div>

      {isStaff && (
        <SavedComplaintsModal
          isOpen={savedModalOpen}
          onClose={() => {
            setSavedModalOpen(false);
            void refreshCount();
          }}
          batchId={batchId}
          isQA={isQA}
          onChanged={() => void refreshCount()}
        />
      )}
    </section>
  );
}

function FormSection({
  title,
  summary,
  children,
  open = false,
}: {
  title: string;
  summary: string;
  children: React.ReactNode;
  open?: boolean;
}) {
  return (
    <details className="dt-fieldset" open={open}>
      <summary className="dt-legend">
        <span>{title}</span>
        <span className="dt-section-summary">{summary}</span>
      </summary>
      <div className="dt-field-grid">{children}</div>
    </details>
  );
}
