// Service worker: pre-cache the whole shell so the app opens with no signal,
// which on an ipad on a stand at night is most of the time.
//
// Cache-first on a fixed, versioned list. Bump VERSION whenever any file in
// ASSETS changes, or the installed app keeps serving the old copy.

const VERSION = 'small-potatoes-v6';

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/theme.css',
  './css/app.css',
  './js/app.js',
  './js/day.js',
  './js/ink.js',
  './js/prompts.js',
  './js/quips.js',
  './js/store.js',
  './js/strokes.js',
  './icons/mascot-small.svg',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then(async (cache) => {
      // `cache: 'reload'` goes past the browser's own http cache. Pages
      // serves files with a ten-minute max-age, and a plain addAll in the
      // minutes after a deploy would fill the new cache with the old shell
      // it was meant to replace. All or nothing: a half-cached app is worse
      // than one that failed to install.
      await Promise.all(ASSETS.map(async (url) => {
        const response = await fetch(url, { cache: 'reload' });
        if (!response.ok) throw new Error(`could not cache ${url}: ${response.status}`);
        await cache.put(url, response);
      }));
      await self.skipWaiting();
    }),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== VERSION).map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((hit) => {
      if (hit) return hit;

      return fetch(request).catch(() => {
        // A navigation that misses the cache while offline still has to land
        // somewhere. The shell renders itself from IndexedDB.
        if (request.mode === 'navigate') return caches.match('./index.html');
        throw new Error('offline and not cached');
      });
    }),
  );
});
