const CACHE = 'blossom-biz-v9';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
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

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
