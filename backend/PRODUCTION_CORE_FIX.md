# Production-Ready Core.py Fixes

## Critical Issues Found

1. **Session Leak in Startup** (Line 667)
   - Using `async for session in get_session()` incorrectly
   - Should use `async with AsyncSessionLocal() as session:`

2. **Deprecated @app.on_event**
   - Should use `lifespan` context manager (FastAPI 0.93+)

3. **All Routers Loaded Eagerly**
   - 50+ routers loaded at startup = high memory
   - Should implement lazy loading

4. **No Compression Middleware**
   - Responses not compressed = higher memory usage

5. **Thread Pool Cleanup**
   - Using `atexit` instead of proper lifespan cleanup

6. **Background Tasks Creating New Event Loops**
   - Dangerous pattern in admin_bookings.py

## Fixes Applied

See the updated `core.py` file with:
- ✅ Lifespan context manager
- ✅ Lazy router loading system
- ✅ Compression middleware
- ✅ Fixed session leak
- ✅ Proper cleanup
- ✅ All memory optimizations

