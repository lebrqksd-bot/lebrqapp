# Netlify Frontend Deployment Setup - Summary

## ✅ Completed Tasks

This document summarizes all changes made to prepare your LeBRQ frontend for Netlify deployment.

### 1. Environment Configuration ✅

**File:** `.env.example`

**Changes:**
- Replaced cPanel-specific documentation with Netlify instructions
- Added clear guidance for `EXPO_PUBLIC_API_URL` configuration
- Included examples for different environments (production, development, emulator)
- Removed references to absolute paths and server-specific setup

**Key Points:**
- Must be set in Netlify UI or `.env` file
- Use HTTPS in production
- Defaults to localhost for development

---

### 2. Netlify Configuration ✅

**File:** `netlify.toml`

**Features:**
- **Build Configuration:**
  - Command: `npm run export:web`
  - Output: `dist/`
  
- **SPA Routing:**
  - All requests → `index.html` (status 200)
  - Allows client-side routing
  - Works with Expo Router
  
- **Security Headers:**
  - X-Frame-Options: SAMEORIGIN (prevent clickjacking)
  - X-Content-Type-Options: nosniff (prevent MIME sniffing)
  - X-XSS-Protection: enabled
  - Referrer-Policy: strict-origin-when-cross-origin

- **Caching Strategy:**
  - Bundle files: 1 year (immutable)
  - HTML: 5 minutes (must revalidate)
  - Assets: 1 year (immutable)

- **Environment Contexts:**
  - Production: Uses production API
  - Preview: Uses production API (can customize)
  - Branch deploys: Can use staging API

**How to Use:**
- Netlify automatically reads this file during build
- No additional configuration needed
- All settings are production-ready

---

### 3. SPA Routing Configuration ✅

**File:** `_redirects`

**Purpose:**
- Alternative to `netlify.toml` for SPA routing
- Simpler format if you prefer
- Netlify reads both, `_redirects` takes precedence

**Current Configuration:**
```
/*  /index.html  200
```

