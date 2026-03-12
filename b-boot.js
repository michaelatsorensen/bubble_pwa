// ══════════════════════════════════════════════════════════
//  BUBBLE — BOOT + EVENT DELEGATION + ANALYTICS
//  Auto-split from app.js · v3.7.0
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
//  AGGRESSIVE PRELOAD — makes app feel instant
// ══════════════════════════════════════════════════════════
async function preloadAllData() {
  try {
    await Promise.all([
      loadHome(),
      loadDiscover(),
      loadMessages(),
      loadMyBubbles(),
      loadSavedContacts(),
      loadProximityMap(),
      loadBlockedUsers(),
      loadPromotedCustomTags()
    ].map(function(p) { return p.catch(function(e) { logError('preload', e); }); }));
  } catch(e) { logError('preloadAllData', e); }
}


// ══════════════════════════════════════════════════════════
//  CHAT INPUT EVENT LISTENERS (bind exactly once on load)
// ══════════════════════════════════════════════════════════
window.addEventListener('load', () => {
  const bcInput = document.getElementById('bc-input');
  if (bcInput) {
    bcInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        bcSendMessage();
      }
    }, { passive: false });
  }

  const dmInput = document.getElementById('chat-input');
  if (dmInput) {
    dmInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (!currentChatUser) return;
        sendMessage();
      }
    }, { passive: false });
  }

  const dmFileInput = document.getElementById('dm-file-input');
  if (dmFileInput) {
    dmFileInput.addEventListener('change', () => dmHandleFile(dmFileInput));
  }

  // Onboarding strength meter — listen on all fields
  ['ob-name','ob-title','ob-bio','ob-linkedin','ob-workplace'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('input', updateObStrength);
  });
});
// Login/signup Enter key handling
document.getElementById('login-password')?.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') { e.preventDefault(); handleLogin(); }
});
document.getElementById('login-email')?.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') { e.preventDefault(); document.getElementById('login-password').focus(); }
});
document.getElementById('signup-password')?.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') { e.preventDefault(); handleSignup(); }
});


// ══════════════════════════════════════════════════════════
//  GLOBAL EVENT DELEGATION
// ══════════════════════════════════════════════════════════
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;
  const id = el.dataset.id;
  const from = el.dataset.from;
  switch (action) {
    case 'openBubble': openBubble(id); break;
    case 'openPerson': openPerson(id, from); break;
    case 'openChat': openChat(id, from); break;
    case 'joinBubble': joinBubble(id); break;
    case 'requestJoin': requestJoin(id); break;
    case 'openQRModal': openQRModal(id); break;
    case 'leaveBubble': leaveBubble(id); break;
    case 'openEditBubble': openEditBubble(id); break;
    case 'openBubbleChat': openBubbleChat(id, from); break;
  }
});

