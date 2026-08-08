"""Repository layer for Lead Management."""
from __future__ import annotations
import uuid
from typing import Sequence
# pyrefly: ignore [missing-import]
from sqlalchemy import func, select
# pyrefly: ignore [missing-import]
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.filters import apply_search, apply_sorting
from app.modules.leads.models import Lead, LeadActivity, LeadFollowup, LeadSource, SalesPipeline
from app.repositories.base import BaseRepository


class LeadSourceRepository(BaseRepository[LeadSource]):
    model = LeadSource
    searchable_columns = [LeadSource.name, LeadSource.slug]
    async def get_by_slug(self, slug: str) -> LeadSource | None:
        r = await self._db.execute(select(LeadSource).where(LeadSource.slug == slug))
        return r.scalar_one_or_none()


class LeadRepository(BaseRepository[Lead]):
    model = Lead
    searchable_columns = [Lead.title, Lead.company_name, Lead.contact_name, Lead.email]

    async def get_all_filtered(self, *, search=None, status=None, priority=None,
                               source_id=None, assigned_to=None, client_id=None, sort_by=None,
                               sort_order="desc", offset=0, limit=20) -> Sequence[Lead]:
        stmt = select(Lead)
        if status: stmt = stmt.where(func.lower(Lead.status) == status.lower())
        if priority: stmt = stmt.where(Lead.priority == priority)
        if source_id: stmt = stmt.where(Lead.source_id == source_id)
        if assigned_to: stmt = stmt.where(Lead.assigned_to == assigned_to)
        if client_id: stmt = stmt.where(Lead.client_id == client_id)
        stmt = apply_search(stmt, search=search, columns=self.searchable_columns)
        allowed = {"title", "company_name", "contact_name", "email", "phone", "status", "priority", "estimated_value", "created_at", "updated_at"}
        stmt = apply_sorting(stmt, model=Lead, sort_by=sort_by, sort_order=sort_order, allowed_columns=allowed)
        stmt = stmt.offset(offset).limit(limit)
        return (await self._db.execute(stmt)).scalars().all()

    async def count_filtered(self, *, search=None, status=None, priority=None,
                             source_id=None, assigned_to=None, client_id=None) -> int:
        stmt = select(func.count()).select_from(Lead)
        if status: stmt = stmt.where(func.lower(Lead.status) == status.lower())
        if priority: stmt = stmt.where(Lead.priority == priority)
        if source_id: stmt = stmt.where(Lead.source_id == source_id)
        if assigned_to: stmt = stmt.where(Lead.assigned_to == assigned_to)
        if client_id: stmt = stmt.where(Lead.client_id == client_id)
        stmt = apply_search(stmt, search=search, columns=self.searchable_columns)
        return (await self._db.execute(stmt)).scalar_one()

    async def find_by_converted_project(self, project_id) -> Lead | None:
        result = await self._db.execute(select(Lead).where(Lead.converted_project_id == project_id))
        return result.scalar_one_or_none()

    async def find_by_converted_client(self, client_id) -> Lead | None:
        result = await self._db.execute(select(Lead).where(Lead.converted_client_id == client_id).order_by(Lead.converted_at.desc()))
        return result.scalars().first()


class LeadActivityRepository(BaseRepository[LeadActivity]):
    model = LeadActivity
    async def list_by_lead(self, lead_id: uuid.UUID) -> Sequence[LeadActivity]:
        r = await self._db.execute(select(LeadActivity).where(LeadActivity.lead_id == lead_id).order_by(LeadActivity.created_at.desc()))
        return r.scalars().all()


class LeadFollowupRepository(BaseRepository[LeadFollowup]):
    model = LeadFollowup
    async def list_by_lead(self, lead_id: uuid.UUID) -> Sequence[LeadFollowup]:
        r = await self._db.execute(select(LeadFollowup).where(LeadFollowup.lead_id == lead_id).order_by(LeadFollowup.followup_date))
        return r.scalars().all()


class SalesPipelineRepository(BaseRepository[SalesPipeline]):
    model = SalesPipeline
    searchable_columns = [SalesPipeline.name, SalesPipeline.stage]
