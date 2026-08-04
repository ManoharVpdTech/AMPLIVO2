"""Routes for the File Manager module."""
from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, Query, Request, UploadFile, status
from fastapi import File as UploadFileParam
from fastapi import Form
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestException
from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db
from app.dependencies.tenant import get_current_client_id
from app.models.user import User
from app.modules.file_manager.dependencies import get_file_folder_service, get_file_service
from app.modules.file_manager.schemas import FileCreate, FileFolderCreate, FileFolderRead, FileRead
from app.modules.file_manager.service import FileFolderService, FileService

router = APIRouter(prefix="/files", tags=["File Manager"])

UPLOADS_DIR = Path(__file__).resolve().parents[3] / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)
MAX_UPLOAD_SIZE = 20 * 1024 * 1024  # 20MB


@router.post("/upload", response_model=FileRead, status_code=status.HTTP_201_CREATED, summary="Upload a file")
async def upload_file(
    request: Request,
    upload: UploadFile = UploadFileParam(...),
    folder_id: uuid.UUID | None = Form(None),
    db: AsyncSession = Depends(get_db),
    service: FileService = Depends(get_file_service),
    folder_service: FileFolderService = Depends(get_file_folder_service),
    current_user: User = Depends(get_current_user),
    scoped_client_id: uuid.UUID | None = Depends(get_current_client_id),
):
    if folder_id is not None:
        # Raises NotFoundException (404) / ForbiddenException (403) if the
        # folder doesn't exist or belongs to another client — otherwise this
        # would only surface later as a foreign-key IntegrityError (500).
        await folder_service.get(folder_id, scoped_client_id=scoped_client_id)

    contents = await upload.read()
    if not contents:
        raise BadRequestException("The uploaded file is empty.")
    if len(contents) > MAX_UPLOAD_SIZE:
        raise BadRequestException("File exceeds the 20MB upload limit.")

    original_name = upload.filename or "file"
    safe_suffix = Path(original_name).suffix
    stored_name = f"{uuid.uuid4().hex}{safe_suffix}"
    (UPLOADS_DIR / stored_name).write_bytes(contents)

    # FileCreate.url is validated as an absolute http(s) URL, so the stored
    # path must be resolved against the request's own origin rather than
    # passed through as a bare "/uploads/..." path (which used to fail that
    # validation with an unhandled ValidationError -> HTTP 500).
    file_url = f"{str(request.base_url).rstrip('/')}/uploads/{stored_name}"

    file_obj = await service.create(FileCreate(
        name=stored_name,
        original_name=original_name,
        mime_type=upload.content_type,
        size=len(contents),
        url=file_url,
        folder_id=folder_id,
        client_id=scoped_client_id,
        uploaded_by=current_user.id,
    ))
    await db.commit()
    return file_obj


# -- Folders --
@router.get("/folders", response_model=list[FileFolderRead])
async def list_folders(
    skip: int = 0, limit: int = 100,
    client_id: uuid.UUID | None = Query(None),
    service: FileFolderService = Depends(get_file_folder_service),
    _: User = Depends(get_current_user),
    scoped_client_id: uuid.UUID | None = Depends(get_current_client_id),
):
    effective_client_id = scoped_client_id if scoped_client_id is not None else client_id
    return await service.list_all(client_id=effective_client_id, skip=skip, limit=limit)


@router.get("/folders/{id}", response_model=FileFolderRead)
async def get_folder(id: uuid.UUID, service: FileFolderService = Depends(get_file_folder_service), _: User = Depends(get_current_user), scoped_client_id: uuid.UUID | None = Depends(get_current_client_id)):
    return await service.get(id, scoped_client_id=scoped_client_id)


@router.post("/folders", response_model=FileFolderRead, status_code=status.HTTP_201_CREATED)
async def create_folder(data: FileFolderCreate, db: AsyncSession = Depends(get_db), service: FileFolderService = Depends(get_file_folder_service), current_user: User = Depends(get_current_user), scoped_client_id: uuid.UUID | None = Depends(get_current_client_id)):
    payload = data.model_dump()
    if scoped_client_id is not None:
        payload["client_id"] = scoped_client_id
    payload["created_by"] = current_user.id
    folder = await service.create(FileFolderCreate(**payload))
    await db.commit()
    return folder


@router.delete("/folders/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_folder(id: uuid.UUID, db: AsyncSession = Depends(get_db), service: FileFolderService = Depends(get_file_folder_service), _: User = Depends(get_current_user), scoped_client_id: uuid.UUID | None = Depends(get_current_client_id)):
    await service.delete(id, scoped_client_id=scoped_client_id)
    await db.commit()


# -- Files --
@router.get("", response_model=list[FileRead])
async def list_files(
    skip: int = 0, limit: int = 100,
    client_id: uuid.UUID | None = Query(None),
    folder_id: uuid.UUID | None = Query(None),
    service: FileService = Depends(get_file_service),
    _: User = Depends(get_current_user),
    scoped_client_id: uuid.UUID | None = Depends(get_current_client_id),
):
    effective_client_id = scoped_client_id if scoped_client_id is not None else client_id
    return await service.list_all(client_id=effective_client_id, folder_id=folder_id, skip=skip, limit=limit)


@router.get("/{id}", response_model=FileRead)
async def get_file(id: uuid.UUID, service: FileService = Depends(get_file_service), _: User = Depends(get_current_user), scoped_client_id: uuid.UUID | None = Depends(get_current_client_id)):
    return await service.get(id, scoped_client_id=scoped_client_id)


@router.post("", response_model=FileRead, status_code=status.HTTP_201_CREATED)
async def create_file(data: FileCreate, db: AsyncSession = Depends(get_db), service: FileService = Depends(get_file_service), current_user: User = Depends(get_current_user), scoped_client_id: uuid.UUID | None = Depends(get_current_client_id)):
    payload = data.model_dump()
    if scoped_client_id is not None:
        payload["client_id"] = scoped_client_id
    payload["uploaded_by"] = current_user.id
    file_obj = await service.create(FileCreate(**payload))
    await db.commit()
    return file_obj


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_file(id: uuid.UUID, db: AsyncSession = Depends(get_db), service: FileService = Depends(get_file_service), _: User = Depends(get_current_user), scoped_client_id: uuid.UUID | None = Depends(get_current_client_id)):
    await service.delete(id, scoped_client_id=scoped_client_id)
    await db.commit()
