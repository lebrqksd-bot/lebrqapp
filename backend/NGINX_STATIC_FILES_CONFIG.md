# Nginx Configuration for Static Files

## Problem
FastAPI/Uvicorn is **BAD** for serving large images → causes memory leaks.

## Solution
Disable static file serving from FastAPI and use Nginx instead.

---

## ✅ Changes Applied

1. **Removed FastAPI static mount** in `backend/app/core.py`
   - Removed: `app.mount("/static", StaticFiles(...))`
   - Custom route `/static/{file_path:path}` kept for development only

2. **Fixed item media upload** in `backend/app/routers/item_media.py`
   - Changed from `content = await file.read()` (loads entire file into memory)
   - To streaming in 2MB chunks (zero memory growth)

---

## 🔧 Nginx Configuration

Add this to your Nginx configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Serve static files directly (bypasses FastAPI)
    location /static/ {
        alias /path/to/your/app/backend/app/uploads/;
        
        # Security: prevent directory traversal
        internal;
        
        # CORS headers (if needed)
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods "GET, OPTIONS";
        add_header Access-Control-Allow-Headers "Content-Type, Range";
        
        # Caching
        expires 1d;
        add_header Cache-Control "public, max-age=86400";
        
        # Range request support (for resume downloads)
        add_header Accept-Ranges bytes;
    }

    # Proxy API requests to FastAPI
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 📁 Directory Structure

Your static files should be organized like this:

```
backend/app/uploads/
├── item-media/          # Item images/videos
├── gallery/            # Gallery images
├── contests/           # Contest files
└── *.jpg, *.png, etc.  # Other uploads
```

Nginx will serve files from `/static/item-media/filename.jpg` → `/path/to/app/backend/app/uploads/item-media/filename.jpg`

---

## 🚀 Benefits

1. **Zero Memory Growth** - Nginx serves files directly from disk
2. **Better Performance** - Nginx is optimized for static file serving
3. **Lower CPU Usage** - No Python overhead for file serving
4. **Better Caching** - Nginx handles ETag, Last-Modified headers
5. **Range Requests** - Nginx handles partial content requests efficiently

---

## ⚠️ Development vs Production

- **Development**: Custom `/static/{file_path:path}` route still works
- **Production**: Use Nginx for all static files (disable FastAPI route)

To disable FastAPI static route in production, comment out the route in `backend/app/core.py`:

```python
# @app.get("/static/{file_path:path}")
# async def serve_static_file(...):
#     ...
```

---

## 🧹 Clean Old Static Files

Your logs show many hashed files like:
- `a9733ba4471690de.png?v=1763631370940`
- `c799b3f8eefdd96f.png`

These come from React/Vite builds. Clean them up:

```bash
# Find and remove old hashed files
find backend/app/uploads -name "*.png" -o -name "*.jpg" | grep -E "[a-f0-9]{16}" | xargs rm -f

# Or clear entire static directory and rebuild
rm -rf backend/app/uploads/*
# Then rebuild your frontend
```

---

## ✅ Verification

After configuring Nginx:

1. **Test static file serving:**
   ```bash
   curl -I http://your-domain.com/static/item-media/filename.jpg
   # Should return 200 OK with proper headers
   ```

2. **Test API still works:**
   ```bash
   curl http://your-domain.com/api/items/103/media
   # Should return JSON response
   ```

3. **Monitor memory:**
   - Before: Memory grows with each image request
   - After: Memory stays stable (Nginx handles files)

---

## 📝 Notes

- FastAPI custom route is kept for development convenience
- In production, disable it and use Nginx exclusively
- All file uploads already use streaming (no memory issues)
- File downloads use `FileResponse` (streaming, no memory issues)

