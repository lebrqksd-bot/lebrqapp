"""
Memory Protection Middleware for FastAPI

This module provides comprehensive memory protection including:
- RAM usage threshold monitoring
- Automatic request rejection when memory is high
- MemoryError handling with retry logic
- Request body size limits
- Memory-aware garbage collection
"""

from __future__ import annotations

import gc
import logging
import os
import psutil
from typing import Callable
from fastapi import Request, Response, HTTPException
from fastapi.responses import JSONResponse
import asyncio

logger = logging.getLogger(__name__)

# Memory thresholds (configurable via environment)
MEMORY_THRESHOLD_PERCENT = float(os.getenv("MEMORY_THRESHOLD_PERCENT", "85.0"))  # Reject requests at 85% RAM
MEMORY_CRITICAL_PERCENT = float(os.getenv("MEMORY_CRITICAL_PERCENT", "90.0"))  # Critical threshold
MAX_BODY_SIZE_MB = int(os.getenv("MAX_BODY_SIZE_MB", "15"))  # Max request body size
MAX_BODY_SIZE = MAX_BODY_SIZE_MB * 1024 * 1024  # Convert to bytes

# Memory monitoring state
_last_memory_check = 0
_memory_check_interval = 2.0  # Check memory every 2 seconds (not on every request)
_memory_stats = {
    "total_ram_gb": 0,
    "available_ram_gb": 0,
    "used_ram_percent": 0.0,
    "last_check": 0.0,
}


def get_memory_usage() -> dict:
    """Get current system memory usage statistics."""
    try:
        mem = psutil.virtual_memory()
        return {
            "total_ram_gb": mem.total / (1024 ** 3),
            "available_ram_gb": mem.available / (1024 ** 3),
            "used_ram_percent": mem.percent,
            "used_ram_gb": mem.used / (1024 ** 3),
        }
    except Exception as e:
        logger.warning(f"[Memory] Failed to get memory stats: {e}")
        return {
            "total_ram_gb": 0,
            "available_ram_gb": 0,
            "used_ram_percent": 0.0,
            "used_ram_gb": 0,
        }


def check_memory_threshold() -> tuple[bool, dict]:
    """
    Check if memory usage exceeds threshold.
    Returns (is_over_threshold, memory_stats)
    """
    global _memory_stats, _last_memory_check
    
    import time
    current_time = time.time()
    
    # Only check memory every N seconds to avoid overhead
    if current_time - _last_memory_check < _memory_check_interval:
        return _memory_stats["used_ram_percent"] >= MEMORY_THRESHOLD_PERCENT, _memory_stats
    
    _last_memory_check = current_time
    _memory_stats = get_memory_usage()
    _memory_stats["last_check"] = current_time
    
    is_over = _memory_stats["used_ram_percent"] >= MEMORY_THRESHOLD_PERCENT
    return is_over, _memory_stats


def aggressive_gc(passes: int = 7) -> int:
    """
    Run aggressive garbage collection.
    Returns total objects collected.
    """
    total_collected = 0
    for _ in range(passes):
        collected = gc.collect()
        total_collected += collected
    
    # Also force collection of generation 2 objects
    gc.collect(2)
    return total_collected


async def memory_protection_middleware(request: Request, call_next: Callable) -> Response:
    """
    Memory protection middleware that:
    1. Checks RAM usage and rejects requests if over threshold
    2. Enforces request body size limits
    3. Handles MemoryErrors gracefully
    4. Triggers aggressive GC when needed
    """
    path = request.url.path
    
    # Skip memory check for health/status endpoints
    if path in ["/health", "/api/health", "/status"]:
        return await call_next(request)
    
    # Check memory threshold (cached, checks every 2 seconds)
    is_over_threshold, mem_stats = check_memory_threshold()
    
    if is_over_threshold:
        # Critical memory situation - reject non-critical requests
        is_critical = mem_stats["used_ram_percent"] >= MEMORY_CRITICAL_PERCENT
        
        # Allow only GET requests for critical endpoints during high memory
        if request.method != "GET" or path not in ["/api/health", "/api/bookings/today"]:
            logger.warning(
                f"[Memory Protection] Rejecting {request.method} {path} - "
                f"Memory usage: {mem_stats['used_ram_percent']:.1f}% "
                f"(threshold: {MEMORY_THRESHOLD_PERCENT}%)"
            )
            
            # Try aggressive GC before rejecting
            if is_critical:
                aggressive_gc(10)  # Extra aggressive for critical
            
            return JSONResponse(
                status_code=503,
                content={
                    "success": False,
                    "message": "Service temporarily unavailable: Memory pressure. Please try again later.",
                    "detail": f"Server memory usage is {mem_stats['used_ram_percent']:.1f}% (threshold: {MEMORY_THRESHOLD_PERCENT}%)",
                    "error_type": "memory_error",
                    "retry_after": 30,
                },
                headers={
                    "Retry-After": "30",
                    "X-Memory-Usage": f"{mem_stats['used_ram_percent']:.1f}%",
                }
            )
    
    # Check request body size for POST/PUT/PATCH requests
    if request.method in ["POST", "PUT", "PATCH"]:
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                body_size = int(content_length)
                if body_size > MAX_BODY_SIZE:
                    size_mb = body_size / (1024 * 1024)
                    max_mb = MAX_BODY_SIZE_MB
                    logger.warning(
                        f"[Memory Protection] Rejecting {request.method} {path} - "
                        f"Request body too large: {size_mb:.2f}MB (max: {max_mb}MB)"
                    )
                    return JSONResponse(
                        status_code=413,
                        content={
                            "success": False,
                            "message": f"Request body too large. Maximum {max_mb}MB allowed.",
                            "detail": f"Request size: {size_mb:.2f}MB, Maximum: {max_mb}MB",
                        }
                    )
            except (ValueError, TypeError):
                pass  # Invalid content-length, let request proceed
    
    # Process request with memory error handling
    try:
        response = await call_next(request)
        return response
    
    except MemoryError as mem_err:
        # Memory error occurred - run aggressive GC and return 503
        logger.error(
            f"[Memory Protection] MemoryError in {request.method} {path}: {mem_err}"
        )
        
        collected = aggressive_gc(7)
        logger.warning(f"[Memory Protection] Collected {collected} objects after MemoryError")
        
        # Get updated memory stats
        mem_stats = get_memory_usage()
        
        return JSONResponse(
            status_code=503,
            content={
                "success": False,
                "message": "Service temporarily unavailable: Memory pressure. Please try again later.",
                "detail": "Memory error occurred. Server is under memory pressure.",
                "error_type": "memory_error",
            },
            headers={
                "Retry-After": "30",
                "X-Memory-Usage": f"{mem_stats['used_ram_percent']:.1f}%",
            }
        )
    
    except Exception as e:
        # Check if it's a memory-related error
        error_str = str(e).lower()
        if "memory" in error_str or "out of memory" in error_str:
            logger.error(f"[Memory Protection] Memory-related error in {request.method} {path}: {e}")
            aggressive_gc(5)
            
            mem_stats = get_memory_usage()
            return JSONResponse(
                status_code=503,
                content={
                    "success": False,
                    "message": "Service temporarily unavailable: Memory pressure. Please try again later.",
                    "detail": "Memory-related error occurred.",
                    "error_type": "memory_error",
                },
                headers={
                    "Retry-After": "30",
                    "X-Memory-Usage": f"{mem_stats['used_ram_percent']:.1f}%",
                }
            )
        
        # Re-raise non-memory exceptions
        raise


