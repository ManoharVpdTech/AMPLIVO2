"""Service layer for Finance."""
from __future__ import annotations
import uuid
from datetime import timedelta
from typing import Sequence
from sqlalchemy.ext.asyncio import AsyncSession
from app.core import lead_pipeline
from app.core.config import settings
from app.core.exceptions import BadRequestException, NotFoundException
from app.core.tenant_scope import enforce_client_scope
from app.modules.finance import constants as finance_constants
from app.modules.finance.models import Expense, Invoice, InvoiceItem, Payment
from app.modules.finance.repository import ExpenseRepository, InvoiceItemRepository, InvoiceRepository, PaymentRepository
from app.utils.sales_events import log_activity, notify_role, notify_users
from app.utils.time import utc_now

# Statuses worth notifying the client's account owner about (maps onto the
# Sales module's "quotation sent / approved / rejected" lifecycle, reusing
# the existing Invoice status field rather than a separate Quotation model).
_NOTIFIABLE_STATUSES = {
    "sent": "Quote/invoice sent",
    "paid": "Invoice paid",
    "cancelled": "Invoice cancelled",
    "overdue": "Invoice overdue",
}

class InvoiceService:
    def __init__(self, db: AsyncSession, repo: InvoiceRepository) -> None:
        self._db = db
        self._repo = repo
    async def list_invoices(self, *, search=None, client_id=None, status=None, sort_by=None, sort_order="desc", offset=0, limit=20):
        items = await self._repo.get_all_filtered(search=search, client_id=client_id, status=status, sort_by=sort_by, sort_order=sort_order, offset=offset, limit=limit)
        total = await self._repo.count_filtered(search=search, client_id=client_id, status=status)
        return items, total
    async def get_invoice(self, invoice_id: uuid.UUID, *, scoped_client_id: uuid.UUID | None = None) -> Invoice:
        i = await self._repo.get_detail(invoice_id)
        if i is None: raise NotFoundException("Invoice")
        enforce_client_scope(i.client_id, scoped_client_id)
        return i
    async def get_advance_for_lead(self, lead_id: uuid.UUID) -> Invoice | None:
        """CRM's onboarding-workflow view needs the deal invoice for a given
        lead (budget/tax/status/PDF) without knowing the invoice id."""
        return await self._repo.get_advance_for_lead(lead_id)
    async def create_invoice(self, data: dict, *, actor_id: uuid.UUID | None = None) -> Invoice:
        invoice = await self._repo.create_from_dict(data)
        if invoice.status and invoice.status.lower() in _NOTIFIABLE_STATUSES:
            await self._notify_status(invoice, invoice.status)
        # The core Sales -> CRM handoff: an advance invoice tied to a lead
        # must automatically surface to CRM. Previously nothing connected
        # invoice creation, lead status, and a CRM notification at all.
        if invoice.invoice_type == finance_constants.INVOICE_TYPE_ADVANCE and invoice.lead_id:
            await self._advance_invoice_to_crm_pending(invoice, actor_id=actor_id)
        return invoice

    async def _advance_invoice_to_crm_pending(self, invoice: Invoice, *, actor_id: uuid.UUID | None) -> None:
        from app.modules.leads.repository import LeadRepository

        lead = await LeadRepository(self._db).get_by_id(invoice.lead_id)
        if lead is None:
            return
        lead.status = lead_pipeline.ADVANCE_INVOICE_CREATED
        await self._db.flush()
        lead.status = lead_pipeline.CRM_PENDING
        invoice.status = finance_constants.INVOICE_STATUS_CRM_PENDING
        await self._db.flush()
        await self._db.refresh(lead)
        await self._db.refresh(invoice)

        await log_activity(
            self._db, user_id=actor_id, entity_type="invoice", entity_id=invoice.id,
            action="advance_invoice_created",
            description=f"Advance invoice {invoice.invoice_number} created for lead '{lead.title}'.",
        )
        await notify_role(
            self._db, "crm",
            title="New advance invoice pending review",
            message=f"Advance invoice {invoice.invoice_number} for '{lead.title}' is ready for CRM review.",
        )

    async def create_advance_invoice_for_lead(
        self, *, lead_id: uuid.UUID, proposal_id: uuid.UUID | None, total_deal_amount: float,
        tax_rate: float, due_date, currency: str, notes: str | None, actor_id: uuid.UUID | None,
    ) -> Invoice:
        """Computes the 25% advance split and invoice number server-side -
        the frontend previously did this math client-side with an
        in-memory counter that reset on page reload (salesStore.ts)."""
        from app.core.exceptions import DuplicateException
        existing = await self.get_advance_for_lead(lead_id)
        if existing is not None:
            raise DuplicateException("Advance invoice", "lead_id")

        return await self._create_deal_invoice(
            invoice_type=finance_constants.INVOICE_TYPE_ADVANCE, percentage=0.25, number_prefix="ADV",
            lead_id=lead_id, proposal_id=proposal_id, project_id=None, task_submission_id=None,
            total_deal_amount=total_deal_amount, tax_rate=tax_rate, due_date=due_date,
            currency=currency, notes=notes, actor_id=actor_id,
        )

    async def create_final_invoice_for_project(
        self, *, project_id: uuid.UUID, task_submission_id: uuid.UUID | None, total_deal_amount: float,
        tax_rate: float, due_date, currency: str, notes: str | None, actor_id: uuid.UUID | None,
    ) -> Invoice:
        """The remaining 75%, generated once CRM approves the final task
        submission (see tasks/service.py TaskSubmissionService.review)."""
        from app.modules.tasks.repository import ProjectRepository

        project = await ProjectRepository(self._db).get_by_id(project_id)
        lead_id = None
        if project is not None:
            from app.modules.leads.repository import LeadRepository
            lead = await LeadRepository(self._db).find_by_converted_project(project_id)
            lead_id = lead.id if lead else None

        invoice = await self._create_deal_invoice(
            invoice_type=finance_constants.INVOICE_TYPE_FINAL, percentage=0.75, number_prefix="FIN",
            lead_id=lead_id, proposal_id=None, project_id=project_id, task_submission_id=task_submission_id,
            total_deal_amount=total_deal_amount, tax_rate=tax_rate, due_date=due_date,
            currency=currency, notes=notes, actor_id=actor_id, client_id=project.client_id if project else None,
        )
        await notify_role(self._db, "finance", title="Final invoice ready to send", message=f"Final invoice {invoice.invoice_number} generated - review and send to the client.")
        return invoice

    async def _create_deal_invoice(
        self, *, invoice_type: str, percentage: float, number_prefix: str,
        lead_id: uuid.UUID | None, proposal_id: uuid.UUID | None, project_id: uuid.UUID | None,
        task_submission_id: uuid.UUID | None, total_deal_amount: float, tax_rate: float, due_date,
        currency: str, notes: str | None, actor_id: uuid.UUID | None, client_id: uuid.UUID | None = None,
    ) -> Invoice:
        subtotal = round(total_deal_amount * percentage, 2)
        tax_total = round(subtotal * (tax_rate / 100), 2)
        total_amount = round(subtotal + tax_total, 2)
        invoice_number = f"{number_prefix}-{utc_now():%Y%m%d}-{uuid.uuid4().hex[:6].upper()}"

        data = {
            "client_id": client_id,
            "lead_id": lead_id,
            "proposal_id": proposal_id,
            "project_id": project_id,
            "task_submission_id": task_submission_id,
            "invoice_number": invoice_number,
            "invoice_type": invoice_type,
            "status": "draft",
            "issue_date": utc_now().date(),
            "due_date": due_date,
            "subtotal": subtotal,
            "tax_total": tax_total,
            "total_amount": total_amount,
            "currency": currency,
            "notes": notes,
        }
        invoice = await self.create_invoice(data, actor_id=actor_id)

        from app.modules.finance.repository import InvoiceItemRepository
        label = "Advance payment (25%)" if invoice_type == finance_constants.INVOICE_TYPE_ADVANCE else "Final payment (75%)"
        await InvoiceItemRepository(self._db).create_from_dict({
            "invoice_id": invoice.id,
            "description": f"{label} for engagement (of {currency} {total_deal_amount:,.2f} total)",
            "quantity": 1,
            "unit_price": subtotal,
            "tax_rate": tax_rate,
            "total": total_amount,
        })

        # A placeholder Payment row so the Payments Dashboard shows the
        # expected amount immediately, before the client has submitted any
        # proof of payment - it stays 'pending' (uncounted by crm_verify's
        # verified-total check) until the real submit_client_payment flow
        # creates the actual payment row that goes through verification.
        await PaymentRepository(self._db).create_from_dict({
            "invoice_id": invoice.id,
            "amount": total_amount,
            "payment_date": utc_now().date(),
            "payment_method": "unpaid",
            "status": "pending",
        })
        return invoice

    async def crm_approve_advance(self, invoice_id: uuid.UUID, *, actor_id: uuid.UUID | None) -> Invoice:
        """CRM reviews the lead/meeting/proposal/invoice, approves, and the
        proposal+invoice+payment-link email goes out to the client.

        If email delivery fails the invoice stays CRM_APPROVED (not
        EMAIL_SENT) so the caller can inspect and retry. The activity log
        records the outcome.
        """
        from app.modules.leads.repository import LeadRepository
        from app.modules.portal_access.repository import PortalAccessTokenRepository
        from app.modules.portal_access.service import PortalAccessTokenService
        from app.services.email_service import EmailDeliveryError, EmailService

        invoice = await self.get_invoice(invoice_id)
        if invoice.invoice_type not in (finance_constants.INVOICE_TYPE_ADVANCE, finance_constants.INVOICE_TYPE_FINAL):
            raise BadRequestException("Only advance/final invoices go through CRM approval.")

        invoice.status = finance_constants.INVOICE_STATUS_CRM_APPROVED
        await self._db.flush()
        await self._db.refresh(invoice)

        lead = await LeadRepository(self._db).get_by_id(invoice.lead_id) if invoice.lead_id else None
        if lead is not None:
            lead.status = lead_pipeline.CRM_APPROVED
            await self._db.flush()

        await log_activity(
            self._db, user_id=actor_id, entity_type="invoice", entity_id=invoice.id,
            action="crm_approved", description=f"Invoice {invoice.invoice_number} approved by CRM.",
        )

        contact_email = lead.email if lead else None
        contact_name = (lead.contact_name or lead.title) if lead else "there"
        if contact_email:
            token_service = PortalAccessTokenService(PortalAccessTokenRepository(self._db))
            email_service = EmailService()

            # Proposal decision link (accept/reject/revise) — magic link.
            if invoice.proposal_id:
                from app.modules.crm.repository import ProposalRepository
                proposal = await ProposalRepository(self._db).get_by_id(invoice.proposal_id)
                if proposal is not None:
                    proposal_token = await token_service.issue(
                        resource_type="proposal", resource_id=proposal.id, lead_id=invoice.lead_id,
                        expires_in=timedelta(hours=settings.PROPOSAL_TOKEN_EXPIRE_HOURS),
                        is_single_use=True, created_by=actor_id,
                    )
                    proposal_url = f"{settings.FRONTEND_URL}/portal-public/proposal/{proposal_token}"
                    try:
                        await email_service.send_proposal_link_email(
                            to_email=contact_email, contact_name=contact_name,
                            proposal_title=proposal.title, portal_url=proposal_url,
                        )
                    except EmailDeliveryError:
                        await log_activity(
                            self._db, user_id=actor_id, entity_type="invoice", entity_id=invoice.id,
                            action="email_failed", description=f"Proposal email for invoice {invoice.invoice_number} failed to send to {contact_email}.",
                        )

            # Invoice payment link — the critical email.
            payment_token = await token_service.issue(
                resource_type="invoice_payment", resource_id=invoice.id, lead_id=invoice.lead_id,
                expires_in=timedelta(hours=settings.PAYMENT_LINK_TOKEN_EXPIRE_HOURS),
                is_single_use=False, created_by=actor_id,
            )
            portal_url = f"{settings.FRONTEND_URL}/portal-public/pay/{payment_token}"
            try:
                await email_service.send_invoice_payment_link_email(
                    to_email=contact_email, contact_name=contact_name, invoice_number=invoice.invoice_number,
                    amount=invoice.total_amount, currency=invoice.currency, portal_url=portal_url,
                )
                invoice.status = finance_constants.INVOICE_STATUS_EMAIL_SENT
                if lead is not None:
                    lead.status = lead_pipeline.EMAIL_SENT
                delivery_note = (
                    "" if email_service.is_live else
                    " SIMULATED ONLY - BREVO_API_KEY is not configured, so the client did not actually receive this email."
                )
                await log_activity(
                    self._db, user_id=actor_id, entity_type="invoice", entity_id=invoice.id,
                    action="email_sent", description=f"Payment-link email for invoice {invoice.invoice_number} sent to {contact_email}.{delivery_note}",
                )
            except EmailDeliveryError:
                await log_activity(
                    self._db, user_id=actor_id, entity_type="invoice", entity_id=invoice.id,
                    action="email_failed", description=f"Payment-link email for invoice {invoice.invoice_number} failed to send to {contact_email}. Invoice stays CRM_APPROVED.",
                )
            await self._db.flush()
            await self._db.refresh(invoice)

        return invoice

    async def update_invoice(self, invoice_id: uuid.UUID, data: dict, *, scoped_client_id: uuid.UUID | None = None) -> Invoice:
        existing = await self.get_invoice(invoice_id, scoped_client_id=scoped_client_id)
        old_status = existing.status
        updated = await self._repo.update(invoice_id, data)
        if updated is None: raise NotFoundException("Invoice")
        new_status = data.get("status")
        if new_status and new_status != old_status and new_status.lower() in _NOTIFIABLE_STATUSES:
            await self._notify_status(updated, new_status)
        return updated
    async def delete_invoice(self, invoice_id: uuid.UUID, *, scoped_client_id: uuid.UUID | None = None) -> None:
        await self.get_invoice(invoice_id, scoped_client_id=scoped_client_id)
        if not await self._repo.delete(invoice_id): raise NotFoundException("Invoice")
    async def _notify_status(self, invoice: Invoice, new_status: str) -> None:
        from app.modules.crm.models import Client
        client = await self._db.get(Client, invoice.client_id)
        if client is None or client.assigned_to is None:
            return
        title = _NOTIFIABLE_STATUSES.get(new_status.lower(), "Invoice updated")
        await notify_users(
            self._db, [client.assigned_to],
            title=title,
            message=f"Invoice {invoice.invoice_number} for {client.company_name} is now '{new_status}'.",
        )

