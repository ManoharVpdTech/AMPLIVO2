"""Service layer for Lead Management."""
from __future__ import annotations
import uuid
from typing import Any, Sequence
from sqlalchemy.ext.asyncio import AsyncSession
from app.core import lead_pipeline
from app.core.exceptions import BadRequestException, DuplicateException, NotFoundException
from app.core.tenant_scope import enforce_client_scope
from app.modules.leads.models import Lead, LeadActivity, LeadFollowup, LeadSource, SalesPipeline
from app.modules.leads.repository import (
    LeadActivityRepository, LeadFollowupRepository, LeadRepository,
    LeadSourceRepository, SalesPipelineRepository,
)
from app.utils.sales_events import log_activity, notify_role, notify_users
from app.utils.time import utc_now


class LeadSourceService:
    def __init__(self, repo: LeadSourceRepository) -> None:
        self._repo = repo
    async def list_sources(self, *, search=None, sort_by=None, sort_order="desc", offset=0, limit=20):
        items = await self._repo.get_all(search=search, sort_by=sort_by, sort_order=sort_order, offset=offset, limit=limit)
        total = await self._repo.count(search=search)
        return items, total
    async def get_source(self, source_id: uuid.UUID) -> LeadSource:
        s = await self._repo.get_by_id(source_id)
        if s is None: raise NotFoundException("LeadSource")
        return s
    async def create_source(self, data: dict) -> LeadSource:
        if await self._repo.get_by_slug(data["slug"]): raise DuplicateException("LeadSource", "slug")
        return await self._repo.create_from_dict(data)
    async def update_source(self, source_id: uuid.UUID, data: dict) -> LeadSource:
        updated = await self._repo.update(source_id, data)
        if updated is None: raise NotFoundException("LeadSource")
        return updated
    async def delete_source(self, source_id: uuid.UUID) -> None:
        if not await self._repo.delete(source_id): raise NotFoundException("LeadSource")


