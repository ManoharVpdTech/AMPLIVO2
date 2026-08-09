"""Idempotent seed for every account the frontend's login page offers as a
"Demo Credentials" quick-fill (see frontend/src/app/login/page.tsx):
admin, hr, employee, sales, crm, and the marketing job-title logins.

Safe to run any number of times, and safe to call from FastAPI startup -
every row is looked up by its natural key (role slug, branch code,
department slug, user email) before being created, so re-running never
duplicates or overwrites existing data.
"""

from __future__ import annotations

import logging
import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.modules.users.models import Branch, Department, Role, UserProfile
from app.utils.password import hash_password
from app.utils.time import utc_now

logger = logging.getLogger("app.scripts.seed_demo_data")

# ── Master roles table ──────────────────────────────────────────────────
# `role.name` (lowercased) must be one of the VALID_ROLES the frontend
# understands (frontend/src/services/authService.ts) - anything else makes
# mapRole() silently fall back to 'admin' and misroute the dashboard.
ROLES = [
    {"name": "Admin", "slug": "admin", "description": "Full system access", "is_system": True},
    {"name": "Client", "slug": "client", "description": "Client portal user", "is_system": True},
    {"name": "Sales", "slug": "sales", "description": "Sales team member", "is_system": True},
    {"name": "HR", "slug": "hr", "description": "Human Resources manager", "is_system": True},
    {"name": "Employee", "slug": "employee", "description": "Internal employee", "is_system": True},
    {"name": "CRM", "slug": "crm", "description": "CRM portal executive", "is_system": True},
    {"name": "Finance", "slug": "finance", "description": "Finance/accounts executive - verifies client payments", "is_system": True},
    # Backend RBAC role for marketing-content/automation routes
    # (app.modules.case_studies/faqs/portfolio/testimonials/marketing_automation
    # now gate their mutating routes with require_roles("marketing", "employee")
    # - see those modules for why "employee" is also allowed). Deliberately not
    # assigned to any demo user below: frontend/src/services/authService.ts's
    # VALID_ROLES doesn't include "marketing" yet, and its mapRole() silently
    # falls back to 'admin' for any role it doesn't recognize (same pre-existing
    # gap already affects "finance") - assigning a demo user to this role would
    # make them appear as admin in the UI. Add "marketing" (and "finance") to
    # that frontend list before moving any real user onto this role.
    {"name": "Marketing", "slug": "marketing", "description": "Marketing team member - manages site content and automation workflows", "is_system": True},
]

BRANCHES = [
    {"name": "Head Office", "code": "HQ", "city": "Hyderabad", "state": "Telangana", "country": "India", "is_headquarters": True},
]

DEPARTMENTS = [
    {"name": "Administration", "slug": "administration", "description": "Company administration"},
    {"name": "Human Resources", "slug": "human-resources", "description": "Hiring, onboarding and people operations"},
    {"name": "Sales", "slug": "sales", "description": "New business and revenue"},
    {"name": "Client Relations", "slug": "client-relations", "description": "CRM and account management"},
    {"name": "Marketing", "slug": "marketing", "description": "Performance, SEO, content and creative delivery"},
    {"name": "Finance", "slug": "finance", "description": "Invoicing, payments and payment verification"},
]

# Every account the login page's demo-credential UI can fill in.
# NOTE: the CRM demo password is 8 chars to satisfy LoginRequest's
# min_length=8 (frontend/src/app/login/page.tsx must use the same value).
DEMO_USERS = [
    {"email": "admin@amplivo.in", "username": "admin", "full_name": "Admin User", "password": "Amplivo!Admin2026",
     "role_slug": "admin", "department_slug": "administration", "designation": "Administrator"},
    {"email": "hr@amplivo.in", "username": "hr", "full_name": "HR Manager", "password": "Amplivo!Hr2026",
     "role_slug": "hr", "department_slug": "human-resources", "designation": "HR Manager"},
    {"email": "employee@amplivo.in", "username": "employee", "full_name": "Employee User", "password": "Amplivo!Emp2026",
     "role_slug": "employee", "department_slug": "marketing", "designation": "Employee"},
    {"email": "sales@amplivo.in", "username": "sales", "full_name": "Sales User", "password": "Amplivo!Sales2026",
     "role_slug": "sales", "department_slug": "sales", "designation": "Sales Executive"},
    {"email": "crm@amplivo.in", "username": "crm", "full_name": "Account Manager", "password": "Amplivo!Crm2026",
     "role_slug": "crm", "department_slug": "client-relations", "designation": "Account Manager"},
    {"email": "finance@amplivo.in", "username": "finance", "full_name": "Finance Executive", "password": "Amplivo!Fin2026",
     "role_slug": "finance", "department_slug": "finance", "designation": "Finance Executive"},
    {"email": "performancemarketer@amplivo.in", "username": "performancemarketer", "full_name": "Performance Marketer", "password": "Amplivo!Emp2026",
     "role_slug": "employee", "department_slug": "marketing", "designation": "Performance Marketer"},
    {"email": "digitalmarketingstrategist@amplivo.in", "username": "digitalmarketingstrategist", "full_name": "Digital Marketing Strategist", "password": "Amplivo!Emp2026",
     "role_slug": "employee", "department_slug": "marketing", "designation": "Digital Marketing Strategist"},
    {"email": "seospecialist@amplivo.in", "username": "seospecialist", "full_name": "SEO Specialist", "password": "Amplivo!Emp2026",
     "role_slug": "employee", "department_slug": "marketing", "designation": "SEO Specialist"},
    {"email": "contentwriter@amplivo.in", "username": "contentwriter", "full_name": "Content Writer", "password": "Amplivo!Emp2026",
     "role_slug": "employee", "department_slug": "marketing", "designation": "Content Writer"},
    {"email": "influencermanager@amplivo.in", "username": "influencermanager", "full_name": "Influencer Manager", "password": "Amplivo!Emp2026",
     "role_slug": "employee", "department_slug": "marketing", "designation": "Influencer Manager"},
]

