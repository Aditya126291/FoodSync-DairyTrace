"""AI Complaint Copilot & Multi-Format Forensic Report Parser for DairyTrace.

Provides:
1. Conversational natural-language extraction (`extract_fields` -> `normalize_patch` ->
   `validate_completeness` -> `evaluate_safety_impact` -> `build_message`).
2. Multi-format document parsing for forensic & dairy check reports (`.pdf`, `.docx`, `.txt`, `.json`, `.eml`).
3. On-demand generation of downloadable sample forensic dairy reports (`.pdf`, `.docx`, `.txt`, `.json`).
"""

from __future__ import annotations

import email
from email import policy
import io
import json
import os
import re
import xml.etree.ElementTree as ET
import zipfile
from typing import Any, Optional


KNOWN_BATCH_DEFAULTS: dict[str, dict[str, str]] = {
    "MILK-101": {
        "product_name": "FoodSync Farm-Chilled Raw Milk",
        "facility_or_store": "Shirur Collection Centre",
    },
    "MILK-102": {
        "product_name": "FoodSync Farm-Chilled Raw Milk",
        "facility_or_store": "Junnar Collection Centre",
    },
    "MILK-103": {
        "product_name": "FoodSync Farm-Chilled Raw Milk",
        "facility_or_store": "Baramati Chilling Centre",
    },
    "PAN-201": {
        "product_name": "FoodSync Fresh Malai Paneer 200g",
        "facility_or_store": "Retailer A (Kothrud)",
    },
    "PAN-202": {
        "product_name": "FoodSync Fresh Malai Paneer 200g",
        "facility_or_store": "Retailer C (Hinjawadi)",
    },
    "PAN-303": {
        "product_name": "FoodSync Fresh Malai Paneer 200g",
        "facility_or_store": "FoodSync Central Dairy Plant, Pune",
    },
}

REQUIRED_COMPLAINT_FIELDS = [
    ("batch_id", "Batch ID"),
    ("product_name", "Product Name"),
    ("reporter_name", "Reporter / Customer Name"),
    ("facility_or_store", "Store / Facility"),
    ("severity", "Severity Level"),
    ("description", "Complaint / Forensic Description"),
]

FORENSIC_OPTIONAL_FIELDS = [
    ("fat_percentage", "Fat %"),
    ("snf_percentage", "SNF %"),
    ("acidity_percentage", "Acidity %"),
    ("adulterant_findings", "Adulterant / Contaminant Findings"),
]


# ---------------------------------------------------------------------------
# Sample Forensic & Dairy Quality Reports Catalog
# ---------------------------------------------------------------------------

SAMPLE_REPORTS_CATALOG: list[dict[str, Any]] = [
    {
        "id": "pdf-aflatoxin-milk101",
        "filename": "NABL_Forensic_Report_MILK-101_Aflatoxin.pdf",
        "format": "PDF",
        "mime_type": "application/pdf",
        "title": "NABL Forensic Lab Report — MILK-101 (Aflatoxin M1 Alert)",
        "subtitle": "Official NABL accredited mycotoxin & compositional lab certificate (.pdf)",
        "badge": "Critical Safety Hazard",
        "structured_data": {
            "Report Reference": "NABL/PUNE/2026/AF-101",
            "Laboratory": "Pune Regional Dairy Forensic & Quality Lab (NABL Accredited)",
            "Batch / Lot Number": "MILK-101",
            "Product Name": "FoodSync Farm-Chilled Raw Milk",
            "Store / Facility": "Shirur Collection Centre",
            "Reported By": "Dr. Ananya Deshmukh",
            "Reporter Role": "NABL Forensic Chemist",
            "Complaint Category": "Chemical / Mycotoxin Contaminant",
            "Severity": "CRITICAL",
            "Milk Fat (%)": "4.1%",
            "Milk Solids SNF (%)": "8.2%",
            "Titratable Acidity (%)": "0.21%",
            "Adulterant Test": "POSITIVE",
            "Adulterant / Contaminant Findings": (
                "Elevated Aflatoxin M1 residue detected at 0.78 ug/kg via HPLC-FLD "
                "(exceeds FSSAI maximum permissible limit of 0.50 ug/kg). Trace sodium bicarbonate neutralizer present."
            ),
            "Summary": (
                "Forensic laboratory analysis of raw milk batch MILK-101 collected from Shirur Collection Centre "
                "confirmed elevated Aflatoxin M1 (0.78 ug/kg vs 0.50 ug/kg FSSAI limit), sub-standard milk fat (4.1%), "
                "and elevated titratable acidity (0.21%). Immediate Class I recall of downstream paneer batches PAN-201 "
                "and PAN-202 is recommended."
            ),
        },
    },
    {
        "id": "docx-urea-pan201",
        "filename": "Retailer_Quality_Check_PAN-201_Urea_Report.docx",
        "format": "DOCX",
        "mime_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "title": "Retail Partner Quality Dossier — PAN-201 (Urea & Sourness)",
        "subtitle": "Retailer A (Kothrud) incoming quality & chemical spot-check dossier (.docx)",
        "badge": "Adulteration Positive",
        "structured_data": {
            "Report Reference": "RET-KOT-2026-089",
            "Batch / Lot Number": "PAN-201",
            "Product Name": "FoodSync Fresh Malai Paneer 200g",
            "Store / Facility": "Retailer A (Kothrud)",
            "Reported By": "Rajesh Kulkarni",
            "Reporter Role": "Retail Store Quality Manager",
            "Complaint Category": "Forensic / Adulteration Alert",
            "Severity": "CRITICAL",
            "Milk Fat (%)": "19.8%",
            "Milk Solids SNF (%)": "24.5%",
            "Titratable Acidity (%)": "0.29%",
            "Adulterant Test": "POSITIVE",
            "Adulterant / Contaminant Findings": (
                "Positive DMAB spot check for synthetic urea (0.38%) and high lactic acidity (0.29%) with sour odor."
            ),
            "Summary": (
                "Incoming retail cold-store inspection at Retailer A (Kothrud) onBatch PAN-201 revealed sharp sour odor, "
                "whey weeping in 14 packs, reduced fat content (19.8%), high acidity (0.29%), and positive DMAB colorimetric "
                "reaction for synthetic urea adulteration. Stock segregated in quarantine freezer pending recall."
            ),
        },
    },
    {
        "id": "txt-coldchain-pan202",
        "filename": "ColdChain_Field_Audit_PAN-202.txt",
        "format": "TXT",
        "mime_type": "text/plain",
        "title": "Cold-Chain & Spoilage Inspection — PAN-202",
        "subtitle": "Field inspector plain-text audit log from Hinjawadi retail hub (.txt)",
        "badge": "Major Quality Issue",
        "structured_data": {
            "Report Reference": "FLD-HINJ-2026-042",
            "Batch / Lot Number": "PAN-202",
            "Product Name": "FoodSync Fresh Malai Paneer 200g",
            "Store / Facility": "Retailer C (Hinjawadi)",
            "Reported By": "Vikram Patil",
            "Reporter Role": "Cold-Chain QA Inspector",
            "Complaint Category": "Cold-Chain / Storage Excursion",
            "Severity": "MAJOR",
            "Milk Fat (%)": "23.4%",
            "Milk Solids SNF (%)": "27.1%",
            "Titratable Acidity (%)": "0.25%",
            "Adulterant Test": "SUSPECTED",
            "Adulterant / Contaminant Findings": (
                "Cold-chain temperature excursion (11.4 C for 5 hours); sour curds and elevated acidity (0.25%)."
            ),
            "Summary": (
                "Field audit at Retailer C (Hinjawadi) logged a reefer van temperature excursion to 11.4 C during delivery "
                "of Batch PAN-202. Lab re-check recorded Fat 23.4%, SNF 27.1%, and elevated Acidity 0.25% with mild package bloating."
            ),
        },
    },
    {
        "id": "json-analyzer-milk102",
        "filename": "Automated_LactoScan_Export_MILK-102.json",
        "format": "JSON",
        "mime_type": "application/json",
        "title": "Automated LactoScan Telemetry — MILK-102",
        "subtitle": "Structured JSON laboratory analyzer export for co-input batch (.json)",
        "badge": "Precautionary Hold",
        "structured_data": {
            "Report Reference": "LACTO-JUN-2026-102",
            "Batch / Lot Number": "MILK-102",
            "Product Name": "FoodSync Farm-Chilled Raw Milk",
            "Store / Facility": "Junnar Collection Centre",
            "Reported By": "Priya Nair",
            "Reporter Role": "Co-op Lab Analyst",
            "Complaint Category": "Compositional Non-Compliance (Fat/SNF)",
            "Severity": "PRECAUTIONARY",
            "Milk Fat (%)": "4.3%",
            "Milk Solids SNF (%)": "8.4%",
            "Titratable Acidity (%)": "0.17%",
            "Adulterant Test": "SUSPECTED",
            "Adulterant / Contaminant Findings": (
                "Borderline beta-lactam antibiotic screen (3.8 ppb) and shared vat co-mingling with MILK-101."
            ),
            "Summary": (
                "Automated ultrasonic milk analyzer export for Batch MILK-102 at Junnar Collection Centre. "
                "Fat 4.3%, SNF 8.4%, Acidity 0.17%. Precautionary hold requested because 400L was blended into "
                "Vat #1 with MILK-101 and rapid beta-lactam strip showed borderline trace reading."
            ),
        },
    },
]


