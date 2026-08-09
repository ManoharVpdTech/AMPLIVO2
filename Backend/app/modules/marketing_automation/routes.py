"""Routes for the Marketing Automation module.

Internal ops tooling (email/campaign automation workflows), not published
site content - every route requires an authenticated `marketing`/`admin`
user. This module previously had zero authentication on any route at all.
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db
from app.dependencies.rbac import require_roles
from app.models.user import User
from app.modules.marketing_automation.dependencies import get_automation_service
from app.modules.marketing_automation.schemas import AutomationWorkflowCreate, AutomationWorkflowRead, AutomationWorkflowUpdate
from app.modules.marketing_automation.service import AutomationWorkflowService

router = APIRouter(prefix="/automation", tags=["Marketing Automation"])


@router.get("", response_model=list[AutomationWorkflowRead])
async def list_workflows(skip: int = 0, limit: int = 100, service: AutomationWorkflowService = Depends(get_automation_service), _: User = Depends(get_current_user), _role: str = Depends(require_roles("marketing", "employee"))):
    return await service.list_all(skip=skip, limit=limit)


@router.get("/{id}", response_model=AutomationWorkflowRead)
async def get_workflow(id: uuid.UUID, service: AutomationWorkflowService = Depends(get_automation_service), _: User = Depends(get_current_user), _role: str = Depends(require_roles("marketing", "employee"))):
    return await service.get(id)


@router.post("", response_model=AutomationWorkflowRead, status_code=status.HTTP_201_CREATED)
async def create_workflow(data: AutomationWorkflowCreate, db: AsyncSession = Depends(get_db), service: AutomationWorkflowService = Depends(get_automation_service), _: User = Depends(get_current_user), _role: str = Depends(require_roles("marketing", "employee"))):
    result = await service.create(data)
    await db.commit()
    return result


@router.put("/{id}", response_model=AutomationWorkflowRead)
async def update_workflow(id: uuid.UUID, data: AutomationWorkflowUpdate, db: AsyncSession = Depends(get_db), service: AutomationWorkflowService = Depends(get_automation_service), _: User = Depends(get_current_user), _role: str = Depends(require_roles("marketing", "employee"))):
    result = await service.update(id, data)
    await db.commit()
    return result


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workflow(id: uuid.UUID, db: AsyncSession = Depends(get_db), service: AutomationWorkflowService = Depends(get_automation_service), _: User = Depends(get_current_user), _role: str = Depends(require_roles("marketing", "employee"))):
    await service.delete(id)
    await db.commit()
