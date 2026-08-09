"""API routes for the CRM module."""
from __future__ import annotations
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import func as sa_func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.exceptions import BadRequestException
from app.core.pagination import PaginatedResponse, PaginationParams
from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db
from app.dependencies.rbac import STAFF_ROLE_SLUGS, require_roles
from app.dependencies.tenant import get_current_client_id
from app.models.user import User
from app.modules.crm.dependencies import (
    get_client_address_service, get_client_contact_service,
    get_client_document_service, get_client_note_service, get_client_service,
    get_proposal_service,
)
from app.modules.crm.schemas import *
from app.modules.crm.service import (
    ClientAddressService, ClientContactService, ClientDocumentService,
    ClientNoteService, ClientService, ProposalService,
)

router = APIRouter(prefix="/clients", tags=["CRM — Clients"])

# ── Clients ─────────────────────────────────────────────────────────────

@router.get("", response_model=PaginatedResponse[ClientRead], summary="List clients")
async def list_clients(
    params: PaginationParams = Depends(),
    client_status: str | None = Query(None, alias="status"),
    client_type: str | None = Query(None),
    assigned_to: uuid.UUID | None = Query(None),
    branch_id: uuid.UUID | None = Query(None),
    is_active: bool | None = Query(None),
    svc: ClientService = Depends(get_client_service),
    _: User = Depends(get_current_user),
    scoped_client_id: uuid.UUID | None = Depends(get_current_client_id),
):
    if scoped_client_id:
        return PaginatedResponse[ClientRead].create(
            items=[ClientRead.model_validate(await svc.get_client(scoped_client_id))],
            total=1, page=1, page_size=params.page_size,
        )
    items, total = await svc.list_clients(
        search=params.search, status=client_status, client_type=client_type,
        assigned_to=assigned_to, branch_id=branch_id, is_active=is_active,
        sort_by=params.sort_by, sort_order=params.sort_order,
        offset=params.offset, limit=params.page_size,
    )
    return PaginatedResponse[ClientRead].create(
        items=[ClientRead.model_validate(c) for c in items],
        total=total, page=params.page, page_size=params.page_size,
    )

@router.post("", response_model=ClientRead, status_code=status.HTTP_201_CREATED, summary="Create client")
async def create_client(
    payload: ClientCreate, db: AsyncSession = Depends(get_db),
    svc: ClientService = Depends(get_client_service),
    current_user: User = Depends(get_current_user),
    _admin: str = Depends(require_roles("sales")),
):
    import sqlalchemy
    try:
        client = await svc.create_client(payload.model_dump(), created_by=current_user.id)
        await db.commit()
        return ClientRead.model_validate(client)
    except sqlalchemy.exc.IntegrityError:
        await db.rollback()
        raise BadRequestException("Invalid foreign key reference (assigned_to or branch_id).")

@router.get("/me", response_model=ClientDetailRead, summary="Get my own company (client-portal user)")
async def get_my_client(svc: ClientService = Depends(get_client_service), _: User = Depends(get_current_user), scoped_client_id: uuid.UUID | None = Depends(get_current_client_id)):
    if scoped_client_id is None:
        raise BadRequestException("This account is not a client-portal user.")
    return ClientDetailRead.model_validate(await svc.get_client(scoped_client_id))

@router.get("/{client_id}", response_model=ClientDetailRead, summary="Get client")
async def get_client(client_id: uuid.UUID, svc: ClientService = Depends(get_client_service), _: User = Depends(get_current_user), scoped_client_id: uuid.UUID | None = Depends(get_current_client_id)):
    return ClientDetailRead.model_validate(await svc.get_client(client_id, scoped_client_id=scoped_client_id))

@router.put("/{client_id}", response_model=ClientRead, summary="Update client")
async def update_client(client_id: uuid.UUID, payload: ClientUpdate, db: AsyncSession = Depends(get_db),
                        svc: ClientService = Depends(get_client_service), current_user: User = Depends(get_current_user),
                        scoped_client_id: uuid.UUID | None = Depends(get_current_client_id),
                        _admin: str = Depends(require_roles("sales"))):
    import sqlalchemy
    try:
        client = await svc.update_client(client_id, payload.model_dump(exclude_unset=True), scoped_client_id=scoped_client_id, actor_id=current_user.id)
        await db.commit()
        return ClientRead.model_validate(client)
    except sqlalchemy.exc.IntegrityError:
        await db.rollback()
        raise BadRequestException("Invalid foreign key reference (assigned_to or branch_id).")

