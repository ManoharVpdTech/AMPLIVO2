"""Service layer for Tasks."""
from __future__ import annotations
import uuid
from datetime import datetime, timedelta, timezone
from typing import Sequence
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.exceptions import BadRequestException, NotFoundException
from app.core.tenant_scope import enforce_client_scope
from app.modules.tasks.models import Project, ProjectMember, Task, TaskAttachment, TaskComment, TaskSubmission
from app.modules.tasks.repository import (
    ProjectMemberRepository, ProjectRepository, TaskAttachmentRepository, TaskCommentRepository, TaskRepository, TaskSubmissionRepository,
)
from app.utils.sales_events import log_activity, notify_role, notify_users

class ProjectService:
    def __init__(self, repo: ProjectRepository, db: AsyncSession | None = None) -> None:
        self._repo = repo
        self._db = db or repo._db
    async def list_projects(self, *, search=None, client_id=None, status=None, manager_id=None, sort_by=None, sort_order="desc", offset=0, limit=20):
        items = await self._repo.get_all_filtered(search=search, client_id=client_id, status=status, manager_id=manager_id, sort_by=sort_by, sort_order=sort_order, offset=offset, limit=limit)
        total = await self._repo.count_filtered(search=search, client_id=client_id, status=status, manager_id=manager_id)
        return items, total
    async def get_project(self, project_id: uuid.UUID, *, scoped_client_id: uuid.UUID | None = None) -> Project:
        p = await self._repo.get_detail(project_id)
        if p is None: raise NotFoundException("Project")
        enforce_client_scope(p.client_id, scoped_client_id)
        return p
    async def create_project(self, data: dict) -> Project:
        return await self._repo.create_from_dict(data)
    async def update_project(self, project_id: uuid.UUID, data: dict, *, scoped_client_id: uuid.UUID | None = None) -> Project:
        await self.get_project(project_id, scoped_client_id=scoped_client_id)
        updated = await self._repo.update(project_id, data)
        if updated is None: raise NotFoundException("Project")
        return updated
    async def delete_project(self, project_id: uuid.UUID, *, scoped_client_id: uuid.UUID | None = None) -> None:
        await self.get_project(project_id, scoped_client_id=scoped_client_id)
        if not await self._repo.delete(project_id): raise NotFoundException("Project")

    async def complete_project(self, project_id: uuid.UUID, *, actor_id: uuid.UUID | None) -> Project:
        """Final step of the whole workflow - marks the project done and
        writes PROJECT_COMPLETED back onto its originating lead (via
        converted_project_id) for Sales/CRM closed-won reporting. Previously
        there was no archive/completion concept at all (Project.status
        stayed whatever free-text value it already had, forever)."""
        from app.modules.leads.repository import LeadRepository
        from app.core import lead_pipeline
        from app.utils.time import utc_now

        project = await self.get_project(project_id)
        project.status = "completed"
        project.completed_at = utc_now()
        await self._db.flush()
        await self._db.refresh(project)

        lead = await LeadRepository(self._db).find_by_converted_project(project_id)
        if lead is not None:
            lead.status = lead_pipeline.PROJECT_COMPLETED
            await self._db.flush()

        await log_activity(
            self._db, user_id=actor_id, entity_type="project", entity_id=project_id,
            action="project_completed", description=f"Project '{project.name}' marked completed.",
        )
        await notify_role(self._db, "admin", title="Project completed", message=f"Project '{project.name}' has been marked completed.")
        return project

