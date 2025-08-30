// sw.js - Jayara service worker
// Bump cache name version whenever assets change
const CACHE_NAME = "jayara-static-v3";

const urlsToCache = [
  "./",
  "./index.html",
  "./style.css",
  "./apps.js",
  "./manifest.json",
  "https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js",
  "https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/9.22.2/firebase-database-compat.js"
];

// -------------------- INSTALL --------------------
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
      .catch((err) => {
        console.warn("SW install: cache.addAll failed:", err);
      })
  );
  self.skipWaiting();
});

// -------------------- ACTIVATE --------------------
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});
// -------------------- FETCH --------------------
self.addEventListener("fetch", (event) => {
  const request = event.request;

  // For navigation requests (HTML pages)
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          // update cache in background
          caches.open(CACHE_NAME).then((cache) => {
            try { cache.put(request, networkResponse.clone()); } catch (e) {}
          });
          return networkResponse;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // For assets (CSS, JS, images, libs)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // refresh cache in background
        fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            caches.open(CACHE_NAME).then((cache) => {
              try { cache.put(request, networkResponse.clone()); } catch (e) {}
            });
          }
        }).catch(() => {});
        return cachedResponse;
      }
      return fetch(request).catch(() =>
        new Response("Offline", { status: 503, statusText: "Offline" })
      );
    })
  );
});

// -------------------- MESSAGES --------------------
self.addEventListener("message", (event) => {
  if (!event.data) return;

  if (event.data === "skipWaiting") {
    self.skipWaiting();
  }

  if (event.data.type === "CLEAR_OLD_CACHES") {
    const keep = event.data.keep || CACHE_NAME;
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (k === keep ? null : caches.delete(k))))
    );
  }
});