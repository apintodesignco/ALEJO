/**
 * ALEJO Service Worker
 * 
 * Provides:
 * - Offline capability
 * - Asset caching
 * - Background sync
 * - Push notifications
 */

const CACHE_NAME = 'alejo-cache-v1';
const ASSETS_CACHE = 'alejo-assets-v1';
const API_CACHE = 'alejo-api-v1';

// Assets to cache on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/favicon.ico',
  '/manifest.json',
  '/assets/logo-192.png',
  '/assets/logo-512.png',
  '/assets/css/main.css'
];

// Install event - precache key assets
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installing');
  
  // Skip waiting to ensure the newest version is activated immediately
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Precaching app shell');
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activating');
  
  // Take control of all clients immediately
  self.clients.claim();
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            // Delete old caches that don't match our current versions
            return cacheName.startsWith('alejo-') &&
                   cacheName !== CACHE_NAME &&
                   cacheName !== ASSETS_CACHE &&
                   cacheName !== API_CACHE;
          })
          .map((cacheName) => {
            console.log('[ServiceWorker] Removing old cache', cacheName);
            return caches.delete(cacheName);
          })
      );
    })
  );
});

// Fetch event - implement stale-while-revalidate strategy
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  
  // Skip non-GET requests and browser extensions
  if (request.method !== 'GET' || 
      url.origin !== self.location.origin && !url.hostname.endsWith('jsdelivr.net')) {
    return;
  }
  
  // Handle API requests with network-first strategy
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }
  
  // Handle asset requests with cache-first strategy
  if (isAssetRequest(request)) {
    event.respondWith(cacheFirstStrategy(request));
    return;
  }
  
  // For HTML and other navigation requests, use stale-while-revalidate
  event.respondWith(staleWhileRevalidateStrategy(request));
});

/**
 * Network-first caching strategy
 * Try the network first, fallback to cache
 */
async function networkFirstStrategy(request) {
  try {
    // Try to get from network
    const networkResponse = await fetch(request);
    
    // If successful, clone and cache
    if (networkResponse.ok) {
      const clonedResponse = networkResponse.clone();
      caches.open(API_CACHE).then(cache => {
        cache.put(request, clonedResponse);
      });
    }
    
    return networkResponse;
  } catch (error) {
    // If network fails, try the cache
    console.log('[ServiceWorker] Serving from API cache for', request.url);
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // If not in cache, return a basic offline JSON response
    if (request.headers.get('accept').includes('application/json')) {
      return new Response(
        JSON.stringify({ 
          error: 'You are offline. Unable to fetch new data.',
          offline: true,
          timestamp: new Date().toISOString()
        }),
        { 
          headers: { 'Content-Type': 'application/json' },
          status: 503,
          statusText: 'Service Unavailable'
        }
      );
    }
    
    // For other requests, throw the error
    throw error;
  }
}

/**
 * Cache-first strategy
 * Try the cache first, fallback to network
 */
async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    console.log('[ServiceWorker] Serving from cache for', request.url);
    
    // In the background, update the cache
    updateCache(request);
    
    return cachedResponse;
  }
  
  // If not in cache, fetch from network and cache
  return fetchAndCache(request, ASSETS_CACHE);
}

/**
 * Stale-while-revalidate strategy
 * Return from cache (if available) while updating cache from network
 */
async function staleWhileRevalidateStrategy(request) {
  const cachedResponse = await caches.match(request);
  
  // Background update
  const fetchPromise = fetchAndCache(request, CACHE_NAME);
  
  // Return the cached response if we have one
  return cachedResponse || fetchPromise;
}

/**
 * Fetch from network and cache the response
 */
async function fetchAndCache(request, cacheName) {
  try {
    const response = await fetch(request);
    
    // Only cache valid responses
    if (response.ok && response.status < 400) {
      const clonedResponse = response.clone();
      caches.open(cacheName).then(cache => {
        cache.put(request, clonedResponse);
      });
    }
    
    return response;
  } catch (error) {
    console.error('[ServiceWorker] Fetch failed:', error);
    throw error;
  }
}

/**
 * Update an existing cached entry
 */
async function updateCache(request) {
  try {
    const response = await fetch(request);
    
    if (response.ok && response.status < 400) {
      const cache = await caches.open(ASSETS_CACHE);
      cache.put(request, response);
    }
  } catch (error) {
    console.log('[ServiceWorker] Update cache failed:', error);
    // Silently fail as this is just a background update
  }
}

/**
 * Check if request is for an asset
 */
function isAssetRequest(request) {
  const url = new URL(request.url);
  
  // Define asset extensions
  const assetExtensions = [
    '.js', '.css', '.png', '.jpg', '.jpeg', '.gif', 
    '.svg', '.webp', '.woff', '.woff2', '.ttf', '.eot',
    '.ico', '.json', '.mp3', '.mp4', '.webm'
  ];
  
  // Check if pathname ends with an asset extension
  return assetExtensions.some(ext => url.pathname.endsWith(ext)) ||
    url.pathname.includes('/assets/');
}

// Background sync for offline data submissions
self.addEventListener('sync', (event) => {
  if (event.tag === 'alejo-background-sync') {
    event.waitUntil(syncOfflineData());
  }
});

/**
 * Process offline data when back online
 */
async function syncOfflineData() {
  try {
    // Open IndexedDB
    const db = await openDatabase();
    const offlineData = await getOfflineData(db);
    
    if (offlineData.length === 0) {
      return;
    }
    
    console.log('[ServiceWorker] Syncing offline data', offlineData.length);
    
    // Process each offline item
    const syncPromises = offlineData.map(async (item) => {
      try {
        const response = await fetch(item.url, {
          method: item.method,
          headers: item.headers,
          body: item.body,
          credentials: 'same-origin'
        });
        
        if (response.ok) {
          // Remove from IndexedDB after successful sync
          return removeOfflineItem(db, item.id);
        }
      } catch (error) {
        console.error('[ServiceWorker] Failed to sync item', item.id, error);
      }
    });
    
    await Promise.all(syncPromises);
    
    // Close IndexedDB connection
    db.close();
    
    console.log('[ServiceWorker] Offline data sync complete');
  } catch (error) {
    console.error('[ServiceWorker] Sync failed:', error);
  }
}

/**
 * Open IndexedDB database
 */
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('alejo-offline', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create object store for offline data
      if (!db.objectStoreNames.contains('offlineData')) {
        const store = db.createObjectStore('offlineData', { keyPath: 'id', autoIncrement: true });
        store.createIndex('url', 'url', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

/**
 * Get all offline data items from IndexedDB
 */
function getOfflineData(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['offlineData'], 'readonly');
    const store = transaction.objectStore('offlineData');
    const request = store.getAll();
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

/**
 * Remove a processed offline item from IndexedDB
 */
function removeOfflineItem(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['offlineData'], 'readwrite');
    const store = transaction.objectStore('offlineData');
    const request = store.delete(id);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// Push notification event listener
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  try {
    const data = event.data.json();
    const options = {
      body: data.body || 'New notification from ALEJO',
      icon: '/assets/logo-192.png',
      badge: '/assets/notification-badge.png',
      vibrate: [100, 50, 100],
      data: {
        url: data.url || '/'
      }
    };
    
    event.waitUntil(
      self.registration.showNotification(
        data.title || 'ALEJO Notification', 
        options
      )
    );
  } catch (error) {
    console.error('[ServiceWorker] Push notification error:', error);
  }
});

// Notification click event handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const url = event.notification.data.url || '/';
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clientList => {
      // If a window client already exists, focus it
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise, open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});
