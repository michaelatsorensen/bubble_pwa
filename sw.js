// ══════════════════════════════════════
//  BUBBLE SERVICE WORKER v3.6.7
// ══════════════════════════════════════

const CACHE_NAME = 'bubble-v3.7.9';
const CACHE_URLS = [
  './', './index.html', './app.css',
  './bubble-icons.js', './tag-data.js',
  './b-config.js', './b-utils.js', './b-navigation.js',
  './b-auth.js', './b-home.js', './b-bubbles.js',
  './b-profile.js', './b-radar.js', './b-messages.js',
  './b-realtime.js', './b-onboarding.js', './b-chat.js',
  './b-notifications.js', './b-live.js', './b-admin.js',
  './b-boot.js'
];

self.addEventListener('install', function(event) {
  event.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(CACHE_URLS)));
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(function() {
      // Fortæl alle åbne vinduer at ny version er klar
      return self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    }).then(function(clients) {
      clients.forEach(function(client) {
        client.postMessage({ type: 'SW_UPDATED', version: CACHE_NAME });
      });
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('supabase.co')) return;
  if (event.request.url.includes('tenor.com')) return;

  event.respondWith(
    fetch(event.request).then(function(res) {
      if (res.ok) caches.open(CACHE_NAME).then(c => c.put(event.request, res.clone()));
      return res;
    }).catch(() => caches.match(event.request))
  );
});

// ── Push: vis notifikation ──
self.addEventListener('push', function(event) {
  var title    = 'Bubble 🫧';
  var body     = 'Du har en ny notifikation';
  var tag      = 'bubble-notif';
  var icon     = './bubble-icon-180.png';   // ✅ eksisterer
  var badge    = './bubble-favicon-32.png'; // ✅ eksisterer
  var notifData = {};

  try {
    if (event.data) {
      var p    = event.data.json();
      title    = p.title  || title;
      body     = p.body   || body;
      tag      = p.tag    || tag;
      icon     = p.icon   || icon;
      badge    = p.badge  || badge;
      notifData = p.data  || {};
    }
  } catch(e) {
    try { if (event.data) body = event.data.text(); } catch(_) {}
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body, icon, badge, tag,
      data:     notifData,
      vibrate:  [100, 50, 100],
      renotify: true
    })
  );
});

// ── Klik på notifikation → naviger i app ──
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  if (event.action === 'dismiss') return;

  var d    = event.notification.data || {};
  var type = d.type || '';
  var url  = './';

  if (type === 'new_message' || type === 'message') {
    url = d.sender_id ? './?push=chat&uid=' + d.sender_id : './?push=messages';
  } else if (type === 'new_invite' || type === 'invitation' || type === 'saved_contact') {
    url = './?push=notifications';
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
      for (var i = 0; i < list.length; i++) {
        if ('focus' in list[i]) {
          list[i].focus();
          // Send besked til app om navigation
          list[i].postMessage({ type: 'PUSH_NAVIGATE', url: url, data: d });
          return;
        }
      }
      return clients.openWindow(url);
    })
  );
});
