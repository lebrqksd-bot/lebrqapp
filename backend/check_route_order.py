#!/usr/bin/env python3
"""Check route order in bookings router"""

from app.routers import bookings

# Show routes related to /bookings/
print("Bookings routes in order:")
for i, route in enumerate(bookings.router.routes):
    path = getattr(route, 'path', None)
    if path and '/bookings' in path:
        methods = getattr(route, 'methods', set())
        print(f"{i:2d}: {path:40} {methods}")

# Find positions of key routes
print("\n" + "="*60)
print("Key route positions:")
for path in ['/bookings/today', '/bookings/series', '/bookings/cancelled', '/bookings/{booking_id}']:
    for i, route in enumerate(bookings.router.routes):
        if getattr(route, 'path', None) == path:
            print(f"  {path:30} -> Position {i}")
            break
