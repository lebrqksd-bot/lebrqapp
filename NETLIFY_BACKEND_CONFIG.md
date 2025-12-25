# Backend Configuration for Netlify Frontend

## Overview

Your backend must be configured to accept requests from your Netlify frontend. This guide shows how to update your FastAPI backend for Netlify deployment.

## 1. Update CORS Configuration

### In Backend `.env` File

**File:** `backend/.env`

```bash
# ============================================================================
# Frontend URL (for redirects, notifications, etc.)
# ============================================================================
# Update this to your Netlify domain
FRONTEND_URL=https://your-site.netlify.app

# ============================================================================
# CORS Origins (Allowed frontend domains)
# ============================================================================
# Update this to include your Netlify domain and custom domains
CORS_ORIGINS=https://your-site.netlify.app,https://lebrq.com,https://www.lebrq.com

# For development, you can add localhost (but remove in production)
# CORS_ORIGINS=http://localhost:19006,https://your-site.netlify.app,https://lebrq.com
```

### In Cloud Run Environment Variables

If backend is deployed on Cloud Run, set via UI or CLI:

```bash
# Via gcloud CLI
gcloud run services update lebrq-api \
  --set-env-vars="FRONTEND_URL=https://your-site.netlify.app,CORS_ORIGINS=https://your-site.netlify.app,https://lebrq.com" \
  --region=us-central1 \
  --project=your-project-id
```

Or in Cloud Run UI:
1. Go to Cloud Run dashboard
2. Select your service
3. Click "Edit & Deploy New Revision"
4. Set environment variables
5. Deploy

## 2. Verify CORS Headers

### Test CORS Configuration

```bash
# Test from Netlify domain
curl -H "Origin: https://your-site.netlify.app" \
     -H "Access-Control-Request-Method: GET" \
     -i https://your-api.run.app/api/health

# Should return header:
# Access-Control-Allow-Origin: https://your-site.netlify.app
```

### From Browser Console

```javascript
// Test API call from browser
fetch('https://your-api.run.app/api/health', {
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json'
  }
})
  .then(r => r.json())
  .then(console.log)
  .catch(e => {
    console.error('CORS Error:', e);
    console.error('Check backend CORS_ORIGINS setting');
  });
```

## 3. Backend Settings in Detail

### How CORS Works

**Request Flow:**
```
Browser (https://your-site.netlify.app)
    ↓
Makes API call to https://your-api.run.app/api/items
    ↓
Browser checks: Is origin in CORS_ORIGINS?
    ↓
If YES: Request continues → Backend processes
If NO:  Browser blocks → CORS error in console
```

### Settings Location

**FastAPI Settings:** `backend/app/settings.py`

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # ============================================================================
    # Frontend Configuration
    # ============================================================================
    
    # Frontend domain (used for redirects, email links, etc.)
    FRONTEND_URL: str = os.getenv('FRONTEND_URL', 'http://localhost:19006')
    
    # ============================================================================
    # CORS (Cross-Origin Resource Sharing)
    # ============================================================================
    # Comma-separated list of allowed frontend domains
    # Example: "https://lebrq.com,https://www.lebrq.com,https://your-site.netlify.app"
    
    CORS_ORIGINS: list[str] = [
        origin.strip() 
        for origin in os.getenv('CORS_ORIGINS', 'http://localhost:19006').split(',')
    ]
    
    class Config:
        env_file = '.env'
```

### Using Settings in Core

**File:** `backend/app/core.py`

```python
from fastapi.middleware.cors import CORSMiddleware
from app.settings import settings

# Configure CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## 4. Common CORS Issues & Solutions

### Issue: "Access to XMLHttpRequest blocked by CORS policy"

**Cause:** Netlify domain not in `CORS_ORIGINS`

**Solution:**
```bash
# Update CORS_ORIGINS in backend/.env
CORS_ORIGINS=https://your-site.netlify.app
```

### Issue: Preflight request fails (OPTIONS 403)

**Cause:** CORS not properly configured on backend

**Solution:**
```python
# Ensure CORSMiddleware is added BEFORE other routes
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Then add other middleware and routes
```

### Issue: Works locally, fails on production

**Cause:** Different domains have different CORS rules

**Solution:**
```python
# Use environment variable with multiple domains
CORS_ORIGINS=https://your-site.netlify.app,https://lebrq.com,https://www.lebrq.com
```

## 5. Environment-Specific Configuration

### Development (Local)

**`backend/.env` (local development):**
```bash
FRONTEND_URL=http://localhost:19006
CORS_ORIGINS=http://localhost:19006,http://localhost:3000,http://127.0.0.1:19006
```

### Staging

**Cloud Run environment variables:**
```bash
FRONTEND_URL=https://staging.lebrq.com
CORS_ORIGINS=https://staging.lebrq.com,https://staging-app.netlify.app
```

