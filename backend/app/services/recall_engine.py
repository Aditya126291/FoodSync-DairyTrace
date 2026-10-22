"""Graph Traversal Recall Engine and Lineage Service for DairyTrace."""

import json
from collections import deque
from typing import Any
from sqlalchemy.orm import Session

from app.models import Batch, BatchLink, DistributionRecord, QualityRecord, RecallEvent


def compute_blast_radius(root_batch_id: str, db_session: Session) -> dict[str, Any]:
    """
    Traverses batch_links forward using BFS to find all downstream products,
    sibling co-input batches for quarantine review, and compromised retail destinations.

    Strictly implements and hardens Section 5 of PROJECT_SPECIFICATION.md with:
    - Cycle prevention (visited set updated on discovery)
    - Diamond DAG deduplication
    - Co-input vs. affected descendant disambiguation
    """
    if not root_batch_id or not isinstance(root_batch_id, str):
        raise ValueError("root_batch_id must be a non-empty string")

    visited_batches: set[str] = {root_batch_id}
    queue: deque[str] = deque([root_batch_id])
    affected_batches: list[str] = []
    affected_set: set[str] = set()
    co_input_batches: set[str] = set()

    while queue:
        current_id = queue.popleft()

        # 1. Find all child batches derived from current_id
        child_links = (
            db_session.query(BatchLink)
            .filter_by(parent_batch_id=current_id)
            .order_by(BatchLink.id.asc())
            .all()
        )
        for link in child_links:
            child_id = link.child_batch_id
            if child_id not in visited_batches:
                visited_batches.add(child_id)
                affected_batches.append(child_id)
                affected_set.add(child_id)
                queue.append(child_id)

            # 2. Find sibling inputs (co-inputs) blended into this same child batch
            sibling_links = (
                db_session.query(BatchLink)
                .filter_by(child_batch_id=child_id)
                .order_by(BatchLink.id.asc())
                .all()
            )
            for sib in sibling_links:
                sib_parent_id = sib.parent_batch_id
                if sib_parent_id != root_batch_id and sib_parent_id not in affected_set:
                    co_input_batches.add(sib_parent_id)

    # Any batch that is itself derived from root_batch_id is directly compromised (RECALLED),
    # so remove it from co_input_batches (QUARANTINED).
    co_input_batches -= affected_set
    co_input_batches.discard(root_batch_id)

    # 3. Find all distribution destinations for root + affected finished batches
    all_compromised_ids = [root_batch_id] + affected_batches
    destinations = (
        db_session.query(DistributionRecord)
        .filter(DistributionRecord.batch_id.in_(all_compromised_ids))
        .order_by(DistributionRecord.id.asc())
        .all()
    )

    return {
        "root_batch": root_batch_id,
        "affected_product_batches": affected_batches,
        "co_input_batches_for_review": sorted(co_input_batches),
        "compromised_retail_destinations": destinations,
    }


def would_create_cycle(parent_batch_id: str, child_batch_id: str, db_session: Session) -> bool:
    """
    Returns True if adding an edge (parent_batch_id -> child_batch_id) would create
    a directed cycle in batch_links (i.e., parent_batch_id is reachable from child_batch_id).
    """
    if parent_batch_id == child_batch_id:
        return True

    visited: set[str] = {child_batch_id}
    queue: deque[str] = deque([child_batch_id])

    while queue:
        curr = queue.popleft()
        links = db_session.query(BatchLink).filter_by(parent_batch_id=curr).all()
        for link in links:
            nxt = link.child_batch_id
            if nxt == parent_batch_id:
                return True
            if nxt not in visited:
                visited.add(nxt)
                queue.append(nxt)

    return False


