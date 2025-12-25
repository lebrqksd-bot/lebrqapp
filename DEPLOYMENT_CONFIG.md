# Production-Ready Environment Configuration Guide

## Overview

This guide explains the new production-ready environment configuration system implemented for Lebrq Backend.

### Key Features

✅ **Clean Separation**: `.env` for local development only, environment variables for production  
✅ **Single-Source Config**: `app/settings.py` using pydantic-settings  
✅ **Production-Safe**: No `.env` required in production (ignored if present)  
✅ **Cloud Run Ready**: Supports PORT env var and async database operations  
✅ **Supabase Support**: Async PostgreSQL with proper connection pooling  
✅ **Secure Defaults**: Validation, secrets checking, defaults  
✅ **Easy Debugging**: `/env-test` endpoint to verify configuration  

---

## Architecture

### File Structure

```
backend/
├── main.py                 # Entry point (loads settings, starts server)
├── .env                    # Local development ONLY (git-ignored)
├── .env.example            # Example configuration (git-tracked)
└── app/
    ├── settings.py         # NEW: Pydantic settings with validation
    ├── core.py             # FastAPI app factory (imports settings)
    └── db/
        ├── __init__.py     # Re-exports session, engine, etc.
        └── session.py      # NEW: Database engine & session management
```

### Configuration Priority

Settings are resolved in this order:

1. **Environment Variables** (highest priority)
   - Cloud Run sets `PORT`, `DATABASE_URL`, `SECRET_KEY`, etc.
   - Prefix: `LEBRQ_*` (if needed) or direct names like `DATABASE_URL`

2. **.env File** (local development)
   - Loaded by pydantic-settings from `.env`
   - Ignored if file doesn't exist
   - NOT loaded in production

3. **Defaults** (lowest priority)
   - Hardcoded in `app/settings.py`
   - Reasonable defaults for development

Example priority resolution:

```python
# DATABASE_URL resolution
computed_database_url:
  1. Use environment variable DATABASE_URL if set
  2. Use environment variable DB_URL if set (SQLite override)
  3. Construct from PostgreSQL components (POSTGRES_USER, POSTGRES_HOST, etc.)
```

---

## Local Development Setup

### Step 1: Copy Example Config

```bash
cd backend
cp .env.example .env
```

### Step 2: Configure Database

#### Option A: SQLite (Fastest for Local Dev)

```bash
# .env
DB_URL=sqlite+aiosqlite:///./lebrq.db
```

No database server needed! Fast iteration.

#### Option B: PostgreSQL (Local)

```bash
# .env
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/lebrq
```

Requires Postgres running locally.

#### Option C: Supabase (Production-like)

```bash
# .env
DATABASE_URL=postgresql+asyncpg://user:password@db.supabase.co:5432/postgres
```

Close to production. Requires Supabase account.

### Step 3: Set Secrets

```bash
# .env
ENVIRONMENT=development
SECRET_KEY=your-local-dev-key-here
ADMIN_PASSWORD=your-local-dev-password
FRONTEND_URL=http://localhost:19006
```

### Step 4: Start Backend

```bash
# Automatic (uses settings from .env)
python main.py

# Or with uvicorn directly
uvicorn app.core:app --reload --host 0.0.0.0 --port 8000
```

### Step 5: Verify Configuration

```bash
# Test that settings are loaded correctly
curl http://localhost:8000/env-test
```

Response:

```json
{
  "status": "ok",
  "environment": "development",
  "database": {
    "configured": "✓ configured",
    "status": "✓ connected",
    "url_prefix": "sqlite+aiosqlite://...",
    "is_supabase": false
  },
  "secrets_configured": {
    "secret_key": "✓",
    "admin_password": "⚠ using default"
  },
  "frontend_url": "http://localhost:19006"
}
```

---

## Production Deployment (Google Cloud Run)

### Step 1: Configure Cloud Run Environment Variables

**Important**: Do NOT use `.env` file in production.

Set these as Cloud Run environment variables:

| Variable | Value | Example |
|----------|-------|---------|
| `ENVIRONMENT` | `production` | `production` |
| `DATABASE_URL` | Full connection string | `postgresql+asyncpg://user:pass@db.supabase.co:5432/postgres` |
| `SECRET_KEY` | Long random string | `(see generation below)` |
| `ADMIN_PASSWORD` | Secure password | `(use Cloud Secret Manager)` |
| `FRONTEND_URL` | Frontend domain | `https://lebrq.com` |
| `PORT` | Auto (8080) | (Cloud Run sets this) |

**Generate SECRET_KEY:**

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
# Output: dXF2LXQtXy1rX19jb2RlLVN0cmluZ182NTAtYVRkZy1tWE==
```

### Step 2: Use Cloud Secret Manager

For sensitive values, use Google Cloud Secret Manager:

```bash
# Create secrets in Cloud Secret Manager
gcloud secrets create lebrq-secret-key \
    --data-file=<(python -c "import secrets; print(secrets.token_urlsafe(32))")

