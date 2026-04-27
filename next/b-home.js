// ══════════════════════════════════════════════════════════
//  BUBBLE — HOME SCREEN + DASHBOARD + CUSTOMIZATION
//  DOMAIN: home
//  OWNS: _homeDartboardProfiles, _homeRadarFilter
//  OWNS: loadHome, loadLiveBanner, homeSetMode, loadEventDartboard, renderHomeDartboard, filterRadarHome
//  READS: currentUser, currentProfile, currentLiveBubble, proxAllProfiles
//  Auto-split from app.js · v3.7.0
// ══════════════════════════════════════════════════════════

// ── Layout-shift-free show/hide for iOS Safari ──
// Uses max-height transition instead of display:none to avoid scroll jumps

// ── Bubble chat unread state ──
var _bubbleUnreadSet = {};
var _allMyBubblesCache = [];
var _myBubbleMemberIds = []; // Global liste af mine boble-IDs — bruges af b-realtime til unread nav-dot
function _renderBubblesUnreadDot() {
  var dot = document.getElementById('bubbles-unread-dot');
  if (dot) dot.style.display = Object.keys(_bubbleUnreadSet).length > 0 ? 'block' : 'none';
}
function _renderSubTabDots(allBubbles) {
  var list = allBubbles || _allMyBubblesCache;
  var hasNet = false, hasEvt = false;
  (list || []).forEach(function(b) {
    if (!_bubbleUnreadSet[b.id]) return;
    if (b.type === 'event' || b.type === 'live') hasEvt = true;
    else hasNet = true;
  });
  var netDot = document.getElementById('bb-sub-net-dot');
  var evtDot = document.getElementById('bb-sub-evt-dot');
  if (netDot) netDot.style.display = hasNet ? 'block' : 'none';
  if (evtDot) evtDot.style.display = hasEvt ? 'block' : 'none';
}
async function _fetchBubbleUnread(membershipRows) {
  try {
    if (!currentUser || !membershipRows || membershipRows.length === 0) { _bubbleUnreadSet = {}; _renderBubblesUnreadDot(); return; }
    var ids = membershipRows.map(function(m) { return m.bubble_id; });
    var lastReadMap = {};
    membershipRows.forEach(function(m) { lastReadMap[m.bubble_id] = m.last_read_at || null; });
    var { data: latestMsgs } = await sb.rpc('get_latest_bubble_msg_times', { p_bubble_ids: ids });
    var unread = {};
    (latestMsgs || []).forEach(function(row) {
      var lr = lastReadMap[row.bubble_id];
      if (!lr || new Date(row.latest_msg_at) > new Date(lr)) {
        unread[row.bubble_id] = true;
      }
    });
    _bubbleUnreadSet = unread;
    _renderBubblesUnreadDot();
    _renderSubTabDots();
  } catch(e) { logError('_fetchBubbleUnread', e); }
}
var _bcUnreadDotHtml = '<div style="width:9px;height:9px;border-radius:50%;background:var(--accent2);flex-shrink:0"></div>';
function _unreadDot(id) { return _bubbleUnreadSet[id] ? _bcUnreadDotHtml : ''; }

function hsSlotShow(id) {
  var slot = document.getElementById(id + '-slot');
  if (slot) { slot.classList.remove('hs-hidden'); slot.classList.add('hs-visible'); }
}
function hsSlotHide(id) {
  var slot = document.getElementById(id + '-slot');
  if (slot) { slot.classList.add('hs-hidden'); slot.classList.remove('hs-visible'); }
}


// ══════════════════════════════════════════════════════════
//  HOME
// ══════════════════════════════════════════════════════════

// ── Live context: set when user is checked into an event ──
var _homeViewMode = 'all'; // UI tab toggle: 'all' or 'live'

var _homeLoading = false;
var _homeBooting = false; // true under initial loadHome — forhindrer homeSetMode i at rendere
async function loadHome() {
  if (_homeLoading) return;
  _homeLoading = true;
  _homeBooting = true;
  _dartboardDataLoaded = false;
  // Ryd gamle dots med det samme — ellers ses stale dots under screenFadeIn (0.2s)
  // og kombinationen med ny drip-animation ser ud som dobbelt drip
  var _avEl = document.getElementById('home-prox-avatars');
  if (_avEl) _avEl.innerHTML = '';
  try {
    if (!currentUser) { _homeLoading = false; _homeBooting = false; return; }
    if (!currentProfile) await loadCurrentProfile();
    updateHomeAvatar();

    // Greeting — write directly to home-greeting-name (do NOT touch previousElementSibling)
    const nameEl = document.getElementById('home-greeting-name');
    if (nameEl && currentProfile?.name) {
      var hour = new Date().getHours();
      var greetText = hour < 5 ? t('home_greeting_evening') : hour < 12 ? t('home_greeting_morning') : hour < 17 ? t('home_greeting_afternoon') : hour < 22 ? t('home_greeting_evening') : t('home_greeting_evening');
      nameEl.textContent = greetText + ', ' + currentProfile.name.split(' ')[0];
    }

    // Load all data in parallel — v5.2
    await Promise.all([
      loadLiveBanner(),
      loadHomeDartboardData(),
      loadSavedContacts(),
      updateTopbarNotifBadge()
    ].map(function(p) { return p.catch(function(e) { logError('loadHome:parallel', e); }); }));

    // Post-load: apply visibility toggles, show nudge
    hsApplyToHome();
    showEventCheckinCard();
    showWelcomeCard();
    showProfileSetupCTA();

    // v7.53: Fade in all data cards together once everything is ready.
    // Cards stay invisible (opacity:0) while data loads — no pop-in,
    // no skeleton, no layout-shift. Radar/dartboard fades in independently.
    var cardsWrap = document.getElementById('home-cards-wrap');
    if (cardsWrap) {
      // requestAnimationFrame ensures the fade-in happens after the
      // browser has applied the show* DOM updates above
      requestAnimationFrame(function() {
        cardsWrap.style.opacity = '1';
      });
    }
  } catch(e) {
    logError("loadHome", e);
  } finally {
    _homeLoading = false;
    _homeBooting = false;
  }
}

// ══════════════════════════════════════════════════════════
//  LIVE BANNER + MODE TABS (Alle / Live)
// ══════════════════════════════════════════════════════════
async function loadLiveBanner() {
  var tabs = document.getElementById('home-mode-tabs');
  var banner = document.getElementById('home-live-banner');
  if (!currentUser) return;
  try {
    var expCut = new Date(Date.now() - 6 * 3600000).toISOString();
    var { data: myLive } = await sb.from('bubble_members')
      .select('bubble_id, checked_in_at, bubbles(id, name, type)')
      .eq('user_id', currentUser.id)
      .not('checked_in_at', 'is', null)
      .is('checked_out_at', null)
      .gte('checked_in_at', expCut)
      .limit(1)
      .maybeSingle();

    if (myLive && myLive.bubbles) {
      var { count: liveCount } = await sb.from('bubble_members')
        .select('*', { count: 'exact', head: true })
        .eq('bubble_id', myLive.bubble_id)
        .not('checked_in_at', 'is', null)
        .is('checked_out_at', null)
        .gte('checked_in_at', expCut);

      var checkinTime = new Date(myLive.checked_in_at).getTime();
      var expiryTime = new Date(checkinTime + 6 * 3600000);
      var expiryStr = expiryTime.getHours().toString().padStart(2,'0') + ':' + expiryTime.getMinutes().toString().padStart(2,'0');

      appMode.set('live', {
        bubbleId: myLive.bubble_id,
        bubbleName: myLive.bubbles.name,
        bubbleType: myLive.bubbles.type,
        memberCount: liveCount || 0,
        expiryStr: expiryStr
      });

      if (tabs) tabs.style.display = 'block';
      homeSetMode('live');
    } else {
      appMode.set('normal');
      if (tabs) tabs.style.display = 'none';
      hsSlotHide('home-live-banner');
      homeSetMode('all');
    }
  } catch(e) {
    logError('loadLiveBanner', e);
    appMode.set('normal');
    if (tabs) tabs.style.display = 'none';
    hsSlotHide('home-live-banner');
  }
}

function homeSetMode(mode) {
  _homeViewMode = mode; // 'all' or 'live' — UI tab state
  // Sync appMode (mode='live'→appMode live, mode='all'→appMode normal)
  if (mode === 'live' && !appMode.is('live')) appMode.set('live', appMode.live);
  else if (mode !== 'live' && appMode.is('live')) {} // keep live context, just switch tab view

  var tabAll = document.getElementById('home-tab-all');
  var tabLive = document.getElementById('home-tab-live');
  var banner = document.getElementById('home-live-banner');
  var ctx = appMode.live;

  if (mode === 'live' && ctx) {
    if (tabAll) { tabAll.style.background = 'transparent'; tabAll.style.color = 'var(--muted)'; tabAll.style.fontWeight = '600'; }
    if (tabLive) { tabLive.style.background = 'linear-gradient(135deg,#1A9E8E,#10B981)'; tabLive.style.color = 'white'; tabLive.style.fontWeight = '700'; }
    loadEventDartboard();
  } else {
    if (tabAll) { tabAll.style.background = 'var(--gradient-primary)'; tabAll.style.color = 'white'; tabAll.style.fontWeight = '700'; }
    if (tabLive) { tabLive.style.background = 'transparent'; tabLive.style.color = 'var(--muted)'; tabLive.style.fontWeight = '600'; }
    _homeRadarFilter = 'all';
    if (!_homeBooting) renderHomeDartboard();
  }

  // Live banner stays visible in BOTH modes as long as checked in
  if (banner && ctx) {
    hsSlotShow('home-live-banner');
    var nameEl = document.getElementById('home-live-banner-name');
    var countEl = document.getElementById('home-live-banner-count');
    if (nameEl) nameEl.textContent = ctx.bubbleName;
    if (countEl) countEl.textContent = ctx.memberCount + ' ' + t('live_here_now');
  } else if (banner) {
    hsSlotHide('home-live-banner');
  }

  // Update checkout tray info
  if (ctx) {
    var coName = document.getElementById('live-checkout-name');
    var coMeta = document.getElementById('live-checkout-meta');
    if (coName) coName.textContent = ctx.bubbleName;
    if (coMeta) coMeta.textContent = t('bc_checked_in') + ' · ' + t('live_expires') + ' ' + (ctx.expiryStr || '—');
  }
  updateFilterChipStyle();
}

function updateFilterChipStyle() {
  var chips = document.getElementById('home-filter-chips');
  if (!chips) return;
  var isLive = appMode.is('live') && appMode.live;
  var firstChip = chips.querySelector('[data-filter="all"]');
  if (firstChip) {
    var countSpan = firstChip.querySelector('#radar-count-home') || firstChip.querySelector('span');
    if (isLive) {
      firstChip.childNodes[0].textContent = 'Alle deltagere ';
      if (countSpan) countSpan.textContent = '· ' + (appMode.live.memberCount || 0);
    } else {
      firstChip.childNodes[0].textContent = 'Alle ';
    }
  }
  chips.querySelectorAll('.radar-filter-chip').forEach(function(c) {
    c.style.background = '';
    c.style.borderColor = '';
  });
  chips.querySelectorAll('.radar-filter-chip.active').forEach(function(c) {
    if (isLive) {
      c.style.background = 'linear-gradient(135deg,#1A9E8E,#10B981)';
    } else {
      c.style.background = 'linear-gradient(135deg,#7C5CFC,#6366F1)';
    }
    c.style.borderColor = 'transparent';
  });
}

// ── Event-aware dartboard: load only event members ──
async function loadEventDartboard() {
  if (!appMode.live) return;
  try {
    var expCut = new Date(Date.now() - 6 * 3600000).toISOString();
    var { data: members } = await sb.from('bubble_members')
      .select('user_id')
      .eq('bubble_id', appMode.live.bubbleId)
      .not('checked_in_at', 'is', null)
      .is('checked_out_at', null)
      .gte('checked_in_at', expCut);
    var memberIds = (members || []).map(function(m) { return m.user_id; }).filter(function(id) { return id !== currentUser.id; });
    if (memberIds.length === 0) {
      _homeDartboardProfiles = []; // Clear — show empty radar in live mode
      renderHomeDartboard();
      return;
    }

    var { data: profiles } = await sb.from('profiles')
      .select('id,name,title,keywords,dynamic_keywords,bio,linkedin,is_anon,avatar_url')
      .in('id', memberIds);

    _homeDartboardProfiles = (profiles || []).map(function(p) {
      var matchScore = (typeof calcMatchScore === 'function') ? calcMatchScore(currentProfile, p, 1) : 0;
      return { id:p.id, name:p.name, title:p.title, keywords:p.keywords, is_anon:p.is_anon, bio:p.bio, linkedin:p.linkedin, avatar_url:p.avatar_url, matchScore:matchScore, sharedBubbles:1 };
    }).sort(function(a,b) { return b.matchScore - a.matchScore; });

    renderHomeDartboard();
  } catch(e) { logError('loadEventDartboard', e); }
}

// ══════════════════════════════════════════════════════════
//  LIVE CHECKOUT TRAY
// ══════════════════════════════════════════════════════════
function openLiveCheckoutTray() {
  var backdrop = document.getElementById('live-checkout-backdrop');
  var tray = document.getElementById('live-checkout-tray');
  if (!backdrop || !tray) return;
  backdrop.style.display = 'block';
  tray.style.visibility = 'visible';
  void tray.offsetHeight;
  tray.style.transform = 'translateY(0)';
}
function closeLiveCheckoutTray() {
  var backdrop = document.getElementById('live-checkout-backdrop');
  var tray = document.getElementById('live-checkout-tray');
  if (backdrop) backdrop.style.display = 'none';
  if (tray) { tray.style.transform = 'translateY(100%)'; setTimeout(function() { tray.style.visibility = 'hidden'; }, 350); }
}

// ══════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════
//  PROFILE SETUP CTA + BOTTOM SHEETS (v5.5)
// ══════════════════════════════════════════════════════════
var SETUP_THRESHOLD = 59; // CTA disappears at this %
var _setupSelectedInterests = [];
var _setupSelectedLifestage = null;

