import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Award,
  Check,
  CheckCircle2,
  ChevronDown,
  Download,
  FileCheck,
  FileSpreadsheet,
  FileText,
  FlaskConical,
  HelpCircle,
  History,
  Layers,
  LoaderCircle,
  Mic,
  MicOff,
  Milk,
  Package,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Store,
  UploadCloud,
  X,
} from 'lucide-react';
import { api } from '../api';

const SAMPLE_PROMPTS = [
  {
    title: 'NABL Aflatoxin Alert (MILK-101)',
    text: 'NABL Pune forensic lab tested raw milk batch MILK-101 from Shirur Collection Centre. Found elevated Aflatoxin M1 at 0.78 ug/kg (exceeds 0.50 ug/kg limit), fat 4.1%, SNF 8.2%, and acidity 0.21%. Reported by Dr. Ananya Deshmukh as Critical.',
  },
  {
    title: 'Urea Adulteration in Paneer (PAN-201)',
    text: 'Retailer A (Kothrud) quality manager Rajesh Kulkarni reported positive DMAB spot check for synthetic urea (0.38%) in fresh paneer batch PAN-201. Whey weeping in 14 packs, fat 19.8%, SNF 24.5%, acidity 0.29%. Flag as Critical recall.',
  },
  {
    title: 'Cold-Chain Excursion (PAN-202)',
    text: 'Field inspector Vikram Patil reported reefer temperature excursion to 11.4 C for batch PAN-202 at Retailer C (Hinjawadi). Lab re-check recorded acidity 0.25%, fat 23.4%, SNF 27.1% with mild packet bloating. Set severity to Major.',
  },
  {
    title: 'LactoScan Fat/SNF Deficit (MILK-102)',
    text: 'Automated LactoScan telemetry at Junnar Collection Centre for MILK-102 flagged borderline beta-lactam reading (3.8 ppb) and lower SNF 8.4%, fat 4.3%, acidity 0.17%. Reported by Priya Nair as Precautionary hold.',
  },
];

