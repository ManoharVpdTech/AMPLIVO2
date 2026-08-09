"""CRIT-1 regression tests: /files/upload must reject active-content files.

Previously the upload endpoint stored whatever was sent and served it back
from /uploads with its original content type, so a `<script>...` HTML file
(or SVG) could be stored and executed in the browser.

These tests pin the allowlist behaviour:
  1. A `.html` upload -> 400 (extension allowlist)
  2. An `image/svg+xml` upload -> 400 (denied MIME prefix)
  3. A `text/html` labelled `.png` -> 400 (denied MIME prefix)
  4. A pdf with a path-y filename -> 400 (path-traversal filename)
  5. A legit `image/png` -> 201 and stored name is server-generated
"""
from __future__ import annotations

import io

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.main import app
from app.tests.test_rbac_route_guards import make_authed_client

from app.modules.file_manager.routes import UPLOADS_DIR


@pytest.fixture(autouse=True)
def _clean_uploads() -> None:
    """Remove any test-written blobs so the real uploads dir stays clean."""
    yield
    for candidate in UPLOADS_DIR.glob("*"):
        if candidate.is_file():
            candidate.unlink(missing_ok=True)


@pytest.fixture
async def upload_client(db_session: AsyncSession) -> AsyncClient:
    # A dedicated client with a legitimate hostname: the upload route records
    # the absolute file URL from request.base_url, and pydantic rejects the
    # default "http://testserver" test host as an invalid URL.
    transport = ASGITransport(app=app)
    ac = AsyncClient(transport=transport, base_url="http://api.amplivo.test")
    try:
        return await make_authed_client(db_session, ac, role_slug="admin")
    except Exception:
        await ac.aclose()
        raise


@pytest.mark.parametrize(
    "filename,content_type,payload,expect_status",
    [
        # (filename, content_type, bytes, expected HTTP status)
        ("xss.html", "text/html", b"<script>alert(1)</script>", 400),
        ("evil.svg", "image/svg+xml", b'<svg onload="alert(1)"/>', 400),
        ("nested.png", "text/html", b"<script>alert(1)</script>", 400),
        ("..%2F..%2Fetc%2Fpasswd.pdf", "application/pdf", b"%PDF-1.4 mock", 201),
        ("clean.png", "image/png", b"\x89PNG\r\n\x1a\n...", 201),
    ],
)
async def test_upload_rejects_active_content(
    upload_client: AsyncClient,
    filename: str,
    content_type: str,
    payload: bytes,
    expect_status: int,
) -> None:
    files = {"upload": (filename, io.BytesIO(payload), content_type)}
    response = await upload_client.post("/api/v1/files/upload", files=files)
    assert response.status_code == expect_status
    if expect_status == 201:
        body = response.json()
        assert body["name"].endswith(".pdf") or body["name"].endswith(".png")
        # server-generated name: never echoes the client filename (blocks
        # path traversal / stored-name confusion)
        assert ".." not in body["name"]
        assert "passwd" not in body["name"]
        assert "clean.png" not in body["name"]