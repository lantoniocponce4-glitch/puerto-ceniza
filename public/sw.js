/* Puerto Ceniza — service worker.
   Red primero: el juego siempre se carga en su versión más nueva.
   Si no hay conexión, usa la última copia guardada, así la práctica contra bots y el campo de tiro funcionan sin internet. */
const CACHE = 'pc-v1';
const SHELL = ['/', '/vendor/three-bundle.js?r=128', '/manifest.webmanifest', '/icon-192.png'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => { }));
});
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));

const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const same = url.origin === self.location.origin;
  if (same && (url.pathname.startsWith('/api/') || url.pathname === '/ws' || url.pathname === '/healthz')) return;
  if (!same && !FONT_HOSTS.includes(url.hostname)) return;
  // Three.js y las fuentes no cambian: caché primero
  if (!same || url.pathname.startsWith('/vendor/')) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok || r.type === 'opaque') { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); } return r; })));
    return;
  }
  e.respondWith(fetch(req).then(r => {
    if (r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }
    return r;
  }).catch(() => caches.match(req, { ignoreSearch: req.mode === 'navigate' }).then(hit => hit || (req.mode === 'navigate' ? caches.match('/') : Response.error()))));
});
