#!/usr/bin/env python3
"""
Add catalog columns to items table:
 - category VARCHAR(64) NULL
 - subcategory VARCHAR(64) NULL
 - type VARCHAR(32) NULL          
 - image_url VARCHAR(500) NULL    
 - space_id INT NULL (FK to spaces.id)
 - available BOOLEAN NOT NULL DEFAULT 1
"""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core import settings


async def add_item_catalog_columns():
    url = settings.DATABASE_URL
    print('Using DATABASE_URL:', url)
    engine = create_async_engine(url, echo=True)

    async with engine.begin() as conn:
        stmts = [
            "ALTER TABLE items ADD COLUMN category VARCHAR(64) NULL",
            "ALTER TABLE items ADD COLUMN subcategory VARCHAR(64) NULL",
            "ALTER TABLE items ADD COLUMN type VARCHAR(32) NULL",
            "ALTER TABLE items ADD COLUMN image_url VARCHAR(500) NULL",
            "ALTER TABLE items ADD COLUMN space_id INT NULL",
            "ALTER TABLE items ADD COLUMN available BOOLEAN NOT NULL DEFAULT 1",
            # add FK (best-effort; older MySQL may need index first)
            "ALTER TABLE items ADD CONSTRAINT fk_items_space_id FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE SET NULL",
        ]
        for sql in stmts:
            try:
                await conn.execute(text(sql))
                print(f"✓ {sql}")
            except Exception as e:
                print(f"⚠ Skipped/failed: {sql} -> {e}")


if __name__ == "__main__":
    asyncio.run(add_item_catalog_columns())
#!/usr/bin/env python3
"""
Add catalog classification columns to items table:
 - category VARCHAR(64) NULL
 - subcategory VARCHAR(64) NULL
 - type VARCHAR(32) NULL
 - image_url VARCHAR(500) NULL
 - space_id INT NULL (FK to spaces.id)
 - available BOOLEAN NOT NULL DEFAULT 1
"""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core import settings


async def add_item_catalog_columns():
    url = settings.DATABASE_URL
    print('Using DATABASE_URL:', url)
    engine = create_async_engine(url, echo=True)

    async with engine.begin() as conn:
        stmts = [
            "ALTER TABLE items ADD COLUMN category VARCHAR(64) NULL",
            "ALTER TABLE items ADD COLUMN subcategory VARCHAR(64) NULL",
            "ALTER TABLE items ADD COLUMN type VARCHAR(32) NULL",
            "ALTER TABLE items ADD COLUMN image_url VARCHAR(500) NULL",
            "ALTER TABLE items ADD COLUMN space_id INT NULL",
            "ALTER TABLE items ADD COLUMN available BOOLEAN NOT NULL DEFAULT 1",
        ]
        for sql in stmts:
            try:
                await conn.execute(text(sql))
                print(f"✓ {sql}")
            except Exception as e:
                print(f"⚠ Skipped/failed: {sql} -> {e}")

        # Add FK constraint for space_id if not present (ignore failures)
        try:
            await conn.execute(text("ALTER TABLE items ADD CONSTRAINT fk_items_space_id FOREIGN KEY (space_id) REFERENCES spaces(id)"))
            print("✓ Added FK fk_items_space_id")
        except Exception as e:
            print(f"⚠ FK add skipped: {e}")


if __name__ == "__main__":
    asyncio.run(add_item_catalog_columns())
