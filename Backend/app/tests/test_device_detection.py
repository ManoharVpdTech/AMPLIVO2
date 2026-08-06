from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditAction, AuditLog

PAYLOAD = {
    "email": "device.detect@amplivo.com",
    "username": "device_detect",
    "full_name": "Device Detect",
    "password": "SecurePass123",
}

CHROME_WINDOWS_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)
FIREFOX_LINUX_UA = "Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/118.0"


async def _register(client: AsyncClient) -> None:
    response = await client.post("/api/v1/auth/register", json=PAYLOAD)
    assert response.status_code == 201


async def _login(client: AsyncClient, user_agent: str) -> None:
    response = await client.post(
        "/api/v1/auth/login",
        json={"identifier": PAYLOAD["email"], "password": PAYLOAD["password"]},
        headers={"User-Agent": user_agent},
    )
    assert response.status_code == 200


async def _new_device_logs(db_session: AsyncSession) -> list[AuditLog]:
    result = await db_session.execute(
        select(AuditLog).where(AuditLog.action == AuditAction.NEW_DEVICE_LOGIN.value)
    )
    return list(result.scalars())


async def test_first_login_is_logged_as_new_device(client: AsyncClient, db_session: AsyncSession) -> None:
    await _register(client)
    await _login(client, CHROME_WINDOWS_UA)

    logs = await _new_device_logs(db_session)
    assert len(logs) == 1
    assert logs[0].action == AuditAction.NEW_DEVICE_LOGIN.value


async def test_repeat_login_from_same_device_is_not_logged_as_new(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _register(client)
    await _login(client, CHROME_WINDOWS_UA)
    await _login(client, CHROME_WINDOWS_UA)

    logs = await _new_device_logs(db_session)
    assert len(logs) == 1


async def test_login_from_a_second_device_is_logged_as_new(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _register(client)
    await _login(client, CHROME_WINDOWS_UA)
    await _login(client, FIREFOX_LINUX_UA)

    logs = await _new_device_logs(db_session)
    assert len(logs) == 2


async def test_new_device_login_still_creates_login_success_log(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _register(client)
    await _login(client, CHROME_WINDOWS_UA)

    result = await db_session.execute(
        select(AuditLog).where(AuditLog.action == AuditAction.LOGIN_SUCCESS.value)
    )
    assert len(list(result.scalars())) == 1
