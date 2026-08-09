"""Reusable pagination primitives.

Usage in a route::

    @router.get("/items")
    async def list_items(params: PaginationParams = Depends()):
        ...
        return PaginatedResponse[ItemRead](items=rows, total=cnt, page=params.page, page_size=params.page_size)
"""

from __future__ import annotations

import math
from typing import Generic, TypeVar

from fastapi import Query
from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")


class PaginationParams:
    """FastAPI dependency that extracts standard list-endpoint query parameters."""

    def __init__(
        self,
        page: int = Query(1, ge=1, description="Page number (1-indexed)"),
        # Several frontend "load everything for client-side filtering" views
        # (sales leads/meetings, admin analytics, portal calendar, etc.) request
        # page_size=200 in one shot; the cap must cover that or every one of
        # those requests 422s and the page silently renders empty.
        page_size: int = Query(20, ge=1, le=500, description="Items per page"),
        sort_by: str | None = Query(None, description="Column name to sort by"),
        sort_order: str = Query("desc", pattern="^(asc|desc)$", description="Sort direction"),
        search: str | None = Query(None, min_length=1, max_length=200, description="Free-text search term"),
    ) -> None:
        self.page = page
        self.page_size = page_size
        self.sort_by = sort_by
        self.sort_order = sort_order
        self.search = search

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


class PaginatedResponse(BaseModel, Generic[T]):
    """Standardised paginated envelope returned by every list endpoint."""

    model_config = ConfigDict(from_attributes=True)

    items: list[T]
    total: int = Field(description="Total number of records matching the query")
    page: int = Field(description="Current page number")
    page_size: int = Field(description="Number of items per page")
    pages: int = Field(description="Total number of pages")

    @classmethod
    def create(
        cls,
        items: list[T],
        total: int,
        page: int,
        page_size: int,
    ) -> "PaginatedResponse[T]":
        return cls(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            pages=max(1, math.ceil(total / page_size)),
        )
