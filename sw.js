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

// Firebase Push Notifications
importScripts('https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyB0G0JLoNejrshjLaKxFR264cY11rmhVJU",
  authDomain: "jayara-web.firebaseapp.com",
  projectId: "jayara-web",
  messagingSenderId: "342182893596",
  appId: "1:342182893596:web:664646e95a40e60d0da7d9"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  const notificationTitle = payload.notification?.title || "Jayara Chat";
  const notificationOptions = {
    body: payload.notification?.body || "New message received",
    icon: 'icon-192.png'
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});