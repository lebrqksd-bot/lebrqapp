# Cloud Run Deployment Checklist

## ✅ Pre-Deployment Tasks

### Database Setup
- [ ] **Migration Applied**: Run `migration_clean.sql` on Supabase
  ```sql
  -- In Supabase SQL Editor, paste and execute:
  -- (contents of migration_clean.sql - 3039 lines)
  ```
  
- [ ] **Tables Verified**: Confirm all tables exist
  ```bash
  psql postgresql://postgres:pwd@host:6543/postgres -c "\dt"
  ```

### Code Updates (All Done ✅)
- [x] `main.py` - Updated with Cloud Run support
- [x] `Dockerfile` - Updated to use main.py entry point
- [x] `requirements.txt` - Already correct (no MySQL drivers)
- [x] `app/core.py` - Already correct (DATABASE_URL setup)
- [x] `app/db.py` - Already correct (async engine, pooling)
- [x] `app/dependencies.py` - Already correct (get_session)
- [x] All routers - No changes needed (async transparent)

### Environment Variables (Set Before Deploy)
- [ ] `DATABASE_URL` = `postgresql+asyncpg://postgres:<PASSWORD>@<PROJECT>.pooler.supabase.com:6543/postgres`
- [ ] `SECRET_KEY` = (long random string, 32+ chars)
- [ ] `GOOGLE_PLACES_API_KEY` = (optional, if using location features)
- [ ] `ADMIN_USERNAME` = (username for default admin)
- [ ] `ADMIN_PASSWORD` = (password for default admin)
- [ ] `POSTGRES_USER` = `postgres` (if not using DATABASE_URL)
- [ ] `POSTGRES_PASSWORD` = (if not using DATABASE_URL)
- [ ] `POSTGRES_HOST` = `<project>.pooler.supabase.com` (if not using DATABASE_URL)
- [ ] `POSTGRES_PORT` = `6543` (if not using DATABASE_URL)
- [ ] `POSTGRES_DB` = `postgres` (if not using DATABASE_URL)

---

## 🚀 Cloud Run Deployment Steps

### Option 1: Deploy via gcloud CLI

```bash
# Set your project ID
export PROJECT_ID="your-gcp-project"
export SERVICE_NAME="lebrq-backend"
export REGION="us-central1"

# Build and deploy
gcloud run deploy $SERVICE_NAME \
  --source . \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --timeout 60 \
  --max-instances 10 \
  --concurrency 80 \
  --set-env-vars DATABASE_URL="postgresql+asyncpg://postgres:<PASSWORD>@<PROJECT>.pooler.supabase.com:6543/postgres" \
  --set-env-vars SECRET_KEY="your-secret-key-here" \
  --project $PROJECT_ID

# Get the service URL
gcloud run services describe $SERVICE_NAME --region $REGION --project $PROJECT_ID --format='value(status.url)'
```

### Option 2: Deploy via Cloud Console

1. Go to **Cloud Run** in Google Cloud Console
2. Click **Create Service**
3. Select **Deploy one revision from an image**
4. Click **Set up Cloud Build** or use **Container Registry**
5. Configure:
   - **Service name**: `lebrq-backend`
   - **Region**: `us-central1`
   - **Authentication**: Allow unauthenticated invocations
   - **Memory**: 512 MiB
   - **CPU**: 1
   - **Timeout**: 60 seconds
   - **Max instances**: 10
   - **Concurrency**: 80
6. Click **Runtime settings** → **Advanced settings**
7. Add environment variables
8. Click **Deploy**

---

## 🧪 Post-Deployment Testing

### 1. **Health Check**
```bash
curl https://$SERVICE_URL/health

# Expected response:
# {"status": "ok"}
```

### 2. **Database Connectivity**
```bash
curl https://$SERVICE_URL/db-test

# Expected response:
# {"db": "connected"}
# OR {"error": "..."} if database not accessible
```

### 3. **Sample API Calls** (adjust to your endpoints)
```bash
# Get a user (assuming you have user ID 1)
curl -X GET https://$SERVICE_URL/api/users/1 \
  -H "X-User-Id: 1" \
  -H "Content-Type: application/json"

# Create a booking (example - adjust to your schema)
curl -X POST https://$SERVICE_URL/api/bookings \
  -H "X-User-Id: 1" \
  -H "Content-Type: application/json" \
  -d '{"venue_id": 1, "space_id": 1, "start_datetime": "2025-01-01T10:00:00", "end_datetime": "2025-01-01T12:00:00"}'
```

### 4. **Verify Responses**
- [ ] Status code is same as before (200, 201, 400, 401, etc.)
- [ ] Response body is identical to MySQL version
- [ ] No "relation does not exist" errors
- [ ] No boolean type errors
- [ ] No backtick syntax errors

### 5. **Load Test** (optional)
```bash
# Install Apache Bench (if not installed)
# macOS: brew install httpd
# Ubuntu: sudo apt-get install apache2-utils

# Run 100 requests, 10 concurrent
ab -n 100 -c 10 https://$SERVICE_URL/health

# Check results - should show:
# - Requests per second: similar to MySQL version
# - Failed requests: 0
# - Total time: reasonable (usually under 10s)
```

---

## 📊 Monitoring & Logs

### View Cloud Run Logs
```bash
# Recent logs (last 50 lines)
gcloud run logs read lebrq-backend --region us-central1

# Follow logs (real-time)
gcloud alpha run logs read lebrq-backend --region us-central1 --follow

# Filter logs
gcloud run logs read lebrq-backend --region us-central1 --limit 100 | grep ERROR
```

### Cloud Console
1. Go to **Cloud Run** → Your service
2. Click **Logs** tab
3. View execution logs, error logs, and request details

