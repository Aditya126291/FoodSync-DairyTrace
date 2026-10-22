import React, { useEffect, useState } from 'react';
import { useAppDispatch } from './store';
import { loadSavedComplaintForEditing } from './complaintSlice';
import {
  deleteSavedComplaint,
  fetchSavedComplaints,
  updateComplaintRecordStatus,
  type SavedComplaintRecord,
} from './api';
import { addMessage, resetChat, setAiResult } from './copilotSlice';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  batchId?: string;
  isQA?: boolean;
  onChanged?: () => void;
}

const STATUS_OPTIONS = ['Committed', 'Under review', 'Recall triggered', 'Resolved'];

export function SavedComplaintsModal({
  isOpen,
  onClose,
  batchId,
  isQA = false,
  onChanged,
}: Props) {
  const dispatch = useAppDispatch();
  const [records, setRecords] = useState<SavedComplaintRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<SavedComplaintRecord | null>(null);
  const [filterBatchOnly, setFilterBatchOnly] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const loadData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const data = await fetchSavedComplaints(filterBatchOnly && batchId ? batchId : undefined);
      setRecords(data);
      if (data.length > 0) {
        const keep = selected ? data.find((r) => r.id === selected.id) : null;
        setSelected(keep || data[0]);
      } else {
        setSelected(null);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not load saved complaints.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      void loadData();
    }
  }, [isOpen, filterBatchOnly, batchId]);

  const handleDelete = async (id: number) => {
    if (!isQA) return;
    setErrorMsg('');
    try {
      await deleteSavedComplaint(id);
      if (selected?.id === id) setSelected(null);
      await loadData();
      onChanged?.();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not delete complaint record.');
    }
  };

  const handleStatusChange = async (id: number, newStatus: string) => {
    setErrorMsg('');
    try {
      const updated = await updateComplaintRecordStatus(id, newStatus);
      setSelected(updated);
      await loadData();
      onChanged?.();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not update status.');
    }
  };

  const handleEditRecord = (record: SavedComplaintRecord) => {
    dispatch(loadSavedComplaintForEditing(record));
    dispatch(resetChat());
    dispatch(
      setAiResult({
        missingFields: [],
        risk: record.riskAssessment || null,
        rootCause: record.rootCause || null,
        capaRecommendations: record.capaRecommendations || [],
      })
    );
    dispatch(
      addMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        text: `📂 Loaded saved complaint ${record.complaintNumber} for editing.\n\nForm fields have been pre-filled with all previous details. Any updates will automatically sync to the database record until you click "File another complaint".`,
      })
    );
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="dt-modal-backdrop" onClick={onClose}>
      <div className="dt-modal-content" onClick={(e) => e.stopPropagation()}>
        <header className="dt-modal-header">
          <div>
            <h2>📁 Saved Dairy QMS Complaints Ledger</h2>
            <p>Database records persisted from consumer &amp; staff complaint intake</p>
          </div>
          <div className="dt-modal-header-right">
            {batchId && (
              <button
                type="button"
                className={`dt-filter-btn ${filterBatchOnly ? 'active' : ''}`}
                onClick={() => setFilterBatchOnly((v) => !v)}
              >
                {filterBatchOnly ? `Showing Batch ${batchId}` : `Filter to Batch ${batchId}`}
              </button>
            )}
            <button type="button" className="dt-close-btn" onClick={onClose} aria-label="Close modal">
              ✕
            </button>
          </div>
        </header>

        <div className="dt-modal-body">
          {errorMsg && <div className="dt-modal-error">{errorMsg}</div>}
          {loading ? (
            <div className="dt-loading-state">Loading complaints from database...</div>
          ) : records.length === 0 ? (
            <div className="dt-empty-ledger">
              <p>No complaints saved in the database yet.</p>
              <small>
                Use the AI Copilot to log a complaint and click &ldquo;Save complaint&rdquo; to commit to the DairyTrace QMS database.
              </small>
            </div>
          ) : (
            <div className="dt-ledger-grid">
              <div className="dt-records-list">
                {records.map((r) => (
                  <div
                    key={r.id}
                    className={`dt-record-item ${selected?.id === r.id ? 'active' : ''}`}
                    onClick={() => setSelected(r)}
                  >
                    <div className="dt-record-top">
                      <span className="dt-rec-num">{r.complaintNumber}</span>
                      <span
                        className={`dt-severity-badge ${
                          r.severity ? r.severity.toLowerCase().replace(/\s+/g, '-') : 'medium'
                        }`}
                      >
                        {r.severity || 'Normal'}
                      </span>
                    </div>
                    <strong className="dt-rec-product">{r.productName || 'Unspecified Dairy Product'}</strong>
                    <div className="dt-rec-sub">
                      <span>Batch: {r.batchLotNumber || r.batchId || 'N/A'}</span>
                      <span>Reporter: {r.customerName || 'Anonymous'}</span>
                      <span>Status: {r.status}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="dt-record-details">
                {selected ? (
                  <div className="dt-details-card">
                    <div className="dt-details-header">
                      <div>
                        <h3>{selected.complaintNumber}</h3>
                        <span className="dt-details-date">
                          Date: {selected.complaintDate || 'N/A'} · Batch {selected.batchLotNumber || selected.batchId}
                        </span>
                      </div>
                      <div className="dt-details-header-actions">
                        <select
                          aria-label="Update complaint status"
                          className="dt-status-select"
                          value={selected.status}
                          onChange={(e) => void handleStatusChange(selected.id, e.target.value)}
                        >
                          {STATUS_OPTIONS.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="dt-edit-record-btn"
                          onClick={() => handleEditRecord(selected)}
                        >
                          ✏️ Edit Record
                        </button>
                        {isQA && (
                          <button
                            type="button"
                            className="dt-delete-btn"
                            onClick={() => void handleDelete(selected.id)}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>

                    <table className="dt-details-table">
                      <tbody>
                        <tr>
                          <td>Reporter Name:</td>
                          <td>{selected.customerName || '-'}</td>
                        </tr>
                        <tr>
                          <td>Complaint Source:</td>
                          <td>{selected.complaintSource || '-'}</td>
                        </tr>
                        <tr>
                          <td>Product Name:</td>
                          <td>{selected.productName || '-'}</td>
                        </tr>
                        <tr>
                          <td>Pack Size / Fat Grade:</td>
                          <td>{selected.strengthGrade || '-'}</td>
                        </tr>
                        <tr>
                          <td>Batch / Lot No:</td>
                          <td>{selected.batchLotNumber || selected.batchId || '-'}</td>
                        </tr>
                        <tr>
                          <td>Mfg Date:</td>
                          <td>{selected.manufacturingDate || '-'}</td>
                        </tr>
                        <tr>
                          <td>Expiry Date:</td>
                          <td>{selected.expiryDate || '-'}</td>
                        </tr>
                        <tr>
                          <td>Affected Quantity:</td>
                          <td>{selected.affectedQuantity || '-'}</td>
                        </tr>
                        <tr>
                          <td>Originating Facility:</td>
                          <td>{selected.originatingSite || '-'}</td>
                        </tr>
                        <tr>
                          <td>Impacted Material / Pack:</td>
                          <td>{selected.impactedMaterial || '-'}</td>
                        </tr>
                        <tr>
                          <td>Complaint Type:</td>
                          <td>{selected.complaintType || '-'}</td>
                        </tr>
                        <tr>
                          <td>Defect Summary:</td>
                          <td>{selected.defectSummary || '-'}</td>
                        </tr>
                        <tr>
                          <td>Detailed Description:</td>
                          <td>{selected.detailedDescription || '-'}</td>
                        </tr>
                        <tr>
                          <td>Severity / Priority:</td>
                          <td>
                            {selected.severity || '-'} / {selected.priority || '-'}
                          </td>
                        </tr>
                        <tr>
                          <td>Risk Assessment:</td>
                          <td>{selected.riskAssessment || '-'}</td>
                        </tr>
                        <tr>
                          <td>Root Cause Hypothesis:</td>
                          <td>{selected.rootCause || '-'}</td>
                        </tr>
                        <tr>
                          <td>CAPA Recommendations:</td>
                          <td>
                            {selected.capaRecommendations && selected.capaRecommendations.length > 0 ? (
                              <ul className="dt-capa-inline-list">
                                {selected.capaRecommendations.map((c, idx) => (
                                  <li key={idx}>{c}</li>
                                ))}
                              </ul>
                            ) : (
                              '-'
                            )}
                          </td>
                        </tr>
                        <tr>
                          <td>Record Status:</td>
                          <td>
                            <span className="dt-status-tag">{selected.status}</span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="dt-select-prompt">
                    Select a complaint from the list to view complete details.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
