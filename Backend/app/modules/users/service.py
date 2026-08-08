"""Service layer for the User Management module.

Orchestrates business logic, validation, and repository calls for users,
roles, permissions, branches, departments, teams, designations, and
user profiles.
"""

from __future__ import annotations

import uuid
from typing import Any, Sequence

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestException, DuplicateException, NotFoundException
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
from app.modules.users.repository import (
    BranchRepository,
    DepartmentRepository,
    DesignationRepository,
    PermissionRepository,
    RolePermissionRepository,
    RoleRepository,
    TeamRepository,
    UserManagementRepository,
    UserProfileRepository,
)


# ── Role Service ───────────────────────────────────────────────────────


class RoleService:
    def __init__(self, db: AsyncSession, repo: RoleRepository, perm_repo: RolePermissionRepository) -> None:
        self._db = db
        self._repo = repo
        self._perm_repo = perm_repo

    async def list_roles(
        self,
        *,
        search: str | None = None,
        sort_by: str | None = None,
        sort_order: str = "desc",
        offset: int = 0,
        limit: int = 20,
    ) -> tuple[Sequence[Role], int]:
        items = await self._repo.get_all(
            search=search, sort_by=sort_by, sort_order=sort_order, offset=offset, limit=limit
        )
        total = await self._repo.count(search=search)
        return items, total

    async def get_role(self, role_id: uuid.UUID) -> Role:
        role = await self._repo.get_by_id(role_id)
        if role is None:
            raise NotFoundException("Role")
        return role

    async def get_role_with_permissions(self, role_id: uuid.UUID) -> Role:
        role = await self._repo.get_with_permissions(role_id)
        if role is None:
            raise NotFoundException("Role")
        return role

    async def create_role(self, data: dict[str, Any]) -> Role:
        if await self._repo.get_by_slug(data["slug"]):
            raise DuplicateException("Role", "slug")
        return await self._repo.create_from_dict(data)

    async def update_role(self, role_id: uuid.UUID, data: dict[str, Any]) -> Role:
        role = await self.get_role(role_id)
        if role.is_system:
            raise BadRequestException("System roles cannot be modified.")
        if "slug" in data and data["slug"] != role.slug:
            if await self._repo.get_by_slug(data["slug"]):
                raise DuplicateException("Role", "slug")
        updated = await self._repo.update(role_id, data)
        if updated is None:
            raise NotFoundException("Role")
        return updated

    async def delete_role(self, role_id: uuid.UUID) -> None:
        role = await self.get_role(role_id)
        if role.is_system:
            raise BadRequestException("System roles cannot be deleted.")
        await self._repo.delete(role_id)

    async def get_role_permissions(self, role_id: uuid.UUID) -> Sequence[Permission]:
        await self.get_role(role_id)  # validate existence
        return await self._perm_repo.list_for_role(role_id)

    async def assign_permission(self, role_id: uuid.UUID, permission_id: uuid.UUID) -> None:
        await self.get_role(role_id)
        perm = await self._db.get(Permission, permission_id)
        if not perm:
            raise NotFoundException("Permission")
        return await self._perm_repo.assign(role_id, permission_id)

    async def revoke_permission(self, role_id: uuid.UUID, permission_id: uuid.UUID) -> None:
        if not await self._perm_repo.revoke(role_id, permission_id):
            raise NotFoundException("RolePermission")


# ── Permission Service ─────────────────────────────────────────────────


