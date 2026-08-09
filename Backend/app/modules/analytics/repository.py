"""Repository layer for Analytics."""
from __future__ import annotations
from typing import Sequence
from sqlalchemy import func, select
from app.core.filters import apply_search, apply_sorting
from app.modules.analytics.models import Dashboard, DataIntegration, Report
from app.repositories.base import BaseRepository

class DashboardRepository(BaseRepository[Dashboard]):
    model = Dashboard
    searchable_columns = [Dashboard.name, Dashboard.description]
    async def get_all_filtered(self, *, search=None, is_shared=None, owner_id=None, current_user_id=None, sort_by=None, sort_order="desc", offset=0, limit=20) -> Sequence[Dashboard]:
        stmt = select(Dashboard)
        if is_shared is not None: stmt = stmt.where(Dashboard.is_shared == is_shared)
        if owner_id: stmt = stmt.where(Dashboard.owner_id == owner_id)
        if current_user_id: stmt = stmt.where((Dashboard.owner_id == current_user_id) | (Dashboard.is_shared == True))
        stmt = apply_search(stmt, search=search, columns=self.searchable_columns)
        stmt = apply_sorting(stmt, model=Dashboard, sort_by=sort_by, sort_order=sort_order)
        stmt = stmt.offset(offset).limit(limit)
        return (await self._db.execute(stmt)).scalars().all()
    async def count_filtered(self, *, search=None, is_shared=None, owner_id=None, current_user_id=None) -> int:
        stmt = select(func.count()).select_from(Dashboard)
        if is_shared is not None: stmt = stmt.where(Dashboard.is_shared == is_shared)
        if owner_id: stmt = stmt.where(Dashboard.owner_id == owner_id)
        if current_user_id: stmt = stmt.where((Dashboard.owner_id == current_user_id) | (Dashboard.is_shared == True))
        stmt = apply_search(stmt, search=search, columns=self.searchable_columns)
        return (await self._db.execute(stmt)).scalar_one()

class ReportRepository(BaseRepository[Report]):
    model = Report
    searchable_columns = [Report.name, Report.report_type]
    async def get_all_filtered(self, *, search=None, client_id=None, report_type=None, status=None, sort_by=None, sort_order="desc", offset=0, limit=20) -> Sequence[Report]:
        stmt = select(Report)
        if client_id: stmt = stmt.where(Report.client_id == client_id)
        if report_type: stmt = stmt.where(Report.report_type == report_type)
        if status: stmt = stmt.where(Report.status == status)
        stmt = apply_search(stmt, search=search, columns=self.searchable_columns)
        stmt = apply_sorting(stmt, model=Report, sort_by=sort_by, sort_order=sort_order)
        stmt = stmt.offset(offset).limit(limit)
        return (await self._db.execute(stmt)).scalars().all()
    async def count_filtered(self, *, search=None, client_id=None, report_type=None, status=None) -> int:
        stmt = select(func.count()).select_from(Report)
        if client_id: stmt = stmt.where(Report.client_id == client_id)
        if report_type: stmt = stmt.where(Report.report_type == report_type)
        if status: stmt = stmt.where(Report.status == status)
        stmt = apply_search(stmt, search=search, columns=self.searchable_columns)
        return (await self._db.execute(stmt)).scalar_one()

class DataIntegrationRepository(BaseRepository[DataIntegration]):
    model = DataIntegration
    async def get_all_filtered(self, *, client_id=None, provider_name=None, status=None, sort_by=None, sort_order="desc", offset=0, limit=20) -> Sequence[DataIntegration]:
        stmt = select(DataIntegration)
        if client_id: stmt = stmt.where(DataIntegration.client_id == client_id)
        if provider_name: stmt = stmt.where(DataIntegration.provider_name == provider_name)
        if status: stmt = stmt.where(DataIntegration.status == status)
        stmt = apply_sorting(stmt, model=DataIntegration, sort_by=sort_by, sort_order=sort_order)
        stmt = stmt.offset(offset).limit(limit)
        return (await self._db.execute(stmt)).scalars().all()
    async def count_filtered(self, *, client_id=None, provider_name=None, status=None) -> int:
        stmt = select(func.count()).select_from(DataIntegration)
        if client_id: stmt = stmt.where(DataIntegration.client_id == client_id)
        if provider_name: stmt = stmt.where(DataIntegration.provider_name == provider_name)
        if status: stmt = stmt.where(DataIntegration.status == status)
        return (await self._db.execute(stmt)).scalar_one()
