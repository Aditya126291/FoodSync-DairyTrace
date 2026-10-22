"""Append-only audit trail helper. Actor identity always comes from the verified user."""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.models import AuditLog, User


def write_audit(
    db: Session,
    actor: User | None,
    action: str,
    entity: str,
    entity_id: Any = None,
    detail: str | None = None,
) -> None:
    """Add an audit row to the session. The caller owns the commit."""
    db.add(
        AuditLog(
            actor_id=actor.id if actor else None,
            actor_label=(f"{actor.full_name} ({actor.role})" if actor else "public"),
            action=action,
            entity=entity,
            entity_id=str(entity_id) if entity_id is not None else None,
            detail=(detail or "")[:1000] or None,
        )
    )
