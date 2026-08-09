"""API routes for Finance."""
from __future__ import annotations
import uuid
from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.exceptions import ForbiddenException
from app.core.pagination import PaginatedResponse, PaginationParams
from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db
from app.dependencies.rbac import STAFF_ROLE_SLUGS, require_roles
from app.dependencies.tenant import get_current_client_id
from app.models.user import User
from app.modules.finance.dependencies import *
from app.modules.finance.schemas import *
from app.modules.finance.service import *
from app.modules.public_client_actions.schemas import ClientPaymentSubmitRequest

router = APIRouter(prefix="/finance", tags=["Finance"], dependencies=[Depends(get_current_user)])


@router.get(
    "/email-delivery-status",
    summary="Whether outgoing email is actually configured to deliver (vs. the in-memory dev stub)",
)
async def get_email_delivery_status(_: User = Depends(get_current_user), _role: str = Depends(require_roles(*STAFF_ROLE_SLUGS))):
    from app.services.email_service import EmailService

    return {"live": EmailService().is_live}


# ── Invoices ──
@router.get("/invoices", response_model=PaginatedResponse[InvoiceRead], summary="List invoices")
async def list_invoices(
    params: PaginationParams = Depends(),
    client_id: uuid.UUID | None = Query(None),
    invoice_status: str | None = Query(None, alias="status"),
    svc: InvoiceService = Depends(get_invoice_service),
    _: User = Depends(get_current_user),
    scoped_client_id: uuid.UUID | None = Depends(get_current_client_id),
    _role: str = Depends(require_roles("finance")),
):
    effective_client_id = scoped_client_id if scoped_client_id is not None else client_id
    items, total = await svc.list_invoices(
        search=params.search, client_id=effective_client_id, status=invoice_status,
        sort_by=params.sort_by, sort_order=params.sort_order,
        offset=params.offset, limit=params.page_size,
    )
    return PaginatedResponse[InvoiceRead].create(items=[InvoiceRead.model_validate(x) for x in items], total=total, page=params.page, page_size=params.page_size)

@router.post("/invoices", response_model=InvoiceRead, status_code=status.HTTP_201_CREATED, summary="Create invoice")
async def create_invoice(payload: InvoiceCreate, db: AsyncSession = Depends(get_db), svc: InvoiceService = Depends(get_invoice_service), current_user: User = Depends(get_current_user), _role: str = Depends(require_roles("finance"))):
    i = await svc.create_invoice(payload.model_dump(), actor_id=current_user.id); await db.commit()
    return InvoiceRead.model_validate(i)

@router.post("/invoices/advance", response_model=InvoiceRead, status_code=status.HTTP_201_CREATED, summary="Generate the 25% advance invoice for a lead (auto CRM handoff)")
async def create_advance_invoice(payload: AdvanceInvoiceCreateRequest, db: AsyncSession = Depends(get_db), svc: InvoiceService = Depends(get_invoice_service), current_user: User = Depends(get_current_user), _role: str = Depends(require_roles("sales"))):
    i = await svc.create_advance_invoice_for_lead(
        lead_id=payload.lead_id, proposal_id=payload.proposal_id, total_deal_amount=payload.total_deal_amount,
        tax_rate=payload.tax_rate, due_date=payload.due_date, currency=payload.currency, notes=payload.notes,
        actor_id=current_user.id,
    )
    await db.commit()
    return InvoiceRead.model_validate(i)

@router.post("/invoices/final", response_model=InvoiceRead, status_code=status.HTTP_201_CREATED, summary="Generate the remaining 75% final invoice for a project")
async def create_final_invoice(payload: FinalInvoiceCreateRequest, db: AsyncSession = Depends(get_db), svc: InvoiceService = Depends(get_invoice_service), current_user: User = Depends(get_current_user), _role: str = Depends(require_roles("finance", "admin"))):
    i = await svc.create_final_invoice_for_project(
        project_id=payload.project_id, task_submission_id=payload.task_submission_id, total_deal_amount=payload.total_deal_amount,
        tax_rate=payload.tax_rate, due_date=payload.due_date, currency=payload.currency, notes=payload.notes,
        actor_id=current_user.id,
    )
    await db.commit()
    return InvoiceRead.model_validate(i)

@router.post("/invoices/{invoice_id}/crm-approve", response_model=InvoiceRead, summary="CRM approves the advance/final invoice - sends the payment-link email")
async def crm_approve_invoice(invoice_id: uuid.UUID, db: AsyncSession = Depends(get_db), svc: InvoiceService = Depends(get_invoice_service), current_user: User = Depends(get_current_user), _role: str = Depends(require_roles("crm"))):
    i = await svc.crm_approve_advance(invoice_id, actor_id=current_user.id); await db.commit()
    return InvoiceRead.model_validate(i)

