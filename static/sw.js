const CACHE = 'vaultx-v1';
const ASSETS = ['/static/style.css', '/static/main.js', '/static/flow.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});

self.addEventListener('fetch', e => {
  if (e.request.url.includes('/crypto') || e.request.url.includes('/news') || e.request.url.includes('/history')) return;
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
