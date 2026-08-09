from functools import lru_cache
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    PROJECT_NAME: str = "Amplivo ERP Auth Service"
    API_V1_PREFIX: str = "/api/v1"
    ENVIRONMENT: str = "development"

    # The single connection string SQLAlchemy/asyncpg actually connects
    # with. Everything else DB-related below configures how that connection
    # behaves (pooling, SSL) - it does not change which database is used.
    #
    # SECURITY: there is intentionally NO real credential baked in here. The
    # live Supabase password was previously committed at this field's default;
    # that constant is gone. In production the app FAILS CLOSED at boot (see
    # _fail_closed_in_production below) if DATABASE_URL / JWT_SECRET_KEY are
    # missing, empty, or still the documented dev placeholders.
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/amplivo_erp"

    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_RECYCLE_SECONDS: int = 1800
    DB_POOL_TIMEOUT_SECONDS: int = 30
    DB_ECHO: bool = False
    # Bounds the startup connectivity check so an unreachable database (e.g.
    # a slow/dropped TCP path) can't stall app boot for the OS's full
    # connect-timeout - it just logs the warning and moves on.
    DB_STARTUP_TIMEOUT_SECONDS: float = 5.0
    # "require" for Supabase or any remote Postgres; "disable" for local
    # development against a Postgres instance with no SSL configured.
    DB_SSL_MODE: Literal["require", "disable"] = "require"

    # Captured for completeness / any future use of the Supabase client SDK
    # directly (Storage, Realtime, etc.). Not read by the SQLAlchemy
    # connection above, which only uses DATABASE_URL.
    SUPABASE_URL: str | None = None
    SUPABASE_ANON_KEY: str | None = None
    SUPABASE_SERVICE_ROLE_KEY: str | None = None

    JWT_SECRET_KEY: str = ""
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    BCRYPT_ROUNDS: int = 12

    CORS_ORIGINS: str = (
        "http://localhost:3000,http://127.0.0.1:3000,"
        "http://localhost:3001,http://127.0.0.1:3001,"
        "https://amplivo-front-and-backend.vercel.app,https://amplivo-2.vercel.app"
    )

    @property
    def cors_origins_list(self) -> list[str]:
        v = self.CORS_ORIGINS.strip()
        if v.startswith("["):
            import json
            return json.loads(v)
        return [o.strip() for o in v.split(",") if o.strip()]

    MAX_FAILED_LOGIN_ATTEMPTS: int = 5
    ACCOUNT_LOCK_MINUTES: int = 15

    RATE_LIMIT_LOGIN_PER_MINUTE: int = 5
    RATE_LIMIT_REGISTER_PER_MINUTE: int = 3
    RATE_LIMIT_REFRESH_PER_MINUTE: int = 10
    # Public marketing forms (contact-submissions, consultation-requests) -
    # unauthenticated, so they need their own tighter bucket rather than
    # relying only on the general default below.
    RATE_LIMIT_FORM_SUBMISSION_PER_MINUTE: int = 5
    # Baseline ceiling applied to every /api/v1 request regardless of path,
    # on top of (not instead of) the tighter per-path rules above - the
    # general "API rate limiting" layer for the ~440 routes with no
    # endpoint-specific rule.
    RATE_LIMIT_DEFAULT_PER_MINUTE: int = 300

    EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS: int = 24
    PASSWORD_RESET_TOKEN_EXPIRE_MINUTES: int = 30

    SESSION_INACTIVITY_TIMEOUT_MINUTES: int = 60

    REDIS_URL: str | None = None

    # Brevo transactional email (app/services/email_service.py). When unset,
    # email sending falls back to a log+in-memory-outbox stub - see that
    # module's docstring. Set BREVO_API_KEY directly in .env to go live.
    BREVO_API_KEY: str | None = None
    BREVO_SENDER_EMAIL: str = "no-reply@amplivo.in"
    BREVO_SENDER_NAME: str = "Amplivo"

    # Magic-link token lifetimes for unauthenticated client actions
    # (app/modules/portal_access) - mirrors EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS's pattern.
    PROPOSAL_TOKEN_EXPIRE_HOURS: int = 168
    PAYMENT_LINK_TOKEN_EXPIRE_HOURS: int = 720

    # Base URL of the deployed frontend, used to build magic-link URLs
    # embedded in proposal/invoice emails (frontend/src/app/portal-public/...).
    FRONTEND_URL: str = "http://localhost:3000"

    # ── Compression ──────────────────────────────────────────────────────────
    # Minimum response body size in bytes before compression is applied.
    COMPRESSION_MIN_SIZE: int = 512

    # ── Caching ───────────────────────────────────────────────────────────────
    # Default TTL for the in-memory cache (seconds).
    CACHE_DEFAULT_TTL_SECONDS: int = 300
    # When set, enables Redis-backed caching for the in-memory TTL cache's
    # "hot" entries.  Falls back gracefully to in-memory-only when absent.
    REDIS_URL: str | None = None  # already declared above

    # ── Logging ───────────────────────────────────────────────────────────────
    LOG_LEVEL: str = "INFO"
    # When "json", outputs structured JSON log lines; "text" uses the standard
    # Python format (useful for local development).
    LOG_FORMAT: str = "json"

    # ── Performance ───────────────────────────────────────────────────────────
    # Log requests that take longer than this threshold (milliseconds) at INFO
    # level instead of DEBUG.
    SLOW_REQUEST_THRESHOLD_MS: int = 1000

    # ── Data retention (A09) ─────────────────────────────────────────────────
    # audit_logs / activity_logs / login_history rows older than this many
    # days are purged by the startup retention task.
    AUDIT_LOG_RETENTION_DAYS: int = 90

    # Known non-production placeholder values. In production mode a boot with
    # any of these is treated as a hard misconfiguration (see validator below).
    _PLACEHOLDER_SECRETS = {"", "CHANGE_ME_IN_PRODUCTION", "change-this-to-a-long-random-secret-in-production"}
    _PLACEHOLDER_DB_PREFIXES = ("postgresql+asyncpg://postgres:postgres@localhost",)

    @model_validator(mode="after")
    def _fail_closed_in_production(self) -> "Settings":
        """Refuse to boot with forgable/leaked credentials when ENVIRONMENT
        is production.

        A missing JWT secret would let anyone mint valid tokens for any user
        (HS256 with a known key); a placeholder DB URL means the app would
        quietly connect to the wrong database. Both are boot-time, fail-fast
        errors instead of runtime surprises.
        """
        if self.ENVIRONMENT != "production":
            return self

        if self.JWT_SECRET_KEY.strip() in self._PLACEHOLDER_SECRETS:
            raise ValueError(
                "JWT_SECRET_KEY must be set to a real secret in production "
                "(it was empty or still the dev placeholder)."
            )

        if not self.DATABASE_URL.strip() or self.DATABASE_URL.strip().startswith(self._PLACEHOLDER_DB_PREFIXES):
            raise ValueError(
                "DATABASE_URL must be set to the production connection string "
                "(it was empty or still a localhost placeholder)."
            )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
