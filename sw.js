/* ============================================================
   SERVICE WORKER
   ------------------------------------------------------------
   Network-first: whenever you're online, you always get the
   latest deployed files (important since this app changes
   often) — the cache is only a fallback for when you're offline
   or on a bad gym-basement connection. Bump CACHE_VERSION any
   time you want to force every device to drop old cached files.
   ============================================================ */

const CACHE_VERSION = 'iron-log-v6';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/storage.js',
  './js/sync.js',
  './js/progression.js',
  './js/recovery.js',
  './js/standards.js',
  './js/scheduler.js',
  './js/charts.js',
  './js/bodymap.js',
  './js/planreview.js',
  './js/ai.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_VERSION).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('./index.html');
    })
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  // Never cache/intercept calls to Google Gemini or the GitHub API —
  // those must always hit the network live.
  if (event.request.url.includes('generativelanguage.googleapis.com') ||
      event.request.url.includes('api.github.com')) return;

  event.respondWith(
    fetch(event.request, { cache: 'no-store' })
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
        return res;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html')))
  );
});
