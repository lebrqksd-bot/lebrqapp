# Configuration System Architecture

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    User's Request to Lebrq API                      │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │   main.py (Entry Point)     │
                    │  1. Import settings         │
                    │  2. Validate config         │
                    │  3. Create FastAPI app      │
                    │  4. Start uvicorn server    │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │  app.settings.settings      │
                    │  ✓ Type-safe settings      │
                    │  ✓ Validation at startup   │
                    │  ✓ Single source of truth  │
                    └──────────────┬──────────────┘
                                   │
         ┌─────────────────────────┴──────────────────────────┐
         │                                                    │
    ┌────▼────────────┐                      ┌────────────────▼──────┐
    │  app.db.engine  │                      │  app.core.create_app  │
    │  ✓ Async engine │                      │  ✓ FastAPI factory   │
    │  ✓ Connection   │                      │  ✓ Middleware setup  │
    │    pooling      │                      │  ✓ Router inclusion  │
    │  ✓ Supabase     │                      │  ✓ /env-test endpoint│
    │    support      │                      └──────────────────────┘
    └─────────────────┘
         │
    ┌────▼──────────────────┐
    │  Database Connection  │
    │  ✓ PostgreSQL/Supabase│
    │  ✓ MySQL              │
    │  ✓ SQLite (dev)       │
    └──────────────────────┘
```

---

## Settings Loading Flow

```
APPLICATION STARTUP
│
├─ 1. Python Interpreter starts
│  └─> sys.path includes backend/
│
├─ 2. main.py imports settings
│  └─> from app.settings import settings
│     └─> pydantic-settings loads values
│
├─ 3. Settings Priority (first found wins):
│  │
│  ├─ PRIORITY 1: Environment Variables
│  │  ├─ DATABASE_URL (if set)
│  │  ├─ SECRET_KEY (if set)
│  │  ├─ ENVIRONMENT (if set)
│  │  └─ ...other vars...
│  │
│  ├─ PRIORITY 2: .env File (if exists)
│  │  ├─ Loaded from backend/.env
│  │  ├─ NOT read in production
│  │  ├─ AUTO-LOADED by pydantic
│  │  └─ Can override env vars? NO (env vars win)
│  │
│  └─ PRIORITY 3: Hardcoded Defaults
│     ├─ POSTGRES_USER = "postgres"
│     ├─ POSTGRES_PORT = 5432
│     ├─ CORS_ORIGINS = [...]
│     └─ ...other defaults...
│
├─ 4. Settings Object Created
│  └─> settings = Settings()
│     └─ All values loaded and typed
│     └─ Computed properties evaluated
│
├─ 5. Validation (if production)
│  └─> settings.validate_production_secrets()
│     ├─ DATABASE_URL not localhost? ✓
│     ├─ SECRET_KEY not default? ✓
│     └─ FAIL if validation error
│
├─ 6. Database Engine Created
│  └─> engine = create_async_engine(
│        settings.computed_database_url,
│        pool_size=settings.DB_POOL_SIZE,
│        ...
│      )
│
├─ 7. FastAPI App Created
│  └─> app = create_app()
│     ├─ CORS middleware (uses settings.CORS_ORIGINS)
│     ├─ /health endpoint
│     ├─ /env-test endpoint
│     └─ All routers registered
│
└─ 8. Server Starts
   └─> uvicorn.run(app, host="0.0.0.0", port=settings.PORT)
      └─ Ready to handle requests!
