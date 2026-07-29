"""API routes for Tasks."""
from __future__ import annotations
import uuid
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.exceptions import ForbiddenException
from app.core.pagination import PaginatedResponse, PaginationParams
from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db
from app.dependencies.rbac import require_roles
from app.dependencies.tenant import get_current_client_id, get_current_user_role_slug
from app.models.user import User
from app.modules.tasks.dependencies import *
from app.modules.tasks.schemas import *
from app.modules.tasks.service import *

router = APIRouter(tags=["Project & Task Management"])

# ── Projects ──
@router.get("/projects", response_model=PaginatedResponse[ProjectRead], summary="List projects")
async def list_projects(
    params: PaginationParams = Depends(),
    client_id: uuid.UUID | None = Query(None),
    project_status: str | None = Query(None, alias="status"),
    manager_id: uuid.UUID | None = Query(None),
    svc: ProjectService = Depends(get_project_service),
    member_svc: ProjectMemberService = Depends(get_project_member_service),
    _: User = Depends(get_current_user),
    scoped_client_id: uuid.UUID | None = Depends(get_current_client_id),
):
    effective_client_id = scoped_client_id if scoped_client_id is not None else client_id
    items, total = await svc.list_projects(
        search=params.search, client_id=effective_client_id, status=project_status,
        manager_id=manager_id, sort_by=params.sort_by, sort_order=params.sort_order,
        offset=params.offset, limit=params.page_size,
    )
    member_map = await member_svc.list_member_ids_map([x.id for x in items])
    out_items = [
        ProjectRead.model_validate(x).model_copy(update={"member_ids": member_map.get(x.id, [])})
        for x in items
    ]
    return PaginatedResponse[ProjectRead].create(items=out_items, total=total, page=params.page, page_size=params.page_size)

@router.post("/projects", response_model=ProjectRead, status_code=status.HTTP_201_CREATED, summary="Create project")
async def create_project(payload: ProjectCreate, db: AsyncSession = Depends(get_db), svc: ProjectService = Depends(get_project_service), _: User = Depends(get_current_user)):
    p = await svc.create_project(payload.model_dump()); await db.commit()
    return ProjectRead.model_validate(p)

@router.get("/projects/{project_id}", response_model=ProjectRead, summary="Get project")
async def get_project(project_id: uuid.UUID, svc: ProjectService = Depends(get_project_service), member_svc: ProjectMemberService = Depends(get_project_member_service), _: User = Depends(get_current_user), scoped_client_id: uuid.UUID | None = Depends(get_current_client_id)):
    p = await svc.get_project(project_id, scoped_client_id=scoped_client_id)
    members = await member_svc.list_members(project_id)
    return ProjectRead.model_validate(p).model_copy(update={"member_ids": [m.user_id for m in members]})

@router.put("/projects/{project_id}", response_model=ProjectRead, summary="Update project")
async def update_project(project_id: uuid.UUID, payload: ProjectUpdate, db: AsyncSession = Depends(get_db), svc: ProjectService = Depends(get_project_service), member_svc: ProjectMemberService = Depends(get_project_member_service), _: User = Depends(get_current_user), scoped_client_id: uuid.UUID | None = Depends(get_current_client_id)):
    p = await svc.update_project(project_id, payload.model_dump(exclude_unset=True), scoped_client_id=scoped_client_id); await db.commit()
    members = await member_svc.list_members(project_id)
    return ProjectRead.model_validate(p).model_copy(update={"member_ids": [m.user_id for m in members]})

@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete project")
async def delete_project(project_id: uuid.UUID, db: AsyncSession = Depends(get_db), svc: ProjectService = Depends(get_project_service), _: User = Depends(get_current_user), scoped_client_id: uuid.UUID | None = Depends(get_current_client_id)):
    await svc.delete_project(project_id, scoped_client_id=scoped_client_id); await db.commit()

@router.post("/projects/{project_id}/complete", response_model=ProjectRead, summary="Mark project completed (final workflow step)")
async def complete_project(project_id: uuid.UUID, db: AsyncSession = Depends(get_db), svc: ProjectService = Depends(get_project_service), current_user: User = Depends(get_current_user), _role: str = Depends(require_roles("admin", "crm"))):
    p = await svc.complete_project(project_id, actor_id=current_user.id); await db.commit()
    return ProjectRead.model_validate(p)

