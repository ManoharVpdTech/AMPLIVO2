from httpx import ASGITransport, AsyncClient
from starlette.applications import Starlette
from starlette.responses import PlainTextResponse
from starlette.routing import Route

from app.core.config import settings
from app.middleware.rate_limiter import RateLimiterMiddleware, RateLimitRule, reset_rate_limit_state


async def test_login_rate_limit_returns_429_after_limit(client: AsyncClient) -> None:
    payload = {"identifier": "nobody@amplivo.com", "password": "WrongPassword1"}

    for _ in range(settings.RATE_LIMIT_LOGIN_PER_MINUTE):
        response = await client.post("/api/v1/auth/login", json=payload)
        assert response.status_code == 401

    limited_response = await client.post("/api/v1/auth/login", json=payload)
    assert limited_response.status_code == 429
    assert limited_response.json()["error_code"] == "rate_limit_exceeded"


async def test_register_rate_limit_returns_429_after_limit(client: AsyncClient) -> None:
    for i in range(settings.RATE_LIMIT_REGISTER_PER_MINUTE):
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": f"burst{i}@amplivo.com",
                "username": f"burst_user_{i}",
                "full_name": "Burst User",
                "password": "SecurePass123",
            },
        )
        assert response.status_code == 201

    limited_response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "overflow@amplivo.com",
            "username": "overflow_user",
            "full_name": "Overflow User",
            "password": "SecurePass123",
        },
    )
    assert limited_response.status_code == 429
    assert limited_response.json()["error_code"] == "rate_limit_exceeded"


async def test_refresh_rate_limit_returns_429_after_limit(client: AsyncClient) -> None:
    for _ in range(settings.RATE_LIMIT_REFRESH_PER_MINUTE):
        response = await client.post("/api/v1/auth/refresh", json={"refresh_token": "garbage-token"})
        assert response.status_code == 401

    limited_response = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": "garbage-token"}
    )
    assert limited_response.status_code == 429


async def test_login_rate_limit_returns_retry_after_header(client: AsyncClient) -> None:
    payload = {"identifier": "nobody@amplivo.com", "password": "WrongPassword1"}
    for _ in range(settings.RATE_LIMIT_LOGIN_PER_MINUTE):
        await client.post("/api/v1/auth/login", json=payload)

    limited_response = await client.post("/api/v1/auth/login", json=payload)
    assert limited_response.status_code == 429
    retry_after = limited_response.headers.get("retry-after")
    assert retry_after is not None
    assert 1 <= int(retry_after) <= 60


async def test_contact_form_submission_rate_limit_returns_429_after_limit(client: AsyncClient) -> None:
    payload = {"name": "Test", "email": "test@example.com", "message": "hi"}
    for _ in range(settings.RATE_LIMIT_FORM_SUBMISSION_PER_MINUTE):
        await client.post("/api/v1/contact-submissions", json=payload)

    limited_response = await client.post("/api/v1/contact-submissions", json=payload)
    assert limited_response.status_code == 429
    assert limited_response.json()["error_code"] == "rate_limit_exceeded"
    assert "retry-after" in limited_response.headers


async def test_consultation_request_submission_rate_limit_returns_429_after_limit(
    client: AsyncClient,
) -> None:
    payload = {"name": "Test", "email": "test@example.com"}
    for _ in range(settings.RATE_LIMIT_FORM_SUBMISSION_PER_MINUTE):
        await client.post("/api/v1/consultation-requests", json=payload)

    limited_response = await client.post("/api/v1/consultation-requests", json=payload)
    assert limited_response.status_code == 429
    assert "retry-after" in limited_response.headers


async def test_rate_limit_is_scoped_per_endpoint(client: AsyncClient) -> None:
    for i in range(settings.RATE_LIMIT_REGISTER_PER_MINUTE):
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": f"scoped{i}@amplivo.com",
                "username": f"scoped_user_{i}",
                "full_name": "Scoped User",
                "password": "SecurePass123",
            },
        )
        assert response.status_code == 201

    # Register is now exhausted, but login (a different bucket) must still work.
    login_response = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "scoped0@amplivo.com", "password": "SecurePass123"},
    )
    assert login_response.status_code == 200


async def _ok(request):
    return PlainTextResponse("ok")


def _build_default_rule_app(limit: int) -> Starlette:
    app = Starlette(
        routes=[Route("/api/v1/one", _ok), Route("/api/v1/two", _ok), Route("/not-api", _ok)]
    )
    app.add_middleware(RateLimiterMiddleware, rules={}, default_rule=RateLimitRule(limit=limit))
    return app


async def test_default_api_rate_limit_applies_across_different_paths() -> None:
    # The general "API rate limiting" tier is keyed by IP only, not by
    # path, so it must trip across different endpoints once the ceiling is
    # reached - unlike the per-path tiers tested above. Verified in
    # isolation (a tiny app + a small limit) rather than through the full
    # 300/min production default, which would make this test slow.
    reset_rate_limit_state()
    app = _build_default_rule_app(limit=3)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        assert (await ac.get("/api/v1/one")).status_code == 200
        assert (await ac.get("/api/v1/two")).status_code == 200
        assert (await ac.get("/api/v1/one")).status_code == 200

        blocked = await ac.get("/api/v1/two")
        assert blocked.status_code == 429
        assert blocked.json()["error_code"] == "rate_limit_exceeded"
        retry_after = blocked.headers.get("retry-after")
        assert retry_after is not None
        assert 1 <= int(retry_after) <= 60
    reset_rate_limit_state()


async def test_default_api_rate_limit_does_not_apply_outside_api_prefix() -> None:
    reset_rate_limit_state()
    app = _build_default_rule_app(limit=1)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        assert (await ac.get("/api/v1/one")).status_code == 200
        # /api/v1 budget of 1 is now exhausted...
        assert (await ac.get("/api/v1/two")).status_code == 429
        # ...but a path outside settings.API_V1_PREFIX is never subject to
        # the default rule at all.
        assert (await ac.get("/not-api")).status_code == 200
    reset_rate_limit_state()


async def test_check_endpoints_rate_limited(client: AsyncClient) -> None:
    reset_rate_limit_state()
    for _ in range(5):
        response = await client.get("/api/v1/auth/check-username?username=randomuser")
        assert response.status_code == 200

    limited_response = await client.get("/api/v1/auth/check-username?username=randomuser")
    assert limited_response.status_code == 429
    assert limited_response.json()["error_code"] == "rate_limit_exceeded"
    reset_rate_limit_state()
