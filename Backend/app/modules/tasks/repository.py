"""Repository layer for Tasks."""
from __future__ import annotations
import uuid
from typing import Sequence
from sqlalchemy import func, select, text
from sqlalchemy.orm import selectinload
from app.core.filters import apply_search, apply_sorting
from app.modules.tasks.models import Project, ProjectMember, Task, TaskAttachment, TaskComment, TaskSubmission
from app.repositories.base import BaseRepository

class ProjectRepository(BaseRepository[Project]):
    model = Project
    searchable_columns = [Project.name, Project.description]
    async def get_detail(self, project_id: uuid.UUID) -> Project | None:
        stmt = select(Project).options(selectinload(Project.tasks)).where(Project.id == project_id)
        result = await self._db.execute(stmt)
        return result.scalar_one_or_none()
    async def get_all_filtered(self, *, search=None, client_id=None, status=None, manager_id=None, sort_by=None, sort_order="desc", offset=0, limit=20) -> Sequence[Project]:
        stmt = select(Project)
        if client_id: stmt = stmt.where(Project.client_id == client_id)
        if status: stmt = stmt.where(Project.status == status)
        if manager_id: stmt = stmt.where(Project.manager_id == manager_id)
        stmt = apply_search(stmt, search=search, columns=self.searchable_columns)
        stmt = apply_sorting(stmt, model=Project, sort_by=sort_by, sort_order=sort_order)
        stmt = stmt.offset(offset).limit(limit)
        return (await self._db.execute(stmt)).scalars().all()
    async def count_filtered(self, *, search=None, client_id=None, status=None, manager_id=None) -> int:
        stmt = select(func.count()).select_from(Project)
        if client_id: stmt = stmt.where(Project.client_id == client_id)
        if status: stmt = stmt.where(Project.status == status)
        if manager_id: stmt = stmt.where(Project.manager_id == manager_id)
        stmt = apply_search(stmt, search=search, columns=self.searchable_columns)
        return (await self._db.execute(stmt)).scalar_one()

class TaskRepository(BaseRepository[Task]):
    model = Task
    searchable_columns = [Task.title, Task.description]
    async def next_task_number(self) -> str:
        """Explicit sequence pull instead of relying on the column's
        server_default (migration 0018) being applied implicitly - avoids a
        NOT NULL violation on task_number when the ORM includes an unset
        attribute as a bound NULL rather than omitting it from the INSERT.
        Uses Postgres' nextval where the backing database exposes it, and a
        portable count-based fallback elsewhere (SQLite/dev/testing)."""
        dialect = self._db.get_bind().dialect.name
        if dialect == "postgresql":
            result = await self._db.execute(text("SELECT nextval('tasks_task_number_seq')"))
            return f"TASK-{result.scalar_one():04d}"
        current = (await self._db.execute(select(func.count()).select_from(Task))).scalar_one()
        return f"TASK-{current + 1:04d}"
    async def get_detail(self, task_id: uuid.UUID) -> Task | None:
        stmt = select(Task).options(selectinload(Task.comments), selectinload(Task.attachments)).where(Task.id == task_id)
        result = await self._db.execute(stmt)
        return result.scalar_one_or_none()
    async def get_all_filtered(self, *, search=None, project_id=None, project_ids=None, status=None, priority=None, assigned_to=None, sort_by=None, sort_order="desc", offset=0, limit=20) -> Sequence[Task]:
        stmt = select(Task)
        if project_id: stmt = stmt.where(Task.project_id == project_id)
        if project_ids is not None: stmt = stmt.where(Task.project_id.in_(project_ids))
        if status: stmt = stmt.where(Task.status == status)
        if priority: stmt = stmt.where(Task.priority == priority)
        if assigned_to: stmt = stmt.where(Task.assigned_to == assigned_to)
        stmt = apply_search(stmt, search=search, columns=self.searchable_columns)
        stmt = apply_sorting(stmt, model=Task, sort_by=sort_by, sort_order=sort_order)
        stmt = stmt.offset(offset).limit(limit)
        return (await self._db.execute(stmt)).scalars().all()
    async def count_filtered(self, *, search=None, project_id=None, project_ids=None, status=None, priority=None, assigned_to=None) -> int:
        stmt = select(func.count()).select_from(Task)
        if project_id: stmt = stmt.where(Task.project_id == project_id)
        if project_ids is not None: stmt = stmt.where(Task.project_id.in_(project_ids))
        if status: stmt = stmt.where(Task.status == status)
        if priority: stmt = stmt.where(Task.priority == priority)
        if assigned_to: stmt = stmt.where(Task.assigned_to == assigned_to)
        stmt = apply_search(stmt, search=search, columns=self.searchable_columns)
        return (await self._db.execute(stmt)).scalar_one()

