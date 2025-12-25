# Expo Web Static Export - API Pending Issue - Complete Fix

## Problem
After running `npx expo export --platform web`, API calls get stuck in "pending" state.

## Root Causes & Fixes Applied

### ✅ 1. Fixed: Relative API URLs → Absolute URLs
**Issue**: Code was using relative URLs or localhost in production
**Fix**: Updated `constants/config.ts` to:
- Detect production web builds automatically
- Use production API URL (`https://taxtower.in:8002/api`) for static exports
- Require `EXPO_PUBLIC_API_URL` environment variable for production

### ✅ 2. Fixed: Service Worker Caching API Requests
**Issue**: Service worker was caching API requests, causing them to hang
**Fix**: Updated `web/service-worker.js` to:
- NEVER cache any `/api/` requests
- Always fetch API requests fresh from server
- Only cache static assets (images, CSS, JS)

### ✅ 3. Fixed: Backend Request Timeout
**Issue**: Long-running requests could hang indefinitely
**Fix**: Added 60-second timeout middleware in `backend/app/core.py`

### ✅ 4. Fixed: OTP Endpoint 500 Errors
**Issue**: OTP endpoint was throwing 500 errors after some requests
**Fix**: Added comprehensive error handling in:
- `backend/app/routers/users.py` - Better exception handling
- `backend/app/services/otp_service.py` - Connection cleanup and error recovery

### ✅ 5. Fixed: HTTP/HTTPS Mixed Content
**Issue**: Using HTTP API with HTTPS website causes mixed content blocking
**Fix**: 
- Production API URL uses HTTPS: `https://taxtower.in:8002/api`
- Added warning if HTTP is used in production

## Configuration for Production

### Environment Variables

Create a `.env` file in the project root:

```env
# Production API URL (REQUIRED for static exports)
EXPO_PUBLIC_API_URL=https://taxtower.in:8002/api

# Optional: App base URL
EXPO_PUBLIC_APP_BASE_URL=https://lebrq.com
```

### Build Command

```bash
# Set environment variable and export
$env:EXPO_PUBLIC_API_URL="https://taxtower.in:8002/api"
npx expo export --platform web
```

Or use a `.env` file:

```bash
# Load .env and export
npx dotenv-cli -e .env -- npx expo export --platform web
```

## Verification Checklist

After deploying, verify:

1. ✅ **API URL is Absolute**: 
   - Open DevTools → Network tab
   - Check API requests - they should go to `https://taxtower.in:8002/api/...`
   - NOT `https://taxtower.in:8002/api` or relative `/api/...`

2. ✅ **Service Worker Not Caching APIs**:
   - DevTools → Application → Service Workers
   - Check Network tab - API requests should show "fetch" not "service worker"

3. ✅ **CORS Headers Present**:
   - Network tab → Check response headers
   - Should see `Access-Control-Allow-Origin: *` or your domain

4. ✅ **HTTPS for API**:
   - API URL should start with `https://`
   - No mixed content warnings in console

5. ✅ **No Pending Requests**:
   - All API requests should complete or timeout (not hang)
   - Timeout should be 30 seconds (frontend) or 60 seconds (backend)

## Common Issues & Solutions

### Issue: Still seeing localhost URLs
**Solution**: 
- Check `.env` file exists and has `EXPO_PUBLIC_API_URL`
- Restart Expo dev server after setting env var
- For static export, env var must be set BEFORE running `expo export`

### Issue: CORS errors
**Solution**:
- Backend CORS is already configured to allow all origins
- Check backend is running and accessible
- Verify backend CORS middleware is active

### Issue: Mixed content warnings
**Solution**:
- Ensure API URL uses HTTPS in production
- Update `EXPO_PUBLIC_API_URL` to use `https://`

### Issue: Service worker still caching
**Solution**:
- Clear browser cache
- Unregister service worker: DevTools → Application → Service Workers → Unregister
- Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

## Testing

1. **Local Development**:
   ```bash
   $env:EXPO_PUBLIC_API_URL="https://taxtower.in:8002/api"
   npx expo start --web
   ```

2. **Production Build**:
   ```bash
   $env:EXPO_PUBLIC_API_URL="https://taxtower.in:8002/api"
   npx expo export --platform web
   ```

3. **Verify Build**:
   - Open `dist/index.html` in browser
   - Check Network tab - API calls should go to production URL
   - All requests should complete (not hang)

## Files Modified

1. ✅ `constants/config.ts` - Production URL detection
2. ✅ `app.config.ts` - Production API URL fallback
3. ✅ `app.json` - Updated default API URL
4. ✅ `web/service-worker.js` - Exclude API requests from caching
5. ✅ `backend/app/core.py` - Request timeout middleware
6. ✅ `backend/app/routers/users.py` - OTP error handling
7. ✅ `backend/app/services/otp_service.py` - Connection cleanup

## Next Steps

1. Set `EXPO_PUBLIC_API_URL` environment variable for production
2. Rebuild static export: `npx expo export --platform web`
3. Deploy to hosting (Netlify, Vercel, etc.)
4. Clear browser cache and test
5. Monitor for any remaining pending requests

