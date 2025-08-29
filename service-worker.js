const CACHE_NAME = 'censo-agro-quixada-v3';
const urlsToCache = [
  '.',
  'index.html',
  'app.js',
  'style.css',
  'manifest.json',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0'
];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(urlsToCache))));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.open(CACHE_NAME).then(c => c.match(e.request).then(r => r || fetch(e.request).then(res => {c.put(e.request, res.clone()); return res;}))));
});
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(n => Promise.all(n.map(c => c !== CACHE_NAME && caches.delete(c))))));
