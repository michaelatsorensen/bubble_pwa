// ══════════════════════════════════════════════════════════
//  BUBBLE — BOOT + EVENT DELEGATION + ANALYTICS
//  DOMAIN: boot
//  OWNS: delegation handler (data-action), pull-to-refresh, deep link routing, SW registration
//  ORCHESTRATES: checkAuth → resolvePostAuth → goTo
//  READS: all domains (orchestrator role)
//  Auto-split from app.js · v3.7.0
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
//  LANDING PAGE REDIRECT LOGIC
//  - No session + no deep link → redirect to landing.html
//  - ?auth=1 from landing → show auth screen directly
//  - Deep links (?qrt=, ?event=, etc.) → bypass landing
// ══════════════════════════════════════════════════════════
var _cameFromLanding = false; // Set true in load handler if ?auth=1 was present

function shouldBypassLanding() {
  if (_cameFromLanding) return true;
  var params = new URLSearchParams(window.location.search);
  return params.has('qrt') || params.has('profile') || params.has('join') ||
         params.has('event') || params.has('push') || params.has('auth') ||
         params.has('code') || // PKCE OAuth callback (LinkedIn, Apple, etc.)
         (window.location.hash && window.location.hash.includes('access_token'));
}

function redirectToLanding() {
  if (!window.location.pathname.includes('landing.html')) {
    window.location.replace('landing.html');
  }
}

// ══════════════════════════════════════════════════════════
//  AGGRESSIVE PRELOAD — makes app feel instant
// ══════════════════════════════════════════════════════════
async function preloadAllData() {
  try {
    // Core: messages badge + bubbles badge for nav-bar.
    // Bubble list itself still loads lazily on screen-bubbles enter via nav hook.
    // _recountBubbleUnread is lightweight: 1 query for memberships + 1 RPC for latest msg times.
    await Promise.all([
      loadMessages(),
      _recountBubbleUnread()
    ].map(function(p) { return p.catch(function(e) { logError('preload', e); }); }));
  } catch(e) { logError('preloadAllData', e); }
}


// ══════════════════════════════════════════════════════════
//  CHAT INPUT EVENT LISTENERS (bind exactly once on load)
// ══════════════════════════════════════════════════════════
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
    case 'openBubble': openBubble(id, from); break;
    case 'openPerson': openPerson(id, from); break;
    case 'openChat': openChat(id, from); break;
    case 'joinBubble': joinBubble(id); break;
    case 'requestJoin': confirmRequestJoin(id); break;
    case 'openQRModal': openQRModal(id); break;
    case 'leaveBubble': leaveBubble(id, el); break;
    case 'openEditBubble': openEditBubble(id); break;
    case 'openBubbleChat': openBubbleChat(id, from); break;
    case 'toggleSaveBubble': toggleSaveBubble(id, el); break;
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
    'screen-bubbles-explore': { scroll: '#screen-bubbles .scroll-area', fn: loadDiscover },
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


// ══════════════════════════════════════════════════════════
//  QR ANON ROUTING — preview profile without login
// ══════════════════════════════════════════════════════════
async function checkQRAnonPreview() {
  try {
    var params = new URLSearchParams(window.location.search);
    var profileId = params.get('profile');
    var joinId = params.get('join');
    var qrToken = params.get('qrt');

    // Reject malformed UUIDs early — prevents injection via crafted URLs
    if (profileId && !isUuid(profileId)) profileId = null;
    if (joinId && !isUuid(joinId)) joinId = null;
    // qrToken is short-lived random string, not UUID — keep as-is but cap length
    if (qrToken && (typeof qrToken !== 'string' || qrToken.length > 40 || !/^[a-z0-9]+$/i.test(qrToken))) qrToken = null;

    // Resolve QR token → profile ID
    if (qrToken && !profileId) {
      try {
        var tokenData = await resolveQrToken(qrToken);
        if (tokenData) {
          if (!tokenData.expired) {
            profileId = tokenData.user_id;
          } else {
            // Token expired — clean URL and show toast
            window.history.replaceState({}, document.title, window.location.pathname);
            // Don't block boot — just ignore expired token
          }
        }
      } catch(e) { logError('qrToken resolve', e); }
    }
    
    // Only show anon preview if NOT logged in
    var { data: { session } } = await sb.auth.getSession();
    if (session) {
      // Logged-in user scanning a QR → save contact + navigate to profile
      if (profileId && profileId !== session.user.id) {
        flowSet('pending_contact', profileId);
      }
      // Clean URL to prevent re-entry on refresh
      window.history.replaceState({}, document.title, window.location.pathname);
      return false;
    }
    
    if (profileId) {
      flowSet('pending_contact', profileId);
      await loadQRProfilePreview(profileId);
      return true;
    }
    if (joinId) {
      flowSet('pending_join', joinId);
      await loadQRProfilePreview(null, joinId);
      return true;
    }
    return false;
  } catch(e) {
    logError('checkQRAnonPreview', e);
    return false;
  }
}