# ── Project Members ──
@router.get("/projects/{project_id}/members", response_model=list[ProjectMemberRead], summary="List project team members")
async def list_project_members(
    project_id: uuid.UUID, project_svc: ProjectService = Depends(get_project_service),
    svc: ProjectMemberService = Depends(get_project_member_service),
    _: User = Depends(get_current_user), scoped_client_id: uuid.UUID | None = Depends(get_current_client_id),
):
    await project_svc.get_project(project_id, scoped_client_id=scoped_client_id)
    return [ProjectMemberRead.model_validate(m) for m in await svc.list_members(project_id)]

@router.post("/projects/{project_id}/members", response_model=ProjectMemberRead, status_code=status.HTTP_201_CREATED, summary="Assign an employee to a project")
async def add_project_member(
    project_id: uuid.UUID, payload: ProjectMemberCreate, db: AsyncSession = Depends(get_db),
    project_svc: ProjectService = Depends(get_project_service), svc: ProjectMemberService = Depends(get_project_member_service),
    current_user: User = Depends(get_current_user), scoped_client_id: uuid.UUID | None = Depends(get_current_client_id),
):
    await project_svc.get_project(project_id, scoped_client_id=scoped_client_id)
    m = await svc.add_member(project_id, payload.user_id, actor_id=current_user.id); await db.commit()
    return ProjectMemberRead.model_validate(m)

@router.delete("/projects/{project_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Remove an employee from a project")
async def remove_project_member(
    project_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession = Depends(get_db),
    project_svc: ProjectService = Depends(get_project_service), svc: ProjectMemberService = Depends(get_project_member_service),
    current_user: User = Depends(get_current_user), scoped_client_id: uuid.UUID | None = Depends(get_current_client_id),
):
    await project_svc.get_project(project_id, scoped_client_id=scoped_client_id)
    await svc.remove_member(project_id, user_id, actor_id=current_user.id); await db.commit()

# ── Tasks ──
@router.get("/tasks", response_model=PaginatedResponse[TaskRead], summary="List tasks")
async def list_tasks(
    params: PaginationParams = Depends(),
    project_id: uuid.UUID | None = Query(None),
    task_status: str | None = Query(None, alias="status"),
    priority: str | None = Query(None),
    assigned_to: uuid.UUID | None = Query(None),
    svc: TaskService = Depends(get_task_service),
    project_svc: ProjectService = Depends(get_project_service),
    current_user: User = Depends(get_current_user),
    scoped_client_id: uuid.UUID | None = Depends(get_current_client_id),
    role_slug: str | None = Depends(get_current_user_role_slug),
):
    if role_slug == "employee":
        # Employees may only ever list their own tasks, regardless of query params.
        assigned_to = current_user.id
    if project_id is not None:
        await project_svc.get_project(project_id, scoped_client_id=scoped_client_id)
    elif scoped_client_id is not None:
        # No project filter given by a client-scoped caller: restrict to tasks
        # belonging to one of that client's own projects.
        own_projects, _total = await project_svc.list_projects(client_id=scoped_client_id, limit=1000)
        own_project_ids = {p.id for p in own_projects}
        items, total = await svc.list_tasks(
            search=params.search, project_id=None, status=task_status,
            priority=priority, assigned_to=assigned_to, sort_by=params.sort_by,
            sort_order=params.sort_order, offset=params.offset, limit=params.page_size,
            project_ids=own_project_ids,
        )
        return PaginatedResponse[TaskRead].create(items=[TaskRead.model_validate(x) for x in items], total=total, page=params.page, page_size=params.page_size)
    items, total = await svc.list_tasks(
        search=params.search, project_id=project_id, status=task_status,
        priority=priority, assigned_to=assigned_to, sort_by=params.sort_by,
        sort_order=params.sort_order, offset=params.offset, limit=params.page_size,
    )
    return PaginatedResponse[TaskRead].create(items=[TaskRead.model_validate(x) for x in items], total=total, page=params.page, page_size=params.page_size)

@router.post("/tasks", response_model=TaskRead, status_code=status.HTTP_201_CREATED, summary="Create task")
async def create_task(payload: TaskCreate, db: AsyncSession = Depends(get_db), svc: TaskService = Depends(get_task_service), current_user: User = Depends(get_current_user)):
    t = await svc.create_task(payload.model_dump(), created_by=current_user.id); await db.commit()
    return TaskRead.model_validate(t)

