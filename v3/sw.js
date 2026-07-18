// KILL-SWITCH SERVICE WORKER v2 (18. juli 2026)
// Denne PWA-sti (/next/ eller /v3/) er retireret — al Bubble bor nu paa root.
//
// HVORFOR v2: den foerste kill-switch (17. jul) proevede c.navigate() ud af scope,
// hvilket IKKE virker i en installeret iOS standalone-PWA — den kan ikke navigere
// permanent ud af sit eget scope. Resultatet var en loekke: gammel cache blev
// serveret, opdaterings-banner kom igen og igen, Safari-overlay dukkede op.
//
// v2 forsoeger IKKE at redirecte. Den:
//   1. tager over straks (skipWaiting)
//   2. sletter ALLE caches + claimer klienter (activate)
//   3. FETCH: serverer ALDRIG cache — tvinger altid den friske beskedside, saa
//      intet gammelt cachet indhold kan blive haengende
//   4. afregistrerer sig selv
// Beskedsiden (index.html) fortaeller brugeren at slette genvejen og geninstallere
// fra root. Det er den eneste paalidelige vej ud af en fastlaast standalone-PWA.

self.addEventListener('install', function(e){ self.skipWaiting(); });

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys()
      .then(function(keys){ return Promise.all(keys.map(function(k){ return caches.delete(k); })); })
      .then(function(){ return self.clients.claim(); })
      .then(function(){ return self.registration.unregister(); })
      .catch(function(){})
  );
});

// Servér ALDRIG fra cache. Enhver navigation henter frisk beskedside fra netvaerket.
// Dette bryder den cache-loekke som den foerste kill-switch efterlod.
self.addEventListener('fetch', function(e){
  e.respondWith(
    fetch(e.request, { cache: 'no-store' }).catch(function(){
      // Offline-fallback: en minimal besked saa brugeren ikke ser en blank fejl.
      return new Response(
        '<!DOCTYPE html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        + '<body style="font-family:system-ui;background:#05080C;color:#EAF2FB;display:flex;align-items:center;'
        + 'justify-content:center;min-height:100vh;margin:0;text-align:center;padding:2rem">'
        + '<div><h2 style="font-size:1.1rem">Denne version er forældet</h2>'
        + '<p style="color:rgba(207,230,247,0.7);font-size:0.9rem;line-height:1.5">Slet denne genvej og '
        + 'opret en ny gennem <b style="color:#8FC6EC">bubbleme.dk</b> i Safari.</p></div></body>',
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    })
  );
});
