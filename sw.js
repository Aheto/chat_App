// sw.js
const CACHE_NAME = 'miniopenstax-v1';
const CORE_ASSETS = [
  '/index.html',
  '/setup.html',
  '/premium.html',
  '/css/chat.css',
  '/js/groupManager.js',
  '/js/chatLogic.js',
  '/js/chatUI.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// Install: Cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting()) // Activate immediately
  );
});

// Activate: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(name => {
          if (name !== CACHE_NAME) {
            console.log('SW: Deleting old cache', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim()) // Take control of all pages immediately
  );
});

// Fetch: Cache-first strategy with network fallback
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip WhatsApp and external URLs
  if (request.url.startsWith('https://wa.me')) {
    return; // Let it go through normally
  }

  // Only handle same-origin requests
  if (new URL(request.url).origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse; // Return from cache
        }

        // Fetch from network and cache dynamically
        return fetch(request.clone())
          .then(networkResponse => {
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }

            // Cache lesson pages and HTML documents
            if (request.destination === 'document' || request.url.includes('/lessons/')) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME)
                .then(cache => cache.put(request, responseToCache));
            }

            return networkResponse;
          })
          .catch(() => {
            // Fallback for critical routes
            if (request.destination === 'document') {
              return caches.match('/index.html');
            }
          });
      })
  );
});
