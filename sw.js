const CACHE_NAME = "jayara-cache-v1";
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
});

// Serve from cache if offline
self.addEventListener("fetch", event => {
  const url = event.request.url;

  // Don't intercept Firebase or FCM requests
  if (url.includes("firebaseio.com") || url.includes("fcm.googleapis.com")) return;

  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});

// Activate & clean old caches
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => key !== CACHE_NAME && caches.delete(key)))
    )
  );
});