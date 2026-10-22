import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Milk,
  Package,
  Plus,
  Link as LinkIcon,
  X,
  CheckCircle,
  FileBadge,
  Sparkles,
  QrCode,
  Download,
  Printer,
  ExternalLink,
  Copy,
  Check,
  ShieldCheck,
  Lock,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { api } from '../api';

export default function BatchCreationModal({
  isOpen,
  onClose,
  existingBatches = [],
  onBatchCreated,
  onViewPassport,
}) {
  const [activeTab, setActiveTab] = useState('raw_milk'); // 'raw_milk' | 'process_paneer' | 'confirmation'
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [allottedBatch, setAllottedBatch] = useState(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Raw Milk Form State
  const [milkForm, setMilkForm] = useState({
    id: `MILK-${Math.floor(104 + Math.random() * 50)}`,
    sku: '',
    serial_number: '',
    facility_name: 'Daund Village Collection Centre (Pune)',
    initial_quantity: 750,
    fat_percentage: 4.5,
    snf_percentage: 8.7,
    acidity: 0.14,
    adulterant_test: 'NEGATIVE',
    lab_name: 'Pune Regional Dairy Quality Lab',
    trust_level: 'VERIFIED',
  });

  const milkBatches = existingBatches.filter(
    (b) => b.product_type === 'MILK' && b.status === 'ACTIVE'
  );
  const defaultMilkId = milkBatches[0]?.id || 'MILK-101';
  const defaultCoInputId =
    milkBatches[1]?.id || (defaultMilkId !== 'MILK-102' ? 'MILK-102' : 'MILK-103');

  // Paneer Processing Form State
  const [paneerForm, setPaneerForm] = useState({
    id: `PAN-${Math.floor(203 + Math.random() * 50)}`,
    sku: '',
    serial_number: '',
    facility_name: 'FoodSync Central Dairy Plant, Pune',
    initial_quantity: 80, // kg
    parent_batch_id: defaultMilkId,
    quantity_used: 400, // L
    has_co_input: false,
    co_parent_batch_id: defaultCoInputId,
    co_quantity_used: 300,
  });

  useEffect(() => {
    if (isOpen) {
      if (activeTab !== 'confirmation') {
        // Regenerate random candidate IDs on modal reopen
        setMilkForm((prev) => ({
          ...prev,
          id: `MILK-${Math.floor(104 + Math.random() * 50)}`,
        }));
        setPaneerForm((prev) => ({
          ...prev,
          id: `PAN-${Math.floor(203 + Math.random() * 50)}`,
          parent_batch_id: milkBatches[0]?.id || 'MILK-101',
          co_parent_batch_id: milkBatches[1]?.id || milkBatches[0]?.id || 'MILK-102',
        }));
      }
    } else {
      setAllottedBatch(null);
      setErrorMsg('');
      setSuccessMsg('');
      setActiveTab('raw_milk');
    }
  }, [isOpen]);

  const handleCreateRawMilk = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      const newBatch = await api.createBatch({
        id: milkForm.id,
        sku: milkForm.sku,
        serial_number: milkForm.serial_number,
        product_type: 'MILK',
        initial_quantity: Number(milkForm.initial_quantity),
        facility_name: milkForm.facility_name,
        trust_level: milkForm.trust_level,
      });

      await api.addQualityRecord({
        batch_id: milkForm.id,
        lab_name: milkForm.lab_name,
        fat_percentage: Number(milkForm.fat_percentage),
        snf_percentage: Number(milkForm.snf_percentage),
        acidity: Number(milkForm.acidity),
        adulterant_test: milkForm.adulterant_test,
        trust_level: milkForm.trust_level,
        contaminant_details: 'Fresh milk collection quality check passed.',
      });

      const passportUrl =
        newBatch.passport_url ||
        `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'}/passport/${newBatch.id}`;

      const fullAllotment = {
        ...newBatch,
        passport_url: passportUrl,
        qr_code_url: `/api/batches/${newBatch.id}/qr`,
        quality_summary: `Fat ${milkForm.fat_percentage}% · SNF ${milkForm.snf_percentage}% · Acidity ${milkForm.acidity}% · Negative Adulterant Screen`,
        lab_name: milkForm.lab_name,
        trust_level: milkForm.trust_level,
      };

      setAllottedBatch(fullAllotment);
      setActiveTab('confirmation');
      if (onBatchCreated) onBatchCreated(fullAllotment);
    } catch (err) {
      setErrorMsg(`${err.message || 'The milk batch could not be completed.'} If it was already saved, search for the batch before retrying.`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePaneerLink = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      const newBatch = await api.createBatch({
        id: paneerForm.id,
        sku: paneerForm.sku,
        serial_number: paneerForm.serial_number,
        product_type: 'PANEER',
        initial_quantity: Number(paneerForm.initial_quantity),
        facility_name: paneerForm.facility_name,
        trust_level: 'VERIFIED',
      });

      if (paneerForm.has_co_input && paneerForm.co_parent_batch_id) {
        await api.linkBatches({
          child_batch_id: paneerForm.id,
          parents: [
            {
              parent_batch_id: paneerForm.parent_batch_id,
              quantity_used: Number(paneerForm.quantity_used),
              unit: 'L',
            },
            {
              parent_batch_id: paneerForm.co_parent_batch_id,
              quantity_used: Number(paneerForm.co_quantity_used),
              unit: 'L',
            },
          ],
        });
      } else {
        await api.linkBatches({
          parent_batch_id: paneerForm.parent_batch_id,
          child_batch_id: paneerForm.id,
          quantity_used: Number(paneerForm.quantity_used),
          unit: 'L',
        });
      }

      await api.addQualityRecord({
        batch_id: paneerForm.id,
        lab_name: 'FoodSync Central QA Lab, Pune',
        fat_percentage: 24.0,
        snf_percentage: 28.0,
        acidity: 0.18,
        adulterant_test: 'NEGATIVE',
        trust_level: 'VERIFIED',
        contaminant_details: 'Freshly crafted paneer; moisture and milk solids compliant.',
      });

      const inputDesc = paneerForm.has_co_input
        ? `${paneerForm.parent_batch_id} (${paneerForm.quantity_used}L) + ${paneerForm.co_parent_batch_id} (${paneerForm.co_quantity_used}L)`
        : `${paneerForm.parent_batch_id} (${paneerForm.quantity_used}L)`;

      const passportUrl =
        newBatch.passport_url ||
        `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'}/passport/${newBatch.id}`;

      const fullAllotment = {
        ...newBatch,
        passport_url: passportUrl,
        qr_code_url: `/api/batches/${newBatch.id}/qr`,
        linked_sources: inputDesc,
        quality_summary: 'Fat 24.0% · SNF 28.0% · Acidity 0.18% · Negative Adulterant Screen (FSSAI Compliant)',
        lab_name: 'FoodSync Central QA Lab, Pune',
        trust_level: 'VERIFIED',
      };

      setAllottedBatch(fullAllotment);
      setActiveTab('confirmation');
      if (onBatchCreated) onBatchCreated(fullAllotment);
    } catch (err) {
      setErrorMsg(`${err.message || 'The paneer batch could not be completed.'} If it was already saved, search for the batch before retrying.`);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPassportUrl = () => {
    if (!allottedBatch?.passport_url) return;
    navigator.clipboard.writeText(allottedBatch.passport_url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2200);
  };

  const handleDownloadQr = () => {
    if (!allottedBatch?.id) return;
    const downloadUrl = api.getBatchQrUrl(allottedBatch.id, 'png');
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `DairyTrace-QR-${allottedBatch.id}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleTestScanPassport = () => {
    if (!allottedBatch?.id) return;
    if (onViewPassport) {
      onViewPassport(allottedBatch.id);
      onClose();
    } else {
      window.open(allottedBatch.passport_url, '_blank');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-stone-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white border border-stone-200 rounded-3xl shadow-2xl overflow-hidden my-6 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="bg-[#FAF7F2] border-b border-stone-200 p-5 sm:p-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-emerald-800 flex items-center justify-center text-white shadow-sm">
              {activeTab === 'confirmation' ? (
                <ShieldCheck className="w-6 h-6 stroke-[2.2]" />
              ) : (
                <Plus className="w-6 h-6 stroke-[2.2]" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-bold text-stone-900 tracking-tight">
                  {activeTab === 'confirmation'
                    ? 'Batch Allotment & QR Confirmation'
                    : 'Add Dairy Batch & Designate QR'}
                </h3>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                  QA Officer
                </span>
              </div>
              <p className="text-xs sm:text-sm text-stone-600 mt-0.5">
                {activeTab === 'confirmation'
                  ? 'Official allotment certificate and designated QR code for the QA officer.'
                  : 'Record a raw milk collection or craft a linked paneer batch.'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-stone-500 hover:text-stone-900 hover:bg-stone-200/60 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher (Visible when not in confirmation mode) */}
        {activeTab !== 'confirmation' && (
          <div className="flex flex-wrap border-b border-stone-200 bg-stone-100/70 p-1.5 gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('raw_milk')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                activeTab === 'raw_milk'
                  ? 'bg-white text-emerald-900 shadow-sm border border-stone-200/80'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Milk className="w-4 h-4 text-sky-700" />
              1. Record Milk Collection
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('process_paneer')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                activeTab === 'process_paneer'
                  ? 'bg-white text-emerald-900 shadow-sm border border-stone-200/80'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Package className="w-4 h-4 text-amber-700" />
              2. Craft Paneer Batch
            </button>
          </div>
        )}

        {/* Error message */}
        {errorMsg && (
          <div role="alert" className="mx-6 mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm font-semibold text-rose-800">
            {errorMsg}
          </div>
        )}

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto">
          {/* VIEW: Allotment & QR Confirmation Page (Visible Exclusively to Uploader / Inspector) */}
          {activeTab === 'confirmation' && allottedBatch && (
            <div className="p-6 sm:p-8 space-y-6">
              {/* Uploader-Only Privacy & Allotment Notice */}
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-3.5 text-emerald-950">
                <div className="w-8 h-8 rounded-xl bg-emerald-800 text-white flex items-center justify-center shrink-0 mt-0.5">
                  <Lock className="w-4 h-4" />
                </div>
                <div className="text-xs sm:text-sm space-y-1">
                  <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-emerald-900 text-[11px]">
                    <span>Inspector &amp; Uploader Confirmation View</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-950 text-[10px]">
                      Restricted
                    </span>
                  </div>
                  <p className="text-emerald-800 leading-relaxed text-xs">
                    This confirmation docket and allotment receipt is generated strictly for the inspector/uploader.
                    Regular consumers scanning the physical package QR code bypass this screen and are routed directly to the public passport view.
                  </p>
                </div>
              </div>

              {/* Main Allotment Dossier Card */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center rounded-3xl border border-stone-200/90 bg-[#FFFDF9] p-6 shadow-sm">
                {/* Left: Detailed Batch Allotment Credentials (7 cols) */}
                <div className="md:col-span-7 space-y-4">
                  <div className="space-y-1">
                    <span className="text-[11px] font-extrabold uppercase tracking-widest text-emerald-800">
                      Official Batch Allotment
                    </span>
                    <h4 className="font-display text-2xl sm:text-3xl font-extrabold text-stone-950 tracking-tight flex items-center gap-2">
                      {allottedBatch.id}
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                        {allottedBatch.status || 'ACTIVE'}
                      </span>
                    </h4>
                    <p className="text-xs font-semibold text-stone-500">
                      {allottedBatch.product_type === 'MILK' ? 'Fresh Raw Milk Collection' : 'Crafted Fresh Malai Paneer'}
                    </p>
                  </div>

                  {/* Metadata Grid */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-white border border-stone-200">
                      <span className="text-stone-400 block text-[10px] uppercase font-bold">Allotted Volume</span>
                      <strong className="text-stone-900 text-sm mt-0.5 block">
                        {allottedBatch.initial_quantity}{' '}
                        {allottedBatch.product_type === 'MILK' ? 'Liters' : 'kg'}
                      </strong>
                    </div>

                    <div className="p-3 rounded-xl bg-white border border-stone-200">
                      <span className="text-stone-400 block text-[10px] uppercase font-bold">Facility / Plant</span>
                      <strong className="text-stone-900 text-xs sm:text-sm mt-0.5 block truncate" title={allottedBatch.facility_name}>
                        {allottedBatch.facility_name}
                      </strong>
                    </div>

                    <div className="p-3 rounded-xl bg-white border border-stone-200">
                      <span className="text-stone-400 block text-[10px] uppercase font-bold">Production Date</span>
                      <strong className="text-stone-900 text-xs mt-0.5 block">
                        {new Date(allottedBatch.production_date || Date.now()).toLocaleDateString()}
                      </strong>
                    </div>

                    <div className="p-3 rounded-xl bg-white border border-stone-200">
                      <span className="text-stone-400 block text-[10px] uppercase font-bold">Best Before</span>
                      <strong className="text-stone-900 text-xs mt-0.5 block">
                        {new Date(allottedBatch.expiry_date || Date.now() + 86400000 * 2).toLocaleDateString()}
                      </strong>
                    </div>
                  </div>

                  {/* Upstream Provenance Links if present */}
                  {allottedBatch.linked_sources && (
                    <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs">
                      <span className="text-emerald-900 font-bold block mb-0.5">Upstream Milk Provenance:</span>
                      <span className="text-emerald-800 font-semibold">{allottedBatch.linked_sources}</span>
                    </div>
                  )}

                  {/* Quality Verification Status */}
                  <div className="p-3 rounded-xl bg-[#FAF7F2] border border-stone-200/90 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-stone-600 font-semibold">Laboratory Verification:</span>
                      <span className="text-emerald-800 font-bold bg-emerald-100 px-2 py-0.5 rounded text-[10px]">
                        {allottedBatch.trust_level || 'Lab Chemist Verified'}
                      </span>
                    </div>
                    <p className="text-stone-500 text-[11px]">
                      {allottedBatch.quality_summary || 'Certified negative adulterant screen; compositional metrics compliant.'}
                    </p>
                  </div>
                </div>

                {/* Right: Designated Scannable QR Code (5 cols) */}
                <div className="md:col-span-5 flex flex-col items-center justify-center p-5 rounded-2xl bg-white border border-stone-200 shadow-sm space-y-3">
                  <div className="text-center space-y-0.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-800">
                      Designated Scannable QR
                    </span>
                    <p className="text-xs text-stone-500 font-medium">Ready for pack labeling &amp; scanner audit</p>
                  </div>

                  {/* QR Box */}
                  <div className="p-3 bg-[#FAF7F2] rounded-2xl border border-stone-200 shadow-inner">
                    <QRCodeSVG
                      value={allottedBatch.passport_url || `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'}/passport/${allottedBatch.id}`}
                      size={152}
                      level="H"
                      includeMargin={false}
                    />
                  </div>

                  {/* Passport URL + Copy Button */}
                  <div className="w-full flex items-center justify-between gap-1 p-2 rounded-xl bg-[#FAF7F2] border border-stone-200 text-[11px]">
                    <span className="font-mono text-stone-600 truncate max-w-[170px]">
                      {allottedBatch.passport_url}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyPassportUrl}
                      className="px-2 py-1 rounded-lg bg-white border border-stone-300 hover:bg-stone-100 text-stone-700 font-bold inline-flex items-center gap-1 shrink-0"
                    >
                      {copiedUrl ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      {copiedUrl ? 'Copied' : 'Copy'}
                    </button>
                  </div>

                  {/* Action Buttons for Inspector */}
                  <div className="w-full grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleTestScanPassport}
                      className="inline-flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-emerald-900 hover:bg-emerald-950 text-white text-xs font-bold transition shadow-sm"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Test Scan
                    </button>

                    <button
                      type="button"
                      onClick={handleDownloadQr}
                      className="inline-flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-800 text-xs font-bold transition"
                    >
                      <Download className="w-3.5 h-3.5 text-stone-600" />
                      Download QR
                    </button>
                  </div>
                </div>
              </div>

              {/* Bottom Actions for Inspector */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => {
                    setAllottedBatch(null);
                    setActiveTab('raw_milk');
                  }}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 text-xs font-bold transition"
                >
                  + Create Another Batch
                </button>

                <div className="w-full sm:w-auto flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                    }}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold shadow-sm transition"
                  >
                    Open in Batch Audit Hub <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Form 1: Record Fresh Milk Collection */}
          {activeTab === 'raw_milk' && (
            <form onSubmit={handleCreateRawMilk} className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wide mb-1.5">
                    Milk Batch Code
                  </label>
                  <input
                    type="text"
                    required
                    value={milkForm.id}
                    onChange={(e) => setMilkForm({ ...milkForm, id: e.target.value })}
                    className="w-full bg-[#FAF7F2] border border-stone-300 rounded-xl px-3.5 py-2 text-sm font-bold text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wide mb-1.5">
                    Milk Volume Collected (Liters)
                  </label>
                  <input
                    type="number"
                    required
                    min="10"
                    value={milkForm.initial_quantity}
                    onChange={(e) => setMilkForm({ ...milkForm, initial_quantity: e.target.value })}
                    className="w-full bg-[#FAF7F2] border border-stone-300 rounded-xl px-3.5 py-2 text-sm font-bold text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">
                    Product SKU <span className="font-normal text-stone-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    maxLength="80"
                    value={milkForm.sku}
                    onChange={(e) => setMilkForm({ ...milkForm, sku: e.target.value })}
                    className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm"
                    placeholder="e.g. DT-MILK-1L"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">
                    Serial number <span className="font-normal text-stone-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    maxLength="120"
                    value={milkForm.serial_number}
                    onChange={(e) => setMilkForm({ ...milkForm, serial_number: e.target.value })}
                    className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm"
                    placeholder="Unique pack or lot serial"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wide mb-1.5">
                    Village Collection Centre / Chilling Hub
                  </label>
                  <input
                    type="text"
                    required
                    value={milkForm.facility_name}
                    onChange={(e) => setMilkForm({ ...milkForm, facility_name: e.target.value })}
                    className="w-full bg-[#FAF7F2] border border-stone-300 rounded-xl px-3.5 py-2 text-sm text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Quality Test Details */}
              <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-stone-200/90 space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wide text-emerald-800 flex items-center gap-1.5">
                    <FileBadge className="w-4 h-4 text-emerald-700" /> Milk Quality &amp; Purity Test
                  </span>
                  <span className="text-[11px] font-semibold bg-emerald-50 text-emerald-800 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    FSSAI Dairy Standard
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-600 mb-1">
                      Milk Fat %
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={milkForm.fat_percentage}
                      onChange={(e) => setMilkForm({ ...milkForm, fat_percentage: e.target.value })}
                      className="w-full bg-white border border-stone-300 rounded-xl px-3 py-1.5 text-sm font-bold text-stone-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-600 mb-1">
                      Milk Solids (SNF) %
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={milkForm.snf_percentage}
                      onChange={(e) => setMilkForm({ ...milkForm, snf_percentage: e.target.value })}
                      className="w-full bg-white border border-stone-300 rounded-xl px-3 py-1.5 text-sm font-bold text-stone-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-600 mb-1">
                      Acidity %
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={milkForm.acidity}
                      onChange={(e) => setMilkForm({ ...milkForm, acidity: e.target.value })}
                      className="w-full bg-white border border-stone-300 rounded-xl px-3 py-1.5 text-sm font-bold text-stone-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-stone-600 mb-1">
                      Testing Lab Name
                    </label>
                    <input
                      type="text"
                      value={milkForm.lab_name}
                      onChange={(e) => setMilkForm({ ...milkForm, lab_name: e.target.value })}
                      className="w-full bg-white border border-stone-300 rounded-xl px-3 py-1.5 text-xs sm:text-sm text-stone-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-600 mb-1">
                      Verification Level
                    </label>
                    <select
                      value={milkForm.trust_level}
                      onChange={(e) => setMilkForm({ ...milkForm, trust_level: e.target.value })}
                      className="w-full bg-white border border-stone-300 rounded-xl px-3 py-1.5 text-xs sm:text-sm font-semibold text-stone-900"
                    >
                      <option value="VERIFIED">Lab Chemist Verified (Highest Trust)</option>
                      <option value="DOCUMENT_CHECKED">Lab Report Attached</option>
                      <option value="SUPPLIER_ENTERED">Recorded at Collection Centre</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl bg-stone-100 text-stone-700 text-xs font-bold hover:bg-stone-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold shadow-sm flex items-center gap-1.5 transition-colors disabled:opacity-60"
                >
                  <Plus className="w-4 h-4" />
                  {loading ? 'Registering Batch & QR…' : 'Save Milk & Generate QR'}
                </button>
              </div>
            </form>
          )}

          {/* Form 2: Craft Paneer Batch */}
          {activeTab === 'process_paneer' && (
            <form onSubmit={handleCreatePaneerLink} className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wide mb-1.5">
                    New Paneer Batch Code
                  </label>
                  <input
                    type="text"
                    required
                    value={paneerForm.id}
                    onChange={(e) => setPaneerForm({ ...paneerForm, id: e.target.value })}
                    className="w-full bg-[#FAF7F2] border border-stone-300 rounded-xl px-3.5 py-2 text-sm font-bold text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wide mb-1.5">
                    Paneer Weight Produced (kg)
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={paneerForm.initial_quantity}
                    onChange={(e) => setPaneerForm({ ...paneerForm, initial_quantity: e.target.value })}
                    className="w-full bg-[#FAF7F2] border border-stone-300 rounded-xl px-3.5 py-2 text-sm font-bold text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">
                    Product SKU <span className="font-normal text-stone-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    maxLength="80"
                    value={paneerForm.sku}
                    onChange={(e) => setPaneerForm({ ...paneerForm, sku: e.target.value })}
                    className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm"
                    placeholder="e.g. DT-PAN-200G"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">
                    Serial number <span className="font-normal text-stone-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    maxLength="120"
                    value={paneerForm.serial_number}
                    onChange={(e) => setPaneerForm({ ...paneerForm, serial_number: e.target.value })}
                    className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm"
                    placeholder="Unique pack or lot serial"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wide mb-1.5">
                    Dairy Processing Plant
                  </label>
                  <input
                    type="text"
                    required
                    value={paneerForm.facility_name}
                    onChange={(e) => setPaneerForm({ ...paneerForm, facility_name: e.target.value })}
                    className="w-full bg-[#FAF7F2] border border-stone-300 rounded-xl px-3.5 py-2 text-sm text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Source Milk Selection */}
              <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-stone-200/90 space-y-3.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-stone-800 flex items-center gap-1.5">
                    <LinkIcon className="w-4 h-4 text-emerald-700" /> Select Source Milk Used
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setPaneerForm({ ...paneerForm, has_co_input: !paneerForm.has_co_input })
                    }
                    className="text-xs font-bold text-emerald-800 hover:text-emerald-900 flex items-center gap-1 bg-white border border-stone-300 px-3 py-1 rounded-lg shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {paneerForm.has_co_input
                      ? 'Remove Second Milk Batch'
                      : 'Blend a Second Milk Batch'}
                  </button>
                </div>

                {/* Primary Milk Input */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-600 mb-1">
                      Primary Milk Batch
                    </label>
                    <select
                      value={paneerForm.parent_batch_id}
                      onChange={(e) =>
                        setPaneerForm({ ...paneerForm, parent_batch_id: e.target.value })
                      }
                      className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-stone-900"
                    >
                      {milkBatches.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.id} — {m.facility_name.split('(')[0]} ({m.remaining_quantity} L avail)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-600 mb-1">
                      Milk Used (Liters)
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={paneerForm.quantity_used}
                      onChange={(e) =>
                        setPaneerForm({ ...paneerForm, quantity_used: e.target.value })
                      }
                      className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-stone-900"
                    />
                  </div>
                </div>

                {/* Optional Second Blended Milk Batch */}
                {paneerForm.has_co_input && (
                  <div className="pt-3 border-t border-stone-200">
                    <span className="text-xs text-amber-800 font-bold block mb-2">
                      Second Milk Batch (Blended in Same Vat)
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-stone-600 mb-1">
                          Second Milk Batch
                        </label>
                        <select
                          value={paneerForm.co_parent_batch_id}
                          onChange={(e) =>
                            setPaneerForm({ ...paneerForm, co_parent_batch_id: e.target.value })
                          }
                          className="w-full bg-white border border-amber-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-stone-900"
                        >
                          {milkBatches
                            .filter((m) => m.id !== paneerForm.parent_batch_id)
                            .map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.id} — {m.facility_name.split('(')[0]} ({m.remaining_quantity} L avail)
                              </option>
                            ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-stone-600 mb-1">
                          Second Batch Milk Used (Liters)
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={paneerForm.co_quantity_used}
                          onChange={(e) =>
                            setPaneerForm({ ...paneerForm, co_quantity_used: e.target.value })
                          }
                          className="w-full bg-white border border-amber-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-stone-900"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Yield Summary Preview */}
                <div className="mt-2 p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-emerald-900 font-medium">Batch Recipe Summary:</span>
                  <span className="text-emerald-950 font-bold">
                    {(() => {
                      const totalMilk =
                        Number(paneerForm.quantity_used || 0) +
                        (paneerForm.has_co_input ? Number(paneerForm.co_quantity_used || 0) : 0);
                      const paneerKg = Number(paneerForm.initial_quantity || 1);
                      return `${totalMilk} Liters Milk → ${paneerKg} kg Fresh Paneer`;
                    })()}
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl bg-stone-100 text-stone-700 text-xs font-bold hover:bg-stone-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold shadow-sm flex items-center gap-1.5 transition-colors disabled:opacity-60"
                >
                  <LinkIcon className="w-4 h-4" />
                  {loading ? 'Creating Batch & QR…' : 'Create Paneer & Allot QR'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
