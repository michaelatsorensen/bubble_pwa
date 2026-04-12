// ══════════════════════════════════════════════════════════
//  BUBBLE — NAVIGATION (v6.6 Router)
//  DOMAIN: nav
//  OWNS: _activeScreen, _navStack, _navLock, _screenHooks, navState
//  OWNS: goTo (calls _navGlobalCleanup + bbCloseAll + screen hooks)
//  Screen hooks: each screen declares its own onEnter/onLeave
//  NOTE: All hook functions use lazy lookup to avoid load-order issues
//
//  v6.6 changes:
//   - Central navState object for tracking active context
//   - Leave hooks for home, notifications, person, auth
//   - _navGlobalCleanup() catches gifPicker, context menus, send state
//   - navState synced on every goTo + back
//   - Improved back handler for DM chat
// ══════════════════════════════════════════════════════════

var _navLock = false;
var _navStack = []; // History stack for back navigation
var _navPopLock = false; // Prevents infinite loops with popstate

// ── Central navigation state (single source of truth) ──
var navState = {
  screen: null,         // Current active screen ID
  overlay: null,        // Currently open overlay/sheet ID (or null)
  modal: null,          // Currently open modal ID (or null)
  chatTarget: null,     // DM: user ID being chatted with
  bubbleChatId: null,   // Bubble chat: bubble ID
  personSheetId: null,  // Person sheet: user ID being viewed
  // Read helpers
  isChat: function() { return this.screen === 'screen-chat' || this.screen === 'screen-bubble-chat'; },
  isOverlayOpen: function() { return !!(this.overlay || this.modal || this.personSheetId); }
};

// ── Programmatic back navigation ──
function navBack() {
  // Priority 1: Close overlays/sheets
  var dynOverlays = document.querySelectorAll('.bb-dyn-overlay');
  if (dynOverlays.length > 0) { dynOverlays.forEach(function(el) { bbDynClose(el); }); return; }
  var psOverlay = document.getElementById('ps-overlay');
  if (psOverlay && psOverlay.classList.contains('open')) { if (typeof psClose === 'function') psClose(); return; }
  var openSheet = document.querySelector('.bb-overlay.open');
  if (openSheet) { if (typeof bbCloseAll === 'function') bbCloseAll(); return; }

  // Priority 2: Navigate back in stack
  if (_navStack.length > 1) {
    _navStack.pop();
    var prev = _navStack[_navStack.length - 1];
    if (prev) {
      // Bubble-chat needs context restoration
      if (prev === 'screen-bubble-chat' && typeof openBubbleChat === 'function') {
        var route = null;
        try { route = JSON.parse(sessionStorage.getItem('bb_route')); } catch(e) {}
        if (route && route.parentBubbleId) {
          openBubbleChat(route.parentBubbleId, route.backTarget || 'screen-bubbles');
        } else {
          goTo('screen-home');
        }
        _navStack = [_navStack[_navStack.length - 1] || 'screen-home'];
      } else {
        _navPopLock = true;
        goTo(prev);
        _navPopLock = false;
      }
    }
  } else {
    goTo('screen-home');
  }
}

