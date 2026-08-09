"""Service for the Timesheets module."""
from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.timesheets.models import Timesheet
from app.modules.timesheets.repository import TimesheetRepository
from app.modules.timesheets.schemas import TimesheetCreate, TimesheetUpdate
from app.core.exceptions import NotFoundException


class TimesheetService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._repo = TimesheetRepository(session)

    async def list_all(self, skip: int = 0, limit: int = 100) -> list[Timesheet]:
        return await self._repo.get_all(offset=skip, limit=limit)

    async def get(self, id: uuid.UUID) -> Timesheet:
        obj = await self._repo.get_by_id(id)
        if not obj:
            raise NotFoundException(detail="Timesheet not found")
        return obj

    async def create(self, data: TimesheetCreate) -> Timesheet:
        return await self._repo.create_from_dict(data.model_dump())

    async def update(self, id: uuid.UUID, data: TimesheetUpdate) -> Timesheet:
        obj = await self._repo.get_by_id(id)
        if not obj:
            raise NotFoundException(detail="Timesheet not found")
        updated_obj = await self._repo.update(obj.id, data.model_dump(exclude_unset=True))
        return updated_obj

    async def delete(self, id: uuid.UUID) -> None:
        obj = await self._repo.get_by_id(id)
        if not obj:
            raise NotFoundException(detail="Timesheet not found")
        await self._repo.delete(obj.id)