// ── Store QR owner profile for contextual auth ──
var _qrContactProfile = null;

async function loadQRProfilePreview(userId, bubbleId) {
  try {
    if (!sb) initSupabase();
    
    if (userId) {
      var _pv = ((await sb.rpc('get_profile_preview', { p_user_id: userId, p_bubble_id: bubbleId || null })).data) || {};
      var profile = _pv.profile;
      
      if (profile) {
        // Store for contextual auth
        _qrContactProfile = profile;

        // ── Hero ──
        var nameEl = document.getElementById('qr-preview-name');
        var titleEl = document.getElementById('qr-preview-title');
        var tagsEl = document.getElementById('qr-preview-tags');
        var avatarEl = document.getElementById('qr-preview-avatar');
        
        if (nameEl) nameEl.textContent = profile.name || 'Bubble-bruger';
        if (titleEl) {
          var titleParts = [];
          if (profile.title) titleParts.push(profile.title);
          if (profile.workplace) titleParts.push(profile.workplace);
          titleEl.textContent = titleParts.join(' · ') || '';
        }
        if (tagsEl) {
          tagsEl.innerHTML = (profile.keywords || []).slice(0, 5).map(function(t) {
            return '<span style="font-size:0.68rem;padding:0.2rem 0.55rem;border-radius:99px;background:rgba(100,180,230,0.07);color:#534AB7;font-weight:500">' + escHtml(t) + '</span>';
          }).join('');
        }
        if (avatarEl) {
          if (profile.avatar_url) {
            avatarEl.innerHTML = '<img src="' + escHtml(profile.avatar_url) + '" class="u-avatar-img">';
          } else {
            avatarEl.textContent = (profile.name || '?').split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();
          }
        }
        
        // ── Stats: network count + bubbles (from preview RPC) ──
        var netCount = _pv.contact_count || 0;
        var memberships = (_pv.bubbles || []).map(function(b) { return { bubbles: b, bubble_id: b.id }; });
        
        var netEl = document.getElementById('qr-preview-network-count');
        if (netEl) netEl.textContent = netCount;
        var bubCountEl = document.getElementById('qr-preview-bubble-count');
        if (bubCountEl) bubCountEl.textContent = memberships.length;
        
        // ── Bubble pills ──
        var bubblesEl = document.getElementById('qr-preview-bubbles');
        if (bubblesEl && memberships.length > 0) {
          bubblesEl.innerHTML = memberships.map(function(m) {
            var b = m.bubbles || {};
            var isEvent = b.type === 'event' || b.type === 'live';
            var col = isEvent ? 'rgba(46,207,207,' : 'rgba(100,180,230,';
            var dotCol = isEvent ? '#2ECFCF' : 'rgb(100,180,230)';
            var txtCol = isEvent ? '#0F6E56' : '#534AB7';
            return '<div style="display:flex;align-items:center;gap:0.3rem;padding:0.35rem 0.65rem;border-radius:10px;background:' + col + '0.06);border:1px solid ' + col + '0.12);flex-shrink:0">' +
              '<div style="width:6px;height:6px;border-radius:50%;background:' + dotCol + '"></div>' +
              '<span style="font-size:0.68rem;font-weight:600;color:' + txtCol + ';white-space:nowrap">' + escHtml(b.name || '...') + '</span></div>';
          }).join('');
        }
        
        // ── Network contacts (real profiles from shared bubbles) ──
        var labelEl = document.getElementById('qr-preview-context-label');
        if (labelEl && profile.name) {
          labelEl.textContent = t('qr_people_network', {name: profile.name.split(' ')[0]});
        }
        var listEl = document.getElementById('qr-preview-network-list');
        var moreEl = document.getElementById('qr-preview-more-label');
        if (listEl) {
          // Network from preview RPC (contacts, safe fields only)
          var contacts = (_pv.network || []).slice(0, 5).map(function(p) { return { profiles: p }; });
          
          var colors = [
            'linear-gradient(135deg,#2ECFCF,#22B8CF)','linear-gradient(135deg,#8B5CF6,#A855F7)',
            'linear-gradient(135deg,#E879A8,#EC4899)','linear-gradient(135deg,#1A9E8E,#10B981)',
            'linear-gradient(135deg,#6366F1,rgb(100,180,230))'
          ];
          if (contacts && contacts.length > 0) {
            listEl.innerHTML = contacts.map(function(c, i) {
              var p = c.profiles || {};
              var ini = (p.name || '?').split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();
              var avHtml = p.avatar_url
                ? '<img src="' + escHtml(p.avatar_url) + '" class="u-avatar-img">'
                : ini;
              var tags = (p.keywords || []).slice(0, 2).map(function(t) {
                return '<span style="font-size:0.55rem;padding:0.1rem 0.35rem;border-radius:6px;background:rgba(100,180,230,0.07);color:#534AB7">' + escHtml(t) + '</span>';
              }).join('');
              return '<div style="display:flex;align-items:center;gap:0.6rem;padding:0.6rem 0.7rem;border-radius:12px;background:rgba(30,27,46,0.02);border:1px solid var(--glass-border-subtle)">' +
                '<div style="width:38px;height:38px;border-radius:50%;background:' + colors[i % colors.length] + ';display:flex;align-items:center;justify-content:center;color:white;font-size:0.72rem;font-weight:700;flex-shrink:0;overflow:hidden">' + avHtml + '</div>' +
                '<div style="flex:1;min-width:0"><div style="font-size:0.8rem;font-weight:600;color:var(--text)">' + escHtml(p.name || '?') + '</div>' +
                '<div style="font-size:0.68rem;color:var(--text-secondary)">' + escHtml(p.title || '') + '</div></div>' +
                (tags ? '<div style="display:flex;gap:0.15rem;flex-shrink:0">' + tags + '</div>' : '') +
              '</div>';
            }).join('');
            // "More" label
            if (moreEl && netCount > contacts.length) {
              moreEl.textContent = '+ ' + (netCount - contacts.length) + ' flere i netværket';
            }
          } else {
            listEl.innerHTML = '';
          }
        }
      }
      goTo('screen-qr-preview');
    } else {
      // Bubble join — route by bubble TYPE: events get the event-landing, networks the teaser
      var { data: _jb } = await sb.from('bubbles').select('id, name, type, location').eq('id', bubbleId).maybeSingle();
      if (_jb) { _routeBubblePreScreen(_jb); }
      else { goTo('screen-qr-teaser'); loadTeaserProfiles(bubbleId); }
    }
    window.history.replaceState({}, document.title, window.location.pathname);
  } catch(e) {
    logError('loadQRProfilePreview', e);
    goTo('screen-auth');
  }
}

