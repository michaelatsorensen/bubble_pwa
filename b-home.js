// ══════════════════════════════════════════════════════════
//  BUBBLE — HOME SCREEN + DASHBOARD + CUSTOMIZATION
//  DOMAIN: home
//  OWNS: _homeDartboardProfiles, _homeRadarFilter
//  OWNS: loadHome, loadLiveBanner, homeSetMode, loadEventDartboard, renderHomeDartboard, filterRadarHome
//  READS: currentUser, currentProfile, currentLiveBubble, proxAllProfiles
//  Auto-split from app.js · v3.7.0
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
//  HOME
// ══════════════════════════════════════════════════════════

// ── Live context: set when user is checked into an event ──
var _homeLiveContext = null; // DEPRECATED — use appMode.live instead
var _homeViewMode = 'all'; // UI tab toggle: 'all' or 'live'

async function loadHome() {
  try {
    if (!currentUser) return;
    if (!currentProfile) await loadCurrentProfile();
    updateHomeAvatar();

    // Greeting
    const nameEl = document.getElementById('home-greeting-name');
    if (nameEl && currentProfile?.name) {
      var hour = new Date().getHours();
      var greetText = hour < 5 ? 'God nat' : hour < 12 ? 'Godmorgen' : hour < 17 ? 'Goddag' : hour < 22 ? 'God aften' : 'God nat';
      var greetLabel = nameEl?.previousElementSibling;
      if (greetLabel) greetLabel.textContent = greetText + ',';
      nameEl.innerHTML = escHtml(currentProfile.name.split(' ')[0]) + '<span style="display:inline-flex;width:1.3rem;height:1.3rem">' + ico('wave') + '</span>';
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
    showProfileSetupCTA();
  } catch(e) { logError("loadHome", e); }
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
      if (banner) banner.style.display = 'none';
      homeSetMode('all');
    }
  } catch(e) {
    logError('loadLiveBanner', e);
    appMode.set('normal');
    if (tabs) tabs.style.display = 'none';
    if (banner) banner.style.display = 'none';
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
    renderHomeDartboard();
  }

  // Live banner stays visible in BOTH modes as long as checked in
  if (banner && ctx) {
    banner.style.display = 'block';
    var nameEl = document.getElementById('home-live-banner-name');
    var countEl = document.getElementById('home-live-banner-count');
    if (nameEl) nameEl.textContent = ctx.bubbleName;
    if (countEl) countEl.textContent = ctx.memberCount + ' her nu';
  } else if (banner) {
    banner.style.display = 'none';
  }

  // Update checkout tray info
  if (ctx) {
    var coName = document.getElementById('live-checkout-name');
    var coMeta = document.getElementById('live-checkout-meta');
    if (coName) coName.textContent = ctx.bubbleName;
    if (coMeta) coMeta.textContent = 'Checked ind · udløber kl. ' + (ctx.expiryStr || '—');
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
  void tray.offsetHeight;
  tray.style.transform = 'translateY(0)';
}
function closeLiveCheckoutTray() {
  var backdrop = document.getElementById('live-checkout-backdrop');
  var tray = document.getElementById('live-checkout-tray');
  if (backdrop) backdrop.style.display = 'none';
  if (tray) tray.style.transform = 'translateY(100%)';
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
  if (profile.name) s += 10;
  if (profile.workplace) s += 10;
  if (profile.title) s += 13;
  if (profile.keywords && profile.keywords.length >= 3) s += 13;
  if (profile.lifestage) s += 13;
  // Above 59% threshold — bonus fields
  if (profile.keywords && profile.keywords.length >= 6) s += 13; // detailed tags
  if (profile.bio) s += 8;
  if (profile.avatar_url) s += 10;
  if (profile.linkedin) s += 10;
  return Math.min(s, 100);
}

function showProfileSetupCTA() {
  var setupEl = document.getElementById('home-profile-setup');
  var miniEl = document.getElementById('home-profile-mini');
  if (!setupEl || !miniEl || !currentProfile) return;

  var strength = calcProfileStrength(currentProfile);

  if (strength >= SETUP_THRESHOLD) {
    setupEl.style.display = 'none';
    miniEl.style.display = 'none';
    return;
  }

  // Determine next step
  var nextLabel = '';
  if (!currentProfile.title) nextLabel = 'Næste: Tilføj titel';
  else if (!currentProfile.keywords || currentProfile.keywords.length < 3) nextLabel = 'Næste: Vælg interesser';
  else if (!currentProfile.lifestage) nextLabel = 'Næste: Vælg din type';
  else nextLabel = 'Tilføj tags for bedre matches';

  // Update CTA avatar
  var avEl = document.getElementById('setup-cta-avatar');
  if (avEl) {
    if (currentProfile.avatar_url) {
      avEl.innerHTML = '<img src="' + escHtml(currentProfile.avatar_url) + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%">';
    } else {
      avEl.textContent = (currentProfile.name || '?').split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();
    }
  }

  // Show big CTA or mini bar
  var bar, pctEl, nextEl;
  setupEl.style.display = 'block';
  miniEl.style.display = 'none';
  bar = document.getElementById('setup-cta-bar');
  pctEl = document.getElementById('setup-cta-pct');
  nextEl = document.getElementById('setup-cta-next');
  if (bar) bar.style.width = strength + '%';
  if (pctEl) pctEl.textContent = strength + '%';
  if (nextEl) nextEl.textContent = nextLabel;
}

function openNextProfileSetupSheet() {
  if (!currentProfile) return;
  if (!currentProfile.title) { openSetupTitleSheet(); return; }
  if (!currentProfile.keywords || currentProfile.keywords.length < 3) { openSetupInterestsSheet(); return; }
  if (!currentProfile.lifestage) { openSetupLifestageSheet(); return; }
  // All done — open profile tab for tags
  openProfileSetupTags();
}

