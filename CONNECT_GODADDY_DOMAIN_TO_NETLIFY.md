# Connect GoDaddy Domain to Netlify - Step by Step

## Overview
This guide connects your GoDaddy domain to your Netlify site (`lebrqapp.netlify.app`).

---

## **Method 1: Using Netlify Nameservers** ⭐ (Recommended)

Netlify manages all DNS for you automatically.

### Step 1: Get Netlify Nameservers

1. Go to **https://app.netlify.com**
2. Select your `lebrqapp` site
3. Click **Site settings** → **Domain settings**
4. Scroll to **Netlify DNS** section
5. Click **"Set up Netlify DNS"** (or similar button)
6. Netlify shows you **4 nameservers** to copy:
   - Example:
     ```
     dns1.p01.nsone.net
     dns2.p01.nsone.net
     dns3.p01.nsone.net
     dns4.p01.nsone.net
     ```
7. **Copy these nameservers** - you'll need them next

### Step 2: Update GoDaddy Nameservers

1. Go to **https://godaddy.com** → **Sign in**
2. Click **"Domains"** (left menu)
3. Find your domain and click it
4. Click **"Manage DNS"** or **"DNS Settings"**
5. Under **Nameservers**, click **"Change"**
6. Select **"Custom Nameservers"**
7. **Paste the 4 Netlify nameservers:**
   - Nameserver 1: `dns1.p01.nsone.net`
   - Nameserver 2: `dns2.p01.nsone.net`
   - Nameserver 3: `dns3.p01.nsone.net`
   - Nameserver 4: `dns4.p01.nsone.net`
8. Click **"Save"**

### Step 3: Point Domain to Netlify (Netlify Side)

1. Back in **Netlify** → **Site settings** → **Domain settings**
2. Under **"Custom domains"**, click **"Add custom domain"**
3. Enter your GoDaddy domain (e.g., `yourdomain.com`)
4. Click **"Verify"**
5. If verification succeeds, you'll see a checkmark ✅

### Step 4: Wait for Propagation

DNS changes take **24-48 hours** to fully propagate.

**Check status:**
```bash
# Check if domain points to Netlify
nslookup yourdomain.com
```

Look for Netlify IP address in results.

---

## **Method 2: Using A Records & CNAME** (Alternative)

If you don't want to change nameservers.

### Step 1: Get Netlify IP & CNAME

1. **Netlify** → **Site settings** → **Domain settings**
2. Look for:
   - **Netlify IP address** (usually `75.2.60.5` or similar)
   - **CNAME target** (usually `lebrqapp.netlify.app`)

### Step 2: Update GoDaddy DNS Records

1. **GoDaddy** → **Domains** → Your domain → **Manage DNS**
2. Find **DNS Records** section
3. **Add/Edit records:**

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | @ (or blank) | `75.2.60.5` | 600 |
| CNAME | www | `lebrqapp.netlify.app` | 600 |

4. **Save** all records

### Step 3: Verify in Netlify

1. **Netlify** → **Site settings** → **Domain settings**
2. Add custom domain
3. Should show as verified ✅

---

## **Step 3: SSL Certificate (Both Methods)**

Netlify automatically provisions free **SSL/TLS certificates** via Let's Encrypt.

**Verify in Netlify:**
1. **Site settings** → **Domain settings**
2. Under your domain, you should see:
   - ✅ `yourdomain.com` (SSL Certificate valid)
   - ✅ `www.yourdomain.com` (SSL Certificate valid)

If not showing, click **"Verify DNS configuration"**.

---

## **Step 4: Update Environment Variables**

Once domain is working, update your backend CORS:

### In Google Cloud Run:

```bash
gcloud run services update fastapi-api \
  --region asia-south1 \
  --set-env-vars CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com,https://lebrqapp.netlify.app
```

Or in **Cloud Console:**
1. Go to **Cloud Run** → `fastapi-api`
2. Click **Edit** → **Environment variables**
3. Add/update `CORS_ORIGINS`:
   ```
   https://yourdomain.com,https://www.yourdomain.com,https://lebrqapp.netlify.app
   ```
4. Click **Deploy**

### In Netlify (Optional):

If you want to use your custom domain instead of `lebrqapp.netlify.app`:

1. **Site settings** → **Build & deploy** → **Environment**
2. Update `EXPO_PUBLIC_API_URL`:
   ```
   https://fastapi-api-645233144944.asia-south1.run.app/api
   ```
   (Stay the same - backend URL doesn't change)

---

## **Step 5: Verify Everything**

### Test Your Domain

```bash
# Should show your site
curl https://yourdomain.com

# Should show Netlify redirect (both www and non-www work)
curl https://www.yourdomain.com
```

### Test API from Your Domain

```bash
# Frontend on your domain
curl https://yourdomain.com

# Frontend should call backend
# Check browser console: Network tab
# API calls should go to: https://fastapi-api-645233144944.asia-south1.run.app/api
```

---

## **Troubleshooting**

### Domain still shows "Not connected"

**Solution:**
1. Clear Netlify cache: **Site settings** → **Build & deploy** → **Trigger deploy**
2. Wait 24-48 hours for DNS propagation
3. Verify nameservers with: `nslookup yourdomain.com`

### SSL Certificate not issuing

**Solution:**
1. Ensure domain is actually pointing to Netlify
2. Click **"Verify DNS configuration"** in Netlify
3. Wait 24 hours
4. If still failing, contact Netlify support

### API calls failing from domain

**Solution:**
1. Check CORS is configured:
   ```bash
   gcloud run services describe fastapi-api --region asia-south1
   ```
   Look for `CORS_ORIGINS` env var with your domain

2. Check backend is running:
   ```bash
   curl https://fastapi-api-645233144944.asia-south1.run.app/api/items
   ```

3. Check frontend is calling correct URL:
   - Open browser DevTools → Network
   - Look for API calls in Network tab
   - Should go to `https://fastapi-api-645233144944.asia-south1.run.app/api/...`

---

## **Quick Reference**

| Step | Action | Where |
|------|--------|-------|
| 1 | Get Netlify nameservers | Netlify → Site settings → Domain settings |
| 2 | Update GoDaddy nameservers | GoDaddy.com → Domains → DNS |
| 3 | Add custom domain in Netlify | Netlify → Site settings → Domain settings |
| 4 | Wait for propagation | 24-48 hours |
| 5 | Update backend CORS | Cloud Run → Environment variables |
| 6 | Verify SSL | Netlify → Domain settings (should show ✅) |

---

## **What You'll Have After**

✅ Domain points to Netlify  
✅ Netlify frontend running on `yourdomain.com`  
✅ Free SSL/TLS certificate (HTTPS)  
✅ API calls work from domain to backend  
✅ Production-ready setup!

---

**Questions?** Check Netlify docs: https://docs.netlify.com/domains-https/custom-domains/
