# SPA Route Refresh 404 Fix (Static Hosting)

When hosting the Expo Router web export as static files, direct URL access like `/venue/grant-hall` can 404 unless the host rewrites requests to `index.html`.

This repo includes a post-export step that:
- Copies `dist/index.html` to `dist/404.html` and `dist/200.html` (useful for GitHub Pages/Surge)
- Writes `dist/_redirects` with `/* /index.html 200` (Netlify-style rewrite)

Run:

```bash
npm run export:web
```

Then deploy the `dist/` folder.

## Nginx (lebrq.com)
If you serve `dist/` via Nginx, add an SPA rewrite:

```
server {
  listen 80;
  server_name lebrq.com www.lebrq.com;
  root /var/www/lebrq/dist;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }

  # Cache static assets aggressively
  location ~* \.(?:js|css|png|jpg|jpeg|svg|webp|ico)$ {
    try_files $uri =404;
    expires 30d;
    add_header Cache-Control "public, max-age=2592000, immutable";
  }
}
```

## Apache (.htaccess)

```
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

### Apache with API Proxy and Extras

Place the following `.htaccess` next to `index.html` (e.g., inside the `dist/` directory after `npm run export:web`). This version includes:
- Static file passthrough for `/static/`
- Reverse proxy for API requests to FastAPI on `127.0.0.1:8000`
- SPA fallback to `index.html`
- CORS headers and compression
 - Immutable caching for hashed assets; no-cache for `service-worker.js`

```
# Enable rewrite engine
RewriteEngine On

# Ensure index is the default document
DirectoryIndex index.html

#####################################
# 1. Serve static files directly
#####################################
RewriteCond %{REQUEST_URI} ^/static/
RewriteCond %{REQUEST_FILENAME} -f
RewriteRule ^ - [L]

#####################################
# 2. Proxy API requests to FastAPI
#####################################
RewriteCond %{REQUEST_URI} ^/api/
RewriteRule ^api/(.*)$ https://taxtower.in:8002/api/$1 [P,L]

<IfModule mod_proxy.c>
  # For cross-host reverse proxying, do not preserve frontend Host header
  ProxyPreserveHost Off
  # Helps fix redirects and Location headers coming from backend
  ProxyPassReverse /api/ https://taxtower.in:8002/api/
</IfModule>

#####################################
# 3. SPA fallback (IMPORTANT FIX)
#####################################
# If file or directory does NOT exist
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^ index.html [L]

#####################################
# 4. CORS headers
#####################################
<IfModule mod_headers.c>
    Header always set Access-Control-Allow-Origin "*"
    Header always set Access-Control-Allow-Methods "GET, POST, OPTIONS"
    Header always set Access-Control-Allow-Headers "Content-Type, Authorization"

  # Aggressive caching for static assets with content hashes
  <FilesMatch "\.(js|css|woff2?|svg|ico)$">
    Header set Cache-Control "public, max-age=2592000, immutable"
  </FilesMatch>

    <FilesMatch "\.(jpg|jpeg|png|gif|webp|pdf|mp4|mp3|wav)$">
        Header set Cache-Control "public, max-age=86400"
    </FilesMatch>

  # Service worker should not be cached to ensure timely updates
  <Files "service-worker.js">
    Header set Cache-Control "no-cache, no-store, must-revalidate"
  </Files>
</IfModule>

#####################################
# 5. Compression
#####################################
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE \
      text/html text/plain text/css text/javascript \
      application/javascript application/json
</IfModule>

# Requirements:
# - Enable Apache modules: mod_rewrite, mod_proxy, mod_proxy_http, mod_headers, mod_deflate, mod_ssl
# - Ensure your VirtualHost or Directory config has: AllowOverride All
# - If API is elsewhere, update the proxy target in the rule above
# - Copy this file into your web root (same folder as index.html). If you export to `dist/`, copy to `dist/.htaccess` before upload.
# - When proxying to an HTTPS upstream, `SSLProxyEngine On` must be set in the VirtualHost (not in .htaccess).
```

## Netlify
- The export writes `_redirects` automatically:
  - `/* /index.html 200`

## Vercel
Add `vercel.json` at the project root:

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

## Cloudflare Pages
- Project → Build Settings → Custom 404: upload `dist/404.html`
- Or add `_routes.json` with a catch-all that serves `index.html` (Pages framework auto-detect also works)

## Summary
- Always rewrite unknown paths to `index.html` for SPA routing
- Use `npm run export:web` so the fallbacks are generated automatically
