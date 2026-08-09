"""Pydantic schemas for the Tasks module."""
from __future__ import annotations
import uuid
from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, Field, computed_field

from app.core.sanitizers import SanitizedModel
from app.core.field_types import HttpUrlStr

# ── Project ──
class ProjectBase(SanitizedModel):
    name: str = Field(min_length=1, max_length=200)
    client_id: uuid.UUID | None = None
    description: str | None = None
    status: str = "active"
    start_date: date | None = None
    end_date: date | None = None
    manager_id: uuid.UUID | None = None

class ProjectCreate(ProjectBase): pass
class ProjectUpdate(SanitizedModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    client_id: uuid.UUID | None = None
    description: str | None = None
    status: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    manager_id: uuid.UUID | None = None

class ProjectRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    client_id: uuid.UUID | None
    description: str | None
    status: str
    start_date: date | None
    end_date: date | None
    manager_id: uuid.UUID | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime
    member_ids: list[uuid.UUID] = Field(default_factory=list)

# ── ProjectMember ──
class ProjectMemberCreate(SanitizedModel):
    user_id: uuid.UUID

class ProjectMemberRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    project_id: uuid.UUID
    user_id: uuid.UUID
    assigned_at: datetime

# ── Task ──
class TaskBase(SanitizedModel):
    title: str = Field(min_length=1, max_length=300)
    description: str | None = None
    project_id: uuid.UUID | None = None
    status: str = "todo"
    priority: str = "medium"
    progress: int = Field(0, ge=0, le=100)
    due_date: datetime | None = None
    assigned_to: uuid.UUID | None = None

class TaskCreate(TaskBase): pass
class TaskUpdate(SanitizedModel):
    title: str | None = Field(None, min_length=1, max_length=300)
    description: str | None = None
    project_id: uuid.UUID | None = None
    status: str | None = None
    priority: str | None = None
    progress: int | None = Field(None, ge=0, le=100)
    due_date: datetime | None = None
    assigned_to: uuid.UUID | None = None

class TaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    task_number: str
    title: str
    description: str | None
    project_id: uuid.UUID | None
    status: str
    priority: str
    progress: int
    due_date: datetime | None
    assigned_to: uuid.UUID | None
    created_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

    @computed_field  # type: ignore[prop-decorator]
    @property
    def assigned_employee_id(self) -> uuid.UUID | None:
        """Alias of `assigned_to` under the name the employee-facing
        frontend expects - `assigned_to` stays the column/FK name everywhere
        else (repository, service, other schemas) to avoid an unrelated
        rename across the module."""
        return self.assigned_to

# ── TaskComment ──
class TaskCommentBase(SanitizedModel):
    content: str = Field(min_length=1)

class TaskCommentCreate(TaskCommentBase): pass
class TaskCommentUpdate(SanitizedModel):
    content: str | None = Field(None, min_length=1)

class TaskCommentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    task_id: uuid.UUID
    content: str
    user_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

# ── TaskAttachment ──
class TaskAttachmentBase(SanitizedModel):
    file_name: str = Field(min_length=1, max_length=300)
    file_url: HttpUrlStr = Field(min_length=1)

class TaskAttachmentCreate(TaskAttachmentBase): pass
class TaskAttachmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    task_id: uuid.UUID
    file_name: str
    file_url: str
    uploaded_by: uuid.UUID | None
    created_at: datetime

# ── TaskSubmission ──
class TaskSubmissionCreate(SanitizedModel):
    title: str = Field(min_length=1, max_length=300)
    work_summary: str | None = None
    deliverable_type: str = "link"
    external_url: HttpUrlStr | None = None
    completion_percentage: int = Field(100, ge=0, le=100)

class TaskSubmissionUpdate(SanitizedModel):
    title: str | None = Field(None, min_length=1, max_length=300)
    work_summary: str | None = None
    deliverable_type: str | None = None
    external_url: HttpUrlStr | None = None
    completion_percentage: int | None = Field(None, ge=0, le=100)

class TaskSubmissionReview(SanitizedModel):
    approve: bool
    reviewer_feedback: str | None = None

class TaskSubmissionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    task_id: uuid.UUID
    submitted_by: uuid.UUID | None
    title: str
    work_summary: str | None
    deliverable_type: str
    external_url: str | None
    completion_percentage: int
    status: str
    reviewer_feedback: str | None
    reviewed_by: uuid.UUID | None
    reviewed_at: datetime | None
    version_number: int
    created_at: datetime

class TaskSubmissionQueueItem(TaskSubmissionRead):
    """TaskSubmissionRead plus the task/project/submitter context the CRM
    review queue needs to render a useful list without N+1 lookups."""
    task_title: str
    task_number: str
    project_id: uuid.UUID | None
    project_name: str | None
    submitted_by_name: str | None
