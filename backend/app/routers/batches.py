"""Batch, Genealogy Lineage, QR Code, and Distribution Endpoints."""

import random
import uuid
from typing import Any, Optional
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Batch, BatchLink, DistributionRecord, QualityRecord
from app.schemas import (
    BatchCreate,
    BatchLinkCreate,
    BatchResponse,
    DistributionRecordCreate,
    DistributionRecordResponse,
)
from app.services.qr_service import (
    generate_batch_qr_payload,
    generate_batch_qr_png,
    generate_batch_qr_svg,
)
from app.services.recall_engine import get_batch_lineage, would_create_cycle

router = APIRouter(tags=["Batches & Lineage"])


@router.get("/batches", response_model=list[BatchResponse])
def list_batches(
    product_type: Optional[str] = Query(default=None, description="Filter by MILK or PANEER"),
    batch_status: Optional[str] = Query(default=None, alias="status", description="Filter by ACTIVE, QUARANTINED, or RECALLED"),
    db: Session = Depends(get_db),
):
    """Returns all batches, with optional filtering by product_type and status."""
    query = db.query(Batch)
    if product_type and product_type.upper() != "ALL":
        query = query.filter(Batch.product_type == product_type.upper())
    if batch_status and batch_status.upper() != "ALL":
        query = query.filter(Batch.status == batch_status.upper())
    return query.order_by(Batch.created_at.asc(), Batch.id.asc()).all()


@router.post("/batches", response_model=BatchResponse, status_code=status.HTTP_201_CREATED)
def create_batch(payload: BatchCreate, db: Session = Depends(get_db)):
    """Creates a new raw milk or finished paneer batch and automatically designates its QR code."""
    batch_id = payload.id
    existing = db.query(Batch).filter_by(id=batch_id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Batch with id '{batch_id}' already exists.",
        )

    batch = Batch(
        id=batch_id,
        product_type=payload.product_type,
        initial_quantity=payload.initial_quantity,
        remaining_quantity=payload.remaining_quantity
        if payload.remaining_quantity is not None
        else payload.initial_quantity,
        facility_name=payload.facility_name,
        status=payload.status,
        production_date=payload.production_date,
        expiry_date=payload.expiry_date,
        sku=payload.sku.strip() if payload.sku else None,
        serial_number=payload.serial_number.strip() if payload.serial_number else None,
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)

    qr_payload = generate_batch_qr_payload(batch.id)
    batch.qr_code_url = f"/api/batches/{batch.id}/qr"
    batch.passport_url = qr_payload["passport_url"]
    batch.qr_code_base64 = qr_payload["qr_base64"]
    batch.qr_code_svg = qr_payload["qr_svg"]
    return batch


