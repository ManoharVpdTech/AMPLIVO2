import json
import logging
import queue
import sys
import threading
from datetime import datetime
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest
from fastapi import HTTPException
from fastapi import Request
from sqlalchemy import column, select

from app.core import cache as cache_mod
from app.core import log_forwarder as lf_module
from app.core.cache import TTLCache, cached_call
from app.core.config import settings
from app.models.user import User


class _CollectHandler(BaseHTTPRequestHandler):
    responses: list = []
    status = 200

    def do_POST(self) -> None:
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)
        type(self).responses.append((dict(self.headers), body))
        self.send_response(type(self).status)
        self.end_headers()

    def log_message(self, *args) -> None:  # silence stderr
        pass


@pytest.fixture
def server_url() -> str:
    _CollectHandler.responses = []
    _CollectHandler.status = 200
    server = HTTPServer(("127.0.0.1", 0), _CollectHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{server.server_address[1]}"
    server.shutdown()
    thread.join(timeout=3)
    server.server_close()


@pytest.fixture
def failing_server_url() -> str:
    _CollectHandler.responses = []
    _CollectHandler.status = 500
    server = HTTPServer(("127.0.0.1", 0), _CollectHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{server.server_address[1]}"
    server.shutdown()
    thread.join(timeout=3)
    server.server_close()


# ── app.core.sanitizers ──────────────────────────────────────────────────────

from app.core.sanitizers import (  # noqa: E402
    SanitizedModel,
    prevent_header_injection,
    sanitize_html,
    sanitize_multiline,
    sanitize_string,
    strip_html,
)


class _StrictModel(SanitizedModel):
    name: str
    bio: str


class _MixedModel(SanitizedModel):
    _sanitized_fields = {"bio": "multiline", "note": "raw"}

    title: str
    bio: str
    note: str


def test_strip_html_removes_script_and_tags() -> None:
    assert strip_html('<script>alert(1)</script>hello <b>there</b>') == "hello there"


def test_sanitize_html() -> None:
    assert sanitize_html(None) is None
    assert sanitize_html("<b>hi</b> & <i>x</i>") == "hi &amp; x"


def test_sanitize_string() -> None:
    assert sanitize_string(None) is None
    assert sanitize_string("  hi\x00\x1f  ") == "hi"
    assert sanitize_string(123) == 123


def test_sanitize_multiline() -> None:
    assert sanitize_multiline(None) is None
    assert sanitize_multiline("<p>\n a\x0b b\x0f \n</p>") == "a b"


def test_prevent_header_injection() -> None:
    assert prevent_header_injection(None) is None
    assert prevent_header_injection("plain value") == "plain value"
    with pytest.raises(ValueError):
        prevent_header_injection("ok\r\nInjected: x")


def test_sanitized_model_strict() -> None:
    m = _StrictModel(name="<b>John</b> & <i>Doe</i>", bio="plain")
    assert m.name == "John & Doe"
    assert m.bio == "plain"


def test_sanitized_model_raw_and_multiline() -> None:
    m = _MixedModel(title="<b>Head</b>", bio="<i>body</i>", note="  note\x00  ")
    assert m.title == "Head"
    assert m.bio == "body"
    assert m.note == "note"


# ── app.core.validators ──────────────────────────────────────────────────────

from app.core.validators import (  # noqa: E402
    normalize_email,
    validate_not_reserved,
    validate_phone,
    validate_slug,
    validate_url,
    validate_uuid,
)


def test_validate_phone() -> None:
    assert validate_phone(None) is None
    assert validate_phone("+1 (555) 123-4567") == "+15551234567"
    with pytest.raises(ValueError):
        validate_phone("not-a-phone")


def test_validate_url() -> None:
    assert validate_url(None) is None
    assert validate_url("https://example.com/path?q=1") == "https://example.com/path?q=1"
    with pytest.raises(ValueError):
        validate_url("ftp://example.com/x")


def test_validate_uuid() -> None:
    import uuid

    u = uuid.UUID("123e4567-e89b-12d3-a456-426614174000")
    assert validate_uuid(u) is u
    assert validate_uuid(str(u)) == u
    with pytest.raises(ValueError):
        validate_uuid("not-a-uuid")


def test_validate_slug() -> None:
    from app.core.validators import validate_slug

    assert validate_slug("abc-123_xy") == "abc-123_xy"
    assert validate_slug("a") == "a"
    with pytest.raises(ValueError):
        validate_slug("Bad Slug")


def test_normalize_email() -> None:
    assert normalize_email(" User@Example.COM ") == "user@example.com"
    with pytest.raises(ValueError):
        normalize_email("nope")


def test_validate_not_reserved() -> None:
    assert validate_not_reserved("my-user") == "my-user"
    with pytest.raises(ValueError):
        validate_not_reserved("Admin")


# ── app.core.filters ─────────────────────────────────────────────────────────

from app.core.filters import apply_date_range, apply_search, apply_sorting  # noqa: E402


def test_apply_search_noop_returns_same_stmt() -> None:
    stmt = select()
    assert apply_search(stmt, search=None, columns=[]) is stmt
    assert apply_search(stmt, search="", columns=[]) is stmt


def test_apply_search_builds_clause() -> None:
    stmt = select()
    result = apply_search(stmt, search="acme", columns=[column("name"), column("email")])
    assert result is not stmt


def test_apply_date_range() -> None:
    stmt = select()
    now = datetime.now(datetime.UTC)
    s1 = apply_date_range(stmt, column=column("created_at"), after=now)
    s2 = apply_date_range(s1, column=column("created_at"), before=now)
    s3 = apply_date_range(s2, column=column("created_at"))
    assert s3 is not None


def test_apply_sorting() -> None:
    stmt = select()
    by_name = apply_sorting(stmt, model=User, sort_by="email", sort_order="asc")
    assert by_name is not None
    defaulted = apply_sorting(stmt, model=User, sort_by=None)
    assert defaulted is not None
    with pytest.raises(HTTPException) as exc:
        apply_sorting(stmt, model=User, sort_by="not_a_column", sort_order="desc")
    assert exc.value.status_code == 422
    with pytest.raises(HTTPException) as exc:
        apply_sorting(stmt, model=User, sort_by="id", sort_order="asc", allowed_columns={"email"})
    assert exc.value.status_code == 422


# ── app.core.cache ───────────────────────────────────────────────────────────

def test_ttl_cache_miss_and_hit() -> None:
    c = TTLCache()
    assert c.get("missing") is None
    c.set("k", "v")
    assert c.get("k") == "v"


def test_ttl_cache_expiry() -> None:
    import time

    c = TTLCache()
    c.set("k", "v", ttl_seconds=30)
    c._store["k"] = (time.monotonic() - 1, "old")
    assert c.get("k") is None


def test_ttl_cache_delete_clear_invalidate() -> None:
    import time

    c = TTLCache(default_ttl_seconds=5)
    c.set("prefix:1", 1, ttl_seconds=1)
    assert c.get("prefix:1") == 1
    c.delete("prefix:1")
    assert c.get("prefix:1") is None
    c.set("prefix:1", 1)
    c.set("prefix:2", 2)
    c.set("other", 3)
    c.invalidate_pattern("prefix")
    assert c.get("prefix:1") is None
    assert c.get("prefix:2") is None
    assert c.get("other") == 3
    c.clear()
    assert c.get("other") is None


async def test_cached_call_miss_then_hit() -> None:
    cache_mod.cache.clear()
    calls = 0

    async def factory():
        nonlocal calls
        calls += 1
        return "result"

    assert await cached_call("c1", factory, ttl_seconds=60) == "result"
    assert await cached_call("c1", factory) == "result"
    assert calls == 1


async def test_get_redis_unconfigured() -> None:
    cache_mod._redis_pool = None
    assert await cache_mod.get_redis() is None


async def test_get_redis_import_error(monkeypatch) -> None:
    monkeypatch.setattr(settings, "REDIS_URL", "redis://localhost:6379/0")
    monkeypatch.setitem(sys.modules, "redis", None)
    cache_mod._redis_pool = None
    assert await cache_mod.get_redis() is None


async def test_close_redis() -> None:
    cache_mod._redis_pool = None
    await cache_mod.close_redis()

    class _FakePool:
        def __init__(self) -> None:
            self.closed = False

        async def close(self) -> None:
            self.closed = True

    pool = _FakePool()
    cache_mod._redis_pool = pool
    await cache_mod.close_redis()
    assert pool.closed
    assert cache_mod._redis_pool is None


# ── app.utils.session_context ────────────────────────────────────────────────

from app.utils.session_context import resolve_session_id  # noqa: E402


def test_resolve_session_id_no_claim() -> None:
    assert resolve_session_id(Request(scope={"type": "http"})) is None


def test_resolve_session_id_valid() -> None:
    req = Request(scope={"type": "http"})
    req.state.session_id = "123e4567-e89b-12d3-a456-426614174000"
    assert str(resolve_session_id(req)) == "123e4567-e89b-12d3-a456-426614174000"


def test_resolve_session_id_invalid() -> None:
    req = Request(scope={"type": "http"})
    req.state.session_id = "not-a-uuid"
    assert resolve_session_id(req) is None


# ── app.core.log_forwarder ───────────────────────────────────────────────────

def _make_record(msg: str = "hello", level: int = logging.INFO, exc_info=None, **extra) -> logging.LogRecord:
    logger_name = "app.tests.log_forwarder"
    rec = logging.LogRecord(
        logger_name,
        level,
        __file__,
        1,
        msg,
        None,
        exc_info,
    )
    for key, value in extra.items():
        setattr(rec, key, value)
    return rec


def test_handler_emit_and_payload(server_url: str) -> None:
    handler = lf_module.LogForwarderHandler(server_url, token="secret-token")
    rec = _make_record(
        "hello",
        correlation_id="c1",
        request_id="r1",
        user_id=42,
        duration_ms=12.3,
        status_code=200,
        method="POST",
        path="/x",
        ip="1.2.3.4",
    )
    handler.emit(rec)
    handler.flush()
    assert len(_CollectHandler.responses) == 1
    headers, body = _CollectHandler.responses[0]
    assert headers.get("Authorization") == "Bearer secret-token"
    payload = json.loads(body)
    assert payload[0]["message"] == "hello"
    assert payload[0]["correlation_id"] == "c1"
    assert payload[0]["request_id"] == "r1"
    assert payload[0]["user_id"] == "42"
    assert payload[0]["status_code"] == 200
    assert payload[0]["method"] == "POST"


def test_handler_below_level_is_dropped() -> None:
    handler = lf_module.LogForwarderHandler("http://127.0.0.1:9", level=logging.WARNING)
    handler.emit(_make_record("low", level=logging.INFO))
    handler.flush()
    assert handler.dropped == 0


def test_handler_queue_full_increments_dropped() -> None:
    handler = lf_module.LogForwarderHandler("http://127.0.0.1:9")

    class _Full:
        def put_nowait(self, item) -> None:
            raise queue.Full

    handler._queue = _Full()
    handler.emit(_make_record())
    assert handler.dropped == 1


def test_redact_nested() -> None:
    data = {
        "user": {"password": "hunter2"},
        "list": [{"secret": "abc"}],
        "clean": "ok",
        "headers": {"authorization": "Bearer x", "accept": "application/json"},
    }
    out = lf_module.LogForwarderHandler._redact(data)
    assert out["user"]["password"] == "<redacted>"
    assert out["list"][0]["secret"] == "<redacted>"
    assert out["headers"]["authorization"] == "<redacted>"
    assert out["headers"]["accept"] == "application/json"
    assert out["clean"] == "ok"
    assert lf_module.LogForwarderHandler._redact(["plain", 5]) == ["plain", 5]


def test_handler_start_stop(server_url: str) -> None:
    handler = lf_module.LogForwarderHandler(
        server_url, flush_interval_seconds=0.1, level=logging.DEBUG
    )
    handler.start()
    assert handler._thread is not None and handler._thread.is_alive()
    handler.emit(_make_record("during-run", level=logging.DEBUG))
    handler.start()
    handler.stop()
    assert not handler._thread.is_alive()


def test_flush_batches_up_to_500(server_url: str) -> None:
    handler = lf_module.LogForwarderHandler(server_url)
    for i in range(505):
        handler.emit(_make_record(f"msg-{i}"))
    handler.flush()
    assert len(_CollectHandler.responses) == 1
    payload = json.loads(_CollectHandler.responses[0][1])
    assert len(payload) == 500


def test_ship_non_2xx_is_tolerated(failing_server_url: str) -> None:
    handler = lf_module.LogForwarderHandler(failing_server_url)
    handler.emit(_make_record("boom"))
    handler.flush()
    assert handler.dropped == 0


def test_exception_payload() -> None:
    import sys

    handler = lf_module.LogForwarderHandler("http://127.0.0.1:9")
    try:
        raise ValueError("boom")
    except ValueError:
        record = _make_record("failed", exc_info=sys.exc_info())
    payload = handler._record_to_payload(record)
    assert payload is not None
    assert "ValueError" in payload["exception"]


def test_setup_log_forwarder_inert() -> None:
    assert lf_module.setup_log_forwarder(None) is None


def test_setup_log_forwarder_singleton(monkeypatch) -> None:
    lf_module._forwarder = None
    handler = lf_module.setup_log_forwarder("http://127.0.0.1:1")
    try:
        assert handler is not None
        assert isinstance(handler, lf_module.LogForwarderHandler)
        assert lf_module.setup_log_forwarder("http://127.0.0.1:1") is handler
    finally:
        logging.getLogger().removeHandler(handler)
        lf_module._forwarder = None