class ProjectMemberService:
    def __init__(self, repo: ProjectMemberRepository, project_repo: ProjectRepository, db: AsyncSession) -> None:
        self._repo = repo
        self._project_repo = project_repo
        self._db = db
    async def list_members(self, project_id: uuid.UUID) -> Sequence[ProjectMember]:
        return await self._repo.list_by_project(project_id)
    async def list_member_ids_map(self, project_ids: Sequence[uuid.UUID]) -> dict[uuid.UUID, list[uuid.UUID]]:
        return await self._repo.list_ids_by_projects(project_ids)
    async def add_member(self, project_id: uuid.UUID, user_id: uuid.UUID, *, actor_id: uuid.UUID | None) -> ProjectMember:
        project = await self._project_repo.get_by_id(project_id)
        if project is None: raise NotFoundException("Project")
        existing = await self._repo.get_by_project_and_user(project_id, user_id)
        if existing is not None:
            raise BadRequestException("This user is already assigned to the project.")
        member = await self._repo.create_from_dict({"project_id": project_id, "user_id": user_id})
        await notify_users(
            self._db, [user_id],
            title="Added to project", message=f"You have been added to the project '{project.name}'.",
        )
        await log_activity(
            self._db, user_id=actor_id, entity_type="project", entity_id=project_id,
            action="member_added", description=f"Added a team member to project '{project.name}'.",
        )
        return member
    async def remove_member(self, project_id: uuid.UUID, user_id: uuid.UUID, *, actor_id: uuid.UUID | None) -> None:
        project = await self._project_repo.get_by_id(project_id)
        if project is None: raise NotFoundException("Project")
        if not await self._repo.delete_by_project_and_user(project_id, user_id):
            raise NotFoundException("ProjectMember")
        await log_activity(
            self._db, user_id=actor_id, entity_type="project", entity_id=project_id,
            action="member_removed", description=f"Removed a team member from project '{project.name}'.",
        )

class TaskService:
    def __init__(self, repo: TaskRepository, db: AsyncSession | None = None) -> None:
        self._repo = repo
        self._db = db or repo._db
    async def list_tasks(self, *, search=None, project_id=None, project_ids=None, status=None, priority=None, assigned_to=None, sort_by=None, sort_order="desc", offset=0, limit=20):
        items = await self._repo.get_all_filtered(search=search, project_id=project_id, project_ids=project_ids, status=status, priority=priority, assigned_to=assigned_to, sort_by=sort_by, sort_order=sort_order, offset=offset, limit=limit)
        total = await self._repo.count_filtered(search=search, project_id=project_id, project_ids=project_ids, status=status, priority=priority, assigned_to=assigned_to)
        return items, total
    async def get_task(self, task_id: uuid.UUID) -> Task:
        t = await self._repo.get_detail(task_id)
        if t is None: raise NotFoundException("Task")
        return t
    async def create_task(self, data: dict, created_by: uuid.UUID | None = None) -> Task:
        data["created_by"] = created_by
        data["task_number"] = await self._repo.next_task_number()
        task = await self._repo.create_from_dict(data)
        if task.assigned_to:
            await notify_users(
                self._db, [task.assigned_to],
                title="New task assigned", message=f"You have been assigned the task '{task.title}'.",
            )
            await log_activity(
                self._db, user_id=created_by, entity_type="task", entity_id=task.id,
                action="task_assigned", description=f"Task '{task.title}' assigned.",
            )
        return task
    async def update_task(self, task_id: uuid.UUID, data: dict, *, actor_id: uuid.UUID | None = None) -> Task:
        existing = await self.get_task(task_id)
        old_assigned_to = existing.assigned_to
        old_status = existing.status
        updated = await self._repo.update(task_id, data)
        if updated is None: raise NotFoundException("Task")
        new_assigned_to = data.get("assigned_to", old_assigned_to)
        if "assigned_to" in data and new_assigned_to and new_assigned_to != old_assigned_to:
            await notify_users(
                self._db, [new_assigned_to],
                title="Task assigned to you", message=f"You have been assigned the task '{updated.title}'.",
            )
            await log_activity(
                self._db, user_id=actor_id, entity_type="task", entity_id=updated.id,
                action="task_reassigned", description=f"Task '{updated.title}' reassigned.",
            )
        new_status = data.get("status")
        if new_status and new_status != old_status:
            await log_activity(
                self._db, user_id=actor_id, entity_type="task", entity_id=updated.id,
                action="status_changed", description=f"Task '{updated.title}' status changed from '{old_status}' to '{new_status}'.",
            )
        return updated
    async def delete_task(self, task_id: uuid.UUID) -> None:
        if not await self._repo.delete(task_id): raise NotFoundException("Task")

