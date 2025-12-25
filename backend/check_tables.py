import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core import settings

async def main():
    url = settings.DATABASE_URL
    print('Using DATABASE_URL:', url)
    engine = create_async_engine(url, echo=False)
    async with engine.begin() as conn:
        rs = await conn.execute(text("SHOW TABLES;"))
        rows = rs.fetchall()
        print('Tables:')
        for r in rows:
            print(' -', r[0])

if __name__ == '__main__':
    asyncio.run(main())