@router.get("/tasks/{task_id}", response_model=TaskRead, summary="Get task")
async def get_task(task_id: uuid.UUID, svc: TaskService = Depends(get_task_service), project_svc: ProjectService = Depends(get_project_service), _: User = Depends(get_current_user), scoped_client_id: uuid.UUID | None = Depends(get_current_client_id)):
    task = await svc.get_task(task_id)
    if task.project_id:
        await project_svc.get_project(task.project_id, scoped_client_id=scoped_client_id)
    return TaskRead.model_validate(task)

@router.put("/tasks/{task_id}", response_model=TaskRead, summary="Update task")
async def update_task(
    task_id: uuid.UUID, payload: TaskUpdate, db: AsyncSession = Depends(get_db),
    svc: TaskService = Depends(get_task_service), project_svc: ProjectService = Depends(get_project_service),
    current_user: User = Depends(get_current_user), scoped_client_id: uuid.UUID | None = Depends(get_current_client_id),
    role_slug: str | None = Depends(get_current_user_role_slug),
):
    existing = await svc.get_task(task_id)
    if existing.project_id:
        await project_svc.get_project(existing.project_id, scoped_client_id=scoped_client_id)
    if role_slug == "employee" and existing.assigned_to != current_user.id:
        raise ForbiddenException("You can only update tasks assigned to you.")
    t = await svc.update_task(task_id, payload.model_dump(exclude_unset=True), actor_id=current_user.id); await db.commit()
    return TaskRead.model_validate(t)

@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete task")
async def delete_task(task_id: uuid.UUID, db: AsyncSession = Depends(get_db), svc: TaskService = Depends(get_task_service), project_svc: ProjectService = Depends(get_project_service), _: User = Depends(get_current_user), scoped_client_id: uuid.UUID | None = Depends(get_current_client_id)):
    existing = await svc.get_task(task_id)
    if existing.project_id:
        await project_svc.get_project(existing.project_id, scoped_client_id=scoped_client_id)
    await svc.delete_task(task_id); await db.commit()

# ── Task Comments ──
@router.get("/tasks/{task_id}/comments", response_model=list[TaskCommentRead], summary="List task comments")
async def list_task_comments(task_id: uuid.UUID, svc: TaskCommentService = Depends(get_task_comment_service), _: User = Depends(get_current_user)):
    return [TaskCommentRead.model_validate(x) for x in await svc.list_comments(task_id)]

@router.post("/tasks/{task_id}/comments", response_model=TaskCommentRead, status_code=status.HTTP_201_CREATED, summary="Add task comment")
async def create_task_comment(task_id: uuid.UUID, payload: TaskCommentCreate, db: AsyncSession = Depends(get_db), svc: TaskCommentService = Depends(get_task_comment_service), current_user: User = Depends(get_current_user)):
    c = await svc.create_comment(task_id, payload.model_dump(), user_id=current_user.id); await db.commit()
    return TaskCommentRead.model_validate(c)

@router.put("/comments/{comment_id}", response_model=TaskCommentRead, summary="Update task comment")
async def update_task_comment(comment_id: uuid.UUID, payload: TaskCommentUpdate, db: AsyncSession = Depends(get_db), svc: TaskCommentService = Depends(get_task_comment_service), _: User = Depends(get_current_user)):
    c = await svc.update_comment(comment_id, payload.model_dump(exclude_unset=True)); await db.commit()
    return TaskCommentRead.model_validate(c)

@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete task comment")
async def delete_task_comment(comment_id: uuid.UUID, db: AsyncSession = Depends(get_db), svc: TaskCommentService = Depends(get_task_comment_service), _: User = Depends(get_current_user)):
    await svc.delete_comment(comment_id); await db.commit()

# ── Task Attachments ──
@router.get("/tasks/{task_id}/attachments", response_model=list[TaskAttachmentRead], summary="List task attachments")
async def list_task_attachments(task_id: uuid.UUID, svc: TaskAttachmentService = Depends(get_task_attachment_service), _: User = Depends(get_current_user)):
    return [TaskAttachmentRead.model_validate(x) for x in await svc.list_attachments(task_id)]

@router.post("/tasks/{task_id}/attachments", response_model=TaskAttachmentRead, status_code=status.HTTP_201_CREATED, summary="Upload task attachment")
async def create_task_attachment(task_id: uuid.UUID, payload: TaskAttachmentCreate, db: AsyncSession = Depends(get_db), svc: TaskAttachmentService = Depends(get_task_attachment_service), current_user: User = Depends(get_current_user)):
    a = await svc.create_attachment(task_id, payload.model_dump(), uploaded_by=current_user.id); await db.commit()
    return TaskAttachmentRead.model_validate(a)

