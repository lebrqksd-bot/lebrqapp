# Netlify Environment Configuration Checklist

## Quick Setup (5 minutes)

### 1. Get Your Backend API URL

From your Cloud Run deployment:
```bash
# Cloud Run service URL looks like:
# https://lebrq-api-abc123xyz.run.app

# Your API endpoint is:
# https://lebrq-api-abc123xyz.run.app/api
```

### 2. Set Netlify Environment Variables

**Via Netlify UI:**
1. Go to your site dashboard
2. **Site Settings** → **Build & Deploy** → **Environment**
3. Click **Edit variables** (or "Add new variable")
4. Add this variable:

```
EXPO_PUBLIC_API_URL = https://lebrq-api-abc123xyz.run.app/api
```

**Important:**
- No quotes around the URL
- Must be HTTPS
- Include `/api` at the end
- No trailing slash

### 3. Trigger Deploy

Any of these will redeploy with new variables:
```bash
netlify deploy --prod
```

Or in Netlify UI: **Deploys** → **Trigger deploy** → **Deploy site**

### 4. Verify

In browser console:
```javascript
// Should show your production API URL
API_BASE_URL
```

---

## Complete Environment Variables Reference

| Variable | Value | Where to Set | Required |
|----------|-------|--------------|----------|
| `EXPO_PUBLIC_API_URL` | `https://your-api.run.app/api` | Netlify UI | **YES** |
| `NODE_ENV` | `production` | Auto-set | No |

### Optional Variables

```
# For external payment gateway (if configured)
EXPO_PUBLIC_PAYMENTS_SERVER_URL=https://payments.example.com

# For analytics/monitoring
EXPO_PUBLIC_SENTRY_DSN=https://your@sentry.io/project
EXPO_PUBLIC_ANALYTICS_URL=https://analytics.example.com
```

---

## Per-Environment Configuration

### Production (Main Branch)

```toml
# In netlify.toml
[context.production]
  [context.production.environment]
    EXPO_PUBLIC_API_URL = "https://lebrq-api-abc123.run.app/api"
    NODE_ENV = "production"
```

Or set in Netlify UI **Deploy contexts** → **Production**.

### Preview Deploys (Pull Requests)

```toml
[context.deploy-preview]
  [context.deploy-preview.environment]
    EXPO_PUBLIC_API_URL = "https://lebrq-api-abc123.run.app/api"
    NODE_ENV = "production"
```

### Branch Deploys (Development)

```toml
# Optional: Use staging API for develop branch
[context.develop]
  [context.develop.environment]
    EXPO_PUBLIC_API_URL = "https://staging-api.run.app/api"
    NODE_ENV = "development"
```

---

## Testing Environment Variables

### 1. Check in Browser

After deploying with new environment variables:

**Open browser DevTools (F12) → Console:**

```javascript
// This should show your production API URL
console.log('API Base:', apiConfig.baseUrl)

// This should show "production"
console.log('Environment:', apiConfig.getEnvironment())

// Log full config
apiConfig.logConfig()
```

**Expected output:**
```
[API Config] API Configuration Summary
[API Config] Environment: production
[API Config] Base URL: https://lebrq-api-abc123.run.app/api
```

### 2. Test API Connectivity

```javascript
// In browser console:
fetch(apiConfig.baseUrl + '/health')
  .then(r => r.json())
  .then(d => console.log('✓ API Healthy:', d))
  .catch(e => console.error('✗ API Error:', e))
```

**Expect:**
```json
{
  "status": "ok",
  "message": "API is healthy",
  "timestamp": "2025-12-26T..."
}
```

### 3. Test Actual API Calls

```javascript
// Test items endpoint
fetch(apiConfig.baseUrl + '/items', {
  headers: {
    'Authorization': 'Bearer your-token-here'
  }
})
  .then(r => r.json())
  .then(console.log)
  .catch(console.error)
```

---

## Debugging Environment Variable Issues

### Problem: Environment Variables Not Applied

**Check:**
1. New deploy triggered? (Redeploy after setting variables)
2. Cache busting? (Hard refresh: Ctrl+Shift+R or Cmd+Shift+R)
3. Correct spelling? (Copy-paste from Netlify UI)

**Verify in Deploy Logs:**
1. Go to **Deploys** tab
2. Click latest deploy
3. Scroll to **Build logs**
4. Look for: `Environment variables loaded`

### Problem: API Calls Still Failing

