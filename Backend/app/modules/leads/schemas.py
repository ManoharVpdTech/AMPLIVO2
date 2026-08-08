"""Pydantic schemas for Lead Management."""
from __future__ import annotations
import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.core.field_types import NameStr, PhoneNumber
from app.core.sanitizers import SanitizedModel

# ── LeadSource ──
class LeadSourceCreate(SanitizedModel):
    name: NameStr = Field(min_length=2, max_length=200)
    slug: str = Field(min_length=2, max_length=200, pattern=r"^[a-z0-9_-]+$")
    description: str | None = Field(None, min_length=1, max_length=1000)
    is_active: bool = True
class LeadSourceUpdate(SanitizedModel):
    name: NameStr | None = Field(None, min_length=2, max_length=200)
    slug: str | None = Field(None, min_length=2, max_length=200)
    description: str | None = Field(None, min_length=1, max_length=1000)
    is_active: bool | None = None
class LeadSourceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID; name: str; slug: str; description: str | None; is_active: bool; created_at: datetime; updated_at: datetime

# ── Lead ──
class LeadCreate(SanitizedModel):
    title: NameStr = Field(min_length=2, max_length=300)
    company_name: NameStr | None = None; contact_name: NameStr | None = None
    email: EmailStr | None = None; phone: PhoneNumber = None
    source_id: uuid.UUID | None = None; client_id: uuid.UUID | None = None
    status: str = Field(min_length=1, max_length=50); pipeline_stage_id: uuid.UUID | None = None; priority: str = Field(min_length=1, max_length=50)
    estimated_value: float | None = Field(None, ge=0.0); assigned_to: uuid.UUID | None = None; notes: str | None = Field(None, min_length=1, max_length=5000)
    interested_services: list[str] | None = None
class LeadUpdate(SanitizedModel):
    title: NameStr | None = Field(None, min_length=2, max_length=300)
    company_name: NameStr | None = None; contact_name: NameStr | None = None
    email: EmailStr | None = None; phone: PhoneNumber = None
    source_id: uuid.UUID | None = None; client_id: uuid.UUID | None = None
    status: str | None = Field(None, min_length=1, max_length=50); pipeline_stage_id: uuid.UUID | None = None; priority: str | None = Field(None, min_length=1, max_length=50)
    estimated_value: float | None = Field(None, ge=0.0); assigned_to: uuid.UUID | None = None; notes: str | None = Field(None, min_length=1, max_length=5000)
    interested_services: list[str] | None = None
class LeadRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID; title: str; company_name: str | None; contact_name: str | None
    email: str | None; phone: str | None; source_id: uuid.UUID | None; client_id: uuid.UUID | None
    status: str; pipeline_stage_id: uuid.UUID | None; priority: str; estimated_value: float | None
    assigned_to: uuid.UUID | None; converted_client_id: uuid.UUID | None
    converted_project_id: uuid.UUID | None
    converted_at: datetime | None; notes: str | None; interested_services: list[str] | None
    created_by: uuid.UUID | None; created_at: datetime; updated_at: datetime

# ── LeadActivity ──
class LeadActivityCreate(SanitizedModel):
    activity_type: str = Field(min_length=1, max_length=100)
    description: str | None = Field(None, min_length=1, max_length=5000)
class LeadActivityRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID; lead_id: uuid.UUID; activity_type: str; description: str | None
    performed_by: uuid.UUID | None; created_at: datetime

# ── LeadFollowup ──
class LeadFollowupCreate(SanitizedModel):
    followup_date: datetime; followup_type: str = Field(min_length=1, max_length=100)
    notes: str | None = Field(None, min_length=1, max_length=5000); status: str = Field(min_length=1, max_length=50); assigned_to: uuid.UUID | None = None
class LeadFollowupUpdate(SanitizedModel):
    followup_date: datetime | None = None; followup_type: str | None = Field(None, min_length=1, max_length=100)
    notes: str | None = Field(None, min_length=1, max_length=5000); status: str | None = Field(None, min_length=1, max_length=50); assigned_to: uuid.UUID | None = None
class LeadFollowupRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID; lead_id: uuid.UUID; followup_date: datetime; followup_type: str
    notes: str | None; status: str; assigned_to: uuid.UUID | None; created_at: datetime; updated_at: datetime

# ── SalesPipeline ──
class SalesPipelineCreate(SanitizedModel):
    name: NameStr = Field(min_length=2, max_length=200)
    stage: str = Field(min_length=1, max_length=100)
    order: int = 0; probability: float | None = None; is_active: bool = True
class SalesPipelineUpdate(SanitizedModel):
    name: NameStr | None = Field(None, min_length=2, max_length=200)
    stage: str | None = Field(None, min_length=1, max_length=100); order: int | None = None; probability: float | None = None; is_active: bool | None = None
class SalesPipelineRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID; name: str; stage: str; order: int; probability: float | None
    is_active: bool; created_at: datetime; updated_at: datetime

# ── Lead Conversion ──
class LeadConvertRequest(SanitizedModel):
    # If omitted, a new Client is created automatically from the lead's own fields.
    client_id: uuid.UUID | None = None

class LeadMarkLostRequest(SanitizedModel):
    reason: str | None = Field(None, min_length=1, max_length=2000)
    # 'LOST' (meeting/negotiation fell through) or 'REJECTED' (client actively declined).
    terminal_status: str = Field(min_length=1, max_length=50)
