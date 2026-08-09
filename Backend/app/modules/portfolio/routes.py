"""Routes for the Portfolio module."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db
from app.dependencies.rbac import require_roles
from app.models.user import User
from app.modules.portfolio.dependencies import get_portfolio_service
from app.modules.portfolio.schemas import PortfolioItemCreate, PortfolioItemRead, PortfolioItemUpdate
from app.modules.portfolio.service import PortfolioItemService

router = APIRouter(prefix="/portfolio", tags=["Portfolio"])


# List/detail stay public - this is the marketing site's published content.
@router.get("", response_model=list[PortfolioItemRead])
async def list_portfolio(skip: int = 0, limit: int = 100, service: PortfolioItemService = Depends(get_portfolio_service)):
    return await service.list_all(skip=skip, limit=limit)


@router.get("/{id}", response_model=PortfolioItemRead)
async def get_portfolio_item(id: uuid.UUID, service: PortfolioItemService = Depends(get_portfolio_service)):
    return await service.get(id)


@router.post("", response_model=PortfolioItemRead, status_code=status.HTTP_201_CREATED)
async def create_portfolio_item(data: PortfolioItemCreate, db: AsyncSession = Depends(get_db), service: PortfolioItemService = Depends(get_portfolio_service), _: User = Depends(get_current_user), _role: str = Depends(require_roles("marketing", "employee"))):
    result = await service.create(data)
    await db.commit()
    return result


@router.put("/{id}", response_model=PortfolioItemRead)
async def update_portfolio_item(id: uuid.UUID, data: PortfolioItemUpdate, db: AsyncSession = Depends(get_db), service: PortfolioItemService = Depends(get_portfolio_service), _: User = Depends(get_current_user), _role: str = Depends(require_roles("marketing", "employee"))):
    result = await service.update(id, data)
    await db.commit()
    return result


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_portfolio_item(id: uuid.UUID, db: AsyncSession = Depends(get_db), service: PortfolioItemService = Depends(get_portfolio_service), _: User = Depends(get_current_user), _role: str = Depends(require_roles("marketing", "employee"))):
    await service.delete(id)
    await db.commit()