def _format_sample_as_text(sample: dict[str, Any]) -> str:
    sd = sample["structured_data"]
    lines = [
        "======================================================================",
        f"DAIRYTRACE FORENSIC & QUALITY CHECK REPORT — {sample['title'].upper()}",
        "======================================================================",
    ]
    for k, v in sd.items():
        lines.append(f"{k}: {v}")
    lines.append("======================================================================")
    return "\n".join(lines)


def generate_sample_report_bytes(sample_id: str) -> tuple[bytes, str, str]:
    """Generates downloadable file bytes, filename, and mime_type for a sample report ID."""
    sample = next((s for s in SAMPLE_REPORTS_CATALOG if s["id"] == sample_id), None)
    if not sample:
        raise ValueError(f"Unknown sample report ID: '{sample_id}'")

    fmt = sample["format"].upper()
    sd = sample["structured_data"]
    filename = sample["filename"]
    mime_type = sample["mime_type"]

    if fmt == "JSON":
        payload = {
            "report_reference": sd["Report Reference"],
            "batch_id": sd["Batch / Lot Number"],
            "product_name": sd["Product Name"],
            "facility_or_store": sd["Store / Facility"],
            "reporter_name": sd["Reported By"],
            "reporter_role": sd["Reporter Role"],
            "complaint_category": sd["Complaint Category"],
            "severity": sd["Severity"],
            "fat_percentage": float(str(sd["Milk Fat (%)"]).replace("%", "").strip()),
            "snf_percentage": float(str(sd["Milk Solids SNF (%)"]).replace("%", "").strip()),
            "acidity_percentage": float(str(sd["Titratable Acidity (%)"]).replace("%", "").strip()),
            "adulterant_status": sd["Adulterant Test"],
            "adulterant_findings": sd["Adulterant / Contaminant Findings"],
            "description": sd["Summary"],
        }
        return json.dumps(payload, indent=2).encode("utf-8"), filename, mime_type

    if fmt == "TXT":
        return _format_sample_as_text(sample).encode("utf-8"), filename, mime_type

    if fmt == "DOCX":
        try:
            from docx import Document  # type: ignore

            doc = Document()
            doc.add_heading(sample["title"], level=1)
            doc.add_paragraph(f"Official DairyTrace Forensic & Quality Intake Dossier ({sd['Report Reference']})")
            table = doc.add_table(rows=0, cols=2)
            for key, value in sd.items():
                if key == "Summary":
                    continue
                row_cells = table.add_row().cells
                row_cells[0].text = str(key)
                row_cells[1].text = str(value)
            doc.add_heading("Forensic & Quality Summary", level=2)
            doc.add_paragraph(sd["Summary"])
            buf = io.BytesIO()
            doc.save(buf)
            return buf.getvalue(), filename, mime_type
        except Exception:
            # Minimal valid DOCX zip fallback if python-docx is unavailable
            buf = io.BytesIO()
            text_content = _format_sample_as_text(sample)
            with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
                xml_body = (
                    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
                    "<w:body><w:p><w:r><w:t>"
                    + (
                        text_content.replace("&", "&amp;")
                        .replace("<", "&lt;")
                        .replace(">", "&gt;")
                    )
                    + "</w:t></w:r></w:p></w:body></w:document>"
                )
                zf.writestr("word/document.xml", xml_body)
            return buf.getvalue(), filename, mime_type

    if fmt == "PDF":
        try:
            from reportlab.lib import colors  # type: ignore
            from reportlab.lib.pagesizes import letter  # type: ignore
            from reportlab.lib.styles import getSampleStyleSheet  # type: ignore
            from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle  # type: ignore

            buf = io.BytesIO()
            doc = SimpleDocTemplate(buf, pagesize=letter, leftMargin=36, rightMargin=36, topMargin=36, bottomMargin=36)
            styles = getSampleStyleSheet()
            story = [
                Paragraph(f"<b>{sample['title']}</b>", styles["Title"]),
                Spacer(1, 8),
                Paragraph(f"Reference: {sd['Report Reference']} | Laboratory: {sd.get('Laboratory', 'DairyTrace QA')}", styles["Normal"]),
                Spacer(1, 12),
            ]
            rows = [[k, v] for k, v in sd.items() if k != "Summary"]
            table = Table(rows, colWidths=[170, 350])
            table.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F5F2EB")),
                        ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#1C1917")),
                        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D6D3D1")),
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("PADDING", (0, 0), (-1, -1), 6),
                    ]
                )
            )
            story.append(table)
            story.append(Spacer(1, 14))
            story.append(Paragraph(f"<b>Summary:</b> {sd['Summary']}", styles["Normal"]))
            # Also embed plain text comment lines for ultra-fast deterministic fallback extraction
            for k, v in sd.items():
                story.append(Spacer(1, 2))
                story.append(Paragraph(f"{k}: {v}", styles["Normal"]))
            doc.build(story)
            return buf.getvalue(), filename, mime_type
        except Exception:
            text_lines = _format_sample_as_text(sample).splitlines()
            pdf_stream = "\n".join(f"({line}) Tj" for line in text_lines)
            raw_pdf = f"%PDF-1.4\n1 0 obj <<>> stream\n{pdf_stream}\nendstream endobj\n%%EOF"
            return raw_pdf.encode("utf-8"), filename, mime_type

    raise ValueError(f"Unsupported sample report format: {fmt}")