function qrPreviewSignup() {
  // Go directly to auth with QR context — no teaser detour
  goTo('screen-auth');
  showAuthForms(true); // true = QR context mode
}

function qrTeaserSignup() {
  goTo('screen-auth');
  showAuthForms();
}

async function loadTeaserProfiles(bubbleId) {
  var el = document.getElementById('qr-teaser-profiles');
  if (!el) return;
  try {
    var profiles = [];
    var colors = [
      'linear-gradient(135deg,#2ECFCF,#22B8CF)','linear-gradient(135deg,#E879A8,#EC4899)',
      'linear-gradient(135deg,#8B5CF6,#A855F7)','linear-gradient(135deg,#1A9E8E,#10B981)',
      'linear-gradient(135deg,#6366F1,rgb(100,180,230))'
    ];

    var _tz = ((await sb.rpc('get_bubble_teaser', { p_bubble_id: bubbleId || null })).data) || {};
    // Bubble members first
    profiles = (_tz.members || []).filter(Boolean);

    // Fallback: recent active profiles
    if (profiles.length < 3) {
      var existingIds = profiles.map(function(p) { return p.id; });
      (_tz.recent || []).forEach(function(p) {
        if (profiles.length < 5 && existingIds.indexOf(p.id) < 0 && p.name && p.title) {
          profiles.push(p);
        }
      });
    }

    if (profiles.length === 0) {
      el.innerHTML = '<div style="text-align:center;padding:1rem;font-size:0.75rem;color:var(--muted)">Ingen profiler at vise endnu</div>';
      return;
    }

    var countEl = document.getElementById('qr-teaser-count');
    if (countEl) countEl.textContent = t('home_pros_count', {count: profiles.length});

    el.innerHTML = profiles.map(function(p, i) {
      var ini = (p.name || '?').split(' ').map(function(w){return w[0]}).join('').slice(0,2).toUpperCase();
      var subtitle = [p.title, p.workplace].filter(Boolean).join(' \u00B7 ');
      var avHtml = p.avatar_url
        ? '<img src="' + escHtml(p.avatar_url) + '" class="u-avatar-img">'
        : ini;
      var fade = i >= 3 ? 'opacity:' + (0.6 - (i - 3) * 0.2) : '';
      return '<div class="card" style="margin:0 1.2rem;' + fade + '"><div class="u-row-gap">' +
        '<div class="avatar" style="width:36px;height:36px;background:' + colors[i % colors.length] + ';overflow:hidden">' + avHtml + '</div>' +
        '<div><div style="font-size:0.82rem;font-weight:600">' + escHtml(p.name) + '</div>' +
        '<div style="font-size:0.68rem;color:var(--text-secondary)">' + escHtml(subtitle) + '</div></div></div></div>';
    }).join('');
  } catch(e) {
    logError('loadTeaserProfiles', e);
    el.innerHTML = '';
  }
}

