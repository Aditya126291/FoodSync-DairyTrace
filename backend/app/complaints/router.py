"""Complaint workspace API: AI copilot intake, commit, and the staff Saved Complaints ledger.

Public (no login, rate-limited): batch context, copilot process/upload, commit.
Staff only: list / read / edit / status change. QA officer only: delete.
"""

from __future__ import annotations

import datetime
import json
import uuid
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.audit import write_audit
from app.database import get_db
from app.models import Batch, ComplaintRecord, User
from app.security import get_optional_user, rate_limit, require_qa, require_staff

from .agent import run_intake
from .documents import MAX_UPLOAD_BYTES, extract_uploaded_document
from .extract import LOCKED_FIELDS, classify, default_risk, normalize_priority, normalize_severity
from .schemas import (
    CommitRequest,
    ComplaintForm,
    CopilotRequest,
    CopilotResponse,
    StatusUpdate,
    UploadedDocumentResponse,
)

router = APIRouter(tags=["Complaints"])

STATUSES = ["Committed", "Under review", "Recall triggered", "Resolved"]
CLOSED_STATUSES = ("Resolved",)
AUTO_FLAG_REPORTERS = 3
DUPLICATE_WINDOW = datetime.timedelta(hours=24)

ai_limit = Depends(rate_limit("ai", 20, 600))
commit_limit = Depends(rate_limit("commit", 10, 600))


def _fmt(dt: datetime.datetime | None) -> str:
    return dt.strftime("%d %B %Y") if dt else ""


def _get_batch(db: Session, batch_id: str) -> Batch:
    batch = db.query(Batch).filter(Batch.id == (batch_id or "").strip().upper()).first()
    if not batch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Batch '{batch_id}' was not found.")
    return batch


def batch_context(batch: Batch) -> dict[str, str]:
    """Fields derived from the scanned batch. These are locked in the UI and enforced on commit."""
    product = "Fresh Malai Paneer" if batch.product_type == "PANEER" else "Farm-Chilled Raw Milk"
    return {
        "productName": product,
        "batchLotNumber": batch.id,
        "manufacturingDate": _fmt(batch.production_date),
        "expiryDate": _fmt(batch.expiry_date) or "Not recorded",
        "originatingSite": batch.facility_name or "",
    }


def _open_reports_for(db: Session, batch_id: str):
    return db.query(ComplaintRecord).filter(
        ComplaintRecord.batch_id == batch_id, ~ComplaintRecord.status.in_(CLOSED_STATUSES)
    )


def batch_defaults(batch: Batch) -> dict[str, str]:
    """Editable defaults derived from the batch's latest quality record."""
    if batch.quality_records:
        latest = batch.quality_records[0]
        return {
            "strengthGrade": f"Fat {latest.fat_percentage:g}%, SNF {latest.snf_percentage:g}%",
        }
    return {"strengthGrade": ""}


