"""
Request Limiter Middleware
Prevents too many concurrent requests from overwhelming the server
"""
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from collections import defaultdict
import asyncio
import time
from typing import Dict

# Track active requests per IP
active_requests: Dict[str, int] = defaultdict(int)
request_timestamps: Dict[str, list] = defaultdict(list)

# Configuration
MAX_CONCURRENT_REQUESTS_PER_IP = 20  # Maximum concurrent requests per IP
MAX_REQUESTS_PER_MINUTE = 60  # Maximum requests per minute per IP
CLEANUP_INTERVAL = 60  # Clean up old timestamps every 60 seconds

async def request_limiter_middleware(request: Request, call_next):
    """Limit concurrent requests and rate limit per IP"""
    client_ip = request.client.host if request.client else "unknown"
    
    # Clean up old timestamps periodically
    current_time = time.time()
    if client_ip in request_timestamps:
        # Remove timestamps older than 1 minute
        request_timestamps[client_ip] = [
            ts for ts in request_timestamps[client_ip]
            if current_time - ts < 60
        ]
    
    # Check concurrent request limit
    if active_requests[client_ip] >= MAX_CONCURRENT_REQUESTS_PER_IP:
        return JSONResponse(
            status_code=429,
            content={
                "detail": "Too many concurrent requests. Please wait and try again.",
                "code": "TOO_MANY_REQUESTS"
            },
            headers={
                "Retry-After": "5",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
                "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Requested-With",
            }
        )
    
    # Check rate limit (requests per minute)
    recent_requests = len(request_timestamps[client_ip])
    if recent_requests >= MAX_REQUESTS_PER_MINUTE:
        return JSONResponse(
            status_code=429,
            content={
                "detail": "Rate limit exceeded. Please slow down your requests.",
                "code": "RATE_LIMIT_EXCEEDED"
            },
            headers={
                "Retry-After": "60",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
                "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Requested-With",
            }
        )
    
    # Increment active requests counter
    active_requests[client_ip] += 1
    request_timestamps[client_ip].append(current_time)
    
    try:
        response = await call_next(request)
        return response
    finally:
        # Decrement active requests counter
        active_requests[client_ip] = max(0, active_requests[client_ip] - 1)

