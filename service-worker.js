// 版本號：改動 index.html / icons 後把這裡 +1，舊快取會在 activate 時清掉。
const VERSION = 'v2';
const SHELL_CACHE = `kana-shell-${VERSION}`;
const FONT_CACHE  = `kana-fonts-${VERSION}`;

// 路徑一律相對於 service-worker.js 所在位置，
// 這樣換 domain 或搬到不同子目錄都不用改（原本寫死 /kana-game/，本機開發就壞）。
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/kana-icon-96.png',
  './icons/kana-icon-144.png',
  './icons/kana-icon-192.png',
  './icons/kana-icon-512.png',
];

const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  const keep = [SHELL_CACHE, FONT_CACHE];
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => !keep.includes(k)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Firestore / Analytics 一律走網路，永遠不要快取（快取排行榜會拿到過期資料）
  if (url.hostname.endsWith('googleapis.com') && !FONT_HOSTS.includes(url.hostname)) return;
  if (url.hostname === 'www.google-analytics.com') return;

  // 字體：stale-while-revalidate，離線時仍有字可用
  if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(req, FONT_CACHE));
    return;
  }

  // 頁面導覽 / HTML：network-first。
  // 原本 cache-first 會讓已安裝的使用者永遠停在舊版，之後推的修正全部收不到。
  const isHtml = req.mode === 'navigate'
    || req.destination === 'document'
    || (url.origin === self.location.origin
        && (url.pathname.endsWith('/') || url.pathname.endsWith('.html')));
  if (isHtml) {
    event.respondWith(networkFirst(req));
    return;
  }

  // 其餘同源靜態資源（icons、manifest）：cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(req, SHELL_CACHE));
  }
});

async function networkFirst(req) {
  try {
    const res = await fetch(req);
    if (res && res.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(req, res.clone());
    }
    return res;
  } catch (err) {
    const cached = await caches.match(req);
    return cached || caches.match('./index.html') || Response.error();
  }
}

async function cacheFirst(req, cacheName) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res && res.ok) {
      const cache = await caches.open(cacheName);
      cache.put(req, res.clone());
    }
    return res;
  } catch (err) {
    return Response.error();
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const network = fetch(req)
    .then(res => {
      // 字體是 opaque response（type:'cors' 才有 ok），能存就存
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
      return res;
    })
    .catch(() => null);
  return cached || network.then(r => r || Response.error());
}
