"""Shared test helpers for building authenticated test clients.

Used by coverage tests and existing RBAC tests to create a real user row with
a given role and point the httpx test client at it with a real access token.
"""
from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.modules.users.models import Role
from app.utils.jwt import create_access_token
from app.utils.password import hash_password


async def get_or_create_role(db_session: AsyncSession, slug: str) -> Role:
    existing = (await db_session.execute(select(Role).where(Role.slug == slug))).scalar_one_or_none()
    if existing:
        return existing
    role = Role(name=slug.capitalize(), slug=slug, is_system=True)
    db_session.add(role)
    await db_session.flush()
    await db_session.commit()
    return role


async def make_authed_client(
    db_session: AsyncSession, client: AsyncClient, role_slug: str | None, email: str | None = None
) -> AsyncClient:
    """Creates a real User row with the requested role and authenticates `client`
    with a real access token for that user."""
    role_id = None
    if role_slug is not None:
        role = await get_or_create_role(db_session, role_slug)
        role_id = role.id

    user = User(
        id=uuid.uuid4(),
        email=email or f"{role_slug or 'norole'}-{uuid.uuid4().hex[:8]}@amplivo.com",
        username=f"{role_slug or 'norole'}_{uuid.uuid4().hex[:8]}",
        full_name="Coverage Test User",
        hashed_password=hash_password("Whatever123!"),
        is_active=True,
        is_verified=True,
        role_id=role_id,
    )
    db_session.add(user)
    await db_session.flush()
    await db_session.commit()

    token = create_access_token(user.id)
    client.headers["Authorization"] = f"Bearer {token}"
    return client


@pytest.fixture
async def admin_client(client: AsyncClient, db_session: AsyncSession) -> AsyncClient:
    return await make_authed_client(db_session, client, "admin")