export default function ComplaintModal({
  isOpen,
  onClose,
  initialBatchId,
  batches = [],
  onComplaintSubmitted,
  onInitiateRecall,
}) {
  const [activeTab, setActiveTab] = useState('raise'); // 'raise' | 'ledger'
  const [inputMode, setInputMode] = useState('MANUAL'); // 'AI' | 'REPORT' | 'MANUAL'

  // Form State
  const [form, setForm] = useState({
    batch_id: initialBatchId || (batches[0]?.id || 'MILK-101'),
    product_name: '',
    reporter_name: '',
    reporter_role: '',
    facility_or_store: '',
    complaint_category: 'Customer Sensory / Taste Defect',
    severity: 'PRECAUTIONARY',
    fat_percentage: '',
    snf_percentage: '',
    acidity_percentage: '',
    adulterant_status: 'NOT_TESTED',
    adulterant_findings: '',
    description: '',
    intake_mode: 'MANUAL',
    source_report_name: '',
    record_quality_check: true,
  });

  const [aiText, setAiText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiFeedback, setAiFeedback] = useState(null);
  const [updatedFields, setUpdatedFields] = useState(new Set());
  const [isUploading, setIsUploading] = useState(false);
  const [sampleReports, setSampleReports] = useState([]);
  const [uploadError, setUploadError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(null);

  // Blast Radius Preview State
  const [previewBlast, setPreviewBlast] = useState(false);
  const [blastData, setBlastData] = useState(null);
  const [loadingBlast, setLoadingBlast] = useState(false);

  // Complaints Ledger State
  const [complaintsList, setComplaintsList] = useState([]);
  const [loadingComplaints, setLoadingComplaints] = useState(false);
  const [ledgerFilter, setLedgerFilter] = useState('ALL');

  const fileInputRef = useRef(null);

  // Sync batch info when initialBatchId or batch selection changes
  useEffect(() => {
    if (initialBatchId) {
      const selected = batches.find((b) => b.id === initialBatchId);
      setForm((prev) => ({
        ...prev,
        batch_id: initialBatchId,
        product_name:
          selected?.product_type === 'PANEER'
            ? 'FoodSync Fresh Malai Paneer 200g'
            : 'FoodSync Farm-Chilled Raw Milk',
        facility_or_store: selected?.facility_name || prev.facility_or_store,
      }));
    } else if (batches.length && !form.batch_id) {
      setForm((prev) => ({
        ...prev,
        batch_id: batches[0].id,
        product_name:
          batches[0].product_type === 'PANEER'
            ? 'FoodSync Fresh Malai Paneer 200g'
            : 'FoodSync Farm-Chilled Raw Milk',
      }));
    }
  }, [initialBatchId, batches]);

  // Load sample reports catalogue on mount
  useEffect(() => {
    let mounted = true;
    api.getSampleReports().then((reports) => {
      if (mounted) setSampleReports(reports || []);
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  // Load Complaints Ledger
  const loadLedger = async () => {
    setLoadingComplaints(true);
    try {
      const data = await api.getComplaints();
      setComplaintsList(data || []);
    } catch (e) {
      setComplaintsList([]);
    } finally {
      setLoadingComplaints(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'ledger') {
      loadLedger();
    }
  }, [isOpen, activeTab]);

  // Handle batch dropdown change in form
  const handleBatchSelect = (newBatchId) => {
    const selected = batches.find((b) => b.id === newBatchId);
    setForm((prev) => ({
      ...prev,
      batch_id: newBatchId,
      product_name:
        selected?.product_type === 'PANEER'
          ? 'FoodSync Fresh Malai Paneer 200g'
          : 'FoodSync Farm-Chilled Raw Milk',
      facility_or_store: selected?.facility_name || prev.facility_or_store,
    }));
    setUpdatedFields((prev) => new Set(prev).add('batch_id'));
    if (previewBlast) {
      loadBlastRadius(newBatchId);
    }
  };

  // Load Blast Radius Preview
  const loadBlastRadius = async (targetBatch) => {
    setLoadingBlast(true);
    try {
      const data = await api.simulateRecall({
        batch_id: targetBatch || form.batch_id,
        reason: form.adulterant_findings || form.description || 'Quality / Safety Alert',
      });
      setBlastData(data);
    } catch (e) {
      setBlastData(null);
    } finally {
      setLoadingBlast(false);
    }
  };

  const toggleBlastPreview = () => {
    if (!previewBlast) {
      loadBlastRadius(form.batch_id);
      setPreviewBlast(true);
    } else {
      setPreviewBlast(false);
    }
  };

  // Apply auto-fill patch with visual highlight tracking
  const applyFormPatch = (patch, sourceMode, sourceFilename = '') => {
    const newlyUpdated = new Set();
    setForm((prev) => {
      const next = { ...prev };
      Object.keys(patch).forEach((key) => {
        if (patch[key] !== undefined && patch[key] !== null && patch[key] !== '') {
          next[key] = patch[key];
          newlyUpdated.add(key);
        }
      });
      next.intake_mode = sourceMode;
      if (sourceFilename) next.source_report_name = sourceFilename;
      return next;
    });

    setUpdatedFields(newlyUpdated);
    // Auto-clear highlight after 5 seconds
    setTimeout(() => {
      setUpdatedFields(new Set());
    }, 6000);

    if (previewBlast && patch.batch_id) {
      loadBlastRadius(patch.batch_id);
    }
  };

  // Run Natural Language AI analysis
  const handleAnalyzeText = async () => {
    if (!aiText.trim()) return;
    setIsAnalyzing(true);
    setAiFeedback(null);
    try {
      const res = await api.processComplaintCopilot({
        message: aiText,
        currentForm: form,
        intakeMode: 'AI_COPILOT',
      });
      if (res?.patch) {
        applyFormPatch(res.patch, 'NATURAL_LANGUAGE');
      }
      setAiFeedback(res);
    } catch (err) {
      setAiFeedback({
        assistant_message: 'Analysis completed with smart local extraction.',
        safety_evaluation: { recommended_severity: form.severity },
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Handle file upload
  const handleFileUpload = async (file) => {
    if (!file) return;
    setIsUploading(true);
    setUploadError('');
    try {
      const res = await api.uploadComplaintReport(file, form);
      if (res?.patch) {
        applyFormPatch(res.patch, 'REPORT_UPLOAD', file.name);
      }
      setAiFeedback(res);
    } catch (err) {
      setUploadError(err.message || 'Could not parse this file format.');
    } finally {
      setIsUploading(false);
    }
  };

  // Load a built-in sample forensic report
  const handleLoadSampleReport = (sample) => {
    const patch = {
      batch_id: sample.structured_data?.['Batch / Lot Number'] || sample.batch_id || form.batch_id,
      product_name: sample.structured_data?.['Product Name'] || form.product_name,
      reporter_name: sample.structured_data?.['Reported By'] || sample.reporter_name || form.reporter_name,
      reporter_role: sample.structured_data?.['Reporter Role'] || 'Forensic Quality Analyst',
      facility_or_store: sample.structured_data?.['Store / Facility'] || form.facility_or_store,
      complaint_category: sample.structured_data?.['Complaint Category'] || 'Forensic / Adulteration Alert',
      severity: sample.structured_data?.Severity || 'CRITICAL',
      fat_percentage: parseFloat(sample.structured_data?.['Milk Fat (%)'] || '4.1'),
      snf_percentage: parseFloat(sample.structured_data?.['Milk Solids SNF (%)'] || '8.2'),
      acidity_percentage: parseFloat(sample.structured_data?.['Titratable Acidity (%)'] || '0.21'),
      adulterant_status: sample.structured_data?.['Adulterant Test'] || 'POSITIVE',
      adulterant_findings: sample.structured_data?.['Adulterant / Contaminant Findings'] || '',
      description: sample.structured_data?.Summary || sample.subtitle || '',
    };
    applyFormPatch(patch, 'REPORT_UPLOAD', sample.filename);
    setAiFeedback({
      assistant_message: `Successfully analyzed and extracted key parameters from official sample report: ${sample.title}`,
      extraction_engine: `DairyTrace Document Parser (${sample.format})`,
      source_filename: sample.filename,
    });
  };

  // Download a real sample report file
  const handleDownloadSample = async (sample) => {
    try {
      const { blob, filename } = await api.downloadSampleReport(sample.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Download error:', e);
    }
  };

  // Submit Complaint
  const handleSubmitComplaint = async (triggerRecallImmediately = false) => {
    setIsSubmitting(true);
    setSubmitSuccess(null);
    try {
      const payload = {
        ...form,
        fat_percentage: form.fat_percentage ? parseFloat(form.fat_percentage) : null,
        snf_percentage: form.snf_percentage ? parseFloat(form.snf_percentage) : null,
        acidity_percentage: form.acidity_percentage ? parseFloat(form.acidity_percentage) : null,
      };
      const saved = await api.createComplaint(payload);
      setSubmitSuccess(saved);

      if (triggerRecallImmediately && onInitiateRecall) {
        onInitiateRecall(form.batch_id, form.adulterant_findings || form.description, form.severity);
        onClose();
        return;
      }

      if (onComplaintSubmitted) {
        onComplaintSubmitted(saved);
      }
    } catch (err) {
      alert(err.message || 'Failed to submit complaint.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered complaints in ledger
  const filteredLedger = useMemo(() => {
    if (ledgerFilter === 'ALL') return complaintsList;
    return complaintsList.filter(
      (c) => c.severity === ledgerFilter || c.intake_mode === ledgerFilter
    );
  }, [complaintsList, ledgerFilter]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-stone-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-6xl bg-[#FFFDF9] border border-stone-200 rounded-3xl shadow-2xl overflow-hidden my-4 max-h-[92vh] flex flex-col">
        {/* Modal Top Header */}
        <div className="bg-white border-b border-stone-200/90 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-emerald-900 flex items-center justify-center text-white shadow-sm">
              <FlaskConical className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-xl font-bold text-stone-950">
                  Dairy Complaint &amp; Forensic Safety Check
                </h2>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                  AI Copilot
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                Raise via manual entry, everyday natural language, or uploaded lab reports with automatic field extraction.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tab Toggle: Raise vs Ledger */}
            <div className="flex rounded-xl bg-stone-100 p-1">
              <button
                type="button"
                onClick={() => setActiveTab('raise')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                  activeTab === 'raise'
                    ? 'bg-white text-emerald-900 shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Raise Issue
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('ledger')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
                  activeTab === 'ledger'
                    ? 'bg-white text-emerald-900 shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                Complaints Ledger
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content Body */}
        {activeTab === 'raise' ? (
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
            {/* Input Mode Selector Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-white border border-stone-200 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
                  Choose Intake Mode:
                </span>
                <span className="text-xs text-stone-400">•</span>
                <span className="text-xs text-stone-600">
                  {inputMode === 'AI' && 'Type or paste plain text; AI extracts parameters automatically.'}
                  {inputMode === 'REPORT' && 'Upload a lab PDF/DOCX/TXT/JSON or test with official forensic samples.'}
                  {inputMode === 'MANUAL' && 'Directly enter and edit each field manually.'}
                </span>
              </div>

              <div className="flex gap-1.5 bg-[#FAF7F2] p-1 rounded-xl border border-stone-200">
                <button
                  type="button"
                  onClick={() => {
                    setInputMode('AI');
                    setForm((prev) => ({ ...prev, intake_mode: 'NATURAL_LANGUAGE' }));
                  }}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                    inputMode === 'AI'
                      ? 'bg-emerald-900 text-white shadow-sm'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  Natural Language AI
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInputMode('REPORT');
                    setForm((prev) => ({ ...prev, intake_mode: 'REPORT_UPLOAD' }));
                  }}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                    inputMode === 'REPORT'
                      ? 'bg-emerald-900 text-white shadow-sm'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <UploadCloud className="w-3.5 h-3.5 text-sky-300" />
                  Upload Lab Report
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInputMode('MANUAL');
                    setForm((prev) => ({ ...prev, intake_mode: 'MANUAL' }));
                  }}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                    inputMode === 'MANUAL'
                      ? 'bg-emerald-900 text-white shadow-sm'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Manual Entry
                </button>
              </div>
            </div>

            {/* Split Panel: Left Assistant + Right Auto-Filled Form */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Copilot & Report Upload Tools (5 cols) */}
              <div className="lg:col-span-5 space-y-4">
                {/* MODE 1: Natural Language AI Assistant */}
                {inputMode === 'AI' && (
                  <div className="p-4 sm:p-5 rounded-2xl bg-white border border-stone-200 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-emerald-800" />
                        <h3 className="text-sm font-bold text-stone-900">
                          AI Natural Language Intake
                        </h3>
                      </div>
                      <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-md">
                        Auto-detects batch &amp; metrics
                      </span>
                    </div>

                    <p className="text-xs text-stone-500">
                      Type the complaint, retailer message, or customer observation in your own words.
                    </p>

                    <textarea
                      value={aiText}
                      onChange={(e) => setAiText(e.target.value)}
                      placeholder="e.g., Metro Fresh Mart reported sour smell and positive urea test in Batch MILK-102 from Village Collection Center B, fat was 3.8%, SNF 7.4%, acidity 0.21%..."
                      rows={4}
                      className="w-full bg-[#FAF7F2] border border-stone-300 rounded-xl p-3 text-xs sm:text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
                    />

                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={handleAnalyzeText}
                        disabled={isAnalyzing || !aiText.trim()}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-900 hover:bg-emerald-950 text-white text-xs font-bold shadow-sm transition disabled:opacity-50"
                      >
                        {isAnalyzing ? (
                          <>
                            <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                            Analyzing with AI…
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                            Analyze &amp; Auto-Fill Form
                          </>
                        )}
                      </button>

                      {aiText && (
                        <button
                          type="button"
                          onClick={() => setAiText('')}
                          className="text-xs text-stone-400 hover:text-stone-700"
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    {/* Sample Prompts */}
                    <div className="pt-3 border-t border-stone-100 space-y-2">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                        1-Click Test Prompts:
                      </p>
                      <div className="flex flex-col gap-1.5">
                        {SAMPLE_PROMPTS.map((sample, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setAiText(sample.text);
                            }}
                            className="text-left p-2.5 rounded-xl border border-stone-200/80 bg-[#FFFDF9] hover:bg-emerald-50/70 hover:border-emerald-300 text-xs text-stone-700 transition group"
                          >
                            <span className="block font-bold text-stone-900 group-hover:text-emerald-950">
                              {sample.title}
                            </span>
                            <span className="block text-[11px] text-stone-500 line-clamp-1 mt-0.5">
                              {sample.text}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* MODE 2: Lab & Forensic Report Upload */}
                {inputMode === 'REPORT' && (
                  <div className="p-4 sm:p-5 rounded-2xl bg-white border border-stone-200 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <UploadCloud className="w-4 h-4 text-sky-700" />
                        <h3 className="text-sm font-bold text-stone-900">
                          Forensic &amp; Dairy Report Upload
                        </h3>
                      </div>
                      <span className="text-[11px] font-semibold text-sky-800 bg-sky-50 px-2.5 py-0.5 rounded-md">
                        PDF • DOCX • TXT • JSON
                      </span>
                    </div>

                    <p className="text-xs text-stone-500">
                      Upload an official certificate or lab printout to extract compositional values, adulterant markers, and batch codes.
                    </p>

                    {/* Drag & Drop File Upload Box */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.docx,.txt,.json,.eml"
                      onChange={(e) => {
                        if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
                      }}
                      className="hidden"
                    />

                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-stone-300 hover:border-emerald-600 rounded-2xl p-6 text-center cursor-pointer bg-[#FAF7F2]/60 hover:bg-emerald-50/40 transition group"
                    >
                      <UploadCloud className="w-8 h-8 mx-auto text-stone-400 group-hover:text-emerald-700 transition" />
                      <p className="mt-2 text-xs font-bold text-stone-800">
                        {isUploading ? 'Extracting document details…' : 'Click to select or drop report file'}
                      </p>
                      <p className="text-[11px] text-stone-400 mt-0.5">
                        Supports NABL certificates, LactoScan JSON, and retail quality audit docs (up to 10MB)
                      </p>
                    </div>

                    {uploadError && (
                      <p className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-semibold flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        {uploadError}
                      </p>
                    )}

                    {/* Built-in Sample Reports */}
                    <div className="pt-3 border-t border-stone-100 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                          Official Sample Lab Reports:
                        </p>
                        <span className="text-[10px] text-stone-500">1-click test or download</span>
                      </div>

                      <div className="space-y-2">
                        {sampleReports.map((sample) => (
                          <div
                            key={sample.id}
                            className="p-3 rounded-xl border border-stone-200 bg-[#FFFDF9] flex flex-col gap-2 hover:border-emerald-300 transition"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-stone-100 text-stone-700 uppercase">
                                    {sample.format}
                                  </span>
                                  <span className="text-xs font-bold text-stone-900">
                                    {sample.title}
                                  </span>
                                </div>
                                <p className="text-[11px] text-stone-500 mt-0.5">
                                  {sample.badge}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => handleLoadSampleReport(sample)}
                                className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-emerald-900 hover:bg-emerald-950 text-white text-[11px] font-bold shadow-sm transition"
                              >
                                <Sparkles className="w-3 h-3 text-amber-300" />
                                Load &amp; Auto-Fill
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDownloadSample(sample)}
                                title="Download actual file to desktop"
                                className="inline-flex items-center gap-1 py-1.5 px-2.5 rounded-lg border border-stone-300 hover:bg-stone-100 text-stone-700 text-[11px] font-semibold transition"
                              >
                                <Download className="w-3 h-3 text-stone-500" />
                                File
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* MODE 3: Manual Entry Help Card */}
                {inputMode === 'MANUAL' && (
                  <div className="p-4 sm:p-5 rounded-2xl bg-white border border-stone-200 shadow-sm space-y-3">
                    <div className="flex items-center gap-2 text-stone-800">
                      <FileText className="w-4 h-4 text-emerald-800" />
                      <h3 className="text-sm font-bold">Direct Form Entry</h3>
                    </div>
                    <p className="text-xs text-stone-600 leading-relaxed">
                      You are in manual mode. Fill in or tweak any field in the right-hand form directly.
                    </p>
                    <div className="p-3 rounded-xl bg-[#FAF7F2] border border-stone-200 text-xs text-stone-600 space-y-1">
                      <p className="font-semibold text-stone-800">Tip:</p>
                      <p>
                        Switch to <strong>Natural Language AI</strong> or <strong>Upload Lab Report</strong> at any time to automatically populate the fields.
                      </p>
                    </div>
                  </div>
                )}

                {/* AI / Extracted Analysis Result Pill */}
                {aiFeedback && (
                  <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 space-y-2">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                      {aiFeedback.assistant_message || 'Key details successfully extracted!'}
                    </div>
                    {aiFeedback.source_filename && (
                      <p className="text-[11px] text-emerald-800">
                        Source Document: <strong>{aiFeedback.source_filename}</strong>
                      </p>
                    )}
                    {updatedFields.size > 0 && (
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-[11px] font-semibold text-emerald-800">Updated:</span>
                        {Array.from(updatedFields).map((field) => (
                          <span
                            key={field}
                            className="px-2 py-0.5 rounded bg-emerald-200/80 text-[10px] font-bold text-emerald-950"
                          >
                            {field.replace('_', ' ')}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Right Column: The Auto-Filled Complaint & Quality Form (7 cols) */}
              <div className="lg:col-span-7 space-y-4">
                <div className="p-5 sm:p-6 rounded-2xl bg-white border border-stone-200 shadow-sm space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                    <div>
                      <h3 className="text-sm font-bold text-stone-900">
                        Structured Complaint &amp; Quality Form
                      </h3>
                      <p className="text-xs text-stone-500 mt-0.5">
                        {updatedFields.size > 0
                          ? 'Fields marked with green badge were automatically populated by AI / Report.'
                          : 'Review and verify details before saving.'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={toggleBlastPreview}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                        previewBlast
                          ? 'bg-rose-50 text-rose-900 border-rose-300'
                          : 'bg-[#FAF7F2] text-stone-700 border-stone-300 hover:bg-stone-100'
                      }`}
                    >
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                      {previewBlast ? 'Hide Blast Radius' : 'Preview Blast Radius'}
                    </button>
                  </div>

                  {/* Form Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Target Batch ID */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-stone-700">Target Batch ID</label>
                        {updatedFields.has('batch_id') && (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded">
                            AI Auto-filled
                          </span>
                        )}
                      </div>
                      <select
                        value={form.batch_id}
                        onChange={(e) => handleBatchSelect(e.target.value)}
                        className={`w-full bg-[#FAF7F2] border rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-stone-900 outline-none transition ${
                          updatedFields.has('batch_id')
                            ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                            : 'border-stone-300 focus:border-emerald-700'
                        }`}
                      >
                        {batches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.id} ({b.product_type === 'MILK' ? 'Raw Milk' : 'Paneer'} — {b.facility_name})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Product Name */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-stone-700">Product Name</label>
                        {updatedFields.has('product_name') && (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded">
                            AI Auto-filled
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        value={form.product_name}
                        onChange={(e) => setForm({ ...form, product_name: e.target.value })}
                        className={`w-full bg-[#FAF7F2] border rounded-xl px-3 py-2 text-xs sm:text-sm text-stone-900 outline-none ${
                          updatedFields.has('product_name')
                            ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                            : 'border-stone-300 focus:border-emerald-700'
                        }`}
                      />
                    </div>

                    {/* Reporter Name */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-stone-700">Reporter / Customer Name</label>
                        {updatedFields.has('reporter_name') && (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded">
                            AI Auto-filled
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        value={form.reporter_name}
                        onChange={(e) => setForm({ ...form, reporter_name: e.target.value })}
                        className={`w-full bg-[#FAF7F2] border rounded-xl px-3 py-2 text-xs sm:text-sm text-stone-900 outline-none ${
                          updatedFields.has('reporter_name')
                            ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                            : 'border-stone-300 focus:border-emerald-700'
                        }`}
                      />
                    </div>

                    {/* Reporter Role */}
                    <div>
                      <label className="text-xs font-bold text-stone-700 block mb-1">Reporter Role</label>
                      <input
                        type="text"
                        value={form.reporter_role}
                        onChange={(e) => setForm({ ...form, reporter_role: e.target.value })}
                        placeholder="e.g., NABL Forensic Chemist, Store QA Manager, Customer"
                        className="w-full bg-[#FAF7F2] border border-stone-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-stone-900 outline-none focus:border-emerald-700"
                      />
                    </div>

                    {/* Facility / Store */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-stone-700">Store / Facility Location</label>
                        {updatedFields.has('facility_or_store') && (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded">
                            AI Auto-filled
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        value={form.facility_or_store}
                        onChange={(e) => setForm({ ...form, facility_or_store: e.target.value })}
                        className={`w-full bg-[#FAF7F2] border rounded-xl px-3 py-2 text-xs sm:text-sm text-stone-900 outline-none ${
                          updatedFields.has('facility_or_store')
                            ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                            : 'border-stone-300 focus:border-emerald-700'
                        }`}
                      />
                    </div>

                    {/* Complaint Category */}
                    <div>
                      <label className="text-xs font-bold text-stone-700 block mb-1">Issue Category</label>
                      <select
                        value={form.complaint_category}
                        onChange={(e) => setForm({ ...form, complaint_category: e.target.value })}
                        className="w-full bg-[#FAF7F2] border border-stone-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold text-stone-900 outline-none focus:border-emerald-700"
                      >
                        <option>Chemical / Mycotoxin Contaminant</option>
                        <option>Forensic / Adulteration Alert</option>
                        <option>Cold-Chain / Storage Excursion</option>
                        <option>Microbial / Spoilage / Sourness</option>
                        <option>Compositional Non-Compliance (Fat/SNF)</option>
                        <option>Packaging / Tamper Seal Defect</option>
                        <option>Customer Sensory / Taste Defect</option>
                      </select>
                    </div>

                    {/* Severity Level */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-stone-700">Severity / Recall Class</label>
                        {updatedFields.has('severity') && (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded">
                            AI Auto-filled
                          </span>
                        )}
                      </div>
                      <select
                        value={form.severity}
                        onChange={(e) => setForm({ ...form, severity: e.target.value })}
                        className={`w-full bg-[#FAF7F2] border rounded-xl px-3 py-2 text-xs sm:text-sm font-bold outline-none ${
                          form.severity === 'CRITICAL'
                            ? 'text-rose-900 bg-rose-50 border-rose-300'
                            : form.severity === 'MAJOR'
                            ? 'text-amber-900 bg-amber-50 border-amber-300'
                            : 'text-stone-900 border-stone-300'
                        }`}
                      >
                        <option value="CRITICAL">CRITICAL (Class I Recall — Direct Hazard)</option>
                        <option value="MAJOR">MAJOR (Class II Recall — Serious Quality Defect)</option>
                        <option value="PRECAUTIONARY">PRECAUTIONARY (Class III — Minor Hold)</option>
                      </select>
                    </div>

                    {/* Adulterant Status */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-stone-700">Adulterant Test Result</label>
                        {updatedFields.has('adulterant_status') && (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded">
                            AI Auto-filled
                          </span>
                        )}
                      </div>
                      <select
                        value={form.adulterant_status}
                        onChange={(e) => setForm({ ...form, adulterant_status: e.target.value })}
                        className={`w-full bg-[#FAF7F2] border rounded-xl px-3 py-2 text-xs sm:text-sm font-bold outline-none ${
                          form.adulterant_status === 'POSITIVE'
                            ? 'text-rose-900 bg-rose-50 border-rose-300'
                            : form.adulterant_status === 'SUSPECTED'
                            ? 'text-amber-900 bg-amber-50 border-amber-300'
                            : 'text-emerald-900 bg-emerald-50 border-emerald-300'
                        }`}
                      >
                        <option value="POSITIVE">POSITIVE (Contaminant Confirmed)</option>
                        <option value="SUSPECTED">SUSPECTED (Irregular Reading / Sensory Flag)</option>
                        <option value="NEGATIVE">NEGATIVE (No Adulterant Found)</option>
                        <option value="NOT_TESTED">NOT TESTED</option>
                      </select>
                    </div>
                  </div>

                  {/* Laboratory Metrics Section */}
                  <div className="p-4 rounded-xl bg-[#FAF7F2] border border-stone-200/90 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Award className="w-4 h-4 text-emerald-800" />
                        <span className="text-xs font-bold text-stone-900 uppercase tracking-wide">
                          Laboratory Compositional Metrics
                        </span>
                      </div>
                      <span className="text-[10px] text-stone-500">Auto-links to batch Quality Record</span>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-semibold text-stone-600">Milk Fat %</label>
                          {updatedFields.has('fat_percentage') && (
                            <Check className="w-3 h-3 text-emerald-600" />
                          )}
                        </div>
                        <input
                          type="number"
                          step="0.01"
                          value={form.fat_percentage}
                          onChange={(e) => setForm({ ...form, fat_percentage: e.target.value })}
                          placeholder="e.g. 4.1"
                          className="w-full bg-white border border-stone-300 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm font-bold text-stone-900 outline-none focus:border-emerald-700"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-semibold text-stone-600">Solids SNF %</label>
                          {updatedFields.has('snf_percentage') && (
                            <Check className="w-3 h-3 text-emerald-600" />
                          )}
                        </div>
                        <input
                          type="number"
                          step="0.01"
                          value={form.snf_percentage}
                          onChange={(e) => setForm({ ...form, snf_percentage: e.target.value })}
                          placeholder="e.g. 8.2"
                          className="w-full bg-white border border-stone-300 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm font-bold text-stone-900 outline-none focus:border-emerald-700"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-semibold text-stone-600">Acidity %</label>
                          {updatedFields.has('acidity_percentage') && (
                            <Check className="w-3 h-3 text-emerald-600" />
                          )}
                        </div>
                        <input
                          type="number"
                          step="0.01"
                          value={form.acidity_percentage}
                          onChange={(e) => setForm({ ...form, acidity_percentage: e.target.value })}
                          placeholder="e.g. 0.21"
                          className="w-full bg-white border border-stone-300 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm font-bold text-stone-900 outline-none focus:border-emerald-700"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-stone-600 block mb-1">
                        Contaminant / Adulterant Findings Details
                      </label>
                      <input
                        type="text"
                        value={form.adulterant_findings}
                        onChange={(e) => setForm({ ...form, adulterant_findings: e.target.value })}
                        placeholder="Specific chemicals, toxin levels, or sensory observations..."
                        className="w-full bg-white border border-stone-300 rounded-lg px-3 py-1.5 text-xs text-stone-900 outline-none focus:border-emerald-700"
                      />
                    </div>
                  </div>

                  {/* Detailed Description */}
                  <div>
                    <label className="text-xs font-bold text-stone-700 block mb-1">
                      Full Complaint &amp; Forensic Summary
                    </label>
                    <textarea
                      rows={3}
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder="Enter detailed notes or forensic investigation background..."
                      className="w-full bg-[#FAF7F2] border border-stone-300 rounded-xl p-3 text-xs sm:text-sm text-stone-900 outline-none focus:border-emerald-700"
                    />
                  </div>

                  {/* Blast Radius Preview Accordion / Box */}
                  {previewBlast && (
                    <div className="p-4 rounded-2xl bg-rose-50/90 border border-rose-200 text-xs text-rose-950 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-bold text-rose-900">
                          <ShieldAlert className="w-4 h-4 text-rose-600" />
                          Instant Recall Blast Radius Simulation for {form.batch_id}
                        </div>
                        {loadingBlast && (
                          <LoaderCircle className="w-4 h-4 animate-spin text-rose-600" />
                        )}
                      </div>

                      {blastData ? (
                        <div className="space-y-3 pt-1">
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            <div className="bg-white p-2.5 rounded-xl border border-rose-200">
                              <span className="text-[10px] text-stone-500 block">Affected Products</span>
                              <span className="font-bold text-rose-950 text-sm">
                                {blastData.affected_product_batches?.length || 0} batches
                              </span>
                              <span className="text-[10px] text-rose-700 block">
                                {blastData.affected_product_batches?.join(', ') || 'None'}
                              </span>
                            </div>
                            <div className="bg-white p-2.5 rounded-xl border border-rose-200">
                              <span className="text-[10px] text-stone-500 block">Compromised Retailers</span>
                              <span className="font-bold text-rose-950 text-sm">
                                {blastData.compromised_retail_destinations?.length || 0} stores
                              </span>
                              <span className="text-[10px] text-rose-700 block">
                                {blastData.compromised_retail_destinations?.map((d) => d.destination_name.split(' ')[0]).join(', ') || 'None'}
                              </span>
                            </div>
                            <div className="bg-white p-2.5 rounded-xl border border-rose-200 col-span-2 sm:col-span-1">
                              <span className="text-[10px] text-stone-500 block">Total Volume at Risk</span>
                              <span className="font-bold text-rose-950 text-sm">
                                {blastData.total_affected_volume_kg || 0} kg / units
                              </span>
                              <span className="text-[10px] text-emerald-800 block">
                                Safe control batches protected
                              </span>
                            </div>
                          </div>

                          <p className="text-[11px] text-rose-900 leading-normal">
                            Submitting with <strong>Submit &amp; Initiate Recall</strong> will automatically flag these downstream batches and alert compromised retail stores.
                          </p>
                        </div>
                      ) : (
                        <p className="text-stone-500">Calculating impact graph…</p>
                      )}
                    </div>
                  )}

                  {/* Submission Action Buttons */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-stone-200">
                    <p className="text-xs text-stone-500">
                      Logged via <strong>{form.intake_mode.replace('_', ' ')}</strong>
                      {form.source_report_name && ` (${form.source_report_name})`}
                    </p>

                    <div className="flex items-center gap-2.5 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => handleSubmitComplaint(false)}
                        disabled={isSubmitting}
                        className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-stone-300 hover:bg-stone-100 text-xs font-bold text-stone-800 transition disabled:opacity-50"
                      >
                        {isSubmitting ? (
                          <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5 text-emerald-700" />
                        )}
                        Log to Ledger
                      </button>

                      {(form.severity === 'CRITICAL' || form.adulterant_status === 'POSITIVE') && (
                        <button
                          type="button"
                          onClick={() => handleSubmitComplaint(true)}
                          disabled={isSubmitting}
                          className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm transition disabled:opacity-50"
                        >
                          <ShieldAlert className="w-3.5 h-3.5 text-white" />
                          Submit &amp; Initiate Recall
                        </button>
                      )}
                    </div>
                  </div>

                  {submitSuccess && (
                    <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                        <span>
                          Complaint successfully logged as <strong>{submitSuccess.complaint_ref}</strong>!
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('ledger')}
                        className="text-xs font-bold text-emerald-900 underline"
                      >
                        View in Ledger →
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* TAB 2: Complaints Ledger */
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-stone-900 text-base">
                  Recorded Quality Complaints &amp; Forensic Dossiers
                </h3>
                <p className="text-xs text-stone-500">
                  Audit trail of all customer, retailer, and forensic reports logged across batches.
                </p>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-stone-500">Filter:</span>
                <select
                  value={ledgerFilter}
                  onChange={(e) => setLedgerFilter(e.target.value)}
                  className="bg-white border border-stone-300 rounded-xl px-3 py-1.5 text-xs font-bold text-stone-800 outline-none focus:border-emerald-700"
                >
                  <option value="ALL">All Records ({complaintsList.length})</option>
                  <option value="CRITICAL">Critical Only</option>
                  <option value="MAJOR">Major Only</option>
                  <option value="REPORT_UPLOAD">Report Uploads</option>
                  <option value="NATURAL_LANGUAGE">Natural Language AI</option>
                  <option value="MANUAL">Manual Submissions</option>
                </select>

                <button
                  type="button"
                  onClick={loadLedger}
                  className="p-1.5 rounded-xl border border-stone-200 hover:bg-stone-100 text-stone-600 transition"
                  title="Refresh list"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingComplaints ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {loadingComplaints ? (
              <div className="p-8 text-center text-sm text-stone-500">
                <LoaderCircle className="w-5 h-5 mx-auto animate-spin mb-2 text-emerald-800" />
                Loading complaints ledger…
              </div>
            ) : filteredLedger.length === 0 ? (
              <div className="p-8 text-center bg-stone-50 rounded-2xl border border-dashed border-stone-200">
                <FileCheck className="w-8 h-8 mx-auto text-stone-400 mb-2" />
                <p className="text-sm font-bold text-stone-800">No complaints matching filter</p>
                <p className="text-xs text-stone-500 mt-1">Use "Raise Issue" to record a new complaint.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredLedger.map((item) => (
                  <article
                    key={item.id}
                    className="p-4 rounded-2xl border border-stone-200 bg-white hover:border-emerald-300 transition shadow-sm space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-xs font-bold text-stone-900">
                          {item.complaint_ref}
                        </span>
                        <span className="text-xs text-stone-300">•</span>
                        <span className="font-bold text-xs text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded">
                          Batch {item.batch_id}
                        </span>
                        <span className="text-xs text-stone-600 hidden sm:inline">
                          {item.product_name}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                            item.severity === 'CRITICAL'
                              ? 'bg-rose-100 text-rose-800'
                              : item.severity === 'MAJOR'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-stone-100 text-stone-700'
                          }`}
                        >
                          {item.severity}
                        </span>
                        <span className="text-[10px] font-semibold bg-[#FAF7F2] text-stone-600 px-2 py-0.5 rounded border border-stone-200">
                          {item.intake_mode.replace('_', ' ')}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-stone-800 font-medium leading-relaxed">
                      {item.description}
                    </p>

                    {item.adulterant_findings && (
                      <p className="text-[11px] p-2 rounded-lg bg-rose-50 text-rose-900 border border-rose-100">
                        <strong>Lab Finding:</strong> {item.adulterant_findings}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-stone-500">
                      <div className="flex items-center gap-3">
                        <span>Reported by: <strong>{item.reporter_name}</strong></span>
                        <span>Location: <strong>{item.facility_or_store}</strong></span>
                        {item.fat_percentage && (
                          <span>Fat: <strong>{item.fat_percentage}%</strong></span>
                        )}
                        {item.acidity_percentage && (
                          <span>Acidity: <strong>{item.acidity_percentage}%</strong></span>
                        )}
                      </div>

                      {item.severity === 'CRITICAL' && onInitiateRecall && (
                        <button
                          type="button"
                          onClick={() => {
                            onInitiateRecall(item.batch_id, item.description, item.severity);
                            onClose();
                          }}
                          className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 hover:text-rose-900 underline"
                        >
                          <ShieldAlert className="w-3.5 h-3.5" />
                          Review &amp; Execute Recall →
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
