#!/usr/bin/env python3
"""
Lebrq Backend - Production-Ready Entry Point

Loads configuration from settings.py (pydantic-settings).
Supports multiple deployment scenarios:

1. Local Development (SQLite):
    DB_URL="sqlite+aiosqlite:///./lebrq.db" python main.py

2. Local Development (MySQL/PostgreSQL):
    DATABASE_URL="postgresql+asyncpg://user:pass@localhost/db" python main.py

3. Cloud Run (Supabase):
    DATABASE_URL="postgresql+asyncpg://..." PORT=8080 python main.py
    (Database URL and PORT set via Cloud Run environment)

4. Docker Container:
    docker run -e DATABASE_URL="..." -e PORT=8080 app

Configuration sources (in order of priority):
1. Environment variables
2. .env file (local development only, git-ignored)
3. Defaults (in settings.py)
"""

import os
import sys
import logging
import uvicorn

# Configure logging FIRST, before anything else
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Import settings to validate configuration at startup
try:
    from app.settings import settings
    logger.info(f"✓ Settings loaded from environment (ENVIRONMENT={settings.ENVIRONMENT})")
except Exception as e:
    logger.error(f"✗ Failed to load settings: {e}")
    sys.exit(1)

# Create the FastAPI application
try:
    from app.core import create_app
    app = create_app()
    logger.info("✓ FastAPI app created successfully")
except Exception as e:
    logger.error(f"✗ Failed to create FastAPI app: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)


def main():
    """
    Run the application with uvicorn.
    
    Cloud Run:
    - PORT env var is set automatically (default 8080)
    - Database configuration via DATABASE_URL env var
    - No need to modify this code for Cloud Run
    
    Local Development:
    - Use DB_URL for SQLite: DB_URL="sqlite+aiosqlite:///./lebrq.db"
    - Use DATABASE_URL for PostgreSQL: DATABASE_URL="postgresql+asyncpg://..."
    - PORT defaults to 8000
    """
    
    # Get port from settings (reads from PORT env var, defaults to 8000)
    # Cloud Run sets PORT=8080, local dev defaults to 8000
    port = settings.PORT
    host = "0.0.0.0"  # Required for Cloud Run and containers
    
    logger.info(f"Starting {settings.APP_NAME} on {host}:{port}")
    logger.info(f"Environment: {settings.ENVIRONMENT}")
    logger.info(f"Database: {settings.computed_database_url.split('@')[0]}...@{settings.computed_database_url.split('@')[1] if '@' in settings.computed_database_url else 'local'}")
    
    # Determine log level and access logging based on environment
    log_level = "info" if settings.is_production else "debug"
    access_log = not settings.is_production
    
    # Run uvicorn
    try:
        uvicorn.run(
            app,
            host=host,
            port=port,
            log_level=log_level,
            access_log=access_log,
        )
    except KeyboardInterrupt:
        logger.info("Shutdown requested")
        sys.exit(0)
    except Exception as e:
        logger.error(f"Failed to start uvicorn: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
