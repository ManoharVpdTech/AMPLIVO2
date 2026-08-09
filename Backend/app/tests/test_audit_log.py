from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditAction, AuditLog, AuditStatus

PAYLOAD = {
    "email": "audit.user@amplivo.com",
    "username": "audit_user",
    "full_name": "Audit User",
    "password": "SecurePass123",
}


async def _register(client: AsyncClient) -> None:
    response = await client.post("/api/v1/auth/register", json=PAYLOAD)
    assert response.status_code == 201


async def _get_logs_for_action(db_session: AsyncSession, action: AuditAction) -> list[AuditLog]:
    result = await db_session.execute(select(AuditLog).where(AuditLog.action == action.value))
    return list(result.scalars())


async def test_successful_registration_creates_audit_log(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _register(client)

    logs = await _get_logs_for_action(db_session, AuditAction.REGISTER)
    assert len(logs) == 1
    assert logs[0].action == AuditAction.REGISTER.value
    assert logs[0].performed_by is not None


async def test_successful_login_creates_audit_log(client: AsyncClient, db_session: AsyncSession) -> None:
    await _register(client)
    response = await client.post(
        "/api/v1/auth/login",
        json={"identifier": PAYLOAD["email"], "password": PAYLOAD["password"]},
    )
    assert response.status_code == 200

    logs = await _get_logs_for_action(db_session, AuditAction.LOGIN_SUCCESS)
    assert len(logs) == 1
    assert logs[0].action == AuditAction.LOGIN_SUCCESS.value


async def test_failed_login_creates_audit_log(client: AsyncClient, db_session: AsyncSession) -> None:
    await _register(client)
    response = await client.post(
        "/api/v1/auth/login",
        json={"identifier": PAYLOAD["email"], "password": "WrongPassword1"},
    )
    assert response.status_code == 401

    logs = await _get_logs_for_action(db_session, AuditAction.LOGIN_FAILED)
    assert len(logs) == 1
    assert logs[0].action == AuditAction.LOGIN_FAILED.value


async def test_logout_creates_audit_log(client: AsyncClient, db_session: AsyncSession) -> None:
    await _register(client)
    login_response = await client.post(
        "/api/v1/auth/login",
        json={"identifier": PAYLOAD["email"], "password": PAYLOAD["password"]},
    )
    refresh_token = login_response.json()["refresh_token"]

    logout_response = await client.post("/api/v1/auth/logout", json={"refresh_token": refresh_token})
    assert logout_response.status_code == 200

    logs = await _get_logs_for_action(db_session, AuditAction.LOGOUT)
    assert len(logs) == 1
    assert logs[0].action == AuditAction.LOGOUT.value


async def test_invalid_token_creates_audit_log(client: AsyncClient, db_session: AsyncSession) -> None:
    response = await client.get(
        "/api/v1/auth/me", headers={"Authorization": "Bearer not-a-real-token"}
    )
    assert response.status_code == 401

    logs = await _get_logs_for_action(db_session, AuditAction.INVALID_TOKEN)
    assert len(logs) == 1
    assert logs[0].action == AuditAction.INVALID_TOKEN.value


async def test_refresh_token_success_creates_audit_log(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _register(client)
    login_response = await client.post(
        "/api/v1/auth/login",
        json={"identifier": PAYLOAD["email"], "password": PAYLOAD["password"]},
    )
    refresh_token = login_response.json()["refresh_token"]

    refresh_response = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert refresh_response.status_code == 200

    logs = await _get_logs_for_action(db_session, AuditAction.REFRESH_TOKEN)
    assert len(logs) == 1
    assert logs[0].action == AuditAction.REFRESH_TOKEN.value
