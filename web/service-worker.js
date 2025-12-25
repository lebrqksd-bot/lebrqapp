/*
  Very basic service worker for offline caching
  - Caches core assets on install
  - Serves cached responses when offline
*/

const CACHE_NAME = 'lebrq-cache-v3'; // Updated to force cache refresh after admin updates
const CORE_ASSETS = [
  '/',
  '/index.html'
  // Note: Expo will fingerprint assets; this is a minimal shell cache.
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => (key !== CACHE_NAME ? caches.delete(key) : undefined)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // NEVER cache API requests - always fetch fresh from server
  if (url.pathname.includes('/api/') || url.pathname.startsWith('/api')) {
    event.respondWith(
      fetch(request).catch((error) => {
        // If fetch fails, return a network error response instead of cached content
        return new Response(
          JSON.stringify({ error: 'Network error', message: 'Unable to connect to server' }),
          {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'application/json' },
          }
        );
      })
    );
    return;
  }
  
  // Only handle GET for static assets
  if (request.method !== 'GET') {
    event.respondWith(fetch(request));
    return;
  }
  
  // Don't cache dynamic pages or content pages - always fetch fresh
  // This ensures client sees updates immediately after admin changes
  if (url.pathname.includes('/about') || 
      url.pathname.includes('/content-pages') ||
      url.pathname.includes('/venue/') ||
      url.pathname.includes('/book/') ||
      url.pathname.includes('/rack/') ||
      url.pathname.includes('/admin/')) {
    event.respondWith(fetch(request));
    return;
  }

  // For static assets only, use cache-first strategy
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          // Only cache successful, same-origin, non-API responses
          const copy = response.clone();
          if (response.ok && (url.origin === location.origin) && !url.pathname.includes('/api/')) {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => {
          // Return network error instead of cached content for failed requests
          return new Response('Network error', { status: 503 });
        });
    })
  );
});
