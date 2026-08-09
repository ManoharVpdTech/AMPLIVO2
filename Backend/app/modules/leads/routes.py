"""API routes for Lead Management."""
from __future__ import annotations
import uuid
from typing import Literal
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.pagination import PaginatedResponse, PaginationParams
from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db
from app.dependencies.rbac import require_roles
from app.dependencies.tenant import get_current_client_id, get_current_user_role_slug
from app.models.user import User
from app.modules.leads.analytics_service import SalesAnalyticsService
from app.modules.leads.dependencies import (
    get_lead_activity_service, get_lead_followup_service,
    get_lead_service, get_lead_source_service, get_sales_pipeline_service,
)
from app.modules.leads.schemas import *
from app.modules.leads.service import (
    LeadActivityService, LeadFollowupService, LeadService,
    LeadSourceService, SalesPipelineService,
)
from app.modules.crm.dependencies import get_proposal_service
from app.modules.crm.schemas import ProposalCreate, ProposalRead
from app.modules.crm.service import ProposalService

router = APIRouter(tags=["CRM — Leads"])

# ── Lead Sources ──
@router.get("/lead-sources", response_model=PaginatedResponse[LeadSourceRead], summary="List lead sources")
async def list_lead_sources(params: PaginationParams = Depends(), svc: LeadSourceService = Depends(get_lead_source_service), _: User = Depends(get_current_user)):
    items, total = await svc.list_sources(search=params.search, sort_by=params.sort_by, sort_order=params.sort_order, offset=params.offset, limit=params.page_size)
    return PaginatedResponse[LeadSourceRead].create(items=[LeadSourceRead.model_validate(x) for x in items], total=total, page=params.page, page_size=params.page_size)

@router.post("/lead-sources", response_model=LeadSourceRead, status_code=status.HTTP_201_CREATED, summary="Create lead source")
async def create_lead_source(payload: LeadSourceCreate, db: AsyncSession = Depends(get_db), svc: LeadSourceService = Depends(get_lead_source_service), _: User = Depends(get_current_user), _role: str = Depends(require_roles("sales"))):
    s = await svc.create_source(payload.model_dump()); await db.commit()
    return LeadSourceRead.model_validate(s)

@router.get("/lead-sources/{source_id}", response_model=LeadSourceRead, summary="Get lead source")
async def get_lead_source(source_id: uuid.UUID, svc: LeadSourceService = Depends(get_lead_source_service), _: User = Depends(get_current_user)):
    return LeadSourceRead.model_validate(await svc.get_source(source_id))

@router.put("/lead-sources/{source_id}", response_model=LeadSourceRead, summary="Update lead source")
async def update_lead_source(source_id: uuid.UUID, payload: LeadSourceUpdate, db: AsyncSession = Depends(get_db), svc: LeadSourceService = Depends(get_lead_source_service), _: User = Depends(get_current_user), _role: str = Depends(require_roles("sales"))):
    s = await svc.update_source(source_id, payload.model_dump(exclude_unset=True)); await db.commit()
    return LeadSourceRead.model_validate(s)

@router.delete("/lead-sources/{source_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete lead source")
async def delete_lead_source(source_id: uuid.UUID, db: AsyncSession = Depends(get_db), svc: LeadSourceService = Depends(get_lead_source_service), _: User = Depends(get_current_user), _role: str = Depends(require_roles("sales"))):
    await svc.delete_source(source_id); await db.commit()

# ── Leads ──
@router.get("/leads", response_model=PaginatedResponse[LeadRead], summary="List leads")
async def list_leads(
    params: PaginationParams = Depends(),
    lead_status: str | None = Query(None, alias="status"),
    priority: str | None = Query(None),
    source_id: uuid.UUID | None = Query(None),
    assigned_to: uuid.UUID | None = Query(None),
    client_id: uuid.UUID | None = Query(None),
    svc: LeadService = Depends(get_lead_service),
    _: User = Depends(get_current_user),
    scoped_client_id: uuid.UUID | None = Depends(get_current_client_id),
    _role: str = Depends(require_roles("sales")),
):
    effective_client_id = scoped_client_id if scoped_client_id is not None else client_id
    items, total = await svc.list_leads(
        search=params.search, status=lead_status, priority=priority,
        source_id=source_id, assigned_to=assigned_to, client_id=effective_client_id, sort_by=params.sort_by,
        sort_order=params.sort_order, offset=params.offset, limit=params.page_size,
    )
    return PaginatedResponse[LeadRead].create(
        items=[LeadRead.model_validate(x) for x in items],
        total=total, page=params.page, page_size=params.page_size,
    )

@router.post("/leads", response_model=LeadRead, status_code=status.HTTP_201_CREATED, summary="Create lead")
async def create_lead(payload: LeadCreate, db: AsyncSession = Depends(get_db), svc: LeadService = Depends(get_lead_service), current_user: User = Depends(get_current_user), _role: str = Depends(require_roles("sales"))):
    lead = await svc.create_lead(payload.model_dump(), created_by=current_user.id); await db.commit()
    return LeadRead.model_validate(lead)

