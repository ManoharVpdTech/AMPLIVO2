"""Routes for the FAQs module."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db
from app.dependencies.rbac import require_roles
from app.models.user import User
from app.modules.faqs.dependencies import get_faq_service
from app.modules.faqs.schemas import FaqCategoryCreate, FaqCategoryRead, FaqCreate, FaqRead, FaqUpdate
from app.modules.faqs.service import FaqService

router = APIRouter(prefix="/faqs", tags=["FAQs"])


# List/detail stay public - this is the marketing site's published content.
@router.get("", response_model=list[FaqRead])
async def list_faqs(skip: int = 0, limit: int = 100, service: FaqService = Depends(get_faq_service)):
    return await service.list_all(skip=skip, limit=limit)


@router.get("/{id}", response_model=FaqRead)
async def get_faq(id: uuid.UUID, service: FaqService = Depends(get_faq_service)):
    return await service.get(id)


@router.post("", response_model=FaqRead, status_code=status.HTTP_201_CREATED)
async def create_faq(data: FaqCreate, db: AsyncSession = Depends(get_db), service: FaqService = Depends(get_faq_service), _: User = Depends(get_current_user), _role: str = Depends(require_roles("marketing", "employee"))):
    result = await service.create(data)
    await db.commit()
    return result


@router.put("/{id}", response_model=FaqRead)
async def update_faq(id: uuid.UUID, data: FaqUpdate, db: AsyncSession = Depends(get_db), service: FaqService = Depends(get_faq_service), _: User = Depends(get_current_user), _role: str = Depends(require_roles("marketing", "employee"))):
    result = await service.update(id, data)
    await db.commit()
    return result


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_faq(id: uuid.UUID, db: AsyncSession = Depends(get_db), service: FaqService = Depends(get_faq_service), _: User = Depends(get_current_user), _role: str = Depends(require_roles("marketing", "employee"))):
    await service.delete(id)
    await db.commit()


@router.get("/categories/list", response_model=list[FaqCategoryRead])
async def list_faq_categories(service: FaqService = Depends(get_faq_service)):
    return await service.list_categories()


@router.post("/categories", response_model=FaqCategoryRead, status_code=status.HTTP_201_CREATED)
async def create_faq_category(data: FaqCategoryCreate, db: AsyncSession = Depends(get_db), service: FaqService = Depends(get_faq_service), _: User = Depends(get_current_user), _role: str = Depends(require_roles("marketing", "employee"))):
    result = await service.create_category(data)
    await db.commit()
    return result
