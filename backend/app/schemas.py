"""Pydantic V2 schemas for DairyTrace REST API payload validation and serialization."""

from datetime import datetime, timedelta, timezone
from typing import Any, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, model_validator


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


# ---------------------------------------------------------------------------
# Batch & Link Schemas
# ---------------------------------------------------------------------------

class BatchCreate(BaseModel):
    id: Optional[str] = Field(default=None, max_length=64, description="Immutable Batch ID (e.g., MILK-101, PAN-201). If omitted or 'RANDOM', auto-generated.")
    product_type: Literal["MILK", "PANEER"] = Field(..., description="MILK or PANEER")
    initial_quantity: float = Field(..., gt=0, description="Initial volume in Liters (MILK) or kg (PANEER)")
    remaining_quantity: Optional[float] = Field(default=None, ge=0, description="Defaults to initial_quantity if omitted")
    facility_name: str = Field(..., min_length=1, max_length=120)
    status: Literal["ACTIVE", "QUARANTINED", "RECALLED"] = Field(default="ACTIVE")
    production_date: Optional[datetime] = Field(default=None)
    expiry_date: Optional[datetime] = Field(default=None)
    sku: Optional[str] = Field(default=None, max_length=80)
    serial_number: Optional[str] = Field(default=None, max_length=120)

    @model_validator(mode="after")
    def _set_defaults(self):
        import random
        if not self.id or not self.id.strip() or self.id.strip().upper() in ("AUTO", "RANDOM"):
            prefix = "MILK" if self.product_type == "MILK" else "PAN"
            self.id = f"{prefix}-{random.randint(500, 9999)}"
        else:
            self.id = self.id.strip().upper()
        if self.remaining_quantity is None:
            self.remaining_quantity = self.initial_quantity
        if self.production_date is None:
            self.production_date = _utcnow()
        if self.expiry_date is None:
            shelf_days = 2 if self.product_type == "MILK" else 14
            self.expiry_date = self.production_date + timedelta(days=shelf_days)
        return self


class BatchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    product_type: str
    initial_quantity: float
    remaining_quantity: float
    facility_name: str
    status: str
    trust_level: Optional[str] = "VERIFIED"
    production_date: datetime
    expiry_date: Optional[datetime] = None
    created_at: datetime
    sku: Optional[str] = None
    serial_number: Optional[str] = None
    qr_code_url: Optional[str] = None
    qr_code_svg: Optional[str] = None
    qr_code_base64: Optional[str] = None
    passport_url: Optional[str] = None


class ParentInputItem(BaseModel):
    parent_batch_id: str = Field(..., min_length=1, max_length=64)
    quantity_used: float = Field(..., gt=0)
    unit: Literal["L", "KG"] = Field(default="L")


class BatchLinkCreate(BaseModel):
    """Supports both single link (parent_batch_id + child_batch_id) and multi-parent link (child_batch_id + parents)."""

    parent_batch_id: Optional[str] = Field(default=None, max_length=64)
    child_batch_id: str = Field(..., min_length=1, max_length=64)
    quantity_used: Optional[float] = Field(default=None, gt=0)
    unit: Literal["L", "KG"] = Field(default="L")
    parents: Optional[list[ParentInputItem]] = Field(default=None)

    @model_validator(mode="after")
    def _validate_link_mode(self):
        has_single = self.parent_batch_id is not None and self.quantity_used is not None
        has_multi = self.parents is not None and len(self.parents) > 0
        if not has_single and not has_multi:
            raise ValueError(
                "Provide either (parent_batch_id and quantity_used) or a non-empty 'parents' list."
            )
        return self


class BatchLinkResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    parent_batch_id: str
    child_batch_id: str
    quantity_used: float
    unit: str
    linked_at: datetime


# ---------------------------------------------------------------------------
# Quality Record Schemas
# ---------------------------------------------------------------------------