```

---

## Database Configuration Routing

```
DATABASE_URL Resolution:

    settings.computed_database_url
    │
    ├─ Has DATABASE_URL env var set?
    │  ├─ YES → Use DATABASE_URL
    │  │        (e.g., postgresql+asyncpg://... from Cloud Run)
    │  │
    │  └─ NO → Continue
    │
    ├─ Has DB_URL env var set?
    │  ├─ YES → Use DB_URL
    │  │        (e.g., sqlite+aiosqlite:///./lebrq.db for local dev)
    │  │
    │  └─ NO → Continue
    │
    └─ Construct from PostgreSQL components
       └─ postgresql+asyncpg://{user}:{pass}@{host}:{port}/{db}
          ├─ user: settings.POSTGRES_USER (default: "postgres")
          ├─ pass: settings.POSTGRES_PASSWORD (default: "postgres")
          ├─ host: settings.POSTGRES_HOST (default: "localhost")
          ├─ port: settings.POSTGRES_PORT (default: 5432)
          └─ db: settings.POSTGRES_DB (default: "lebrq")

EXAMPLE RESOLUTIONS:

Cloud Run:
  DATABASE_URL=postgresql+asyncpg://...
  │
  └─> settings.computed_database_url = "postgresql+asyncpg://..."

Local Dev (SQLite):
  DB_URL=sqlite+aiosqlite:///./lebrq.db
  │
  └─> settings.computed_database_url = "sqlite+aiosqlite:///./lebrq.db"

Local Dev (PostgreSQL):
  POSTGRES_USER=postgres
  POSTGRES_PASSWORD=password
  POSTGRES_HOST=localhost
  POSTGRES_PORT=5432
  POSTGRES_DB=lebrq
  │
  └─> settings.computed_database_url = "postgresql+asyncpg://postgres:password@localhost:5432/lebrq"
```

---

## Request Lifecycle

```
CLIENT REQUEST
│
├─ HTTP Request arrives at 0.0.0.0:8000 (or :8080 on Cloud Run)
│
├─ FastAPI middleware stack processes request
│  ├─ CORS middleware (uses settings.CORS_ORIGINS)
│  ├─ Timeout middleware (uses route-specific timeouts)
│  └─ Error handling middleware
│
├─ Route handler executes
│  ├─ Accesses settings (e.g., settings.FRONTEND_URL)
│  ├─ Uses database session (from app.db.get_session)
│  │  └─ Session obtained from connection pool
│  │     └─ Pool sized at settings.DB_POOL_SIZE
│  └─ Returns response
│
├─ Session automatically closes
│  └─ Connection returned to pool
│
├─ Middleware applies response headers (CORS, etc.)
│
└─ Response sent back to client
```

---

## Local Development Workflow

```
┌───────────────────────────────────────────────────┐
│           LOCAL DEVELOPMENT SETUP                 │
├───────────────────────────────────────────────────┤
│                                                   │
│  1. Clone repository                              │
│     backend/                                      │
│     ├─ app/                                       │
│     │  ├─ settings.py ✓ (defines all config)     │
│     │  ├─ core.py      ✓ (imports settings)      │
│     │  └─ db/          ✓ (uses settings)         │
│     ├─ main.py        ✓ (entry point)           │
│     └─ .env.example   ✓ (template)              │
│                                                   │
│  2. Copy .env.example → .env                      │
│     $ cp .env.example .env                        │
│                                                   │
│  3. Edit .env for local setup                     │
│     DB_URL=sqlite+aiosqlite:///./lebrq.db        │
│     ENVIRONMENT=development                      │
│     SECRET_KEY=anything-for-local-dev            │
│                                                   │
│  4. Run backend                                   │
│     $ python main.py                              │
│                                                   │
│  5. Test configuration                            │
│     $ curl http://localhost:8000/env-test        │
│                                                   │
│  6. Development!                                  │
│     Auto-reload: Use --reload flag               │
│     uvicorn app.core:app --reload --port 8000   │
│                                                   │
└───────────────────────────────────────────────────┘
```

---

## Production (Cloud Run) Workflow

```
┌───────────────────────────────────────────────────┐
│        PRODUCTION DEPLOYMENT (Cloud Run)          │
├───────────────────────────────────────────────────┤
│                                                   │
│  1. NO .env file needed!                          │
│     ✓ .env not read in production                 │
│     ✓ .env never committed                        │
│     ✓ Configuration via Cloud Run variables       │
│                                                   │
│  2. Docker build                                  │
│     $ docker build -t lebrq-api .                │
│                                                   │
│  3. Push to Container Registry                    │
│     $ docker push gcr.io/PROJECT/lebrq-api       │
│                                                   │
│  4. Set Cloud Run environment variables           │
│     ENVIRONMENT=production                       │
│     DATABASE_URL=postgresql+asyncpg://...       │
│     SECRET_KEY=<generated-secret>               │
│     ADMIN_PASSWORD=<secure-password>            │
│     FRONTEND_URL=https://lebrq.com              │
│     (Use Cloud Secret Manager for sensitive)    │
│                                                   │
│  5. Deploy to Cloud Run                           │
│     $ gcloud run deploy lebrq-api \              │
│         --image gcr.io/.../lebrq-api:latest \   │
│         --set-env-vars="ENVIRONMENT=production"  │
│         --set-secrets="SECRET_KEY=secret:latest" │
│                                                   │
│  6. Automatic Features                            │
│     ✓ PORT=8080 (Cloud Run sets automatically)   │
│     ✓ Async engine ready                         │
│     ✓ Connection pooling optimized               │
│     ✓ Validation runs at startup                 │
│     ✓ Production security checks enabled         │
│                                                   │
│  7. Verify deployment                             │
│     $ curl https://lebrq-api-xxx.run.app/health │
│     $ curl https://lebrq-api-xxx.run.app/env-test│
│                                                   │
│  8. Monitoring                                    │
│     ✓ Check /env-test periodically               │
│     ✓ Monitor logs for configuration issues      │
│     ✓ Alert on SECRET_KEY validation failures    │
│                                                   │
└───────────────────────────────────────────────────┘
```

---

## Setting Inheritance Example

```
Scenario: Running in Cloud Run with Supabase

1. Environment Variables (set by Cloud Run):
   ├─ ENVIRONMENT=production
   ├─ DATABASE_URL=postgresql+asyncpg://user:pass@db.supabase.co:5432/postgres
   ├─ SECRET_KEY=<generated-32-char-value>
   └─ PORT=8080

2. pydantic-settings loads Settings():
   ├─ settings.ENVIRONMENT = "production" (from env)
   ├─ settings.computed_database_url = postgresql+asyncpg://... (from env)
   ├─ settings.SECRET_KEY = <value> (from env)
   ├─ settings.PORT = 8080 (from env)
   ├─ settings.POSTGRES_USER = "postgres" (default, not overridden)
   ├─ settings.APP_NAME = "Lebrq API" (default)
   ├─ settings.CORS_ORIGINS = [...] (default list)
   └─ settings.is_production = True (computed)

3. Validation runs:
   ├─ Is ENVIRONMENT=production? YES
   ├─ Is DATABASE_URL set and not localhost? YES ✓
   ├─ Is SECRET_KEY changed from default? YES ✓
   └─ → Validation PASSES

4. Database engine created:
   ├─ create_async_engine(
   │    "postgresql+asyncpg://...",
   │    pool_size=5,
   │    pool_pre_ping=True,
   │    prepared_statement_cache_size=0,  # Supabase PgBouncer
   │    connect_args={'server_settings': ...}
   │  )
   └─ Connection pooling optimized for Cloud Run

5. FastAPI app created:
   ├─ CORS allowed origins: settings.CORS_ORIGINS
   ├─ Debug disabled (settings.DEBUG=False)
   └─ Ready for production traffic

RESULT: Fully configured, validated, production-ready system!
```

---

## File Organization

```
backend/
├─ main.py                     ← Entry point
│  └─ Loads settings, starts server
│
├─ app/
│  ├─ settings.py              ← ✨ NEW: Central configuration
│  │  ├─ Settings class (pydantic)
│  │  ├─ DATABASE_URL resolution
│  │  ├─ Production validation
│  │  └─ settings = Settings() (global object)
│  │
│  ├─ core.py                  ← Refactored: Imports settings
│  │  ├─ from app.settings import settings
│  │  ├─ create_app() factory
│  │  ├─ /env-test endpoint (NEW)
│  │  └─ uses settings throughout
│  │
│  ├─ db.py                    ← Backward compatibility layer
│  │  └─ from app.db.session import *
│  │
│  └─ db/                       ← ✨ NEW: Database module
│     ├─ __init__.py           ← Re-exports for clean API
│     │
│     └─ session.py            ← ✨ NEW: Engine & session
│        ├─ create_async_engine()
│        ├─ get_session() dependency
│        ├─ init_db() startup function
│        ├─ close_db() shutdown function
│        └─ Sync engine for legacy routes
│
├─ .env                        ← Local dev config (git-ignored)
├─ .env.example                ← Config template (git-tracked)
│
└─ ... other files unchanged ...


DEPLOYMENT_CONFIG.md           ← ✨ NEW: Full deployment guide
CONFIG_QUICK_REFERENCE.md      ← ✨ NEW: Quick reference
IMPLEMENTATION_SUMMARY.md      ← ✨ NEW: This implementation
```

---

## Dependencies

```
New Python Packages Used:
├─ pydantic-settings (already in requirements.txt)
│  └─ Used for configuration management
│
├─ sqlalchemy (async support)
│  └─ Already in requirements.txt
│
└─ fastapi
   └─ Already in requirements.txt

NO NEW DEPENDENCIES REQUIRED ✓
(All packages already in project)
```

---

## Configuration Lookup Example

```
# When code accesses settings.SECRET_KEY:

Step 1: Check if ENVIRONMENT variable set
        → YES, ENVIRONMENT=production

Step 2: Pydantic loads from sources in order:
        1. Check os.environ['SECRET_KEY']
           → FOUND in Cloud Run: "dXF2LXQtX..."
        2. Check .env file
           → NOT LOADED (production mode)
        3. Use default
           → N/A (found in step 1)

Step 3: Assign to Settings object
        → settings.SECRET_KEY = "dXF2LXQtX..."

Step 4: Validation (production mode)
        → Is "dXF2LXQtX..." different from "change-me-in-production"?
        → YES ✓ (validation passes)

Step 5: Use in code
        → jwt.encode(payload, settings.SECRET_KEY, ...)
        → Used for signing JWTs
```

---

## This Architecture Enables

✅ **Clean Separation of Concerns**
- Configuration in settings.py
- Database setup in db/session.py
- App creation in core.py
- Entry point in main.py

✅ **Easy Testing**
- Mock settings for tests
- Override DATABASE_URL for test DB
- No global state pollution

✅ **Easy Deployment**
- Local dev: Just copy .env.example → .env
- Cloud Run: Set env variables, no .env needed
- Same code, different config

✅ **Easy Extension**
- Add new setting to Settings class
- Use in code via settings.NEW_SETTING
- Automatically loaded and validated

✅ **Production Safety**
- Validation at startup
- Secrets never in logs
- Environment-aware behavior
- Fail fast on misconfiguration