var SETUP_INTERESTS = [
  { id: 'startup',        label: 'Startup & Iværksætteri',    color: '#E879A8', bg: 'rgba(232,121,168,', icon: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4.5 16.5c-1.5 1.5-2 5-2 5s3.5-.5 5-2c.8-.8 1-2 .4-2.8a2.1 2.1 0 00-3.4-.2z"/><path d="M14.5 2.5c-3 2-5 5.5-5.5 9l3.5 3.5c3.5-.5 7-2.5 9-5.5z"/></svg>' },
  { id: 'tech',           label: 'Teknologi & Digitalisering', color: '#7C5CFC', bg: 'rgba(124,92,252,',  icon: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>' },
  { id: 'sustainability', label: 'Bæredygtighed & Energi',     color: '#1A9E8E', bg: 'rgba(26,158,142,',  icon: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 3v19M5 8l7-5 7 5M5 16l7 5 7-5"/></svg>' },
  { id: 'leadership',     label: 'Ledelse & Strategi',         color: '#F59E0B', bg: 'rgba(245,158,11,',  icon: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>' },
  { id: 'public',         label: 'Offentlig & NGO',            color: '#1A9E8E', bg: 'rgba(26,158,142,',  icon: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M10 21v-3h4v3"/></svg>' },
  { id: 'industry',       label: 'Industri & Håndværk',        color: '#F59E0B', bg: 'rgba(245,158,11,',  icon: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>' },
  { id: 'health',         label: 'Sundhed & Omsorg',           color: '#E879A8', bg: 'rgba(232,121,168,', icon: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z"/></svg>' },
  { id: 'education',      label: 'Uddannelse & Forskning',     color: '#3B82F6', bg: 'rgba(59,130,246,',  icon: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 10l-10-5L2 10l10 5z"/><path d="M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5"/></svg>' },
  { id: 'creative',       label: 'Kreativ & Medie',            color: '#2ECFCF', bg: 'rgba(46,207,207,',  icon: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M14.31 8l5.74 9.94M9.69 8h11.48M7.38 12l5.74-9.94M9.69 16L3.95 6.06M14.31 16H2.83M16.62 12l-5.74 9.94"/></svg>' },
  { id: 'commerce',       label: 'Handel & Service',           color: '#888780', bg: 'rgba(136,135,128,', icon: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><path d="M3 6h18M16 10a4 4 0 01-8 0"/></svg>' },
  { id: 'community',      label: 'Fællesskab & Fritid',        color: '#2ECFCF', bg: 'rgba(46,207,207,',  icon: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>' }
];

function calcProfileStrength(profile) {
  if (!profile) return 0;
  var s = 0;
  // Identity (10) — onboarding gives these for free
  if (profile.name) s += 5;
  if (profile.workplace) s += 5;
  // Context (18) — setup flow fields
  if (profile.title) s += 10;
  if (profile.lifestage) s += 8;
  // Tags (37) — drives TF-IDF match quality
  var tagCount = (profile.keywords && profile.keywords.length) || 0;
  if (tagCount >= 3) s += 10;
  if (tagCount >= 6) s += 15;
  if (tagCount >= 10) s += 12;
  // Presentation (35) — trust & context
  if (profile.bio) s += 15;
  if (profile.avatar_url) s += 10;
  if (profile.linkedin) s += 10;
  return Math.min(s, 100);
}

// ── Event checkin card — shown after QR scan auto-checkin ──
// ── Shared check-in confirmation modal — used from home (QR) and inside event (auto/manual) ──
// opts.fromHome: show "Gå til event" + "Bliv på forsiden"
// opts.inEvent: show single "Forstået" (already inside the event)
function showCheckinModal(eventName, opts) {
  opts = opts || {};
  var eventId = opts.eventId || null;

  // Remove any existing overlay
  var existing = document.getElementById('checkin-confirm-overlay');
  if (existing) existing.remove();

  var ov = document.createElement('div');
  ov.id = 'checkin-confirm-overlay';
  ov.style.cssText = 'position:fixed;inset:0;z-index:600;background:rgba(30,27,46,0.45);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:1.5rem;animation:fadeSlideUp 0.3s ease';

  var buttonsHtml = '';
  if (opts.fromHome && eventId) {
    buttonsHtml =
      '<button id="checkin-goto-btn" style="width:100%;padding:0.8rem;border-radius:12px;border:none;background:linear-gradient(135deg,#1A9E8E,#17877A);color:white;font-size:0.92rem;font-weight:700;font-family:inherit;cursor:pointer;margin-bottom:0.5rem;display:flex;align-items:center;justify-content:center;gap:0.4rem">' + t('ob_goto_event') + '</button>' +
      '<button id="checkin-stay-btn" style="width:100%;padding:0.7rem;border-radius:12px;border:1px solid rgba(124,92,252,0.12);background:none;color:var(--muted);font-size:0.8rem;font-weight:600;font-family:inherit;cursor:pointer">' + t('modal_stay_home') + '</button>';
  } else {
    buttonsHtml =
      '<button id="checkin-ok-btn" style="width:100%;padding:0.8rem;border-radius:12px;border:none;background:linear-gradient(135deg,#1A9E8E,#17877A);color:white;font-size:0.92rem;font-weight:700;font-family:inherit;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:0.4rem">' + t('modal_understood') + '</button>';
  }

  ov.innerHTML =
    '<div style="background:#FFFFFF;border-radius:20px;padding:2rem 1.5rem 1.5rem;width:100%;max-width:320px;text-align:center;box-shadow:0 16px 48px rgba(0,0,0,0.15)">' +
      '<div style="width:56px;height:56px;border-radius:50%;background:rgba(26,158,142,0.1);display:flex;align-items:center;justify-content:center;margin:0 auto 1rem">' +
        '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1A9E8E" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>' +
      '</div>' +
      '<div style="font-size:1.15rem;font-weight:800;color:var(--text);margin-bottom:0.3rem">' + t('toast_checkedin') + '</div>' +
      '<div style="font-size:0.85rem;color:var(--text-secondary);line-height:1.5;margin-bottom:0.25rem">' + escHtml(eventName || '') + '</div>' +
      '<div style="display:flex;align-items:center;justify-content:center;gap:0.4rem;margin-bottom:1.25rem">' +
        '<span class="live-dot"></span>' +
        '<span style="font-size:0.8rem;font-weight:600;color:var(--accent3)">' + t('modal_you_are_live') + '</span>' +
      '</div>' +
      buttonsHtml +
    '</div>';

  document.body.appendChild(ov);

  // Wire buttons
  var gotoBtn = document.getElementById('checkin-goto-btn');
  var stayBtn = document.getElementById('checkin-stay-btn');
  var okBtn = document.getElementById('checkin-ok-btn');

  if (gotoBtn) {
    gotoBtn.onclick = function() {
      ov.remove();
      if (eventId) {
        openBubbleChat(eventId, 'screen-home');
        setTimeout(function() { if (typeof bcSwitchTab === 'function') bcSwitchTab('info'); }, 300);
      }
    };
  }
  if (stayBtn) {
    stayBtn.onclick = function() {
      ov.style.transition = 'opacity 0.25s';
      ov.style.opacity = '0';
      setTimeout(function() { ov.remove(); }, 260);
    };
  }
  if (okBtn) {
    okBtn.onclick = function() {
      ov.style.transition = 'opacity 0.25s';
      ov.style.opacity = '0';
      setTimeout(function() { ov.remove(); }, 260);
    };
  }
}

// ── Home screen wrapper: reads from sessionStorage (QR flow) ──
function showEventCheckinCard() {
  var eventName, eventId;
  try {
    eventName = sessionStorage.getItem('event_greeting');
    eventId = sessionStorage.getItem('event_greeting_id');
  } catch(e) { return; }
  if (!eventName || !eventId) return;

  // Consume immediately — only show once
  try {
    sessionStorage.removeItem('event_greeting');
    sessionStorage.removeItem('event_greeting_id');
  } catch(e) {}

  showCheckinModal(eventName, { fromHome: true, eventId: eventId });
}

// ══════════════════════════════════════════════════════════
//  DEEP-LINK MODAL — unified confirmation for all QR/invite flows
//  Types: 'contact' (profile QR), 'event' (event QR), 'network' (invite link)
// ══════════════════════════════════════════════════════════
// ── Format event timing for modal subtitle ──
// Returns { html, isLive, isEnded } based on event_date / event_end_date
function _formatEventTiming(eventDate, endDate) {
  var now = Date.now();
  var startMs = eventDate ? new Date(eventDate).getTime() : null;
  var endMs = endDate ? new Date(endDate).getTime() : null;
  var loc = (typeof _locale === 'function') ? _locale() : 'da-DK';

  // Helper: format HH:MM
  function _hm(d) {
    return d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' });
  }

  // Live now: between start and end (or after start with no end)
  if (startMs && startMs <= now && (!endMs || endMs > now)) {
    if (endMs) {
      return {
        html: '<span class="bb-dl-live-dot"></span>' + escHtml(t('dl_live_now_until', { time: _hm(new Date(endMs)) })),
        isLive: true, isEnded: false, isUpcoming: false
      };
    }
    return {
      html: '<span class="bb-dl-live-dot"></span>' + escHtml(t('dl_live_now')),
      isLive: true, isEnded: false, isUpcoming: false
    };
  }

  // Ended: end date in the past (or start in past with no end)
  if ((endMs && endMs <= now) || (!endMs && startMs && startMs <= now)) {
    return {
      html: escHtml(t('dl_event_ended')),
      isLive: false, isEnded: true, isUpcoming: false
    };
  }

  // Upcoming: start in future
  if (startMs && startMs > now) {
    var startDate = new Date(startMs);
    var diffMs = startMs - now;
    var diffMin = Math.round(diffMs / 60000);
    var diffDays = Math.floor(diffMs / (24 * 3600000));
    var sameDay = startDate.toDateString() === new Date().toDateString();

    // < 60 min: countdown
    if (diffMin < 60) {
      return {
        html: escHtml(t('dl_starts_in_min', { n: diffMin, s: diffMin === 1 ? '' : 'ter' })),
        isLive: false, isEnded: false, isUpcoming: true
      };
    }
    // Today: time only
    if (sameDay) {
      return {
        html: escHtml(t('dl_starts_today', { time: _hm(startDate) })),
        isLive: false, isEnded: false, isUpcoming: true
      };
    }
    // 1-7 days: weekday + time + days
    if (diffDays >= 1 && diffDays <= 7) {
      var weekday = startDate.toLocaleDateString(loc, { weekday: 'long' });
      return {
        html: escHtml(t('dl_starts_weekday', { weekday: weekday, time: _hm(startDate), n: diffDays, s: diffDays === 1 ? '' : 'e' })),
        isLive: false, isEnded: false, isUpcoming: true
      };
    }
    // > 7 days: full date
    var dateStr = startDate.toLocaleDateString(loc, { day: 'numeric', month: 'long' });
    return {
      html: escHtml(t('dl_starts_date', { date: dateStr, time: _hm(startDate) })),
      isLive: false, isEnded: false, isUpcoming: true
    };
  }

  // No date: treat as upcoming with no info (shouldn't happen for events)
  return { html: '', isLive: false, isEnded: false, isUpcoming: true };
}

// ── Inject one-time CSS for live-pulse dot used in event modal ──
function _ensureDlStyles() {
  if (document.getElementById('bb-dl-styles')) return;
  var style = document.createElement('style');
  style.id = 'bb-dl-styles';
  style.textContent =
    '.bb-dl-live-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:#1A9E8E;margin-right:6px;vertical-align:middle;animation:bbDlPulse 1.5s ease-in-out infinite}' +
    '@keyframes bbDlPulse{0%,100%{opacity:1}50%{opacity:0.5}}';
  document.head.appendChild(style);
}

async function showDeepLinkModal(type, targetId) {
  try {
    _ensureDlStyles();
    var existing = document.getElementById('deeplink-modal-overlay');
    if (existing) existing.remove();

    // ── CONTACT flow (unchanged from previous version) ──
    if (type === 'contact') {
      var { data: p } = await sb.from('profiles').select('id, name, title, workplace, avatar_url').eq('id', targetId).maybeSingle();
      if (!p) { showWarningToast(t('toast_not_found')); return; }
      var nameText = p.name || '?';
      var ini = nameText.split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();
      var iconHtml = p.avatar_url
        ? '<img src="' + escHtml(p.avatar_url) + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%">'
        : '<span style="font-size:1.1rem;font-weight:700;color:white">' + escHtml(ini) + '</span>';
      var title = escHtml(nameText);
      var subtitle = [p.title, p.workplace].filter(Boolean).join(' · ');
      _renderSimpleDeepLinkModal({
        iconBg: 'linear-gradient(135deg,#7C5CFC,#6366F1)', iconSize: '64px', iconRadius: '50%',
        iconHtml: iconHtml, title: title, subtitle: subtitle,
        primaryLabel: t('dl_save_contact') + ' →',
        primaryFn: async function() {
          var result = await dbActions.saveContact(targetId);
          if (result.ok) showSuccessToast(t('toast_saved'));
          openPerson(targetId, 'screen-home');
        }
      });
      return;
    }

    // ── BUBBLE flow: fetch bubble + check membership ──
    var { data: b } = await sb.from('bubbles')
      .select('id, name, type, location, icon_url, visibility, event_date, event_end_date, created_by')
      .eq('id', targetId)
      .maybeSingle();
    if (!b) { showWarningToast(t('toast_not_found')); return; }

    var isEvent = b.type === 'event' || b.type === 'live';

    // ── If NOT an event → use simple "Go to network" flow (unchanged behavior) ──
    if (!isEvent) {
      var bEmoji = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#534AB7" stroke-width="1.5"><circle cx="9.5" cy="9.5" r="6" opacity="0.85"/><circle cx="16" cy="13.5" r="4.5" opacity="0.6"/></svg>';
      var iconHtmlN = b.icon_url
        ? '<img src="' + escHtml(b.icon_url) + '" style="width:100%;height:100%;object-fit:cover;border-radius:14px">'
        : bEmoji;
      _renderSimpleDeepLinkModal({
        iconBg: 'rgba(124,92,252,0.15)', iconSize: '56px', iconRadius: '14px',
        iconHtml: iconHtmlN, title: escHtml(b.name || '?'),
        subtitle: b.location ? escHtml(b.location) : '',
        primaryLabel: t('dl_go_to_network') + ' →',
        primaryFn: async function() {
          var result = await dbActions.joinBubble(targetId, 'invite_link');
          if (result.ok) showSuccessToast(t('toast_joined'));
          openBubbleChat(targetId, 'screen-home');
        }
      });
      return;
    }

    // ── EVENT flow: check membership + timing ──
    var isMember = false;
    if (currentUser) {
      var { data: memberRow } = await sb.from('bubble_members')
        .select('user_id')
        .eq('bubble_id', targetId)
        .eq('user_id', currentUser.id)
        .maybeSingle();
      isMember = !!memberRow;
    }
    var timing = _formatEventTiming(b.event_date, b.event_end_date);

    // Special case: already member + event ended → skip modal entirely (go straight to chat)
    if (isMember && timing.isEnded) {
      openBubbleChat(targetId, 'screen-home');
      return;
    }

    // Build event modal
    var iconHtmlE = b.icon_url
      ? '<img src="' + escHtml(b.icon_url) + '" style="width:100%;height:100%;object-fit:cover;border-radius:14px">'
      : '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" stroke-width="1.5"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>';

    _renderEventDeepLinkModal({
      bubbleId: targetId,
      iconHtml: iconHtmlE,
      iconOpacity: timing.isEnded ? '0.4' : '1',
      title: escHtml(b.name || '?'),
      subtitle: b.location ? escHtml(b.location) : '',
      timingHtml: timing.html,
      timingIsLive: timing.isLive,
      timingIsEnded: timing.isEnded,
      isMember: isMember
    });
  } catch(e) { logError('showDeepLinkModal', e); }
}

// Helper: render simple two-button modal (contact / network) — preserves prior behavior
function _renderSimpleDeepLinkModal(opts) {
  var ov = document.createElement('div');
  ov.id = 'deeplink-modal-overlay';
  ov.style.cssText = 'position:fixed;inset:0;z-index:600;background:rgba(30,27,46,0.45);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:1.5rem;animation:fadeSlideUp 0.35s cubic-bezier(0.34,1.56,0.64,1)';
  ov.innerHTML =
    '<div style="background:#FFFFFF;border-radius:20px;padding:2rem 1.5rem 1.5rem;width:100%;max-width:320px;text-align:center;box-shadow:0 16px 48px rgba(0,0,0,0.15)">' +
      '<div style="width:' + opts.iconSize + ';height:' + opts.iconSize + ';border-radius:' + opts.iconRadius + ';background:' + opts.iconBg + ';display:flex;align-items:center;justify-content:center;margin:0 auto 1rem;overflow:hidden">' + opts.iconHtml + '</div>' +
      '<div style="font-size:1.15rem;font-weight:800;color:var(--text);margin-bottom:0.2rem">' + opts.title + '</div>' +
      (opts.subtitle ? '<div style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:1.25rem">' + opts.subtitle + '</div>' : '<div style="margin-bottom:1.25rem"></div>') +
      '<button id="dl-action-btn" style="width:100%;padding:0.8rem;border-radius:12px;border:none;background:linear-gradient(135deg,#7C5CFC,#6366F1);color:white;font-size:0.92rem;font-weight:700;font-family:inherit;cursor:pointer;margin-bottom:0.5rem">' + escHtml(opts.primaryLabel) + '</button>' +
      '<button id="dl-stay-btn" style="width:100%;padding:0.7rem;border-radius:12px;border:1px solid rgba(124,92,252,0.12);background:none;color:var(--muted);font-size:0.8rem;font-weight:600;font-family:inherit;cursor:pointer">' + t('dl_stay_home') + '</button>' +
    '</div>';
  document.body.appendChild(ov);
  document.getElementById('dl-action-btn').onclick = async function() {
    this.disabled = true;
    this.textContent = t('ui_saving');
    try { await opts.primaryFn(); } catch(e) { logError('deepLinkAction', e); errorToast('save', e); }
    ov.remove();
  };
  document.getElementById('dl-stay-btn').onclick = function() {
    ov.style.transition = 'opacity 0.25s';
    ov.style.opacity = '0';
    setTimeout(function() { ov.remove(); }, 260);
  };
}

// Helper: render event-specific modal with timing + membership-aware buttons
function _renderEventDeepLinkModal(opts) {
  var bubbleId = opts.bubbleId;
  var ov = document.createElement('div');
  ov.id = 'deeplink-modal-overlay';
  ov.style.cssText = 'position:fixed;inset:0;z-index:600;background:rgba(30,27,46,0.45);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:1.5rem;animation:fadeSlideUp 0.35s cubic-bezier(0.34,1.56,0.64,1)';

  // Determine button set based on state
  var primaryLabel = '', primaryFn = null;
  var secondaryLabel = '', secondaryFn = null;
  var showDecline = false;
  var memberBanner = '';
  var readonlyBanner = '';

  // Common: "Se info" handler — joinless bubble open, lands on info tab via bcRenderActions()
  var seeInfoFn = function() { openBubbleChat(bubbleId, 'screen-home'); };

  if (opts.timingIsEnded) {
    // Slut + ikke medlem: kun "Se info"
    primaryLabel = t('dl_see_info') + ' →';
    primaryFn = seeInfoFn;
    readonlyBanner = '<div style="background:rgba(95,94,90,0.08);color:#5F5E5A;font-size:0.72rem;padding:0.5rem 0.75rem;border-radius:8px;text-align:center;margin-bottom:0.75rem">' + t('dl_event_ended_readonly') + '</div>';
  } else if (opts.isMember) {
    // Allerede medlem (event aktivt eller kommende)
    memberBanner = '<div style="background:rgba(26,158,142,0.10);color:#0F6E56;font-size:0.72rem;font-weight:600;padding:0.5rem 0.75rem;border-radius:8px;text-align:center;margin-bottom:0.75rem">' + t('dl_already_member') + '</div>';
    if (opts.timingIsLive) {
      // Live + medlem: Tjek ind primær
      primaryLabel = t('dl_check_in') + ' →';
      primaryFn = async function() {
        var r = await dbActions.checkIn(bubbleId);
        if (r.ok) { showSuccessToast(t('toast_saved')); if (typeof loadLiveBubbleStatus === 'function') await loadLiveBubbleStatus(); }
        openBubbleChat(bubbleId, 'screen-home');
      };
      secondaryLabel = t('dl_see_info');
      secondaryFn = seeInfoFn;
    } else {
      // Kommende + medlem: bare se info (ingen point i "Tjek ind" på fremtidigt event)
      primaryLabel = t('dl_see_info') + ' →';
      primaryFn = seeInfoFn;
    }
  } else if (opts.timingIsLive) {
    // Live + ikke medlem
    primaryLabel = t('dl_join_and_live') + ' →';
    primaryFn = async function() {
      var jr = await dbActions.joinBubble(bubbleId, 'invite_link');
      if (jr.ok) {
        var cr = await dbActions.checkIn(bubbleId);
        if (cr.ok && typeof loadLiveBubbleStatus === 'function') await loadLiveBubbleStatus();
        showSuccessToast(t('toast_joined'));
      }
      openBubbleChat(bubbleId, 'screen-home');
    };
    secondaryLabel = t('dl_see_info');
    secondaryFn = seeInfoFn;
    showDecline = true;
  } else {
    // Kommende + ikke medlem (default for upcoming events)
    primaryLabel = t('dl_accept_invitation') + ' →';
    primaryFn = async function() {
      var r = await dbActions.joinBubble(bubbleId, 'invite_link');
      if (r.ok) showSuccessToast(t('toast_joined'));
      openBubbleChat(bubbleId, 'screen-home');
    };
    secondaryLabel = t('dl_see_info');
    secondaryFn = seeInfoFn;
    showDecline = true;
  }

  // Build modal HTML
  var primaryBtnHtml = '<button id="dl-event-primary" style="width:100%;padding:0.8rem;border-radius:12px;border:none;background:linear-gradient(135deg,#7C5CFC,#6366F1);color:white;font-size:0.92rem;font-weight:700;font-family:inherit;cursor:pointer;margin-bottom:0.5rem">' + primaryLabel + '</button>';
  var secondaryBtnHtml = secondaryLabel ? '<button id="dl-event-secondary" style="width:100%;padding:0.75rem;border-radius:12px;border:1px solid rgba(124,92,252,0.18);background:none;color:#534AB7;font-size:0.82rem;font-weight:600;font-family:inherit;cursor:pointer;margin-bottom:0.4rem">' + secondaryLabel + '</button>' : '';
  var declineBtnHtml = showDecline ? '<button id="dl-event-decline" style="width:100%;padding:0.6rem;border-radius:12px;border:none;background:none;color:#993556;font-size:0.75rem;font-weight:600;font-family:inherit;cursor:pointer">' + t('dl_decline_invitation') + '</button>' : '';

  ov.innerHTML =
    '<div id="dl-event-card" style="background:#FFFFFF;border-radius:20px;padding:1.75rem 1.5rem 1.25rem;width:100%;max-width:320px;text-align:center;box-shadow:0 16px 48px rgba(30,27,46,0.12);position:relative">' +
      '<button id="dl-event-close" style="position:absolute;top:12px;right:12px;width:28px;height:28px;border-radius:50%;background:rgba(30,27,46,0.06);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:0.85rem;color:#6B6680;border:none;font-family:inherit">×</button>' +
      '<div id="dl-event-fadable">' +
        '<div style="width:56px;height:56px;border-radius:14px;background:rgba(46,207,207,0.15);display:flex;align-items:center;justify-content:center;margin:0 auto 0.85rem;overflow:hidden;opacity:' + opts.iconOpacity + '">' + opts.iconHtml + '</div>' +
        '<div style="font-size:1.05rem;font-weight:700;color:#1E1B2E;margin-bottom:0.2rem">' + opts.title + '</div>' +
        (opts.subtitle ? '<div style="font-size:0.78rem;color:#6B6680;margin-bottom:0.25rem">' + opts.subtitle + '</div>' : '') +
        (opts.timingHtml ? '<div style="font-size:0.72rem;color:' + (opts.timingIsLive ? '#0F6E56' : (opts.timingIsEnded ? '#888780' : '#6B6680')) + ';margin-bottom:1rem;font-weight:500">' + opts.timingHtml + '</div>' : '<div style="margin-bottom:1rem"></div>') +
        memberBanner +
        readonlyBanner +
      '</div>' +
      '<div id="dl-event-actions">' +
        primaryBtnHtml +
        secondaryBtnHtml +
        declineBtnHtml +
      '</div>' +
    '</div>';

  document.body.appendChild(ov);

  // Wire up handlers
  var card = document.getElementById('dl-event-card');
  var closeAndRemove = function() {
    ov.style.transition = 'opacity 0.25s';
    ov.style.opacity = '0';
    setTimeout(function() { if (ov.parentNode) ov.remove(); }, 260);
  };

  document.getElementById('dl-event-close').onclick = closeAndRemove;

  var wirePrimary = function() {
    var btn = document.getElementById('dl-event-primary');
    if (!btn) return;
    btn.onclick = async function() {
      this.disabled = true;
      this.textContent = t('ui_saving');
      try { await primaryFn(); } catch(e) { logError('deepLinkPrimary', e); errorToast('save', e); }
      if (ov.parentNode) ov.remove();
    };
  };
  var wireSecondary = function() {
    var btn = document.getElementById('dl-event-secondary');
    if (!btn) return;
    btn.onclick = async function() {
      this.disabled = true;
      try { await secondaryFn(); } catch(e) { logError('deepLinkSecondary', e); }
      if (ov.parentNode) ov.remove();
    };
  };
  wirePrimary();
  if (secondaryFn) wireSecondary();

  if (showDecline) {
    var wireDeclineBtn = function() {
      var declineBtn = document.getElementById('dl-event-decline');
      if (!declineBtn) return;
      declineBtn.onclick = function() {
        // Replace actions area with confirmation tray; fade rest of card
        var fadable = document.getElementById('dl-event-fadable');
        if (fadable) fadable.style.opacity = '0.5';
        var actions = document.getElementById('dl-event-actions');
        if (!actions) return;
        actions.innerHTML =
          '<div style="background:rgba(153,53,86,0.06);border:1px solid rgba(153,53,86,0.15);border-radius:12px;padding:0.85rem 0.75rem 0.75rem">' +
            '<div style="font-size:0.78rem;color:#993556;font-weight:600;text-align:center;margin-bottom:0.6rem">' + t('dl_decline_confirm_q') + '</div>' +
            '<div style="display:flex;gap:0.5rem">' +
              '<button id="dl-decline-undo" style="flex:1;padding:0.6rem;border-radius:10px;border:1px solid rgba(30,27,46,0.12);background:white;color:#1E1B2E;font-size:0.78rem;font-weight:600;font-family:inherit;cursor:pointer">' + t('dl_undo') + '</button>' +
              '<button id="dl-decline-yes" style="flex:1;padding:0.6rem;border-radius:10px;border:none;background:#993556;color:white;font-size:0.78rem;font-weight:700;font-family:inherit;cursor:pointer">' + t('dl_yes_decline') + '</button>' +
            '</div>' +
          '</div>';
        document.getElementById('dl-decline-undo').onclick = function() {
          // Restore original buttons + handlers
          if (fadable) fadable.style.opacity = opts.iconOpacity;
          actions.innerHTML = primaryBtnHtml + secondaryBtnHtml + declineBtnHtml;
          wirePrimary();
          if (secondaryFn) wireSecondary();
          wireDeclineBtn();
        };
        document.getElementById('dl-decline-yes').onclick = function() {
          showToast(t('toast_invitation_dismissed'));
          closeAndRemove();
        };
      };
    };
    wireDeclineBtn();
  }
}

// Legacy aliases (safe to call from other files)
function goToEventFromCard() {}
function dismissEventCard() {
  var ov = document.getElementById('checkin-confirm-overlay');
  if (ov) ov.remove();
}

// ── Saved contact modal (shown after QR scan signup) ──
async function _showSavedContactModal(contactId) {
  try {
    var { data: p } = await sb.from('profiles').select('id, name, title, workplace, avatar_url, keywords').eq('id', contactId).maybeSingle();
    if (!p) return;
    var existing = document.getElementById('saved-contact-overlay');
    if (existing) existing.remove();

    var name = p.name || '?';
    var ini = name.split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();
    var subtitle = [p.title, p.workplace].filter(Boolean).join(' · ');
    var avHtml = p.avatar_url
      ? '<img src="' + escHtml(p.avatar_url) + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%">'
      : '<span style="font-size:1.1rem;font-weight:700;color:white">' + escHtml(ini) + '</span>';

    var ov = document.createElement('div');
    ov.id = 'saved-contact-overlay';
    ov.style.cssText = 'position:fixed;inset:0;z-index:600;background:rgba(30,27,46,0.45);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:1.5rem;animation:fadeSlideUp 0.35s cubic-bezier(0.34,1.56,0.64,1)';

    ov.innerHTML =
      '<div style="background:#FFFFFF;border-radius:20px;padding:2rem 1.5rem 1.5rem;width:100%;max-width:320px;text-align:center;box-shadow:0 16px 48px rgba(0,0,0,0.15)">' +
        '<div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#7C5CFC,#6366F1);display:flex;align-items:center;justify-content:center;margin:0 auto 1rem;box-shadow:0 4px 12px rgba(124,92,252,0.25)">' + avHtml + '</div>' +
        '<div style="font-size:1.15rem;font-weight:800;color:var(--text);margin-bottom:0.2rem">' + escHtml(name) + '</div>' +
        (subtitle ? '<div style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:0.3rem">' + escHtml(subtitle) + '</div>' : '') +
        '<div style="display:flex;align-items:center;justify-content:center;gap:0.4rem;margin-bottom:1.25rem">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1A9E8E" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>' +
          '<span style="font-size:0.78rem;font-weight:600;color:#1A9E8E">Kontakt gemt</span>' +
        '</div>' +
        '<button id="sc-view-btn" style="width:100%;padding:0.8rem;border-radius:12px;border:none;background:linear-gradient(135deg,#7C5CFC,#6366F1);color:white;font-size:0.92rem;font-weight:700;font-family:inherit;cursor:pointer;margin-bottom:0.5rem">Se profil →</button>' +
        '<button id="sc-close-btn" style="width:100%;padding:0.7rem;border-radius:12px;border:1px solid rgba(124,92,252,0.12);background:none;color:var(--muted);font-size:0.8rem;font-weight:600;font-family:inherit;cursor:pointer">' + t('modal_ok') + '</button>' +
      '</div>';

    document.body.appendChild(ov);

    document.getElementById('sc-view-btn').onclick = function() {
      ov.remove();
      openPerson(contactId, 'screen-home');
    };
    document.getElementById('sc-close-btn').onclick = function() {
      ov.style.transition = 'opacity 0.25s';
      ov.style.opacity = '0';
      setTimeout(function() { ov.remove(); }, 260);
    };
  } catch(e) { logError('_showSavedContactModal', e); }
}

// ── Welcome card — shown once to brand new users ──
function showWelcomeCard() {
  var el = document.getElementById('home-welcome-card');
  if (!el || !currentProfile) return;
  if (localStorage.getItem('bubble_welcome_card_dismissed')) return;
  // Suppress if event checkin overlay is showing
  var eventOverlay = document.getElementById('checkin-confirm-overlay');
  if (eventOverlay) return;
  // Only show if profile is truly fresh — name + workplace but nothing else
  var isNewUser = !currentProfile.title &&
    !(currentProfile.keywords && currentProfile.keywords.length) &&
    !currentProfile.lifestage;
  if (!isNewUser) return;

  el.innerHTML =
    '<div style="background:rgba(23,15,52,0.85);backdrop-filter:blur(12px) saturate(130%);-webkit-backdrop-filter:blur(12px) saturate(130%);border:0.5px solid rgba(255,255,255,0.06);border-radius:14px;padding:1rem 1.1rem;position:relative">' +
      '<button onclick="dismissWelcomeCard()" style="position:absolute;top:0.6rem;right:0.7rem;background:none;border:none;cursor:pointer;color:rgba(255,255,255,0.4);font-size:1rem;line-height:1;padding:0.2rem;font-family:inherit" aria-label="Luk">×</button>' +
      '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem">' +
        '<div style="width:28px;height:28px;color:rgb(100,180,230);flex-shrink:0">' + ico('bubble') + '</div>' +
        '<div style="font-size:0.88rem;font-weight:800;color:rgba(255,255,255,0.95)">Velkommen til Bubble' + (currentProfile.name ? ', ' + currentProfile.name.split(' ')[0] : '') + '!</div>' +
      '</div>' +
      '<div style="font-size:0.78rem;color:rgba(255,255,255,0.7);line-height:1.55;margin-bottom:0.75rem">' +
        'Bubble matcher dig med relevante mennesker i nærheden — baseret på hvem du er og hvad du søger. Jo mere du udfylder, jo bedre og mere præcise matches får du i radaren.' +
      '</div>' +
      '<div style="display:flex;gap:0.5rem;align-items:center">' +
        '<button onclick="dismissWelcomeCard();goTo(\'screen-profile\');setTimeout(function(){profSwitchTab(\'dashboard\')},200)" style="flex:1;padding:0.55rem;border-radius:10px;font-size:0.78rem;font-weight:700;font-family:inherit;cursor:pointer;background:rgba(100,180,230,0.18);border:0.5px solid rgba(100,180,230,0.25);color:rgba(255,255,255,0.95)">Udfyld profil →</button>' +
        '<button onclick="dismissWelcomeCard()" style="padding:0.55rem 0.8rem;border-radius:10px;font-size:0.78rem;font-weight:600;font-family:inherit;cursor:pointer;background:none;border:0.5px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.45)">Senere</button>' +
      '</div>' +
    '</div>';
  el.style.display = 'block';
}

function dismissWelcomeCard() {
  localStorage.setItem('bubble_welcome_card_dismissed', '1');
  var el = document.getElementById('home-welcome-card');
  if (!el) return;
  el.style.transition = 'opacity 0.25s';
  el.style.opacity = '0';
  setTimeout(function() { el.style.display = 'none'; }, 260);
}

function showProfileSetupCTA() {
  var setupEl = document.getElementById('home-profile-setup');
  var miniEl = document.getElementById('home-profile-mini');
  if (!setupEl || !currentProfile) return;

  var strength = calcProfileStrength(currentProfile);
  var prefs = hsGetPrefs();
  var ctaVisible = prefs.profile_cta !== false; // default on

  // Hide completely at 100% or if toggled off
  if (strength >= 100 || !ctaVisible) {
    hsSlotHide('home-profile-setup'); setupEl.style.display = 'none';
    if (miniEl) miniEl.style.display = 'none';
    _updateProfileStrengthBar(strength);
    return;
  }

  // Contextual match-position message based on what's missing
  var nextLabel = '';
  var tags = currentProfile.keywords ? currentProfile.keywords.length : 0;
  if (!currentProfile.title && tags < 3) nextLabel = t('pf_hint_title_tags');
  else if (tags < 3) nextLabel = t('pf_hint_more_tags', {n: 3 - tags});
  else if (!currentProfile.title) nextLabel = t('pf_hint_title');
  else if (tags < 6) nextLabel = t('pf_hint_tags6');
  else if (!currentProfile.bio) nextLabel = t('pf_hint_bio');
  else nextLabel = t('pf_hint_almost');

  // Avatar
  var avEl = document.getElementById('setup-cta-avatar');
  if (avEl) {
    if (currentProfile.avatar_url) {
      avEl.innerHTML = '<img src="' + escHtml(currentProfile.avatar_url) + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%">';
    } else {
      avEl.textContent = (currentProfile.name || '?').split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();
    }
  }

  hsSlotShow('home-profile-setup'); setupEl.style.display = 'block';
  if (miniEl) miniEl.style.display = 'none';
  var bar = document.getElementById('setup-cta-bar');
  var pctEl = document.getElementById('setup-cta-pct');
  var nextEl = document.getElementById('setup-cta-next');
  if (bar) bar.style.width = strength + '%';
  if (pctEl) pctEl.textContent = strength + '%';
  if (nextEl) nextEl.textContent = nextLabel;

  _updateProfileStrengthBar(strength);
}

// Update the always-visible strength bar on the profile screen
function _updateProfileStrengthBar(strength) {
  var bar = document.getElementById('prof-strength-bar');
  var pct = document.getElementById('prof-strength-pct');
  var lbl = document.getElementById('prof-strength-label');
  if (bar) bar.style.width = strength + '%';
  if (pct) pct.textContent = strength + '%';
  if (lbl) {
    if (strength >= 80) { lbl.textContent = 'Stærk profil'; lbl.style.color = '#1A9E8E'; }
    else if (strength >= 50) { lbl.textContent = 'God profil'; lbl.style.color = 'var(--accent)'; }
    else if (strength >= 25) { lbl.textContent = 'Basis profil'; lbl.style.color = 'var(--gold)'; }
    else { lbl.textContent = 'Kom i gang'; lbl.style.color = 'var(--accent2)'; }
  }
}

function openNextProfileSetupSheet() {
  if (!currentProfile) return;
  if (!currentProfile.title) { openSetupTitleSheet(); return; }
  if (!currentProfile.lifestage) { openSetupLifestageSheet(); return; }
  if (!currentProfile.keywords || currentProfile.keywords.length < 3) { openSetupTagsSheet(); return; }
  if (!currentProfile.bio) { openSetupBioSheet(); return; }
  // All done
  showSuccessToast('Profil komplet! 🎉');
  showProfileSetupCTA();
}

// ── WORKPLACE SHEET ──
function openSetupWorkplaceSheet() {
  var { overlay, sheet } = bbDynOpen();
  sheet.innerHTML = '<div style="padding:1.2rem 1rem">' +
    '<div style="font-size:1rem;font-weight:800;margin-bottom:0.3rem">Hvor arbejder du?</div>' +
    '<div style="font-size:0.78rem;color:var(--text-secondary);margin-bottom:1rem">Andre kan se din arbejdsplads på din profil</div>' +
    '<input class="input" id="setup-workplace-input" maxlength="80" placeholder="f.eks. Danfoss, SDU, selvstændig..." value="' + escHtml(currentProfile?.workplace || '') + '">' +
    '<button class="btn-primary" onclick="saveSetupWorkplace()" style="width:100%;margin-top:0.8rem">Gem</button>' +
    '</div>';
  setTimeout(function() { var el = document.getElementById('setup-workplace-input'); if (el) el.focus(); }, 200);
}

async function saveSetupWorkplace() {
  var input = document.getElementById('setup-workplace-input');
  if (!input) return;
  var val = input.value.trim();
  if (!val) return showWarningToast(t('val_workplace_required'));
  try {
    var { error } = await sb.from('profiles').update({ workplace: val }).eq('id', currentUser.id);
    if (error) return errorToast('save', error);
    currentProfile.workplace = val;
    showSuccessToast('Arbejdsplads gemt');
    var ov = document.querySelector('.bb-dyn-overlay');
    if (ov) bbDynClose(ov);
    showProfileSetupCTA();
  } catch(e) { errorToast('save', e); }
}

// ── TITLE SHEET ──
function openSetupTitleSheet() {
  var input = document.getElementById('setup-title-input');
  if (input) input.value = currentProfile?.title || '';
  var strength = calcProfileStrength(currentProfile);
  var bar = document.getElementById('setup-title-bar');
  var pct = document.getElementById('setup-title-pct');
  if (bar) bar.style.width = strength + '%';
  if (pct) pct.textContent = strength + '%';
  openModal('sheet-setup-title');
}

function setupTitleChanged() {
  var val = (document.getElementById('setup-title-input')?.value || '').trim();
  // Highlight matching suggestion
  var btns = document.querySelectorAll('#setup-title-suggestions .setup-suggestion');
  btns.forEach(function(b) { b.classList.toggle('active', b.textContent.trim() === val); });
}

function pickSetupTitle(btn) {
  var input = document.getElementById('setup-title-input');
  if (input) { input.value = btn.textContent.trim(); setupTitleChanged(); }
}

async function saveSetupTitle() {
  var title = (document.getElementById('setup-title-input')?.value || '').trim();
  if (!title) { showWarningToast('Skriv en titel'); return; }
  try {
    await sb.from('profiles').update({ title: title }).eq('id', currentUser.id);
    if (currentProfile) currentProfile.title = title;
    closeModal('sheet-setup-title');
    showProfileSetupCTA();
    setTimeout(function() { openSetupLifestageSheet(); }, 180);
  } catch(e) { errorToast('save', e); }
}

// ── TAGS SHEET ──
function openSetupTagsSheet() {
  _etPrefix = '';
  if (typeof etInit === 'function') etInit();
  var strength = calcProfileStrength(currentProfile);
  var bar = document.getElementById('setup-tags-bar');
  var pct = document.getElementById('setup-tags-pct');
  if (bar) bar.style.width = strength + '%';
  if (pct) pct.textContent = strength + '%';
  openModal('sheet-setup-tags');
}

async function saveSetupTags() {
  try {
    var tags = typeof etGetSelectedTags === 'function' ? etGetSelectedTags() : [];
    var lifestage = typeof etGetLifestage === 'function' ? etGetLifestage() : null;
    await sb.from('profiles').update({ keywords: tags, lifestage: lifestage || currentProfile?.lifestage || null }).eq('id', currentUser.id);
    if (currentProfile) { currentProfile.keywords = tags; }
    closeModal('sheet-setup-tags');
    showProfileSetupCTA();
    setTimeout(function() { openSetupBioSheet(); }, 180);
  } catch(e) { errorToast('save', e); }
}

// ── BIO SHEET ──
function openSetupBioSheet() {
  var input = document.getElementById('setup-bio-input');
  if (input) {
    input.value = currentProfile?.bio || '';
    input.oninput = function() {
      var cnt = document.getElementById('setup-bio-count');
      if (cnt) cnt.textContent = input.value.length;
    };
    input.oninput();
  }
  var strength = calcProfileStrength(currentProfile);
  var bar = document.getElementById('setup-bio-bar');
  var pct = document.getElementById('setup-bio-pct');
  if (bar) bar.style.width = strength + '%';
  if (pct) pct.textContent = strength + '%';
  openModal('sheet-setup-bio');
}

async function saveSetupBio() {
  var bio = (document.getElementById('setup-bio-input')?.value || '').trim();
  try {
    await sb.from('profiles').update({ bio: bio }).eq('id', currentUser.id);
    if (currentProfile) currentProfile.bio = bio;
    closeModal('sheet-setup-bio');
    showSuccessToast('Profil komplet! 🎉');
    showProfileSetupCTA();
    loadHomeDartboardData();
  } catch(e) { errorToast('save', e); }
}

// ── LIFESTAGE SHEET ──
function openSetupLifestageSheet() {
  _setupSelectedLifestage = currentProfile?.lifestage || null;
  updateSetupLifestageUI();
  var strength = calcProfileStrength(currentProfile);
  var bar = document.getElementById('setup-ls-bar');
  var pct = document.getElementById('setup-ls-pct');
  if (bar) bar.style.width = strength + '%';
  if (pct) pct.textContent = strength + '%';
  openModal('sheet-setup-lifestage');
}

function pickSetupLifestage(btn) {
  _setupSelectedLifestage = btn.dataset.ls;
  updateSetupLifestageUI();
}

function updateSetupLifestageUI() {
  document.querySelectorAll('#setup-lifestage-grid .setup-ls-btn').forEach(function(b) {
    b.classList.toggle('active', b.dataset.ls === _setupSelectedLifestage);
  });
  var btn = document.getElementById('setup-ls-save');
  if (btn) {
    if (_setupSelectedLifestage) { btn.disabled = false; btn.textContent = t('misc_done'); }
    else { btn.disabled = true; btn.textContent = t('home_select_type'); }
  }
  var strength = calcProfileStrength(currentProfile);
  var bonus = (_setupSelectedLifestage && !currentProfile?.lifestage) ? 8 : 0;
  var projected = Math.min(strength + bonus, 100);
  var bar = document.getElementById('setup-ls-bar');
  var pct = document.getElementById('setup-ls-pct');
  if (bar) bar.style.width = projected + '%';
  if (pct) pct.textContent = projected + '%';
}

async function saveSetupLifestage() {
  if (!_setupSelectedLifestage) return;
  try {
    await sb.from('profiles').update({ lifestage: _setupSelectedLifestage }).eq('id', currentUser.id);
    if (currentProfile) currentProfile.lifestage = _setupSelectedLifestage;
    closeModal('sheet-setup-lifestage');
    showProfileSetupCTA();
    setTimeout(function() { openSetupTagsSheet(); }, 180);
  } catch(e) { errorToast('save', e); }
}

// ── SKIP + BOOST ──
function skipSetupSheet(which) {
  var modalId = 'sheet-setup-' + which;
  closeModal(modalId);
  showProfileSetupCTA();
  // Continue to next step after skip
  var next = { title: openSetupLifestageSheet, lifestage: openSetupTagsSheet, tags: openSetupBioSheet, bio: null };
  var fn = next[which];
  if (fn) setTimeout(fn, 180);
}

// ── STEP NAVIGATION — jump between setup sheets ──
var _setupStepMap = {
  1: { id: 'sheet-setup-title', open: function() { openSetupTitleSheet(); } },
  2: { id: 'sheet-setup-lifestage', open: function() { openSetupLifestageSheet(); } },
  3: { id: 'sheet-setup-tags', open: function() { openSetupTagsSheet(); } },
  4: { id: 'sheet-setup-bio', open: function() { openSetupBioSheet(); } }
};
function setupGoToStep(step) {
  // Close all setup sheets first
  [1, 2, 3, 4].forEach(function(s) { closeModal(_setupStepMap[s].id); });
  var target = _setupStepMap[step];
  if (target) setTimeout(target.open, 60);
}

function openProfileSetupTags() {
  openSetupTagsSheet();
}

// Alias for onclick references in radar empty states
function openEditTags() {
  openSetupTagsSheet();
}

// ── EMPTY FILTER STATE ──
function showDartboardEmpty(filter) {
  var container = document.getElementById('home-prox-avatars');
  if (!container) return;
  var existing = container.querySelector('.dartboard-empty');
  if (existing) existing.remove();
  var msg = '', link = '', linkFn = '';
  if (filter === 'strong') {
    msg = t('home_no_strong_matches');
    link = t('home_add_tags_link');
    linkFn = 'openEditTags()';
  } else if (filter === 'good') {
    msg = t('home_no_good_matches');
    link = t('home_try_other_filter');
    linkFn = 'filterRadarHome(\'all\')';
  } else if (filter === 'interest') {
    msg = t('home_no_shared_interests');
    link = t('home_add_interests_link');
    linkFn = 'openEditTags()';
  }
  if (!msg) return;
  var div = document.createElement('div');
  div.className = 'dartboard-empty';
  div.innerHTML = '<div class="de-title">' + msg + '</div>' +
    '<div class="de-sub">Tilføj flere tags for at finde folk der matcher dine specifikke interesser</div>' +
    '<div class="de-link" onclick="' + linkFn + '">' + link + '</div>';
  container.appendChild(div);
}

// ══════════════════════════════════════════════════════════
//  TOPBAR NOTIFICATION BADGE
// ══════════════════════════════════════════════════════════
async function updateTopbarNotifBadge() {
  try {
    var badge = document.getElementById('topbar-notif-badge');
    if (!badge || !currentUser) return;
    var lastSeen = localStorage.getItem('bubble_notifs_seen') || '2000-01-01';
    var ownedIds = [];
    try {
      var { data: ownedB } = await sb.from('bubbles').select('id').eq('created_by', currentUser.id);
      ownedIds = (ownedB || []).map(function(b) { return b.id; });
    } catch(e) {}
    var [invRes, saveRes] = await Promise.all([
      sb.from('bubble_invitations').select('*', { count: 'exact', head: true })
        .eq('to_user_id', currentUser.id).eq('status', 'pending'),
      sb.from('saved_contacts').select('*', { count: 'exact', head: true })
        .eq('contact_id', currentUser.id).gt('created_at', lastSeen)
    ]);
    var pendingCount = 0;
    if (ownedIds.length > 0) {
      var { count: pc } = await sb.from('bubble_members').select('*', { count: 'exact', head: true })
        .in('bubble_id', ownedIds).eq('status', 'pending');
      pendingCount = pc || 0;
    }
    var total = (invRes.count || 0) + (saveRes.count || 0) + pendingCount;
    // Topbar bell: pure dot only (no number) — matches unreadState.notifSet pattern
    if (total > 0) {
      badge.style.display = 'block';
    } else {
      badge.style.display = 'none';
    }
    // Also update nav tab badge (for consistency)
    notifBadgeSet(total);
  } catch(e) { logError('updateTopbarNotifBadge', e); }
}

// ── Notification nav badge ──
async function updateNotifNavBadge() {
  // v5.2: delegated to topbar badge
  updateTopbarNotifBadge();
}

// ── Bubble invite actions (from bubbles screen) ──
function bbAcceptInvite(inviteId, fromUserId) {
  var card = document.getElementById('bb-inv-' + inviteId);
  if (!card) return;
  bbConfirm(card, {
    label: 'Join denne boble?',
    confirmText: 'Ja, join',
    confirmClass: 'bb-confirm-btn-accept',
    onConfirm: "bbConfirmAccept('" + inviteId + "','" + fromUserId + "')"
  });
}

async function bbConfirmAccept(inviteId, fromUserId) {
  try {
    var { data: inv } = await sb.from('bubble_invitations').select('bubble_id').eq('id', inviteId).maybeSingle();
    var result = await dbActions.acceptInvitation(inviteId, inv?.bubble_id);
    if (result.ok) {
      var invCard = document.getElementById('bb-inv-' + inviteId);
      if (invCard) { invCard.style.transition = 'opacity 0.2s'; invCard.style.opacity = '0'; setTimeout(function() { invCard.remove(); }, 200); }
      showSuccessToast('Du er nu med i boblen!');
      if (inv?.bubble_id) {
        _bbAfterJoin(inv.bubble_id);
        loadMyBubbles();
        requestAnimationFrame(function() { requestAnimationFrame(function() { openBubbleChat(inv.bubble_id, 'screen-bubbles'); }); });
      }
    }
  } catch(e) { logError('bbConfirmAccept', e); errorToast('save', e); }
}

function bbDeclineInvite(inviteId) {
  var card = document.getElementById('bb-inv-' + inviteId);
  if (!card) return;
  bbConfirm(card, {
    label: 'Afvis invitation?',
    confirmText: 'Ja, afvis',
    confirmClass: 'bb-confirm-btn-danger',
    onConfirm: "bbConfirmDecline('" + inviteId + "')"
  });
}

async function bbConfirmDecline(inviteId) {
  var result = await dbActions.declineInvitation(inviteId);
  if (result.ok) {
    var card = document.getElementById('bb-inv-' + inviteId);
    if (card) { card.style.transition = 'opacity 0.2s'; card.style.opacity = '0'; setTimeout(function() { card.remove(); }, 200); }
    showToast('Invitation afvist');
  }
}

var _bbActiveTab = 'mine';
var _bbActiveSub = 'net';

function bbSwitchTab(tab) {
  _bbActiveTab = tab;
  var mineTab = document.getElementById('bb-tab-mine');
  var exploreTab = document.getElementById('bb-tab-explore');
  var subTabs = document.getElementById('bb-sub-tabs');
  if (tab === 'explore') {
    if (mineTab) mineTab.classList.remove('active');
    if (exploreTab) exploreTab.classList.add('active');
  } else {
    if (mineTab) mineTab.classList.add('active');
    if (exploreTab) exploreTab.classList.remove('active');
  }
  if (subTabs) subTabs.style.display = 'flex';
  bbSwitchSub(_bbActiveSub);
}

function bbSwitchSub(sub) {
  _bbActiveSub = sub;
  var netBtn = document.getElementById('bb-sub-net');
  var evtBtn = document.getElementById('bb-sub-evt');
  if (sub === 'evt') {
    if (netBtn) netBtn.classList.remove('active');
    if (evtBtn) evtBtn.classList.add('active');
  } else {
    if (netBtn) netBtn.classList.add('active');
    if (evtBtn) evtBtn.classList.remove('active');
  }
  // Route to correct panel based on active tab + sub
  if (_bbActiveTab === 'explore') {
    if (sub === 'evt') { _bbShowPanel('explore-evt'); loadDiscoverEvents(); }
    else { _bbShowPanel('explore-net'); loadDiscoverNetworks(); }
  } else {
    if (sub === 'evt') { _bbShowPanel('mine-evt'); loadMyEvents(); }
    else { _bbShowPanel('mine-net'); loadMyNetworks(); }
  }
}

function _bbShowPanel(id) {
  ['bb-panel-mine-net','bb-panel-mine-evt','bb-panel-explore-net','bb-panel-explore-evt'].forEach(function(pid) {
    var el = document.getElementById(pid);
    if (el) el.style.display = pid === 'bb-panel-' + id ? 'block' : 'none';
  });
}

async function loadMyBubbles() {
  bbSwitchTab(_bbActiveTab);
}

// ── Pending invitations for bubbles screen ──
async function _bbLoadPendingInvites() {
  var el = document.getElementById('bb-pending-invites');
  if (!el || !currentUser) return;
  try {
    var { data: invites } = await sb.from('bubble_invitations')
      .select('id, from_user_id, bubble_id, created_at')
      .eq('to_user_id', currentUser.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (!invites || invites.length === 0) { el.innerHTML = ''; return; }

    var senderIds = invites.map(function(i) { return i.from_user_id; }).filter(function(v, i, a) { return a.indexOf(v) === i; });
    var bubbleIds = invites.map(function(i) { return i.bubble_id; }).filter(Boolean).filter(function(v, i, a) { return a.indexOf(v) === i; });
    var profileMap = {}, bubbleMap = {};
    var { data: profiles } = await sb.from('profiles').select('id, name, avatar_url').in('id', senderIds);
    (profiles || []).forEach(function(p) { profileMap[p.id] = p; });
    if (bubbleIds.length > 0) {
      var { data: bubbles } = await sb.from('bubbles').select('id, name').in('id', bubbleIds);
      (bubbles || []).forEach(function(b) { bubbleMap[b.id] = b; });
    }

    var html = '<div style="margin-bottom:0.5rem">';
    invites.forEach(function(inv) {
      var p = profileMap[inv.from_user_id] || {};
      var b = bubbleMap[inv.bubble_id] || {};
      var ini = (p.name || '?').split(' ').map(function(w) { return w[0]; }).join('').slice(0, 2).toUpperCase();
      html += '<div class="card" style="padding:0.6rem 0.8rem;margin-bottom:0.4rem;border-left:2px solid var(--accent)" id="bb-inv-' + inv.id + '">';
      html += '<div style="display:flex;align-items:center;gap:0.6rem">';
      html += '<div class="avatar" style="width:32px;height:32px;font-size:0.65rem;flex-shrink:0">' + ini + '</div>';
      html += '<div style="flex:1;min-width:0">';
      html += '<div style="font-size:0.78rem;font-weight:600">' + escHtml(p.name || t('misc_unknown')) + '</div>';
      if (b.name) html += '<div style="font-size:0.62rem;color:var(--muted)">' + icon('bubble') + ' ' + escHtml(b.name) + '</div>';
      html += '</div>';
      html += '<div style="display:flex;gap:0.3rem;flex-shrink:0">';
      html += '<button class="btn-sm" style="padding:0.3rem 0.6rem;font-size:0.65rem;font-weight:600;background:var(--gradient-primary);color:white;border:none;border-radius:var(--radius-xs);cursor:pointer;font-family:inherit" onclick="event.stopPropagation();bbAcceptInvite(\'' + inv.id + '\',\'' + inv.from_user_id + '\')">Accepter</button>';
      html += '<button class="btn-sm btn-ghost" style="padding:0.3rem 0.5rem;font-size:0.65rem" onclick="event.stopPropagation();bbDeclineInvite(\'' + inv.id + '\',this)">Afvis</button>';
      html += '</div></div></div>';
    });
    html += '</div>';
    el.innerHTML = html;
  } catch(e) { logError('_bbLoadPendingInvites', e); el.innerHTML = ''; }
}

// ── Accordion network view with Reddit-style threading ──
var _bbAccordionOpen = {};

async function loadMyNetworks() {
  try {
    if (!currentUser) return;
    var myNav = _navVersion;
    var list = document.getElementById('bb-net-list');
    if (!list) return;
    list.innerHTML = skelCards(3);

    // Load pending invitations in parallel (issue 2)
    _bbLoadPendingInvites();

    // 1. Fetch memberships
    var { data: memberships } = await sb.from('bubble_members').select('bubble_id, status, last_read_at').eq('user_id', currentUser.id);
    if (_navVersion !== myNav) return;
    if (!memberships || memberships.length === 0) {
      _bubbleUnreadSet = {}; _renderBubblesUnreadDot();
      list.innerHTML = '<div class="empty-state" style="padding:2rem 0"><div class="empty-icon">' + icon('bubble') + '</div><div class="empty-text">' + t('bb_no_networks') + '</div><div style="margin-top:1rem"><button class="btn-primary" onclick="bbSwitchTab(\'explore\')" style="font-size:0.82rem;padding:0.6rem 1.5rem">' + t('home_discover_networks') + '</button></div></div>';
      return;
    }
    _fetchBubbleUnread(memberships);
    var myIds = memberships.map(function(m) { return m.bubble_id; });
    _myBubbleMemberIds = myIds; // eksponér til b-realtime.js
    var pendingSet = {};
    memberships.forEach(function(m) { if (m.status === 'pending') pendingSet[m.bubble_id] = true; });

    // 2. Fetch my bubbles
    var { data: allMyBubbles, error: fetchErr } = await sb.from('bubbles').select('*, bubble_members(count)').in('id', myIds);
    if (fetchErr) { logError('loadMyNetworks:fetch', fetchErr); showRetryState('bb-net-list', 'loadMyNetworks', 'Kunne ikke hente netværk'); return; }
    if (_navVersion !== myNav) return;
    var allMy = allMyBubbles || [];
    _allMyBubblesCache = allMy;

    var networks = allMy.filter(function(b) { return b.type !== 'event' && b.type !== 'live'; });

    // Split: parent networks (no parent_bubble_id) vs child networks with missing parent
    var parentNets = networks.filter(function(b) { return !b.parent_bubble_id; });
    var parentIds = parentNets.map(function(b) { return b.id; });
    var childNetsWithMissingParent = networks.filter(function(b) { return b.parent_bubble_id && parentIds.indexOf(b.parent_bubble_id) < 0; });

    // 3. Fetch ALL children for parent networks
    var childrenMap = {};
    if (parentIds.length > 0) {
      var { data: children } = await sb.from('bubbles')
        .select('*, bubble_members(count)')
        .in('parent_bubble_id', parentIds)
        .order('event_date', { ascending: true, nullsFirst: false });
      if (_navVersion !== myNav) return;
      (children || []).forEach(function(c) {
        if (!childrenMap[c.parent_bubble_id]) childrenMap[c.parent_bubble_id] = [];
        childrenMap[c.parent_bubble_id].push(c);
      });
    }

    // 3b. Ghost parents: fetch full parent data for orphans
    var ghostParentMap = {}; // id → bubble data
    var adoptedOrphans = []; // orphans whose grandparent is in parentNets
    var trueOrphans = []; // orphans with no grandparent connection
    var orphanParentIds = childNetsWithMissingParent.map(function(o) { return o.parent_bubble_id; }).filter(function(v, i, a) { return a.indexOf(v) === i; });

    if (orphanParentIds.length > 0) {
      var { data: opData } = await sb.from('bubbles').select('id, name, type, visibility, parent_bubble_id, icon_url, bubble_members(count)').in('id', orphanParentIds);
      if (_navVersion !== myNav) return;
      (opData || []).forEach(function(p) { ghostParentMap[p.id] = p; });
    }

    // Classify orphans: adopted (grandparent is member) vs true orphan
    childNetsWithMissingParent.forEach(function(orphan) {
      var ghost = ghostParentMap[orphan.parent_bubble_id];
      if (ghost && ghost.parent_bubble_id && parentIds.indexOf(ghost.parent_bubble_id) >= 0) {
        // Ghost parent is child of a parentNet → adopted: inject into childrenMap
        adoptedOrphans.push(orphan);
        if (!childrenMap[ghost.parent_bubble_id]) childrenMap[ghost.parent_bubble_id] = [];
        // Add ghost parent to children if not already there
        var alreadyInChildren = childrenMap[ghost.parent_bubble_id].some(function(c) { return c.id === ghost.id; });
        if (!alreadyInChildren) {
          ghost._isGhost = true;
          childrenMap[ghost.parent_bubble_id].push(ghost);
        } else {
          // Mark existing child as having an adopted grandchild
          childrenMap[ghost.parent_bubble_id].forEach(function(c) { if (c.id === ghost.id) c._hasAdoptedChild = true; });
        }
      } else {
        trueOrphans.push(orphan);
      }
    });

    // Build adopted grandchildren map (ghost parent id → [grandchildren])
    var adoptedGrandchildMap = {};
    adoptedOrphans.forEach(function(o) {
      if (!adoptedGrandchildMap[o.parent_bubble_id]) adoptedGrandchildMap[o.parent_bubble_id] = [];
      adoptedGrandchildMap[o.parent_bubble_id].push(o);
    });

    // 4. For child networks: fetch THEIR events (level 3)
    var lvl2NetIds = [];
    Object.values(childrenMap).forEach(function(kids) {
      kids.forEach(function(k) { if (k.type !== 'event' && k.type !== 'live') lvl2NetIds.push(k.id); });
    });
    // Also include true orphan network IDs and adopted orphan IDs for their children
    trueOrphans.forEach(function(o) { lvl2NetIds.push(o.id); });
    adoptedOrphans.forEach(function(o) { if (lvl2NetIds.indexOf(o.id) < 0) lvl2NetIds.push(o.id); });
    var lvl3Map = {};
    if (lvl2NetIds.length > 0) {
      var { data: lvl3 } = await sb.from('bubbles')
        .select('*, bubble_members(count)')
        .in('parent_bubble_id', lvl2NetIds)
        .eq('type', 'event')
        .order('event_date', { ascending: true, nullsFirst: false });
      if (_navVersion !== myNav) return;
      (lvl3 || []).forEach(function(e) {
        if (!lvl3Map[e.parent_bubble_id]) lvl3Map[e.parent_bubble_id] = [];
        lvl3Map[e.parent_bubble_id].push(e);
      });
    }

    // 5. Render F2 tree
    var now = new Date();
    var html = '';
    var _chevSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>';
    var _chevSm = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>';
    var _calIco = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>';
    var _netIco = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9.5" cy="9.5" r="6" opacity="0.85"/><circle cx="16" cy="13.5" r="4.5" opacity="0.6"/></svg>';
    var _netIcoSm = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9.5" cy="9.5" r="6" opacity="0.85"/><circle cx="16" cy="13.5" r="4.5" opacity="0.6"/></svg>';
    var _addIco = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>';

    // Bubble icon helper: shows icon_url if available, fallback to SVG
    function _bIco(b, fallback, r) {
      return b && b.icon_url
        ? '<img src="' + escHtml(b.icon_url) + '" style="width:100%;height:100%;object-fit:cover;border-radius:' + (r || '8') + 'px">'
        : fallback;
    }

    // ── Membership checkmark overlay (16px teal badge with subtle glow — Variant 2) ──
    var _memberCheck = '<div class="bb-mem-check"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><path d="M5 12.5l5 5L20 7"/></svg></div>';

    // ── Event time window check ──
    // Returns: 'before' | 'active' | 'after' | 'no_date'
    function _eventTimeWindow(ev) {
      if (!ev.event_date) return 'no_date';
      var start = new Date(ev.event_date);
      var end = ev.event_end_date ? new Date(ev.event_end_date) : new Date(start.getTime() + 24 * 60 * 60 * 1000);
      var windowStart = new Date(start.getTime() - 60 * 60 * 1000); // 1h before
      if (now < windowStart) return 'before';
      if (now > end) return 'after';
      return 'active';
    }

    // ── "Gå Live" button HTML for an event ──
    function _goLiveBtn(ev, isMember) {
      if (!isMember) return '';
      var mode = ev.checkin_mode || 'self';
      var win = _eventTimeWindow(ev);
      var isLiveHere = appMode.live && appMode.live.bubbleId === ev.id;
      if (isLiveHere) return '<span class="bb-pill bb-pill-live" style="margin-right:4px">LIVE</span>';
      if (mode === 'scan') return '<span class="bb-pill bb-pill-coming" style="margin-right:4px">' + t('live_scan_checkin') + '</span>';
      if (win === 'before') {
        var dateStr = new Date(ev.event_date).toLocaleDateString(_locale(), { day: 'numeric', month: 'short' });
        return '<span class="bb-pill bb-pill-coming" style="margin-right:4px">' + t('live_starts') + ' ' + dateStr + '</span>';
      }
      if (win === 'after') return '<span class="bb-pill bb-pill-past" style="margin-right:4px">' + t('live_ended') + '</span>';
      // Active window + self check-in — use new pink CTA button
      return '<button onclick="event.stopPropagation();quickGoLive(\'' + ev.id + '\',\'' + escHtml(ev.name).replace(/'/g,"\\'") + '\')" class="bb-go-live-btn">' + t('live_go_live') + '</button>';
    }

    // ── Accordion restore helper ──
    function _accState(accId) {
      return _bbAccordionOpen[accId] ? ' style="max-height:2000px;opacity:1"' : '';
    }
    function _accClass(accId) {
      return _bbAccordionOpen[accId] ? '' : ' collapsed';
    }
    function _togClass(accId) {
      return _bbAccordionOpen[accId] ? ' open' : '';
    }

    parentNets.forEach(function(net) {
      var kids = childrenMap[net.id] || [];
      var isOwner = net.created_by === currentUser.id;
      if (!isOwner) {
        kids = kids.filter(function(k) { return k.visibility !== 'hidden' || myIds.indexOf(k.id) >= 0; });
      }
      var childNets = kids.filter(function(k) { return k.type !== 'event' && k.type !== 'live'; });
      var childEvents = kids.filter(function(k) { return k.type === 'event' || k.type === 'live'; });
      var totalChildren = childNets.length + childEvents.length;
      var mc = net.member_count ?? net.bubble_members?.[0]?.count ?? 0;
      var badgeParts = [];
      if (childNets.length > 0) badgeParts.push(childNets.length + ' ' + t('bb_networks_count'));
      if (childEvents.length > 0) {
        var upN = childEvents.filter(function(e) { return e.event_date && new Date(e.event_date) >= now; }).length;
        badgeParts.push(upN > 0 ? upN + ' ' + t('bb_upcoming') : childEvents.length + ' ' + t('bb_events_count'));
      }
      var badgeText = badgeParts.join(' \u00B7 ');
      var accId = 'acc-' + net.id.slice(0, 8);

      // Root card
      html += '<div class="bb-accordion">';
      html += '<div class="bb-tree-root">';
      html += '<div class="bb-tree-root-ico">' + _bIco(net, _netIco, 9) + '</div>';
      html += '<div class="bb-tree-body" onclick="openBubbleChat(\'' + net.id + '\',\'screen-bubbles\')">';
      html += '<div style="font-size:0.8rem;font-weight:700">' + escHtml(net.name) + (pendingSet[net.id] ? ' <span class="pending-badge">Afventer</span>' : '') + '</div>';
      html += '<div style="font-size:0.62rem;color:var(--muted);display:flex;align-items:center;gap:3px;flex-wrap:wrap">' + visIcon(net.visibility) + mc + ' ' + t('bb_members') + (badgeText ? ' \u00B7 ' + badgeText : '') + '</div>';
      html += '</div>';
      html += _unreadDot(net.id);
      if (totalChildren > 0) {
        html += '<button class="bb-tree-toggle' + _togClass(accId) + '" id="tog-' + accId + '" onclick="event.stopPropagation();bbTreeToggle(\'' + accId + '\')">' + _chevSvg + '</button>';
      }
      html += '</div>';

      // Children
      if (totalChildren > 0) {
        html += '<div class="bb-tree-trunk' + _accClass(accId) + '" id="trunk-' + accId + '"' + _accState(accId) + '>';

        // Child networks (level 2)
        childNets.forEach(function(cn) {
          var cnMc = cn.member_count ?? cn.bubble_members?.[0]?.count ?? 0;
          var cnEvents = lvl3Map[cn.id] || [];
          var cnAdopted = adoptedGrandchildMap[cn.id] || [];
          var cnAccId = 'acc-' + cn.id.slice(0, 8);
          var isGhost = cn._isGhost || false;
          var isMember = myIds.indexOf(cn.id) >= 0;
          var hasChildren = cnEvents.length > 0 || cnAdopted.length > 0;

          html += '<div class="bb-tree-branch">';
          html += '<div class="bb-card-list' + (isGhost && !isMember ? ' is-ghost' : '') + '">';
          html += '<div class="bb-card-icon-sq icon-wrap">' + _bIco(cn, _netIcoSm, 8) + (isMember ? _memberCheck : '') + '</div>';
          html += '<div class="bb-card-text" onclick="event.stopPropagation();openBubbleChat(\'' + cn.id + '\',\'screen-bubbles\')">';
          html += '<div class="bb-card-title">' + escHtml(cn.name) + (pendingSet[cn.id] ? ' <span class="pending-badge">Afventer</span>' : '') + '</div>';
          html += '<div class="bb-card-meta">' + visIcon(cn.visibility) + '<span class="bb-card-meta-text">' + cnMc + ' ' + t('bb_members_short') + (cnEvents.length > 0 ? ' \u00B7 ' + cnEvents.length + ' ' + t('bb_events_count') : '') + '</span></div>';
          html += '</div>';
          html += _unreadDot(cn.id);
          if (hasChildren) {
            html += '<button class="bb-tree-toggle' + _togClass(cnAccId) + '" id="tog-' + cnAccId + '" onclick="event.stopPropagation();bbTreeToggle(\'' + cnAccId + '\')">' + _chevSm + '</button>';
          }
          html += '</div>';

          // Level 3: events + adopted grandchildren
          if (hasChildren) {
            html += '<div class="bb-tree-leaves' + _accClass(cnAccId) + '" id="trunk-' + cnAccId + '"' + _accState(cnAccId) + '>';

            // Adopted grandchildren (member networks nested under ghost parent)
            cnAdopted.forEach(function(gc) {
              var gcMc = gc.member_count ?? gc.bubble_members?.[0]?.count ?? 0;

              html += '<div class="bb-tree-leaf"><div class="bb-card-list" onclick="event.stopPropagation();openBubbleChat(\'' + gc.id + '\',\'screen-bubbles\')">';
              html += '<div class="bb-card-icon-sq icon-wrap">' + _bIco(cn, _netIcoSm, 8) + '</div>';
              html += '<div class="bb-card-text">';
              html += '<div class="bb-card-title">' + escHtml(gc.name) + '</div>';
              html += '<div class="bb-card-meta">' + visIcon(gc.visibility) + '<span class="bb-card-meta-text">' + gcMc + ' medl.</span></div>';
              html += '</div>';
              html += _unreadDot(gc.id) + '<div class="bb-card-chev">\u203A</div>';
              html += '</div></div>';
            });

            // Events
            cnEvents.forEach(function(ev) {
              var isPast = ev.event_date && new Date(ev.event_end_date || ev.event_date) < now;
              var evMc = ev.member_count ?? ev.bubble_members?.[0]?.count ?? 0;
              var dateStr = ev.event_date ? new Date(ev.event_date).toLocaleDateString(_locale(), { day: 'numeric', month: 'short' }) : '';
              var gcLive = (typeof currentLiveBubble !== 'undefined' && currentLiveBubble && currentLiveBubble.bubble_id === ev.id);
              var evIsMember = myIds.indexOf(ev.id) >= 0;
              html += '<div class="bb-tree-leaf"><div class="bb-card-list' + (isPast && !gcLive ? ' is-past' : '') + '" onclick="event.stopPropagation();openBubbleChat(\'' + ev.id + '\',\'screen-bubbles\')">';
              html += '<div class="bb-card-icon-sq icon-wrap is-event">' + _bIco(ev, _calIco, 6) + (evIsMember ? _memberCheck : '') + '</div>';
              html += '<div class="bb-card-text">';
              html += '<div class="bb-card-title">' + escHtml(ev.name) + '</div>';
              html += '<div class="bb-card-meta">' + visIcon(ev.visibility) + '<span class="bb-card-meta-text">' + dateStr + (evMc > 0 ? ' \u00B7 ' + evMc + ' ' + t('bb_attendees') : '') + '</span></div>';
              html += '</div>';
              html += _unreadDot(ev.id) + (_goLiveBtn(ev, evIsMember) || '<div class="bb-card-chev">\u203A</div>');
              html += '</div></div>';
            });
            if (isOwner) {
              html += '<div class="bb-tree-add" onclick="event.stopPropagation();openCreateEventFromBubble(\'' + cn.id + '\')">' + _addIco + ' ' + t('bb_create_event') + '</div>';
            }
            html += '</div>';
          }
          html += '</div>';
        });

        // Direct child events (level 2)
        childEvents.forEach(function(ev) {
          var isPast = ev.event_date && new Date(ev.event_end_date || ev.event_date) < now;
          var evMc = ev.member_count ?? ev.bubble_members?.[0]?.count ?? 0;
          var dateStr = ev.event_date ? new Date(ev.event_date).toLocaleDateString(_locale(), { day: 'numeric', month: 'short' }) : '';
          var evLive = (typeof currentLiveBubble !== 'undefined' && currentLiveBubble && currentLiveBubble.bubble_id === ev.id);
          var evIsMember = myIds.indexOf(ev.id) >= 0;
          html += '<div class="bb-tree-branch"><div class="bb-card-list' + (isPast && !evLive ? ' is-past' : '') + '" onclick="event.stopPropagation();openBubbleChat(\'' + ev.id + '\',\'screen-bubbles\')">';
          html += '<div class="bb-card-icon-sq icon-wrap is-event">' + _bIco(ev, _calIco, 6) + (evIsMember ? _memberCheck : '') + '</div>';
          html += '<div class="bb-card-text">';
          html += '<div class="bb-card-title">' + escHtml(ev.name) + '</div>';
          html += '<div class="bb-card-meta">' + visIcon(ev.visibility) + '<span class="bb-card-meta-text">' + dateStr + (evMc > 0 ? ' \u00B7 ' + evMc + ' ' + t('bb_attendees') : '') + '</span></div>';
          html += '</div>';
          html += _unreadDot(ev.id) + (_goLiveBtn(ev, evIsMember) || '<div class="bb-card-chev">\u203A</div>');
          html += '</div></div>';
        });

        if (isOwner) {
          html += '<div class="bb-tree-add" onclick="event.stopPropagation();openCreateEventFromBubble(\'' + net.id + '\')">' + _addIco + ' ' + t('bb_create_network_event') + '</div>';
        }
        html += '</div>';
      }
      html += '</div>';
    });

    // True orphans: ghost parent + member child
    trueOrphans.forEach(function(net) {
      var mc = net.member_count ?? net.bubble_members?.[0]?.count ?? 0;
      var ghost = ghostParentMap[net.parent_bubble_id];
      var ghostName = ghost ? ghost.name : '';
      var ghostMc = ghost ? (ghost.member_count ?? ghost.bubble_members?.[0]?.count ?? 0) : 0;
      var orphanEvents = lvl3Map[net.id] || [];
      var accId = 'acc-' + net.id.slice(0, 8);
      var isOwner = net.created_by === currentUser.id;

      html += '<div class="bb-accordion">';

      // Ghost parent as root (if available)
      if (ghost) {
        html += '<div class="bb-tree-root" style="opacity:0.55;border-style:dashed">';
        html += '<div class="bb-tree-root-ico">' + _bIco(ghost, _netIco, 9) + '</div>';
        html += '<div class="bb-tree-body">';
        html += '<div style="font-size:0.8rem;font-weight:700">' + escHtml(ghostName) + '</div>';
        html += '<div style="font-size:0.62rem;color:var(--muted);display:flex;align-items:center;gap:3px">' + visIcon(ghost.visibility) + ghostMc + ' ' + t('bb_members') + '</div>';
        html += '</div></div>';
        // Member child nested under ghost
        html += '<div class="bb-tree-trunk" style="max-height:2000px;opacity:1">';
        html += '<div class="bb-tree-branch">';
      }

      // The actual member network
      html += '<div class="bb-tree-' + (ghost ? 'net' : 'root') + '">';
      if (!ghost) html += '<div class="bb-tree-root-ico">' + _bIco(net, _netIco, 9) + '</div>';
      else html += '<div class="bb-tree-net-ico">' + _bIco(net, _netIcoSm, 8) + '</div>';
      html += '<div class="bb-tree-body" onclick="openBubbleChat(\'' + net.id + '\',\'screen-bubbles\')">';
      html += '<div style="font-size:' + (ghost ? '0.75rem' : '0.8rem') + ';font-weight:' + (ghost ? '600' : '700') + '">' + escHtml(net.name) + (pendingSet[net.id] ? ' <span class="pending-badge">Afventer</span>' : '') + '</div>';
      html += '<div style="font-size:' + (ghost ? '0.58' : '0.62') + 'rem;color:var(--muted);display:flex;align-items:center;gap:3px">' + visIcon(net.visibility) + mc + ' ' + t('bb_members') + '</div>';
      html += '</div>';
      html += _unreadDot(net.id);
      if (orphanEvents.length > 0) {
        html += '<button class="bb-tree-toggle' + _togClass(accId) + '" id="tog-' + accId + '" onclick="event.stopPropagation();bbTreeToggle(\'' + accId + '\')"' + (ghost ? ' style="width:24px;height:24px"' : '') + '>' + (ghost ? _chevSm : _chevSvg) + '</button>';
      }
      html += '</div>';

      if (orphanEvents.length > 0) {
        html += '<div class="bb-tree-leaves' + _accClass(accId) + '" id="trunk-' + accId + '"' + _accState(accId) + '>';
        orphanEvents.forEach(function(ev) {
          var isPast = ev.event_date && new Date(ev.event_end_date || ev.event_date) < now;
          var evMc = ev.member_count ?? ev.bubble_members?.[0]?.count ?? 0;
          var dateStr = ev.event_date ? new Date(ev.event_date).toLocaleDateString(_locale(), { day: 'numeric', month: 'short' }) : '';
          var evIsMember = myIds.indexOf(ev.id) >= 0;
          html += '<div class="bb-tree-leaf"><div class="bb-card-list' + (isPast ? ' is-past' : '') + '" onclick="event.stopPropagation();openBubbleChat(\'' + ev.id + '\',\'screen-bubbles\')">';
          html += '<div class="bb-card-icon-sq icon-wrap is-event">' + _bIco(ev, _calIco, 6) + (evIsMember ? _memberCheck : '') + '</div>';
          html += '<div class="bb-card-text">';
          html += '<div class="bb-card-title">' + escHtml(ev.name) + '</div>';
          html += '<div class="bb-card-meta">' + visIcon(ev.visibility) + '<span class="bb-card-meta-text">' + dateStr + (evMc > 0 ? ' \u00B7 ' + evMc + ' ' + t('bb_attendees') : '') + '</span></div>';
          html += '</div>';
          html += _unreadDot(ev.id) + (_goLiveBtn(ev, evIsMember) || '<div class="bb-card-chev">\u203A</div>');
          html += '</div></div>';
        });
        if (isOwner) {
          html += '<div class="bb-tree-add" onclick="event.stopPropagation();openCreateEventFromBubble(\'' + net.id + '\')">' + _addIco + ' ' + t('bb_create_event') + '</div>';
        }
        html += '</div>';
      }

      if (ghost) {
        html += '</div></div>'; // close bb-tree-branch + bb-tree-trunk
      }
      html += '</div>';
    });

    if (!html) {
      html = '<div class="empty-state" style="padding:2rem 0"><div class="empty-icon">' + icon('bubble') + '</div><div class="empty-text">Du er ikke med i nogen netv\u00E6rk endnu</div><div style="margin-top:1rem;display:flex;gap:0.5rem;justify-content:center"><button class="btn-primary" onclick="bbSwitchTab(\'explore\')" style="font-size:0.82rem;padding:0.6rem 1.2rem">Opdag netv\u00E6rk</button><button class="btn-secondary" onclick="bbSwitchSub(\'evt\')" style="font-size:0.82rem;padding:0.6rem 1.2rem">Se events</button></div></div>';
    }
    list.innerHTML = html;
    _renderSubTabDots();
  } catch(e) { logError("loadMyNetworks", e); showRetryState('bb-net-list', 'loadMyNetworks', 'Kunne ikke hente netv\u00E6rk'); }
}

function bbTreeToggle(accId) {
  var trunk = document.getElementById('trunk-' + accId);
  var tog = document.getElementById('tog-' + accId);
  if (!trunk) return;
  var isOpen = tog && tog.classList.contains('open');
  if (isOpen) {
    trunk.style.maxHeight = trunk.scrollHeight + 'px';
    requestAnimationFrame(function() {
      trunk.style.maxHeight = '0';
      trunk.style.opacity = '0';
    });
    trunk.classList.add('collapsed');
    if (tog) tog.classList.remove('open');
    _bbAccordionOpen[accId] = false;
  } else {
    trunk.classList.remove('collapsed');
    trunk.style.maxHeight = trunk.scrollHeight + 'px';
    trunk.style.opacity = '1';
    if (tog) tog.classList.add('open');
    setTimeout(function() { trunk.style.maxHeight = '2000px'; }, 300);
    _bbAccordionOpen[accId] = true;
  }
}

// ── Quick "Go Live" from bubble hierarchy ──
async function quickGoLive(bubbleId, bubbleName) {
  if (!currentUser) return;
  // If already live somewhere, confirm switch
  if (appMode.is('live') && appMode.live && appMode.live.bubbleId !== bubbleId) {
    if (!confirm(t('live_switch_confirm', { name: appMode.live.bubbleName || '' }))) return;
    try { await liveCheckout(); } catch(e) {}
  }
  try {
    await liveCheckin(bubbleId);
    // Re-render the bubble list to update button states
    if (_activeScreen === 'screen-bubbles') loadMyBubbles();
  } catch(e) {
    logError('quickGoLive', e);
    errorToast('checkin', e);
  }
}

// ── Chronological events list ──
async function loadMyEvents() {
  try {
    if (!currentUser) return;
    var myNav = _navVersion;
    var list = document.getElementById('bb-evt-list');
    if (!list) return;
    list.innerHTML = skelCards(3);

    var { data: memberships } = await sb.from('bubble_members').select('bubble_id, status, last_read_at').eq('user_id', currentUser.id);
    if (_navVersion !== myNav) return;
    var myIds = (memberships || []).map(function(m) { return m.bubble_id; });
    if (myIds.length === 0) {
      list.innerHTML = '<div class="empty-state" style="padding:2rem 0"><div class="empty-icon">' + icon('calendar') + '</div><div class="empty-text">'+t('bb_no_events')+'</div><div style="margin-top:1rem"><button class="btn-primary" onclick="bbSwitchTab(\'explore\')" style="font-size:0.82rem;padding:0.6rem 1.5rem">'+t('bb_discover_events')+'</button></div></div>';
      return;
    }

    var { data: events } = await sb.from('bubbles')
      .select('id, name, type, event_date, event_end_date, parent_bubble_id, location, visibility, icon_url')
      .in('id', myIds)
      .in('type', ['event', 'live'])
      .order('event_date', { ascending: true, nullsFirst: false });
    if (_navVersion !== myNav) return;

    if (!events || events.length === 0) {
      list.innerHTML = '<div class="empty-state" style="padding:2rem 0"><div class="empty-icon">' + icon('calendar') + '</div><div class="empty-text">'+t('bb_no_events')+'</div></div>';
      return;
    }

    var pIds = [...new Set(events.filter(function(e) { return e.parent_bubble_id; }).map(function(e) { return e.parent_bubble_id; }))];
    var parentMap = {};
    var gpMap = {};
    if (pIds.length > 0) {
      var { data: parents } = await sb.from('bubbles').select('id, name, parent_bubble_id').in('id', pIds);
      (parents || []).forEach(function(p) { parentMap[p.id] = p; });
      // Grandparent lookup
      var gpIds = (parents || []).filter(function(p) { return p.parent_bubble_id; }).map(function(p) { return p.parent_bubble_id; }).filter(function(v, i, a) { return a.indexOf(v) === i; });
      if (gpIds.length > 0) {
        var { data: gps } = await sb.from('bubbles').select('id, name').in('id', gpIds);
        (gps || []).forEach(function(g) { gpMap[g.id] = g.name; });
      }
    }

    var now = new Date();
    var upcoming = events.filter(function(e) { return !e.event_date || new Date(e.event_end_date || e.event_date) >= now; });
    var past = events.filter(function(e) { return e.event_date && new Date(e.event_end_date || e.event_date) < now; }).reverse();

    var html = '';
    if (upcoming.length > 0) {
      html += '<div style="font-size:0.68rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:0.4rem">'+t('misc_upcoming')+'</div>';
      html += upcoming.map(function(e) { return _bbEventCard(e, parentMap, gpMap, false); }).join('');
    }
    if (past.length > 0) {
      var accId = 'bb-past-events-acc';
      var isOpen = _bbAccordionOpen[accId] || false;
      html += '<div onclick="var c=this.nextElementSibling;var a=c.style.display===\'none\';c.style.display=a?\'block\':\'none\';this.querySelector(\'.bb-acc-chev\').style.transform=a?\'rotate(90deg)\':\'rotate(0)\';_bbAccordionOpen[\'' + accId + '\']=a" style="display:flex;align-items:center;gap:0.5rem;padding:0.6rem 0.2rem;margin-top:0.8rem;cursor:pointer;border-top:1px solid var(--glass-border)">' +
        '<span class="bb-acc-chev" style="transition:transform 0.2s;transform:' + (isOpen ? 'rotate(90deg)' : 'rotate(0)') + ';color:var(--muted);font-size:12px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg></span>' +
        '<span style="font-size:0.72rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.04em">' + t('misc_past') + ' (' + past.length + ')</span>' +
      '</div>';
      html += '<div style="display:' + (isOpen ? 'block' : 'none') + '">';
      html += past.map(function(e) { return _bbEventCard(e, parentMap, gpMap, true); }).join('');
      html += '</div>';
    }
    list.innerHTML = html;
  } catch(e) { logError("loadMyEvents", e); showRetryState('bb-evt-list', 'loadMyEvents', 'Kunne ikke hente events'); }
}

function _bbEventCard(e, parentMap, gpMap, isPast) {
  var evD = e.event_date ? new Date(e.event_date) : null;
  var dateStr = evD ? evD.toLocaleDateString(_locale(), { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  if (evD && evD.getHours() > 0) {
    dateStr += (_lang === 'da' ? ' kl. ' : ' at ') + evD.toLocaleTimeString(_locale(), { hour: '2-digit', minute: '2-digit' });
    if (e.event_end_date) dateStr += ' – ' + new Date(e.event_end_date).toLocaleTimeString(_locale(), { hour: '2-digit', minute: '2-digit' });
  }
  var parent = parentMap[e.parent_bubble_id];
  var parentName = parent ? parent.name : '';
  var gpName = (parent && parent.parent_bubble_id && gpMap[parent.parent_bubble_id]) ? gpMap[parent.parent_bubble_id] : '';
  var breadcrumb = '';
  if (gpName && parentName) {
    breadcrumb = '<div class="bb-breadcrumb"><span class="bb-bc-pill">' + escHtml(gpName) + '</span><span class="bb-bc-chev">\u203A</span><span class="bb-bc-pill2">' + escHtml(parentName) + '</span></div>';
  } else if (parentName) {
    breadcrumb = '<div class="bb-breadcrumb"><span class="bb-bc-pill">' + escHtml(parentName) + '</span></div>';
  }
  var evCardLive = (typeof currentLiveBubble !== 'undefined' && currentLiveBubble && currentLiveBubble.bubble_id === e.id);
  // User is always member of events shown on Mine/Events tab — show checkmark
  var memCheck = '<div class="bb-mem-check"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><path d="M5 12.5l5 5L20 7"/></svg></div>';
  return '<div class="bb-card-list' + (isPast && !evCardLive ? ' is-past' : '') + '" data-action="openBubble" data-id="' + e.id + '">' +
    '<div class="bb-card-icon-sq icon-wrap is-event">' + (e.icon_url ? '<img src="' + escHtml(e.icon_url) + '" style="width:100%;height:100%;object-fit:cover;border-radius:6px">' : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>') + memCheck + '</div>' +
    '<div class="bb-card-text">' +
    breadcrumb +
    '<div class="bb-card-title">' + escHtml(e.name) + '</div>' +
    '<div class="bb-card-meta">' + visIcon(e.visibility) + '<span class="bb-card-meta-text">' + dateStr + '</span></div>' +
    '</div>' + _unreadDot(e.id) + '<div class="bb-card-chev">\u203A</div></div>';
}
// ══════════════════════════════════════════════════════════
//  TOP MATCHES — "Vigtigste personer du bør møde"
// ══════════════════════════════════════════════════════════
async function loadTopMatches() {
  try {
    var container = document.getElementById('home-top-matches');
    var list = document.getElementById('home-top-matches-list');
    if (!container || !list || !currentProfile || !currentUser) return;

    var myKw = (currentProfile.keywords || []).map(function(k) { return k.toLowerCase(); });
    if (myKw.length === 0) { container.style.display = 'none'; return; }

    // Get user's bubbles
    var { data: myBubbles } = await sb.from('bubble_members')
      .select('bubble_id').eq('user_id', currentUser.id);
    var bubbleIds = (myBubbles || []).map(function(m) { return m.bubble_id; });
    if (bubbleIds.length === 0) { container.style.display = 'none'; return; }

    // Get other members with profiles (limit 50 for perf)
    var { data: others } = await sb.from('bubble_members')
      .select('user_id, profiles(id, name, title, workplace, keywords, avatar_url)')
      .in('bubble_id', bubbleIds)
      .neq('user_id', currentUser.id)
      .limit(50);

    if (!others || others.length === 0) { container.style.display = 'none'; return; }

    // Deduplicate by user_id
    var seen = {};
    var unique = [];
    others.forEach(function(m) {
      if (!seen[m.user_id] && m.profiles) { seen[m.user_id] = true; unique.push(m.profiles); }
    });

    // Score using same algorithm as radar (calcMatchScore)
    var scored = unique.map(function(p) {
      var theirKw = (p.keywords || []).map(function(k) { return k.toLowerCase(); });
      var shared = myKw.filter(function(k) { return theirKw.indexOf(k) >= 0; });
      var score = (typeof calcMatchScore === 'function')
        ? calcMatchScore(currentProfile, p, 1)
        : (myKw.length > 0 ? Math.round((shared.length / Math.max(myKw.length, theirKw.length)) * 100) : 0);
      return { profile: p, shared: shared, score: score };
    }).filter(function(s) { return s.score > 15; })
      .sort(function(a, b) { return b.score - a.score; })
      .slice(0, 5);

    if (scored.length === 0) { container.style.display = 'none'; return; }

    // Render
    var avColors = ['linear-gradient(135deg,#2ECFCF,#22B8CF)','linear-gradient(135deg,#6366F1,#7C5CFC)','linear-gradient(135deg,#E879A8,#EC4899)','linear-gradient(135deg,#F59E0B,#EAB308)','linear-gradient(135deg,#1A9E8E,#10B981)'];

    list.innerHTML = scored.map(function(s, i) {
      var p = s.profile;
      var ini = (p.name||'?').split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();
      var avHtml = p.avatar_url ?
        '<div style="width:40px;height:40px;border-radius:50%;overflow:hidden;flex-shrink:0;border:2px solid rgba(124,92,252,0.15)"><img src="' + escHtml(p.avatar_url) + '" style="width:100%;height:100%;object-fit:cover"></div>' :
        '<div style="width:40px;height:40px;border-radius:50%;background:' + avColors[i % 5] + ';display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700;color:white;flex-shrink:0">' + ini + '</div>';

      var sharedTags = s.shared.slice(0, 3).map(function(t) {
        return '<span style="font-size:0.58rem;padding:0.1rem 0.4rem;background:rgba(124,92,252,0.06);color:var(--accent);border-radius:99px;font-weight:600">' + escHtml(t) + '</span>';
      }).join('');

      return '<div style="background:var(--glass-bg-strong);border:1px solid var(--glass-border-subtle);border-radius:12px;padding:0.6rem 0.75rem;display:flex;align-items:center;gap:0.65rem;cursor:pointer" onclick="openPerson(\'' + p.id + '\',\'screen-home\')">' +
        avHtml +
        '<div style="flex:1;min-width:0">' +
          '<div style="display:flex;align-items:center;gap:0.4rem">' +
            '<div style="font-size:0.82rem;font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escHtml(p.name || '?') + '</div>' +
            matchBadgeHtml(s.score) +
          '</div>' +
          '<div style="font-size:0.68rem;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escHtml(p.title || '') + (p.workplace ? ' \u00b7 ' + escHtml(p.workplace) : '') + '</div>' +
          '<div style="display:flex;gap:0.2rem;margin-top:0.2rem;flex-wrap:wrap">' + sharedTags + '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    container.style.display = 'block';
  } catch(e) { logError('loadTopMatches', e); }
}

function bubbleCard(b, joined) {
  // Visibility pill (always shown — encodes synlighed)
  var visClass = b.visibility === 'open' ? 'bb-pill-open'
               : b.visibility === 'hidden' ? 'bb-pill-hidden'
               : 'bb-pill-private';
  var visLabel = b.visibility === 'open' ? (t('bb_open') || 'Åben')
                : b.visibility === 'hidden' ? (t('bb_hidden') || 'Skjult')
                : (t('bb_private') || 'Privat');

  // Icon — squircle (8px radius) with type-tinted background if no logo
  var isEvent = b.type === 'event' || b.type === 'live';
  var iconClass = isEvent ? 'bb-card-icon-sq is-event' : 'bb-card-icon-sq';
  var iconInner;
  if (b.icon_url) {
    iconInner = '<img src="' + escHtml(b.icon_url) + '" alt="">';
  } else {
    iconInner = isEvent
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9.5" cy="9.5" r="6"/><circle cx="16" cy="13.5" r="4.5"/></svg>';
  }

  // Status badge — state of the bubble (placed inline with title)
  // Computed BEFORE meta so we can also set is-past on the card
  var isPast = false;
  var statusBadge = '';
  if (isEvent && b.event_date) {
    var endTime = new Date(b.event_end_date || b.event_date);
    var startTime = new Date(b.event_date);
    var now = new Date();
    if (endTime < now) {
      isPast = true;
      statusBadge = ' <span class="bb-pill bb-pill-past">' + (t('bb_status_past') || 'Afsluttet') + '</span>';
    } else if (startTime <= now && endTime >= now) {
      // Currently live
      statusBadge = ' <span class="bb-pill bb-pill-live">' + (t('bb_status_live') || 'Live nu') + '</span>';
    }
  }
  // Pending membership status (overrides past — relevant even for past events)
  if (b._pending) {
    statusBadge = ' <span class="bb-pill bb-pill-pending">' + (t('bb_status_pending') || 'Afventer') + '</span>';
  }

  // Meta line — pill + dot-separated info (members, location, event date)
  var metaParts = [];
  var memberCount = b.member_count || 0;
  if (memberCount > 0) {
    metaParts.push(memberCount + ' ' + (memberCount === 1 ? (t('bb_member') || 'medlem') : (t('bb_members') || 'medlemmer')));
  }
  if (b.location && !isEvent) metaParts.push(escHtml(b.location));

  // Event date for events — formatted nicely on meta line
  if (isEvent && b.event_date) {
    var evD2 = new Date(b.event_date);
    var evDateStr = evD2.toLocaleDateString(_locale(), { weekday: 'short', day: 'numeric', month: 'short' }) +
      (evD2.getHours() > 0 ? (_lang === 'da' ? ' kl. ' : ' at ') + evD2.toLocaleTimeString(_locale(), { hour: '2-digit', minute: '2-digit' }) : '');
    metaParts.push(evDateStr);
  }

  // Child counts (Opdag tab) — replace location/members with breakdown
  if (b._childNetCount > 0 || b._childEventCount > 0) {
    var childParts = [];
    if (b._childNetCount > 0) childParts.push(b._childNetCount + ' netværk');
    if (b._childEventCount > 0) childParts.push(b._childEventCount + ' event' + (b._childEventCount > 1 ? 's' : ''));
    metaParts = childParts;
  }

  var metaText = metaParts.join(' · ');

  // Card class — adds is-past for dimmed past events
  var cardClass = 'bb-card-list' + (isPast ? ' is-past' : '');

  // Breadcrumb (Variant A) — shown above title when bubble has a parent
  // Format: "Grandparent › Parent" or just "Parent"
  var breadcrumb = '';
  if (b._grandparentName && b._parentName) {
    breadcrumb = '<div class="bb-breadcrumb">' +
      '<span class="bb-bc-pill">' + escHtml(b._grandparentName) + '</span>' +
      '<span class="bb-bc-chev">›</span>' +
      '<span class="bb-bc-pill2">' + escHtml(b._parentName) + '</span>' +
    '</div>';
  } else if (b._parentName) {
    breadcrumb = '<div class="bb-breadcrumb">' +
      '<span class="bb-bc-pill">' + escHtml(b._parentName) + '</span>' +
    '</div>';
  }

  return '<div class="' + cardClass + '" data-action="openBubble" data-id="' + b.id + '">' +
    '<div class="' + iconClass + '">' + iconInner + '</div>' +
    '<div class="bb-card-text">' +
      breadcrumb +
      '<div class="bb-card-title">' + escHtml(b.name) + statusBadge + '</div>' +
      '<div class="bb-card-meta">' +
        '<span class="bb-pill ' + visClass + '">' + visLabel + '</span>' +
        (metaText ? '<span class="bb-card-meta-text">' + metaText + '</span>' : '') +
      '</div>' +
    '</div>' +
    '<div class="bb-card-chev">›</div>' +
  '</div>';
}


// ══════════════════════════════════════════════════════════
//  HOME SCREEN CUSTOMIZATION
// ══════════════════════════════════════════════════════════

function hsGetPrefs() {
  try {
    var stored = localStorage.getItem('bubble_hs_prefs');
    if (stored) return JSON.parse(stored);
  } catch(e) {}
  return Object.assign({}, hsDefaults);
}

function hsSavePrefs(prefs) {
  try { localStorage.setItem('bubble_hs_prefs', JSON.stringify(prefs)); } catch(e) {}
}

function hsUpdatePreview() {
  var prefs = hsGetPrefs();
  var labels = { live: 'Live', saved: 'Gemte', bubbles: 'Bobler', notifs: 'Notif.', radar: 'Radar' };
  var active = [];
  ['live','saved','bubbles','notifs','radar'].forEach(function(key) {
    if (prefs[key]) active.push(labels[key]);
  });
  var el = document.getElementById('hs-preview-text');
  if (el) el.textContent = active.length > 0 ? 'Viser: ' + active.join(' \u00b7 ') : 'Alt er slået fra';
}


function hsToggle(key) {
  var prefs = hsGetPrefs();
  prefs[key] = !prefs[key];
  hsSavePrefs(prefs);
  hsUpdateToggleUI(key, prefs[key]);
  hsApplyToHome();
  hsUpdatePreview();
}

function hsUpdateToggleUI(key, isOn) {
  var el = document.getElementById('hs-toggle-' + key);
  if (el) el.setAttribute('data-on', isOn ? 'true' : 'false');
}

function hsUpdateAllToggles() {
  var prefs = hsGetPrefs();
  ['saved','nudge','feedback','profile_cta'].forEach(function(key) {
    hsUpdateToggleUI(key, prefs[key] !== false);
  });
  hsUpdatePreview();
}

function hsApplyToHome() {
  var prefs = hsGetPrefs();
  // v5.2: toggle keys are saved, nudge, feedback. Radar is always visible.
  ['saved','nudge','feedback','profile_cta'].forEach(function(key) {
    var els = document.querySelectorAll('[data-hs="' + key + '"]');
    els.forEach(function(el) {
      if (prefs[key] !== false) {
        el.removeAttribute('data-hs-hidden');
      } else {
        el.setAttribute('data-hs-hidden', 'true');
      }
    });
  });
}





function updateAnonToggle() {
  var toggle = document.getElementById('anon-toggle');
  var knob = document.getElementById('anon-knob');
  if (!toggle || !knob) return;
  toggle.style.background = isAnon ? 'var(--accent)' : 'var(--border)';
  knob.style.background = isAnon ? 'white' : 'var(--muted)';
  knob.style.left = isAnon ? '23px' : '3px';
}

// ══════════════════════════════════════════════════════════
//  HOME DARTBOARD — data loader + renderer
// ══════════════════════════════════════════════════════════
var _homeDartboardProfiles = [];
var _homeRadarFilter = 'all';
var _dartboardDataLoaded = false;
var _renderDartboardTimer = null;

async function loadHomeDartboardData() {
  try {
    if (!currentUser || !currentProfile) return;

    var { data: allProfiles } = await sb.from('profiles')
      .select('id,name,title,keywords,dynamic_keywords,bio,linkedin,is_anon,avatar_url')
      .neq('id', currentUser.id).neq('banned', true).limit(200);
    if (!allProfiles || allProfiles.length === 0) {
      _dartboardDataLoaded = true;
      if (_homeViewMode !== 'live') renderHomeDartboard();
      return;
    }

    var savedIds = [];
    try {
      var { data: savedRes } = await sb.from('saved_contacts').select('contact_id').eq('user_id', currentUser.id);
      savedIds = (savedRes || []).map(function(s) { return s.contact_id; });
    } catch(e) {}
    allProfiles = allProfiles.filter(function(p) { return savedIds.indexOf(p.id) < 0 && !(typeof isBlocked === 'function' && isBlocked(p.id)); });

    if (typeof buildTagPopularity === 'function') buildTagPopularity(allProfiles);

    var bmMap = {};
    try {
      var { data: myBubbles } = await sb.from('bubble_members').select('bubble_id').eq('user_id', currentUser.id);
      var myBubbleIds = (myBubbles || []).map(function(m) { return m.bubble_id; });
      if (myBubbleIds.length > 0) {
        var { data: allBm } = await sb.from('bubble_members').select('user_id,bubble_id').in('bubble_id', myBubbleIds);
        (allBm || []).forEach(function(bm) { if (!bmMap[bm.user_id]) bmMap[bm.user_id] = []; bmMap[bm.user_id].push(bm.bubble_id); });
      }
    } catch(e) {}

    var scored = allProfiles.map(function(p) {
      var sharedBubbles = (bmMap[p.id] || []).length;
      var matchScore = (typeof calcMatchScore === 'function') ? calcMatchScore(currentProfile, p, sharedBubbles) : 0;
      return { id:p.id, name:p.name, title:p.title, keywords:p.keywords, is_anon:p.is_anon, bio:p.bio, linkedin:p.linkedin, avatar_url:p.avatar_url, matchScore:matchScore, sharedBubbles:sharedBubbles };
    }).sort(function(a,b) { return b.matchScore - a.matchScore; });

    // Store all profiles for 'all' mode — but don't overwrite live dartboard
    proxAllProfiles = scored;
    _dartboardDataLoaded = true;
    if (_homeViewMode !== 'live') {
      _homeDartboardProfiles = scored;
      renderHomeDartboard();
    }
  } catch(e) { logError('loadHomeDartboardData', e); }
}

// ── Get filtered profiles based on active filter ──
function _getFilteredProfiles() {
  // In live mode, ONLY use event dartboard profiles — never fall back to all
  if (_homeViewMode === 'live') return _homeDartboardProfiles;
  var allP = proxAllProfiles || [];
  if (_homeRadarFilter === 'all') return allP;
  if (_homeRadarFilter === 'live') {
    var liveIds = appMode.checkedInIds;
    return allP.filter(function(p) { return liveIds.indexOf(p.id) >= 0; });
  }
  if (_homeRadarFilter === 'interest') return allP.filter(function(p) { return p.matchScore >= 20; });
  if (_homeRadarFilter === 'good') return allP.filter(function(p) { return p.matchScore >= 40; });
  if (_homeRadarFilter === 'strong') return allP.filter(function(p) { return p.matchScore >= 60; });
  return allP;
}

// ── Filter chip handler ──
function filterRadarHome(filter) {
  _homeRadarFilter = filter;
  document.querySelectorAll('.radar-filter-chip').forEach(function(c) {
    c.classList.toggle('active', c.dataset.filter === filter);
  });
  renderHomeDartboard();
  updateFilterChipStyle();
}

// ── Tap dartboard background → open tray ──
function onDartboardTap(event) {
  // If the tap was on a dot (person avatar), don't open tray — the dot handles it
  var target = event.target;
  while (target && target !== event.currentTarget) {
    if (target.onclick && target !== event.currentTarget) return; // clicked a dot
    target = target.parentElement;
  }
  openHomeTray();
}

function _homeDrawProxRings(canvas) {
  if (!canvas) return;
  var par = canvas.parentElement; if (!par) return;
  var w = par.offsetWidth || 300, h = par.offsetHeight || w;
  canvas.width = w*2; canvas.height = h*2; canvas.style.width = w+'px'; canvas.style.height = h+'px';
  var ctx = canvas.getContext('2d'); ctx.scale(2,2); ctx.clearRect(0,0,w,h);
  var cx = w/2, cy = h/2, maxR = Math.min(cx,cy);
  var zones = [
    {r:0.10,fill:'rgba(124,92,252,0.18)'},{r:0.26,fill:'rgba(124,92,252,0.10)'},
    {r:0.42,fill:'rgba(46,207,207,0.08)'},{r:0.58,fill:'rgba(107,139,255,0.06)'},
    {r:0.74,fill:'rgba(139,92,246,0.04)'},{r:0.90,fill:'rgba(124,92,252,0.02)'}
  ];
  for (var i = zones.length-1; i >= 0; i--) {
    ctx.beginPath(); ctx.arc(cx,cy,zones[i].r*maxR,0,Math.PI*2);
    ctx.fillStyle = zones[i].fill; ctx.fill();
  }
  for (var i = 0; i < zones.length; i++) {
    ctx.beginPath(); ctx.arc(cx,cy,zones[i].r*maxR,0,Math.PI*2);
    ctx.strokeStyle = 'rgba(30,27,46,0.08)'; ctx.lineWidth = 1; ctx.stroke();
  }
  var g = ctx.createRadialGradient(cx,cy,0,cx,cy,zones[0].r*maxR);
  g.addColorStop(0,'rgba(124,92,252,0.12)'); g.addColorStop(1,'rgba(124,92,252,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx,cy,zones[0].r*maxR,0,Math.PI*2); ctx.fill();
}

function renderHomeDartboard() {
  // Debounce: koalescer alle kald inden for samme event loop tick til ét render.
  // Løser dobbelt-render race condition mellem loadLiveBanner + loadHomeDartboardData.
  clearTimeout(_renderDartboardTimer);
  _renderDartboardTimer = setTimeout(_doRenderHomeDartboard, 0);
}

function _doRenderHomeDartboard() {
  var canvas  = document.getElementById('home-prox-canvas');
  var av      = document.getElementById('home-prox-avatars');
  var ce      = document.getElementById('home-prox-center');
  var spinner = document.getElementById('home-radar-spinner');
  var countEl = document.getElementById('radar-count-home');
  if (!av) return;

  if (spinner) spinner.style.display = 'none';

  var filtered = _getFilteredProfiles();
  var profiles = filtered.slice(0, 25);
  var total = filtered.length;
  if (countEl) countEl.textContent = total > 0 ? '· ' + total : '';

  _homeDrawProxRings(canvas);

  if (ce) {
    ce.style.display = 'flex';
    if (currentProfile && currentProfile.avatar_url) {
      ce.innerHTML = '<img src="' + escHtml(currentProfile.avatar_url) + '">';
    } else {
      var ini = (currentProfile && currentProfile.name)
        ? currentProfile.name.split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase()
        : 'DU';
      ce.textContent = ini;
    }
    // Re-trigger dripCenter animation ved hver render
    ce.style.animation = 'none';
    void ce.offsetHeight; // reflow
    ce.style.animation = '';
  }

  if (profiles.length === 0) {
    av.innerHTML = '';
    // Don't show empty state until data has actually loaded — prevents flash
    if (!_dartboardDataLoaded) return;
    if (_homeViewMode === 'live') {
      av.innerHTML = '<div class="dartboard-empty" style="position:absolute;top:50%;left:50%;transform:translate(-50%, calc(-100% - 40px));text-align:center;padding:0.6rem 1.2rem;background:rgba(255,255,255,0.85);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border-radius:12px;border:1px solid var(--glass-border-subtle);box-shadow:0 2px 8px rgba(30,27,46,0.06);white-space:nowrap">' +
        '<div style="font-size:0.78rem;font-weight:600;color:var(--text)">' + t('home_first_here') + '</div>' +
        '<div style="font-size:0.68rem;color:var(--muted);margin-top:0.15rem">' + t('home_waiting') + '</div>' +
        '</div>';
    } else if (_homeRadarFilter !== 'all') {
      showDartboardEmpty(_homeRadarFilter);
    } else {
      av.innerHTML = '<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:0 2rem">' +
        '<div style="font-size:0.82rem;font-weight:700;color:var(--text)">' + t('home_radar_empty') + '</div>' +
        '<div style="font-size:0.72rem;color:var(--muted);text-align:center;line-height:1.4">' + t('home_radar_empty_desc') + '</div>' +
        '<button class="btn-primary" onclick="bbSwitchTab(\'explore\');goTo(\'screen-bubbles\')" style="font-size:0.75rem;padding:0.5rem 1.2rem;margin-top:6px">' + t('home_discover_networks') + '</button>' +
        '</div>';
    }
    return;
  }
  // Clear any empty state
  var emptyEl = av.querySelector('.dartboard-empty');
  if (emptyEl) emptyEl.remove();

  var map = canvas ? canvas.parentElement : null;
  var w = map ? (map.offsetWidth || 300) : 300;
  var h = map ? (map.offsetHeight || w) : w;
  var cx = w/2, cy = h/2, maxR = Math.min(cx,cy) - 24;

  var colors = (typeof proxColors !== 'undefined' && proxColors) ? proxColors : [
    'linear-gradient(135deg,#2ECFCF,#22B8CF)','linear-gradient(135deg,#6366F1,#7C5CFC)',
    'linear-gradient(135deg,#E879A8,#EC4899)','linear-gradient(135deg,#F59E0B,#EAB308)',
    'linear-gradient(135deg,#1A9E8E,#10B981)','linear-gradient(135deg,#8B5CF6,#A855F7)',
    'linear-gradient(135deg,#3B82F6,#6366F1)','linear-gradient(135deg,#EF4444,#F97316)',
    'linear-gradient(135deg,#06B6D4,#0EA5E9)','linear-gradient(135deg,#D946EF,#C026D3)'
  ];

  var placed = [];
  function findSafe(ix, iy, sz) {
    var hs = sz/2, tx = ix, ty = iy;
    for (var a = 0; a < 12; a++) {
      var hit = false;
      for (var j = 0; j < placed.length; j++) {
        var dx = (tx+hs)-(placed[j].x+placed[j].s/2), dy = (ty+hs)-(placed[j].y+placed[j].s/2);
        if (Math.sqrt(dx*dx+dy*dy) < (hs+placed[j].s/2)+3) { hit = true; break; }
      }
      if (!hit) return {x:tx,y:ty};
      var na = Math.atan2(ty+hs-cy,tx+hs-cx) + a*0.5;
      tx = ix + Math.cos(na)*(8+a*5); ty = iy + Math.sin(na)*(8+a*5);
    }
    return {x:tx,y:ty};
  }

  var out = '';
  for (var i = 0; i < profiles.length; i++) {
    var p = profiles[i];
    var matchPct = p.matchScore || 0;
    var dist = 0.14 + (1 - matchPct/100) * (0.88 - 0.14);
    var r = dist * maxR;
    var ang = (i * 2.399) + (matchPct * 0.03);
    var sz = matchPct >= 70 ? 38 : matchPct >= 40 ? 34 : 30;
    var ix = cx + Math.cos(ang)*r - sz/2, iy = cy + Math.sin(ang)*r - sz/2;
    var pos = findSafe(ix, iy, sz);
    placed.push({x:pos.x,y:pos.y,s:sz});
    var col = p.is_anon ? 'var(--glass-border)' : colors[i % colors.length];
    var ini = p.is_anon ? '?' : (p.name||'?').split(' ').map(function(x){return x[0];}).join('').slice(0,2).toUpperCase();
    var inner = (p.avatar_url && !p.is_anon)
      ? '<img src="' + escHtml(p.avatar_url) + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%">'
      : ini;
    var liveIds = appMode.checkedInIds;
    var dripDelay = (i * 40);
    out += '<div class="prox-dot" style="width:'+sz+'px;height:'+sz+'px;left:'+pos.x.toFixed(1)+'px;top:'+pos.y.toFixed(1)+'px;background:'+col+';font-size:'+(sz<34?'0.48':'0.55')+'rem;animation-delay:'+dripDelay+'ms" onclick="event.stopPropagation();openRadarPerson(\''+p.id+'\')" data-id="'+p.id+'">'+inner+(liveIds.indexOf(p.id)>=0?'<span class="live-dot" style="position:absolute;bottom:-1px;right:-1px;width:8px;height:8px;border:2px solid var(--bg)"></span>':'')+'</div>';
  }
  av.innerHTML = out;
}

// ══════════════════════════════════════════════════════════
//  HOME LIST TRAY
// ══════════════════════════════════════════════════════════
function openHomeTray() {
  var backdrop = document.getElementById('home-tray-backdrop');
  var tray = document.getElementById('home-tray');
  if (!backdrop || !tray) return;
  backdrop.style.display = 'block';
  tray.style.visibility = 'visible';
  void tray.offsetHeight;
  tray.style.transform = 'translateY(0)';
  renderHomeTrayList();
}

function closeHomeTray() {
  var backdrop = document.getElementById('home-tray-backdrop');
  var tray = document.getElementById('home-tray');
  if (backdrop) backdrop.style.display = 'none';
  if (tray) { tray.style.transform = 'translateY(100%)'; setTimeout(function() { tray.style.visibility = 'hidden'; }, 350); }
}

function renderHomeTrayList() {
  var list = document.getElementById('home-tray-list');
  var subtitle = document.getElementById('home-tray-subtitle');
  if (!list) return;

  var sorted = _getFilteredProfiles().slice().sort(function(a, b) { return (b.matchScore || 0) - (a.matchScore || 0); });
  if (subtitle) subtitle.textContent = sorted.length + ' personer';

  if (sorted.length === 0) {
    list.innerHTML = '<div style="text-align:center;padding:2rem 0;font-size:0.78rem;color:var(--muted)">Ingen matches' + (_homeRadarFilter !== 'all' ? ' i denne kategori' : '') + '</div>';
    return;
  }

  var colors = proxColors || ['linear-gradient(135deg,#6366F1,#7C5CFC)'];
  list.innerHTML = sorted.map(function(p, i) {
    var name = p.is_anon ? 'Anonym' : (p.name || '?');
    var ini = name.split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();
    var col = p.is_anon ? 'var(--glass-border)' : colors[i % colors.length];
    var ml = matchLabel(p.matchScore || 0);
    var avHtml = p.avatar_url && !p.is_anon
      ? '<div style="width:40px;height:40px;border-radius:50%;overflow:hidden;flex-shrink:0"><img src="' + escHtml(p.avatar_url) + '" style="width:100%;height:100%;object-fit:cover"></div>'
      : '<div style="width:40px;height:40px;border-radius:50%;background:' + col + ';display:flex;align-items:center;justify-content:center;font-size:0.72rem;font-weight:700;color:white;flex-shrink:0">' + escHtml(ini) + '</div>';
    return '<div onclick="openRadarPerson(\'' + p.id + '\')" style="display:flex;align-items:center;gap:0.75rem;padding:0.7rem 0.85rem;margin-bottom:0.4rem;border-radius:14px;background:#FFFFFF;border:1px solid rgba(216,213,228,0.4);box-shadow:0 1px 3px rgba(30,27,46,0.03);cursor:pointer;transition:transform 0.3s cubic-bezier(0.34,1.56,0.64,1);-webkit-tap-highlight-color:transparent" ontouchstart="this.style.transform=\'scale(0.97)\'" ontouchend="this.style.transform=\'scale(1)\'">' +
      avHtml +
      '<div style="flex:1;min-width:0">' +
        '<div style="display:flex;align-items:center;gap:0.4rem">' +
          '<span style="font-weight:700;font-size:0.85rem">' + escHtml(name) + '</span>' +
          (ml.text ? matchBadgeHtml(p.matchScore || 0) : '') +
        '</div>' +
        '<div style="font-size:0.72rem;color:var(--text-secondary);margin-top:0.15rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escHtml(p.title || '') + (p.workplace ? ' · ' + escHtml(p.workplace) : '') + '</div>' +
      '</div>' +
      '<span style="color:var(--muted);font-size:0.9rem;opacity:0.3">›</span>' +
    '</div>';
  }).join('');
}

// ══════════════════════════════════════════════════════════
//  HOME BUBBLE PILLS (horizontal scroll)
// ══════════════════════════════════════════════════════════

