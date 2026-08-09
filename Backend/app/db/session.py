import asyncio
import ssl as _ssl
import sys
import time
import uuid
from collections.abc import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

if sys.platform == "win32":
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    except Exception:
        pass

from sqlalchemy.pool import AsyncAdaptedQueuePool, NullPool, StaticPool

is_sqlite = "sqlite" in settings.DATABASE_URL.lower()

# Supabase connection ssl configuration
if not is_sqlite and settings.DB_SSL_MODE == "require":
    _ssl_ctx = _ssl.create_default_context()
    _ssl_ctx.check_hostname = True
    _ssl_ctx.verify_mode = _ssl.CERT_REQUIRED
    _connect_args: dict = {"ssl": _ssl_ctx}
else:
    _connect_args: dict = {}

if is_sqlite:
    _connect_args = {"check_same_thread": False}
    engine_kwargs = {
        "connect_args": _connect_args,
        "echo": settings.DB_ECHO,
        "poolclass": StaticPool,
    }
else:
    # Supabase's pooled connection (Supavisor, port 6543) runs in transaction
    # mode: a physical backend connection can be handed to a different logical
    # client between statements. asyncpg/SQLAlchemy name server-side prepared
    # statements deterministically (__asyncpg_stmt_1__, _2__, ...) per fresh
    # DBAPI connection object, so a brand-new logical connection's first query
    # requests the same name a previous, unrelated logical connection may have
    # left prepared on that same physical backend session - raising
    # DuplicatePreparedStatementError. Disabling both cache layers
    # (statement_cache_size is asyncpg's; prepared_statement_cache_size is
    # SQLAlchemy's own, separate, asyncpg-dialect cache) does NOT fix this by
    # itself, since disabling the cache still goes through the same
    # deterministic name generator. The actual fix is forcing a globally-unique
    # name per prepare call via prepared_statement_name_func, so no two logical
    # connections can ever request the same name.
    _connect_args["statement_cache_size"] = 0
    _connect_args["prepared_statement_cache_size"] = 0
    _connect_args["prepared_statement_name_func"] = lambda: f"__asyncpg_{uuid.uuid4().hex}__"
    engine_kwargs = {
        "pool_pre_ping": True,
        "pool_size": settings.DB_POOL_SIZE,
        "max_overflow": settings.DB_MAX_OVERFLOW,
        "pool_recycle": settings.DB_POOL_RECYCLE_SECONDS,
        "pool_timeout": settings.DB_POOL_TIMEOUT_SECONDS,
        "echo": settings.DB_ECHO,
        "future": True,
        "connect_args": _connect_args,
        "pool_use_lifo": True,
        "hide_parameters": not settings.DB_ECHO,
    }

engine = create_async_engine(
    settings.DATABASE_URL,
    **engine_kwargs,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session


async def check_database_connection() -> tuple[bool, float]:
    """Runs a lightweight SELECT 1 against the real engine and reports
    (is_healthy, latency_ms). Used at application startup for boot-time
    logging; unlike the /health/database route this bypasses the
    per-request session (there is no request yet at startup) and talks to
    the engine directly, pool_pre_ping and all.

    Bounded by DB_STARTUP_TIMEOUT_SECONDS so an unreachable database can't
    stall startup for the OS's full TCP connect-timeout.
    """
    start = time.perf_counter()

    async def _ping() -> None:
        async with engine.connect() as connection:
            await connection.execute(text("SELECT 1"))

    try:
        await asyncio.wait_for(_ping(), timeout=settings.DB_STARTUP_TIMEOUT_SECONDS)
        return True, (time.perf_counter() - start) * 1000
    except Exception:
        return False, (time.perf_counter() - start) * 1000