class PermissionService:
    def __init__(self, repo: PermissionRepository) -> None:
        self._repo = repo

    async def list_permissions(
        self,
        *,
        search: str | None = None,
        module: str | None = None,
        sort_by: str | None = None,
        sort_order: str = "desc",
        offset: int = 0,
        limit: int = 100,
    ) -> tuple[Sequence[Permission], int]:
        filters = []
        if module:
            filters.append(Permission.module == module)
        items = await self._repo.get_all(
            filters=filters, search=search, sort_by=sort_by, sort_order=sort_order,
            offset=offset, limit=limit,
        )
        total = await self._repo.count(filters=filters, search=search)
        return items, total

    async def get_permission(self, permission_id: uuid.UUID) -> Permission:
        perm = await self._repo.get_by_id(permission_id)
        if perm is None:
            raise NotFoundException("Permission")
        return perm

    async def create_permission(self, data: dict[str, Any]) -> Permission:
        if await self._repo.get_by_slug(data["slug"]):
            raise DuplicateException("Permission", "slug")
        if await self._repo.get_by_module_and_action(data["module"], data["action"]):
            raise DuplicateException("Permission", "module and action")
        return await self._repo.create_from_dict(data)


# ── Branch Service ─────────────────────────────────────────────────────


class BranchService:
    def __init__(self, repo: BranchRepository) -> None:
        self._repo = repo

    async def list_branches(
        self,
        *,
        search: str | None = None,
        is_active: bool | None = None,
        sort_by: str | None = None,
        sort_order: str = "desc",
        offset: int = 0,
        limit: int = 20,
    ) -> tuple[Sequence[Branch], int]:
        filters = []
        if is_active is not None:
            filters.append(Branch.is_active == is_active)
        items = await self._repo.get_all(
            filters=filters, search=search, sort_by=sort_by, sort_order=sort_order,
            offset=offset, limit=limit,
        )
        total = await self._repo.count(filters=filters, search=search)
        return items, total

    async def get_branch(self, branch_id: uuid.UUID) -> Branch:
        branch = await self._repo.get_by_id(branch_id)
        if branch is None:
            raise NotFoundException("Branch")
        return branch

    async def create_branch(self, data: dict[str, Any]) -> Branch:
        if await self._repo.get_by_code(data["code"]):
            raise DuplicateException("Branch", "code")
        return await self._repo.create_from_dict(data)

    async def update_branch(self, branch_id: uuid.UUID, data: dict[str, Any]) -> Branch:
        await self.get_branch(branch_id)
        if "code" in data:
            existing = await self._repo.get_by_code(data["code"])
            if existing and existing.id != branch_id:
                raise DuplicateException("Branch", "code")
        updated = await self._repo.update(branch_id, data)
        if updated is None:
            raise NotFoundException("Branch")
        return updated

    async def delete_branch(self, branch_id: uuid.UUID) -> None:
        await self.get_branch(branch_id)
        await self._repo.delete(branch_id)


# ── Department Service ─────────────────────────────────────────────────


class DepartmentService:
    def __init__(self, repo: DepartmentRepository) -> None:
        self._repo = repo

    async def list_departments(
        self,
        *,
        search: str | None = None,
        sort_by: str | None = None,
        sort_order: str = "desc",
        offset: int = 0,
        limit: int = 20,
    ) -> tuple[Sequence[Department], int]:
        items = await self._repo.get_all(
            search=search, sort_by=sort_by, sort_order=sort_order, offset=offset, limit=limit
        )
        total = await self._repo.count(search=search)
        return items, total

    async def get_department(self, department_id: uuid.UUID) -> Department:
        dept = await self._repo.get_by_id(department_id)
        if dept is None:
            raise NotFoundException("Department")
        return dept

    async def create_department(self, data: dict[str, Any]) -> Department:
        if await self._repo.get_by_slug(data["slug"]):
            raise DuplicateException("Department", "slug")
        if "head_user_id" in data and data["head_user_id"] is not None:
            user = await self._repo._db.get(User, data["head_user_id"])
            if not user or user.is_deleted:
                raise NotFoundException("User")
        return await self._repo.create_from_dict(data)

    async def update_department(self, department_id: uuid.UUID, data: dict[str, Any]) -> Department:
        await self.get_department(department_id)
        if "slug" in data:
            existing = await self._repo.get_by_slug(data["slug"])
            if existing and existing.id != department_id:
                raise DuplicateException("Department", "slug")
        if "head_user_id" in data and data["head_user_id"] is not None:
            user = await self._repo._db.get(User, data["head_user_id"])
            if not user or user.is_deleted:
                raise NotFoundException("User")
        updated = await self._repo.update(department_id, data)
        if updated is None:
            raise NotFoundException("Department")
        return updated

    async def delete_department(self, department_id: uuid.UUID) -> None:
        await self.get_department(department_id)
        await self._repo.delete(department_id)


