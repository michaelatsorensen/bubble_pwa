// ══════════════════════════════════════
//  BUBBLE SERVICE WORKER
//  Push notifications + basic offline cache
// ══════════════════════════════════════

const CACHE_NAME = 'bubble-v3';
const CACHE_URLS = [
  './',
  './index.html',
  './app.js',
  './app.css',
  './bubble-icons.js',
  './tag-data.js',
  './manifest.json'
];

// ── Install: cache core files ──
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(CACHE_URLS);
    })
  );
  self.skipWaiting();
});

// ── Activate: clean old caches ──
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

// ── Fetch: network-first with cache fallback ──
self.addEventListener('fetch', function(event) {
  // Skip non-GET and API requests
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('supabase.co')) return;
  if (event.request.url.includes('api.giphy.com')) return;

  event.respondWith(
    fetch(event.request).then(function(response) {
      // Cache successful responses
      if (response.ok) {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, clone);
        });
      }
      return response;
    }).catch(function() {
      return caches.match(event.request);
    })
  );
});

// ── Push: show notification ──
self.addEventListener('push', function(event) {
  var data = { title: 'Bubble', body: 'Du har en ny notifikation', icon: './bubble-icon-192.png', badge: './bubble-icon-192.png', tag: 'bubble-notif' };

  try {
    if (event.data) {
      var payload = event.data.json();
      data.title = payload.title || data.title;
      data.body = payload.body || data.body;
      data.tag = payload.tag || data.tag;
      data.data = payload.data || {};
    }
  } catch(e) {
    if (event.data) data.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      tag: data.tag,
      data: data.data,
      vibrate: [100, 50, 100],
      actions: [
        { action: 'open', title: 'Åbn' },
        { action: 'dismiss', title: 'Luk' }
      ]
    })
  );
});

// ── Notification click: open app ──
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  if (event.action === 'dismiss') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Focus existing window if open
      for (var i = 0; i < clientList.length; i++) {
        if (clientList[i].url.includes('index.html') && 'focus' in clientList[i]) {
          return clientList[i].focus();
        }
      }
      // Otherwise open new window
      return clients.openWindow('./index.html');
    })
  );
});
