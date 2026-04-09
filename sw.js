const CACHE_NAME = 'blossom-business-v1';
const urlsToCache = [
  '/My-blossom/',
  '/My-blossom/index.html',
  '/My-blossom/manifest.json',
  '/My-blossom/icon-192.png',
  '/My-blossom/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request).catch(() => caches.match('/My-blossom/'));
    })
  );
});