def get_batch_lineage(batch_id: str, db_session: Session) -> dict[str, Any]:
    """
    Computes the full recursive upstream (backward provenance) and downstream (forward outputs)
    genealogy graph for a given batch_id, including co-inputs, quality records, and retail dispatches.
    Cycle-safe for arbitrary graph topologies.
    """
    target_batch = db_session.query(Batch).filter_by(id=batch_id).first()
    if not target_batch:
        raise ValueError(f"Batch '{batch_id}' not found")

    # Upstream traversal (backward: child -> parents)
    upstream_nodes: dict[str, dict[str, Any]] = {}
    upstream_edges: list[dict[str, Any]] = []
    visited_up: set[str] = {batch_id}
    up_queue: deque[str] = deque([batch_id])

    while up_queue:
        curr_id = up_queue.popleft()
        parent_links = (
            db_session.query(BatchLink)
            .filter_by(child_batch_id=curr_id)
            .order_by(BatchLink.id.asc())
            .all()
        )
        for link in parent_links:
            p_id = link.parent_batch_id
            upstream_edges.append({
                "id": link.id,
                "parent_batch_id": p_id,
                "child_batch_id": curr_id,
                "quantity_used": link.quantity_used,
                "unit": link.unit,
                "linked_at": link.linked_at.isoformat() if link.linked_at else None,
            })
            if p_id not in visited_up:
                visited_up.add(p_id)
                p_batch = db_session.query(Batch).filter_by(id=p_id).first()
                if p_batch:
                    upstream_nodes[p_id] = p_batch.to_dict()
                up_queue.append(p_id)

    # Downstream traversal (forward: parent -> children)
    downstream_nodes: dict[str, dict[str, Any]] = {}
    downstream_edges: list[dict[str, Any]] = []
    co_input_nodes: dict[str, dict[str, Any]] = {}
    visited_down: set[str] = {batch_id}
    down_queue: deque[str] = deque([batch_id])

    while down_queue:
        curr_id = down_queue.popleft()
        child_links = (
            db_session.query(BatchLink)
            .filter_by(parent_batch_id=curr_id)
            .order_by(BatchLink.id.asc())
            .all()
        )
        for link in child_links:
            c_id = link.child_batch_id
            downstream_edges.append({
                "id": link.id,
                "parent_batch_id": curr_id,
                "child_batch_id": c_id,
                "quantity_used": link.quantity_used,
                "unit": link.unit,
                "linked_at": link.linked_at.isoformat() if link.linked_at else None,
            })
            if c_id not in visited_down:
                visited_down.add(c_id)
                c_batch = db_session.query(Batch).filter_by(id=c_id).first()
                if c_batch:
                    downstream_nodes[c_id] = c_batch.to_dict()
                down_queue.append(c_id)

            # Also discover sibling co-inputs for downstream children
            sibling_links = (
                db_session.query(BatchLink)
                .filter_by(child_batch_id=c_id)
                .order_by(BatchLink.id.asc())
                .all()
            )
            for sib in sibling_links:
                sib_id = sib.parent_batch_id
                if sib_id != batch_id and sib_id not in visited_down and sib_id not in visited_up:
                    sib_batch = db_session.query(Batch).filter_by(id=sib_id).first()
                    if sib_batch:
                        co_input_nodes[sib_id] = sib_batch.to_dict()
                    edge_dict = {
                        "id": sib.id,
                        "parent_batch_id": sib_id,
                        "child_batch_id": c_id,
                        "quantity_used": sib.quantity_used,
                        "unit": sib.unit,
                        "linked_at": sib.linked_at.isoformat() if sib.linked_at else None,
                    }
                    if edge_dict not in downstream_edges:
                        downstream_edges.append(edge_dict)

    # Prune any node that was later discovered to be a downstream descendant, upstream ancestor, or target batch
    for non_co_id in list(downstream_nodes.keys()) + list(upstream_nodes.keys()) + [batch_id]:
        co_input_nodes.pop(non_co_id, None)

    # Collect distributions for target batch and all downstream batches
    relevant_for_dist = [batch_id] + list(downstream_nodes.keys())
    distributions = (
        db_session.query(DistributionRecord)
        .filter(DistributionRecord.batch_id.in_(relevant_for_dist))
        .order_by(DistributionRecord.id.asc())
        .all()
    )

    # Collect quality records for target batch and upstream batches
    relevant_for_quality = [batch_id] + list(upstream_nodes.keys())
    quality_records = (
        db_session.query(QualityRecord)
        .filter(QualityRecord.batch_id.in_(relevant_for_quality))
        .order_by(QualityRecord.test_date.desc(), QualityRecord.id.desc())
        .all()
    )

    # Build unified nodes & edges list for frontend graph visualization
    all_nodes_map: dict[str, dict[str, Any]] = {
        batch_id: {**target_batch.to_dict(), "lineage_role": "TARGET"}
    }
    for uid, udata in upstream_nodes.items():
        all_nodes_map[uid] = {**udata, "lineage_role": "UPSTREAM_INPUT"}
    for did, ddata in downstream_nodes.items():
        all_nodes_map[did] = {**ddata, "lineage_role": "DOWNSTREAM_PRODUCT"}
    for cid, cdata in co_input_nodes.items():
        if cid not in all_nodes_map:
            all_nodes_map[cid] = {**cdata, "lineage_role": "CO_INPUT"}

    seen_edge_ids: set[int] = set()
    all_edges: list[dict[str, Any]] = []
    for edge in upstream_edges + downstream_edges:
        if edge["id"] not in seen_edge_ids:
            seen_edge_ids.add(edge["id"])
            all_edges.append(edge)

    all_batches_db = db_session.query(Batch).order_by(Batch.created_at.asc(), Batch.id.asc()).all()
    all_links_db = db_session.query(BatchLink).order_by(BatchLink.id.asc()).all()
    all_dists_db = db_session.query(DistributionRecord).order_by(DistributionRecord.id.asc()).all()
    direct_dists = [d.to_dict() for d in distributions if d.batch_id == batch_id]

    direct_parent_links = [l for l in all_links_db if l.child_batch_id == batch_id]
    parents_structured = [
        {
            "link": l.to_dict(),
            "batch": upstream_nodes.get(l.parent_batch_id),
            "quality": [q.to_dict() for q in quality_records if q.batch_id == l.parent_batch_id],
        }
        for l in direct_parent_links
    ]

    direct_child_links = [l for l in all_links_db if l.parent_batch_id == batch_id]
    children_structured = [
        {
            "link": l.to_dict(),
            "batch": downstream_nodes.get(l.child_batch_id),
            "destinations": [d.to_dict() for d in distributions if d.batch_id == l.child_batch_id],
        }
        for l in direct_child_links
    ]

    return {
        "batch_id": batch_id,
        "batch": target_batch.to_dict(),
        "upstream": list(upstream_nodes.values()),
        "downstream": list(downstream_nodes.values()),
        "parents": parents_structured,
        "children": children_structured,
        "co_inputs": list(co_input_nodes.values()),
        "nodes": list(all_nodes_map.values()),
        "edges": all_edges,
        "distributions": [d.to_dict() for d in distributions],
        "directDistributions": direct_dists,
        "quality_records": [q.to_dict() for q in quality_records],
        "allBatches": [b.to_dict() for b in all_batches_db],
        "allLinks": [l.to_dict() for l in all_links_db],
        "allDistributions": [d.to_dict() for d in all_dists_db],
    }