class LeadService:
    def __init__(self, db: AsyncSession, repo: LeadRepository, activity_repo: LeadActivityRepository) -> None:
        self._db = db; self._repo = repo; self._activity_repo = activity_repo
    async def list_leads(self, *, search=None, status=None, priority=None, source_id=None,
                         assigned_to=None, client_id=None, sort_by=None, sort_order="desc", offset=0, limit=20):
        items = await self._repo.get_all_filtered(
            search=search, status=status, priority=priority, source_id=source_id,
            assigned_to=assigned_to, client_id=client_id, sort_by=sort_by, sort_order=sort_order, offset=offset, limit=limit,
        )
        total = await self._repo.count_filtered(
            search=search, status=status, priority=priority, source_id=source_id,
            assigned_to=assigned_to, client_id=client_id,
        )
        return items, total
    async def get_lead(self, lead_id: uuid.UUID, *, scoped_client_id: uuid.UUID | None = None) -> Lead:
        lead = await self._repo.get_by_id(lead_id)
        if lead is None: raise NotFoundException("Lead")
        enforce_client_scope(lead.client_id, scoped_client_id)
        return lead
    async def _validate_fk_references(self, data: dict) -> None:
        from app.models.user import User
        from app.modules.leads.models import LeadSource, SalesPipeline
        from app.modules.crm.models import Client

        if "client_id" in data and data["client_id"] is not None:
            client = await self._db.get(Client, data["client_id"])
            if not client:
                raise NotFoundException("Client")
        if "pipeline_stage_id" in data and data["pipeline_stage_id"] is not None:
            stage = await self._db.get(SalesPipeline, data["pipeline_stage_id"])
            if not stage:
                raise NotFoundException("SalesPipeline")
        if "assigned_to" in data and data["assigned_to"] is not None:
            user = await self._db.get(User, data["assigned_to"])
            if not user or user.is_deleted:
                raise NotFoundException("User")
        if "source_id" in data and data["source_id"] is not None:
            source = await self._db.get(LeadSource, data["source_id"])
            if not source:
                raise NotFoundException("LeadSource")

    async def create_lead(self, data: dict, created_by: uuid.UUID | None = None) -> Lead:
        await self._validate_fk_references(data)
        data["created_by"] = created_by
        lead = await self._repo.create_from_dict(data)
        if lead.assigned_to:
            await notify_users(
                self._db, [lead.assigned_to],
                title="New lead assigned to you",
                message=f"'{lead.title}'" + (f" ({lead.company_name})" if lead.company_name else "") + " has been assigned to you.",
            )
        await log_activity(
            self._db, user_id=created_by, entity_type="lead", entity_id=lead.id,
            action="lead_created", description=f"Lead '{lead.title}' created.",
        )
        return lead
    async def update_lead(self, lead_id: uuid.UUID, data: dict, *, scoped_client_id: uuid.UUID | None = None, actor_id: uuid.UUID | None = None) -> Lead:
        existing = await self.get_lead(lead_id, scoped_client_id=scoped_client_id)
        await self._validate_fk_references(data)
        old_status = existing.status
        old_assigned_to = existing.assigned_to
        updated = await self._repo.update(lead_id, data)
        if updated is None: raise NotFoundException("Lead")

        new_assigned_to = data.get("assigned_to")
        if new_assigned_to and new_assigned_to != old_assigned_to:
            await notify_users(
                self._db, [new_assigned_to],
                title="Lead assigned to you",
                message=f"'{updated.title}' has been assigned to you.",
            )
            await log_activity(
                self._db, user_id=actor_id, entity_type="lead", entity_id=lead_id,
                action="lead_assigned", description=f"Lead '{updated.title}' reassigned.",
            )

        new_status = data.get("status")
        if new_status and new_status != old_status:
            await notify_users(
                self._db, [updated.assigned_to],
                title="Lead status updated",
                message=f"'{updated.title}' status changed to {new_status}.",
            )
            await log_activity(
                self._db, user_id=actor_id, entity_type="lead", entity_id=lead_id,
                action="status_changed", description=f"Status changed from '{old_status}' to '{new_status}'.",
            )
        return updated
    async def delete_lead(self, lead_id: uuid.UUID, *, scoped_client_id: uuid.UUID | None = None) -> None:
        await self.get_lead(lead_id, scoped_client_id=scoped_client_id)
        from app.modules.crm.models import Proposal
        from sqlalchemy import delete
        await self._db.execute(delete(Proposal).where(Proposal.lead_id == lead_id))
        if not await self._repo.delete(lead_id): raise NotFoundException("Lead")

    async def set_status(self, lead_id: uuid.UUID, status: str, *, actor_id: uuid.UUID | None = None) -> Lead:
        """Advance a lead's pipeline status (app/core/lead_pipeline.py values).
        Shared by every cross-module caller (meetings/finance/tasks) instead of
        each one poking Lead.status directly, so the notification+audit-log
        side effect is never forgotten."""
        lead = await self.get_lead(lead_id)
        old_status = lead.status
        if old_status == status:
            return lead
        lead.status = status
        await self._db.flush()
        await self._db.refresh(lead)
        await log_activity(
            self._db, user_id=actor_id, entity_type="lead", entity_id=lead_id,
            action="status_changed", description=f"Status changed from '{old_status}' to '{status}'.",
        )
        return lead

    async def mark_lost(self, lead_id: uuid.UUID, *, reason: str | None, terminal_status: str = lead_pipeline.LOST, actor_id: uuid.UUID | None = None) -> Lead:
        """Terminal path: a rejected meeting/proposal ends the deal here - no
        Client, no Project, no User account is ever created for this lead."""
        if terminal_status not in (lead_pipeline.LOST, lead_pipeline.REJECTED):
            raise BadRequestException("terminal_status must be LOST or REJECTED.")
        lead = await self.get_lead(lead_id)
        lead.status = terminal_status
        if reason:
            lead.notes = f"{lead.notes}\n\n[{terminal_status}] {reason}" if lead.notes else f"[{terminal_status}] {reason}"
        await self._db.flush()
        await self._db.refresh(lead)
        await log_activity(
            self._db, user_id=actor_id, entity_type="lead", entity_id=lead_id,
            action="lead_lost", description=f"Lead '{lead.title}' marked {terminal_status}" + (f": {reason}" if reason else "."),
        )
        if lead.assigned_to:
            await notify_users(
                self._db, [lead.assigned_to],
                title="Lead closed",
                message=f"'{lead.title}' was marked {terminal_status.lower()}.",
            )
        return lead

    async def ensure_client_for_lead(self, lead: Lead, actor_id: uuid.UUID | None) -> uuid.UUID:
        """Return lead.converted_client_id, creating the Client company row
        first if this lead hasn't been converted yet. Shared by the manual
        /leads/{id}/convert path and the automatic payment-triggered path
        (ClientAccountService) so both create a Client the exact same way."""
        from app.modules.crm.repository import ClientContactRepository, ClientRepository

        if lead.converted_client_id is not None:
            return lead.converted_client_id

        client = await ClientRepository(self._db).create_from_dict({
            "company_name": lead.company_name or lead.title,
            "email": lead.email,
            "phone": lead.phone,
            "assigned_to": lead.assigned_to,
            "onboarding_date": utc_now(),
            "created_by": actor_id,
        })

        # The lead's contact person (name/email/phone) was captured at
        # intake but previously never carried over - the Client record only
        # has a company-level email/phone, so the CRM client page had no
        # named point-of-contact to display for any real (non-mock) client.
        if lead.contact_name:
            await ClientContactRepository(self._db).create_from_dict({
                "client_id": client.id,
                "name": lead.contact_name,
                "email": lead.email,
                "phone": lead.phone,
                "is_primary": True,
            })

        lead.converted_client_id = client.id
        lead.converted_at = utc_now()
        await self._db.flush()
        await self._db.refresh(lead)
        return client.id

    async def create_onboarding_project(self, lead: Lead, client_id: uuid.UUID):
        """Create (or return the existing) onboarding Project for a lead's
        client. Shared the same way as `ensure_client_for_lead`."""
        from app.modules.tasks.repository import ProjectRepository

        if lead.converted_project_id is not None:
            existing = await ProjectRepository(self._db).get_by_id(lead.converted_project_id)
            if existing is not None:
                return existing

        project = await ProjectRepository(self._db).create_from_dict({
            "name": f"{lead.company_name or lead.title} - Onboarding",
            "client_id": client_id,
            "status": "active",
            "manager_id": lead.assigned_to,
        })
        lead.converted_project_id = project.id
        await self._db.flush()
        await self._db.refresh(lead)
        return project

    async def convert_lead(self, lead_id: uuid.UUID, client_id: uuid.UUID | None, actor_id: uuid.UUID | None = None) -> Lead:
        """Manual/admin override: Sales can still convert a lead to a client +
        onboarding project directly, without going through the advance-payment
        pipeline. Kept as-is for that purpose; now shares its two building
        blocks with the automatic path instead of duplicating them."""
        lead = await self.get_lead(lead_id)
        if lead.status == "converted": raise BadRequestException("Lead is already converted.")

        if client_id is not None:
            from app.modules.crm.models import Client
            client = await self._db.get(Client, client_id)
            if not client:
                raise NotFoundException("Client")
            lead.converted_client_id = client_id
            await self._db.flush()
            await self._db.refresh(lead)
        else:
            client_id = await self.ensure_client_for_lead(lead, actor_id)

        lead.status = "converted"
        await self._db.flush()
        await self._db.refresh(lead)

        project = await self.create_onboarding_project(lead, client_id)

        await log_activity(
            self._db, user_id=actor_id, entity_type="lead", entity_id=lead_id,
            action="lead_converted",
            description=f"Lead '{lead.title}' converted to client; project '{project.name}' created.",
        )
        await notify_role(
            self._db, "admin",
            title="Lead converted - handoff ready",
            message=f"'{lead.title}' was converted by Sales. Project '{project.name}' created and awaiting handoff.",
        )
        if lead.assigned_to:
            await notify_users(
                self._db, [lead.assigned_to],
                title="Lead converted",
                message=f"'{lead.title}' was successfully converted to a client.",
            )
        return lead


