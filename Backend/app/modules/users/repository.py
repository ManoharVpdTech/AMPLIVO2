"""Repository layer for the User Management module.

Every repository extends ``BaseRepository`` and adds domain-specific
query methods (e.g. get-by-slug, list-with-relationships).
"""

from __future__ import annotations

import uuid
from typing import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.filters import apply_search, apply_sorting
from app.models.user import User
from app.modules.users.models import (
    Branch,
    Department,
    Designation,
    Permission,
    Role,
    RolePermission,
    Team,
    UserProfile,
)
from app.repositories.base import BaseRepository


# ── Role Repository ────────────────────────────────────────────────────


class RoleRepository(BaseRepository[Role]):
    model = Role
    searchable_columns = [Role.name, Role.slug]

    async def get_by_slug(self, slug: str) -> Role | None:
        result = await self._db.execute(select(Role).where(Role.slug == slug))
        return result.scalar_one_or_none()

    async def get_with_permissions(self, role_id: uuid.UUID) -> Role | None:
        stmt = (
            select(Role)
            .options(selectinload(Role.role_permissions).selectinload(RolePermission.permission))
            .where(Role.id == role_id)
        )
        result = await self._db.execute(stmt)
        return result.scalar_one_or_none()


# ── Permission Repository ──────────────────────────────────────────────


class PermissionRepository(BaseRepository[Permission]):
    model = Permission
    searchable_columns = [Permission.module, Permission.action, Permission.slug]

    async def get_by_slug(self, slug: str) -> Permission | None:
        result = await self._db.execute(select(Permission).where(Permission.slug == slug))
        return result.scalar_one_or_none()

    async def get_by_module(self, module: str) -> Sequence[Permission]:
        result = await self._db.execute(
            select(Permission).where(Permission.module == module).order_by(Permission.action)
        )
        return result.scalars().all()

    async def get_by_module_and_action(self, module: str, action: str) -> Permission | None:
        result = await self._db.execute(
            select(Permission).where(Permission.module == module, Permission.action == action)
        )
        return result.scalar_one_or_none()



# ── RolePermission Repository ──────────────────────────────────────────


class RolePermissionRepository:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def assign(self, role_id: uuid.UUID, permission_id: uuid.UUID) -> RolePermission:
        rp = RolePermission(role_id=role_id, permission_id=permission_id)
        self._db.add(rp)
        await self._db.flush()
        return rp

    async def revoke(self, role_id: uuid.UUID, permission_id: uuid.UUID) -> bool:
        stmt = select(RolePermission).where(
            RolePermission.role_id == role_id, RolePermission.permission_id == permission_id
        )
        result = await self._db.execute(stmt)
        rp = result.scalar_one_or_none()
        if rp is None:
            return False
        await self._db.delete(rp)
        await self._db.flush()
        return True

    async def list_for_role(self, role_id: uuid.UUID) -> Sequence[Permission]:
        stmt = (
            select(Permission)
            .join(RolePermission, RolePermission.permission_id == Permission.id)
            .where(RolePermission.role_id == role_id)
            .order_by(Permission.module, Permission.action)
        )
        result = await self._db.execute(stmt)
        return result.scalars().all()


# ── Branch Repository ──────────────────────────────────────────────────


class BranchRepository(BaseRepository[Branch]):
    model = Branch
    searchable_columns = [Branch.name, Branch.code, Branch.city, Branch.country]

    async def get_by_code(self, code: str) -> Branch | None:
        result = await self._db.execute(select(Branch).where(Branch.code == code))
        return result.scalar_one_or_none()


# ── Department Repository ──────────────────────────────────────────────


class DepartmentRepository(BaseRepository[Department]):
    model = Department
    searchable_columns = [Department.name, Department.slug]

    async def get_by_slug(self, slug: str) -> Department | None:
        result = await self._db.execute(select(Department).where(Department.slug == slug))
        return result.scalar_one_or_none()


# ── Designation Repository ─────────────────────────────────────────────


class DesignationRepository(BaseRepository[Designation]):
    model = Designation
    searchable_columns = [Designation.title]

    async def get_by_title(self, title: str) -> Designation | None:
        result = await self._db.execute(select(Designation).where(Designation.title == title))
        return result.scalar_one_or_none()


