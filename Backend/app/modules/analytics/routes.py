"""API routes for Analytics."""
from __future__ import annotations
import uuid
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.pagination import PaginatedResponse, PaginationParams
from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db
from app.models.user import User
from app.modules.analytics.dependencies import *
from app.modules.analytics.schemas import *
from app.modules.analytics.service import *

router = APIRouter(prefix="/analytics", tags=["Analytics"])

# ── Dashboards ──
@router.head("/dashboards", status_code=status.HTTP_405_METHOD_NOT_ALLOWED, include_in_schema=False)
async def list_dashboards_head():
    pass

@router.get("/dashboards", response_model=PaginatedResponse[DashboardRead], summary="List dashboards")
async def list_dashboards(
    params: PaginationParams = Depends(),
    is_shared: bool | None = Query(None),
    owner_id: uuid.UUID | None = Query(None),
    svc: DashboardService = Depends(get_dashboard_service),
    current_user: User = Depends(get_current_user),
):
    items, total = await svc.list_dashboards(
        search=params.search, is_shared=is_shared, owner_id=owner_id, current_user_id=current_user.id,
        sort_by=params.sort_by, sort_order=params.sort_order,
        offset=params.offset, limit=params.page_size,
    )
    return PaginatedResponse[DashboardRead].create(items=[DashboardRead.model_validate(x) for x in items], total=total, page=params.page, page_size=params.page_size)

@router.post("/dashboards", response_model=DashboardRead, status_code=status.HTTP_201_CREATED, summary="Create dashboard")
async def create_dashboard(payload: DashboardCreate, db: AsyncSession = Depends(get_db), svc: DashboardService = Depends(get_dashboard_service), current_user: User = Depends(get_current_user)):
    d = await svc.create_dashboard(payload.model_dump(), owner_id=current_user.id); await db.commit()
    return DashboardRead.model_validate(d)

@router.get("/dashboards/{dashboard_id}", response_model=DashboardRead, summary="Get dashboard")
async def get_dashboard(dashboard_id: uuid.UUID, svc: DashboardService = Depends(get_dashboard_service), current_user: User = Depends(get_current_user)):
    return DashboardRead.model_validate(await svc.get_dashboard(dashboard_id, current_user.id))

@router.put("/dashboards/{dashboard_id}", response_model=DashboardRead, summary="Update dashboard")
async def update_dashboard(dashboard_id: uuid.UUID, payload: DashboardUpdate, db: AsyncSession = Depends(get_db), svc: DashboardService = Depends(get_dashboard_service), current_user: User = Depends(get_current_user)):
    d = await svc.update_dashboard(dashboard_id, payload.model_dump(exclude_unset=True), current_user.id); await db.commit()
    return DashboardRead.model_validate(d)

@router.delete("/dashboards/{dashboard_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete dashboard")
async def delete_dashboard(dashboard_id: uuid.UUID, db: AsyncSession = Depends(get_db), svc: DashboardService = Depends(get_dashboard_service), current_user: User = Depends(get_current_user)):
    await svc.delete_dashboard(dashboard_id, current_user.id); await db.commit()

# ── Reports ──
@router.head("/reports", status_code=status.HTTP_405_METHOD_NOT_ALLOWED, include_in_schema=False)
async def list_reports_head():
    pass

@router.get("/reports", response_model=PaginatedResponse[ReportRead], summary="List reports")
async def list_reports(
    params: PaginationParams = Depends(),
    client_id: uuid.UUID | None = Query(None),
    report_type: str | None = Query(None),
    report_status: str | None = Query(None, alias="status"),
    svc: ReportService = Depends(get_report_service),
    current_user: User = Depends(get_current_user),
):
    # Enforce tenant isolation for list if not provided
    effective_client_id = client_id or current_user.client_id
    items, total = await svc.list_reports(
        search=params.search, client_id=effective_client_id, report_type=report_type, status=report_status,
        sort_by=params.sort_by, sort_order=params.sort_order,
        offset=params.offset, limit=params.page_size,
    )
    return PaginatedResponse[ReportRead].create(items=[ReportRead.model_validate(x) for x in items], total=total, page=params.page, page_size=params.page_size)

