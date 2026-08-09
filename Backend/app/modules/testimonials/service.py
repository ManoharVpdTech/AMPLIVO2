"""Service for the Testimonials module."""
from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.testimonials.models import Testimonial
from app.modules.testimonials.repository import TestimonialRepository
from app.modules.testimonials.schemas import TestimonialCreate, TestimonialUpdate
from app.core.exceptions import NotFoundException


class TestimonialService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._repo = TestimonialRepository(session)

    async def list_all(self, skip: int = 0, limit: int = 100) -> list[Testimonial]:
        return await self._repo.get_all(offset=skip, limit=limit)

    async def get(self, id: uuid.UUID) -> Testimonial:
        obj = await self._repo.get_by_id(id)
        if not obj:
            raise NotFoundException(detail="Testimonial not found")
        return obj

    async def create(self, data: TestimonialCreate) -> Testimonial:
        return await self._repo.create_from_dict(data.model_dump())

    async def update(self, id: uuid.UUID, data: TestimonialUpdate) -> Testimonial:
        obj = await self._repo.get_by_id(id)
        if not obj:
            raise NotFoundException(detail="Testimonial not found")
        await self._repo.update(obj.id, data.model_dump(exclude_unset=True))
        return await self._repo.get_by_id(id)

    async def delete(self, id: uuid.UUID) -> None:
        obj = await self._repo.get_by_id(id)
        if not obj:
            raise NotFoundException(detail="Testimonial not found")
        await self._repo.delete(obj.id)
