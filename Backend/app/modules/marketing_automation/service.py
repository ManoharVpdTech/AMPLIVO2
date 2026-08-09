"""Service for the Marketing Automation module."""
from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.marketing_automation.models import AutomationWorkflow
from app.modules.marketing_automation.repository import AutomationWorkflowRepository, AutomationActionRepository, AutomationLogRepository
from app.modules.marketing_automation.schemas import AutomationWorkflowCreate, AutomationWorkflowUpdate
from app.core.exceptions import NotFoundException


class AutomationWorkflowService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._repo = AutomationWorkflowRepository(session)
        self._action_repo = AutomationActionRepository(session)
        self._log_repo = AutomationLogRepository(session)

    async def list_all(self, skip: int = 0, limit: int = 100) -> list[AutomationWorkflow]:
        return await self._repo.get_all(offset=skip, limit=limit)

    async def get(self, id: uuid.UUID) -> AutomationWorkflow:
        obj = await self._repo.get_detail(id)
        if not obj:
            raise NotFoundException(detail="Automation workflow not found")
        return obj

    async def create(self, data: AutomationWorkflowCreate) -> AutomationWorkflow:
        actions_data = data.actions
        obj_data = data.model_dump(exclude={"actions"})
        obj = await self._repo.create_from_dict(obj_data)
        for a in actions_data:
            await self._action_repo.create_from_dict({**a.model_dump(), "workflow_id": obj.id})
        return await self._repo.get_detail(obj.id)

    async def update(self, id: uuid.UUID, data: AutomationWorkflowUpdate) -> AutomationWorkflow:
        obj = await self._repo.get_by_id(id)
        if not obj:
            raise NotFoundException(detail="Automation workflow not found")
        await self._repo.update(obj.id, data.model_dump(exclude_unset=True))
        return await self._repo.get_detail(id)

    async def delete(self, id: uuid.UUID) -> None:
        obj = await self._repo.get_by_id(id)
        if not obj:
            raise NotFoundException(detail="Automation workflow not found")
        await self._repo.delete(obj.id)

    async def list_logs(self, workflow_id: uuid.UUID) -> list:
        return await self._log_repo.get_all()
