import React, { useState, useEffect } from 'react';
import {
  FileText,
  Printer,
  Download,
  X,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { api } from '../api';

export default function FSSAINoticeModal({ isOpen, onClose, recallId = 1 }) {
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadNotice = async () => {
    setLoading(true);
    try {
      const data = await api.getFssaiNotice(recallId);
      setNotice(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(notice, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    if (isOpen) {
      loadNotice();
    }
  }, [isOpen, recallId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white">
      <div className="relative w-full max-w-3xl bg-white border border-stone-200 rounded-2xl shadow-2xl overflow-hidden my-8 print:border-none print:shadow-none">
        {/* Top Action Bar */}
        <div className="bg-[#FAF7F2] border-b border-stone-200 p-4 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-800">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-stone-900 text-sm sm:text-base">
                Official FSSAI Food Recall Notice
              </h3>
              <p className="text-xs text-stone-500">
                Print-ready statutory notice for retail stores and food safety authorities
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyJson}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-stone-100 text-stone-700 border border-stone-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              {copied ? 'Copied Data' : 'Copy Data'}
            </button>

            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Print / Save PDF
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-stone-500 hover:text-stone-900 hover:bg-stone-200/60 transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Official Document */}
        <div className="p-6 sm:p-8 space-y-6 max-h-[80vh] overflow-y-auto print:max-h-none print:overflow-visible print:p-6 text-stone-900">
          {/* Official Letterhead */}
          <div className="border-b-2 border-stone-800 pb-4 text-center">
            <span className="text-[11px] uppercase font-bold tracking-widest text-amber-800">
              Government of India · Food Safety Compliance
            </span>
            <h1 className="font-display text-xl sm:text-2xl font-bold uppercase tracking-wide text-stone-900 mt-1">
              Food Safety and Standards Authority of India (FSSAI)
            </h1>
            <p className="text-xs text-stone-600 mt-0.5">
              Official Food Recall &amp; Store Withdrawal Notice (Schedule I — Form I)
            </p>
          </div>

          {notice ? (
            <div className="space-y-5 text-sm">
              {/* Reference Summary Box */}
              <div className="grid grid-cols-2 gap-4 text-xs bg-[#FAF7F2] p-4 rounded-xl border border-stone-200">
                <div>
                  <span className="text-stone-500 uppercase font-bold block">Notice Reference:</span>
                  <p className="font-bold text-stone-900 text-sm mt-0.5">{notice.notice_reference}</p>
                </div>
                <div>
                  <span className="text-stone-500 uppercase font-bold block">Date Issued:</span>
                  <p className="font-semibold text-stone-800 text-sm mt-0.5">
                    {new Date(notice.issued_at).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <span className="text-stone-500 uppercase font-bold block">Recall Classification:</span>
                  <p className="font-bold text-red-700 mt-0.5">{notice.classification}</p>
                </div>
                <div>
                  <span className="text-stone-500 uppercase font-bold block">Originating Batch:</span>
                  <p className="font-bold text-emerald-800 text-sm mt-0.5">
                    {notice.originating_batch}
                  </p>
                </div>
              </div>

              {/* Section 1: Reason for Recall */}
              <div>
                <h4 className="font-bold uppercase text-xs tracking-wider text-stone-700 mb-1.5">
                  1. Reason for Food Safety Recall
                </h4>
                <p className="text-stone-800 leading-relaxed bg-red-50/50 p-3.5 rounded-xl border border-red-200 text-xs sm:text-sm font-medium">
                  {notice.hazard_description}
                </p>
              </div>

              {/* Section 2: Products to Withdraw */}
              <div>
                <h4 className="font-bold uppercase text-xs tracking-wider text-red-700 mb-1.5">
                  2. Finished Dairy Batches to Withdraw from Sale
                </h4>
                <div className="flex flex-wrap gap-2">
                  {notice.affected_finished_batches?.map((b) => (
                    <span
                      key={b}
                      className="px-3 py-1 rounded-lg bg-red-50 border border-red-200 font-bold text-red-800 text-xs"
                    >
                      {b} (Fresh Paneer)
                    </span>
                  ))}
                  {(!notice.affected_finished_batches ||
                    notice.affected_finished_batches.length === 0) && (
                    <span className="text-xs text-stone-500 italic">
                      Direct batch recall ({notice.originating_batch})
                    </span>
                  )}
                </div>
              </div>

              {/* Section 3: Co-Inputs Placed on Hold */}
              <div>
                <h4 className="font-bold uppercase text-xs tracking-wider text-amber-800 mb-1.5">
                  3. Blended Milk Batches Placed on Hold for Testing
                </h4>
                <div className="flex flex-wrap gap-2">
                  {notice.co_inputs_quarantined?.map((b) => (
                    <span
                      key={b}
                      className="px-3 py-1 rounded-lg bg-amber-50 border border-amber-200 font-bold text-amber-900 text-xs"
                    >
                      {b} (Blended in Same Vat — Hold for Lab Check)
                    </span>
                  ))}
                  {(!notice.co_inputs_quarantined ||
                    notice.co_inputs_quarantined.length === 0) && (
                    <span className="text-xs text-stone-500 italic">None</span>
                  )}
                </div>
              </div>

              {/* Section 4: Retail Stores Table */}
              <div>
                <h4 className="font-bold uppercase text-xs tracking-wider text-stone-700 mb-1.5">
                  4. Retail Stores Holding Affected Packs
                </h4>
                <div className="text-xs border border-stone-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-[#FAF7F2] text-stone-700 border-b border-stone-200">
                      <tr>
                        <th className="p-2.5 font-bold">Retail Store</th>
                        <th className="p-2.5 font-bold">Location</th>
                        <th className="p-2.5 font-bold">Batch Code</th>
                        <th className="p-2.5 font-bold">Quantity</th>
                        <th className="p-2.5 font-bold">Store Contact</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200">
                      {notice.distribution_lockdown_targets?.map((d, idx) => (
                        <tr key={d.id || idx} className="text-stone-800">
                          <td className="p-2.5 font-bold">{d.destination_name}</td>
                          <td className="p-2.5 text-stone-600">{d.location}</td>
                          <td className="p-2.5 font-bold text-red-700">{d.batch_id}</td>
                          <td className="p-2.5 font-bold">{d.quantity_dispatched} kg</td>
                          <td className="p-2.5 font-semibold text-stone-700">{d.contact_phone}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Section 5: Instructions for Stores & Customers */}
              <div className="text-xs space-y-2.5 pt-1">
                <div className="p-3.5 rounded-xl bg-[#FAF7F2] border border-stone-200">
                  <strong className="text-red-700 block uppercase mb-1">
                    Instructions for Retail Stores:
                  </strong>
                  <p className="text-stone-700 leading-relaxed">
                    {notice.action_required_retailers}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#FAF7F2] border border-stone-200">
                  <strong className="text-amber-800 block uppercase mb-1">
                    Customer Guidance:
                  </strong>
                  <p className="text-stone-700 leading-relaxed">{notice.public_action}</p>
                </div>
              </div>

              {/* Sign-off Footer */}
              <div className="pt-5 border-t border-stone-200 flex items-center justify-between text-xs">
                <div>
                  <span className="text-stone-500 uppercase font-bold block">Authorized By:</span>
                  <p className="font-bold text-stone-900 mt-0.5">{notice.fssai_officer_signoff}</p>
                  <p className="text-stone-500 text-[11px]">DairyTrace Quality Assurance Team</p>
                </div>
                <div className="text-right">
                  <span className="text-emerald-700 font-bold flex items-center gap-1 justify-end">
                    <ShieldCheck className="w-4 h-4" /> Official Food Safety Notice
                  </span>
                  <p className="text-[11px] text-stone-500">FSSAI FoSCoS Compliant</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-stone-500">Loading recall report...</div>
          )}
        </div>
      </div>
    </div>
  );
}
