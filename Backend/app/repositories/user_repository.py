import uuid
from datetime import timedelta

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.utils.time import utc_now


class UserRepository:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def get_by_id(self, user_id: uuid.UUID, *, include_deleted: bool = False) -> User | None:
        stmt = select(User).where(User.id == user_id).execution_options(populate_existing=True)
        if not include_deleted:
            stmt = stmt.where(User.is_deleted.is_(False))
        result = await self._db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> User | None:
        result = await self._db.execute(select(User).where(User.email == email.lower()))
        return result.scalar_one_or_none()

    async def get_by_username(self, username: str) -> User | None:
        result = await self._db.execute(select(User).where(User.username == username.lower()))
        return result.scalar_one_or_none()

    async def get_by_email_or_username(self, identifier: str) -> User | None:
        """Used for login - excludes soft-deleted accounts so a deleted user is
        treated as if it never existed.
        """
        identifier_lower = identifier.lower()
        result = await self._db.execute(
            select(User).where(
                or_(User.email == identifier_lower, User.username == identifier_lower),
                User.is_deleted.is_(False),
            )
        )
        return result.scalar_one_or_none()

    async def exists_by_email(self, email: str) -> bool:
        return await self.get_by_email(email) is not None

    async def exists_by_username(self, username: str) -> bool:
        return await self.get_by_username(username) is not None

    async def get_by_client_id(self, client_id: uuid.UUID) -> User | None:
        result = await self._db.execute(
            select(User).where(User.client_id == client_id, User.is_deleted.is_(False))
        )
        return result.scalars().first()

    async def create(
        self, *, email: str, username: str, full_name: str, hashed_password: str,
        role_id: uuid.UUID | None = None, client_id: uuid.UUID | None = None,
        user_type: str = "internal", is_verified: bool = False,
    ) -> User:
        user = User(
            email=email.lower(),
            username=username.lower(),
            full_name=full_name,
            hashed_password=hashed_password,
            role_id=role_id,
            client_id=client_id,
            user_type=user_type,
            is_verified=is_verified,
            status="active",
        )
        self._db.add(user)
        await self._db.flush()
        await self._db.refresh(user)
        return user

    async def increment_failed_login(self, user: User, *, max_attempts: int, lock_minutes: int) -> None:
        now = utc_now()
        user.failed_login_attempts += 1
        user.last_failed_login = now
        if user.failed_login_attempts >= max_attempts:
            user.locked_until = now + timedelta(minutes=lock_minutes)
        await self._db.flush()

    async def reset_failed_login(self, user: User) -> None:
        user.failed_login_attempts = 0
        user.last_failed_login = None
        user.locked_until = None
        await self._db.flush()

    async def record_successful_login(self, user: User, *, ip_address: str | None) -> None:
        now = utc_now()
        user.last_login_at = now
        user.last_login_ip = ip_address
        user.last_seen = now
        await self._db.flush()

    async def soft_delete(self, user: User, *, deleted_by: uuid.UUID | None) -> None:
        user.is_deleted = True
        user.deleted_at = utc_now()
        user.deleted_by = deleted_by
        await self._db.flush()

    async def mark_verified(self, user: User) -> None:
        user.is_verified = True
        user.verified_at = utc_now()
        await self._db.flush()
        # updated_at has onupdate=func.now(): after the UPDATE flush it's
        # marked expired (needs a server round-trip for its new value).
        # verify_email() returns this object straight into a UserRead
        # response, so it must be refreshed now - reading it later during
        # response serialization happens outside an awaited DB context and
        # would raise MissingGreenlet.
        await self._db.refresh(user)

    async def update_password(self, user: User, *, hashed_password: str) -> None:
        user.hashed_password = hashed_password
        await self._db.flush()