@router.post("/invoices/{invoice_id}/resend-email", response_model=InvoiceRead, summary="Resend the payment-link email for an invoice")
async def resend_invoice_email(invoice_id: uuid.UUID, db: AsyncSession = Depends(get_db), svc: InvoiceService = Depends(get_invoice_service), current_user: User = Depends(get_current_user), _role: str = Depends(require_roles("crm", "finance"))):
    i = await svc.crm_approve_advance(invoice_id, actor_id=current_user.id); await db.commit()
    return InvoiceRead.model_validate(i)

@router.get("/invoices/by-lead/{lead_id}/advance", response_model=InvoiceRead | None, summary="Get the advance invoice for a lead, if one exists")
async def get_advance_invoice_for_lead(lead_id: uuid.UUID, svc: InvoiceService = Depends(get_invoice_service), _: User = Depends(get_current_user), _role: str = Depends(require_roles(*STAFF_ROLE_SLUGS))):
    invoice = await svc.get_advance_for_lead(lead_id)
    return InvoiceRead.model_validate(invoice) if invoice else None

@router.get("/invoices/{invoice_id}/pdf", summary="Download invoice as PDF")
async def get_invoice_pdf(invoice_id: uuid.UUID, svc: InvoiceService = Depends(get_invoice_service), _: User = Depends(get_current_user), scoped_client_id: uuid.UUID | None = Depends(get_current_client_id), _role: str = Depends(require_roles("finance"))):
    from app.services.pdf_service import render_invoice_pdf
    invoice = await svc.get_invoice(invoice_id, scoped_client_id=scoped_client_id)
    pdf_bytes = render_invoice_pdf(invoice)
    return Response(content=pdf_bytes, media_type="application/pdf", headers={
        "Content-Disposition": f'inline; filename="invoice-{invoice.invoice_number}.pdf"'
    })

@router.get("/invoices/{invoice_id}", response_model=InvoiceRead, summary="Get invoice")
async def get_invoice(invoice_id: uuid.UUID, svc: InvoiceService = Depends(get_invoice_service), _: User = Depends(get_current_user), scoped_client_id: uuid.UUID | None = Depends(get_current_client_id), _role: str = Depends(require_roles("finance"))):
    return InvoiceRead.model_validate(await svc.get_invoice(invoice_id, scoped_client_id=scoped_client_id))

@router.post(
    "/invoices/{invoice_id}/client-payment", response_model=PaymentRead, status_code=status.HTTP_201_CREATED,
    summary="Client (logged into the portal) submits proof of payment for their own invoice",
)
async def submit_client_portal_payment(
    invoice_id: uuid.UUID,
    payload: ClientPaymentSubmitRequest,
    db: AsyncSession = Depends(get_db),
    invoice_svc: InvoiceService = Depends(get_invoice_service),
    payment_svc: PaymentService = Depends(get_payment_service),
    _: User = Depends(get_current_user),
    scoped_client_id: uuid.UUID | None = Depends(get_current_client_id),
):
    """Authenticated equivalent of the magic-link `/public/invoices/{token}/payments`
    route - same `submit_client_payment` service call (starts the two-step
    Finance-then-CRM manual verification, never auto-confirmed), just reached
    from an already-logged-in client-portal session instead of a token link.
    `get_invoice` 404s/403s if this invoice doesn't belong to the caller's
    own client - a client can never submit proof against someone else's invoice.
    """
    if scoped_client_id is None:
        raise ForbiddenException("Only client-portal accounts can submit payment proof through this endpoint.")
    await invoice_svc.get_invoice(invoice_id, scoped_client_id=scoped_client_id)
    payment = await payment_svc.submit_client_payment(
        invoice_id,
        {"amount": payload.amount, "payment_method": payload.payment_method, "reference_number": payload.reference_number},
        token_id=None,
    )
    await db.commit()
    return PaymentRead.model_validate(payment)

@router.put("/invoices/{invoice_id}", response_model=InvoiceRead, summary="Update invoice")
async def update_invoice(invoice_id: uuid.UUID, payload: InvoiceUpdate, db: AsyncSession = Depends(get_db), svc: InvoiceService = Depends(get_invoice_service), _: User = Depends(get_current_user), scoped_client_id: uuid.UUID | None = Depends(get_current_client_id), _role: str = Depends(require_roles("finance"))):
    i = await svc.update_invoice(invoice_id, payload.model_dump(exclude_unset=True), scoped_client_id=scoped_client_id); await db.commit()
    return InvoiceRead.model_validate(i)

@router.delete("/invoices/{invoice_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete invoice")
async def delete_invoice(invoice_id: uuid.UUID, db: AsyncSession = Depends(get_db), svc: InvoiceService = Depends(get_invoice_service), _: User = Depends(get_current_user), scoped_client_id: uuid.UUID | None = Depends(get_current_client_id), _role: str = Depends(require_roles("finance"))):
    await svc.delete_invoice(invoice_id, scoped_client_id=scoped_client_id); await db.commit()