// ══════════════════════════════════════════════════════════
//  SOCIAL PROOF SCREEN (opsøgende flow)
// ══════════════════════════════════════════════════════════
async function loadSocialProofScreen() {
  try {
    if (!sb) initSupabase();
    var count = (((await sb.rpc('get_teaser_stats')).data) || {}).profile_count || 0;
    var el = document.getElementById('sp-total-count');
    if (el) el.textContent = count || 0;
    
    // Only show screen if enough users (threshold)
    if (count && count >= 20) {
      goTo('screen-social-proof');
      return true;
    }
    return false;
  } catch(e) {
    logError('loadSocialProofScreen', e);
    return false;
  }
}

function spFilter(cat, el) {
  // UI only for now — toggle active state
  var bar = document.getElementById('sp-filters');
  if (bar) bar.querySelectorAll('.sp-filter-chip').forEach(function(c) { c.classList.remove('active'); });
  if (el) el.classList.add('active');
}

function spContinueToSignup() {
  goTo('screen-auth');
  showAuthForms();
}

// ══════════════════════════════════════════════════════════
//  PENDING CONTACT — auto-save QR owner after signup
// ══════════════════════════════════════════════════════════
async function checkPendingContact() {
  try {
    if (!currentUser) return null;
    var contactId = consumeFlow('pending_contact');
    if (!contactId || contactId === currentUser.id) return null;
    var result = await dbActions.saveContact(contactId);
    if (result.ok) showSuccessToast(t('toast_saved'));
    return contactId;
  } catch(e) {
    logError('checkPendingContact', e);
    return null;
  }
}

// ══════════════════════════════════════════════════════════
//  EVENT LANDING FLOW — teaser → signup → onboarding → QR
// ══════════════════════════════════════════════════════════
var _eventBubble = null;

// Route a not-logged-in user to the correct pre-auth screen by bubble TYPE
// (not by delivery method): events/live → event-landing + event_flow, networks → teaser.
// Shared by both the ?event link path and the ?join QR path so the pre-screen is
// consistent regardless of how the bubble was opened.
function _routeBubblePreScreen(bubble) {
  flowSet('pending_join', bubble.id);
  if (bubble.type === 'event' || bubble.type === 'live') {
    _eventBubble = bubble;
    flowSet('event_flow', 'true');
    var nameEl = document.getElementById('guest-event-name');
    var metaEl = document.getElementById('guest-event-meta');
    if (nameEl) nameEl.textContent = bubble.name;
    if (metaEl) metaEl.textContent = (bubble.location ? bubble.location + ' · ' : '') + 'Live Event';
    loadEventSocialProof(bubble.id);
    goTo('screen-guest-checkin');
  } else {
    loadTeaserProfiles(bubble.id);
    goTo('screen-qr-teaser');
  }
}

async function checkGuestEventRoute() {
  try {
    var params = new URLSearchParams(window.location.search);
    var eventId = params.get('event');
    if (!eventId) return false;
    
    // Validate before query — prevents string concat injection in .or() clause below.
    // Either valid UUID or short alphanumeric join_code (4-32 chars).
    // Ported from PROD v8.17.31 (Fix 1: UUID validation).
    if (!isUuid(eventId) && !/^[a-zA-Z0-9_-]{4,32}$/.test(eventId)) {
      _renderToast('Ugyldigt event-link', 'error');
      window.history.replaceState({}, document.title, window.location.pathname);
      return false;
    }
    
    // Already logged in → join + handle check-in
    var { data: { session } } = await sb.auth.getSession();
    if (session) {
      // P0.1 fix: resolve join_code → bubble.id BEFORE storing. pending_join is
      // consumed by showDeepLinkModal/checkPendingJoin via .eq('id', …), so a raw
      // join_code (non-UUID) would later yield "Event ikke fundet". Mirror the
      // logged-out resolution so the invariant holds: pending_join is always a bubble.id.
      var _resolvedId = eventId;
      try {
        var { data: _lb } = await sb.from('bubbles')
          .select('id')
          .or('id.eq.' + eventId + ',join_code.eq.' + eventId)
          .limit(1)
          .maybeSingle();
        if (_lb && _lb.id) _resolvedId = _lb.id;
      } catch(e) { /* fall back to raw eventId (UUID links still work) */ }
      flowSet('pending_join', _resolvedId);
      flowSet('event_flow', 'true');
      // Clean URL to prevent re-entry on refresh
      window.history.replaceState({}, document.title, window.location.pathname);
      return false;
    }
    
    // Resolve bubble
    var bubble = null;
    var { data: b } = await sb.from('bubbles')
      .select('id, name, type, location')
      .or('id.eq.' + eventId + ',join_code.eq.' + eventId)
      .limit(1)
      .maybeSingle();
    if (b) bubble = b;
    
    if (!bubble) {
      var uuidMatch = eventId.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
      if (uuidMatch) {
        var { data: b2 } = await sb.from('bubbles').select('id, name, type, location').eq('id', uuidMatch[0]).maybeSingle();
        if (b2) bubble = b2;
      }
    }
    
    if (!bubble) { _renderToast('Event ikke fundet', 'error'); return false; }
    
    // Route by bubble TYPE (events/live → event-landing, networks → teaser) — same as the QR path
    _routeBubblePreScreen(bubble);
    window.history.replaceState({}, document.title, window.location.pathname);
    return true;
  } catch(e) {
    logError('checkGuestEventRoute', e);
    return false;
  }
}

