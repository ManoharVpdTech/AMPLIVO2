"""Service for the Case Studies module."""
from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.case_studies.models import CaseStudy
from app.modules.case_studies.repository import CaseStudyRepository, CaseStudyMetricRepository
from app.modules.case_studies.schemas import CaseStudyCreate, CaseStudyUpdate
from app.core.exceptions import NotFoundException


class CaseStudyService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._repo = CaseStudyRepository(session)
        self._metric_repo = CaseStudyMetricRepository(session)

    async def list_all(self, skip: int = 0, limit: int = 100) -> list[CaseStudy]:
        return await self._repo.get_all_detailed(offset=skip, limit=limit)

    async def get(self, id: uuid.UUID) -> CaseStudy:
        obj = await self._repo.get_detail(id)
        if not obj:
            raise NotFoundException(detail="Case study not found")
        return obj

    async def create(self, data: CaseStudyCreate) -> CaseStudy:
        metrics_data = data.metrics
        obj_data = data.model_dump(exclude={"metrics"})
        obj = await self._repo.create_from_dict(obj_data)
        for m in metrics_data:
            await self._metric_repo.create_from_dict({**m.model_dump(), "case_study_id": obj.id})
        return await self._repo.get_detail(obj.id)

    async def update(self, id: uuid.UUID, data: CaseStudyUpdate) -> CaseStudy:
        obj = await self._repo.get_by_id(id)
        if not obj:
            raise NotFoundException(detail="Case study not found")
        await self._repo.update(obj.id, data.model_dump(exclude_unset=True))
        return await self._repo.get_detail(id)

    async def delete(self, id: uuid.UUID) -> None:
        obj = await self._repo.get_by_id(id)
        if not obj:
            raise NotFoundException(detail="Case study not found")
        await self._repo.delete(obj.id)
