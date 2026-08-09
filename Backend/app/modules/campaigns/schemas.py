"""Pydantic schemas for the Campaigns module."""
from __future__ import annotations
import uuid
from datetime import datetime, date as datetime_date
from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.core.field_types import HttpUrlStr
from app.core.sanitizers import SanitizedModel

# Campaign
class CampaignBase(SanitizedModel):
    name: str = Field(min_length=2, max_length=300)
    client_id: uuid.UUID
    type: str = Field(min_length=2, max_length=100)
    status: str = Field(default="draft", min_length=1, max_length=50)
    start_date: datetime_date | None = None
    end_date: datetime_date | None = None
    budget: float | None = Field(None, ge=0.0, le=1_000_000_000_000.0)
    spent_amount: float = Field(default=0.0, ge=0.0, le=1_000_000_000_000.0)
    target_audience: str | None = None
    description: str | None = None
    manager_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def validate_dates(self) -> CampaignBase:
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("end_date must be greater than or equal to start_date")
        return self

class CampaignCreate(CampaignBase): pass

class CampaignUpdate(SanitizedModel):
    name: str | None = Field(None, min_length=2, max_length=300)
    client_id: uuid.UUID | None = None
    type: str | None = Field(None, min_length=2, max_length=100)
    status: str | None = None
    start_date: datetime_date | None = None
    end_date: datetime_date | None = None
    budget: float | None = Field(None, ge=0.0, le=1_000_000_000_000.0)
    spent_amount: float | None = Field(None, ge=0.0, le=1_000_000_000_000.0)
    target_audience: str | None = None
    description: str | None = None
    manager_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def validate_dates(self) -> CampaignUpdate:
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("end_date must be greater than or equal to start_date")
        return self

class CampaignRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    client_id: uuid.UUID
    type: str
    status: str
    start_date: datetime_date | None
    end_date: datetime_date | None
    budget: float | None
    spent_amount: float
    target_audience: str | None
    description: str | None
    manager_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

# CampaignPlatform
class CampaignPlatformBase(SanitizedModel):
    platform_name: str = Field(min_length=1, max_length=100)
    account_id: str | None = None
    status: str = Field(default="active", min_length=1, max_length=50)
    budget_allocation: float | None = Field(None, ge=0.0, le=1_000_000_000_000.0)

class CampaignPlatformCreate(CampaignPlatformBase): pass
class CampaignPlatformUpdate(SanitizedModel):
    platform_name: str | None = Field(None, min_length=1, max_length=100)
    account_id: str | None = None
    status: str | None = None
    budget_allocation: float | None = Field(None, ge=0.0, le=1_000_000_000_000.0)

class CampaignPlatformRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    campaign_id: uuid.UUID
    platform_name: str
    account_id: str | None
    status: str
    budget_allocation: float | None
    created_at: datetime

# CampaignAsset
class CampaignAssetBase(SanitizedModel):
    name: str = Field(min_length=1, max_length=200)
    asset_type: str = Field(min_length=1, max_length=100)
    file_url: HttpUrlStr = None
    status: str = Field(default="pending", min_length=1, max_length=50)

class CampaignAssetCreate(CampaignAssetBase): pass
class CampaignAssetUpdate(SanitizedModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    asset_type: str | None = Field(None, min_length=1, max_length=100)
    file_url: HttpUrlStr = None
    status: str | None = None

class CampaignAssetRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    campaign_id: uuid.UUID
    name: str
    asset_type: str
    file_url: str | None
    status: str
    uploaded_by: uuid.UUID | None
    created_at: datetime

# CampaignMetric
class CampaignMetricBase(SanitizedModel):
    date: datetime_date
    impressions: int = Field(default=0, ge=0, le=2_147_483_647)
    clicks: int = Field(default=0, ge=0, le=2_147_483_647)
    conversions: int = Field(default=0, ge=0, le=2_147_483_647)
    spend: float = Field(default=0.0, ge=0.0, le=1_000_000_000_000.0)

class CampaignMetricCreate(CampaignMetricBase): pass
class CampaignMetricUpdate(SanitizedModel):
    date: datetime_date | None = None
    impressions: int | None = Field(None, ge=0, le=2_147_483_647)
    clicks: int | None = Field(None, ge=0, le=2_147_483_647)
    conversions: int | None = Field(None, ge=0, le=2_147_483_647)
    spend: float | None = Field(None, ge=0.0, le=1_000_000_000_000.0)

class CampaignMetricRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    campaign_id: uuid.UUID
    date: datetime_date
    impressions: int
    clicks: int
    conversions: int
    spend: float
    created_at: datetime
