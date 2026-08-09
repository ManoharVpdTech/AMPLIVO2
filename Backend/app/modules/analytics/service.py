"""Service layer for Analytics."""
from __future__ import annotations
import uuid
from typing import Sequence
from sqlalchemy.exc import IntegrityError
from app.core.exceptions import BadRequestException, NotFoundException
from app.modules.analytics.models import Dashboard, DataIntegration, Report
from app.modules.analytics.repository import DashboardRepository, DataIntegrationRepository, ReportRepository

class DashboardService:
    def __init__(self, repo: DashboardRepository) -> None:
        self._repo = repo
    async def list_dashboards(self, *, search=None, is_shared=None, owner_id=None, current_user_id=None, sort_by=None, sort_order="desc", offset=0, limit=20):
        items = await self._repo.get_all_filtered(search=search, is_shared=is_shared, owner_id=owner_id, current_user_id=current_user_id, sort_by=sort_by, sort_order=sort_order, offset=offset, limit=limit)
        total = await self._repo.count_filtered(search=search, is_shared=is_shared, owner_id=owner_id, current_user_id=current_user_id)
        return items, total
    async def get_dashboard(self, dashboard_id: uuid.UUID, user_id: uuid.UUID) -> Dashboard:
        d = await self._repo.get_by_id(dashboard_id)
        if d is None or (d.owner_id != user_id and not d.is_shared): raise NotFoundException("Dashboard")
        return d
    async def create_dashboard(self, data: dict, owner_id: uuid.UUID | None = None) -> Dashboard:
        data["owner_id"] = owner_id
        return await self._repo.create_from_dict(data)
    async def update_dashboard(self, dashboard_id: uuid.UUID, data: dict, user_id: uuid.UUID) -> Dashboard:
        d = await self._repo.get_by_id(dashboard_id)
        if d is None or d.owner_id != user_id: raise NotFoundException("Dashboard")
        updated = await self._repo.update(dashboard_id, data)
        if updated is None: raise NotFoundException("Dashboard")
        return updated
    async def delete_dashboard(self, dashboard_id: uuid.UUID, user_id: uuid.UUID) -> None:
        d = await self._repo.get_by_id(dashboard_id)
        if d is None or d.owner_id != user_id: raise NotFoundException("Dashboard")
        if not await self._repo.delete(dashboard_id): raise NotFoundException("Dashboard")

class ReportService:
    def __init__(self, repo: ReportRepository) -> None:
        self._repo = repo
    async def list_reports(self, *, search=None, client_id=None, report_type=None, status=None, sort_by=None, sort_order="desc", offset=0, limit=20):
        items = await self._repo.get_all_filtered(search=search, client_id=client_id, report_type=report_type, status=status, sort_by=sort_by, sort_order=sort_order, offset=offset, limit=limit)
        total = await self._repo.count_filtered(search=search, client_id=client_id, report_type=report_type, status=status)
        return items, total
    async def get_report(self, report_id: uuid.UUID, client_id: uuid.UUID | None) -> Report:
        r = await self._repo.get_by_id(report_id)
        if r is None or (r.client_id != client_id and client_id is not None): raise NotFoundException("Report")
        return r
    async def create_report(self, data: dict, generated_by: uuid.UUID | None = None) -> Report:
        data["generated_by"] = generated_by
        try:
            return await self._repo.create_from_dict(data)
        except IntegrityError:
            raise BadRequestException("Invalid client_id")
    async def update_report(self, report_id: uuid.UUID, data: dict, client_id: uuid.UUID | None) -> Report:
        r = await self._repo.get_by_id(report_id)
        if r is None or (r.client_id != client_id and client_id is not None): raise NotFoundException("Report")
        updated = await self._repo.update(report_id, data)
        if updated is None: raise NotFoundException("Report")
        return updated
    async def delete_report(self, report_id: uuid.UUID, client_id: uuid.UUID | None) -> None:
        r = await self._repo.get_by_id(report_id)
        if r is None or (r.client_id != client_id and client_id is not None): raise NotFoundException("Report")
        if not await self._repo.delete(report_id): raise NotFoundException("Report")

class DataIntegrationService:
    def __init__(self, repo: DataIntegrationRepository) -> None:
        self._repo = repo
    async def list_integrations(self, *, client_id=None, provider_name=None, status=None, sort_by=None, sort_order="desc", offset=0, limit=20):
        items = await self._repo.get_all_filtered(client_id=client_id, provider_name=provider_name, status=status, sort_by=sort_by, sort_order=sort_order, offset=offset, limit=limit)
        total = await self._repo.count_filtered(client_id=client_id, provider_name=provider_name, status=status)
        return items, total
    async def get_integration(self, integration_id: uuid.UUID, client_id: uuid.UUID | None) -> DataIntegration:
        i = await self._repo.get_by_id(integration_id)
        if i is None or (i.client_id != client_id and client_id is not None): raise NotFoundException("DataIntegration")
        return i
    async def create_integration(self, data: dict) -> DataIntegration:
        try:
            return await self._repo.create_from_dict(data)
        except IntegrityError:
            raise BadRequestException("Invalid client_id")
    async def update_integration(self, integration_id: uuid.UUID, data: dict, client_id: uuid.UUID | None) -> DataIntegration:
        i = await self._repo.get_by_id(integration_id)
        if i is None or (i.client_id != client_id and client_id is not None): raise NotFoundException("DataIntegration")
        updated = await self._repo.update(integration_id, data)
        if updated is None: raise NotFoundException("DataIntegration")
        return updated
    async def delete_integration(self, integration_id: uuid.UUID, client_id: uuid.UUID | None) -> None:
        i = await self._repo.get_by_id(integration_id)
        if i is None or (i.client_id != client_id and client_id is not None): raise NotFoundException("DataIntegration")
        if not await self._repo.delete(integration_id): raise NotFoundException("DataIntegration")
