"""API routes for Campaigns."""
from __future__ import annotations
import uuid
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.pagination import PaginatedResponse, PaginationParams
from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db
from app.dependencies.tenant import get_current_client_id
from app.models.user import User
from app.modules.campaigns.dependencies import *
from app.modules.campaigns.schemas import *
from app.modules.campaigns.service import *

router = APIRouter(prefix="/campaigns", tags=["Campaigns"])

# ── Campaigns ──
@router.get("", response_model=PaginatedResponse[CampaignRead], summary="List campaigns")
async def list_campaigns(
    params: PaginationParams = Depends(),
    client_id: uuid.UUID | None = Query(None),
    campaign_status: str | None = Query(None, alias="status"),
    type_: str | None = Query(None, alias="type"),
    manager_id: uuid.UUID | None = Query(None),
    svc: CampaignService = Depends(get_campaign_service),
    _: User = Depends(get_current_user),
    scoped_client_id: uuid.UUID | None = Depends(get_current_client_id),
):
    effective_client_id = scoped_client_id if scoped_client_id is not None else client_id
    items, total = await svc.list_campaigns(
        search=params.search, client_id=effective_client_id, status=campaign_status, type_=type_,
        manager_id=manager_id, sort_by=params.sort_by, sort_order=params.sort_order,
        offset=params.offset, limit=params.page_size,
    )
    return PaginatedResponse[CampaignRead].create(items=[CampaignRead.model_validate(x) for x in items], total=total, page=params.page, page_size=params.page_size)

@router.post("", response_model=CampaignRead, status_code=status.HTTP_201_CREATED, summary="Create campaign")
async def create_campaign(payload: CampaignCreate, db: AsyncSession = Depends(get_db), svc: CampaignService = Depends(get_campaign_service), _: User = Depends(get_current_user), scoped_client_id: uuid.UUID | None = Depends(get_current_client_id)):
    c = await svc.create_campaign(payload.model_dump(), scoped_client_id=scoped_client_id); await db.commit()
    return CampaignRead.model_validate(c)

@router.get("/{campaign_id}", response_model=CampaignRead, summary="Get campaign")
async def get_campaign(campaign_id: uuid.UUID, svc: CampaignService = Depends(get_campaign_service), _: User = Depends(get_current_user), scoped_client_id: uuid.UUID | None = Depends(get_current_client_id)):
    return CampaignRead.model_validate(await svc.get_campaign(campaign_id, scoped_client_id=scoped_client_id))

@router.put("/{campaign_id}", response_model=CampaignRead, summary="Update campaign")
async def update_campaign(campaign_id: uuid.UUID, payload: CampaignUpdate, db: AsyncSession = Depends(get_db), svc: CampaignService = Depends(get_campaign_service), _: User = Depends(get_current_user), scoped_client_id: uuid.UUID | None = Depends(get_current_client_id)):
    c = await svc.update_campaign(campaign_id, payload.model_dump(exclude_unset=True), scoped_client_id=scoped_client_id); await db.commit()
    return CampaignRead.model_validate(c)

@router.delete("/{campaign_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete campaign")
async def delete_campaign(campaign_id: uuid.UUID, db: AsyncSession = Depends(get_db), svc: CampaignService = Depends(get_campaign_service), _: User = Depends(get_current_user), scoped_client_id: uuid.UUID | None = Depends(get_current_client_id)):
    await svc.delete_campaign(campaign_id, scoped_client_id=scoped_client_id); await db.commit()

# ── Campaign Platforms ──
@router.get("/{campaign_id}/platforms", response_model=list[CampaignPlatformRead], summary="List campaign platforms")
async def list_campaign_platforms(campaign_id: uuid.UUID, svc: CampaignPlatformService = Depends(get_campaign_platform_service), campaign_svc: CampaignService = Depends(get_campaign_service), _: User = Depends(get_current_user), scoped_client_id: uuid.UUID | None = Depends(get_current_client_id)):
    await campaign_svc.get_campaign(campaign_id, scoped_client_id=scoped_client_id)
    return [CampaignPlatformRead.model_validate(x) for x in await svc.list_platforms(campaign_id)]

