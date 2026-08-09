import logging

from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


class UnhandledErrorMiddleware:
    """Turns an exception that escapes the router/other middleware into a
    normal ASGI response instead of letting it reach Starlette's
    ServerErrorMiddleware.

    Starlette always wraps the whole app in an implicit ServerErrorMiddleware
    that sits OUTSIDE every middleware added via app.add_middleware() -
    including CORSMiddleware - and it's what @app.exception_handler(Exception)
    is wired to. A response built there never passes back through
    CORSMiddleware, so the browser sees a 500 with no
    Access-Control-Allow-Origin header and reports a misleading CORS error
    instead of the real one. This must be registered as the outermost
    middleware except CORS (added last, just before CORSMiddleware) so it
    still sits inside CORS and its response gets CORS headers attached.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        started = False

        async def send_wrapper(message):
            nonlocal started
            if message["type"] == "http.response.start":
                started = True
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        except Exception:
            logger.exception(
                "Unhandled exception while processing %s %s",
                scope.get("method"),
                scope.get("path"),
            )
            # Env-gated error tracking: only sends when SENTRY_DSN is configured.
            from app.core.sentry import capture_exception

            capture_exception()
            if started:
                raise
            response = JSONResponse(
                status_code=500,
                content={"error_code": "internal_error", "message": "An unexpected error occurred."},
            )
            await response(scope, receive, send)
