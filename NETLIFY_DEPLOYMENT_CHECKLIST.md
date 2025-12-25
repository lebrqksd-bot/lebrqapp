# Netlify Deployment Master Checklist

## Pre-Deployment Verification

### ✅ Repository & Git

- [ ] Frontend code in Git repository (GitHub, GitLab, Bitbucket)
- [ ] All changes committed and pushed
- [ ] Repository is public or you have Netlify access
- [ ] Main branch is stable and tested locally

### ✅ Configuration Files

- [ ] `netlify.toml` exists in root
- [ ] `_redirects` exists in root
- [ ] `.env.example` exists and updated
- [ ] `lib/netlifyApiConfig.ts` exists
- [ ] No `.htaccess` file (cPanel config - should be removed)
- [ ] No `web.config` file (IIS config - should be removed)
- [ ] No server-side auth configuration

### ✅ Build Configuration

- [ ] `package.json` has `"export:web"` script
- [ ] `npm run export:web` works locally
- [ ] `dist/` folder is generated successfully
- [ ] `dist/index.html` exists
- [ ] `dist/_expo/` folder exists
- [ ] No build errors or warnings

### ✅ Frontend Code

- [ ] All API calls use environment variables
- [ ] No hardcoded API URLs (except for fallbacks)
- [ ] No cPanel references in code
- [ ] No absolute `/var/www/` paths
- [ ] No server-side code in frontend
- [ ] React Router / Expo Router works locally
- [ ] Page refresh works for all routes (SPA routing)

### ✅ API Configuration

- [ ] `EXPO_PUBLIC_API_URL` is environment variable
- [ ] API client reads from `process.env.EXPO_PUBLIC_API_URL`
- [ ] Fallback to localhost for development
- [ ] No hardcoded domain names
- [ ] AsyncStorage auth tokens work

### ✅ Backend API

- [ ] Backend API deployed (Cloud Run, Heroku, etc.)
- [ ] API is running and accessible
- [ ] CORS configured (but will be updated for Netlify domain)
- [ ] `FRONTEND_URL` configured in backend
- [ ] API `/health` endpoint responds
- [ ] API endpoints are tested and working

### ✅ Security

- [ ] No secrets in `.env.example`
- [ ] No secrets in code
- [ ] No API keys in frontend
- [ ] HTTPS will be used in production
- [ ] Backend CORS will be restricted to Netlify domain

### ✅ Testing Locally

- [ ] Tested in browser locally
- [ ] Tested page refresh (all routes)
- [ ] Tested API calls
- [ ] Tested authentication flow
- [ ] Tested image loading
- [ ] Tested CSS styling
- [ ] No console errors
- [ ] No console warnings about localhost/production

---

## Netlify Setup

### ✅ Account Setup

