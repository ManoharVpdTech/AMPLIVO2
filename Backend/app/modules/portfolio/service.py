"""Service for the Portfolio module."""
from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.portfolio.models import PortfolioItem
from app.modules.portfolio.repository import PortfolioItemRepository
from app.modules.portfolio.schemas import PortfolioItemCreate, PortfolioItemUpdate
from app.core.exceptions import NotFoundException


class PortfolioItemService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._repo = PortfolioItemRepository(session)

    async def list_all(self, skip: int = 0, limit: int = 100) -> list[PortfolioItem]:
        return await self._repo.get_all(offset=skip, limit=limit)

    async def get(self, id: uuid.UUID) -> PortfolioItem:
        obj = await self._repo.get_by_id(id)
        if not obj:
            raise NotFoundException(detail="Portfolio item not found")
        return obj

    async def create(self, data: PortfolioItemCreate) -> PortfolioItem:
        return await self._repo.create_from_dict(data.model_dump())

    async def update(self, id: uuid.UUID, data: PortfolioItemUpdate) -> PortfolioItem:
        obj = await self._repo.get_by_id(id)
        if not obj:
            raise NotFoundException(detail="Portfolio item not found")
        await self._repo.update(obj.id, data.model_dump(exclude_unset=True))
        return await self._repo.get_by_id(id)

    async def delete(self, id: uuid.UUID) -> None:
        obj = await self._repo.get_by_id(id)
        if not obj:
            raise NotFoundException(detail="Portfolio item not found")
        await self._repo.delete(obj.id)