@router.post("/reports", response_model=ReportRead, status_code=status.HTTP_201_CREATED, summary="Create report")
async def create_report(payload: ReportCreate, db: AsyncSession = Depends(get_db), svc: ReportService = Depends(get_report_service), current_user: User = Depends(get_current_user)):
    r = await svc.create_report(payload.model_dump(), generated_by=current_user.id); await db.commit()
    return ReportRead.model_validate(r)

@router.get("/reports/{report_id}", response_model=ReportRead, summary="Get report")
async def get_report(report_id: uuid.UUID, svc: ReportService = Depends(get_report_service), current_user: User = Depends(get_current_user)):
    return ReportRead.model_validate(await svc.get_report(report_id, current_user.client_id))

@router.put("/reports/{report_id}", response_model=ReportRead, summary="Update report")
async def update_report(report_id: uuid.UUID, payload: ReportUpdate, db: AsyncSession = Depends(get_db), svc: ReportService = Depends(get_report_service), current_user: User = Depends(get_current_user)):
    r = await svc.update_report(report_id, payload.model_dump(exclude_unset=True), current_user.client_id); await db.commit()
    return ReportRead.model_validate(r)

@router.delete("/reports/{report_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete report")
async def delete_report(report_id: uuid.UUID, db: AsyncSession = Depends(get_db), svc: ReportService = Depends(get_report_service), current_user: User = Depends(get_current_user)):
    await svc.delete_report(report_id, current_user.client_id); await db.commit()

# ── Data Integrations ──
@router.head("/integrations", status_code=status.HTTP_405_METHOD_NOT_ALLOWED, include_in_schema=False)
async def list_integrations_head():
    pass

@router.get("/integrations", response_model=PaginatedResponse[DataIntegrationRead], summary="List data integrations")
async def list_integrations(
    params: PaginationParams = Depends(),
    client_id: uuid.UUID | None = Query(None),
    provider_name: str | None = Query(None),
    integration_status: str | None = Query(None, alias="status"),
    svc: DataIntegrationService = Depends(get_data_integration_service),
    current_user: User = Depends(get_current_user),
):
    effective_client_id = client_id or current_user.client_id
    items, total = await svc.list_integrations(
        client_id=effective_client_id, provider_name=provider_name, status=integration_status,
        sort_by=params.sort_by, sort_order=params.sort_order,
        offset=params.offset, limit=params.page_size,
    )
    return PaginatedResponse[DataIntegrationRead].create(items=[DataIntegrationRead.model_validate(x) for x in items], total=total, page=params.page, page_size=params.page_size)

@router.post("/integrations", response_model=DataIntegrationRead, status_code=status.HTTP_201_CREATED, summary="Add data integration")
async def create_integration(payload: DataIntegrationCreate, db: AsyncSession = Depends(get_db), svc: DataIntegrationService = Depends(get_data_integration_service), _: User = Depends(get_current_user)):
    i = await svc.create_integration(payload.model_dump()); await db.commit()
    return DataIntegrationRead.model_validate(i)

@router.get("/integrations/{integration_id}", response_model=DataIntegrationRead, summary="Get data integration")
async def get_integration(integration_id: uuid.UUID, svc: DataIntegrationService = Depends(get_data_integration_service), current_user: User = Depends(get_current_user)):
    return DataIntegrationRead.model_validate(await svc.get_integration(integration_id, current_user.client_id))

@router.put("/integrations/{integration_id}", response_model=DataIntegrationRead, summary="Update data integration")
async def update_integration(integration_id: uuid.UUID, payload: DataIntegrationUpdate, db: AsyncSession = Depends(get_db), svc: DataIntegrationService = Depends(get_data_integration_service), current_user: User = Depends(get_current_user)):
    i = await svc.update_integration(integration_id, payload.model_dump(exclude_unset=True), current_user.client_id); await db.commit()
    return DataIntegrationRead.model_validate(i)

@router.delete("/integrations/{integration_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete data integration")
async def delete_integration(integration_id: uuid.UUID, db: AsyncSession = Depends(get_db), svc: DataIntegrationService = Depends(get_data_integration_service), current_user: User = Depends(get_current_user)):
    await svc.delete_integration(integration_id, current_user.client_id); await db.commit()