- [ ] Netlify account created (https://netlify.com)
- [ ] Account verified (check email)
- [ ] Ready to connect Git repo

### ✅ Connect Repository

- [ ] Logged into Netlify
- [ ] Clicked "Add new site" → "Import an existing project"
- [ ] Selected Git provider (GitHub, etc.)
- [ ] Authorized Netlify to access repositories
- [ ] Selected your frontend repository
- [ ] Build settings auto-detected from `netlify.toml`

### ✅ Verify Build Settings

In Netlify UI, verify:

- [ ] **Build command:** `npm run export:web`
- [ ] **Publish directory:** `dist`
- [ ] **Base directory:** (empty - if monorepo, update accordingly)
- [ ] **Functions directory:** (empty unless using serverless)

### ✅ Environment Variables

In Netlify UI → **Site Settings** → **Build & Deploy** → **Environment**:

- [ ] `EXPO_PUBLIC_API_URL` = `https://your-api-domain.run.app/api`
- [ ] Verified spelling is correct
- [ ] No trailing slash in URL
- [ ] HTTPS (not HTTP)
- [ ] Points to actual API domain
- [ ] Saved successfully

### ✅ First Deploy

- [ ] Clicked "Deploy site" or pushed to Git
- [ ] Build started (watch logs)
- [ ] Build completed successfully
- [ ] No build errors
- [ ] Site deployed to `your-site.netlify.app`

---

## Post-Deployment Verification

### ✅ Site Access

- [ ] Site loads on `your-site.netlify.app`
- [ ] Site is HTTPS (green lock icon)
- [ ] No SSL/certificate errors

### ✅ Routing

- [ ] Home page loads
- [ ] Navigate to different routes (click links)
- [ ] Page refresh works on all routes
- [ ] No 404 errors on refresh
- [ ] Browser back/forward works

### ✅ Styling & Assets

- [ ] CSS styling applied (colors, fonts, layout)
- [ ] Images load and display
- [ ] Icons visible
- [ ] Fonts loaded correctly
- [ ] No styling is missing

### ✅ Console & Errors

- [ ] Open DevTools Console (F12)
- [ ] No JavaScript errors
- [ ] No warning about localhost API
- [ ] No CORS errors
- [ ] No mixed content errors
- [ ] Environment variable logged correctly

### ✅ API Connectivity

In browser console, run:

```javascript
// Check API URL
console.log('API Base:', apiConfig.baseUrl)
// Expected: https://your-api-domain.run.app/api

// Check environment
console.log('Environment:', apiConfig.getEnvironment())
// Expected: production

// Test health endpoint
fetch(apiConfig.baseUrl + '/health')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error)
// Expected: JSON response with status: ok
```

- [ ] API URL is production URL (not localhost)
- [ ] Environment is "production"
- [ ] Health endpoint responds
- [ ] No CORS errors

### ✅ Feature Testing

- [ ] Login/authentication works
- [ ] Logout works
- [ ] Forms submit successfully
- [ ] API calls complete
- [ ] Data displays correctly
- [ ] Search/filter works
- [ ] Pagination works
- [ ] Payments work (if applicable)

### ✅ Monitoring

- [ ] Check deploy logs (Netlify UI → Deploys)
- [ ] Look for any warnings or errors
- [ ] Check build duration (should be < 5 minutes)
- [ ] Monitor site analytics/health

---

## Backend Configuration

### ✅ Update CORS

In your backend `.env` or Cloud Run variables:

```bash
FRONTEND_URL=https://your-site.netlify.app
CORS_ORIGINS=https://your-site.netlify.app,https://lebrq.com,https://www.lebrq.com
```

- [ ] `FRONTEND_URL` points to Netlify domain
- [ ] `CORS_ORIGINS` includes Netlify domain
- [ ] Deployed to Cloud Run
- [ ] Verified CORS headers with curl

### ✅ Test CORS

From command line:

```bash
curl -H "Origin: https://your-site.netlify.app" \
     -i https://your-api-domain.run.app/api/health
```

- [ ] Response includes `Access-Control-Allow-Origin` header
- [ ] Header value matches Netlify domain

### ✅ API Endpoints

- [ ] `/health` endpoint works
- [ ] `/api/items` endpoint works
- [ ] Authentication endpoints work
- [ ] Pagination works
- [ ] Filtering works
- [ ] All endpoints return proper CORS headers

---

## Custom Domain (Optional)

### ✅ Domain Setup

- [ ] Domain registered (GoDaddy, Namecheap, etc.)
- [ ] Domain accessible
- [ ] Ready to update DNS

### ✅ Netlify Configuration

In Netlify UI → **Site Settings** → **Domain Management**:

- [ ] Added custom domain
- [ ] Verified domain ownership
- [ ] Noted Netlify nameservers

### ✅ DNS Update

In your domain registrar:

- [ ] Updated DNS to point to Netlify
- [ ] Or changed nameservers to Netlify
- [ ] Waited for DNS propagation (5-15 minutes)
- [ ] Verified domain resolves to Netlify

### ✅ HTTPS

- [ ] Netlify automatic HTTPS configured
- [ ] Certificate provisioned (Let's Encrypt)
- [ ] HTTPS works on custom domain
- [ ] Green lock icon shows

### ✅ Redirects (Optional)

If migrating from cPanel to custom domain:

- [ ] Old domain now redirects to new domain
- [ ] Or old domain hosting is disabled
- [ ] No broken links to old domain

---

## Monitoring & Maintenance

### ✅ Set Up Monitoring

- [ ] Monitor deploy logs (check daily for first week)
- [ ] Monitor site uptime
- [ ] Set up error tracking (Sentry, Bugsnag, etc.)
- [ ] Monitor API response times
- [ ] Check for failed API calls

### ✅ Optimization

- [ ] Review build time (target: < 3 minutes)
- [ ] Analyze bundle size
- [ ] Enable caching (already configured in `netlify.toml`)
- [ ] Optimize images (if needed)

### ✅ Backup & Disaster Recovery

- [ ] Git repository is backed up (with GitHub, etc.)
- [ ] Netlify keeps deployment history
- [ ] Can rollback to previous deploy if needed
- [ ] Document rollback procedure

### ✅ Logging & Debugging

- [ ] Netlify deploy logs accessible
- [ ] Browser console available for debugging
- [ ] API logs accessible on backend
- [ ] Know how to check all three sources

---

## Post-Migration Cleanup (If from cPanel)

### ✅ Verify Netlify Works

- [ ] All tests above passed
- [ ] Everything works on Netlify
- [ ] No issues for 24+ hours

### ✅ Update DNS Records

- [ ] Domain now points to Netlify
- [ ] Old domain no longer resolves
- [ ] HTTPS works on new domain

### ✅ Disable cPanel

- [ ] Backed up all files from cPanel
- [ ] Kept backup for 30+ days
- [ ] Disabled website in cPanel
- [ ] Or cancelled cPanel service

### ✅ Update Documentation

- [ ] Updated team documentation
- [ ] Updated deployment runbooks
- [ ] Updated status page
- [ ] Informed team of new process

---

## Troubleshooting Checklist

### If Build Fails

- [ ] Check Netlify deploy logs
- [ ] Verify `npm run export:web` works locally
- [ ] Check for syntax errors in code
- [ ] Verify all dependencies are in `package.json`
- [ ] Try rebuilding locally
- [ ] Clear Netlify cache and redeploy

### If Site Shows 404

- [ ] Verify `netlify.toml` has redirect rule
- [ ] Verify `_redirects` file exists
- [ ] Check that `index.html` exists in `dist/`
- [ ] Refresh browser cache (Ctrl+Shift+R)
- [ ] Clear browser cookies

### If API Calls Fail

- [ ] Verify `EXPO_PUBLIC_API_URL` environment variable set
- [ ] Check API URL in browser console
- [ ] Test API endpoint with curl
- [ ] Check backend CORS configuration
- [ ] Look for CORS errors in browser console
- [ ] Verify backend is running
- [ ] Check for mixed content errors (HTTP vs HTTPS)

### If Styles/Images Missing

- [ ] Check browser console for 404s
- [ ] Verify files exist in `dist/`
- [ ] Check file paths (case-sensitive on Linux)
- [ ] Verify caching headers aren't too aggressive
- [ ] Clear browser cache completely
- [ ] Rebuild with `npm run export:web`

### If Authentication Fails

- [ ] Check AsyncStorage working in browser
- [ ] Verify token stored correctly
- [ ] Check Authorization header sent
- [ ] Verify backend auth endpoints work
- [ ] Check token hasn't expired
- [ ] Verify CORS allows Authorization header

---

## Sign-Off

### ✅ Go-Live Approval

- [ ] All checklists completed
- [ ] All tests passed
- [ ] No critical issues
- [ ] Performance acceptable
- [ ] Security verified
- [ ] Team notified
- [ ] Documentation updated
- [ ] Monitoring configured

### ✅ First 24 Hours Monitoring

- [ ] Monitor error logs
- [ ] Check user feedback
- [ ] Verify no data loss
- [ ] Monitor API performance
- [ ] Monitor site uptime
- [ ] Check build logs daily

### ✅ First Week Monitoring

- [ ] Review deployment logs
- [ ] Check error tracking service
- [ ] Monitor site analytics
- [ ] Monitor API metrics
- [ ] Verify no issues reported
- [ ] Check backup procedures

---

## Quick Reference

**If something goes wrong:**

1. Check browser console (F12)
2. Check Netlify deploy logs (UI → Deploys → Latest)
3. Check backend API logs (Cloud Run console)
4. Test with curl: `curl https://your-api.run.app/health`
5. Check environment variable: In browser console: `console.log(apiConfig.baseUrl)`

**Common Quick Fixes:**

- 404 on refresh? Check `netlify.toml` has redirect
- API not found? Check `EXPO_PUBLIC_API_URL` environment variable
- Mixed content error? Change HTTP to HTTPS in `EXPO_PUBLIC_API_URL`
- CORS error? Check backend `CORS_ORIGINS` includes Netlify domain
- Build failed? Check `npm run export:web` works locally

---

## Support

For help, refer to:

- `NETLIFY_QUICK_REFERENCE.md` - Quick lookup
- `NETLIFY_DEPLOYMENT.md` - Full guide
- `NETLIFY_ENV_SETUP.md` - Environment configuration
- `NETLIFY_BACKEND_CONFIG.md` - Backend integration
- [Netlify Docs](https://docs.netlify.com)
- [Expo Docs](https://docs.expo.dev)

---

**You're ready to go live!** ✅ 🚀
