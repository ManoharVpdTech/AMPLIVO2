"""Service for the Activity Timeline module."""
from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.activity_timeline.models import ActivityLog
from app.modules.activity_timeline.repository import ActivityLogRepository
from app.modules.activity_timeline.schemas import ActivityLogCreate
from app.core.exceptions import NotFoundException


class ActivityLogService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._repo = ActivityLogRepository(session)

    async def list_all(self, skip: int = 0, limit: int = 100, *, entity_type: str | None = None, entity_id: uuid.UUID | None = None, user_id: uuid.UUID | None = None) -> list[ActivityLog]:
        # BAC-1: user_id scopes a 'client'-role caller to their own records.
        if entity_type or entity_id or user_id is not None:
            return await self._repo.get_all_filtered(entity_type=entity_type, entity_id=entity_id, user_id=user_id, offset=skip, limit=limit)
        return await self._repo.get_all(offset=skip, limit=limit)

    async def get(self, id: uuid.UUID, *, user_id: uuid.UUID | None = None) -> ActivityLog:
        # BAC-1: single-row read is scoped the same way for client-role users.
        obj = await self._repo.get_by_id_scoped(id, user_id=user_id)
        if not obj:
            raise NotFoundException("ActivityLog")
        return obj

    async def create(self, data: ActivityLogCreate) -> ActivityLog:
        return await self._repo.create_from_dict(data.model_dump())

    async def delete(self, id: uuid.UUID) -> None:
        if not await self._repo.delete(id):
            raise NotFoundException("ActivityLog")
