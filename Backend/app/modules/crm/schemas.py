"""Pydantic schemas for the CRM module."""
from __future__ import annotations
import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.core.field_types import HttpUrlStr, NameStr, PhoneNumber
from app.core.sanitizers import SanitizedModel

# ── Client ──────────────────────────────────────────────────────────────
class ClientBase(SanitizedModel):
    company_name: NameStr = Field(min_length=2, max_length=300)
    display_name: NameStr | None = None
    industry: str | None = Field(None, min_length=1, max_length=200)
    website: HttpUrlStr = None
    email: EmailStr | None = None
    phone: PhoneNumber = None
    gst_number: str | None = Field(None, min_length=1, max_length=50)
    pan_number: str | None = Field(None, min_length=1, max_length=20)
    client_type: str | None = Field(None, min_length=1, max_length=50)
    status: str = Field(min_length=1, max_length=50)
    assigned_to: uuid.UUID | None = None
    branch_id: uuid.UUID | None = None
    onboarding_date: datetime | None = None
    notes: str | None = Field(None, min_length=1, max_length=5000)
    is_active: bool = True

class ClientCreate(ClientBase): pass
class ClientUpdate(SanitizedModel):
    company_name: NameStr | None = Field(None, min_length=2, max_length=300)
    display_name: NameStr | None = None
    industry: str | None = Field(None, min_length=1, max_length=200)
    website: HttpUrlStr = None
    email: EmailStr | None = None
    phone: PhoneNumber = None
    gst_number: str | None = Field(None, min_length=1, max_length=50)
    pan_number: str | None = Field(None, min_length=1, max_length=20)
    client_type: str | None = Field(None, min_length=1, max_length=50)
    status: str | None = Field(None, min_length=1, max_length=50)
    assigned_to: uuid.UUID | None = None
    branch_id: uuid.UUID | None = None
    onboarding_date: datetime | None = None
    notes: str | None = Field(None, min_length=1, max_length=5000)
    is_active: bool | None = None

class ClientRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    company_name: str
    display_name: str | None
    industry: str | None
    website: str | None
    email: str | None
    phone: str | None
    gst_number: str | None
    pan_number: str | None
    client_type: str | None
    status: str
    assigned_to: uuid.UUID | None
    branch_id: uuid.UUID | None
    onboarding_date: datetime | None
    notes: str | None
    is_active: bool
    created_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

# ── Client Contact ──────────────────────────────────────────────────────
class ClientContactBase(SanitizedModel):
    name: NameStr = Field(min_length=2, max_length=200)
    email: EmailStr | None = None
    phone: PhoneNumber = None
    designation: str | None = Field(None, min_length=1, max_length=200)
    is_primary: bool = False
    is_active: bool = True

class ClientContactCreate(ClientContactBase): pass
class ClientContactUpdate(SanitizedModel):
    name: NameStr | None = Field(None, min_length=2, max_length=200)
    email: EmailStr | None = None
    phone: PhoneNumber = None
    designation: str | None = Field(None, min_length=1, max_length=200)
    is_primary: bool | None = None
    is_active: bool | None = None

class ClientContactRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    client_id: uuid.UUID
    name: str
    email: str | None
    phone: str | None
    designation: str | None
    is_primary: bool
    is_active: bool
    user_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

class ClientDetailRead(ClientRead):
    """Adds the client's named contacts (eager-loaded by
    ClientRepository.get_detail) - only used on the single-client GET routes.
    The list route uses plain ClientRead since get_all_filtered doesn't
    eager-load contacts and accessing them there would trigger an
    unsupported lazy-load in the async ORM session."""
    contacts: list[ClientContactRead] = []

# ── Client Address ──────────────────────────────────────────────────────
class ClientAddressBase(SanitizedModel):
    address_type: str = Field(min_length=1, max_length=100)
    address_line_1: str = Field(min_length=2, max_length=500)
    address_line_2: str | None = Field(None, min_length=1, max_length=500)
    city: str = Field(min_length=1, max_length=100)
    state: str | None = Field(None, min_length=1, max_length=100)
    country: str = Field(min_length=1, max_length=100)
    postal_code: str | None = Field(None, min_length=1, max_length=20)
    is_primary: bool = False

class ClientAddressCreate(ClientAddressBase): pass
class ClientAddressUpdate(SanitizedModel):
    address_type: str | None = Field(None, min_length=1, max_length=100)
    address_line_1: str | None = Field(None, min_length=2, max_length=500)
    address_line_2: str | None = Field(None, min_length=1, max_length=500)
    city: str | None = Field(None, min_length=1, max_length=100)
    state: str | None = Field(None, min_length=1, max_length=100)
    country: str | None = Field(None, min_length=1, max_length=100)
    postal_code: str | None = Field(None, min_length=1, max_length=20)
    is_primary: bool | None = None

class ClientAddressRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    client_id: uuid.UUID
    address_type: str
    address_line_1: str
    address_line_2: str | None
    city: str
    state: str | None
    country: str
    postal_code: str | None
    is_primary: bool
    created_at: datetime
    updated_at: datetime

# ── Client Document ─────────────────────────────────────────────────────
class ClientDocumentBase(SanitizedModel):
    title: NameStr = Field(min_length=2, max_length=300)
    document_type: str | None = Field(None, min_length=1, max_length=100)
    file_url: HttpUrlStr = None
    file_size: int | None = None

class ClientDocumentCreate(ClientDocumentBase): pass
class ClientDocumentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    client_id: uuid.UUID
    title: str
    document_type: str | None
    file_url: str | None
    file_size: int | None
    uploaded_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

# ── Client Note ─────────────────────────────────────────────────────────
class ClientNoteBase(SanitizedModel):
    content: str = Field(min_length=1)

class ClientNoteCreate(ClientNoteBase): pass
class ClientNoteRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    client_id: uuid.UUID
    content: str
    created_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

# ── Proposal ─────────────────────────────────────────────────────────────
class ProposalCreate(SanitizedModel):
    title: NameStr = Field(min_length=2, max_length=300)
    description: str | None = Field(None, min_length=1, max_length=5000)
    amount: float | None = Field(None, ge=0.0)

class ProposalUpdate(SanitizedModel):
    title: NameStr | None = Field(None, min_length=2, max_length=300)
    description: str | None = Field(None, min_length=1, max_length=5000)
    amount: float | None = Field(None, ge=0.0)
    status: str | None = Field(None, min_length=1, max_length=50)

class ProposalRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    client_id: uuid.UUID | None
    lead_id: uuid.UUID | None
    title: str
    description: str | None
    amount: float | None
    status: str
    decision_notes: str | None
    sent_at: datetime | None
    decided_at: datetime | None
    created_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