# ── Team Service ───────────────────────────────────────────────────────


class TeamService:
    def __init__(self, repo: TeamRepository) -> None:
        self._repo = repo

    async def list_teams(
        self,
        *,
        search: str | None = None,
        department_id: uuid.UUID | None = None,
        is_active: bool | None = None,
        sort_by: str | None = None,
        sort_order: str = "desc",
        offset: int = 0,
        limit: int = 20,
    ) -> tuple[Sequence[Team], int]:
        filters = []
        if department_id:
            filters.append(Team.department_id == department_id)
        if is_active is not None:
            filters.append(Team.is_active == is_active)
        items = await self._repo.get_all(
            filters=filters, search=search, sort_by=sort_by, sort_order=sort_order,
            offset=offset, limit=limit,
        )
        total = await self._repo.count(filters=filters, search=search)
        return items, total

    async def get_team(self, team_id: uuid.UUID) -> Team:
        team = await self._repo.get_by_id(team_id)
        if team is None:
            raise NotFoundException("Team")
        return team

    async def create_team(self, data: dict[str, Any]) -> Team:
        if "department_id" not in data or data["department_id"] is None:
            raise BadRequestException("department_id is required")
        dept = await self._repo._db.get(Department, data["department_id"])
        if not dept:
            raise NotFoundException("Department")
        if await self._repo.get_by_slug(data["slug"]):
            raise DuplicateException("Team", "slug")
        return await self._repo.create_from_dict(data)

    async def update_team(self, team_id: uuid.UUID, data: dict[str, Any]) -> Team:
        await self.get_team(team_id)
        if "department_id" in data and data["department_id"] is not None:
            dept = await self._repo._db.get(Department, data["department_id"])
            if not dept:
                raise NotFoundException("Department")
        if "slug" in data:
            existing = await self._repo.get_by_slug(data["slug"])
            if existing and existing.id != team_id:
                raise DuplicateException("Team", "slug")
        updated = await self._repo.update(team_id, data)
        if updated is None:
            raise NotFoundException("Team")
        return updated

    async def delete_team(self, team_id: uuid.UUID) -> None:
        await self.get_team(team_id)
        await self._repo.delete(team_id)


# ── Designation Service ────────────────────────────────────────────────


class DesignationService:
    def __init__(self, repo: DesignationRepository) -> None:
        self._repo = repo

    async def list_designations(
        self,
        *,
        search: str | None = None,
        is_active: bool | None = None,
        sort_by: str | None = None,
        sort_order: str = "desc",
        offset: int = 0,
        limit: int = 20,
    ) -> tuple[Sequence[Designation], int]:
        filters = []
        if is_active is not None:
            filters.append(Designation.is_active == is_active)
        items = await self._repo.get_all(
            filters=filters, search=search, sort_by=sort_by, sort_order=sort_order,
            offset=offset, limit=limit,
        )
        total = await self._repo.count(filters=filters, search=search)
        return items, total

    async def get_designation(self, designation_id: uuid.UUID) -> Designation:
        d = await self._repo.get_by_id(designation_id)
        if d is None:
            raise NotFoundException("Designation")
        return d

    async def create_designation(self, data: dict[str, Any]) -> Designation:
        if await self._repo.get_by_title(data["title"]):
            raise DuplicateException("Designation", "title")
        return await self._repo.create_from_dict(data)

    async def update_designation(self, designation_id: uuid.UUID, data: dict[str, Any]) -> Designation:
        await self.get_designation(designation_id)
        if "title" in data:
            existing = await self._repo.get_by_title(data["title"])
            if existing and existing.id != designation_id:
                raise DuplicateException("Designation", "title")
        updated = await self._repo.update(designation_id, data)
        if updated is None:
            raise NotFoundException("Designation")
        return updated

    async def delete_designation(self, designation_id: uuid.UUID) -> None:
        await self.get_designation(designation_id)
        await self._repo.delete(designation_id)