# Client demo user (client@amplivo.in) is deliberately out of scope here -
# it is seeded together with its Client company row by seed_client_portal_demo.py,
# which also needs a `clients` row to link client_id to.


async def _get_or_create_role(session: AsyncSession, data: dict) -> Role:
    existing = (await session.execute(select(Role).where(Role.slug == data["slug"]))).scalar_one_or_none()
    if existing:
        return existing
    role = Role(**data)
    session.add(role)
    await session.flush()
    logger.info("Created role '%s' (%s)", data["name"], role.id)
    return role


async def _get_or_create_branch(session: AsyncSession, data: dict) -> Branch:
    existing = (await session.execute(select(Branch).where(Branch.code == data["code"]))).scalar_one_or_none()
    if existing:
        return existing
    branch = Branch(**data)
    session.add(branch)
    await session.flush()
    logger.info("Created branch '%s' (%s)", data["name"], branch.id)
    return branch


async def _get_or_create_department(session: AsyncSession, data: dict) -> Department:
    existing = (await session.execute(select(Department).where(Department.slug == data["slug"]))).scalar_one_or_none()
    if existing:
        return existing
    department = Department(**data)
    session.add(department)
    await session.flush()
    logger.info("Created department '%s' (%s)", data["name"], department.id)
    return department


async def seed_demo_data(session: AsyncSession) -> dict[str, int]:
    """Ensure every demo role/branch/department/user the frontend expects exists.

    Returns a summary of how many rows of each kind were newly created
    (idempotent - a rerun against fully-seeded data returns all zeros).
    """
    created = {"roles": 0, "branches": 0, "departments": 0, "users": 0, "profiles": 0}

    role_map: dict[str, Role] = {}
    for role_data in ROLES:
        before = (await session.execute(select(Role).where(Role.slug == role_data["slug"]))).scalar_one_or_none()
        role = await _get_or_create_role(session, role_data)
        role_map[role_data["slug"]] = role
        if before is None:
            created["roles"] += 1
    await session.commit()

    branch = None
    for branch_data in BRANCHES:
        before = (await session.execute(select(Branch).where(Branch.code == branch_data["code"]))).scalar_one_or_none()
        branch = await _get_or_create_branch(session, branch_data)
        if before is None:
            created["branches"] += 1
    await session.commit()

    department_map: dict[str, Department] = {}
    for dept_data in DEPARTMENTS:
        before = (await session.execute(select(Department).where(Department.slug == dept_data["slug"]))).scalar_one_or_none()
        department = await _get_or_create_department(session, dept_data)
        department_map[dept_data["slug"]] = department
        if before is None:
            created["departments"] += 1
    await session.commit()

    for user_data in DEMO_USERS:
        role = role_map[user_data["role_slug"]]
        department = department_map[user_data["department_slug"]]

        existing = (await session.execute(select(User).where(User.email == user_data["email"]))).scalar_one_or_none()

        if existing is None:
            user = User(
                id=uuid.uuid4(),
                email=user_data["email"],
                username=user_data["username"],
                full_name=user_data["full_name"],
                hashed_password=hash_password(user_data["password"]),
                user_type="internal",
                status="active",
                role_id=role.id,
                department_id=department.id,
                branch_id=branch.id if branch else None,
                is_active=True,
                is_verified=True,
                verified_at=utc_now(),
            )
            session.add(user)
            await session.flush()
            created["users"] += 1
            logger.info(
                "Created demo user '%s' (%s) role=%s department=%s",
                user_data["email"], user.id, user_data["role_slug"], user_data["department_slug"],
            )
        else:
            # Repair rather than skip: a demo account can already exist as a
            # bare row (e.g. from an earlier partial seed/test run) without
            # the role/org-structure/password it needs to actually log in
            # and land on the right dashboard.
            user = existing
            user.hashed_password = hash_password(user_data["password"])
            user.role_id = role.id
            user.department_id = department.id
            user.branch_id = branch.id if branch else user.branch_id
            user.is_active = True
            if not user.is_verified:
                user.is_verified = True
                user.verified_at = utc_now()
            await session.flush()
            logger.info("Repaired demo user '%s' (%s)", user_data["email"], user.id)

        profile = (await session.execute(select(UserProfile).where(UserProfile.user_id == user.id))).scalar_one_or_none()
        if profile is None:
            session.add(UserProfile(
                user_id=user.id,
                full_name=user_data["full_name"],
                designation=user_data["designation"],
                date_of_joining=date.today(),
            ))
            created["profiles"] += 1
        elif profile.designation != user_data["designation"]:
            profile.designation = user_data["designation"]

    await session.commit()
    return created
