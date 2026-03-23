const CACHE_NAME = 'assispro-cache-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest-admin.json',
  '/manifest-motoboy.json',
  'https://cdn-icons-png.flaticon.com/512/1048/1048953.png',
  'https://img.freepik.com/premium-photo/delivery-man-scooter-express-food-delivery-around-city-yellow-background-delivery-fast-high-speed-ai-generation_235573-2619.jpg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', event => {
  // For navigation requests, try network first, then cache, then fallback to index.html
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});
