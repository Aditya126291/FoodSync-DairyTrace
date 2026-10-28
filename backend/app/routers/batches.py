"""Batch, Genealogy Lineage, QR Code, and Distribution Endpoints."""

import uuid
from typing import Any, Optional
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import or_, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.security import require_qa, require_staff
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


@router.get("/batches", response_model=list[BatchResponse], dependencies=[Depends(require_staff)])
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


@router.post("/batches", response_model=BatchResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_qa)])
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


@router.get("/batches/lookup", response_model=list[BatchResponse], dependencies=[Depends(require_staff)])
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


@router.post("/batches/link", status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_qa)])
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

        if db.query(BatchLink.id).filter_by(parent_batch_id=parent_id, child_batch_id=payload.child_batch_id).first():
            raise HTTPException(status_code=409, detail=f"Batch '{parent_id}' is already linked to '{payload.child_batch_id}'.")

        link = BatchLink(
            parent_batch_id=parent_id,
            child_batch_id=payload.child_batch_id,
            quantity_used=qty_used,
            unit=unit,
        )
        stock_update = db.execute(
            update(Batch)
            .where(Batch.id == parent_id, Batch.remaining_quantity >= qty_used)
            .values(remaining_quantity=Batch.remaining_quantity - qty_used)
        )
        if stock_update.rowcount != 1:
            raise HTTPException(status_code=409, detail=f"Batch '{parent_id}' does not have enough remaining quantity.")
        db.add(link)
        try:
            db.flush()
        except IntegrityError as error:
            db.rollback()
            raise HTTPException(status_code=409, detail="This batch link conflicts with an existing genealogy record.") from error
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


@router.get("/batches/{batch_id}", response_model=BatchResponse, dependencies=[Depends(require_staff)])
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


@router.get("/batches/{batch_id}/lineage", dependencies=[Depends(require_staff)])
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


@router.post("/distribution", response_model=DistributionRecordResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_qa)])
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
    stock_update = db.execute(
        update(Batch)
        .where(Batch.id == payload.batch_id, Batch.remaining_quantity >= payload.quantity_dispatched)
        .values(remaining_quantity=Batch.remaining_quantity - payload.quantity_dispatched)
    )
    if stock_update.rowcount != 1:
        raise HTTPException(status_code=409, detail=f"Batch '{payload.batch_id}' does not have enough remaining quantity.")
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/distribution", response_model=list[DistributionRecordResponse], dependencies=[Depends(require_staff)])
def list_distribution_records(
    batch_id: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    """Lists all retail/distributor dispatch records."""
    query = db.query(DistributionRecord)
    if batch_id:
        query = query.filter_by(batch_id=batch_id)
    return query.order_by(DistributionRecord.id.asc()).all()
