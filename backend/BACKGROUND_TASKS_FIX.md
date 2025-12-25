# Background Tasks Event Loop Fix

## Problem

Multiple instances in `admin_bookings.py` create new event loops in threads:
```python
loop = asyncio.new_event_loop()
asyncio.set_event_loop(loop)
try:
    loop.run_until_complete(...)
finally:
    loop.close()
```

**This is dangerous and causes memory leaks:**
- Event loops may not be properly closed
- Multiple event loops can cause resource exhaustion
- Can lead to hanging threads and memory leaks

## Solution

Use `asyncio.run()` or the utility helper function:
```python
from app.utils.async_thread_helper import run_async_in_thread

async def send_email():
    await NotificationService.send_vendor_invitation_email(...)

run_async_in_thread(send_email)
```

## Instances to Fix

Found 8 instances in `admin_bookings.py`:
1. Line ~245: WhatsApp notification
2. Line ~925: Booking item email
3. Line ~1191: Vendor invite email (create vendor)
4. Line ~1267: Vendor invite email (invite vendor)
5. Line ~1609: Broker invite email (create broker)
6. Line ~1685: Broker invite email (invite broker)
7. Line ~2200: WhatsApp notification (assign vendor)
8. Line ~2411: Booking approval notifications (complex)

## Fix Pattern

Replace:
```python
loop = asyncio.new_event_loop()
asyncio.set_event_loop(loop)
try:
    loop.run_until_complete(asyncio.wait_for(send_email(), timeout=10.0))
except asyncio.TimeoutError:
    print("Timeout")
finally:
    loop.close()
```

With:
```python
from app.utils.async_thread_helper import run_async_in_thread
import asyncio

async def send_email():
    try:
        await asyncio.wait_for(
            NotificationService.send_vendor_invitation_email(...),
            timeout=10.0
        )
    except asyncio.TimeoutError:
        print("Timeout")
    except Exception as e:
        print(f"Error: {e}")

run_async_in_thread(send_email)
```

## Status

- ✅ Utility function created: `app/utils/async_thread_helper.py`
- ✅ One instance fixed (vendor invite email)
- ⚠️ 7 more instances need fixing (see list above)

## Next Steps

1. Apply the same fix pattern to all 7 remaining instances
2. Test to ensure notifications still work
3. Monitor memory usage to confirm leaks are fixed