@router.post("/batches/random", response_model=BatchResponse, status_code=status.HTTP_201_CREATED)
def create_random_batch(
    product_type: Optional[str] = Query(default=None, description="MILK or PANEER (randomized if omitted)"),
    facility_name: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    """
    Randomly initiates a batch in the backend, creates its quality record,
    links upstream milk if paneer, and automatically designates a scannable QR code.
    """
    p_type = (
        product_type.upper().strip()
        if product_type and product_type.upper().strip() in ("MILK", "PANEER")
        else random.choice(["MILK", "PANEER"])
    )

    prefix = "MILK" if p_type == "MILK" else "PAN"
    for _ in range(50):
        candidate_id = f"{prefix}-{random.randint(400, 9999)}"
        if not db.query(Batch).filter_by(id=candidate_id).first():
            batch_id = candidate_id
            break
    else:
        batch_id = f"{prefix}-{uuid.uuid4().hex[:6].upper()}"

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if p_type == "MILK":
        facilities = [
            "Daund Village Collection Centre (Pune)",
            "Shirur Collection Centre",
            "Baramati Chilling Centre",
            "Junnar Collection Centre",
            "Purandar Dairy Hub",
        ]
        facility = facility_name or random.choice(facilities)
        initial_qty = float(random.choice([500, 600, 750, 850, 1000, 1200]))
        expiry = now + timedelta(days=2)
        sku = f"DT-MILK-{random.randint(10, 99)}"
        serial = f"SN-M{random.randint(10000, 99999)}"
        lab = "Pune Regional Dairy Quality Lab"
        fat = round(random.uniform(4.2, 4.8), 2)
        snf = round(random.uniform(8.5, 9.0), 2)
        acidity = round(random.uniform(0.13, 0.15), 2)
    else:
        facilities = [
            "FoodSync Central Dairy Plant, Pune",
            "Baramati Co-op Processing Unit",
        ]
        facility = facility_name or random.choice(facilities)
        initial_qty = float(random.choice([60, 80, 100, 120, 150]))
        expiry = now + timedelta(days=14)
        sku = f"DT-PAN-{random.randint(10, 99)}"
        serial = f"SN-P{random.randint(10000, 99999)}"
        lab = "FoodSync Central QA Lab, Pune"
        fat = round(random.uniform(23.5, 25.0), 2)
        snf = round(random.uniform(27.5, 28.5), 2)
        acidity = round(random.uniform(0.17, 0.19), 2)

    batch = Batch(
        id=batch_id,
        product_type=p_type,
        initial_quantity=initial_qty,
        remaining_quantity=initial_qty,
        facility_name=facility,
        status="ACTIVE",
        production_date=now,
        expiry_date=expiry,
        sku=sku,
        serial_number=serial,
    )
    db.add(batch)
    db.flush()

    if p_type == "PANEER":
        milk_batch = (
            db.query(Batch)
            .filter(Batch.product_type == "MILK", Batch.status == "ACTIVE")
            .order_by(Batch.remaining_quantity.desc())
            .first()
        )
        if milk_batch:
            qty_used = min(float(milk_batch.remaining_quantity), 400.0) if milk_batch.remaining_quantity > 0 else 400.0
            link = BatchLink(
                parent_batch_id=milk_batch.id,
                child_batch_id=batch.id,
                quantity_used=qty_used,
                unit="L",
            )
            milk_batch.remaining_quantity = max(0.0, round(milk_batch.remaining_quantity - qty_used, 4))
            db.add(link)

    q_record = QualityRecord(
        batch_id=batch.id,
        lab_name=lab,
        fat_percentage=fat,
        snf_percentage=snf,
        acidity=acidity,
        adulterant_test="NEGATIVE",
        contaminant_details="Certified batch release: negative for adulterants and antibiotic residues.",
        trust_level="VERIFIED",
    )
    db.add(q_record)
    db.commit()
    db.refresh(batch)

    qr_payload = generate_batch_qr_payload(batch.id)
    batch.qr_code_url = f"/api/batches/{batch.id}/qr"
    batch.passport_url = qr_payload["passport_url"]
    batch.qr_code_base64 = qr_payload["qr_base64"]
    batch.qr_code_svg = qr_payload["qr_svg"]
    return batch


@router.get("/batches/lookup", response_model=list[BatchResponse])
def lookup_batches(q: str = Query(..., min_length=1, max_length=120), db: Session = Depends(get_db)):
    """Search batch ID, SKU, or serial number for inspector lookup."""
    term = q.strip()
    if not term:
        return []
    pattern = f"%{term}%"
    return (
        db.query(Batch)
        .filter(or_(Batch.id.ilike(pattern), Batch.sku.ilike(pattern), Batch.serial_number.ilike(pattern)))
        .order_by(Batch.id.asc())
        .limit(25)
        .all()
    )


@router.post("/batches/link", status_code=status.HTTP_201_CREATED)
def link_batches(payload: BatchLinkCreate, db: Session = Depends(get_db)) -> dict[str, Any]:
    """Links one or more parent batches (Milk) to a child batch (Paneer)."""
    child_batch = db.query(Batch).filter_by(id=payload.child_batch_id).first()
    if not child_batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Child batch '{payload.child_batch_id}' not found.",
        )

    items_to_link = []
    if payload.parents:
        for p in payload.parents:
            items_to_link.append((p.parent_batch_id, p.quantity_used, p.unit))
    elif payload.parent_batch_id is not None and payload.quantity_used is not None:
        items_to_link.append((payload.parent_batch_id, payload.quantity_used, payload.unit))

    created_links = []
    for parent_id, qty_used, unit in items_to_link:
        parent_batch = db.query(Batch).filter_by(id=parent_id).first()
        if not parent_batch:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Parent batch '{parent_id}' not found.",
            )

        if would_create_cycle(parent_id, payload.child_batch_id, db):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Linking '{parent_id}' -> '{payload.child_batch_id}' would create a cycle in the genealogy graph.",
            )

        link = BatchLink(
            parent_batch_id=parent_id,
            child_batch_id=payload.child_batch_id,
            quantity_used=qty_used,
            unit=unit,
        )
        parent_batch.remaining_quantity = max(0.0, round(parent_batch.remaining_quantity - qty_used, 4))
        db.add(link)
        db.flush()
        created_links.append(link.to_dict())

    db.commit()
    first_link = created_links[0] if created_links else {}
    return {
        **first_link,
        "status": "linked",
        "child_batch_id": payload.child_batch_id,
        "links_created": len(created_links),
        "links": created_links,
    }