async function loadEventSocialProof(bubbleId) {
  try {
    var _tz = ((await sb.rpc('get_bubble_teaser', { p_bubble_id: bubbleId })).data) || {};
    var count = _tz.member_count || 0;

    var countEl = document.getElementById('event-attendee-count');
    if (countEl && count > 0) {
      countEl.textContent = count + ' deltager' + (count !== 1 ? 'e' : '') + ' er allerede her';
    } else if (countEl) {
      countEl.textContent = t('home_first_here');
    }

    var container = document.getElementById('event-blurred-profiles');
    if (!container) return;

    var avColors = ['linear-gradient(135deg,#2ECFCF,#22B8CF)','linear-gradient(135deg,#6366F1,rgb(100,180,230))','linear-gradient(135deg,#E879A8,#EC4899)','linear-gradient(135deg,#F59E0B,#EAB308)'];

    // Render one social-proof card. badge = optional label (e.g. VAERT).
    function _spCard(p, idx, badge) {
      var ini = (p.name || '?').split(' ').map(function(w){ return w[0]; }).join('').slice(0,2).toUpperCase();
      var tags = (p.keywords || []).slice(0,2).map(function(k) { return '<span style="font-size:0.58rem;padding:0.1rem 0.4rem;background:rgba(100,180,230,0.06);color:var(--accent);border-radius:99px">' + escHtml(k) + '</span>'; }).join('');
      var badgeHtml = badge ? '<span style="font-size:0.52rem;font-weight:700;letter-spacing:0.03em;color:#2c7fb8;background:rgba(100,180,230,0.15);border-radius:5px;padding:0.05rem 0.35rem;margin-left:0.35rem;vertical-align:middle">' + badge + '</span>' : '';
      return '<div style="background:rgba(255,255,255,0.075);border:0.5px solid rgba(255,255,255,0.12);border-radius:var(--radius);padding:0.7rem 0.9rem;display:flex;align-items:center;gap:0.6rem;box-shadow:0 1px 3px rgba(30,27,46,0.06)">' +
        '<div style="width:36px;height:36px;border-radius:50%;background:' + avColors[idx % avColors.length] + ';display:flex;align-items:center;justify-content:center;font-size:0.6rem;font-weight:700;color:white;flex-shrink:0">' + ini + '</div>' +
        '<div style="flex:1;min-width:0"><div style="font-size:0.8rem;font-weight:600;color:var(--text)">' + escHtml(p.name || 'Deltager') + badgeHtml + '</div>' +
        '<div style="font-size:0.68rem;color:var(--text-secondary)">' + escHtml(p.title || '') + (p.workplace ? ' \u00B7 ' + escHtml(p.workplace) : '') + '</div>' +
        (tags ? '<div style="display:flex;gap:0.2rem;margin-top:0.2rem">' + tags + '</div>' : '') +
        '</div></div>';
    }
    function _spLabel(txt) {
      return '<div style="font-size:0.6rem;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:var(--muted);padding:0.5rem 0.1rem 0.3rem">' + txt + '</div>';
    }

    var html = '';
    var shownIds = [];

    if (count > 0) {
      // Real attendees
      var members = (_tz.members || []).slice(0, 4).map(function(m) { return { profiles: m }; });
      (members || []).forEach(function(m) {
        var p = m.profiles || {};
        if (p.name) { html += _spCard(p, shownIds.length, null); shownIds.push(p.id); }
      });
      if (count > 4) html += '<div style="text-align:center;font-size:0.72rem;color:var(--accent);font-weight:600;padding:0.4rem 0">+ ' + (count - 4) + ' flere deltagere</div>';
    } else {
      // Empty event - anchor with the host/organizer (there is always a creator)
      var host = _tz.host;
      if (host && host.name) { html += _spCard(host, 0, 'V\u00C6RT'); shownIds.push(host.id); }
    }

    // Never empty: top up with nearby professionals - honestly labelled, NOT as "deltagere"
    if (shownIds.length < 3) {
      var recent = _tz.recent || [];
      var near = (recent || []).filter(function(p) { return p.name && p.title && shownIds.indexOf(p.id) < 0; });
      if (near.length) {
        html += _spLabel(t('home_more_pros'));
        near.forEach(function(p) {
          if (shownIds.length < 4) { html += _spCard(p, shownIds.length, null); shownIds.push(p.id); }
        });
      }
    }

    container.innerHTML = html;
  } catch(e) { logError('loadEventSocialProof', e); }
}

// ── Event signup actions ──


function eventSignupEmail() {
  flowSet('event_flow', 'true');
  goTo('screen-auth');
  showAuthForms();
  setTimeout(function() { if (typeof switchToSignup === 'function') switchToSignup(); }, 200);
}

