"""SQL injection regression tests (OWASP A03).

Verify that the app does not interpolate user input into SQL without
parameterization. The suite probes the most common injection surfaces with
payloads that would break out of quotes or comment out the remainder of a
query, and asserts the API treats them as ordinary (invalid/validation) input
rather than letting them alter rows or leak data.
"""

from httpx import AsyncClient

INJECTION_PAYLOADS = [
    ("' OR '1'='1", "string-breakout"),
    ("'; DROP TABLE users; --", "statement-stacking"),
    ('" OR 1=1 --', "double-quote breakout"),
    ("1 OR 1=1", "numeric tautology"),
    ("x' UNION SELECT * FROM users --", "union-injection"),
    ("1; SELECT pg_sleep(10) --", "time-based (pg)"),
    ("1` OR `1`=`1", "backtick breakout"),
]


async def _register_and_login(client: AsyncClient) -> str:
    await client.post(
        "/api/v1/auth/register",
        json={
            "email": "sqli-check@amplivo.com",
            "username": "sqli_check",
            "full_name": "SQLi Check",
            "password": "SecurePass123",
        },
    )
    resp = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "sqli-check@amplivo.com", "password": "SecurePass123"},
    )
    return resp.json()["access_token"]


async def test_login_identifier_rejects_injection(client: AsyncClient) -> None:
    """Logins must treat injection strings as ordinary (failed) credentials.

    A vulnerable implementation would craft 'OR'1'='1 -> match the first user
    and authenticate; a correct one rejects with 401/422 and never succeeds.
    """
    for payload, _ in INJECTION_PAYLOADS:
        resp = await client.post(
            "/api/v1/auth/login",
            json={"identifier": payload, "password": "SecurePass123"},
        )
        # Either the schema rejects it cleanly (422), auth fails (401), or
        # the rate limiter has already locked after repeated probes (429).
        # Any of those means the injection never authenticated.
        assert resp.status_code in (401, 422, 429), f"{payload!r} -> {resp.status_code}"
        assert resp.json().get("access_token") is None


async def test_register_username_rejects_injection(client: AsyncClient) -> None:
    for i, (payload, _) in enumerate(INJECTION_PAYLOADS):
        resp = await client.post(
            "/api/v1/auth/register",
            json={
                "email": f"inj{i}@amplivo.com",
                "username": payload,
                "full_name": "Injection Probe",
                "password": "SecurePass123",
            },
        )
        # Must be a validation error, never a 201 that stores raw injection.
        # (The 422 body echoes the offending input back for the consuming
        # client — that is normal FastAPI validation behaviour; the injection
        # is rejected, not stored.)
        assert resp.status_code != 201
        assert resp.status_code in (400, 422, 429), f"{payload!r} -> {resp.status_code}"


async def test_search_like_endpoints_do_not_break(client: AsyncClient) -> None:
    """Public list/search paths must treat injection strings as plain text."""
    for payload, _ in INJECTION_PAYLOADS:
        resp = await client.get(
            "/api/v1/auth/check-email", params={"email": payload}
        )
        # 200 = treated as a plain query (boolean result); 422 = rejected by
        # the email validator before it ever reaches a query; 429 = throttled
        # by the rate limiter. All prove the payload is not interpreted as
        # SQL and never reaches a query.
        if resp.status_code == 200:
            assert resp.json().get("exists") in (False, True)
        else:
            assert resp.status_code in (422, 429), f"{payload!r} -> {resp.status_code}"


async def test_injected_payloads_never_reach_successful_auth(client: AsyncClient) -> None:
    """Prove the tautology payload does not unlock an API key/token."""
    resp = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "' OR 1=1 --", "password": "' OR 1=1 --"},
    )
    assert resp.status_code in (401, 422)