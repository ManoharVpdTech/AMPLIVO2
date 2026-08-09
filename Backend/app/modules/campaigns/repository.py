"""Repository layer for Campaigns."""
from __future__ import annotations
import uuid
from typing import Sequence
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload
from app.core.filters import apply_search, apply_sorting
from app.modules.campaigns.models import Campaign, CampaignAsset, CampaignMetric, CampaignPlatform
from app.repositories.base import BaseRepository


class CampaignRepository(BaseRepository[Campaign]):
    model = Campaign
    searchable_columns = [Campaign.name, Campaign.type]

    async def get_detail(self, campaign_id: uuid.UUID) -> Campaign | None:
        stmt = (
            select(Campaign)
            .options(
                selectinload(Campaign.platforms),
                selectinload(Campaign.assets),
                selectinload(Campaign.metrics),
            )
            .where(Campaign.id == campaign_id)
        )
        result = await self._db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_all_filtered(self, *, search=None, client_id=None, status=None,
                               type_=None, manager_id=None, sort_by=None,
                               sort_order="desc", offset=0, limit=20) -> Sequence[Campaign]:
        stmt = select(Campaign)
        if client_id: stmt = stmt.where(Campaign.client_id == client_id)
        if status: stmt = stmt.where(Campaign.status == status)
        if type_: stmt = stmt.where(Campaign.type == type_)
        if manager_id: stmt = stmt.where(Campaign.manager_id == manager_id)
        stmt = apply_search(stmt, search=search, columns=self.searchable_columns)
        allowed_sort = {"id", "name", "type", "status", "start_date", "end_date", "budget", "spent_amount", "created_at", "updated_at"}
        stmt = apply_sorting(stmt, model=Campaign, sort_by=sort_by, sort_order=sort_order, allowed_columns=allowed_sort)
        stmt = stmt.offset(offset).limit(limit)
        return (await self._db.execute(stmt)).scalars().all()

    async def count_filtered(self, *, search=None, client_id=None, status=None,
                             type_=None, manager_id=None) -> int:
        stmt = select(func.count()).select_from(Campaign)
        if client_id: stmt = stmt.where(Campaign.client_id == client_id)
        if status: stmt = stmt.where(Campaign.status == status)
        if type_: stmt = stmt.where(Campaign.type == type_)
        if manager_id: stmt = stmt.where(Campaign.manager_id == manager_id)
        stmt = apply_search(stmt, search=search, columns=self.searchable_columns)
        return (await self._db.execute(stmt)).scalar_one()


class CampaignPlatformRepository(BaseRepository[CampaignPlatform]):
    model = CampaignPlatform
    async def list_by_campaign(self, campaign_id: uuid.UUID) -> Sequence[CampaignPlatform]:
        r = await self._db.execute(select(CampaignPlatform).where(CampaignPlatform.campaign_id == campaign_id).order_by(CampaignPlatform.platform_name))
        return r.scalars().all()


class CampaignAssetRepository(BaseRepository[CampaignAsset]):
    model = CampaignAsset
    async def list_by_campaign(self, campaign_id: uuid.UUID) -> Sequence[CampaignAsset]:
        r = await self._db.execute(select(CampaignAsset).where(CampaignAsset.campaign_id == campaign_id).order_by(CampaignAsset.created_at.desc()))
        return r.scalars().all()


class CampaignMetricRepository(BaseRepository[CampaignMetric]):
    model = CampaignMetric
    async def list_by_campaign(self, campaign_id: uuid.UUID) -> Sequence[CampaignMetric]:
        r = await self._db.execute(select(CampaignMetric).where(CampaignMetric.campaign_id == campaign_id).order_by(CampaignMetric.date.desc()))
        return r.scalars().all()