@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete client")
async def delete_client(client_id: uuid.UUID, db: AsyncSession = Depends(get_db),
                        svc: ClientService = Depends(get_client_service), _: User = Depends(get_current_user),
                        scoped_client_id: uuid.UUID | None = Depends(get_current_client_id),
                        _admin: str = Depends(require_roles("sales"))):
    await svc.delete_client(client_id, scoped_client_id=scoped_client_id); await db.commit()

# ── Client Contacts ────────────────────────────────────────────────────

@router.get("/{client_id}/contacts", response_model=list[ClientContactRead], summary="List client contacts")
async def list_contacts(client_id: uuid.UUID, svc: ClientContactService = Depends(get_client_contact_service), _: User = Depends(get_current_user), client_svc: ClientService = Depends(get_client_service), scoped_client_id: uuid.UUID | None = Depends(get_current_client_id)):
    await client_svc.get_client(client_id, scoped_client_id=scoped_client_id)
    return [ClientContactRead.model_validate(c) for c in await svc.list_contacts(client_id)]

@router.post("/{client_id}/contacts", response_model=ClientContactRead, status_code=status.HTTP_201_CREATED, summary="Add contact")
async def create_contact(client_id: uuid.UUID, payload: ClientContactCreate, db: AsyncSession = Depends(get_db),
                         client_svc: ClientService = Depends(get_client_service),
                         svc: ClientContactService = Depends(get_client_contact_service), _: User = Depends(get_current_user),
                         scoped_client_id: uuid.UUID | None = Depends(get_current_client_id),
                         _admin: str = Depends(require_roles("sales"))):
    await client_svc.get_client(client_id, scoped_client_id=scoped_client_id)
    c = await svc.create_contact(client_id, payload.model_dump()); await db.commit()
    return ClientContactRead.model_validate(c)

@router.put("/contacts/{contact_id}", response_model=ClientContactRead, summary="Update contact")
async def update_contact(contact_id: uuid.UUID, payload: ClientContactUpdate, db: AsyncSession = Depends(get_db),
                         svc: ClientContactService = Depends(get_client_contact_service), _: User = Depends(get_current_user),
                         scoped_client_id: uuid.UUID | None = Depends(get_current_client_id),
                         _admin: str = Depends(require_roles("sales"))):
    c = await svc.update_contact(contact_id, payload.model_dump(exclude_unset=True), scoped_client_id=scoped_client_id); await db.commit()
    return ClientContactRead.model_validate(c)

@router.delete("/contacts/{contact_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete contact")
async def delete_contact(contact_id: uuid.UUID, db: AsyncSession = Depends(get_db),
                         svc: ClientContactService = Depends(get_client_contact_service), _: User = Depends(get_current_user),
                         scoped_client_id: uuid.UUID | None = Depends(get_current_client_id),
                         _admin: str = Depends(require_roles("sales"))):
    await svc.delete_contact(contact_id, scoped_client_id=scoped_client_id); await db.commit()

# ── Client Addresses ───────────────────────────────────────────────────

@router.get("/{client_id}/addresses", response_model=list[ClientAddressRead], summary="List client addresses")
async def list_addresses(client_id: uuid.UUID, svc: ClientAddressService = Depends(get_client_address_service), _: User = Depends(get_current_user), client_svc: ClientService = Depends(get_client_service), scoped_client_id: uuid.UUID | None = Depends(get_current_client_id)):
    await client_svc.get_client(client_id, scoped_client_id=scoped_client_id)
    return [ClientAddressRead.model_validate(a) for a in await svc.list_addresses(client_id)]

@router.post("/{client_id}/addresses", response_model=ClientAddressRead, status_code=status.HTTP_201_CREATED, summary="Add address")
async def create_address(client_id: uuid.UUID, payload: ClientAddressCreate, db: AsyncSession = Depends(get_db),
                         client_svc: ClientService = Depends(get_client_service),
                         svc: ClientAddressService = Depends(get_client_address_service), _: User = Depends(get_current_user),
                         scoped_client_id: uuid.UUID | None = Depends(get_current_client_id),
                         _admin: str = Depends(require_roles("sales"))):
    await client_svc.get_client(client_id, scoped_client_id=scoped_client_id)
    a = await svc.create_address(client_id, payload.model_dump()); await db.commit()
    return ClientAddressRead.model_validate(a)

