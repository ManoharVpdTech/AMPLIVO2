"""Pydantic schemas for the Finance module."""
from __future__ import annotations
import uuid
from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, Field

from app.core.field_types import HttpUrlStr
from app.core.sanitizers import SanitizedModel

# ── Invoice ──
class InvoiceBase(SanitizedModel):
    # One of client_id/lead_id must be set (DB check constraint) - an advance
    # invoice is created against a Lead, before any Client exists.
    client_id: uuid.UUID | None = None
    lead_id: uuid.UUID | None = None
    proposal_id: uuid.UUID | None = None
    project_id: uuid.UUID | None = None
    task_submission_id: uuid.UUID | None = None
    invoice_number: str = Field(min_length=1, max_length=99)
    invoice_type: str = Field(min_length=1, max_length=50)
    status: str = Field(min_length=1, max_length=50)
    issue_date: date
    due_date: date
    subtotal: float = 0.0
    tax_total: float = 0.0
    total_amount: float = 0.0
    currency: str = Field(min_length=1, max_length=10)
    notes: str | None = Field(None, min_length=1, max_length=5000)

class InvoiceCreate(InvoiceBase): pass
class InvoiceUpdate(SanitizedModel):
    client_id: uuid.UUID | None = None
    invoice_number: str | None = Field(None, min_length=1, max_length=99)
    status: str | None = Field(None, min_length=1, max_length=50)
    issue_date: date | None = None
    due_date: date | None = None
    subtotal: float | None = None
    tax_total: float | None = None
    total_amount: float | None = None
    currency: str | None = Field(None, min_length=1, max_length=10)
    notes: str | None = Field(None, min_length=1, max_length=5000)

class InvoiceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    client_id: uuid.UUID | None
    lead_id: uuid.UUID | None
    proposal_id: uuid.UUID | None
    project_id: uuid.UUID | None
    task_submission_id: uuid.UUID | None
    invoice_number: str
    invoice_type: str
    status: str
    issue_date: date
    due_date: date
    subtotal: float
    tax_total: float
    total_amount: float
    currency: str
    notes: str | None
    created_at: datetime
    updated_at: datetime

class AdvanceInvoiceCreateRequest(SanitizedModel):
    """Generates the 25% advance invoice for a lead's accepted proposal -
    the server computes the split and invoice number; the client only
    supplies the deal total and due date."""
    lead_id: uuid.UUID
    proposal_id: uuid.UUID | None = None
    total_deal_amount: float = Field(gt=0)
    tax_rate: float = Field(0.0, ge=0, le=100)
    due_date: date
    currency: str = Field(min_length=1, max_length=10)
    notes: str | None = Field(None, min_length=1, max_length=5000)

class FinalInvoiceCreateRequest(SanitizedModel):
    project_id: uuid.UUID
    task_submission_id: uuid.UUID | None = None
    total_deal_amount: float = Field(gt=0)
    tax_rate: float = Field(0.0, ge=0, le=100)
    due_date: date
    currency: str = Field(min_length=1, max_length=10)
    notes: str | None = Field(None, min_length=1, max_length=5000)

# ── InvoiceItem ──
class InvoiceItemBase(SanitizedModel):
    description: str = Field(min_length=1, max_length=2000)
    quantity: float = 1.0
    unit_price: float
    tax_rate: float = 0.0
    total: float

class InvoiceItemCreate(InvoiceItemBase): pass
class InvoiceItemUpdate(SanitizedModel):
    description: str | None = Field(None, min_length=1, max_length=2000)
    quantity: float | None = None
    unit_price: float | None = None
    tax_rate: float | None = None
    total: float | None = None

class InvoiceItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    invoice_id: uuid.UUID
    description: str
    quantity: float
    unit_price: float
    tax_rate: float
    total: float
    created_at: datetime

# ── Payment ──
class PaymentBase(SanitizedModel):
    amount: float
    payment_date: date
    payment_method: str = Field(min_length=1, max_length=100)
    reference_number: str | None = Field(None, min_length=1, max_length=200)
    status: str = Field(min_length=1, max_length=50)

class PaymentCreate(PaymentBase): pass
class PaymentUpdate(SanitizedModel):
    amount: float | None = None
    payment_date: date | None = None
    payment_method: str | None = Field(None, min_length=1, max_length=100)
    reference_number: str | None = Field(None, min_length=1, max_length=200)
    status: str | None = Field(None, min_length=1, max_length=50)

class PaymentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    invoice_id: uuid.UUID
    amount: float
    payment_date: date
    payment_method: str
    reference_number: str | None
    status: str
    submitted_by_client: bool
    finance_verified_by: uuid.UUID | None
    finance_verified_at: datetime | None
    crm_verified_by: uuid.UUID | None
    crm_verified_at: datetime | None
    created_at: datetime

class ClientPaymentSubmitRequest(SanitizedModel):
    amount: float = Field(gt=0)
    payment_method: str = Field(min_length=1, max_length=100)
    reference_number: str | None = Field(None, min_length=1, max_length=200)
    payment_date: date | None = None

class PaymentRejectRequest(SanitizedModel):
    reason: str | None = Field(None, min_length=1, max_length=2000)

# ── Expense ──
class ExpenseBase(SanitizedModel):
    category: str = Field(min_length=1, max_length=100)
    amount: float = Field(gt=0)
    currency: str = Field(min_length=1, max_length=10)
    expense_date: date
    description: str | None = Field(None, min_length=1, max_length=2000)
    receipt_url: HttpUrlStr = None

class ExpenseCreate(ExpenseBase): pass
class ExpenseUpdate(SanitizedModel):
    category: str | None = Field(None, min_length=1, max_length=100)
    amount: float | None = Field(None, gt=0)
    currency: str | None = Field(None, min_length=1, max_length=10)
    expense_date: date | None = None
    description: str | None = Field(None, min_length=1, max_length=2000)
    receipt_url: HttpUrlStr = None

class ExpenseRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    category: str
    amount: float
    currency: str
    expense_date: date
    description: str | None
    receipt_url: str | None
    logged_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