@router.get("/batches/{batch_id}", response_model=BatchResponse)
def get_batch(batch_id: str, db: Session = Depends(get_db)):
    """Fetches a single batch by ID with designated QR code data."""
    batch = db.query(Batch).filter_by(id=batch_id).first()
    if not batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Batch '{batch_id}' not found.",
        )
    qr_payload = generate_batch_qr_payload(batch.id)
    batch.qr_code_url = f"/api/batches/{batch.id}/qr"
    batch.passport_url = qr_payload["passport_url"]
    batch.qr_code_base64 = qr_payload["qr_base64"]
    batch.qr_code_svg = qr_payload["qr_svg"]
    return batch


@router.get("/batches/{batch_id}/lineage")
def get_lineage(batch_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    """Returns recursive graph of upstream inputs (provenance) and downstream outputs."""
    try:
        return get_batch_lineage(batch_id, db)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/batches/{batch_id}/qr")
def get_batch_qr(
    batch_id: str,
    format: str = Query(default="png", description="Response format: png, svg, or json"),
    db: Session = Depends(get_db),
):
    """Generates a dynamic PNG, SVG, or JSON QR code representing the public passport URL."""
    batch = db.query(Batch).filter_by(id=batch_id).first()
    if not batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Batch '{batch_id}' not found.",
        )

    fmt = format.lower().strip()
    if fmt in ("json", "base64"):
        return generate_batch_qr_payload(batch_id)
    if fmt == "svg":
        svg_content = generate_batch_qr_svg(batch_id)
        return Response(content=svg_content, media_type="image/svg+xml")

    png_bytes = generate_batch_qr_png(batch_id)
    return Response(content=png_bytes, media_type="image/png")


@router.post("/distribution", response_model=DistributionRecordResponse, status_code=status.HTTP_201_CREATED)
def create_distribution_record(payload: DistributionRecordCreate, db: Session = Depends(get_db)):
    """Dispatches a batch to a retail outlet or distributor."""
    batch = db.query(Batch).filter_by(id=payload.batch_id).first()
    if not batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Batch '{payload.batch_id}' not found.",
        )

    record = DistributionRecord(
        batch_id=payload.batch_id,
        destination_name=payload.destination_name,
        destination_type=payload.destination_type,
        location=payload.location,
        quantity_dispatched=payload.quantity_dispatched,
        contact_phone=payload.contact_phone,
        dispatched_at=payload.dispatched_at,
    )
    batch.remaining_quantity = max(0.0, round(batch.remaining_quantity - payload.quantity_dispatched, 4))
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/distribution", response_model=list[DistributionRecordResponse])
def list_distribution_records(
    batch_id: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    """Lists all retail/distributor dispatch records."""
    query = db.query(DistributionRecord)
    if batch_id:
        query = query.filter_by(batch_id=batch_id)
    return query.order_by(DistributionRecord.id.asc()).all()
