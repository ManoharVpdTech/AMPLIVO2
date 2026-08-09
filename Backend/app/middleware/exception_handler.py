import logging

from fastapi import FastAPI, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from sqlalchemy.exc import IntegrityError

from app.core.exceptions import AppException

logger = logging.getLogger(__name__)

_ERROR_CODES: dict[int, str] = {
    400: "bad_request",
    401: "unauthorized",
    403: "forbidden",
    404: "not_found",
    405: "method_not_allowed",
    409: "conflict",
    422: "validation_error",
    429: "too_many_requests",
    500: "internal_error",
    502: "bad_gateway",
    503: "service_unavailable",
}


def _request_id(request: Request) -> str | None:
    return getattr(request.state, "request_id", None)


def _correlation_id(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _enrich(content: dict, request: Request) -> dict:
    rid = _request_id(request)
    cid = _correlation_id(request)
    if rid:
        content["request_id"] = rid
    if cid:
        content["correlation_id"] = cid
    return content


def error_response(exc: AppException, request: Request | None = None) -> JSONResponse:
    """Build the standard ``{error_code, message}`` JSON body.

    Exposed separately because exceptions raised inside
    ``BaseHTTPMiddleware.dispatch()`` never reach FastAPI's exception
    middleware — those handlers must build and return the response
    themselves.
    """
    content: dict = {"error_code": exc.error_code, "message": exc.message}
    if request is not None:
        _enrich(content, request)
    response = JSONResponse(status_code=exc.status_code, content=content)
    retry_after = getattr(exc, "retry_after", None)
    if retry_after is not None:
        response.headers["Retry-After"] = str(retry_after)
    return response


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppException)
    async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
        return error_response(exc, request)

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        content: dict = {
            "error_code": "validation_error",
            "message": "Request validation failed.",
            "details": exc.errors(),
        }
        _enrich(content, request)
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=jsonable_encoder(content),
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = _ERROR_CODES.get(exc.status_code, "http_error")
        message = str(exc.detail) if exc.detail else _default_message(exc.status_code)
        content: dict = {"error_code": code, "message": message}
        _enrich(content, request)
        return JSONResponse(status_code=exc.status_code, content=content)

    @app.exception_handler(IntegrityError)
    async def integrity_error_handler(request: Request, exc: IntegrityError) -> JSONResponse:
        logger.warning("Database IntegrityError: %s", exc)
        content: dict = {
            "error_code": "validation_error",
            "message": "A database integrity constraint was violated (e.g., invalid reference or duplicate entry).",
        }
        _enrich(content, request)
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=content,
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        rid = _request_id(request)
        cid = _correlation_id(request)
        extra = {"method": request.method, "path": request.url.path}
        if rid:
            extra["request_id"] = rid
        if cid:
            extra["correlation_id"] = cid
        logger.exception("Unhandled exception", extra=extra)
        content: dict = {
            "error_code": "internal_error",
            "message": "An unexpected error occurred.",
        }
        _enrich(content, request)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=content,
        )


def _default_message(status_code: int) -> str:
    messages = {
        400: "Bad request.",
        401: "Not authenticated.",
        403: "Forbidden.",
        404: "Not found.",
        405: "Method not allowed.",
        409: "Conflict.",
        422: "Unprocessable entity.",
        429: "Too many requests.",
        500: "Internal server error.",
        502: "Bad gateway.",
        503: "Service unavailable.",
    }
    return messages.get(status_code, "An error occurred.")
