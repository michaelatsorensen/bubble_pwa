// ══════════════════════════════════════════════════════════
//  BUBBLE — NAVIGATION (v5.9 Router)
//  DOMAIN: nav
//  OWNS: _activeScreen, _navStack, _navLock, _screenHooks
//  OWNS: goTo (calls bbCloseAll + screen hooks)
//  Screen hooks: each screen declares its own onEnter/onLeave
//  NOTE: All hook functions use lazy lookup to avoid load-order issues
// ══════════════════════════════════════════════════════════

var _navLock = false;
var _navStack = []; // History stack for back navigation
var _navPopLock = false; // Prevents infinite loops with popstate

// ── Browser/Android back button handler ──
window.addEventListener('popstate', function() {
  if (_navPopLock) return;
  _navPopLock = true;
  setTimeout(function() { _navPopLock = false; }, 300);

  if (_navStack.length > 1) {
    _navStack.pop(); // Remove current
    var prev = _navStack[_navStack.length - 1]; // Peek at previous
    if (prev) {
      // For bubble-chat, we need to reopen the bubble
      if (prev === 'screen-bubble-chat' && typeof openBubbleChat === 'function') {
        // Restore bubble from route state
        var route = null;
        try { route = JSON.parse(sessionStorage.getItem('bb_route')); } catch(e) {}
        if (route && route.parentBubbleId) {
          openBubbleChat(route.parentBubbleId, route.backTarget || 'screen-bubbles');
        } else if (route && route.backTarget) {
          goTo(route.backTarget);
        } else {
          goTo('screen-home');
        }
        _navStack = [_navStack[_navStack.length - 1] || 'screen-home'];
      } else {
        goTo(prev);
      }
    }
  } else {
    // At root — push state back to prevent exiting app
    if (_activeScreen !== 'screen-home') {
      goTo('screen-home');
      _navStack = ['screen-home'];
    } else {
      // On home already — let browser handle (minimize PWA)
      history.pushState({ screen: 'screen-home' }, '');
    }
  }
});

// ── Screen hooks registry ──
// navIndex: 0=home, 1=bubbles, 2=messages, 3=profile, -1=hide nav
var _screenHooks = {
  'screen-home':          { enter: 'loadHome,rtStartRadarPolling', leave: 'rtStopRadarPolling', navIndex: 0 },
  'screen-bubbles':       { enter: 'loadMyBubbles', navIndex: 1 },
  'screen-discover':      { enter: '_navGoDiscover', navIndex: 1 },
  'screen-messages':      { enter: 'loadMessages,dmBadgeClear', navIndex: 2 },
  'screen-profile':       { enter: 'loadProfile', navIndex: 3 },
  'screen-notifications': { enter: '_navEnterNotifs', navIndex: -1 },
  'screen-chat':          { leave: '_navLeaveChat', navIndex: -1 },
  'screen-bubble-chat':   { leave: '_navLeaveBubbleChat', navIndex: -1 },
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

// ── Named hook helpers (avoid direct references in object literal) ──
function _navGoDiscover() { goTo('screen-bubbles'); bbSwitchTab('explore'); }
function _navEnterNotifs() { loadNotifications(); notifBadgeSet(0); localStorage.setItem('bubble_notifs_seen', new Date().toISOString()); }
function _navLeaveChat() {
  try { if (typeof chatSubscription !== 'undefined' && chatSubscription) { chatSubscription.unsubscribe(); chatSubscription = null; } } catch(e) {}
  if (typeof dmEditingId !== 'undefined') dmEditingId = null;
}
function _navLeaveBubbleChat() {
  try { sessionStorage.removeItem('bb_route'); } catch(e) {}
  try { if (typeof bcSubscription !== 'undefined' && bcSubscription) { bcSubscription.unsubscribe(); bcSubscription = null; } } catch(e) {}
  if (typeof bcEditingId !== 'undefined') bcEditingId = null;
  if (typeof bcCurrentMsgId !== 'undefined') bcCurrentMsgId = null;
  try { bcCloseContext(); } catch(e) {}
  try { cancelLeaveBubble(); } catch(e) {}
}

// ── Execute hook: string of comma-separated function names, or a single function ──
function _runHook(hookVal) {
  if (!hookVal) return;
  if (typeof hookVal === 'function') { hookVal(); return; }
  if (typeof hookVal === 'string') {
    hookVal.split(',').forEach(function(name) {
      name = name.trim();
      if (typeof window[name] === 'function') {
        try { window[name](); } catch(e) { console.error('[nav] hook error:', name, e); }
      } else {
        console.warn('[nav] hook not found:', name);
      }
    });
  }
}

// ── Main router ──
var _publicScreens = ['screen-auth','screen-loading','screen-onboarding','screen-qr-preview','screen-qr-teaser','screen-social-proof','screen-guest-checkin','screen-event-ready','screen-welcome'];

function goTo(screenId) {
  // Auth guard: prevent navigation to protected screens without login
  if (!currentUser && _publicScreens.indexOf(screenId) < 0) {
    console.warn('[nav] auth guard: no user, redirecting to auth');
    screenId = 'screen-auth';
  }

  if (_activeScreen === screenId) return;
  if (_navLock) return;
  _navLock = true;
  setTimeout(function() { _navLock = false; }, 250);

  console.debug('[nav] goTo:', screenId);
  _navVersion++;
  trackEvent('screen_view', { screen: screenId });

  // ── Phase 1: Leave previous screen ──
  try {
    // Close ALL overlays, sheets, modals, pickers
    bbCloseAll();

    var prevHook = _screenHooks[_activeScreen];
    if (prevHook && prevHook.leave) {
      try { _runHook(prevHook.leave); } catch(e) { console.error('[nav] onLeave error:', _activeScreen, e); }
    }
  } catch(e) { console.error('[nav] cleanup error:', e); }

  // ── Phase 2: Switch screen ──
  _activeScreen = screenId;
  // Push to history for browser/Android back
  if (!_navPopLock) {
    _navStack.push(screenId);
    if (_navStack.length > 20) _navStack = _navStack.slice(-15); // Cap at 15
    try { history.pushState({ screen: screenId }, ''); } catch(e) {}
  }
  try {
    document.querySelectorAll('.screen').forEach(function(s) { s.classList.remove('active'); });
    var target = document.getElementById(screenId);
    if (!target) { console.error('[nav] screen not found:', screenId); return; }
    void target.offsetHeight;
    target.classList.add('active');
  } catch(e) { console.error('[nav] screen switch error:', e); }
  window.scrollTo(0, 0);

  // ── Phase 3: Update bottom nav ──
  try {
    var globalNav = document.getElementById('global-nav');
    if (globalNav) {
      var hook = _screenHooks[screenId];
      var activeIdx = hook ? hook.navIndex : -1;
      globalNav.classList.toggle('nav-hidden', activeIdx < 0);
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
    if (enterHook && enterHook.enter) {
      _runHook(enterHook.enter);
    }
  } catch(e) { console.error('[nav] onEnter error:', screenId, e); }
}
