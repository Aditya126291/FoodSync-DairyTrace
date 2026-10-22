/**
 * DairyTrace API Client & Mock State Engine
 * Connects to FastAPI backend at http://localhost:8000/api
 * Includes automatic in-memory / localStorage fallback for 100% reliable hackathon offline demos.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

// Initial Seed Data for the official Tech4Food 2026 Pitch Scenario
const INITIAL_PITCH_DATA = {
  batches: [
    {
      id: 'MILK-101',
      product_type: 'MILK',
      initial_quantity: 1000,
      remaining_quantity: 0,
      facility_name: 'Shirur Collection Centre',
      status: 'ACTIVE',
      trust_level: 'VERIFIED',
      production_date: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
      expiry_date: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      created_at: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
    },
    {
      id: 'MILK-102',
      product_type: 'MILK',
      initial_quantity: 800,
      remaining_quantity: 400,
      facility_name: 'Junnar Collection Centre',
      status: 'ACTIVE',
      trust_level: 'DOCUMENT_CHECKED',
      production_date: new Date(Date.now() - 44 * 3600 * 1000).toISOString(),
      expiry_date: new Date(Date.now() + 28 * 3600 * 1000).toISOString(),
      created_at: new Date(Date.now() - 44 * 3600 * 1000).toISOString(),
    },
    {
      id: 'MILK-103',
      product_type: 'MILK',
      initial_quantity: 500,
      remaining_quantity: 0,
      facility_name: 'Baramati Chilling Centre',
      status: 'ACTIVE',
      trust_level: 'VERIFIED',
      production_date: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
      expiry_date: new Date(Date.now() + 36 * 3600 * 1000).toISOString(),
      created_at: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
    },
    {
      id: 'PAN-201',
      product_type: 'PANEER',
      initial_quantity: 120,
      remaining_quantity: 0,
      facility_name: 'FoodSync Central Dairy Plant, Pune',
      status: 'ACTIVE',
      trust_level: 'VERIFIED',
      production_date: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
      expiry_date: new Date(Date.now() + 120 * 3600 * 1000).toISOString(),
      created_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    },
    {
      id: 'PAN-202',
      product_type: 'PANEER',
      initial_quantity: 90,
      remaining_quantity: 0,
      facility_name: 'FoodSync Central Dairy Plant, Pune',
      status: 'ACTIVE',
      trust_level: 'DOCUMENT_CHECKED',
      production_date: new Date(Date.now() - 20 * 3600 * 1000).toISOString(),
      expiry_date: new Date(Date.now() + 124 * 3600 * 1000).toISOString(),
      created_at: new Date(Date.now() - 20 * 3600 * 1000).toISOString(),
    },
    {
      id: 'PAN-303',
      product_type: 'PANEER',
      initial_quantity: 150,
      remaining_quantity: 150,
      facility_name: 'FoodSync Central Dairy Plant, Pune',
      status: 'ACTIVE',
      trust_level: 'VERIFIED',
      production_date: new Date(Date.now() - 16 * 3600 * 1000).toISOString(),
      expiry_date: new Date(Date.now() + 128 * 3600 * 1000).toISOString(),
      created_at: new Date(Date.now() - 16 * 3600 * 1000).toISOString(),
    },
  ],
  links: [
    { id: 1, parent_batch_id: 'MILK-101', child_batch_id: 'PAN-201', quantity_used: 600, unit: 'L', linked_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString() },
    { id: 2, parent_batch_id: 'MILK-102', child_batch_id: 'PAN-201', quantity_used: 400, unit: 'L', linked_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString() },
    { id: 3, parent_batch_id: 'MILK-101', child_batch_id: 'PAN-202', quantity_used: 400, unit: 'L', linked_at: new Date(Date.now() - 20 * 3600 * 1000).toISOString() },
    { id: 4, parent_batch_id: 'MILK-103', child_batch_id: 'PAN-303', quantity_used: 500, unit: 'L', linked_at: new Date(Date.now() - 16 * 3600 * 1000).toISOString() },
  ],
  distributions: [
    { id: 1, batch_id: 'PAN-201', destination_name: 'Retailer A (Kothrud)', destination_type: 'RETAILER', location: 'Kothrud, Pune, MH', quantity_dispatched: 60, contact_phone: '+91-9822011101', dispatched_at: new Date(Date.now() - 18 * 3600 * 1000).toISOString() },
    { id: 2, batch_id: 'PAN-201', destination_name: 'Retailer B (Wakad)', destination_type: 'RETAILER', location: 'Wakad, Pune, MH', quantity_dispatched: 60, contact_phone: '+91-9822011102', dispatched_at: new Date(Date.now() - 18 * 3600 * 1000).toISOString() },
    { id: 3, batch_id: 'PAN-202', destination_name: 'Retailer C (Hinjawadi)', destination_type: 'RETAILER', location: 'Hinjawadi, Pune, MH', quantity_dispatched: 90, contact_phone: '+91-9822011103', dispatched_at: new Date(Date.now() - 15 * 3600 * 1000).toISOString() },
  ],
  quality_records: [
    {
      id: 1,
      batch_id: 'MILK-101',
      test_date: new Date(Date.now() - 47 * 3600 * 1000).toISOString(),
      lab_name: 'Pune Regional Dairy Quality Lab (NABL Accredited)',
      fat_percentage: 4.6,
      snf_percentage: 8.7,
      acidity: 0.14,
      adulterant_test: 'NEGATIVE',
      contaminant_details: 'Standard milk purity & freshness parameters verified prior to vat pooling.',
      trust_level: 'VERIFIED',
      certificate_url: 'https://certs.dairytrace.in/2026/NABL-M101-VERIFIED.pdf',
    },
    {
      id: 2,
      batch_id: 'MILK-102',
      test_date: new Date(Date.now() - 43 * 3600 * 1000).toISOString(),
      lab_name: 'Junnar Co-op Quality Testing Lab',
      fat_percentage: 4.4,
      snf_percentage: 8.5,
      acidity: 0.13,
      adulterant_test: 'NEGATIVE',
      contaminant_details: 'No adulterants detected; lab report attached.',
      trust_level: 'DOCUMENT_CHECKED',
      certificate_url: 'https://certs.dairytrace.in/2026/JUNNAR-M102-DOC.pdf',
    },
    {
      id: 3,
      batch_id: 'MILK-103',
      test_date: new Date(Date.now() - 35 * 3600 * 1000).toISOString(),
      lab_name: 'Pune Regional Dairy Quality Lab (NABL Accredited)',
      fat_percentage: 4.7,
      snf_percentage: 8.8,
      acidity: 0.13,
      adulterant_test: 'NEGATIVE',
      contaminant_details: '100% compliant across Fat, SNF, and antibiotic residue checks.',
      trust_level: 'VERIFIED',
      certificate_url: 'https://certs.dairytrace.in/2026/NABL-M103-VERIFIED.pdf',
    },
    {
      id: 4,
      batch_id: 'PAN-201',
      test_date: new Date(Date.now() - 22 * 3600 * 1000).toISOString(),
      lab_name: 'FoodSync Central QA Lab, Pune',
      fat_percentage: 24.5,
      snf_percentage: 28.0,
      acidity: 0.18,
      adulterant_test: 'NEGATIVE',
      contaminant_details: 'Moisture 52.4% (within FSSAI max 60% limit for fresh paneer).',
      trust_level: 'VERIFIED',
      certificate_url: 'https://certs.dairytrace.in/2026/QA-PAN201.pdf',
    },
    {
      id: 5,
      batch_id: 'PAN-202',
      test_date: new Date(Date.now() - 19 * 3600 * 1000).toISOString(),
      lab_name: 'FoodSync Central QA Lab, Pune',
      fat_percentage: 24.2,
      snf_percentage: 27.8,
      acidity: 0.19,
      adulterant_test: 'NEGATIVE',
      contaminant_details: 'Batch release quality check passed.',
      trust_level: 'DOCUMENT_CHECKED',
      certificate_url: 'https://certs.dairytrace.in/2026/QA-PAN202.pdf',
    },
    {
      id: 6,
      batch_id: 'PAN-303',
      test_date: new Date(Date.now() - 15 * 3600 * 1000).toISOString(),
      lab_name: 'Pune Regional Dairy Quality Lab (NABL Accredited)',
      fat_percentage: 25.0,
      snf_percentage: 28.5,
      acidity: 0.17,
      adulterant_test: 'NEGATIVE',
      contaminant_details: 'Fresh control batch; lab chemist signed off.',
      trust_level: 'VERIFIED',
      certificate_url: 'https://certs.dairytrace.in/2026/NABL-PAN303.pdf',
    },
  ],
  recalls: [],
  complaints: [
    {
      id: 1,
      complaint_ref: 'CMP-2026-0001',
      batch_id: 'MILK-101',
      product_name: 'FoodSync Farm-Chilled Raw Milk',
      reporter_name: 'Dr. Ananya Deshmukh',
      reporter_role: 'NABL Forensic Chemist',
      facility_or_store: 'Shirur Collection Centre',
      complaint_category: 'Chemical / Mycotoxin Contaminant',
      severity: 'CRITICAL',
      status: 'OPEN',
      fat_percentage: 4.1,
      snf_percentage: 8.2,
      acidity_percentage: 0.21,
      adulterant_status: 'POSITIVE',
      adulterant_findings:
        'Elevated Aflatoxin M1 residue detected at 0.78 ug/kg via HPLC-FLD (exceeds FSSAI maximum permissible limit of 0.50 ug/kg).',
      description:
        'Forensic laboratory confirmation on retained raw milk sample MILK-101 from Shirur Collection Centre detected Aflatoxin M1 at 0.78 ug/kg alongside elevated acidity (0.21%). Recommend immediate blast-radius simulation for downstream paneer batches PAN-201 and PAN-202.',
      intake_mode: 'REPORT_UPLOAD',
      source_report_name: 'NABL_Forensic_Report_MILK-101_Aflatoxin.pdf',
      ai_summary: '[CRITICAL] Chemical / Mycotoxin Contaminant on MILK-101 (Fat 4.1%, SNF 8.2%, Acidity 0.21%) — Adulterant: POSITIVE.',
      created_at: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
      safety_alert_recommended: true,
      batch_exists: true,
    },
    {
      id: 2,
      complaint_ref: 'CMP-2026-0002',
      batch_id: 'PAN-201',
      product_name: 'FoodSync Fresh Malai Paneer 200g',
      reporter_name: 'Rajesh Kulkarni',
      reporter_role: 'Retail Store Partner',
      facility_or_store: 'Retailer A (Kothrud)',
      complaint_category: 'Microbial / Spoilage / Sourness',
      severity: 'MAJOR',
      status: 'OPEN',
      fat_percentage: 21.2,
      snf_percentage: 25.8,
      acidity_percentage: 0.26,
      adulterant_status: 'SUSPECTED',
      adulterant_findings: 'High titratable acidity (0.26%) and sour whey separation noted in retail cold counter.',
      description:
        'Customer and store quality supervisor at Retailer A (Kothrud) reported sour smell and excess whey moisture in 6 packs of Batch PAN-201 during morning shelf check.',
      intake_mode: 'NATURAL_LANGUAGE',
      source_report_name: null,
      ai_summary: '[MAJOR] Microbial / Spoilage / Sourness on PAN-201 (Fat 21.2%, SNF 25.8%, Acidity 0.26%) — Adulterant: SUSPECTED.',
      created_at: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
      safety_alert_recommended: true,
      batch_exists: true,
    },
  ],
};

const OFFLINE_SAMPLE_REPORTS = [
  {
    id: 'pdf-aflatoxin-milk101',
    filename: 'NABL_Forensic_Report_MILK-101_Aflatoxin.pdf',
    format: 'PDF',
    mime_type: 'application/pdf',
    title: 'NABL Forensic Lab Report — MILK-101 (Aflatoxin M1 Alert)',
    subtitle: 'Official NABL accredited mycotoxin & compositional lab certificate (.pdf)',
    badge: 'Critical Safety Hazard',
    download_url: `${API_BASE_URL}/complaints/sample-reports/pdf-aflatoxin-milk101/download`,
    preview_patch: {
      batch_id: 'MILK-101',
      product_name: 'FoodSync Farm-Chilled Raw Milk',
      reporter_name: 'Dr. Ananya Deshmukh',
      reporter_role: 'NABL Forensic Chemist',
      facility_or_store: 'Shirur Collection Centre',
      complaint_category: 'Chemical / Mycotoxin Contaminant',
      severity: 'CRITICAL',
      fat_percentage: 4.1,
      snf_percentage: 8.2,
      acidity_percentage: 0.21,
      adulterant_status: 'POSITIVE',
      adulterant_findings:
        'Elevated Aflatoxin M1 residue detected at 0.78 ug/kg via HPLC-FLD (exceeds FSSAI maximum permissible limit of 0.50 ug/kg). Trace sodium bicarbonate neutralizer present.',
      description:
        'Forensic laboratory analysis of raw milk batch MILK-101 collected from Shirur Collection Centre confirmed elevated Aflatoxin M1 (0.78 ug/kg vs 0.50 ug/kg FSSAI limit), sub-standard milk fat (4.1%), and elevated titratable acidity (0.21%). Immediate Class I recall of downstream paneer batches PAN-201 and PAN-202 is recommended.',
    },
  },
  {
    id: 'docx-urea-pan201',
    filename: 'Retailer_Quality_Check_PAN-201_Urea_Report.docx',
    format: 'DOCX',
    mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    title: 'Retail Partner Quality Dossier — PAN-201 (Urea & Sourness)',
    subtitle: 'Retailer A (Kothrud) incoming quality & chemical spot-check dossier (.docx)',
    badge: 'Adulteration Positive',
    download_url: `${API_BASE_URL}/complaints/sample-reports/docx-urea-pan201/download`,
    preview_patch: {
      batch_id: 'PAN-201',
      product_name: 'FoodSync Fresh Malai Paneer 200g',
      reporter_name: 'Rajesh Kulkarni',
      reporter_role: 'Retail Store Quality Manager',
      facility_or_store: 'Retailer A (Kothrud)',
      complaint_category: 'Forensic / Adulteration Alert',
      severity: 'CRITICAL',
      fat_percentage: 19.8,
      snf_percentage: 24.5,
      acidity_percentage: 0.29,
      adulterant_status: 'POSITIVE',
      adulterant_findings:
        'Positive DMAB spot check for synthetic urea (0.38%) and high lactic acidity (0.29%) with sour odor.',
      description:
        'Incoming retail cold-store inspection at Retailer A (Kothrud) on Batch PAN-201 revealed sharp sour odor, whey weeping in 14 packs, reduced fat content (19.8%), high acidity (0.29%), and positive DMAB colorimetric reaction for synthetic urea adulteration. Stock segregated in quarantine freezer pending recall.',
    },
  },
  {
    id: 'txt-coldchain-pan202',
    filename: 'ColdChain_Field_Audit_PAN-202.txt',
    format: 'TXT',
    mime_type: 'text/plain',
    title: 'Cold-Chain & Spoilage Inspection — PAN-202',
    subtitle: 'Field inspector plain-text audit log from Hinjawadi retail hub (.txt)',
    badge: 'Major Quality Issue',
    download_url: `${API_BASE_URL}/complaints/sample-reports/txt-coldchain-pan202/download`,
    preview_patch: {
      batch_id: 'PAN-202',
      product_name: 'FoodSync Fresh Malai Paneer 200g',
      reporter_name: 'Vikram Patil',
      reporter_role: 'Cold-Chain QA Inspector',
      facility_or_store: 'Retailer C (Hinjawadi)',
      complaint_category: 'Cold-Chain / Storage Excursion',
      severity: 'MAJOR',
      fat_percentage: 23.4,
      snf_percentage: 27.1,
      acidity_percentage: 0.25,
      adulterant_status: 'SUSPECTED',
      adulterant_findings:
        'Cold-chain temperature excursion (11.4 C for 5 hours); sour curds and elevated acidity (0.25%).',
      description:
        'Field audit at Retailer C (Hinjawadi) logged a reefer van temperature excursion to 11.4 C during delivery of Batch PAN-202. Lab re-check recorded Fat 23.4%, SNF 27.1%, and elevated Acidity 0.25% with mild package bloating.',
    },
  },
  {
    id: 'json-analyzer-milk102',
    filename: 'Automated_LactoScan_Export_MILK-102.json',
    format: 'JSON',
    mime_type: 'application/json',
    title: 'Automated LactoScan Telemetry — MILK-102',
    subtitle: 'Structured JSON laboratory analyzer export for co-input batch (.json)',
    badge: 'Precautionary Hold',
    download_url: `${API_BASE_URL}/complaints/sample-reports/json-analyzer-milk102/download`,
    preview_patch: {
      batch_id: 'MILK-102',
      product_name: 'FoodSync Farm-Chilled Raw Milk',
      reporter_name: 'Priya Nair',
      reporter_role: 'Co-op Lab Analyst',
      facility_or_store: 'Junnar Collection Centre',
      complaint_category: 'Compositional Non-Compliance (Fat/SNF)',
      severity: 'PRECAUTIONARY',
      fat_percentage: 4.3,
      snf_percentage: 8.4,
      acidity_percentage: 0.17,
      adulterant_status: 'SUSPECTED',
      adulterant_findings:
        'Borderline beta-lactam antibiotic screen (3.8 ppb) and shared vat co-mingling with MILK-101.',
      description:
        'Automated ultrasonic milk analyzer export for Batch MILK-102 at Junnar Collection Centre. Fat 4.3%, SNF 8.4%, Acidity 0.17%. Precautionary hold requested because 400L was blended into Vat #1 with MILK-101 and rapid beta-lactam strip showed borderline trace reading.',
    },
  },
];

export function parseComplaintTextOffline(message = '', currentForm = {}, sourceFilename = null) {
  const text = String(message || '').trim();
  const lower = text.toLowerCase();
  const patch = {};

  // Match if filename matches one of our sample reports
  if (sourceFilename) {
    const matchedSample = OFFLINE_SAMPLE_REPORTS.find(
      (s) => s.filename.toLowerCase() === String(sourceFilename).toLowerCase()
    );
    if (matchedSample) {
      Object.assign(patch, matchedSample.preview_patch);
    }
  }

  const batchMatch = text.match(/\b(MILK|PAN|PANEER)[\s_-]?(\d{2,5}[A-Z0-9-]*)\b/i);
  if (batchMatch) {
    const prefix = batchMatch[1].toUpperCase().startsWith('PAN') ? 'PAN' : 'MILK';
    patch.batch_id = `${prefix}-${batchMatch[2].toUpperCase()}`;
  }

  const fatMatch = text.match(/(?:milk\s*fat|fat(?:\s*content|\s*percentage|\s*\(%?\))?)\s*(?:[:=-]|is|of|at)?\s*(\d{1,2}(?:\.\d{1,2})?)\s*%?/i);
  if (fatMatch) patch.fat_percentage = Number(fatMatch[1]);

  const snfMatch = text.match(/(?:solids[\s-]*not[\s-]*fat|milk\s*solids|snf(?:\s*percentage|\s*\(%?\))?)\s*(?:[:=-]|is|of|at)?\s*(\d{1,2}(?:\.\d{1,2})?)\s*%?/i);
  if (snfMatch) patch.snf_percentage = Number(snfMatch[1]);

  const acidMatch = text.match(/(?:titratable\s*acidity|lactic\s*acidity|acidity)\s*(?:[:=-]|is|of|at)?\s*(\d{1,2}(?:\.\d{1,2})?)\s*%?/i);
  if (acidMatch && Number(acidMatch[1]) <= 10) patch.acidity_percentage = Number(acidMatch[1]);

  const repLabel = text.match(/(?:reported\s*by|reporter(?:\s*name)?|customer(?:\s*name)?|tested\s*by|chemist|inspector)\s*[:=-]\s*([^\n\r|;]{2,60})/i);
  if (repLabel) {
    patch.reporter_name = repLabel[1].trim().replace(/[.,]+$/, '');
  } else {
    const convRep = text.match(/(?:i\s+am|i'm|my\s+name\s+is|this\s+is|reporter\s+(?:is|to))\s+((?:(?:Dr|Mr|Ms|Mrs)\.?\s+)?[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,2})/i);
    if (convRep) patch.reporter_name = convRep[1].trim();
  }

  if (lower.includes('shirur')) patch.facility_or_store = 'Shirur Collection Centre';
  else if (lower.includes('junnar')) patch.facility_or_store = 'Junnar Collection Centre';
  else if (lower.includes('baramati')) patch.facility_or_store = 'Baramati Chilling Centre';
  else if (lower.includes('kothrud') || lower.includes('retailer a')) patch.facility_or_store = 'Retailer A (Kothrud)';
  else if (lower.includes('wakad') || lower.includes('retailer b')) patch.facility_or_store = 'Retailer B (Wakad)';
  else if (lower.includes('hinjawadi') || lower.includes('retailer c')) patch.facility_or_store = 'Retailer C (Hinjawadi)';

  const activeBatch = patch.batch_id || currentForm.batch_id || '';
  if (activeBatch && !patch.product_name && !currentForm.product_name) {
    patch.product_name = activeBatch.startsWith('PAN')
      ? 'FoodSync Fresh Malai Paneer 200g'
      : 'FoodSync Farm-Chilled Raw Milk';
  }

  const hazards = [];
  if (lower.includes('aflatoxin')) hazards.push('Elevated Aflatoxin M1 residue detected above FSSAI limit');
  if (lower.includes('urea')) hazards.push('Synthetic urea adulteration positive');
  if (lower.includes('antibiotic') || lower.includes('beta-lactam')) hazards.push('Antibiotic residue trace detected');
  if (lower.includes('neutralizer') || lower.includes('bicarbonate')) hazards.push('Alkaline neutralizer detected');
  if (lower.includes('cold-chain') || lower.includes('cold chain') || lower.includes('temperature')) hazards.push('Cold-chain temperature excursion');
  if (lower.includes('sour') || lower.includes('curdled') || lower.includes('spoiled') || lower.includes('odor') || lower.includes('smell')) {
    hazards.push('Sourness / off-odor / spoilage observed');
  }
  if (hazards.length && !patch.adulterant_findings) {
    patch.adulterant_findings = hazards.join('; ');
  }

  if (lower.includes('aflatoxin') || lower.includes('urea') || lower.includes('positive') || lower.includes('adulterat')) {
    patch.adulterant_status = 'POSITIVE';
    patch.severity = 'CRITICAL';
    patch.complaint_category = lower.includes('aflatoxin')
      ? 'Chemical / Mycotoxin Contaminant'
      : 'Forensic / Adulteration Alert';
  } else if (lower.includes('sour') || lower.includes('spoiled') || lower.includes('cold-chain') || lower.includes('excursion')) {
    patch.adulterant_status = 'SUSPECTED';
    patch.severity = 'MAJOR';
    patch.complaint_category = lower.includes('cold')
      ? 'Cold-Chain / Storage Excursion'
      : 'Microbial / Spoilage / Sourness';
  }

  const sevOverride = text.match(/(?:severity|priority)\s*(?:[:=-]|to|is)\s*(CRITICAL|MAJOR|PRECAUTIONARY)/i);
  if (sevOverride) patch.severity = sevOverride[1].toUpperCase();

  if (text.length >= 12 && !patch.description && !/^(change|set|update)\s+/i.test(text)) {
    patch.description = text.slice(0, 800);
  }

  const merged_form = { ...currentForm, ...patch };
  const extracted_fields = Object.keys(patch);
  const reqKeys = [
    ['batch_id', 'Batch ID'],
    ['product_name', 'Product Name'],
    ['reporter_name', 'Reporter / Customer Name'],
    ['facility_or_store', 'Store / Facility'],
    ['severity', 'Severity Level'],
    ['description', 'Complaint Description'],
  ];
  const missing_fields = reqKeys.filter(([k]) => !merged_form[k]).map(([, label]) => label);
  const completeness_score = Math.round(((reqKeys.length - missing_fields.length) / reqKeys.length) * 100);
  const requires_recall_preview =
    merged_form.severity === 'CRITICAL' ||
    merged_form.severity === 'MAJOR' ||
    merged_form.adulterant_status === 'POSITIVE';

  return {
    patch,
    merged_form,
    extracted_fields,
    completeness: {
      is_complete: missing_fields.length === 0,
      completeness_score,
      missing_fields,
    },
    safety_evaluation: {
      requires_recall_preview,
      batch_id: merged_form.batch_id || 'MILK-101',
      recommended_severity: merged_form.severity || 'CRITICAL',
      recall_reason: merged_form.adulterant_findings || merged_form.description || 'Quality safety alert',
    },
    assistant_message: extracted_fields.length
      ? `Auto-filled ${extracted_fields.length} field(s) (${extracted_fields.join(', ').replaceAll('_', ' ')}).`
      : 'Please include a Batch ID (such as MILK-101 or PAN-201) or forensic test details.',
    extraction_engine: 'DairyTrace Smart Forensic Parser',
    source_filename: sourceFilename,
  };
}

// In-memory store fallback + browser localStorage persistence
let _memoryStore = JSON.parse(JSON.stringify(INITIAL_PITCH_DATA));

export function getLocalStore() {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem('dairytrace_state');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed.complaints)) {
          parsed.complaints = JSON.parse(JSON.stringify(INITIAL_PITCH_DATA.complaints));
        }
        return parsed;
      }
    } catch (e) {
      console.warn('LocalStorage read error:', e);
    }
  }
  return _memoryStore;
}

function saveLocalStore(data) {
  _memoryStore = data;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem('dairytrace_state', JSON.stringify(data));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
  }
}

// Reset store to initial pitch state
export function resetMockPitchData() {
  _memoryStore = JSON.parse(JSON.stringify(INITIAL_PITCH_DATA));
  saveLocalStore(_memoryStore);
  return _memoryStore;
}

// Normalizer for consumer passport data (bridges FastAPI backend and mock schemas)
function normalizePassportData(data, requestedBatchId) {
  if (!data) return null;
  const id = data.id || data.batch_id || requestedBatchId || 'PAN-201';
  const isRecalled = data.status === 'RECALLED';
  const isQuarantined = data.status === 'QUARANTINED';

  const q = data.quality_highlights || {};
  const fat = data.fat_percentage ?? q.fat_percentage ?? null;
  const snf = data.snf_percentage ?? q.snf_percentage ?? null;
  const acidity = data.acidity ?? q.acidity_percentage ?? null;
  const adulterant =
    data.adulterant_screen ??
    q.adulterant_screen ??
    (data.adulterant_test ? `${data.adulterant_test}` : 'NOT TESTED');
  const lab = data.lab_signoff ?? q.verified_by_lab ?? 'No lab record';
  const trustBadge = data.trust_badge ?? data.trust_tier ?? q.trust_level ?? 'VERIFIED';

  let purity = data.purity_score;
  if (purity === undefined) {
    purity = data.adulterant_status === 'NEGATIVE' && !isRecalled && !isQuarantined ? 99.4 : null;
  }

  let origins = [];
  if (Array.isArray(data.origins) && data.origins.length > 0) {
    origins = data.origins;
  } else if (Array.isArray(data.raw_milk_origin_breakdown) && data.raw_milk_origin_breakdown.length > 0) {
    origins = data.raw_milk_origin_breakdown.map((org) => ({
      source: org.origin_facility || org.source || 'Verified Dairy Cooperative',
      source_batch_code: org.source_batch_code || org.batch_id || '',
      contribution_liters: org.contribution_liters ?? (org.contribution_percentage ? `${org.contribution_percentage}% eq.` : '400 L'),
      percentage: Math.round(org.contribution_percentage ?? org.percentage ?? 100),
    }));
  } else {
    origins = [
      {
        source: data.facility_name || 'Verified Cooperative Hub',
        source_batch_code: id,
        contribution_liters: data.initial_quantity || 1000,
        percentage: 100,
      },
    ];
  }

  return {
    ...data,
    id,
    batch_id: id,
    product_name:
      data.product_name ||
      (data.product_type === 'PANEER'
        ? 'FoodSync Fresh Malai Paneer 200g'
        : 'FoodSync Farm-Chilled Cow Milk'),
    facility_name: data.facility_name || 'Pune Central Processing Plant',
    status: data.status || 'ACTIVE',
    production_date: data.production_date || data.manufacture_date || new Date().toISOString(),
    expiry_date: data.expiry_date || new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
    fssai_licence_number: data.fssai_licence_number || '11526038000412',
    fssai_compliance_status: data.fssai_compliance_status || (isRecalled ? 'SAFETY_RECALLED' : isQuarantined ? 'HOLD_UNDER_INSPECTION' : 'NOT_VERIFIED'),
    purity_score: purity,
    fat_percentage: fat,
    snf_percentage: snf,
    acidity_percentage: acidity,
    adulterant_screen: adulterant,
    origins,
    trust_badge: trustBadge,
    lab_signoff: lab,
    contaminant_warning: data.contaminant_warning || (isRecalled ? 'URGENT: This batch has been recalled by Food Safety Officer. Do not consume.' : null),
    passport_url: data.passport_url || `https://dairytrace.foodsync.live/passport/${id}`,
  };
}

// Generic fetch with timeout & fallback
async function request(endpoint, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2000);

  try {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers: {
        ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...(options.headers || {}),
      },
    });
    clearTimeout(timeoutId);
    if (!res.ok) {
      let detail = '';
      try {
        const payload = await res.clone().json();
        detail = typeof payload.detail === 'string' ? payload.detail : '';
      } catch { /* response may not contain JSON */ }
      const error = new Error(detail || `HTTP ${res.status}: ${res.statusText}`);
      error.status = res.status;
      throw error;
    }
    return await res.json();
  } catch (err) {
    clearTimeout(timeoutId);
    // Silent pass-through to trigger fallback
    throw err;
  }
}

