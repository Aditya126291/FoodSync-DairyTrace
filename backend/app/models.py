"""SQLAlchemy ORM models adhering strictly to PROJECT_SPECIFICATION.md Section 3."""

from datetime import datetime, timezone
from typing import Any
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class DictAccessMixin:
    """Mixin enabling both attribute access and dict-like subscript access for model rows."""

    def __getitem__(self, key: str) -> Any:
        if hasattr(self, key):
            return getattr(self, key)
        raise KeyError(key)

    def get(self, key: str, default: Any = None) -> Any:
        return getattr(self, key, default)

    def keys(self):
        return [c.name for c in self.__table__.columns]

    def to_dict(self) -> dict[str, Any]:
        result = {}
        for col in self.__table__.columns:
            val = getattr(self, col.name)
            if isinstance(val, datetime):
                result[col.name] = val.isoformat()
            else:
                result[col.name] = val
        return result


class Batch(Base, DictAccessMixin):
    """3.1 `batches` Table — Raw milk collections and finished paneer batches."""

    __tablename__ = "batches"

    id = Column(String(64), primary_key=True, index=True)
    product_type = Column(String(20), nullable=False, index=True)  # MILK or PANEER
    initial_quantity = Column(Float, nullable=False)
    remaining_quantity = Column(Float, nullable=False)
    facility_name = Column(String(120), nullable=False)
    status = Column(String(20), nullable=False, default="ACTIVE", index=True)  # ACTIVE, QUARANTINED, RECALLED
    production_date = Column(DateTime, nullable=False, default=_utcnow)
    expiry_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=_utcnow)
    sku = Column(String(80), nullable=True, index=True)
    serial_number = Column(String(120), nullable=True, index=True)

    parent_links = relationship(
        "BatchLink",
        foreign_keys="BatchLink.child_batch_id",
        back_populates="child_batch",
        cascade="all, delete-orphan",
    )
    child_links = relationship(
        "BatchLink",
        foreign_keys="BatchLink.parent_batch_id",
        back_populates="parent_batch",
        cascade="all, delete-orphan",
    )
    quality_records = relationship(
        "QualityRecord",
        back_populates="batch",
        cascade="all, delete-orphan",
        order_by="QualityRecord.test_date.desc()",
    )
    distribution_records = relationship(
        "DistributionRecord",
        back_populates="batch",
        cascade="all, delete-orphan",
    )
    recall_events = relationship(
        "RecallEvent",
        back_populates="root_batch",
        cascade="all, delete-orphan",
    )
    inspections = relationship(
        "SecurityInspection",
        back_populates="batch",
        cascade="all, delete-orphan",
        order_by="SecurityInspection.created_at.desc()",
    )

    @property
    def trust_level(self) -> str:
        """Returns the highest trust tier among attached quality records, or 'VERIFIED' if none."""
        if not self.quality_records:
            return "VERIFIED"
        rank = {"VERIFIED": 3, "DOCUMENT_CHECKED": 2, "SUPPLIER_ENTERED": 1}
        best = max(self.quality_records, key=lambda r: rank.get(r.trust_level, 0))
        return best.trust_level

    @property
    def passport_url(self) -> str:
        if hasattr(self, "_passport_url") and self._passport_url is not None:
            return self._passport_url
        from app.services.qr_service import get_passport_url
        return get_passport_url(self.id)

    @passport_url.setter
    def passport_url(self, val: str):
        self._passport_url = val

    @property
    def qr_code_url(self) -> str:
        if hasattr(self, "_qr_code_url") and self._qr_code_url is not None:
            return self._qr_code_url
        return f"/api/batches/{self.id}/qr"

    @qr_code_url.setter
    def qr_code_url(self, val: str):
        self._qr_code_url = val

    @property
    def qr_code_svg(self) -> Optional[str]:
        return getattr(self, "_qr_code_svg", None)

    @qr_code_svg.setter
    def qr_code_svg(self, val: Optional[str]):
        self._qr_code_svg = val

    @property
    def qr_code_base64(self) -> Optional[str]:
        return getattr(self, "_qr_code_base64", None)

    @qr_code_base64.setter
    def qr_code_base64(self, val: Optional[str]):
        self._qr_code_base64 = val

    def to_dict(self) -> dict[str, Any]:
        data = super().to_dict()
        data["trust_level"] = self.trust_level
        data["passport_url"] = self.passport_url
        data["qr_code_url"] = self.qr_code_url
        if self.qr_code_svg:
            data["qr_code_svg"] = self.qr_code_svg
        if self.qr_code_base64:
            data["qr_code_base64"] = self.qr_code_base64
        return data


