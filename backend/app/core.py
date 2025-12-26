from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
# StaticFiles removed - use Nginx for static file serving to prevent memory leaks
from fastapi.responses import JSONResponse, FileResponse, StreamingResponse
from typing import Optional, List
import os
import logging
import traceback
import uuid
import gc  # For garbage collection

# Import settings from new settings module
from app.settings import settings
# Try Starlette's proxy headers middleware first; fallback to Uvicorn's; else disable gracefully
try:  # Starlette >=0.13
    from starlette.middleware.proxy_headers import ProxyHeadersMiddleware as _ProxyHeadersMiddleware  # type: ignore
    ProxyHeadersMiddleware = _ProxyHeadersMiddleware  # noqa: N816 (keep external name)
except Exception:
    try:
        from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware as _ProxyHeadersMiddleware  # type: ignore
        ProxyHeadersMiddleware = _ProxyHeadersMiddleware  # noqa: N816
    except Exception:
        ProxyHeadersMiddleware = None  # type: ignore


# Settings are now loaded from app.settings module
# Removed: class Settings(BaseSettings) - use app.settings.settings instead


def create_app() -> FastAPI:
    """Create FastAPI application with production-ready optimizations.
    
    Deployment: 2025-12-26 - Verified all bookings endpoints are properly registered
    """
    from contextlib import asynccontextmanager
    
    # Define lifespan for proper startup/shutdown (replaces deprecated @app.on_event)
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        """Lifespan context manager for startup and shutdown."""
        # Startup - run async but don't block app if it fails
        try:
            await _startup(app)
        except Exception as e:
            logging.error(f"[Lifespan] Startup error (app will still run): {e}")
            # Continue anyway - app can serve /health and other basic endpoints
        yield
        # Shutdown
        try:
            await _shutdown(app)
        except Exception as e:
            logging.error(f"[Lifespan] Shutdown error: {e}")
    
    # Configure FastAPI with memory-conscious settings and lifespan
    app = FastAPI(
        title=settings.APP_NAME,
        lifespan=lifespan,
        # Limit request body size to prevent memory exhaustion
        # 50MB max body size (for file uploads)
        # This prevents large requests from consuming all memory
    )

    # Ensure the static directory exists
    static_dir = "static"
    if not os.path.exists(static_dir):
        os.makedirs(static_dir)

    # Add compression middleware FIRST (before CORS) to reduce memory usage
    try:
        from fastapi.middleware.gzip import GZipMiddleware
        app.add_middleware(GZipMiddleware, minimum_size=1000)  # Compress responses > 1KB
        logging.info("[Startup] GZip compression middleware enabled")
    except ImportError:
        logging.warning("[Startup] GZip middleware not available")
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"] if "*" in settings.CORS_ORIGINS else settings.CORS_ORIGINS,
        allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*"],
        max_age=3600,  # Cache preflight requests for 1 hour
    )

    # Health check endpoint for Cloud Run (always available, before any middleware)
    @app.get("/health")
    async def health():
        return {"status": "ok"}

    # Environment validation endpoint - verify env variables are loaded without exposing secrets
    @app.get("/env-test")
    async def env_test():
        """
        Test endpoint to verify environment configuration is properly loaded.
        
        Returns configuration status without exposing sensitive values.
        Useful for debugging deployment issues on Cloud Run.
        
        NOTE: This endpoint should be protected in production (removed or auth-guarded).
        """
        try:
            from app.db import engine
            
            # Test database connectivity
            db_test = "✓ configured"
            try:
                async with engine.begin() as conn:
                    await conn.execute(text("SELECT 1"))
                db_status = "✓ connected"
            except Exception as e:
                db_status = f"✗ error: {str(e)[:50]}"
            
            # Build response (without exposing secrets)
            return {
                "status": "ok",
                "environment": settings.ENVIRONMENT,
                "debug": settings.DEBUG,
                "app_name": settings.APP_NAME,
                "port": settings.PORT,
                "api_prefix": settings.API_PREFIX,
                "database": {
                    "configured": db_test,
                    "status": db_status,
                    "url_prefix": settings.computed_database_url.split('@')[0] + "...@",
                    "is_supabase": settings.is_supabase,
                },
                "cors": {
                    "allow_origins_count": len(settings.CORS_ORIGINS),
                },
                "secrets_configured": {
                    "secret_key": "✓" if settings.SECRET_KEY != "change-me-in-production" else "✗ using default",
                    "admin_password": "✓" if settings.ADMIN_PASSWORD != "change-me-in-production" else "⚠ using default",
                },
                "frontend_url": settings.FRONTEND_URL,
            }
        except Exception as e:
            return {
                "status": "error",
                "message": str(e),
            }

    # Trust X-Forwarded-* headers from reverse proxy (Cloud Run or other proxies)
    try:
        if ProxyHeadersMiddleware is not None:
            app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="*")
            logging.info("[Startup] ProxyHeadersMiddleware enabled (trusted_hosts='*')")
        else:
            logging.warning("[Startup] ProxyHeadersMiddleware not available. Consider running Uvicorn with --proxy-headers.")
    except Exception as e:
        logging.warning(f"[Startup] Failed to enable ProxyHeadersMiddleware: {e}")
    
    # Import memory protection middleware (lazy import to avoid loading psutil if not available)
    try:
        from .middleware.memory_protection import memory_protection_middleware
        # Add memory protection middleware FIRST (before other middleware)
        # This provides RAM threshold monitoring, request body size limits, and MemoryError handling
        app.middleware("http")(memory_protection_middleware)
        logging.info("[Startup] Memory protection middleware enabled (with psutil)")
    except ImportError as e:
        logging.warning(f"[Startup] Memory protection middleware not available: {e}. Install psutil for memory monitoring.")
        # Fallback to basic body size limit
        MAX_BODY_SIZE_MB = 15
        MAX_BODY_SIZE = MAX_BODY_SIZE_MB * 1024 * 1024
        
        @app.middleware("http")
        async def body_size_middleware(request: Request, call_next):
            """Basic request body size limit (fallback if memory protection not available)."""
            content_length = request.headers.get("content-length")
            if content_length:
                try:
                    size_mb = int(content_length) / (1024 * 1024)
                    if size_mb > MAX_BODY_SIZE_MB:
                        logging.warning(f"[Request Size] Request body too large: {size_mb:.2f}MB (max: {MAX_BODY_SIZE_MB}MB)")
                        origin = request.headers.get("origin")
                        return JSONResponse(
                            status_code=413,
                            content={"detail": f"Request body too large. Maximum {MAX_BODY_SIZE_MB}MB allowed."},
                            headers={
                                "Access-Control-Allow-Origin": "*" if "*" in settings.CORS_ORIGINS else (origin or "*"),
                                "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
                                "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Requested-With",
                            }
                        )
                except (ValueError, TypeError):
                    pass
            response = await call_next(request)
            return response
    
    # Add request timeout middleware to prevent hanging requests
    @app.middleware("http")
    async def timeout_middleware(request: Request, call_next):
        import asyncio
        import time
        
        # Different timeouts for different operations
        path = request.url.path
        
        # Longer timeout for file uploads and payment operations
        # Payment operations need more time due to external API calls
        if any(x in path for x in ['/uploads/', '/payment', '/razorpay', '/create-razorpay-order', '/payments/']):
            timeout = 60.0  # 60 seconds for uploads and payments
        # Longer timeout for admin operations that might process large datasets
        elif '/admin/' in path:
            timeout = 45.0  # 45 seconds for admin operations
        else:
            timeout = 30.0  # 30 seconds for regular operations
        
        start_time = time.time()
        try:
            logging.debug(f"[Request] Starting {request.method} {path} (timeout: {timeout}s)")
            response = await asyncio.wait_for(call_next(request), timeout=timeout)
            elapsed = time.time() - start_time
            if elapsed > 5.0:  # Log slow requests
                logging.warning(f"[Slow Request] {request.method} {path} took {elapsed:.2f}s")
            return response
        except asyncio.TimeoutError:
            elapsed = time.time() - start_time
            # Return timeout error with CORS headers - ensures API doesn't hang
            logging.error(f"[Timeout] Request to {request.method} {path} timed out after {timeout}s (elapsed: {elapsed:.2f}s)")
            from fastapi.responses import JSONResponse
            origin = request.headers.get("origin")
            return JSONResponse(
                status_code=504,
                content={
                    "success": False,
                    "message": f"Request timeout: The server took too long to respond ({timeout}s). Please try again.",
                    "detail": f"Request timeout: The server took too long to respond ({timeout}s)"
                },
                headers={
                    "Access-Control-Allow-Origin": "*" if "*" in settings.CORS_ORIGINS else (origin or "*"),
                    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
                    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Requested-With",
                    "Retry-After": "10",
                }
            )
        except MemoryError as mem_err:
            # Force aggressive garbage collection on memory error
            path = request.url.path
            logging.error(f"[Memory Error] MemoryError in middleware for {request.method} {path}: {mem_err}")
            # Run GC multiple times to free up memory - more aggressive
            for _ in range(7):  # Increased from 5 to 7 passes
                gc.collect()
            # Also force collection of generation 2 objects
            gc.collect(2)
            from fastapi.responses import JSONResponse
            origin = request.headers.get("origin")
            
            # For payment endpoints, provide more specific error message
            if '/payment' in path or '/razorpay' in path:
                error_message = "Payment service temporarily unavailable due to server memory pressure. Please try again in a moment."
            else:
                error_message = "Service temporarily unavailable: Memory pressure. Please try again later."
            
            return JSONResponse(
                status_code=503,
                content={
                    "success": False,
                    "message": error_message,
                    "detail": error_message,
                    "error_type": "memory_error"
                },
                headers={
                    "Access-Control-Allow-Origin": "*" if "*" in settings.CORS_ORIGINS else (origin or "*"),
                    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
                    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Requested-With",
                    "Retry-After": "30",
                }
            )

    # Safety net: ensure CORS headers are present on all app responses, including errors
    @app.middleware("http")
    async def add_cors_headers(request: Request, call_next):
        try:
            response = await call_next(request)
        except Exception as e:
            # If an exception occurs, create a response with CORS headers
            from fastapi.responses import JSONResponse
            response = JSONResponse(
                status_code=500,
                content={"detail": "Internal server error"},
            )
        
        origin = request.headers.get("origin")
        if origin and ("*" in settings.CORS_ORIGINS or origin in settings.CORS_ORIGINS):
            response.headers["Access-Control-Allow-Origin"] = "*" if "*" in settings.CORS_ORIGINS else origin
            response.headers["Vary"] = ", ".join(filter(None, [response.headers.get("Vary"), "Origin"]))
            response.headers["Access-Control-Allow-Methods"] = "GET,POST,PUT,PATCH,DELETE,OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = response.headers.get(
                "Access-Control-Allow-Headers", "Authorization, Content-Type, X-Requested-With"
            )
            if settings.CORS_ALLOW_CREDENTIALS:
                response.headers["Access-Control-Allow-Credentials"] = "true"
        return response

    # Explicit OPTIONS handler to satisfy strict proxies/CDNs that don't pass through middleware
    @app.options("/{path:path}")
    async def options_handler(path: str, request: Request):
        from fastapi import Response
        response = Response(status_code=204)
        origin = request.headers.get("origin")
        req_headers = request.headers.get("access-control-request-headers", "Authorization, Content-Type, X-Requested-With")
        if origin and ("*" in settings.CORS_ORIGINS or origin in settings.CORS_ORIGINS):
            response.headers["Access-Control-Allow-Origin"] = "*" if "*" in settings.CORS_ORIGINS else origin
            response.headers["Vary"] = ", ".join(filter(None, [response.headers.get("Vary"), "Origin"]))
            response.headers["Access-Control-Allow-Methods"] = "GET,POST,PUT,PATCH,DELETE,OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = req_headers
            if settings.CORS_ALLOW_CREDENTIALS:
                response.headers["Access-Control-Allow-Credentials"] = "true"
        return response

    # Basic logging setup (LOG_LEVEL env to control verbosity)
    log_level = os.getenv("LOG_LEVEL", "INFO").upper()
    logging.basicConfig(level=getattr(logging, log_level, logging.INFO))

    from .db import init_db, get_session
    from .routers import broker_payments
    from .routers import (
        health,
        events,
        programs,
        auth,
        uploads,
        users,
        bookings,
        admin_bookings,
        vendor,
        vendor_notifications,
        vendor_messages,
        admin_vendor,
        admin_clients,
        client_audio,
        client_notifications,
        admin_client,
        payments,
        venues,
        time_slots,
        notifications,
        items,
        gallery,
        whatsapp,
        program_participants,
        content,
        public_bookings,
        content_pages,
        debug,
        vehicles,  # NEW: Transportation vehicles
        locations,  # NEW: Location services (Google Places API)
        admin_items,  # NEW: Admin catalog items with pricing
        racks,  # NEW: Rack ecommerce system
        vendor_payments,  # NEW: Vendor payment summary and invoices
        offers,  # NEW: Offers & Coupons Engine
        contests,  # NEW: Contest System
        staff,  # HR: Staff management
        attendance,  # HR: Attendance management
        leave,  # HR: Leave management
        payroll,  # HR: Payroll management
        hr_dashboard,  # HR: Dashboard statistics
    )
    from app.routers import (
        qr_attendance,  # HR: QR Code Attendance System
        office,  # HR: Office Location Management
    )
    from .auth import hash_password
    from .models import User
    from .models_rack import Rack, RackProduct, RackOrder  # Import rack models for SQLAlchemy registration
    from .models_booking_guests import BookingGuest  # Import booking guests model
    from .middleware.error_handler import register_error_handlers
    
    # Register global error handlers for standardized responses
    register_error_handlers(app)

    # Include all routers (keeping current structure for stability)
    # Note: True lazy loading would require middleware and is complex
    # Current approach: All routers loaded at startup but optimized imports
    app.include_router(health.router, prefix=settings.API_PREFIX)
    app.include_router(events.router, prefix=settings.API_PREFIX)
    app.include_router(programs.router, prefix=settings.API_PREFIX)
    app.include_router(auth.router, prefix=settings.API_PREFIX)
    app.include_router(uploads.router, prefix=settings.API_PREFIX)
    app.include_router(bookings.router, prefix=settings.API_PREFIX)
    app.include_router(admin_bookings.router, prefix=settings.API_PREFIX)
    app.include_router(venues.router, prefix=settings.API_PREFIX)
    app.include_router(time_slots.router, prefix=settings.API_PREFIX)
    app.include_router(items.router, prefix=settings.API_PREFIX)
    app.include_router(vendor.router, prefix=settings.API_PREFIX)
    app.include_router(vendor_notifications.router, prefix=settings.API_PREFIX)  # Vendor notifications
    app.include_router(vendor_messages.router, prefix=settings.API_PREFIX)  # Vendor messaging
    app.include_router(admin_vendor.router, prefix=settings.API_PREFIX)  # Admin-vendor communication
    app.include_router(admin_clients.router, prefix=settings.API_PREFIX)  # Admin client insights
    app.include_router(client_audio.router, prefix=settings.API_PREFIX)  # Client audio upload
    app.include_router(client_audio.admin_router, prefix=settings.API_PREFIX)  # Admin audio review
    app.include_router(client_notifications.router, prefix=settings.API_PREFIX)  # Client notifications
    app.include_router(admin_client.client_router, prefix=settings.API_PREFIX)  # Client messaging (customer)
    app.include_router(admin_client.admin_router, prefix=settings.API_PREFIX)  # Admin messaging tools
    app.include_router(users.router, prefix=settings.API_PREFIX)
    app.include_router(payments.router, prefix=settings.API_PREFIX)
    app.include_router(content.router, prefix=settings.API_PREFIX)
    app.include_router(gallery.router, prefix=settings.API_PREFIX)
    app.include_router(notifications.router, prefix=settings.API_PREFIX)
    app.include_router(whatsapp.router, prefix=settings.API_PREFIX)
    from .routers import guest_notifications
    app.include_router(guest_notifications.router, prefix=settings.API_PREFIX)
    from .routers import admin_whatsapp
    app.include_router(admin_whatsapp.router, prefix=settings.API_PREFIX)
    app.include_router(program_participants.router, prefix=settings.API_PREFIX)
    app.include_router(vehicles.router, prefix=settings.API_PREFIX)  # NEW: Transportation vehicles
    app.include_router(locations.router, prefix=settings.API_PREFIX)  # NEW: Location services
    app.include_router(admin_items.router, prefix=settings.API_PREFIX)  # NEW: Admin catalog items with pricing
    app.include_router(racks.router, prefix=settings.API_PREFIX)  # NEW: Rack ecommerce system
    app.include_router(vendor_payments.router, prefix=settings.API_PREFIX)  # NEW: Vendor payment summary and invoices
    app.include_router(offers.router, prefix=settings.API_PREFIX)  # NEW: Offers & Coupons Engine
    app.include_router(contests.router, prefix=settings.API_PREFIX)  # NEW: Contest System
    app.include_router(broker_payments.router, prefix=settings.API_PREFIX)  # NEW: Broker payment summary and settlements
    app.include_router(staff.router, prefix=settings.API_PREFIX)  # HR: Staff management
    # Register QR attendance router BEFORE attendance router to avoid route conflicts
    app.include_router(qr_attendance.router, prefix=settings.API_PREFIX)  # HR: QR Code Attendance System (PUBLIC)
    app.include_router(attendance.router, prefix=settings.API_PREFIX)  # HR: Attendance management
    app.include_router(leave.router, prefix=settings.API_PREFIX)  # HR: Leave management
    app.include_router(payroll.router, prefix=settings.API_PREFIX)  # HR: Payroll management
    app.include_router(hr_dashboard.router, prefix=settings.API_PREFIX)  # HR: Dashboard statistics
    app.include_router(office.router, prefix=settings.API_PREFIX)  # HR: Office Location Management
    from app.routers import item_media
    app.include_router(item_media.router, prefix=settings.API_PREFIX)  # Item media (images/videos)
    app.include_router(public_bookings.router, prefix=settings.API_PREFIX)
    app.include_router(content_pages.router, prefix=settings.API_PREFIX)
    app.include_router(content_pages.public_router, prefix=settings.API_PREFIX)
    # Admin debug router (secured via auth role=admin)
    app.include_router(debug.router, prefix=settings.API_PREFIX)

    # Mount uploads directory (where user-uploaded files are stored) at /static
    # This makes uploaded files accessible at /static/{filename}
    uploads_dir = os.path.join(os.path.dirname(__file__), "uploads")
    if not os.path.exists(uploads_dir):
        os.makedirs(uploads_dir)
    
    # Custom static file handler with CORS headers
    from fastapi.responses import FileResponse
    from fastapi import Response
    
    @app.get("/static/{file_path:path}")
    async def serve_static_file(file_path: str, request: Request):
        """
        Serve static files with proper CORS headers, range request support, and ETag caching.
        Supports partial content (Range requests) for efficient large file downloads.
        """
        # Security: prevent directory traversal
        # Allow /static/ prefix but strip it if present
        if file_path.startswith("/"):
            file_path = file_path.lstrip("/")
        if ".." in file_path:
            return Response(status_code=403, content="Access denied")
        
        # Remove /static/ prefix if present in file_path
        if file_path.startswith("static/"):
            file_path = file_path[7:]  # Remove "static/" prefix
        
        file_full_path = os.path.join(uploads_dir, file_path)
        
        # Check multiple possible locations for the file
        search_paths = [
            file_full_path,  # Direct path: backend/app/uploads/{file_path}
            os.path.join(uploads_dir, "item-media", file_path),  # Item media: backend/app/uploads/item-media/{file_path}
            os.path.join(uploads_dir, "gallery", file_path),  # Gallery: backend/app/uploads/gallery/{file_path}
            os.path.join(uploads_dir, "gallery", os.path.basename(file_path)),  # Gallery with just filename: backend/app/uploads/gallery/{filename}
        ]
        
        # If file_path starts with "gallery/", also check without the prefix
        if file_path.startswith("gallery/"):
            gallery_filename = file_path[8:]  # Remove "gallery/" prefix
            search_paths.insert(0, os.path.join(uploads_dir, "gallery", gallery_filename))
        
        # Fallback: check old uploads location (backend/uploads/) for backward compatibility
        old_uploads_dir = os.path.join(os.path.dirname(os.path.dirname(uploads_dir)), "uploads")
        search_paths.extend([
            os.path.join(old_uploads_dir, file_path),  # Old location: backend/uploads/{file_path}
            os.path.join(old_uploads_dir, "item-media", file_path),  # Old item-media: backend/uploads/item-media/{file_path}
            os.path.join(old_uploads_dir, "gallery", file_path),  # Old gallery: backend/uploads/gallery/{file_path}
            os.path.join(old_uploads_dir, "gallery", os.path.basename(file_path)),  # Old gallery with just filename
        ])
        
        # Try each path until we find the file
        file_found = None
        for search_path in search_paths:
            if os.path.exists(search_path) and os.path.isfile(search_path):
                file_found = search_path
                break
        
        if not file_found:
            # Log missing file for debugging (but don't spam logs with 404s)
            # Only log if it's not a common missing file pattern
            if not file_path.endswith(('.ico', '.png', '.jpg', '.jpeg', '.gif', '.webp')):
                logging.getLogger(__name__).debug(f"Static file not found: {file_path} (searched {len(search_paths)} locations)")
            # Return 404 with minimal content to reduce memory usage
            return Response(
                status_code=404,
                content="File not found",
                headers={"Cache-Control": "no-cache, no-store, must-revalidate"}
            )
        
        # Get file stats for ETag and Content-Length
        file_stat = os.stat(file_found)
        file_size = file_stat.st_size
        file_mtime = file_stat.st_mtime
        
        # Generate ETag based on file mtime and size (for caching)
        import hashlib
        etag_value = hashlib.md5(f"{file_found}_{file_mtime}_{file_size}".encode()).hexdigest()
        
        # Check If-None-Match header (client caching)
        if_none_match = request.headers.get("If-None-Match")
        if if_none_match == etag_value:
            return Response(status_code=304, headers={"ETag": etag_value})
        
        # Determine MIME type
        import mimetypes
        mime_type, _ = mimetypes.guess_type(file_found)
        if not mime_type:
            ext = os.path.splitext(file_found)[1].lower()
            if ext == '.pdf':
                mime_type = 'application/pdf'
            elif ext in ['.jpg', '.jpeg', '.png', '.webp', '.gif']:
                mime_type = 'image/jpeg'
            elif ext in ['.mp4', '.mpeg', '.mpg']:
                mime_type = 'video/mp4'
            elif ext == '.mov':
                mime_type = 'video/quicktime'
            elif ext == '.avi':
                mime_type = 'video/x-msvideo'
            elif ext == '.webm':
                mime_type = 'video/webm'
            elif ext in ['.mp3', '.wav', '.ogg', '.m4a']:
                mime_type = 'audio/mpeg'
            else:
                mime_type = "application/octet-stream"
        
        # Handle Range requests for partial content (resume downloads, streaming)
        range_header = request.headers.get("Range")
        if range_header:
            # Parse Range header (e.g., "bytes=0-1023" or "bytes=1024-")
            try:
                range_match = range_header.replace("bytes=", "").split("-")
                start = int(range_match[0]) if range_match[0] else 0
                end = int(range_match[1]) if range_match[1] and range_match[1] else file_size - 1
                
                if start < 0 or end >= file_size or start > end:
                    # Return proper 416 response with Content-Range header (RFC 7233)
                    return Response(
                        status_code=416,
                        headers={
                            "Content-Range": f"bytes */{file_size}",
                            "Accept-Ranges": "bytes",
                            "ETag": etag_value,
                        }
                    )
                
                # Stream partial content
                from fastapi.responses import StreamingResponse
                from typing import Generator
                
                def generate_range() -> Generator[bytes, None, None]:
                    """Stream file range in chunks"""
                    chunk_size = 64 * 1024  # 64KB chunks
                    with open(file_found, 'rb') as f:
                        f.seek(start)
                        remaining = end - start + 1
                        while remaining > 0:
                            chunk = f.read(min(chunk_size, remaining))
                            if not chunk:
                                break
                            remaining -= len(chunk)
                            yield chunk
                
                content_length = end - start + 1
                return StreamingResponse(
                    generate_range(),
                    status_code=206,  # Partial Content
                    media_type=mime_type,
                    headers={
                        "Content-Range": f"bytes {start}-{end}/{file_size}",
                        "Content-Length": str(content_length),
                        "Accept-Ranges": "bytes",
                        "ETag": etag_value,
                        "Access-Control-Allow-Origin": "*",
                        "Access-Control-Allow-Methods": "GET, OPTIONS",
                        "Access-Control-Allow-Headers": "Content-Type, Range",
                        "Cache-Control": "public, max-age=86400",
                    }
                )
            except (ValueError, IndexError):
                # Invalid Range header, fall through to full file response
                pass
        
        # Return full file with range support headers
        return FileResponse(
            file_found,
            media_type=mime_type,
            headers={
                "Content-Length": str(file_size),
                "Accept-Ranges": "bytes",
                "ETag": etag_value,
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Range",
                "Cache-Control": "public, max-age=86400",
            }
        )
    
    # Static file serving is DISABLED - use Nginx instead
    # FastAPI/Uvicorn is BAD for serving large images → causes memory leaks
    # Configure Nginx to serve static files:
    #   location /static/ {
    #       alias /var/www/myapp/static/;
    #   }
    # The custom route above (/static/{file_path:path}) is kept for development
    # but should be disabled in production in favor of Nginx

    async def _startup(app: FastAPI) -> None:
        # Set up asyncio error handler to catch SSL protocol MemoryErrors
        # This prevents SSL protocol errors from crashing the server
        def handle_asyncio_exception(loop, context):
            """Handle asyncio exceptions, especially SSL protocol MemoryErrors."""
            exception = context.get('exception')
            message = context.get('message', '')
            
            # Handle SSL protocol MemoryErrors gracefully - prevent server crash
            if isinstance(exception, MemoryError) or 'MemoryError' in str(exception):
                # Log at debug level since this is handled gracefully and is expected under high load
                logging.debug(f"[SSL Memory Error] Caught in asyncio event loop (handled): {message}")
                # Force aggressive garbage collection - run 7 times for SSL memory errors
                for _ in range(7):  # Increased from 5 to 7 passes
                    gc.collect()
                # Also force collection of generation 2 objects
                gc.collect(2)
                # Only log warning if this happens frequently (not every occurrence)
                # logging.debug("[SSL Memory Error] Triggered aggressive garbage collection (7 passes + gen2)")
                # Don't propagate - allow server to continue serving other requests
                return
            
            # Log other asyncio errors but don't crash - especially SSL-related
            if 'SSL protocol' in message or 'SSLProtocol' in message or 'SSL' in message:
                logging.warning(f"[SSL Protocol] Non-fatal SSL error: {message}")
                # Run GC twice for SSL-related errors to free up memory
                gc.collect()
                gc.collect()
                # Don't crash the server - SSL errors are often recoverable
                return
            
            # For other exceptions, use default handler but don't crash
            logging.error(f"[Asyncio] Unhandled exception in event loop: {message}")
            if exception:
                logging.error(f"[Asyncio] Exception: {type(exception).__name__}: {exception}")
                # Run GC once for any asyncio error to help with memory
                gc.collect()
        
        # Set the exception handler
        import asyncio
        loop = asyncio.get_event_loop()
        loop.set_exception_handler(handle_asyncio_exception)
        logging.info("[Startup] Asyncio exception handler configured for SSL/Memory errors")
        
        try:
            # Set a 10-second timeout for database init
            import asyncio
            await asyncio.wait_for(init_db(), timeout=10)
        except asyncio.TimeoutError:
            logging.warning("[Startup] Database initialization timed out (>10s) - starting WITHOUT database")
        except Exception as e:
            logging.error(f"[Startup] Database initialization failed: {e}")
            logging.warning("[Startup] Starting app WITHOUT database connection - API may have limited functionality")
            # Allow app to start even if database connection fails
            # This is useful for health checks and diagnostics
        try:
            abs_uploads = os.path.abspath(uploads_dir)
            print(f"[Startup] Static uploads mounted at /static -> {abs_uploads}")
        except Exception:
            pass
        # Seed default admin if configured
        # CRITICAL FIX: Use AsyncSessionLocal directly instead of get_session() generator
        # get_session() is an async generator for dependency injection, not for direct use
        # SKIP admin seeding on Cloud Run to avoid database wait at startup
        if os.getenv("SKIP_ADMIN_SEEDING") != "true":
            try:
                if settings.ADMIN_USERNAME and settings.ADMIN_PASSWORD:
                    from sqlalchemy import select
                    from app.models import User
                    from app.auth import hash_password
                    from app.db import AsyncSessionLocal
                    
                    # Use AsyncSessionLocal directly with proper context manager
                    async with AsyncSessionLocal() as session:
                        try:
                            rs = await session.execute(select(User).where(User.username == settings.ADMIN_USERNAME))
                            user = rs.scalars().first()
                            if not user:
                                # bcrypt limits input to 72 bytes; truncate the admin password if necessary
                                admin_pw = settings.ADMIN_PASSWORD
                                try:
                                    b = admin_pw.encode('utf-8')
                                    if len(b) > 72:
                                        print("Warning: ADMIN_PASSWORD longer than 72 bytes; truncating before hashing.")
                                        admin_pw = b[:72].decode('utf-8', errors='ignore')
                                except Exception:
                                    pass
                                u = User(
                                    username=settings.ADMIN_USERNAME,
                                    password_hash=hash_password(admin_pw),
                                    role="admin",
                                )
                                session.add(u)
                                await session.commit()
                                print(f"[Startup] Created default admin user: {settings.ADMIN_USERNAME}")
                            else:
                                print(f"[Startup] Admin user already exists: {settings.ADMIN_USERNAME}")
                        except Exception as admin_err:
                            logging.warning(f"[Startup] Could not seed admin user: {admin_err}")
                            await session.rollback()
            except Exception as outer_err:
                logging.warning(f"[Startup] Admin seeding skipped (likely no database): {outer_err}")
        
        # Warm up Razorpay service to avoid first-request latency/errors and validate configuration
        try:
            from app.razorpay_service import get_razorpay_service, validate_razorpay_config
            if not validate_razorpay_config():
                app.state.payments_enabled = False
                logging.critical("[Startup] Razorpay keys missing/invalid. Payments disabled until configured.")
            else:
                svc = get_razorpay_service()
                if getattr(svc, 'is_configured', lambda: False)():
                    app.state.payments_enabled = True
                    logging.info("[Startup] Razorpay service warmed up (LIVE mode)")
                else:
                    app.state.payments_enabled = False
                    logging.warning("[Startup] Razorpay service not configured; payments disabled")
        except Exception as e:
            app.state.payments_enabled = False
            logging.warning(f"[Startup] Razorpay warm-up failed: {e}")

        # Supply reminder scheduler disabled for now
        # This was causing memory issues and has been temporarily disabled
        # To re-enable, uncomment the code below
        # try:
        #     import threading
        #     def start_scheduler_delayed():
        #         """Start scheduler after a delay to ensure startup completes"""
        #         import time
        #         time.sleep(5)  # Wait 5 seconds after startup
        #         try:
        #             from app.services.supply_reminder import start_supply_reminder_scheduler
        #             start_supply_reminder_scheduler()
        #             print("[Startup] Supply reminder scheduler started")
        #         except Exception as e:
        #             print(f"[Startup] Warning: Failed to start supply reminder scheduler: {e}")
        #     
        #     scheduler_thread = threading.Thread(target=start_scheduler_delayed, daemon=True, name="SchedulerStarter")
        #     scheduler_thread.start()
        # except Exception as e:
        #     print(f"[Startup] Warning: Failed to start supply reminder scheduler thread: {e}")
        
        # Periodic garbage collection to prevent memory accumulation
        # More frequent GC to prevent SSL memory errors
        try:
            import threading
            def periodic_gc():
                """Run garbage collection periodically to free up memory"""
                import time
                while True:
                    time.sleep(30)  # Every 30 seconds (more frequent to prevent SSL memory issues)
                    try:
                        # More aggressive garbage collection - run four times for better cleanup
                        collected = gc.collect()
                        collected2 = gc.collect()  # Run twice for better cleanup
                        collected3 = gc.collect()  # Third pass for SSL-related memory cleanup
                        collected4 = gc.collect()  # Fourth pass for additional cleanup
                        total_collected = collected + collected2 + collected3 + collected4
                        if total_collected > 0:
                            logging.info(f"[GC] Collected {total_collected} objects")
                        else:
                            logging.debug("[GC] Periodic garbage collection completed")
                        
                    except Exception as e:
                        logging.warning(f"[GC] Error during garbage collection: {e}")
            
            gc_thread = threading.Thread(target=periodic_gc, daemon=True, name="GarbageCollector")
            gc_thread.start()
            logging.info("[Startup] Periodic garbage collection started (every 30 seconds)")
        except Exception as e:
            logging.warning(f"[Startup] Failed to start garbage collection thread: {e}")
        
        # Initialize shared thread pool executor for background tasks
        # This prevents thread exhaustion from creating unlimited threads
        try:
            from concurrent.futures import ThreadPoolExecutor
            from app.utils.thread_pool import set_thread_pool
            import atexit
            
            # Create a shared thread pool with limited workers to prevent thread exhaustion
            # Max 10 workers should be enough for background email/notification tasks
            thread_pool = ThreadPoolExecutor(max_workers=10, thread_name_prefix="BackgroundTask")
            app.state.thread_pool = thread_pool
            set_thread_pool(thread_pool)  # Make it available globally
            
            # Thread pool will be cleaned up in _shutdown() via lifespan
            # No need for atexit - lifespan ensures proper cleanup
            logging.info("[Startup] Shared thread pool executor initialized (max 10 workers)")
        except Exception as e:
            logging.warning(f"[Startup] Failed to initialize thread pool executor: {e}")

    async def _shutdown(app: FastAPI) -> None:
        """Cleanup on shutdown - ensures all resources are properly released."""
        try:
            # Close shared Razorpay AsyncClient if present
            client = getattr(app.state, 'razorpay_async_client', None)
            if client is not None:
                try:
                    await client.aclose()
                    logging.info("[Shutdown] Razorpay AsyncClient closed")
                except Exception as e:
                    logging.warning(f"[Shutdown] Error closing Razorpay AsyncClient: {e}")
                finally:
                    try:
                        delattr(app.state, 'razorpay_async_client')
                    except Exception:
                        pass
        except Exception as e:
            logging.warning(f"[Shutdown] Error during Razorpay client cleanup: {e}")
        
        try:
            # Shutdown thread pool executor
            if hasattr(app.state, 'thread_pool'):
                # Note: timeout parameter not available in all Python versions
                # Use wait=True for graceful shutdown
                app.state.thread_pool.shutdown(wait=True)
                logging.info("[Shutdown] Thread pool executor shut down")
        except Exception as e:
            logging.warning(f"[Shutdown] Error shutting down thread pool: {e}")
        
        try:
            # Close database connections gracefully
            from app.db import engine
            await engine.dispose()
            logging.info("[Shutdown] Database connections closed")
        except Exception as e:
            logging.warning(f"[Shutdown] Error closing database connections: {e}")
        
        try:
            # Force aggressive garbage collection to free up memory
            for _ in range(3):
                gc.collect()
            gc.collect(2)  # Force generation 2 collection
            logging.info("[Shutdown] Cleanup completed")
        except Exception as e:
            logging.warning(f"[Shutdown] Error during cleanup: {e}")

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        """Catch-all exception handler to prevent HTML 500s and provide error tracking.
        
        Handles:
        - MemoryError (including SSL protocol MemoryErrors)
        - Database connection errors
        - OTP service errors
        - Registration errors
        - All other unhandled exceptions
        """
        error_id = str(uuid.uuid4())[:8]
        try:
            path = str(request.url.path)
            method = request.method
        except Exception:
            path = "<unknown>"
            method = "<unknown>"
        
        # Add CORS headers (define early for use in all responses)
        origin = request.headers.get("origin", "")
        headers = {
            "Access-Control-Allow-Origin": "*" if "*" in settings.CORS_ORIGINS else (origin or "*"),
            "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
            "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Requested-With",
            "Access-Control-Expose-Headers": "*",
        }
        
        # Handle memory errors specially (including SSL protocol MemoryErrors)
        if isinstance(exc, MemoryError) or "MemoryError" in str(type(exc).__name__):
            logging.error(
                "[Memory Error] %s at %s %s: %r",
                error_id,
                method,
                path,
                exc,
            )
            # Force aggressive garbage collection - run multiple times
            for _ in range(7):
                gc.collect()
            gc.collect(2)  # Force generation 2 collection
            logging.warning(f"[Memory Error] {error_id} - Triggered aggressive garbage collection (7 passes + gen2)")
            
            # Return 503 with retry-after for memory errors
            return JSONResponse(
                status_code=503,
                content={
                    "success": False,
                    "message": "Service temporarily unavailable: Memory pressure. Please try again later.",
                    "error_id": error_id,
                },
                headers={
                    **headers,
                    "Retry-After": "30",
                },
            )
        
        # Handle database connection errors
        if "connection" in str(type(exc).__name__).lower() or "pool" in str(exc).lower():
            logging.error(
                "[DB Connection Error] %s at %s %s: %r",
                error_id,
                method,
                path,
                exc,
            )
            # Force GC to free up connections
            gc.collect()
            return JSONResponse(
                status_code=503,
                content={
                    "success": False,
                    "message": "Database connection error. Please try again.",
                    "error_id": error_id,
                },
                headers={
                    **headers,
                    "Retry-After": "10",
                },
            )
        
        # Log all other unhandled exceptions with full traceback
        logging.error(
            "[Unhandled Exception] %s at %s %s: %r\n%s",
            error_id,
            method,
            path,
            exc,
            "".join(traceback.format_exception(type(exc), exc, exc.__traceback__)),
        )
        
        # For OTP/registration endpoints, provide more specific error messages
        if "/otp/" in path or "/register" in path or "/reset-password" in path:
            return JSONResponse(
                status_code=500,
                content={
                    "success": False,
                    "message": "An error occurred processing your request. Please try again.",
                    "error_id": error_id,
                },
                headers=headers,
            )
        
        # Generic error response for other endpoints
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": "Internal Server Error",
                "error_id": error_id,
            },
            headers=headers,
        )

    return app

    


app = create_app()

def run():  # for uvicorn --factory
    import os
    port = int(os.getenv("PORT", 8080))
    import uvicorn
    uvicorn.run("app.core:app", host="0.0.0.0", port=port, factory=True)
    # If running as a module, this will start the server on the correct port