# ── Invoice Items ──
@router.get("/invoices/{invoice_id}/items", response_model=list[InvoiceItemRead], summary="List invoice items")
async def list_invoice_items(invoice_id: uuid.UUID, svc: InvoiceItemService = Depends(get_invoice_item_service), invoice_svc: InvoiceService = Depends(get_invoice_service), _: User = Depends(get_current_user), scoped_client_id: uuid.UUID | None = Depends(get_current_client_id), _role: str = Depends(require_roles("finance"))):
    await invoice_svc.get_invoice(invoice_id, scoped_client_id=scoped_client_id)
    return [InvoiceItemRead.model_validate(x) for x in await svc.list_items(invoice_id)]

@router.post("/invoices/{invoice_id}/items", response_model=InvoiceItemRead, status_code=status.HTTP_201_CREATED, summary="Add invoice item")
async def create_invoice_item(invoice_id: uuid.UUID, payload: InvoiceItemCreate, db: AsyncSession = Depends(get_db), svc: InvoiceItemService = Depends(get_invoice_item_service), _: User = Depends(get_current_user), _role: str = Depends(require_roles("finance"))):
    item = await svc.create_item(invoice_id, payload.model_dump()); await db.commit()
    return InvoiceItemRead.model_validate(item)

@router.put("/invoice-items/{item_id}", response_model=InvoiceItemRead, summary="Update invoice item")
async def update_invoice_item(item_id: uuid.UUID, payload: InvoiceItemUpdate, db: AsyncSession = Depends(get_db), svc: InvoiceItemService = Depends(get_invoice_item_service), _: User = Depends(get_current_user), _role: str = Depends(require_roles("finance"))):
    item = await svc.update_item(item_id, payload.model_dump(exclude_unset=True)); await db.commit()
    return InvoiceItemRead.model_validate(item)

@router.delete("/invoice-items/{item_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete invoice item")
async def delete_invoice_item(item_id: uuid.UUID, db: AsyncSession = Depends(get_db), svc: InvoiceItemService = Depends(get_invoice_item_service), _: User = Depends(get_current_user), _role: str = Depends(require_roles("finance"))):
    await svc.delete_item(item_id); await db.commit()

# ── Payments ──
@router.get("/payments", response_model=PaginatedResponse[PaymentRead], summary="List all payments (across every invoice)")
async def list_all_payments(
    params: PaginationParams = Depends(),
    payment_status: str | None = Query(None, alias="status"),
    svc: PaymentService = Depends(get_payment_service),
    _: User = Depends(get_current_user),
    # "crm" must be able to list payments, not just act on individual ones -
    # verify-crm/reject below already grant crm access, but this endpoint
    # (the one the CRM Payments Dashboard actually calls to populate the
    # page) was left finance-only, so every CRM-role user 403'd on load and
    # the dashboard silently rendered as if zero payments existed.
    _role: str = Depends(require_roles("finance", "crm")),
):
    items, total = await svc.list_all_payments(
        status=payment_status, sort_by=params.sort_by, sort_order=params.sort_order,
        offset=params.offset, limit=params.page_size,
    )
    return PaginatedResponse[PaymentRead].create(items=[PaymentRead.model_validate(p) for p in items], total=total, page=params.page, page_size=params.page_size)

@router.get("/invoices/{invoice_id}/payments", response_model=list[PaymentRead], summary="List payments for invoice")
async def list_payments(invoice_id: uuid.UUID, svc: PaymentService = Depends(get_payment_service), invoice_svc: InvoiceService = Depends(get_invoice_service), _: User = Depends(get_current_user), scoped_client_id: uuid.UUID | None = Depends(get_current_client_id), _role: str = Depends(require_roles("finance"))):
    await invoice_svc.get_invoice(invoice_id, scoped_client_id=scoped_client_id)
    return [PaymentRead.model_validate(x) for x in await svc.list_payments(invoice_id)]

@router.post("/invoices/{invoice_id}/payments", response_model=PaymentRead, status_code=status.HTTP_201_CREATED, summary="Add payment")
async def create_payment(invoice_id: uuid.UUID, payload: PaymentCreate, db: AsyncSession = Depends(get_db), svc: PaymentService = Depends(get_payment_service), _: User = Depends(get_current_user), _role: str = Depends(require_roles("finance"))):
    p = await svc.create_payment(invoice_id, payload.model_dump()); await db.commit()
    return PaymentRead.model_validate(p)

