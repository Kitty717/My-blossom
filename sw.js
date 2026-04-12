// Service Worker — Blossom Business
// Bumped cache version to force full reload after modularization
const CACHE_NAME = 'blossom-biz-v2';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './js/data.js',
  './js/utils.js',
  './js/finance.js',
  './js/inventory.js',
  './js/dashboard.js',
  './js/shipments.js',
  './js/customers.js',
  './js/flora.js',
  './js/currency.js',
  './js/invoices.js',
  './js/calendar.js',
  './js/notifications.js',
  './js/expenses.js',
  './js/supplies.js',
  './js/collections.js',
  './js/catalog.js',
  './js/stockcount.js',
  './js/bundles.js',
  './js/settings.js',
];

// Install — cache all assets
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
});

// Activate — delete old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — serve from cache, fall back to network
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
