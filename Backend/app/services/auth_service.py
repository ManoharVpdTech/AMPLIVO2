import hashlib
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import (
    AccountLockedException,
    AppException,
    InactiveUserException,
    InvalidCredentialsException,
    InvalidTokenException,
    TokenRevokedException,
)
from app.models.audit_log import AuditAction, AuditStatus
from app.repositories.login_history_repository import LoginHistoryRepository
from app.repositories.refresh_token_repository import RefreshTokenRepository
from app.repositories.user_repository import UserRepository
from app.repositories.user_session_repository import UserSessionRepository
from app.schemas.auth import TokenResponse
from app.services.audit_service import AuditService
from app.services.geolocation_service import GeoLocationService
from app.utils.jwt import create_access_token, create_refresh_token, decode_token
from app.utils.password import verify_password
from app.utils.request_context import ClientContext
from app.utils.time import as_aware_utc, utc_now


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


class AuthService:
    def __init__(
        self,
        db: AsyncSession,
        user_repository: UserRepository,
        refresh_token_repository: RefreshTokenRepository,
        login_history_repository: LoginHistoryRepository,
        audit_service: AuditService,
        user_session_repository: UserSessionRepository,
        geolocation_service: GeoLocationService,
    ) -> None:
        self._db = db
        self._user_repository = user_repository
        self._refresh_token_repository = refresh_token_repository
        self._login_history_repository = login_history_repository
        self._audit_service = audit_service
        self._user_session_repository = user_session_repository
        self._geolocation_service = geolocation_service

    async def authenticate(
        self,
        *,
        identifier: str,
        password: str,
        endpoint: str,
        request_method: str,
        client_context: ClientContext,
    ) -> TokenResponse:
        user = await self._user_repository.get_by_email_or_username(identifier)

        locked_until = as_aware_utc(user.locked_until) if user is not None else None
        if locked_until is not None and locked_until > utc_now():
            if user is not None and verify_password(password, user.hashed_password):
                # Correct password: bypass the lockout check so owner can still log in
                pass
            else:
                retry_after_seconds = int((locked_until - utc_now()).total_seconds())
                await self._audit_service.log(
                    user_id=user.id,
                    action=AuditAction.ACCESS_DENIED,
                    endpoint=endpoint,
                    request_method=request_method,
                    client_context=client_context,
                    status=AuditStatus.FAILURE,
                    message="Login rejected: account is locked.",
                )
                await self._db.commit()
                raise AccountLockedException(retry_after=max(1, retry_after_seconds))

        if user is None:
            from app.utils.password import dummy_verify
            dummy_verify()

        if user is None or not verify_password(password, user.hashed_password):
            if user is not None:
                await self._user_repository.increment_failed_login(
                    user,
                    max_attempts=settings.MAX_FAILED_LOGIN_ATTEMPTS,
                    lock_minutes=settings.ACCOUNT_LOCK_MINUTES,
                )
            await self._audit_service.log(
                user_id=user.id if user is not None else None,
                action=AuditAction.LOGIN_FAILED,
                endpoint=endpoint,
                request_method=request_method,
                client_context=client_context,
                status=AuditStatus.FAILURE,
                message="Invalid credentials.",
            )
            await self._db.commit()
            raise InvalidCredentialsException()

        if not user.is_active:
            await self._audit_service.log(
                user_id=user.id,
                action=AuditAction.ACCESS_DENIED,
                endpoint=endpoint,
                request_method=request_method,
                client_context=client_context,
                status=AuditStatus.FAILURE,
                message="Login rejected: account is inactive.",
            )
            await self._db.commit()
            raise InactiveUserException()

        await self._user_repository.reset_failed_login(user)
        await self._user_repository.record_successful_login(user, ip_address=client_context.ip_address)

        is_known_device = await self._user_session_repository.exists_matching_device_for_user(
            user.id,
            browser=client_context.browser,
            operating_system=client_context.operating_system,
            device_name=client_context.device,
        )

        tokens, refresh_token_id, _ = await self._issue_tokens(user.id, client_context=client_context)

        await self._login_history_repository.create(
            user_id=user.id,
            login_time=utc_now(),
            ip_address=client_context.ip_address,
            browser=client_context.browser,
            operating_system=client_context.operating_system,
            device=client_context.device,
            refresh_token_id=refresh_token_id,
        )

        await self._audit_service.log(
            user_id=user.id,
            action=AuditAction.LOGIN_SUCCESS,
            endpoint=endpoint,
            request_method=request_method,
            client_context=client_context,
            status=AuditStatus.SUCCESS,
            message="Login successful.",
        )

        if not is_known_device:
            await self._audit_service.log(
                user_id=user.id,
                action=AuditAction.NEW_DEVICE_LOGIN,
                endpoint=endpoint,
                request_method=request_method,
                client_context=client_context,
                status=AuditStatus.SUCCESS,
                message="Login detected from a new device.",
            )

        return tokens

    async def refresh(
        self,
        *,
        refresh_token: str,
        endpoint: str,
        request_method: str,
        client_context: ClientContext,
    ) -> TokenResponse:
        try:
            payload = decode_token(refresh_token, expected_type="refresh")
        except AppException as exc:
            await self._audit_service.log(
                user_id=None,
                action=AuditAction.INVALID_TOKEN,
                endpoint=endpoint,
                request_method=request_method,
                client_context=client_context,
                status=AuditStatus.FAILURE,
                message=str(exc),
            )
            await self._db.commit()
            raise

        token_id = payload.get("jti")
        subject = payload.get("sub")
        if not token_id or not subject:
            await self._audit_service.log(
                user_id=None,
                action=AuditAction.INVALID_TOKEN,
                endpoint=endpoint,
                request_method=request_method,
                client_context=client_context,
                status=AuditStatus.FAILURE,
                message="Malformed refresh token payload.",
            )
            await self._db.commit()
            raise InvalidTokenException()

        stored_token = await self._refresh_token_repository.get_by_id(uuid.UUID(token_id))
        if stored_token is None or stored_token.token_hash != _hash_token(refresh_token):
            await self._audit_service.log(
                user_id=uuid.UUID(subject),
                action=AuditAction.INVALID_TOKEN,
                endpoint=endpoint,
                request_method=request_method,
                client_context=client_context,
                status=AuditStatus.FAILURE,
                message="Refresh token not recognized.",
            )
            await self._db.commit()
            raise InvalidTokenException()

        if stored_token.is_revoked:
            await self._audit_service.log(
                user_id=stored_token.user_id,
                action=AuditAction.ACCESS_DENIED,
                endpoint=endpoint,
                request_method=request_method,
                client_context=client_context,
                status=AuditStatus.FAILURE,
                message="Refresh token has already been revoked.",
            )
            await self._db.commit()
            raise TokenRevokedException()

        user = await self._user_repository.get_by_id(stored_token.user_id)
        if user is None:
            await self._audit_service.log(
                user_id=stored_token.user_id,
                action=AuditAction.INVALID_TOKEN,
                endpoint=endpoint,
                request_method=request_method,
                client_context=client_context,
                status=AuditStatus.FAILURE,
                message="Refresh token subject no longer exists.",
            )
            await self._db.commit()
            raise InvalidTokenException()
        if not user.is_active:
            await self._audit_service.log(
                user_id=user.id,
                action=AuditAction.ACCESS_DENIED,
                endpoint=endpoint,
                request_method=request_method,
                client_context=client_context,
                status=AuditStatus.FAILURE,
                message="Refresh rejected: account is inactive.",
            )
            await self._db.commit()
            raise InactiveUserException()

        existing_session = await self._user_session_repository.get_by_refresh_token_id(stored_token.id)

        await self._refresh_token_repository.touch_last_used(stored_token)
        # Rotate: the presented refresh token is single-use, so revoke it before
        # issuing the replacement pair. Any later replay attempt hits is_revoked.
        await self._refresh_token_repository.revoke(stored_token)

        tokens, new_refresh_token_id, _ = await self._issue_tokens(
            user.id,
            client_context=client_context,
            session_id=existing_session.id if existing_session is not None else None,
        )

        login_history = await self._login_history_repository.get_active_by_refresh_token_id(
            stored_token.id
        )
        if login_history is not None:
            await self._login_history_repository.reassign_refresh_token(
                login_history, new_refresh_token_id
            )

        await self._audit_service.log(
            user_id=user.id,
            action=AuditAction.REFRESH_TOKEN,
            endpoint=endpoint,
            request_method=request_method,
            client_context=client_context,
            status=AuditStatus.SUCCESS,
            message="Refresh token rotated successfully.",
        )

        return tokens

    async def logout(
        self,
        *,
        refresh_token: str,
        endpoint: str,
        request_method: str,
        client_context: ClientContext,
    ) -> None:
        try:
            payload = decode_token(refresh_token, expected_type="refresh")
        except AppException as exc:
            await self._audit_service.log(
                user_id=None,
                action=AuditAction.INVALID_TOKEN,
                endpoint=endpoint,
                request_method=request_method,
                client_context=client_context,
                status=AuditStatus.FAILURE,
                message=str(exc),
            )
            await self._db.commit()
            raise

        token_id = payload.get("jti")
        if not token_id:
            await self._audit_service.log(
                user_id=None,
                action=AuditAction.INVALID_TOKEN,
                endpoint=endpoint,
                request_method=request_method,
                client_context=client_context,
                status=AuditStatus.FAILURE,
                message="Malformed refresh token payload.",
            )
            await self._db.commit()
            raise InvalidTokenException()

        stored_token = await self._refresh_token_repository.get_by_id(uuid.UUID(token_id))
        if stored_token is None or stored_token.token_hash != _hash_token(refresh_token):
            await self._audit_service.log(
                user_id=None,
                action=AuditAction.INVALID_TOKEN,
                endpoint=endpoint,
                request_method=request_method,
                client_context=client_context,
                status=AuditStatus.FAILURE,
                message="Refresh token not recognized.",
            )
            await self._db.commit()
            raise InvalidTokenException()

        if not stored_token.is_revoked:
            await self._refresh_token_repository.revoke(stored_token)

        existing_session = await self._user_session_repository.get_by_refresh_token_id(stored_token.id)
        if existing_session is not None:
            await self._user_session_repository.revoke(existing_session)

        login_history = await self._login_history_repository.get_active_by_refresh_token_id(
            stored_token.id
        )
        if login_history is not None:
            await self._login_history_repository.close_session(login_history)

        await self._audit_service.log(
            user_id=stored_token.user_id,
            action=AuditAction.LOGOUT,
            endpoint=endpoint,
            request_method=request_method,
            client_context=client_context,
            status=AuditStatus.SUCCESS,
            message="Logout successful.",
        )

    async def _issue_tokens(
        self,
        user_id: uuid.UUID,
        *,
        client_context: ClientContext,
        session_id: uuid.UUID | None = None,
    ) -> tuple[TokenResponse, uuid.UUID, uuid.UUID]:
        """Issue an access/refresh token pair, and either create a new
        user_sessions row (session_id is None - a fresh login) or keep an
        existing session alive across rotation (session_id given - a
        refresh), reassigning it to the new refresh token and touching its
        last_activity/expires_at per the refresh-token-synchronization
        requirement.
        """
        resolved_session_id = session_id or uuid.uuid4()

        access_token = create_access_token(user_id, session_id=resolved_session_id)
        refresh_token, jti, expires_at = create_refresh_token(user_id, session_id=resolved_session_id)
        token_id = uuid.UUID(jti)

        await self._refresh_token_repository.create(
            token_id=token_id,
            user_id=user_id,
            token_hash=_hash_token(refresh_token),
            expires_at=expires_at,
            ip_address=client_context.ip_address,
            user_agent=client_context.user_agent,
            browser=client_context.browser,
            operating_system=client_context.operating_system,
            device_name=client_context.device,
        )

        if session_id is None:
            location = self._geolocation_service.locate(client_context.ip_address)
            await self._user_session_repository.create(
                session_id=resolved_session_id,
                user_id=user_id,
                refresh_token_id=token_id,
                device_name=client_context.device,
                browser=client_context.browser,
                operating_system=client_context.operating_system,
                ip_address=client_context.ip_address,
                country=location.country,
                city=location.city,
                expires_at=expires_at,
            )
        else:
            existing_session = await self._user_session_repository.get_by_id(resolved_session_id)
            if existing_session is not None:
                await self._user_session_repository.reassign_refresh_token_and_touch(
                    existing_session, new_refresh_token_id=token_id, expires_at=expires_at
                )

        return (
            TokenResponse(access_token=access_token, refresh_token=refresh_token),
            token_id,
            resolved_session_id,
        )
