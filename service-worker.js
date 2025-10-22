const CACHE_NAME = 'yabunishi-gomi-cache-v6';
const ASSET_BASE = self.location.href.replace(/service-worker\.js$/, '');
const RELATIVE_ASSETS = [
  './',
  './index.html',
  './styles/main.css',
  './scripts/app.js',
  './scripts/sw-register.js',
  './data/schedule.js',
  './data/schedule.csv',
  './manifest.json',
  './assets/yabunishi-gomicalendar.pdf',
  './icons/icon-192.png',
  './icons/icon-512.png',
];
const OFFLINE_ASSETS = RELATIVE_ASSETS.map((path) => new URL(path, ASSET_BASE).toString());
const FALLBACK_PAGE = new URL('./index.html', ASSET_BASE).toString();

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(OFFLINE_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.map((key) => (key === CACHE_NAME ? null : caches.delete(key)))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request)
        .then((response) => {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
          return response;
        })
        .catch(() => caches.match(FALLBACK_PAGE));
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          return undefined;
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow('./');
      }

      return undefined;
    }),
  );
});
