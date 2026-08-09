import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class SessionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    device_name: str | None = None
    browser: str | None = None
    operating_system: str | None = None
    ip_address: str | None = None
    country: str | None = None
    city: str | None = None
    is_active: bool = True
    is_revoked: bool = False
    is_expired: bool = False
    is_current: bool = False
    last_activity: datetime | None = None
    created_at: datetime | None = None
    expires_at: datetime | None = None
