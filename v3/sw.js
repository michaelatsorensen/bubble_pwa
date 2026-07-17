// KILL-SWITCH SERVICE WORKER (17. juli 2026)
// Denne PWA-installation (scope) er retireret — konsolideret til bubbleme.dk/ (root).
// Denne fil erstatter den tidligere aktive service worker for at faa eksisterende
// installationer til at slippe kontrollen, rydde deres cache, og lande paa root.
// Se: eksternt build-review 17. juli 2026, punkt 1 (ét rent deployment-artifact).
self.addEventListener('install', function(e){ self.skipWaiting(); });
self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys()
      .then(function(keys){ return Promise.all(keys.map(function(k){ return caches.delete(k); })); })
      .then(function(){ return self.clients.claim(); })
      .then(function(){ return self.clients.matchAll({ type: 'window' }); })
      .then(function(clientList){
        clientList.forEach(function(c){ try { c.navigate('https://bubbleme.dk/'); } catch(e){} });
      })
      .then(function(){ return self.registration.unregister(); })
  );
});
