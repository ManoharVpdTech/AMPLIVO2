"""Repository for the FAQs module."""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.repositories.base import BaseRepository
from app.modules.faqs.models import Faq, FaqCategory


class FaqCategoryRepository(BaseRepository[FaqCategory]):
    model = FaqCategory

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)


class FaqRepository(BaseRepository[Faq]):
    model = Faq

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)

    async def get_detail(self, id: uuid.UUID) -> Faq | None:
        stmt = select(self.model).options(selectinload(self.model.category)).where(self.model.id == id)
        result = await self._db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_all_detailed(self, offset: int = 0, limit: int = 100) -> list[Faq]:
        from sqlalchemy import Sequence
        stmt = select(self.model).options(selectinload(self.model.category)).offset(offset).limit(limit)
        result = await self._db.execute(stmt)
        return list(result.scalars().all())