function eventLoginExisting() {
  flowSet('event_flow', 'true');
  goTo('screen-auth');
  showAuthForms();
}

// ── Show QR after signup + onboarding ──
async function showEventReadyQR() {
  try {
    if (!currentUser || !currentProfile) return;
    
    goTo('screen-event-ready');
    
    var nameEl = document.getElementById('event-ready-name');
    var roleEl = document.getElementById('event-ready-role');
    if (nameEl) nameEl.textContent = currentProfile.name || '';
    if (roleEl) roleEl.textContent = (currentProfile.title || '') + (currentProfile.workplace ? ' · ' + currentProfile.workplace : '');
    
    var metaEl = document.getElementById('event-ready-meta');
    if (metaEl && _eventBubble) metaEl.textContent = t('qr_show_qr_at', {event: _eventBubble.name});
    
    // Generate rotating QR token (10 min)
    var token = crypto.randomUUID ? crypto.randomUUID().replace(/-/g,'') : (crypto.getRandomValues ? Array.prototype.map.call(crypto.getRandomValues(new Uint8Array(16)), function(b){return ('0'+b.toString(16)).slice(-2);}).join('') : (Date.now().toString(36)+Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2)).slice(0,32));
    var expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    var qrResult = await dbActions.createQRToken(token, expiresAt);
    if (!qrResult.ok) token = null;
    
    var qrUrl = token
      ? window.location.origin + window.location.pathname + '?qrt=' + token
      : window.location.origin + window.location.pathname + '?profile=' + currentUser.id;
    
    setTimeout(function() {
      var container = document.getElementById('event-ready-qr');
      if (container && typeof QRCode !== 'undefined') {
        container.innerHTML = '';
        new QRCode(container, {
          text: qrUrl,
          width: 220,
          height: 220,
          colorDark: '#1E1B2E',
          colorLight: '#FFFFFF',
          correctLevel: QRCode.CorrectLevel.M
        });
      }
    }, 200);
    
    trackEvent('event_qr_shown', { bubble_id: flowGet('pending_join') || '' });
  } catch(e) { logError('showEventReadyQR', e); }
}

function eventReadyGoToEvent() {
  var bubbleId = consumeFlow('pending_join');
  consumeFlow('post_tags_destination');
  if (bubbleId) {
    goToThen('screen-home', function() { openBubble(bubbleId, 'screen-home'); });
    loadHome();
  } else {
    goTo('screen-home');
    loadHome();
  }
}

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

    // SW version svar — vis banner hvis version ikke matcher
    if (msg.type === 'SW_VERSION') {
      var expected = 'bubble-' + BUILD_VERSION;
      if (msg.version && msg.version !== expected) {
        showUpdateBanner();
      }
      return;
    }

    // Push-notifikation klik → naviger
    if (msg.type === 'PUSH_NAVIGATE') {
      var d = msg.data || {};
      var pushType = d.type || '';
      if ((pushType === 'new_message' || pushType === 'message') && d.sender_id) {
        if (currentUser) openChat(d.sender_id, 'screen-messages');
      } else if (pushType === 'new_invite' || pushType === 'invitation' || pushType === 'saved_contact') {
        goTo('screen-notifications');
        loadNotifications();
      } else if (pushType === 'checkin' && d.bubble_id) {
        if (currentUser) openBubbleChat(d.bubble_id, 'screen-home');
      }
      // Refresh badges after push navigation
      setTimeout(function() { _unreadRecount(); updateTopbarNotifBadge(); }, 500);
    }
  });

  // Tjek også ved app-start om SW har en opdatering klar
  navigator.serviceWorker.ready.then(function(reg) {
    reg.update(); // Trigger SW update check

    // Ported from PROD v8.17.31 (Fix 7): detect waiting SW at boot
    // (in case SW_UPDATED postMessage missed)
    if (reg.waiting && navigator.serviceWorker.controller) {
      showUpdateBanner();
    }
    // Listen for new SW becoming waiting AFTER boot (deploy happens mid-session)
    reg.addEventListener('updatefound', function() {
      var newSW = reg.installing;
      if (!newSW) return;
      newSW.addEventListener('statechange', function() {
        if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
          // New SW installed but not yet active — show banner
          showUpdateBanner();
        }
      });
    });

    // Spørg den aktive SW om dens version og sammenlign med BUILD_VERSION
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'GET_VERSION' });
    }
  });
}

// Ported from PROD v8.17.31 (Fix 7): SW update orchestration
// 1. acceptUpdate() — called when user clicks "Opdatér" in banner
// 2. controllerchange listener — reloads after new SW takes control
// 3. updatefound listener — detects waiting SW that wasn't yet announced
function acceptUpdate() {
  if (!('serviceWorker' in navigator)) {
    window.location.reload();
    return;
  }
  navigator.serviceWorker.ready.then(function(reg) {
    // If a new SW is waiting, tell it to activate
    if (reg.waiting) {
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      // controllerchange listener (below) will reload when new SW takes control
    } else {
      // No waiting SW — just reload (handles edge case)
      window.location.reload();
    }
  }).catch(function() {
    window.location.reload();
  });
}

