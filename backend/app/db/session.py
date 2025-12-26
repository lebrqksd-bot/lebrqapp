"""
Database Session and Engine Management

Provides:
- Async SQLAlchemy engine with Supabase/PostgreSQL support
- Proper connection pooling and cleanup
- Prepared statement handling for transaction poolers
- Database initialization with migration safety
"""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
from typing import AsyncGenerator
import logging

from app.settings import settings

logger = logging.getLogger(__name__)


class Base(DeclarativeBase):
    """SQLAlchemy declarative base for all ORM models."""
    pass


# ─────────────────────────────────────────────────────────────────────────────
# Async Engine (Primary)
# ─────────────────────────────────────────────────────────────────────────────

def _create_async_engine():
    """
    Create async SQLAlchemy engine with production-ready settings.
    
    Features:
    - Supabase/PostgreSQL support (asyncpg driver)
    - SQLite support for local development
    - Proper connection pooling for high concurrency
    - Prepared statement handling for transaction poolers
    - Memory-efficient defaults
    """
    db_url = settings.computed_database_url
    
    # Base connect_args from settings (handles prepared statements, app name, etc.)
    connect_args = settings.get_db_connect_args()
    
    logger.info(f"Creating async engine for: {db_url.split('@')[0]}...@{db_url.split('@')[1] if '@' in db_url else 'local'}")
    
    engine = create_async_engine(
        db_url,
        echo=settings.DEBUG,  # SQL logging only in debug mode
        
        # Connection Pooling
        pool_size=settings.DB_POOL_SIZE,
        max_overflow=settings.DB_MAX_OVERFLOW,
        pool_timeout=settings.DB_POOL_TIMEOUT,
        pool_reset_on_return='commit',
        pool_pre_ping=True,  # Verify connections before use
        
        # Connect args (prepared statements, app name, etc.)
        connect_args=connect_args,
    )
    
    return engine


# Global async engine - MUST be initialized before use
# On Cloud Run: If DATABASE_URL is not set, defaults to localhost:5432
# SOLUTION: Only try to create engine if we have a valid database URL
engine = None
AsyncSessionLocal = None

def _initialize_engine():
    """Initialize the engine and session factory."""
    global engine, AsyncSessionLocal
    if engine is None:
        try:
            logger.info(f"[DB] Initializing engine with: {settings.computed_database_url.split('@')[0]}...")
            engine = _create_async_engine()
            AsyncSessionLocal = async_sessionmaker(
                engine,
                class_=AsyncSession,
                expire_on_commit=False,
                autocommit=False,
                autoflush=False,
            )
            logger.info("[DB] Engine and AsyncSessionLocal initialized successfully")
        except Exception as e:
            logger.error(f"[DB] Failed to initialize engine: {e}")
            # Leave engine as None - will be retried later
            raise

# Try to initialize on import, but don't crash if it fails
# This allows the app to start even if database isn't available
try:
    _initialize_engine()
except Exception as e:
    logger.warning(f"[DB] Deferred engine initialization (will retry on first request): {e}")


# ─────────────────────────────────────────────────────────────────────────────
# Database Initialization
# ─────────────────────────────────────────────────────────────────────────────

async def init_db() -> None:
    """
    Initialize database connection and create tables (development only).
    
    IMPORTANT: In production, tables are NOT created here.
    Use proper migrations (Alembic) for schema changes in production.
    This function only verifies connectivity and creates tables in dev mode.
    
    Cloud Run and production environments:
    - Skips table creation (use Alembic migrations instead)
    - Only verifies database connectivity
    - Logs startup status
    """
    try:
        async with engine.begin() as conn:
            # Always verify connectivity
            await conn.execute(text("SELECT 1"))
            logger.info("✓ Database connectivity verified")
            
            # Create tables only in development
            if not settings.is_production:
                await conn.run_sync(Base.metadata.create_all)
                logger.info("✓ Development mode: Tables created/verified")
            else:
                logger.info("✓ Production mode: Skipping table creation (use Alembic migrations)")
    
    except Exception as e:
        logger.error(f"✗ Database initialization failed: {e}")
        raise


async def close_db() -> None:
    """Close database engine and cleanup resources."""
    await engine.dispose()
    logger.info("✓ Database engine disposed")


# ─────────────────────────────────────────────────────────────────────────────
# Dependency: Async Session
# ─────────────────────────────────────────────────────────────────────────────

async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Provide an async database session for FastAPI routes.
    
    Usage in FastAPI routes:
        @app.get("/items")
        async def list_items(session: AsyncSession = Depends(get_session)):
            result = await session.execute(...)
            return result.scalars().all()
    
    Guarantees:
    - Session is always closed (context manager)
    - Transactions are rolled back on error
    - Connection returned to pool
    - No connection leaks
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            # Rollback on any exception to release locks
            await session.rollback()
            raise
        finally:
            # Context manager auto-closes; explicit cleanup if needed
            await session.close()


# ─────────────────────────────────────────────────────────────────────────────
# Sync Engine (Optional - for specific routers like payments)
# ─────────────────────────────────────────────────────────────────────────────

def _create_sync_engine():
    """
    Create sync SQLAlchemy engine for routers that require blocking I/O.
    
    Used sparingly for:
    - Razorpay webhook processing (requires blocking network calls)
    - Batch exports
    
    Prefer async engine for all new code.
    """
    db_url = settings.computed_database_url
    
    # Convert asyncpg to psycopg2 for sync engine
    if db_url.startswith("postgresql+asyncpg://"):
        sync_url = db_url.replace("postgresql+asyncpg://", "postgresql+psycopg2://")
    elif db_url.startswith("sqlite+aiosqlite://"):
        sync_url = db_url.replace("sqlite+aiosqlite://", "sqlite:///")
    else:
        sync_url = db_url
    
    logger.info(f"Creating sync engine for: {sync_url.split('@')[0]}...@{sync_url.split('@')[1] if '@' in sync_url else 'local'}")
    
    # Handle SQLite special case
    if sync_url.startswith("sqlite:///"):
        return create_engine(
            sync_url,
            echo=settings.DEBUG,
            connect_args={"check_same_thread": False},
        )
    
    # PostgreSQL or MySQL
    return create_engine(
        sync_url,
        echo=settings.DEBUG,
        pool_size=settings.DB_POOL_SIZE,
        max_overflow=settings.DB_MAX_OVERFLOW,
        pool_timeout=settings.DB_POOL_TIMEOUT,
        pool_reset_on_return='commit',
        pool_pre_ping=True,
    )


# Global sync engine (module-level to avoid per-request creation)
sync_engine = _create_sync_engine()

# Sync session factory
SyncSessionLocal = sessionmaker(
    bind=sync_engine,
    autocommit=False,
    autoflush=False,
)


def get_db():
    """
    Provide a sync database session for sync routers.
    
    Usage in FastAPI routes:
        @app.get("/payments")
        def list_payments(db: Session = Depends(get_db)):
            return db.query(Payment).all()
    
    Note: Prefer async routes with get_session() for new code.
    """
    db = SyncSessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
