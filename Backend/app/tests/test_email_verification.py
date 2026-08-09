from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditAction, AuditLog
from app.models.email_verification_token import EmailVerificationToken
from app.services.email_service import get_outbox
from app.utils.time import utc_now

PAYLOAD = {
    "email": "verify.user@amplivo.com",
    "username": "verify_user",
    "full_name": "Verify User",
    "password": "SecurePass123",
}


async def _register(client: AsyncClient) -> dict:
    response = await client.post("/api/v1/auth/register", json=PAYLOAD)
    assert response.status_code == 201
    return response.json()


async def _login(client: AsyncClient) -> dict:
    response = await client.post(
        "/api/v1/auth/login",
        json={"identifier": PAYLOAD["email"], "password": PAYLOAD["password"]},
    )
    assert response.status_code == 200
    return response.json()


def _latest_token() -> str:
    outbox = get_outbox()
    assert outbox, "expected at least one email to have been sent"
    return outbox[-1].token


async def test_registration_creates_verification_token(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _register(client)

    result = await db_session.execute(select(EmailVerificationToken))
    tokens = list(result.scalars())
    assert len(tokens) == 1
    assert tokens[0].is_used is False


async def test_registration_sends_verification_email(client: AsyncClient) -> None:
    await _register(client)

    outbox = get_outbox()
    assert len(outbox) == 1
    assert outbox[0].to == PAYLOAD["email"]
    assert outbox[0].token


async def test_new_user_is_not_verified_by_default(client: AsyncClient) -> None:
    body = await _register(client)
    assert body["is_verified"] is False
    assert body["verified_at"] is None


async def test_verify_email_success(client: AsyncClient) -> None:
    await _register(client)
    token = _latest_token()

    response = await client.post("/api/v1/auth/verify-email", json={"token": token})
    assert response.status_code == 200
    body = response.json()
    assert body["is_verified"] is True
    assert body["verified_at"] is not None


async def test_verify_email_marks_token_used(client: AsyncClient, db_session: AsyncSession) -> None:
    await _register(client)
    token = _latest_token()

    await client.post("/api/v1/auth/verify-email", json={"token": token})

    result = await db_session.execute(select(EmailVerificationToken))
    stored = result.scalar_one()
    assert stored.is_used is True
    assert stored.verified_at is not None


async def test_verify_email_with_expired_token_rejected(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _register(client)
    token = _latest_token()

    result = await db_session.execute(select(EmailVerificationToken))
    stored = result.scalar_one()
    stored.expires_at = utc_now().replace(year=2000)
    await db_session.commit()

    response = await client.post("/api/v1/auth/verify-email", json={"token": token})
    assert response.status_code == 401
    assert response.json()["error_code"] == "verification_token_expired"


async def test_verify_email_with_already_used_token_rejected(client: AsyncClient) -> None:
    await _register(client)
    token = _latest_token()

    first = await client.post("/api/v1/auth/verify-email", json={"token": token})
    assert first.status_code == 200

    second = await client.post("/api/v1/auth/verify-email", json={"token": token})
    assert second.status_code == 401
    assert second.json()["error_code"] == "verification_token_invalid"


async def test_verify_email_with_invalid_token_rejected(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/auth/verify-email", json={"token": "totally-made-up-token-value"}
    )
    assert response.status_code == 401
    assert response.json()["error_code"] == "verification_token_invalid"


async def test_send_verification_requires_authentication(client: AsyncClient) -> None:
    response = await client.post("/api/v1/auth/send-verification")
    assert response.status_code in (401, 403)


async def test_send_verification_already_verified_rejected(client: AsyncClient) -> None:
    await _register(client)
    token = _latest_token()
    await client.post("/api/v1/auth/verify-email", json={"token": token})

    tokens = await _login(client)
    response = await client.post(
        "/api/v1/auth/send-verification",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert response.status_code == 409
    assert response.json()["error_code"] == "email_already_verified"


async def test_send_verification_invalidates_previous_token(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _register(client)
    first_token = _latest_token()
    tokens = await _login(client)

    response = await client.post(
        "/api/v1/auth/send-verification",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert response.status_code == 200
    second_token = _latest_token()
    assert second_token != first_token

    old_verify = await client.post("/api/v1/auth/verify-email", json={"token": first_token})
    assert old_verify.status_code == 401
    assert old_verify.json()["error_code"] == "verification_token_invalid"

    new_verify = await client.post("/api/v1/auth/verify-email", json={"token": second_token})
    assert new_verify.status_code == 200


async def test_resend_verification_by_email_success(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _register(client)
    first_token = _latest_token()

    response = await client.post(
        "/api/v1/auth/resend-verification", json={"email": PAYLOAD["email"]}
    )
    assert response.status_code == 200

    second_token = _latest_token()
    assert second_token != first_token

    result = await db_session.execute(select(EmailVerificationToken))
    tokens = list(result.scalars())
    assert len(tokens) == 2
    used_flags = sorted(t.is_used for t in tokens)
    assert used_flags == [False, True]


async def test_resend_verification_unknown_email_returns_generic_success(
    client: AsyncClient,
) -> None:
    response = await client.post(
        "/api/v1/auth/resend-verification", json={"email": "nobody@amplivo.com"}
    )
    assert response.status_code == 200
    assert not get_outbox()


async def test_resend_verification_already_verified_returns_generic_success(
    client: AsyncClient,
) -> None:
    await _register(client)
    token = _latest_token()
    await client.post("/api/v1/auth/verify-email", json={"token": token})

    response = await client.post(
        "/api/v1/auth/resend-verification", json={"email": PAYLOAD["email"]}
    )
    assert response.status_code == 200
    # Only the original registration email was ever sent - no second one.
    assert len(get_outbox()) == 1


async def test_verification_status_endpoint(client: AsyncClient) -> None:
    await _register(client)
    tokens = await _login(client)
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    before = await client.get("/api/v1/auth/verification-status", headers=headers)
    assert before.status_code == 200
    assert before.json() == {"is_verified": False, "verified_at": None}

    verify_token = _latest_token()
    csrf_token = client.cookies.get("csrf_token")
    post_headers = {"X-CSRF-Token": csrf_token} if csrf_token else {}
    verify_res = await client.post("/api/v1/auth/verify-email", json={"token": verify_token}, headers=post_headers)
    assert verify_res.status_code == 200

    after = await client.get("/api/v1/auth/verification-status", headers=headers)
    assert after.status_code == 200
    assert after.json()["is_verified"] is True
    assert after.json()["verified_at"] is not None


async def test_verification_audit_logs_created(client: AsyncClient, db_session: AsyncSession) -> None:
    await _register(client)
    token = _latest_token()
    await client.post("/api/v1/auth/verify-email", json={"token": token})

    result = await db_session.execute(
        select(AuditLog).where(AuditLog.action == AuditAction.VERIFICATION_EMAIL_SENT.value)
    )
    assert len(list(result.scalars())) == 1

    result = await db_session.execute(
        select(AuditLog).where(AuditLog.action == AuditAction.VERIFICATION_SUCCESS.value)
    )
    assert len(list(result.scalars())) == 1


async def test_verification_failed_audit_log_created(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await client.post("/api/v1/auth/verify-email", json={"token": "garbage-token-value-here"})

    result = await db_session.execute(
        select(AuditLog).where(AuditLog.action == AuditAction.VERIFICATION_FAILED.value)
    )
    assert len(list(result.scalars())) == 1