// ══════════════════════════════════════════════════════════
//  PULL-TO-REFRESH
// ══════════════════════════════════════════════════════════
(function initPullToRefresh() {
  if (isDesktop) return; // No PTR on desktop
  const PTR_THRESHOLD = 100;  // px to pull before triggering
  const PTR_MAX = 120;        // max indicator travel
  const PTR_RESISTANCE = 3;   // finger-to-indicator ratio

  // Map: screen ID → { scrollEl selector, refreshFn }
  const screenMap = {
    'screen-home':          { scroll: '#home-scroll', fn: loadHome },
    'screen-bubbles':       { scroll: '#screen-bubbles .scroll-area', fn: loadMyBubbles },
    'screen-discover':      { scroll: '#screen-discover .scroll-area', fn: loadDiscover },
    'screen-messages':      { scroll: '#screen-messages .scroll-area', fn: loadMessages },
    'screen-notifications': { scroll: '#screen-notifications .scroll-area', fn: loadNotifications },
    'screen-profile':       { scroll: null, fn: loadProfile }, // uses active panel
  };

  // Create the indicator element
  const indicator = document.createElement('div');
  indicator.className = 'ptr-indicator';
  indicator.innerHTML = '<div class="ptr-spinner"></div>';
  document.body.appendChild(indicator);

  let startY = 0;
  let pulling = false;
  let refreshing = false;

  function getScrollEl() {
    const active = document.querySelector('.screen.active');
    if (!active) return null;
    const cfg = screenMap[active.id];
    if (!cfg) return null;

    // Profile: find the visible panel
    if (active.id === 'screen-profile') {
      return active.querySelector('[id^="prof-panel-"]:not([style*="display:none"]):not([style*="display: none"])') ||
             active.querySelector('[id^="prof-panel-"]');
    }
    return cfg.scroll ? document.querySelector(cfg.scroll) : active.querySelector('.scroll-area');
  }

  function getRefreshFn() {
    const active = document.querySelector('.screen.active');
    if (!active) return null;
    const cfg = screenMap[active.id];
    return cfg?.fn || null;
  }

  document.addEventListener('touchstart', (e) => {
    if (refreshing) return;
    const scrollEl = getScrollEl();
    if (!scrollEl) return;
    if (scrollEl.scrollTop > 5) return; // only when at top
    startY = e.touches[0].clientY;
    pulling = true;
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (!pulling || refreshing) return;
    const scrollEl = getScrollEl();
    if (!scrollEl || scrollEl.scrollTop > 5) { pulling = false; return; }

    const dy = (e.touches[0].clientY - startY) / PTR_RESISTANCE;
    if (dy < 0) return;

    const travel = Math.min(dy, PTR_MAX);
    indicator.style.transform = `translateX(-50%) translateY(${travel - 40}px)`;
    indicator.style.opacity = Math.min(travel / PTR_THRESHOLD, 1);
    indicator.classList.add('visible');

    if (travel >= PTR_THRESHOLD) {
      indicator.classList.add('ready');
    } else {
      indicator.classList.remove('ready');
    }
  }, { passive: true });

  document.addEventListener('touchend', async () => {
    if (!pulling) return;
    pulling = false;

    if (!indicator.classList.contains('ready')) {
      resetIndicator();
      return;
    }

    const fn = getRefreshFn();
    if (!fn) { resetIndicator(); return; }

    // Trigger refresh
    refreshing = true;
    indicator.classList.add('refreshing');
    indicator.classList.remove('ready');
    indicator.style.transform = 'translateX(-50%) translateY(20px)';
    indicator.style.opacity = '1';

    try {
      await fn();
    } catch(e) { logError('PTR refresh error', e); }

    refreshing = false;
    indicator.classList.remove('refreshing');
    resetIndicator();
    showToast('Opdateret');
  }, { passive: true });

  function resetIndicator() {
    indicator.style.transition = 'transform 0.3s, opacity 0.3s';
    indicator.style.transform = 'translateX(-50%) translateY(-40px)';
    indicator.style.opacity = '0';
    setTimeout(() => {
      indicator.classList.remove('visible', 'ready', 'refreshing');
      indicator.style.transition = '';
    }, 300);
  }
})();


//  APP BOOT
// ══════════════════════════════════════════════════════════
// ── Lyt på beskeder fra Service Worker ──
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', function(event) {
    var msg = event.data;
    if (!msg) return;

    // Ny app-version tilgængelig
    if (msg.type === 'SW_UPDATED') {
      showUpdateBanner();
      return;
    }

    // Push-notifikation klik → naviger
    if (msg.type === 'PUSH_NAVIGATE') {
      var d = msg.data || {};
      var t = d.type || '';
      if ((t === 'new_message' || t === 'message') && d.sender_id) {
        if (currentUser) openChat(d.sender_id, 'screen-messages');
      } else if (t === 'new_invite' || t === 'invitation' || t === 'saved_contact') {
        goTo('screen-notifications');
        loadNotifications();
      }
    }
  });

  // Tjek også ved app-start om SW har en opdatering klar
  navigator.serviceWorker.ready.then(function(reg) {
    reg.update(); // Trigger SW update check
  });
}

function showUpdateBanner() {
  if (document.getElementById('update-banner')) return;
  var banner = document.createElement('div');
  banner.id = 'update-banner';
  banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;'
    + 'padding-top:env(safe-area-inset-top,0px);'
    + 'background:rgba(12,12,25,0.92);'
    + 'backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);'
    + 'border-bottom:1px solid rgba(139,127,255,0.25);'
    + 'box-shadow:0 4px 24px rgba(0,0,0,0.4);';
  banner.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;'
    + 'padding:0.55rem 1rem;gap:0.75rem;font-family:inherit">'
    + '<div style="display:flex;align-items:center;gap:0.5rem;min-width:0">'
    + '<div style="width:28px;height:28px;border-radius:8px;background:linear-gradient(135deg,var(--accent),var(--accent2));display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:0.75rem">✦</div>'
    + '<span style="font-size:0.78rem;font-weight:600;color:var(--text)">Ny version klar</span>'
    + '</div>'
    + '<div style="display:flex;gap:0.4rem;flex-shrink:0">'
    + '<button onclick="window.location.reload()" style="background:linear-gradient(135deg,var(--accent),var(--accent2));border:none;'
    + 'color:#fff;padding:0.35rem 0.85rem;border-radius:99px;font-weight:700;font-size:0.72rem;'
    + 'font-family:inherit;cursor:pointer;white-space:nowrap">Opdatér</button>'
    + '<button onclick="this.closest(\'#update-banner\').remove()" style="background:none;border:1px solid var(--glass-border);'
    + 'color:var(--muted);padding:0.35rem 0.6rem;border-radius:99px;font-size:0.72rem;'
    + 'font-family:inherit;cursor:pointer">Senere</button>'
    + '</div></div>';
  document.body.prepend(banner);
}

