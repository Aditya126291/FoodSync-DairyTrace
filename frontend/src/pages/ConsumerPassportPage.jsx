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
  Printer,
  FlaskConical,
  Factory,
  PackageCheck,
} from 'lucide-react';
import { api } from '../api';

export default function ConsumerPassportPage({
  initialBatchId = 'PAN-201',
  onBackToScanner,
  onReportConcern,
}) {
  const [selectedBatchId, setSelectedBatchId] = useState(initialBatchId);
  const [passportData, setPassportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [loadError, setLoadError] = useState('');

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
      setLoadError(
        err.status === 404
          ? `Batch "${batchId}" was not found. Check the QR code or scan again.`
          : 'We could not load this product’s details. Check your connection and try again.'
      );
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
  const hasRecordedPurity =
    passportData?.purity_score !== null && passportData?.purity_score !== undefined;

  const activeBatchId = passportData?.id || passportData?.batch_id || selectedBatchId;
  const passportUrl =
    passportData?.passport_url ||
    (typeof window !== 'undefined'
      ? `${window.location.origin}/passport/${activeBatchId}`
      : `https://dairytrace.in/passport/${activeBatchId}`);

  const getTrustBadgeInfo = (badge) => {
    if (badge === 'VERIFIED') {
      return {
        label: 'Verified (NABL Lab Chemist Sign-Off)',
        tone: 'bg-emerald-50 text-emerald-900 border-emerald-300',
      };
    }
    if (badge === 'DOCUMENT_CHECKED') {
      return {
        label: 'Document-checked (Certificate Attached)',
        tone: 'bg-sky-50 text-sky-900 border-sky-300',
      };
    }
    if (badge === 'SUPPLIER_ENTERED') {
      return {
        label: 'Supplier-entered (Collection Desk)',
        tone: 'bg-amber-50 text-amber-900 border-amber-300',
      };
    }
    return {
      label: 'Unverified Record',
      tone: 'bg-stone-100 text-stone-700 border-stone-300',
    };
  };

  const trustInfo = getTrustBadgeInfo(passportData?.trust_badge);

  return (
    <div className="min-h-screen py-6 sm:py-10 px-4 sm:px-6 max-w-3xl mx-auto space-y-6">
      {/* One-batch public passport top bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white border border-stone-200/90 shadow-sm print:hidden">
        <div>
          <span className="text-xs font-bold uppercase tracking-wide text-emerald-800">
            Public Batch Passport
          </span>
          <p className="mt-0.5 text-sm font-bold text-stone-900">
            Scanned Batch: {activeBatchId}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleShare}
            className="px-3.5 py-2 rounded-xl bg-[#FAF7F2] hover:bg-stone-200/70 text-stone-700 border border-stone-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Share2 className="w-3.5 h-3.5 text-stone-500" />
            {copiedLink ? 'Link Copied!' : 'Share Link'}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3.5 py-2 rounded-xl bg-[#FAF7F2] hover:bg-stone-200/70 text-stone-700 border border-stone-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Printer className="w-3.5 h-3.5 text-stone-500" />
            Print
          </button>
          {onBackToScanner && (
            <button
              type="button"
              onClick={onBackToScanner}
              className="px-3.5 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
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
          <p className="text-sm font-medium">
            Loading product quality, lineage &amp; farm origin details…
          </p>
        </div>
      ) : loadError ? (
        <div
          role="alert"
          className="rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-sm"
        >
          <ShieldAlert className="mx-auto h-9 w-9 text-rose-700" />
          <h2 className="mt-3 text-lg font-bold text-stone-900">
            Product passport unavailable
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-stone-600">{loadError}</p>
          {onBackToScanner && (
            <button
              type="button"
              onClick={onBackToScanner}
              className="mt-5 rounded-xl bg-emerald-900 px-4 py-2.5 text-sm font-bold text-white"
            >
              Scan another product
            </button>
          )}
        </div>
      ) : passportData ? (
        <>
          {/* Customer-Friendly Dairy Product Passport Card */}
          <div className="mx-auto max-w-3xl rounded-3xl bg-white border border-stone-200/90 shadow-md overflow-hidden">
            {/* Safety Status Verdict Banner */}
            {isRecalled ? (
              <div className="p-6 bg-red-600 text-white flex items-start sm:items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  <ShieldAlert className="w-7 h-7 text-white stroke-[2.2]" />
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] uppercase tracking-wider font-bold bg-white/20 px-2.5 py-0.5 rounded-full inline-block">
                    Active Food Safety Recall
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
                    Precautionary Hold — Under QA Review
                  </span>
                  <h2 className="text-lg sm:text-xl font-extrabold tracking-tight">
                    Batch Temporarily Under Quality Check
                  </h2>
                  <p className="text-xs sm:text-sm text-amber-50 leading-relaxed">
                    Our dairy quality team is conducting additional laboratory checks on this batch before clearing it for sale.
                  </p>
                </div>
              </div>
            ) : passportData.adulterant_status === 'POSITIVE' ||
              passportData.adulterant_status === 'SUSPECTED' ||
              passportData.adulterant_status === 'NOT_TESTED' ? (
              <div
                className={`p-6 text-white flex items-start sm:items-center gap-4 ${
                  passportData.adulterant_status === 'POSITIVE'
                    ? 'bg-rose-700'
                    : passportData.adulterant_status === 'SUSPECTED'
                    ? 'bg-amber-600'
                    : 'bg-stone-700'
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-7 h-7 text-white stroke-[2.2]" />
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] uppercase tracking-wider font-bold bg-white/20 px-2.5 py-0.5 rounded-full inline-block">
                    {passportData.adulterant_status === 'NOT_TESTED'
                      ? 'Quality Test Not Recorded'
                      : passportData.adulterant_status === 'SUSPECTED'
                      ? 'Precautionary Alert — Under Review'
                      : 'Contamination Alert'}
                  </span>
                  <h2 className="text-lg sm:text-xl font-extrabold tracking-tight">
                    {passportData.adulterant_status === 'NOT_TESTED'
                      ? 'This Batch Has No Recorded Safety Screen'
                      : passportData.adulterant_status === 'SUSPECTED'
                      ? 'A Safety Concern Has Been Reported'
                      : 'A Contamination Screen Was Positive'}
                  </h2>
                  <p className="text-xs sm:text-sm leading-relaxed text-white/90">
                    {passportData.contaminant_warning}
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-6 bg-emerald-800 text-white flex items-start sm:items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="w-7 h-7 text-white stroke-[2.2]" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] uppercase tracking-wider font-bold bg-white/20 px-2.5 py-0.5 rounded-full">
                      Safe · Quality Screen Passed
                    </span>
                    <span className="text-xs text-emerald-100 font-medium">
                      • FSSAI Compliant Record
                    </span>
                  </div>
                  <h2 className="text-lg sm:text-xl font-extrabold tracking-tight">
                    Quality Checked &amp; Traceable from Origin
                  </h2>
                  <p className="text-xs sm:text-sm text-emerald-50 leading-relaxed">
                    This batch has a recorded negative adulterant screen and verified farm-to-plant genealogy.
                  </p>
                </div>
              </div>
            )}

            {/* Main Passport Content */}
            <div className="p-6 sm:p-8 space-y-7">
              {/* Product Overview & Scannable QR */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6 pb-6 border-b border-stone-200/80">
                <div className="space-y-2.5 text-center sm:text-left">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-[#FAF7F2] border border-stone-200 text-xs font-bold text-emerald-900">
                    <Milk className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Batch ID: {activeBatchId}</span>
                  </div>

                  <h1 className="font-display text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight">
                    {passportData.product_name}
                  </h1>

                  <p className="text-xs sm:text-sm text-stone-600 flex items-center justify-center sm:justify-start gap-1.5 font-medium">
                    <MapPin className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                    {passportData.facility_name}
                  </p>

                  <div className="flex items-center justify-center sm:justify-start gap-4 pt-2 text-xs flex-wrap">
                    <div className="bg-[#FAF7F2] px-3.5 py-2 rounded-xl border border-stone-200/80">
                      <span className="text-[10px] text-stone-500 uppercase font-bold block">
                        Packed / Collected On
                      </span>
                      <span className="text-stone-900 font-bold text-xs sm:text-sm flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                        {passportData.production_date
                          ? new Date(passportData.production_date).toLocaleDateString()
                          : 'Recorded'}
                      </span>
                    </div>

                    <div className="bg-[#FAF7F2] px-3.5 py-2 rounded-xl border border-stone-200/80">
                      <span className="text-[10px] text-stone-500 uppercase font-bold block">
                        Best Before
                      </span>
                      <span className="text-stone-900 font-bold text-xs sm:text-sm flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3.5 h-3.5 text-amber-600" />
                        {passportData.expiry_date
                          ? new Date(passportData.expiry_date).toLocaleDateString()
                          : 'Recorded'}
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

              {/* Quality & Purity Highlights + 3-Tier Evidence Chip */}
              <div className="space-y-3.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                    <Award className="w-4 h-4 text-emerald-700" />
                    Evidence-Linked Quality &amp; Purity Results
                  </h3>
                  <span
                    className={`text-xs font-bold px-3 py-1 rounded-full border ${trustInfo.tone}`}
                  >
                    {trustInfo.label}
                  </span>
                </div>

                {/* Overall Purity Rating Bar */}
                <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-stone-200/90">
                  <div className="flex items-center justify-between text-xs sm:text-sm mb-2">
                    <span className="text-stone-700 font-semibold">
                      Overall Dairy Purity Score
                    </span>
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
                            passportData.purity_score ??
                              (isRecalled ? 42 : isQuarantined ? 78 : 0)
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
                      {passportData.fat_percentage == null
                        ? 'Not recorded'
                        : `${passportData.fat_percentage}%`}
                    </span>
                    <span className="text-[11px] text-emerald-700 font-medium block mt-0.5">
                      Compositional Standard
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-stone-200/80 text-center">
                    <span className="text-xs text-stone-500 font-semibold block">
                      Milk Solids (SNF)
                    </span>
                    <span className="text-xl font-extrabold text-stone-900 mt-1 block">
                      {passportData.snf_percentage == null
                        ? 'Not recorded'
                        : `${passportData.snf_percentage}%`}
                    </span>
                    <span className="text-[11px] text-emerald-700 font-medium block mt-0.5">
                      Protein &amp; Minerals
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-stone-200/80 text-center">
                    <span className="text-xs text-stone-500 font-semibold block">
                      Adulteration Screen
                    </span>
                    <span
                      className={`text-sm font-extrabold block mt-1.5 ${
                        isRecalled || safetyStatus === 'POSITIVE'
                          ? 'text-red-700'
                          : isQuarantined || safetyStatus === 'SUSPECTED'
                          ? 'text-amber-700'
                          : 'text-emerald-700'
                      }`}
                    >
                      {isRecalled
                        ? 'Failed Safety Limit'
                        : isQuarantined
                        ? 'Under Quality Hold'
                        : safetyStatus === 'POSITIVE'
                        ? 'Positive result'
                        : safetyStatus === 'SUSPECTED'
                        ? 'Under review'
                        : safetyStatus === 'NEGATIVE'
                        ? 'Negative screen'
                        : 'Not tested'}
                    </span>
                    <span className="text-[11px] text-stone-500 block mt-0.5">
                      {safetyStatus === 'NEGATIVE'
                        ? 'No adulterants detected'
                        : 'From recorded batch data'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Vertical Farm-to-Pack Journey Timeline */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                    <HeartHandshake className="w-4 h-4 text-emerald-700" />
                    Farm-to-Pack Traceability Timeline &amp; Milk Origin Breakdown
                  </h3>
                  <span className="text-xs text-stone-500 font-medium">
                    Verified Batch Genealogy
                  </span>
                </div>

                {/* Origin contribution cards */}
                <div className="space-y-2.5">
                  {passportData.origins?.map((org, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl bg-[#FAF7F2] border border-stone-200/90 space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs sm:text-sm">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-emerald-800 text-white flex items-center justify-center font-bold text-xs">
                            {idx + 1}
                          </div>
                          <div>
                            <span className="font-bold text-stone-900 block">{org.source}</span>
                            <span className="text-xs text-stone-500">
                              Chilled Milk Contribution • {org.contribution_liters}{' '}
                              {String(org.contribution_liters).includes('L') ? '' : 'Liters'}
                            </span>
                          </div>
                        </div>

                        <span className="font-bold text-emerald-900 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 text-xs">
                          {org.percentage}% of Batch Input
                        </span>
                      </div>

                      <div className="w-full h-1.5 rounded-full bg-stone-200 overflow-hidden">
                        <div
                          className="h-full bg-emerald-600 rounded-full"
                          style={{
                            width: `${Math.min(100, Math.max(5, org.percentage || 100))}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* 4-Stage Step Timeline */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="rounded-2xl border border-stone-200 bg-white p-3.5 text-xs">
                    <div className="flex items-center gap-2 font-bold text-stone-900">
                      <Factory className="h-4 w-4 text-emerald-700" />
                      <span>1. Processing &amp; HTST</span>
                    </div>
                    <p className="mt-1 text-stone-600">
                      {passportData.pasteurization_status || 'Pasteurized & Chilled at 4°C'} at{' '}
                      {passportData.facility_name}.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-stone-200 bg-white p-3.5 text-xs">
                    <div className="flex items-center gap-2 font-bold text-stone-900">
                      <FlaskConical className="h-4 w-4 text-emerald-700" />
                      <span>2. Lab Verification</span>
                    </div>
                    <p className="mt-1 text-stone-600">
                      Signed off by {passportData.lab_signoff} ({trustInfo.label.split(' ')[0]}).
                    </p>
                  </div>

                  <div className="rounded-2xl border border-stone-200 bg-white p-3.5 text-xs">
                    <div className="flex items-center gap-2 font-bold text-stone-900">
                      <PackageCheck className="h-4 w-4 text-emerald-700" />
                      <span>3. FSSAI Compliance</span>
                    </div>
                    <p className="mt-1 text-stone-600">
                      Licence #{passportData.fssai_licence_number} · Status:{' '}
                      <strong>{passportData.status}</strong>.
                    </p>
                  </div>
                </div>
              </div>

              {/* Official Food Safety & Testing Sign-Off */}
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/90 space-y-2.5 text-xs sm:text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-stone-500 font-medium">
                    Pasteurization &amp; Hygiene:
                  </span>
                  <span className="font-semibold text-stone-800 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    {passportData.pasteurization_status || 'Pasteurized & Chilled at 4°C'}
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
                <ShieldCheck className="w-4 h-4" /> Evidence-Linked Farm-to-Table Record
              </span>
            </div>
          </div>

          {/* Bound Consumer Report Action -> Navigates to /passport/:id/report */}
          <section className="print:hidden">
            <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-5 sm:p-6">
              <div>
                <h2 className="text-base font-bold text-stone-900">
                  Notice something wrong with this product?
                </h2>
                <p className="mt-1 text-sm leading-6 text-stone-600">
                  Open the AI-assisted DairyTrace QMS Complaint Workspace pre-bound to batch{' '}
                  <strong>{activeBatchId}</strong>. Upload a lab report, paste a description, or review AI risk, root cause &amp; CAPA recommendations.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onReportConcern?.(activeBatchId)}
                className="mt-4 inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-900 px-5 text-sm font-bold text-white hover:bg-emerald-950 transition shadow-sm sm:mt-0"
              >
                <MessageSquareText className="h-4 w-4 text-emerald-300" />
                Report a Safety Concern
              </button>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
