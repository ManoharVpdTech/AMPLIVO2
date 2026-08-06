import uuid

from fastapi import APIRouter, Depends, Request

from app.api.v1.auth.session_responses import (
    SESSION_LIST_RESPONSES,
    TERMINATE_CURRENT_SESSION_RESPONSES,
    TERMINATE_SESSION_RESPONSES,
)
from app.dependencies.auth import get_current_user
from app.dependencies.services import get_session_service
from app.models.user import User
from app.models.user_session import UserSession
from app.schemas.auth import MessageResponse
from app.schemas.session import SessionRead
from app.services.session_service import SessionService
from app.utils.request_context import resolve_client_context
from app.utils.session_context import resolve_session_id

router = APIRouter(prefix="/auth", tags=["Session Management"])


def _to_session_read(session: UserSession, current_session_id: uuid.UUID | None) -> SessionRead:
    now = session.expires_at.tzinfo and session.expires_at or None
    is_expired = session.expires_at <= session.created_at if session.expires_at else False
    return SessionRead(
        id=session.id,
        user_id=session.user_id,
        device_name=session.device_name,
        browser=session.browser,
        operating_system=session.operating_system,
        ip_address=session.ip_address,
        country=session.country,
        city=session.city,
        is_active=session.is_active,
        is_revoked=not session.is_active,
        is_expired=is_expired,
        last_activity=session.last_activity,
        created_at=session.created_at,
        expires_at=session.expires_at,
        is_current=current_session_id is not None and session.id == current_session_id,
    )


@router.get(
    "/sessions",
    response_model=list[SessionRead],
    summary="List the current user's active sessions",
    responses=SESSION_LIST_RESPONSES,
)
async def list_sessions(
    request: Request,
    current_user: User = Depends(get_current_user),
    session_service: SessionService = Depends(get_session_service),
) -> list[SessionRead]:
    current_session_id = resolve_session_id(request)
    sessions = await session_service.list_sessions(current_user.id)
    return [_to_session_read(session, current_session_id) for session in sessions]


@router.get(
    "/devices",
    response_model=list[SessionRead],
    summary="List every device the current user has ever logged in from",
    responses=SESSION_LIST_RESPONSES,
)
async def list_devices(
    request: Request,
    current_user: User = Depends(get_current_user),
    session_service: SessionService = Depends(get_session_service),
) -> list[SessionRead]:
    current_session_id = resolve_session_id(request)
    sessions = await session_service.list_devices(current_user.id)
    return [_to_session_read(session, current_session_id) for session in sessions]


# NOTE: this literal route MUST be declared before /sessions/{session_id} -
# Starlette tries routes in registration order, and {session_id} would
# otherwise greedily match the literal path segment "current" and fail
# UUID conversion with a 422 instead of falling through to this handler.
@router.delete(
    "/sessions/current",
    response_model=MessageResponse,
    summary="Terminate the current session",
    responses=TERMINATE_CURRENT_SESSION_RESPONSES,
)
async def logout_current_session(
    request: Request,
    current_user: User = Depends(get_current_user),
    session_service: SessionService = Depends(get_session_service),
) -> MessageResponse:
    current_session_id = resolve_session_id(request)
    client_context = resolve_client_context(request)
    await session_service.terminate_current_session(
        user_id=current_user.id,
        current_session_id=current_session_id,
        endpoint=request.url.path,
        request_method=request.method,
        client_context=client_context,
    )
    return MessageResponse(message="Current session terminated.")


@router.delete(
    "/sessions/{session_id}",
    response_model=MessageResponse,
    summary="Terminate a specific session",
    responses=TERMINATE_SESSION_RESPONSES,
)
async def logout_session(
    session_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    session_service: SessionService = Depends(get_session_service),
) -> MessageResponse:
    client_context = resolve_client_context(request)
    await session_service.terminate_session(
        user_id=current_user.id,
        session_id=session_id,
        endpoint=request.url.path,
        request_method=request.method,
        client_context=client_context,
    )
    return MessageResponse(message="Session terminated.")


@router.delete(
    "/sessions",
    response_model=MessageResponse,
    summary="Terminate every session except the current one",
    responses=SESSION_LIST_RESPONSES,
)
async def logout_all_sessions(
    request: Request,
    current_user: User = Depends(get_current_user),
    session_service: SessionService = Depends(get_session_service),
) -> MessageResponse:
    current_session_id = resolve_session_id(request)
    client_context = resolve_client_context(request)
    terminated = await session_service.terminate_all_other_sessions(
        user_id=current_user.id,
        current_session_id=current_session_id,
        endpoint=request.url.path,
        request_method=request.method,
        client_context=client_context,
    )
    return MessageResponse(message=f"Terminated {terminated} other session(s).")