export const api = {
  // Check if live backend is online
  async checkHealth() {
    try {
      const res = await fetch(`${API_BASE_URL}/health`, { method: 'GET' });
      if (res.ok) return true;
      const fallback = await fetch(`${API_BASE_URL}/batches`, { method: 'GET' });
      return fallback.ok;
    } catch {
      return false;
    }
  },

  // 1. Batches
  async getBatches(filters = {}) {
    try {
      let query = new URLSearchParams();
      if (filters.product_type) query.append('product_type', filters.product_type);
      if (filters.status) query.append('status', filters.status);
      const q = query.toString() ? `?${query.toString()}` : '';
      return await request(`/batches${q}`);
    } catch (e) {
      const store = getLocalStore();
      let list = [...store.batches];
      if (filters.product_type && filters.product_type !== 'ALL') {
        list = list.filter((b) => b.product_type === filters.product_type);
      }
      if (filters.status && filters.status !== 'ALL') {
        list = list.filter((b) => b.status === filters.status);
      }
      return list;
    }
  },

  async getBatch(batchId) {
    try {
      return await request(`/batches/${batchId}`);
    } catch (e) {
      if (e.status === 404) throw e;
      const store = getLocalStore();
      const batch = store.batches.find((b) => b.id === batchId);
      if (!batch) throw new Error('Batch not found');
      return batch;
    }
  },

  async lookupBatches(query) {
    try {
      return await request(`/batches/lookup?q=${encodeURIComponent(query)}`);
    } catch (e) {
      if (e.status) throw e;
      const store = getLocalStore();
      const term = String(query || '').trim().toLowerCase();
      return store.batches.filter((batch) =>
        [batch.id, batch.sku, batch.serial_number].some((value) => String(value || '').toLowerCase().includes(term))
      );
    }
  },

  async createBatch(batchData) {
    try {
      return await request('/batches', {
        method: 'POST',
        body: JSON.stringify(batchData),
      });
    } catch (e) {
      if (e.status) throw e;
      const store = getLocalStore();
      const genId = batchData.id || `${batchData.product_type === 'MILK' ? 'MILK' : 'PAN'}-${Math.floor(100 + Math.random() * 900)}`;
      const newBatch = {
        id: genId,
        product_type: batchData.product_type,
        initial_quantity: Number(batchData.initial_quantity),
        remaining_quantity: Number(batchData.initial_quantity),
        facility_name: batchData.facility_name,
        sku: batchData.sku || null,
        serial_number: batchData.serial_number || null,
        status: batchData.status || 'ACTIVE',
        trust_level: batchData.trust_level || 'DOCUMENT_CHECKED',
        production_date: batchData.production_date || new Date().toISOString(),
        expiry_date: batchData.expiry_date || new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
        created_at: new Date().toISOString(),
        passport_url: `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'}/passport/${genId}`,
        qr_code_url: `/api/batches/${genId}/qr`,
      };
      store.batches.unshift(newBatch);
      saveLocalStore(store);
      return newBatch;
    }
  },

  async initiateRandomBatch(productType) {
    try {
      const q = productType ? `?product_type=${encodeURIComponent(productType)}` : '';
      return await request(`/batches/random${q}`, {
        method: 'POST',
      });
    } catch (e) {
      if (e.status) throw e;
      const store = getLocalStore();
      const pType = productType || (Math.random() > 0.5 ? 'MILK' : 'PANEER');
      const randomId = `${pType === 'MILK' ? 'MILK' : 'PAN'}-${Math.floor(400 + Math.random() * 9500)}`;
      const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
      const newBatch = {
        id: randomId,
        product_type: pType,
        initial_quantity: pType === 'MILK' ? 800 : 90,
        remaining_quantity: pType === 'MILK' ? 800 : 90,
        facility_name: pType === 'MILK' ? 'Daund Village Collection Centre (Pune)' : 'FoodSync Central Dairy Plant, Pune',
        sku: `DT-${pType}-${Math.floor(10 + Math.random() * 89)}`,
        serial_number: `SN-${Math.floor(10000 + Math.random() * 89999)}`,
        status: 'ACTIVE',
        trust_level: 'VERIFIED',
        production_date: new Date().toISOString(),
        expiry_date: new Date(Date.now() + (pType === 'MILK' ? 48 : 336) * 3600 * 1000).toISOString(),
        created_at: new Date().toISOString(),
        passport_url: `${origin}/passport/${randomId}`,
        qr_code_url: `/api/batches/${randomId}/qr`,
      };
      store.batches.unshift(newBatch);
      saveLocalStore(store);
      return newBatch;
    }
  },

  async linkBatches(linkPayload) {
    // linkPayload: { parent_batch_id, child_batch_id, quantity_used, unit, parents: [...] }
    try {
      return await request('/batches/link', {
        method: 'POST',
        body: JSON.stringify(linkPayload),
      });
    } catch (e) {
      if (e.status) throw e;
      const store = getLocalStore();
      const itemsToLink = [];

      if (Array.isArray(linkPayload.parents) && linkPayload.parents.length > 0) {
        linkPayload.parents.forEach((p) => {
          itemsToLink.push({
            parent_batch_id: p.parent_batch_id,
            quantity_used: Number(p.quantity_used),
            unit: p.unit || 'L',
          });
        });
      } else if (linkPayload.parent_batch_id) {
        itemsToLink.push({
          parent_batch_id: linkPayload.parent_batch_id,
          quantity_used: Number(linkPayload.quantity_used),
          unit: linkPayload.unit || 'L',
        });
      }

      const createdLinks = [];
      for (const item of itemsToLink) {
        const link = {
          id: store.links.length + 1,
          parent_batch_id: item.parent_batch_id,
          child_batch_id: linkPayload.child_batch_id,
          quantity_used: item.quantity_used,
          unit: item.unit,
          linked_at: new Date().toISOString(),
        };
        store.links.push(link);
        createdLinks.push(link);

        // Deduct remaining quantity from parent batch
        const parent = store.batches.find((b) => b.id === item.parent_batch_id);
        if (parent) {
          parent.remaining_quantity = Math.max(0, parent.remaining_quantity - item.quantity_used);
        }
      }

      saveLocalStore(store);
      return {
        status: 'linked',
        child_batch_id: linkPayload.child_batch_id,
        links_created: createdLinks.length,
        links: createdLinks,
      };
    }
  },

  // 2. Lineage Traversal
  async getLineage(batchId = 'MILK-101') {
    try {
      const data = await request(`/batches/${batchId}/lineage`);
      return {
        ...data,
        allLinks: data.allLinks || data.edges || [],
        allDistributions: data.allDistributions || data.distributions || [],
        allBatches: data.allBatches || data.nodes || [],
      };
    } catch (e) {
      const store = getLocalStore();
      const current = store.batches.find((b) => b.id === batchId) || store.batches[0];
      if (!current) throw new Error('No batches found');

      const targetId = current.id;

      // Backward links (parents that fed into current)
      const parentLinks = store.links.filter((l) => l.child_batch_id === targetId);
      const parents = parentLinks.map((l) => ({
        link: l,
        batch: store.batches.find((b) => b.id === l.parent_batch_id),
        quality: store.quality_records.filter((q) => q.batch_id === l.parent_batch_id),
      }));

      // Forward links (children made from current)
      const childLinks = store.links.filter((l) => l.parent_batch_id === targetId);
      const children = childLinks.map((l) => ({
        link: l,
        batch: store.batches.find((b) => b.id === l.child_batch_id),
        destinations: store.distributions.filter((d) => d.batch_id === l.child_batch_id),
      }));

      // Direct distributions if this batch was distributed directly
      const directDistributions = store.distributions.filter((d) => d.batch_id === targetId);

      return {
        batch: current,
        parents,
        children,
        directDistributions,
        allBatches: store.batches,
        allLinks: store.links,
        allDistributions: store.distributions,
        edges: store.links,
        distributions: store.distributions,
      };
    }
  },

  async getDistributions(batchId) {
    try {
      const q = batchId ? `?batch_id=${encodeURIComponent(batchId)}` : '';
      return await request(`/distribution${q}`);
    } catch (e) {
      const store = getLocalStore();
      if (batchId) {
        return store.distributions.filter((d) => d.batch_id === batchId);
      }
      return store.distributions;
    }
  },

  // 3. Quality Records
  async getQualityRecords(batchId) {
    try {
      return await request(`/quality/${batchId}`);
    } catch (e) {
      const store = getLocalStore();
      return store.quality_records.filter((q) => q.batch_id === batchId);
    }
  },

  async addQualityRecord(recordData) {
    try {
      return await request('/quality', {
        method: 'POST',
        body: JSON.stringify(recordData),
      });
    } catch (e) {
      if (e.status) throw e;
      const store = getLocalStore();
      const newRecord = {
        id: store.quality_records.length + 1,
        batch_id: recordData.batch_id,
        test_date: recordData.test_date || new Date().toISOString(),
        lab_name: recordData.lab_name,
        fat_percentage: Number(recordData.fat_percentage),
        snf_percentage: Number(recordData.snf_percentage),
        acidity: Number(recordData.acidity),
        adulterant_test: recordData.adulterant_test || 'NEGATIVE',
        contaminant_details: recordData.contaminant_details || 'Standard verification passed.',
        trust_level: recordData.trust_level || 'DOCUMENT_CHECKED',
        certificate_url: recordData.certificate_url || null,
      };
      store.quality_records.unshift(newRecord);
      saveLocalStore(store);
      return newRecord;
    }
  },

  // 4. Smart Recall Engine (Simulation & Execution)
  async simulateRecall(payload) {
    // payload: { batch_id, reason }
    const targetId = payload.batch_id || payload.root_batch_id;
    try {
      const res = await request('/recall/simulate', {
        method: 'POST',
        body: JSON.stringify({ batch_id: targetId, reason: payload.reason }),
      });
      const destinations = res.compromised_retail_destinations || [];
      const totalRisk =
        res.total_retail_units_at_risk ??
        res.total_retail_units ??
        destinations.reduce((acc, d) => acc + (Number(d.quantity_dispatched) || 0), 0);

      return {
        ...res,
        root_batch: res.root_batch || targetId,
        affected_product_batches: res.affected_product_batches || [],
        co_input_batches_for_review: res.co_input_batches_for_review || [],
        compromised_retail_destinations: destinations,
        total_retail_units: totalRisk,
        total_retail_units_at_risk: totalRisk,
      };
    } catch (e) {
      if (e.status) throw e;
      const store = getLocalStore();
      const rootId = targetId || 'MILK-101';

      // Traversal logic strictly following Section 5 of specification
      const visitedBatches = new Set([rootId]);
      const queue = [rootId];
      const affectedProducts = [];
      const coInputBatches = new Set();

      while (queue.length > 0) {
        const currentId = queue.shift();

        // 1. Find child batches derived from currentId
        const childLinks = store.links.filter((l) => l.parent_batch_id === currentId);
        for (const link of childLinks) {
          const childId = link.child_batch_id;
          if (!visitedBatches.has(childId)) {
            visitedBatches.add(childId);
            affectedProducts.push(childId);
            queue.push(childId);
          }

          // 2. Find sibling inputs (co-inputs) blended into same child vat
          const siblingLinks = store.links.filter((l) => l.child_batch_id === childId);
          for (const sib of siblingLinks) {
            if (sib.parent_batch_id !== rootId && !visitedBatches.has(sib.parent_batch_id)) {
              coInputBatches.add(sib.parent_batch_id);
            }
          }
        }
      }

      // Prune any directly compromised batches or root from co-inputs
      affectedProducts.forEach((id) => coInputBatches.delete(id));
      coInputBatches.delete(rootId);

      // 3. Find retail destinations for compromised batches
      const allCompromisedIds = [rootId, ...affectedProducts];
      const destinations = store.distributions.filter((d) => allCompromisedIds.includes(d.batch_id));

      const affectedProductObjs = affectedProducts.map((id) => store.batches.find((b) => b.id === id)).filter(Boolean);
      const coInputObjs = Array.from(coInputBatches).map((id) => store.batches.find((b) => b.id === id)).filter(Boolean);
      const rootBatchObj = store.batches.find((b) => b.id === rootId);

      const totalRetailRisk = destinations.reduce((acc, d) => acc + (Number(d.quantity_dispatched) || 0), 0);

      return {
        root_batch: rootId,
        root_batch_details: rootBatchObj,
        reason: payload.reason || 'Safety alert detected',
        affected_product_batches: affectedProducts,
        affected_product_details: affectedProductObjs,
        co_input_batches_for_review: Array.from(coInputBatches),
        co_input_details: coInputObjs,
        compromised_retail_destinations: destinations,
        total_retail_units: totalRetailRisk,
        total_retail_units_at_risk: totalRetailRisk,
        simulation_timestamp: new Date().toISOString(),
      };
    }
  },

  async executeRecall(payload) {
    // payload: { batch_id, reason, severity, initiated_by }
    const targetId = payload.batch_id || payload.root_batch_id;
    try {
      return await request('/recall/execute', {
        method: 'POST',
        body: JSON.stringify({
          batch_id: targetId,
          reason: payload.reason,
          severity: payload.severity,
          initiated_by: payload.initiated_by,
        }),
      });
    } catch (e) {
      if (e.status) throw e;
      const store = getLocalStore();
      const sim = await this.simulateRecall({ batch_id: targetId, reason: payload.reason });

      // Mutate status in store
      // 1. Root batch & affected products become RECALLED
      const recallIds = [targetId, ...sim.affected_product_batches];
      store.batches.forEach((b) => {
        if (recallIds.includes(b.id)) {
          b.status = 'RECALLED';
        } else if (sim.co_input_batches_for_review.includes(b.id)) {
          // Never demote an already RECALLED batch to QUARANTINED
          if (b.status !== 'RECALLED') {
            b.status = 'QUARANTINED';
          }
        }
      });

      const recallEvent = {
        id: store.recalls.length + 1,
        root_batch_id: targetId,
        reason: payload.reason || 'Contaminant detected exceeding safety limits',
        severity: payload.severity || 'CRITICAL',
        initiated_by: payload.initiated_by || 'Dr. K. Sharma (QA Lead)',
        status: 'ACTIVE',
        affected_batches_json: JSON.stringify(recallIds),
        affected_destinations_json: JSON.stringify(sim.compromised_retail_destinations),
        created_at: new Date().toISOString(),
        blast_radius: sim,
      };

      if (Array.isArray(store.complaints)) {
        store.complaints.forEach((c) => {
          if (recallIds.includes(c.batch_id) && c.status === 'OPEN') {
            c.status = 'RECALL_TRIGGERED';
          }
        });
      }

      store.recalls.unshift(recallEvent);
      saveLocalStore(store);

      return {
        status: 'SUCCESS',
        message: `Recall successfully executed for batch ${targetId}`,
        recall_event: recallEvent,
        blast_radius: sim,
      };
    }
  },

  async getRecallHistory() {
    try {
      return await request('/recall/history');
    } catch (e) {
      const store = getLocalStore();
      return store.recalls;
    }
  },

  async getInspections(batchId) {
    const query = batchId ? `?batch_id=${encodeURIComponent(batchId)}` : '';
    return request(`/inspections${query}`);
  },

  async submitInspection(batchId, values) {
    const form = new FormData();
    Object.entries(values).forEach(([key, value]) => {
      if (key === 'evidence') {
        if (value) form.append('evidence', value);
      } else {
        form.append(key, String(value ?? ''));
      }
    });
    return request(`/batches/${encodeURIComponent(batchId)}/inspections`, {
      method: 'POST',
      body: form,
    });
  },

  getEvidenceUrl(evidenceUrl) {
    if (!evidenceUrl) return '';
    if (/^https?:\/\//i.test(evidenceUrl)) return evidenceUrl;
    const base = API_BASE_URL.replace(/\/api\/?$/, '');
    return `${base}${evidenceUrl.startsWith('/') ? '' : '/'}${evidenceUrl}`;
  },

  // 4B. Complaints & Safety Check Copilot (3-Mode System)
  async getComplaints({ batchId, status, severity } = {}) {
    const params = new URLSearchParams();
    if (batchId) params.set('batch_id', batchId);
    if (status) params.set('status', status);
    if (severity) params.set('severity', severity);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return request(`/complaints${qs}`);
  },

  async createComplaint(payload) {
    return request('/complaints', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateComplaintStatus(complaintId, status) {
    return request(`/complaints/${complaintId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  async processComplaintCopilot({ message, currentForm = {}, intakeMode = 'AI_COPILOT' }) {
    try {
      return await request('/copilot/process', {
        method: 'POST',
        body: JSON.stringify({
          message,
          current_form: currentForm,
          intake_mode: intakeMode,
        }),
      });
    } catch (e) {
      return parseComplaintTextOffline(message, currentForm, intakeMode);
    }
  },

  async uploadComplaintReport(file, currentForm = {}) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('current_form', JSON.stringify(currentForm || {}));
      return await request('/copilot/upload', {
        method: 'POST',
        body: formData,
      });
    } catch (e) {
      const text = await file.text().catch(() => '');
      const result = parseComplaintTextOffline(
        text || file.name,
        { ...currentForm, source_filename: file.name },
        'REPORT_UPLOAD'
      );
      return {
        ...result,
        source_filename: file.name,
        extracted_text_preview: (text || '').slice(0, 650),
      };
    }
  },

  async getSampleReports() {
    try {
      return await request('/complaints/sample-reports');
    } catch (e) {
      return OFFLINE_SAMPLE_REPORTS.map(({ sample_text, ...meta }) => meta);
    }
  },

  async downloadSampleReport(sampleId) {
    const sampleMeta = OFFLINE_SAMPLE_REPORTS.find((s) => s.id === sampleId) || OFFLINE_SAMPLE_REPORTS[0];
    try {
      const response = await fetch(`${API_BASE_URL}/complaints/sample-reports/${encodeURIComponent(sampleId)}/download`);
      if (!response.ok) throw new Error('Backend download unavailable');
      const blob = await response.blob();
      return { blob, filename: sampleMeta.filename };
    } catch (e) {
      const blob = new Blob([sampleMeta.sample_text], { type: 'text/plain;charset=utf-8' });
      return { blob, filename: sampleMeta.filename.replace(/\.(pdf|docx)$/i, '.txt') };
    }
  },

  // 5. FSSAI Export
  async getFssaiNotice(recallId = 1) {
    try {
      return await request(`/recall/${recallId}/export-fssai`);
    } catch (e) {
      const store = getLocalStore();
      const ev = store.recalls.find((r) => r.id === Number(recallId)) || store.recalls[0];
      const blast = ev?.blast_radius || (await this.simulateRecall({ batch_id: 'MILK-101', reason: 'Aflatoxin M1' }));

      return {
        notice_reference: `FSSAI-RECALL-2026-${String(recallId || 101).padStart(4, '0')}`,
        statutory_authority: 'Food Safety and Standards Authority of India (FSSAI)',
        framework: 'Food Safety and Standards (Food Recall Procedure) Regulations, 2017 (FoSCoS)',
        issued_at: ev?.created_at || new Date().toISOString(),
        classification: ev?.severity || 'CLASS I (CRITICAL)',
        brand_name: 'FoodSync / DairyTrace Cooperative Network',
        originating_batch: ev?.root_batch_id || 'MILK-101',
        hazard_description: ev?.reason || 'Adulteration / Chemical Residue Detected Exceeding Permissible Maximum Residue Limit (MRL)',
        affected_finished_batches: blast.affected_product_batches,
        co_inputs_quarantined: blast.co_input_batches_for_review,
        distribution_lockdown_targets: blast.compromised_retail_destinations,
        action_required_retailers: 'IMMEDIATE WITHDRAWAL FROM SHELVES. QUARANTINE IN DESIGNATED STORAGE. NOTIFY LOCAL FOOD SAFETY OFFICER.',
        public_action: 'DO NOT CONSUME. RETURN TO RETAIL STORE OR NEAREST COLLECTION HUB FOR FULL REFUND.',
        fssai_officer_signoff: 'Tech4Food Food Safety Evaluation Board — Pune District Office',
      };
    }
  },

  // 6. Public Consumer Passport
  async getPublicPassport(batchId = 'PAN-201') {
    try {
      const raw = await request(`/public/passport/${batchId}`);
      return normalizePassportData(raw, batchId);
    } catch (e) {
      if (e.status === 404) throw e;
      const store = getLocalStore();
      const batch = store.batches.find((b) => b.id === batchId);
      if (!batch) throw new Error('Batch not found');

      // Compute origin breakdown from parents
      const parentLinks = store.links.filter((l) => l.child_batch_id === batch.id);
      const totalParentQty = parentLinks.reduce((sum, l) => sum + (l.quantity_used || 0), 0);
      const origins = parentLinks.map((l) => {
        const parentBatch = store.batches.find((b) => b.id === l.parent_batch_id);
        const percent = totalParentQty > 0 ? Math.round((l.quantity_used / totalParentQty) * 100) : 100;
        return {
          source: parentBatch ? parentBatch.facility_name : l.parent_batch_id,
          source_batch_code: l.parent_batch_id,
          contribution_liters: l.quantity_used,
          percentage: percent,
        };
      });

      const quality = store.quality_records.find((q) => q.batch_id === batch.id);
      const complaintStatuses = (store.complaints || [])
        .filter((c) => c.batch_id === batch.id)
        .map((c) => c.adulterant_status);
      const adulterantStatus = [quality?.adulterant_test, ...complaintStatuses]
        .filter(Boolean)
        .sort((a, b) => ({ NOT_TESTED: 0, NEGATIVE: 1, SUSPECTED: 2, POSITIVE: 3 }[b] ?? 2) - ({ NOT_TESTED: 0, NEGATIVE: 1, SUSPECTED: 2, POSITIVE: 3 }[a] ?? 2))[0] || 'NOT_TESTED';

      return normalizePassportData({
        id: batch.id,
        batch_id: batch.id,
        product_name: batch.product_type === 'PANEER' ? 'FoodSync Fresh Malai Paneer 200g' : 'FoodSync Farm-Chilled Cow Milk',
        product_type: batch.product_type,
        status: batch.status,
        facility_name: batch.facility_name,
        production_date: batch.production_date,
        expiry_date: batch.expiry_date,
        fssai_licence_number: '11526038000412',
        fssai_compliance_status:
          batch.status === 'RECALLED'
            ? 'SAFETY_RECALLED'
            : batch.status === 'QUARANTINED'
            ? 'HOLD_UNDER_INSPECTION'
          : adulterantStatus === 'NEGATIVE' ? 'COMPLIANT' : 'NOT_VERIFIED',
        adulterant_status: adulterantStatus,
        is_safe: batch.status === 'ACTIVE' && adulterantStatus === 'NEGATIVE',
        verification_badge: adulterantStatus === 'POSITIVE' ? 'CONTAMINATION ALERT — DO NOT CONSUME' : adulterantStatus === 'SUSPECTED' ? 'PRECAUTIONARY ALERT — UNDER REVIEW' : adulterantStatus === 'NEGATIVE' ? 'Quality Screen Passed' : 'Quality Testing Not Recorded',
        purity_score: batch.status === 'ACTIVE' && adulterantStatus === 'NEGATIVE' ? 99.4 : null,
        fat_percentage: quality?.fat_percentage ?? null,
        snf_percentage: quality?.snf_percentage ?? null,
        adulterant_screen: quality ? `${quality.adulterant_test}` : adulterantStatus === 'NOT_TESTED' ? 'NOT TESTED' : adulterantStatus,
        origins: origins.length > 0 ? origins : [{ source: batch.facility_name, source_batch_code: batch.id, contribution_liters: batch.initial_quantity, percentage: 100 }],
        trust_badge: quality?.trust_level || batch.trust_level || 'VERIFIED',
        lab_signoff: quality?.lab_name || 'No lab record',
        contaminant_warning: batch.status === 'RECALLED'
          ? 'URGENT: This batch has been recalled by Food Safety Officer. Do not consume.'
          : adulterantStatus === 'POSITIVE' ? 'ALERT: Positive adulteration/contaminant screen detected. Do not consume this batch.'
          : adulterantStatus === 'SUSPECTED' ? 'A contamination concern has been reported. Avoid consuming this batch while it is reviewed.'
          : adulterantStatus === 'NOT_TESTED' ? 'No adulterant test result is recorded for this batch. Check with the supplier before consuming.' : null,
      }, batchId);
    }
  },

  // 7. Seed Pitch Scenario
  async seedPitchScenario() {
    try {
      const res = await request('/seed/tech4food', { method: 'POST' });
      resetMockPitchData();
      return res;
    } catch (e) {
      return resetMockPitchData();
    }
  },
};

export default api;

