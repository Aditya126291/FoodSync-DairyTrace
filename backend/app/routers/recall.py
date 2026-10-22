"""Smart Recall Engine Endpoints (Simulate, Execute, History, FSSAI Export)."""

import json
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.audit import write_audit
from app.models import Batch, ComplaintRecord, RecallEvent, User
from app.security import require_qa, require_staff
from app.schemas import BlastRadiusResponse, RecallExecuteRequest, RecallSimulateRequest
from app.services.fssai_export import export_fssai_notice
from app.services.recall_engine import compute_blast_radius, execute_recall

router = APIRouter(tags=["Smart Recall Engine"])


@router.post("/recall/simulate", response_model=BlastRadiusResponse, dependencies=[Depends(require_staff)])
def simulate_recall(payload: RecallSimulateRequest, db: Session = Depends(get_db)):
    """
    Computes the blast radius in real time without mutating database state.
    Returns affected paneer batches, co-inputs for quarantine review, and retail destinations.
    """
    target_id = payload.batch_id or payload.root_batch_id
    root_batch = db.query(Batch).filter_by(id=target_id).first()
    if not root_batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Batch '{target_id}' not found.",
        )

    blast = compute_blast_radius(target_id, db)
    affected_ids = blast["affected_product_batches"]
    co_input_ids = blast["co_input_batches_for_review"]
    destinations = blast["compromised_retail_destinations"]

    affected_batch_objs = (
        db.query(Batch).filter(Batch.id.in_(affected_ids)).order_by(Batch.id.asc()).all()
        if affected_ids
        else []
    )
    co_input_batch_objs = (
        db.query(Batch).filter(Batch.id.in_(co_input_ids)).order_by(Batch.id.asc()).all()
        if co_input_ids
        else []
    )

    total_affected_kg = sum(b.initial_quantity for b in affected_batch_objs)
    if total_affected_kg == 0.0 and root_batch.product_type == "PANEER":
        total_affected_kg = root_batch.initial_quantity
    total_retail_risk = sum(d.quantity_dispatched for d in destinations)

    return BlastRadiusResponse(
        root_batch=target_id,
        root_batch_details=root_batch,
        reason=payload.reason,
        affected_product_batches=affected_ids,
        co_input_batches_for_review=co_input_ids,
        compromised_retail_destinations=destinations,
        affected_batch_details=affected_batch_objs,
        affected_product_details=affected_batch_objs,
        co_input_batch_details=co_input_batch_objs,
        co_input_details=co_input_batch_objs,
        total_affected_volume_kg=round(total_affected_kg, 2),
        total_retail_units_at_risk=round(total_retail_risk, 2),
        total_retail_units=round(total_retail_risk, 2),
    )


@router.post("/recall/execute")
def execute_recall_endpoint(
    payload: RecallExecuteRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_qa),
) -> dict[str, Any]:
    """
    Commits the recall:
    - Sets root and descendant batches to RECALLED
    - Sets co-input batches to QUARANTINED
    - Creates a RecallEvent audit log entry
    - Generates an official FSSAI recall notice dossier
    """
    target_id = payload.batch_id or payload.root_batch_id
    try:
        result = execute_recall(
            root_batch_id=target_id,
            reason=payload.reason,
            severity=payload.severity,
            initiated_by=f"{user.full_name} ({user.role})"[:80],  # identity from token, never from input
            db_session=db,
        )
        blast = result.get("blast_radius", {})
        impacted_ids = {target_id, *(blast.get("affected_product_batches") or [])}
        open_complaints = (
            db.query(ComplaintRecord)
            .filter(ComplaintRecord.batch_id.in_(impacted_ids))
            .all()
        )
        if open_complaints:
            for comp in open_complaints:
                if comp.status != "Resolved":
                    comp.status = "Recall triggered"
        write_audit(db, user, "RECALL_EXECUTED", "batch", target_id, payload.reason)
        db.commit()
        return result
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/recall/history", dependencies=[Depends(require_staff)])
def get_recall_history(db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    """Lists all past recall actions and containment statuses."""
    events = db.query(RecallEvent).order_by(RecallEvent.created_at.desc(), RecallEvent.id.desc()).all()
    results = []
    for ev in events:
        try:
            aff_batches = json.loads(ev.affected_batches_json or "[]")
        except (json.JSONDecodeError, TypeError):
            aff_batches = []
        try:
            aff_dests = json.loads(ev.affected_destinations_json or "[]")
        except (json.JSONDecodeError, TypeError):
            aff_dests = []
        results.append({
            **ev.to_dict(),
            "affected_batches": aff_batches,
            "affected_destinations": aff_dests,
        })
    return results


@router.get("/recall/{recall_id}/export-fssai", dependencies=[Depends(require_qa)])
def export_fssai_recall_notice(
    recall_id: int,
    format: str = Query(default="json", description="Export format: 'json' (includes printable_html) or 'html'"),
    db: Session = Depends(get_db),
):
    """Returns structured JSON and/or formatted printable HTML FSSAI recall notice."""
    try:
        exported = export_fssai_notice(recall_id, db)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    if format.lower().strip() == "html":
        return HTMLResponse(content=exported["printable_html"])

    return exported
