from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.refresh_token import RefreshToken
from app.models.user_session import UserSession

PAYLOAD = {
    "email": "sessions.user@amplivo.com",
    "username": "sessions_user",
    "full_name": "Sessions User",
    "password": "SecurePass123",
}

CHROME_WINDOWS_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)
FIREFOX_LINUX_UA = "Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/118.0"
SAFARI_IPHONE_UA = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
)


async def _register(client: AsyncClient) -> None:
    response = await client.post("/api/v1/auth/register", json=PAYLOAD)
    assert response.status_code == 201


async def _login(client: AsyncClient, user_agent: str = CHROME_WINDOWS_UA) -> dict:
    response = await client.post(
        "/api/v1/auth/login",
        json={"identifier": PAYLOAD["email"], "password": PAYLOAD["password"]},
        headers={"User-Agent": user_agent},
    )
    assert response.status_code == 200
    return response.json()


def _auth_headers(tokens: dict) -> dict:
    return {"Authorization": f"Bearer {tokens['access_token']}"}


async def test_login_creates_a_user_session(client: AsyncClient, db_session: AsyncSession) -> None:
    await _register(client)
    await _login(client)

    result = await db_session.execute(select(UserSession))
    sessions = list(result.scalars())
    assert len(sessions) == 1
    assert sessions[0].is_active is True
    assert sessions[0].browser == "Chrome"
    assert sessions[0].operating_system == "Windows"


async def test_list_sessions_returns_only_active_sessions_for_current_user(client: AsyncClient) -> None:
    await _register(client)
    tokens = await _login(client)

    response = await client.get("/api/v1/auth/sessions", headers=_auth_headers(tokens))
    assert response.status_code == 200
    sessions = response.json()
    assert len(sessions) == 1
    assert sessions[0]["is_active"] is True


async def test_current_session_is_marked_is_current(client: AsyncClient) -> None:
    await _register(client)
    tokens = await _login(client)

    response = await client.get("/api/v1/auth/sessions", headers=_auth_headers(tokens))
    sessions = response.json()
    assert sessions[0]["is_current"] is True


async def test_multiple_device_logins_create_multiple_sessions(client: AsyncClient) -> None:
    await _register(client)
    await _login(client, user_agent=CHROME_WINDOWS_UA)
    tokens_firefox = await _login(client, user_agent=FIREFOX_LINUX_UA)
    await _login(client, user_agent=SAFARI_IPHONE_UA)

    response = await client.get("/api/v1/auth/sessions", headers=_auth_headers(tokens_firefox))
    assert response.status_code == 200
    sessions = response.json()
    assert len(sessions) == 3
    browsers = sorted(s["browser"] for s in sessions)
    assert browsers == ["Chrome", "Firefox", "Safari"]

    current_flags = [s["is_current"] for s in sessions]
    assert current_flags.count(True) == 1


async def test_logout_current_session_terminates_only_that_session(client: AsyncClient) -> None:
    await _register(client)
    tokens_chrome = await _login(client, user_agent=CHROME_WINDOWS_UA)
    tokens_firefox = await _login(client, user_agent=FIREFOX_LINUX_UA)

    response = await client.delete(
        "/api/v1/auth/sessions/current", headers=_auth_headers(tokens_chrome)
    )
    assert response.status_code == 200

    remaining = await client.get("/api/v1/auth/sessions", headers=_auth_headers(tokens_firefox))
    sessions = remaining.json()
    assert len(sessions) == 1
    assert sessions[0]["browser"] == "Firefox"


async def test_logout_current_session_revokes_its_refresh_token(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _register(client)
    tokens = await _login(client)

    await client.delete("/api/v1/auth/sessions/current", headers=_auth_headers(tokens))

    refresh_response = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    assert refresh_response.status_code == 401
    assert refresh_response.json()["error_code"] == "token_revoked"


async def test_logout_specific_session_by_id(client: AsyncClient, db_session: AsyncSession) -> None:
    await _register(client)
    tokens_chrome = await _login(client, user_agent=CHROME_WINDOWS_UA)
    tokens_firefox = await _login(client, user_agent=FIREFOX_LINUX_UA)

    sessions_response = await client.get(
        "/api/v1/auth/sessions", headers=_auth_headers(tokens_firefox)
    )
    firefox_session_id = next(
        s["id"] for s in sessions_response.json() if s["browser"] == "Firefox"
    )

    response = await client.delete(
        f"/api/v1/auth/sessions/{firefox_session_id}", headers=_auth_headers(tokens_chrome)
    )
    assert response.status_code == 200

    remaining = await client.get("/api/v1/auth/sessions", headers=_auth_headers(tokens_chrome))
    sessions = remaining.json()
    assert len(sessions) == 1
    assert sessions[0]["browser"] == "Chrome"


async def test_logout_specific_session_not_owned_by_caller_returns_404(client: AsyncClient) -> None:
    await _register(client)
    tokens = await _login(client)

    other_payload = {
        "email": "other.user@amplivo.com",
        "username": "other_user",
        "full_name": "Other User",
        "password": "SecurePass123",
    }
    await client.post("/api/v1/auth/register", json=other_payload)
    other_login = await client.post(
        "/api/v1/auth/login",
        json={"identifier": other_payload["email"], "password": other_payload["password"]},
    )
    other_tokens = other_login.json()

    my_sessions = await client.get("/api/v1/auth/sessions", headers=_auth_headers(tokens))
    my_session_id = my_sessions.json()[0]["id"]

    response = await client.delete(
        f"/api/v1/auth/sessions/{my_session_id}", headers=_auth_headers(other_tokens)
    )
    assert response.status_code == 404
    assert response.json()["error_code"] == "session_not_found"


async def test_logout_nonexistent_session_returns_404(client: AsyncClient) -> None:
    await _register(client)
    tokens = await _login(client)

    response = await client.delete(
        "/api/v1/auth/sessions/00000000-0000-0000-0000-000000000000",
        headers=_auth_headers(tokens),
    )
    assert response.status_code == 404


async def test_logout_all_sessions_terminates_every_session_except_current(
    client: AsyncClient,
) -> None:
    await _register(client)
    tokens_chrome = await _login(client, user_agent=CHROME_WINDOWS_UA)
    await _login(client, user_agent=FIREFOX_LINUX_UA)
    await _login(client, user_agent=SAFARI_IPHONE_UA)

    response = await client.delete("/api/v1/auth/sessions", headers=_auth_headers(tokens_chrome))
    assert response.status_code == 200
    assert "2" in response.json()["message"]

    remaining = await client.get("/api/v1/auth/sessions", headers=_auth_headers(tokens_chrome))
    sessions = remaining.json()
    assert len(sessions) == 1
    assert sessions[0]["browser"] == "Chrome"
    assert sessions[0]["is_current"] is True


async def test_logout_all_sessions_revokes_other_refresh_tokens(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _register(client)
    tokens_chrome = await _login(client, user_agent=CHROME_WINDOWS_UA)
    tokens_firefox = await _login(client, user_agent=FIREFOX_LINUX_UA)

    await client.delete("/api/v1/auth/sessions", headers=_auth_headers(tokens_chrome))

    refresh_response = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens_firefox["refresh_token"]}
    )
    assert refresh_response.status_code == 401
    assert refresh_response.json()["error_code"] == "token_revoked"

    still_works = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens_chrome["refresh_token"]}
    )
    assert still_works.status_code == 200