// ── Browser/Android back button handler ──
window.addEventListener('popstate', function() {
  if (_navPopLock) return;
  _navPopLock = true;
  setTimeout(function() { _navPopLock = false; }, 300);

  // Priority 1: Close dynamic overlays
  var dynOverlays = document.querySelectorAll('.bb-dyn-overlay');
  if (dynOverlays.length > 0) {
    dynOverlays.forEach(function(el) { if (typeof bbDynClose === 'function') bbDynClose(el); });
    navState.overlay = null;
    history.pushState(null, '');
    return;
  }

  // Priority 2: Close person sheet
  var psOverlay = document.getElementById('ps-overlay');
  if (psOverlay && psOverlay.classList.contains('open')) {
    if (typeof psClose === 'function') psClose();
    navState.personSheetId = null;
    history.pushState(null, '');
    return;
  }

  // Priority 3: Close modal
  var openModal = document.querySelector('.modal.open');
  if (openModal) {
    if (typeof closeModal === 'function') closeModal(openModal.id);
    navState.modal = null;
    history.pushState(null, '');
    return;
  }

  // Priority 4: Close sheet/overlay
  var openSheet = document.querySelector('.bb-overlay.open');
  if (openSheet) {
    if (typeof bbCloseAll === 'function') bbCloseAll();
    navState.overlay = null;
    history.pushState(null, '');
    return;
  }

  // Priority 5: Navigate back in screen stack
  if (_navStack.length > 1) {
    _navStack.pop();
    var prev = _navStack[_navStack.length - 1];

    if (prev) {
      // Bubble-chat: restore bubble context
      if (prev === 'screen-bubble-chat' && typeof openBubbleChat === 'function') {
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
    if (_activeScreen !== 'screen-home') {
      goTo('screen-home');
      _navStack = ['screen-home'];
    } else {
      history.pushState({ screen: 'screen-home' }, '');
    }
  }
});

// ── Screen hooks registry ──
// navIndex: 0=home, 1=bubbles, 2=messages, 3=profile, -1=hide nav
var _screenHooks = {
  'screen-home':          { enter: 'loadHome,rtStartRadarPolling', leave: '_navLeaveHome', navIndex: 0 },
  'screen-bubbles':       { enter: 'loadMyBubbles', navIndex: 1 },
  'screen-discover':      { enter: '_navGoDiscover', navIndex: 1 },
  'screen-messages':      { enter: 'loadMessages,dmBadgeClear', navIndex: 2 },
  'screen-profile':       { enter: 'loadProfile', navIndex: 3 },
  'screen-notifications': { enter: '_navEnterNotifs', navIndex: -1 },
  'screen-chat':          { leave: '_navLeaveChat', navIndex: -1 },
  'screen-bubble-chat':   { leave: '_navLeaveBubbleChat', navIndex: -1 },
  'screen-person':        { leave: '_navLeavePerson', navIndex: -1 },
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

// ── Named hook helpers ──
function _navGoDiscover() { _bbActiveTab = 'explore'; goTo('screen-bubbles'); }
function _navEnterNotifs() { loadNotifications(); notifBadgeSet(0); localStorage.setItem('bubble_notifs_seen', new Date().toISOString()); }

function _navLeaveHome() {
  try { if (typeof rtStopRadarPolling === 'function') rtStopRadarPolling(); } catch(e) {}
}

function _navLeaveChat() {
  // Close GIF picker if open
  try { if (typeof closeGifPicker === 'function') closeGifPicker(); } catch(e) {}
  // Unsubscribe realtime
  try {
    if (typeof chatSubscription !== 'undefined' && chatSubscription) {
      chatSubscription.unsubscribe();
      chatSubscription = null;
    }
  } catch(e) {}
  // Clear typing indicators and timers
  try {
    if (typeof dmHideTyping === 'function') dmHideTyping();
    if (typeof _dmBroadcastTypingTimer !== 'undefined') { clearTimeout(_dmBroadcastTypingTimer); _dmBroadcastTypingTimer = null; }
  } catch(e) {}
  // Reset DM state
  if (typeof dmEditingId !== 'undefined') dmEditingId = null;
  navState.chatTarget = null;
}

function _navLeaveBubbleChat() {
  // Close GIF picker if open
  try { if (typeof closeGifPicker === 'function') closeGifPicker(); } catch(e) {}
  try { sessionStorage.removeItem('bb_route'); } catch(e) {}
  // Unsubscribe realtime
  try {
    if (typeof bcSubscription !== 'undefined' && bcSubscription) {
      bcSubscription.unsubscribe();
      bcSubscription = null;
    }
  } catch(e) {}
  // Reset bubble chat state
  if (typeof bcEditingId !== 'undefined') bcEditingId = null;
  if (typeof bcCurrentMsgId !== 'undefined') bcCurrentMsgId = null;
  try { cancelLeaveBubble(); } catch(e) {}
  navState.bubbleChatId = null;
}

function _navLeavePerson() {
  navState.personSheetId = null;
}

// ── Global cleanup: catches state that individual hooks miss ──
// Called BEFORE bbCloseAll and individual leave hooks on every goTo
function _navGlobalCleanup() {
  // 1. Close GIF picker (shared between DM and bubble chat)
  try {
    if (typeof gifPickerMode !== 'undefined') gifPickerMode = null;
    var gp = document.getElementById('gif-picker');
    var go = document.getElementById('gif-picker-overlay');
    if (gp) gp.classList.remove('open');
    if (go) go.classList.remove('open');
  } catch(e) {}

  // 2. Close chat plus menus
  try {
    document.querySelectorAll('.chat-plus-menu.open').forEach(function(m) { m.classList.remove('open'); });
    document.querySelectorAll('.chat-plus-btn.open').forEach(function(b) { b.classList.remove('open'); });
  } catch(e) {}

  // 3. Reset send-in-progress flags
  try { if (typeof bcSending !== 'undefined') bcSending = false; } catch(e) {}

  // 4. Close long-press context overlays
  try { document.querySelectorAll('.dm-ctx-overlay').forEach(function(el) { el.remove(); }); } catch(e) {}

  // 5. Clear long-press timers
  try {
    if (typeof _dmLongPressTimer !== 'undefined' && _dmLongPressTimer) { clearTimeout(_dmLongPressTimer); _dmLongPressTimer = null; }
    if (typeof _bcLongPressTimer !== 'undefined' && _bcLongPressTimer) { clearTimeout(_bcLongPressTimer); _bcLongPressTimer = null; }
  } catch(e) {}
}

// ── Execute hook ──
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

function _slideNavIndicator(idx) {
  var indicator = document.getElementById('nav-slide-indicator');
  var navRow = indicator ? indicator.parentElement : null;
  if (!indicator || !navRow) return;
  var items = navRow.querySelectorAll('.nav-item');
  if (idx < 0 || idx >= items.length) return;
  var item = items[idx];
  var rowRect = navRow.getBoundingClientRect();
  var itemRect = item.getBoundingClientRect();
  var cx = itemRect.left + itemRect.width / 2 - rowRect.left;
  indicator.style.transform = 'translateX(' + (cx - 18) + 'px)';
}

function goTo(screenId) {
  // Close any open trays + reset rubber band
  try { if (typeof closeNotifTray === 'function') closeNotifTray(); } catch(e) {}
  try { document.querySelectorAll('.scroll-area').forEach(function(el) { el.style.transition = ''; el.style.transform = ''; }); } catch(e) {}
  // Auth guard
  if (!currentUser && _publicScreens.indexOf(screenId) < 0) {
    console.warn('[nav] auth guard: no user, redirecting to auth');
    screenId = 'screen-auth';
  }

  if (_activeScreen === screenId) return;
  if (_navLock) return;
  _navLock = true;
  setTimeout(function() { _navLock = false; }, 250);

  console.debug('[nav] goTo:', screenId, '(from:', _activeScreen, ')');
  _navVersion++;
  trackEvent('screen_view', { screen: screenId });

  // ── Phase 1: Leave previous screen ──
  try {
    // Global cleanup first (GIF picker, plus menus, send flags)
    _navGlobalCleanup();

    // Close ALL overlays, sheets, modals, pickers
    bbCloseAll();

    // Run screen-specific leave hook
    var prevHook = _screenHooks[_activeScreen];
    if (prevHook && prevHook.leave) {
      try { _runHook(prevHook.leave); } catch(e) { console.error('[nav] onLeave error:', _activeScreen, e); }
    }
  } catch(e) { console.error('[nav] cleanup error:', e); }

  // ── Phase 2: Switch screen ──
  _activeScreen = screenId;
  navState.screen = screenId;
  navState.overlay = null;
  navState.modal = null;

  if (!_navPopLock) {
    _navStack.push(screenId);
    if (_navStack.length > 40) _navStack = _navStack.slice(-30);
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
        _slideNavIndicator(activeIdx);
      }
    }
  } catch(e) { console.error('[nav] nav update error:', e); }

  // Update Home nav dot visibility based on current screen
  try { if (typeof unreadState !== 'undefined') unreadState.render(); } catch(e) {}

  // ── Phase 4: Enter new screen ──
  try {
    var enterHook = _screenHooks[screenId];
    if (enterHook && enterHook.enter) {
      _runHook(enterHook.enter);
    }
  } catch(e) { console.error('[nav] onEnter error:', screenId, e); }
}

// ── Safe post-navigation callback ──
// Replaces goTo() + setTimeout(() => openX(), N) pattern
// Waits for screen render before firing callback
function goToThen(screenId, callback) {
  goTo(screenId);
  // rAF ensures DOM is painted, second rAF ensures layout is stable
  requestAnimationFrame(function() {
    requestAnimationFrame(function() {
      if (typeof callback === 'function') {
        try { callback(); } catch(e) { logError('goToThen:callback', e); }
      }
    });
  });
}