class BatchLink(Base, DictAccessMixin):
    """3.2 `batch_links` Table — Genealogy edges linking parent milk batches to child paneer batches."""

    __tablename__ = "batch_links"

    id = Column(Integer, primary_key=True, autoincrement=True)
    parent_batch_id = Column(String(64), ForeignKey("batches.id", ondelete="CASCADE"), nullable=False, index=True)
    child_batch_id = Column(String(64), ForeignKey("batches.id", ondelete="CASCADE"), nullable=False, index=True)
    quantity_used = Column(Float, nullable=False)
    unit = Column(String(10), nullable=False, default="L")  # 'L' or 'KG'
    linked_at = Column(DateTime, nullable=False, default=_utcnow)

    parent_batch = relationship("Batch", foreign_keys=[parent_batch_id], back_populates="child_links")
    child_batch = relationship("Batch", foreign_keys=[child_batch_id], back_populates="parent_links")


class QualityRecord(Base, DictAccessMixin):
    """3.3 `quality_records` Table — Evidence-linked lab records with 3-tier trust classification."""

    __tablename__ = "quality_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    batch_id = Column(String(64), ForeignKey("batches.id", ondelete="CASCADE"), nullable=False, index=True)
    test_date = Column(DateTime, nullable=False, default=_utcnow)
    lab_name = Column(String(120), nullable=False)
    fat_percentage = Column(Float, nullable=False)
    snf_percentage = Column(Float, nullable=False)
    acidity = Column(Float, nullable=False)
    adulterant_test = Column(String(20), nullable=False, default="NEGATIVE")  # NEGATIVE, POSITIVE, SUSPECTED, NOT_TESTED
    contaminant_details = Column(Text, nullable=True)
    trust_level = Column(String(30), nullable=False)  # SUPPLIER_ENTERED, DOCUMENT_CHECKED, VERIFIED
    certificate_url = Column(String(255), nullable=True)

    batch = relationship("Batch", back_populates="quality_records")


class DistributionRecord(Base, DictAccessMixin):
    """3.4 `distribution_records` Table — Downstream retail and distributor dispatches."""

    __tablename__ = "distribution_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    batch_id = Column(String(64), ForeignKey("batches.id", ondelete="CASCADE"), nullable=False, index=True)
    destination_name = Column(String(120), nullable=False)
    destination_type = Column(String(20), nullable=False, default="RETAILER")  # RETAILER or DISTRIBUTOR
    location = Column(String(120), nullable=False)
    quantity_dispatched = Column(Float, nullable=False)
    contact_phone = Column(String(20), nullable=False)
    dispatched_at = Column(DateTime, nullable=False, default=_utcnow)

    batch = relationship("Batch", back_populates="distribution_records")


class RecallEvent(Base, DictAccessMixin):
    """3.5 `recall_events` Table — Audit log and containment status for executed recalls."""

    __tablename__ = "recall_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    root_batch_id = Column(String(64), ForeignKey("batches.id", ondelete="CASCADE"), nullable=False, index=True)
    reason = Column(Text, nullable=False)
    severity = Column(String(20), nullable=False, default="CRITICAL")  # CRITICAL, MAJOR, PRECAUTIONARY
    initiated_by = Column(String(80), nullable=False)
    status = Column(String(20), nullable=False, default="ACTIVE")  # ACTIVE, CONTAINED, CLOSED
    affected_batches_json = Column(Text, nullable=False)
    affected_destinations_json = Column(Text, nullable=False)
    created_at = Column(DateTime, nullable=False, default=_utcnow)

    root_batch = relationship("Batch", back_populates="recall_events")


class SecurityInspection(Base, DictAccessMixin):
    """Manual physical and digital inspection audit record for a batch."""

    __tablename__ = "security_inspections"

    id = Column(Integer, primary_key=True, autoincrement=True)
    batch_id = Column(String(64), ForeignKey("batches.id", ondelete="CASCADE"), nullable=False, index=True)
    tamper_seal_condition = Column(String(24), nullable=False)
    seal_serial_number = Column(String(100), nullable=True)
    packaging_status = Column(String(24), nullable=False)
    expected_quantity = Column(Float, nullable=False)
    actual_quantity = Column(Float, nullable=False)
    temperature_c = Column(Float, nullable=False)
    humidity_percent = Column(Float, nullable=False)
    cold_chain_compliant = Column(Boolean, nullable=False, default=False)
    verdict = Column(String(32), nullable=False)
    notes = Column(Text, nullable=False, default="")
    inspector_name = Column(String(100), nullable=False)
    created_at = Column(DateTime, nullable=False, default=_utcnow)
    evidence_filename = Column(String(255), nullable=True)
    evidence_mime_type = Column(String(80), nullable=True)
    evidence_sha256 = Column(String(64), nullable=True)
    record_sha256 = Column(String(64), nullable=False)

    batch = relationship("Batch", back_populates="inspections")


