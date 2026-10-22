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
    """3.7 `complaints` Table — Customer, retailer, and forensic lab complaints with AI Copilot metadata."""

    __tablename__ = "complaints"

    id = Column(Integer, primary_key=True, autoincrement=True)
    complaint_ref = Column(String(40), nullable=False, unique=True, index=True)
    batch_id = Column(String(64), nullable=False, index=True)
    product_name = Column(String(120), nullable=False)
    reporter_name = Column(String(120), nullable=False)
    reporter_role = Column(String(80), nullable=False, default="Customer / Retailer")
    facility_or_store = Column(String(140), nullable=False)
    complaint_category = Column(String(80), nullable=False, default="Quality / Safety Check")
    severity = Column(String(20), nullable=False, default="MAJOR", index=True)  # CRITICAL, MAJOR, PRECAUTIONARY
    status = Column(String(30), nullable=False, default="OPEN", index=True)  # OPEN, UNDER_REVIEW, RECALL_TRIGGERED, RESOLVED
    fat_percentage = Column(Float, nullable=True)
    snf_percentage = Column(Float, nullable=True)
    acidity_percentage = Column(Float, nullable=True)
    adulterant_status = Column(String(20), nullable=False, default="NOT_TESTED")  # NEGATIVE, POSITIVE, SUSPECTED, NOT_TESTED
    adulterant_findings = Column(Text, nullable=True)
    description = Column(Text, nullable=False)
    intake_mode = Column(String(30), nullable=False, default="MANUAL")  # MANUAL, NATURAL_LANGUAGE, REPORT_UPLOAD
    source_report_name = Column(String(255), nullable=True)
    ai_summary = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=_utcnow)

