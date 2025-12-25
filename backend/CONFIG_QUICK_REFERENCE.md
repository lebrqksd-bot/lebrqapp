# Lebrq Backend - Configuration Quick Reference

## TL;DR

### Local Development
```bash
cd backend
cp .env.example .env
python main.py
```

### Cloud Run Deployment
```bash
gcloud run deploy lebrq-api \
  --set-env-vars="ENVIRONMENT=production,DATABASE_URL=postgresql+asyncpg://..." \
  --set-secrets="SECRET_KEY=lebrq-secret-key:latest" \
  ...
```

---

## Configuration Files

| File | Purpose | Git-tracked? | Required? |
|------|---------|-------------|-----------|
| `backend/app/settings.py` | Config definitions | ✓ Yes | ✓ Yes |
| `backend/app/db/session.py` | Database setup | ✓ Yes | ✓ Yes |
| `backend/main.py` | Entry point | ✓ Yes | ✓ Yes |
| `backend/.env` | Local dev overrides | ✗ No (gitignored) | ✗ No (dev only) |
| `backend/.env.example` | Example template | ✓ Yes | - |
| `DEPLOYMENT_CONFIG.md` | Full deployment guide | ✓ Yes | - |

---

## How Settings Work

```
┌─────────────────────────────────────────────────────────────┐
│ Environment Variables (Cloud Run, Docker, etc.)            │
└────────────────────┬────────────────────────────────────────┘
                     │ (Highest Priority)
                     ▼
          ┌──────────────────────┐
          │  Settings Object     │
          │ app.settings.settings│
          └──────────────────────┘
                     ▲
                     │
┌────────────────────┴────────────────────────────────────────┐
│ .env File (Local Dev - Pydantic loads automatically)       │
└─────────────────────────────────────────────────────────────┘
                     │ (Medium Priority)
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Hardcoded Defaults (in settings.py)                        │
└─────────────────────────────────────────────────────────────┘
                     (Lowest Priority)
```

**Settings are loaded ONCE at startup** - no dynamic reloading needed.

---

## Common Tasks

### Add a New Setting

1. **Define in `app/settings.py`:**
```python
class Settings(BaseSettings):
    MY_NEW_SETTING: str = "default_value"  # Default
    # or
    MY_NEW_SETTING: Optional[str] = None  # Optional
```

2. **Use in code:**
```python
from app.settings import settings

print(settings.MY_NEW_SETTING)
```

3. **Override in `.env` (dev):**
```bash
MY_NEW_SETTING=my_value
```

4. **Override in Cloud Run:**
```bash
gcloud run deploy ... --set-env-vars="MY_NEW_SETTING=my_value"
```

### Check Configuration at Runtime

```bash
# Query the /env-test endpoint
curl http://localhost:8000/env-test

# Response shows all config status without exposing secrets
{
  "status": "ok",
  "environment": "development",
  "database": { "configured": "✓", "status": "✓ connected" },
  "secrets_configured": { "secret_key": "✓" }
}
```

### Test Database Connection

```bash
# Via /env-test endpoint
curl http://localhost:8000/env-test

# Or programmatically
from app.db import engine
from sqlalchemy import text

async with engine.begin() as conn:
    result = await conn.execute(text("SELECT 1"))
    print("✓ Database connected")
```

### Generate Production SECRET_KEY

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
# Output: dXF2LXQtXy1rX19jb2RlLVN0cmluZ182NTAtYVRkZy1tWE==
```

---

## Environment Variables by Scenario

### Local Development (SQLite)

```bash
ENVIRONMENT=development
DB_URL=sqlite+aiosqlite:///./lebrq.db
SECRET_KEY=dev-key-no-need-to-change
ADMIN_PASSWORD=admin123
FRONTEND_URL=http://localhost:19006
```

### Local Development (PostgreSQL)

```bash
ENVIRONMENT=development
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/lebrq
SECRET_KEY=dev-key
ADMIN_PASSWORD=admin123
FRONTEND_URL=http://localhost:19006
```

### Production (Cloud Run + Supabase)

```bash
ENVIRONMENT=production
DATABASE_URL=postgresql+asyncpg://user:pass@db.supabase.co:5432/postgres
SECRET_KEY=<generated-32-char-secret>
ADMIN_PASSWORD=<secure-password>
FRONTEND_URL=https://lebrq.com
CORS_ORIGINS=https://lebrq.com,https://www.lebrq.com
```

---

## Database Connection Strings

### SQLite (Local Dev)
```
sqlite+aiosqlite:///./lebrq.db
```

### PostgreSQL (Local)
```
postgresql+asyncpg://postgres:password@localhost:5432/lebrq
```

### PostgreSQL (Remote)
```
postgresql+asyncpg://user:password@hostname:5432/database
```

### Supabase (Production)
```
postgresql+asyncpg://postgres:[PASSWORD]@[HOST]:5432/postgres
```

**Get Supabase connection string:**
1. Open Supabase project
2. Go to Settings → Database
3. Copy "Connection string"
4. Replace `[PASSWORD]` with your password
5. Use as `DATABASE_URL`

---

## Checking Configuration in Code

```python
from app.settings import settings

