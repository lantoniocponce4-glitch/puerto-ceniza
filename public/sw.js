/* Puerto Ceniza — service worker mínimo: permite instalar la app; el juego siempre se carga desde la red. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => { });
