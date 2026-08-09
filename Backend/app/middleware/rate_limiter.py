import asyncio
import math
import time
from dataclasses import dataclass

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response
from starlette.types import ASGIApp

from app.core.config import settings
from app.core.exceptions import RateLimitException
from app.middleware.exception_handler import error_response
from app.utils.jwt import decode_token
from app.utils.request_context import get_client_ip

# Module-level (not instance-level) so tests can import reset_rate_limit_state()
# and clear state between test cases regardless of how the middleware instance
# was constructed by Starlette's lazily-built middleware stack.
_hits: dict[tuple[str, str], list[float]] = {}
_penalties: dict[tuple[str, str], int] = {}
_lock = asyncio.Lock()


def reset_rate_limit_state() -> None:
    _hits.clear()
    _penalties.clear()


@dataclass(frozen=True)
class RateLimitRule:
    limit: int
    window_seconds: int = 60
    exponential_backoff: bool = False


class RateLimiterMiddleware(BaseHTTPMiddleware):
    """Fixed-window, in-memory rate limiter keyed by (bucket, client IP).

    In-memory state means limits are per-process, not shared across multiple
    workers/instances - adequate for a single-instance deployment; a
    distributed deployment should back this with Redis instead.

    Two tiers are enforced, in this order, both independently:
      1. A tighter per-path rule for specific abuse-prone endpoints (login,
         register, refresh, the public contact/consultation forms).
      2. A general per-IP ceiling applied to every /api/v1 request as a
         volumetric baseline for the remaining ~440 routes that have no
         endpoint-specific rule ("API rate limiting").
    A request only needs to trip one tier to be rejected with 429 - a
    rejected request is never double-counted against the other tier.
    """

    def __init__(
        self,
        app: ASGIApp,
        rules: dict[str, RateLimitRule] | None = None,
        default_rule: RateLimitRule | None = None,
    ) -> None:
        super().__init__(app)
        self._rules = rules or {
            f"{settings.API_V1_PREFIX}/auth/login": RateLimitRule(limit=settings.RATE_LIMIT_LOGIN_PER_MINUTE),
            f"{settings.API_V1_PREFIX}/auth/register": RateLimitRule(
                limit=settings.RATE_LIMIT_REGISTER_PER_MINUTE
            ),
            f"{settings.API_V1_PREFIX}/auth/refresh": RateLimitRule(
                limit=settings.RATE_LIMIT_REFRESH_PER_MINUTE
            ),
            f"{settings.API_V1_PREFIX}/auth/check-email": RateLimitRule(
                limit=5
            ),
            f"{settings.API_V1_PREFIX}/auth/check-username": RateLimitRule(
                limit=5
            ),
            f"{settings.API_V1_PREFIX}/contact-submissions": RateLimitRule(
                limit=settings.RATE_LIMIT_FORM_SUBMISSION_PER_MINUTE
            ),
            f"{settings.API_V1_PREFIX}/consultation-requests": RateLimitRule(
                limit=settings.RATE_LIMIT_FORM_SUBMISSION_PER_MINUTE
            ),
            f"{settings.API_V1_PREFIX}/campaigns": RateLimitRule(limit=60),
        }
        self._default_rule = default_rule or RateLimitRule(limit=settings.RATE_LIMIT_DEFAULT_PER_MINUTE)

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if request.method == "OPTIONS":
            return await call_next(request)

        client_ip = get_client_ip(request) or "unknown"

        # Try to resolve user_id from authorization header for per-account rate limiting
        user_id = None
        authorization = request.headers.get("Authorization")
        if authorization and authorization.lower().startswith("bearer "):
            token = authorization.split(" ", 1)[1].strip()
            try:
                from app.utils.jwt import decode_token
                payload = decode_token(token, expected_type="access")
                user_id = payload.get("sub")
            except Exception:
                pass

        limit_key = f"user:{user_id}" if user_id else f"ip:{client_ip}"

        specific_rule = self._rules.get(request.url.path)
        bucket_name = request.url.path
        if specific_rule is None and request.url.path.startswith(f"{settings.API_V1_PREFIX}/campaigns"):
            specific_rule = self._rules.get(f"{settings.API_V1_PREFIX}/campaigns")
            bucket_name = f"{settings.API_V1_PREFIX}/campaigns"
        elif specific_rule is None and request.url.path.startswith(f"{settings.API_V1_PREFIX}/analytics"):
            specific_rule = RateLimitRule(limit=settings.RATE_LIMIT_DEFAULT_PER_MINUTE, window_seconds=60)
        elif specific_rule is None and request.url.path.startswith(f"{settings.API_V1_PREFIX}/clients"):
            specific_rule = RateLimitRule(limit=5, window_seconds=60)
            bucket_name = f"{settings.API_V1_PREFIX}/clients"
        elif specific_rule is None and request.url.path.startswith(f"{settings.API_V1_PREFIX}/finance"):
            specific_rule = RateLimitRule(limit=10, window_seconds=60, exponential_backoff=True)
            bucket_name = f"{settings.API_V1_PREFIX}/finance"
        elif specific_rule is None and request.url.path.startswith(f"{settings.API_V1_PREFIX}/leads"):
            specific_rule = RateLimitRule(limit=5, window_seconds=60)
            bucket_name = "leads"
        elif specific_rule is None and (
            request.url.path.startswith(f"{settings.API_V1_PREFIX}/users") or
            request.url.path.startswith(f"{settings.API_V1_PREFIX}/roles") or
            request.url.path.startswith(f"{settings.API_V1_PREFIX}/permissions") or
            request.url.path.startswith(f"{settings.API_V1_PREFIX}/branches") or
            request.url.path.startswith(f"{settings.API_V1_PREFIX}/departments") or
            request.url.path.startswith(f"{settings.API_V1_PREFIX}/teams") or
            request.url.path.startswith(f"{settings.API_V1_PREFIX}/designations")
        ):
            specific_rule = RateLimitRule(limit=5, window_seconds=60)
            bucket_name = "user_management"

        if specific_rule is not None:
            user_id: str | None = None
            auth = request.headers.get("Authorization")
            if auth and auth.lower().startswith("bearer "):
                token = auth.split(" ", 1)[1].strip()
                try:
                    payload = decode_token(token, expected_type="access")
                    sub = payload.get("sub")
                    if sub is not None:
                        user_id = str(sub)
                except Exception:
                    pass

            retry_ip = await self._check(f"path:{bucket_name}", client_ip, specific_rule)
            retry_acc = None
            if user_id is not None:
                retry_acc = await self._check(f"account:{bucket_name}", user_id, specific_rule)
            
            if retry_ip is not None or retry_acc is not None:
                wait_time = max(retry_ip or 0, retry_acc or 0)
                return error_response(RateLimitException(retry_after=wait_time), request)

        if request.url.path.startswith(settings.API_V1_PREFIX):
            user_id: str | None = None
            auth = request.headers.get("Authorization")
            if auth and auth.lower().startswith("bearer "):
                token = auth.split(" ", 1)[1].strip()
                try:
                    payload = decode_token(token, expected_type="access")
                    sub = payload.get("sub")
                    if sub is not None:
                        user_id = str(sub)
                except Exception:
                    pass

            retry_ip = await self._check("global", client_ip, self._default_rule)
            retry_acc = None
            if user_id is not None:
                retry_acc = await self._check("global", user_id, self._default_rule)
            
            if retry_ip is not None or retry_acc is not None:
                wait_time = max(retry_ip or 0, retry_acc or 0)
                return error_response(RateLimitException(retry_after=wait_time), request)

        return await call_next(request)

    @staticmethod
    async def _check(bucket: str, client_ip: str, rule: RateLimitRule) -> int | None:
        """Registers a hit against (bucket, client_ip) under rule.

        Returns None if the request is allowed. Returns the number of
        seconds the caller should wait before retrying (for the
        Retry-After header) if the rule's limit has been reached.
        """
        key = (bucket, client_ip)
        now = time.monotonic()
        async with _lock:
            timestamps = [t for t in _hits.get(key, []) if now - t < rule.window_seconds]
            if len(timestamps) >= rule.limit:
                multiplier = 1
                if rule.exponential_backoff:
                    penalties = _penalties.get(key, 0)
                    _penalties[key] = penalties + 1
                    multiplier = 2 ** penalties
                _hits[key] = timestamps
                oldest = timestamps[0]
                return max(1, math.ceil(rule.window_seconds - (now - oldest))) * multiplier
            timestamps.append(now)
            _hits[key] = timestamps
            return None
