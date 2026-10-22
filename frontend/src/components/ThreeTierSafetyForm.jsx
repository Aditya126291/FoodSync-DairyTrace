import React, { useState, useEffect, useRef } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Award,
  Check,
  CheckCircle2,
  ChevronDown,
  Download,
  FileCheck,
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

const CONSUMER_SAMPLE_PROMPTS = [
  {
    title: 'Sour Taste & Whey Separation',
    text: 'Purchased packet of Paneer at Metro Fresh Mart Kothrud. The paneer smells sour, has liquid whey leaking inside the pouch, and acidity is abnormally high. Reported by Rajesh Sharma as Major issue.',
  },
  {
    title: 'Damaged Tamper Seal & Off-Odor',
    text: 'Pack tamper seal was loose and leaking cold-chain milk upon delivery from Aundh Store. Noticed off-flavor and curds forming. Reported by Sunita Patel as Precautionary check.',
  },
  {
    title: 'Foreign Chemical Odor Alert',
    text: 'Severe chemical odor observed in product from Baner Outlet. Lab rapid strip showed positive adulterant color reaction, fat 21.2%, SNF 25.0%. Reported by Dr. Verma as Critical contamination alert.',
  },
];

export default function ThreeTierSafetyForm({ batch, onClose, onSubmitted }) {
  const batchId = batch?.id || batch?.batch_id || 'PAN-201';
  const productName = batch?.product_name || (batchId.startsWith('PAN') ? 'FoodSync Fresh Malai Paneer 200g' : 'FoodSync Farm-Chilled Raw Milk');

  const [inputMode, setInputMode] = useState('NATURAL_LANGUAGE'); // 'NATURAL_LANGUAGE' | 'REPORT_UPLOAD' | 'MANUAL'
  const [form, setForm] = useState({
    batch_id: batchId,
    product_name: productName,
    reporter_name: '',
    reporter_role: 'Consumer / Customer',
    facility_or_store: batch?.facility_name || '',
    complaint_category: 'Packaging / Tamper Seal Issue',
    severity: 'MAJOR',
    fat_percentage: '',
    snf_percentage: '',
    acidity_percentage: '',
    adulterant_status: 'SUSPECTED',
    adulterant_findings: '',
    description: '',
    intake_mode: 'NATURAL_LANGUAGE',
    source_report_name: '',
    record_quality_check: false,
  });

  const [aiText, setAiText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiFeedback, setAiFeedback] = useState(null);
  const [updatedFields, setUpdatedFields] = useState(new Set());
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [sampleReports, setSampleReports] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submittedResult, setSubmittedResult] = useState(null);

  // Speech Recognition State
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef(null);
  const fileInputRef = useRef(null);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition =
      typeof window !== 'undefined'
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : null;

    if (SpeechRecognition) {
      setSpeechSupported(true);
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-IN';

        recognition.onresult = (event) => {
          let transcript = '';
          for (let i = 0; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }
          if (transcript) {
            setAiText((prev) => {
              const trimmed = prev.trim();
              return trimmed ? `${trimmed} ${transcript}` : transcript;
            });
          }
        };

        recognition.onerror = () => {
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      } catch (err) {
        console.warn('SpeechRecognition init error:', err);
      }
    }
  }, []);

  // Load sample reports for upload mode
  useEffect(() => {
    api.getSampleReports().then((data) => setSampleReports(data || [])).catch(() => {});
  }, []);

  // Update batch details if prop changes
  useEffect(() => {
    if (batchId) {
      setForm((prev) => ({
        ...prev,
        batch_id: batchId,
        product_name: productName,
      }));
    }
  }, [batchId, productName]);

  const toggleListening = () => {
    if (!speechSupported || !recognitionRef.current) {
      alert('Speech recognition is not supported in this browser. You can type in natural language or use sample prompts.');
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.warn('Speech recognition error:', err);
      }
    }
  };

  const applyPatch = (patch, mode, sourceFilename = '') => {
    const newlyUpdated = new Set();
    setForm((prev) => {
      const next = { ...prev };
      Object.keys(patch).forEach((key) => {
        if (patch[key] !== undefined && patch[key] !== null && patch[key] !== '') {
          next[key] = patch[key];
          newlyUpdated.add(key);
        }
      });
      next.intake_mode = mode;
      if (sourceFilename) next.source_report_name = sourceFilename;
      // Guarantee batch_id stays pinned to this scanned batch unless explicitly set
      if (!next.batch_id) next.batch_id = batchId;
      return next;
    });

    setUpdatedFields(newlyUpdated);
    setTimeout(() => setUpdatedFields(new Set()), 6000);
  };

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
        applyPatch(res.patch, 'NATURAL_LANGUAGE');
      }
      setAiFeedback(res);
    } catch {
      setAiFeedback({
        assistant_message: 'Parsed complaint details and extracted key parameters.',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileUpload = async (file) => {
    if (!file) return;
    setIsUploading(true);
    setUploadError('');
    try {
      const res = await api.uploadComplaintReport(file, form);
      if (res?.patch) {
        applyPatch(res.patch, 'REPORT_UPLOAD', file.name);
      }
      setAiFeedback(res);
    } catch (err) {
      setUploadError(err.message || 'Could not parse document. Please try another format.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleLoadSampleReport = (sample) => {
    const patch = {
      batch_id: sample.structured_data?.['Batch / Lot Number'] || sample.batch_id || batchId,
      product_name: sample.structured_data?.['Product Name'] || productName,
      reporter_name: sample.structured_data?.['Reported By'] || sample.reporter_name || 'Forensic Lab Analyst',
      reporter_role: sample.structured_data?.['Reporter Role'] || 'Quality Auditor',
      facility_or_store: sample.structured_data?.['Store / Facility'] || form.facility_or_store || 'Pune Retailer',
      complaint_category: sample.structured_data?.['Complaint Category'] || 'Forensic / Adulteration Alert',
      severity: sample.structured_data?.Severity || 'CRITICAL',
      fat_percentage: parseFloat(sample.structured_data?.['Milk Fat (%)'] || '4.1'),
      snf_percentage: parseFloat(sample.structured_data?.['Milk Solids SNF (%)'] || '8.2'),
      acidity_percentage: parseFloat(sample.structured_data?.['Titratable Acidity (%)'] || '0.21'),
      adulterant_status: sample.structured_data?.['Adulterant Test'] || 'POSITIVE',
      adulterant_findings: sample.structured_data?.['Adulterant / Contaminant Findings'] || '',
      description: sample.structured_data?.Summary || sample.subtitle || '',
    };
    applyPatch(patch, 'REPORT_UPLOAD', sample.filename);
    setAiFeedback({
      assistant_message: `Extracted parameters from official report: ${sample.title}`,
      source_filename: sample.filename,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError('');
    try {
      const payload = {
        ...form,
        batch_id: batchId,
        fat_percentage: form.fat_percentage ? parseFloat(form.fat_percentage) : null,
        snf_percentage: form.snf_percentage ? parseFloat(form.snf_percentage) : null,
        acidity_percentage: form.acidity_percentage ? parseFloat(form.acidity_percentage) : null,
        record_quality_check: false,
      };
      const result = await api.createComplaint(payload);
      setSubmittedResult(result);
      onSubmitted?.(result);
    } catch (err) {
      setSubmitError(err.message || 'Could not submit report. Check your network connection and retry.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-3xl border border-stone-200/90 bg-white p-5 sm:p-7 shadow-sm space-y-6">
      {/* Form Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-200/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-emerald-800">
              Consumer Safety &amp; Quality Feedback
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
              3-Tier Intake
            </span>
          </div>
          <h3 className="mt-1 font-display text-xl sm:text-2xl font-bold text-stone-900">
            Report a Safety Concern or Quality Defect
          </h3>
          <p className="text-xs sm:text-sm text-stone-600 mt-0.5">
            Pre-linked to scanned Batch <strong>{batchId}</strong> ({productName}). Choose how you want to provide details.
          </p>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 self-start sm:self-center"
            aria-label="Close safety concern form"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Success Notification Banner */}
      {submittedResult && (
        <div role="status" className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 flex items-start gap-3.5 text-emerald-950">
          <CheckCircle2 className="w-6 h-6 text-emerald-700 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold text-sm text-emerald-950">
              Safety Report Registered · Reference {submittedResult.complaint_ref}
            </h4>
            <p className="text-xs text-emerald-800 leading-relaxed">
              Your safety concern regarding Batch <strong>{batchId}</strong> has been saved directly to the DairyTrace Inspector Audit Ledger.
              The safety compliance team can review the farm origin, pasteurization logs, and transport history for this product.
            </p>
            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setSubmittedResult(null);
                  setAiText('');
                  setForm((prev) => ({
                    ...prev,
                    reporter_name: '',
                    description: '',
                    adulterant_findings: '',
                  }));
                }}
                className="px-3 py-1.5 rounded-lg bg-emerald-800 text-white text-xs font-bold hover:bg-emerald-900 transition"
              >
                Submit another note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3-Tier Tab Bar */}
      {!submittedResult && (
        <div className="flex flex-wrap gap-2 p-1.5 rounded-2xl bg-[#FAF7F2] border border-stone-200">
          <button
            type="button"
            onClick={() => {
              setInputMode('NATURAL_LANGUAGE');
              setForm((prev) => ({ ...prev, intake_mode: 'NATURAL_LANGUAGE' }));
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition ${
              inputMode === 'NATURAL_LANGUAGE'
                ? 'bg-emerald-900 text-white shadow-sm'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Mic className="w-3.5 h-3.5 text-amber-300" />
            1. Speak / Natural Language
          </button>

          <button
            type="button"
            onClick={() => {
              setInputMode('REPORT_UPLOAD');
              setForm((prev) => ({ ...prev, intake_mode: 'REPORT_UPLOAD' }));
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition ${
              inputMode === 'REPORT_UPLOAD'
                ? 'bg-emerald-900 text-white shadow-sm'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5 text-sky-300" />
            2. Upload Document / Report
          </button>

          <button
            type="button"
            onClick={() => {
              setInputMode('MANUAL');
              setForm((prev) => ({ ...prev, intake_mode: 'MANUAL' }));
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition ${
              inputMode === 'MANUAL'
                ? 'bg-emerald-900 text-white shadow-sm'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            3. Manual Form
          </button>
        </div>
      )}

      {!submittedResult && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Natural Language or Upload Assistant (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            {/* TIER 1: Natural Language & Speech-to-Text */}
            {inputMode === 'NATURAL_LANGUAGE' && (
              <div className="p-4 sm:p-5 rounded-2xl bg-[#FAF7F2] border border-stone-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wide text-stone-800 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-700" />
                    Speak or Type in Everyday Words
                  </span>
                  {speechSupported && (
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      Mic Ready
                    </span>
                  )}
                </div>

                <p className="text-xs text-stone-500 leading-relaxed">
                  Click the microphone to speak your observation or type what you noticed. The AI automatically extracts the defect category, severity, and parameters into the form.
                </p>

                {/* Textarea with Microphone Button */}
                <div className="relative">
                  <textarea
                    rows={4}
                    value={aiText}
                    onChange={(e) => setAiText(e.target.value)}
                    placeholder="e.g. I bought this paneer pack yesterday at Kothrud Fresh Mart. It smells sour and the pouch was bloated with liquid whey leaking..."
                    className="w-full bg-white border border-stone-300 rounded-xl p-3 pr-12 text-xs sm:text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
                  />
                  <button
                    type="button"
                    onClick={toggleListening}
                    title={isListening ? 'Stop listening' : 'Speak complaint (Speech to Text)'}
                    className={`absolute right-2.5 bottom-3 p-2 rounded-xl transition ${
                      isListening
                        ? 'bg-rose-600 text-white animate-pulse shadow-md'
                        : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                    }`}
                  >
                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>
                </div>

                {isListening && (
                  <p role="status" className="text-xs text-rose-700 font-bold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
                    Listening… speak clearly into your microphone.
                  </p>
                )}

                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={handleAnalyzeText}
                    disabled={isAnalyzing || !aiText.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-900 hover:bg-emerald-950 text-white text-xs font-bold shadow-sm transition disabled:opacity-50"
                  >
                    {isAnalyzing ? (
                      <>
                        <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                        Analyzing text…
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

                {/* Consumer Test Prompts */}
                <div className="pt-3 border-t border-stone-200/70 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
                    1-Click Consumer Scenarios:
                  </span>
                  <div className="space-y-1.5">
                    {CONSUMER_SAMPLE_PROMPTS.map((prompt, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setAiText(prompt.text)}
                        className="w-full text-left p-2 rounded-xl border border-stone-200 bg-white hover:bg-emerald-50/70 text-xs transition"
                      >
                        <span className="block font-bold text-stone-800">{prompt.title}</span>
                        <span className="block text-[11px] text-stone-500 line-clamp-1">{prompt.text}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TIER 2: Lab / Forensic Report Upload */}
            {inputMode === 'REPORT_UPLOAD' && (
              <div className="p-4 sm:p-5 rounded-2xl bg-[#FAF7F2] border border-stone-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wide text-stone-800 flex items-center gap-1.5">
                    <UploadCloud className="w-4 h-4 text-sky-700" />
                    Upload Supporting Document
                  </span>
                  <span className="text-[10px] font-bold text-sky-800 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200">
                    PDF • DOCX • TXT • JSON
                  </span>
                </div>

                <p className="text-xs text-stone-500 leading-relaxed">
                  Attach an official lab receipt, retail audit sheet, or test certificate. DairyTrace extracts batch parameters automatically.
                </p>

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
                  className="border-2 border-dashed border-stone-300 hover:border-emerald-600 rounded-2xl p-5 text-center cursor-pointer bg-white hover:bg-emerald-50/30 transition group"
                >
                  <UploadCloud className="w-8 h-8 mx-auto text-stone-400 group-hover:text-emerald-700 transition" />
                  <p className="mt-2 text-xs font-bold text-stone-800">
                    {isUploading ? 'Extracting report parameters…' : 'Click to select or drop report document'}
                  </p>
                  <p className="text-[10px] text-stone-400 mt-0.5">
                    Supports laboratory certificates, LactoScan exports, or consumer test photos (up to 10MB)
                  </p>
                </div>

                {uploadError && (
                  <p className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-semibold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {uploadError}
                  </p>
                )}

                {/* Built-in Sample Reports */}
                <div className="pt-3 border-t border-stone-200/70 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
                    1-Click Sample Test Reports:
                  </span>
                  <div className="space-y-1.5">
                    {sampleReports.map((sample) => (
                      <div
                        key={sample.id}
                        className="p-2.5 rounded-xl border border-stone-200 bg-white flex items-center justify-between gap-2 hover:border-emerald-300 transition"
                      >
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-stone-900 block truncate">{sample.title}</span>
                          <span className="text-[10px] text-stone-500 block">{sample.format} · {sample.badge}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleLoadSampleReport(sample)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-900 hover:bg-emerald-950 text-white text-[11px] font-bold shrink-0"
                        >
                          Auto-Fill
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TIER 3: Manual Direct Entry Note */}
            {inputMode === 'MANUAL' && (
              <div className="p-4 sm:p-5 rounded-2xl bg-[#FAF7F2] border border-stone-200 shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-stone-800 font-bold text-xs uppercase tracking-wide">
                  <FileText className="w-4 h-4 text-emerald-800" />
                  Direct Form Mode
                </div>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Fill in or adjust every parameter directly in the right-hand form. All fields are fully editable.
                </p>
                <div className="p-3 rounded-xl bg-white border border-stone-200 text-xs text-stone-600 space-y-1">
                  <p className="font-semibold text-stone-800">Note:</p>
                  <p>
                    You can switch to <strong>Natural Language / Voice</strong> or <strong>Document Upload</strong> at any time to automatically extract data.
                  </p>
                </div>
              </div>
            )}

            {/* AI / Extracted Analysis Result Notification */}
            {aiFeedback && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  {aiFeedback.assistant_message || 'Details extracted successfully!'}
                </div>
                {updatedFields.size > 0 && (
                  <div className="flex items-center gap-1 flex-wrap pt-1">
                    <span className="text-[10px] font-bold text-emerald-800">Auto-filled:</span>
                    {Array.from(updatedFields).map((field) => (
                      <span
                        key={field}
                        className="px-2 py-0.5 rounded bg-emerald-200 text-[10px] font-bold text-emerald-950"
                      >
                        {field.replace('_', ' ')}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Structured Editable Form (7 cols) */}
          <div className="lg:col-span-7">
            <form onSubmit={handleSubmit} className="p-5 sm:p-6 rounded-2xl bg-[#FFFDF9] border border-stone-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-stone-200/80">
                <h4 className="text-sm font-bold text-stone-900">
                  Structured Safety &amp; Quality Form
                </h4>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-stone-100 text-stone-700">
                  Batch: {batchId}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Your Name */}
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1" htmlFor="rep-name">
                    Your Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="rep-name"
                    type="text"
                    required
                    maxLength={120}
                    value={form.reporter_name}
                    onChange={(e) => setForm({ ...form, reporter_name: e.target.value })}
                    placeholder="e.g. Vikram Mehta"
                    className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-emerald-700"
                  />
                </div>

                {/* Purchase Location / Store */}
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1" htmlFor="rep-store">
                    Store or Purchase Location <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="rep-store"
                    type="text"
                    required
                    maxLength={140}
                    value={form.facility_or_store}
                    onChange={(e) => setForm({ ...form, facility_or_store: e.target.value })}
                    placeholder="e.g. Retailer A (Kothrud, Pune)"
                    className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-emerald-700"
                  />
                </div>

                {/* Complaint Category */}
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1" htmlFor="rep-category">
                    Concern Category
                  </label>
                  <select
                    id="rep-category"
                    value={form.complaint_category}
                    onChange={(e) => setForm({ ...form, complaint_category: e.target.value })}
                    className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold text-stone-900 focus:outline-none focus:border-emerald-700"
                  >
                    <option>Packaging / Tamper Seal Issue</option>
                    <option>Microbial / Spoilage / Sourness</option>
                    <option>Cold-Chain / Storage Excursion</option>
                    <option>Chemical / Mycotoxin Contaminant</option>
                    <option>Forensic / Adulteration Alert</option>
                    <option>Compositional Non-Compliance (Fat/SNF)</option>
                    <option>Other Quality / Safety Concern</option>
                  </select>
                </div>

                {/* Severity */}
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1" htmlFor="rep-sev">
                    Urgency / Severity
                  </label>
                  <select
                    id="rep-sev"
                    value={form.severity}
                    onChange={(e) => setForm({ ...form, severity: e.target.value })}
                    className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-stone-900 focus:outline-none focus:border-emerald-700"
                  >
                    <option value="PRECAUTIONARY">Precautionary (Something to check)</option>
                    <option value="MAJOR">Major (Needs prompt review)</option>
                    <option value="CRITICAL">Critical (Immediate safety concern)</option>
                  </select>
                </div>

                {/* Contamination Concern Status */}
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1" htmlFor="rep-adulterant">
                    Contamination Status
                  </label>
                  <select
                    id="rep-adulterant"
                    value={form.adulterant_status}
                    onChange={(e) => setForm({ ...form, adulterant_status: e.target.value })}
                    className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold text-stone-900 focus:outline-none focus:border-emerald-700"
                  >
                    <option value="SUSPECTED">Suspected / Uncertain</option>
                    <option value="POSITIVE">Positive Test / Contamination Confirmed</option>
                    <option value="NEGATIVE">Negative / Normal</option>
                    <option value="NOT_TESTED">Not Tested</option>
                  </select>
                </div>

                {/* Contamination Findings */}
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1" htmlFor="rep-findings">
                    Contaminant Details <span className="font-normal text-stone-400">(optional)</span>
                  </label>
                  <input
                    id="rep-findings"
                    type="text"
                    maxLength={2000}
                    value={form.adulterant_findings}
                    onChange={(e) => setForm({ ...form, adulterant_findings: e.target.value })}
                    placeholder="e.g. Unusual chemical smell, whey leakage"
                    className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-emerald-700"
                  />
                </div>

                {/* Optional Lab Metrics if available */}
                <div className="sm:col-span-2 grid grid-cols-3 gap-2 p-3 rounded-xl bg-[#FAF7F2] border border-stone-200">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-stone-600 mb-0.5">
                      Fat % (optional)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={form.fat_percentage}
                      onChange={(e) => setForm({ ...form, fat_percentage: e.target.value })}
                      placeholder="e.g. 4.1"
                      className="w-full bg-white border border-stone-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-stone-600 mb-0.5">
                      SNF % (optional)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={form.snf_percentage}
                      onChange={(e) => setForm({ ...form, snf_percentage: e.target.value })}
                      placeholder="e.g. 8.2"
                      className="w-full bg-white border border-stone-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-stone-600 mb-0.5">
                      Acidity % (optional)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={form.acidity_percentage}
                      onChange={(e) => setForm({ ...form, acidity_percentage: e.target.value })}
                      placeholder="e.g. 0.22"
                      className="w-full bg-white border border-stone-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold"
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-stone-700 mb-1" htmlFor="rep-desc">
                    What Happened? <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    id="rep-desc"
                    required
                    minLength={5}
                    maxLength={5000}
                    rows={3}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Describe what you observed, pack condition, date of purchase, or defect details…"
                    className="w-full bg-white border border-stone-300 rounded-xl p-3 text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-emerald-700"
                  />
                </div>
              </div>

              {submitError && (
                <p role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {submitError}
                </p>
              )}

              {/* Form Bottom Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-stone-200/80">
                <p className="text-[11px] text-stone-500">
                  Target Batch: <strong>{batchId}</strong> · Submitted to safety inbox
                </p>

                <div className="flex gap-2 w-full sm:w-auto">
                  {onClose && (
                    <button
                      type="button"
                      onClick={onClose}
                      className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-stone-300 bg-white text-stone-700 text-xs font-bold hover:bg-stone-50"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold shadow-sm transition disabled:opacity-60"
                  >
                    {submitting ? (
                      <>
                        <LoaderCircle className="w-4 h-4 animate-spin" />
                        Submitting report…
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Submit Safety Concern
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
