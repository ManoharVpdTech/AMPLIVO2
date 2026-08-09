from datetime import timedelta

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.dependencies.services import get_audit_service
from app.models.audit_log import AuditAction, AuditLog
from app.models.user_session import UserSession
from app.repositories.user_session_repository import UserSessionRepository
from app.services.session_expiry_service import SessionExpiryService
from app.utils.time import utc_now

PAYLOAD = {
    "email": "expiry.user@amplivo.com",
    "username": "expiry_user",
    "full_name": "Expiry User",
    "password": "SecurePass123",
}


async def _register_and_login(client: AsyncClient) -> None:
    response = await client.post("/api/v1/auth/register", json=PAYLOAD)
    assert response.status_code == 201
    response = await client.post(
        "/api/v1/auth/login",
        json={"identifier": PAYLOAD["email"], "password": PAYLOAD["password"]},
    )
    assert response.status_code == 200


def _build_expiry_service(db_session: AsyncSession) -> SessionExpiryService:
    return SessionExpiryService(
        db_session, UserSessionRepository(db_session), get_audit_service(db_session)
    )


async def test_expire_stale_sessions_marks_inactive_session_as_expired(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _register_and_login(client)

    result = await db_session.execute(select(UserSession))
    session = result.scalar_one()
    session.last_activity = utc_now() - timedelta(minutes=settings.SESSION_INACTIVITY_TIMEOUT_MINUTES + 5)
    await db_session.commit()

    service = _build_expiry_service(db_session)
    count = await service.expire_stale_sessions()
    assert count == 1

    result = await db_session.execute(select(UserSession))
    refreshed = result.scalar_one()
    assert refreshed.is_active is False


async def test_expire_stale_sessions_ignores_recently_active_sessions(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _register_and_login(client)

    service = _build_expiry_service(db_session)
    count = await service.expire_stale_sessions()
    assert count == 0

    result = await db_session.execute(select(UserSession))
    session = result.scalar_one()
    assert session.is_active is True


async def test_expire_stale_sessions_expires_sessions_past_expires_at(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _register_and_login(client)

    result = await db_session.execute(select(UserSession))
    session = result.scalar_one()
    # Still recently active, but its hard expiry has passed.
    session.expires_at = utc_now() - timedelta(minutes=1)
    await db_session.commit()

    service = _build_expiry_service(db_session)
    count = await service.expire_stale_sessions()
    assert count == 1


async def test_expire_stale_sessions_creates_audit_log(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _register_and_login(client)

    result = await db_session.execute(select(UserSession))
    session = result.scalar_one()
    session.last_activity = utc_now() - timedelta(minutes=settings.SESSION_INACTIVITY_TIMEOUT_MINUTES + 5)
    await db_session.commit()

    service = _build_expiry_service(db_session)
    await service.expire_stale_sessions()

    result = await db_session.execute(
        select(AuditLog).where(AuditLog.action == AuditAction.SESSION_EXPIRED.value)
    )
    logs = list(result.scalars())
    assert len(logs) == 1
    assert logs[0].action == AuditAction.SESSION_EXPIRED.value
