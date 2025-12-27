from __future__ import annotations

import os
import logging
import gc
from pathlib import Path
from typing import Annotated, Optional

from fastapi import APIRouter, File, UploadFile, HTTPException, Form, Depends, Request
from fastapi.responses import JSONResponse, FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from ..db import get_session
from ..auth import get_current_user
from ..models import User
from datetime import datetime

UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

router = APIRouter(prefix="/uploads", tags=["uploads"])


@router.get("/contests/{file_path:path}")
async def get_contest_file(file_path: str, request: Request):
    """
    Serve contest uploaded files with CORS headers, range request support, and ETag caching.
    Supports partial content (Range requests) for efficient large file downloads.
    """
    contests_dir = UPLOAD_DIR / "contests"
    contests_dir.mkdir(parents=True, exist_ok=True)
    
    # Security: prevent directory traversal
    if ".." in file_path or file_path.startswith("/"):
        raise HTTPException(status_code=403, detail="Access denied")
    
    file_full_path = contests_dir / file_path
    
    # Ensure the file is within contests_dir
    try:
        file_full_path.resolve().relative_to(contests_dir.resolve())
    except ValueError:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if not file_full_path.exists():
        # Log for debugging
        import logging
        logging.warning(f"File not found: {file_full_path}, contests_dir: {contests_dir}")
        raise HTTPException(status_code=404, detail=f"File not found: {file_path}")
    
    # Get file stats for ETag and Content-Length
    file_stat = file_full_path.stat()
    file_size = file_stat.st_size
    file_mtime = file_stat.st_mtime
    
    # Generate ETag based on file mtime and size (for caching)
    import hashlib
    etag_value = hashlib.md5(f"{file_path}_{file_mtime}_{file_size}".encode()).hexdigest()
    
    # Check If-None-Match header (client caching)
    if_none_match = request.headers.get("If-None-Match")
    if if_none_match == etag_value:
        from fastapi.responses import Response
        return Response(status_code=304, headers={"ETag": etag_value})
    
    # Determine MIME type
    import mimetypes
    mime_type, _ = mimetypes.guess_type(str(file_full_path))
    if not mime_type:
        ext = file_full_path.suffix.lower()
        if ext == '.pdf':
            mime_type = 'application/pdf'
        elif ext in ['.jpg', '.jpeg', '.png', '.webp']:
            mime_type = 'image/jpeg'
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
                from fastapi.responses import Response
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
                with open(file_full_path, 'rb') as f:
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
        file_full_path,
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


@router.get("/{file_path:path}")
async def get_upload_file(file_path: str, request: Request):
    """
    Serve uploaded files with CORS headers, range request support, and ETag caching.
    Supports partial content (Range requests) for efficient large file downloads and resume.
    """
    # Security: prevent directory traversal
    if ".." in file_path or file_path.startswith("/"):
        raise HTTPException(status_code=403, detail="Access denied")
    
    file_full_path = UPLOAD_DIR / file_path
    
    # Ensure the file is within UPLOAD_DIR
    try:
        file_full_path.resolve().relative_to(UPLOAD_DIR.resolve())
    except ValueError:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if not file_full_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    # Get file stats for ETag and Content-Length
    file_stat = file_full_path.stat()
    file_size = file_stat.st_size
    file_mtime = file_stat.st_mtime
    
    # Generate ETag based on file mtime and size (for caching)
    import hashlib
    etag_value = hashlib.md5(f"{file_path}_{file_mtime}_{file_size}".encode()).hexdigest()
    
    # Check If-None-Match header (client caching)
    if_none_match = request.headers.get("If-None-Match")
    if if_none_match == etag_value:
        from fastapi.responses import Response
        return Response(status_code=304, headers={"ETag": etag_value})
    
    # Determine MIME type based on file extension
    import mimetypes
    mime_type, _ = mimetypes.guess_type(str(file_full_path))
    if not mime_type:
        # Fallback to common types
        ext = file_full_path.suffix.lower()
        if ext in ['.mp4', '.mpeg', '.mpg']:
            mime_type = 'video/mp4'
        elif ext == '.mov':
            mime_type = 'video/quicktime'
        elif ext == '.avi':
            mime_type = 'video/x-msvideo'
        elif ext == '.webm':
            mime_type = 'video/webm'
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
                from fastapi.responses import Response
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
                with open(file_full_path, 'rb') as f:
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
        file_full_path,
        media_type=mime_type,
        headers={
            "Content-Length": str(file_size),
            "Accept-Ranges": "bytes",
            "ETag": etag_value,
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Range",
            "Cache-Control": "public, max-age=86400",  # Cache for 1 day
        }
    )


