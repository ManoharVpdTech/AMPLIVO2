"""Client-portal tenant scoping.

Resolves the caller's own client/tenant id so 'client'-role users can only
ever see rows that belong to their own company, regardless of what query
params the frontend sends. Internal/staff users are unrestricted (None).
"""
from __future__ import annotations

import uuid

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ForbiddenException
from app.core.tenant_scope import enforce_client_scope  # noqa: F401  (re-exported for route imports)
from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db
from app.models.user import User
from app.modules.users.models import Role

CLIENT_ROLE_SLUG = "client"


async def get_current_user_role_slug(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> str | None:
    if not current_user.role_id:
        return None
    result = await db.execute(select(Role.slug).where(Role.id == current_user.role_id))
    return result.scalar_one_or_none()


async def get_current_client_id(
    current_user: User = Depends(get_current_user),
    role_slug: str | None = Depends(get_current_user_role_slug),
) -> uuid.UUID | None:
    """None for staff (unrestricted). The caller's own clients.id for a client user."""
    from app.dependencies.rbac import STAFF_ROLE_SLUGS, ALWAYS_ALLOWED_SLUGS
    if role_slug in STAFF_ROLE_SLUGS or role_slug in ALWAYS_ALLOWED_SLUGS:
        return None
    if role_slug != CLIENT_ROLE_SLUG:
        raise ForbiddenException("You do not have permission to access client resources.")
    if current_user.client_id is None:
        raise ForbiddenException("This account is not linked to a client company yet. Contact support.")
    return current_user.client_id
