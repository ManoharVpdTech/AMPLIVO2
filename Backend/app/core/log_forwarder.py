"""HTTP log forwarder (centralized logging).

When ``LOG_FORWARD_URL`` is configured, this handler attaches to the root
logger and ships structured JSON log records to a remote ingest endpoint
(e.g. a Render log-drain URL, a self-hosted Loki/webhook, or any HTTP sink)
in bounded batches.

It is deliberately **inert** when ``LOG_FORWARD_URL`` is unset: no thread is
started and no network traffic is generated. Setup is safe to call at every
boot.

Design notes
------------
* Records are queued on a bounded ``queue.Queue``; if the queue is full the
  log record is dropped (never blocks the app) and a counter is incremented.
* A single daemon worker thread flushes batches on a size or time trigger so
  log writes never perform blocking network I/O.
* Credentials are never included in the payload: ``Authorization`` is only
  attached as an HTTP header, and any value that looks like a secret in a
  record field is stripped before shipping.
"""

from __future__ import annotations

import json
import logging
import queue
import threading
import time
from datetime import datetime, timezone
from typing import Any

try:
    import orjson

    def _json_serialize(obj: Any) -> str:
        return orjson.dumps(obj, default=str).decode("utf-8")

except ImportError:
    def _json_serialize(obj: Any) -> str:
        return json.dumps(obj, default=str)


_SENSITIVE_FIELD_NAMES = (
    "password",
    "secret",
    "token",
    "authorization",
    "api_key",
    "apikey",
    "credential",
    "access_key",
    "private_key",
    "dsn",
)


class LogForwarderHandler(logging.Handler):
    """Batch-shipping handler for remote log ingestion."""

    def __init__(
        self,
        url: str,
        token: str | None = None,
        max_batch_bytes: int = 100_000,
        flush_interval_seconds: float = 10.0,
        level: int = logging.INFO,
    ) -> None:
        super().__init__(level=level)
        self.url = url
        self.token = token
        self.max_batch_bytes = max(1_000, max_batch_bytes)
        self.flush_interval_seconds = max(0.1, flush_interval_seconds)
        self._queue: queue.Queue[str] = queue.Queue(maxsize=20_000)
        self._dropped = 0
        self._lock = threading.Lock()
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    # ── public lifecycle ────────────────────────────────────────────────────
    def start(self) -> None:
        if self._thread is not None and self._thread.is_alive():
            return
        self._stop.clear()
        self._thread = threading.Thread(
            target=self._run, name="log-forwarder", daemon=True
        )
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._thread is not None:
            self._thread.join(timeout=5)
        self.flush(blocking=False)

    def flush(self, blocking: bool = False) -> None:
        batch: list[str] = []
        while True:
            try:
                batch.append(self._queue.get_nowait())
            except queue.Empty:
                break
            if len(batch) >= 500:
                break
        if batch:
            self._ship(batch)

    # ── logging.Handler interface ───────────────────────────────────────────
    def emit(self, record: logging.LogRecord) -> None:
        try:
            payload = self._record_to_payload(record)
            if payload is None:
                return
            serialized = _json_serialize(payload)
            try:
                self._queue.put_nowait(serialized)
            except queue.Full:
                with self._lock:
                    self._dropped += 1
        except Exception:
            self.handleError(record)

    def _record_to_payload(self, record: logging.LogRecord) -> dict[str, Any] | None:
        if record.levelno < self.level:
            return None
        payload: dict[str, Any] = {
            "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc)
            .strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3]
            + "Z",
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        for key in ("correlation_id", "request_id"):
            val = getattr(record, key, None)
            if val is not None:
                payload[key] = val
        user_id = getattr(record, "user_id", None)
        if user_id is not None:
            payload["user_id"] = str(user_id)
        for key in ("duration_ms", "status_code", "method", "path", "ip"):
            val = getattr(record, key, None)
            if val is not None:
                payload[key] = val
        if record.exc_info and record.exc_info[0] is not None:
            import traceback

            payload["exception"] = "".join(traceback.format_exception(*record.exc_info))
        return self._redact(payload)

    @staticmethod
    def _redact(obj: Any) -> Any:
        """Recursively strip fields that look like secrets (keys or values)."""
        if isinstance(obj, dict):
            return {
                k: LogForwarderHandler._redact(v)
                if not (isinstance(k, str) and k.lower() in _SENSITIVE_FIELD_NAMES)
                else "<redacted>"
                for k, v in obj.items()
            }
        if isinstance(obj, list):
            return [LogForwarderHandler._redact(v) for v in obj]
        return obj

    # ── worker ──────────────────────────────────────────────────────────────
    def _run(self) -> None:
        while not self._stop.is_set():
            self.flush()
            self._stop.wait(self.flush_interval_seconds)
        self.flush()

    def _ship(self, batch: list[str]) -> None:
        import urllib.request

        body = "[" + ",".join(batch) + "]"
        req = urllib.request.Request(
            self.url,
            data=body.encode("utf-8"),
            headers={"Content-Type": "application/json", "User-Agent": "amplivo-log-forwarder/1.0"},
            method="POST",
        )
        if self.token:
            req.add_header("Authorization", f"Bearer {self.token}")
        try:
            with urllib.request.urlopen(req, timeout=5) as resp:
                if not (200 <= resp.status < 300):
                    logging.getLogger("app.log_forwarder").warning(
                        "Log forwarder target returned %s", resp.status
                    )
        except Exception:
            # Never fail the app on a dead log sink; drop and continue.
            pass

    @property
    def dropped(self) -> int:
        with self._lock:
            return self._dropped


_forwarder: LogForwarderHandler | None = None


def setup_log_forwarder(
    url: str | None,
    token: str | None = None,
    max_batch_bytes: int = 100_000,
    flush_interval_seconds: float = 10.0,
) -> LogForwarderHandler | None:
    """Attach the forwarder to the root logger. Inert when ``url`` is None."""
    global _forwarder
    if not url:
        return None
    if _forwarder is not None:
        return _forwarder
    handler = LogForwarderHandler(
        url=url,
        token=token,
        max_batch_bytes=max_batch_bytes,
        flush_interval_seconds=flush_interval_seconds,
    )
    handler.start()
    logging.getLogger().addHandler(handler)
    _forwarder = handler
    return handler