class ComplaintRecord(Base, DictAccessMixin):
    """`complaints` Table — customer / retailer / staff complaints filed via the AI Copilot.

    Mirrors the 17-field complaint contract of the reference AI Complaint Management System,
    relabelled for dairy. Batch-derived fields are populated server-side from the scanned batch.
    """

    __tablename__ = "complaints"
    __table_args__ = {"sqlite_autoincrement": True}  # ids (and so CC- numbers) are never reused after a delete

    id = Column(Integer, primary_key=True, autoincrement=True)
    complaint_number = Column(String(50), unique=True, index=True, nullable=False)  # CC-YYYY-NNNN
    batch_id = Column(String(64), nullable=False, index=True)
    customer_name = Column(String(255), default="")
    complaint_source = Column(String(255), default="")
    product_name = Column(String(255), default="")
    strength_grade = Column(String(100), default="")
    batch_lot_number = Column(String(100), default="")
    manufacturing_date = Column(String(100), default="")
    expiry_date = Column(String(100), default="")
    affected_quantity = Column(String(100), default="")
    originating_site = Column(String(255), default="")
    impacted_material = Column(String(255), default="")
    complaint_type = Column(String(100), default="")
    complaint_date = Column(String(100), default="")
    defect_summary = Column(Text, default="")
    detailed_description = Column(Text, default="")
    severity = Column(String(50), default="", index=True)
    priority = Column(String(50), default="")
    risk_assessment = Column(Text, default="")
    root_cause = Column(Text, default="")
    capa_json = Column(Text, default="[]")
    # Committed -> Under review -> Recall triggered -> Resolved
    status = Column(String(30), nullable=False, default="Committed", index=True)
    reporter_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, nullable=False, default=_utcnow)
    updated_at = Column(DateTime, nullable=False, default=_utcnow, onupdate=_utcnow)

    def to_dict(self) -> dict[str, Any]:
        import json

        try:
            capa = json.loads(self.capa_json or "[]")
        except (TypeError, ValueError):
            capa = []
        return {
            "id": self.id,
            "complaintNumber": self.complaint_number,
            "batchId": self.batch_id,
            "customerName": self.customer_name,
            "complaintSource": self.complaint_source,
            "productName": self.product_name,
            "strengthGrade": self.strength_grade,
            "batchLotNumber": self.batch_lot_number,
            "manufacturingDate": self.manufacturing_date,
            "expiryDate": self.expiry_date,
            "affectedQuantity": self.affected_quantity,
            "originatingSite": self.originating_site,
            "impactedMaterial": self.impacted_material,
            "complaintType": self.complaint_type,
            "complaintDate": self.complaint_date,
            "defectSummary": self.defect_summary,
            "detailedDescription": self.detailed_description,
            "severity": self.severity,
            "priority": self.priority,
            "riskAssessment": self.risk_assessment,
            "rootCause": self.root_cause,
            "capaRecommendations": capa,
            "status": self.status,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }


class User(Base, DictAccessMixin):
    """`users` Table — staff accounts. Roles: INSPECTOR, QA_OFFICER. Provisioned only via CLI."""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(160), unique=True, nullable=False, index=True)
    full_name = Column(String(120), nullable=False)
    organisation = Column(String(120), nullable=True)
    role = Column(String(20), nullable=False)  # INSPECTOR | QA_OFFICER
    password_hash = Column(String(120), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    failed_logins = Column(Integer, nullable=False, default=0)
    locked_until = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=_utcnow)
    last_login_at = Column(DateTime, nullable=True)


class AuditLog(Base, DictAccessMixin):
    """`audit_log` Table — who did what. Actor comes from the verified token, never from user input."""

    __tablename__ = "audit_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    actor_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    actor_label = Column(String(160), nullable=False, default="public")
    action = Column(String(60), nullable=False, index=True)
    entity = Column(String(60), nullable=False)
    entity_id = Column(String(80), nullable=True)
    detail = Column(String(1000), nullable=True)
    created_at = Column(DateTime, nullable=False, default=_utcnow)
