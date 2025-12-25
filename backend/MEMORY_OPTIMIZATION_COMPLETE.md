# Complete FastAPI Memory Optimization Guide

## Executive Summary

This document provides a comprehensive memory optimization strategy for the FastAPI backend, targeting a **50%+ reduction in memory usage** and elimination of all MemoryError crashes.

## Critical Issues Identified

### 1. **Eager Router Imports (HIGH PRIORITY)**
**Problem**: All 40+ routers are imported eagerly at startup, loading all dependencies into memory immediately.

**Impact**: 
- Startup memory: ~200-300MB
- Each router loads models, services, dependencies
- Unused routers consume memory unnecessarily

**Solution**: Lazy router loading - only import routers when first accessed.

### 2. **Large Database Queries Without Pagination (HIGH PRIORITY)**
**Problem**: Multiple endpoints load entire tables into memory:
- `list_my_bookings()` - loads all bookings for user
- `get_regular_programs()` - loads all bookings
- `admin_bookings` endpoints - load all bookings
- `get_todays_bookings()` - loads all today's bookings

**Impact**: 
- 10,000 bookings = ~50-100MB in memory
- No pagination = memory grows linearly with data

**Solution**: Add pagination (limit/offset) to all list endpoints.

### 3. **File Uploads Loading Entire Files (MEDIUM PRIORITY)**
**Problem**: Some upload endpoints use `await file.read()` which loads entire file into memory.

**Impact**:
- 10MB file = 10MB RAM
- Multiple concurrent uploads = memory spike

**Solution**: Already partially fixed with chunked reads, but needs verification.

### 4. **Missing Memory Monitoring (HIGH PRIORITY)**
**Problem**: No proactive memory monitoring - only reactive error handling.

**Impact**: Server crashes before errors are caught.

**Solution**: Memory protection middleware with RAM threshold monitoring.

### 5. **Database Connection Pool Too Large (MEDIUM PRIORITY)**
**Problem**: Pool size 3 + overflow 3 = up to 6 connections, each with SSL overhead.

**Impact**: SSL connections consume significant memory.

**Solution**: Already optimized, but can be further reduced if needed.

### 6. **Large JSON Responses (MEDIUM PRIORITY)**
**Problem**: Some endpoints return large JSON objects without streaming.

**Impact**: Large responses consume memory during serialization.

**Solution**: Use StreamingResponse for large responses.

## Implementation Plan

### Phase 1: Memory Protection Middleware ✅

**Status**: Implemented in `backend/app/middleware/memory_protection.py`

**Features**:
- RAM usage threshold monitoring (85% default)
- Automatic request rejection when memory is high
- MemoryError handling with aggressive GC
- Request body size limits (15MB)

**Usage**:
```python
# Already integrated in core.py
# Automatically enabled if psutil is installed
```

### Phase 2: Lazy Router Loading

**File**: `backend/app/core.py`

**Current Code** (Lines 309-350):
```python
from .routers import (
    health,
    events,
    programs,
    # ... 40+ routers imported eagerly
)
```

**Optimized Code**:
```python
# Lazy router loading - only import when needed
def lazy_include_router(router_module_name: str, prefix: str = None):
    """Lazy load and include router only when first accessed."""
    def _lazy_import():
        module = __import__(f"app.routers.{router_module_name}", fromlist=[router_module_name])
        router = getattr(module, "router", None)
        if router:
            app.include_router(router, prefix=prefix or settings.API_PREFIX)
        return router
    return _lazy_import

# Register routers lazily
_router_registry = {
    "health": lazy_include_router("health"),
    "events": lazy_include_router("events"),
    # ... etc
}

# Include critical routers immediately (health, auth)
app.include_router(health.router, prefix=settings.API_PREFIX)
app.include_router(auth.router, prefix=settings.API_PREFIX)

# Others loaded on first access via middleware
```

**Alternative Simpler Approach**: Keep current imports but optimize startup order.

### Phase 3: Add Pagination to All List Endpoints

**Affected Files**:
- `backend/app/routers/bookings.py`
- `backend/app/routers/admin_bookings.py`
- `backend/app/routers/venues.py`
- `backend/app/routers/items.py`
- `backend/app/routers/gallery.py`

**Pattern to Apply**:
```python
@router.get('/bookings')
async def list_my_bookings(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    status: Optional[str] = None,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    offset = (page - 1) * page_size
    
    # Query with limit/offset
    stmt = select(Booking).where(Booking.user_id == current_user.id)
    if status:
        stmt = stmt.where(Booking.status == status)
    
    stmt = stmt.order_by(Booking.start_datetime.desc())
    stmt = stmt.offset(offset).limit(page_size)
    
    result = await session.execute(stmt)
    rows = result.scalars().all()
    
    # Get total count (separate query for efficiency)
    count_stmt = select(func.count(Booking.id)).where(Booking.user_id == current_user.id)
    if status:
        count_stmt = count_stmt.where(Booking.status == status)
    total_result = await session.execute(count_stmt)
    total = total_result.scalar()
    
    return {
        "items": [serialize_booking(b) for b in rows],
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "pages": (total + page_size - 1) // page_size
        }
    }
```

### Phase 4: Optimize File Uploads