// ── TITLE SHEET ──
function openSetupTitleSheet() {
  var input = document.getElementById('setup-title-input');
  if (input) input.value = currentProfile?.title || '';
  var strength = calcProfileStrength(currentProfile);
  var bar = document.getElementById('setup-title-bar');
  var pct = document.getElementById('setup-title-pct');
  if (bar) bar.style.width = Math.min(strength + 13, 100) + '%';
  if (pct) pct.textContent = Math.min(strength + 13, 100) + '%';
  setupTitleChanged();
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
  if (!title) { showToast('Skriv en titel'); return; }
  try {
    await sb.from('profiles').update({ title: title }).eq('id', currentUser.id);
    if (currentProfile) currentProfile.title = title;
    closeModal('sheet-setup-title');
    showProfileSetupCTA();
    loadHomeDartboardData();
    // Auto-open next sheet after brief delay
    setTimeout(function() { openNextProfileSetupSheet(); }, 400);
  } catch(e) { showToast('Fejl: ' + (e.message || 'ukendt')); }
}

// ── INTERESTS SHEET ──
function openSetupInterestsSheet() {
  _setupSelectedInterests = Array.isArray(currentProfile?.keywords) ? currentProfile.keywords.filter(function(k) {
    return SETUP_INTERESTS.some(function(si) { return si.id === k || si.label === k; });
  }) : [];
  renderSetupInterests();
  openModal('sheet-setup-interests');
}

function renderSetupInterests() {
  var list = document.getElementById('setup-interest-list');
  if (!list) return;
  list.innerHTML = SETUP_INTERESTS.map(function(si) {
    var isActive = _setupSelectedInterests.indexOf(si.id) !== -1;
    return '<div class="setup-interest-row' + (isActive ? ' active' : '') + '" onclick="toggleSetupInterest(\'' + si.id + '\')" ' +
      'style="' + (isActive ? '--active-border:' + si.bg + '0.35);--active-bg:' + si.bg + '0.05);--check-color:' + si.color : '') + '">' +
      '<div class="si-icon" style="background:' + si.bg + '0.1);color:' + si.color + '">' + si.icon + '</div>' +
      '<div style="flex:1;font-size:0.82rem;font-weight:' + (isActive ? '700' : '600') + ';color:' + (isActive ? si.color : 'var(--text-secondary)') + '">' + si.label + '</div>' +
      '<div class="si-check">' + (isActive ? '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : '') + '</div>' +
    '</div>';
  }).join('');
  // Update count + button
  var cnt = _setupSelectedInterests.length;
  var countEl = document.getElementById('setup-interest-count');
  if (countEl) countEl.textContent = 'Vælg mindst 3 emner (' + cnt + '/3)';
  var btn = document.getElementById('setup-interest-save');
  if (btn) {
    if (cnt >= 3) { btn.disabled = false; btn.textContent = 'Gem og fortsæt'; }
    else { btn.disabled = true; btn.textContent = 'Vælg ' + (3 - cnt) + ' mere'; }
  }
  // Update progress bar
  var strength = calcProfileStrength(currentProfile);
  var projectedStrength = cnt >= 3 ? Math.min(strength + 13, 100) : strength;
  var bar = document.getElementById('setup-interest-bar');
  var pct = document.getElementById('setup-interest-pct');
  if (bar) bar.style.width = projectedStrength + '%';
  if (pct) pct.textContent = projectedStrength + '%';
}

function toggleSetupInterest(id) {
  var idx = _setupSelectedInterests.indexOf(id);
  if (idx === -1) _setupSelectedInterests.push(id);
  else _setupSelectedInterests.splice(idx, 1);
  renderSetupInterests();
}

async function saveSetupInterests() {
  if (_setupSelectedInterests.length < 3) return;
  try {
    // Merge with existing keywords (keep detailed tags, add broad interests)
    var existing = Array.isArray(currentProfile?.keywords) ? currentProfile.keywords : [];
    var merged = _setupSelectedInterests.slice();
    existing.forEach(function(k) { if (merged.indexOf(k) === -1) merged.push(k); });
    await sb.from('profiles').update({ keywords: merged }).eq('id', currentUser.id);
    if (currentProfile) currentProfile.keywords = merged;
    closeModal('sheet-setup-interests');
    showProfileSetupCTA();
    loadHomeDartboardData();
    setTimeout(function() { openNextProfileSetupSheet(); }, 400);
  } catch(e) { showToast('Fejl: ' + (e.message || 'ukendt')); }
}

// ── LIFESTAGE SHEET ──
function openSetupLifestageSheet() {
  _setupSelectedLifestage = currentProfile?.lifestage || null;
  updateSetupLifestageUI();
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
    if (_setupSelectedLifestage) { btn.disabled = false; btn.textContent = 'Færdig!'; }
    else { btn.disabled = true; btn.textContent = 'Vælg din type'; }
  }
  var strength = calcProfileStrength(currentProfile);
  var projected = _setupSelectedLifestage ? Math.min(strength + 13, 100) : strength;
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
    showSuccessToast('Profil klar!');
    showProfileSetupCTA();
    loadHomeDartboardData();
  } catch(e) { showToast('Fejl: ' + (e.message || 'ukendt')); }
}

// ── SKIP + BOOST ──
function skipSetupSheet(which) {
  closeModal('sheet-setup-' + (which === 'interests' ? 'interests' : which === 'lifestage' ? 'lifestage' : 'title'));
  // Back to home — CTA updates with next step
  showProfileSetupCTA();
}

function openProfileSetupTags() {
  goTo('screen-profile');
  setTimeout(function() { if (typeof profSwitchTab === 'function') profSwitchTab('edit'); }, 200);
}