**Check these in order:**

1. **Is API URL correct?**
   ```javascript
   console.log(apiConfig.baseUrl)
   // Should show https://your-api.run.app/api
   ```

2. **Is backend API actually running?**
   ```bash
   curl https://your-api.run.app/health
   # Should return JSON with "ok" status
   ```

3. **Are CORS headers correct?**
   ```bash
   curl -i https://your-api.run.app/health
   # Look for: Access-Control-Allow-Origin header
   ```

4. **Is HTTPS being used?**
   - Frontend: Netlify is always HTTPS ✓
   - Backend: Must be HTTPS, NOT HTTP
   - If backend is HTTP, you'll get **mixed content** error

### Problem: Mixed Content Error

**Symptom:** Browser console shows:
```
Blocked loading mixed content from 'http://api...'
```

**Cause:** Frontend is HTTPS, API is HTTP

**Fix:** Update `EXPO_PUBLIC_API_URL` to use HTTPS:
```
EXPO_PUBLIC_API_URL = https://your-api.run.app/api
                      ^^^^^^^ (not http)
```

---

## Backend Configuration for Netlify

Your backend must accept requests from Netlify domain.

### Update Backend CORS Settings

In `backend/.env` or Cloud Run environment variables:

```bash
# Allow Netlify domains
CORS_ORIGINS=https://your-site.netlify.app,https://lebrq.com,https://www.lebrq.com

# Or allow all CORS (not recommended for production)
CORS_ORIGINS=*
```

### Test CORS

```bash
# From Netlify domain
curl -H "Origin: https://your-site.netlify.app" \
     -i https://your-api.run.app/health

# Should return:
# Access-Control-Allow-Origin: https://your-site.netlify.app
```

---

## Common Scenarios

### Scenario 1: New Production Deployment

1. **Deploy frontend to Netlify**
   ```bash
   # Link repo or use CLI
   netlify deploy --prod
   ```

2. **Set API URL in Netlify**
   - UI: Site Settings → Environment
   - Add: `EXPO_PUBLIC_API_URL = https://your-api.run.app/api`

3. **Redeploy**
   ```bash
   netlify deploy --prod
   ```

4. **Verify**
   ```javascript
   // In browser console
   apiConfig.logConfig()
   ```

### Scenario 2: Update Backend API Domain

1. **Update `EXPO_PUBLIC_API_URL` in Netlify UI**
   - New URL: `https://new-api.run.app/api`

2. **Redeploy**
   ```bash
   netlify deploy --prod
   ```

3. **Update backend CORS**
   - Add Netlify domain to `CORS_ORIGINS`

4. **Test**
   ```javascript
   // Verify new API URL is being used
   apiConfig.logConfig()
   ```

### Scenario 3: Local Development

When developing locally, API defaults to `http://localhost:8000/api`:

```javascript
// Automatically detected in development
console.log(apiConfig.baseUrl)
// Output: http://localhost:8000/api

// To override:
process.env.EXPO_PUBLIC_API_URL = 'http://192.168.1.100:8000/api'
```

---

## Security Notes

### ✅ Do:
- Use HTTPS for all URLs (API and frontend)
- Store secrets in Netlify (environment variables)
- Use environment-specific configurations
- Validate API responses
- Use short token expiration

### ❌ Don't:
- Commit `.env` files with secrets
- Use hardcoded localhost in production
- Use HTTP API from HTTPS frontend
- Store API keys in frontend code
- Make API endpoints public

---

## Monitoring

### Check Deploy Status

```bash
netlify status
# Shows site info, current deploy status
```

### View Build Logs

```bash
netlify logs
# Shows real-time build logs
```

### Monitor API Health

```bash
# Check backend API status
curl https://your-api.run.app/health -v
```

---

## Rollback

If environment variable causes issues:

1. **Revert in Netlify UI**
   - Site Settings → Environment → Click variable → Delete/Edit

2. **Redeploy**
   - Netlify will use previous config

3. **Or deploy from CLI**
   ```bash
   netlify deploy --prod
   ```

---

## More Help

- [Netlify Env Vars Docs](https://docs.netlify.com/configure-builds/environment-variables/)
- [Expo Configuration](https://docs.expo.dev/guides/environment-variables/)
- [FastAPI CORS](https://fastapi.tiangolo.com/tutorial/cors/)
- [Cloud Run Environment Variables](https://cloud.google.com/run/docs/configuring/environment-variables)
