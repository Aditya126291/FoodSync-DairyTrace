import React, { useState, useEffect } from 'react';
import {
  FileText,
  Printer,
  Download,
  ShieldCheck,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { api } from '../api';
import { Alert, Modal, Spinner } from './ui';
import { formatDate } from '../utils/format';

export default function FSSAINoticeModal({ isOpen, onClose, recallId = 1 }) {
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const loadNotice = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getFssaiNotice(recallId);
      setNotice(data);
    } catch (err) {
      setError(err.message || 'Could not load official FSSAI notice.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopyJson = () => {
    if (!notice) return;
    navigator.clipboard.writeText(JSON.stringify(notice, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    if (isOpen) {
      loadNotice();
    }
  }, [isOpen, recallId]);

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Statutory FSSAI Food Recall Notice"
      description="Official Form I / Schedule I notice for public display, retailer withdrawal, and regulatory dispatch."
      icon={FileText}
      tone="warn"
      size="xl"
    >
      <div className="space-y-5">
        {/* Top Action Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-200 pb-3 no-print">
          <div className="flex items-center gap-2">
            <span className="badge badge-warn">Schedule I · Form I</span>
            <span className="text-xs text-ink-500">Government of India Standard</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyJson}
              className="btn btn-secondary btn-sm"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Download className="h-3.5 w-3.5" />}
              {copied ? 'Copied JSON' : 'Export JSON'}
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="btn btn-primary btn-sm"
            >
              <Printer className="h-3.5 w-3.5" />
              Print / Save PDF
            </button>
          </div>
        </div>

        {error && (
          <Alert tone="danger">{error}</Alert>
        )}

        {loading ? (
          <Spinner label="Generating statutory FSSAI notice document…" />
        ) : notice ? (
          <div className="card p-6 sm:p-8 space-y-6 text-ink-900 border-ink-300">
            {/* Header Letterhead */}
            <div className="border-b-2 border-ink-900 pb-4 text-center">
              <span className="text-[11px] font-bold uppercase tracking-widest text-brand-800">
                Government of India · Food Safety Compliance
              </span>
              <h2 className="font-display text-xl sm:text-2xl font-bold uppercase tracking-wide mt-1">
                Food Safety and Standards Authority of India (FSSAI)
              </h2>
              <p className="text-xs text-ink-500 mt-0.5">
                Statutory Food Safety Recall &amp; Market Withdrawal Order (Schedule I — Form I)
              </p>
            </div>

            {/* Reference Table */}
            <div className="grid grid-cols-2 gap-4 rounded-card border border-ink-200 bg-canvas p-4 text-xs">
              <div>
                <span className="block font-bold uppercase text-[10px] text-ink-500">Notice Reference</span>
                <p className="font-mono font-bold text-ink-900 text-sm mt-0.5">{notice.notice_reference}</p>
              </div>
              <div>
                <span className="block font-bold uppercase text-[10px] text-ink-500">Date Issued</span>
                <p className="font-bold text-ink-900 text-sm mt-0.5">{formatDate(notice.issued_at)}</p>
              </div>
              <div>
                <span className="block font-bold uppercase text-[10px] text-ink-500">Recall Classification</span>
                <p className="font-bold text-red-700 mt-0.5">{notice.classification}</p>
              </div>
              <div>
                <span className="block font-bold uppercase text-[10px] text-ink-500">Originating Batch</span>
                <p className="font-mono font-bold text-brand-800 text-sm mt-0.5">{notice.originating_batch}</p>
              </div>
            </div>

            {/* Section 1: Reason for Recall */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-ink-700 mb-1.5">
                1. Statutory Reason for Food Safety Recall
              </h4>
              <p className="rounded-control bg-canvas border border-ink-200 p-3 text-xs leading-relaxed text-ink-800">
                {notice.reason}
              </p>
            </div>

            {/* Section 2: Instructions to Food Business Operators (FBOs) */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-ink-700 mb-1.5">
                2. Mandatory Instructions to Retail Outlets &amp; Distributors
              </h4>
              <ul className="list-disc pl-5 text-xs space-y-1.5 text-ink-700 leading-relaxed">
                <li>Immediately quarantine and halt sales of all packages labeled with the affected batch IDs.</li>
                <li>Display this notice prominently at retail customer service points and return counters.</li>
                <li>Segregate affected inventory into a designated locked quarantine holding area.</li>
                <li>Contact DairyTrace central recall coordinator for reverse logistics collection and refund processing.</li>
              </ul>
            </div>

            {/* Section 3: Consumer Advisory */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-ink-700 mb-1.5">
                3. Consumer Health Advisory
              </h4>
              <div className="rounded-control border border-red-200 bg-red-50/50 p-3 text-xs leading-relaxed text-red-950">
                Consumers who have purchased this product should <strong>not consume it</strong>. Return the pack to the point of purchase for an immediate refund. If symptoms or discomfort occur, seek prompt medical consultation.
              </div>
            </div>

            {/* Signatures & Accreditation */}
            <div className="grid grid-cols-2 gap-8 border-t border-ink-200 pt-6 text-xs">
              <div>
                <span className="block text-ink-500">Authorized QA Officer Signature:</span>
                <p className="mt-4 font-bold text-ink-900 border-t border-dashed border-ink-400 pt-1">
                  Vikram Patil · QA Officer (Lead Chemist)
                </p>
                <span className="text-[10px] text-ink-400">Digital Token Verified · ISO 22000 / HACCP</span>
              </div>
              <div className="text-right">
                <span className="block text-ink-500">Official Enforcement Registry:</span>
                <p className="mt-4 font-bold text-ink-900 border-t border-dashed border-ink-400 pt-1">
                  DairyTrace Central Verification Node
                </p>
                <span className="text-[10px] text-ink-400">FSSAI Licence #10012022000123</span>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
