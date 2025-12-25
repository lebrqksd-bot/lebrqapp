# Migration Guide: cPanel → Netlify

## Overview

This guide explains how to move your frontend from cPanel hosting to Netlify, removing all cPanel-specific dependencies and configurations.

**Why migrate?**
- Better performance (global CDN)
- Automatic HTTPS
- Automatic builds from Git
- Environment variable management
- Better developer experience
- Lower maintenance overhead

## Before You Start

### Prerequisites
- [ ] Frontend code in Git repository (GitHub, GitLab, Bitbucket)
- [ ] Netlify account (free)
- [ ] Backend API deployed (Cloud Run, Heroku, etc.)
- [ ] Custom domain (optional, can use netlify.app subdomain)

### Estimated Time
- 15-30 minutes for complete migration

## Step 1: Remove cPanel-Specific Code

### Find and Remove cPanel References

**Search for these patterns in code:**

```bash
# Search for cPanel paths
grep -r "public_html" .
grep -r "/var/www" .
grep -r "cPanel" .
grep -r "cpanel" .
grep -r "WHM" .
```

**Common cPanel patterns to remove:**

1. **Absolute paths:**
   ```typescript
   // ❌ Remove:
   const API_URL = '/var/www/api/v1';
   const UPLOAD_PATH = '/home/username/public_html/uploads';
   
   // ✅ Use instead:
   const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api';
   const UPLOAD_PATH = './public/uploads';
   ```

2. **Server-specific rewrites:**
   ```apache
   # ❌ Remove from .htaccess:
   <IfModule mod_rewrite.c>
     RewriteEngine On
     RewriteBase /
     RewriteCond %{REQUEST_FILENAME} !-f
     RewriteCond %{REQUEST_FILENAME} !-d
     RewriteRule . /index.html [L]
   </IfModule>
   ```
   
   ✅ **Already handled by Netlify:**
   - Use `netlify.toml` instead
   - Already created in your repo

3. **Server-side authentication:**
   ```typescript
   // ❌ Remove:
   import { authenticate } from 'server-auth';
   const token = req.session.token;
   
   // ✅ Use instead:
   import AsyncStorage from '@react-native-async-storage/async-storage';
   const token = await AsyncStorage.getItem('auth.token');
   ```

4. **Server configuration files:**
   ```bash
   # ❌ Remove these if present:
   rm -f .htaccess
   rm -f php.ini
   rm -f web.config
   ```

### Check: Configuration Files

**Files that should exist:**

```
✓ netlify.toml          (Netlify config - don't use .htaccess)
✓ _redirects            (Alternative routing config)
✓ .env.example          (Template for environment variables)
✗ .htaccess             (REMOVE - cPanel specific)
✗ web.config            (REMOVE - IIS specific)
```

## Step 2: Update API Configuration

### Update Environment Variables Template

File: `.env.example`

```bash
# ✅ Production (Netlify)
EXPO_PUBLIC_API_URL=https://your-api-domain.run.app/api

# ✅ Development
EXPO_PUBLIC_API_URL=http://localhost:8000/api

# ❌ Remove:
# CPANEL_HOST=example.com
# CPANEL_PORT=2083
# SERVER_PATH=/home/username/public_html
```

### Update API Client

Ensure your API client uses environment variables:

```typescript
// ✅ Use environment variables
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api';

// ❌ Don't hardcode
// const API_BASE_URL = 'https://example.com/api';
```

## Step 3: Connect to Netlify

### Option A: GitHub Integration (Recommended)

1. **Push code to GitHub**
   ```bash
   git push origin main
   ```

2. **In Netlify Dashboard:**
   - Click "Add new site" → "Import an existing project"
   - Select GitHub and authorize
   - Choose your repository
   - Build settings auto-detected from `netlify.toml`
   - Click "Deploy site"

### Option B: CLI Deployment

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Authenticate
netlify login

# Deploy
cd /path/to/lebrqapp
netlify deploy --prod
```

### Option C: Drag & Drop

For testing only:
1. Build locally: `npm run export:web`
2. Go to https://app.netlify.com/drop
3. Drag `dist` folder onto the page

## Step 4: Configure Environment Variables

### In Netlify Dashboard

1. **Select your site**
2. **Site Settings** → **Build & Deploy** → **Environment**
3. **Add new variable** (or edit existing)

```
Key:   EXPO_PUBLIC_API_URL
Value: https://your-api-domain.run.app/api
```

4. **Save and trigger deploy**

### Verify Variables

After deploy, check in browser console:
```javascript
console.log(apiConfig.baseUrl)
// Should show: https://your-api-domain.run.app/api
```

## Step 5: Configure Backend CORS

Your backend must accept requests from Netlify domain.

### Update Backend Environment

```bash
# In backend/.env or Cloud Run variables:
CORS_ORIGINS=https://your-site.netlify.app,https://lebrq.com
FRONTEND_URL=https://your-site.netlify.app
```

### Verify CORS

```bash
curl -H "Origin: https://your-site.netlify.app" \
     -i https://your-api.run.app/health

# Look for header:
# Access-Control-Allow-Origin: https://your-site.netlify.app
```

## Step 6: Configure Custom Domain (Optional)

### Add Custom Domain to Netlify

1. **Site Settings** → **Domain Management**
2. **Add custom domain**
3. Enter your domain (e.g., `lebrq.com`)
4. Update DNS settings (Netlify provides instructions)
5. Wait for HTTPS certificate (automatic)

### DNS Configuration

Netlify provides DNS records to add:

```
Type: CNAME
Name: lebrq.com
Value: your-site.netlify.app
```

Or use Netlify DNS for easier management.

## Step 7: Test Everything

### Pre-Migration Checklist

Before taking down cPanel, verify:

- [ ] Site loads on Netlify domain
- [ ] Routes work (refresh page)
- [ ] API calls work
- [ ] Images load
- [ ] CSS styling applied
- [ ] Forms submit successfully
- [ ] Authentication works
- [ ] Payments/checkout works (if applicable)

### Test Commands

```bash
# Test API connectivity
fetch(apiConfig.baseUrl + '/health')
  .then(r => r.json())
  .then(console.log)

# Test specific endpoints
fetch(apiConfig.baseUrl + '/items')
  .then(r => r.json())
  .then(console.log)
```

## Step 8: Migrate DNS

### Option A: Point Domain to Netlify

**Update your domain registrar DNS:**

```
Type: CNAME
Host: lebrq.com
Target: your-site.netlify.app
TTL: 3600
```

Wait 5-15 minutes for DNS propagation.

### Option B: Netlify DNS

For easier management:

1. **In Netlify:** Site Settings → Domain Management
2. **Change nameservers** to Netlify's nameservers
3. Update in domain registrar
4. Wait for propagation

## Step 9: Remove cPanel Hosting

### Before Removing

1. **Backup everything**
   ```bash
   # Download all files from cPanel
   # (via FTP, File Manager, or cPanel backup feature)
   ```

2. **Verify Netlify is working**
   - Test production domain
   - Check all features work

3. **Monitor 404 errors**
   - Keep old domain for 24-48 hours
   - Ensure no broken links

### Cancel cPanel

1. **In your hosting provider's dashboard:**
   - Terminate/cancel cPanel account
   - Or disable the website

2. **Update DNS to point elsewhere**
   - If keeping domain, point to Netlify
   - If not using domain, no action needed

## Step 10: Monitor & Troubleshoot

### Check Deploy Status

```bash
netlify status
```

### View Deploy Logs

In Netlify UI:
- **Deploys** tab
- Click latest deploy
- Check logs for errors

### Monitor Site Health

Set up monitoring to catch issues:
- Netlify Monitoring
- StatusPage
- Pingdom
- New Relic

## Common Issues & Solutions

### Issue: 404 on Page Refresh

**Solution:** Already handled by `netlify.toml`

```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### Issue: API Calls Failing

**Check:**
1. Environment variable set? (`EXPO_PUBLIC_API_URL`)
2. Backend running? (`curl https://your-api.run.app/health`)
3. CORS configured? (Backend should allow Netlify domain)
4. HTTPS? (Not HTTP)

**Solution:**
```javascript
// In browser console, check:
console.log(apiConfig.baseUrl)
console.log(apiConfig.getEnvironment())
```

### Issue: Old Content Cached

**Solution:** Clear Netlify cache

In Netlify UI:
1. Site Settings → Builds & Deploy
2. **Purge cache**
3. Trigger deploy

### Issue: Slow Page Loads

**Solution:**

1. Optimize images in build
2. Check bundle size
3. Enable caching headers (already done)

```bash
# Analyze bundle
npm run export:web
ls -lh dist/
```

## Migration Checklist

- [ ] Code pushed to Git
- [ ] `netlify.toml` configured
- [ ] `_redirects` file exists
- [ ] `.env.example` updated
- [ ] cPanel-specific code removed
- [ ] Netlify site created
- [ ] Environment variables set
- [ ] Build succeeds (check logs)
- [ ] Site loads on netlify.app domain
- [ ] Routes work (refresh page)
- [ ] API calls work
- [ ] Custom domain configured (optional)
- [ ] DNS updated
- [ ] Backend CORS updated
- [ ] Tested all features
- [ ] cPanel hosting canceled
- [ ] Monitoring set up

## Post-Migration

### Regular Maintenance

- Monitor Netlify deploy logs
- Check for failed builds
- Monitor API connectivity
- Review performance metrics

### Performance Optimization

- Images optimized
- Bundle size monitored
- Caching properly configured
- CDN edges working

### Backups

- Git repo is your backup
- Keep old cPanel backup for 30 days
- Use Netlify deployments history

## Getting Help

- [Netlify Docs](https://docs.netlify.com)
- [Netlify Support](https://support.netlify.com)
- [Expo Docs](https://docs.expo.dev)
- [FastAPI Docs](https://fastapi.tiangolo.com)

## Summary

You've successfully migrated from cPanel to Netlify! 🎉

**Key benefits:**
- ✅ Automatic HTTPS everywhere
- ✅ Global CDN for fast content delivery
- ✅ Git-based deployments
- ✅ Environment variable management
- ✅ Automatic builds on push
- ✅ Better monitoring and logs
- ✅ Lower maintenance burden

**Your new architecture:**
```
Git Repository
    ↓
Netlify (builds & hosts)
    ↓
Browser (loads from CDN)
    ↓
Cloud Run Backend API (FastAPI)
    ↓
Supabase (PostgreSQL)
```

No more cPanel! 🚀