gcloud secrets create lebrq-admin-password \
    --data-file=<(echo "your-secure-password")
```

Reference in Cloud Run:

```bash
gcloud run deploy lebrq-api \
    --set-env-vars="ENVIRONMENT=production" \
    --set-secrets="SECRET_KEY=lebrq-secret-key:latest" \
    --set-secrets="ADMIN_PASSWORD=lebrq-admin-password:latest" \
    --set-env-vars="DATABASE_URL=postgresql+asyncpg://..." \
    ...
```

### Step 3: Database Connection

#### For Supabase PostgreSQL:

1. Create Supabase project: https://supabase.com
2. Get connection string from Supabase dashboard:
   - Settings → Database → Connection String
   - Select "PostgreSQL" driver
   - Copy entire string
3. Set as `DATABASE_URL`:

```bash
DATABASE_URL=postgresql+asyncpg://postgres:[PASSWORD]@[HOST]:5432/postgres
```

**Important**: Use `asyncpg` driver (already in settings)

#### Disable Prepared Statements (if using PgBouncer):

If your database uses PgBouncer transaction pooler (common with Supabase):

```bash
# Set in Cloud Run environment
DB_DISABLE_PREPARED_STATEMENTS=True
```

This prevents `prepared statement` errors with Supabase transaction pooler.

### Step 4: Verify Production Configuration

Test the `/env-test` endpoint:

```bash
curl https://your-api.run.app/env-test
```

Production response:

```json
{
  "status": "ok",
  "environment": "production",
  "database": {
    "configured": "✓ configured",
    "status": "✓ connected",
    "url_prefix": "postgresql+asyncpg://...",
    "is_supabase": true
  },
  "secrets_configured": {
    "secret_key": "✓",
    "admin_password": "✓"
  }
}
```

---

## Configuration Reference

### Environment Variables

#### Core

| Name | Default | Required | Description |
|------|---------|----------|-------------|
| `ENVIRONMENT` | `development` | No | `development`, `staging`, or `production` |
| `DEBUG` | `False` | No | Enable debug mode (SQL logging, etc.) |
| `PORT` | `8000` | No | Server port (Cloud Run sets to 8080) |

#### Database

| Name | Default | Required | Description |
|------|---------|----------|-------------|
| `DATABASE_URL` | (see below) | ✓ Prod | Full PostgreSQL/MySQL connection string |
| `DB_URL` | None | Prod? | Override for SQLite (dev-only) |
| `POSTGRES_USER` | `postgres` | Dev | PostgreSQL username |
| `POSTGRES_PASSWORD` | `postgres` | Dev | PostgreSQL password |
| `POSTGRES_HOST` | `localhost` | Dev | PostgreSQL host |
| `POSTGRES_PORT` | `5432` | Dev | PostgreSQL port |
| `POSTGRES_DB` | `lebrq` | Dev | Database name |
| `DB_POOL_SIZE` | `5` | No | Connection pool size |
| `DB_MAX_OVERFLOW` | `5` | No | Max overflow connections |
| `DB_POOL_TIMEOUT` | `30` | No | Pool wait timeout (seconds) |
| `DB_DISABLE_PREPARED_STATEMENTS` | `False` | No | For PgBouncer compatibility |

#### Security

| Name | Default | Required | Description |
|------|---------|----------|-------------|
| `SECRET_KEY` | `change-me-in-production` | ✓ Prod | JWT signing key (generate new) |
| `ADMIN_USERNAME` | `admin` | No | Initial admin username |
| `ADMIN_PASSWORD` | `change-me-in-production` | ✓ Prod | Initial admin password |

#### Frontend & CORS

| Name | Default | Required | Description |
|------|---------|----------|-------------|
| `FRONTEND_URL` | `http://localhost:19006` | No | Frontend domain for redirects |
| `CORS_ORIGINS` | `[localhost:19006, ...]` | No | Comma-separated allowed origins |

#### Optional Services

| Name | Default | Required | Description |
|------|---------|----------|-------------|
| `GOOGLE_PLACES_API_KEY` | None | No | Google Places API key |
| `TWILIO_ACCOUNT_SID` | None | No | Twilio account SID |
| `SMTP_HOST` | None | No | SMTP server hostname |
| `ROUTEMOBILE_BASE_URL` | None | No | Route Mobile WhatsApp API |

---

## Code Examples

### Using Settings in Routes

```python
from fastapi import FastAPI
from app.settings import settings
from app.db import get_session

app = FastAPI()

@app.get("/config")
async def get_config():
    return {
        "app_name": settings.APP_NAME,
        "frontend_url": settings.FRONTEND_URL,
        "is_production": settings.is_production,
    }

@app.post("/items")
async def create_item(session = Depends(get_session)):
    # settings automatically loaded
    db_url = settings.computed_database_url
    return {"status": "ok"}
```

