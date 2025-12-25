# Memory Error SSL Fix - Production Deployment

## Problem
The server is experiencing `MemoryError` in the SSL protocol layer (`uvloop.loop.SSLProtocol`), causing fatal errors and connection failures.

## Root Causes
1. **SSL Buffer Memory**: SSL/TLS connections require additional memory for encryption buffers
2. **Connection Pool Size**: Too many concurrent database connections with SSL overhead
3. **Large Request Bodies**: File uploads and large payloads consuming memory
4. **Memory Accumulation**: Garbage collection not frequent enough
5. **No Request Size Limits**: Unlimited request body sizes can exhaust memory

## Fixes Applied

### ✅ 1. Reduced Database Connection Pool Size
**File:** `backend/app/db.py`

**Change:**
- `POOL_SIZE`: 10 → 8
- `MAX_OVERFLOW`: 10 → 8

**Reason:** SSL connections consume more memory. Reducing pool size prevents memory exhaustion while still handling concurrent requests.

### ✅ 2. Added Request Body Size Limit
**File:** `backend/app/core.py`

**Change:** Added middleware to check `Content-Length` header and reject requests larger than 50MB.

**Code:**
```python
MAX_BODY_SIZE_MB = 50  # 50MB limit
if size_mb > MAX_BODY_SIZE_MB:
    return JSONResponse(status_code=413, ...)
```

**Reason:** Prevents large file uploads or payloads from consuming all available memory.

### ✅ 3. Enhanced Garbage Collection
**File:** `backend/app/core.py`

**Changes:**
- Frequency: 3 minutes → 2 minutes
- Runs `gc.collect()` twice for aggressive cleanup
- Added memory usage monitoring (if `psutil` available)
- Logs memory usage and warnings when high

**Reason:** More frequent GC prevents memory accumulation, especially important with SSL connections.

### ✅ 4. Improved Memory Error Handling
**File:** `backend/app/core.py`

**Changes:**
- Better logging of memory errors
- Returns 503 (Service Unavailable) instead of 500
- Adds `Retry-After` header
- Runs GC twice on memory error

**Reason:** Better user experience and faster recovery from memory pressure.

## Configuration

### Environment Variables (Optional)
You can adjust these in your `.env` file or cPanel:

```bash
# Database connection pool (reduce if memory issues persist)
DB_POOL_SIZE=6          # Further reduce for low-memory servers
DB_MAX_OVERFLOW=6      # Match pool size

# For high-memory servers, you can increase:
DB_POOL_SIZE=12
DB_MAX_OVERFLOW=12
```

### Server Requirements
- **Minimum RAM**: 512MB (with reduced pool size)
- **Recommended RAM**: 1GB+ for production
- **SSL/TLS**: Enabled (required for HTTPS)

## Monitoring

### Check Memory Usage
```bash
# Monitor Python process memory
ps aux | grep python | grep uvicorn

# Check server memory
free -h

# Monitor memory in real-time
watch -n 1 'ps aux | grep python | grep -v grep'
```

### Check Logs for Memory Warnings
Look for these log messages:
```
[GC] High memory usage detected: XXX MB
[Memory Error] MemoryError in middleware: ...
[Request Size] Request body too large: XX.XMB
```

### Monitor Connection Pool
```sql
-- Check current MySQL connections
SHOW PROCESSLIST;

-- Check connection count
SHOW STATUS LIKE 'Threads_connected';
```

## Additional Optimizations (If Issues Persist)

### 1. Further Reduce Pool Size
If memory errors continue, reduce pool size further:
```bash
DB_POOL_SIZE=5
DB_MAX_OVERFLOW=5
```

### 2. Enable Connection Pooling at MySQL Level
```sql
SET GLOBAL max_connections = 50;  # Limit total connections
```

### 3. Use Nginx Reverse Proxy
Nginx can handle SSL termination, reducing memory pressure on Python:
```nginx
# Nginx handles SSL, forwards to Python on HTTP
upstream backend {
    server 127.0.0.1:8000;
}

server {
    listen 443 ssl;
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://backend;
    }
}
```

### 4. Increase Server Memory
If possible, upgrade server RAM to 2GB+ for better performance.

### 5. Use Multiple Workers (if memory allows)
```bash
# Only if server has 2GB+ RAM
uvicorn app.core:app --workers 2 --host 0.0.0.0 --port 8002
```

## Expected Results

After these fixes:
- ✅ No more MemoryError in SSL protocol handlers
- ✅ Better handling of large file uploads
- ✅ More frequent memory cleanup
- ✅ Better error messages for memory issues
- ✅ Reduced memory footprint from connection pool

## Files Modified

1. `backend/app/core.py`
   - Added request body size limit middleware
   - Enhanced garbage collection with memory monitoring
   - Improved memory error handling

2. `backend/app/db.py`
   - Reduced connection pool size (8 instead of 10)

## Testing

### Test Request Size Limit
```bash
# Should return 413 error
curl -X POST https://taxtower.in:8002/api/uploads/image \
  -H "Content-Type: multipart/form-data" \
  -F "file=@large_file_60mb.jpg"
```

### Test Memory Recovery
1. Send multiple concurrent requests
2. Monitor logs for GC messages
3. Verify no MemoryError occurs

## Support

If MemoryError persists after these fixes:
1. Check server RAM: `free -h`
2. Check Python memory: `ps aux | grep python`
3. Review logs for memory warnings
4. Consider reducing pool size further
5. Consider using Nginx for SSL termination

---

**Last Updated:** 2025-01-XX
**Status:** ✅ All SSL memory fixes applied

