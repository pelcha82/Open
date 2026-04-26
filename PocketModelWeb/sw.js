self.addEventListener('install', event => {
  event.waitUntil(caches.open('pocketmodel-web-v1').then(cache => cache.addAll([
    './',
    './index.html',
    './styles.css',
    './manifest.webmanifest',
    './src/app.js',
    './src/runtime.js',
    './src/local-api.js'
  ])));
});

self.addEventListener('fetch', event => {
  event.respondWith(caches.match(event.request).then(response => response || fetch(event.request)));
});