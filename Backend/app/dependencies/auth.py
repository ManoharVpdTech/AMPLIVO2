import uuid

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppException, InactiveUserException, InvalidTokenException, UserNotFoundException
from app.dependencies.db import get_db
from app.dependencies.services import get_audit_service
from app.models.audit_log import AuditAction, AuditStatus
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.services.audit_service import AuditService
from app.utils.jwt import decode_token
from app.utils.request_context import resolve_client_context

bearer_scheme = HTTPBearer(
    auto_error=False,
    description="JWT access token issued by /auth/login or /auth/refresh",
)


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
    audit_service: AuditService = Depends(get_audit_service),
) -> User:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    client_context = resolve_client_context(request)
    endpoint = request.url.path
    request_method = request.method

    try:
        payload = decode_token(credentials.credentials, expected_type="access")
    except AppException as exc:
        try:
            await audit_service.log(
                user_id=None,
                action=AuditAction.INVALID_TOKEN,
                endpoint=endpoint,
                request_method=request_method,
                client_context=client_context,
                status=AuditStatus.FAILURE,
                message=str(exc),
            )
            await db.commit()
        except Exception:
            await db.rollback()
        raise

    session_id = payload.get("session_id")
    if session_id:
        from app.repositories.user_session_repository import UserSessionRepository
        user_session = await UserSessionRepository(db).get_by_id(uuid.UUID(session_id))
        if user_session is None or not user_session.is_active:
            raise InvalidTokenException("The session associated with this token has been terminated.")

    user_id = payload.get("sub")
    if not user_id:
        try:
            await audit_service.log(
                user_id=None,
                action=AuditAction.INVALID_TOKEN,
                endpoint=endpoint,
                request_method=request_method,
                client_context=client_context,
                status=AuditStatus.FAILURE,
                message="Token missing subject claim.",
            )
            await db.commit()
        except Exception:
            await db.rollback()
        raise InvalidTokenException()

    user = await UserRepository(db).get_by_id(uuid.UUID(user_id))
    if user is None:
        try:
            await audit_service.log(
                user_id=None,
                action=AuditAction.INVALID_TOKEN,
                endpoint=endpoint,
                request_method=request_method,
                client_context=client_context,
                status=AuditStatus.FAILURE,
                message="Token subject does not match any active user.",
            )
            await db.commit()
        except Exception:
            await db.rollback()
        raise UserNotFoundException()
    if not user.is_active:
        try:
            await audit_service.log(
                user_id=user.id,
                action=AuditAction.ACCESS_DENIED,
                endpoint=endpoint,
                request_method=request_method,
                client_context=client_context,
                status=AuditStatus.FAILURE,
                message="User is inactive.",
            )
            await db.commit()
        except Exception:
            await db.rollback()
        raise InactiveUserException()

    return user