### Using Settings in Services

```python
from app.settings import settings

class EmailService:
    def __init__(self):
        self.smtp_host = settings.SMTP_HOST
        self.from_email = settings.SMTP_FROM_EMAIL
    
    async def send_email(self, to: str, body: str):
        # Use settings for configuration
        if not self.smtp_host:
            raise ValueError("SMTP not configured")
        # ... send email
```

### Database Connection

```python
from app.db import engine, get_session
from sqlalchemy import text

# In startup
async def startup():
    async with engine.begin() as conn:
        await conn.execute(text("SELECT 1"))
        print("✓ Database connected")

# In routes
@app.get("/users")
async def list_users(session = Depends(get_session)):
    result = await session.execute(text("SELECT * FROM users"))
    return result.scalars().all()
```

---

## Troubleshooting

### Issue: "DatabaseURL must be set in production"

**Cause**: `ENVIRONMENT=production` but `DATABASE_URL` not set

**Fix**:
```bash
# In Cloud Run environment variables
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/db
```

### Issue: "SECRET_KEY must be changed from default"

**Cause**: Using default `change-me-in-production`

**Fix**:
```bash
# Generate new key
python -c "import secrets; print(secrets.token_urlsafe(32))"

# Set in Cloud Run
SECRET_KEY=<generated-value>
```

### Issue: "prepared statement" errors with Supabase

**Cause**: Supabase uses PgBouncer transaction pooler which doesn't support prepared statements

**Fix**:
```bash
# In Cloud Run environment
DB_DISABLE_PREPARED_STATEMENTS=True
```

### Issue: `/env-test` returns connection error

**Cause**: Database unreachable

**Check**:
```bash
# Verify DATABASE_URL is correct
curl https://your-api.run.app/env-test

# Check logs
gcloud run logs read lebrq-api --limit 50
```

### Issue: Settings not loading from `.env`

**Cause**: `.env` file not in correct location or .env not readable

**Fix**:
```bash
# .env must be in backend/ directory
ls -la backend/.env

# Check file has correct values
cat backend/.env
```

---

## Migration from Old Config

If migrating from hardcoded settings in `core.py`:

### Before (Old)
```python
# app/core.py
class Settings(BaseSettings):
    POSTGRES_USER = "hardcoded"
    POSTGRES_PASSWORD = "hardcoded"

settings = Settings()
```

### After (New)
```python
# app/settings.py (centralized)
class Settings(BaseSettings):
    POSTGRES_USER: str = "default"  # Override via env var

# app/core.py (imports)
from app.settings import settings
```

**No code changes needed** in routes - they already use `settings` from imports.

---

## Security Checklist

- [ ] Never commit `.env` file (git-ignored)
- [ ] `SECRET_KEY` is unique and long (32+ chars)
- [ ] `ADMIN_PASSWORD` is strong and not default
- [ ] `DATABASE_URL` uses HTTPS/SSL
- [ ] `CORS_ORIGINS` is explicit in production (no `*`)
- [ ] Secrets stored in Cloud Secret Manager (not env vars)
- [ ] Production `ENVIRONMENT=production` to enable validation
- [ ] No API keys in logs (DEBUG=False in production)
- [ ] Regular rotation of `SECRET_KEY` and admin password

---

## Best Practices

1. **Use `.env` for local dev only**
   - Keep secrets out of git
   - Test with real-like values

2. **Use Cloud Secret Manager for production**
   - Auditable access
   - Automatic rotation support
   - Encrypted at rest

3. **Validate at startup**
   - Production config validated on boot
   - Fails fast if misconfigured
   - See `settings.validate_production_secrets()`

4. **Use `/env-test` for debugging**
   - Verify configuration without exposing secrets
   - Safe to call in production
   - Returns configuration status

5. **Document custom settings**
   - Add to `app/settings.py` with comments
   - Update `.env.example` with defaults
   - Update this guide with descriptions

---

## Additional Resources

- [Pydantic Settings Docs](https://docs.pydantic.dev/latest/concepts/pydantic_settings/)
- [FastAPI Settings](https://fastapi.tiangolo.com/advanced/settings/)
- [Google Cloud Run Best Practices](https://cloud.google.com/run/docs/configuring/environment-variables)
- [Supabase PostgreSQL Connection](https://supabase.com/docs/guides/database/connecting-to-postgres)

---

## Version History

- **v1.0** (2025-01-26): Initial production-ready configuration system
  - `settings.py` with pydantic-settings
  - `db/session.py` for database management
  - `/env-test` endpoint for debugging
  - Supabase PostgreSQL support with async
  - Cloud Run environment variable support
