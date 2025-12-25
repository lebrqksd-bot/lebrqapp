# Netlify Deployment Guide for LeBRQ Frontend

## Overview

This guide explains how to deploy the LeBRQ frontend (Expo web export) to Netlify with proper environment configuration, routing, and production best practices.

**Current Setup:**
- Frontend Framework: Expo (React Native web)
- Build Output: `/dist` (static HTML/CSS/JS)
- Hosting: Netlify CDN
- Backend API: FastAPI on Google Cloud Run
- Database: Supabase (PostgreSQL)

## Prerequisites

1. **Netlify Account** - Sign up at https://netlify.com
2. **Git Repository** - Frontend code must be in a Git repo (GitHub, GitLab, Bitbucket)
3. **Backend API Deployed** - Your FastAPI backend should be running on Cloud Run or similar
4. **Environment Variables** - Set up in Netlify after deployment

## Step 1: Connect Git Repository to Netlify

### Option A: Direct GitHub Integration (Recommended)

1. Go to [Netlify Dashboard](https://app.netlify.com)
2. Click **"Add new site"** → **"Import an existing project"**
3. Select GitHub (or your Git provider)
4. Authorize Netlify to access your repositories
5. Select your LeBRQ frontend repository
6. Click **"Deploy site"**

### Option B: Deploy from CLI

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Authenticate with Netlify (opens browser)
netlify login

# Deploy the project
cd /path/to/lebrqapp
netlify deploy --prod
```

## Step 2: Configure Build Settings

Netlify will auto-detect your build configuration from `netlify.toml`. Verify in Netlify UI:

**Site Settings → Build & Deploy → Build Settings**

```
Build command:    npm run export:web
Publish directory: dist
```

These match the settings in `netlify.toml` - no additional configuration needed.

## Step 3: Set Environment Variables

This is **CRITICAL** for production. Your frontend needs to know where the backend API is located.

### In Netlify UI:

1. Go to **Site Settings → Build & Deploy → Environment**
2. Click **"Edit variables"**
3. Add these variables:

| Variable | Value | Purpose |
|----------|-------|---------|
| `EXPO_PUBLIC_API_URL` | `https://your-api-domain.run.app/api` | Backend API endpoint |
| `NODE_ENV` | `production` | Enables production optimizations |

**Important:**
- Replace `your-api-domain.run.app` with your actual Cloud Run domain
- Use **HTTPS only** - never use HTTP in production
- If using custom domain, use that instead (e.g., `https://api.lebrq.com/api`)

### Testing Environment Variables:

After setting variables, trigger a new deploy:

```bash
# This will rebuild with new environment variables
netlify deploy --prod
```

Verify in browser DevTools Console:
```javascript
// Should output your production API URL
console.log(API_BASE_URL)
```

## Step 4: Configure Custom Domain (Optional)

If using a custom domain instead of `your-site.netlify.app`:

1. Go to **Site Settings → Domain Management**
2. Click **"Add custom domain"**
3. Enter your domain (e.g., `lebrq.com`)
4. Follow DNS configuration instructions

Netlify automatically provisions free HTTPS certificate (Let's Encrypt).

## Step 5: Set Up Deploy Previews (Optional)

Branch deploy previews allow testing before merging to main:

**Site Settings → Build & Deploy → Deploy Contexts**

All preview deploys will use production API (not staging). If you need separate staging API:

```toml
# In netlify.toml
[context.deploy-preview]
  [context.deploy-preview.environment]
    EXPO_PUBLIC_API_URL = "https://staging-api.run.app/api"
```

## File Structure & Routing

### Key Files for Netlify

```
lebrqapp/
├── netlify.toml              # Netlify configuration (build, redirects, headers)
├── _redirects                # Alternative SPA routing config
├── .env.example              # Environment variable template
├── app.json                  # Expo configuration
├── package.json              # Build script: "export:web"
├── dist/                     # Generated static files (output)
│   ├── index.html           # Entry point
│   ├── _expo/               # Expo/Metro bundled code
│   └── assets/              # Images, fonts, etc.
└── lib/netlifyApiConfig.ts   # API URL configuration
```

### SPA Routing

Netlify uses `netlify.toml` to handle client-side routing:

```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

This means:
- `/` → serves `index.html`
- `/items` → serves `index.html` (React Router handles it)
- `/admin/settings` → serves `index.html` (React Router handles it)
- `/static/image.png` → serves actual file (Netlify detects existing files)

**Your routes MUST be handled by the frontend app.** Example:

```typescript
// App routing (handled by Expo Router)
import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Home' }} />
      <Stack.Screen name="items/[id]" options={{ title: 'Item Details' }} />
      <Stack.Screen name="admin/settings" options={{ title: 'Settings' }} />
    </Stack>
  );
}
```

## API Configuration for Netlify

### How It Works

1. **Build Time:** `npm run export:web` creates static HTML/JS
2. **Environment Variables:** Netlify injects `EXPO_PUBLIC_API_URL` during build
3. **Runtime:** Frontend JavaScript uses the environment variable to call API

### Code Example

The frontend automatically detects and uses the API URL:

```typescript
// In lib/netlifyApiConfig.ts
const API_BASE_URL = resolveApiUrl();

