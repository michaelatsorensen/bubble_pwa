// ══════════════════════════════════════════════════════════
//  BUBBLE — NAVIGATION
//  Auto-split from app.js · v3.7.0
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
//  NAVIGATION
// ══════════════════════════════════════════════════════════
function goTo(screenId) {
  console.debug('[nav] goTo:', screenId);
  trackEvent('screen_view', { screen: screenId });

  // Force close any lingering sheets/overlays
  document.querySelectorAll('.person-sheet.open,.person-sheet-overlay.open,.radar-person-sheet.open,.radar-person-overlay.open').forEach(function(el) { el.classList.remove('open'); el.style.transform = ''; });

  // Cleanup: unsubscribe when leaving chat screens
  const prev = document.querySelector('.screen.active');
  if (prev) {
    const prevId = prev.id;
    if (prevId === 'screen-chat' && screenId !== 'screen-chat') {
      if (chatSubscription) { chatSubscription.unsubscribe(); chatSubscription = null; }
      dmEditingId = null;
    }
    if (prevId === 'screen-bubble-chat' && screenId !== 'screen-bubble-chat') {
      if (bcSubscription) { bcSubscription.unsubscribe(); bcSubscription = null; }
      bcEditingId = null;
      bcCurrentMsgId = null;
      bcCloseContext();
    }
  }
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(screenId);
  if (!target) { console.error('[nav] screen not found:', screenId); return; }
  target.classList.add('active');

  // Reset profile tab to default when navigating to profile
  if (screenId === 'screen-profile') {
    // keep current tab
  }
  window.scrollTo(0,0);

  // Update bottom nav active state + visibility
  const navMap = {
    'screen-home': 0, 'screen-bubbles': 0, 'screen-bubble-chat': -1,
    'screen-discover': 1,
    'screen-messages': 2, 'screen-chat': -1,
    'screen-profile': 3,
    'screen-notifications': -1, 'screen-person': -1
  };
  const globalNav = document.getElementById('global-nav');
  const activeIdx = navMap[screenId];
  if (globalNav) {
    var hideNav = screenId === 'screen-chat' || screenId === 'screen-bubble-chat';
    globalNav.classList.toggle('nav-hidden', hideNav);
    if (activeIdx !== undefined && activeIdx >= 0) {
      globalNav.querySelectorAll('.nav-item').forEach((btn, i) => {
        btn.classList.toggle('active', i === activeIdx);
      });
    }
  }

  // Load data for screen
  if (screenId === 'screen-home') loadHome();
  if (screenId === 'screen-bubbles') loadMyBubbles();
  if (screenId === 'screen-notifications') loadNotifications();
  if (screenId === 'screen-discover') loadDiscover();
  if (screenId === 'screen-messages') { loadMessages(); dmBadgeClear(); }
  if (screenId === 'screen-profile') loadProfile();

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