class QualityRecordCreate(BaseModel):
    batch_id: str = Field(..., min_length=1, max_length=64)
    test_date: Optional[datetime] = Field(default=None)
    lab_name: str = Field(..., min_length=1, max_length=120)
    fat_percentage: float = Field(..., ge=0, le=100)
    snf_percentage: float = Field(..., ge=0, le=100)
    acidity: float = Field(..., ge=0, le=10)
    adulterant_test: Literal["NEGATIVE", "POSITIVE", "SUSPECTED", "NOT_TESTED"] = Field(default="NEGATIVE")
    contaminant_details: Optional[str] = Field(default=None)
    trust_level: Literal["SUPPLIER_ENTERED", "DOCUMENT_CHECKED", "VERIFIED"] = Field(...)
    certificate_url: Optional[str] = Field(default=None, max_length=255)

    @model_validator(mode="after")
    def _default_test_date(self):
        if self.test_date is None:
            self.test_date = _utcnow()
        return self


class QualityRecordResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    batch_id: str
    test_date: datetime
    lab_name: str
    fat_percentage: float
    snf_percentage: float
    acidity: float
    adulterant_test: str
    contaminant_details: Optional[str] = None
    trust_level: str
    certificate_url: Optional[str] = None


# ---------------------------------------------------------------------------
# Distribution Record Schemas
# ---------------------------------------------------------------------------

class DistributionRecordCreate(BaseModel):
    batch_id: str = Field(..., min_length=1, max_length=64)
    destination_name: str = Field(..., min_length=1, max_length=120)
    destination_type: Literal["RETAILER", "DISTRIBUTOR"] = Field(default="RETAILER")
    location: str = Field(..., min_length=1, max_length=120)
    quantity_dispatched: float = Field(..., gt=0)
    contact_phone: str = Field(..., min_length=3, max_length=20)
    dispatched_at: Optional[datetime] = Field(default=None)

    @model_validator(mode="after")
    def _default_dispatched_at(self):
        if self.dispatched_at is None:
            self.dispatched_at = _utcnow()
        return self


class DistributionRecordResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    batch_id: str
    destination_name: str
    destination_type: str
    location: str
    quantity_dispatched: float
    contact_phone: str
    dispatched_at: datetime


# ---------------------------------------------------------------------------
# Smart Recall Schemas
# ---------------------------------------------------------------------------

class RecallSimulateRequest(BaseModel):
    batch_id: Optional[str] = Field(default=None, description="Flagged batch ID (e.g., MILK-101)")
    root_batch_id: Optional[str] = Field(default=None, description="Alias for batch_id")
    reason: str = Field(default="Suspected food safety contamination", min_length=1)

    @model_validator(mode="after")
    def _normalize_batch_id(self):
        target = self.batch_id or self.root_batch_id
        if not target:
            raise ValueError("Either 'batch_id' or 'root_batch_id' is required.")
        self.batch_id = target
        self.root_batch_id = target
        return self


class RecallExecuteRequest(BaseModel):
    batch_id: Optional[str] = Field(default=None, description="Flagged batch ID (e.g., MILK-101)")
    root_batch_id: Optional[str] = Field(default=None, description="Alias for batch_id")
    reason: str = Field(default="Confirmed food safety contamination", min_length=1)
    severity: Literal["CRITICAL", "MAJOR", "PRECAUTIONARY"] = Field(default="CRITICAL")
    initiated_by: str = Field(default="QA Compliance Officer", min_length=1, max_length=80)

    @model_validator(mode="after")
    def _normalize_batch_id(self):
        target = self.batch_id or self.root_batch_id
        if not target:
            raise ValueError("Either 'batch_id' or 'root_batch_id' is required.")
        self.batch_id = target
        self.root_batch_id = target
        return self


class BlastRadiusResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    root_batch: str
    root_batch_details: Optional[BatchResponse] = None
    reason: str
    affected_product_batches: list[str]
    co_input_batches_for_review: list[str]
    compromised_retail_destinations: list[DistributionRecordResponse]
    affected_batch_details: list[BatchResponse] = Field(default_factory=list)
    affected_product_details: list[BatchResponse] = Field(default_factory=list)
    co_input_batch_details: list[BatchResponse] = Field(default_factory=list)
    co_input_details: list[BatchResponse] = Field(default_factory=list)
    total_affected_volume_kg: float = 0.0
    total_retail_units_at_risk: float = 0.0
    total_retail_units: float = 0.0
    simulation_timestamp: Optional[datetime] = Field(default_factory=_utcnow)


class RecallEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    root_batch_id: str
    reason: str
    severity: str
    initiated_by: str
    status: str
    affected_batches_json: str
    affected_destinations_json: str
    created_at: datetime
    affected_batches: list[str] = Field(default_factory=list)
    affected_destinations: list[dict[str, Any]] = Field(default_factory=list)


class SecurityInspectionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    batch_id: str
    tamper_seal_condition: str
    seal_serial_number: Optional[str] = None
    packaging_status: str
    expected_quantity: float
    actual_quantity: float
    temperature_c: float
    humidity_percent: float
    cold_chain_compliant: bool
    verdict: str
    notes: str
    inspector_name: str
    created_at: datetime
    evidence_url: Optional[str] = None
    evidence_sha256: Optional[str] = None
    record_sha256: str


# ---------------------------------------------------------------------------
# Customer, Retailer & Forensic Complaint Copilot Schemas
# ---------------------------------------------------------------------------

class ComplaintCreate(BaseModel):
    batch_id: str = Field(..., min_length=1, max_length=64, description="Target batch ID (e.g., MILK-101, PAN-201)")
    product_name: Optional[str] = Field(default=None, max_length=120)
    reporter_name: str = Field(..., min_length=1, max_length=120)
    reporter_role: str = Field(default="Customer / Retailer", max_length=80)
    facility_or_store: str = Field(..., min_length=1, max_length=140)
    complaint_category: str = Field(default="Forensic / Adulteration Alert", max_length=80)
    severity: Literal["CRITICAL", "MAJOR", "PRECAUTIONARY"] = Field(default="MAJOR")
    fat_percentage: Optional[float] = Field(default=None, ge=0, le=100)
    snf_percentage: Optional[float] = Field(default=None, ge=0, le=100)
    acidity_percentage: Optional[float] = Field(default=None, ge=0, le=10)
    adulterant_status: Literal["NEGATIVE", "POSITIVE", "SUSPECTED", "NOT_TESTED"] = Field(default="NOT_TESTED")
    adulterant_findings: Optional[str] = Field(default=None, max_length=2000)
    description: str = Field(..., min_length=1, max_length=5000)
    intake_mode: Literal["MANUAL", "NATURAL_LANGUAGE", "REPORT_UPLOAD"] = Field(default="MANUAL")
    source_report_name: Optional[str] = Field(default=None, max_length=255)
    ai_summary: Optional[str] = Field(default=None, max_length=2000)
    record_quality_check: bool = Field(default=True)

    @model_validator(mode="after")
    def _normalize_fields(self):
        self.batch_id = self.batch_id.strip().upper()
        self.reporter_name = self.reporter_name.strip()
        self.facility_or_store = self.facility_or_store.strip()
        self.description = self.description.strip()
        if not self.batch_id:
            raise ValueError("Batch ID is required.")
        if not self.reporter_name:
            raise ValueError("Reporter / Customer name is required.")
        if not self.facility_or_store:
            raise ValueError("Store / Facility is required.")
        if not self.description:
            raise ValueError("Complaint description is required.")
        if not self.product_name or not self.product_name.strip():
            self.product_name = (
                "FoodSync Fresh Malai Paneer 200g"
                if self.batch_id.startswith("PAN")
                else "FoodSync Farm-Chilled Raw Milk"
            )
        else:
            self.product_name = self.product_name.strip()
        return self


class ComplaintResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    complaint_ref: str
    batch_id: str
    product_name: str
    reporter_name: str
    reporter_role: str
    facility_or_store: str
    complaint_category: str
    severity: str
    status: str
    fat_percentage: Optional[float] = None
    snf_percentage: Optional[float] = None
    acidity_percentage: Optional[float] = None
    adulterant_status: str
    adulterant_findings: Optional[str] = None
    description: str
    intake_mode: str
    source_report_name: Optional[str] = None
    ai_summary: Optional[str] = None
    created_at: datetime
    safety_alert_recommended: bool = False
    batch_exists: bool = True


class CopilotProcessRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=10000, description="Natural language complaint or conversational edit")
    current_form: Optional[dict[str, Any]] = Field(default_factory=dict)


class CopilotProcessResponse(BaseModel):
    patch: dict[str, Any]
    merged_form: dict[str, Any]
    extracted_fields: list[str]
    completeness: dict[str, Any]
    safety_evaluation: dict[str, Any]
    assistant_message: str
    extraction_engine: str = "DairyTrace Smart Forensic Copilot"
    raw_text_preview: Optional[str] = None
    source_filename: Optional[str] = None

