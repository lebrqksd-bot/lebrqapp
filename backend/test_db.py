import asyncio

from app.core import settings
from app.db import init_db

async def main():
    print("Using DATABASE_URL:", settings.DATABASE_URL)
    try:
        await init_db()
        print("Success: connected and ensured tables (if DB exists and credentials are correct).")
    except Exception as e:
        print("Connection failed:", repr(e))

if __name__ == '__main__':
    asyncio.run(main())
