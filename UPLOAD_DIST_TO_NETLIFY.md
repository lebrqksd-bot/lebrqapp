# Upload dist Folder to Netlify

## ✅ Your dist Folder is Ready!

Built with:
- ✅ Environment variable: `EXPO_PUBLIC_API_URL=https://fastapi-api-645233144944.asia-south1.run.app/api`
- ✅ Clean cache rebuild
- ✅ SPA routing configured
- ✅ All Cloud Run URLs embedded

---

## Upload to Netlify

### Option 1: Drag & Drop (Easiest)

1. Go to **https://app.netlify.com**
2. Click on your `lebrqapp` site
3. Go to **Deployments** tab
4. Find "Drag and drop your site folder here" area
5. Drag the `dist` folder from `c:\Users\HP\Desktop\LebrqApp\dist` onto Netlify
6. Wait for upload to complete

### Option 2: Netlify CLI

```powershell
cd "c:\Users\HP\Desktop\LebrqApp"

# Install Netlify CLI (if needed)
npm install -g netlify-cli

# Login to Netlify
netlify login

# Deploy
netlify deploy --prod --dir=dist
```

---

## Verify After Upload

1. **Wait** for Netlify deployment to finish
2. **Open** https://lebrqapp.netlify.app
3. **Press F12** → Go to **Network** tab
4. **Click anywhere** on the app to trigger API calls
5. **Look for** API requests like:
   - `/api/gallery/public`
   - `/api/bookings/regular-programs`
   - `/api/items`

**Expected URLs:**
```
✅ https://fastapi-api-645233144944.asia-south1.run.app/api/gallery/public
✅ https://fastapi-api-645233144944.asia-south1.run.app/api/bookings/...
```

**NOT:**
```
❌ https://taxtower.in:8002/api/gallery/public
```

---

## If Still Seeing taxtower.in

1. **Clear Netlify cache:**
   - Site settings → Deployments → Find old deploy → Delete
   
2. **Hard refresh:**
   - `Ctrl + Shift + R` (Windows)
   - `Cmd + Shift + R` (Mac)

3. **Clear browser cache:**
   - DevTools → Application → Clear storage → Clear site data

4. **Re-upload fresh dist:**
   - Delete current deployment
   - Drag new dist folder to Netlify

---

## What's Inside dist/

```
dist/
├── _redirects          ← SPA routing
├── _expo/              ← Bundled app
│   └── static/js/
│       └── web/
│           └── entry-*.js   ← Contains Cloud Run URL
├── 404.html            ← SPA fallback
└── index.html          ← Netlify main file
```

**All API URLs in these files point to Cloud Run! ✅**

---

**Ready to upload? Go to Netlify and drag the dist folder!** 🚀