# NOTE: these two must stay registered before "/leads/{lead_id}" — otherwise
# Starlette matches "/leads/dashboard-stats" against the {lead_id}: uuid.UUID
# route first and returns 422 instead of reaching these handlers.
@router.get("/leads/dashboard-stats", summary="Sales dashboard rollup (live KPIs, no mock data)")
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    role_slug: str | None = Depends(get_current_user_role_slug),
    _role: str = Depends(require_roles("sales")),
):
    return await SalesAnalyticsService(db).get_dashboard_stats(current_user_id=current_user.id, role_slug=role_slug)

@router.get("/leads/sales-reports", summary="Sales reports (conversion/revenue/won-vs-lost/etc.)")
async def get_sales_reports(
    report_type: Literal["conversion", "won_vs_lost", "revenue", "monthly_growth", "campaign_performance", "performance", "team_performance"] = Query(..., alias="type"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    role_slug: str | None = Depends(get_current_user_role_slug),
    _role: str = Depends(require_roles("sales")),
):
    return await SalesAnalyticsService(db).get_report(report_type, current_user_id=current_user.id, role_slug=role_slug)

@router.get("/leads/{lead_id}", response_model=LeadRead, summary="Get lead")
async def get_lead(lead_id: uuid.UUID, svc: LeadService = Depends(get_lead_service), _: User = Depends(get_current_user), scoped_client_id: uuid.UUID | None = Depends(get_current_client_id), _role: str = Depends(require_roles("sales"))):
    return LeadRead.model_validate(await svc.get_lead(lead_id, scoped_client_id=scoped_client_id))

@router.put("/leads/{lead_id}", response_model=LeadRead, summary="Update lead")
async def update_lead(lead_id: uuid.UUID, payload: LeadUpdate, db: AsyncSession = Depends(get_db), svc: LeadService = Depends(get_lead_service), current_user: User = Depends(get_current_user), scoped_client_id: uuid.UUID | None = Depends(get_current_client_id), _role: str = Depends(require_roles("sales"))):
    lead = await svc.update_lead(lead_id, payload.model_dump(exclude_unset=True), scoped_client_id=scoped_client_id, actor_id=current_user.id); await db.commit()
    return LeadRead.model_validate(lead)

@router.delete("/leads/{lead_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete lead")
async def delete_lead(lead_id: uuid.UUID, db: AsyncSession = Depends(get_db), svc: LeadService = Depends(get_lead_service), _: User = Depends(get_current_user), scoped_client_id: uuid.UUID | None = Depends(get_current_client_id), _role: str = Depends(require_roles("sales"))):
    await svc.delete_lead(lead_id, scoped_client_id=scoped_client_id); await db.commit()

@router.post("/leads/{lead_id}/convert", response_model=LeadRead, summary="Convert lead to client")
async def convert_lead(lead_id: uuid.UUID, payload: LeadConvertRequest, db: AsyncSession = Depends(get_db), svc: LeadService = Depends(get_lead_service), current_user: User = Depends(get_current_user), _role: str = Depends(require_roles("sales"))):
    lead = await svc.convert_lead(lead_id, payload.client_id, actor_id=current_user.id); await db.commit()
    return LeadRead.model_validate(lead)

@router.post("/leads/{lead_id}/mark-lost", response_model=LeadRead, summary="Mark a lead LOST/REJECTED (terminal - no client/project/account is ever created)")
async def mark_lead_lost(lead_id: uuid.UUID, payload: LeadMarkLostRequest, db: AsyncSession = Depends(get_db), svc: LeadService = Depends(get_lead_service), current_user: User = Depends(get_current_user), _role: str = Depends(require_roles("sales"))):
    lead = await svc.mark_lost(lead_id, reason=payload.reason, terminal_status=payload.terminal_status, actor_id=current_user.id); await db.commit()
    return LeadRead.model_validate(lead)

# ── Proposals on a Lead (pre-conversion - see migration 0020) ──
@router.get("/leads/{lead_id}/proposals", response_model=list[ProposalRead], summary="List proposals for a lead")
async def list_lead_proposals(lead_id: uuid.UUID, svc: ProposalService = Depends(get_proposal_service), _: User = Depends(get_current_user), _role: str = Depends(require_roles("sales"))):
    return [ProposalRead.model_validate(p) for p in await svc.list_proposals_for_lead(lead_id)]

@router.post("/leads/{lead_id}/proposals", response_model=ProposalRead, status_code=status.HTTP_201_CREATED, summary="Create proposal for a lead")
async def create_lead_proposal(lead_id: uuid.UUID, payload: ProposalCreate, db: AsyncSession = Depends(get_db), svc: ProposalService = Depends(get_proposal_service), current_user: User = Depends(get_current_user), _role: str = Depends(require_roles("sales"))):
    p = await svc.create_proposal_for_lead(lead_id, payload.model_dump(), created_by=current_user.id); await db.commit()
    return ProposalRead.model_validate(p)

# ── Lead Activities ──
@router.get("/leads/{lead_id}/activities", response_model=list[LeadActivityRead], summary="List lead activities")
async def list_activities(lead_id: uuid.UUID, svc: LeadActivityService = Depends(get_lead_activity_service), _: User = Depends(get_current_user), _role: str = Depends(require_roles("sales"))):
    return [LeadActivityRead.model_validate(a) for a in await svc.list_activities(lead_id)]

@router.post("/leads/{lead_id}/activities", response_model=LeadActivityRead, status_code=status.HTTP_201_CREATED, summary="Add lead activity")
async def create_activity(lead_id: uuid.UUID, payload: LeadActivityCreate, db: AsyncSession = Depends(get_db), svc: LeadActivityService = Depends(get_lead_activity_service), current_user: User = Depends(get_current_user), _role: str = Depends(require_roles("sales"))):
    a = await svc.create_activity(lead_id, payload.model_dump(), performed_by=current_user.id); await db.commit()
    return LeadActivityRead.model_validate(a)

# ── Lead Followups ──
@router.get("/leads/{lead_id}/followups", response_model=list[LeadFollowupRead], summary="List lead followups")
async def list_followups(lead_id: uuid.UUID, svc: LeadFollowupService = Depends(get_lead_followup_service), _: User = Depends(get_current_user), _role: str = Depends(require_roles("sales"))):
    return [LeadFollowupRead.model_validate(f) for f in await svc.list_followups(lead_id)]

@router.post("/leads/{lead_id}/followups", response_model=LeadFollowupRead, status_code=status.HTTP_201_CREATED, summary="Add lead followup")
async def create_followup(lead_id: uuid.UUID, payload: LeadFollowupCreate, db: AsyncSession = Depends(get_db), svc: LeadFollowupService = Depends(get_lead_followup_service), _: User = Depends(get_current_user), _role: str = Depends(require_roles("sales"))):
    f = await svc.create_followup(lead_id, payload.model_dump()); await db.commit()
    return LeadFollowupRead.model_validate(f)

@router.put("/followups/{followup_id}", response_model=LeadFollowupRead, summary="Update followup")
async def update_followup(followup_id: uuid.UUID, payload: LeadFollowupUpdate, db: AsyncSession = Depends(get_db), svc: LeadFollowupService = Depends(get_lead_followup_service), _: User = Depends(get_current_user), _role: str = Depends(require_roles("sales"))):
    f = await svc.update_followup(followup_id, payload.model_dump(exclude_unset=True)); await db.commit()
    return LeadFollowupRead.model_validate(f)

@router.delete("/followups/{followup_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete followup")
async def delete_followup(followup_id: uuid.UUID, db: AsyncSession = Depends(get_db), svc: LeadFollowupService = Depends(get_lead_followup_service), _: User = Depends(get_current_user), _role: str = Depends(require_roles("sales"))):
    await svc.delete_followup(followup_id); await db.commit()

# ── Sales Pipeline ──
@router.get("/sales-pipeline", response_model=PaginatedResponse[SalesPipelineRead], summary="List pipeline stages")
async def list_pipeline_stages(params: PaginationParams = Depends(), svc: SalesPipelineService = Depends(get_sales_pipeline_service), _: User = Depends(get_current_user)):
    items, total = await svc.list_stages(search=params.search, sort_by=params.sort_by, sort_order=params.sort_order, offset=params.offset, limit=params.page_size)
    return PaginatedResponse[SalesPipelineRead].create(items=[SalesPipelineRead.model_validate(x) for x in items], total=total, page=params.page, page_size=params.page_size)

@router.post("/sales-pipeline", response_model=SalesPipelineRead, status_code=status.HTTP_201_CREATED, summary="Create pipeline stage")
async def create_pipeline_stage(payload: SalesPipelineCreate, db: AsyncSession = Depends(get_db), svc: SalesPipelineService = Depends(get_sales_pipeline_service), _: User = Depends(get_current_user), _role: str = Depends(require_roles("sales"))):
    s = await svc.create_stage(payload.model_dump()); await db.commit()
    return SalesPipelineRead.model_validate(s)

@router.put("/sales-pipeline/{stage_id}", response_model=SalesPipelineRead, summary="Update pipeline stage")
async def update_pipeline_stage(stage_id: uuid.UUID, payload: SalesPipelineUpdate, db: AsyncSession = Depends(get_db), svc: SalesPipelineService = Depends(get_sales_pipeline_service), _: User = Depends(get_current_user), _role: str = Depends(require_roles("sales"))):
    s = await svc.update_stage(stage_id, payload.model_dump(exclude_unset=True)); await db.commit()
    return SalesPipelineRead.model_validate(s)

@router.delete("/sales-pipeline/{stage_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete pipeline stage")
async def delete_pipeline_stage(stage_id: uuid.UUID, db: AsyncSession = Depends(get_db), svc: SalesPipelineService = Depends(get_sales_pipeline_service), _: User = Depends(get_current_user), _role: str = Depends(require_roles("sales"))):
    await svc.delete_stage(stage_id); await db.commit()
