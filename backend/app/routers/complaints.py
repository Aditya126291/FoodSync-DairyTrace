"""Customer, Retailer & Forensic Complaint Management + AI Copilot Endpoints."""

import json
import uuid
from typing import Any, Literal, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Batch, ComplaintRecord, QualityRecord
from app.schemas import (
    ComplaintCreate,
    ComplaintResponse,
    CopilotProcessRequest,
    CopilotProcessResponse,
)
from app.services.complaint_copilot import (
    extract_text_from_upload,
    generate_sample_report_bytes,
    list_sample_reports,
    process_complaint_input,
)

router = APIRouter(tags=["Complaints & Forensic Copilot"])

MAX_REPORT_BYTES = 10 * 1024 * 1024


def _serialize_complaint(record: ComplaintRecord, db: Session) -> dict[str, Any]:
    data = record.to_dict()
    batch_exists = db.query(Batch.id).filter_by(id=record.batch_id).first() is not None
    data["batch_exists"] = batch_exists
    data["safety_alert_recommended"] = (
        record.severity in {"CRITICAL", "MAJOR"}
        or record.adulterant_status in {"POSITIVE", "SUSPECTED"}
    )
    return data


def _next_complaint_ref(db: Session) -> str:
    count = db.query(ComplaintRecord).count()
    candidate = f"CMP-2026-{count + 1:04d}"
    if db.query(ComplaintRecord).filter_by(complaint_ref=candidate).first():
        candidate = f"CMP-2026-{uuid.uuid4().hex[:6].upper()}"
    return candidate


@router.post("/copilot/process", response_model=CopilotProcessResponse)
@router.post("/complaints/parse-text", response_model=CopilotProcessResponse)
def process_natural_language_complaint(payload: CopilotProcessRequest) -> dict[str, Any]:
    """
    Analyzes natural language complaint text or conversational field edits and returns
    a form patch, merged form state, completeness validation, and safety evaluation.
    """
    return process_complaint_input(
        message=payload.message,
        current_form=payload.current_form or {},
    )


@router.post("/copilot/upload", response_model=CopilotProcessResponse)
@router.post("/complaints/parse-report", response_model=CopilotProcessResponse)
async def parse_uploaded_forensic_report(
    file: UploadFile = File(...),
    current_form: Optional[str] = Form(default="{}"),
) -> dict[str, Any]:
    """
    Parses an uploaded forensic or dairy quality report (.pdf, .docx, .txt, .json, .eml)
    and extracts structured complaint & laboratory fields to auto-fill the form.
    """
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="Please select a report file to upload.")

    raw_bytes = await file.read(MAX_REPORT_BYTES + 1)
    if len(raw_bytes) > MAX_REPORT_BYTES:
        raise HTTPException(status_code=413, detail="Uploaded report must be 10 MB or smaller.")
    if len(raw_bytes) == 0:
        raise HTTPException(status_code=400, detail="The uploaded report file is empty.")

    try:
        parsed_form = json.loads(current_form or "{}") if current_form else {}
        if not isinstance(parsed_form, dict):
            parsed_form = {}
    except json.JSONDecodeError:
        parsed_form = {}

    try:
        extracted_text, direct_json = extract_text_from_upload(
            filename=file.filename,
            content_bytes=raw_bytes,
            content_type=file.content_type or "",
        )
    except ValueError as exc:
        msg = str(exc)
        code = 415 if "Unsupported" in msg else 400
        raise HTTPException(status_code=code, detail=msg) from exc

    return process_complaint_input(
        message=extracted_text,
        current_form=parsed_form,
        direct_json=direct_json,
        source_filename=file.filename,
    )


@router.get("/complaints/sample-reports")
def get_sample_forensic_reports() -> list[dict[str, Any]]:
    """Lists downloadable sample forensic and dairy check reports for instant demo testing."""
    return list_sample_reports()


