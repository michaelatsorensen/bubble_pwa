// ══════════════════════════════════════════════════════════
//  BUBBLE — BOOT + EVENT DELEGATION + ANALYTICS
//  DOMAIN: boot
//  OWNS: delegation handler (data-action), pull-to-refresh, deep link routing, SW registration
//  ORCHESTRATES: checkAuth → resolvePostAuth → goTo
//  READS: all domains (orchestrator role)
//  Auto-split from app.js · v3.7.0
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
//  AGGRESSIVE PRELOAD — makes app feel instant
// ══════════════════════════════════════════════════════════
async function preloadAllData() {
  try {
    // Core: messages (badge) + bubbles (nav). Discover + proximity load lazily on screen open.
    await Promise.all([
      loadMessages(),
      loadMyBubbles()
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

  // DM file input: handled via inline onchange in HTML (more reliable on iOS PWA)

  // Scroll-to-bottom FAB: show when scrolled up, hide when near bottom
  ['chat-messages', 'bc-messages'].forEach(function(scrollId) {
    var scrollEl = document.getElementById(scrollId);
    var fabId = scrollId === 'chat-messages' ? 'dm-scroll-bottom' : 'bc-scroll-bottom';
    if (scrollEl) {
      scrollEl.addEventListener('scroll', function() {
        var fab = document.getElementById(fabId);
        if (!fab) return;
        var atBottom = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight < 80;
        fab.style.display = atBottom ? 'none' : 'flex';
      });
    }
  });

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
    case 'openBubble': openBubble(id, from); break;
    case 'openPerson': openPerson(id, from); break;
    case 'openChat': openChat(id, from); break;
    case 'joinBubble': joinBubble(id); break;
    case 'requestJoin': requestJoin(id); break;
    case 'openQRModal': openQRModal(id); break;
    case 'leaveBubble': leaveBubble(id, el); break;
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
    
    // Resolve QR token → profile ID
    if (qrToken && !profileId) {
      try {
        var { data: tokenData } = await sb.from('qr_tokens')
          .select('user_id, expires_at')
          .eq('token', qrToken)
          .maybeSingle();
        if (tokenData) {
          if (new Date(tokenData.expires_at) > new Date()) {
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
      var { data: profile } = await sb.from('profiles')
        .select('id,name,title,keywords,avatar_url,workplace')
        .eq('id', userId)
        .maybeSingle();
      
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
            return '<span style="font-size:0.68rem;padding:0.2rem 0.55rem;border-radius:99px;background:rgba(124,92,252,0.07);color:#534AB7;font-weight:500">' + escHtml(t) + '</span>';
          }).join('');
        }
        if (avatarEl) {
          if (profile.avatar_url) {
            avatarEl.innerHTML = '<img src="' + escHtml(profile.avatar_url) + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%">';
          } else {
            avatarEl.textContent = (profile.name || '?').split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();
          }
        }
        
        // ── Stats: network count + bubble count (parallel) ──
        var [netRes, membRes] = await Promise.all([
          sb.from('saved_contacts').select('*', { count: 'exact', head: true })
            .or('user_id.eq.' + userId + ',contact_id.eq.' + userId),
          sb.from('bubble_members').select('bubble_id, bubbles(id,name,type)')
            .eq('user_id', userId).limit(8)
        ]);
        var netCount = netRes.count || 0;
        var memberships = membRes.data || [];
        
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
            var col = isEvent ? 'rgba(46,207,207,' : 'rgba(124,92,252,';
            var dotCol = isEvent ? '#2ECFCF' : '#7C5CFC';
            var txtCol = isEvent ? '#0F6E56' : '#534AB7';
            return '<div style="display:flex;align-items:center;gap:0.3rem;padding:0.35rem 0.65rem;border-radius:10px;background:' + col + '0.06);border:1px solid ' + col + '0.12);flex-shrink:0">' +
              '<div style="width:6px;height:6px;border-radius:50%;background:' + dotCol + '"></div>' +
              '<span style="font-size:0.68rem;font-weight:600;color:' + txtCol + ';white-space:nowrap">' + escHtml(b.name || '...') + '</span></div>';
          }).join('');
        }
        
        // ── Network contacts (real profiles from shared bubbles) ──
        var labelEl = document.getElementById('qr-preview-context-label');
        if (labelEl && profile.name) {
          labelEl.textContent = 'Folk i ' + profile.name.split(' ')[0] + 's netværk';
        }
        var listEl = document.getElementById('qr-preview-network-list');
        var moreEl = document.getElementById('qr-preview-more-label');
        if (listEl) {
          // Get contacts of this user
          var { data: contacts } = await sb.from('saved_contacts')
            .select('contact_id, profiles:contact_id(id,name,title,keywords,avatar_url)')
            .eq('user_id', userId).limit(5);
          // Fallback: bubble co-members
          if (!contacts || contacts.length === 0) {
            var bubbleIds = memberships.map(function(m) { return m.bubble_id; });
            if (bubbleIds.length > 0) {
              var { data: coMembers } = await sb.from('bubble_members')
                .select('user_id, profiles:user_id(id,name,title,keywords,avatar_url)')
                .in('bubble_id', bubbleIds).neq('user_id', userId).limit(8);
              // Deduplicate
              var seen = {};
              contacts = (coMembers || []).filter(function(m) {
                if (!m.profiles || seen[m.user_id]) return false;
                seen[m.user_id] = true;
                return true;
              }).slice(0, 5).map(function(m) { return { profiles: m.profiles }; });
            }
          }
          
          var colors = [
            'linear-gradient(135deg,#2ECFCF,#22B8CF)','linear-gradient(135deg,#8B5CF6,#A855F7)',
            'linear-gradient(135deg,#E879A8,#EC4899)','linear-gradient(135deg,#1A9E8E,#10B981)',
            'linear-gradient(135deg,#6366F1,#7C5CFC)'
          ];
          if (contacts && contacts.length > 0) {
            listEl.innerHTML = contacts.map(function(c, i) {
              var p = c.profiles || {};
              var ini = (p.name || '?').split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();
              var avHtml = p.avatar_url
                ? '<img src="' + escHtml(p.avatar_url) + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%">'
                : ini;
              var tags = (p.keywords || []).slice(0, 2).map(function(t) {
                return '<span style="font-size:0.55rem;padding:0.1rem 0.35rem;border-radius:6px;background:rgba(124,92,252,0.07);color:#534AB7">' + escHtml(t) + '</span>';
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
      // Bubble join without profile - show teaser
      goTo('screen-qr-teaser');
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

// ══════════════════════════════════════════════════════════
//  SOCIAL PROOF SCREEN (opsøgende flow)
// ══════════════════════════════════════════════════════════
async function loadSocialProofScreen() {
  try {
    if (!sb) initSupabase();
    var { count } = await sb.from('profiles')
      .select('*', { count: 'exact', head: true })
      .neq('banned', true);
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
    if (!currentUser) return;
    var contactId = flowGet('pending_contact');
    if (!contactId || contactId === currentUser.id) {
      flowRemove('pending_contact');
      return;
    }
    // Auto-save the contact
    var { error } = await sb.from('saved_contacts').upsert({
      user_id: currentUser.id,
      contact_id: contactId
    });
    flowRemove('pending_contact');
    if (!error) {
      showToast('Kontakt gemt fra QR-scan! ✓');
      trackEvent('qr_contact_saved', { contact_id: contactId });
    }
  } catch(e) {
    logError('checkPendingContact', e);
    flowRemove('pending_contact');
  }
}

// ══════════════════════════════════════════════════════════
//  EVENT LANDING FLOW — teaser → signup → onboarding → QR
// ══════════════════════════════════════════════════════════
var _eventBubble = null;

async function checkGuestEventRoute() {
  try {
    var params = new URLSearchParams(window.location.search);
    var eventId = params.get('event');
    if (!eventId) return false;
    
    // Already logged in → join + handle check-in
    var { data: { session } } = await sb.auth.getSession();
    if (session) {
      flowSet('pending_join', eventId);
      flowSet('event_flow', 'true');
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
    
    if (!bubble) { showToast('Event ikke fundet'); return false; }
    
    _eventBubble = bubble;
    flowSet('pending_join', bubble.id);
    flowSet('event_flow', 'true');
    
    // Populate teaser screen
    var nameEl = document.getElementById('guest-event-name');
    var metaEl = document.getElementById('guest-event-meta');
    if (nameEl) nameEl.textContent = bubble.name;
    if (metaEl) metaEl.textContent = (bubble.location ? bubble.location + ' · ' : '') + (bubble.type === 'event' || bubble.type === 'live' ? 'Live Event' : 'Netværk');
    
    // Load social proof: attendee count + blurred profiles
    loadEventSocialProof(bubble.id);
    
    goTo('screen-guest-checkin');
    window.history.replaceState({}, document.title, window.location.pathname);
    return true;
  } catch(e) {
    logError('checkGuestEventRoute', e);
    return false;
  }
}

async function loadEventSocialProof(bubbleId) {
  try {
    var { count } = await sb.from('bubble_members')
      .select('*', { count: 'exact', head: true })
      .eq('bubble_id', bubbleId);
    
    var countEl = document.getElementById('event-attendee-count');
    if (countEl && count > 0) {
      countEl.textContent = count + ' deltager' + (count !== 1 ? 'e' : '') + ' er allerede her';
    } else if (countEl) {
      countEl.textContent = 'Vær den første!';
    }
    
    // Load blurred profile cards (max 4)
    if (count > 0) {
      var { data: members } = await sb.from('bubble_members')
        .select('profiles(name, title, workplace, keywords)')
        .eq('bubble_id', bubbleId)
        .limit(4);
      
      var container = document.getElementById('event-blurred-profiles');
      if (container && members) {
        var avColors = ['linear-gradient(135deg,#2ECFCF,#22B8CF)','linear-gradient(135deg,#6366F1,#7C5CFC)','linear-gradient(135deg,#E879A8,#EC4899)','linear-gradient(135deg,#F59E0B,#EAB308)'];
        container.innerHTML = members.map(function(m, i) {
          var p = m.profiles || {};
          var ini = (p.name||'?').split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();
          var tags = (p.keywords || []).slice(0,2).map(function(k) { return '<span style="font-size:0.58rem;padding:0.1rem 0.4rem;background:rgba(124,92,252,0.06);color:var(--accent);border-radius:99px">' + escHtml(k) + '</span>'; }).join('');
          return '<div style="background:#FFFFFF;border:1px solid var(--glass-border-subtle);border-radius:var(--radius);padding:0.7rem 0.9rem;display:flex;align-items:center;gap:0.6rem;box-shadow:0 1px 3px rgba(30,27,46,0.06)">' +
            '<div style="width:36px;height:36px;border-radius:50%;background:' + avColors[i] + ';display:flex;align-items:center;justify-content:center;font-size:0.6rem;font-weight:700;color:white;flex-shrink:0">' + ini + '</div>' +
            '<div style="flex:1;min-width:0"><div style="font-size:0.8rem;font-weight:600;color:var(--text)">' + escHtml(p.name || 'Deltager') + '</div>' +
            '<div style="font-size:0.68rem;color:var(--text-secondary)">' + escHtml(p.title || '') + (p.workplace ? ' · ' + escHtml(p.workplace) : '') + '</div>' +
            (tags ? '<div style="display:flex;gap:0.2rem;margin-top:0.2rem">' + tags + '</div>' : '') +
            '</div></div>';
        }).join('') +
        (count > 4 ? '<div style="text-align:center;font-size:0.72rem;color:var(--accent);font-weight:600;padding:0.4rem 0">+ ' + (count - 4) + ' flere deltagere</div>' : '');
      }
    }
  } catch(e) { logError('loadEventSocialProof', e); }
}

// ── Event signup actions ──
function eventSignupGoogle() {
  flowSet('event_flow', 'true');
  goTo('screen-auth');
  showAuthForms();
  setTimeout(function() { handleGoogleLogin(); }, 200);
}

function eventSignupLinkedIn() {
  flowSet('event_flow', 'true');
  goTo('screen-auth');
  showAuthForms();
  setTimeout(function() { handleLinkedInLogin(); }, 200);
}

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
    if (metaEl && _eventBubble) metaEl.textContent = 'Vis din QR-kode til arrangøren ved ' + _eventBubble.name;
    
    // Generate rotating QR token (10 min)
    var token = crypto.randomUUID ? crypto.randomUUID().split('-')[0] : Math.random().toString(36).slice(2,10);
    var expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    try {
      await sb.from('qr_tokens').insert({ token: token, user_id: currentUser.id, expires_at: expiresAt });
    } catch(e) { token = null; }
    
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
  var bubbleId = flowGet('pending_join');
  flowRemove('pending_join');
  flowRemove('post_tags_destination');
  if (bubbleId) {
    goTo('screen-home');
    loadHome();
    setTimeout(function() { openBubble(bubbleId, 'screen-home'); }, 500);
  } else {
    goTo('screen-home');
    loadHome();
  }
}

// ══════════════════════════════════════════════════════════
//  MANUAL CHECK-IN — organizer adds guest by name
// ══════════════════════════════════════════════════════════
async function manualCheckinGuest() {
  var nameInput = document.getElementById('manual-checkin-name');
  var name = (nameInput?.value || '').trim();
  if (!name) { showToast('Indtast deltagerens navn'); return; }
  
  // Find the current live bubble
  var bubbleId = _liveQrResolvedBubble?.id || _currentLiveBubbleId;
  if (!bubbleId && window.bcBubbleData) bubbleId = bcBubbleData.id;
  
  // Try from live status
  if (!bubbleId) {
    try {
      var expCut = new Date(Date.now() - 6 * 3600000).toISOString();
      var { data: myLive } = await sb.from('bubble_members')
        .select('bubble_id')
        .eq('user_id', currentUser.id)
        .not('checked_in_at', 'is', null)
        .is('checked_out_at', null)
        .gte('checked_in_at', expCut)
        .limit(1)
        .maybeSingle();
      if (myLive) bubbleId = myLive.bubble_id;
    } catch(e) {}
  }
  
  if (!bubbleId) { showToast('Check ind i en boble først'); return; }
  
  try {
    var guestId = crypto.randomUUID ? crypto.randomUUID() : 'g-' + Date.now() + '-' + Math.random().toString(36).slice(2,8);
    var { error } = await sb.from('guest_checkins').insert({
      id: guestId,
      bubble_id: bubbleId,
      name: name,
      checked_in_at: new Date().toISOString()
    });
    if (error) { showToast('Fejl: ' + error.message); return; }
    
    if (nameInput) nameInput.value = '';
    showSuccessToast(name + ' tilføjet! ✓');
    trackEvent('manual_checkin', { bubble_id: bubbleId, guest_name: name });
    
    // Refresh checkin list
    if (typeof loadLiveCheckinList === 'function') loadLiveCheckinList();
  } catch(e) {
    logError('manualCheckinGuest', e);
    showToast('Fejl: ' + (e.message || 'ukendt'));
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

    // Push-notifikation klik → naviger
    if (msg.type === 'PUSH_NAVIGATE') {
      var d = msg.data || {};
      var t = d.type || '';
      if ((t === 'new_message' || t === 'message') && d.sender_id) {
        if (currentUser) openChat(d.sender_id, 'screen-messages');
      } else if (t === 'new_invite' || t === 'invitation' || t === 'saved_contact') {
        goTo('screen-notifications');
        loadNotifications();
      } else if (t === 'checkin' && d.bubble_id) {
        if (currentUser) openBubbleChat(d.bubble_id, 'screen-home');
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
    + 'background:rgba(255,255,255,0.96);'
    + 'backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);'
    + 'border-bottom:1px solid rgba(124,92,252,0.25);'
    + 'box-shadow:0 4px 24px rgba(30,27,46,0.12);';
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
  // Check QR anon preview BEFORE auth (shows profile without login)
  if (initSupabase()) {
    var isGuest = await checkGuestEventRoute();
    if (isGuest) {
      initAllSwipeClose();
      return;
    }
    var isAnon = await checkQRAnonPreview();
    if (isAnon) {
      initAllSwipeClose();
      return;
    }
  }
  await checkAuth();
  await checkQRJoin();
  if (currentUser) {
    // Realtime, badges, preload, pending actions already initialized by resolvePostAuth
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


