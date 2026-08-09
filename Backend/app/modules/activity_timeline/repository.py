"""Repository for the Activity Timeline module."""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.base import BaseRepository
from app.modules.activity_timeline.models import ActivityLog


class ActivityLogRepository(BaseRepository[ActivityLog]):
    model = ActivityLog

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)

    async def get_all_filtered(self, *, entity_type: str | None = None, entity_id: uuid.UUID | None = None,
                               user_id: uuid.UUID | None = None,
                               offset: int = 0, limit: int = 100) -> list[ActivityLog]:
        stmt = select(ActivityLog)
        if entity_type: stmt = stmt.where(ActivityLog.entity_type == entity_type)
        if entity_id: stmt = stmt.where(ActivityLog.entity_id == entity_id)
        # BAC-1: a 'client'-role caller only sees rows recorded for their own
        # user account. Staff pass user_id=None and remain unrestricted.
        if user_id is not None: stmt = stmt.where(ActivityLog.user_id == user_id)
        stmt = stmt.order_by(ActivityLog.created_at.desc()).offset(offset).limit(limit)
        return (await self._db.execute(stmt)).scalars().all()

    async def get_by_id_scoped(self, id: uuid.UUID, *, user_id: uuid.UUID | None = None) -> ActivityLog | None:
        stmt = select(ActivityLog).where(ActivityLog.id == id)
        if user_id is not None:
            stmt = stmt.where(ActivityLog.user_id == user_id)
        return (await self._db.execute(stmt)).scalar_one_or_none()
