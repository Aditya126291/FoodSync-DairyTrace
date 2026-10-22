"""Quality & Evidence Endpoints with 3-Tier Trust Classification."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Batch, QualityRecord
from app.schemas import QualityRecordCreate, QualityRecordResponse

router = APIRouter(tags=["Quality & Evidence"])


@router.post("/quality", response_model=QualityRecordResponse, status_code=status.HTTP_201_CREATED)
def add_quality_record(payload: QualityRecordCreate, db: Session = Depends(get_db)):
    """Attaches a new quality testing record with a specific trust level (SUPPLIER_ENTERED, DOCUMENT_CHECKED, VERIFIED)."""
    batch = db.query(Batch).filter_by(id=payload.batch_id).first()
    if not batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Batch '{payload.batch_id}' not found.",
        )

    record = QualityRecord(
        batch_id=payload.batch_id,
        test_date=payload.test_date,
        lab_name=payload.lab_name,
        fat_percentage=payload.fat_percentage,
        snf_percentage=payload.snf_percentage,
        acidity=payload.acidity,
        adulterant_test=payload.adulterant_test,
        contaminant_details=payload.contaminant_details,
        trust_level=payload.trust_level,
        certificate_url=payload.certificate_url,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/quality/{batch_id}", response_model=list[QualityRecordResponse])
def get_batch_quality_records(batch_id: str, db: Session = Depends(get_db)):
    """Fetches all lab reports and trust indicators for a specific batch."""
    batch = db.query(Batch).filter_by(id=batch_id).first()
    if not batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Batch '{batch_id}' not found.",
        )

    return (
        db.query(QualityRecord)
        .filter_by(batch_id=batch_id)
        .order_by(QualityRecord.test_date.desc(), QualityRecord.id.desc())
        .all()
    )
