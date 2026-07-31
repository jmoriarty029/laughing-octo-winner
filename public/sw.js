const CACHE = 'love-ledger-cache-v3';
const ASSETS = [
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-192.png',
  '/icons/icon-maskable-512.png',
  '/favicon.ico'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => k !== CACHE && caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;

  // Only handle same-origin GET requests. Leave Firestore, fonts, and any
  // POST/streaming traffic completely alone so the service worker can't
  // interfere with real-time listeners or writes.
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Page loads: always try the network first so a new deploy shows up
  // immediately. Only fall back to the cached shell if actually offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Static assets: cache-first is fine, they're versioned by the CACHE name.
  e.respondWith(caches.match(req).then((r) => r || fetch(req)));
});