def list_sample_reports() -> list[dict[str, Any]]:
    """Returns metadata and pre-parsed preview for all downloadable sample reports."""
    items = []
    for sample in SAMPLE_REPORTS_CATALOG:
        text_repr = _format_sample_as_text(sample)
        parsed = process_complaint_input(text_repr, {})
        items.append(
            {
                "id": sample["id"],
                "filename": sample["filename"],
                "format": sample["format"],
                "mime_type": sample["mime_type"],
                "title": sample["title"],
                "subtitle": sample["subtitle"],
                "badge": sample["badge"],
                "download_url": f"/api/complaints/sample-reports/{sample['id']}/download",
                "preview_patch": parsed["patch"],
            }
        )
    return items


# ---------------------------------------------------------------------------
# Multi-Format Document Text Extraction (.pdf, .docx, .txt, .json, .eml)
# ---------------------------------------------------------------------------

def extract_text_from_upload(filename: str, content_bytes: bytes, content_type: str = "") -> tuple[str, dict[str, Any]]:
    """
    Extracts plain text and any direct structured key-value pairs from an uploaded
    forensic or dairy quality report (.pdf, .docx, .txt, .json, .eml, .csv, .md).
    """
    if not content_bytes:
        raise ValueError("The uploaded report file is empty.")

    lower_name = (filename or "report.txt").lower().strip()
    ext = os.path.splitext(lower_name)[1]

    # 1. JSON report
    if ext == ".json" or "application/json" in (content_type or ""):
        try:
            decoded = content_bytes.decode("utf-8", errors="replace")
            data = json.loads(decoded)
            if isinstance(data, dict):
                lines = [f"{k}: {v}" for k, v in data.items() if v is not None]
                return "\n".join(lines), data
            return decoded, {}
        except json.JSONDecodeError as exc:
            raise ValueError("Uploaded JSON report is not valid JSON.") from exc

    # 2. DOCX report
    if ext == ".docx" or "officedocument.wordprocessingml" in (content_type or ""):
        extracted_parts: list[str] = []
        try:
            from docx import Document  # type: ignore

            doc = Document(io.BytesIO(content_bytes))
            for para in doc.paragraphs:
                if para.text and para.text.strip():
                    extracted_parts.append(para.text.strip())
            for table in doc.tables:
                for row in table.rows:
                    cells = [c.text.strip() for c in row.cells if c.text and c.text.strip()]
                    if len(cells) >= 2:
                        extracted_parts.append(f"{cells[0]}: {' | '.join(cells[1:])}")
                    elif cells:
                        extracted_parts.append(cells[0])
        except Exception:
            pass

        if not extracted_parts:
            # Fallback: parse word/document.xml directly via zipfile
            try:
                with zipfile.ZipFile(io.BytesIO(content_bytes)) as zf:
                    if "word/document.xml" in zf.namelist():
                        xml_bytes = zf.read("word/document.xml")
                        root = ET.fromstring(xml_bytes)
                        texts = [elem.text for elem in root.iter() if elem.tag.endswith("}t") and elem.text]
                        extracted_parts.append(" ".join(texts))
            except Exception as exc:
                raise ValueError("The uploaded .docx file could not be read as a valid Word document.") from exc

        text_out = "\n".join(extracted_parts).strip()
        if not text_out:
            raise ValueError("No readable text was found in the uploaded .docx report.")
        return text_out, {}

    # 3. PDF report
    if ext == ".pdf" or "application/pdf" in (content_type or ""):
        extracted_pages: list[str] = []
        # Try pypdf first
        try:
            from pypdf import PdfReader  # type: ignore

            reader = PdfReader(io.BytesIO(content_bytes))
            for page in reader.pages:
                page_txt = page.extract_text() or ""
                if page_txt.strip():
                    extracted_pages.append(page_txt.strip())
        except Exception:
            pass

        # Fallback to PyPDF2
        if not extracted_pages:
            try:
                import PyPDF2  # type: ignore

                reader = PyPDF2.PdfReader(io.BytesIO(content_bytes))
                for page in reader.pages:
                    page_txt = page.extract_text() or ""
                    if page_txt.strip():
                        extracted_pages.append(page_txt.strip())
            except Exception:
                pass

        # Fallback to PDF literal text stream extraction (e.g. `(Batch ID: MILK-101) Tj`)
        if not extracted_pages:
            raw_str = content_bytes.decode("latin-1", errors="ignore")
            if "%PDF" in raw_str:
                paren_matches = re.findall(r"\(([^()]{2,300})\)", raw_str)
                if paren_matches:
                    extracted_pages.append("\n".join(paren_matches))
                else:
                    extracted_pages.append(raw_str)
            else:
                raise ValueError("The uploaded file is not a valid PDF document.")

        text_out = "\n".join(extracted_pages).strip()
        if not text_out:
            raise ValueError("No readable text could be extracted from the PDF report.")
        return text_out, {}

    # 4. EML email report
    if ext == ".eml" or "message/rfc822" in (content_type or ""):
        msg = email.message_from_bytes(content_bytes, policy=policy.default)
        headers = []
        if msg.get("From"):
            headers.append(f"Reported By: {msg.get('From')}")
        if msg.get("Subject"):
            headers.append(f"Subject: {msg.get('Subject')}")
        body = ""
        if msg.is_multipart():
            for part in msg.walk():
                if part.get_content_type() == "text/plain":
                    body += part.get_content() or ""
        else:
            body = msg.get_content() if hasattr(msg, "get_content") else msg.get_payload(decode=True).decode("utf-8", errors="replace")
        return "\n".join(headers + [str(body)]).strip(), {}

    # 5. Plain text / Markdown / CSV
    if ext in {".txt", ".md", ".csv", ".log"} or (content_type or "").startswith("text/"):
        try:
            text_out = content_bytes.decode("utf-8").strip()
        except UnicodeDecodeError:
            text_out = content_bytes.decode("latin-1", errors="replace").strip()
        if not text_out:
            raise ValueError("The uploaded text report is empty.")
        return text_out, {}

    raise ValueError(
        f"Unsupported report file format '{ext or content_type}'. "
        "Please upload a PDF, DOCX, TXT, JSON, or EML report."
    )


