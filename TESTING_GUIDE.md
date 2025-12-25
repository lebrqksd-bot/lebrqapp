# Configuration System - Testing & Verification Guide

## Quick Verification Checklist

Run these commands to verify the configuration system is working correctly.

### 1. Test Settings Module Loading

```bash
cd backend
python -c "from app.settings import settings; print('✓ Settings loaded'); print(f'Environment: {settings.ENVIRONMENT}')"
```

Expected output:
```
✓ Settings loaded
Environment: development
```

### 2. Test Database Module Loading

```bash
cd backend
python -c "from app.db import engine, Base, get_session; print('✓ Database module loaded'); print(f'Engine: {type(engine)}')"
```

Expected output:
```
✓ Database module loaded
Engine: <class 'sqlalchemy.ext.asyncio.AsyncEngine'>
```

### 3. Test Backward Compatibility

```bash
cd backend
python -c "from app.db import AsyncSessionLocal, init_db, get_session; print('✓ Backward compatibility maintained')"
```

Expected output:
```
✓ Backward compatibility maintained
```

### 4. Test Main Entry Point

```bash
cd backend
python -c "from main import app; print('✓ Main entry point works'); print(f'App: {type(app)}')"
```

Expected output:
```
✓ Main entry point works
App: <class 'fastapi.FastAPI'>
```

---

## Local Development Testing

### Setup for Testing

```bash
cd backend
cp .env.example .env

# Edit .env to use SQLite (default already does)
# DB_URL=sqlite+aiosqlite:///./lebrq.db
```

### Start Server

```bash
cd backend
python main.py

# Output should include:
# ✓ Settings loaded from environment
# ✓ FastAPI app created successfully
# Starting Lebrq API on 0.0.0.0:8000
# Environment: development
```

### Test Health Endpoint

```bash
curl http://localhost:8000/health

# Expected response:
# {"status":"ok"}
```

### Test Configuration Endpoint

```bash
curl http://localhost:8000/env-test

# Expected response (example):
{
  "status": "ok",
  "environment": "development",
  "debug": false,
  "app_name": "Lebrq API",
  "port": 8000,
  "api_prefix": "/api",
  "database": {
    "configured": "✓ configured",
    "status": "✓ connected",
    "url_prefix": "sqlite+aiosqlite://...",
    "is_supabase": false
  },
  "cors": {
    "allow_origins_count": 11
  },
  "secrets_configured": {
    "secret_key": "✗ using default",
    "admin_password": "✗ using default"
  },
  "frontend_url": "http://localhost:19006"
}
```

---

## Environment Variable Testing

### Test 1: Override with Environment Variable

```bash
cd backend

# Set via environment variable
export SECRET_KEY="my-custom-key"
python -c "from app.settings import settings; print(f'SECRET_KEY: {settings.SECRET_KEY}')"

# Expected:
# SECRET_KEY: my-custom-key
```

### Test 2: .env File Loading

```bash
cd backend

# Edit .env
echo "SECRET_KEY=from-env-file" >> .env

# Restart Python (new process needed)
python -c "from app.settings import settings; print(f'SECRET_KEY: {settings.SECRET_KEY}')"

# Expected:
# SECRET_KEY: from-env-file
```

### Test 3: Priority: Environment Variable > .env

```bash
cd backend

# Set both
export SECRET_KEY="from-env-var"
echo "SECRET_KEY=from-env-file" > .env

python -c "from app.settings import settings; print(f'SECRET_KEY: {settings.SECRET_KEY}')"

# Expected (env var wins):
# SECRET_KEY: from-env-var
```

### Test 4: Priority: .env > Default

```bash
cd backend

# Remove env var
unset SECRET_KEY

# .env should be used
python -c "from app.settings import settings; print(f'SECRET_KEY: {settings.SECRET_KEY}')"

# Expected:
# SECRET_KEY: from-env-file
```

### Test 5: Priority: Default (neither env nor .env)

```bash
cd backend

# Clean .env
rm .env

# Default should be used
python -c "from app.settings import settings; print(f'SECRET_KEY: {settings.SECRET_KEY}')"

# Expected:
# SECRET_KEY: change-me-in-production
```

---

## Database Configuration Testing

### Test 1: SQLite Configuration

```bash
cd backend

# Set SQLite in .env
export DB_URL="sqlite+aiosqlite:///./test.db"

python -c "from app.settings import settings; print(f'DB URL: {settings.computed_database_url}')"

# Expected:
# DB URL: sqlite+aiosqlite:///./test.db
```

