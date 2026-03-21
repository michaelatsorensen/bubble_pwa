// ══════════════════════════════════════════════════════════
//  BUBBLE — NAVIGATION (v5.8 Router)
//  Screen hooks: each screen declares its own onEnter/onLeave
// ══════════════════════════════════════════════════════════

var _navLock = false;

// ── Screen hooks registry ──
// Each screen can define:
//   onEnter()  — called after screen becomes active
//   onLeave()  — called before screen becomes inactive
//   navIndex   — bottom nav highlight index (-1 = hide nav)
var _screenHooks = {
  'screen-home':          { onEnter: function() { loadHome(); rtStartRadarPolling(); },
                            onLeave: function() { rtStopRadarPolling(); },
                            navIndex: 0 },

  'screen-bubbles':       { onEnter: function() { loadMyBubbles(); },
                            navIndex: 1 },

  'screen-discover':      { onEnter: function() { goTo('screen-bubbles'); bbSwitchTab('explore'); },
                            navIndex: 1 },

  'screen-messages':      { onEnter: function() { loadMessages(); dmBadgeClear(); },
                            navIndex: 2 },

  'screen-profile':       { onEnter: function() { loadProfile(); },
                            navIndex: 3 },

  'screen-notifications': { onEnter: function() { loadNotifications(); notifBadgeSet(0); localStorage.setItem('bubble_notifs_seen', new Date().toISOString()); },
                            navIndex: -1 },

  'screen-chat':          { onLeave: function() {
                              try { if (chatSubscription) { chatSubscription.unsubscribe(); chatSubscription = null; } } catch(e) {}
                              dmEditingId = null;
                            },
                            navIndex: -1 },

  'screen-bubble-chat':   { onLeave: function() {
                              try { if (bcSubscription) { bcSubscription.unsubscribe(); bcSubscription = null; } } catch(e) {}
                              bcEditingId = null;
                              bcCurrentMsgId = null;
                              try { bcCloseContext(); } catch(e) {}
                              try { cancelLeaveBubble(); } catch(e) {}
                            },
                            navIndex: -1 },

  'screen-person':        { navIndex: -1 },
  'screen-qr-preview':    { navIndex: -1 },
  'screen-qr-teaser':     { navIndex: -1 },
  'screen-social-proof':  { navIndex: -1 },
  'screen-guest-checkin':  { navIndex: -1 },
  'screen-event-ready':   { navIndex: -1 },
  'screen-auth':          { navIndex: -1 },
  'screen-loading':       { navIndex: -1 },
  'screen-onboarding':    { navIndex: -1 },
  'screen-welcome':       { navIndex: -1 }
};

// ── Nav visibility: screens with navIndex -1 hide the nav ──
function _navShouldHide(screenId) {
  var hook = _screenHooks[screenId];
  return !hook || hook.navIndex < 0;
}

// ── Main router ──
function goTo(screenId) {
  // Skip if already on this screen
  if (_activeScreen === screenId) return;
  // Click throttle (250ms)
  if (_navLock) return;
  _navLock = true;
  setTimeout(function() { _navLock = false; }, 250);

  console.debug('[nav] goTo:', screenId);
  _navVersion++;
  trackEvent('screen_view', { screen: screenId });

  // ── Phase 1: Leave previous screen ──
  try {
    // Force close lingering sheets/overlays
    document.querySelectorAll('.person-sheet.open,.person-sheet-overlay.open,.radar-person-sheet.open,.radar-person-overlay.open').forEach(function(el) {
      el.classList.remove('open');
      el.style.transform = '';
    });

    // Call onLeave hook for current screen
    var prevHook = _screenHooks[_activeScreen];
    if (prevHook && prevHook.onLeave) {
      try { prevHook.onLeave(); } catch(e) { console.error('[nav] onLeave error:', _activeScreen, e); }
    }
  } catch(e) {
    console.error('[nav] cleanup error:', e);
  }

  // ── Phase 2: Switch screen (ALWAYS, even if cleanup failed) ──
  _activeScreen = screenId;
  try {
    document.querySelectorAll('.screen').forEach(function(s) { s.classList.remove('active'); });
    var target = document.getElementById(screenId);
    if (!target) { console.error('[nav] screen not found:', screenId); return; }
    void target.offsetHeight; // Force reflow
    target.classList.add('active');
  } catch(e) {
    console.error('[nav] screen switch error:', e);
  }
  window.scrollTo(0, 0);

  // ── Phase 3: Update bottom nav ──
  try {
    var globalNav = document.getElementById('global-nav');
    if (globalNav) {
      globalNav.classList.toggle('nav-hidden', _navShouldHide(screenId));
      var hook = _screenHooks[screenId];
      var activeIdx = hook ? hook.navIndex : -1;
      if (activeIdx >= 0) {
        globalNav.querySelectorAll('.nav-item').forEach(function(btn, i) {
          btn.classList.toggle('active', i === activeIdx);
        });
      }
    }
  } catch(e) { console.error('[nav] nav update error:', e); }

  // ── Phase 4: Enter new screen ──
  try {
    var enterHook = _screenHooks[screenId];
    if (enterHook && enterHook.onEnter) {
      enterHook.onEnter();
    }
  } catch(e) { console.error('[nav] onEnter error:', screenId, e); }
}

// Nav is now in document flow (not fixed), so env(safe-area-inset-bottom)
// is handled by CSS directly. No JS safe-area management needed.
