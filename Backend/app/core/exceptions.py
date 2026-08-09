class AppException(Exception):
    """Base class for all application-raised, client-facing errors."""

    status_code: int = 500
    error_code: str = "internal_error"
    message: str = "An unexpected error occurred."

    def __init__(self, message: str | None = None) -> None:
        if message is not None:
            self.message = message
        super().__init__(self.message)


class EmailAlreadyExistsException(AppException):
    status_code = 409
    error_code = "email_already_exists"
    message = "A user with this email address already exists."


class UsernameAlreadyExistsException(AppException):
    status_code = 409
    error_code = "username_already_exists"
    message = "This username is already taken."


class InvalidCredentialsException(AppException):
    status_code = 401
    error_code = "invalid_credentials"
    message = "Incorrect email/username or password."


class InactiveUserException(AppException):
    status_code = 403
    error_code = "inactive_user"
    message = "This user account is inactive."


class UserNotFoundException(AppException):
    status_code = 404
    error_code = "user_not_found"
    message = "User not found."


class InvalidTokenException(AppException):
    status_code = 401
    error_code = "invalid_token"
    message = "The provided token is invalid."


class TokenExpiredException(AppException):
    status_code = 401
    error_code = "token_expired"
    message = "The provided token has expired."


class TokenRevokedException(AppException):
    status_code = 401
    error_code = "token_revoked"
    message = "The provided refresh token has been revoked."


class AccountLockedException(AppException):
    status_code = 423
    error_code = "account_locked"
    message = "Account is temporarily locked due to too many failed login attempts."

    def __init__(self, message: str | None = None, retry_after: int | None = None) -> None:
        super().__init__(message)
        self.retry_after = retry_after


class RateLimitException(AppException):
    status_code = 429
    error_code = "rate_limit_exceeded"
    message = "Too many requests. Please try again later."

    def __init__(self, message: str | None = None, retry_after: int | None = None) -> None:
        super().__init__(message)
        # Seconds until the caller may retry - surfaced as a Retry-After
        # response header by error_response(). None when not computed by
        # the caller (falls back to no header, never a wrong value).
        self.retry_after = retry_after


class CSRFException(AppException):
    status_code = 403
    error_code = "csrf_token_invalid"
    message = "CSRF token missing or invalid."


class ReservedUsernameException(AppException):
    status_code = 409
    error_code = "reserved_username"
    message = "This username is reserved and cannot be used."


class EmailAlreadyVerifiedException(AppException):
    status_code = 409
    error_code = "email_already_verified"
    message = "This email address has already been verified."


class VerificationTokenExpiredException(AppException):
    status_code = 401
    error_code = "verification_token_expired"
    message = "The email verification token has expired."


class VerificationTokenInvalidException(AppException):
    status_code = 401
    error_code = "verification_token_invalid"
    message = "The email verification token is invalid or has already been used."


class PasswordResetTokenExpiredException(AppException):
    status_code = 401
    error_code = "password_reset_token_expired"
    message = "The password reset token has expired."


class PasswordResetTokenInvalidException(AppException):
    status_code = 401
    error_code = "password_reset_token_invalid"
    message = "The password reset token is invalid or has already been used."


class WeakPasswordException(AppException):
    status_code = 400
    error_code = "weak_password"
    message = (
        "Password must be at least 8 characters and include an uppercase letter, "
        "a lowercase letter, a number, and a special character."
    )


class SessionNotFoundException(AppException):
    status_code = 404
    error_code = "session_not_found"
    message = "Session not found or already terminated."


# ── Generic module exceptions (reused across all domain modules) ────────


class NotFoundException(AppException):
    """Raised when a requested resource does not exist."""

    status_code = 404
    error_code = "not_found"

    def __init__(self, resource: str = "Resource", identifier: str | None = None) -> None:
        detail = f"{resource} not found." if not identifier else f"{resource} '{identifier}' not found."
        super().__init__(detail)


class DuplicateException(AppException):
    """Raised when creation would violate a uniqueness constraint."""

    status_code = 409
    error_code = "duplicate"

    def __init__(self, resource: str = "Resource", field: str | None = None) -> None:
        detail = (
            f"{resource} already exists."
            if not field
            else f"{resource} with this {field} already exists."
        )
        super().__init__(detail)


class ForbiddenException(AppException):
    """Raised when an authenticated user lacks permission for the action."""

    status_code = 403
    error_code = "forbidden"
    message = "You do not have permission to perform this action."


class BadRequestException(AppException):
    """Raised for generic client-side input errors not covered by validation."""

    status_code = 400
    error_code = "bad_request"
    message = "Bad request."


class PasswordReuseException(AppException):
    status_code = 400
    error_code = "password_reuse"
    message = "New password cannot be the same as the current password."