# ---------------------------------------------------------------------------
# AI Copilot Pipeline (extract_fields -> normalize_patch -> validate_completeness -> build_message)
# ---------------------------------------------------------------------------

def _extract_fields_deterministic(text: str, direct_json: Optional[dict[str, Any]] = None) -> dict[str, Any]:
    """
    Deterministic Dairy Forensic & Natural Language Entity Extractor.
    Extracts structured complaint & lab fields from free-form text or parsed report tables.
    """
    raw_patch: dict[str, Any] = {}
    clean_text = text.strip()
    lower_text = clean_text.lower()

    # 0. Map any direct JSON keys first
    if direct_json and isinstance(direct_json, dict):
        key_map = {
            "batch_id": ["batch_id", "batch_number", "batch_code", "lot_number", "batch"],
            "product_name": ["product_name", "product", "product_type"],
            "reporter_name": ["reporter_name", "reported_by", "customer_name", "chemist", "inspector_name", "analyst"],
            "reporter_role": ["reporter_role", "role", "designation"],
            "facility_or_store": ["facility_or_store", "facility_name", "store_name", "store", "facility", "location", "retailer"],
            "complaint_category": ["complaint_category", "category", "issue_type"],
            "severity": ["severity", "priority", "risk_level"],
            "fat_percentage": ["fat_percentage", "fat", "milk_fat", "fat_pct"],
            "snf_percentage": ["snf_percentage", "snf", "milk_solids", "snf_pct"],
            "acidity_percentage": ["acidity_percentage", "acidity", "titratable_acidity", "lactic_acidity"],
            "adulterant_status": ["adulterant_status", "adulterant_test", "contaminant_status"],
            "adulterant_findings": ["adulterant_findings", "contaminant_details", "findings", "forensic_findings"],
            "description": ["description", "summary", "notes", "complaint_description"],
        }
        lower_json = {str(k).lower().strip(): v for k, v in direct_json.items() if v is not None}
        for target_field, aliases in key_map.items():
            for alias in aliases:
                if alias in lower_json and str(lower_json[alias]).strip() != "":
                    raw_patch[target_field] = lower_json[alias]
                    break

    # 1. Extract Batch ID
    if "batch_id" not in raw_patch:
        # Check explicit Milk/Paneer batch codes first (e.g., MILK-101, PAN-201, MILK 102)
        m_dairy = re.search(r"\b(MILK|PAN|PANEER)[\s_-]?(\d{2,5}[A-Z0-9-]*)\b", clean_text, re.IGNORECASE)
        if m_dairy:
            prefix = "PAN" if m_dairy.group(1).upper().startswith("PAN") else "MILK"
            raw_patch["batch_id"] = f"{prefix}-{m_dairy.group(2).upper()}"
        else:
            # Check labelled Batch / Lot Number
            m_label = re.search(
                r"(?:batch\s*(?:id|no|number|code)?|lot\s*(?:id|no|number|#)?)\s*(?:[:=\-]|is)\s*([A-Za-z0-9][A-Za-z0-9_-]{2,32})",
                clean_text,
                re.IGNORECASE,
            )
            if m_label:
                candidate = m_label.group(1).strip().upper()
                if candidate not in {"NUMBER", "CODE", "ID", "THE", "IS", "FOR"}:
                    raw_patch["batch_id"] = candidate

    # 2. Extract Fat %, SNF %, Acidity %
    if "fat_percentage" not in raw_patch:
        m_fat = re.search(
            r"(?:milk\s*fat|fat\s*(?:content|percentage|level|\(%?\))?|fat)\s*(?:[:=\-]|is|was|of|at|around)?\s*(\d{1,2}(?:\.\d{1,3})?)\s*%?",
            clean_text,
            re.IGNORECASE,
        )
        if m_fat:
            raw_patch["fat_percentage"] = float(m_fat.group(1))

    if "snf_percentage" not in raw_patch:
        m_snf = re.search(
            r"(?:solids[\s-]*not[\s-]*fat|milk\s*solids\s*(?:\(snf\))?|snf\s*(?:percentage|content|\(%?\))?|snf)\s*(?:[:=\-]|is|was|of|at|around)?\s*(\d{1,2}(?:\.\d{1,3})?)\s*%?",
            clean_text,
            re.IGNORECASE,
        )
        if m_snf:
            raw_patch["snf_percentage"] = float(m_snf.group(1))

    if "acidity_percentage" not in raw_patch:
        m_acid = re.search(
            r"(?:titratable\s*acidity|lactic\s*acidity|acidity\s*(?:percentage|level|\(%?\))?|acidity)\s*(?:[:=\-]|is|was|of|at|around)?\s*(\d{1,2}(?:\.\d{1,3})?)\s*%?",
            clean_text,
            re.IGNORECASE,
        )
        if m_acid:
            val = float(m_acid.group(1))
            if 0 <= val <= 10:
                raw_patch["acidity_percentage"] = val

    # 3. Extract Reporter / Customer Name & Role
    if "reporter_name" not in raw_patch:
        m_rep_label = re.search(
            r"(?:reported\s*by|reporter(?:\s*name)?|customer(?:\s*name)?|tested\s*by|forensic\s*chemist|inspector(?:\s*name)?|complainant|analyst)\s*[:=\-]\s*([^\n\r|;]{2,80})",
            clean_text,
            re.IGNORECASE,
        )
        if m_rep_label:
            rep_val = m_rep_label.group(1).strip().rstrip(".,")
            # If role is in parentheses, split it cleanly
            m_paren = re.match(r"^([^()]+)\(([^()]+)\)$", rep_val)
            if m_paren:
                raw_patch["reporter_name"] = m_paren.group(1).strip()
                raw_patch.setdefault("reporter_role", m_paren.group(2).strip())
            else:
                raw_patch["reporter_name"] = rep_val
        else:
            # Conversational: "I am Dr. Ananya Deshmukh", "My name is Rajesh Kulkarni", "change reporter to Meera Joshi"
            m_conv_rep = re.search(
                r"(?i:i\s+am|i'm|my\s+name\s+is|this\s+is|reporter\s+(?:name\s+)?(?:is|to)|reported\s+by)\s+((?:(?:Dr|Mr|Ms|Mrs|Prof)\.?\s+)?[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,2})",
                clean_text,
            )
            if m_conv_rep:
                candidate_name = m_conv_rep.group(1).strip()
                stop_words = {"Raising", "Reporting", "Writing", "Filing", "Uploading", "Testing", "Checking", "From"}
                if candidate_name.split()[0] not in stop_words:
                    raw_patch["reporter_name"] = candidate_name

    if "reporter_role" not in raw_patch:
        m_role_label = re.search(
            r"(?:reporter\s*role|designation|role)\s*[:=\-]\s*([^\n\r|;]{2,60})",
            clean_text,
            re.IGNORECASE,
        )
        if m_role_label:
            raw_patch["reporter_role"] = m_role_label.group(1).strip()
        elif "nabl" in lower_text or "forensic" in lower_text or "chemist" in lower_text:
            raw_patch["reporter_role"] = "NABL Forensic Chemist"
        elif "retailer" in lower_text or "store" in lower_text or "kothrud" in lower_text or "wakad" in lower_text or "hinjawadi" in lower_text:
            raw_patch["reporter_role"] = "Retail Store Partner"
        elif "inspector" in lower_text or "audit" in lower_text or "qa" in lower_text:
            raw_patch["reporter_role"] = "QA Safety Inspector"
        elif "customer" in lower_text or "consumer" in lower_text or "bought" in lower_text or "purchased" in lower_text:
            raw_patch["reporter_role"] = "Consumer"

    # 4. Extract Store / Facility
    if "facility_or_store" not in raw_patch:
        m_fac_label = re.search(
            r"(?:store\s*/\s*facility|facility(?:\s*name)?|store(?:\s*name)?|collection\s*centre|sampling\s*location|originating\s*site)\s*[:=\-]\s*([^\n\r|;]{2,90})",
            clean_text,
            re.IGNORECASE,
        )
        if m_fac_label:
            raw_patch["facility_or_store"] = m_fac_label.group(1).strip().rstrip(".,")
        else:
            # Match conversational "set store to ...", "at <Facility>" or known facilities
            if "shirur" in lower_text:
                raw_patch["facility_or_store"] = "Shirur Collection Centre"
            elif "junnar" in lower_text:
                raw_patch["facility_or_store"] = "Junnar Collection Centre"
            elif "baramati" in lower_text:
                raw_patch["facility_or_store"] = "Baramati Chilling Centre"
            elif "kothrud" in lower_text or "retailer a" in lower_text:
                raw_patch["facility_or_store"] = "Retailer A (Kothrud)"
            elif "wakad" in lower_text or "retailer b" in lower_text:
                raw_patch["facility_or_store"] = "Retailer B (Wakad)"
            elif "hinjawadi" in lower_text or "hinjewadi" in lower_text or "retailer c" in lower_text:
                raw_patch["facility_or_store"] = "Retailer C (Hinjawadi)"
            elif "central dairy" in lower_text or "pune plant" in lower_text:
                raw_patch["facility_or_store"] = "FoodSync Central Dairy Plant, Pune"
            else:
                m_store_conv = re.search(
                    r"(?:store|facility|centre|center|retailer)\s+(?:is|to|at)\s+([A-Z][A-Za-z0-9\s(),.-]{2,60}?)(?:[.;,\n]|$)",
                    clean_text,
                    re.IGNORECASE,
                )
                if m_store_conv:
                    raw_patch["facility_or_store"] = m_store_conv.group(1).strip()
                else:
                    m_location = re.search(
                        r"\b(?:at|from)\s+([A-Z][A-Za-z0-9&'.-]*(?:\s+[A-Z][A-Za-z0-9&'.-]*){0,5}\s+(?:Store|Market|Collection\s+Centre|Collection\s+Center|Dairy\s+Plant|Processing\s+Plant))\b",
                        clean_text,
                    )
                    if m_location:
                        raw_patch["facility_or_store"] = m_location.group(1).strip()

    # 5. Extract Product Name
    if "product_name" not in raw_patch:
        m_prod_label = re.search(
            r"(?:product\s*name|product\s*description|sample\s*type)\s*[:=\-]\s*([^\n\r|;]{2,90})",
            clean_text,
            re.IGNORECASE,
        )
        if m_prod_label:
            raw_patch["product_name"] = m_prod_label.group(1).strip().rstrip(".,")
        elif "paneer" in lower_text or "chhana" in lower_text:
            raw_patch["product_name"] = "FoodSync Fresh Malai Paneer 200g"
        elif "raw milk" in lower_text or "chilled milk" in lower_text or "cow milk" in lower_text or "milk" in lower_text:
            raw_patch["product_name"] = "FoodSync Farm-Chilled Raw Milk"

    # 6. Extract Adulterant / Contaminant Findings & Status
    if "adulterant_findings" not in raw_patch:
        m_find_label = re.search(
            r"(?:adulterant\s*/\s*contaminant\s*findings|adulterant\s*findings|contaminant\s*details|forensic\s*findings|key\s*findings)\s*[:=\-]?\s*(.{3,700}?)(?=\n\s*(?:summary|report\s*reference|laboratory|batch\s*/\s*lot\s*number|product\s*name|store\s*/\s*facility|reported\s*by|reporter\s*role|complaint\s*category|severity|milk\s*fat|milk\s*solids|titratable\s*acidity|adulterant\s*test)\b\s*(?::|\n|$)|\Z)",
            clean_text,
            re.IGNORECASE | re.DOTALL,
        )
        if m_find_label:
            raw_patch["adulterant_findings"] = re.sub(r"\s+", " ", m_find_label.group(1)).strip(" \t\r\n.,")
        else:
            hazards: list[str] = []
            if "aflatoxin" in lower_text:
                m_af = re.search(r"aflatoxin(?:\s*m1)?[^;\n]{0,140}", clean_text, re.IGNORECASE)
                finding = m_af.group(0).strip() if m_af else "Elevated Aflatoxin M1 residue detected"
                finding = re.split(r"(?<!\d)[.!?]\s+(?=[A-Z])", finding, maxsplit=1)[0]
                hazards.append(finding.strip().rstrip(".,"))
            if "urea" in lower_text and "no urea" not in lower_text:
                m_ur = re.search(r"(?:synthetic\s+)?urea[^.;,\n]{0,50}", clean_text, re.IGNORECASE)
                hazards.append(m_ur.group(0).strip() if m_ur else "Synthetic urea adulteration detected")
            if "melamine" in lower_text:
                hazards.append("Melamine contaminant detected")
            if "antibiotic" in lower_text or "oxytetracycline" in lower_text or "beta-lactam" in lower_text:
                hazards.append("Antibiotic residue detected above limit")
            if "starch" in lower_text and "no starch" not in lower_text:
                hazards.append("Starch adulterant positive")
            if "neutralizer" in lower_text or "bicarbonate" in lower_text or "caustic" in lower_text:
                hazards.append("Alkaline neutralizer (carbonate/bicarbonate) detected")
            if "formalin" in lower_text or "peroxide" in lower_text or "detergent" in lower_text:
                hazards.append("Chemical preservative / detergent adulterant detected")
            if "cold-chain" in lower_text or "cold chain" in lower_text or "temperature excursion" in lower_text:
                hazards.append("Cold-chain temperature excursion observed")
            if any(w in lower_text for w in ["sour", "curdled", "spoiled", "foul smell", "off-odor", "off odor", "bloated"]):
                hazards.append("Organoleptic spoilage / sourness / off-odor observed")

            if hazards:
                raw_patch["adulterant_findings"] = "; ".join(hazards)

    if "adulterant_status" not in raw_patch:
        m_status_label = re.search(
            r"(?:adulterant\s*(?:test|status|screen))\s*[:=\-]\s*(POSITIVE|NEGATIVE|SUSPECTED|NOT[_\s]TESTED|FAILED|PASSED)",
            clean_text,
            re.IGNORECASE,
        )
        if m_status_label:
            tok = m_status_label.group(1).upper()
            raw_patch["adulterant_status"] = (
                "POSITIVE" if tok in {"POSITIVE", "FAILED"}
                else "NEGATIVE" if tok in {"NEGATIVE", "PASSED"}
                else "NOT_TESTED" if tok in {"NOT TESTED", "NOT_TESTED"}
                else "SUSPECTED"
            )
        else:
            positive_markers = [
                "aflatoxin", "urea", "melamine", "formalin", "detergent", "peroxide",
                "neutralizer", "bicarbonate", "positive", "adulterated", "contaminated",
                "exceeds fssai", "above limit", "exceeding",
            ]
            suspected_markers = [
                "sour", "curdled", "spoiled", "off-odor", "off odor", "foul smell",
                "bloated", "temperature excursion", "cold-chain", "cold chain", "borderline", "suspected",
            ]
            negative_result = bool(re.search(
                r"\b(?:no|not detected|not found|negative for|free of|free from|without|absent)\b"
                r"[^.\n]{0,60}\b(?:aflatoxin|urea|melamine|formalin|detergent|peroxide|antibiotic|adulterant|contaminant)\b"
                r"|\b(?:aflatoxin|urea|melamine|formalin|detergent|peroxide|antibiotic|adulterant|contaminant)\b"
                r"[^.\n]{0,40}\b(?:not detected|not found|negative|absent)\b",
                lower_text,
            ))
            if negative_result or "no adulterant" in lower_text:
                raw_patch["adulterant_status"] = "NEGATIVE"
            elif any(marker in lower_text for marker in positive_markers) and "negative" not in lower_text:
                raw_patch["adulterant_status"] = "POSITIVE"
            elif any(marker in lower_text for marker in suspected_markers):
                raw_patch["adulterant_status"] = "SUSPECTED"
            elif "negative" in lower_text or "100% pure" in lower_text or "passed" in lower_text:
                raw_patch["adulterant_status"] = "NEGATIVE"

    # 7. Extract Severity & Complaint Category
    if "severity" not in raw_patch:
        m_sev = re.search(
            r"(?:severity|priority|alert\s*level)\s*(?:[:=\-]|to|is)\s*(CRITICAL|MAJOR|PRECAUTIONARY|HIGH|MEDIUM|LOW|CLASS\s*I{1,3})",
            clean_text,
            re.IGNORECASE,
        )
        if m_sev:
            tok = m_sev.group(1).upper().replace(" ", "")
            if tok in {"CRITICAL", "HIGH", "CLASSI"}:
                raw_patch["severity"] = "CRITICAL"
            elif tok in {"MAJOR", "MEDIUM", "CLASSII"}:
                raw_patch["severity"] = "MAJOR"
            else:
                raw_patch["severity"] = "PRECAUTIONARY"
        else:
            if raw_patch.get("adulterant_status") == "POSITIVE" or any(
                w in lower_text for w in ["critical", "urgent", "class i", "health risk", "recall"]
            ):
                raw_patch["severity"] = "CRITICAL"
            elif any(
                w in lower_text for w in ["major", "sour", "spoiled", "curdled", "bloated", "broken seal", "excursion", "class ii"]
            ):
                raw_patch["severity"] = "MAJOR"
            elif any(w in lower_text for w in ["precautionary", "minor", "borderline", "hold", "class iii"]):
                raw_patch["severity"] = "PRECAUTIONARY"

    if "complaint_category" not in raw_patch:
        m_cat = re.search(
            r"(?:complaint\s*category|category)\s*[:=\-]\s*([^\n\r|;]{3,70})",
            clean_text,
            re.IGNORECASE,
        )
        if m_cat:
            raw_patch["complaint_category"] = m_cat.group(1).strip()
        elif "aflatoxin" in lower_text or "mycotoxin" in lower_text or "antibiotic" in lower_text:
            raw_patch["complaint_category"] = "Chemical / Mycotoxin Contaminant"
        elif raw_patch.get("adulterant_status") == "POSITIVE" or "urea" in lower_text or "adulterat" in lower_text:
            raw_patch["complaint_category"] = "Forensic / Adulteration Alert"
        elif "cold-chain" in lower_text or "cold chain" in lower_text or "temperature" in lower_text:
            raw_patch["complaint_category"] = "Cold-Chain / Storage Excursion"
        elif "seal" in lower_text or "packag" in lower_text or "leak" in lower_text:
            raw_patch["complaint_category"] = "Packaging / Tamper Seal Issue"
        elif any(w in lower_text for w in ["sour", "spoiled", "curdled", "smell", "odor", "mold"]):
            raw_patch["complaint_category"] = "Microbial / Spoilage / Sourness"
        elif "fat" in lower_text or "snf" in lower_text:
            raw_patch["complaint_category"] = "Compositional Non-Compliance (Fat/SNF)"

    # 8. Extract Description / Summary
    if "description" not in raw_patch:
        m_desc = re.search(
            r"(?:summary|complaint\s*description|description|detailed\s*observations)\s*[:=\-]\s*(.{10,2000}?)(?=\n\s*(?:report\s*reference|laboratory|batch\s*/\s*lot\s*number|product\s*name|store\s*/\s*facility|reported\s*by|reporter\s*role|complaint\s*category|severity|milk\s*fat|milk\s*solids|titratable\s*acidity|adulterant\s*test|adulterant\s*/\s*contaminant\s*findings)\b\s*(?::|\n|$)|\Z)",
            clean_text,
            re.IGNORECASE | re.DOTALL,
        )
        if m_desc:
            raw_patch["description"] = re.sub(r"\s+", " ", m_desc.group(1)).strip(" \t\r\n.,")
        elif len(clean_text) >= 12 and not re.match(r"^(?:change|set|update)\s+\w+\s+to\b", lower_text):
            # Use cleaned narrative if it's a natural language complaint
            compact = re.sub(r"\s+", " ", clean_text).strip()
            raw_patch["description"] = compact[:1000]

    return raw_patch