async def test_devices_endpoint_includes_inactive_sessions(client: AsyncClient) -> None:
    await _register(client)
    tokens = await _login(client, user_agent=CHROME_WINDOWS_UA)
    await client.delete("/api/v1/auth/sessions/current", headers=_auth_headers(tokens))

    new_tokens = await _login(client, user_agent=FIREFOX_LINUX_UA)
    response = await client.get("/api/v1/auth/devices", headers=_auth_headers(new_tokens))
    assert response.status_code == 200
    devices = response.json()
    assert len(devices) == 2
    active_flags = sorted(d["is_active"] for d in devices)
    assert active_flags == [False, True]


async def test_sessions_require_authentication(client: AsyncClient) -> None:
    response = await client.get("/api/v1/auth/sessions")
    assert response.status_code in (401, 403)


async def test_session_expires_at_matches_refresh_token_expiry(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _register(client)
    await _login(client)

    result = await db_session.execute(select(UserSession))
    session = result.scalar_one()
    result = await db_session.execute(select(RefreshToken))
    refresh_token = result.scalar_one()

    assert session.expires_at == refresh_token.expires_at
    assert session.refresh_token_id == refresh_token.id


async def test_sessions_and_devices_with_null_metadata(client: AsyncClient, db_session: AsyncSession) -> None:
    await _register(client)
    tokens = await _login(client)

    from sqlalchemy import update
    await db_session.execute(
        update(UserSession).values(
            device_name=None,
            browser=None,
            operating_system=None,
            ip_address=None,
            country=None,
            city=None
        )
    )
    await db_session.commit()

    response = await client.get("/api/v1/auth/sessions", headers=_auth_headers(tokens))
    assert response.status_code == 200
    sessions = response.json()
    assert len(sessions) == 1
    assert sessions[0]["device_name"] is None
    assert sessions[0]["browser"] is None
    assert sessions[0]["operating_system"] is None
    assert sessions[0]["ip_address"] is None
    assert sessions[0]["country"] is None
    assert sessions[0]["city"] is None

    response_devices = await client.get("/api/v1/auth/devices", headers=_auth_headers(tokens))
    assert response_devices.status_code == 200
    devices = response_devices.json()
    assert len(devices) == 1
    assert devices[0]["device_name"] is None
    assert devices[0]["browser"] is None


async def test_user_with_zero_sessions(client: AsyncClient, db_session: AsyncSession) -> None:
    await _register(client)
    
    from app.models.user import User
    result = await db_session.execute(select(User).where(User.email == PAYLOAD["email"]))
    user = result.scalar_one()

    from app.utils.jwt import create_access_token
    token = create_access_token(user_id=user.id, session_id=None)
    tokens = {"access_token": token}

    response = await client.get("/api/v1/auth/sessions", headers=_auth_headers(tokens))
    assert response.status_code == 200
    assert response.json() == []


async def test_sessions_with_invalid_token(client: AsyncClient) -> None:
    response = await client.get("/api/v1/auth/sessions", headers={"Authorization": "Bearer invalid_token_here"})
    assert response.status_code in (401, 403)


async def test_authenticated_user_complete_session_metadata(client: AsyncClient, db_session: AsyncSession) -> None:
    await _register(client)
    tokens = await _login(client, user_agent=CHROME_WINDOWS_UA)

    from sqlalchemy import update
    await db_session.execute(
        update(UserSession).values(
            device_name="My Test Device",
            browser="Chrome",
            operating_system="Windows",
            ip_address="192.168.1.1",
            country="United States",
            city="New York"
        )
    )
    await db_session.commit()

    response = await client.get("/api/v1/auth/sessions", headers=_auth_headers(tokens))
    assert response.status_code == 200
    sessions = response.json()
    assert len(sessions) == 1
    assert sessions[0]["device_name"] == "My Test Device"
    assert sessions[0]["browser"] == "Chrome"
    assert sessions[0]["operating_system"] == "Windows"
    assert sessions[0]["ip_address"] == "192.168.1.1"
    assert sessions[0]["country"] == "United States"
    assert sessions[0]["city"] == "New York"
