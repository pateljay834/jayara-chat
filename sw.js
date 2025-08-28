const CACHE_NAME = "jayara-cache-v1";
const urlsToCache = [
  "./",
  "./index.html",
  "./style.css",
  "./apps.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

// ----------------- Install -----------------
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    })
  );