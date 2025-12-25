// Simple post-export step to make SPA routes work on static hosts
// - Copies dist/index.html to dist/404.html and dist/200.html (for GitHub Pages/Surge)
// - Creates Netlify-style _redirects to rewrite all paths to /index.html

const fs = require('fs');
const path = require('path');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function copyIfExists(src, dest) {
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    return true;
  }
  return false;
}

try {
  const dist = process.env.EXPO_EXPORT_DIR || path.resolve(process.cwd(), 'dist');
  const indexHtml = path.join(dist, 'index.html');
  if (!fs.existsSync(indexHtml)) {
    console.warn('[post-export] dist/index.html not found, skipping SPA fallbacks');
    process.exit(0);
  }

  // Copy index.html to 404.html and 200.html for SPA fallback on static hosts
  const fourOhFour = path.join(dist, '404.html');
  const twoHundred = path.join(dist, '200.html');
  fs.copyFileSync(indexHtml, fourOhFour);
  fs.copyFileSync(indexHtml, twoHundred);
  console.log('[post-export] Created 404.html and 200.html');

  // Netlify redirects
  const redirectsPath = path.join(dist, '_redirects');
  const redirectsContent = '/* /index.html 200\n';
  fs.writeFileSync(redirectsPath, redirectsContent);
  console.log('[post-export] Wrote _redirects for SPA rewrite');

  // Render.com / static.json (optional)
  const staticJsonPath = path.join(dist, 'static.json');
  const staticJson = {
    root: '.',
    clean_urls: true,
    routes: {
      '/**': 'index.html'
    }
  };
  fs.writeFileSync(staticJsonPath, JSON.stringify(staticJson, null, 2));
  console.log('[post-export] Wrote static.json for Render SPA rewrite');

} catch (err) {
  console.error('[post-export] Error creating SPA fallbacks:', err);
  process.exit(1);
}