def _try_llm_extract(message: str, current_form: dict[str, Any]) -> dict[str, Any]:
    """Optional live LLM extraction (Groq / Gemini) if an API key is configured in environment."""
    groq_key = os.getenv("GROQ_API_KEY", "").strip()
    if not groq_key:
        return {}
    try:
        from groq import Groq  # type: ignore

        client = Groq(api_key=groq_key, timeout=3.5)
        prompt = (
            "You are the DairyTrace Forensic Complaint Copilot. Extract a JSON object with any of these keys "
            "present in the user's input: batch_id, product_name, reporter_name, reporter_role, facility_or_store, "
            "complaint_category, severity (CRITICAL, MAJOR, PRECAUTIONARY), fat_percentage (number), "
            "snf_percentage (number), acidity_percentage (number), adulterant_status (POSITIVE, NEGATIVE, SUSPECTED), "
            "adulterant_findings, description.\n"
            f"Current form state: {json.dumps(current_form)}\n"
            f"User input: {message}\n"
            "Return ONLY valid JSON."
        )
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0,
            response_format={"type": "json_object"},
        )
        content = completion.choices[0].message.content or "{}"
        parsed = json.loads(content)
        return parsed if isinstance(parsed, dict) else {}
    except Exception:
        return {}


def normalize_patch(raw_patch: dict[str, Any], current_form: dict[str, Any]) -> dict[str, Any]:
    """Step 2 of Copilot Graph: Normalizes types, infers batch defaults, and cleans values."""
    patch: dict[str, Any] = {}

    # Batch ID normalization
    if raw_patch.get("batch_id"):
        b_id = str(raw_patch["batch_id"]).strip().upper().replace(" ", "-")
        patch["batch_id"] = b_id

    effective_batch = patch.get("batch_id") or str(current_form.get("batch_id") or "").strip().upper()
    batch_defaults = KNOWN_BATCH_DEFAULTS.get(effective_batch, {})

    # Product Name
    if raw_patch.get("product_name"):
        patch["product_name"] = str(raw_patch["product_name"]).strip()
    elif "batch_id" in patch and not current_form.get("product_name"):
        patch["product_name"] = batch_defaults.get(
            "product_name",
            "FoodSync Fresh Malai Paneer 200g" if effective_batch.startswith("PAN") else "FoodSync Farm-Chilled Raw Milk",
        )

    # Facility / Store
    if raw_patch.get("facility_or_store"):
        patch["facility_or_store"] = str(raw_patch["facility_or_store"]).strip()
    elif "batch_id" in patch and not current_form.get("facility_or_store") and batch_defaults.get("facility_or_store"):
        patch["facility_or_store"] = batch_defaults["facility_or_store"]

    # Reporter Name & Role
    if raw_patch.get("reporter_name"):
        patch["reporter_name"] = str(raw_patch["reporter_name"]).strip()
    if raw_patch.get("reporter_role"):
        patch["reporter_role"] = str(raw_patch["reporter_role"]).strip()

    # Numeric lab parameters
    for num_key, max_val in [("fat_percentage", 100.0), ("snf_percentage", 100.0), ("acidity_percentage", 10.0)]:
        if raw_patch.get(num_key) is not None and str(raw_patch.get(num_key)).strip() != "":
            try:
                val = round(float(str(raw_patch[num_key]).replace("%", "").strip()), 2)
                if 0.0 <= val <= max_val:
                    patch[num_key] = val
            except (ValueError, TypeError):
                pass

    # Adulterant Status & Findings
    if raw_patch.get("adulterant_findings"):
        patch["adulterant_findings"] = str(raw_patch["adulterant_findings"]).strip()

    if raw_patch.get("adulterant_status"):
        st = str(raw_patch["adulterant_status"]).strip().upper()
        if st in {"POSITIVE", "NEGATIVE", "SUSPECTED", "NOT_TESTED", "NOT TESTED"}:
            patch["adulterant_status"] = "NOT_TESTED" if st == "NOT TESTED" else st

    # Severity
    if raw_patch.get("severity"):
        sev = str(raw_patch["severity"]).strip().upper()
        if sev in {"CRITICAL", "MAJOR", "PRECAUTIONARY"}:
            patch["severity"] = sev

    # Complaint Category
    if raw_patch.get("complaint_category"):
        patch["complaint_category"] = str(raw_patch["complaint_category"]).strip()

    # Description
    if raw_patch.get("description"):
        patch["description"] = str(raw_patch["description"]).strip()

    return patch