@router.post("/poster")
async def upload_poster(file: Annotated[UploadFile, File(...)]):
    """
    Upload poster image with streaming to prevent memory issues.
    Uses chunked processing to avoid loading entire file into RAM.
    """
    # Strict content-type whitelist
    allowed_types = {"image/jpeg": ".jpg", "image/png": ".png"}
    if not file.content_type or file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Only JPEG and PNG are allowed")
    
    # File size limits (strict)
    MAX_FILE_SIZE_MB = 5
    MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024
    
    # Derive extension from content-type, not user filename
    ext = allowed_types[file.content_type]
    name = os.urandom(8).hex() + ext
    dest = UPLOAD_DIR / name
    
    # Stream file to disk in chunks to avoid loading entire file into memory
    total_size = 0
    try:
        with open(dest, 'wb') as out_file:
            while True:
                # Read in 1MB chunks
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                total_size += len(chunk)
                if total_size > MAX_FILE_SIZE:
                    if dest.exists():
                        dest.unlink()
                    raise HTTPException(
                        status_code=413,
                        detail=f"File too large. Maximum {MAX_FILE_SIZE_MB}MB allowed."
                    )
                out_file.write(chunk)
    except MemoryError:
        if dest.exists():
            dest.unlink()
        gc.collect()
        raise HTTPException(
            status_code=503,
            detail="Service temporarily unavailable: Memory pressure. Please try again later."
        )
    except Exception as e:
        if dest.exists():
            dest.unlink()
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")
    
    # Optimize the uploaded image
    optimization_info = None
    try:
        from ..utils.image_optimizer import optimize_image, PILLOW_AVAILABLE
        if PILLOW_AVAILABLE:
            optimized_path, orig_size, opt_size = optimize_image(
                str(dest),
                image_type="banner",
                keep_original=False
            )
            # Update filename if extension changed
            name = os.path.basename(optimized_path)
            optimization_info = {
                "original_kb": round(orig_size / 1024, 1),
                "optimized_kb": round(opt_size / 1024, 1),
                "reduction_pct": round((1 - opt_size / orig_size) * 100, 1) if orig_size > 0 else 0
            }
    except Exception as opt_err:
        print(f"[POSTER] Image optimization failed: {opt_err}")
        # Continue with unoptimized image
    
    # Return a relative URL path; static serving should mount this directory at /static
    response = {"url": f"/static/{name}"}
    if optimization_info:
        response["optimization"] = optimization_info
    return JSONResponse(response)