### Test 2: PostgreSQL Components Resolution

```bash
cd backend

# Unset override
unset DB_URL
unset DATABASE_URL

# Set PostgreSQL components
export POSTGRES_USER="myuser"
export POSTGRES_PASSWORD="mypass"
export POSTGRES_HOST="localhost"
export POSTGRES_PORT="5432"
export POSTGRES_DB="mydb"

python -c "from app.settings import settings; print(f'DB URL: {settings.computed_database_url}')"

# Expected:
# DB URL: postgresql+asyncpg://myuser:mypass@localhost:5432/mydb
```

### Test 3: Database URL Priority

```bash
cd backend

# Set all three
export DATABASE_URL="postgresql+asyncpg://a:b@c:5432/d"
export DB_URL="sqlite+aiosqlite:///./test.db"
export POSTGRES_USER="ignored"

python -c "from app.settings import settings; print(f'DB URL: {settings.computed_database_url}')"

# Expected (DATABASE_URL wins):
# DB URL: postgresql+asyncpg://a:b@c:5432/d
```

---

## Production Mode Testing

### Test 1: Production Validation - Fails

```bash
cd backend

export ENVIRONMENT="production"
export SECRET_KEY="change-me-in-production"  # Default value!
export DATABASE_URL="postgresql+asyncpg://localhost:5432/db"  # Localhost!

python -c "from app.settings import settings"

# Expected output (FAILS with error):
# ValueError: Production security validation failed:
# DATABASE_URL must be set to production database (not localhost)
# SECRET_KEY must be changed from default value
```

### Test 2: Production Validation - Passes

```bash
cd backend

export ENVIRONMENT="production"
export SECRET_KEY="my-secure-production-key-32-chars"
export DATABASE_URL="postgresql+asyncpg://user:pass@db.supabase.co:5432/postgres"

python -c "from app.settings import settings; print('✓ Production validation PASSED')"

# Expected:
# ✓ Production validation PASSED
```

### Test 3: is_production Property

```bash
cd backend

# Development mode
export ENVIRONMENT="development"
python -c "from app.settings import settings; print(f'is_production: {settings.is_production}')"

# Expected: is_production: False

# Production mode
export ENVIRONMENT="production"
python -c "from app.settings import settings; print(f'is_production: {settings.is_production}')"

# Expected: is_production: True
```

---

## Database Connection Testing

### Test 1: SQLite Connection (No Server Required)

```bash
cd backend

# Use SQLite
export DB_URL="sqlite+aiosqlite:///./test.db"

# Test connection
python << 'EOF'
import asyncio
from app.db import engine
from sqlalchemy import text

async def test():
    async with engine.begin() as conn:
        result = await conn.execute(text("SELECT 1"))
        print("✓ SQLite connection successful")

asyncio.run(test())
EOF

# Expected:
# ✓ SQLite connection successful
```

### Test 2: PostgreSQL Connection

```bash
cd backend

# Set PostgreSQL (assumes local Postgres running)
export DATABASE_URL="postgresql+asyncpg://postgres:postgres@localhost:5432/lebrq"

# Test connection
python << 'EOF'
import asyncio
from app.db import engine
from sqlalchemy import text

async def test():
    try:
        async with engine.begin() as conn:
            result = await conn.execute(text("SELECT 1"))
            print("✓ PostgreSQL connection successful")
    except Exception as e:
        print(f"✗ Connection failed: {e}")

asyncio.run(test())
EOF

# Expected (if Postgres running):
# ✓ PostgreSQL connection successful

# Expected (if Postgres not running):
# ✗ Connection failed: ...
```

---

## Server Startup Testing

### Test 1: Verify Server Starts

```bash
cd backend

# Start server in background
python main.py &
sleep 2

# Test health endpoint
curl http://localhost:8000/health

# Expected:
# {"status":"ok"}

# Kill server
pkill -f "python main.py"
```

### Test 2: Verify Configuration Endpoint

```bash
cd backend

# Start server
python main.py &
sleep 2

# Test env-test endpoint
curl http://localhost:8000/env-test

# Should return JSON with configuration status
pkill -f "python main.py"
```

### Test 3: Verify Logging

```bash
cd backend

# Start server and capture output
python main.py 2>&1 | head -20

# Expected to see:
# ✓ Settings loaded from environment
# ✓ FastAPI app created successfully
# Starting Lebrq API on 0.0.0.0:8000
# Environment: development
# Database: ...
```