class LeadActivityService:
    def __init__(self, db: AsyncSession, repo: LeadActivityRepository) -> None:
        self._db = db; self._repo = repo
    async def list_activities(self, lead_id: uuid.UUID) -> Sequence[LeadActivity]:
        return await self._repo.list_by_lead(lead_id)
    async def create_activity(self, lead_id: uuid.UUID, data: dict, performed_by: uuid.UUID | None = None) -> LeadActivity:
        lead = await self._db.get(Lead, lead_id)
        if not lead:
            raise NotFoundException("Lead")
        if performed_by:
            from app.models.user import User
            user = await self._db.get(User, performed_by)
            if not user or user.is_deleted:
                raise NotFoundException("User")
        data["lead_id"] = lead_id; data["performed_by"] = performed_by
        return await self._repo.create_from_dict(data)


class LeadFollowupService:
    def __init__(self, db: AsyncSession, repo: LeadFollowupRepository) -> None:
        self._db = db; self._repo = repo
    async def list_followups(self, lead_id: uuid.UUID) -> Sequence[LeadFollowup]:
        return await self._repo.list_by_lead(lead_id)
    async def create_followup(self, lead_id: uuid.UUID, data: dict) -> LeadFollowup:
        lead = await self._db.get(Lead, lead_id)
        if not lead:
            raise NotFoundException("Lead")
        if "assigned_to" in data and data["assigned_to"] is not None:
            from app.models.user import User
            user = await self._db.get(User, data["assigned_to"])
            if not user or user.is_deleted:
                raise NotFoundException("User")
        data["lead_id"] = lead_id
        return await self._repo.create_from_dict(data)
    async def update_followup(self, followup_id: uuid.UUID, data: dict) -> LeadFollowup:
        if "assigned_to" in data and data["assigned_to"] is not None:
            from app.models.user import User
            user = await self._db.get(User, data["assigned_to"])
            if not user or user.is_deleted:
                raise NotFoundException("User")
        updated = await self._repo.update(followup_id, data)
        if updated is None: raise NotFoundException("LeadFollowup")
        return updated
    async def delete_followup(self, followup_id: uuid.UUID) -> None:
        if not await self._repo.delete(followup_id): raise NotFoundException("LeadFollowup")


class SalesPipelineService:
    def __init__(self, repo: SalesPipelineRepository) -> None:
        self._repo = repo
    async def list_stages(self, *, search=None, sort_by=None, sort_order="asc", offset=0, limit=50):
        items = await self._repo.get_all(search=search, sort_by=sort_by or "order", sort_order=sort_order, offset=offset, limit=limit)
        total = await self._repo.count(search=search)
        return items, total
    async def create_stage(self, data: dict) -> SalesPipeline:
        return await self._repo.create_from_dict(data)
    async def update_stage(self, stage_id: uuid.UUID, data: dict) -> SalesPipeline:
        updated = await self._repo.update(stage_id, data)
        if updated is None: raise NotFoundException("SalesPipeline")
        return updated
    async def delete_stage(self, stage_id: uuid.UUID) -> None:
        if not await self._repo.delete(stage_id): raise NotFoundException("SalesPipeline")
