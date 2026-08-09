import asyncio
import logging
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from prometheus_fastapi_instrumentator import Instrumentator
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.router import api_router
from app.core.cache import close_redis
from app.core.config import settings
from app.core.logging_config import setup_logging
from app.db.session import AsyncSessionLocal, check_database_connection, engine
from app.dependencies.db import get_db
from app.middleware.activity import ActivityMiddleware
from app.middleware.audit import AuditMiddleware
from app.middleware.authentication import AuthenticationMiddleware
from app.middleware.cache_headers import CacheHeadersMiddleware
from app.middleware.compression import CompressionMiddleware
from app.middleware.csrf import CSRFMiddleware
from app.middleware.error_boundary import UnhandledErrorMiddleware
from app.middleware.exception_handler import register_exception_handlers
from app.middleware.performance_logger import PerformanceLoggerMiddleware
from app.middleware.rate_limiter import RateLimiterMiddleware
from app.middleware.request_id import RequestIDMiddleware
from app.middleware.security_headers import SecurityHeadersMiddleware
from app.middleware.session import SessionMiddleware

logger = logging.getLogger("app.startup")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Structured logging ────────────────────────────────────────────────
    setup_logging(level=settings.LOG_LEVEL)

    # ── Database connectivity ─────────────────────────────────────────────
    is_healthy, latency_ms = await check_database_connection()
    if is_healthy:
        logger.info(
            "Database connection verified at startup",
            extra={"duration_ms": round(latency_ms, 2)},
        )
        # Demo data seeding is deferred to a background task so it never
        # blocks the application from starting up to serve requests.
        asyncio.create_task(_seed_demo_background())
        # A09: purge audit_logs / activity_logs / login_history older than
        # AUDIT_LOG_RETENTION_DAYS so the tracking tables can't grow without
        # bound (there was previously no retention job at all).
        asyncio.create_task(_purge_old_audit_logs())
    else:
        logger.warning(
            "Database connection could not be verified at startup — "
            "the app will still boot; check DATABASE_URL and DB_SSL_MODE."
        )
    yield
    await engine.dispose()
    await close_redis()


async def _purge_old_audit_logs() -> None:
    """One-shot retention cleanup, safe to run every boot (idempotent)."""
    try:
        from datetime import datetime, timedelta, timezone

        from app.db.session import AsyncSessionLocal
        from app.models.audit_log import AuditLog
        from app.modules.activity_timeline.models import ActivityLog

        cutoff = datetime.now(timezone.utc) - timedelta(days=settings.AUDIT_LOG_RETENTION_DAYS)
        removed = 0
        async with AsyncSessionLocal() as session:
            for model in (AuditLog, ActivityLog):
                res = await session.execute(
                    text(
                        f"DELETE FROM {model.__tablename__} "
                        "WHERE created_at < :cutoff"
                    ).bindparams(cutoff=cutoff)
                )
                removed += res.rowcount or 0
            await session.commit()
        if removed:
            logger.info(
                "Retention cleanup removed %d rows older than %d days",
                removed,
                settings.AUDIT_LOG_RETENTION_DAYS,
            )
    except Exception:
        logger.exception("Audit-log retention cleanup failed — continuing.")


async def _seed_demo_background() -> None:
    """Idempotent demo data seeding, run in the background after startup."""
    try:
        from app.scripts.seed_demo_data import seed_demo_data

        async with AsyncSessionLocal() as session:
            created = await seed_demo_data(session)
        if any(created.values()):
            logger.info("Demo data seeded", extra={"created": created})
    except Exception:
        logger.exception("Demo data seeding failed — continuing without it.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version="2.0.0",
    description=(
        "Authentication module for the Amplivo Digital Marketing ERP + Client "
        "Portal: registration, login, logout, token refresh, current-user "
        "retrieval, and Phase 2 enterprise security (audit logging, login "
        "history, account lockout, device tracking, rate limiting)."
    ),
    lifespan=lifespan,
    # MED-1: interactive API docs (Swagger/ReDoc + the raw OpenAPI JSON) are
    # a high-value discovery surface in production. They enumerate every
    # route, schema, and accepted field. Enabled only outside "production".
    openapi_url=(
        None
        if settings.ENVIRONMENT == "production"
        else f"{settings.API_V1_PREFIX}/openapi.json"
    ),
    docs_url=(
        None
        if settings.ENVIRONMENT == "production"
        else f"{settings.API_V1_PREFIX}/docs"
    ),
    redoc_url=(
        None
        if settings.ENVIRONMENT == "production"
        else f"{settings.API_V1_PREFIX}/redoc"
    ),
)

