# FastAPI Memory Optimization - Deployment Guide

## 🎯 Summary of Changes

All critical memory optimizations have been completed:

1. ✅ **Upload Streaming**: All upload endpoints now stream files to disk in chunks
2. ✅ **PDF Streaming**: All PDF generation streams from temporary files
3. ✅ **MySQL Pool**: Reduced pool size from 3+3 to 2+2 (33% reduction)
4. ✅ **Range Headers**: File downloads support partial content and ETag caching

## 📦 Installation

### 1. Install New Dependencies

```bash
cd backend
pip install -r requirements.txt
# This will install psutil>=5.9.0 (already added)
```

### 2. No Database Migrations Required

All changes are code-only. No database schema changes needed.

### 3. Restart Server

```bash
# Stop current server
pkill -f uvicorn

# Start with optimized settings
cd /home/taxtower/lebrq_api
source myenv/bin/activate
uvicorn app.core:app \
  --host 0.0.0.0 \
  --port 8002 \
  --ssl-keyfile=/var/cpanel/ssl/apache_tls/taxtower.in/key.pem \
  --ssl-certfile=/var/cpanel/ssl/apache_tls/taxtower.in/cert.pem \
  --limit-concurrency 30 \
  --timeout-keep-alive 5 \
  --backlog 1024 \
  --workers 1
```

## ✅ Verification

### Check Memory Protection

```bash
# Check if middleware is loaded (should see in logs)
tail -f /path/to/uvicorn.log | grep "Memory protection"

# Monitor memory usage
watch -n 1 'ps aux | grep uvicorn | awk "{print \$6/1024 \"MB\"}"'
```

### Test Upload Streaming

```bash
# Test large file upload (should not cause memory spike)
curl -X POST -F "file=@large_image.jpg" \
  -H "Authorization: Bearer $TOKEN" \
  https://taxtower.in:8002/api/uploads/image

# Monitor memory during upload
```

### Test PDF Streaming

```bash
# Test invoice download (should stream, not load into memory)
curl -H "Authorization: Bearer $TOKEN" \
  https://taxtower.in:8002/api/bookings/123/invoice \
  --output invoice.pdf
```

### Test Range Requests

```bash
# Test partial download
curl -H "Range: bytes=0-1048575" \
  -I https://taxtower.in:8002/api/uploads/large_file.mp4

# Should return: HTTP/1.1 206 Partial Content
# With headers: Content-Range, Accept-Ranges, ETag
```

## 📊 Expected Memory Improvements

| Operation | Before | After | Reduction |
|-----------|--------|-------|-----------|
| Upload 10MB | 10MB | 1-2MB | 80-90% |
| Upload 100MB | 100MB | 2MB | 98% |
| PDF 5MB | 5MB | 64KB | 99% |
| PDF 20MB | 20MB | 64KB | 99.7% |
| DB Pool | 30MB | 20MB | 33% |

## 🔍 Monitoring

### Memory Usage Endpoint

Add to `backend/app/routers/health.py`:

```python
@router.get("/memory")
async def get_memory_stats():
    """Get current memory usage statistics."""
    try:
        import psutil
        mem = psutil.virtual_memory()
        return {
            "total_gb": mem.total / (1024 ** 3),
            "available_gb": mem.available / (1024 ** 3),
            "used_percent": mem.percent,
            "used_gb": mem.used / (1024 ** 3),
            "threshold_percent": 85.0,
            "status": "ok" if mem.percent < 85 else "warning" if mem.percent < 90 else "critical"
        }
    except ImportError:
        return {"error": "psutil not installed"}
```

### Log Monitoring

Watch for these log messages:

```
[Memory Protection] Rejecting POST /api/... - Memory usage: 87.3%
[Memory Protection] Collected 1234 objects after MemoryError
[GC] Collected 567 objects
```

## 🚨 Rollback Plan

If issues occur:

1. **Disable memory protection** (temporary):
   ```python
   # In core.py, comment out:
   # app.middleware("http")(memory_protection_middleware)
   ```

2. **Restore old pool settings**:
   ```python
   # In db.py:
   POOL_SIZE = 3
   MAX_OVERFLOW = 3
   ```

3. **Revert upload endpoints** (if needed):
   - Restore `content = await file.read()` pattern
   - Remove chunked streaming

## 📝 Notes

- All changes are backward compatible
- No breaking API changes
- Frontend doesn't need updates (but can benefit from range support)
- Temporary files are automatically cleaned up
- No disk space leaks

## 🎉 Success Criteria

After 7 days:
- [ ] Zero MemoryError crashes
- [ ] Average memory < 400MB
- [ ] 99.9% request success rate
- [ ] Response times < 2s (95th percentile)
- [ ] No 503 errors due to memory

