/*
 * sw.js — offline app shell.
 * Bump CACHE when you change any file below, so browsers pick up the new copy.
 */
const CACHE = 'life-balance-v2';

const SHELL = [
  './',
  'index.html',
  'styles.css',
  'manifest.webmanifest',
  'js/model.js',
  'js/store.js',
  'js/lock.js',
  'js/ui.js',
  'js/habits.js',
  'js/quests.js',
  'js/goals.js',
  'js/report.js',
  'js/app.js',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE)
      .then(function (cache) { return cache.addAll(SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (names) {
        return Promise.all(names.filter(function (name) { return name !== CACHE; })
          .map(function (name) { return caches.delete(name); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  // Navigations fall back to the cached shell so the app opens offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(function () {
        return caches.match('index.html');
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(function (cached) {
      const network = fetch(request).then(function (response) {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE).then(function (cache) { cache.put(request, copy); });
        }
        return response;
      }).catch(function () { return cached; });
      return cached || network;
    })
  );
});