@router.delete("/attachments/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete task attachment")
async def delete_task_attachment(attachment_id: uuid.UUID, db: AsyncSession = Depends(get_db), svc: TaskAttachmentService = Depends(get_task_attachment_service), _: User = Depends(get_current_user)):
    await svc.delete_attachment(attachment_id); await db.commit()

# ── Task Submissions ──
@router.get("/tasks/{task_id}/submissions", response_model=list[TaskSubmissionRead], summary="List task submissions")
async def list_task_submissions(
    task_id: uuid.UUID, task_svc: TaskService = Depends(get_task_service),
    svc: TaskSubmissionService = Depends(get_task_submission_service),
    current_user: User = Depends(get_current_user), role_slug: str | None = Depends(get_current_user_role_slug),
):
    task = await task_svc.get_task(task_id)
    if role_slug == "employee" and task.assigned_to != current_user.id:
        raise ForbiddenException("You can only view submissions for tasks assigned to you.")
    return [TaskSubmissionRead.model_validate(x) for x in await svc.list_by_task(task_id)]

@router.post("/tasks/{task_id}/submissions", response_model=TaskSubmissionRead, status_code=status.HTTP_201_CREATED, summary="Submit work for a task")
async def create_task_submission(
    task_id: uuid.UUID, payload: TaskSubmissionCreate, db: AsyncSession = Depends(get_db),
    task_svc: TaskService = Depends(get_task_service), svc: TaskSubmissionService = Depends(get_task_submission_service),
    current_user: User = Depends(get_current_user), role_slug: str | None = Depends(get_current_user_role_slug),
):
    task = await task_svc.get_task(task_id)
    if role_slug == "employee" and task.assigned_to != current_user.id:
        raise ForbiddenException("You can only submit work for tasks assigned to you.")
    s = await svc.create(task_id, payload.model_dump(), submitted_by=current_user.id); await db.commit()
    return TaskSubmissionRead.model_validate(s)

@router.get("/submissions", response_model=PaginatedResponse[TaskSubmissionQueueItem], summary="CRM review queue: list all task submissions")
async def list_all_submissions(
    params: PaginationParams = Depends(),
    submission_status: str | None = Query(None, alias="status"),
    svc: TaskSubmissionService = Depends(get_task_submission_service),
    _: str = Depends(require_roles("admin", "crm")),
):
    enriched, total = await svc.list_queue(status=submission_status, offset=params.offset, limit=params.page_size)
    out_items = [
        TaskSubmissionQueueItem.model_validate(
            TaskSubmissionRead.model_validate(e["submission"]).model_dump()
            | {
                "task_title": e["task_title"],
                "task_number": e["task_number"],
                "project_id": e["project_id"],
                "project_name": e["project_name"],
                "submitted_by_name": e["submitted_by_name"],
            }
        )
        for e in enriched
    ]
    return PaginatedResponse[TaskSubmissionQueueItem].create(items=out_items, total=total, page=params.page, page_size=params.page_size)

@router.put("/submissions/{submission_id}", response_model=TaskSubmissionRead, summary="Resubmit work")
async def resubmit_task_submission(
    submission_id: uuid.UUID, payload: TaskSubmissionUpdate, db: AsyncSession = Depends(get_db),
    svc: TaskSubmissionService = Depends(get_task_submission_service),
    current_user: User = Depends(get_current_user), role_slug: str | None = Depends(get_current_user_role_slug),
):
    existing = await svc.get(submission_id)
    if role_slug == "employee" and existing.submitted_by != current_user.id:
        raise ForbiddenException("You can only resubmit your own work.")
    s = await svc.resubmit(submission_id, payload.model_dump(exclude_unset=True), submitted_by=current_user.id); await db.commit()
    return TaskSubmissionRead.model_validate(s)

@router.post("/submissions/{submission_id}/review", response_model=TaskSubmissionRead, summary="Review a task submission")
async def review_task_submission(
    submission_id: uuid.UUID, payload: TaskSubmissionReview, db: AsyncSession = Depends(get_db),
    svc: TaskSubmissionService = Depends(get_task_submission_service),
    current_user: User = Depends(get_current_user),
    _: str = Depends(require_roles("admin", "crm")),
):
    s = await svc.review(submission_id, approve=payload.approve, reviewer_feedback=payload.reviewer_feedback, reviewer_id=current_user.id)
    await db.commit()
    return TaskSubmissionRead.model_validate(s)