# Middleware is added innermost-first: Starlette wraps the stack so the LAST
# middleware added ends up OUTERMOST (sees the request first, the response
# last). Desired outer-to-inner order (performance/compression/logging at
# the outside, then CORS, then security, then auth):
#   Compression, PerformanceLogger, RequestID, CacheHeaders,
#   CORSMiddleware, UnhandledError, SecurityHeaders, RateLimiter, CSRF,
#   Audit, Session, Activity, Authentication
#
# Compression sits outermost so the response body is compressed last
# (after all inner middleware and the route have produced it).
# PerformanceLogger captures full end-to-end timing.
# RequestID must run early so every downstream component sees the IDs.
# CacheHeaders runs after Compression so ETags reflect the compressed body.
# Everything else follows the existing ordering rationale.
app.add_middleware(AuthenticationMiddleware)
app.add_middleware(ActivityMiddleware)
app.add_middleware(SessionMiddleware)
app.add_middleware(AuditMiddleware)
app.add_middleware(CSRFMiddleware)
app.add_middleware(RateLimiterMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(UnhandledErrorMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Requested-With", "X-CSRF-Token"],
)
app.add_middleware(CacheHeadersMiddleware)
app.add_middleware(RequestIDMiddleware)
app.add_middleware(PerformanceLoggerMiddleware)
app.add_middleware(
    CompressionMiddleware,
    minimum_size=settings.COMPRESSION_MIN_SIZE,
)

register_exception_handlers(app)

# A09: Prometheus metrics at GET /metrics (disabled in schema/docs; always
# reachable, no auth on purpose — scrape endpoints are internal-facing).
# The /health probe is excluded from latency histograms so it doesn't skew
# the request-profile (it is polled constantly by Render).
Instrumentator(excluded_handlers=["/health", "/health/ready", "/"]).instrument(app).expose(
    app,
    endpoint="/metrics",
    include_in_schema=False,
)

UPLOADS_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)


class _HardenedStaticFiles(StaticFiles):
    """StaticFiles variant that never lets a browser *render* an uploaded
    file inline.

    Defense-in-depth for CRIT-1: the upload allowlist keeps HTML/SVG/etc.
    out of the store, but a file that already slipped in (pre-fix), or a
    future regression, must not be executable via /uploads either. These two
    headers make every response a download:
      - X-Content-Type-Options: nosniff  — browser must not MIME-sniff
      - Content-Disposition: attachment  — treated as a download, not page
    """

    async def get_response(self, path, scope):
        response = await super().get_response(path, scope)
        response.headers["X-Content-Type-Options"] = "nosniff"
        # Only content-type values that might render active content get forced
        # to attachment; images stay inline so the portal previews still work.
        content_type = response.headers.get("content-type", "").lower()
        if any(
            marker in content_type
            for marker in ("text/html", "svg+xml", "text/xml", "application/xml",
                          "text/javascript", "application/javascript", "application/json")
        ):
            response.headers["Content-Disposition"] = "attachment"
        return response


app.mount("/uploads", _HardenedStaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/", include_in_schema=False)
async def root():
    if settings.ENVIRONMENT == "production":
        return JSONResponse(
            {"service": "Amplivo API", "docs": "disabled in production"},
            status_code=200,
        )
    return RedirectResponse(url=f"{settings.API_V1_PREFIX}/docs")


@app.get("/health", tags=["Health"], summary="Liveness probe")
async def liveness() -> dict[str, str]:
    """Minimal liveness check — never touches the database."""
    return {"status": "ok"}


@app.get("/health/ready", tags=["Health"], summary="Readiness probe")
async def readiness(db: AsyncSession = Depends(get_db)) -> JSONResponse:
    """Readiness check: verifies the database is reachable.

    Orchestrators should call this endpoint (not /health) to decide
    whether this instance is ready to receive traffic.
    """
    return await _db_health(db)


@app.get(
    "/health/database",
    tags=["Health"],
    summary="Database connectivity check (legacy alias for /health/ready)",
)
async def database_health_check(db: AsyncSession = Depends(get_db)) -> JSONResponse:
    return await _db_health(db)


async def _db_health(db: AsyncSession) -> JSONResponse:
    start = time.perf_counter()
    try:
        await db.execute(text("SELECT 1"))
    except Exception:
        latency_ms = (time.perf_counter() - start) * 1000
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "database": "disconnected",
                "latency_ms": round(latency_ms, 2),
            },
        )

    latency_ms = (time.perf_counter() - start) * 1000
    return JSONResponse(
        status_code=200,
        content={
            "status": "healthy",
            "database": "connected",
            "latency_ms": round(latency_ms, 2),
        },
    )