@router.get("/complaints/context/{batch_id}")
def get_batch_context(batch_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    batch = _get_batch(db, batch_id)
    return {
        "batchId": batch.id,
        "productType": batch.product_type,
        "locked": batch_context(batch),
        "defaults": batch_defaults(batch),
        "otherReports": _open_reports_for(db, batch.id).count(),
    }


def _result_to_response(result: dict[str, Any]) -> dict[str, Any]:
    return {
        "message": result["summary"],
        "patch": {k: str(v) for k, v in result.get("patch", {}).items() if k not in LOCKED_FIELDS},
        "missingFields": result.get("missing_fields", []),
        "risk": result.get("risk"),
        "rootCause": result.get("root_cause"),
        "capaRecommendations": result.get("capa_recommendations", []),
        "engine": result.get("engine", "rule-based"),
    }


@router.post("/copilot/process", response_model=CopilotResponse, dependencies=[ai_limit])
def process_copilot(request: CopilotRequest, db: Session = Depends(get_db)) -> dict[str, Any]:
    batch = _get_batch(db, request.batchId)
    form = {**batch_defaults(batch), **request.current_form.model_dump(), **batch_context(batch)}
    return _result_to_response(run_intake(request.text, form))


@router.post("/copilot/upload", response_model=UploadedDocumentResponse, dependencies=[ai_limit])
async def process_uploaded_document(
    batchId: str = Form(...),
    file: UploadFile = File(...),
    current_form: str = Form(default="{}"),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Choose a complaint document to upload.")
    batch = _get_batch(db, batchId)
    data = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="The file is larger than the 10 MB upload limit.")
    try:
        parsed_form = ComplaintForm.model_validate_json(current_form)
    except ValidationError as error:
        raise HTTPException(status_code=422, detail="The existing complaint form is invalid.") from error

    text, truncated = extract_uploaded_document(file.filename, data)
    seed_form = {
        **batch_defaults(batch),
        "customerName": parsed_form.customerName,
        "complaintSource": parsed_form.complaintSource,
        **batch_context(batch),
    }
    if parsed_form.strengthGrade:
        seed_form["strengthGrade"] = parsed_form.strengthGrade
    result = run_intake(text, seed_form)
    return {
        **_result_to_response(result),
        "message": result.get("summary") or "Extracted complaint document details into the form.",
        "sourceFile": file.filename,
        "extractedCharacters": len(text),
        "textTruncated": truncated,
    }


def _number_for(record_id: int) -> str:
    """CC-YYYY-NNNN derived from the monotonic row id, so numbers are unique and never reused."""
    return f"CC-{datetime.datetime.now().year}-{record_id:04d}"


def _apply_form(record: ComplaintRecord, form: ComplaintForm) -> None:
    record.customer_name = form.customerName.strip()
    record.complaint_source = form.complaintSource.strip()
    record.strength_grade = form.strengthGrade.strip()
    record.affected_quantity = form.affectedQuantity.strip()
    record.impacted_material = form.impactedMaterial.strip()
    record.complaint_type = form.complaintType.strip()
    record.defect_summary = form.defectSummary.strip()
    record.detailed_description = form.detailedDescription.strip()


@router.post("/complaints/commit", status_code=status.HTTP_201_CREATED, dependencies=[commit_limit])
def commit_complaint(
    request: CommitRequest,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
) -> dict[str, Any]:
    batch = _get_batch(db, request.batchId)
    form = request.form
    narrative = f"{form.defectSummary} {form.detailedDescription}".strip()
    if len(narrative) < 5:
        raise HTTPException(status_code=422, detail="Describe the problem before saving the complaint.")

    # Duplicate rule: same batch + same reporter + same complaint type within 24h.
    # (Different people reporting the same batch is a safety signal and is always accepted.)
    reporter = form.customerName.strip().lower()
    if reporter:
        cutoff = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None) - DUPLICATE_WINDOW
        dup = (
            db.query(ComplaintRecord)
            .filter(ComplaintRecord.batch_id == batch.id, ComplaintRecord.created_at >= cutoff)
            .all()
        )
        for rec in dup:
            if (rec.customer_name or "").strip().lower() == reporter and (rec.complaint_type or "").strip().lower() == form.complaintType.strip().lower():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Duplicate complaint detected: record {rec.complaint_number} from the same reporter for this batch and issue was filed in the last 24 hours.",
                )

    ctx = batch_context(batch)
    label, sev, pri, root, capa = classify(narrative)
    risk = request.risk or form.riskAssessment or default_risk(narrative)
    record = ComplaintRecord(
        complaint_number=f"PENDING-{uuid.uuid4().hex[:12]}",
        batch_id=batch.id,
        customer_name="",
        product_name=ctx["productName"],
        batch_lot_number=batch.id,
        manufacturing_date=ctx["manufacturingDate"],
        expiry_date=ctx["expiryDate"],
        originating_site=ctx["originatingSite"],
        complaint_date=form.complaintDate.strip() or datetime.date.today().strftime("%d %B %Y"),
        severity=normalize_severity(form.severity, narrative),
        priority=normalize_priority(form.priority, narrative),
        risk_assessment=risk,
        root_cause=request.rootCause or root,
        capa_json=request.capaRecommendations or capa,
        status="Committed",
        reporter_user_id=user.id if user else None,
    )
    _apply_form(record, form)
    if not record.complaint_source:
        record.complaint_source = user.role.replace("_", " ").title() if user else "Consumer"
    if not record.complaint_type:
        record.complaint_type = label
    if user and not record.customer_name:
        record.customer_name = user.full_name
    db.add(record)
    db.flush()
    record.complaint_number = _number_for(record.id)
    db.flush()

    # Safety signal: several independent reporters on one open batch -> flag for staff review.
    open_reports = _open_reports_for(db, batch.id).all()
    reporters = {(r.customer_name or f"anon-{r.id}").strip().lower() for r in open_reports}
    flagged = len(reporters) >= AUTO_FLAG_REPORTERS
    if flagged:
        for rec in open_reports:
            if rec.status == "Committed":
                rec.status = "Under review"
    write_audit(db, user, "COMPLAINT_FILED", "complaint", record.complaint_number, f"batch {batch.id}")
    db.commit()
    db.refresh(record)
    return {**record.to_dict(), "otherReports": max(len(open_reports) - 1, 0), "autoFlagged": flagged}


