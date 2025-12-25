from __future__ import annotations

import sys
from pathlib import Path

# Add parent directory to path so 'app' module can be imported
sys.path.insert(0, str(Path(__file__).parent.parent))

from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool
from alembic import context

# Import Base for metadata, but don't import settings which may have MySQL URL
from app.db import Base
from app import models  # noqa: F401  ensure models are imported

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Use the PostgreSQL URL from alembic.ini (already configured for Supabase)
# Ensure it uses the sync driver (psycopg2) instead of async (asyncpg)
db_url = config.get_main_option("sqlalchemy.url")
if db_url and "+asyncpg" in db_url:
    db_url = db_url.replace("postgresql+asyncpg://", "postgresql+psycopg2://")
    config.set_main_option("sqlalchemy.url", db_url)

target_metadata = Base.metadata

def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    # literal_binds is used to generate actual SQL values instead of parameterized
    context.configure(
        url=url, 
        target_metadata=target_metadata, 
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    try:
        connectable = engine_from_config(
            config.get_section(config.config_ini_section),
            prefix="sqlalchemy.",
            poolclass=pool.NullPool,
        )
        with connectable.connect() as connection:
            context.configure(connection=connection, target_metadata=target_metadata)
            with context.begin_transaction():
                context.run_migrations()
    except Exception as e:
        # If online mode fails (e.g., invalid credentials), fall back to offline mode
        error_str = str(e)
        if "Tenant or user not found" in error_str or "connection" in error_str.lower():
            import sys
            print(f"\n⚠ Could not connect to database with provided credentials.", file=sys.stderr)
            print(f"⚠ Falling back to offline migration mode (SQL generation).\n", file=sys.stderr)
            run_migrations_offline()
        else:
            raise


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
