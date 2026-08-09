import os
from collections.abc import AsyncGenerator

os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["ENVIRONMENT"] = "testing"
os.environ["JWT_SECRET_KEY"] = "testing_secret_key_at_least_32_characters_long_for_security"

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.dependencies.db import get_db
from app.main import app
from app.middleware.rate_limiter import reset_rate_limit_state
from app.services.email_service import clear_outbox

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


async def _override_get_db() -> AsyncGenerator[AsyncSession, None]:
    async with TestSessionLocal() as session:
        yield session


app.dependency_overrides[get_db] = _override_get_db


@pytest_asyncio.fixture(autouse=True)
async def _prepare_database() -> AsyncGenerator[None, None]:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture(autouse=True)
def _reset_rate_limiter() -> None:
    reset_rate_limit_state()


@pytest.fixture(autouse=True)
def _reset_email_outbox() -> None:
    clear_outbox()


@pytest_asyncio.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """A standalone session for tests to assert on DB state directly (e.g.
    audit_logs, login_history rows, or User columns not exposed via the API).
    Shares the same in-memory SQLite connection as the app's request-scoped
    sessions (StaticPool), so it sees everything already committed by them.
    """
    async with TestSessionLocal() as session:
        yield session
