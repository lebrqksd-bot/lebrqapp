# Final Steps - Deploy Everything

## ✅ What's Done

1. **Backend Deployed** (Google Cloud Run)
   - URL: `https://fastapi-api-645233144944.asia-south1.run.app/api`
   - Database: Supabase PostgreSQL
   - CORS: Configured for Netlify

2. **Frontend Code Updated** (All taxtower.in removed)
   - ✅ `constants/config.ts` - Cloud Run URL
   - ✅ `constants/whatsapp.ts` - Cloud Run URL
   - ✅ `constants/whatsapp-config.ts` - Cloud Run URL
   - ✅ `app.config.ts` - Cloud Run host
   - ✅ `web/.htaccess` - Cloud Run proxies
   - ✅ `app.json` - Cloud Run apiUrl
   - ✅ Built: `npm run export:web`
   - ✅ Pushed to GitHub

3. **Netlify Deployment** (Ready to trigger)

---

## 🚀 Final Step: Redeploy on Netlify

1. **Go to:** https://app.netlify.com
2. **Select:** Your `lebrqapp` site
3. **Navigate to:** Deployments tab
4. **Click:** "Trigger deploy" → "Deploy site"

Netlify will:
- Pull latest code from GitHub
- Run `npm run export:web`
- Deploy to CDN with new Cloud Run URLs

---

## ✅ Verification After Deploy

Once Netlify finishes deploying:

1. **Visit:** https://lebrqapp.netlify.app
2. **Open DevTools:** F12 → Network tab
3. **Navigate page** → Look for API calls
4. **Verify URL:** Should show `fastapi-api-645233144944.asia-south1.run.app`

**Expected API calls:**
```
GET https://fastapi-api-645233144944.asia-south1.run.app/api/bookings/regular-programs
GET https://fastapi-api-645233144944.asia-south1.run.app/api/items
GET https://fastapi-api-645233144944.asia-south1.run.app/api/...
```

NOT:
```
❌ https://taxtower.in:8002/api/... (old - should be gone)
```

---

## 📋 Complete Architecture

```
Frontend (Netlify)
├─ https://lebrqapp.netlify.app
├─ Built from: GitHub main branch
└─ Calls API: https://fastapi-api-645233144944.asia-south1.run.app/api

Backend (Google Cloud Run)
├─ https://fastapi-api-645233144944.asia-south1.run.app
├─ FastAPI + SQLAlchemy
└─ Database: Supabase PostgreSQL

Domain (GoDaddy → Netlify)
├─ yourdomain.com → lebrqapp.netlify.app
└─ Optional: Points frontend to custom domain
```

---

## ❌ If Still Seeing taxtower.in Requests

**Causes:**
1. Netlify cache - Clear it:
   - Site settings → Deployments → Clear cache & deploy
2. Browser cache - Hard refresh:
   - Ctrl + Shift + R (Windows)
   - Cmd + Shift + R (Mac)
3. Old build still live - Wait for new deployment
   - Check "Deployments" tab shows newest deploy as "Published"

---

## 🎯 All Set!

Everything is configured to use your Cloud Run backend. 

**Next:** Trigger the Netlify deploy and verify API calls are going to Cloud Run! 🚀