class ProjectMemberRepository(BaseRepository[ProjectMember]):
    model = ProjectMember
    async def list_by_project(self, project_id: uuid.UUID) -> Sequence[ProjectMember]:
        r = await self._db.execute(select(ProjectMember).where(ProjectMember.project_id == project_id).order_by(ProjectMember.assigned_at))
        return r.scalars().all()
    async def list_ids_by_projects(self, project_ids: Sequence[uuid.UUID]) -> dict[uuid.UUID, list[uuid.UUID]]:
        """Map each project id to its list of assigned user ids, in one query."""
        if not project_ids:
            return {}
        r = await self._db.execute(
            select(ProjectMember.project_id, ProjectMember.user_id)
            .where(ProjectMember.project_id.in_(project_ids))
            .order_by(ProjectMember.assigned_at)
        )
        member_map: dict[uuid.UUID, list[uuid.UUID]] = {pid: [] for pid in project_ids}
        for project_id, user_id in r.all():
            member_map[project_id].append(user_id)
        return member_map
    async def get_by_project_and_user(self, project_id: uuid.UUID, user_id: uuid.UUID) -> ProjectMember | None:
        r = await self._db.execute(
            select(ProjectMember).where(ProjectMember.project_id == project_id, ProjectMember.user_id == user_id)
        )
        return r.scalar_one_or_none()
    async def delete_by_project_and_user(self, project_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        member = await self.get_by_project_and_user(project_id, user_id)
        if member is None:
            return False
        await self._db.delete(member)
        await self._db.flush()
        return True

class TaskCommentRepository(BaseRepository[TaskComment]):
    model = TaskComment
    async def list_by_task(self, task_id: uuid.UUID) -> Sequence[TaskComment]:
        r = await self._db.execute(select(TaskComment).where(TaskComment.task_id == task_id).order_by(TaskComment.created_at))
        return r.scalars().all()

class TaskAttachmentRepository(BaseRepository[TaskAttachment]):
    model = TaskAttachment
    async def list_by_task(self, task_id: uuid.UUID) -> Sequence[TaskAttachment]:
        r = await self._db.execute(select(TaskAttachment).where(TaskAttachment.task_id == task_id).order_by(TaskAttachment.created_at.desc()))
        return r.scalars().all()

class TaskSubmissionRepository(BaseRepository[TaskSubmission]):
    model = TaskSubmission
    async def list_by_task(self, task_id: uuid.UUID) -> Sequence[TaskSubmission]:
        r = await self._db.execute(select(TaskSubmission).where(TaskSubmission.task_id == task_id).order_by(TaskSubmission.created_at.desc()))
        return r.scalars().all()
    async def list_by_submitter(self, submitted_by: uuid.UUID) -> Sequence[TaskSubmission]:
        r = await self._db.execute(select(TaskSubmission).where(TaskSubmission.submitted_by == submitted_by).order_by(TaskSubmission.created_at.desc()))
        return r.scalars().all()
    async def list_all_filtered(self, *, status=None, offset=0, limit=20) -> Sequence[TaskSubmission]:
        """Cross-task submission feed for the CRM review queue - unlike
        list_by_task, this isn't scoped to a single task the caller already
        knows about."""
        stmt = select(TaskSubmission).options(selectinload(TaskSubmission.task).selectinload(Task.project))
        if status: stmt = stmt.where(TaskSubmission.status == status)
        stmt = stmt.order_by(TaskSubmission.created_at.desc()).offset(offset).limit(limit)
        return (await self._db.execute(stmt)).scalars().all()
    async def count_all_filtered(self, *, status=None) -> int:
        stmt = select(func.count()).select_from(TaskSubmission)
        if status: stmt = stmt.where(TaskSubmission.status == status)
        return (await self._db.execute(stmt)).scalar_one()