class InvoiceItemService:
    def __init__(self, repo: InvoiceItemRepository) -> None:
        self._repo = repo
    async def list_items(self, invoice_id: uuid.UUID) -> Sequence[InvoiceItem]:
        return await self._repo.list_by_invoice(invoice_id)
    async def create_item(self, invoice_id: uuid.UUID, data: dict) -> InvoiceItem:
        data["invoice_id"] = invoice_id
        return await self._repo.create_from_dict(data)
    async def update_item(self, item_id: uuid.UUID, data: dict) -> InvoiceItem:
        updated = await self._repo.update(item_id, data)
        if updated is None: raise NotFoundException("InvoiceItem")
        return updated
    async def delete_item(self, item_id: uuid.UUID) -> None:
        if not await self._repo.delete(item_id): raise NotFoundException("InvoiceItem")

class PaymentService:
    def __init__(self, db: AsyncSession, repo: PaymentRepository) -> None:
        self._db = db
        self._repo = repo
    async def list_payments(self, invoice_id: uuid.UUID) -> Sequence[Payment]:
        return await self._repo.list_by_invoice(invoice_id)
    async def list_all_payments(self, *, status=None, sort_by=None, sort_order="desc", offset=0, limit=20):
        items = await self._repo.get_all_filtered(status=status, sort_by=sort_by, sort_order=sort_order, offset=offset, limit=limit)
        total = await self._repo.count_filtered(status=status)
        return items, total
    async def get_payment(self, payment_id: uuid.UUID) -> Payment:
        payment = await self._repo.get_by_id(payment_id)
        if payment is None: raise NotFoundException("Payment")
        return payment
    async def create_payment(self, invoice_id: uuid.UUID, data: dict) -> Payment:
        """Legacy staff-entered path (finance directly logging an
        already-confirmed payment) - unchanged, still defaults to
        status='completed'. Client-submitted proof goes through
        submit_client_payment + the two-step verify methods below instead."""
        data["invoice_id"] = invoice_id
        return await self._repo.create_from_dict(data)
    async def update_payment(self, payment_id: uuid.UUID, data: dict) -> Payment:
        updated = await self._repo.update(payment_id, data)
        if updated is None: raise NotFoundException("Payment")
        return updated
    async def delete_payment(self, payment_id: uuid.UUID) -> None:
        if not await self._repo.delete(payment_id): raise NotFoundException("Payment")

    async def submit_client_payment(self, invoice_id: uuid.UUID, data: dict, *, token_id: uuid.UUID | None) -> Payment:
        """A client submits proof of payment via the magic-link (no login) -
        see app/modules/public_client_actions. Starts the two-step
        Finance-then-CRM manual verification, never auto-confirmed."""
        data["invoice_id"] = invoice_id
        data["status"] = finance_constants.PAYMENT_STATUS_SUBMITTED
        data["submitted_by_client"] = True
        data["submitted_via_token_id"] = token_id
        payment = await self._repo.create_from_dict(data)
        await notify_role(
            self._db, "finance",
            title="Payment proof submitted", message=f"A client submitted payment proof ({payment.payment_method}, ref {payment.reference_number or 'n/a'}) - please verify.",
        )
        return payment

    async def finance_verify(self, payment_id: uuid.UUID, *, actor_id: uuid.UUID | None) -> Payment:
        payment = await self.get_payment(payment_id)
        if payment.status != finance_constants.PAYMENT_STATUS_SUBMITTED:
            from app.core.exceptions import BadRequestException
            raise BadRequestException("Payment is not in a submitted state and cannot be verified.")
        payment.status = finance_constants.PAYMENT_STATUS_FINANCE_VERIFIED
        payment.finance_verified_by = actor_id
        payment.finance_verified_at = utc_now()
        await self._db.flush()
        await self._db.refresh(payment)
        await notify_role(self._db, "crm", title="Payment finance-verified", message="A payment has been finance-verified and needs CRM sign-off.")
        return payment

    async def reject_payment(self, payment_id: uuid.UUID, *, reason: str | None, actor_id: uuid.UUID | None) -> Payment:
        payment = await self.get_payment(payment_id)
        payment.status = finance_constants.PAYMENT_STATUS_REJECTED
        await self._db.flush()
        await self._db.refresh(payment)
        await log_activity(
            self._db, user_id=actor_id, entity_type="payment", entity_id=payment.id,
            action="payment_rejected", description="Payment proof rejected." + (f" Reason: {reason}" if reason else ""),
        )
        return payment

    async def crm_verify(self, payment_id: uuid.UUID, *, actor_id: uuid.UUID | None) -> Payment:
        """Second (final) step of the manual two-step verification. Once the
        verified total covers the invoice, flips the invoice to
        ADVANCE_PAID/FINAL_PAID and - for an advance invoice - triggers
        client-account creation (the ONLY place that happens)."""
        payment = await self.get_payment(payment_id)
        if payment.finance_verified_at is None:
            raise BadRequestException("Payment must be finance-verified before CRM verification.")
        payment.status = finance_constants.PAYMENT_STATUS_CRM_VERIFIED
        payment.crm_verified_by = actor_id
        payment.crm_verified_at = utc_now()
        await self._db.flush()
        await self._db.refresh(payment)

        invoice = await InvoiceRepository(self._db).get_detail(payment.invoice_id)
        if invoice is not None:
            confirmed_statuses = {finance_constants.PAYMENT_STATUS_CRM_VERIFIED, "completed"}
            verified_total = sum(p.amount for p in invoice.payments if p.status in confirmed_statuses)
            if verified_total >= invoice.total_amount:
                if invoice.invoice_type == finance_constants.INVOICE_TYPE_ADVANCE:
                    invoice.status = finance_constants.INVOICE_STATUS_ADVANCE_PAID
                    await self._db.flush()
                    await self._db.refresh(invoice)
                    if invoice.lead_id:
                        from app.services.client_account_service import ClientAccountService
                        await ClientAccountService(self._db).create_portal_account_for_client(invoice.lead_id, actor_id=actor_id)
                elif invoice.invoice_type == finance_constants.INVOICE_TYPE_FINAL:
                    invoice.status = finance_constants.INVOICE_STATUS_FINAL_PAID
                    await self._db.flush()
                    await notify_role(self._db, "admin", title="Final payment received", message=f"Final invoice {invoice.invoice_number} is fully paid.")
        return payment

class ExpenseService:
    def __init__(self, repo: ExpenseRepository) -> None:
        self._repo = repo
    async def list_expenses(self, *, search=None, category=None, sort_by=None, sort_order="desc", offset=0, limit=20):
        items = await self._repo.get_all_filtered(search=search, category=category, sort_by=sort_by, sort_order=sort_order, offset=offset, limit=limit)
        total = await self._repo.count_filtered(search=search, category=category)
        return items, total
    async def get_expense(self, expense_id: uuid.UUID) -> Expense:
        e = await self._repo.get_by_id(expense_id)
        if e is None: raise NotFoundException("Expense")
        return e
    async def create_expense(self, data: dict, logged_by: uuid.UUID | None = None) -> Expense:
        data["logged_by"] = logged_by
        return await self._repo.create_from_dict(data)
    async def update_expense(self, expense_id: uuid.UUID, data: dict) -> Expense:
        updated = await self._repo.update(expense_id, data)
        if updated is None: raise NotFoundException("Expense")
        return updated
    async def delete_expense(self, expense_id: uuid.UUID) -> None:
        if not await self._repo.delete(expense_id): raise NotFoundException("Expense")