# ── Team Repository ────────────────────────────────────────────────────


class TeamRepository(BaseRepository[Team]):
    model = Team
    searchable_columns = [Team.name, Team.slug]

    async def get_by_slug(self, slug: str) -> Team | None:
        result = await self._db.execute(select(Team).where(Team.slug == slug))
        return result.scalar_one_or_none()

    async def list_by_department(self, department_id: uuid.UUID) -> Sequence[Team]:
        result = await self._db.execute(
            select(Team).where(Team.department_id == department_id).order_by(Team.name)
        )
        return result.scalars().all()


# ── User Profile Repository ────────────────────────────────────────────


class UserProfileRepository:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def get_by_user_id(self, user_id: uuid.UUID) -> UserProfile | None:
        result = await self._db.execute(select(UserProfile).where(UserProfile.user_id == user_id))
        return result.scalar_one_or_none()

    async def create(self, profile: UserProfile) -> UserProfile:
        self._db.add(profile)
        await self._db.flush()
        await self._db.refresh(profile)
        return profile

    async def update(self, user_id: uuid.UUID, data: dict) -> UserProfile | None:
        profile = await self.get_by_user_id(user_id)
        if profile is None:
            return None
        for key, value in data.items():
            if hasattr(profile, key):
                setattr(profile, key, value)
        await self._db.flush()
        await self._db.refresh(profile)
        return profile


# ── User Management Repository (extends auth UserRepository) ───────────


class UserManagementRepository(BaseRepository[User]):
    model = User
    searchable_columns = [User.email, User.username, User.full_name]

    async def get_detail(self, user_id: uuid.UUID) -> User | None:
        stmt = (
            select(User)
            .options(selectinload(User.profile))
            .where(User.id == user_id, User.is_deleted.is_(False))
        )
        result = await self._db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_all_active(
        self,
        *,
        search: str | None = None,
        user_type: str | None = None,
        status: str | None = None,
        role_id: uuid.UUID | None = None,
        department_id: uuid.UUID | None = None,
        branch_id: uuid.UUID | None = None,
        is_active: bool | None = None,
        sort_by: str | None = None,
        sort_order: str = "desc",
        offset: int = 0,
        limit: int = 20,
    ) -> Sequence[User]:
        stmt = select(User).where(User.is_deleted.is_(False))
        if user_type:
            stmt = stmt.where(User.user_type == user_type)
        if status:
            stmt = stmt.where(User.status == status)
        if role_id:
            stmt = stmt.where(User.role_id == role_id)
        if department_id:
            stmt = stmt.where(User.department_id == department_id)
        if branch_id:
            stmt = stmt.where(User.branch_id == branch_id)
        if is_active is not None:
            stmt = stmt.where(User.is_active == is_active)
        stmt = apply_search(stmt, search=search, columns=self.searchable_columns)
        stmt = apply_sorting(stmt, model=User, sort_by=sort_by, sort_order=sort_order)
        stmt = stmt.offset(offset).limit(limit)
        result = await self._db.execute(stmt)
        return result.scalars().all()

    async def count_active(
        self,
        *,
        search: str | None = None,
        user_type: str | None = None,
        status: str | None = None,
        role_id: uuid.UUID | None = None,
        department_id: uuid.UUID | None = None,
        branch_id: uuid.UUID | None = None,
        is_active: bool | None = None,
    ) -> int:
        stmt = select(func.count()).select_from(User).where(User.is_deleted.is_(False))
        if user_type:
            stmt = stmt.where(User.user_type == user_type)
        if status:
            stmt = stmt.where(User.status == status)
        if role_id:
            stmt = stmt.where(User.role_id == role_id)
        if department_id:
            stmt = stmt.where(User.department_id == department_id)
        if branch_id:
            stmt = stmt.where(User.branch_id == branch_id)
        if is_active is not None:
            stmt = stmt.where(User.is_active == is_active)
        stmt = apply_search(stmt, search=search, columns=self.searchable_columns)
        result = await self._db.execute(stmt)
        return result.scalar_one()