# ---------------------------------------------------------------- staff ledger
@router.get("/complaints")
def list_complaints(
    batch_id: str | None = Query(default=None),
    complaint_status: str | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    _: User = Depends(require_staff),
) -> list[dict[str, Any]]:
    query = db.query(ComplaintRecord)
    if batch_id:
        query = query.filter(ComplaintRecord.batch_id == batch_id.strip().upper())
    if complaint_status:
        query = query.filter(ComplaintRecord.status == complaint_status)
    return [r.to_dict() for r in query.order_by(ComplaintRecord.created_at.desc(), ComplaintRecord.id.desc()).all()]


def _get_record(db: Session, complaint_id: int) -> ComplaintRecord:
    record = db.query(ComplaintRecord).filter(ComplaintRecord.id == complaint_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Complaint not found.")
    return record


@router.get("/complaints/{complaint_id}")
def get_complaint(complaint_id: int, db: Session = Depends(get_db), _: User = Depends(require_staff)) -> dict[str, Any]:
    return _get_record(db, complaint_id).to_dict()


@router.put("/complaints/{complaint_id}")
def update_complaint(
    complaint_id: int,
    request: CommitRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff),
) -> dict[str, Any]:
    record = _get_record(db, complaint_id)
    form = request.form
    _apply_form(record, form)
    record.complaint_date = form.complaintDate.strip() or record.complaint_date
    record.severity = normalize_severity(form.severity, form.detailedDescription)
    record.priority = normalize_priority(form.priority, form.detailedDescription)
    if request.risk or form.riskAssessment:
        record.risk_assessment = request.risk or form.riskAssessment
    if request.rootCause:
        record.root_cause = request.rootCause
    if request.capaRecommendations:
        record.capa_json = request.capaRecommendations
    write_audit(db, user, "COMPLAINT_EDITED", "complaint", record.complaint_number)
    db.commit()
    db.refresh(record)
    return record.to_dict()


@router.patch("/complaints/{complaint_id}/status")
def update_complaint_status(
    complaint_id: int,
    payload: StatusUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff),
) -> dict[str, Any]:
    if payload.status not in STATUSES:
        raise HTTPException(status_code=422, detail=f"Status must be one of: {', '.join(STATUSES)}.")
    record = _get_record(db, complaint_id)
    record.status = payload.status
    write_audit(db, user, "COMPLAINT_STATUS", "complaint", record.complaint_number, payload.status)
    db.commit()
    db.refresh(record)
    return record.to_dict()


@router.delete("/complaints/{complaint_id}")
def delete_complaint(complaint_id: int, db: Session = Depends(get_db), user: User = Depends(require_qa)) -> dict[str, str]:
    record = _get_record(db, complaint_id)
    number = record.complaint_number
    db.delete(record)
    write_audit(db, user, "COMPLAINT_DELETED", "complaint", number)
    db.commit()
    return {"status": "success", "message": f"Complaint {number} deleted."}
