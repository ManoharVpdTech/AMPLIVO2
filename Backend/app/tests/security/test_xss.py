"""Cross-Site Scripting (XSS) regression tests (OWASP A03).

Complements the file-upload allowlist suite (test_file_upload_allowlist.py)
which already proves `.html` / `image/svg+xml` / MIME-mismatch uploads are
rejected. These tests focus on textual user input: the API must not persist
and re-emit attacker HTML verbatim into API responses that a frontend then
marks unsafe.
"""

from httpx import AsyncClient

XSS_EMAIL = "xss-probe@amplivo.com"
XSS_USERNAME = "xss_probe"
XSS_FULL_NAME = '<script>alert(1)</script><b>BoldName</b>'


async def _register_xss_user(client: AsyncClient) -> None:
    await client.post(
        "/api/v1/auth/register",
        json={
            "email": XSS_EMAIL,
            "username": XSS_USERNAME,
            "full_name": XSS_FULL_NAME,
            "password": "SecurePass123",
        },
    )


async def test_registration_does_not_reintroduce_raw_script(client: AsyncClient) -> None:
    """full_name is user-controlled and stored; a CREATE response must not
    echo the raw payload (a stored-XSS echo point leaks to dashboards)."""
    resp = await client.post(
        "/api/v1/auth/register",
        json={
            "email": XSS_EMAIL,
            "username": XSS_USERNAME,
            "full_name": XSS_FULL_NAME,
            "password": "SecurePass123",
        },
    )
    assert resp.status_code == 201
    assert "<script>" not in resp.text.lower()


async def test_profile_field_can_store_normal_html_like_chars(client: AsyncClient) -> None:
    """Balanced tags that are NOT scripts (e.g. <b>) remain accepted, proving
    the fix is output-encoding (or scoped stripping), not a blanket ban that
    would break legitimate names/bios."""
    resp = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "legit-html@example.com",
            "username": "legit_html",
            "full_name": "<b>Just Bold</b>",
            "password": "SecurePass123",
        },
    )
    assert resp.status_code == 201


async def test_login_failure_does_not_reflect_payload(client: AsyncClient) -> None:
    """Reflected-XSS: a failed login echoing the identifier must escape it,
    not return it verbatim."""
    payload = '<script>alert(1)</script>'
    resp = await client.post(
        "/api/v1/auth/login",
        json={"identifier": payload, "password": "nope"},
    )
    assert resp.status_code in (401, 422)
    assert "<script>" not in resp.text.lower()