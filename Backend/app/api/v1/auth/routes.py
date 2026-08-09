from fastapi import APIRouter, Depends, Query, Request, status
from pydantic import EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.v1.auth.responses import (
    LOGIN_RESPONSES,
    LOGOUT_RESPONSES,
    ME_RESPONSES,
    REFRESH_RESPONSES,
    REGISTER_RESPONSES,
)
from app.core.exceptions import InvalidCredentialsException, WeakPasswordException, PasswordReuseException
from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db
from app.dependencies.services import get_auth_service, get_user_service
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    LogoutRequest,
    MessageResponse,
    RefreshTokenRequest,
    TokenResponse,
)
from app.schemas.user import EmailExistsResponse, UserCreate, UserRead, UsernameExistsResponse
from app.services.auth_service import AuthService
from app.services.user_service import UserService
from app.utils.password import hash_password, is_strong_password, verify_password
from app.utils.request_context import resolve_client_context

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
    responses=REGISTER_RESPONSES,
)
async def register(
    payload: UserCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user_service: UserService = Depends(get_user_service),
) -> User:
    client_context = resolve_client_context(request)
    user = await user_service.register_user(
        email=payload.email,
        username=payload.username,
        full_name=payload.full_name,
        password=payload.password,
        endpoint=request.url.path,
        request_method=request.method,
        client_context=client_context,
    )
    await db.commit()
    return user


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Authenticate with email/username and password",
    responses=LOGIN_RESPONSES,
)
async def login(
    payload: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    auth_service: AuthService = Depends(get_auth_service),
) -> TokenResponse:
    client_context = resolve_client_context(request)
    tokens = await auth_service.authenticate(
        identifier=payload.identifier,
        password=payload.password,
        endpoint=request.url.path,
        request_method=request.method,
        client_context=client_context,
    )
    await db.commit()
    return tokens


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Exchange a valid refresh token for a new access/refresh token pair",
    responses=REFRESH_RESPONSES,
)
async def refresh(
    payload: RefreshTokenRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    auth_service: AuthService = Depends(get_auth_service),
) -> TokenResponse:
    client_context = resolve_client_context(request)
    tokens = await auth_service.refresh(
        refresh_token=payload.refresh_token,
        endpoint=request.url.path,
        request_method=request.method,
        client_context=client_context,
    )
    await db.commit()
    return tokens


@router.post(
    "/logout",
    response_model=MessageResponse,
    summary="Revoke a refresh token, ending that session",
    responses=LOGOUT_RESPONSES,
)
async def logout(
    payload: LogoutRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    auth_service: AuthService = Depends(get_auth_service),
) -> MessageResponse:
    client_context = resolve_client_context(request)
    await auth_service.logout(
        refresh_token=payload.refresh_token,
        endpoint=request.url.path,
        request_method=request.method,
        client_context=client_context,
    )
    await db.commit()
    return MessageResponse(message="Successfully logged out.")


@router.get(
    "/me",
    response_model=UserRead,
    summary="Get the currently authenticated user's profile",
    responses=ME_RESPONSES,
)
async def get_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserRead:
    stmt = select(User).where(User.id == current_user.id).options(selectinload(User.role))
    result = await db.execute(stmt)
    user_with_role = result.scalar_one()
    return UserRead(
        id=user_with_role.id,
        email=user_with_role.email,
        username=user_with_role.username,
        full_name=user_with_role.full_name,
        is_active=user_with_role.is_active,
        is_verified=user_with_role.is_verified,
        verified_at=user_with_role.verified_at,
        last_login_at=user_with_role.last_login_at,
        created_at=user_with_role.created_at,
        updated_at=user_with_role.updated_at,
        role_name=user_with_role.role.name if user_with_role.role else None,
    )


@router.post(
    "/change-password",
    response_model=MessageResponse,
    summary="Change the current user's password",
)
async def change_password(
    payload: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MessageResponse:
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise InvalidCredentialsException()
    if payload.new_password == payload.current_password:
        raise PasswordReuseException()
    if not is_strong_password(payload.new_password):
        raise WeakPasswordException()
    repo = UserRepository(db)
    await repo.update_password(current_user, hashed_password=hash_password(payload.new_password))
    await db.commit()
    return MessageResponse(message="Password changed successfully.")


@router.get(
    "/check-email",
    response_model=EmailExistsResponse,
    summary="Check whether an email address is already registered",
)
async def check_email(
    email: EmailStr = Query(..., description="Email address to check"),
    user_service: UserService = Depends(get_user_service),
) -> EmailExistsResponse:
    exists = await user_service.check_email_exists(email)
    return EmailExistsResponse(email=email, exists=exists)


@router.get(
    "/check-username",
    response_model=UsernameExistsResponse,
    summary="Check whether a username is already taken",
)
async def check_username(
    username: str = Query(..., min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_.]+$", description="Username to check"),
    user_service: UserService = Depends(get_user_service),
) -> UsernameExistsResponse:
    exists = await user_service.check_username_exists(username)
    return UsernameExistsResponse(username=username, exists=exists)
