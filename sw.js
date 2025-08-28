const CACHE_NAME = "jayara-cache-v3"; // Increment version when updating
const urlsToCache = [
  "./",
  "./index.html",
  "./style.css",
  "./apps.js",
  "./manifest.json"
];

// Install SW and cache files
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

// Activate SW and remove old caches
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      )
    )
  );
  self.clients.claim();
});

// Fetch handler
self.addEventListener("fetch", event => {
  const url = event.request.url;

  // Allow Firebase requests to go to network directly
  if (url.includes("firebaseio.com") || url.includes("fcm.googleapis.com")) return;

  // Network first, fallback to cache
  event.respondWith(
    fetch(event.request)
      .then(response => response)
      .catch(() => caches.match(event.request))
  );
});