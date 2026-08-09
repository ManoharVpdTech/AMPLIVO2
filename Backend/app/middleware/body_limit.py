from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from app.core.exceptions import InvalidContentLengthException, PayloadTooLargeException
from app.middleware.exception_handler import error_response

class ContentSizeLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, max_content_size: int = 102_400):  # 100 KB
        super().__init__(app)
        self.max_content_size = max_content_size

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if request.method in ("POST", "PUT", "PATCH"):
            content_length = request.headers.get("content-length")
            if content_length:
                try:
                    if int(content_length) > self.max_content_size:
                        return error_response(PayloadTooLargeException(), request)
                except ValueError:
                    return error_response(InvalidContentLengthException(), request)
        return await call_next(request)