@router.post("/poster/by-url")
async def upload_poster_by_url(payload: dict):
    """
    Upload poster image by fetching from a remote URL.
    This avoids multipart parsing issues and reduces client upload overhead.
    """
    import httpx
    import re

    url = (payload or {}).get("url")
    if not isinstance(url, str) or not url:
        raise HTTPException(status_code=400, detail="Missing 'url' in request body")

    # Basic URL validation
    if not re.match(r"^https?://", url):
        raise HTTPException(status_code=400, detail="URL must start with http:// or https://")

    # Strict size limit and content-type whitelist
    MAX_FILE_SIZE_MB = 5
    MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024

    # Create destination path
    # Extension will be chosen after content-type validation
    name = None
    dest = UPLOAD_DIR / name

    # Stream download and write to disk
    total_size = 0
    timeout = httpx.Timeout(15.0, connect=5.0)
    limits = httpx.Limits(max_keepalive_connections=5, max_connections=10)
    headers = {"User-Agent": "LebrQ-Uploader/1.0"}

    async with httpx.AsyncClient(timeout=timeout, limits=limits, headers=headers) as client:
        try:
            resp = await client.get(url)
            if resp.status_code != 200:
                raise HTTPException(status_code=400, detail=f"Failed to fetch image: HTTP {resp.status_code}")

            ctype = resp.headers.get("Content-Type", "")
            allowed_types = {"image/jpeg": ".jpg", "image/png": ".png"}
            if ctype not in allowed_types:
                raise HTTPException(status_code=400, detail="Invalid file type. Only JPEG and PNG are allowed")

            # Set destination now that we know the real extension
            ext = allowed_types[ctype]
            name_local = os.urandom(8).hex() + ext
            local_dest = UPLOAD_DIR / name_local

            with open(local_dest, "wb") as out_file:
                async for chunk in resp.aiter_bytes():
                    if not chunk:
                        break
                    total_size += len(chunk)
                    if total_size > MAX_FILE_SIZE:
                        if local_dest.exists():
                            local_dest.unlink()
                        raise HTTPException(status_code=413, detail=f"File too large. Maximum {MAX_FILE_SIZE_MB}MB allowed.")
                    out_file.write(chunk)
        except HTTPException:
            # Reraise known HTTP errors
            raise
        except Exception as e:
            if name is not None:
                tmp_path = UPLOAD_DIR / name
                if tmp_path.exists():
                    try:
                        tmp_path.unlink()
                    except Exception:
                        pass
                try:
                    local_dest.unlink()
                except Exception:
                        pass
            raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")
    # Publish final path
    return JSONResponse({"url": f"/static/{name_local}"})