### Production

**Cloud Run environment variables:**
```bash
FRONTEND_URL=https://lebrq.com
CORS_ORIGINS=https://lebrq.com,https://www.lebrq.com,https://your-site.netlify.app
```

## 6. Additional Backend Configuration

### Email Links & Redirects

If backend sends emails with links, use `FRONTEND_URL`:

```python
# In backend service
from app.settings import settings

reset_link = f"{settings.FRONTEND_URL}/reset-password?token={token}"
email_body = f"Click here to reset: {reset_link}"
```

### API Response Headers

Add security headers:

```python
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    return response
```

### Rate Limiting (Optional)

Add rate limiting to protect backend:

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

@app.get("/api/items")
@limiter.limit("100/minute")
async def get_items(request: Request):
    return items
```

## 7. Deployment Checklist

### Before Deploying Backend

- [ ] `FRONTEND_URL` matches Netlify domain
- [ ] `CORS_ORIGINS` includes all frontend domains
- [ ] Tested CORS locally
- [ ] Security headers configured
- [ ] Rate limiting configured (optional)
- [ ] Email links use `FRONTEND_URL`
- [ ] Logging configured

### Deploy Steps

```bash
# Update backend/.env with production values
FRONTEND_URL=https://your-site.netlify.app
CORS_ORIGINS=https://your-site.netlify.app,https://lebrq.com

# Build and push to Cloud Run
gcloud run deploy lebrq-api \
  --source . \
  --region=us-central1 \
  --set-env-vars="FRONTEND_URL=https://your-site.netlify.app,CORS_ORIGINS=https://your-site.netlify.app,https://lebrq.com" \
  --project=your-project-id
```

## 8. Testing Backend for Netlify

### Test Health Endpoint

```bash
curl -i https://your-api.run.app/api/health
```

Expected response:
```
HTTP/1.1 200 OK
Access-Control-Allow-Origin: https://your-site.netlify.app
Content-Type: application/json

{"status": "ok"}
```

### Test API Endpoint with Auth

```bash
curl -i \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Origin: https://your-site.netlify.app" \
  https://your-api.run.app/api/items
```

Expected response:
```
HTTP/1.1 200 OK
Access-Control-Allow-Origin: https://your-site.netlify.app
Access-Control-Allow-Credentials: true
Content-Type: application/json

[...]
```

### Test from Browser Console

```javascript
// Get auth token from localStorage/AsyncStorage
const token = localStorage.getItem('auth.token');

// Make request
fetch('https://your-api.run.app/api/items', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
})
  .then(r => {
    console.log('Status:', r.status);
    console.log('CORS Header:', r.headers.get('Access-Control-Allow-Origin'));
    return r.json();
  })
  .then(data => console.log('Data:', data))
  .catch(err => console.error('Error:', err));
```

## 9. Troubleshooting Backend

### Check Current Configuration

**API endpoint for testing:**
```bash
curl https://your-api.run.app/env-test
```

Returns (without secrets):
```json
{
  "environment": "production",
  "frontend_url": "https://your-site.netlify.app",
  "cors_origins": ["https://your-site.netlify.app", "https://lebrq.com"],
  "api_version": "1.0.0"
}
```

### View Backend Logs

**Cloud Run:**
```bash
gcloud run logs read lebrq-api --region=us-central1 --limit=50
```

**Look for:**
- CORS configuration loaded
- Requests from Netlify domain
- API health checks
- Any errors or warnings

## 10. Summary

**Required Backend Changes:**

1. **Update `.env`:**
   ```bash
   FRONTEND_URL=https://your-site.netlify.app
   CORS_ORIGINS=https://your-site.netlify.app,https://lebrq.com
   ```

2. **Deploy to Cloud Run** with new environment variables

3. **Test CORS:**
   ```bash
   curl -H "Origin: https://your-site.netlify.app" \
        https://your-api.run.app/api/health
   ```

4. **Verify:**
   - Response header includes `Access-Control-Allow-Origin`
   - Frontend can make API calls
   - No CORS errors in browser console

## Next Steps

1. ✅ Update backend `.env` with Netlify domain
2. ✅ Deploy backend to Cloud Run
3. ✅ Test CORS from curl
4. ✅ Deploy frontend to Netlify
5. ✅ Test API calls from browser
6. ✅ Monitor logs for issues

## References

- [FastAPI CORS Docs](https://fastapi.tiangolo.com/tutorial/cors/)
- [MDN CORS Guide](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [Pydantic Settings](https://docs.pydantic.dev/latest/concepts/pydantic_settings/)
- [Cloud Run Env Vars](https://cloud.google.com/run/docs/configuring/environment-variables)
