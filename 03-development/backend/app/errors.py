"""Standard error envelope (API Contract v1 §4).

Every non-2xx response is `{ "error": { "code", "message", "details" } }` so the
frontend writes error handling once. Raise `api_error(...)` for coded errors.
"""

from fastapi import FastAPI, HTTPException, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

_DEFAULT_CODES = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    413: "PAYLOAD_TOO_LARGE",
    415: "UNSUPPORTED_MEDIA_TYPE",
    422: "VALIDATION_ERROR",
    429: "BUDGET_EXCEEDED",
    500: "INTERNAL_ERROR",
}


def api_error(status_code: int, code: str, message: str, details: dict | None = None) -> HTTPException:
    """Return an HTTPException carrying a coded error body. Use as `raise api_error(...)`."""
    return HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "details": details},
    )


def _envelope(status_code: int, detail) -> dict:
    if isinstance(detail, dict) and "code" in detail:
        return {"error": {"code": detail["code"], "message": detail.get("message", ""), "details": detail.get("details")}}
    return {"error": {"code": _DEFAULT_CODES.get(status_code, "ERROR"), "message": str(detail), "details": None}}


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(StarletteHTTPException)
    async def _http(request: Request, exc: StarletteHTTPException):
        return JSONResponse(status_code=exc.status_code, content=_envelope(exc.status_code, exc.detail))

    @app.exception_handler(RequestValidationError)
    async def _validation(request: Request, exc: RequestValidationError):
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Request validation failed",
                    "details": jsonable_encoder(exc.errors()),
                }
            },
        )