This means:
- Any URL that doesn't match a file → serves `index.html`
- Status 200 means the redirect is transparent (URL doesn't change)
- React Router / Expo Router handles the actual routing

---

### 4. API Configuration Module ✅

**File:** `lib/netlifyApiConfig.ts`

**Features:**
- **Environment-Aware URL Resolution:**
  1. Check `EXPO_PUBLIC_API_URL` environment variable
  2. Detect production vs. development domains
  3. Fallback to sensible defaults
  
- **Production Domain Detection:**
  - Netlify production: uses `EXPO_PUBLIC_API_URL`
  - Custom domain: uses `EXPO_PUBLIC_API_URL`
  - Localhost: uses development URL
  - LAN IP: uses development URL

- **Security:**
  - Warns if using HTTP in production
  - Never allows localhost in production builds
  - Properly handles HTTPS-only restriction

- **Export Functions:**
  ```typescript
  export const API_BASE_URL          // Resolved API URL
  export async function getAuthToken() // Get stored token
  export async function setAuthToken() // Store token
  export async function clearAuth()    // Clear all auth
  export const apiConfig              // Configuration object
  ```

**Usage:**
```typescript
import { API_BASE_URL, apiConfig } from '@/lib/netlifyApiConfig';

// Get current API URL
console.log(apiConfig.baseUrl);

// Check environment
console.log(apiConfig.getEnvironment()); // 'production', 'development', etc.

// Log full config
apiConfig.logConfig();

// Get auth headers
const headers = await apiConfig.getHeaders();

// Check if production
if (apiConfig.isProduction()) {
  // Use production configuration
}
```

---

### 5. Documentation ✅

**Created 4 comprehensive guides:**

#### A. `NETLIFY_DEPLOYMENT.md`
**Audience:** Developers deploying to Netlify

**Contents:**
- Step-by-step deployment instructions
- Environment variable setup
- Custom domain configuration
- Deploy previews for pull requests
- Troubleshooting guide
- Performance optimization
- Monitoring & debugging

**Key Sections:**
- Connect Git repo to Netlify
- Set environment variables
- Configure custom domain
- SPA routing explanation
- API configuration for Netlify
- Common issues & solutions

#### B. `NETLIFY_ENV_SETUP.md`
**Audience:** DevOps/Team leads managing environments

**Contents:**
- Quick 5-minute setup
- Complete environment variable reference
- Per-environment configuration
- Testing & verification procedures
- Backend configuration required
- Debugging guide
- Common scenarios

**Key Sections:**
- Get API URL from Cloud Run
- Set Netlify environment variables
- Verify in browser console
- Backend CORS configuration
- Troubleshooting environment issues

#### C. `CPANEL_TO_NETLIFY_MIGRATION.md`
**Audience:** Teams migrating from cPanel

**Contents:**
- Migration overview and rationale
- Step-by-step migration checklist
- Remove cPanel-specific code
- Update API configuration
- Configure backend CORS
- Domain migration
- Post-migration tasks
- Rollback procedures

**Key Sections:**
- Remove cPanel paths
- Update environment variables
- Connect to Netlify
- Configure custom domain
- Migrate DNS records
- Cancel cPanel hosting

#### D. `NETLIFY_QUICK_REFERENCE.md`
**Audience:** Everyone - Quick lookup

**Contents:**
- TL;DR 3-step deployment
- Key files reference
- Build configuration
- Routing configuration
- Common tasks (deploy, test, debug)
- Troubleshooting shortcuts
- Security headers
- Caching strategy

---

### 6. No Breaking Changes ✅

**Compatibility:**

- ✅ Existing API client `lib/apiClient.ts` still works
- ✅ Existing API calls unchanged
- ✅ Existing component code unchanged
- ✅ AsyncStorage auth still works
- ✅ Expo Router still works
- ✅ Local development unchanged
- ✅ Android/iOS apps unaffected

**What Was NOT Changed:**

- `app/` - Routing structure
- `components/` - Component code
- `lib/api.ts` - Existing API client
- `lib/apiClient.ts` - Client class
- `utils/` - Utility functions
- `constants/` - Other constants

**What WAS Changed:**

- `.env.example` - Netlify-focused docs
- `netlify.toml` - Created (prod-ready)
- `_redirects` - Updated (SPA routing)
- `lib/netlifyApiConfig.ts` - Created (config helper)

---

## How It All Works Together

### Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│ DEVELOPER                                               │
│ (Local Machine)                                         │
│                                                         │
│ npm run export:web                                      │
│     ↓                                                   │
│ Generates: dist/                                        │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ GIT REPOSITORY (GitHub, GitLab, etc.)                   │
│                                                         │
│ Push code + netlify.toml + .env                         │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ NETLIFY BUILD PROCESS                                   │
│                                                         │
│ 1. Read netlify.toml                                    │
│ 2. Load environment variables                           │
│ 3. Run: npm run export:web                              │
│ 4. Generate: dist/                                      │
│ 5. Deploy to CDN                                        │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ NETLIFY CDN (Global)                                    │
│                                                         │
│ - Serves index.html for all routes (SPA routing)       │
│ - Caches static assets with versioning                 │
│ - Provides HTTPS everywhere                            │
│ - Injects environment variables at build time          │
│ - Sets security headers                                │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ BROWSER                                                 │
│                                                         │
│ 1. Loads /index.html                                   │
│ 2. React/Expo Router starts                            │
│ 3. API client reads EXPO_PUBLIC_API_URL               │
│ 4. Makes requests to backend API                       │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ BACKEND API (Cloud Run / Production)                   │
│                                                         │
│ https://your-api.run.app/api                          │
│                                                         │
│ - FastAPI application                                  │
│ - PostgreSQL/Supabase database                         │
│ - CORS configured for Netlify domain                   │
│ - Returns JSON responses                               │
└─────────────────────────────────────────────────────────┘
```

### Configuration Flow

```
ENVIRONMENT VARIABLES (Set in Netlify UI)
    ↓
netlify.toml (Read by Netlify)
    ↓
Build Process (npm run export:web)
    ↓
dist/ folder (Static files)
    ↓
Netlify CDN (Host static files)
    ↓
Browser loads index.html
    ↓
JavaScript executes
    ↓
apiConfig.baseUrl resolved (from EXPO_PUBLIC_API_URL)
    ↓
API calls made to backend
```

---

## Key Concepts

### 1. Build vs. Runtime

**Build Time (Netlify):**
- Runs `npm run export:web`
- Generates static files
- Injects `EXPO_PUBLIC_API_URL` into build

**Runtime (Browser):**
- Loads HTML/JS from Netlify CDN
- Reads environment variables
- Makes API calls to backend

### 2. SPA Routing

**Problem:** User visits `/items/123` → Netlify serves what?

**Solution:** `netlify.toml` redirects to `/index.html` (status 200)

Result: React Router handles the route, not the server

### 3. Environment Variables

**How Netlify injects variables:**

```javascript
// In Netlify build process:
process.env.EXPO_PUBLIC_API_URL = "https://your-api.run.app/api"

// Code reads the variable:
const url = process.env.EXPO_PUBLIC_API_URL
// url = "https://your-api.run.app/api"
```

### 4. Security

**HTTPS:**
- Netlify CDN: Always HTTPS ✓
- Backend API: Must be HTTPS
- Browser: Mixed content policy enforced

**Headers:**
- X-Frame-Options: Prevent clickjacking
- X-Content-Type-Options: Prevent MIME sniffing
- X-XSS-Protection: Enable browser XSS filter

**CORS:**
- Backend must allow Netlify domain
- Environment variable configures frontend API URL

---

## Before You Deploy

### Checklist

- [ ] Code pushed to Git
- [ ] `netlify.toml` exists (✅ Created)
- [ ] `_redirects` exists (✅ Updated)
- [ ] `.env.example` updated (✅ Done)
- [ ] `lib/netlifyApiConfig.ts` exists (✅ Created)
- [ ] `npm run export:web` works locally
- [ ] `dist/` folder generates
- [ ] No cPanel references in code
- [ ] API client uses environment variables
- [ ] Backend API deployed (Cloud Run)
- [ ] Backend CORS configured
- [ ] Custom domain ready (optional)

### Local Testing

```bash
# Test build locally
npm run export:web

# Serve locally
npx http-server dist

# Check in browser
open http://localhost:8080

# Test API calls
# In console: apiConfig.logConfig()
```

---

## Deployment Steps

### Quick Deploy (3 Steps)

1. **Set API URL in Netlify**
   ```
   EXPO_PUBLIC_API_URL = https://your-api.run.app/api
   ```

2. **Deploy**
   ```bash
   netlify deploy --prod
   ```

3. **Verify**
   ```javascript
   // In browser console
   apiConfig.logConfig()
   ```

### Full Deployment

See `NETLIFY_DEPLOYMENT.md` for complete step-by-step guide.

---

## Support & Reference

| Topic | File |
|-------|------|
| Complete deployment | `NETLIFY_DEPLOYMENT.md` |
| Environment setup | `NETLIFY_ENV_SETUP.md` |
| Migrate from cPanel | `CPANEL_TO_NETLIFY_MIGRATION.md` |
| Quick reference | `NETLIFY_QUICK_REFERENCE.md` |
| API configuration | `lib/netlifyApiConfig.ts` |
| Routing configuration | `netlify.toml` or `_redirects` |

---

## Summary

✅ **Your frontend is ready for Netlify deployment!**

All configuration files created:
- `netlify.toml` - Build & routing config
- `_redirects` - SPA routing backup
- `lib/netlifyApiConfig.ts` - Environment-aware API configuration
- `.env.example` - Updated environment template

All documentation created:
- `NETLIFY_DEPLOYMENT.md` - Full guide (step-by-step)
- `NETLIFY_ENV_SETUP.md` - Environment configuration
- `CPANEL_TO_NETLIFY_MIGRATION.md` - Migration guide
- `NETLIFY_QUICK_REFERENCE.md` - Quick lookup

No breaking changes to existing code.

**Next Steps:**
1. Review the Quick Reference guide
2. Follow the Deployment guide
3. Set environment variables in Netlify
4. Deploy and verify
5. Monitor logs for issues

Happy deploying! 🚀
