from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditAction, AuditLog
from app.models.refresh_token import RefreshToken
from app.models.user_session import UserSession
from app.services.email_service import get_outbox

PAYLOAD = {
    "email": "activity.user@amplivo.com",
    "username": "activity_user",
    "full_name": "Activity User",
    "password": "OldSecure123",
}


async def _register(client: AsyncClient) -> None:
    response = await client.post("/api/v1/auth/register", json=PAYLOAD)
    assert response.status_code == 201


async def _login(client: AsyncClient) -> dict:
    response = await client.post(
        "/api/v1/auth/login",
        json={"identifier": PAYLOAD["email"], "password": PAYLOAD["password"]},
    )
    assert response.status_code == 200
    return response.json()


async def test_refresh_reassigns_session_to_new_refresh_token(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _register(client)
    tokens = await _login(client)

    result = await db_session.execute(select(UserSession))
    session_before = result.scalar_one()
    old_refresh_token_id = session_before.refresh_token_id
    session_id = session_before.id

    refresh_response = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    assert refresh_response.status_code == 200

    db_session.expire_all()
    result = await db_session.execute(select(UserSession))
    sessions = list(result.scalars())
    assert len(sessions) == 1
    session_after = sessions[0]
    assert session_after.id == session_id
    assert session_after.refresh_token_id != old_refresh_token_id
    assert session_after.is_active is True


async def test_refresh_updates_session_expires_at_to_match_new_token(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _register(client)
    tokens = await _login(client)

    await client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]})

    db_session.expire_all()
    result = await db_session.execute(select(UserSession))
    session = result.scalar_one()
    result = await db_session.execute(
        select(RefreshToken).where(RefreshToken.id == session.refresh_token_id)
    )
    new_refresh_token = result.scalar_one()

    assert session.expires_at == new_refresh_token.expires_at


async def test_refresh_touches_old_refresh_token_last_used(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _register(client)
    tokens = await _login(client)

    result = await db_session.execute(select(RefreshToken))
    old_token = result.scalar_one()
    old_token_id = old_token.id
    assert old_token.last_used is not None

    await client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]})

    db_session.expire_all()
    result = await db_session.execute(select(RefreshToken).where(RefreshToken.id == old_token_id))
    old_token_after = result.scalar_one()
    assert old_token_after.is_revoked is True
    assert old_token_after.last_used is not None


async def test_authenticated_request_touches_session_last_activity(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _register(client)
    tokens = await _login(client)

    result = await db_session.execute(select(UserSession))
    session_after_login = result.scalar_one()
    activity_after_login = session_after_login.last_activity

    me_response = await client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {tokens['access_token']}"}
    )
    assert me_response.status_code == 200

    db_session.expire_all()
    result = await db_session.execute(select(UserSession))
    session_after_request = result.scalar_one()
    assert session_after_request.last_activity >= activity_after_login


async def test_activity_middleware_does_not_touch_inactive_sessions(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _register(client)
    tokens = await _login(client)

    logout_response = await client.delete(
        "/api/v1/auth/sessions/current", headers={"Authorization": f"Bearer {tokens['access_token']}"}
    )
    assert logout_response.status_code == 200

    result = await db_session.execute(select(UserSession))
    session = result.scalar_one()
    assert session.is_active is False


async def test_password_reset_revokes_all_sessions(client: AsyncClient, db_session: AsyncSession) -> None:
    await _register(client)
    tokens = await _login(client)

    await client.post("/api/v1/auth/forgot-password", json={"email": PAYLOAD["email"]})
    reset_token = get_outbox()[-1].token
    reset_response = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": reset_token, "new_password": "NewSecure!Pass1"},
    )
    assert reset_response.status_code == 200

    result = await db_session.execute(select(UserSession))
    session = result.scalar_one()
    assert session.is_active is False

    # Password reset revokes the session, so the old access token is now invalid and returns 401.
    sessions_response = await client.get(
        "/api/v1/auth/sessions", headers={"Authorization": f"Bearer {tokens['access_token']}"}
    )
    assert sessions_response.status_code == 401


async def test_password_reset_creates_session_revoked_audit_log(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _register(client)
    await _login(client)

    await client.post("/api/v1/auth/forgot-password", json={"email": PAYLOAD["email"]})
    reset_token = get_outbox()[-1].token
    await client.post(
        "/api/v1/auth/reset-password",
        json={"token": reset_token, "new_password": "NewSecure!Pass1"},
    )

    result = await db_session.execute(
        select(AuditLog).where(AuditLog.action == AuditAction.SESSION_REVOKED.value)
    )
    assert len(list(result.scalars())) == 1
