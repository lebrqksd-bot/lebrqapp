# Netlify Deployment Quick Reference

## TL;DR - Deploy in 3 Steps

### 1. Set Environment Variable in Netlify

```
EXPO_PUBLIC_API_URL = https://your-api.run.app/api
```

### 2. Trigger Deploy

```bash
netlify deploy --prod
# OR push to Git if auto-deploy is enabled
```

### 3. Verify

```javascript
// In browser console
apiConfig.logConfig()
```

---

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| `netlify.toml` | Build & routing config | ✅ Created |
| `_redirects` | SPA routing backup | ✅ Created |
| `.env.example` | Environment template | ✅ Updated |
| `lib/netlifyApiConfig.ts` | API URL resolution | ✅ Created |
| `package.json` | Build script | ✅ Has `export:web` |

## Build Configuration

```toml
# netlify.toml
command = "npm run export:web"
publish = "dist"
```

## Routing Configuration

```toml
# SPA routing: all URLs → index.html
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

## Environment Variables

| Variable | Value |
|----------|-------|
| `EXPO_PUBLIC_API_URL` | `https://your-api.run.app/api` |
| `NODE_ENV` | `production` (auto) |

## API Configuration in Code

```typescript
// Automatically resolves:
// 1. EXPO_PUBLIC_API_URL env var
// 2. Production domain detection
// 3. Development fallback (localhost)

const API_BASE_URL = resolveApiUrl();

// Usage:
const items = await apiClient.get('/items');
```

## Common Tasks

### Deploy Latest Changes

```bash
netlify deploy --prod
```

### View Build Logs

```bash
netlify logs
```

### Check Site Status

```bash
netlify status
```

### Test API Connectivity

```javascript
// In browser console
fetch(apiConfig.baseUrl + '/health')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error)
```

### Verify Environment Variables

```javascript
// In browser console
console.log('API URL:', apiConfig.baseUrl)
console.log('Environment:', apiConfig.getEnvironment())
console.log('Production?', apiConfig.isProduction())
```

## Troubleshooting

### API Calls Failing

1. Check environment variable set:
   ```javascript
   console.log(apiConfig.baseUrl)
   ```

2. Check backend running:
   ```bash
   curl https://your-api.run.app/health
   ```

3. Check CORS configured:
   ```
   Backend CORS_ORIGINS must include Netlify domain
   ```

### 404 on Page Refresh

✅ Expected! The `netlify.toml` redirect handles it automatically.

### Build Failed

Check logs:
```bash
netlify logs
```

Common causes:
- Wrong `npm run export:web` output
- Missing `dist` folder
- Invalid `netlify.toml`

### Cache Issues

Clear and redeploy:
```bash
# In Netlify UI: Site Settings → Builds & Deploy → Purge cache
# Then redeploy
netlify deploy --prod
```

## DNS Configuration

### For Custom Domain

Update your registrar's DNS:

```
Type: CNAME
Name: yourdomain.com
Value: your-site.netlify.app
```

Or use Netlify's nameservers for easier management.

## Security Headers

Automatically set by `netlify.toml`:

```
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
```

## Caching Strategy

```toml
# Bundle files (1 year - content-hashed)
/_expo/* → Cache-Control: max-age=31536000, immutable

# Index HTML (5 minutes - allows frequent updates)
/index.html → Cache-Control: max-age=300, must-revalidate

# Assets (1 year - content-hashed)
/assets/* → Cache-Control: max-age=31536000, immutable
```

## Performance Metrics

Monitor in Netlify UI:
- Build time
- Site load time
- Deploy frequency
- Error rate

## No cPanel References

Removed:
- ❌ `.htaccess` files
- ❌ Absolute `/var/www/` paths
- ❌ Server-side authentication
- ❌ cPanel-specific configuration
- ❌ `web.config` (IIS)
- ❌ `php.ini` overrides

## Production Checklist

- [ ] `EXPO_PUBLIC_API_URL` set in Netlify
- [ ] Backend API HTTPS (not HTTP)
- [ ] Backend CORS includes Netlify domain
- [ ] Site loads on netlify.app domain
- [ ] Routes work (page refresh)
- [ ] API calls work
- [ ] Images load
- [ ] Forms submit
- [ ] Authentication works
- [ ] Build logs clean
- [ ] No console errors

## Next Steps

1. ✅ Files created/updated
2. ✅ Deploy to Netlify
3. ✅ Set environment variables
4. ✅ Verify API connectivity
5. ⏭ Configure custom domain (optional)
6. ⏭ Set up monitoring
7. ⏭ Configure backend CORS
8. ⏭ Test all features
9. ⏭ Cancel cPanel hosting

## References

- [Netlify Documentation](https://docs.netlify.com)
- [Full Deployment Guide](./NETLIFY_DEPLOYMENT.md)
- [Environment Setup Guide](./NETLIFY_ENV_SETUP.md)
- [cPanel Migration Guide](./CPANEL_TO_NETLIFY_MIGRATION.md)

## Support

For detailed instructions, see:
- `NETLIFY_DEPLOYMENT.md` - Complete guide
- `NETLIFY_ENV_SETUP.md` - Environment configuration
- `CPANEL_TO_NETLIFY_MIGRATION.md` - Migration from cPanel