# ── User Profile Service ──────────────────────────────────────────────


class UserProfileService:
    def __init__(self, db: AsyncSession, repo: UserProfileRepository) -> None:
        self._db = db
        self._repo = repo

    async def get_profile(self, user_id: uuid.UUID) -> UserProfile:
        profile = await self._repo.get_by_user_id(user_id)
        if profile is None:
            # No profile row exists yet (e.g. a freshly-hired employee, or any
            # account created before this endpoint was ever called) — bootstrap
            # a blank one instead of 404ing, so "My Profile" always loads.
            user = await self._db.get(User, user_id)
            if user is None:
                raise NotFoundException("UserProfile")
            profile = UserProfile(user_id=user_id, full_name=user.full_name)
            profile = await self._repo.create(profile)
        return profile

    async def create_or_update_profile(self, user_id: uuid.UUID, data: dict[str, Any]) -> UserProfile:
        existing = await self._repo.get_by_user_id(user_id)
        if existing:
            return await self._repo.update(user_id, data)
        user = await self._db.get(User, user_id)
        if user is None:
            raise NotFoundException("User")
        data["user_id"] = user_id
        if "full_name" not in data or not data["full_name"]:
            data["full_name"] = user.full_name
        profile = UserProfile(**data)
        return await self._repo.create(profile)


# ── User Management Service ───────────────────────────────────────────


class UserManagementService:
    def __init__(self, db: AsyncSession, repo: UserManagementRepository) -> None:
        self._db = db
        self._repo = repo

    async def list_users(
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
    ) -> tuple[Sequence[User], int]:
        items = await self._repo.get_all_active(
            search=search, user_type=user_type, status=status, role_id=role_id,
            department_id=department_id, branch_id=branch_id, is_active=is_active,
            sort_by=sort_by, sort_order=sort_order, offset=offset, limit=limit,
        )
        total = await self._repo.count_active(
            search=search, user_type=user_type, status=status, role_id=role_id,
            department_id=department_id, branch_id=branch_id, is_active=is_active,
        )
        return items, total

    async def get_user(self, user_id: uuid.UUID) -> User:
        user = await self._repo.get_detail(user_id)
        if user is None:
            raise NotFoundException("User")
        return user

    async def update_user(self, user_id: uuid.UUID, data: dict[str, Any]) -> User:
        user = await self.get_user(user_id)
        if "role_id" in data and data["role_id"] is not None:
            role = await self._db.get(Role, data["role_id"])
            if not role:
                raise NotFoundException("Role")
        if "department_id" in data and data["department_id"] is not None:
            dept = await self._db.get(Department, data["department_id"])
            if not dept:
                raise NotFoundException("Department")
        if "branch_id" in data and data["branch_id"] is not None:
            branch = await self._db.get(Branch, data["branch_id"])
            if not branch:
                raise NotFoundException("Branch")
        if "reporting_manager_id" in data and data["reporting_manager_id"] is not None:
            manager = await self._db.get(User, data["reporting_manager_id"])
            if not manager or manager.is_deleted:
                raise NotFoundException("Reporting Manager")
        for key, value in data.items():
            if hasattr(user, key):
                setattr(user, key, value)
        await self._db.flush()
        # db.refresh() only reloads columns, not the eagerly-loaded `profile`
        # relationship that get_detail() attaches via selectinload — re-fetch
        # through the same path so UserDetail.model_validate can read it
        # without triggering an implicit (and here, forbidden) lazy load.
        return await self.get_user(user_id)

    async def deactivate_user(self, user_id: uuid.UUID) -> User:
        return await self.update_user(user_id, {"is_active": False, "status": "inactive"})

    async def activate_user(self, user_id: uuid.UUID) -> User:
        return await self.update_user(user_id, {"is_active": True, "status": "active"})