@router.put("/addresses/{address_id}", response_model=ClientAddressRead, summary="Update address")
async def update_address(address_id: uuid.UUID, payload: ClientAddressUpdate, db: AsyncSession = Depends(get_db),
                         svc: ClientAddressService = Depends(get_client_address_service), _: User = Depends(get_current_user),
                         scoped_client_id: uuid.UUID | None = Depends(get_current_client_id),
                         _admin: str = Depends(require_roles("sales"))):
    a = await svc.update_address(address_id, payload.model_dump(exclude_unset=True), scoped_client_id=scoped_client_id); await db.commit()
    return ClientAddressRead.model_validate(a)

@router.delete("/addresses/{address_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete address")
async def delete_address(address_id: uuid.UUID, db: AsyncSession = Depends(get_db),
                         svc: ClientAddressService = Depends(get_client_address_service), _: User = Depends(get_current_user),
                         scoped_client_id: uuid.UUID | None = Depends(get_current_client_id),
                         _admin: str = Depends(require_roles("sales"))):
    await svc.delete_address(address_id, scoped_client_id=scoped_client_id); await db.commit()

# ── Client Documents ───────────────────────────────────────────────────

@router.get("/{client_id}/documents", response_model=list[ClientDocumentRead], summary="List client documents")
async def list_documents(client_id: uuid.UUID, svc: ClientDocumentService = Depends(get_client_document_service), _: User = Depends(get_current_user), client_svc: ClientService = Depends(get_client_service), scoped_client_id: uuid.UUID | None = Depends(get_current_client_id)):
    await client_svc.get_client(client_id, scoped_client_id=scoped_client_id)
    return [ClientDocumentRead.model_validate(d) for d in await svc.list_documents(client_id)]

@router.post("/{client_id}/documents", response_model=ClientDocumentRead, status_code=status.HTTP_201_CREATED, summary="Upload document")
async def create_document(client_id: uuid.UUID, payload: ClientDocumentCreate, db: AsyncSession = Depends(get_db),
                          client_svc: ClientService = Depends(get_client_service),
                          svc: ClientDocumentService = Depends(get_client_document_service), current_user: User = Depends(get_current_user),
                          scoped_client_id: uuid.UUID | None = Depends(get_current_client_id),
                          _admin: str = Depends(require_roles("sales"))):
    await client_svc.get_client(client_id, scoped_client_id=scoped_client_id)
    d = await svc.create_document(client_id, payload.model_dump(), uploaded_by=current_user.id); await db.commit()
    return ClientDocumentRead.model_validate(d)

@router.delete("/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete document")
async def delete_document(document_id: uuid.UUID, db: AsyncSession = Depends(get_db),
                          svc: ClientDocumentService = Depends(get_client_document_service), _: User = Depends(get_current_user),
                          scoped_client_id: uuid.UUID | None = Depends(get_current_client_id),
                          _admin: str = Depends(require_roles("sales"))):
    await svc.delete_document(document_id, scoped_client_id=scoped_client_id); await db.commit()

# ── Client Notes ───────────────────────────────────────────────────────

@router.get("/{client_id}/notes", response_model=list[ClientNoteRead], summary="List client notes")
async def list_notes(client_id: uuid.UUID, svc: ClientNoteService = Depends(get_client_note_service), _: User = Depends(get_current_user), client_svc: ClientService = Depends(get_client_service), scoped_client_id: uuid.UUID | None = Depends(get_current_client_id)):
    await client_svc.get_client(client_id, scoped_client_id=scoped_client_id)
    return [ClientNoteRead.model_validate(n) for n in await svc.list_notes(client_id)]

