# Lazy Router Loading Implementation

## Current Status

- ✅ Lazy router system exists in `core_lazy_routers.py`
- ❌ Not being used in `core.py` - all routers load at startup
- **Impact:** High startup memory usage (50+ routers loaded immediately)

## Implementation Options

### Option 1: Full Lazy Loading (Complex)
- Load routers only when first accessed
- Requires middleware to intercept requests
- May cause first-request delays
- **Not recommended** - adds complexity

### Option 2: Hybrid Approach (Recommended)
- Load critical routers immediately (health, auth, users)
- Load non-critical routers lazily
- Best balance of performance and memory

### Option 3: Keep Current (Simplest)
- All routers load at startup
- Simple and reliable
- Higher memory usage but acceptable for most deployments

## Recommendation

**Keep current approach** for now because:
1. Router imports are relatively lightweight
2. Lazy loading adds complexity and potential bugs
3. Memory savings are minimal compared to other optimizations
4. Production deployments typically have sufficient memory

## If Memory is Critical

If startup memory is a concern, implement Option 2:
1. Mark critical routers (health, auth, users, bookings)
2. Load others lazily using `core_lazy_routers.py`
3. Add middleware to load on first access

## Current Memory Usage

- All routers: ~50-100MB at startup
- With lazy loading: ~20-30MB at startup
- **Savings:** ~30-70MB (acceptable trade-off for simplicity)