# Check environment
if settings.is_production:
    print("Running in production mode")

# Check database type
if settings.is_supabase:
    print("Using Supabase PostgreSQL")

# Access any setting
database_url = settings.computed_database_url
cors_origins = settings.CORS_ORIGINS
frontend_url = settings.FRONTEND_URL

# All settings are type-hinted and validated
print(f"Database: {settings.computed_database_url}")
print(f"API Prefix: {settings.API_PREFIX}")
print(f"Timezone: {settings.LOCAL_TIMEZONE}")
```

---

## Production Validation

When `ENVIRONMENT=production`, the system automatically validates:

1. **DATABASE_URL is NOT localhost**
   - Prevents accidental production env pointing to local DB

2. **SECRET_KEY is NOT default**
   - Prevents insecure default secrets in production

3. **Validation runs at startup**
   - Application fails fast if misconfigured
   - No silent failures in production

Example:
```bash
# This WILL FAIL in production
ENVIRONMENT=production
SECRET_KEY=change-me-in-production
```

Error:
```
ValueError: Production security validation failed:
SECRET_KEY must be changed from default value
```

---

## Database Pool Configuration

Fine-tune connection pool for your infrastructure:

```bash
# In .env or Cloud Run environment
DB_POOL_SIZE=5              # Default connections in pool
DB_MAX_OVERFLOW=5           # Extra connections for bursts
DB_POOL_TIMEOUT=30          # Wait time for available connection (seconds)
DB_POOL_RECYCLE=280         # Recycle connections before timeout
DB_DISABLE_PREPARED_STATEMENTS=False  # For PgBouncer compatibility
```

**Default settings optimize for:**
- Cloud Run (limited resources)
- High concurrency
- Memory efficiency

Adjust for your specific needs.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `ModuleNotFoundError: No module named 'app.settings'` | Ensure backend/ is in PYTHONPATH |
| `DATABASE_URL must be set in production` | Set DATABASE_URL env var for production |
| `SECRET_KEY must be changed from default` | Generate new SECRET_KEY and set in Cloud Run |
| `/env-test` shows DB connection error | Verify DATABASE_URL is correct and accessible |
| `.env` not being loaded | Ensure file is in `backend/` directory and readable |
| `prepared statement` errors with Supabase | Set `DB_DISABLE_PREPARED_STATEMENTS=True` |

---

## Example: Cloud Run Deployment

```bash
#!/bin/bash

# 1. Build Docker image
docker build -t lebrq-api .

# 2. Push to Google Container Registry
docker tag lebrq-api gcr.io/PROJECT_ID/lebrq-api:latest
docker push gcr.io/PROJECT_ID/lebrq-api:latest

# 3. Create Cloud Run secrets (one-time)
echo "your-secret-key" | gcloud secrets create lebrq-secret-key --data-file=-
echo "admin-password" | gcloud secrets create lebrq-admin-password --data-file=-
echo "db-url" | gcloud secrets create lebrq-db-url --data-file=-

# 4. Deploy to Cloud Run
gcloud run deploy lebrq-api \
  --image gcr.io/PROJECT_ID/lebrq-api:latest \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --set-env-vars="ENVIRONMENT=production,FRONTEND_URL=https://lebrq.com" \
  --set-secrets="SECRET_KEY=lebrq-secret-key:latest,ADMIN_PASSWORD=lebrq-admin-password:latest,DATABASE_URL=lebrq-db-url:latest"

# 5. Verify
curl https://lebrq-api-xxx.run.app/health
curl https://lebrq-api-xxx.run.app/env-test
```

---

## Next Steps

1. **Read full guide**: See [DEPLOYMENT_CONFIG.md](DEPLOYMENT_CONFIG.md)
2. **Local dev**: Follow "Local Development Setup" section
3. **Deploy**: Follow "Production Deployment (Google Cloud Run)" section
4. **Secure**: Review "Security Checklist" before going live