@router.post("/{client_id}/notes", response_model=ClientNoteRead, status_code=status.HTTP_201_CREATED, summary="Add note")
async def create_note(client_id: uuid.UUID, payload: ClientNoteCreate, db: AsyncSession = Depends(get_db),
                      client_svc: ClientService = Depends(get_client_service),
                      svc: ClientNoteService = Depends(get_client_note_service), current_user: User = Depends(get_current_user),
                      scoped_client_id: uuid.UUID | None = Depends(get_current_client_id),
                      _admin: str = Depends(require_roles("sales"))):
    await client_svc.get_client(client_id, scoped_client_id=scoped_client_id)
    n = await svc.create_note(client_id, payload.model_dump(), created_by=current_user.id); await db.commit()
    return ClientNoteRead.model_validate(n)

@router.delete("/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete note")
async def delete_note(note_id: uuid.UUID, db: AsyncSession = Depends(get_db),
                      svc: ClientNoteService = Depends(get_client_note_service), _: User = Depends(get_current_user),
                      scoped_client_id: uuid.UUID | None = Depends(get_current_client_id),
                      _admin: str = Depends(require_roles("sales"))):
    await svc.delete_note(note_id, scoped_client_id=scoped_client_id); await db.commit()

# ── Proposals ───────────────────────────────────────────────────────────

@router.get("/{client_id}/proposals", response_model=list[ProposalRead], summary="List client proposals")
async def list_client_proposals(client_id: uuid.UUID, svc: ProposalService = Depends(get_proposal_service), _: User = Depends(get_current_user), client_svc: ClientService = Depends(get_client_service), scoped_client_id: uuid.UUID | None = Depends(get_current_client_id)):
    await client_svc.get_client(client_id, scoped_client_id=scoped_client_id)
    items, _total = await svc.list_proposals(client_id=client_id, limit=200)
    return [ProposalRead.model_validate(p) for p in items]

@router.post("/{client_id}/proposals", response_model=ProposalRead, status_code=status.HTTP_201_CREATED, summary="Create proposal")
async def create_proposal(client_id: uuid.UUID, payload: ProposalCreate, db: AsyncSession = Depends(get_db),
                          client_svc: ClientService = Depends(get_client_service),
                          svc: ProposalService = Depends(get_proposal_service), current_user: User = Depends(get_current_user),
                          scoped_client_id: uuid.UUID | None = Depends(get_current_client_id),
                          _admin: str = Depends(require_roles("sales"))):
    await client_svc.get_client(client_id, scoped_client_id=scoped_client_id)
    p = await svc.create_proposal(client_id, payload.model_dump(), created_by=current_user.id); await db.commit()
    return ProposalRead.model_validate(p)

@router.get("/proposals/{proposal_id}", response_model=ProposalRead, summary="Get proposal")
async def get_proposal(proposal_id: uuid.UUID, svc: ProposalService = Depends(get_proposal_service), _: User = Depends(get_current_user),
                       scoped_client_id: uuid.UUID | None = Depends(get_current_client_id)):
    return ProposalRead.model_validate(await svc.get_proposal(proposal_id, scoped_client_id=scoped_client_id))

@router.put("/proposals/{proposal_id}", response_model=ProposalRead, summary="Update proposal")
async def update_proposal(proposal_id: uuid.UUID, payload: ProposalUpdate, db: AsyncSession = Depends(get_db),
                          svc: ProposalService = Depends(get_proposal_service), current_user: User = Depends(get_current_user),
                          scoped_client_id: uuid.UUID | None = Depends(get_current_client_id),
                          _admin: str = Depends(require_roles("sales"))):
    p = await svc.update_proposal(proposal_id, payload.model_dump(exclude_unset=True), scoped_client_id=scoped_client_id, actor_id=current_user.id)
    await db.commit()
    return ProposalRead.model_validate(p)

@router.delete("/proposals/{proposal_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete proposal")
async def delete_proposal(proposal_id: uuid.UUID, db: AsyncSession = Depends(get_db),
                          svc: ProposalService = Depends(get_proposal_service), _: User = Depends(get_current_user),
                          scoped_client_id: uuid.UUID | None = Depends(get_current_client_id),
                          _admin: str = Depends(require_roles("sales"))):
    await svc.delete_proposal(proposal_id, scoped_client_id=scoped_client_id); await db.commit()