@router.put("/payments/{payment_id}", response_model=PaymentRead, summary="Update payment")
async def update_payment(payment_id: uuid.UUID, payload: PaymentUpdate, db: AsyncSession = Depends(get_db), svc: PaymentService = Depends(get_payment_service), _: User = Depends(get_current_user), _role: str = Depends(require_roles("finance"))):
    p = await svc.update_payment(payment_id, payload.model_dump(exclude_unset=True)); await db.commit()
    return PaymentRead.model_validate(p)

@router.delete("/payments/{payment_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete payment")
async def delete_payment(payment_id: uuid.UUID, db: AsyncSession = Depends(get_db), svc: PaymentService = Depends(get_payment_service), _: User = Depends(get_current_user), _role: str = Depends(require_roles("finance"))):
    await svc.delete_payment(payment_id); await db.commit()

# ── Two-step manual payment verification (Finance, then CRM) ──
@router.post("/payments/{payment_id}/verify-finance", response_model=PaymentRead, summary="Finance verifies a submitted payment")
async def finance_verify_payment(payment_id: uuid.UUID, db: AsyncSession = Depends(get_db), svc: PaymentService = Depends(get_payment_service), current_user: User = Depends(get_current_user), _role: str = Depends(require_roles("finance"))):
    p = await svc.finance_verify(payment_id, actor_id=current_user.id); await db.commit()
    return PaymentRead.model_validate(p)

@router.post("/payments/{payment_id}/verify-crm", response_model=PaymentRead, summary="CRM gives final sign-off on a finance-verified payment")
async def crm_verify_payment(payment_id: uuid.UUID, db: AsyncSession = Depends(get_db), svc: PaymentService = Depends(get_payment_service), current_user: User = Depends(get_current_user), _role: str = Depends(require_roles("crm"))):
    p = await svc.crm_verify(payment_id, actor_id=current_user.id); await db.commit()
    return PaymentRead.model_validate(p)

@router.post("/payments/{payment_id}/reject", response_model=PaymentRead, summary="Reject a submitted payment")
async def reject_payment(payment_id: uuid.UUID, payload: PaymentRejectRequest, db: AsyncSession = Depends(get_db), svc: PaymentService = Depends(get_payment_service), current_user: User = Depends(get_current_user), _role: str = Depends(require_roles("finance", "crm"))):
    p = await svc.reject_payment(payment_id, reason=payload.reason, actor_id=current_user.id); await db.commit()
    return PaymentRead.model_validate(p)

# ── Expenses ──
@router.get("/expenses", response_model=PaginatedResponse[ExpenseRead], summary="List expenses")
async def list_expenses(
    params: PaginationParams = Depends(),
    category: str | None = Query(None),
    svc: ExpenseService = Depends(get_expense_service),
    _: User = Depends(get_current_user),
    _role: str = Depends(require_roles("finance")),
):
    items, total = await svc.list_expenses(
        search=params.search, category=category,
        sort_by=params.sort_by, sort_order=params.sort_order,
        offset=params.offset, limit=params.page_size,
    )
    return PaginatedResponse[ExpenseRead].create(items=[ExpenseRead.model_validate(x) for x in items], total=total, page=params.page, page_size=params.page_size)

@router.post("/expenses", response_model=ExpenseRead, status_code=status.HTTP_201_CREATED, summary="Log expense")
async def create_expense(payload: ExpenseCreate, db: AsyncSession = Depends(get_db), svc: ExpenseService = Depends(get_expense_service), current_user: User = Depends(get_current_user), _role: str = Depends(require_roles("finance"))):
    e = await svc.create_expense(payload.model_dump(), logged_by=current_user.id); await db.commit()
    return ExpenseRead.model_validate(e)

@router.get("/expenses/{expense_id}", response_model=ExpenseRead, summary="Get expense")
async def get_expense(expense_id: uuid.UUID, svc: ExpenseService = Depends(get_expense_service), _: User = Depends(get_current_user), _role: str = Depends(require_roles("finance"))):
    return ExpenseRead.model_validate(await svc.get_expense(expense_id))

@router.put("/expenses/{expense_id}", response_model=ExpenseRead, summary="Update expense")
async def update_expense(expense_id: uuid.UUID, payload: ExpenseUpdate, db: AsyncSession = Depends(get_db), svc: ExpenseService = Depends(get_expense_service), _: User = Depends(get_current_user), _role: str = Depends(require_roles("finance"))):
    e = await svc.update_expense(expense_id, payload.model_dump(exclude_unset=True)); await db.commit()
    return ExpenseRead.model_validate(e)

@router.delete("/expenses/{expense_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete expense")
async def delete_expense(expense_id: uuid.UUID, db: AsyncSession = Depends(get_db), svc: ExpenseService = Depends(get_expense_service), _: User = Depends(get_current_user), _role: str = Depends(require_roles("finance"))):
    await svc.delete_expense(expense_id); await db.commit()