def execute_recall(
    root_batch_id: str,
    reason: str,
    severity: str,
    initiated_by: str,
    db_session: Session,
) -> dict[str, Any]:
    """
    Commits a recall event:
    1. Computes the blast radius from root_batch_id.
    2. Marks root_batch_id and all descendant batches as RECALLED.
    3. Marks co-input batches as QUARANTINED (if not already RECALLED).
    4. Creates a RecallEvent record in the database.
    5. Generates the official FSSAI Recall Dossier.
    """
    from app.services.fssai_export import generate_fssai_dossier_json

    root_batch = db_session.query(Batch).filter_by(id=root_batch_id).first()
    if not root_batch:
        raise ValueError(f"Root batch '{root_batch_id}' not found")

    blast = compute_blast_radius(root_batch_id, db_session)
    affected_ids: list[str] = blast["affected_product_batches"]
    co_input_ids: list[str] = blast["co_input_batches_for_review"]
    destinations: list[DistributionRecord] = blast["compromised_retail_destinations"]

    # 1. Update status of root batch and all downstream affected batches to RECALLED
    recalled_ids = [root_batch_id] + affected_ids
    recalled_batches = db_session.query(Batch).filter(Batch.id.in_(recalled_ids)).all()
    for batch in recalled_batches:
        batch.status = "RECALLED"

    # 2. Update status of co-input batches to QUARANTINED (unless already RECALLED)
    quarantined_batches = []
    if co_input_ids:
        quarantined_batches = db_session.query(Batch).filter(Batch.id.in_(co_input_ids)).all()
        for batch in quarantined_batches:
            if batch.status != "RECALLED":
                batch.status = "QUARANTINED"

    # 3. Serialize destinations for RecallEvent storage
    dest_dicts = [d.to_dict() for d in destinations]

    recall_event = RecallEvent(
        root_batch_id=root_batch_id,
        reason=reason,
        severity=severity,
        initiated_by=initiated_by,
        status="ACTIVE",
        affected_batches_json=json.dumps(affected_ids),
        affected_destinations_json=json.dumps(dest_dicts),
    )
    db_session.add(recall_event)
    db_session.commit()
    db_session.refresh(recall_event)

    dossier = generate_fssai_dossier_json(
        recall_event=recall_event,
        db_session=db_session,
        co_input_batches=co_input_ids,
    )

    blast_summary = {
        "root_batch": root_batch_id,
        "affected_product_batches": affected_ids,
        "co_input_batches_for_review": co_input_ids,
        "compromised_retail_destinations": dest_dicts,
    }

    return {
        "status": "SUCCESS",
        "message": f"Recall successfully executed for batch {root_batch_id}",
        "recall_event": {
            **recall_event.to_dict(),
            "affected_batches": affected_ids,
            "affected_destinations": dest_dicts,
            "blast_radius": blast_summary,
        },
        "blast_radius": blast_summary,
        "fssai_dossier": dossier,
    }