@router.get("/complaints/sample-reports/{sample_id}/download")
def download_sample_forensic_report(sample_id: str) -> Response:
    """Downloads a generated sample forensic report (.pdf, .docx, .txt, .json)."""
    try:
        content_bytes, filename, mime_type = generate_sample_report_bytes(sample_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return Response(
        content=content_bytes,
        media_type=mime_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


@router.post("/complaints", response_model=ComplaintResponse, status_code=status.HTTP_201_CREATED)
def create_complaint(payload: ComplaintCreate, db: Session = Depends(get_db)) -> dict[str, Any]:
    """
    Persists a submitted complaint (Manual, Natural Language, or Report Upload) to the
    Complaints Ledger and optionally attaches a corresponding lab QualityRecord if forensic
    metrics (Fat %, SNF %, Acidity %) were provided for a registered batch.
    """
    complaint_ref = _next_complaint_ref(db)
    ai_summary = payload.ai_summary
    if not ai_summary:
        metrics_parts = []
        if payload.fat_percentage is not None:
            metrics_parts.append(f"Fat {payload.fat_percentage}%")
        if payload.snf_percentage is not None:
            metrics_parts.append(f"SNF {payload.snf_percentage}%")
        if payload.acidity_percentage is not None:
            metrics_parts.append(f"Acidity {payload.acidity_percentage}%")
        metrics_str = f" ({', '.join(metrics_parts)})" if metrics_parts else ""
        ai_summary = (
            f"[{payload.severity}] {payload.complaint_category} on {payload.batch_id}{metrics_str} — "
            f"Adulterant: {payload.adulterant_status}."
        )

    record = ComplaintRecord(
        complaint_ref=complaint_ref,
        batch_id=payload.batch_id,
        product_name=payload.product_name or "DairyTrace Product",
        reporter_name=payload.reporter_name,
        reporter_role=payload.reporter_role,
        facility_or_store=payload.facility_or_store,
        complaint_category=payload.complaint_category,
        severity=payload.severity,
        status="OPEN",
        fat_percentage=payload.fat_percentage,
        snf_percentage=payload.snf_percentage,
        acidity_percentage=payload.acidity_percentage,
        adulterant_status=payload.adulterant_status,
        adulterant_findings=payload.adulterant_findings,
        description=payload.description,
        intake_mode=payload.intake_mode,
        source_report_name=payload.source_report_name,
        ai_summary=ai_summary,
    )
    db.add(record)

    # If the batch exists and full numeric lab metrics were provided, also attach a QualityRecord
    batch = db.query(Batch).filter_by(id=payload.batch_id).first()
    if (
        batch
        and payload.record_quality_check
        and payload.fat_percentage is not None
        and payload.snf_percentage is not None
        and payload.acidity_percentage is not None
    ):
        # A user-uploaded file or manually entered values are not lab-authenticated
        # just because a report parser could read them.
        trust_tier = "SUPPLIER_ENTERED"
        q_record = QualityRecord(
            batch_id=batch.id,
            lab_name=f"{payload.reporter_name} ({payload.facility_or_store})"[:120],
            fat_percentage=payload.fat_percentage,
            snf_percentage=payload.snf_percentage,
            acidity=payload.acidity_percentage,
            adulterant_test=payload.adulterant_status,
            contaminant_details=payload.adulterant_findings or payload.description,
            trust_level=trust_tier,
            certificate_url=(
                f"/api/complaints/{complaint_ref}/report"
                if payload.source_report_name
                else None
            ),
        )
        db.add(q_record)

    db.commit()
    db.refresh(record)
    return _serialize_complaint(record, db)


@router.get("/complaints", response_model=list[ComplaintResponse])
def list_complaints(
    batch_id: Optional[str] = Query(default=None),
    severity: Optional[str] = Query(default=None),
    intake_mode: Optional[str] = Query(default=None),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    """Lists all committed complaints in the Complaints Ledger with optional filters."""
    query = db.query(ComplaintRecord)
    if batch_id and batch_id.upper() != "ALL":
        query = query.filter(ComplaintRecord.batch_id == batch_id.strip().upper())
    if severity and severity.upper() != "ALL":
        query = query.filter(ComplaintRecord.severity == severity.strip().upper())
    if intake_mode and intake_mode.upper() != "ALL":
        query = query.filter(ComplaintRecord.intake_mode == intake_mode.strip().upper())
    if status_filter and status_filter.upper() != "ALL":
        query = query.filter(ComplaintRecord.status == status_filter.strip().upper())

    records = query.order_by(ComplaintRecord.created_at.desc(), ComplaintRecord.id.desc()).limit(200).all()
    return [_serialize_complaint(r, db) for r in records]


@router.get("/complaints/{complaint_id}", response_model=ComplaintResponse)
def get_complaint(complaint_id: int, db: Session = Depends(get_db)) -> dict[str, Any]:
    """Fetches a single complaint dossier by ID."""
    record = db.query(ComplaintRecord).filter_by(id=complaint_id).first()
    if not record:
        raise HTTPException(status_code=404, detail=f"Complaint #{complaint_id} not found.")
    return _serialize_complaint(record, db)


class ComplaintStatusUpdate(BaseModel):
    status: Literal["OPEN", "UNDER_REVIEW", "RECALL_TRIGGERED", "RESOLVED"]


@router.patch("/complaints/{complaint_id}/status", response_model=ComplaintResponse)
def update_complaint_status(
    complaint_id: int,
    payload: ComplaintStatusUpdate,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Updates the resolution or recall status of a complaint."""
    record = db.query(ComplaintRecord).filter_by(id=complaint_id).first()
    if not record:
        raise HTTPException(status_code=404, detail=f"Complaint #{complaint_id} not found.")
    record.status = payload.status
    db.commit()
    db.refresh(record)
    return _serialize_complaint(record, db)
