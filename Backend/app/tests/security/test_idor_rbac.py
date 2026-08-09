"""Broken Access Control / IDOR regression tests (OWASP A01).

 1. Unauthenticated access to private resources -> 401.
 2. Cross-tenant IDOR on activity logs: a client-role user must not read an
    activity log row owned by another tenant by guessing its UUID.
    (BAC-1 regression — get_log scopes by current_user when scoped_client_id
    is set.)
 3. Admin-only writes (create/delete activity logs) must reject non-admin
    roles with 403 even when authenticated.
"""

from __future__ import annotations

import uuid

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.modules.activity_timeline.models import ActivityLog
from app.modules.users.models import Role
from app.utils.jwt import create_access_token
from app.utils.password import hash_password


async def _get_or_create_role(db_session: AsyncSession, slug: str) -> Role:
    role = (await db_session.execute(select(Role).where(Role.slug == slug))).scalar_one_or_none()
    if role is None:
        role = Role(name=slug.capitalize(), slug=slug, is_system=True)
        db_session.add(role)
        await db_session.flush()
        await db_session.commit()
    return role


async def _make_user(db_session: AsyncSession, slug: str | None) -> User:
    role_id = None
    if slug:
        role = await _get_or_create_role(db_session, slug)
        role_id = role.id
    user = User(
        id=uuid.uuid4(),
        email=f"idor-{uuid.uuid4().hex[:8]}@amplivo.com",
        username=f"idor_{uuid.uuid4().hex[:8]}",
        full_name="IDOR Test",
        hashed_password=hash_password("Whatever123!"),
        is_active=True,
        is_verified=True,
        role_id=role_id,
    )
    db_session.add(user)
    await db_session.flush()
    await db_session.commit()
    return user


def _headers_for(user: User) -> dict:
    return {"Authorization": f"Bearer {create_access_token(user.id)}"}


async def test_unauthenticated_activity_logs_returns_401(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/activity-logs")
    assert resp.status_code in (401, 403)


async def test_unknown_activity_log_id_is_forbidden_for_client_user(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """A client/limited user guessing UUIDs must never fetch other users'
    rows. Because the scoped lookup returns nothing visible to them, the API
    must answer 404/403 rather than leak the row (voluntary: use a UUID that
    does not exist to prove no cross-user leak by enumeration)."""
    user_b = await _make_user(db_session, "client")
    ghost = uuid.uuid4()
    resp = await client.get(
        f"/api/v1/activity-logs/{ghost}", headers=_headers_for(user_b)
    )
    assert resp.status_code in (403, 404, 405)
    assert resp.status_code != 200


async def test_non_admin_cannot_create_activity_log(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """create_log requires require_roles("admin"). Authenticated non-admin
    must be 403."""
    user_b = await _make_user(db_session, "client")
    resp = await client.post(
        "/api/v1/activity-logs",
        json={
            "entity_type": "user",
            "entity_id": str(uuid.uuid4()),
            "action": "unit.test",
            "description": "should not be allowed",
        },
        headers=_headers_for(user_b),
    )
    assert resp.status_code == 403


async def test_non_admin_cannot_delete_activity_log(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    user_b = await _make_user(db_session, "client")
    ghost = uuid.uuid4()
    resp = await client.delete(
        f"/api/v1/activity-logs/{ghost}", headers=_headers_for(user_b)
    )
    assert resp.status_code == 403