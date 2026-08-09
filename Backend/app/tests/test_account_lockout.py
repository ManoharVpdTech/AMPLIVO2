from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.middleware.rate_limiter import reset_rate_limit_state
from app.models.user import User

PAYLOAD = {
    "email": "lockout.user@amplivo.com",
    "username": "lockout_user",
    "full_name": "Lockout User",
    "password": "CorrectPass123",
}


async def _register(client: AsyncClient) -> None:
    response = await client.post("/api/v1/auth/register", json=PAYLOAD)
    assert response.status_code == 201


async def _fail_login(client: AsyncClient) -> None:
    return await client.post(
        "/api/v1/auth/login",
        json={"identifier": PAYLOAD["email"], "password": "WrongPassword1"},
    )


async def test_account_locks_after_max_failed_attempts(client: AsyncClient) -> None:
    await _register(client)

    for _ in range(settings.MAX_FAILED_LOGIN_ATTEMPTS):
        response = await _fail_login(client)
        assert response.status_code == 401

    # This test isolates lockout behavior from rate limiting (covered in
    # test_rate_limiting.py), and the two thresholds happen to coincide.
    reset_rate_limit_state()
    locked_response = await client.post(
        "/api/v1/auth/login",
        json={"identifier": PAYLOAD["email"], "password": "WrongPasswordAgain"},
    )
    assert locked_response.status_code == 423
    assert locked_response.json()["error_code"] == "account_locked"
    assert "Retry-After" in locked_response.headers


async def test_locked_account_allows_correct_password(client: AsyncClient) -> None:
    await _register(client)

    for _ in range(settings.MAX_FAILED_LOGIN_ATTEMPTS):
        await _fail_login(client)

    reset_rate_limit_state()
    response = await client.post(
        "/api/v1/auth/login",
        json={"identifier": PAYLOAD["email"], "password": PAYLOAD["password"]},
    )
    assert response.status_code == 200


async def test_failed_login_increments_counter(client: AsyncClient, db_session: AsyncSession) -> None:
    await _register(client)
    await _fail_login(client)
    await _fail_login(client)

    result = await db_session.execute(select(User).where(User.email == PAYLOAD["email"]))
    user = result.scalar_one()
    assert user.failed_login_attempts == 2
    assert user.last_failed_login is not None


async def test_successful_login_resets_failed_attempts(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _register(client)
    await _fail_login(client)
    await _fail_login(client)

    response = await client.post(
        "/api/v1/auth/login",
        json={"identifier": PAYLOAD["email"], "password": PAYLOAD["password"]},
    )
    assert response.status_code == 200

    result = await db_session.execute(select(User).where(User.email == PAYLOAD["email"]))
    user = result.scalar_one()
    assert user.failed_login_attempts == 0
    assert user.last_failed_login is None
    assert user.locked_until is None


async def test_wrong_password_for_unknown_user_does_not_lock_anything(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "nobody@amplivo.com", "password": "WhoKnows123"},
    )
    assert response.status_code == 401
    assert response.json()["error_code"] == "invalid_credentials"