---

## Integration Testing

### Test 1: Full Startup Sequence

```bash
cd backend

# Clean environment
unset DATABASE_URL
unset DB_URL
unset SECRET_KEY
unset ENVIRONMENT

# Verify defaults are used
python -c "
from app.settings import settings
from app.db import engine

print(f'✓ Settings: {settings.APP_NAME}')
print(f'✓ Database: {settings.computed_database_url}')
print(f'✓ Engine: {type(engine).__name__}')
"

# Expected:
# ✓ Settings: Lebrq API
# ✓ Database: sqlite+aiosqlite:///./lebrq.db
# ✓ Engine: AsyncEngine
```

### Test 2: Development Environment

```bash
cd backend
cp .env.example .env

# Edit .env to ensure SQLite
# DB_URL=sqlite+aiosqlite:///./lebrq.db

# Start server
timeout 5 python main.py || true

# Check it started without errors
# (timeout kills it after 5 seconds)
```

---

## Type Checking

### Test with Pylance/Mypy

```bash
cd backend

# Check syntax
python -m py_compile app/settings.py app/db/session.py main.py

# Check imports
python -c "import app.settings; import app.db; from main import app"

# Verify types
python << 'EOF'
from app.settings import Settings, settings

# These should work (IDE autocomplete)
s: Settings = settings
_ = s.APP_NAME  # str
_ = s.PORT  # int
_ = s.CORS_ORIGINS  # List[str]
_ = s.is_production  # bool

print("✓ All types correct")
EOF
```

---

## Backward Compatibility Testing

### Test: Old Import Style Still Works

```bash
cd backend

python << 'EOF'
# Old style (from db.py)
from app.db import (
    Base,
    engine,
    AsyncSessionLocal,
    init_db,
    get_session,
    sync_engine,
    SyncSessionLocal,
    get_db,
)

print("✓ All old imports work")
EOF

# Expected:
# ✓ All old imports work
```

### Test: New Import Style Works

```bash
cd backend

python << 'EOF'
# New style (from db/session.py)
from app.db.session import (
    Base,
    engine,
    AsyncSessionLocal,
    init_db,
    get_session,
)

print("✓ All new imports work")
EOF

# Expected:
# ✓ All new imports work
```

---

## Performance Testing

### Test: Settings Loading Time

```bash
cd backend

python << 'EOF'
import time

start = time.time()
from app.settings import settings
elapsed = (time.time() - start) * 1000

print(f"✓ Settings loaded in {elapsed:.2f}ms")
# Expected: < 100ms
EOF
```

### Test: Engine Creation Time

```bash
cd backend

python << 'EOF'
import time

start = time.time()
from app.db import engine
elapsed = (time.time() - start) * 1000

print(f"✓ Engine created in {elapsed:.2f}ms")
# Expected: < 500ms
EOF
```

---

## Troubleshooting Tests

### Test: Missing .env File

```bash
cd backend
rm -f .env

python -c "from app.settings import settings; print('✓ Works without .env')"

# Expected (should use defaults):
# ✓ Works without .env
```

### Test: Invalid .env File

```bash
cd backend

# Create invalid .env
echo "INVALID_SYNTAX!!!" > .env

python -c "from app.settings import settings; print('✓ Ignores invalid lines')"

# Expected (pydantic-settings ignores unparseable lines):
# ✓ Ignores invalid lines
```

### Test: Missing Required Env Var (Production)

```bash
cd backend

export ENVIRONMENT="production"
export SECRET_KEY="my-key"
# Missing DATABASE_URL!

python -c "from app.settings import settings" 2>&1 | head -5

# Expected (validation fails):
# ValueError: Production security validation failed:
# DATABASE_URL must be set to production database
```

---

## Summary

After running these tests, you should verify:

- [ ] Settings module loads correctly
- [ ] Database module loads correctly
- [ ] Main entry point works
- [ ] Server starts and responds to /health
- [ ] /env-test endpoint works
- [ ] Environment variables take priority
- [ ] .env file is loaded when present
- [ ] Defaults are used when nothing is set
- [ ] Production validation works
- [ ] Database connections work (for your DB type)
- [ ] Backward compatibility maintained
- [ ] No syntax or type errors
- [ ] Server startup logs are clean

✅ If all tests pass, the configuration system is working correctly!
