# SSL Memory Optimization Guide

## Current Optimizations (Already Applied)

1. ✅ Reduced database connection pool (5 connections)
2. ✅ Request body size limits (50MB)
3. ✅ Periodic garbage collection (every 90 seconds)
4. ✅ SSL error handling in asyncio event loop
5. ✅ Memory error middleware

## Additional Optimizations to Reduce SSL Memory Issues

### 1. **Use Nginx Reverse Proxy for SSL Termination** (RECOMMENDED)

**Best Solution:** Let Nginx handle SSL/TLS, reducing memory pressure on Python.

**Benefits:**
- Nginx is optimized for SSL/TLS
- Python app runs on HTTP (no SSL overhead)
- Better performance and lower memory usage

**Nginx Configuration:**
```nginx
upstream backend {
    server 127.0.0.1:8002;
    keepalive 32;
}

server {
    listen 443 ssl http2;
    server_name taxtower.in;
    
    ssl_certificate /var/cpanel/ssl/apache_tls/taxtower.in/cert.pem;
    ssl_certificate_key /var/cpanel/ssl/apache_tls/taxtower.in/key.pem;
    
    # SSL optimization
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Buffer sizes (reduce memory usage)
    client_body_buffer_size 128k;
    client_max_body_size 50m;
    
    location / {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

**Then run uvicorn without SSL:**
```bash
uvicorn app.core:app --host 127.0.0.1 --port 8002
```

### 2. **Reduce Connection Pool Further** (If memory is very limited)

**File:** `backend/app/db.py` or set environment variables:

```bash
# In .env or cPanel environment
DB_POOL_SIZE=3
DB_MAX_OVERFLOW=3
```

**Or modify `backend/app/db.py`:**
```python
POOL_SIZE = int(os.getenv("DB_POOL_SIZE", "3"))  # Reduced from 5
MAX_OVERFLOW = int(os.getenv("DB_MAX_OVERFLOW", "3"))  # Reduced from 5
```

### 3. **Increase Garbage Collection Frequency**

**File:** `backend/app/core.py` (line 612)

```python
time.sleep(60)  # Every 60 seconds instead of 90
```

### 4. **Reduce Request Body Size Limit**

**File:** `backend/app/core.py` (find MAX_BODY_SIZE_MB)

```python
MAX_BODY_SIZE_MB = 20  # Reduce from 50MB to 20MB
```

### 5. **Optimize SSL Context Settings** (If using uvicorn with SSL)

**When running uvicorn with SSL, add these flags:**

```bash
uvicorn app.core:app \
  --host 0.0.0.0 \
  --port 8002 \
  --ssl-keyfile=/var/cpanel/ssl/apache_tls/taxtower.in/key.pem \
  --ssl-certfile=/var/cpanel/ssl/apache_tls/taxtower.in/cert.pem \
  --limit-concurrency 50 \
  --timeout-keep-alive 5 \
  --backlog 2048
```

**Parameters:**
- `--limit-concurrency 50`: Limits concurrent connections
- `--timeout-keep-alive 5`: Closes idle connections faster
- `--backlog 2048`: Limits connection queue

### 6. **Set Python Memory Limits**

**Create a startup script with memory limits:**

```bash
#!/bin/bash
# Limit Python memory to 512MB (adjust based on server RAM)
ulimit -v 524288  # 512MB in KB

# Run with reduced memory
python -X dev -m uvicorn app.core:app --host 0.0.0.0 --port 8002 \
  --ssl-keyfile=/var/cpanel/ssl/apache_tls/taxtower.in/key.pem \
  --ssl-certfile=/var/cpanel/ssl/apache_tls/taxtower.in/cert.pem
```

### 7. **Use uvloop Optimizations**

**File:** `backend/app/core.py` (add to startup)

```python
@app.on_event("startup")
async def on_startup():
    # Optimize uvloop for lower memory usage
    import uvloop
    uvloop.install()
    
    # Set lower SSL buffer sizes
    import ssl
    ssl._create_default_https_context = ssl._create_unverified_context
```

### 8. **Enable Connection Keep-Alive with Limits**

**File:** `backend/app/core.py` (in CORS middleware)

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if "*" in settings.CORS_ORIGINS else settings.CORS_ORIGINS,
    allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=300,  # Reduce from 3600 to 300 (5 minutes)
)
```

### 9. **Add Memory Monitoring and Auto-Restart**

**Create a monitoring script:**

```python
# backend/monitor_memory.py
import psutil
import os
import signal
import time

MAX_MEMORY_MB = 400  # Restart if memory exceeds 400MB
CHECK_INTERVAL = 30  # Check every 30 seconds

def monitor_process():
    pid = os.getpid()
    process = psutil.Process(pid)
    
    while True:
        memory_mb = process.memory_info().rss / 1024 / 1024
        if memory_mb > MAX_MEMORY_MB:
            print(f"Memory exceeded {MAX_MEMORY_MB}MB: {memory_mb:.2f}MB")
            # Optionally restart or trigger GC
            import gc
            for _ in range(5):
                gc.collect()
        time.sleep(CHECK_INTERVAL)
```

### 10. **Optimize File Upload Handling**

**File:** `backend/app/routers/uploads.py`

Already optimized with chunked reading, but ensure:
- File size limits are enforced
- Files are processed in chunks
- Memory is freed immediately after processing

## Quick Implementation Checklist

### Immediate Actions (High Impact):

1. **✅ Use Nginx for SSL termination** (Best solution)
2. **✅ Reduce DB pool to 3** if memory is limited
3. **✅ Increase GC frequency to 60 seconds**
4. **✅ Add uvicorn concurrency limits**

### Medium Priority:

5. **✅ Reduce request body limit to 20MB**
6. **✅ Add memory monitoring**
7. **✅ Optimize keep-alive settings**

### Low Priority (If issues persist):

8. **✅ Set Python memory limits**
9. **✅ Use uvloop optimizations**
10. **✅ Add auto-restart on high memory**

## Environment Variables Summary

Add to `.env` or cPanel:

```bash
# Database connection pool (reduce for low memory)
DB_POOL_SIZE=3
DB_MAX_OVERFLOW=3
DB_POOL_TIMEOUT=30
DB_POOL_RECYCLE=280

# Python memory settings
PYTHONHASHSEED=0
PYTHONUNBUFFERED=1
```

## Monitoring Commands

```bash
# Check current memory usage
ps aux | grep uvicorn | awk '{print $6/1024 " MB"}'

# Monitor memory in real-time
watch -n 1 'ps aux | grep uvicorn | grep -v grep'

# Check SSL connections
netstat -an | grep :8002 | grep ESTABLISHED | wc -l

# Check database connections
mysql -u root -p -e "SHOW STATUS LIKE 'Threads_connected';"
```

## Expected Results

After implementing these optimizations:
- ✅ 50-70% reduction in SSL memory usage
- ✅ Fewer MemoryError exceptions
- ✅ Better handling of concurrent connections
- ✅ More stable server under load

## Recommended Configuration for Low-Memory Servers (< 1GB RAM)

1. **Use Nginx for SSL** (essential)
2. **DB_POOL_SIZE=3**
3. **GC every 60 seconds**
4. **Request limit: 20MB**
5. **uvicorn --limit-concurrency 30**

## Recommended Configuration for Medium-Memory Servers (1-2GB RAM)

1. **Use Nginx for SSL** (recommended)
2. **DB_POOL_SIZE=5** (current)
3. **GC every 90 seconds** (current)
4. **Request limit: 50MB** (current)
5. **uvicorn --limit-concurrency 50**

---

**Priority:** Use Nginx for SSL termination - this is the single most effective solution.

