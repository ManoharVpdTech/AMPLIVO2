"""Sensitive-data exposure / secrets-in-response regression tests.

The API must never:
  * return hashed passwords or tokens in user/me payloads,
  * leak SENTRY_DSN / BREVO_API_KEY / JWT_SECRET_KEY / DATABASE_URL in any
    response body,
  * include secrets as placeholder defaults that would boot in prod.

Also pinned: fail-closed production configuration (missing/placeholder
JWT_SECRET_KEY or DATABASE_URL raises at Settings construction).
"""

from __future__ import annotations

import os
from unittest.mock import patch

import httpx
from httpx import AsyncClient

from app.core.config import Settings
from app.core.sentry import _scrub_sensitive_event


async def test_register_response_never_leaks_password_fields(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "no-leak@amplivo.com",
            "username": "no_leak",
            "full_name": "No Leak",
            "password": "SecurePass123",
        },
    )
    assert resp.status_code == 201
    json_body = resp.json()
    assert "hashed_password" not in json_body
    assert "password" not in json_body
    assert "passwd" not in json_body


async def test_me_response_has_no_hashed_password(client: AsyncClient) -> None:
    await client.post(
        "/api/v1/auth/register",
        json={
            "email": "me-check@amplivo.com",
            "username": "me_check",
            "full_name": "Me Check",
            "password": "SecurePass123",
        },
    )
    login = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "me-check@amplivo.com", "password": "SecurePass123"},
    )
    tokens = login.json()
    resp = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "hashed_password" not in body
    assert "password" not in body


SECRET_ENV_NAMES = (
    "JWT_SECRET_KEY",
    "DATABASE_URL",
    "SENTRY_DSN",
    "BREVO_API_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SERVICE_KEY",
)


async def test_no_endpoint_echoes_secrets(client: AsyncClient) -> None:
    """Hit a few public surface responses and confirm no secret-shaped
    string appears (defense for future accidental debug endpoints)."""
    responses = [
        await client.get("/health"),
        await client.get("/api/v1/auth/check-email", params={"email": "a@b.com"}),
    ]
    for r in responses:
        body = r.text.lower()
        for name in ("sentdsn", "brevo", "service_role_key", "database_url", "jwt_secret"):
            assert name not in body


def test_prod_fails_closed_on_missing_jwt_secret() -> None:
    with patch.dict(
        "os.environ",
        {
            "ENVIRONMENT": "production",
            "DATABASE_URL": "postgresql+asyncpg://u:p@fakehost/db",
            "JWT_SECRET_KEY": "",
        },
        clear=True,
    ):
        try:
            Settings()
            raised = False
        except ValueError:
            raised = True
        assert raised, "production boot with empty JWT secret must fail"


def test_prod_fails_closed_on_placeholder_db() -> None:
    with patch.dict(
        "os.environ",
        {
            "ENVIRONMENT": "production",
            "JWT_SECRET_KEY": "x",
            "DATABASE_URL": "postgresql+asyncpg://postgres:postgres@localhost/db",
        },
        clear=True,
    ):
        try:
            Settings()
            raise AssertionError("boot with placeholder DB must fail")
        except ValueError:
            pass


def test_scrubber_redacts_secret_fields() -> None:
    event = {
        "request": {"headers": {"authorization": "Bearer abc", "cookie": "sid=1"}},
        "extra": {"db_password": "s3cr3t", "ok": "fine"},
        "user": {"email": "a@b.com"},
    }
    out = _scrub_sensitive_event(event, {})
    assert out["request"]["headers"]["authorization"] == "<redacted>"
    assert out["request"]["headers"]["cookie"] == "<redacted>"
    assert out["extra"]["db_password"] == "<redacted>"
    assert "email" not in out["user"]