// Reload page when new SW takes control (after SKIP_WAITING + activate)
if ('serviceWorker' in navigator) {
  var _swReloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', function() {
    if (_swReloaded) return; // Prevent infinite reload loop
    _swReloaded = true;
    window.location.reload();
  });
}

function showUpdateBanner() {
  if (document.getElementById('update-banner')) return;
  var banner = document.createElement('div');
  banner.id = 'update-banner';
  banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;'
    + 'padding-top:env(safe-area-inset-top,0px);'
    + 'background:rgba(20,22,28,0.94);'
    + 'backdrop-filter:blur(24px) saturate(1.2);-webkit-backdrop-filter:blur(24px) saturate(1.2);'
    + 'border-bottom:1px solid rgba(100,180,230,0.35);'
    + 'box-shadow:0 4px 24px rgba(0,0,0,0.4),0 0 0 0.5px rgba(100,180,230,0.15);';
  banner.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;'
    + 'padding:0.7rem 1rem;gap:0.75rem;font-family:inherit">'
    + '<div style="display:flex;align-items:center;gap:0.6rem;min-width:0">'
    + '<div style="width:30px;height:30px;border-radius:9px;background:rgba(100,180,230,0.16);border:0.5px solid rgba(100,180,230,0.35);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#CFE6F7">'
    + '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6M3 12a9 9 0 0115-6.7L21 8M3 22v-6h6M21 12a9 9 0 01-15 6.7L3 16"/></svg>'
    + '</div>'
    + '<span style="font-size:0.76rem;font-weight:600;color:rgba(255,255,255,0.92);line-height:1.35">' + t('update_banner_text') + '</span>'
    + '</div>'
    + '<div style="display:flex;gap:0.4rem;flex-shrink:0">'
    + '<button onclick="acceptUpdate()" style="background:rgba(100,180,230,0.18);border:0.5px solid rgba(100,180,230,0.35);'
    + 'color:#CFE6F7;padding:0.4rem 0.9rem;border-radius:99px;font-weight:700;font-size:0.72rem;'
    + 'font-family:inherit;cursor:pointer;white-space:nowrap">' + t('update_banner_btn') + '</button>'
    + '<button onclick="this.closest(\'#update-banner\').remove()" style="background:none;border:0.5px solid rgba(255,255,255,0.14);'
    + 'color:rgba(255,255,255,0.5);padding:0.4rem 0.65rem;border-radius:99px;font-size:0.72rem;'
    + 'font-family:inherit;cursor:pointer;white-space:nowrap">' + t('update_banner_later') + '</button>'
    + '</div></div>';
  document.body.prepend(banner);
}

