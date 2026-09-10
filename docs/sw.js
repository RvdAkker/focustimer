const CACHE = 'focustimer-v3';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png', './klankschaal.mp3'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// Netwerk eerst (updates komen direct door), cache als fallback zodat de app ook zonder wifi start.
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // GitHub Pages serveert met max-age=600. Zonder no-store zou de pagina tot tien minuten na een
  // uitrol alsnog uit de browsercache komen; voor afbeeldingen en geluid is die cache juist prima.
  const isPagina = request.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html');
  const netwerk = isPagina ? fetch(url.href, { cache: 'no-store' }) : fetch(request);

  event.respondWith(
    netwerk
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('./index.html')))
  );
});
