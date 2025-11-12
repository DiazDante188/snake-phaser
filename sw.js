// sw.js — v22 (cache-first, auto-activate, offline-ready)
const CACHE = 'snake-v22';
const ASSETS = [
  './',
  './index.html',
  './game.js',
  './phaser.min.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// INSTALL — pre-cache all assets
self.addEventListener('install', e => {
  console.log('[SW] Installing...');
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting(); // activate immediately
});

// ACTIVATE — remove old caches, take control of clients
self.addEventListener('activate', e => {
  console.log('[SW] Activating...');
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim(); // take control of open pages right away
});

// FETCH — serve from cache first, then network fallback
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(hit => {
      if (hit) {
        console.log('[SW] Serving from cache:', e.request.url);
        return hit;
      }
      return fetch(e.request);
    })
  );
});
