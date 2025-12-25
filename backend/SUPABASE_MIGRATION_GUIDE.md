# FastAPI MySQL → Supabase PostgreSQL Migration Guide

## Overview
Convert your working FastAPI backend from MySQL/cPanel to PostgreSQL/Supabase with async SQLAlchemy and Cloud Run support.

---

## KEY CHANGES REQUIRED

### 1. **main.py** → Replace with Production Cloud Run Setup
**Why**: Current main.py has duplicate DB initialization and isn't using the proper app factory pattern from core.py

```python
# main.py - NEW VERSION
import os
import uvicorn
from app.core import create_app

# Create the app using the factory (includes all middleware, startup/shutdown)
app = create_app()

# Cloud Run entrypoint
if __name__ == "__main__":
    port = int(os.getenv("PORT", "8080"))
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        log_level="info"
    )
```

**What Changed**:
- ✅ Removed duplicate `create_async_engine` from main.py
- ✅ Uses `create_app()` factory that includes ALL middleware and lifespan handlers
- ✅ Cloud Run PORT environment variable support
- ✅ Listens on `0.0.0.0` for container networking

---

### 2. **requirements.txt** → Remove MySQL, Add asyncpg
**Why**: MySQL drivers no longer needed; asyncpg provides async PostgreSQL support

```diff
- mysqlclient==2.x.x  (REMOVE)
- pymysql==x.x.x      (REMOVE)
+ asyncpg==0.29.0     (ALREADY PRESENT - KEEP)
+ sqlalchemy==2.0.23  (ALREADY PRESENT - KEEP)
+ psycopg2-binary     (OPTIONAL: Sync fallback if needed)
```

**Your Current requirements.txt is CORRECT**. No changes needed!

---

### 3. **app/core.py** → Verify DATABASE_URL Setup (ALREADY CORRECT)
**Status**: ✅ **NO CHANGES NEEDED**

Your core.py already has:
```python
@property
def DATABASE_URL(self) -> str:
    # Allow override via DB_URL. Otherwise use PostgreSQL (asyncpg)
    if self.DB_URL:
        return self.DB_URL
    return (
        f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@"
        f"{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
    )
```

**Set these environment variables for Supabase**:
```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<your-supabase-password>
POSTGRES_HOST=<project>.pooler.supabase.com
POSTGRES_PORT=6543
POSTGRES_DB=postgres
```

Or use the direct override:
```env
DB_URL=postgresql+asyncpg://postgres:<password>@<project>.pooler.supabase.com:6543/postgres
```

---

### 4. **app/db.py** → Status: ✅ ALREADY CORRECT
**What's Working**:
- ✅ Uses `create_async_engine` with PostgreSQL
- ✅ Uses `AsyncSession` with `async_sessionmaker`
- ✅ Proper connection pooling (5 connections, 5 overflow)
- ✅ `init_db()` checks connectivity, skips table creation in production
- ✅ `get_session()` yields AsyncSession with proper cleanup

**Pool Settings** (production-optimized):
```python
POOL_SIZE = 5                    # Base connections
MAX_OVERFLOW = 5                 # Extra connections for bursts
POOL_TIMEOUT = 30                # Wait time for available connection
POOL_RECYCLE = 280               # Recycle before Supabase 5-min timeout
POOL_PRE_PING = True            # Verify connections before use
```

---

### 5. **app/dependencies.py** → Status: ✅ ALREADY CORRECT
**What's Working**:
- ✅ `get_current_user()` with async session
- ✅ `optional_current_user()` for public endpoints
- ✅ Role-based checks: `admin_required`, `vendor_required`, `broker_required`

No changes needed!

---

## DEPLOYMENT CHECKLIST

### Before Deploying:

- [ ] **Supabase Tables Created**: Run migration_clean.sql or verify tables exist
  ```bash
  # Via Supabase SQL Editor:
  # Paste contents of migration_clean.sql and run
  
  # OR via psql:
  psql postgresql://postgres:password@host:6543/postgres < migration_clean.sql
  ```

- [ ] **Environment Variables Set**:
  ```bash
  PORT=8080
  DATABASE_URL=postgresql+asyncpg://postgres:xxx@xxx.pooler.supabase.com:6543/postgres
  # OR individual settings:
  POSTGRES_USER=postgres
  POSTGRES_PASSWORD=xxx
  POSTGRES_HOST=xxx.pooler.supabase.com
  POSTGRES_PORT=6543
  POSTGRES_DB=postgres
  ```

- [ ] **Dependencies Installed**:
  ```bash
  pip install -r requirements.txt
  ```

- [ ] **Test Locally**:
  ```bash
  # Set DATABASE_URL or individual env vars
  export DATABASE_URL="postgresql+asyncpg://..."
  python main.py
  # Visit http://localhost:8080/docs
  ```

- [ ] **Verify Database Connection**:
  ```bash
  # GET /health should return {"status": "ok"}
  curl http://localhost:8080/health
  
  # GET /db-test should return {"db": "connected"}
  curl http://localhost:8080/db-test
  ```

---

## CLOUD RUN DEPLOYMENT

### 1. **Create Dockerfile** (if not present):
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app
COPY . .

# Cloud Run port
ENV PORT=8080

# Run with Uvicorn
CMD ["python", "main.py"]
```

### 2. **Deploy to Cloud Run**:
```bash
gcloud run deploy lebrq-backend \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars DATABASE_URL="postgresql+asyncpg://postgres:xxx@xxx.pooler.supabase.com:6543/postgres" \
  --memory 512Mi \
  --timeout 60 \
  --concurrency 80
```

### 3. **Cloud Run Environment Variables**:
Set in Cloud Run Console:
- `DATABASE_URL` or individual Postgres settings
- `SECRET_KEY` (long random string)
- `GOOGLE_PLACES_API_KEY` (optional)
- Other settings as needed

---

## API COMPATIBILITY

### ✅ All APIs Work Exactly the Same

Your routers don't need changes. The async SQLAlchemy conversion is transparent:

```python
# Your existing router code works as-is:
@router.get("/users/{user_id}")
async def get_user(user_id: int, session: AsyncSession = Depends(get_session)):
    # session is AsyncSession, database is PostgreSQL
    # Everything else: same APIs, same responses, same behavior
    user = await session.get(User, user_id)
    return user
```

The following are automatically converted:
- `session.add()` → ✅ Works with PostgreSQL
- `session.execute(select(...))` → ✅ Works with PostgreSQL
- `await session.commit()` → ✅ Proper async transactions
- Relationships, filters, joins → ✅ All work identically

---

## POSTGRESQL-SPECIFIC CONSIDERATIONS

### No Breaking Changes for Your Codebase

Your models use SQLAlchemy's ORM which is database-agnostic:

✅ SQLAlchemy Mapped columns → Works on both MySQL and PostgreSQL
✅ ForeignKey relationships → Works identically
✅ Boolean fields → PostgreSQL has native BOOLEAN
✅ DateTime/Date fields → PostgreSQL handles properly
✅ JSON fields → PostgreSQL has better JSON support
✅ String/Integer/Float → No differences

### Only MySQL-Specific Code Changes Needed:

1. **If you use raw SQL**: Replace MySQL syntax with PostgreSQL
   - `BIGINT(20)` → `BIGINT` ✅ (Already done in migration_clean.sql)
   - Backticks `` ` `` → Double quotes `"` or no quotes ✅ (Already done)
   - `COLLATE utf8mb4_unicode_ci` → Not needed in PostgreSQL
   - `AUTO_INCREMENT` → `SERIAL` or `GENERATED ALWAYS AS IDENTITY`

2. **If you use MySQL functions**: May need PostgreSQL equivalents
   - `NOW()` → Works in PostgreSQL
   - `DATE_FORMAT()` → Use PostgreSQL `to_char()`
   - `IFNULL()` → Use `COALESCE()`

3. **Connection strings**: Already handled in core.py

---

## MEMORY & PERFORMANCE OPTIMIZATIONS

Your app already has:

✅ **Memory Protection Middleware** - Tracks RAM usage, prevents MemoryError
✅ **Request Timeout Middleware** - 30s default, 60s for uploads
✅ **GZip Compression** - Reduces response size
✅ **Connection Pooling** - Reuses connections efficiently
✅ **Async/Await** - Non-blocking I/O
✅ **Lazy Router Loading** - Reduces startup time
✅ **Graceful Shutdown** - Closes connections cleanly

---

## TESTING BEFORE PRODUCTION

### 1. **Health Endpoint**:
```bash
curl https://your-cloud-run-url/health
# Expected: {"status": "ok"}
```

### 2. **Database Connection**:
```bash
curl https://your-cloud-run-url/db-test
# Expected: {"db": "connected"}
```

### 3. **Sample API Call**:
```bash
curl -X GET https://your-cloud-run-url/api/users/1 \
  -H "X-User-Id: 1"
# Expected: Your normal API response
```

### 4. **Load Test** (optional):
```bash
ab -n 100 -c 10 https://your-cloud-run-url/health
# Should handle 10 concurrent requests without issues
```

---

## ROLLBACK PLAN

If issues occur:

1. **Cloud Run**: Click "Deploy previous revision" in console
2. **Database**: Supabase keeps backups; restore from snapshot if needed
3. **Code**: Push previous version to main branch

---

## NEXT STEPS

1. ✅ **Update main.py** (provided below)
2. ✅ **Verify requirements.txt** (no changes needed)
3. ✅ **Verify app/core.py** (no changes needed)
4. ✅ **Verify app/db.py** (no changes needed)
5. **Deploy migration_clean.sql** to Supabase
6. **Set environment variables** in Cloud Run
7. **Deploy to Cloud Run**
8. **Test endpoints**

---

## FILES TO MODIFY

| File | Change | Reason |
|------|--------|--------|
| `main.py` | ✏️ Replace | Use app factory, Cloud Run PORT support |
| `requirements.txt` | ✅ No change | Already correct |
| `app/core.py` | ✅ No change | Already correct |
| `app/db.py` | ✅ No change | Already correct |
| `app/dependencies.py` | ✅ No change | Already correct |
| `app/models.py` | ✅ No change | Already correct |
| All routers | ✅ No change | Async conversion is transparent |

---

## SUCCESS INDICATORS

After deployment, you should see:

✅ Cloud Run service shows "OK" health status
✅ API endpoints respond with same data as before
✅ Database queries execute without errors
✅ Memory usage stable (not growing)
✅ Response times similar to before (possibly faster)
✅ No "relation does not exist" errors
✅ No boolean type mismatches
✅ No backtick syntax errors

---

## SUPPORT

If issues occur:

1. Check Cloud Run logs: `gcloud run logs`
2. Check database connectivity: Call `/db-test` endpoint
3. Check environment variables are set correctly
4. Verify migration_clean.sql was applied to Supabase
5. Check Supabase firewall rules allow Cloud Run IP

