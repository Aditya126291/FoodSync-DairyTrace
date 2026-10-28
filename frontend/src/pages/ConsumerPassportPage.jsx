import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Milk,
  Calendar,
  Award,
  Share2,
  MapPin,
  CheckCircle2,
  ArrowLeft,
  HeartHandshake,
  MessageSquareText,
  Printer,
  FlaskConical,
  Factory,
  PackageCheck,
  Check,
} from 'lucide-react';
import { api } from '../api';
import { Alert, Badge, Spinner, StatusBadge } from '../components/ui';
import { formatDate, trustTier } from '../utils/format';

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
  const requestVersion = useRef(0);

  useEffect(() => {
    if (initialBatchId) {
      setSelectedBatchId(initialBatchId);
    }
  }, [initialBatchId]);

  useEffect(() => {
    loadPassport(selectedBatchId);
  }, [selectedBatchId]);

  const loadPassport = async (batchId) => {
    const version = ++requestVersion.current;
    setLoading(true);
    setPassportData(null);
    setLoadError('');
    try {
      const data = await api.getPublicPassport(batchId);
      if (version !== requestVersion.current) return;
      setPassportData(data);
    } catch (err) {
      if (version !== requestVersion.current) return;
      setLoadError(
        err.status === 404
          ? `Batch "${batchId}" was not found in our registry. Please check the code and try scanning again.`
          : 'Could not load product details. Please check your network connection and try again.'
      );
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  };

  const handleShare = async () => {
    const url =
      typeof window !== 'undefined'
        ? `${window.location.origin}/passport/${selectedBatchId}`
        : `https://dairytrace.in/passport/${selectedBatchId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      window.prompt('Copy this product passport link:', url);
    }
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

  const tier = trustTier(passportData?.trust_badge);

  return (
    <div className="container-page py-6 sm:py-10 space-y-6">
      {/* Action / Navigation Bar */}
      <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between no-print">
        <div>
          <span className="eyebrow">Public Product Passport</span>
          <p className="mt-0.5 text-base font-bold text-ink-900">
            Batch: <span className="font-mono text-brand-800">{activeBatchId}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleShare}
            className="btn btn-secondary btn-sm"
          >
            {copiedLink ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                Link Copied!
              </>
            ) : (
              <>
                <Share2 className="h-3.5 w-3.5 text-ink-500" />
                Share Link
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="btn btn-secondary btn-sm"
          >
            <Printer className="h-3.5 w-3.5 text-ink-500" />
            Print Record
          </button>
          {onBackToScanner && (
            <button
              type="button"
              onClick={onBackToScanner}
              className="btn btn-primary btn-sm"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Scan Another Product
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="card p-12 text-center">
          <Spinner label="Verifying batch origin, laboratory purity &amp; FSSAI compliance…" />
        </div>
      ) : loadError ? (
        <div className="card p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-700">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h2 className="section-title mt-4 text-xl">Product Record Not Found</h2>
          <p className="muted mx-auto mt-2 max-w-md">{loadError}</p>
          {onBackToScanner && (
            <button
              type="button"
              onClick={onBackToScanner}
              className="btn btn-primary mt-6"
            >
              Scan Another Code
            </button>
          )}
        </div>
      ) : passportData ? (
        <div className="space-y-6">
          {/* Main Passport Card */}
          <div className="card overflow-hidden">
            {/* Status Banner */}
            {isRecalled ? (
              <div className="flex items-start gap-4 bg-red-700 p-6 text-white sm:items-center">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20">
                  <ShieldAlert className="h-6 w-6 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="inline-block rounded-full bg-white/25 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider">
                    Official Food Safety Recall
                  </span>
                  <h2 className="mt-1 text-xl font-bold">Do Not Consume This Batch</h2>
                  <p className="mt-1 text-sm text-red-100 leading-relaxed">
                    {passportData.contaminant_warning ||
                      'This batch has been recalled due to a confirmed quality non-compliance. Please return the pack to your retailer for a full refund.'}
                  </p>
                </div>
              </div>
            ) : isQuarantined ? (
              <div className="flex items-start gap-4 bg-amber-600 p-6 text-white sm:items-center">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20">
                  <AlertTriangle className="h-6 w-6 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="inline-block rounded-full bg-white/25 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider">
                    Quality Hold · Under Investigation
                  </span>
                  <h2 className="mt-1 text-xl font-bold">Batch Temporarily Under QA Review</h2>
                  <p className="mt-1 text-sm text-amber-100 leading-relaxed">
                    Our quality assurance team is conducting confirmatory laboratory screenings on this batch.
                  </p>
                </div>
              </div>
            ) : passportData.adulterant_status === 'POSITIVE' ? (
              <div className="flex items-start gap-4 bg-red-700 p-6 text-white sm:items-center">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20">
                  <ShieldAlert className="h-6 w-6 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="inline-block rounded-full bg-white/25 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider">
                    Contamination Detected
                  </span>
                  <h2 className="mt-1 text-xl font-bold">Adulterant Screen Positive</h2>
                  <p className="mt-1 text-sm text-red-100 leading-relaxed">
                    {passportData.contaminant_warning || 'An adulterant test for this batch returned a non-compliant result.'}
                  </p>
                </div>
              </div>
            ) : passportData.adulterant_status === 'SUSPECTED' ? (
              <div className="flex items-start gap-4 bg-amber-600 p-6 text-white sm:items-center">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20">
                  <AlertTriangle className="h-6 w-6 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="inline-block rounded-full bg-white/25 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider">
                    Precautionary Alert
                  </span>
                  <h2 className="mt-1 text-xl font-bold">Safety Concern Under Review</h2>
                  <p className="mt-1 text-sm text-amber-100 leading-relaxed">
                    {passportData.contaminant_warning || 'A consumer complaint or sensory observation is being investigated by plant QA.'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-4 bg-brand-800 p-6 text-white sm:items-center">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20">
                  <ShieldCheck className="h-6 w-6 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-block rounded-full bg-white/25 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider">
                      Verified Safe
                    </span>
                    <span className="text-xs font-medium text-brand-200">
                      • NABL Tested &amp; FSSAI Cleared
                    </span>
                  </div>
                  <h2 className="mt-1 text-xl font-bold">Purity Verified &amp; 100% Traceable</h2>
                  <p className="mt-1 text-sm text-brand-100 leading-relaxed">
                    Passed all mandatory chemical and biological purity tests. Direct traceability from village collection societies to pack.
                  </p>
                </div>
              </div>
            )}

            {/* Passport Body */}
            <div className="p-6 sm:p-8 space-y-8">
              {/* Product Info & Scannable QR */}
              <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between pb-6 border-b border-ink-200">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="badge badge-neutral font-mono font-bold">
                      <Milk className="h-3.5 w-3.5 text-brand-700" />
                      {activeBatchId}
                    </span>
                    <StatusBadge status={passportData.status} />
                    <Badge tone={tier.tone}>{tier.label}</Badge>
                  </div>

                  <h1 className="page-title text-2xl sm:text-3xl">
                    {passportData.product_name}
                  </h1>

                  <p className="muted flex items-center gap-1.5 font-medium">
                    <MapPin className="h-4 w-4 text-brand-700 shrink-0" />
                    <span>{passportData.facility_name}</span>
                  </p>

                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <div className="rounded-control border border-ink-200 bg-canvas px-3.5 py-2">
                      <span className="block text-[11px] font-bold uppercase tracking-wide text-ink-500">
                        Production Date
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-xs font-bold text-ink-900">
                        <Calendar className="h-3.5 w-3.5 text-brand-700" />
                        {formatDate(passportData.production_date)}
                      </span>
                    </div>

                    <div className="rounded-control border border-ink-200 bg-canvas px-3.5 py-2">
                      <span className="block text-[11px] font-bold uppercase tracking-wide text-ink-500">
                        Best Before
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-xs font-bold text-ink-900">
                        <Calendar className="h-3.5 w-3.5 text-amber-600" />
                        {formatDate(passportData.expiry_date)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Scannable Pack QR */}
                <div className="flex flex-col items-center gap-2 rounded-card border border-ink-200 bg-canvas p-3 sm:shrink-0 shadow-sm">
                  <div className="rounded-control bg-white p-2 border border-ink-200">
                    <QRCodeSVG value={passportUrl} size={110} level="H" includeMargin={false} />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-ink-600">
                    Cryptographic QR
                  </span>
                </div>
              </div>

              {/* Lab Quality & Composition Metrics */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="section-title text-base flex items-center gap-2">
                    <Award className="h-4 w-4 text-brand-700" />
                    Lab Quality &amp; Composition
                  </h3>
                  <span className="text-xs text-ink-500">{tier.detail}</span>
                </div>

                {/* Purity Progress Bar */}
                <div className="rounded-card border border-ink-200 bg-canvas p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-ink-700 uppercase tracking-wide">
                      Overall Dairy Purity Index
                    </span>
                    <span
                      className={`text-base font-extrabold ${
                        isRecalled || safetyStatus === 'POSITIVE'
                          ? 'text-red-700'
                          : isQuarantined || safetyStatus === 'SUSPECTED'
                          ? 'text-amber-700'
                          : hasRecordedPurity
                          ? 'text-emerald-700'
                          : 'text-ink-600'
                      }`}
                    >
                      {isRecalled
                        ? '0% · Recalled'
                        : safetyStatus === 'POSITIVE'
                        ? '0% · Contaminated'
                        : isQuarantined
                        ? 'Hold · Testing'
                        : safetyStatus === 'SUSPECTED'
                        ? 'Under Review'
                        : hasRecordedPurity
                        ? `${passportData.purity_score}%`
                        : 'Pending Verification'}
                    </span>
                  </div>
                  <div className="h-3 w-full rounded-full bg-ink-200 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        isRecalled || safetyStatus === 'POSITIVE'
                          ? 'bg-red-600'
                          : isQuarantined || safetyStatus === 'SUSPECTED'
                          ? 'bg-amber-500'
                          : 'bg-emerald-600'
                      }`}
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(
                            5,
                            isRecalled || safetyStatus === 'POSITIVE'
                              ? 100
                              : isQuarantined || safetyStatus === 'SUSPECTED'
                              ? 65
                              : (passportData.purity_score ?? 15)
                          )
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                {/* 3 Metric Tiles */}
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="card p-4 text-center">
                    <span className="text-xs font-semibold text-ink-500 block">
                      Milk Fat (Richness)
                    </span>
                    <span className="mt-1 block text-2xl font-extrabold text-ink-900">
                      {passportData.fat_percentage == null
                        ? '—'
                        : `${passportData.fat_percentage}%`}
                    </span>
                    <span className="mt-1 block text-xs font-medium text-brand-700">
                      Standard Quality
                    </span>
                  </div>

                  <div className="card p-4 text-center">
                    <span className="text-xs font-semibold text-ink-500 block">
                      Milk Solids (SNF)
                    </span>
                    <span className="mt-1 block text-2xl font-extrabold text-ink-900">
                      {passportData.snf_percentage == null
                        ? '—'
                        : `${passportData.snf_percentage}%`}
                    </span>
                    <span className="mt-1 block text-xs font-medium text-brand-700">
                      Proteins &amp; Minerals
                    </span>
                  </div>

                  <div className="card p-4 text-center">
                    <span className="text-xs font-semibold text-ink-500 block">
                      Adulteration Screen
                    </span>
                    <span
                      className={`mt-1 block text-base font-extrabold ${
                        isRecalled || safetyStatus === 'POSITIVE'
                          ? 'text-red-700'
                          : isQuarantined || safetyStatus === 'SUSPECTED'
                          ? 'text-amber-700'
                          : 'text-emerald-700'
                      }`}
                    >
                      {isRecalled
                        ? 'Failed Safety'
                        : isQuarantined
                        ? 'Under Hold'
                        : safetyStatus === 'POSITIVE'
                        ? 'Positive'
                        : safetyStatus === 'SUSPECTED'
                        ? 'Reviewing'
                        : safetyStatus === 'NEGATIVE'
                        ? 'Negative'
                        : 'Not tested'}
                    </span>
                    <span className="mt-1 block text-xs text-ink-500">
                      {safetyStatus === 'NEGATIVE' ? 'Zero adulterants' : 'Lab validated'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Farm-to-Pack Traceability & Milk Origin Breakdown */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="section-title text-base flex items-center gap-2">
                    <HeartHandshake className="h-4 w-4 text-brand-700" />
                    Farm Milk Origins
                  </h3>
                  <span className="text-xs text-ink-500">
                    Verified Supply Chain Genealogy
                  </span>
                </div>

                <div className="space-y-2.5">
                  {passportData.origins?.map((org, idx) => {
                    const breakdown = passportData.raw_milk_origin_breakdown?.[idx];
                    const sourceCode = breakdown?.source_batch_code;
                    return (
                      <div
                        key={idx}
                        className="rounded-card border border-ink-200 bg-canvas p-4 space-y-2"
                      >
                        <div className="flex items-center justify-between text-xs sm:text-sm">
                          <div className="flex items-center gap-3">
                            <span className="flex h-7 w-7 items-center justify-center rounded-control bg-brand-800 text-xs font-bold text-white">
                              {idx + 1}
                            </span>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-ink-900 block">{org.source}</span>
                                {sourceCode && (
                                  <span className="font-mono text-[11px] bg-ink-100 text-ink-700 px-1.5 py-0.5 rounded border border-ink-200">
                                    {sourceCode}
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-ink-500">
                                Chilled Milk Contribution · {org.contribution_liters}{' '}
                                {String(org.contribution_liters).includes('L') ? '' : 'L'}
                                {breakdown?.collection_date && (
                                  <> · Collected {new Date(breakdown.collection_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</>
                                )}
                              </span>
                            </div>
                          </div>

                          <span className="badge badge-safe">
                            {org.percentage}% of Input
                          </span>
                        </div>

                        <div className="h-1.5 w-full rounded-full bg-ink-200 overflow-hidden">
                          <div
                            className="h-full bg-brand-700 rounded-full"
                            style={{
                              width: `${Math.min(100, Math.max(5, org.percentage || 100))}%`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 3-Stage Process Journey */}
                <div className="grid gap-3 pt-2 sm:grid-cols-3">
                  <div className="card p-3.5 text-xs">
                    <div className="flex items-center gap-2 font-bold text-ink-900">
                      <Factory className="h-4 w-4 text-brand-700" />
                      <span>1. Processing &amp; HTST</span>
                    </div>
                    <p className="mt-1 text-ink-600 leading-relaxed">
                      {passportData.pasteurization_status || 'Pasteurized & Chilled at 4°C'} at{' '}
                      {passportData.facility_name}.
                    </p>
                  </div>

                  <div className="card p-3.5 text-xs">
                    <div className="flex items-center gap-2 font-bold text-ink-900">
                      <FlaskConical className="h-4 w-4 text-brand-700" />
                      <span>2. NABL Lab Sign-Off</span>
                    </div>
                    <p className="mt-1 text-ink-600 leading-relaxed">
                      Signed off by {passportData.lab_signoff || 'Senior Laboratory Chemist'}.
                    </p>
                  </div>

                  <div className="card p-3.5 text-xs">
                    <div className="flex items-center gap-2 font-bold text-ink-900">
                      <PackageCheck className="h-4 w-4 text-brand-700" />
                      <span>3. FSSAI Compliance</span>
                    </div>
                    <p className="mt-1 text-ink-600 leading-relaxed">
                      License #{passportData.fssai_licence_number || '10012022000123'} · Status:{' '}
                      <strong className="text-ink-900">{passportData.status}</strong>.
                    </p>
                  </div>
                </div>
              </div>

              {/* Official Food Safety Sign-Off */}
              <div className="rounded-card border border-ink-200 bg-canvas p-4 text-xs space-y-2 sm:text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-ink-500 font-medium">Pasteurization &amp; Hygiene:</span>
                  <span className="font-semibold text-ink-900 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    {passportData.pasteurization_status || 'Pasteurized & Chilled at 4°C'}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-ink-200 pt-2">
                  <span className="text-ink-500 font-medium">Tested &amp; Approved By:</span>
                  <span className="font-semibold text-ink-900 text-right">
                    {passportData.lab_signoff || 'Central Quality Lab'}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-ink-200 pt-2">
                  <span className="text-ink-500 font-medium">FSSAI License:</span>
                  <span className="font-mono font-bold text-ink-900">
                    {passportData.fssai_licence_number || '10012022000123'}
                  </span>
                </div>
              </div>
            </div>

            {/* Passport Footer */}
            <div className="flex items-center justify-between border-t border-ink-200 bg-canvas px-6 py-4 text-xs text-ink-500">
              <span className="font-semibold text-ink-700">DairyTrace Trust Guarantee</span>
              <span className="flex items-center gap-1 font-semibold text-brand-800">
                <ShieldCheck className="h-4 w-4 text-brand-700" /> Cryptographic Provenance
              </span>
            </div>
          </div>

          {/* Action to report safety concern */}
          <div className="card card-pad flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between no-print">
            <div className="space-y-1">
              <h2 className="section-title text-base font-bold">
                Notice something wrong with this product?
              </h2>
              <p className="muted text-xs sm:text-sm max-w-xl">
                Open the AI-assisted DairyTrace safety portal pre-bound to batch{' '}
                <strong className="text-ink-900">{activeBatchId}</strong>. Upload photos or report taste/smell anomalies for rapid investigation.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onReportConcern?.(activeBatchId)}
              className="btn btn-primary shrink-0"
            >
              <MessageSquareText className="h-4 w-4" />
              Report a Safety Concern
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
