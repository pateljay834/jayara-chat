// Jayara Service Worker
// Version 1.0.0

const CACHE_NAME = 'jayara-v1.0.0';
const STATIC_CACHE = 'jayara-static-v1';
const DYNAMIC_CACHE = 'jayara-dynamic-v1';

// Files to cache immediately (static assets)
const STATIC_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
  // External CDN resources (cached dynamically)
];

// CDN resources that should be cached
const CDN_RESOURCES = [
  'https://cdnjs.cloudflare.com/ajax/libs/firebase/9.22.0/firebase-app-compat.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/firebase/9.22.0/firebase-database-compat.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js'
];

// Install event - cache static files
self.addEventListener('install', event => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('[SW] Caching static files');
        return cache.addAll(STATIC_FILES);
      })
      .then(() => {
        console.log('[SW] Static files cached successfully');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('[SW] Error caching static files:', error);
      })
  );
});

// Activate event - cleanup old caches
self.addEventListener('activate', event => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            // Delete old versions of caches
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Service worker activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve cached content or fetch from network
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip Firebase and external API calls (except CDN resources)
  if (url.hostname.includes('firebase') && !CDN_RESOURCES.includes(request.url)) {
    return;
  }

  // Handle different types of requests
  if (CDN_RESOURCES.includes(request.url)) {
    // Cache CDN resources with network-first strategy
    event.respondWith(cacheFirstStrategy(request));
  } else if (request.destination === 'document') {
    // HTML pages - network first with fallback
    event.respondWith(networkFirstStrategy(request));
  } else {
    // Other resources - cache first
    event.respondWith(cacheFirstStrategy(request));
  }
});

// Cache-first strategy (good for static assets)
async function cacheFirstStrategy(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('[SW] Serving from cache:', request.url);
      return cachedResponse;
    }

    console.log('[SW] Fetching from network:', request.url);
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.status === 200) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[SW] Cache-first strategy failed:', error);
    
    // Return offline page or cached fallback
    if (request.destination === 'document') {
      const cachedResponse = await caches.match('/index.html');
      return cachedResponse || new Response('App is offline', {
        status: 503,
        statusText: 'Service Unavailable'
      });
    }
    
    throw error;
  }
}

// Network-first strategy (good for dynamic content)
async function networkFirstStrategy(request) {
  try {
    console.log('[SW] Network-first for:', request.url);
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.status === 200) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache for:', request.url);
    
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline fallback for HTML pages
    if (request.destination === 'document') {
      return new Response(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Jayara - Offline</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, sans-serif;
              display: flex; 
              justify-content: center; 
              align-items: center; 
              height: 100vh; 
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              text-align: center;
            }
            .offline-container {
              background: rgba(255,255,255,0.1);
              padding: 2rem;
              border-radius: 1rem;
              backdrop-filter: blur(10px);
            }
            .offline-icon { font-size: 4rem; margin-bottom: 1rem; }
            h1 { margin: 0 0 1rem 0; }
            p { margin: 0.5rem 0; opacity: 0.9; }
            button {
              background: white;
              color: #4f46e5;
              border: none;
              padding: 0.75rem 1.5rem;
              border-radius: 0.5rem;
              font-weight: 600;
              cursor: pointer;
              margin-top: 1rem;
            }
          </style>
        </head>
        <body>
          <div class="offline-container">
            <div class="offline-icon">📵</div>
            <h1>You're Offline</h1>
            <p>Jayara needs an internet connection to work.</p>
            <p>Please check your connection and try again.</p>
            <button onclick="window.location.reload()">Try Again</button>
          </div>
        </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' }
      });
    }
    
    throw error;
  }
}

// Background sync for offline messages (future enhancement)
self.addEventListener('sync', event => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncOfflineMessages());
  }
});

// Sync offline messages when connection is restored
async function syncOfflineMessages() {
  try {
    // Get offline messages from IndexedDB (if implemented)
    console.log('[SW] Syncing offline messages...');
    
    // This would sync any messages that were queued while offline
    // Implementation depends on your offline storage strategy
    
    console.log('[SW] Offline messages synced successfully');
  } catch (error) {
    console.error('[SW] Error syncing offline messages:', error);
  }
}

// Push notification handling (future enhancement)
self.addEventListener('push', event => {
  console.log('[SW] Push message received');
  
  const options = {
    body: 'You have new messages in Jayara',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 'jayara-notification'
    },
    actions: [
      {
        action: 'open',
        title: 'Open Chat',
        icon: '/icon-open.png'
      },
      {
        action: 'close',
        title: 'Dismiss',
        icon: '/icon-close.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('New Message', options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', event => {
  console.log('[SW] Notification clicked:', event.action);
  
  event.notification.close();
  
  if (event.action === 'open') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Handle messages from main app
self.addEventListener('message', event => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Cleanup old cache entries periodically
setInterval(() => {
  caches.open(DYNAMIC_CACHE).then(cache => {
    cache.keys().then(keys => {
      // Remove old entries (keep last 50)
      if (keys.length > 50) {
        const toDelete = keys.slice(0, keys.length - 50);
        toDelete.forEach(key => cache.delete(key));
      }
    });
  });
}, 30 * 60 * 1000); // Every 30 minutes

console.log('[SW] Jayara Service Worker loaded successfully');