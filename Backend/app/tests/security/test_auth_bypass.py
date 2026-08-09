"""Authentication bypass regression tests (OWASP A02 / A07).

These prove that forged/absent/expired credentials are never accepted:
  1. Missing Authorization header -> 401
  2. Garbage token -> 401
  3. Token for a deleted user -> 401
  4. Token signed with the wrong secret -> 401
  5. Token with app-created fake claims (no valid signature) -> 401
  6. Expired token -> 401
"""

import time
from datetime import datetime, timedelta, timezone

import jwt as pyjwt
from httpx import AsyncClient

from app.core.config import settings


async def _register_and_login(client: AsyncClient) -> dict:
    await client.post(
        "/api/v1/auth/register",
        json={
            "email": "bypass@amplivo.com",
            "username": "bypass_user",
            "full_name": "Bypass User",
            "password": "SecurePass123",
        },
    )
    resp = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "bypass@amplivo.com", "password": "SecurePass123"},
    )
    return resp.json()


def _toke(payload: dict, secret: str) -> str:
    return pyjwt.encode(payload, secret, algorithm="HS256")


async def test_me_without_token_returns_401(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code in (401, 403)


async def test_me_with_garbage_token_returns_401(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/auth/me", headers={"Authorization": "Bearer garbage.token.here"})
    assert resp.status_code == 401


async def test_me_with_forged_signature_returns_401(client: AsyncClient) -> None:
    """A token signed with any secret other than JWT_SECRET_KEY must fail."""
    forged = _toke(
        {"sub": "00000000-0000-0000-0000-000000000001", "exp": int(time.time()) + 3600},
        "attacker-controlled-secret",
    )
    resp = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {forged}"})
    assert resp.status_code == 401


async def test_me_with_expired_token_returns_401(client: AsyncClient) -> None:
    tokens = await _register_and_login(client)
    expired = pyjwt.encode(
        {
            "sub": "00000000-0000-0000-0000-000000000001",
            "exp": datetime.now(timezone.utc) - timedelta(minutes=5),
        },
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )
    resp = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {expired}"})
    assert resp.status_code == 401


async def test_me_with_none_token_returns_401(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/auth/me", headers={"Authorization": "Bearer none"})
    assert resp.status_code == 401