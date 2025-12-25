"""
Global Error Handler Middleware

Catches all exceptions and returns standardized error responses
"""

from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError, OperationalError, DisconnectionError
import logging
from typing import Dict

from app.schemas.responses import ErrorCodes, create_error_response, create_validation_error

logger = logging.getLogger(__name__)


def get_cors_headers(request: Request) -> Dict[str, str]:
    """Get CORS headers for the request origin"""
    origin = request.headers.get("origin", "")
    headers = {
        "Access-Control-Allow-Origin": "*",  # Allow all origins for public endpoints
        "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Requested-With",
        "Access-Control-Expose-Headers": "*",
    }
    return headers


async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    """Handle HTTP exceptions with standardized response format"""
    
    # Extract error code from detail if it's a dict
    detail = exc.detail
    code = None
    message = str(detail)
    
    if isinstance(detail, dict):
        message = detail.get('message', str(detail))
        code = detail.get('code')
    
    # Map common HTTP status codes to error codes
    if not code:
        if exc.status_code == status.HTTP_401_UNAUTHORIZED:
            code = ErrorCodes.UNAUTHORIZED
            if 'credentials' in message.lower():
                code = ErrorCodes.INVALID_CREDENTIALS
        elif exc.status_code == status.HTTP_403_FORBIDDEN:
            code = ErrorCodes.ACCESS_DENIED
        elif exc.status_code == status.HTTP_404_NOT_FOUND:
            code = ErrorCodes.NOT_FOUND
        elif exc.status_code == status.HTTP_400_BAD_REQUEST:
            code = ErrorCodes.BAD_REQUEST
    
    logger.warning(f"HTTP {exc.status_code}: {message}")
    
    return JSONResponse(
        status_code=exc.status_code,
        content=create_error_response(message=message, code=code),
        headers=get_cors_headers(request)
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Handle validation errors with detailed field-level errors"""
    
    errors = []
    for error in exc.errors():
        field = '.'.join(str(loc) for loc in error['loc'] if loc != 'body')
        message = error['msg']
        errors.append(create_validation_error(field=field, message=message))
    
    logger.warning(f"Validation error: {errors}")
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=create_error_response(
            message="Validation failed. Please check your input.",
            code=ErrorCodes.VALIDATION_ERROR,
            errors=errors
        ),
        headers=get_cors_headers(request)
    )


async def integrity_error_handler(request: Request, exc: IntegrityError) -> JSONResponse:
    """Handle database integrity errors (duplicate entries, etc.)"""
    
    error_message = str(exc.orig)
    code = ErrorCodes.BAD_REQUEST
    message = "Database constraint violation"
    errors = []
    
    # Parse common integrity errors
    if 'UNIQUE constraint' in error_message or 'Duplicate entry' in error_message:
        if 'username' in error_message.lower():
            code = ErrorCodes.USERNAME_EXISTS
            message = "Username already exists"
            errors.append(create_validation_error('username', 'This username is already taken'))
        elif 'email' in error_message.lower():
            code = ErrorCodes.EMAIL_EXISTS
            message = "Email address already exists"
            errors.append(create_validation_error('email', 'This email is already registered'))
        elif 'mobile' in error_message.lower():
            code = ErrorCodes.MOBILE_EXISTS
            message = "Mobile number already exists"
            errors.append(create_validation_error('mobile', 'This mobile number is already registered'))
    
    logger.error(f"Integrity error: {error_message}")
    
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content=create_error_response(message=message, code=code, errors=errors if errors else None),
        headers=get_cors_headers(request)
    )


async def database_error_handler(request: Request, exc: OperationalError) -> JSONResponse:
    """Handle database connection/operational errors"""
    
    error_message = str(exc.orig) if hasattr(exc, 'orig') else str(exc)
    logger.error(f"Database operational error: {error_message}", exc_info=True)
    
    # Check for specific error types
    error_lower = error_message.lower()
    
    if 'connection' in error_lower or 'connect' in error_lower:
        message = "Database connection failed. Please try again later."
        code = ErrorCodes.SERVER_ERROR
    elif 'timeout' in error_lower:
        message = "Database request timed out. Please try again."
        code = ErrorCodes.SERVER_ERROR
    elif 'unknown column' in error_lower:
        # This is a database schema mismatch - likely missing migration
        message = "Database schema error: Missing column. Please contact support or run database migrations."
        code = ErrorCodes.SERVER_ERROR
        logger.error(f"Database schema error - missing column. Error: {error_message}")
    else:
        message = "Database operation failed. Please try again later."
        code = ErrorCodes.SERVER_ERROR
    
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content=create_error_response(
            message=message,
            code=code
        ),
        headers=get_cors_headers(request)
    )


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle all other unexpected exceptions"""
    
    # Check if it's a database-related error that wasn't caught
    if isinstance(exc, (OperationalError, DisconnectionError)):
        return await database_error_handler(request, exc)
    
    logger.error(f"Unhandled exception: {type(exc).__name__}: {str(exc)}", exc_info=True)
    
    # Don't expose internal error details in production
    message = "An unexpected error occurred. Please try again later."
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=create_error_response(
            message=message,
            code=ErrorCodes.SERVER_ERROR
        ),
        headers=get_cors_headers(request)
    )


def register_error_handlers(app):
    """Register all error handlers with the FastAPI app"""
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(IntegrityError, integrity_error_handler)
    app.add_exception_handler(OperationalError, database_error_handler)
    app.add_exception_handler(DisconnectionError, database_error_handler)
    app.add_exception_handler(Exception, generic_exception_handler)