@router.post("/image")
async def upload_image(
    file: Annotated[UploadFile, File(...)],
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Generic image upload endpoint (requires authentication).
    Uses streaming to prevent memory issues with large images.
    """
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are allowed")
    
    # File size limits
    MAX_FILE_SIZE_MB = 15  # 15MB max for images
    MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024
    
    # Generate unique filename with timestamp
    ext = os.path.splitext(file.filename or "")[1] or ".jpg"
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    name = f"{timestamp}_{os.urandom(4).hex()}{ext}"
    dest = UPLOAD_DIR / name
    
    # Stream file to disk in chunks to avoid loading entire file into memory
    total_size = 0
    try:
        with open(dest, 'wb') as out_file:
            while True:
                # Read in 1MB chunks
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                total_size += len(chunk)
                if total_size > MAX_FILE_SIZE:
                    if dest.exists():
                        dest.unlink()
                    raise HTTPException(
                        status_code=413,
                        detail=f"File too large. Maximum {MAX_FILE_SIZE_MB}MB allowed."
                    )
                out_file.write(chunk)
    except MemoryError:
        if dest.exists():
            dest.unlink()
        gc.collect()
        raise HTTPException(
            status_code=503,
            detail="Service temporarily unavailable: Memory pressure. Please try again later."
        )
    except Exception as e:
        if dest.exists():
            dest.unlink()
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")
    
    # Return URL path that can be accessed via /static/
    return JSONResponse({
        "url": f"/static/{name}",
        "path": name,
    })


@router.post("/video")
async def upload_video(
    file: Annotated[UploadFile, File(...)],
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Generic video upload endpoint (requires authentication).
    Uses streaming to prevent memory issues with large video files.
    """
    # Validate video file type
    allowed_video_types = ["video/mp4", "video/mpeg", "video/quicktime", "video/x-msvideo", "video/webm"]
    if not file.content_type or file.content_type not in allowed_video_types:
        # Also check by extension as fallback
        filename = file.filename or ""
        ext = os.path.splitext(filename)[1].lower()
        allowed_extensions = [".mp4", ".mov", ".avi", ".webm", ".mpeg", ".mpg"]
        if ext not in allowed_extensions:
            raise HTTPException(
                status_code=400, 
                detail=f"Only video files are allowed. Allowed types: {', '.join(allowed_video_types)}"
            )
    
    # File size limits for videos (larger than images)
    MAX_FILE_SIZE_MB = 100  # 100MB max for videos
    MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024
    
    # Generate unique filename with timestamp
    ext = os.path.splitext(file.filename or "")[1] or ".mp4"
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    name = f"{timestamp}_{os.urandom(4).hex()}{ext}"
    dest = UPLOAD_DIR / name
    
    # Stream file to disk in chunks to avoid loading entire file into memory
    total_size = 0
    try:
        with open(dest, 'wb') as out_file:
            while True:
                # Read in 2MB chunks for videos (larger chunks for better performance)
                chunk = await file.read(2 * 1024 * 1024)
                if not chunk:
                    break
                total_size += len(chunk)
                if total_size > MAX_FILE_SIZE:
                    if dest.exists():
                        dest.unlink()
                    raise HTTPException(
                        status_code=413,
                        detail=f"File too large. Maximum {MAX_FILE_SIZE_MB}MB allowed."
                    )
                out_file.write(chunk)
    except MemoryError:
        if dest.exists():
            dest.unlink()
        gc.collect()
        raise HTTPException(
            status_code=503,
            detail="Service temporarily unavailable: Memory pressure. Please try again later."
        )
    except Exception as e:
        if dest.exists():
            dest.unlink()
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")
    
    # Return URL path that can be accessed via /static/
    return JSONResponse({
        "url": f"/static/{name}",
        "path": name,
    })


@router.post("/program-images")
async def upload_program_images(
    files: list[UploadFile] = File(...),
    program_id: Optional[int] = Form(None),
    optimize: bool = Form(True),  # Enable optimization by default
    image_type: str = Form("banner"),  # Type for optimization config
    session: AsyncSession = Depends(get_session),
):
    import gc
    
    # Import image optimizer
    try:
        from ..utils.image_optimizer import optimize_image, PILLOW_AVAILABLE
    except ImportError:
        PILLOW_AVAILABLE = False
        logging.warning("Image optimizer not available")
    
    # Limit number of files to prevent memory exhaustion
    MAX_FILES = 10
    MAX_FILE_SIZE_MB = 10  # 10MB per file
    MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024  # Convert to bytes
    
    if len(files) > MAX_FILES:
        raise HTTPException(
            status_code=400, 
            detail=f"Too many files. Maximum {MAX_FILES} files allowed per request."
        )
    
    # Save to uploads directory so files are accessible via /static/
    # Create a subdirectory for program images
    program_images_dir = UPLOAD_DIR / "program-images"
    program_images_dir.mkdir(parents=True, exist_ok=True)

    saved_paths: list[str] = []
    errors: list[str] = []
    optimization_stats: list[dict] = []
    
    for idx, f in enumerate(files):
        try:
            if not f.content_type or not f.content_type.startswith("image/"):
                errors.append(f"{f.filename or 'File'}: Only image files are allowed")
                continue
            
            # Check file size before processing
            # Note: We can't get exact size from UploadFile, but we'll check during read
            ext = os.path.splitext(f.filename or "")[1] or ".jpg"
            # Generate unique filename with timestamp
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            name = f"{timestamp}_{os.urandom(4).hex()}{ext}"
            dest = program_images_dir / name
            
            # Process file in chunks to avoid loading entire file into memory
            # This is more memory-efficient for large files
            total_size = 0
            with open(dest, 'wb') as out_file:
                while True:
                    # Read in 1MB chunks
                    chunk = await f.read(1024 * 1024)
                    if not chunk:
                        break
                    total_size += len(chunk)
                    if total_size > MAX_FILE_SIZE:
                        # Clean up partial file
                        if dest.exists():
                            dest.unlink()
                        errors.append(f"{f.filename or 'File'}: File too large. Maximum {MAX_FILE_SIZE_MB}MB per file.")
                        break
                    out_file.write(chunk)
            
            # Optimize image if enabled and Pillow is available
            final_path = dest
            original_size = total_size
            optimized_size = total_size
            
            if optimize and PILLOW_AVAILABLE and dest.exists() and dest.stat().st_size > 0:
                try:
                    optimized_path, orig_sz, opt_sz = optimize_image(
                        dest, 
                        image_type=image_type,
                        keep_original=False
                    )
                    final_path = Path(optimized_path)
                    original_size = orig_sz
                    optimized_size = opt_sz
                    # Update name to reflect new extension if changed
                    name = final_path.name
                    optimization_stats.append({
                        "file": f.filename,
                        "original_kb": round(original_size / 1024, 1),
                        "optimized_kb": round(optimized_size / 1024, 1),
                        "reduction_pct": round((1 - optimized_size / original_size) * 100, 1) if original_size > 0 else 0
                    })
                except Exception as opt_err:
                    logging.error(f"Image optimization failed for {name}: {opt_err}")
                    # Continue with unoptimized image
            
            # If file was successfully written, add to saved paths
            if final_path.exists() and final_path.stat().st_size > 0:
                # Return path relative to static mount (uploads directory)
                # The static mount serves files from UPLOAD_DIR at /static/
                rel_path = f"program-images/{name}"
                saved_paths.append(rel_path)
            
            # Force garbage collection after each file to free memory
            if idx % 2 == 0:  # GC every 2 files to balance performance
                gc.collect()
                
        except MemoryError:
            # If we hit memory error, clean up and return error
            if dest.exists():
                dest.unlink()
            errors.append(f"{f.filename or 'File'}: Memory error. File too large or too many files.")
            # Force aggressive GC
            gc.collect()
            gc.collect()
            raise HTTPException(
                status_code=503,
                detail="Service temporarily unavailable: Memory pressure. Please try uploading fewer or smaller files."
            )
        except Exception as e:
            # Clean up on any error
            if dest.exists():
                dest.unlink()
            errors.append(f"{f.filename or 'File'}: {str(e)}")
    
    # If no files were successfully uploaded, return error
    if not saved_paths:
        error_msg = "No files were uploaded successfully."
        if errors:
            error_msg += " Errors: " + "; ".join(errors)
        raise HTTPException(status_code=400, detail=error_msg)

    # Optionally persist in a table for retrieval
    if program_id is not None:
        try:
            # Create table if not exists
            await session.execute(text(
                """
                CREATE TABLE IF NOT EXISTS program_images (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    program_id INT NOT NULL,
                    file_path VARCHAR(500) NOT NULL,
                    created_at DATETIME NOT NULL
                )
                """
            ))
            now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
            for p in saved_paths:
                await session.execute(
                    text("INSERT INTO program_images (program_id, file_path, created_at) VALUES (:pid, :fp, :ts)"),
                    {"pid": program_id, "fp": p, "ts": now}
                )
            await session.commit()
        except Exception as e:
            # Log error but don't fail the upload - files are already saved
            logging.error(f"Failed to save program_images metadata: {e}")
            # Rollback if commit failed
            await session.rollback()

    # Final garbage collection to free memory
    gc.collect()
    
    response = {"files": saved_paths, "program_id": program_id}
    if errors:
        response["warnings"] = errors
    if optimization_stats:
        response["optimization"] = optimization_stats
        total_orig = sum(s["original_kb"] for s in optimization_stats)
        total_opt = sum(s["optimized_kb"] for s in optimization_stats)
        response["total_savings_kb"] = round(total_orig - total_opt, 1)
        response["total_reduction_pct"] = round((1 - total_opt / total_orig) * 100, 1) if total_orig > 0 else 0
    
    return response
