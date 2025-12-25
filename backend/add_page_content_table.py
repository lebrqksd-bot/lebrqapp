"""One-off script to create page_content table if not using Alembic migration yet.
Run:
    python add_page_content_table.py
Make sure DB_URL is set or falls back to MySQL settings.
"""
from app.core import settings
from sqlalchemy import text
import asyncio
from app.db import async_engine

DDL = """
CREATE TABLE IF NOT EXISTS page_content (
    id INT AUTO_INCREMENT PRIMARY KEY,
    slug VARCHAR(120) NOT NULL UNIQUE,
    title VARCHAR(255) NULL,
    body_html TEXT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
"""

async def main():
    async with async_engine.begin() as conn:
        await conn.execute(text(DDL))
        print("page_content table ensured")

if __name__ == '__main__':
    asyncio.run(main())
