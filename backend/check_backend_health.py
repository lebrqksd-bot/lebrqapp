"""
Quick script to check if backend APIs are responding
"""
import asyncio
import aiohttp
import sys

async def check_health():
    """Check if backend is responding"""
    try:
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=5)) as session:
            async with session.get(https://taxtower.in:8002/api'
/health') as resp:
                if resp.status == 200:
                    data = await resp.json()
                    print(f"✅ Backend is healthy: {data}")
                    return True
                else:
                    print(f"❌ Backend returned status {resp.status}")
                    return False
    except asyncio.TimeoutError:
        print("❌ Backend request timed out - server may be hung")
        return False
    except Exception as e:
        print(f"❌ Error connecting to backend: {e}")
        return False

if __name__ == "__main__":
    result = asyncio.run(check_health())
    sys.exit(0 if result else 1)