@router.get("/proposals/{proposal_id}/pdf", summary="Download proposal as PDF")
async def get_proposal_pdf(proposal_id: uuid.UUID, svc: ProposalService = Depends(get_proposal_service), _: User = Depends(get_current_user),
                          scoped_client_id: uuid.UUID | None = Depends(get_current_client_id)):
    from app.services.pdf_service import render_proposal_pdf
    proposal = await svc.get_proposal(proposal_id, scoped_client_id=scoped_client_id)
    pdf_bytes = render_proposal_pdf(proposal)
    return Response(content=pdf_bytes, media_type="application/pdf", headers={
        "Content-Disposition": f'inline; filename="proposal-{proposal_id}.pdf"'
    })


# ────────────────────────────────────────────────────────────────────────────
# CRM Payments Dashboard
# ────────────────────────────────────────────────────────────────────────────


class CrmPaymentRow(BaseModel):
    payment_id: uuid.UUID
    invoice_id: uuid.UUID
    invoice_number: str
    invoice_type: str
    invoice_status: str
    amount: float
    payment_date: date
    payment_method: str
    reference_number: str | None
    status: str
    submitted_by_client: bool
    created_at: datetime
    client_id: uuid.UUID | None
    client_name: str | None
    lead_id: uuid.UUID | None
    lead_title: str | None


class CrmPaymentStats(BaseModel):
    total_pending: float
    total_submitted: float
    total_finance_verified: float
    total_crm_verified: float
    total_rejected: float
    total_completed: float
    grand_total: float


class CrmPaymentsDashboardResponse(BaseModel):
    payments: list[CrmPaymentRow]
    stats: CrmPaymentStats


@router.get("/payments/dashboard", response_model=CrmPaymentsDashboardResponse, summary="CRM Payments dashboard — list payments with stats")
async def crm_payments_dashboard(
    status_filter: str | None = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
    _role: str = Depends(require_roles("crm", "sales", "admin")),
):
    from app.modules.crm.models import Client
    from app.modules.finance.models import Invoice, Payment
    from app.modules.leads.models import Lead

    # Build the join query
    stmt = (
        select(
            Payment.id.label("payment_id"),
            Payment.invoice_id,
            Payment.amount,
            Payment.payment_date,
            Payment.payment_method,
            Payment.reference_number,
            Payment.status,
            Payment.submitted_by_client,
            Payment.created_at,
            Invoice.id.label("invoice_id_"),
            Invoice.invoice_number,
            Invoice.invoice_type,
            Invoice.status.label("invoice_status"),
            Invoice.client_id,
            Invoice.lead_id,
            Client.company_name,
            Lead.title.label("lead_title"),
        )
        .join(Invoice, Payment.invoice_id == Invoice.id)
        .outerjoin(Client, Invoice.client_id == Client.id)
        .outerjoin(Lead, Invoice.lead_id == Lead.id)
    )
    if status_filter:
        stmt = stmt.where(Payment.status == status_filter)
    stmt = stmt.order_by(Payment.created_at.desc())

    rows = (await db.execute(stmt)).all()
    payments = [
        CrmPaymentRow(
            payment_id=r.payment_id,
            invoice_id=r.invoice_id,
            invoice_number=r.invoice_number,
            invoice_type=r.invoice_type,
            invoice_status=r.invoice_status,
            amount=float(r.amount),
            payment_date=r.payment_date,
            payment_method=r.payment_method,
            reference_number=r.reference_number,
            status=r.status,
            submitted_by_client=r.submitted_by_client,
            created_at=r.created_at,
            client_id=r.client_id,
            client_name=r.company_name,
            lead_id=r.lead_id,
            lead_title=r.lead_title,
        )
        for r in rows
    ]

    # Compute stats
    stats_stmt = select(
        Payment.status,
        sa_func.coalesce(sa_func.sum(Payment.amount), 0).label("total"),
    ).group_by(Payment.status)
    stats_rows = (await db.execute(stats_stmt)).all()
    stats_map: dict[str, float] = {r.status: float(r.total) for r in stats_rows}

    stats = CrmPaymentStats(
        total_pending=stats_map.get("pending", 0.0),
        total_submitted=stats_map.get("submitted", 0.0),
        total_finance_verified=stats_map.get("finance_verified", 0.0),
        total_crm_verified=stats_map.get("crm_verified", 0.0),
        total_rejected=stats_map.get("rejected", 0.0),
        total_completed=stats_map.get("completed", 0.0),
        grand_total=sum(stats_map.values()),
    )

    return CrmPaymentsDashboardResponse(payments=payments, stats=stats)