window.addEventListener('load', async () => {
  // Save flag BEFORE cleaning URL — used by shouldBypassLanding() later.
  // Persist in sessionStorage so reload survives (in-memory _cameFromLanding
  // would be reset by reload, and ?auth=1 URL param has already been stripped
  // on first visit — without this, reload on auth screen → redirectToLanding
  // → loop). sessionStorage clears on PWA close, so legitimate fresh opens
  // still see landing as intended.
  var _hadAuthParam = new URLSearchParams(window.location.search).has('auth');
  try {
    if (_hadAuthParam) sessionStorage.setItem('bubble_came_from_landing', '1');
    _cameFromLanding = _hadAuthParam || sessionStorage.getItem('bubble_came_from_landing') === '1';
  } catch(e) {
    _cameFromLanding = _hadAuthParam;
  }

  // Clean ?auth=1 param from landing page redirect (keep other params)
  var _urlParams = new URLSearchParams(window.location.search);
  if (_urlParams.has('auth')) {
    _urlParams.delete('auth');
    var _cleanUrl = _urlParams.toString() ? window.location.pathname + '?' + _urlParams.toString() : window.location.pathname;
    window.history.replaceState({}, document.title, _cleanUrl);
  }

  // ── Read flow intent from OAuth redirectTo URL params ──
  // b-auth.js encodes pending_contact/_join/event_flow as _fc/_fj/_fe in redirectTo.
  // After OAuth redirect, we restore them here before any auth/flow logic runs.
  // UUID validation prevents injection attacks via crafted OAuth callback URLs.
  (function restoreFlowFromUrl() {
    try {
      var p = new URLSearchParams(window.location.search);
      var fc = p.get('_fc'); // pending_contact
      var fj = p.get('_fj'); // pending_join
      var fe = p.get('_fe'); // event_flow
      if (fc && isUuid(fc)) flowSet('pending_contact', fc);
      if (fj && isUuid(fj)) flowSet('pending_join', fj);
      if (fe) flowSet('event_flow', 'true');
      // Clean flow params from URL (keep other params like ?auth=)
      if (fc || fj || fe) {
        p.delete('_fc'); p.delete('_fj'); p.delete('_fe');
        var clean = window.location.pathname + (p.toString() ? '?' + p.toString() : '');
        window.history.replaceState({}, '', clean);
      }
    } catch(e) { console.warn('[boot] restoreFlowFromUrl failed:', e); }
  })();

  // Check QR anon preview BEFORE auth (shows profile without login)
  if (initSupabase()) {
    var isGuest = await checkGuestEventRoute();
    if (isGuest) {
      initAllSwipeClose();
      return;
    }

    // Capture ?join= BEFORE auth so resolvePostAuthDestination handles it
    // This prevents the double-join race between checkPendingJoin + checkQRJoin
    var _joinParam = new URLSearchParams(window.location.search).get('join');
    if (_joinParam && isUuid(_joinParam)) {
      flowSet('pending_join', _joinParam);
      window.history.replaceState({}, '', window.location.pathname);
    } else if (_joinParam) {
      // Invalid UUID — clean URL but don't store
      window.history.replaceState({}, '', window.location.pathname);
    }

    var isAnon = await checkQRAnonPreview();
    if (isAnon) {
      initAllSwipeClose();
      return;
    }
  }
  await checkAuth();
  // Note: ?join= is captured during initial auth flow and handled inside
  // resolvePostAuthDestination() via showDeepLinkModal() (b-auth.js).
  // Legacy checkQRJoin() in b-bubbles.js is deprecated as of v8.20 —
  // see DEPRECATED comment there.
  if (currentUser) {
    // Realtime, badges, preload, pending actions already initialized by resolvePostAuth
    trackEvent('app_open');
  }
  // Init swipe-to-close on all sheets/modals
  initAllSwipeClose();
  initInputConfirmButtons();

  // Chat keyboard Enter handlers
  var bcInput = document.getElementById('bc-input');
  if (bcInput) bcInput.addEventListener('keydown', function(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); bcSendMessage(); } }, { passive: false });
  var dmInput = document.getElementById('chat-input');
  if (dmInput) dmInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') { e.preventDefault(); if (!currentChatUser) return; sendMessage(); } }, { passive: false });

  // Scroll-to-bottom FAB
  ['chat-messages', 'bc-messages'].forEach(function(scrollId) {
    var scrollEl = document.getElementById(scrollId);
    var fabId = scrollId === 'chat-messages' ? 'dm-scroll-bottom' : 'bc-scroll-bottom';
    if (scrollEl) scrollEl.addEventListener('scroll', function() {
      var fab = document.getElementById(fabId);
      if (!fab) return;
      fab.style.display = (scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight < 80) ? 'none' : 'flex';
    });
  });

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

  // Rubber band removed — iOS Safari has native overscroll elastic behaviour.
  // Custom implementation caused scroll jerk by clearing transforms without transition.
});


// ══════════════════════════════════════════════════════════
//  ANALYTICS
// ══════════════════════════════════════════════════════════

var _analyticsQueue = [];
var _analyticsFlushTimer = null;

function trackEvent(event, data) {
  if (!currentUser) return;
  if (_analyticsQueue.length >= 100) _analyticsQueue.shift(); // R6: cap at 100
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

// O2: Flush on visibility change (more reliable than beforeunload)
var _lastBgAt = 0; // P0.4: track background duration to detect likely socket death
document.addEventListener('visibilitychange', function() {
  if (document.hidden) {
    _lastBgAt = Date.now();
    // App backgrounded → flush analytics
    if (_analyticsQueue.length > 0) flushAnalytics().catch(function() {});
  } else {
    // App returned to foreground → refresh stale data
    if (!currentUser) return;

    // P0.4: iOS silently kills WebSockets in the background WITHOUT firing
    // offline/CHANNEL_ERROR, so _rtState can wrongly read 'connected'. If we were
    // backgrounded long enough that the socket likely died, force a reconnect.
    // rtReconnect() also re-subscribes the open DM/bubble chat realtime.
    var _bgMs = _lastBgAt ? (Date.now() - _lastBgAt) : 0;
    if (_bgMs > 8000 && typeof rtReconnect === 'function') {
      _rtReconnectAttempt = 0;
      rtReconnect();
    }

    _unreadRecount();
    updateTopbarNotifBadge();
    // Refresh active screen data — now includes chat screens (P0.4): reconnect only
    // re-subscribes; it doesn't backfill messages missed while backgrounded.
    if (_activeScreen === 'screen-messages') loadMessages();
    else if (_activeScreen === 'screen-home') { loadHome(); }
    else if (_activeScreen === 'screen-notifications') loadNotifications();
    else if (_activeScreen === 'screen-bubble-chat' && typeof bcBubbleId !== 'undefined' && bcBubbleId && typeof bcLoadMessages === 'function') bcLoadMessages();
    else if (_activeScreen === 'screen-chat' && typeof currentChatUser !== 'undefined' && currentChatUser && typeof loadChatMessages === 'function') loadChatMessages();
  }
});


