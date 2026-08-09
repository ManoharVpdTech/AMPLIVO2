"""Service for the File Manager module."""
from __future__ import annotations

import logging
import os
import uuid
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.file_manager.models import FileFolder, File
from app.modules.file_manager.repository import FileFolderRepository, FileRepository
from app.modules.file_manager.schemas import FileFolderCreate, FileCreate
from app.core.exceptions import NotFoundException
from app.core.tenant_scope import enforce_client_scope

logger = logging.getLogger("app.file_manager")

UPLOADS_DIR = Path(__file__).resolve().parents[3] / "uploads"


class FileFolderService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._repo = FileFolderRepository(session)

    async def list_all(self, *, client_id: uuid.UUID | None = None, skip: int = 0, limit: int = 100) -> list[FileFolder]:
        return await self._repo.get_all_filtered(client_id=client_id, offset=skip, limit=limit)

    async def get(self, id: uuid.UUID, *, scoped_client_id: uuid.UUID | None = None) -> FileFolder:
        obj = await self._repo.get_by_id(id)
        if not obj:
            raise NotFoundException("Folder")
        enforce_client_scope(obj.client_id, scoped_client_id)
        return obj

    async def create(self, data: FileFolderCreate) -> FileFolder:
        return await self._repo.create_from_dict(data.model_dump())

    async def delete(self, id: uuid.UUID, *, scoped_client_id: uuid.UUID | None = None) -> None:
        await self.get(id, scoped_client_id=scoped_client_id)
        await self._repo.delete(id)


class FileService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._repo = FileRepository(session)

    async def list_all(self, *, client_id: uuid.UUID | None = None, folder_id: uuid.UUID | None = None, skip: int = 0, limit: int = 100) -> list[File]:
        return await self._repo.get_all_filtered(client_id=client_id, folder_id=folder_id, offset=skip, limit=limit)

    async def get(self, id: uuid.UUID, *, scoped_client_id: uuid.UUID | None = None) -> File:
        obj = await self._repo.get_by_id(id)
        if not obj:
            raise NotFoundException("File")
        enforce_client_scope(obj.client_id, scoped_client_id)
        return obj

    async def create(self, data: FileCreate) -> File:
        return await self._repo.create_from_dict(data.model_dump())

    async def delete(self, id: uuid.UUID, *, scoped_client_id: uuid.UUID | None = None) -> None:
        obj = await self.get(id, scoped_client_id=scoped_client_id)
        # CRIT-1a: delete the on-disk blob too, not just the DB row. Otherwise
        # a deleted record keeps being served from /uploads/{name} and the
        # original upload persists indefinitely.
        self._unlink_physical(obj)
        await self._repo.delete(id)

    @staticmethod
    def _unlink_physical(file: File) -> None:
        """Remove the physical blob, guarded against path traversal.

        Only ever deletes inside UPLOADS_DIR; `file.name` is always a
        server-generated `<uuid>.<ext>` value in practice, but we assert the
        resolved path stays under the upload root regardless.
        """
        name = file.name or ""
        path = (UPLOADS_DIR / Path(name).name).resolve()
        uploads_root = UPLOADS_DIR.resolve()
        if uploads_root in path.parents:
            try:
                path.unlink(missing_ok=True)
            except OSError:  # noqa: B014
                logger.exception("Failed to unlink uploaded file %s", path)
