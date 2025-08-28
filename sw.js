const CACHE_NAME = "jayara-cache-v3"; // increment version
const urlsToCache = [
  "./",
  "./index.html",
  "./style.css",
  "./apps.js",
  "./manifest.json"
];

// Install service worker and cache core files
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting(); // activate new SW immediately
});

// Activate and remove old caches
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
  self.clients.claim(); // take control immediately
});

// Fetch handler
self.addEventListener("fetch", event => {
  const url = event.request.url;

  // 🔹 Allow Firebase requests to go to network directly
  if (url.includes("firebaseio.com") || url.includes("fcm.googleapis.com")) {
    return; // do not intercept Firebase requests
  }

  // For other requests: network first, fallback to cache
  event.respondWith(
    fetch(event.request)
      .then(response => response)
      .catch(() => caches.match(event.request))
  );
});