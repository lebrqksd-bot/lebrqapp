# Memory Error Fixes - Production Deployment

## Critical Fixes Applied

### ✅ 1. Fixed `get_session()` Dependency
**File:** `backend/app/db.py`

**Problem:** Sessions were not being properly closed, causing connection pool exhaustion and MemoryError.

**Solution:** Updated `get_session()` to ensure:
- Sessions are always closed via async context manager
- Transactions are rolled back on exceptions
- Connections are returned to pool immediately

**Code:**
```python
async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """Get an async database session with proper cleanup."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            # CRITICAL: Rollback on any exception to release locks and return connection
            await session.rollback()
            raise
        finally:
            # Context manager will close session automatically
            pass
```

---

### ✅ 2. Increased Connection Pool Size for Production
**File:** `backend/app/db.py`

**Problem:** Pool size was too small (10 connections) for production load, causing connection exhaustion.

**Solution:** Increased pool settings for production:
- `POOL_SIZE`: 10 → 20 (increased)
- `MAX_OVERFLOW`: 10 → 20 (increased)
- Pool settings are now optimized for concurrent requests

**Code:**
```python
POOL_SIZE = int(os.getenv("DB_POOL_SIZE", "20"))  # Increased for production load
MAX_OVERFLOW = int(os.getenv("DB_MAX_OVERFLOW", "20"))  # Increased for peak traffic
POOL_TIMEOUT = int(os.getenv("DB_POOL_TIMEOUT", "30"))  # seconds
POOL_RECYCLE = int(os.getenv("DB_POOL_RECYCLE", "280"))  # less than MySQL wait_timeout
```

**Environment Variables (Optional):**
You can override these in your `.env` file or cPanel environment:
```bash
DB_POOL_SIZE=30          # For very busy servers
DB_MAX_OVERFLOW=20       # Additional connections during peak
DB_POOL_TIMEOUT=30       # Timeout for getting connection from pool
DB_POOL_RECYCLE=280      # Recycle connections before MySQL timeout
```

---

### ✅ 3. Removed `Base.metadata.create_all()` from Production Startup
**File:** `backend/app/db.py` - `init_db()` function

**Problem:** `Base.metadata.create_all()` runs on every startup, scanning all models and causing memory issues in production.

**Solution:** 
- Production: Only checks database connectivity (lightweight)
- Development: Still creates tables if needed

**Production Detection:**
- Checks `ENVIRONMENT=production` or `PRODUCTION=true`
- Automatically detects if host contains "taxtower.in"

**Code:**
```python
async def init_db() -> None:
    """Initialize database connection and verify connectivity."""
    # Check if we're in production mode
    is_production = os.getenv("ENVIRONMENT", "").lower() in ("production", "prod") or \
                    os.getenv("PRODUCTION", "").lower() in ("true", "1", "yes") or \
                    "taxtower.in" in str(settings.MYSQL_HOST) or \
                    "taxtower.in" in str(settings.DATABASE_URL)
    
    async with engine.begin() as conn:
        # Always check connectivity
        await conn.execute(text("SELECT 1"))
        
        # Only create tables in development mode
        if not is_production:
            await conn.run_sync(Base.metadata.create_all)
            print("[DB] Development mode: Tables created/verified")
        else:
            print("[DB] Production mode: Connectivity verified (skipping table creation - use migrations)")
```

**Important:** In production, use migrations (Alembic) for schema changes, NOT `create_all()`.

---

## Why These Fixes Prevent MemoryError

### MemoryError Causes:
1. **Connection Pool Exhaustion**
   - Too few connections → requests wait → memory builds up
   - Sessions not closed → connections leak → pool exhausted
   - **Fix:** Increased pool size + guaranteed session cleanup

2. **Heavy Startup Operations**
   - `create_all()` scans all models on every restart
   - Loads schema into memory unnecessarily
   - **Fix:** Removed from production startup

3. **Unclosed Sessions**
   - Sessions hold database connections
   - Connections not returned to pool
   - Pool exhausted → new connections fail → MemoryError
   - **Fix:** Guaranteed cleanup via context manager + finally

---

## Deployment Checklist

### Before Deploying:
- [ ] Verify `.env` has correct database credentials
- [ ] Set `ENVIRONMENT=production` in cPanel (optional, auto-detected)
- [ ] Ensure database migration script has been run (for `performance_team_profile` column)
- [ ] Test connection pool settings match your server capacity

### After Deploying:
- [ ] Monitor logs for "[DB] Production mode: Connectivity verified" message
- [ ] Check that MemoryError no longer appears
- [ ] Monitor connection pool usage (if possible)
- [ ] Verify endpoints respond within timeout limits

---

## Monitoring Commands

### Check if production mode is detected:
Look for this in startup logs:
```
[DB] Production mode: Connectivity verified (skipping table creation - use migrations)
```

### Monitor connection pool:
```sql
-- Check current MySQL connections
SHOW PROCESSLIST;

-- Check connection pool usage (from application logs)
-- Should see connections being reused, not constantly created
```

### Check for memory leaks:
```bash
# Monitor Python process memory
ps aux | grep python

# Check server memory usage
free -h
```

---

## Additional Optimizations (Optional)

If memory issues persist, consider:

1. **Further increase pool size:**
   ```bash
   DB_POOL_SIZE=30
   DB_MAX_OVERFLOW=25
   ```

2. **Reduce pool timeout:**
   ```bash
   DB_POOL_TIMEOUT=20  # Fail faster if pool is exhausted
   ```

3. **Enable connection pooling at MySQL level:**
   ```sql
   SET GLOBAL max_connections = 200;
   ```

4. **Monitor slow queries:**
   ```sql
   SET GLOBAL slow_query_log = 'ON';
   SET GLOBAL long_query_time = 2;
   ```

---

## Expected Results

After these fixes:
- ✅ No more MemoryError in SSL protocol handlers
- ✅ No more 500 errors due to connection exhaustion
- ✅ Faster startup time (no table creation)
- ✅ Better handling of concurrent requests
- ✅ Proper connection pool management

---

## Files Modified

1. `backend/app/db.py`
   - Updated `get_session()` with proper cleanup
   - Increased pool size settings
   - Modified `init_db()` to skip table creation in production

2. `backend/app/core.py`
   - Improved admin user seeding with better error handling

---

## Support

If MemoryError persists after these fixes:
1. Check server memory: `free -h`
2. Check MySQL max_connections: `SHOW VARIABLES LIKE 'max_connections';`
3. Review application logs for connection errors
4. Consider increasing server memory or optimizing queries

---

**Last Updated:** 2025-01-XX
**Status:** ✅ All critical fixes applied

