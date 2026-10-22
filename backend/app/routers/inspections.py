"""Manual security inspection and evidence endpoints."""

import hashlib
import json
import uuid
from pathlib import Path
from typing import Literal, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from PIL import Image, UnidentifiedImageError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Batch, SecurityInspection, User
from app.audit import write_audit
from app.security import require_staff
from app.schemas import SecurityInspectionResponse

router = APIRouter(tags=["Security Inspections"])
UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads" / "security_inspections"
MAX_EVIDENCE_BYTES = 10 * 1024 * 1024
ALLOWED_MIME_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}


def _response(record: SecurityInspection) -> dict:
    result = record.to_dict()
    result["evidence_url"] = f"/api/inspections/{record.id}/evidence" if record.evidence_filename else None
    result.pop("evidence_filename", None)
    result.pop("evidence_mime_type", None)
    return result


@router.post(
    "/batches/{batch_id}/inspections",
    response_model=SecurityInspectionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_inspection(
    batch_id: str,
    tamper_seal_condition: Literal["INTACT", "BROKEN", "SUSPICIOUS", "NA"] = Form(...),
    seal_serial_number: Optional[str] = Form(default=None, max_length=100),
    packaging_status: Literal["NORMAL", "DAMAGED", "RESEALED"] = Form(...),
    expected_quantity: float = Form(..., ge=0),
    actual_quantity: float = Form(..., ge=0),
    temperature_c: float = Form(..., ge=-50, le=100),
    humidity_percent: float = Form(..., ge=0, le=100),
    cold_chain_compliant: bool = Form(...),
    verdict: Literal["PASSED", "FLAGGED", "REJECTED"] = Form(...),
    notes: str = Form(default="", max_length=5000),
    inspector_name: Optional[str] = Form(default=None, max_length=100),  # ignored: identity comes from the login token
    evidence: Optional[UploadFile] = File(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(require_staff),
):
    """Persist an inspector's physical security check and optional photo evidence."""
    batch = db.query(Batch).filter_by(id=batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail=f"Batch '{batch_id}' not found.")

    if not (0 <= float(humidity_percent) <= 100) or not (-50 <= float(temperature_c) <= 100) or float(expected_quantity) < 0 or float(actual_quantity) < 0:
        raise HTTPException(status_code=422, detail="Inspection measurements are outside valid ranges.")

    evidence_bytes = None
    evidence_mime = None
    evidence_digest = None
    saved_path = None
    evidence_filename = None
    if evidence and evidence.filename:
        evidence_mime = evidence.content_type or ""
        if evidence_mime not in ALLOWED_MIME_TYPES:
            raise HTTPException(status_code=415, detail="Evidence must be a JPEG, PNG, or WebP image.")
        evidence_bytes = await evidence.read(MAX_EVIDENCE_BYTES + 1)
        if len(evidence_bytes) > MAX_EVIDENCE_BYTES:
            raise HTTPException(status_code=413, detail="Evidence image must be 10 MB or smaller.")
        try:
            image = Image.open(__import__("io").BytesIO(evidence_bytes))
            if image.format not in {"JPEG", "PNG", "WEBP"}:
                raise ValueError("unsupported image format")
            image.verify()
        except (UnidentifiedImageError, OSError, ValueError) as exc:
            raise HTTPException(status_code=415, detail="The uploaded file is not a valid supported image.") from exc
        evidence_digest = hashlib.sha256(evidence_bytes).hexdigest()
        evidence_filename = f"{uuid.uuid4().hex}{ALLOWED_MIME_TYPES[evidence_mime]}"
        UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        saved_path = UPLOAD_DIR / evidence_filename
        saved_path.write_bytes(evidence_bytes)

    clean_name = f"{user.full_name} ({user.role})"[:100]
    if not clean_name:
        if saved_path:
            saved_path.unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail="Inspector name is required.")

    record = SecurityInspection(
        batch_id=batch_id,
        tamper_seal_condition=tamper_seal_condition,
        seal_serial_number=seal_serial_number.strip() if seal_serial_number and seal_serial_number.strip() else None,
        packaging_status=packaging_status,
        expected_quantity=expected_quantity,
        actual_quantity=actual_quantity,
        temperature_c=temperature_c,
        humidity_percent=humidity_percent,
        cold_chain_compliant=cold_chain_compliant,
        verdict=verdict,
        notes=notes.strip(),
        inspector_name=clean_name,
        evidence_filename=evidence_filename,
        evidence_mime_type=evidence_mime,
        evidence_sha256=evidence_digest,
        record_sha256="pending",
    )
    try:
        db.add(record)
        db.flush()
        canonical = {
            key: (value.isoformat() if hasattr(value, "isoformat") else value)
            for key, value in record.to_dict().items()
            if key not in {"record_sha256"}
        }
        record.record_sha256 = hashlib.sha256(
            json.dumps(canonical, sort_keys=True, separators=(",", ":")).encode("utf-8")
        ).hexdigest()
        write_audit(db, user, "INSPECTION_LOGGED", "batch", batch_id, verdict)
        db.commit()
        db.refresh(record)
    except Exception:
        db.rollback()
        if saved_path:
            saved_path.unlink(missing_ok=True)
        raise
    return _response(record)


@router.get("/inspections", response_model=list[SecurityInspectionResponse], dependencies=[Depends(require_staff)])
def list_inspections(batch_id: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(SecurityInspection)
    if batch_id:
        query = query.filter(SecurityInspection.batch_id == batch_id)
    return [_response(record) for record in query.order_by(SecurityInspection.created_at.desc(), SecurityInspection.id.desc()).limit(200).all()]


@router.get("/inspections/{inspection_id}/evidence", dependencies=[Depends(require_staff)])
def get_inspection_evidence(inspection_id: int, db: Session = Depends(get_db)):
    record = db.query(SecurityInspection).filter_by(id=inspection_id).first()
    if not record or not record.evidence_filename:
        raise HTTPException(status_code=404, detail="Inspection evidence not found.")
    path = (UPLOAD_DIR / record.evidence_filename).resolve()
    if path.parent != UPLOAD_DIR.resolve() or not path.is_file():
        raise HTTPException(status_code=404, detail="Inspection evidence file is missing.")
    return FileResponse(path, media_type=record.evidence_mime_type or "application/octet-stream")