class TaskCommentService:
    def __init__(self, repo: TaskCommentRepository) -> None:
        self._repo = repo
    async def list_comments(self, task_id: uuid.UUID) -> Sequence[TaskComment]:
        return await self._repo.list_by_task(task_id)
    async def create_comment(self, task_id: uuid.UUID, data: dict, user_id: uuid.UUID | None = None) -> TaskComment:
        data["task_id"] = task_id; data["user_id"] = user_id
        return await self._repo.create_from_dict(data)
    async def update_comment(self, comment_id: uuid.UUID, data: dict) -> TaskComment:
        updated = await self._repo.update(comment_id, data)
        if updated is None: raise NotFoundException("TaskComment")
        return updated
    async def delete_comment(self, comment_id: uuid.UUID) -> None:
        if not await self._repo.delete(comment_id): raise NotFoundException("TaskComment")

class TaskAttachmentService:
    def __init__(self, repo: TaskAttachmentRepository) -> None:
        self._repo = repo
    async def list_attachments(self, task_id: uuid.UUID) -> Sequence[TaskAttachment]:
        return await self._repo.list_by_task(task_id)
    async def create_attachment(self, task_id: uuid.UUID, data: dict, uploaded_by: uuid.UUID | None = None) -> TaskAttachment:
        data["task_id"] = task_id; data["uploaded_by"] = uploaded_by
        return await self._repo.create_from_dict(data)
    async def delete_attachment(self, attachment_id: uuid.UUID) -> None:
        if not await self._repo.delete(attachment_id): raise NotFoundException("TaskAttachment")