@router.post("/{campaign_id}/platforms", response_model=CampaignPlatformRead, status_code=status.HTTP_201_CREATED, summary="Add campaign platform")
async def create_campaign_platform(campaign_id: uuid.UUID, payload: CampaignPlatformCreate, db: AsyncSession = Depends(get_db), svc: CampaignPlatformService = Depends(get_campaign_platform_service), campaign_svc: CampaignService = Depends(get_campaign_service), _: User = Depends(get_current_user), scoped_client_id: uuid.UUID | None = Depends(get_current_client_id)):
    await campaign_svc.get_campaign(campaign_id, scoped_client_id=scoped_client_id)
    p = await svc.create_platform(campaign_id, payload.model_dump()); await db.commit()
    return CampaignPlatformRead.model_validate(p)

@router.put("/platforms/{platform_id}", response_model=CampaignPlatformRead, summary="Update campaign platform")
async def update_campaign_platform(platform_id: uuid.UUID, payload: CampaignPlatformUpdate, db: AsyncSession = Depends(get_db), svc: CampaignPlatformService = Depends(get_campaign_platform_service), campaign_svc: CampaignService = Depends(get_campaign_service), _: User = Depends(get_current_user), scoped_client_id: uuid.UUID | None = Depends(get_current_client_id)):
    platform = await svc.get_platform(platform_id)
    await campaign_svc.get_campaign(platform.campaign_id, scoped_client_id=scoped_client_id)
    p = await svc.update_platform(platform_id, payload.model_dump(exclude_unset=True)); await db.commit()
    return CampaignPlatformRead.model_validate(p)

@router.delete("/platforms/{platform_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete campaign platform")
async def delete_campaign_platform(platform_id: uuid.UUID, db: AsyncSession = Depends(get_db), svc: CampaignPlatformService = Depends(get_campaign_platform_service), campaign_svc: CampaignService = Depends(get_campaign_service), _: User = Depends(get_current_user), scoped_client_id: uuid.UUID | None = Depends(get_current_client_id)):
    platform = await svc.get_platform(platform_id)
    await campaign_svc.get_campaign(platform.campaign_id, scoped_client_id=scoped_client_id)
    await svc.delete_platform(platform_id); await db.commit()

# ── Campaign Assets ──
@router.get("/{campaign_id}/assets", response_model=list[CampaignAssetRead], summary="List campaign assets")
async def list_campaign_assets(campaign_id: uuid.UUID, svc: CampaignAssetService = Depends(get_campaign_asset_service), campaign_svc: CampaignService = Depends(get_campaign_service), _: User = Depends(get_current_user), scoped_client_id: uuid.UUID | None = Depends(get_current_client_id)):
    await campaign_svc.get_campaign(campaign_id, scoped_client_id=scoped_client_id)
    return [CampaignAssetRead.model_validate(x) for x in await svc.list_assets(campaign_id)]

@router.post("/{campaign_id}/assets", response_model=CampaignAssetRead, status_code=status.HTTP_201_CREATED, summary="Add campaign asset")
async def create_campaign_asset(campaign_id: uuid.UUID, payload: CampaignAssetCreate, db: AsyncSession = Depends(get_db), svc: CampaignAssetService = Depends(get_campaign_asset_service), campaign_svc: CampaignService = Depends(get_campaign_service), current_user: User = Depends(get_current_user), scoped_client_id: uuid.UUID | None = Depends(get_current_client_id)):
    await campaign_svc.get_campaign(campaign_id, scoped_client_id=scoped_client_id)
    a = await svc.create_asset(campaign_id, payload.model_dump(), uploaded_by=current_user.id); await db.commit()
    return CampaignAssetRead.model_validate(a)