function resolveApiUrl(): string {
  // 1. Check EXPO_PUBLIC_API_URL (from Netlify environment)
  const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (envUrl) return envUrl;
  
  // 2. Detect if on production domain
  if (!isLocalEnvironment(hostname)) {
    return 'https://your-api-domain.run.app/api';
  }
  
  // 3. Development fallback
  return 'http://localhost:8000/api';
}
```

### Testing API Connectivity

In browser console:
```javascript
// Check API URL
console.log('API Base:', apiConfig.baseUrl)

// Test connectivity
const health = await apiConfig.getHealth();
console.log('API Health:', health)

// Test an API call
const items = await apiClient.get('/items');
console.log('Items:', items)
```

## Troubleshooting Common Issues

### Issue: 404 on Page Refresh

**Symptom:** Routes work fine, but refreshing a page gives 404

**Solution:** This is expected! The redirect in `netlify.toml` handles it:
- Refresh → Netlify serves `/index.html`
- Frontend router renders correct page

If you get 404, check:
1. `netlify.toml` has the redirect rule
2. Or `_redirects` file exists in root

### Issue: API Calls Failing (CORS, 404, timeout)

**Symptom:** Frontend can't reach backend API

**Check:**

```javascript
// In browser console
console.log(apiConfig.baseUrl)    // Should show your API URL
console.log(apiConfig.getEnvironment())  // Should be "production"

// Test API health
fetch(apiConfig.baseUrl + '/health')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error)
```

**Solutions:**

1. **CORS Issue:** Backend must allow Netlify domain
   - Backend `CORS_ORIGINS` should include your Netlify domain
   - Or use wildcard (not recommended)

2. **API URL Wrong:** Check environment variable
   - In Netlify UI: **Site Settings → Build & Deploy → Environment**
   - Verify `EXPO_PUBLIC_API_URL` is correct (https, no trailing slash)

3. **Mixed Content (HTTP + HTTPS):**
   - Frontend is HTTPS (Netlify CDN)
   - API must be HTTPS (not HTTP)
   - Use HTTPS in `EXPO_PUBLIC_API_URL`

### Issue: Environment Variables Not Taking Effect

**Solution:** Trigger a new deploy

Environment variables are injected during build. Netlify caches builds, so:

```bash
# Option 1: Redeploy via CLI
netlify deploy --prod

# Option 2: Netlify UI
# Site Overview → "Trigger deploy" → "Deploy site"

# Option 3: Push to Git
git push origin main  # Auto-deploys if connected to Netlify
```

### Issue: Assets (CSS, Images) 404

**Symptom:** Site loads but styles/images missing

**Cause:** Expo export may have path issues

**Solution:**

1. Check `dist/` folder exists with files
2. Rebuild locally: `npm run export:web`
3. Verify `netlify.toml` caching headers don't exclude `_expo/`

## Performance Optimization

### Caching Strategy

`netlify.toml` configures smart caching:

```toml
# Cache static assets for 1 year
[[headers]]
  for = "/_expo/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

# Cache HTML for 5 minutes (allows frequent updates)
[[headers]]
  for = "/index.html"
  [headers.values]
    Cache-Control = "public, max-age=300, must-revalidate"
```

This means:
- **Bundle changes:** Update on each deploy
- **HTML updates:** Visible within 5 minutes
- **Image/font updates:** Must include in file hash

### Security Headers

`netlify.toml` sets security headers automatically:

```toml
X-Frame-Options = "SAMEORIGIN"        # Prevent clickjacking
X-Content-Type-Options = "nosniff"    # Prevent MIME sniffing
X-XSS-Protection = "1; mode=block"    # XSS protection
```

## Monitoring & Debugging

### View Deploy Logs

In Netlify UI:
1. **Deploys** tab
2. Click any deploy
3. Scroll to **Logs** section

Shows build output:
```
npm run export:web
> expo export --platform web
✓ Generated ./dist (123 MB)
```

### Check Site Health

After deploy:
1. Visit `https://your-site.netlify.app`
2. Open DevTools Console (F12)
3. Check for errors
4. Verify API calls work

## Next Steps

1. ✅ Deploy to Netlify
2. ✅ Set environment variables
3. ✅ Test frontend + API communication
4. ✅ Configure custom domain
5. ✅ Set up monitoring/logging
6. ✅ Configure CORS on backend
7. ✅ Test on mobile (Expo Go app)

## Additional Resources

- [Netlify Documentation](https://docs.netlify.com)
- [Expo Web Export Guide](https://docs.expo.dev/guides/web/)
- [Expo Router Documentation](https://expo.github.io/router/)
- [FastAPI CORS Configuration](https://fastapi.tiangolo.com/tutorial/cors/)
- [Google Cloud Run Docs](https://cloud.google.com/run/docs)

## Support

For issues:
1. Check Netlify logs: **Deploys → Latest → Logs**
2. Check browser console: DevTools → Console
3. Check backend API: `curl https://your-api.run.app/health`
4. Check environment variables: Netlify UI → Build & Deploy → Environment
