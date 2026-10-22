"""Request/response schemas for the complaint workspace (camelCase contract, same as the reference)."""

from __future__ import annotations

from pydantic import BaseModel, Field


class ComplaintForm(BaseModel):
    customerName: str = Field(default="", max_length=255)
    complaintSource: str = Field(default="", max_length=255)
    productName: str = Field(default="", max_length=255)
    strengthGrade: str = Field(default="", max_length=100)
    batchLotNumber: str = Field(default="", max_length=100)
    manufacturingDate: str = Field(default="", max_length=100)
    expiryDate: str = Field(default="", max_length=100)
    affectedQuantity: str = Field(default="", max_length=100)
    originatingSite: str = Field(default="", max_length=255)
    impactedMaterial: str = Field(default="", max_length=255)
    complaintType: str = Field(default="", max_length=100)
    complaintDate: str = Field(default="", max_length=100)
    defectSummary: str = Field(default="", max_length=2000)
    detailedDescription: str = Field(default="", max_length=10_000)
    severity: str = Field(default="", max_length=50)
    priority: str = Field(default="", max_length=50)
    riskAssessment: str = Field(default="", max_length=2000)


class CommitRequest(BaseModel):
    batchId: str = Field(min_length=1, max_length=64)
    form: ComplaintForm
    risk: str | None = Field(default=None, max_length=2000)
    rootCause: str | None = Field(default=None, max_length=2000)
    capaRecommendations: list[str] = Field(default_factory=list, max_length=10)


class CopilotRequest(BaseModel):
    text: str = Field(min_length=1, max_length=20_000)
    batchId: str = Field(min_length=1, max_length=64)
    current_form: ComplaintForm


class CopilotResponse(BaseModel):
    message: str
    patch: dict[str, str]
    missingFields: list[str]
    risk: str | None = None
    rootCause: str | None = None
    capaRecommendations: list[str] = Field(default_factory=list)
    engine: str = "rule-based"


class UploadedDocumentResponse(CopilotResponse):
    sourceFile: str
    extractedCharacters: int
    textTruncated: bool


class StatusUpdate(BaseModel):
    status: str = Field(min_length=1, max_length=30)
