import enum
import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, String, Text, Uuid, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

# JSONB is Postgres-only; the in-memory SQLite DB used by the test suite
# can't compile it. with_variant keeps production (Postgres) on JSONB
# unchanged and only swaps in a portable JSON type for other dialects.
_JSON_TYPE = JSON().with_variant(JSONB, "postgresql")


class AuditAction(str, enum.Enum):
    REGISTER = "register"
    LOGIN_SUCCESS = "login_success"
    LOGIN_FAILED = "login_failed"
    LOGOUT = "logout"
    REFRESH_TOKEN = "refresh_token"
    ACCESS_DENIED = "access_denied"
    INVALID_TOKEN = "invalid_token"
    VERIFICATION_EMAIL_SENT = "verification_email_sent"
    VERIFICATION_SUCCESS = "verification_success"
    VERIFICATION_FAILED = "verification_failed"
    PASSWORD_RESET_REQUESTED = "password_reset_requested"
    PASSWORD_RESET_COMPLETED = "password_reset_completed"
    PASSWORD_RESET_FAILED = "password_reset_failed"
    NEW_DEVICE_LOGIN = "new_device_login"
    SESSION_EXPIRED = "session_expired"
    SESSION_REVOKED = "session_revoked"
    LOGOUT_ALL_DEVICES = "logout_all_devices"
    LOGOUT_DEVICE = "logout_device"


class AuditStatus(str, enum.Enum):
    SUCCESS = "success"
    FAILURE = "failure"


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    table_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    record_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True), nullable=True)
    action: Mapped[str | None] = mapped_column(String(50), nullable=True)
    old_data: Mapped[dict | None] = mapped_column(_JSON_TYPE, nullable=True)
    new_data: Mapped[dict | None] = mapped_column(_JSON_TYPE, nullable=True)
    performed_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), server_default=func.now(), nullable=True
    )

    @property
    def status(self) -> str | None:
        if isinstance(self.new_data, dict):
            return self.new_data.get("status")
        return None

    @property
    def endpoint(self) -> str | None:
        if isinstance(self.new_data, dict):
            return self.new_data.get("endpoint")
        return None

    @property
    def request_method(self) -> str | None:
        if isinstance(self.new_data, dict):
            return self.new_data.get("request_method")
        return None

    @property
    def message(self) -> str | None:
        if isinstance(self.new_data, dict):
            return self.new_data.get("message")
        return None

    @property
    def user_id(self) -> uuid.UUID | None:
        if self.performed_by:
            return self.performed_by
        if isinstance(self.new_data, dict):
            uid = self.new_data.get("user_id")
            if uid:
                try:
                    return uuid.UUID(str(uid))
                except (ValueError, TypeError):
                    pass
        return None