def validate_completeness(merged_form: dict[str, Any]) -> dict[str, Any]:
    """Step 3 of Copilot Graph: Checks required & forensic fields for completeness."""
    missing_required: list[str] = []
    filled_required: list[str] = []

    for key, label in REQUIRED_COMPLAINT_FIELDS:
        val = merged_form.get(key)
        if val is not None and str(val).strip() != "":
            filled_required.append(label)
        else:
            missing_required.append(label)

    filled_forensic: list[str] = []
    for key, label in FORENSIC_OPTIONAL_FIELDS:
        val = merged_form.get(key)
        if val is not None and str(val).strip() != "":
            filled_forensic.append(label)

    total_req = len(REQUIRED_COMPLAINT_FIELDS)
    score = round((len(filled_required) / total_req) * 100) if total_req else 100

    return {
        "is_complete": len(missing_required) == 0,
        "completeness_score": score,
        "filled_required": filled_required,
        "missing_fields": missing_required,
        "forensic_metrics_extracted": filled_forensic,
    }


def evaluate_safety_impact(merged_form: dict[str, Any]) -> dict[str, Any]:
    """Step 4: Evaluates whether this complaint should trigger a Smart Recall blast-radius preview."""
    severity = str(merged_form.get("severity") or "MAJOR").upper()
    adulterant_status = str(merged_form.get("adulterant_status") or "NEGATIVE").upper()
    findings = str(merged_form.get("adulterant_findings") or "").strip()
    batch_id = str(merged_form.get("batch_id") or "").strip().upper()

    requires_recall = severity in {"CRITICAL", "MAJOR"} or adulterant_status in {"POSITIVE", "SUSPECTED"}
    reason_text = findings or str(merged_form.get("description") or "Quality safety complaint filed")
    if len(reason_text) > 160:
        reason_text = reason_text[:157] + "..."

    return {
        "requires_recall_preview": requires_recall,
        "batch_id": batch_id or "MILK-101",
        "recommended_severity": severity if severity in {"CRITICAL", "MAJOR", "PRECAUTIONARY"} else "CRITICAL",
        "recall_reason": reason_text,
        "recommended_action": (
            f"Immediate Smart Recall blast-radius preview recommended for {batch_id or 'this batch'}."
            if requires_recall
            else "Standard quality log; no urgent recall required."
        ),
    }


