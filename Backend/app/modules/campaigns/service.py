"""Service layer for Campaigns."""
from __future__ import annotations
import uuid
from typing import Sequence
from app.core.exceptions import NotFoundException
from app.core.tenant_scope import enforce_client_scope
from app.modules.campaigns.models import Campaign, CampaignAsset, CampaignMetric, CampaignPlatform
from app.modules.campaigns.repository import (
    CampaignAssetRepository, CampaignMetricRepository,
    CampaignPlatformRepository, CampaignRepository,
)

class CampaignService:
    def __init__(self, repo: CampaignRepository) -> None:
        self._repo = repo

    async def _validate_foreign_keys(self, client_id: uuid.UUID | None = None, manager_id: uuid.UUID | None = None) -> None:
        if client_id is not None:
            from app.modules.crm.repository import ClientRepository
            client = await ClientRepository(self._repo._db).get_by_id(client_id)
            if client is None:
                raise NotFoundException("Client")
        if manager_id is not None:
            from app.repositories.user_repository import UserRepository
            user = await UserRepository(self._repo._db).get_by_id(manager_id)
            if user is None:
                raise NotFoundException("User")

    async def list_campaigns(self, *, search=None, client_id=None, status=None, type_=None,
                             manager_id=None, sort_by=None, sort_order="desc", offset=0, limit=20):
        items = await self._repo.get_all_filtered(
            search=search, client_id=client_id, status=status, type_=type_,
            manager_id=manager_id, sort_by=sort_by, sort_order=sort_order, offset=offset, limit=limit,
        )
        total = await self._repo.count_filtered(
            search=search, client_id=client_id, status=status, type_=type_, manager_id=manager_id,
        )
        return items, total

    async def get_campaign(self, campaign_id: uuid.UUID, *, scoped_client_id: uuid.UUID | None = None) -> Campaign:
        c = await self._repo.get_detail(campaign_id)
        if c is None: raise NotFoundException("Campaign")
        enforce_client_scope(c.client_id, scoped_client_id)
        return c

    async def create_campaign(self, data: dict, *, scoped_client_id: uuid.UUID | None = None) -> Campaign:
        if scoped_client_id is not None:
            data["client_id"] = scoped_client_id
        await self._validate_foreign_keys(client_id=data.get("client_id"), manager_id=data.get("manager_id"))
        return await self._repo.create_from_dict(data)

    async def update_campaign(self, campaign_id: uuid.UUID, data: dict, *, scoped_client_id: uuid.UUID | None = None) -> Campaign:
        await self.get_campaign(campaign_id, scoped_client_id=scoped_client_id)
        client_id = data.get("client_id")
        manager_id = data.get("manager_id")
        if client_id is not None or manager_id is not None:
            await self._validate_foreign_keys(client_id=client_id, manager_id=manager_id)
        updated = await self._repo.update(campaign_id, data)
        if updated is None: raise NotFoundException("Campaign")
        return updated

    async def delete_campaign(self, campaign_id: uuid.UUID, *, scoped_client_id: uuid.UUID | None = None) -> None:
        await self.get_campaign(campaign_id, scoped_client_id=scoped_client_id)
        if not await self._repo.delete(campaign_id): raise NotFoundException("Campaign")

class CampaignPlatformService:
    def __init__(self, repo: CampaignPlatformRepository) -> None:
        self._repo = repo
    async def get_platform(self, platform_id: uuid.UUID) -> CampaignPlatform:
        p = await self._repo.get_by_id(platform_id)
        if p is None: raise NotFoundException("CampaignPlatform")
        return p
    async def list_platforms(self, campaign_id: uuid.UUID) -> Sequence[CampaignPlatform]:
        return await self._repo.list_by_campaign(campaign_id)
    async def create_platform(self, campaign_id: uuid.UUID, data: dict) -> CampaignPlatform:
        data["campaign_id"] = campaign_id
        return await self._repo.create_from_dict(data)
    async def update_platform(self, platform_id: uuid.UUID, data: dict) -> CampaignPlatform:
        updated = await self._repo.update(platform_id, data)
        if updated is None: raise NotFoundException("CampaignPlatform")
        return updated
    async def delete_platform(self, platform_id: uuid.UUID) -> None:
        if not await self._repo.delete(platform_id): raise NotFoundException("CampaignPlatform")

class CampaignAssetService:
    def __init__(self, repo: CampaignAssetRepository) -> None:
        self._repo = repo
    async def get_asset(self, asset_id: uuid.UUID) -> CampaignAsset:
        a = await self._repo.get_by_id(asset_id)
        if a is None: raise NotFoundException("CampaignAsset")
        return a
    async def list_assets(self, campaign_id: uuid.UUID) -> Sequence[CampaignAsset]:
        return await self._repo.list_by_campaign(campaign_id)
    async def create_asset(self, campaign_id: uuid.UUID, data: dict, uploaded_by: uuid.UUID | None = None) -> CampaignAsset:
        data["campaign_id"] = campaign_id
        data["uploaded_by"] = uploaded_by
        return await self._repo.create_from_dict(data)
    async def update_asset(self, asset_id: uuid.UUID, data: dict) -> CampaignAsset:
        updated = await self._repo.update(asset_id, data)
        if updated is None: raise NotFoundException("CampaignAsset")
        return updated
    async def delete_asset(self, asset_id: uuid.UUID) -> None:
        if not await self._repo.delete(asset_id): raise NotFoundException("CampaignAsset")

class CampaignMetricService:
    def __init__(self, repo: CampaignMetricRepository) -> None:
        self._repo = repo
    async def get_metric(self, metric_id: uuid.UUID) -> CampaignMetric:
        m = await self._repo.get_by_id(metric_id)
        if m is None: raise NotFoundException("CampaignMetric")
        return m
    async def list_metrics(self, campaign_id: uuid.UUID) -> Sequence[CampaignMetric]:
        return await self._repo.list_by_campaign(campaign_id)
    async def create_metric(self, campaign_id: uuid.UUID, data: dict) -> CampaignMetric:
        data["campaign_id"] = campaign_id
        return await self._repo.create_from_dict(data)
    async def update_metric(self, metric_id: uuid.UUID, data: dict) -> CampaignMetric:
        updated = await self._repo.update(metric_id, data)
        if updated is None: raise NotFoundException("CampaignMetric")
        return updated
    async def delete_metric(self, metric_id: uuid.UUID) -> None:
        if not await self._repo.delete(metric_id): raise NotFoundException("CampaignMetric")