**File**: `backend/app/routers/uploads.py`

**Current Status**: Already uses chunked reads (good!)

**Additional Optimizations**:
1. Use `SpooledTemporaryFile` for in-memory buffering
2. Stream directly to disk for large files
3. Add file size validation before processing

### Phase 5: Optimize Database Queries

**Patterns to Apply**:

1. **Use `select()` with explicit columns** instead of loading full objects:
```python
# BAD: Loads entire Booking object
stmt = select(Booking).where(...)
rows = await session.execute(stmt).scalars().all()

# GOOD: Only select needed columns
stmt = select(
    Booking.id,
    Booking.booking_reference,
    Booking.start_datetime,
    Booking.status
).where(...)
rows = await session.execute(stmt).all()
```

2. **Use `yield_per()` for large result sets**:
```python
# For very large queries
stmt = select(Booking).where(...)
result = await session.stream_scalars(stmt)
async for booking in result:
    # Process one at a time
    yield serialize_booking(booking)
```

3. **Add database indexes**:
```sql
-- Ensure indexes exist for common queries
CREATE INDEX IF NOT EXISTS idx_bookings_user_status ON bookings(user_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_start_datetime ON bookings(start_datetime);
CREATE INDEX IF NOT EXISTS idx_booking_items_booking_id ON booking_items(booking_id);
```

### Phase 6: Streaming Responses for Large Data

**Pattern**:
```python
from fastapi.responses import StreamingResponse
import json

@router.get('/bookings/export')
async def export_bookings(session: AsyncSession = Depends(get_session)):
    """Stream large booking export as JSON."""
    
    async def generate():
        yield '{"items": ['
        first = True
        async for booking in session.stream_scalars(select(Booking)):
            if not first:
                yield ','
            first = False
            yield json.dumps(serialize_booking(booking))
        yield ']}'
    
    return StreamingResponse(
        generate(),
        media_type="application/json"
    )
```

## Memory Optimization Checklist

### Immediate Actions (High Impact)

- [x] Add memory protection middleware
- [x] Reduce request body size limit to 15MB
- [x] Increase GC frequency to 30 seconds
- [x] Add aggressive GC on memory errors (7 passes)
- [ ] Add pagination to `list_my_bookings()`
- [ ] Add pagination to `get_regular_programs()`
- [ ] Add pagination to admin booking endpoints
- [ ] Add database indexes for common queries

### Medium Priority

- [ ] Convert large list endpoints to streaming responses
- [ ] Optimize database queries to select only needed columns
- [ ] Add query result caching for frequently accessed data
- [ ] Implement lazy loading for heavy router modules

### Low Priority (Nice to Have)

- [ ] Add response compression middleware
- [ ] Implement request rate limiting per endpoint
- [ ] Add memory usage metrics endpoint
- [ ] Create memory usage dashboard

## Expected Memory Reduction

### Before Optimization:
- Startup: ~250MB
- Under load: ~500-800MB
- Memory errors: Frequent

### After Optimization:
- Startup: ~150MB (40% reduction)
- Under load: ~300-400MB (50% reduction)
- Memory errors: Eliminated

## Configuration

### Environment Variables

```bash
# Memory thresholds
MEMORY_THRESHOLD_PERCENT=85.0  # Reject requests at 85% RAM
MEMORY_CRITICAL_PERCENT=90.0   # Critical threshold

# Request limits
MAX_BODY_SIZE_MB=15            # Max request body size

# Database pool (already optimized)
DB_POOL_SIZE=3
DB_MAX_OVERFLOW=3
```

## Monitoring

### Memory Usage Endpoint

Add to `backend/app/routers/health.py`:

```python
@router.get("/memory")
async def get_memory_stats():
    """Get current memory usage statistics."""
    try:
        import psutil
        mem = psutil.virtual_memory()
        return {
            "total_gb": mem.total / (1024 ** 3),
            "available_gb": mem.available / (1024 ** 3),
            "used_percent": mem.percent,
            "used_gb": mem.used / (1024 ** 3),
            "threshold_percent": MEMORY_THRESHOLD_PERCENT,
        }
    except ImportError:
        return {"error": "psutil not installed"}
```

## Testing

### Load Testing

```bash
# Test with concurrent requests
ab -n 1000 -c 50 https://taxtower.in:8002/api/bookings

# Monitor memory
watch -n 1 'ps aux | grep uvicorn | awk "{print \$6/1024 \"MB\"}"'
```

### Memory Profiling

```python
# Add to any endpoint for profiling
import tracemalloc
tracemalloc.start()
# ... your code ...
current, peak = tracemalloc.get_traced_memory()
print(f"Current: {current / 1024 / 1024:.2f}MB, Peak: {peak / 1024 / 1024:.2f}MB")
```

## Rollout Plan

1. **Week 1**: Deploy memory protection middleware
2. **Week 2**: Add pagination to critical endpoints
3. **Week 3**: Optimize database queries
4. **Week 4**: Add streaming responses for large exports
5. **Week 5**: Monitor and fine-tune

## Success Metrics

- [ ] Zero MemoryError crashes for 7 days
- [ ] Average memory usage < 400MB
- [ ] 99.9% request success rate
- [ ] Response times < 2s for 95% of requests


