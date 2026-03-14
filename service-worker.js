const CACHE_NAME = 'kana-game-v1';
const ASSETS = [
  '/kana-game/',
  '/kana-game/index.html',
  '/kana-game/manifest.json',
  '/kana-game/icons/kana-icon-96.png',
  '/kana-game/icons/kana-icon-144.png',
  '/kana-game/icons/kana-icon-192.png',
  '/kana-game/icons/kana-icon-512.png',
];

// Install: cache all assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: cache first, fallback to network
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).catch(() => caches.match('/kana-game/'));
    })
  );
});