class TaskSubmissionService:
    def __init__(self, repo: TaskSubmissionRepository, task_repo: TaskRepository, db: AsyncSession) -> None:
        self._repo = repo
        self._task_repo = task_repo
        self._db = db
    async def list_by_task(self, task_id: uuid.UUID) -> Sequence[TaskSubmission]:
        return await self._repo.list_by_task(task_id)
    async def list_queue(self, *, status: str | None = None, offset: int = 0, limit: int = 20) -> tuple[list[dict], int]:
        """CRM review queue feed: every submission across all tasks/employees,
        enriched with the task/project/submitter context a reviewer needs
        without a round trip per row. Previously nothing in the app fetched
        submissions outside a single already-known task, so the CRM side had
        no way to even list what was waiting on it."""
        from app.models.user import User
        from sqlalchemy import select as sa_select

        items = await self._repo.list_all_filtered(status=status, offset=offset, limit=limit)
        total = await self._repo.count_all_filtered(status=status)

        submitter_ids = {s.submitted_by for s in items if s.submitted_by}
        names: dict[uuid.UUID, str] = {}
        if submitter_ids:
            result = await self._db.execute(sa_select(User.id, User.full_name).where(User.id.in_(submitter_ids)))
            names = {uid: full_name for uid, full_name in result.all()}

        enriched = [
            {
                "submission": s,
                "task_title": s.task.title if s.task else "",
                "task_number": s.task.task_number if s.task else "",
                "project_id": s.task.project_id if s.task else None,
                "project_name": s.task.project.name if s.task and s.task.project else None,
                "submitted_by_name": names.get(s.submitted_by) if s.submitted_by else None,
            }
            for s in items
        ]
        return enriched, total
    async def get(self, submission_id: uuid.UUID) -> TaskSubmission:
        s = await self._repo.get_by_id(submission_id)
        if s is None: raise NotFoundException("TaskSubmission")
        return s
    async def create(self, task_id: uuid.UUID, data: dict, *, submitted_by: uuid.UUID | None) -> TaskSubmission:
        task = await self._task_repo.get_by_id(task_id)
        if task is None: raise NotFoundException("Task")
        data["task_id"] = task_id
        data["submitted_by"] = submitted_by
        submission = await self._repo.create_from_dict(data)
        await self._task_repo.update(task_id, {"status": "submitted", "progress": data.get("completion_percentage", 100)})
        await log_activity(
            self._db, user_id=submitted_by, entity_type="task", entity_id=task_id,
            action="work_submitted", description=f"Work submitted for task '{task.title}'.",
        )
        for role_slug in ("admin", "crm"):
            await notify_role(self._db, role_slug, title="Task submitted for review", message=f"Work submitted for task '{task.title}'.")
        return submission
    async def resubmit(self, submission_id: uuid.UUID, data: dict, *, submitted_by: uuid.UUID | None) -> TaskSubmission:
        existing = await self.get(submission_id)
        data["status"] = "pending_review"
        data["version_number"] = existing.version_number + 1
        data["reviewer_feedback"] = None
        updated = await self._repo.update(submission_id, data)
        task = await self._task_repo.get_by_id(existing.task_id)
        if task is not None:
            await self._task_repo.update(existing.task_id, {"status": "submitted"})
        await log_activity(
            self._db, user_id=submitted_by, entity_type="task", entity_id=existing.task_id,
            action="work_resubmitted", description=f"Work resubmitted (v{updated.version_number}) for task '{task.title if task else ''}'.",
        )
        for role_slug in ("admin", "crm"):
            await notify_role(self._db, role_slug, title="Task resubmitted for review", message=f"Work resubmitted for task '{task.title if task else ''}'.")
        return updated
    async def review(self, submission_id: uuid.UUID, *, approve: bool, reviewer_feedback: str | None, reviewer_id: uuid.UUID | None) -> TaskSubmission:
        existing = await self.get(submission_id)
        new_status = "approved" if approve else "changes_requested"
        updated = await self._repo.update(submission_id, {
            "status": new_status, "reviewer_feedback": reviewer_feedback,
            "reviewed_by": reviewer_id, "reviewed_at": datetime.now(timezone.utc),
        })
        task = await self._task_repo.get_by_id(existing.task_id)
        if task is not None and approve:
            await self._task_repo.update(existing.task_id, {"status": "completed", "progress": 100})
        await log_activity(
            self._db, user_id=reviewer_id, entity_type="task", entity_id=existing.task_id,
            action="submission_reviewed", description=f"Submission for task '{task.title if task else ''}' marked '{new_status}'.",
        )
        if existing.submitted_by:
            await notify_users(
                self._db, [existing.submitted_by],
                title="Your submission was reviewed",
                message=f"Your submission for '{task.title if task else 'a task'}' was {'approved' if approve else 'sent back for changes'}."
                + (f" Feedback: {reviewer_feedback}" if reviewer_feedback else ""),
            )
        if approve and task is not None and task.project_id is not None:
            await self._maybe_generate_final_invoice(task.project_id, task_submission_id=submission_id, actor_id=reviewer_id)
        return updated

    async def _maybe_generate_final_invoice(self, project_id: uuid.UUID, *, task_submission_id: uuid.UUID, actor_id: uuid.UUID | None) -> None:
        """Once every task on the project is complete, the remaining 75% is
        due - generate that invoice automatically instead of leaving Finance
        to notice and create it by hand. No-ops if there's still outstanding
        work, or a final invoice already exists for this project."""
        from app.modules.finance.repository import InvoiceRepository
        from app.modules.finance.service import InvoiceService
        from app.modules.leads.repository import LeadRepository

        project_tasks = await self._task_repo.get_all_filtered(project_id=project_id, limit=1000)
        if not project_tasks or any(t.status != "completed" for t in project_tasks):
            return

        invoice_repo = InvoiceRepository(self._db)
        if await invoice_repo.exists_final_for_project(project_id):
            return

        lead = await LeadRepository(self._db).find_by_converted_project(project_id)
        advance_invoice = await invoice_repo.get_advance_for_lead(lead.id) if lead else None
        if advance_invoice is None or advance_invoice.subtotal <= 0:
            # No advance-invoice trail to derive the deal total from (e.g. a
            # project created via the manual /leads/convert path with no
            # advance-invoice pipeline) - nothing to safely auto-generate.
            return

        total_deal_amount = advance_invoice.subtotal / 0.25
        tax_rate = (advance_invoice.tax_total / advance_invoice.subtotal * 100) if advance_invoice.subtotal else 0.0
        due_date = (datetime.now(timezone.utc) + timedelta(days=14)).date()

        invoice_service = InvoiceService(self._db, invoice_repo)
        await invoice_service.create_final_invoice_for_project(
            project_id=project_id, task_submission_id=task_submission_id, total_deal_amount=total_deal_amount,
            tax_rate=tax_rate, due_date=due_date, currency=advance_invoice.currency,
            notes="Final 75% invoice - auto-generated after all project tasks were approved.",
            actor_id=actor_id,
        )