window.addEventListener('load', async () => {
  await checkAuth();
  await checkQRJoin();
  await checkPendingJoin();
  if (currentUser) {
    updateUnreadBadge();
    updateNotifNavBadge();
    initGlobalRealtime();
    loadLiveBubbleStatus();
    preloadAllData();
    initPushNotifications();
    trackEvent('app_open');
  }
  // Init swipe-to-close on all sheets/modals
  initAllSwipeClose();
  initInputConfirmButtons();

  // iOS keyboard dismiss: blur active input when tapping outside inputs
  document.addEventListener('touchstart', function(e) {
    var active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
      if (e.target !== active && !e.target.closest('.input-wrap') && !e.target.closest('.chips-container') && !e.target.closest('.ob-cat-custom-row') && !e.target.closest('.tag-suggestions')) {
        active.blur();
      }
    }
  }, { passive: true });

  // Nav bar is handled purely by CSS #global-nav rule

  // ── Rubber band elastic overscroll for scroll areas ──
  (function initRubberBand() {
    if (isDesktop) return;

    var RESISTANCE = 3.5;
    var BOUNCE_MS = 400;
    var BOUNCE_EASE = 'cubic-bezier(0.25, 0.46, 0.45, 0.94)';

    document.querySelectorAll('.scroll-area').forEach(function(scrollEl) {
      var startY = 0;
      var pulling = false;
      var direction = 0;

      // Apply transform to ALL direct children simultaneously
      function setTransform(value, transition) {
        var children = scrollEl.children;
        for (var i = 0; i < children.length; i++) {
          children[i].style.transition = transition || 'none';
          children[i].style.transform = value;
        }
      }

      function clearTransform() {
        var children = scrollEl.children;
        for (var i = 0; i < children.length; i++) {
          children[i].style.transition = '';
          children[i].style.transform = '';
        }
      }

      scrollEl.addEventListener('touchstart', function(e) {
        startY = e.touches[0].clientY;
        pulling = true;
        direction = 0;
        setTransform('', 'none');
      }, { passive: true });

      scrollEl.addEventListener('touchmove', function(e) {
        if (!pulling) return;
        var dy = e.touches[0].clientY - startY;
        var atTop = scrollEl.scrollTop <= 0;
        var atBottom = scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 1;

        if (atTop && dy > 0) {
          direction = 1;
          var pull = dy / RESISTANCE;
          setTransform('translate3d(0,' + pull + 'px,0)');
        } else if (atBottom && dy < 0) {
          direction = -1;
          var pull = dy / RESISTANCE;
          setTransform('translate3d(0,' + pull + 'px,0)');
        } else {
          if (direction !== 0) {
            direction = 0;
            clearTransform();
          }
        }
      }, { passive: true });

      function snapBack() {
        pulling = false;
        if (direction !== 0) {
          setTransform('translate3d(0,0,0)', 'transform ' + BOUNCE_MS + 'ms ' + BOUNCE_EASE);
          setTimeout(clearTransform, BOUNCE_MS + 10);
        }
        direction = 0;
      }

      scrollEl.addEventListener('touchend', snapBack, { passive: true });
      scrollEl.addEventListener('touchcancel', snapBack, { passive: true });
    });
  })();
});


// ══════════════════════════════════════════════════════════
//  ANALYTICS
// ══════════════════════════════════════════════════════════

var _analyticsQueue = [];
var _analyticsFlushTimer = null;

function trackEvent(event, data) {
  if (!currentUser) return;
  _analyticsQueue.push({
    user_id: currentUser.id,
    event: event,
    data: data ? JSON.stringify(data) : null,
    screen: document.querySelector('.screen.active')?.id || '',
    timestamp: new Date().toISOString()
  });

  // Debounce flush — batch writes every 3 seconds
  clearTimeout(_analyticsFlushTimer);
  _analyticsFlushTimer = setTimeout(flushAnalytics, 3000);
}

async function flushAnalytics() {
  if (_analyticsQueue.length === 0) return;
  var batch = _analyticsQueue.splice(0);
  try {
    await sb.from('analytics').insert(batch);
  } catch(e) {
    // Silent fail — analytics should never break the app
    console.debug('Analytics flush failed:', e.message);
  }
}

// Flush on page unload
window.addEventListener('beforeunload', function() {
  // Flush any remaining analytics via normal SDK call
  // (sendBeacon without auth headers would get 401 from Supabase)
  if (_analyticsQueue.length > 0) {
    flushAnalytics().catch(function() {});
  }
});