// ── EMPTY FILTER STATE ──
function showDartboardEmpty(filter) {
  var container = document.getElementById('home-prox-avatars');
  if (!container) return;
  var existing = container.querySelector('.dartboard-empty');
  if (existing) existing.remove();
  var msg = '', link = '', linkFn = '';
  if (filter === 'strong') {
    msg = 'Ingen stærke matches endnu';
    link = 'Tilføj tags →';
    linkFn = 'openProfileSetupTags()';
  } else if (filter === 'good') {
    msg = 'Ingen gode matches endnu';
    link = 'Prøv et andet filter';
    linkFn = 'filterRadarHome(\'all\')';
  } else if (filter === 'interest') {
    msg = 'Ingen med fælles interesser';
    link = 'Tilføj interesser →';
    linkFn = 'openSetupInterestsSheet()';
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
    var [invRes, saveRes] = await Promise.all([
      sb.from('bubble_invitations').select('*', { count: 'exact', head: true })
        .eq('to_user_id', currentUser.id).eq('status', 'pending'),
      sb.from('saved_contacts').select('*', { count: 'exact', head: true })
        .eq('contact_id', currentUser.id).gt('created_at', lastSeen)
    ]);
    var total = (invRes.count || 0) + (saveRes.count || 0);
    if (total > 0) {
      badge.textContent = total > 9 ? '9+' : total;
      badge.style.display = 'flex';
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
    await sb.from('bubble_invitations').update({ status: 'accepted' }).eq('id', inviteId);
    var { data: inv } = await sb.from('bubble_invitations').select('bubble_id').eq('id', inviteId).single();
    if (inv?.bubble_id) {
      await sb.from('bubble_members').insert({ bubble_id: inv.bubble_id, user_id: currentUser.id });
      showSuccessToast('Du er nu med i boblen!');
      loadMyBubbles();
      setTimeout(function() { openBubbleChat(inv.bubble_id, 'screen-bubbles'); }, 800);
    }
  } catch(e) { logError('bbConfirmAccept', e); showToast('Fejl: ' + (e.message || 'ukendt')); }
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
  try {
    await sb.from('bubble_invitations').update({ status: 'declined' }).eq('id', inviteId);
    var card = document.getElementById('bb-inv-' + inviteId);
    if (card) { card.style.transition = 'opacity 0.2s'; card.style.opacity = '0'; setTimeout(function() { card.remove(); }, 200); }
    showToast('Invitation afvist');
  } catch(e) { logError('bbConfirmDecline', e); showToast('Fejl: ' + (e.message || 'ukendt')); }
}

function bbSwitchTab(tab) {
  var minePanel    = document.getElementById('bb-panel-mine');
  var explorePanel = document.getElementById('bb-panel-explore');
  var mineTab      = document.getElementById('bb-tab-mine');
  var exploreTab   = document.getElementById('bb-tab-explore');
  if (tab === 'explore') {
    if (minePanel)    minePanel.style.display    = 'none';
    if (explorePanel) explorePanel.style.display = 'block';
    if (mineTab)      mineTab.classList.remove('active');
    if (exploreTab)   exploreTab.classList.add('active');
    loadDiscover();
  } else {
    if (minePanel)    minePanel.style.display    = 'block';
    if (explorePanel) explorePanel.style.display = 'none';
    if (mineTab)      mineTab.classList.add('active');
    if (exploreTab)   exploreTab.classList.remove('active');
    loadMyBubbles();
  }
}

async function bbLoadLivePanel() {
  var list = document.getElementById('bb-live-list');
  if (!list) return;
  list.innerHTML = skelCards(3);
  try {
    // Get user's memberships for access check
    var { data: myMem } = await sb.from('bubble_members').select('bubble_id').eq('user_id', currentUser.id);
    var myBIds = (myMem || []).map(function(m) { return m.bubble_id; });

    // Show location-based and event bubbles
    var { data: placeBubbles } = await sb.from('bubbles')
      .select('id, name, location, type, visibility, created_at')
      .or('type.eq.live,type.eq.event')
      .order('created_at', { ascending: false })
      .limit(30);

    // Also get bubbles with locations
    var { data: locBubbles } = await sb.from('bubbles')
      .select('id, name, location, type, visibility, created_at')
      .not('location', 'is', null)
      .order('created_at', { ascending: false })
      .limit(30);

    // Merge, deduplicate, and filter hidden
    var allMap = {};
    (placeBubbles || []).forEach(function(b) { allMap[b.id] = b; });
    (locBubbles || []).forEach(function(b) { if (b.location && b.location.trim()) allMap[b.id] = b; });
    var filtered = Object.values(allMap).filter(function(b) {
      // Hidden bubbles only visible to members
      if (b.visibility === 'hidden' && myBIds.indexOf(b.id) < 0) return false;
      return true;
    });

    if (filtered.length === 0) {
      list.innerHTML = '<div style="text-align:center;padding:2rem 1rem">' +
        '<div style="width:44px;height:44px;margin:0 auto 0.7rem;opacity:0.4;color:var(--accent)">' + ico('pin') + '</div>' +
        '<div style="font-size:0.85rem;font-weight:700;margin-bottom:0.25rem">Ingen events eller steder endnu</div>' +
        '<div style="font-size:0.72rem;color:var(--text-secondary);margin-bottom:1rem;line-height:1.4">Opret en event-boble med lokation, eller scan en QR-kode for at checke ind.</div>' +
        '<button onclick="openCreateBubble()" style="font-size:0.78rem;padding:0.55rem 1.3rem;background:rgba(124,92,252,0.08);color:var(--accent);border:1px solid rgba(124,92,252,0.2);border-radius:12px;cursor:pointer;font-family:inherit;font-weight:600">+ Opret event</button>' +
        '</div>';
      return;
    }

    // Get active check-in counts
    var bubbleIds = filtered.map(function(b) { return b.id; });
    var expireCutoff = new Date(Date.now() - LIVE_EXPIRE_HOURS * 60 * 60 * 1000).toISOString();
    var { data: activeMembers } = await sb.from('bubble_members')
      .select('bubble_id, user_id')
      .in('bubble_id', bubbleIds)
      .not('checked_in_at', 'is', null)
      .is('checked_out_at', null)
      .gte('checked_in_at', expireCutoff);

    var countMap = {};
    var memberMap = {};
    (activeMembers || []).forEach(function(m) {
      countMap[m.bubble_id] = (countMap[m.bubble_id] || 0) + 1;
      if (!memberMap[m.bubble_id]) memberMap[m.bubble_id] = [];
      if (memberMap[m.bubble_id].length < 3) memberMap[m.bubble_id].push(m.user_id);
    });

    // Fetch avatar data
    var allUserIds = [];
    Object.values(memberMap).forEach(function(ids) {
      ids.forEach(function(id) { if (allUserIds.indexOf(id) < 0) allUserIds.push(id); });
    });
    var profileMap = {};
    if (allUserIds.length > 0) {
      var { data: profiles } = await sb.from('profiles').select('id, name, avatar_url').in('id', allUserIds);
      (profiles || []).forEach(function(p) { profileMap[p.id] = p; });
    }

    var avColors = ['linear-gradient(135deg,#2ECFCF,#22B8CF)','linear-gradient(135deg,#6366F1,#7C5CFC)','linear-gradient(135deg,#E879A8,#EC4899)','linear-gradient(135deg,#F59E0B,#EAB308)','linear-gradient(135deg,#1A9E8E,#10B981)','linear-gradient(135deg,#8B5CF6,#A855F7)','linear-gradient(135deg,#3B82F6,#6366F1)','linear-gradient(135deg,#EF4444,#F97316)','linear-gradient(135deg,#06B6D4,#0EA5E9)','linear-gradient(135deg,#D946EF,#C026D3)'];

    // Sort: active first, events first, then date
    filtered.sort(function(a, b) {
      var aActive = countMap[a.id] || 0;
      var bActive = countMap[b.id] || 0;
      if (bActive !== aActive) return bActive - aActive;
      return new Date(b.created_at) - new Date(a.created_at);
    });

    list.innerHTML = filtered.map(function(b) {
      var cnt = countMap[b.id] || 0;
      var isEvent = b.type === 'event' || b.type === 'live';

      // Avatar preview
      var avatarHtml = '';
      if (cnt > 0 && memberMap[b.id]) {
        var avs = memberMap[b.id].map(function(uid, i) {
          var p = profileMap[uid];
          if (!p) return '';
          var ini = (p.name || '?').split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();
          var ml = i > 0 ? 'margin-left:-6px;' : '';
          if (p.avatar_url) return '<div style="width:24px;height:24px;border-radius:50%;overflow:hidden;border:1.5px solid var(--bg);' + ml + 'position:relative;z-index:' + (3-i) + '"><img src="' + escHtml(p.avatar_url) + '" style="width:100%;height:100%;object-fit:cover"></div>';
          return '<div style="width:24px;height:24px;border-radius:50%;background:' + avColors[i % 10] + ';display:flex;align-items:center;justify-content:center;font-size:0.5rem;font-weight:700;color:white;border:1.5px solid var(--bg);' + ml + 'position:relative;z-index:' + (3-i) + '">' + ini + '</div>';
        }).join('');
        avatarHtml = '<div style="display:flex;align-items:center;margin-right:0.4rem">' + avs + '</div>';
      }

      return '<div class="card flex-row-center" style="padding:0.85rem 1.1rem;margin-bottom:0.4rem;cursor:pointer" onclick="openBubble(\'' + b.id + '\')">' +
        '<div class="bubble-icon" style="background:' + (isEvent ? 'rgba(124,92,252,0.12)' : 'rgba(46,207,207,0.15)') + ';color:' + (isEvent ? '#3B82F6' : '#2ECFCF') + '">' + ico(isEvent ? 'calendar' : 'pin') + '</div>' +
        '<div style="flex:1;min-width:0">' +
        '<div class="fw-600 fs-09">' + escHtml(b.name) + '</div>' +
        '<div class="fs-075 text-muted">' + (isEvent ? 'Event' : 'Sted') + (b.location ? ' \u00B7 ' + escHtml(b.location) : '') + '</div>' +
        '</div>' +
        avatarHtml +
        (cnt > 0 ? '<div style="display:flex;align-items:center;gap:0.3rem"><div class="live-dot" style="width:6px;height:6px"></div><span class="fs-075 fw-600">' + cnt + '</span></div>' : '') +
        '<button onclick="event.stopPropagation();liveCheckin(\'' + b.id + '\')" style="font-size:0.62rem;padding:0.25rem 0.5rem;background:rgba(124,92,252,0.08);color:var(--accent);border:1px solid rgba(124,92,252,0.15);border-radius:8px;cursor:pointer;font-family:inherit;font-weight:600;flex-shrink:0;margin-left:0.3rem">Check ind</button>' +
        '</div>';
    }).join('');
  } catch(e) {
    logError('bbLoadLivePanel', e);
    list.innerHTML = '<div class="sub-muted">Kunne ikke hente steder</div>';
  }
}

async function loadMyBubbles() {
  try {
    if (!currentUser) return;
    var myNav = _navVersion;
    // Mark bubbles as seen — clears badge on home screen
    localStorage.setItem('bubble_bubbles_seen', new Date().toISOString());
    const ownedList  = document.getElementById('my-owned-bubbles-list');
    const joinedList = document.getElementById('my-bubbles-list');
    const inviteEl   = document.getElementById('bb-pending-invites');
    ownedList.innerHTML = skelCards(2);
    joinedList.innerHTML = skelCards(2);
    if (inviteEl) inviteEl.innerHTML = '';

    // Fetch memberships + pending invites in parallel
    var [memRes, invRes] = await Promise.all([
      sb.from('bubble_members').select('bubble_id').eq('user_id', currentUser.id),
      sb.from('bubble_invitations')
        .select('id, bubble_id, from_user_id, created_at')
        .eq('to_user_id', currentUser.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
    ]);
    var memberships = memRes.data;
    var pendingInvites = invRes.data || [];
    if (_navVersion !== myNav) return;

    // Enrich invites with bubble + profile data (no FK hints)
    if (pendingInvites.length > 0) {
      var invBubbleIds = [...new Set(pendingInvites.map(function(i) { return i.bubble_id; }))];
      var invFromIds = [...new Set(pendingInvites.map(function(i) { return i.from_user_id; }))];
      var [ibRes, ipRes] = await Promise.all([
        sb.from('bubbles').select('id, name, type, location, description').in('id', invBubbleIds),
        sb.from('profiles').select('id, name').in('id', invFromIds)
      ]);
      var ibMap = {}; (ibRes.data || []).forEach(function(b) { ibMap[b.id] = b; });
      var ipMap = {}; (ipRes.data || []).forEach(function(p) { ipMap[p.id] = p; });
      pendingInvites.forEach(function(inv) {
        inv._bubble = ibMap[inv.bubble_id] || {};
        inv._from = ipMap[inv.from_user_id] || {};
      });
    }

    // Render pending invites at top
    if (inviteEl && pendingInvites.length > 0) {
      // Fetch member avatars for invite bubbles
      var invBIds = pendingInvites.map(function(inv) { return inv.bubble_id; });
      var invMemberMap = {};
      try { invMemberMap = await fetchMemberAvatarsForBubbles(invBIds, 4); } catch(e) {}

      inviteEl.innerHTML = '<div class="section-label" style="margin-top:0.25rem;color:var(--accent)">Invitationer</div>' +
        pendingInvites.map(function(inv) {
          var b = inv._bubble;
          var fromName = inv._from.name || 'Nogen';
          var invAvStack = renderAvatarStack(invMemberMap[inv.bubble_id] || [], 0);
          return '<div id="bb-inv-' + inv.id + '" class="card" style="border:1.5px solid rgba(124,92,252,0.25);background:rgba(124,92,252,0.02);margin-bottom:0.4rem">' +
            '<div style="display:flex;align-items:center;gap:0.6rem">' +
            '<div class="bubble-icon" style="background:' + bubbleColor(b.type, 0.15) + ';color:' + bubbleColor(b.type, 0.9) + '">' + bubbleEmoji(b.type) + '</div>' +
            '<div style="flex:1;min-width:0">' +
            '<div class="fw-600 fs-09">' + escHtml(b.name || 'Boble') + '</div>' +
            '<div class="fs-072 text-muted">' + escHtml(fromName) + ' inviterer dig · ' + timeAgo(inv.created_at) + '</div>' +
            invAvStack +
            '</div>' +
            '</div>' +
            '<div style="display:flex;gap:0.35rem;margin-top:0.5rem">' +
            '<button onclick="bbAcceptInvite(\'' + inv.id + '\',\'' + inv.from_user_id + '\')" style="flex:1;padding:0.45rem;border-radius:10px;border:none;background:var(--gradient-primary);color:white;font-family:inherit;font-size:0.78rem;font-weight:700;cursor:pointer">Acceptér</button>' +
            '<button onclick="bbDeclineInvite(\'' + inv.id + '\')" style="padding:0.45rem 0.7rem;border-radius:10px;border:1px solid var(--glass-border);background:none;color:var(--muted);font-family:inherit;font-size:0.78rem;font-weight:600;cursor:pointer">Nej tak</button>' +
            '</div></div>';
        }).join('');
    }

    if (!memberships || memberships.length === 0) {
      ownedList.innerHTML  = '';
      joinedList.innerHTML = '<div class="empty-state" style="padding:2rem 0"><div class="empty-icon">' + icon('bubble') + '</div><div class="empty-text">Du er ikke med i nogen bobler endnu</div><div style="margin-top:1rem"><button class="btn-primary" onclick="goTo(\'screen-bubbles\');bbSwitchTab(\'explore\')" style="font-size:0.82rem;padding:0.6rem 1.5rem">Opdag bobler →</button></div><div style="margin-top:0.5rem"><button class="btn-secondary" onclick="openCreateBubble()" style="font-size:0.78rem;padding:0.5rem 1.2rem">+ Opret en boble</button></div></div>';
      var profBubblesEl = document.getElementById('profile-bubbles');
      if (profBubblesEl) {
        profBubblesEl.innerHTML = '<div style="text-align:center;padding:2rem 1rem">' +
          '<div style="width:44px;height:44px;margin:0 auto 0.7rem;opacity:0.4;color:var(--accent)">' + ico('bubble') + '</div>' +
          '<div style="font-size:0.85rem;font-weight:700;margin-bottom:0.25rem">Ingen bobler endnu</div>' +
          '<div style="font-size:0.72rem;color:var(--text-secondary);margin-bottom:1rem;line-height:1.4">Bobler er fællesskaber og events. Udforsk og join din første!</div>' +
          '<button onclick="goTo(\'screen-bubbles\');bbSwitchTab(\'explore\')" style="font-size:0.78rem;padding:0.55rem 1.3rem;background:rgba(124,92,252,0.12);color:var(--accent);border:1px solid rgba(124,92,252,0.25);border-radius:12px;cursor:pointer;font-family:inherit;font-weight:600">Opdag bobler →</button>' +
          '</div>';
      }
      return;
    }

    const ids = memberships.map(m => m.bubble_id);
    const { data: bubbles } = await sb.from('bubbles').select('*').in('id', ids);
    if (_navVersion !== myNav) return;
    if (!bubbles || bubbles.length === 0) {
      ownedList.innerHTML = joinedList.innerHTML = '';
      return;
    }

    // Enrich all bubbles with saved contact avatars
    var savedIds = await getSavedContactIds();
    var contactMap = await fetchContactAvatarsForBubbles(ids, savedIds);
    if (_navVersion !== myNav) return;
    bubbles.forEach(function(b) { b._contacts = contactMap[b.id] || []; });

    // Enrich bubbles with parent name (for ↳ display)
    var parentIds = [...new Set(bubbles.filter(function(b) { return b.parent_bubble_id; }).map(function(b) { return b.parent_bubble_id; }))];
    if (parentIds.length > 0) {
      try {
        var { data: parents } = await sb.from('bubbles').select('id,name').in('id', parentIds);
        var parentMap = {};
        (parents || []).forEach(function(p) { parentMap[p.id] = p.name; });
        bubbles.forEach(function(b) { if (b.parent_bubble_id && parentMap[b.parent_bubble_id]) b._parentName = parentMap[b.parent_bubble_id]; });
      } catch(e) { /* silent — parent ref is optional */ }
    }

    // ── Smart auto-sort: live → upcoming events → recent activity ──
    var liveId = currentLiveBubble ? currentLiveBubble.bubble_id : null;
    // Fetch upcoming child events for sorting
    var upcomingEventParents = {};
    try {
      var { data: upcoming } = await sb.from('bubbles')
        .select('parent_bubble_id')
        .eq('type', 'event')
        .gte('event_date', new Date().toISOString())
        .in('parent_bubble_id', ids);
      (upcoming || []).forEach(function(e) { upcomingEventParents[e.parent_bubble_id] = true; });
    } catch(e) {}

    bubbles.sort(function(a, b) {
      // 1. Currently live → top
      var aLive = (a.id === liveId) ? 1 : 0;
      var bLive = (b.id === liveId) ? 1 : 0;
      if (aLive !== bLive) return bLive - aLive;
      // 2. Has upcoming events → next
      var aEvent = upcomingEventParents[a.id] ? 1 : 0;
      var bEvent = upcomingEventParents[b.id] ? 1 : 0;
      if (aEvent !== bEvent) return bEvent - aEvent;
      // 3. Most recently updated → next
      var aTime = new Date(a.updated_at || a.created_at).getTime();
      var bTime = new Date(b.updated_at || b.created_at).getTime();
      return bTime - aTime;
    });

    const owned  = bubbles.filter(b => b.created_by === currentUser.id);
    const joined = bubbles.filter(b => b.created_by !== currentUser.id);

    // Owned bubbles — show with visibility badge + edit shortcut
    if (owned.length === 0) {
      ownedList.innerHTML = '<div class="sub-muted" style="padding:0.5rem 0">Du har ikke oprettet nogen bobler endnu.</div>';
    } else {
      ownedList.innerHTML = owned.map(b => {
        const visIcon = b.visibility === 'private' ? icon('lock') : b.visibility === 'hidden' ? icon('eye') : icon('globe');
        // Render contact avatars inline (same logic as bubbleCard)
        var cHtml = '';
        var cs = b._contacts || [];
        if (cs.length > 0) {
          var avCols = ['linear-gradient(135deg,#2ECFCF,#22B8CF)','linear-gradient(135deg,#6366F1,#7C5CFC)','linear-gradient(135deg,#E879A8,#EC4899)','linear-gradient(135deg,#F59E0B,#EAB308)','linear-gradient(135deg,#1A9E8E,#10B981)','linear-gradient(135deg,#8B5CF6,#A855F7)','linear-gradient(135deg,#3B82F6,#6366F1)','linear-gradient(135deg,#EF4444,#F97316)','linear-gradient(135deg,#06B6D4,#0EA5E9)','linear-gradient(135deg,#D946EF,#C026D3)'];
          var avs = cs.map(function(c, i) {
            var ini = (c.name||'?').split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();
            var ml = i > 0 ? 'margin-left:-5px;' : '';
            if (c.avatar_url) return '<div style="width:20px;height:20px;border-radius:50%;overflow:hidden;border:1.5px solid var(--bg);' + ml + 'position:relative;z-index:' + (3-i) + '"><img src="' + escHtml(c.avatar_url) + '" style="width:100%;height:100%;object-fit:cover"></div>';
            return '<div style="width:20px;height:20px;border-radius:50%;background:' + avCols[i % 10] + ';display:flex;align-items:center;justify-content:center;font-size:0.4rem;font-weight:700;color:white;border:1.5px solid var(--bg);' + ml + 'position:relative;z-index:' + (3-i) + '">' + ini + '</div>';
          }).join('');
          cHtml = '<div style="display:flex;align-items:center;gap:0.25rem;margin-top:0.2rem"><div style="display:flex;align-items:center">' + avs + '</div><span class="fs-065 text-muted">' + cs.length + ' kontakt' + (cs.length > 1 ? 'er' : '') + '</span></div>';
        }
        return `<div class="card flex-row-center" data-action="openBubble" data-id="${b.id}">
          <div class="bubble-icon" style="background:${bubbleColor(b.type, 0.15)};color:${bubbleColor(b.type, 0.9)}">${bubbleEmoji(b.type)}</div>
          <div style="flex:1">
            <div class="fw-600 fs-09">${escHtml(b.name)}</div>
            <div class="fs-075 text-muted">${visIcon} ${b.type_label||b.type}${b.location ? ' · '+escHtml(b.location) : ''}</div>
            ${b._parentName ? '<div style="display:inline-flex;align-items:center;gap:3px;margin-top:0.15rem;font-size:0.62rem;color:#534AB7">\u21B3 ' + escHtml(b._parentName) + '</div>' : ''}
            ${cHtml}
          </div>
          <div style="display:flex;gap:0.4rem;align-items:center">
            <button class="btn-sm btn-ghost" data-action="openEditBubble" data-id="${b.id}" onclick="event.stopPropagation()" style="font-size:0.8rem;padding:0.3rem 0.5rem">${icon("edit")}</button>
            <div class="live-dot"></div>
          </div>
        </div>`;
      }).join('');
    }

    // Joined bubbles
    if (joined.length === 0) {
      joinedList.innerHTML = '<div class="sub-muted" style="padding:0.5rem 0">Du er ikke medlem af andres bobler endnu.</div>';
    } else {
      joinedList.innerHTML = joined.map(b => bubbleCard(b, true)).join('');
    }

    // Suggested bubbles removed — discovery belongs in Opdag screen
    var sugEl = document.getElementById('suggested-bubbles-list');
    if (sugEl) sugEl.innerHTML = '';

    // Profile bubbles
    var profBubblesEl = document.getElementById('profile-bubbles');
    if (profBubblesEl) {
      if (bubbles.length === 0) {
        profBubblesEl.innerHTML = '<div style="text-align:center;padding:2rem 1rem">' +
          '<div style="width:44px;height:44px;margin:0 auto 0.7rem;opacity:0.4;color:var(--accent)">' + ico('bubble') + '</div>' +
          '<div style="font-size:0.85rem;font-weight:700;margin-bottom:0.25rem">Ingen bobler endnu</div>' +
          '<div style="font-size:0.72rem;color:var(--text-secondary);margin-bottom:1rem;line-height:1.4">Bobler er fællesskaber og events. Udforsk og join din første!</div>' +
          '<button onclick="goTo(\'screen-bubbles\');bbSwitchTab(\'explore\')" style="font-size:0.78rem;padding:0.55rem 1.3rem;background:rgba(124,92,252,0.12);color:var(--accent);border:1px solid rgba(124,92,252,0.25);border-radius:12px;cursor:pointer;font-family:inherit;font-weight:600">Opdag bobler →</button>' +
          '</div>';
      } else {
        profBubblesEl.innerHTML = bubbles.map(function(b) {
          // Contact avatars
          var cHtml = '';
          var cs = b._contacts || [];
          if (cs.length > 0) {
            var avCols = ['linear-gradient(135deg,#2ECFCF,#22B8CF)','linear-gradient(135deg,#6366F1,#7C5CFC)','linear-gradient(135deg,#E879A8,#EC4899)','linear-gradient(135deg,#F59E0B,#EAB308)','linear-gradient(135deg,#1A9E8E,#10B981)','linear-gradient(135deg,#8B5CF6,#A855F7)','linear-gradient(135deg,#3B82F6,#6366F1)','linear-gradient(135deg,#EF4444,#F97316)','linear-gradient(135deg,#06B6D4,#0EA5E9)','linear-gradient(135deg,#D946EF,#C026D3)'];
            var avs = cs.map(function(c, i) {
              var ini = (c.name||'?').split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();
              var ml = i > 0 ? 'margin-left:-5px;' : '';
              if (c.avatar_url) return '<div style="width:20px;height:20px;border-radius:50%;overflow:hidden;border:1.5px solid var(--bg);' + ml + 'position:relative;z-index:' + (3-i) + '"><img src="' + escHtml(c.avatar_url) + '" style="width:100%;height:100%;object-fit:cover"></div>';
              return '<div style="width:20px;height:20px;border-radius:50%;background:' + avCols[i % 10] + ';display:flex;align-items:center;justify-content:center;font-size:0.4rem;font-weight:700;color:white;border:1.5px solid var(--bg);' + ml + 'position:relative;z-index:' + (3-i) + '">' + ini + '</div>';
            }).join('');
            cHtml = '<div style="display:flex;align-items:center;gap:0.25rem;margin-top:0.2rem"><div style="display:flex;align-items:center">' + avs + '</div><span class="fs-065 text-muted">' + cs.length + ' kontakt' + (cs.length > 1 ? 'er' : '') + '</span></div>';
          }
          return '<div class="card flex-row-center" data-action="openBubble" data-id="' + b.id + '" style="padding:0.85rem 1.1rem">' +
            '<div class="bubble-icon" style="background:' + bubbleColor(b.type, 0.15) + ';flex-shrink:0">' + bubbleEmoji(b.type) + '</div>' +
            '<div style="flex:1;min-width:0">' +
              '<div class="fw-600 fs-09">' + escHtml(b.name) + '</div>' +
              '<div class="fs-075 text-muted">' + (b.created_by === currentUser.id ? icon('crown') + ' Ejer' : 'Aktiv') + ' · ' + visibilityBadge(b.visibility) + (b.location ? ' · ' + escHtml(b.location) : '') + '</div>' +
              (b._parentName ? '<div style="display:inline-flex;align-items:center;gap:3px;margin-top:0.15rem;font-size:0.62rem;color:#534AB7">\u21B3 ' + escHtml(b._parentName) + '</div>' : '') +
              cHtml +
            '</div>' +
            '<div class="icon-muted">›</div>' +
          '</div>';
        }).join('');
      }
    }
  } catch(e) { logError("loadMyBubbles", e); showRetryState('my-bubbles-list', 'loadMyBubbles', 'Kunne ikke hente bobler'); }
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
  var ups = b.upvote_count || bubbleUpvotes[b.id] || 0;
  var upLabel = ups > 0 ? `<div class="fs-065" style="color:var(--accent);display:flex;align-items:center;gap:0.15rem">${icon('rocket')}<span style="font-weight:700">${ups}</span></div>` : '';

  // Contact avatars (from Discover)
  var contactHtml = '';
  var contacts = b._contacts || [];
  if (contacts.length > 0) {
    var avColors = ['linear-gradient(135deg,#2ECFCF,#22B8CF)','linear-gradient(135deg,#6366F1,#7C5CFC)','linear-gradient(135deg,#E879A8,#EC4899)','linear-gradient(135deg,#F59E0B,#EAB308)','linear-gradient(135deg,#1A9E8E,#10B981)','linear-gradient(135deg,#8B5CF6,#A855F7)','linear-gradient(135deg,#3B82F6,#6366F1)','linear-gradient(135deg,#EF4444,#F97316)','linear-gradient(135deg,#06B6D4,#0EA5E9)','linear-gradient(135deg,#D946EF,#C026D3)'];
    var avs = contacts.map(function(c, i) {
      var ini = (c.name||'?').split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();
      var ml = i > 0 ? 'margin-left:-5px;' : '';
      if (c.avatar_url) return '<div style="width:20px;height:20px;border-radius:50%;overflow:hidden;border:1.5px solid var(--bg);' + ml + 'position:relative;z-index:' + (3-i) + '"><img src="' + escHtml(c.avatar_url) + '" style="width:100%;height:100%;object-fit:cover"></div>';
      return '<div style="width:20px;height:20px;border-radius:50%;background:' + avColors[i % 10] + ';display:flex;align-items:center;justify-content:center;font-size:0.4rem;font-weight:700;color:white;border:1.5px solid var(--bg);' + ml + 'position:relative;z-index:' + (3-i) + '">' + ini + '</div>';
    }).join('');
    contactHtml = '<div style="display:flex;align-items:center;gap:0.25rem;margin-top:0.2rem"><div style="display:flex;align-items:center">' + avs + '</div><span class="fs-065 text-muted">' + contacts.length + ' kontakt' + (contacts.length > 1 ? 'er' : '') + '</span></div>';
  }

  var memberLabel = (b.member_count || 0) > 0 ? '<div class="fw-700" style="font-size:0.75rem">' + ico('users') + ' ' + b.member_count + '</div>' : '';
  var visBadge = visibilityBadge(b.visibility);
  var parentRef = b._parentName ? '<div style="display:inline-flex;align-items:center;gap:3px;margin-top:0.15rem;font-size:0.62rem;color:#534AB7">\u21B3 ' + escHtml(b._parentName) + '</div>' : '';

  var cardBorder = b.visibility === 'private' ? 'border-left:3px solid rgba(124,92,252,0.4);' : (b.visibility === 'hidden' ? 'border-left:3px solid rgba(30,27,46,0.15);' : '');

  return `<div class="card flex-row-center" data-action="openBubble" data-id="${b.id}" style="${cardBorder}">
    <div class="bubble-icon" style="background:${bubbleColor(b.type, 0.15)};color:${bubbleColor(b.type, 0.9)}">${bubbleEmoji(b.type)}</div>
    <div style="flex:1;min-width:0">
      <div class="fw-600 fs-09">${escHtml(b.name)}</div>
      <div style="font-size:0.75rem;color:var(--text-secondary);display:flex;align-items:center;gap:0.25rem;flex-wrap:wrap">${escHtml(b.type_label || b.type)} ${b.location ? '<span>·</span> <span>' + escHtml(b.location) + '</span>' : ''} <span>·</span> ${visBadge}</div>
      ${parentRef}
      ${contactHtml}
    </div>
    <div class="flex-col-end" style="align-items:flex-end;gap:0.15rem">
      ${memberLabel}
      ${upLabel}
      ${joined ? '<div class="live-dot"></div>' : '<div class="fs-09" style="color:var(--accent)">+</div>'}
    </div>
  </div>`;
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
  ['saved','nudge','feedback'].forEach(function(key) {
    hsUpdateToggleUI(key, prefs[key] !== false);
  });
  hsUpdatePreview();
}

function hsApplyToHome() {
  var prefs = hsGetPrefs();
  // v5.2: toggle keys are saved, nudge, feedback. Radar is always visible.
  ['saved','nudge','feedback'].forEach(function(key) {
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

async function loadHomeDartboardData() {
  try {
    if (!currentUser || !currentProfile) return;

    var { data: allProfiles } = await sb.from('profiles')
      .select('id,name,title,keywords,dynamic_keywords,bio,linkedin,is_anon,avatar_url')
      .neq('id', currentUser.id).neq('banned', true).limit(200);
    if (!allProfiles || allProfiles.length === 0) {
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
  var allP = _homeDartboardProfiles.length > 0 ? _homeDartboardProfiles : (proxAllProfiles || []);
  if (_homeRadarFilter === 'all') return allP;
  if (_homeRadarFilter === 'live') {
    var liveIds = window._liveCheckedInIds || [];
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
  var w = par.offsetWidth || 300, h = w;
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
  }

  if (profiles.length === 0) {
    av.innerHTML = '';
    if (_homeViewMode === 'live') {
      av.innerHTML = '<div class="dartboard-empty" style="position:absolute;top:50%;left:50%;transform:translate(-50%, calc(-100% - 40px));text-align:center;padding:0.6rem 1.2rem;background:rgba(255,255,255,0.85);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border-radius:12px;border:1px solid var(--glass-border-subtle);box-shadow:0 2px 8px rgba(30,27,46,0.06);white-space:nowrap">' +
        '<div style="font-size:0.78rem;font-weight:600;color:var(--text)">Du er den første her!</div>' +
        '<div style="font-size:0.68rem;color:var(--muted);margin-top:0.15rem">Venter på deltagere...</div>' +
        '</div>';
    } else if (_homeRadarFilter !== 'all') {
      showDartboardEmpty(_homeRadarFilter);
    } else {
      av.innerHTML = '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:0.75rem;color:var(--muted)">Join en boble for at se matches</div>';
    }
    return;
  }
  // Clear any empty state
  var emptyEl = av.querySelector('.dartboard-empty');
  if (emptyEl) emptyEl.remove();

  var map = canvas ? canvas.parentElement : null;
  var w = map ? (map.offsetWidth || 300) : 300;
  var cx = w/2, cy = w/2, maxR = Math.min(cx,cy) - 24;

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
    out += '<div class="prox-dot" style="width:'+sz+'px;height:'+sz+'px;left:'+pos.x.toFixed(1)+'px;top:'+pos.y.toFixed(1)+'px;background:'+col+';font-size:'+(sz<34?'0.48':'0.55')+'rem" onclick="event.stopPropagation();openRadarPerson(\''+p.id+'\')" data-id="'+p.id+'">'+inner+'</div>';
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
  void tray.offsetHeight;
  tray.style.transform = 'translateY(0)';
  renderHomeTrayList();
}

function closeHomeTray() {
  var backdrop = document.getElementById('home-tray-backdrop');
  var tray = document.getElementById('home-tray');
  if (backdrop) backdrop.style.display = 'none';
  if (tray) tray.style.transform = 'translateY(100%)';
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
    return '<div onclick="closeHomeTray();setTimeout(function(){openRadarPerson(\'' + p.id + '\')},100)" style="display:flex;align-items:center;gap:0.7rem;padding:0.6rem 0;border-bottom:1px solid var(--glass-border-subtle);cursor:pointer">' +
      avHtml +
      '<div style="flex:1;min-width:0">' +
        '<div style="display:flex;align-items:center;gap:0.4rem">' +
          '<span style="font-weight:600;font-size:0.85rem">' + escHtml(name) + '</span>' +
          (ml.text ? matchBadgeHtml(p.matchScore || 0) : '') +
        '</div>' +
        '<div style="font-size:0.72rem;color:var(--text-secondary);margin-top:0.1rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escHtml(p.title || '') + '</div>' +
      '</div>' +
      '<span style="color:var(--muted);font-size:0.85rem;opacity:0.4">›</span>' +
    '</div>';
  }).join('');
}

// ══════════════════════════════════════════════════════════
//  HOME BUBBLE PILLS (horizontal scroll)
// ══════════════════════════════════════════════════════════

