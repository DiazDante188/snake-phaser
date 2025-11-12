const CACHE = 'snake-v18';
const ASSETS = [
  './',
  './index.html',
  './game.js',
  'icons/icon-192.png',
  'icons/icon-512.png'
];
  'https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.min.js'
];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
});
self.addEventListener('activate', e=>{
  e.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', e=>{
  e.respondWith(
    caches.match(e.request).then(r=> r || fetch(e.request))
  );
});