### Key Log Messages to Look For
- ✅ `[Startup] Asyncio exception handler configured`
- ✅ `[DB] Production mode: Connectivity verified`
- ✅ `[Startup] ProxyHeadersMiddleware enabled`
- ✅ `[Startup] Memory protection middleware enabled`
- ❌ `ERROR: FATAL: could not connect to server` → Database connection issue
- ❌ `relation "table_name" does not exist` → Migration not applied
- ❌ `TypeError: column is boolean but got int` → Data type mismatch

---

## 🔧 Troubleshooting

### Issue: "Tenant or user not found" / Connection Refused
**Cause**: Database credentials incorrect or Supabase project not initialized
**Fix**:
1. Verify Supabase project is active and running
2. Double-check password (special characters must be URL-encoded)
3. Use Supabase connection string from Settings → Database → Connection string
4. Ensure IP whitelisting allows Cloud Run IP (usually automatic in Supabase)

```bash
# Test connection locally
export DATABASE_URL="postgresql://postgres:PASSWORD@HOST:6543/postgres"
python -c "import asyncio; from sqlalchemy.ext.asyncio import create_async_engine; print('Testing connection...'); engine = create_async_engine(DATABASE_URL); print('OK')"
```

### Issue: "relation 'users' does not exist"
**Cause**: migration_clean.sql was not applied to Supabase
**Fix**:
1. Go to Supabase SQL Editor
2. Paste contents of `migration_clean.sql`
3. Click "Run"
4. Verify no errors

### Issue: Request Timeout (504 Gateway Timeout)
**Cause**: Too slow database or network
**Fix**:
1. Check Cloud Run logs for slow queries
2. Increase timeout in `app/core.py` line ~250
3. Check database performance in Supabase console
4. Increase Cloud Run memory (512Mi → 1Gi)

### Issue: Out of Memory (OOMKilled)
**Cause**: Memory leak or insufficient Cloud Run memory
**Fix**:
1. Increase Cloud Run memory: 512Mi → 1Gi
2. Reduce connection pool size in `app/db.py`:
   ```python
   POOL_SIZE = 3      # Reduced from 5
   MAX_OVERFLOW = 3   # Reduced from 5
   ```
3. Check logs for memory protection warnings

### Issue: 403 Forbidden on /static routes
**Cause**: Static files not configured for Cloud Run
**Fix**: Use Cloud CDN or nginx reverse proxy instead of FastAPI static serving (recommended for production)

---

## 📈 Performance Expectations

### After Migration (PostgreSQL on Supabase)

| Metric | MySQL (cPanel) | PostgreSQL (Supabase) | Notes |
|--------|-----------------|----------------------|-------|
| Response time | ~100-200ms | ~80-150ms | Async I/O is faster |
| Concurrent requests | 20-30 | 80-100 | Cloud Run allows more concurrency |
| Memory usage | Stable | 150-200MB | Connection pooling reuses memory |
| Database latency | Variable | Consistent | Dedicated connection pool |
| Failover time | N/A | <30s | Supabase handles failover |
| Backups | Manual | Automatic daily | Supabase feature |

---

## 🚨 Rollback Plan

### If Issues Occur:

1. **Immediate Rollback** (stop serving new traffic)
   ```bash
   gcloud run services update-traffic lebrq-backend \
     --to-revisions PREVIOUS=100 \
     --region us-central1
   ```

2. **Deploy Previous Code**
   ```bash
   git revert <commit-hash>
   git push
   # Wait for Cloud Build to redeploy
   ```

3. **Restore Database**
   - Go to Supabase → Database → Backups
   - Click "Restore" on a previous backup
   - Confirm and wait for restore

4. **Verify Rollback**
   ```bash
   curl https://$SERVICE_URL/health
   # Should show old behavior
   ```

---

## ✅ Final Verification Checklist

After deployment, verify:

- [ ] **Health endpoint works**: `/health` returns `{"status": "ok"}`
- [ ] **Database connected**: `/db-test` returns `{"db": "connected"}`
- [ ] **All APIs respond**: GET/POST/PUT/DELETE to your endpoints work
- [ ] **Response format correct**: Same JSON structure as before
- [ ] **Authentication works**: X-User-Id header properly validated
- [ ] **No errors in logs**: Check Cloud Run logs for ERROR or WARNING
- [ ] **Performance acceptable**: Response times < 500ms for typical requests
- [ ] **Memory stable**: Not growing over time
- [ ] **Handles concurrency**: Multiple simultaneous requests succeed
- [ ] **Proper CORS headers**: Requests from frontend work

---

## 📞 Support & Issues

If deployment issues occur:

1. **Check logs first**:
   ```bash
   gcloud run logs read lebrq-backend --region us-central1 --limit 200
   ```

2. **Test database connection**:
   ```bash
   # From Cloud Run service
   curl https://$SERVICE_URL/db-test
   
   # From local machine
   psql postgresql://postgres:pwd@host:6543/postgres -c "SELECT 1"
   ```

3. **Verify migration applied**:
   ```bash
   psql postgresql://postgres:pwd@host:6543/postgres -c "\dt"
   # Should show all tables from migration_clean.sql
   ```

4. **Check environment variables**:
   ```bash
   gcloud run services describe lebrq-backend --region us-central1 --format='value(spec.template.spec.containers[0].env)'
   ```

---

## 🎉 Deployment Complete

Once all checks pass, your backend is successfully running on:
- **Platform**: Cloud Run (Google Cloud)
- **Database**: PostgreSQL (Supabase)
- **Language**: Python/FastAPI
- **Runtime**: Async with uvicorn
- **Scalability**: Auto-scaling 0-10 instances

Your APIs behave identically to the MySQL version, but with better performance and reliability.

