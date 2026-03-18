// ══════════════════════════════════════════════════════════
//  BUBBLE — NAVIGATION
//  Auto-split from app.js · v3.7.0
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
//  NAVIGATION
// ══════════════════════════════════════════════════════════
var _navLock = false;

function goTo(screenId) {
  // Fix 1: Skip if already on this screen
  if (_activeScreen === screenId) return;
  // Fix 5: Click throttle (250ms)
  if (_navLock) return;
  _navLock = true;
  setTimeout(function() { _navLock = false; }, 250);

  try {
    console.debug('[nav] goTo:', screenId);
    _navVersion++;
    _activeScreen = screenId;
    trackEvent('screen_view', { screen: screenId });

    // Force close any lingering sheets/overlays
    try { document.querySelectorAll('.person-sheet.open,.person-sheet-overlay.open,.radar-person-sheet.open,.radar-person-overlay.open').forEach(function(el) { el.classList.remove('open'); el.style.transform = ''; }); } catch(e) {}

    // Cleanup: unsubscribe when leaving chat screens
    const prev = document.querySelector('.screen.active');
    if (prev) {
      const prevId = prev.id;
      if (prevId === 'screen-chat' && screenId !== 'screen-chat') {
        try { if (chatSubscription) { chatSubscription.unsubscribe(); chatSubscription = null; } } catch(e) {}
        dmEditingId = null;
      }
      if (prevId === 'screen-bubble-chat' && screenId !== 'screen-bubble-chat') {
        try { if (bcSubscription) { bcSubscription.unsubscribe(); bcSubscription = null; } } catch(e) {}
        bcEditingId = null;
        bcCurrentMsgId = null;
        try { bcCloseContext(); } catch(e) {}
        // Restore action bar if leave-confirm tray was showing
        try { cancelLeaveBubble(); } catch(e) {}
      }
    }
  } catch(e) {
    console.error('[nav] cleanup error:', e);
  }
  // ALWAYS switch screen — even if cleanup failed
  try {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (!target) { console.error('[nav] screen not found:', screenId); return; }
    // Force reflow to ensure CSS re-evaluates
    void target.offsetHeight;
    target.classList.add('active');
  } catch(navErr) {
    console.error('[nav] screen switch error:', navErr);
  }

  // Reset profile tab to default when navigating to profile
  if (screenId === 'screen-profile') {
    // keep current tab
  }
  window.scrollTo(0,0);

  // Update bottom nav active state + visibility
  try {
    const navMap = {
      'screen-home': 0, 'screen-bubbles': 0, 'screen-bubble-chat': -1,
      'screen-discover': 1,
      'screen-messages': 2, 'screen-chat': -1,
      'screen-profile': 3,
      'screen-notifications': -1, 'screen-person': -1,
      'screen-qr-preview': -1, 'screen-qr-teaser': -1, 'screen-social-proof': -1, 'screen-guest-checkin': -1, 'screen-event-ready': -1
    };
    const globalNav = document.getElementById('global-nav');
    const activeIdx = navMap[screenId];
    if (globalNav) {
      var hideNav = screenId === 'screen-chat' || screenId === 'screen-bubble-chat' || screenId === 'screen-qr-preview' || screenId === 'screen-qr-teaser' || screenId === 'screen-social-proof' || screenId === 'screen-guest-checkin' || screenId === 'screen-event-ready' || screenId === 'screen-auth' || screenId === 'screen-loading' || screenId === 'screen-onboarding' || screenId === 'screen-welcome';
      globalNav.classList.toggle('nav-hidden', hideNav);
      if (activeIdx !== undefined && activeIdx >= 0) {
        globalNav.querySelectorAll('.nav-item').forEach((btn, i) => {
          btn.classList.toggle('active', i === activeIdx);
        });
      }
    }
  } catch(e) { console.error('[nav] nav update error:', e); }

  // Load data for screen
  try {
    if (screenId === 'screen-home') loadHome();
    if (screenId === 'screen-bubbles') loadMyBubbles();
    if (screenId === 'screen-notifications') loadNotifications();
    if (screenId === 'screen-discover') loadDiscover();
    if (screenId === 'screen-messages') { loadMessages(); dmBadgeClear(); }
    if (screenId === 'screen-profile') loadProfile();
  } catch(e) { console.error('[nav] loader error:', e); }

  // Radar polling: start when on home/radar, stop when leaving
  if (screenId === 'screen-home') {
    rtStartRadarPolling();
  } else {
    rtStopRadarPolling();
  }

  // Clear notif badge when entering notifications
  if (screenId === 'screen-notifications') {
    notifBadgeSet(0);
    localStorage.setItem('bubble_notifs_seen', new Date().toISOString());
  }
}

// Nav is now in document flow (not fixed), so env(safe-area-inset-bottom)
// is handled by CSS directly. No JS safe-area management needed.