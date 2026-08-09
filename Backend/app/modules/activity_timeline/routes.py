"""Routes for the Activity Timeline module."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db
from app.dependencies.rbac import require_roles
from app.dependencies.tenant import get_current_client_id
from app.models.user import User
from app.modules.activity_timeline.dependencies import get_activity_log_service
from app.modules.activity_timeline.schemas import ActivityLogCreate, ActivityLogRead
from app.modules.activity_timeline.service import ActivityLogService

router = APIRouter(prefix="/activity-logs", tags=["Activity Timeline"])


@router.get("", response_model=list[ActivityLogRead])
async def list_logs(
    skip: int = 0, limit: int = 100,
    entity_type: str | None = None, entity_id: uuid.UUID | None = None,
    service: ActivityLogService = Depends(get_activity_log_service),
    _: User = Depends(get_current_user),
    scoped_client_id: uuid.UUID | None = Depends(get_current_client_id),
    current_user: User = Depends(get_current_user),
):
    # BAC-1: for 'client'-role users, scoped_client_id is their own clients.id
    # and we narrow the listing to activity rows recorded for their own user
    # account. Staff (scoped_client_id is None) keep full visibility.
    user_scope = current_user.id if scoped_client_id is not None else None
    return await service.list_all(
        skip=skip, limit=limit, entity_type=entity_type, entity_id=entity_id,
        user_id=user_scope,
    )


@router.get("/{id}", response_model=ActivityLogRead)
async def get_log(
    id: uuid.UUID,
    service: ActivityLogService = Depends(get_activity_log_service),
    _: User = Depends(get_current_user),
    scoped_client_id: uuid.UUID | None = Depends(get_current_client_id),
    current_user: User = Depends(get_current_user),
):
    return await service.get(
        id,
        user_id=current_user.id if scoped_client_id is not None else None,
    )


@router.post("", response_model=ActivityLogRead, status_code=status.HTTP_201_CREATED)
async def create_log(data: ActivityLogCreate, db: AsyncSession = Depends(get_db), service: ActivityLogService = Depends(get_activity_log_service), _: User = Depends(get_current_user), _admin: str = Depends(require_roles("admin"))):
    log = await service.create(data)
    await db.commit()
    return log


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_log(id: uuid.UUID, db: AsyncSession = Depends(get_db), service: ActivityLogService = Depends(get_activity_log_service), _: User = Depends(get_current_user), _admin: str = Depends(require_roles("admin"))):
    await service.delete(id)
    await db.commit()
