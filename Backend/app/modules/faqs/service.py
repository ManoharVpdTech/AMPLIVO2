"""Service for the FAQs module."""
from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.faqs.models import Faq
from app.modules.faqs.repository import FaqRepository, FaqCategoryRepository
from app.modules.faqs.schemas import FaqCreate, FaqUpdate, FaqCategoryCreate
from app.modules.faqs.models import FaqCategory
from app.core.exceptions import NotFoundException


class FaqService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._repo = FaqRepository(session)
        self._cat_repo = FaqCategoryRepository(session)

    async def list_categories(self) -> list[FaqCategory]:
        return await self._cat_repo.get_all()

    async def create_category(self, data: FaqCategoryCreate) -> FaqCategory:
        return await self._cat_repo.create_from_dict(data.model_dump())

    async def list_all(self, skip: int = 0, limit: int = 100) -> list[Faq]:
        return await self._repo.get_all(offset=skip, limit=limit)

    async def get(self, id: uuid.UUID) -> Faq:
        obj = await self._repo.get_detail(id)
        if not obj:
            raise NotFoundException(detail="FAQ not found")
        return obj

    async def create(self, data: FaqCreate) -> Faq:
        return await self._repo.create_from_dict(data.model_dump())

    async def update(self, id: uuid.UUID, data: FaqUpdate) -> Faq:
        obj = await self._repo.get_by_id(id)
        if not obj:
            raise NotFoundException(detail="FAQ not found")
        await self._repo.update(obj.id, data.model_dump(exclude_unset=True))
        return await self._repo.get_detail(id)

    async def delete(self, id: uuid.UUID) -> None:
        obj = await self._repo.get_by_id(id)
        if not obj:
            raise NotFoundException(detail="FAQ not found")
        await self._repo.delete(obj.id)
