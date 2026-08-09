"""Sentry error-tracking bootstrap (env-gated, inert without a DSN).

Calling ``init_sentry()`` at startup is always safe:

* With ``SENTRY_DSN`` set, the Sentry SDK is configured to capture unhandled
  exceptions and (optionally) traces. Sensitive fields are scrubbed by
  ``before_send`` before anything leaves the process.
* Without ``SENTRY_DSN`` the function returns immediately — no SDK import
  side effects, no network, no threads. Local/dev/test runs are completely
  untouched.
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger("app.sentry")


def init_sentry() -> None:
    """Initialize the Sentry SDK if a DSN is configured. No-op otherwise."""
    from app.core.config import settings

    if not settings.SENTRY_DSN:
        return

    try:
        import sentry_sdk
        from sentry_sdk.integrations.asgi import SentryAsgiMiddleware
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.logging import LoggingIntegration
        from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

        sentry_logging = LoggingIntegration(
            level=logging.INFO,
            event_level=logging.ERROR,
        )

        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            environment=settings.SENTRY_ENVIRONMENT or settings.ENVIRONMENT,
            traces_sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE,
            before_send=_scrub_sensitive_event,
            integrations=[
                SentryAsgiMiddleware,
                FastApiIntegration(),
                sentry_logging,
                SqlalchemyIntegration(),
            ],
            send_default_pii=False,
            attach_stacktrace=True,
        )
        logger.info("Sentry SDK initialized for error tracking")
    except Exception:
        # A broken DSN/integration must never take the app down at boot.
        logger.warning("Sentry initialization failed — continuing without it.", exc_info=True)


def _scrub_sensitive_event(event: dict[str, Any], hint: dict[str, Any]) -> dict[str, Any] | None:
    """Remove secrets, auth headers, and PII from an event before sending.

    * Drops any frame/extra/context value that looks like a credential.
    * Drops ``Authorization`` / ``Cookie`` headers from the request context.
    * Drops user emails when present (send_default_pii=False covers most,
      this is defense-in-depth for explicitly-passed context).
    """
    sensitive_names = (
        "password",
        "passwd",
        "secret",
        "token",
        "authorization",
        "cookie",
        "api_key",
        "apikey",
        "access_key",
        "private_key",
        "client_secret",
        "dsn",
        "db_password",
    )

    def _scrub(value: Any) -> Any:
        if isinstance(value, dict):
            return {
                k: "<redacted>" if isinstance(k, str) and k.lower() in sensitive_names else _scrub(v)
                for k, v in value.items()
            }
        if isinstance(value, list):
            return [_scrub(v) for v in value]
        return value

    if "request" in event and isinstance(event["request"], dict):
        req = event["request"]
        if "headers" in req and isinstance(req["headers"], dict):
            req["headers"] = {
                k: ("<redacted>" if k.lower() in ("authorization", "cookie", "x-csrf-token") else v)
                for k, v in req["headers"].items()
            }
        if "data" in req:
            req["data"] = _scrub(req["data"])
        event["request"] = req

    for key in ("extra", "contexts"):
        if key in event and isinstance(event[key], dict):
            event[key] = _scrub(event[key])

    if "user" in event and isinstance(event["user"], dict):
        user = dict(event["user"])
        user.pop("email", None)
        user.pop("username", None)
        event["user"] = user

    return event


def capture_exception(exc: BaseException | None = None) -> None:
    """Best-effort capture helper; no-op when Sentry is not initialized."""
    try:
        import sentry_sdk

        if sentry_sdk.get_current_hub().client is not None:
            sentry_sdk.capture_exception(exc)
    except Exception:
        pass
