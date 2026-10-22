import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Milk,
  Calendar,
  Award,
  Share2,
  RefreshCw,
  MapPin,
  CheckCircle2,
  ArrowLeft,
  HeartHandshake,
  MessageSquareText,
} from 'lucide-react';
import { api } from '../api';
import ThreeTierSafetyForm from '../components/ThreeTierSafetyForm';

export default function ConsumerPassportPage({
  initialBatchId = 'PAN-201',
  onBackToDashboard,
  onOpenComplaintModal,
}) {
  const [selectedBatchId, setSelectedBatchId] = useState(initialBatchId);
  const [passportData, setPassportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [complaintOpen, setComplaintOpen] = useState(false);
  const [complaintNotice, setComplaintNotice] = useState('');

  useEffect(() => {
    if (initialBatchId) {
      setSelectedBatchId(initialBatchId);
    }
  }, [initialBatchId]);

  useEffect(() => {
    loadPassport(selectedBatchId);
  }, [selectedBatchId]);

  const loadPassport = async (batchId) => {
    setLoading(true);
    setPassportData(null);
    setLoadError('');
    try {
      const data = await api.getPublicPassport(batchId);
      setPassportData(data);
    } catch (err) {
      setLoadError(err.status === 404 ? 'This product code was not found. Check the QR code or scan it again.' : 'We could not load this product’s details. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleShare = () => {
    const url =
      typeof window !== 'undefined'
        ? `${window.location.origin}/passport/${selectedBatchId}`
        : `https://dairytrace.in/passport/${selectedBatchId}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const isRecalled = passportData?.status === 'RECALLED';
  const isQuarantined = passportData?.status === 'QUARANTINED';
  const safetyStatus = passportData?.adulterant_status || 'NOT_TESTED';
  const hasRecordedPurity = passportData?.purity_score !== null && passportData?.purity_score !== undefined;

  const activeBatchId = passportData?.id || passportData?.batch_id || selectedBatchId;
  const passportUrl =
    passportData?.passport_url ||
    (typeof window !== 'undefined'
      ? `${window.location.origin}/passport/${activeBatchId}`
      : `https://dairytrace.in/passport/${activeBatchId}`);

  const getFriendlyTrustLabel = (badge) => {
    if (badge === 'SUPPLIER_ENTERED') return 'Supplier Reported';
    if (badge === 'DOCUMENT_CHECKED') return 'Lab Report Checked';
    return 'Lab Chemist Verified';
  };

  return (
    <div className="min-h-screen py-6 sm:py-10 px-4 sm:px-6 max-w-3xl mx-auto space-y-6">
      {/* One-batch public passport header. */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white border border-stone-200/90 shadow-sm">
        <div><span className="text-xs font-bold uppercase tracking-wide text-stone-500">Product passport</span><p className="mt-1 text-sm font-bold text-stone-900">Batch {activeBatchId}</p></div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleShare}
            className="px-3.5 py-2 rounded-xl bg-[#FAF7F2] hover:bg-stone-200/70 text-stone-700 border border-stone-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Share2 className="w-3.5 h-3.5 text-stone-500" />
            {copiedLink ? 'Link Copied!' : 'Share Link'}
          </button>
          {onBackToDashboard && (
            <button
              onClick={onBackToDashboard}
              className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Scan another product
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="p-12 rounded-3xl bg-white border border-stone-200 text-center text-stone-500 flex flex-col items-center justify-center gap-3 shadow-sm">
          <RefreshCw className="w-7 h-7 text-emerald-700 animate-spin" />
          <p className="text-sm font-medium">Loading product quality &amp; farm origin details...</p>
        </div>
      ) : loadError ? (
        <div role="alert" className="rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-sm"><ShieldAlert className="mx-auto h-9 w-9 text-rose-700" /><h2 className="mt-3 text-lg font-bold text-stone-900">Product details unavailable</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-stone-600">{loadError}</p>{onBackToDashboard && <button type="button" onClick={onBackToDashboard} className="mt-5 rounded-xl bg-emerald-900 px-4 py-2.5 text-sm font-bold text-white">Scan another product</button>}</div>
      ) : passportData ? (
        /* Customer-Friendly Dairy Product Passport Card */
        <div className="mx-auto max-w-2xl rounded-3xl bg-white border border-stone-200/90 shadow-md overflow-hidden">
          {/* Safety Status Banner */}
          {isRecalled ? (
            <div className="p-6 bg-red-600 text-white flex items-start sm:items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <ShieldAlert className="w-7 h-7 text-white stroke-[2.2]" />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] uppercase tracking-wider font-bold bg-white/20 px-2.5 py-0.5 rounded-full inline-block">
                  Important Food Safety Recall
                </span>
                <h2 className="text-lg sm:text-xl font-extrabold tracking-tight">
                  Do Not Consume This Batch
                </h2>
                <p className="text-xs sm:text-sm text-red-50 leading-relaxed">
                  {passportData.contaminant_warning ||
                    'This batch has been recalled due to a quality safety alert. Please return this pack to your store for a full refund.'}
                </p>
              </div>
            </div>
          ) : isQuarantined ? (
            <div className="p-6 bg-amber-600 text-white flex items-start sm:items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-7 h-7 text-white stroke-[2.2]" />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] uppercase tracking-wider font-bold bg-white/20 px-2.5 py-0.5 rounded-full inline-block">
                  Precautionary Quality Hold
                </span>
                <h2 className="text-lg sm:text-xl font-extrabold tracking-tight">
                  Batch Temporarily Under Quality Check
                </h2>
                <p className="text-xs sm:text-sm text-amber-50 leading-relaxed">
                  Our dairy quality team is conducting additional laboratory checks on this batch before clearing it for sale.
                </p>
              </div>
            </div>
          ) : passportData.adulterant_status === 'POSITIVE' || passportData.adulterant_status === 'SUSPECTED' || passportData.adulterant_status === 'NOT_TESTED' ? (
            <div className={`p-6 text-white flex items-start sm:items-center gap-4 ${passportData.adulterant_status === 'POSITIVE' ? 'bg-rose-700' : passportData.adulterant_status === 'SUSPECTED' ? 'bg-amber-600' : 'bg-stone-700'}`}>
              <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-7 h-7 text-white stroke-[2.2]" />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] uppercase tracking-wider font-bold bg-white/20 px-2.5 py-0.5 rounded-full inline-block">
                  {passportData.adulterant_status === 'NOT_TESTED' ? 'Quality Test Not Recorded' : passportData.adulterant_status === 'SUSPECTED' ? 'Safety Concern Under Review' : 'Contamination Alert'}
                </span>
                <h2 className="text-lg sm:text-xl font-extrabold tracking-tight">
                  {passportData.adulterant_status === 'NOT_TESTED' ? 'This Batch Has No Recorded Safety Screen' : passportData.adulterant_status === 'SUSPECTED' ? 'A Safety Concern Has Been Reported' : 'A Contamination Screen Was Positive'}
                </h2>
                <p className="text-xs sm:text-sm leading-relaxed text-white/90">{passportData.contaminant_warning}</p>
              </div>
            </div>
          ) : (
            <div className="p-6 bg-emerald-700 text-white flex items-start sm:items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-7 h-7 text-white stroke-[2.2]" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] uppercase tracking-wider font-bold bg-white/20 px-2.5 py-0.5 rounded-full">
                    Quality Screen Passed
                  </span>
                  <span className="text-xs text-emerald-100 font-medium">
                    • Test result recorded
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold tracking-tight">
                  Quality Checked &amp; Traceable
                </h2>
                <p className="text-xs sm:text-sm text-emerald-50 leading-relaxed">
                  This batch has a recorded negative adulterant screen and is tracked from its listed origin.
                </p>
              </div>
            </div>
          )}

          {/* Main Passport Content */}
          <div className="p-6 sm:p-8 space-y-7">
            {/* Product Overview & Scannable QR */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6 pb-6 border-b border-stone-200/80">
              <div className="space-y-2 text-center sm:text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-[#FAF7F2] border border-stone-200 text-xs font-bold text-emerald-800">
                  <Milk className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Batch Number: {activeBatchId}</span>
                </div>

                <h1 className="font-display text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight">
                  {passportData.product_name}
                </h1>

                <p className="text-xs sm:text-sm text-stone-600 flex items-center justify-center sm:justify-start gap-1.5 font-medium">
                  <MapPin className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                  {passportData.facility_name}
                </p>

                <div className="flex items-center justify-center sm:justify-start gap-5 pt-2 text-xs">
                  <div className="bg-[#FAF7F2] px-3 py-2 rounded-xl border border-stone-200/80">
                    <span className="text-[10px] text-stone-500 uppercase font-bold block">
                      Packed On
                    </span>
                    <span className="text-stone-900 font-bold text-xs sm:text-sm flex items-center gap-1 mt-0.5">
                      <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                      {new Date(passportData.production_date).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="bg-[#FAF7F2] px-3 py-2 rounded-xl border border-stone-200/80">
                    <span className="text-[10px] text-stone-500 uppercase font-bold block">
                      Best Before
                    </span>
                    <span className="text-stone-900 font-bold text-xs sm:text-sm flex items-center gap-1 mt-0.5">
                      <Calendar className="w-3.5 h-3.5 text-amber-600" />
                      {new Date(passportData.expiry_date).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* QR Code Box */}
              <div className="p-3.5 bg-[#FAF7F2] border border-stone-200 rounded-2xl flex flex-col items-center gap-2 flex-shrink-0 shadow-sm">
                <div className="p-2 bg-white rounded-xl border border-stone-200/60">
                  <QRCodeSVG value={passportUrl} size={104} level="H" includeMargin={false} />
                </div>
                <span className="text-[10px] font-bold text-stone-600 uppercase tracking-wider">
                  Pack QR Code
                </span>
              </div>
            </div>

            {/* Quality & Purity Highlights */}
            <div className="space-y-3.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                  <Award className="w-4 h-4 text-emerald-700" />
                  Quality &amp; Purity Test Results
                </h3>
                <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                  {getFriendlyTrustLabel(passportData.trust_badge)}
                </span>
              </div>

              {/* Overall Purity Rating Bar */}
              <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-stone-200/90">
                <div className="flex items-center justify-between text-xs sm:text-sm mb-2">
                  <span className="text-stone-700 font-semibold">Overall Dairy Purity Score</span>
                  <span
                    className={`font-extrabold text-sm ${
                      isRecalled || safetyStatus === 'POSITIVE'
                        ? 'text-red-700'
                        : isQuarantined || safetyStatus === 'SUSPECTED'
                        ? 'text-amber-700'
                        : hasRecordedPurity
                        ? 'text-emerald-700'
                        : 'text-stone-600'
                    }`}
                  >
                    {hasRecordedPurity ? `${passportData.purity_score}%` : 'Not scored'}
                  </span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-stone-200 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      isRecalled
                        ? 'bg-red-600'
                        : isQuarantined
                        ? 'bg-amber-500'
                        : 'bg-emerald-600'
                      }`}
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(
                          5,
                          passportData.purity_score ?? (isRecalled ? 42 : isQuarantined ? 78 : 0)
                        )
                      )}%`,
                    }}
                  />
                </div>
              </div>

              {/* 3 Customer-Friendly Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-stone-200/80 text-center">
                  <span className="text-xs text-stone-500 font-semibold block">
                    Milk Fat (Richness)
                  </span>
                  <span className="text-xl font-extrabold text-stone-900 mt-1 block">
                    {passportData.fat_percentage == null ? 'Not recorded' : `${passportData.fat_percentage}%`}
                  </span>
                  <span className="text-[11px] text-emerald-700 font-medium block mt-0.5">
                    Natural Creaminess
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-stone-200/80 text-center">
                  <span className="text-xs text-stone-500 font-semibold block">
                    Milk Solids (SNF)
                  </span>
                  <span className="text-xl font-extrabold text-stone-900 mt-1 block">
                    {passportData.snf_percentage == null ? 'Not recorded' : `${passportData.snf_percentage}%`}
                  </span>
                  <span className="text-[11px] text-emerald-700 font-medium block mt-0.5">
                    Rich in Protein &amp; Calcium
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-stone-200/80 text-center">
                  <span className="text-xs text-stone-500 font-semibold block">
                    Adulteration Check
                  </span>
                  <span
                    className={`text-sm font-extrabold block mt-1.5 ${
                      isRecalled
                        ? 'text-red-700'
                        : isQuarantined
                        ? 'text-amber-700'
                        : 'text-emerald-700'
                    }`}
                  >
                    {isRecalled
                      ? 'Failed Safety Limit'
                      : isQuarantined
                      ? 'Under Quality Hold'
                      : safetyStatus === 'POSITIVE' ? 'Positive result' : safetyStatus === 'SUSPECTED' ? 'Under review' : safetyStatus === 'NEGATIVE' ? 'Negative screen' : 'Not tested'}
                  </span>
                  <span className="text-[11px] text-stone-500 block mt-0.5">
                    {safetyStatus === 'NEGATIVE' ? 'No adulterants detected in the recorded screen' : 'Safety result from the recorded batch data'}
                  </span>
                </div>
              </div>
            </div>

            {/* Where Did Your Milk Come From? */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                  <HeartHandshake className="w-4 h-4 text-emerald-700" />
                  Where Did This Milk Come From?
                </h3>
                <span className="text-xs text-stone-500 font-medium">
                  Direct Farmer Cooperatives
                </span>
              </div>

              <div className="space-y-2.5">
                {passportData.origins?.map((org, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-[#FAF7F2] border border-stone-200/90 space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-bold text-xs">
                          {idx + 1}
                        </div>
                        <div>
                          <span className="font-bold text-stone-900 block">{org.source}</span>
                          <span className="text-xs text-stone-500">
                            Fresh Chilled Milk • {org.contribution_liters}{' '}
                            {String(org.contribution_liters).includes('L') ? '' : 'Liters'}
                          </span>
                        </div>
                      </div>

                      <span className="font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 text-xs">
                        {org.percentage}% of Milk
                      </span>
                    </div>

                    <div className="w-full h-1.5 rounded-full bg-stone-200 overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 rounded-full"
                        style={{ width: `${Math.min(100, Math.max(5, org.percentage || 100))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Official Food Safety & Testing Sign-Off */}
            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/90 space-y-2.5 text-xs sm:text-sm">
              <div className="flex items-center justify-between">
                <span className="text-stone-500 font-medium">Pasteurization &amp; Hygiene:</span>
                <span className="font-semibold text-stone-800 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Pasteurized &amp; Chilled at 4°C
                </span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-stone-200/70">
                <span className="text-stone-500 font-medium">Tested &amp; Approved By:</span>
                <span className="font-semibold text-stone-800 text-right">
                  {passportData.lab_signoff}
                </span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-stone-200/70">
                <span className="text-stone-500 font-medium">FSSAI License Number:</span>
                <span className="font-bold text-stone-900">
                  {passportData.fssai_licence_number}
                </span>
              </div>
            </div>
          </div>

          {/* Warm Footer */}
          <div className="px-6 py-4 bg-[#FAF7F2] border-t border-stone-200/80 flex items-center justify-between text-xs text-stone-500">
            <span className="font-semibold text-stone-700">DairyTrace Quality Promise</span>
            <span className="flex items-center gap-1 text-emerald-700 font-semibold">
              <ShieldCheck className="w-4 h-4" /> Verified Farm-to-Table Record
            </span>
          </div>
        </div>
      ) : null}
      {passportData && (
        <section className="space-y-4">
          {!complaintOpen ? (
            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-5 sm:p-6">
              <div>
                <h2 className="text-base font-bold text-stone-900">
                  Notice something wrong with this product?
                </h2>
                <p className="mt-1 text-sm leading-6 text-stone-600">
                  Submit a safety concern or quality defect tied directly to batch <strong>{activeBatchId}</strong>.
                  Speak in natural language, upload a lab report, or fill the form manually.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setComplaintNotice('');
                  setComplaintOpen(true);
                }}
                className="mt-4 inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-900 px-5 text-sm font-bold text-white hover:bg-emerald-950 transition shadow-sm sm:mt-0"
              >
                <MessageSquareText className="h-4 w-4 text-emerald-300" />
                Report a Safety Concern
              </button>
            </div>
          ) : (
            <ThreeTierSafetyForm
              batch={passportData}
              onClose={() => setComplaintOpen(false)}
              onSubmitted={(result) => {
                setComplaintNotice(`Safety concern registered with compliance team · Ref: ${result.complaint_ref}`);
                loadPassport(selectedBatchId);
              }}
            />
          )}

          {complaintNotice && (
            <div role="status" className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-sm font-bold text-emerald-900">
              {complaintNotice}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