@router.put("/assets/{asset_id}", response_model=CampaignAssetRead, summary="Update campaign asset")
async def update_campaign_asset(asset_id: uuid.UUID, payload: CampaignAssetUpdate, db: AsyncSession = Depends(get_db), svc: CampaignAssetService = Depends(get_campaign_asset_service), campaign_svc: CampaignService = Depends(get_campaign_service), _: User = Depends(get_current_user), scoped_client_id: uuid.UUID | None = Depends(get_current_client_id)):
    asset = await svc.get_asset(asset_id)
    await campaign_svc.get_campaign(asset.campaign_id, scoped_client_id=scoped_client_id)
    a = await svc.update_asset(asset_id, payload.model_dump(exclude_unset=True)); await db.commit()
    return CampaignAssetRead.model_validate(a)

@router.delete("/assets/{asset_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete campaign asset")
async def delete_campaign_asset(asset_id: uuid.UUID, db: AsyncSession = Depends(get_db), svc: CampaignAssetService = Depends(get_campaign_asset_service), campaign_svc: CampaignService = Depends(get_campaign_service), _: User = Depends(get_current_user), scoped_client_id: uuid.UUID | None = Depends(get_current_client_id)):
    asset = await svc.get_asset(asset_id)
    await campaign_svc.get_campaign(asset.campaign_id, scoped_client_id=scoped_client_id)
    await svc.delete_asset(asset_id); await db.commit()

# ── Campaign Metrics ──
@router.get("/{campaign_id}/metrics", response_model=list[CampaignMetricRead], summary="List campaign metrics")
async def list_campaign_metrics(campaign_id: uuid.UUID, svc: CampaignMetricService = Depends(get_campaign_metric_service), campaign_svc: CampaignService = Depends(get_campaign_service), _: User = Depends(get_current_user), scoped_client_id: uuid.UUID | None = Depends(get_current_client_id)):
    await campaign_svc.get_campaign(campaign_id, scoped_client_id=scoped_client_id)
    return [CampaignMetricRead.model_validate(x) for x in await svc.list_metrics(campaign_id)]

@router.post("/{campaign_id}/metrics", response_model=CampaignMetricRead, status_code=status.HTTP_201_CREATED, summary="Add campaign metric")
async def create_campaign_metric(campaign_id: uuid.UUID, payload: CampaignMetricCreate, db: AsyncSession = Depends(get_db), svc: CampaignMetricService = Depends(get_campaign_metric_service), campaign_svc: CampaignService = Depends(get_campaign_service), _: User = Depends(get_current_user), scoped_client_id: uuid.UUID | None = Depends(get_current_client_id)):
    await campaign_svc.get_campaign(campaign_id, scoped_client_id=scoped_client_id)
    m = await svc.create_metric(campaign_id, payload.model_dump()); await db.commit()
    return CampaignMetricRead.model_validate(m)

@router.put("/metrics/{metric_id}", response_model=CampaignMetricRead, summary="Update campaign metric")
async def update_campaign_metric(metric_id: uuid.UUID, payload: CampaignMetricUpdate, db: AsyncSession = Depends(get_db), svc: CampaignMetricService = Depends(get_campaign_metric_service), campaign_svc: CampaignService = Depends(get_campaign_service), _: User = Depends(get_current_user), scoped_client_id: uuid.UUID | None = Depends(get_current_client_id)):
    metric = await svc.get_metric(metric_id)
    await campaign_svc.get_campaign(metric.campaign_id, scoped_client_id=scoped_client_id)
    m = await svc.update_metric(metric_id, payload.model_dump(exclude_unset=True)); await db.commit()
    return CampaignMetricRead.model_validate(m)

@router.delete("/metrics/{metric_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete campaign metric")
async def delete_campaign_metric(metric_id: uuid.UUID, db: AsyncSession = Depends(get_db), svc: CampaignMetricService = Depends(get_campaign_metric_service), campaign_svc: CampaignService = Depends(get_campaign_service), _: User = Depends(get_current_user), scoped_client_id: uuid.UUID | None = Depends(get_current_client_id)):
    metric = await svc.get_metric(metric_id)
    await campaign_svc.get_campaign(metric.campaign_id, scoped_client_id=scoped_client_id)
    await svc.delete_metric(metric_id); await db.commit()

