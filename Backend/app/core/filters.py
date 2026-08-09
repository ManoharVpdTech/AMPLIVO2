"""Reusable query-filter helpers applied inside repository methods.

All functions accept a SQLAlchemy ``Select`` statement, mutate it, and return
the modified statement — i.e. they compose naturally::

    stmt = select(Client)
    stmt = apply_search(stmt, search="acme", columns=[Client.name, Client.email])
    stmt = apply_date_range(stmt, column=Client.created_at, after=dt1, before=dt2)
    stmt = apply_sorting(stmt, model=Client, sort_by="name", sort_order="asc")
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import Select, asc, desc, or_


def apply_search(
    stmt: Select,
    *,
    search: str | None,
    columns: list,
) -> Select:
    """Add case-insensitive ILIKE search across *columns*."""
    if not search:
        return stmt
    pattern = f"%{search}%"
    clauses = [col.ilike(pattern) for col in columns]
    return stmt.where(or_(*clauses))


def apply_date_range(
    stmt: Select,
    *,
    column,
    after: datetime | None = None,
    before: datetime | None = None,
) -> Select:
    """Filter rows where *column* falls within an optional date window."""
    if after is not None:
        stmt = stmt.where(column >= after)
    if before is not None:
        stmt = stmt.where(column <= before)
    return stmt


def apply_sorting(
    stmt: Select,
    *,
    model,
    sort_by: str | None,
    sort_order: str = "desc",
    allowed_columns: set[str] | None = None,
    default_sort: str = "created_at",
) -> Select:
    """Apply dynamic column sorting with safety checks.

    Parameters
    ----------
    model:
        SQLAlchemy model class.
    sort_by:
        Column name requested by the caller.  Falls back to *default_sort*
        if ``None`` or not in *allowed_columns*.
    sort_order:
        ``"asc"`` or ``"desc"``.
    allowed_columns:
        Whitelist of sortable column names.  When ``None``, every column on
        *model* is allowed.
    default_sort:
        Fallback column when *sort_by* is rejected or absent.
    """
    if allowed_columns is None:
        allowed_columns = {c.key for c in model.__table__.columns}

    if sort_by is not None and sort_by not in allowed_columns:
        from fastapi import HTTPException
        raise HTTPException(status_code=422, detail=f"Invalid sort_by field. Allowed fields: {', '.join(allowed_columns)}")

    col_name = sort_by if sort_by in allowed_columns else default_sort
    column = getattr(model, col_name, None)
    if column is None:
        column = getattr(model, default_sort)

    order_fn = asc if sort_order == "asc" else desc
    return stmt.order_by(order_fn(column))
