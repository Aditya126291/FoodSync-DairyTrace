"""Public Consumer Passport Endpoint (`GET /api/public/passport/{batch_id}`)."""

from datetime import timedelta
import json
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import not_

from app.database import get_db
from app.models import Batch, BatchLink, ComplaintRecord, QualityRecord, RecallEvent
from app.services.qr_service import get_passport_url

router = APIRouter(tags=["Public Consumer Passport"])

TRUST_RANK = {
    "VERIFIED": 3,
    "DOCUMENT_CHECKED": 2,
    "SUPPLIER_ENTERED": 1,
}


@router.get("/public/passport/{batch_id}")
def get_public_consumer_passport(batch_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    """
    Publicly accessible consumer batch passport.
    Strips internal financial, retail contact, and private supplier PII;
    returns consumer-friendly transparency metrics, origin breakdown, and FSSAI compliance badge.
    """
    batch = db.query(Batch).filter_by(id=batch_id).first()
    if not batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Batch '{batch_id}' not found.",
        )

    # Trace parent raw milk origins (1st and 2nd+ hop upstream, cycle-safe)
    parent_links = (
        db.query(BatchLink)
        .filter_by(child_batch_id=batch_id)
        .order_by(BatchLink.id.asc())
        .all()
    )

    all_upstream_ids: list[str] = []
    origin_leaves: list[tuple[str, float, str]] = []  # (source_batch_id, effective_qty, unit)

    def _collect_origins(curr_links: list[BatchLink], visited_path: set[str]) -> None:
        for lnk in curr_links:
            pid = lnk.parent_batch_id
            if pid not in all_upstream_ids:
                all_upstream_ids.append(pid)
            if pid in visited_path:
                origin_leaves.append((pid, float(lnk.quantity_used), lnk.unit))
                continue
            grand_links = (
                db.query(BatchLink)
                .filter_by(child_batch_id=pid)
                .order_by(BatchLink.id.asc())
                .all()
            )
            if grand_links:
                _collect_origins(grand_links, visited_path | {pid})
            else:
                origin_leaves.append((pid, float(lnk.quantity_used), lnk.unit))

    if parent_links:
        _collect_origins(parent_links, {batch_id})

    total_input_qty = sum(qty for _, qty, _ in origin_leaves) or 0.0
    origin_breakdown = []
    origins_ui = []
    if origin_leaves:
        for src_id, qty_used, unit in origin_leaves:
            parent_batch = db.query(Batch).filter_by(id=src_id).first()
            pct = round((qty_used / total_input_qty) * 100.0, 1) if total_input_qty > 0 else 100.0
            facility_str = parent_batch.facility_name if parent_batch else "Verified Dairy Cooperative"
            origin_breakdown.append({
                "origin_facility": facility_str,
                "source_batch_code": src_id,
                "contribution_percentage": pct,
                "unit": unit,
                "collection_date": (
                    parent_batch.production_date.isoformat()
                    if parent_batch and parent_batch.production_date
                    else None
                ),
            })
            origins_ui.append({
                "source": facility_str,
                "contribution_liters": qty_used,
                "percentage": pct,
            })
    else:
        origin_breakdown.append({
            "origin_facility": batch.facility_name,
            "source_batch_code": batch.id,
            "contribution_percentage": 100.0,
            "unit": "L" if batch.product_type == "MILK" else "KG",
            "collection_date": batch.production_date.isoformat() if batch.production_date else None,
        })
        origins_ui.append({
            "source": batch.facility_name,
            "contribution_liters": batch.initial_quantity,
            "percentage": 100.0,
        })

    # Fetch quality records for this batch and any upstream parents
    direct_quality_records = (
        db.query(QualityRecord)
        .filter_by(batch_id=batch_id)
        .order_by(QualityRecord.test_date.desc(), QualityRecord.id.desc())
        .all()
    )
    upstream_quality_records = (
        db.query(QualityRecord)
        .filter(QualityRecord.batch_id.in_(all_upstream_ids))
        .order_by(QualityRecord.test_date.desc(), QualityRecord.id.desc())
        .all()
        if all_upstream_ids
        else []
    )
    quality_records = direct_quality_records if direct_quality_records else upstream_quality_records
    all_related_quality = direct_quality_records + upstream_quality_records
    related_batch_ids = [batch_id, *all_upstream_ids]
    active_safety_complaints = (
        db.query(ComplaintRecord)
        .filter(ComplaintRecord.batch_id.in_(related_batch_ids))
        .filter(not_(ComplaintRecord.status.in_(["RESOLVED", "CLOSED", "REJECTED"])))
        .all()
    )
    reported_safety_statuses = [
        (item.adulterant_status or "NOT_TESTED").upper() for item in active_safety_complaints
    ]

    highest_trust = "UNVERIFIED"
    latest_fat = 22.5 if batch.product_type == "PANEER" else 4.5
    latest_snf = 28.0 if batch.product_type == "PANEER" else 8.6
    latest_acidity = 0.18 if batch.product_type == "PANEER" else 0.14
    # Absence of a quality record is not evidence of a clean test.
    adulterant_status = "NOT_TESTED"
    accredited_lab = "FoodSync Quality Assurance Lab"

    if quality_records:
        best_record = max(quality_records, key=lambda r: TRUST_RANK.get(r.trust_level, 0))
        highest_trust = best_record.trust_level
        latest_fat = best_record.fat_percentage
        latest_snf = best_record.snf_percentage
        latest_acidity = best_record.acidity
        accredited_lab = best_record.lab_name

    result_rank = {"NOT_TESTED": 0, "NEGATIVE": 1, "SUSPECTED": 2, "POSITIVE": 3}
    observed_statuses = [
        (r.adulterant_test or "NOT_TESTED").upper() for r in all_related_quality
    ] + reported_safety_statuses
    if observed_statuses:
        adulterant_status = max(observed_statuses, key=lambda value: result_rank.get(value, 2))
    if any(status in {"POSITIVE", "SUSPECTED"} for status in reported_safety_statuses):
        # A submitted complaint must not inherit the verified badge from an older test.
        highest_trust = "SUPPLIER_ENTERED"

    is_safe = batch.status == "ACTIVE" and adulterant_status == "NEGATIVE"
    if batch.status == "RECALLED":
        verification_badge = "ACTIVE FOOD RECALL — DO NOT CONSUME"
        compliance_status = "NON_COMPLIANT_RECALLED"
        purity_score = None
        # Check if there is an active recall event with a specific hazard reason
        active_recall = (
            db.query(RecallEvent)
            .order_by(RecallEvent.created_at.desc(), RecallEvent.id.desc())
            .all()
        )
        matched_reason = None
        for ev in active_recall:
            try:
                aff = json.loads(ev.affected_batches_json or "[]")
            except (json.JSONDecodeError, TypeError):
                aff = []
            if ev.root_batch_id == batch.id or batch.id in aff:
                matched_reason = ev.reason
                break
        contaminant_warning = (
            f"URGENT: This batch has been recalled by Food Safety Officer ({matched_reason}). Do not consume."
            if matched_reason
            else "URGENT: This batch has been recalled by Food Safety Officer. Do not consume."
        )
    elif batch.status == "QUARANTINED":
        verification_badge = "PRECAUTIONARY HOLD — UNDER QA REVIEW"
        compliance_status = "UNDER_QUARANTINE_REVIEW"
        purity_score = None
        contaminant_warning = "Batch is currently on precautionary quarantine hold pending laboratory verification."
    else:
        compliance_status = "COMPLIANT" if adulterant_status == "NEGATIVE" else "NOT_VERIFIED"
        if adulterant_status == "NEGATIVE":
            verification_badge = "Quality Screen Passed"
            purity_score = 99.4
            contaminant_warning = None
        elif adulterant_status == "POSITIVE":
            verification_badge = "CONTAMINATION ALERT — DO NOT CONSUME"
            purity_score = None
            contaminant_warning = "ALERT: Positive adulteration/contaminant screen detected. Do not consume this batch."
        elif adulterant_status == "SUSPECTED":
            verification_badge = "PRECAUTIONARY ALERT — UNDER REVIEW"
            purity_score = None
            contaminant_warning = "A contamination concern has been reported. Avoid consuming this batch while it is reviewed."
        else:
            verification_badge = "Quality Testing Not Recorded"
            purity_score = None
            contaminant_warning = "No adulterant test result is recorded for this batch. Check with the supplier before consuming."

    product_display_name = (
        "FoodSync Fresh Malai Paneer"
        if batch.product_type == "PANEER"
        else "FoodSync Farm-Chilled Raw Milk"
    )
    if batch.status == "RECALLED" or adulterant_status == "POSITIVE":
        adulterant_screen_str = "ALERT: FAILED"
    elif batch.status == "QUARANTINED":
        adulterant_screen_str = "UNDER QA HOLD"
    elif adulterant_status == "SUSPECTED":
        adulterant_screen_str = "SUSPECTED — UNDER REVIEW"
    elif adulterant_status == "NOT_TESTED":
        adulterant_screen_str = "NOT TESTED"
    else:
        adulterant_screen_str = "PASSED"

    expiry_dt = batch.expiry_date
    if expiry_dt is None and batch.production_date is not None:
        expiry_dt = batch.production_date + timedelta(days=2 if batch.product_type == "MILK" else 14)

    return {
        "id": batch.id,
        "batch_id": batch.id,
        "product_type": batch.product_type,
        "product_name": product_display_name,
        "brand_name": "FoodSync DairyPure",
        "facility_name": batch.facility_name,
        "manufacture_date": batch.production_date.isoformat() if batch.production_date else None,
        "production_date": batch.production_date.isoformat() if batch.production_date else None,
        "expiry_date": expiry_dt.isoformat() if expiry_dt else None,
        "status": batch.status,
        "is_safe": is_safe,
        "fssai_compliant": is_safe,
        "fssai_licence_number": "11526034000981",
        "fssai_compliance_status": compliance_status,
        "quality_compliance_status": compliance_status,
        "verification_badge": verification_badge,
        "pasteurization_status": "Pasteurized & Homogenized (HTST 72°C / 15s)",
        "trust_tier": highest_trust,
        "trust_badge": highest_trust,
        "purity_score": purity_score,
        "fat_percentage": latest_fat,
        "snf_percentage": latest_snf,
        "acidity_percentage": latest_acidity,
        "adulterant_screen": adulterant_screen_str,
        "adulterant_status": adulterant_status,
        "lab_signoff": accredited_lab,
        "contaminant_warning": contaminant_warning,
        "quality_highlights": {
            "fat_percentage": latest_fat,
            "snf_percentage": latest_snf,
            "acidity_percentage": latest_acidity,
            "adulterant_screen": adulterant_screen_str,
            "verified_by_lab": accredited_lab,
            "trust_level": highest_trust,
            "tests_conducted_count": len(all_related_quality),
        },
        "raw_milk_origin_breakdown": origin_breakdown,
        "origins": origins_ui,
        "passport_url": get_passport_url(batch.id),
    }