def process_complaint_input(
    message: str,
    current_form: Optional[dict[str, Any]] = None,
    direct_json: Optional[dict[str, Any]] = None,
    source_filename: Optional[str] = None,
) -> dict[str, Any]:
    """
    Runs the complete AI Complaint Copilot workflow:
    extract_fields -> normalize_patch -> validate_completeness -> evaluate_safety_impact -> build_message
    """
    base_form = dict(current_form or {})

    # 1. Extract fields (deterministic + optional live LLM enrichment)
    det_patch = _extract_fields_deterministic(message, direct_json=direct_json)
    llm_patch = _try_llm_extract(message, base_form)
    combined_raw = {**llm_patch, **det_patch}  # deterministic takes precedence on exact numbers/codes
    engine_name = (
        "DairyTrace AI Copilot (Groq Llama-3.3 + Forensic Parser)"
        if llm_patch
        else "DairyTrace Smart Forensic Parser"
    )

    # 2. Normalize patch
    patch = normalize_patch(combined_raw, base_form)

    # 3. Merge into current form
    merged_form = {**base_form, **patch}
    extracted_fields = list(patch.keys())

    # 4. Validate completeness & safety impact
    completeness = validate_completeness(merged_form)
    safety_eval = evaluate_safety_impact(merged_form)

    # 5. Build friendly assistant message
    if source_filename:
        prefix = f"Analyzed report '{source_filename}' and auto-filled {len(extracted_fields)} field(s)"
    else:
        prefix = f"Analyzed your description and auto-filled {len(extracted_fields)} field(s)"

    if not extracted_fields:
        assistant_msg = (
            "I couldn't spot specific batch codes or lab numbers in that message. "
            "Try mentioning a Batch ID (like MILK-101 or PAN-201), Fat/SNF %, or what issue you observed."
        )
    elif completeness["is_complete"]:
        assistant_msg = (
            f"{prefix} ({', '.join(extracted_fields).replace('_', ' ')}). "
            "All required complaint fields are complete and ready to submit!"
        )
        if safety_eval["requires_recall_preview"]:
            assistant_msg += (
                f" Because a {merged_form.get('severity', 'HIGH')} safety issue was detected on "
                f"{merged_form.get('batch_id')}, you can immediately preview the Smart Recall blast radius."
            )
    else:
        missing_str = ", ".join(completeness["missing_fields"])
        assistant_msg = (
            f"{prefix}. Almost ready — please provide or confirm: {missing_str}."
        )

    return {
        "patch": patch,
        "merged_form": merged_form,
        "extracted_fields": extracted_fields,
        "completeness": completeness,
        "safety_evaluation": safety_eval,
        "assistant_message": assistant_msg,
        "extraction_engine": engine_name,
        "raw_text_preview": message[:1500] if message else None,
        "source_filename": source_filename,
    }
