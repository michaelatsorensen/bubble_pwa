// ══════════════════════════════════════════════════════════
//  BUBBLE — BUBBLE CHAT + GIF PICKER
//  DOMAIN: chat
//  OWNS: bcBubbleId, bcBubbleData, bcSubscription, bcEditingId, bcSending
//  OWNS: openBubbleChat, bcLoadChatData, bcLoadMembers, bcLoadMessages, bcLoadEvents, bcLoadPosts, bcLoadInfo
//  READS: currentUser, currentProfile, currentLiveBubble
//  Auto-split from app.js · v3.7.0
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
//  GIF PICKER (Giphy API)
// ══════════════════════════════════════════════════════════
// Giphy API — PG-rated, 20 results per query
var gifPickerMode = null; // 'bc' or 'dm'
var _gifSearchTimer = null;

function toggleGifPicker(mode) {
  var picker = document.getElementById('gif-picker');
  var overlay = document.getElementById('gif-picker-overlay');
  if (picker.classList.contains('open')) { closeGifPicker(); return; }
  gifPickerMode = mode;
  overlay.classList.add('open');
  setTimeout(function() { picker.classList.add('open'); }, 10);
  var input = document.getElementById('gif-search');
  if (input) { input.value = ''; input.focus(); }
  loadTrendingGifs();
}

function closeGifPicker() {
  var picker = document.getElementById('gif-picker');
  var overlay = document.getElementById('gif-picker-overlay');
  if (picker) picker.classList.remove('open');
  setTimeout(function() { if (overlay) overlay.classList.remove('open'); }, 280);
}

function gifSearchDebounce() {
  clearTimeout(_gifSearchTimer);
  _gifSearchTimer = setTimeout(function() {
    var q = (document.getElementById('gif-search')?.value || '').trim();
    if (q.length >= 2) searchGifs(q);
    else if (q.length === 0) loadTrendingGifs();
  }, 350);
}

async function loadTrendingGifs() {
  try {
  var grid = document.getElementById('gif-grid');
  if (!grid) return;
  grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:1rem"><div class="spinner"></div></div>';
  try {
    var res = await fetch('https://api.giphy.com/v1/gifs/trending?api_key=' + GIPHY_API_KEY + '&limit=20&rating=pg');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var data = await res.json();
    renderGifs(data.data || []);
  } catch(e) {
    logError('GIF trending error', e);
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:1.5rem;font-size:0.75rem;color:var(--muted)">Kunne ikke hente GIFs.<br>Tjek din internetforbindelse.</div>';
  }
  } catch(e) { logError("loadTrendingGifs", e); }
}

async function searchGifs(query) {
  try {
  var grid = document.getElementById('gif-grid');
  if (!grid) return;
  grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:1rem"><div class="spinner"></div></div>';
  try {
    var res = await fetch('https://api.giphy.com/v1/gifs/search?api_key=' + GIPHY_API_KEY + '&q=' + encodeURIComponent(query) + '&limit=20&rating=pg');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var data = await res.json();
    renderGifs(data.data || []);
  } catch(e) {
    logError('GIF search error', e);
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:1.5rem;font-size:0.75rem;color:var(--muted)">Søgning fejlede</div>';
  }
  } catch(e) { logError("searchGifs", e); }
}

function renderGifs(results) {
  var grid = document.getElementById('gif-grid');
  if (!grid) return;
  if (results.length === 0) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:1.5rem;font-size:0.78rem;color:var(--muted)">Ingen GIFs fundet</div>';
    return;
  }
  window._gifResults = [];
  grid.innerHTML = results.map(function(r, idx) {
    var preview = r.images?.fixed_width_small?.url || r.images?.preview_gif?.url || '';
    var full = r.images?.original?.url || r.images?.fixed_width?.url || preview;
    if (!preview) return '';
    window._gifResults[idx] = full;
    return '<img src="' + preview + '" alt="GIF" loading="lazy" onclick="selectGif(' + idx + ')">';
  }).join('');
}

async function selectGif(idx) {
  try {
  if (!currentUser) { logError('selectGif', 'No currentUser'); return; }
  var gifUrl = window._gifResults && window._gifResults[idx];
  var mode = gifPickerMode;
  closeGifPicker();
  if (!gifUrl) { logError('selectGif', 'No GIF URL at index ' + idx); return; }
  try {
    if (mode === 'bc') {
      if (!bcBubbleId) { logError('selectGif', 'No bcBubbleId'); _renderToast('Fejl: ingen aktiv boble', 'error'); return; }
      var result = await dbActions.sendBubbleMessage(bcBubbleId, '', { gifUrl: gifUrl });
      if (result.ok && result.message) bcReduceMsg(result.message);
    } else if (mode === 'dm') {
      if (!currentChatUser) { logError('selectGif', 'No currentChatUser'); _renderToast(t('toast_generic_error'), 'error'); return; }
      var dmResult = await dbActions.sendDM(currentChatUser, '', { gifUrl: gifUrl });
      if (dmResult.ok && dmResult.message) {
        dmReduceMsg(dmResult.message);
      }
    } else {
      logError('selectGif', 'Unknown mode: ' + mode);
      _renderToast(t('toast_generic_error'), 'error');
    }
  } catch(e) { logError('selectGif', e, { mode: mode }); errorToast('send', e); }
  } catch(e) { logError("selectGif", e); }
}


// ══════════════════════════════════════════════════════════
//  BOBLE CHAT
// ══════════════════════════════════════════════════════════
let bcBubbleId = null;
let bcCurrentMsgId = null;
let bcEditingId = null;
let bcMsgHistories = {};
let bcSubscription = null;
let bcBubbleData = null;
var _bcLivePollTimer = null;

// ── REALTIME CLEANUP HELPER ──
// v5.2: chat only cleans up its own subscriptions.
// Global channels are owned by b-realtime.js → rtUnsubscribeAll().
function bcUnsubscribe() {
  if (bcSubscription) { bcSubscription.unsubscribe(); bcSubscription = null; }
  if (_bcLivePollTimer) { clearInterval(_bcLivePollTimer); _bcLivePollTimer = null; }
}
function dmUnsubscribe() {
  if (chatSubscription) { chatSubscription.unsubscribe(); chatSubscription = null; }
}
function bcUnsubscribeAll() {
  bcUnsubscribe();
  dmUnsubscribe();
  // NOTE: does NOT touch global realtime channels — use rtUnsubscribeAll() for full teardown
}

// ── Skeleton loader for bubble chat entry ──
function _bcShowSkeleton() {
  var existing = document.getElementById('bc-skeleton');
  if (existing) existing.remove();
  var skel = document.createElement('div');
  skel.id = 'bc-skeleton';
  skel.style.cssText = 'flex:1;display:flex;flex-direction:column;overflow:hidden;padding:0';
  // Fake tab bar
  skel.innerHTML =
    '<div style="display:flex;margin:0.4rem 1.1rem 0;background:#F4F3F9;border-radius:10px;padding:3px;gap:2px;border:1px solid var(--glass-border-subtle)">' +
      '<div class="skel" style="flex:1;height:28px;border-radius:8px"></div>' +
      '<div class="skel" style="flex:1;height:28px;border-radius:8px"></div>' +
      '<div class="skel" style="flex:1;height:28px;border-radius:8px"></div>' +
    '</div>' +
    // Fake action bar
    '<div style="display:flex;gap:0.4rem;padding:0.5rem 1.1rem">' +
      '<div class="skel" style="flex:1;height:32px;border-radius:10px"></div>' +
      '<div class="skel" style="flex:1;height:32px;border-radius:10px"></div>' +
      '<div class="skel" style="width:60px;height:32px;border-radius:10px"></div>' +
    '</div>' +
    // Fake member cards
    '<div style="padding:0.4rem 1.1rem">' + skelCards(5) + '</div>';
  // Insert after topbar
  var screen = document.getElementById('screen-bubble-chat');
  var tabs = screen ? screen.querySelector('.bubble-tabs') : null;
  if (tabs) tabs.insertAdjacentElement('afterend', skel);
  else if (screen) screen.appendChild(skel);
}

function _bcHideSkeleton() {
  var skel = document.getElementById('bc-skeleton');
  if (skel) skel.remove();
  // Restore tab bar container (individual tab visibility handled by bcRenderActions)
  var tabBar = document.querySelector('#screen-bubble-chat .bubble-tabs');
  if (tabBar) tabBar.style.display = '';
}

async function openBubbleChat(bubbleId, fromScreen) {
  if (!currentUser || !bubbleId) { console.warn('openBubbleChat: missing user or bubbleId'); return; }
  console.debug('[bc] openBubbleChat:', bubbleId, 'from:', fromScreen);

  // 1. Navigate + cleanup previous
  // If navigating from one bubble to another (e.g. parent → child event),
  // store previous bubble so back can reopen it
  var prevBubbleId = (fromScreen === 'screen-bubble-chat' && bcBubbleId) ? bcBubbleId : null;
  var prevTab = prevBubbleId ? _bcActiveTab : null;
  bcUnsubscribe();
  bcBubbleId = bubbleId;
  navState.bubbleChatId = bubbleId;

  // Persist route state for browser back/restore
  try {
    sessionStorage.setItem('bb_route', JSON.stringify({
      bubbleId: bubbleId,
      parentBubbleId: prevBubbleId || null,
      parentTab: prevTab || null,
      backTarget: fromScreen || 'screen-home'
    }));
  } catch(e) {}

  var backBtn = document.getElementById('bc-back-btn');
  var _bcBackFn;
  if (prevBubbleId) {
    _bcBackFn = function() {
      openBubbleChat(prevBubbleId, 'screen-bubbles');
      // Always land on info when returning to parent — shows hierarchy context
    };
  } else {
    _bcBackFn = function() { goTo(fromScreen || 'screen-home'); };
  }
  // If member tapped ⓘ to view info temporarily, back returns to previous tab
  // For non-members, info IS the landing tab — back should navigate away
  backBtn.onclick = function() {
    _bcBackFn();
  };

  // Reset ALL visible state BEFORE showing screen — prevents previous bubble flashing
  document.getElementById('bc-name').textContent = '';
  document.getElementById('bc-members-count').textContent = '';
  var iconEl = document.getElementById('bc-topbar-icon');
  if (iconEl) iconEl.innerHTML = '';
  var actionBtns = document.getElementById('bc-action-btns');
  if (actionBtns) { actionBtns.innerHTML = ''; actionBtns.style.display = 'none'; }
  // Clear old content from ALL panels (sub-loaders will repopulate)
  ['bc-members-list','bc-messages','bc-info-list','bc-posts-list','bc-events-list'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = '';
  });
  var pendingBanner = document.getElementById('bc-pending-banner');
  if (pendingBanner) pendingBanner.style.display = 'none';
  var tabBar = document.querySelector('#screen-bubble-chat .bubble-tabs');
  if (tabBar) tabBar.style.display = 'none';
  ['chat','members','info','posts','events'].forEach(function(t) {
    var p = document.getElementById('bc-panel-' + t);
    if (p) p.style.display = 'none';
    var tab = document.getElementById('bc-tab-' + t);
    if (tab) tab.style.display = 'none';
  });
  var actionBar = document.getElementById('bc-action-bar');
  if (actionBar) actionBar.style.display = 'none';

  // NOW show the clean screen + skeleton
  goTo('screen-bubble-chat');
  _bcShowSkeleton();

  // 2. Load all data
  var backTarget = prevBubbleId ? 'screen-bubbles' : (fromScreen || 'screen-home');
  try {
    var success = await bcLoadChatData(bubbleId);
    _bcHideSkeleton();
    if (!success) {
      if (prevBubbleId) { openBubbleChat(prevBubbleId, 'screen-bubbles'); }
      else { goTo(backTarget); }
      return;
    }
  } catch(e) {
    _bcHideSkeleton();
    logError("openBubbleChat:load", e);
    _renderToast(t('err_open_bubble'), 'error');
    if (prevBubbleId) { openBubbleChat(prevBubbleId, 'screen-bubbles'); }
    else { goTo(backTarget); }
    return;
  }

  // 3. Subscribe AFTER data is ready (members only — non-members just view static data)
  if (bcBubbleData._isMember) bcSubscribeRealtime();
}

// ── Pure data loading: fetch bubble, membership, roles, render UI ──
// Split into 4 clear phases for maintainability
async function bcLoadChatData(bubbleId) {
  // Phase 1: Load bubble core data + render topbar
  var b = await bcLoadBubbleCore(bubbleId);
  if (!b) return false;

  // Phase 2: Configure tabs (Events/Opslag visibility)
  await bcConfigureTabs(b, bubbleId);

  // Phase 3: Load membership + roles + render actions + pending banner
  await bcLoadMembership(b, bubbleId);

  // Phase 4: Load initial tab data
  // Members: members + messages. Non-members: members only (chat tab hidden).
  var phase4 = [bcLoadMembers()];
  if (bcBubbleData._isMember) phase4.push(bcLoadMessages());
  await Promise.all(phase4);

  // Mark bubble chat as read
  if (bcBubbleData._isMember) {
    sb.from('bubble_members').update({ last_read_at: new Date().toISOString() }).eq('bubble_id', bubbleId).eq('user_id', currentUser.id).then(function() {
      delete _bubbleUnreadSet[bubbleId];
      _renderBubblesUnreadDot();
      _renderSubTabDots();
    });
  }

  return true;
}

// Phase 1: Fetch bubble, set bcBubbleData, render topbar
async function bcLoadBubbleCore(bubbleId) {
  var { data: b, error: bErr } = await sb.from('bubbles').select('*').eq('id', bubbleId).maybeSingle();
  if (!b || bErr) { _renderToast('Denne boble eksisterer ikke længere', 'error'); return null; }
  bcBubbleData = b;

  // Topbar
  // Topbar icon
  var isEvent = b.type === 'event' || b.type === 'live';
  var iconEl = document.getElementById('bc-topbar-icon');
  if (iconEl) {
    iconEl.style.background = isEvent ? 'rgba(46,207,207,0.1)' : 'rgba(124,92,252,0.1)';
    iconEl.innerHTML = b.icon_url ? '<img src="' + escHtml(b.icon_url) + '" style="width:1.2rem;height:1.2rem;border-radius:4px;object-fit:cover">' : bubbleEmoji(b.type);
  }
  document.getElementById('bc-name').textContent = b.name;

  // Member count + parent ref in subtitle
  var { count: memberCount } = await sb.from('bubble_members').select('*',{count:'exact',head:true}).eq('bubble_id', bubbleId).or('status.is.null,status.neq.pending');
  memberCount = memberCount || 0;
  var subText = memberCount + (isEvent ? ' ' + t('bb_participants') : ' ' + t('bb_members'));
  // Fetch parent name for child bubbles
  if (b.parent_bubble_id) {
    try {
      var { data: parentB } = await sb.from('bubbles').select('name').eq('id', b.parent_bubble_id).maybeSingle();
      if (parentB) subText += ' · <span style="color:#534AB7">\u21B3 ' + escHtml(parentB.name) + '</span>';
    } catch(e) {}
  }
  document.getElementById('bc-members-count').innerHTML = subText;

  return b;
}

// Phase 2: Show/hide tabs based on bubble type + children
async function bcConfigureTabs(b, bubbleId) {
  try {
    var isEvent = b.type === 'event' || b.type === 'live';
    var tabMembers = document.getElementById('bc-tab-members');
    var tabPosts = document.getElementById('bc-tab-posts');

    if (tabMembers) tabMembers.textContent = isEvent ? 'Deltagere' : 'Medlemmer';
    if (tabPosts) tabPosts.style.display = '';
  } catch(e) { logError('bcConfigureTabs', e); }
}

// Phase 3: Load membership, roles, pending state, action buttons
async function bcLoadMembership(b, bubbleId) {
  var [upvoteRes, memberRes, roleRes] = await Promise.all([
    loadBubbleUpvotes().catch(function() {}),
    sb.from('bubble_members').select('id,status').eq('bubble_id', bubbleId).eq('user_id', currentUser.id).maybeSingle(),
    sb.from('bubble_members').select('role').eq('bubble_id', bubbleId).eq('user_id', currentUser.id).maybeSingle()
  ]);
  var myMembership = memberRes?.data;
  var myRole = roleRes?.data;
  var isPending = myMembership && myMembership.status === 'pending';
  var isOwner = b.created_by === currentUser.id;
  var isBubbleAdmin = myRole && myRole.role === 'admin';
  var canEdit = isOwner || isBubbleAdmin;
  bcBubbleData._isOwner = isOwner;
  bcBubbleData._isAdmin = isBubbleAdmin;
  bcBubbleData._canEdit = canEdit;
  bcBubbleData._isPending = isPending;
  bcBubbleData._isMember = !!myMembership && !isPending;

  // Pending membership banner
  bcRenderPendingBanner(isPending);

  // Action buttons + tab gating
  bcRenderActions(b, myMembership, canEdit, isPending);

  // Event greeting banner (shown once after QR auto-checkin)
  _bcShowEventGreeting();

  // Auto check-in: if member opens an event that is currently "I gang"
  if (bcBubbleData._isMember && (b.type === 'event' || b.type === 'live') && b.event_date) {
    await _bcAutoCheckin(b, bubbleId);
  }

  // Live polling: refresh member list every 15s for active events
  // (postgres_changes may not deliver other users' check-ins due to RLS)
  if (_bcLivePollTimer) { clearInterval(_bcLivePollTimer); _bcLivePollTimer = null; }
  if (bcBubbleData._isMember && (b.type === 'event' || b.type === 'live') && b.event_date) {
    var _pollNow = new Date();
    var _pollStart = new Date(b.event_date);
    var _pollEnd = b.event_end_date ? new Date(b.event_end_date) : new Date(_pollStart.getTime() + 4 * 3600000);
    if (_pollNow >= _pollStart && _pollNow <= _pollEnd) {
      _bcLivePollTimer = setInterval(function() {
        if (_activeScreen === 'screen-bubble-chat' && bcBubbleId === bubbleId) {
          bcLoadMembers();
        } else {
          clearInterval(_bcLivePollTimer); _bcLivePollTimer = null;
        }
      }, 15000);
    }
  }
}

// ── Event greeting banner (shown once after QR auto-checkin) ──
function _bcShowEventGreeting() {
  var eventName;
  try { eventName = sessionStorage.getItem('event_greeting'); } catch(e) { return; }
  if (eventName === null) return;
  // Consume immediately so it only shows once
  try { sessionStorage.removeItem('event_greeting'); } catch(e) {}

  var banner = document.createElement('div');
  banner.id = 'bc-event-greeting';
  banner.style.cssText = 'padding:0.6rem 1rem;margin:0.5rem 1.1rem 0;border-radius:10px;background:rgba(26,158,142,0.08);border:1px solid rgba(26,158,142,0.18);font-size:0.8rem;color:#085041;font-weight:600;display:flex;align-items:center;gap:0.5rem;cursor:pointer;animation:fadeSlideUp 0.3s ease';
  banner.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1A9E8E" stroke-width="2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>' +
    '<span>' + t('event_greeting', { name: escHtml(eventName) }) + '</span>';
  banner.onclick = function() { banner.remove(); };

  var anchor = document.getElementById('bc-action-bar');
  if (anchor) anchor.insertAdjacentElement('afterend', banner);

  // Auto-dismiss after 6 seconds
  setTimeout(function() {
    if (banner.parentNode) {
      banner.style.transition = 'opacity 0.4s ease';
      banner.style.opacity = '0';
      setTimeout(function() { banner.remove(); }, 400);
    }
  }, 6000);
}

// ── Auto check-in for active events ──
async function _bcAutoCheckin(b, bubbleId) {
  try {
    var now = new Date();
    var start = new Date(b.event_date);
    var end = b.event_end_date ? new Date(b.event_end_date) : new Date(start.getTime() + 4 * 3600000);
    // Only if event is "I gang"
    if (now < start || now > end) return;

    // Check if already checked in
    var { data: mem } = await sb.from('bubble_members')
      .select('checked_in_at, checked_out_at')
      .eq('bubble_id', bubbleId).eq('user_id', currentUser.id)
      .maybeSingle();
    if (mem && mem.checked_in_at && !mem.checked_out_at) {
      // Already live — just ensure live state is synced
      if (typeof loadLiveBubbleStatus === 'function') loadLiveBubbleStatus();
      return;
    }

    // Auto check-in
    var ciResult = await dbActions.checkIn(bubbleId);
    if (!ciResult.ok) {
      console.warn('[_bcAutoCheckin] checkIn failed:', ciResult.error);
      return;
    }

    // Update client-side live state
    if (typeof loadLiveBubbleStatus === 'function') await loadLiveBubbleStatus();
    if (typeof loadLiveBanner === 'function') loadLiveBanner();

    // Refresh member list to show live dot
    bcLoadMembers();
    // Show check-in confirmation modal (requires active dismiss)
    if (typeof showCheckinModal === 'function') showCheckinModal(b.name || '', { inEvent: true });
  } catch(e) { logError('_bcAutoCheckin', e); }
}

// ── Manual check-in button handler ──
async function bcManualCheckIn() {
  if (!currentUser || !bcBubbleId) return;
  try {
    var result = await dbActions.checkIn(bcBubbleId);
    if (result.ok) {
      if (typeof loadLiveBubbleStatus === 'function') await loadLiveBubbleStatus();
      if (typeof loadLiveBanner === 'function') loadLiveBanner();
      bcLoadMembers();
      // Show check-in confirmation modal (requires active dismiss)
      var evName = bcBubbleData ? bcBubbleData.name : '';
      if (typeof showCheckinModal === 'function') showCheckinModal(evName, { inEvent: true });
    }
  } catch(e) { logError('bcManualCheckIn', e); }
}

// Render or hide pending membership banner
function bcRenderPendingBanner(isPending) {
  var pendingBanner = document.getElementById('bc-pending-banner');
  if (!pendingBanner) {
    var anchor = document.getElementById('bc-action-bar');
    if (anchor) {
      var pb = document.createElement('div');
      pb.id = 'bc-pending-banner';
      pb.style.cssText = 'display:none;padding:0.55rem 1rem;margin:0.4rem 1.1rem 0;border-radius:10px;background:rgba(249,177,55,0.08);border:1px solid rgba(249,177,55,0.2);font-size:0.75rem;color:#854F0B;font-weight:600';
      anchor.insertAdjacentElement('afterend', pb);
      pendingBanner = pb;
    }
  }
  if (pendingBanner) {
    if (isPending) {
      pendingBanner.style.display = 'flex';
      pendingBanner.style.alignItems = 'center';
      pendingBanner.style.justifyContent = 'space-between';
      pendingBanner.style.gap = '0.5rem';
      pendingBanner.innerHTML = '<div style="display:flex;align-items:center;gap:6px"><span style="width:8px;height:8px;border-radius:50%;background:#F59E0B;animation:livePulse 1.5s infinite;flex-shrink:0"></span> Afventer godkendelse</div>' +
        '<button onclick="bcCancelPending()" style="font-size:0.65rem;padding:3px 10px;border-radius:6px;border:1px solid rgba(133,79,11,0.2);background:none;color:#854F0B;cursor:pointer;font-family:inherit;font-weight:600;flex-shrink:0">Annuller</button>';
    } else {
      pendingBanner.style.display = 'none';
    }
  }
}

async function bcCancelPending() {
  if (!bcBubbleId || !currentUser) return;
  try {
    await sb.from('bubble_members').delete().eq('bubble_id', bcBubbleId).eq('user_id', currentUser.id);
    bcBubbleData._isPending = false;
    bcBubbleData._isMember = false;
    bcRenderPendingBanner(false);
    bcRenderActions(bcBubbleData, null, false, false);
    showToast('Anmodning annulleret');
  } catch(e) { logError('bcCancelPending', e); errorToast('delete', e); }
}

// ── Lightweight membership re-check (called by realtime INSERT/DELETE) ──
async function bcRefreshMembership() {
  if (!bcBubbleId || !bcBubbleData || !currentUser) return;
  try {
    var { data: myM } = await sb.from('bubble_members').select('id,status,role')
      .eq('bubble_id', bcBubbleId).eq('user_id', currentUser.id).maybeSingle();
    var wasMember = bcBubbleData._isMember;
    var wasAdmin = bcBubbleData._isAdmin;
    var wasOwner = bcBubbleData._isOwner;
    var isPending = myM && myM.status === 'pending';
    var isMember = !!myM && !isPending;
    bcBubbleData._isMember = isMember;
    bcBubbleData._isPending = isPending;
    bcBubbleData._isAdmin = myM && myM.role === 'admin';
    // Re-derive ownership from bubble data
    bcBubbleData._isOwner = currentUser && bcBubbleData.created_by === currentUser.id;
    bcBubbleData._canEdit = bcBubbleData._isOwner || bcBubbleData._isAdmin;

    // If any role/membership state changed, re-render UI
    var roleChanged = (wasMember !== isMember) || (wasAdmin !== bcBubbleData._isAdmin) || (wasOwner !== bcBubbleData._isOwner);
    if (roleChanged) {
      bcRenderActions(bcBubbleData, myM, bcBubbleData._canEdit, isPending);
      bcRenderPendingBanner(isPending);
      if (_bcActiveTab === 'info') bcLoadInfo();
      // If kicked: unsubscribe realtime, switch to info
      if (wasMember && !isMember) {
        if (bcSubscription) { bcSubscription.unsubscribe(); bcSubscription = null; }
        bcSwitchTab('info');
        _renderToast(t('bc_kicked'), 'error');
      }
      // Ownership gained
      if (!wasOwner && bcBubbleData._isOwner) {
        showSuccessToast(t('bc_you_are_owner'));
      }
      // Admin granted
      if (!wasAdmin && bcBubbleData._isAdmin) {
        showSuccessToast(t('bc_you_are_admin'));
      }
      // Pending → approved: start realtime + load chat
      if (!wasMember && isMember) {
        bcSubscribeRealtime();
        bcLoadMessages();
      }
    }
  } catch(e) { logError('bcRefreshMembership', e); }
}

// ── Render action buttons based on membership state ──
function bcRenderActions(b, myMembership, canEdit, isPending) {
  // Remove skeleton atomically as real UI appears (no-op if already removed)
  _bcHideSkeleton();

  var actionArea = document.getElementById('bc-action-btns');
  var actionBar = document.getElementById('bc-action-bar');
  var infoTab = document.getElementById('bc-tab-info');
  var chatTab = document.getElementById('bc-tab-chat');
  var postsTab = document.getElementById('bc-tab-posts');
  var isActiveMember = myMembership && !isPending;
  var membersTab = document.getElementById('bc-tab-members');

  if (isActiveMember) {
    // Active members: Medlemmer + Opslag + Chat + Info (accordion shows children)
    if (membersTab) membersTab.style.display = '';
    if (infoTab) infoTab.style.display = '';
    if (chatTab) chatTab.style.display = '';
    if (postsTab) postsTab.style.display = '';
    // Set initial tab — Info first so user sees hierarchy + context
    bcSwitchTab('info');
    // Edit button as topbar card
    var _scannerVisible = canEdit && (b.type === 'event' || b.type === 'live' || b.visibility === 'private' || b.visibility === 'hidden');
    if (_scannerVisible && (b.type === 'event' || b.type === 'live') && b.event_date) {
      var _evEnd = new Date(b.event_end_date || b.event_date);
      if (_evEnd < new Date()) _scannerVisible = false;
    }
    actionArea.innerHTML =
      (canEdit ? `<button class="chat-topbar-back" data-action="openEditBubble" data-id="${b.id}" title="Rediger"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M16.5 3.5a2.1 2.1 0 013 3L8 18l-4 1 1-4L16.5 3.5z"/></svg></button>` : '') +
      (_scannerVisible ? `<button class="chat-topbar-back" onclick="openBubbleScannerFromInfo('${b.id}')" title="Scanner" style="color:#1A9E8E"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 7V2h5M17 2h5v5M22 17v5h-5M7 22H2v-5"/><line x1="6" y1="12" x2="18" y2="12" stroke-dasharray="2 2"/></svg></button>` : '');
    actionArea.style.display = canEdit ? 'flex' : 'none';
    if (actionBar) {
      var upvoted = myUpvotes[b.id];
      actionBar.innerHTML =
        `<button class="bc-bar-btn" onclick="openInviteModal('${b.id}')">${icon('user-plus')} Invitér</button>` +
        `<button class="bc-bar-btn" onclick="shareBubbleLink('${b.id}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v7a2 2 0 002 2h12a2 2 0 002-2v-7"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg> Del</button>` +
        `<button class="bc-bar-btn${upvoted ? ' active' : ''}" id="bc-upvote-bar-btn" onclick="toggleBubbleUpvote('${b.id}')">${upvoted ? icon('checkCircle') : icon('rocket')} ${upvoted ? 'Anbefalet' : 'Anbefal'}</button>` +
        `<button class="bc-bar-btn" data-action="openQRModal" data-id="${b.id}">${icon('qrcode')} QR</button>`;
      actionBar.style.display = 'flex';
    }
  } else {
    // Non-members + pending: only Medlemmer + Info tabs
    if (membersTab) membersTab.style.display = '';
    if (infoTab) infoTab.style.display = '';
    if (chatTab) chatTab.style.display = 'none';
    if (postsTab) postsTab.style.display = 'none';
    if (actionBar) actionBar.style.display = 'none';
    actionArea.style.display = 'none';

    if (isPending) {
      actionArea.innerHTML = '';
    } else if (b.visibility === 'hidden') {
      actionArea.innerHTML = `<span style="font-size:0.75rem;color:var(--muted)">${icon("eye")} Kun via invitation</span>`;
    } else if (b.visibility === 'private') {
      actionArea.innerHTML = `<button class="btn-sm btn-accent" data-action="requestJoin" data-id="${b.id}">${icon("lock")} Anmod</button>`;
    } else {
      actionArea.innerHTML = `<button class="btn-sm btn-accent" data-action="joinBubble" data-id="${b.id}">+ Join</button>`;
    }
    // Non-members land on Info first so they can read about the bubble
    bcSwitchTab('info');
  }
  // Update chat lock state
  bcUpdateChatLockUI();
}

// ── Realtime subscription: only call AFTER data is loaded ──
function bcSubscribeRealtime() {
  if (!currentUser || !bcBubbleId) { console.warn('bcSubscribeRealtime: missing user or bubbleId'); return; }
  if (bcSubscription) bcSubscription.unsubscribe();
  bcSubscription = sb.channel('bc-' + bcBubbleId)
    .on('postgres_changes', {event:'INSERT', schema:'public', table:'bubble_messages', filter:`bubble_id=eq.${bcBubbleId}`},
      async (payload) => {
        const m = payload.new;
        if (m.user_id === currentUser.id) return;
        m.profiles = await getCachedProfile(m.user_id);
        const panel = document.getElementById('bc-panel-chat');
        if (panel.style.display !== 'none') {
          bcReduceMsg(m);
        } else {
          // Chat tab not visible — increment unread badge
          if (!document.querySelector('[data-bc-msg-id="' + m.id + '"]')) {
            const badge = document.getElementById('bc-unread-badge');
            badge.textContent = parseInt(badge.textContent||0) + 1;
            badge.style.display = 'inline-flex';
          }
        }
      })
    .on('postgres_changes', {event:'UPDATE', schema:'public', table:'bubble_messages', filter:`bubble_id=eq.${bcBubbleId}`},
      (payload) => {
        const m = payload.new;
        const bubbleEl = document.getElementById('bc-bubble-' + m.id);
        if (bubbleEl) {
          bubbleEl.textContent = m.content || '';
          if (m.edited) {
            const msgBody = bubbleEl.closest('.msg-body');
            if (msgBody && !msgBody.querySelector('.msg-edited')) {
              const e = document.createElement('span');
              e.className = 'msg-edited';
              e.textContent = t('misc_edited');
              const id = m.id;
              e.onclick = () => bcShowHistory(id);
              bubbleEl.appendChild(e);
            }
          }
        }
      })
    .on('postgres_changes', {event:'DELETE', schema:'public', table:'bubble_messages', filter:`bubble_id=eq.${bcBubbleId}`},
      (payload) => {
        const m = payload.old;
        if (!m) return;
        const msgEl = document.querySelector('[data-bc-msg-id="' + m.id + '"]');
        if (msgEl) {
          msgEl.style.transition = 'opacity 0.2s';
          msgEl.style.opacity = '0';
          setTimeout(function() { msgEl.remove(); }, 220);
        }
      })
    .on('postgres_changes', {event:'INSERT', schema:'public', table:'bubble_message_reactions', filter:`bubble_id=eq.${bcBubbleId}`},
      (payload) => {
        const r = payload.new;
        if (r && r.message_id) bcLoadReactions(r.message_id);
      })
    .on('postgres_changes', {event:'DELETE', schema:'public', table:'bubble_message_reactions', filter:`bubble_id=eq.${bcBubbleId}`},
      (payload) => {
        const r = payload.old;
        if (r && r.message_id) bcLoadReactions(r.message_id);
      })
    .on('postgres_changes', {event:'INSERT', schema:'public', table:'bubble_post_reactions', filter:`bubble_id=eq.${bcBubbleId}`},
      (payload) => {
        const r = payload.new;
        if (!r) return;
        if (!window._postLikeCounts) window._postLikeCounts = {};
        window._postLikeCounts[r.post_id] = (window._postLikeCounts[r.post_id] || 0) + 1;
        var countEl = document.getElementById('bp-like-count-' + r.post_id);
        if (countEl) countEl.textContent = window._postLikeCounts[r.post_id] || '';
        var expandCount = document.getElementById('bp-expand-like-count-' + r.post_id);
        if (expandCount) expandCount.textContent = window._postLikeCounts[r.post_id] || '';
      })
    .on('postgres_changes', {event:'DELETE', schema:'public', table:'bubble_post_reactions', filter:`bubble_id=eq.${bcBubbleId}`},
      (payload) => {
        const r = payload.old;
        if (!r) return;
        if (!window._postLikeCounts) window._postLikeCounts = {};
        window._postLikeCounts[r.post_id] = Math.max((window._postLikeCounts[r.post_id] || 1) - 1, 0);
        var countEl = document.getElementById('bp-like-count-' + r.post_id);
        if (countEl) countEl.textContent = window._postLikeCounts[r.post_id] > 0 ? window._postLikeCounts[r.post_id] : '';
        var expandCount = document.getElementById('bp-expand-like-count-' + r.post_id);
        if (expandCount) expandCount.textContent = window._postLikeCounts[r.post_id] > 0 ? window._postLikeCounts[r.post_id] : '';
      })
    .on('postgres_changes', {event:'INSERT', schema:'public', table:'bubble_posts', filter:`bubble_id=eq.${bcBubbleId}`},
      () => {
        // Nyt opslag — reload posts-tab for alle i boblen
        if (typeof bcLoadPosts === 'function') bcLoadPosts();
      })
    .on('postgres_changes', {event:'DELETE', schema:'public', table:'bubble_posts', filter:`bubble_id=eq.${bcBubbleId}`},
      (payload) => {
        const p = payload.old;
        if (!p) return;
        // Fjern opslaget fra DOM øjeblikkeligt
        var postEl = document.getElementById('bc-post-' + p.id);
        if (postEl) {
          postEl.style.transition = 'opacity 0.2s';
          postEl.style.opacity = '0';
          setTimeout(function() { postEl.remove(); }, 220);
        } else {
          // Fallback: reload posts
          if (typeof bcLoadPosts === 'function') bcLoadPosts();
        }
      })
    .on('postgres_changes', {event:'INSERT', schema:'public', table:'bubble_members', filter:`bubble_id=eq.${bcBubbleId}`},
      () => { bcLoadMembers(); bcLoadBubbleInfo(); bcRefreshMembership(); })
    .on('postgres_changes', {event:'UPDATE', schema:'public', table:'bubble_members', filter:`bubble_id=eq.${bcBubbleId}`},
      () => { bcLoadMembers(); bcLoadBubbleInfo(); bcRefreshMembership(); })
    .on('postgres_changes', {event:'DELETE', schema:'public', table:'bubble_members', filter:`bubble_id=eq.${bcBubbleId}`},
      () => { bcLoadMembers(); bcLoadBubbleInfo(); bcRefreshMembership(); })
    .on('postgres_changes', {event:'UPDATE', schema:'public', table:'bubbles', filter:`id=eq.${bcBubbleId}`},
      () => { bcLoadBubbleInfo(); bcLoadMembers(); if (_bcActiveTab === 'info') bcLoadInfo(); })
    .subscribe(typeof _rtStatusCallback === 'function' ? _rtStatusCallback('bc-' + bcBubbleId) : undefined);
}

async function bcLoadBubbleInfo() {
  if (_activeScreen !== 'screen-bubble-chat' || !bcBubbleId) return;
  try {
    const { data: b } = await sb.from('bubbles').select('*').eq('id', bcBubbleId).maybeSingle();
    if (!b) return;
    // Re-derive ownership from fresh data (critical for ownership transfer)
    var wasOwner = bcBubbleData ? bcBubbleData._isOwner : false;
    bcBubbleData = b;
    bcBubbleData._isOwner = currentUser && b.created_by === currentUser.id;
    // Membership flags from current state
    var { data: myM } = await sb.from('bubble_members').select('id,status,role')
      .eq('bubble_id', bcBubbleId).eq('user_id', currentUser.id).maybeSingle();
    var isPending = myM && myM.status === 'pending';
    bcBubbleData._isMember = !!myM && !isPending;
    bcBubbleData._isPending = isPending;
    bcBubbleData._isAdmin = myM && myM.role === 'admin';
    bcBubbleData._canEdit = bcBubbleData._isOwner || bcBubbleData._isAdmin;

    // If ownership just changed, re-render actions
    if (wasOwner !== bcBubbleData._isOwner) {
      bcRenderActions(bcBubbleData, myM, bcBubbleData._canEdit, isPending);
      if (_bcActiveTab === 'info') bcLoadInfo();
    }

    var iconEl = document.getElementById('bc-topbar-icon');
    if (iconEl) {
      var isEv = b.type === 'event' || b.type === 'live';
      iconEl.style.background = isEv ? 'rgba(46,207,207,0.1)' : 'rgba(124,92,252,0.1)';
      iconEl.innerHTML = b.icon_url ? '<img src="' + escHtml(b.icon_url) + '" style="width:1.2rem;height:1.2rem;border-radius:4px;object-fit:cover">' : bubbleEmoji(b.type);
    }
    document.getElementById('bc-name').textContent = b.name;

    var { count: memberCount2 } = await sb.from('bubble_members').select('*',{count:'exact',head:true}).eq('bubble_id', bcBubbleId).or('status.is.null,status.neq.pending');
    memberCount2 = memberCount2 || 0;
    var isEvent = b.type === 'event' || b.type === 'live';
    var statusText = memberCount2 + (isEvent ? ' ' + t('bb_participants') : ' ' + t('bb_members'));

    // Check membership + live status for subtitle
    var myMFull = null;
    try { var { data: mf } = await sb.from('bubble_members').select('checked_in_at,checked_out_at').eq('bubble_id', bcBubbleId).eq('user_id', currentUser.id).maybeSingle(); myMFull = mf; } catch(e) {}
    var isLive = myMFull && myMFull.checked_in_at && !myMFull.checked_out_at && (Date.now() - new Date(myMFull.checked_in_at).getTime() < 6*3600000);
    var countEl = document.getElementById('bc-members-count');
    if (countEl) {
      if (isLive) {
        var expiry = new Date(new Date(myMFull.checked_in_at).getTime() + 6*3600000);
        var hh = expiry.getHours().toString().padStart(2,'0');
        var mm = expiry.getMinutes().toString().padStart(2,'0');
        countEl.innerHTML = statusText + ' · <span style="color:#1A9E8E">LIVE</span> <span style="opacity:0.6">udl. ' + hh + ':' + mm + '</span>';
      } else if (myMFull) {
        countEl.textContent = statusText + ' · Medlem ✓';
      } else {
        countEl.textContent = statusText;
      }
    }
    // Always refresh chat lock UI when bubble data changes
    bcUpdateChatLockUI();
  } catch(e) { logError("bcLoadBubbleInfo", e); }
}

var _bcActiveTab = 'info';

function bcToggleInfo() {
  if (_bcActiveTab === 'info') {
    // Already on info → go back to previous content tab
    bcSwitchTab(_bcPrevTab || 'members');
  } else {
    _bcPrevTab = _bcActiveTab;
    bcSwitchTab('info');
  }
}
var _bcPrevTab = null;

function bcSwitchTab(tab) {
  if (tab === 'events') tab = 'info'; // v8.6.1: events tab removed, redirect to info
  _bcActiveTab = tab;
  ['chat','members','info','posts'].forEach(t => {
    const panel = document.getElementById('bc-panel-'+t);
    const tabBtn = document.getElementById('bc-tab-'+t);
    if (panel) {
      if (t === tab) {
        panel.style.display = 'flex';
        panel.style.flexDirection = 'column';
        panel.style.flex = '1';
        panel.style.overflow = 'hidden';
      } else {
        panel.style.display = 'none';
      }
    }
    if (tabBtn) tabBtn.classList.toggle('active', t === tab);
  });
  if (tab === 'chat') {
    const badge = document.getElementById('bc-unread-badge');
    if (badge) badge.style.display = 'none';
    setTimeout(() => bcScrollToBottom(), 100);
    // Opdater last_read_at og ryd nav unread dot
    if (bcBubbleId && currentUser) {
      sb.from('bubble_members').update({ last_read_at: new Date().toISOString() })
        .eq('bubble_id', bcBubbleId).eq('user_id', currentUser.id).then(function() {
          if (typeof _bubbleUnreadSet !== 'undefined') {
            delete _bubbleUnreadSet[bcBubbleId];
            if (typeof _renderBubblesUnreadDot === 'function') _renderBubblesUnreadDot();
            if (typeof _renderSubTabDots === 'function') _renderSubTabDots();
          }
        });
    }
  }
  if (tab === 'info') bcLoadInfo();
  if (tab === 'posts') bcLoadPosts();
}

async function bcLoadEvents() {
  var list = document.getElementById('bc-events-list');
  if (!list || !bcBubbleId || _activeScreen !== 'screen-bubble-chat') return;
  list.innerHTML = skelCards(3);
  try {
    var { data: children } = await sb.from('bubbles')
      .select('*, bubble_members(count)')
      .eq('parent_bubble_id', bcBubbleId)
      .order('event_date', { ascending: true, nullsFirst: false })
      .limit(30);
    if (!children || children.length === 0) {
      var canEdit = bcBubbleData?._canEdit;
      list.innerHTML = '<div class="empty-state">' +
        '<div class="empty-icon">' + icon('bubble') + '</div>' +
        '<div class="empty-text">Ingen tilknyttede endnu</div>' +
        (canEdit ? '<div class="empty-cta">' +
          '<button class="btn-primary" onclick="openCreateEventFromBubble(\'' + bcBubbleId + '\')" style="font-size:0.82rem;padding:0.6rem 1.2rem;margin-bottom:0.4rem">' + icon('calendar') + ' Opret event</button>' +
          '<button class="btn-secondary" onclick="openCreateSubBubble(\'' + bcBubbleId + '\')" style="font-size:0.78rem;padding:0.5rem 1rem">' + icon('bubble') + ' Opret sub-boble</button>' +
          '</div>' : '') +
        '</div>';
      return;
    }
    var now = new Date();
    // Fetch member avatars for all children
    var childIds = children.map(function(ch) { return ch.id; });
    var memberMap = await fetchMemberAvatarsForBubbles(childIds, 4);

    var html = children.map(function(ch) {
      var mc = ch.bubble_members?.[0]?.count || 0;
      var isEvent = ch.type === 'event' || ch.type === 'live';
      var avStack = renderAvatarStack(memberMap[ch.id] || [], mc);

      if (isEvent) {
        var evDate = ch.event_date ? new Date(ch.event_date) : null;
        var isPast = evDate && new Date(ch.event_end_date || ch.event_date) < now;
        var dateStr = evDate
          ? evDate.toLocaleDateString(_locale(), { weekday: 'short', day: 'numeric', month: 'short' }) +
            (evDate.getHours() > 0 ? (_lang === 'da' ? ' kl. ' : ' at ') + evDate.toLocaleTimeString(_locale(), { hour: '2-digit', minute: '2-digit' }) +
              (ch.event_end_date ? ' – ' + new Date(ch.event_end_date).toLocaleTimeString(_locale(), { hour: '2-digit', minute: '2-digit' }) : '')
            : '')
          : new Date(ch.created_at).toLocaleDateString(_locale(), { day: 'numeric', month: 'short' });
        var badge = isPast
          ? '<span style="font-size:0.6rem;padding:2px 6px;border-radius:4px;background:rgba(30,27,46,0.06);color:var(--muted)">Afsluttet</span>'
          : '<span style="font-size:0.6rem;padding:2px 6px;border-radius:4px;background:rgba(46,207,207,0.1);color:#0F6E56">Kommende</span>';
        return '<div class="card" style="padding:0.75rem 0.9rem;margin-bottom:0.4rem;cursor:pointer" onclick="openBubbleChat(\'' + ch.id + '\',\'screen-bubble-chat\')">' +
          '<div style="display:flex;align-items:center;gap:0.6rem">' +
          '<div style="width:38px;height:38px;border-radius:10px;background:' + (isPast ? 'rgba(30,27,46,0.04)' : 'rgba(46,207,207,0.08)') + ';display:flex;align-items:center;justify-content:center;font-size:0.9rem;flex-shrink:0">' + icon('calendar') + '</div>' +
          '<div style="flex:1;min-width:0">' +
          '<div style="display:flex;align-items:center;gap:0.4rem"><span class="fw-600 fs-085" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escHtml(ch.name) + '</span>' + badge + '</div>' +
          '<div class="fs-072 text-muted">' + dateStr + ' · ' + mc + ' deltager' + (mc !== 1 ? 'e' : '') + '</div>' +
          avStack +
          '</div>' +
          '<div style="font-size:0.88rem;color:var(--muted)">›</div></div></div>';
      } else {
        // Sub-bubble (network type)
        return '<div class="card" style="padding:0.75rem 0.9rem;margin-bottom:0.4rem;cursor:pointer" onclick="openBubbleChat(\'' + ch.id + '\',\'screen-bubble-chat\')">' +
          '<div style="display:flex;align-items:center;gap:0.6rem">' +
          '<div style="width:38px;height:38px;border-radius:10px;background:rgba(124,92,252,0.08);display:flex;align-items:center;justify-content:center;font-size:0.9rem;flex-shrink:0;overflow:hidden">' + (ch.icon_url ? '<img src="' + escHtml(ch.icon_url) + '" style="width:100%;height:100%;object-fit:cover;border-radius:10px">' : bubbleEmoji(ch.type)) + '</div>' +
          '<div style="flex:1;min-width:0">' +
          '<div class="fw-600 fs-085" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escHtml(ch.name) + '</div>' +
          '<div class="fs-072 text-muted">' + typeLabel(ch.type) + ' · ' + mc + ' medlem' + (mc !== 1 ? 'mer' : '') + '</div>' +
          avStack +
          '</div>' +
          '<div style="font-size:0.88rem;color:var(--muted)">›</div></div></div>';
      }
    }).join('');
    // Add create buttons for owners
    if (bcBubbleData?._canEdit) {
      html += '<div style="display:flex;gap:0.4rem;margin-top:0.8rem">' +
        '<button onclick="openCreateEventFromBubble(\'' + bcBubbleId + '\')" style="flex:1;padding:0.6rem;border-radius:12px;background:rgba(46,207,207,0.05);border:1px solid rgba(46,207,207,0.15);color:#085041;font-size:0.78rem;font-weight:700;cursor:pointer;font-family:var(--font);display:flex;align-items:center;justify-content:center;gap:0.35rem"> + ' + icon('calendar') + ' Event</button>' +
        '<button onclick="openCreateSubBubble(\'' + bcBubbleId + '\')" style="flex:1;padding:0.6rem;border-radius:12px;background:rgba(124,92,252,0.05);border:1px solid rgba(124,92,252,0.15);color:#534AB7;font-size:0.78rem;font-weight:700;cursor:pointer;font-family:var(--font);display:flex;align-items:center;justify-content:center;gap:0.35rem"> + ' + icon('bubble') + ' Sub-boble</button>' +
        '</div>';
    }
    list.innerHTML = html;
  } catch(e) {
    logError('bcLoadEvents', e);
    showRetryState('bc-events-list', 'bcLoadEvents', t('toast_load_failed'));
  }
}

async function bcLoadMessages() {
  if (_activeScreen !== 'screen-bubble-chat' || !bcBubbleId) return;
  try {
    const el = document.getElementById('bc-messages');
    el.innerHTML = skelMessages(6);

    // Hent beskeder uden profiles join — henter profiler separat
    const { data: msgs, error: msgErr } = await sb.from('bubble_messages')
      .select('id, bubble_id, user_id, content, file_url, file_name, file_size, file_type, edited, created_at')
      .eq('bubble_id', bcBubbleId)
      .order('created_at', {ascending:true})
      .limit(50);

    if (msgErr) console.error('bcLoadMessages error:', msgErr);

    if (!msgs || msgs.length === 0) {
      var bName = bcBubbleData?.name || 'boblen';
      el.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;padding:3rem 1.5rem 1rem;text-align:center">' +
        '<div style="width:48px;height:48px;border-radius:14px;background:rgba(124,92,252,0.08);display:flex;align-items:center;justify-content:center;margin-bottom:0.6rem">' + icon('chat') + '</div>' +
        '<div style="font-size:0.88rem;font-weight:700">Start samtalen</div>' +
        '<div style="font-size:0.72rem;color:var(--muted);margin-top:0.2rem">Skriv den første besked i ' + escHtml(bName) + '</div>' +
        '</div>';
      return;
    }

    // Hent unikke profiler separat
    const userIds = [...new Set(msgs.map(m => m.user_id))];
    const { data: profiles } = await sb.from('profiles').select('id, name, title, workplace, avatar_url').in('id', userIds);
    const profileMap = {};
    (profiles || []).forEach(p => profileMap[p.id] = p);

    el.innerHTML = '';
    let lastDate = '';

    // Compute grouping
    _msgComputeGroups(msgs, 'user_id');

    msgs.forEach(m => {
      m.profiles = profileMap[m.user_id] || { name: '?' };
      const d = new Date(m.created_at).toLocaleDateString(_locale(), {weekday:'short', day:'numeric', month:'short'});
      if (d !== lastDate) {
        const sep = document.createElement('div');
        sep.className = 'chat-date-sep';
        sep.textContent = d;
        el.appendChild(sep);
        lastDate = d;
      }
      // Time separator between groups with 5+ min gap
      if (m._showTimeSep) {
        var ts = document.createElement('div');
        ts.className = 'msg-time-sep';
        ts.textContent = new Date(m.created_at).toLocaleTimeString(_locale(), {hour:'2-digit', minute:'2-digit'});
        el.appendChild(ts);
      }
      el.appendChild(bcRenderMsg(m));
    });
    bcScrollToBottom();
  } catch(e) { logError("bcLoadMessages", e); errorToast("load", e); }
}

// ══════════════════════════════════════════════════════════
//  BUBBLE CHAT MESSAGE REDUCER — single entry point for all BC message inserts
//  Deduplicates by msg.id before any DOM mutation
// ══════════════════════════════════════════════════════════
function bcReduceMsg(msg) {
  if (!msg || !msg.id) return false;
  var msgEl = document.getElementById('bc-messages');
  if (!msgEl) return false;

  // Dedup: skip if already in DOM
  if (document.querySelector('[data-bc-msg-id="' + msg.id + '"]')) return false;

  // Clear empty state
  var emptyState = msgEl.querySelector('.empty-state');
  if (emptyState) emptyState.remove();

  // Append rendered message
  msgEl.appendChild(bcRenderMsg(msg));
  bcScrollToBottom();
  return true;
}

function bcRenderMsg(m) {
  const isMe = m.user_id === currentUser.id;
  const p = m.profiles || {};
  const name = p.name || '?';
  const initials = name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  const gp = m._gp || 'single';
  const showAvatar = !isMe && (gp === 'tail' || gp === 'single');
  const showName = !isMe && (gp === 'first' || gp === 'single');

  const row = document.createElement('div');
  row.className = 'msg-row msg-' + gp + (isMe ? ' me' : '');
  row.id = 'bc-msg-' + m.id;
  row.setAttribute('data-bc-msg-id', m.id);
  row.setAttribute('oncontextmenu', "if(!window.getSelection().toString()){event.preventDefault();bcLongPress('" + m.id + "'," + isMe + ")}");
  row.setAttribute('ontouchstart', "bcTouchStart(event,'" + m.id + "'," + isMe + ")");
  row.setAttribute('ontouchend', 'bcTouchEnd()');
  row.setAttribute('ontouchmove', 'bcTouchEnd()');

  let bubble = '';
  if (m.file_url) {
    const safeUrl = escHtml(m.file_url);
    const ext = m.file_name?.split('.').pop()?.toLowerCase() || '';
    const isImg = ['jpg','jpeg','png','gif','webp'].includes(ext) || (m.file_type||'').startsWith('image/');
    if (isImg) {
      bubble = '<a href="javascript:void(0)" onclick="chatLightbox(\'' + safeUrl + '\')"><img class="msg-img" src="' + safeUrl + '" alt="' + escHtml(m.file_name||'') + '"></a>';
    } else {
      const sz = m.file_size ? (m.file_size < 1048576 ? Math.round(m.file_size/1024)+'KB' : (m.file_size/1048576).toFixed(1)+'MB') : '';
      bubble = '<a class="msg-file" href="' + safeUrl + '" target="_blank" rel="noopener">' + icon('clip') + ' ' + escHtml(m.file_name||'Fil') + ' <span class="msg-file-sz">' + sz + '</span></a>';
    }
  } else {
    var content = m.content || '';
    var edited = m.edited ? ' <span class="msg-edited" onclick="bcShowHistory(\'' + m.id + '\')">' + t('misc_edited') + '</span>' : '';
    if (isEmojiOnly(content)) {
      bubble = '<div class="msg-emoji" id="bc-bubble-' + m.id + '">' + escHtml(content) + '</div>';
    } else {
      bubble = '<div class="msg-bubble' + (isMe ? ' sent' : '') + '" id="bc-bubble-' + m.id + '">' + linkify(escHtml(filterChatContent(content))) + edited + '</div>';
    }
  }

  var nameHtml = escHtml(name);
  var safeTitle = escHtml(p.title||'');
  var bcAvUrl = isMe ? currentProfile?.avatar_url : (p.avatar_url || null);
  var bcAvInner = bcAvUrl ? '<img src="' + bcAvUrl + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%">' : initials;
  var avatarColor = 'linear-gradient(135deg,#CECBF6,#AFA9EC)';
  var avatarStyle = isMe ? 'display:none' : ('background:' + avatarColor + ';overflow:hidden' + (showAvatar ? ';cursor:pointer' : ';visibility:hidden'));
  var avatarClick = showAvatar ? " onclick=\"bcOpenPerson('" + m.user_id + "','" + nameHtml + "','" + safeTitle + "','" + avatarColor + "')\"" : '';

  // Timestamp on tail/single — skip if time separator was just shown
  var timeHtml = '';
  if ((gp === 'single' || gp === 'tail') && !m._showTimeSep) {
    var msgTime = new Date(m.created_at);
    timeHtml = '<div class="msg-timestamp">' + msgTime.toLocaleTimeString(_locale(), {hour:'2-digit', minute:'2-digit'}) + '</div>';
  }

  // Sender name on first/single (group chat context)
  var nameRow = showName ? '<div class="msg-sender-name">' + nameHtml + '</div>' : '';

  row.innerHTML =
    '<div class="msg-avatar"' + avatarClick + ' style="' + avatarStyle + '">' + bcAvInner + '</div>' +
    '<div class="msg-body">' +
      nameRow +
      '<div class="msg-content">' + bubble + '</div>' +
      '<div class="msg-reactions" id="bc-reactions-' + m.id + '"></div>' +
      timeHtml +
    '</div>';

  setTimeout(() => bcLoadReactions(m.id), 80);
  return row;
}

function bcScrollToBottom() {
  const el = document.getElementById('bc-messages');
  if (el) el.scrollTop = el.scrollHeight;
}

var _profileCache = {};

async function getCachedProfile(userId) {
  try {
  if (_profileCache[userId]) return _profileCache[userId];
  var { data: p } = await sb.from('profiles').select('name,title,workplace,avatar_url').eq('id', userId).maybeSingle();
  if (p) _profileCache[userId] = p;
  return p || {};
  } catch(e) { logError("getCachedProfile", e); }
}

let bcSending = false;
// ── Chat lock: owner/admin can disable chat for members ──
async function bcToggleChatLock(bubbleId, locked) {
  var result = await dbActions.updateBubble(bubbleId, { chat_locked: locked });
  if (!result.ok) {
    // Column may not exist if migration hasn't been run
    if (result.error && String(result.error.message || '').includes('chat_locked')) {
      showWarningToast('Chat-lås kræver database-migration');
      return;
    }
    return;
  }
  if (bcBubbleData) bcBubbleData.chat_locked = locked;
  bcUpdateChatLockUI();
  // Update toggle visual state without full re-render
  var toggleEl = document.querySelector('#bc-panel-info input[type="checkbox"][onchange*="bcToggleChatLock"]');
  if (toggleEl) {
    var track = toggleEl.nextElementSibling;
    var knob = track ? track.nextElementSibling : null;
    if (track) track.style.background = locked ? 'var(--accent)' : 'var(--border)';
    if (knob) knob.style.left = locked ? '18px' : '2px';
  }
  showSuccessToast(locked ? t('bc_chat_closed') : t('bc_chat_opened'));
}

function bcUpdateChatLockUI() {
  var composer = document.querySelector('#bc-panel-chat .chat-composer');
  var lockBanner = document.getElementById('bc-chat-lock-banner');
  if (!bcBubbleData) return;
  var locked = bcBubbleData.chat_locked || false;
  var canPost = bcBubbleData._isOwner || bcBubbleData._isAdmin;

  if (locked && !canPost) {
    // Hide composer, show banner
    if (composer) composer.style.display = 'none';
    if (!lockBanner) {
      lockBanner = document.createElement('div');
      lockBanner.id = 'bc-chat-lock-banner';
      lockBanner.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:6px;padding:12px 16px;background:rgba(245,158,11,0.06);border-top:1px solid rgba(245,158,11,0.15);color:#78350F;font-size:0.75rem;font-weight:600';
      lockBanner.innerHTML = '<span style="font-size:13px;display:flex">' + ico('lock') + '</span> ' + t('bc_chat_locked');
      var panel = document.getElementById('bc-panel-chat');
      if (panel) panel.appendChild(lockBanner);
    }
    lockBanner.style.display = 'flex';
  } else {
    // Show composer, hide banner
    if (composer) composer.style.display = '';
    if (lockBanner) lockBanner.style.display = 'none';
  }
}

async function bcSendMessage() {
  try {
  if (bcSending) return;
  // Chat lock guard
  if (bcBubbleData?.chat_locked && !bcBubbleData._isOwner && !bcBubbleData._isAdmin) {
    showWarningToast(t('bc_chat_locked'));
    return;
  }
  bcSending = true;
  var sendBtn = document.getElementById("bc-send-btn");
  if (sendBtn) { sendBtn.disabled = true; }
  console.debug('[bc] bcSendMessage');
  try {
    const inp = document.getElementById('bc-input');
    const text = filterChatContent(inp.value.trim());
    if (!text) { bcSending = false; if (sendBtn) { sendBtn.disabled = false; } return; }

    if (bcEditingId) {
      // Save edit to history first
      const { data: orig } = await sb.from('bubble_messages').select('content').eq('id', bcEditingId).maybeSingle();
      if (orig) {
        await sb.from('bubble_message_edits').insert({message_id: bcEditingId, content: orig.content});
      }
      await sb.from('bubble_messages').update({content: text, edited: true, updated_at: new Date().toISOString()}).eq('id', bcEditingId).eq('user_id', currentUser.id);
      // Update local
      const bubbleEl = document.getElementById('bc-bubble-' + bcEditingId);
      if (bubbleEl) {
        bubbleEl.textContent = text;
        if (!bubbleEl.querySelector('.msg-edited')) {
          const e = document.createElement('span');
          e.className = 'msg-edited';
          const id = bcEditingId;
          e.textContent = t('misc_edited');
          e.onclick = () => bcShowHistory(id);
          bubbleEl.appendChild(e);
        }
      }
      bcCancelEdit();
      showToast(t('toast_updated'));
    } else {
      inp.value = '';
      inp.blur();

      var sendResult = await dbActions.sendBubbleMessage(bcBubbleId, text);
      if (!sendResult.ok) {
        inp.value = text;
        return;
      }
      if (sendResult.message) {
        bcReduceMsg(sendResult.message);
        trackEvent('bubble_chat_msg_sent', { bubble_id: bcBubbleId });
      }
    }
  } catch(e) { logError("bcSendMessage", e); errorToast("send", e); }
  finally { bcSending = false; var sb3 = document.getElementById("bc-send-btn"); if (sb3) { sb3.disabled = false; } }
  } catch(e) { logError("bcSendMessage", e); }
}

async function bcHandleFile(input) {
  try {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { showWarningToast('Maks 10MB per fil'); return; }

    // File type allowlist — block HTML/SVG/JS to prevent stored XSS
    var blockedTypes = ['text/html','application/xhtml+xml','image/svg+xml','application/javascript','text/javascript','application/x-httpd-php'];
    var blockedExts = ['html','htm','svg','js','php','exe','bat','cmd','sh','ps1'];
    var ext = (file.name || '').split('.').pop().toLowerCase();
    if (blockedTypes.indexOf(file.type) >= 0 || blockedExts.indexOf(ext) >= 0) {
      showWarningToast('Filtypen er ikke tilladt');
      input.value = '';
      return;
    }

    // Sørg for at filen er på chat-tab så bruger kan se progress
    bcSwitchTab('chat');
    showToast('📤 Uploader...');

    // Sanitér filnavn — fjern mellemrum og specialtegn
    const safeFilename = file.name
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // fjern accenter
      .replace(/[^a-zA-Z0-9._-]/g, '_');                 // erstat ugyldige tegn

    const path = `${bcBubbleId}/${Date.now()}-${safeFilename}`;

    const { error: uploadErr } = await sb.storage.from('bubble-files').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type
    });

    if (uploadErr) {
      console.error('Upload error:', uploadErr);
      errorToast('upload', uploadErr);
      input.value = '';
      return;
    }

    // Public URL — permanent, no expiry. Requires bubble-files bucket to be public in Supabase.
    const { data: urlData } = sb.storage.from('bubble-files').getPublicUrl(path);
    if (!urlData?.publicUrl) { _renderToast(t('err_file_link'), 'error'); input.value = ''; return; }

    var fileResult = await dbActions.sendBubbleMessage(bcBubbleId, '', {
      fileUrl: urlData.publicUrl, fileName: file.name, fileType: file.type
    });
    if (fileResult.ok && fileResult.message) {
      bcReduceMsg(fileResult.message);
      showToast(t('toast_sent'));
    }
    input.value = '';
  } catch(e) { logError("bcHandleFile", e); errorToast("upload", e); }
}

// ── BC Long-press context menu (matches DM pattern) ──
var _bcLongPressTimer = null;

function bcTouchStart(event, msgId, isMe) {
  _bcLongPressTimer = setTimeout(function() { bcLongPress(msgId, isMe); }, 500);
}

function bcTouchEnd() {
  if (_bcLongPressTimer) { clearTimeout(_bcLongPressTimer); _bcLongPressTimer = null; }
}

function bcLongPress(msgId, isMe) {
  if (window.getSelection().toString()) return; // Let native text selection work
  if (navigator.vibrate) navigator.vibrate(10);
  var msgEl = document.getElementById('bc-msg-' + msgId);
  if (!msgEl) return;

  var overlay = document.createElement('div');
  overlay.className = 'dm-ctx-overlay';
  overlay.onclick = function() { overlay.remove(); };

  var container = document.createElement('div');
  container.style.cssText = 'position:absolute;display:flex;flex-direction:column;align-items:' + (isMe ? 'flex-end' : 'flex-start') + ';padding:0 1rem;';
  var rect = msgEl.getBoundingClientRect();
  container.style.top = Math.max(60, rect.top - 50) + 'px';
  container.style.left = '0';
  container.style.right = '0';

  // Reaction bar
  var reactions = document.createElement('div');
  reactions.className = 'dm-ctx-reactions';
  ['\u2764\uFE0F', '\uD83D\uDC4D', '\uD83D\uDE02', '\uD83D\uDE2E', '\uD83D\uDD25', '+'].forEach(function(emoji) {
    var btn = document.createElement('button');
    btn.textContent = emoji;
    if (emoji === '+') { btn.style.fontSize = '14px'; btn.style.color = 'var(--muted)'; }
    btn.onclick = function(e) {
      e.stopPropagation();
      if (emoji !== '+') bcReact(msgId, emoji);
      overlay.remove();
    };
    reactions.appendChild(btn);
  });
  container.appendChild(reactions);

  // Context menu
  var menu = document.createElement('div');
  menu.className = 'dm-ctx-menu';
  var copyBtn = document.createElement('button');
  copyBtn.textContent = t('misc_copy');
  copyBtn.onclick = function(e) { e.stopPropagation(); var b = document.getElementById('bc-bubble-' + msgId); if (b) navigator.clipboard.writeText(b.textContent).then(function(){ showToast(t('misc_copied')); }); overlay.remove(); };
  menu.appendChild(copyBtn);
  if (isMe) {
    var editBtn = document.createElement('button');
    editBtn.textContent = t('misc_edit');
    editBtn.onclick = function(e) { e.stopPropagation(); overlay.remove(); bcEditStart(msgId); };
    menu.appendChild(editBtn);
    var delBtn = document.createElement('button');
    delBtn.className = 'danger';
    delBtn.textContent = t('misc_delete');
    delBtn.onclick = function(e) { e.stopPropagation(); overlay.remove(); bcDeleteConfirm(msgId); };
    menu.appendChild(delBtn);
  }
  container.appendChild(menu);
  overlay.appendChild(container);
  document.body.appendChild(overlay);
}

function bcEditStart(msgId) {
  bcEditingId = msgId;
  var bubble = document.getElementById('bc-bubble-' + msgId);
  if (!bubble) return;
  var input = document.getElementById('bc-input');
  if (input) { input.value = bubble.textContent; input.focus(); }
  var editBar = document.getElementById('bc-edit-bar');
  if (editBar) editBar.classList.add('show');
  var sendBtn = document.getElementById('bc-send-btn');
  if (sendBtn) sendBtn.textContent = '✓';
}

async function bcDeleteConfirm(msgId) {
  var result = await dbActions.deleteBubbleMessage(msgId);
  if (result.ok) {
    var el = document.getElementById('bc-msg-' + msgId);
    if (el) { el.style.transition = 'opacity 0.2s'; el.style.opacity = '0'; setTimeout(function(){ el.remove(); }, 200); }
    showToast('Besked slettet');
  }
}

// ── Shared image lightbox ──
function chatLightbox(url) {
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.9);display:flex;align-items:center;justify-content:center;padding:1rem;cursor:pointer';
  overlay.onclick = function() { overlay.remove(); };
  var img = document.createElement('img');
  img.src = url;
  img.style.cssText = 'max-width:100%;max-height:100%;border-radius:8px;object-fit:contain';
  var closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText = 'position:absolute;top:calc(16px + env(safe-area-inset-top,0px));right:16px;background:rgba(255,255,255,0.2);border:none;color:white;font-size:1.2rem;width:36px;height:36px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center';
  closeBtn.onclick = function(e) { e.stopPropagation(); overlay.remove(); };
  overlay.appendChild(img);
  overlay.appendChild(closeBtn);
  document.body.appendChild(overlay);
}

// bcOpenContext removed — replaced by bcLongPress

async function bcReact(emoji) {
  if (!bcCurrentMsgId) return;
  try {
    // Check if user already reacted with this emoji
    const { data: existing } = await sb.from('bubble_message_reactions')
      .select('id').eq('message_id', bcCurrentMsgId).eq('user_id', currentUser.id).eq('emoji', emoji).maybeSingle();
    if (existing) {
      // Remove reaction
      await sb.from('bubble_message_reactions').delete().eq('id', existing.id);
    } else {
      // Add reaction
      await sb.from('bubble_message_reactions').insert({ message_id: bcCurrentMsgId, user_id: currentUser.id, emoji });
    }
    await bcLoadReactions(bcCurrentMsgId);
  } catch(e) { logError("bcReact", e); }
}

async function bcLoadReactions(msgId) {
  try {
    const { data: reactions } = await sb.from('bubble_message_reactions')
      .select('emoji, user_id, profiles(name)').eq('message_id', msgId);
    const el = document.getElementById('bc-reactions-' + msgId);
    if (!el) return;
    if (!reactions || reactions.length === 0) { el.innerHTML = ''; return; }
    // Group by emoji
    const groups = {};
    reactions.forEach(r => {
      if (!groups[r.emoji]) groups[r.emoji] = [];
      groups[r.emoji].push(r.profiles?.name || '?');
    });
    el.innerHTML = Object.entries(groups).map(([emoji, names]) => {
      const mine = reactions.some(r => r.emoji === emoji && r.user_id === currentUser.id);
      return `<button class="chat-reaction-pill${mine ? ' mine' : ''}" onclick="bcToggleReaction('${msgId}','${emoji}')" title="${escHtml(names.join(', '))}">${emoji} ${names.length}</button>`;
    }).join('');
  } catch(e) { /* silent */ }
}

async function bcToggleReaction(msgId, emoji) {
  try {
  bcCurrentMsgId = msgId;
  await bcReact(emoji);
  } catch(e) { logError("bcToggleReaction", e); }
}

// bcCloseContext and bcStartEdit removed — replaced by bcLongPress context menu

function bcCancelEdit() {
  bcEditingId = null;
  document.getElementById('bc-input').value = '';
  document.getElementById('bc-edit-bar').classList.remove('show');
  document.getElementById('bc-send-btn').textContent = '→';
}

async function bcDeleteMessage() {
  if (!bcCurrentMsgId) return;
  var result = await dbActions.deleteBubbleMessage(bcCurrentMsgId);
  if (result.ok) {
    document.getElementById('bc-msg-' + bcCurrentMsgId)?.remove();
    showToast('Besked slettet');
  }
}

async function bcShowHistory(msgId) {
  try {
    const { data: edits } = await sb.from('bubble_message_edits')
      .select('content, edited_at').eq('message_id', msgId).order('edited_at', {ascending:true});
    const { data: current } = await sb.from('bubble_messages').select('content').eq('id', msgId).maybeSingle();
    if (!edits || edits.length === 0) { showWarningToast(t('toast_not_found')); return; }
    const modal = document.getElementById('modal-edit-history') || bcCreateHistoryModal();
    const content = document.getElementById('edit-history-content');
    content.innerHTML = edits.map((e,i) => {
      const ts = new Date(e.edited_at).toLocaleTimeString(_locale(),{hour:'2-digit',minute:'2-digit'});
      return `<div style="padding:0.55rem 0;border-bottom:1px solid var(--border)">
        <div style="font-size:0.62rem;color:var(--muted);margin-bottom:0.2rem;font-family:monospace">${i===0? t('bc_edit_original') : t('bc_edit_edited')+' '+i} · ${ts}</div>
        <div style="font-size:0.82rem;color:var(--muted)">${escHtml(e.content)}</div>
      </div>`;
    }).join('') + `<div style="padding:0.55rem 0"><div style="font-size:0.62rem;color:var(--muted);margin-bottom:0.2rem;font-family:monospace">${t('bc_edit_current')}</div><div style="font-size:0.82rem">${escHtml(current?.content||'')}</div></div>`;
    openModal('modal-edit-history');
  } catch(e) { logError("bcShowHistory", e); errorToast("load", e); }
}

function bcCreateHistoryModal() {
  const m = document.createElement('div');
  m.id = 'modal-edit-history';
  m.className = 'modal';
  m.innerHTML = `<div class="modal-content"><div class="modal-header"><div class="modal-title">${icon("edit")} ${t('bc_edit_history')}</div><button class="modal-close" onclick="closeModal('modal-edit-history')">${icon('x')}</button></div><div id="edit-history-content" style="padding:0 1.25rem 1rem;overflow-y:auto;max-height:60vh"></div></div>`;
  document.getElementById('app-root').appendChild(m);
  return m;
}

async function bcLoadMembers() {
  if (_activeScreen !== 'screen-bubble-chat' || !bcBubbleId) return;
  try {
    const list = document.getElementById('bc-members-list');
    list.innerHTML = skelCards(4);

    const expireCutoff = new Date(Date.now() - LIVE_EXPIRE_HOURS * 60 * 60 * 1000).toISOString();

    const { data: members } = await sb.from('bubble_members')
      .select('user_id, joined_at, checked_in_at, checked_out_at, status')
      .eq('bubble_id', bcBubbleId)
      .order('joined_at', {ascending:true});

    if (!members || members.length === 0) {
      list.innerHTML = '<div class="empty-state"><div class="empty-icon">' + icon('users') + '</div><div class="empty-text">'+t('bc_no_members')+'</div></div>';
      return;
    }

    // Non-members: show count + join button only
    var isMember = bcBubbleData?._isMember;
    if (!isMember) {
      var activeCount = members.filter(function(m) { return m.status !== 'pending'; }).length;
      var isEvent = bcBubbleData?.type === 'event' || bcBubbleData?.type === 'live';
      var memberLabel = isEvent ? 'deltagere' : 'medlemmer';
      var vis = bcBubbleData?.visibility || 'public';
      var joinBtn = '';
      if (vis === 'hidden') {
        joinBtn = '<div style="font-size:0.78rem;color:var(--muted);margin-top:0.3rem">' + icon('eye') + ' Kun via invitation</div>';
      } else if (vis === 'private') {
        joinBtn = '<button class="bb-cta-anmod" data-action="requestJoin" data-id="' + bcBubbleId + '"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>Anmod om medlemskab</button>';
      } else {
        joinBtn = '<button class="btn-primary" onclick="joinBubble(\'' + bcBubbleId + '\')" style="font-size:0.8rem;padding:0.5rem 1.4rem;margin-top:0.5rem">Bliv medlem</button>';
      }
      list.innerHTML = '<div style="text-align:center;padding:2.5rem 1rem">' +
        '<div style="font-size:2.2rem;font-weight:700;color:var(--text-primary);margin-bottom:0.15rem">' + activeCount + '</div>' +
        '<div style="font-size:0.88rem;color:var(--muted);margin-bottom:0.8rem">' + memberLabel + '</div>' +
        joinBtn + '</div>';
      return;
    }

    // Privacy gate removed — non-members handled above

    // Hent profiler separat
    const userIds = members.map(m => m.user_id);
    const { data: profiles } = await sb.from('profiles').select('id, name, title, workplace, avatar_url').in('id', userIds);
    const profileMap = {};
    (profiles || []).forEach(p => profileMap[p.id] = p);

    // Determine live status per member
    const now = Date.now();
    members.forEach(m => {
      m._isLive = m.checked_in_at && !m.checked_out_at &&
        new Date(m.checked_in_at).getTime() > (now - LIVE_EXPIRE_HOURS * 3600000);
    });

    const colors = ['linear-gradient(135deg,#2ECFCF,#22B8CF)','linear-gradient(135deg,#6366F1,#7C5CFC)','linear-gradient(135deg,#E879A8,#EC4899)','linear-gradient(135deg,#F59E0B,#EAB308)','linear-gradient(135deg,#1A9E8E,#10B981)','linear-gradient(135deg,#8B5CF6,#A855F7)','linear-gradient(135deg,#3B82F6,#6366F1)','linear-gradient(135deg,#EF4444,#F97316)','linear-gradient(135deg,#06B6D4,#0EA5E9)','linear-gradient(135deg,#D946EF,#C026D3)'];
    const ownerId = bcBubbleData?.created_by;
    const isOwner = currentUser && ownerId === currentUser.id;

    // Separate pending from active members
    var activeMembers = members.filter(m => m.status !== 'pending');
    var pendingMembers = members.filter(m => m.status === 'pending');

    // Sort active: owner first, then live members, then rest
    const sorted = [...activeMembers].filter(m => !isBlocked(m.user_id)).sort((a, b) => {
      if (a.user_id === ownerId) return -1;
      if (b.user_id === ownerId) return 1;
      if (a._isLive && !b._isLive) return -1;
      if (!a._isLive && b._isLive) return 1;
      return 0;
    });

    const liveCount = activeMembers.filter(m => m._isLive).length;

    // Section labels — event-aware terminology
    var isEvent = bcBubbleData?.type === 'event' || bcBubbleData?.type === 'live';
    let html = '';

    // Live status banner for active events
    if (isEvent && bcBubbleData?.event_date) {
      var _evNow = new Date();
      var _evStart = new Date(bcBubbleData.event_date);
      var _evEnd = bcBubbleData.event_end_date ? new Date(bcBubbleData.event_end_date) : new Date(_evStart.getTime() + 4 * 3600000);
      if (_evNow >= _evStart && _evNow <= _evEnd) {
        var _myMem = members.find(function(m) { return m.user_id === currentUser.id; });
        var _amILive = _myMem && _myMem.checked_in_at && !_myMem.checked_out_at;
        if (_amILive) {
          html += '<div style="display:flex;align-items:center;gap:0.5rem;padding:0.5rem 0.75rem;margin-bottom:0.6rem;border-radius:10px;background:rgba(46,207,207,0.08);border:1px solid rgba(46,207,207,0.2)">' +
            '<span class="live-dot"></span>' +
            '<span style="font-size:0.78rem;font-weight:700;color:var(--accent3)">Du er live</span>' +
            '<span style="font-size:0.72rem;color:var(--muted);margin-left:auto">' + liveCount + ' til stede</span>' +
          '</div>';
        } else {
          html += '<div style="text-align:center;padding:0.5rem 0.75rem;margin-bottom:0.6rem">' +
            '<button onclick="bcManualCheckIn()" style="width:100%;padding:0.55rem;border-radius:10px;font-size:0.8rem;font-weight:700;font-family:inherit;cursor:pointer;background:linear-gradient(135deg,var(--accent3),#22B8CF);color:white;border:none;display:flex;align-items:center;justify-content:center;gap:0.4rem">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>' +
            'Check ind</button>' +
          '</div>';
        }
      }
    }

    // Pending requests section (only visible to owner/admin)
    if (pendingMembers.length > 0 && (isOwner || bcBubbleData?._isAdmin)) {
      html += '<div class="chat-section-label" style="color:#BA7517">Afventer godkendelse \u00B7 ' + pendingMembers.length + '</div>';
      pendingMembers.forEach(function(m) {
        var p = profileMap[m.user_id] || {};
        var ini = (p.name||'?').split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();
        var avHtml = p.avatar_url ? '<img src="' + escHtml(p.avatar_url) + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%">' : ini;
        html += '<div class="chat-member-row" style="background:rgba(249,177,55,0.04);border:1px solid rgba(249,177,55,0.15);border-radius:12px;margin-bottom:6px;padding:0.65rem 0.75rem">' +
          '<div class="chat-member-avatar" style="background:linear-gradient(135deg,#F59E0B,#EAB308);overflow:hidden">' + avHtml + '</div>' +
          '<div style="flex:1;min-width:0">' +
            '<div class="chat-member-name">' + escHtml(p.name||t('misc_unknown')) + '</div>' +
            '<div class="chat-member-status">' + escHtml([p.title, p.workplace].filter(Boolean).join(' \u00B7 ')) + '</div>' +
          '</div>' +
          '<div style="display:flex;gap:4px;flex-shrink:0">' +
            '<button onclick="event.stopPropagation();bcApproveMember(\'' + m.user_id + '\')" style="padding:0.3rem 0.6rem;font-size:0.68rem;font-weight:700;border-radius:8px;border:none;background:#1A9E8E;color:white;cursor:pointer;font-family:inherit">Godkend</button>' +
            '<button onclick="event.stopPropagation();bcRejectMember(\'' + m.user_id + '\')" style="padding:0.3rem 0.5rem;font-size:0.68rem;font-weight:700;border-radius:8px;border:1px solid rgba(239,68,68,0.25);background:rgba(239,68,68,0.06);color:#DC2626;cursor:pointer;font-family:inherit">Afvis</button>' +
          '</div>' +
        '</div>';
      });
    }

    let prevSection = '';
    sorted.forEach((m, i) => {
      const p = profileMap[m.user_id] || {};
      const initials = (p.name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
      const color = colors[i % colors.length];
      const isOwnerRow = m.user_id === ownerId;

      // Section labels
      let section = isOwnerRow ? 'owner' : (m._isLive ? 'live' : 'members');
      if (section !== prevSection) {
        if (section === 'owner') html += `<div class="chat-section-label">${isEvent ? t('misc_organizer') : t('misc_owner')}</div>`;
        else if (section === 'live') html += `<div class="chat-section-label" style="margin-top:0.8rem">${isEvent ? 'Til stede nu' : 'Her lige nu'} · ${liveCount}</div>`;
        else {
          var restCount = activeMembers.length - liveCount - (ownerId ? 1 : 0);
          html += `<div class="chat-section-label" style="margin-top:0.8rem">${isEvent ? 'Deltagere' : 'Medlemmer'} · ${restCount}</div>`;
        }
        prevSection = section;
      }

      const liveBadge = m._isLive ? '<span class="live-badge-mini">LIVE</span>' : '';

      // Status line: for events, show check-in time; for networks, show title
      var statusText = escHtml([p.title, p.workplace].filter(Boolean).join(' \u00B7 '));
      if (isEvent && !isOwnerRow && !m._isLive && m.checked_in_at) {
        var checkinTime = new Date(m.checked_in_at).toLocaleTimeString(_locale(), { hour: '2-digit', minute: '2-digit' });
        statusText = (statusText ? statusText + ' · ' : '') + '<span style="color:var(--muted)">' + t('bc_was_here_at') + ' ' + checkinTime + '</span>';
      }

      // Role label
      var roleLabel = isEvent ? t('misc_organizer') : t('misc_owner');

      var avatarInner = (p.avatar_url && !p.is_anon)
        ? '<img src="' + escHtml(p.avatar_url) + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%">'
        : initials;

      html += `<div class="chat-member-row" data-member-uid="${m.user_id}" onclick="bcOpenPerson('${m.user_id}','${escHtml(p.name||'')}','${escHtml(p.title||'')}','${color}')">
        <div class="chat-member-avatar" style="background:${color};overflow:hidden">${avatarInner}${m._isLive ? '<span class="live-dot"></span>' : ''}</div>
        <div style="flex:1;min-width:0"><div class="chat-member-name">${escHtml(p.name||t('misc_unknown'))} ${liveBadge}</div><div class="chat-member-status">${statusText}</div></div>
        ${isOwnerRow ? '<span class="chat-member-role">' + roleLabel + '</span>' : (isOwner && !isOwnerRow ? '<button class="bc-kick-btn" onclick="event.stopPropagation();bcShowKickConfirm(this,\'' + m.user_id + '\',\'' + escHtml(p.name||t('misc_unknown')).replace(/'/g,'') + '\')" title="Fjern fra boble">' + icon('x') + '</button>' : '')}
      </div>`;
    });
    // Add search field when 5+ members
    if (sorted.length >= 5) {
      html = '<div style="padding:0 0 0.4rem"><input class="input" type="search" id="bc-member-search" placeholder="Søg medlemmer..." oninput="bcFilterMembers()" style="font-size:0.75rem;padding:0.4rem 0.75rem;border-radius:10px"></div>' + html;
    }
    list.innerHTML = html;
  } catch(e) { logError("bcLoadMembers", e); errorToast("load", e); }
}

// ── Bubble owner: kick/remove member (inline confirm tray) ──
function bcShowKickConfirm(btn, userId, userName) {
  var row = btn.closest('.chat-member-row');
  if (!row) return;
  bbConfirm(row, {
    label: t('bc_remove_member_confirm', { name: userName }),
    confirmText: t('misc_remove'),
    confirmClass: 'bb-confirm-btn-danger',
    onConfirm: "event.stopPropagation();bcConfirmKick('" + userId + "','" + userName + "')"
  });
}

async function bcConfirmKick(userId, userName) {
  if (!bcBubbleId || !currentUser) return;
  if (bcBubbleData?.created_by !== currentUser.id) { showWarningToast(t('toast_no_permission')); return; }
  try {
    var { error } = await sb.from('bubble_members').delete()
      .eq('bubble_id', bcBubbleId).eq('user_id', userId);
    if (error) throw error;
    showToast(userName + ' er fjernet fra boblen');
    bcLoadMembers();
    bcLoadBubbleInfo();
  } catch(e) { logError('bcConfirmKick', e, { bubbleId: bcBubbleId, userId: userId }); errorToast('save', e); }
}

async function bcApproveMember(userId) {
  if (!bcBubbleId) return;
  try {
    var { error } = await sb.from('bubble_members').update({ status: 'active' })
      .eq('bubble_id', bcBubbleId).eq('user_id', userId);
    if (error) throw error;
    showSuccessToast(t('bc_member_approved'));
    bcLoadMembers();
    bcLoadBubbleInfo();
    // Notify approved user via Broadcast
    var bubbleName = bcBubbleData?.name || '';
    try {
      var ch = sb.channel('member-notify-' + userId);
      await ch.subscribe();
      await ch.send({ type: 'broadcast', event: 'approved', payload: { bubbleName: bubbleName, bubbleId: bcBubbleId } });
      setTimeout(function() { ch.unsubscribe(); }, 2000);
      // Push notification to approved user
      sendPush(userId, 'Du er godkendt!', 'Du er nu medlem af ' + bubbleName, { type: 'approved', bubble_id: bcBubbleId });
    } catch(e2) { console.debug('[approve] broadcast error:', e2); }
  } catch(e) { logError('bcApproveMember', e); errorToast('save', e); }
}

async function bcRejectMember(userId) {
  if (!bcBubbleId) return;
  try {
    var { error } = await sb.from('bubble_members').delete()
      .eq('bubble_id', bcBubbleId).eq('user_id', userId).eq('status', 'pending');
    if (error) throw error;
    showToast(t('bc_request_rejected'));
    bcLoadMembers();
    bcLoadBubbleInfo();
  } catch(e) { logError('bcRejectMember', e); errorToast('save', e); }
}

function bcFilterMembers() {
  var q = (document.getElementById('bc-member-search')?.value || '').toLowerCase();
  var rows = document.querySelectorAll('#bc-members-list .chat-member-row');
  var labels = document.querySelectorAll('#bc-members-list .chat-section-label');
  rows.forEach(function(row) {
    var text = (row.textContent || '').toLowerCase();
    row.style.display = !q || text.includes(q) ? '' : 'none';
  });
  // Hide section labels when filtering
  labels.forEach(function(l) { l.style.display = q ? 'none' : ''; });
}

async function bcLoadInfo() {
  if (_activeScreen !== 'screen-bubble-chat' || !bcBubbleId) return;
  try {
    const list = document.getElementById('bc-info-list');
    if (!bcBubbleData) await bcLoadBubbleInfo();
    const b = bcBubbleData;
    if (!b) return;
    const isOwner = bcBubbleData._isOwner || (currentUser && b.created_by === currentUser.id);
    const isBubbleAdmin = bcBubbleData._isAdmin || false;
    const canEdit = isOwner || isBubbleAdmin;
    const isEvent = b.type === 'event' || b.type === 'live';
    const memberLabel = isEvent ? 'deltagere' : 'medlemmer';

    // Member count
    var { count: mc } = await sb.from('bubble_members').select('*', { count: 'exact', head: true }).eq('bubble_id', b.id).or('status.is.null,status.neq.pending');
    mc = mc || 0;

    // Tags
    var tagsHtml = (b.keywords || []).map(function(k) {
      var col = isEvent ? 'rgba(46,207,207,0.07)' : 'rgba(124,92,252,0.07)';
      var txt = isEvent ? '#0F6E56' : '#534AB7';
      return '<span style="font-size:0.68rem;padding:0.2rem 0.55rem;border-radius:99px;background:' + col + ';color:' + txt + ';font-weight:500">' + escHtml(k) + '</span>';
    }).join('');

    // Color theming
    var accentBg = isEvent ? 'rgba(46,207,207,' : 'rgba(124,92,252,';
    var accentTxt = isEvent ? '#085041' : '#534AB7';
    var accentStroke = isEvent ? '#2ECFCF' : '#7C5CFC';
    var iconBg = isEvent ? 'rgba(46,207,207,0.1)' : 'rgba(124,92,252,0.1)';
    var heroIcon = b.icon_url
      ? '<img src="' + escHtml(b.icon_url) + '" style="width:100%;height:100%;object-fit:cover;border-radius:15px">'
      : (isEvent ? icon('calendar') : ico('bubble'));

    // ── Parent reference (for any bubble with parent_bubble_id) ──
    var parentHtml = '';
    if (b.parent_bubble_id) {
      try {
        var { data: parent } = await sb.from('bubbles').select('id,name').eq('id', b.parent_bubble_id).maybeSingle();
        if (parent) {
          parentHtml = '<div onclick="openBubble(\'' + parent.id + '\')" style="display:flex;align-items:center;gap:0.55rem;padding:0.55rem 0.7rem;border-radius:12px;background:rgba(124,92,252,0.04);border:1px solid rgba(124,92,252,0.1);margin-bottom:0.9rem;cursor:pointer">' +
            '<div style="width:24px;height:24px;border-radius:7px;background:rgba(124,92,252,0.1);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:13px">' + ico('bubble') + '</div>' +
            '<div style="flex:1"><div style="font-size:0.68rem;color:var(--muted)">Del af</div><div style="font-size:0.78rem;font-weight:600;color:#534AB7">' + escHtml(parent.name) + '</div></div>' +
            '<div style="font-size:0.88rem;color:var(--muted)">›</div></div>';
        }
      } catch(e) { /* silent */ }
    }

    // ── Child bubbles + events (only for non-event bubbles) ──
    var eventsHtml = '';
    if (!isEvent) {
      try {
        var { data: childBubbles } = await sb.from('bubbles')
          .select('id, name, type, created_at, event_date, event_end_date, visibility, icon_url, agenda, bubble_members(count)')
          .eq('parent_bubble_id', b.id)
          .order('event_date', { ascending: true, nullsFirst: false })
          .limit(20);
        if (childBubbles && childBubbles.length > 0) {
          var _calIco = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>';
          var _netIco = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9.5" cy="9.5" r="6" opacity="0.85"/><circle cx="16" cy="13.5" r="4.5" opacity="0.6"/></svg>';
          var _chevSm = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>';
          var _addIco = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>';
          var now = new Date();

          var childNets = childBubbles.filter(function(ch) { return ch.type !== 'event' && ch.type !== 'live'; });
          var childEvents = childBubbles.filter(function(ch) { return ch.type === 'event' || ch.type === 'live'; });

          // Fetch grandchildren (events under sub-networks)
          var gcMap = {};
          var childNetIds = childNets.map(function(cn) { return cn.id; });
          if (childNetIds.length > 0) {
            var { data: grandchildren } = await sb.from('bubbles')
              .select('id, name, type, event_date, event_end_date, visibility, parent_bubble_id, icon_url, agenda, bubble_members(count)')
              .in('parent_bubble_id', childNetIds)
              .order('event_date', { ascending: true, nullsFirst: false });
            (grandchildren || []).forEach(function(gc) {
              if (!gcMap[gc.parent_bubble_id]) gcMap[gc.parent_bubble_id] = [];
              gcMap[gc.parent_bubble_id].push(gc);
            });
          }

          var childCards = '';

          // Sub-networks with fold-out (same tree structure as home screen)
          childNets.forEach(function(cn) {
            var cnMc = cn.bubble_members?.[0]?.count || 0;
            var cnGc = gcMap[cn.id] || [];
            var cnEvents = cnGc.filter(function(g) { return g.type === 'event' || g.type === 'live'; });
            var cnNets = cnGc.filter(function(g) { return g.type !== 'event' && g.type !== 'live'; });
            var cnAccId = 'bci-' + cn.id.slice(0, 8);
            var hasChildren = cnEvents.length > 0 || cnNets.length > 0;
            var cnIcon = cn.icon_url ? '<img src="' + escHtml(cn.icon_url) + '">' : _netIco;

            childCards += '<div class="bb-tree-branch">';
            childCards += '<div class="bb-card-list">';
            childCards += '<div class="bb-card-icon-sq icon-wrap">' + cnIcon + '</div>';
            childCards += '<div class="bb-card-text" onclick="openBubbleChat(\'' + cn.id + '\',\'screen-bubble-chat\')">';
            childCards += '<div class="bb-card-title">' + escHtml(cn.name) + '</div>';
            childCards += '<div class="bb-card-meta">' + visIcon(cn.visibility) + '<span class="bb-card-meta-text">' + cnMc + ' medl.' + (cnGc.length > 0 ? ' \u00B7 ' + cnGc.length + ' events' : '') + '</span></div>';
            childCards += '</div>';
            if (hasChildren) {
              childCards += '<button class="bb-tree-toggle" id="tog-' + cnAccId + '" onclick="event.stopPropagation();bbTreeToggle(\'' + cnAccId + '\')">' + _chevSm + '</button>';
            } else {
              childCards += '<div class="bb-card-chev">\u203A</div>';
            }
            childCards += '</div>';

            if (hasChildren) {
              childCards += '<div class="bb-tree-leaves collapsed" id="trunk-' + cnAccId + '">';
              cnGc.forEach(function(ev) {
                var isPast = ev.event_date && new Date(ev.event_end_date || ev.event_date) < now;
                var evMc = ev.bubble_members?.[0]?.count || 0;
                var dateStr = ev.event_date ? new Date(ev.event_date).toLocaleDateString(_locale(), { day: 'numeric', month: 'short' }) : '';
                var isEvt = ev.type === 'event' || ev.type === 'live';
                var evIcon = ev.icon_url ? '<img src="' + escHtml(ev.icon_url) + '">' : (isEvt ? _calIco : _netIco);
                if (isEvt) {
                  var gcEvLive = (typeof currentLiveBubble !== 'undefined' && currentLiveBubble && currentLiveBubble.bubble_id === ev.id);
                  childCards += '<div class="bb-tree-leaf"><div class="bb-card-list' + (isPast ? ' is-past' : '') + '" onclick="event.stopPropagation();openBubbleChat(\'' + ev.id + '\',\'screen-bubble-chat\')">';
                  childCards += '<div class="bb-card-icon-sq icon-wrap is-event">' + evIcon + '</div>';
                  childCards += '<div class="bb-card-text">';
                  childCards += '<div class="bb-card-title">' + escHtml(ev.name) + (gcEvLive ? ' <span class="bb-pill bb-pill-live">LIVE</span>' : '') + '</div>';
                  childCards += '<div class="bb-card-meta">' + visIcon(ev.visibility) + '<span class="bb-card-meta-text">' + dateStr + (evMc > 0 ? ' \u00B7 ' + evMc + ' tilmeldt' : '') + '</span></div>';
                  childCards += '</div>';
                  childCards += '<div class="bb-card-chev">\u203A</div>';
                  childCards += '</div></div>';
                } else {
                  childCards += '<div class="bb-tree-leaf"><div class="bb-card-list" onclick="event.stopPropagation();openBubbleChat(\'' + ev.id + '\',\'screen-bubble-chat\')">';
                  childCards += '<div class="bb-card-icon-sq icon-wrap">' + evIcon + '</div>';
                  childCards += '<div class="bb-card-text">';
                  childCards += '<div class="bb-card-title">' + escHtml(ev.name) + '</div>';
                  childCards += '<div class="bb-card-meta">' + visIcon(ev.visibility) + '<span class="bb-card-meta-text">' + evMc + ' medl.</span></div>';
                  childCards += '</div>';
                  childCards += '<div class="bb-card-chev">\u203A</div>';
                  childCards += '</div></div>';
                }
              });
              if (canEdit) {
                childCards += '<div class="bb-tree-add" onclick="openCreateEventFromBubble(\'' + cn.id + '\')">' + _addIco + ' Opret event</div>';
              }
              childCards += '</div>';
            }
            childCards += '</div>';
          });

          // Direct child events
          childEvents.forEach(function(ch) {
            var chMc = ch.bubble_members?.[0]?.count || 0;
            var isPast = ch.event_date && new Date(ch.event_end_date || ch.event_date) < now;
            var dateStr = ch.event_date
              ? new Date(ch.event_date).toLocaleDateString(_locale(), { weekday: 'short', day: 'numeric', month: 'short' }) +
                (new Date(ch.event_date).getHours() > 0 ? (_lang === 'da' ? ' kl. ' : ' at ') + new Date(ch.event_date).toLocaleTimeString(_locale(), { hour: '2-digit', minute: '2-digit' }) +
                  (ch.event_end_date ? ' – ' + new Date(ch.event_end_date).toLocaleTimeString(_locale(), { hour: '2-digit', minute: '2-digit' }) : '')
                : '')
              : '';
            var chEvLive = (typeof currentLiveBubble !== 'undefined' && currentLiveBubble && currentLiveBubble.bubble_id === ch.id);
            var _agId = 'bc-agenda-' + ch.id;
            var chIcon = ch.icon_url ? '<img src="' + escHtml(ch.icon_url) + '">' : _calIco;
            childCards += '<div class="bb-tree-branch">';
            childCards += '<div class="bb-card-list' + (isPast ? ' is-past' : '') + '" onclick="openBubbleChat(\'' + ch.id + '\',\'screen-bubble-chat\')">';
            childCards += '<div class="bb-card-icon-sq icon-wrap is-event">' + chIcon + '</div>';
            childCards += '<div class="bb-card-text">';
            childCards += '<div class="bb-card-title">' + escHtml(ch.name) + (chEvLive ? ' <span class="bb-pill bb-pill-live">LIVE</span>' : '') + '</div>';
            childCards += '<div class="bb-card-meta">' + visIcon(ch.visibility) + '<span class="bb-card-meta-text">' + dateStr + ' \u00B7 ' + chMc + ' tilmeldt</span></div>';
            childCards += '</div>';
            if (ch.agenda) {
              childCards += '<div onclick="event.stopPropagation();var p=document.getElementById(\'' + _agId + '\');var v=p.style.display===\'none\';p.style.display=v?\'block\':\'none\';this.style.transform=v?\'rotate(90deg)\':\'rotate(0)\'" class="bb-card-chev" style="cursor:pointer;transition:transform 0.2s">' + _chevSm + '</div>';
            } else {
              childCards += '<div class="bb-card-chev">\u203A</div>';
            }
            childCards += '</div>';
            if (ch.agenda) {
              childCards += '<div id="' + _agId + '" style="display:none;padding:0.4rem 0.6rem 0.5rem 2.2rem;font-size:0.7rem;color:rgba(255,255,255,0.7);line-height:1.5;white-space:pre-line;background:rgba(46,207,207,0.05);border-radius:0 0 12px 12px;margin-top:-4px">' + escHtml(ch.agenda) + '</div>';
            }
            childCards += '</div>';
          });

          eventsHtml = '<div style="margin-bottom:0.9rem">' +
            '<div class="bb-section-header" style="display:flex;align-items:center;justify-content:space-between">' +
            '<span>' + t('bi_network_events') + '</span>' +
            '<span class="bb-section-count">' + childBubbles.length + '</span></div>' +
            '<div class="bb-tree-trunk">' + childCards + '</div>' +
            (canEdit ? '<div style="display:flex;gap:0.4rem;margin-top:0.8rem">' +
              '<button onclick="openCreateEventFromBubble(\'' + b.id + '\')" class="bb-cta-create"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>Event</button>' +
              '<button onclick="openCreateSubBubble(\'' + b.id + '\')" class="bb-cta-create"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9.5" cy="9.5" r="6"/><circle cx="16" cy="13.5" r="4.5"/></svg>Sub-boble</button></div>' : '') +
            '</div>';
        } else if (canEdit) {
          eventsHtml = '<div style="margin-bottom:0.9rem">' +
            '<div class="bb-section-header">' + t('bi_network_events') + '</div>' +
            '<div style="display:flex;gap:0.4rem">' +
            '<button onclick="openCreateEventFromBubble(\'' + b.id + '\')" class="bb-cta-create"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>Event</button>' +
            '<button onclick="openCreateSubBubble(\'' + b.id + '\')" class="bb-cta-create"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9.5" cy="9.5" r="6"/><circle cx="16" cy="13.5" r="4.5"/></svg>Sub-boble</button></div></div>';
        }
      } catch(e) { logError('bcLoadInfo:children', e); }
    }

    // ── Owner/admin dashboard stats ──
    var statsHtml = '';
    if (canEdit) {
      try {
        var allBubbleIds = [b.id];
        if (!isEvent) {
          var { data: childIds } = await sb.from('bubbles').select('id').eq('parent_bubble_id', b.id);
          (childIds || []).forEach(function(c) { allBubbleIds.push(c.id); });
        }
        var d30 = new Date(Date.now() - 30*24*3600000).toISOString();
        var [memTotalRpc, memNewRpc, msgTotal, msgNew] = await Promise.all([
          sb.rpc('count_unique_members', { bubble_ids: allBubbleIds }),
          sb.rpc('count_new_unique_members', { bubble_ids: allBubbleIds, since: d30 }),
          sb.from('bubble_messages').select('*', { count: 'exact', head: true }).in('bubble_id', allBubbleIds),
          sb.from('bubble_messages').select('*', { count: 'exact', head: true }).in('bubble_id', allBubbleIds).gte('created_at', d30)
        ]);
        var memTotalCount = memTotalRpc.data || 0;
        var memNewCount = memNewRpc.data || 0;
        // Register bubble-specific chart meta
        _dashMeta['o-mem-' + b.id] = { title: t('bi_member_growth'), sub: t('bi_member_growth_sub'), table: 'bubble_members', field: 'joined_at', type: 'line', filter: allBubbleIds, icon: 'users' };
        _dashMeta['o-msg-' + b.id] = { title: t('bi_chat_activity'), sub: t('bi_chat_activity_sub'), table: 'bubble_messages', field: 'created_at', type: 'bar', filter: allBubbleIds, icon: 'chat' };

        function oCard(id, iconName, icoBg, icoCol, val, label, delta, color) {
          return '<div class="dash-card" data-color="' + color + '" onclick="dashToggle(this,\'' + id + '\',this.closest(\'.dash-pair\').querySelector(\'.dash-tray\').id)">' +
            '<div class="dash-ico" style="background:' + icoBg + ';color:' + icoCol + '">' + ico(iconName) + '</div>' +
            '<div><div class="dash-val">' + val + '</div><div class="dash-label">' + label + '</div>' +
            (delta ? '<div class="dash-delta">+' + delta + ' ' + t('bi_this_month') + '</div>' : '') + '</div></div>';
        }

        var childCount = allBubbleIds.length - 1;
        statsHtml = '<div style="margin-bottom:0.9rem">' +
          '<div style="font-size:0.68rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:0.4rem">' + t('bi_statistics') + '</div>' +
          '<div class="dash-pair"><div class="dash-row">' +
            oCard('o-mem-' + b.id, 'users', 'rgba(124,92,252,0.08)', 'var(--accent)', memTotalCount, t('bi_members_label'), memNewCount, 'accent') +
            oCard('o-msg-' + b.id, 'chat', 'rgba(232,121,168,0.08)', 'var(--pink)', msgTotal.count || 0, t('bi_messages_label'), msgNew.count, 'pink') +
          '</div><div class="dash-tray" id="dtray-o1-' + b.id.slice(0,8) + '"><div class="dash-tray-collapse"><div class="dash-tray-inner" id="dti-o1"><div style="font-size:0.72rem;font-weight:700" id="dtitle-o1"></div><div style="font-size:0.55rem;color:var(--muted)" id="dsub-o1"></div><div class="dash-chart-wrap"><canvas id="dcv-o1"></canvas></div></div></div></div></div>' +
          '</div>';
      } catch(e) { logError('bcLoadInfo:stats', e); }
    }

    // ── Admin section (role-aware, type-aware) ──
    var adminHtml = '';
    if (canEdit) {
      var adminItems = '';
      // Shared: admins
      if (isOwner) {
        adminItems += '<div onclick="openAdminDesignation(\'' + b.id + '\')" style="display:flex;align-items:center;gap:0.6rem;padding:0.65rem 0.75rem;cursor:pointer">' +
          '<span style="width:15px;height:15px;display:flex;align-items:center;justify-content:center;color:var(--muted)">' + icon('users') + '</span>' +
          '<div style="flex:1;font-size:0.8rem;color:var(--text-secondary)">' + t('bi_designate_admins') + '</div>' +
          '<div style="font-size:0.88rem;color:var(--muted)">›</div></div>' +
          '<div style="height:1px;background:var(--glass-border-subtle);margin:0 0.75rem"></div>';
      }
      // Shared: download list
      adminItems += '<div onclick="downloadMembersPdf(\'' + b.id + '\')" style="display:flex;align-items:center;gap:0.6rem;padding:0.65rem 0.75rem;cursor:pointer">' +
        '<span style="width:15px;height:15px;display:flex;align-items:center;justify-content:center;color:var(--muted)">' + icon('file') + '</span>' +
        '<div style="flex:1;font-size:0.8rem;color:var(--text-secondary)">Download ' + memberLabel + 'liste</div>' +
        '<div style="font-size:0.88rem;color:var(--muted)">›</div></div>';
      // Shared: chat lock toggle
      var chatLocked = b.chat_locked || false;
      adminItems += '<div style="height:1px;background:var(--glass-border-subtle);margin:0 0.75rem"></div>' +
        '<div style="display:flex;align-items:center;gap:0.6rem;padding:0.65rem 0.75rem">' +
        '<span style="width:15px;height:15px;display:flex;align-items:center;justify-content:center;color:var(--muted)">' + icon('lock') + '</span>' +
        '<div style="flex:1;font-size:0.8rem;color:var(--text-secondary)">' + t('bi_lock_chat') + '</div>' +
        '<label style="position:relative;width:36px;height:20px;flex-shrink:0;cursor:pointer">' +
        '<input type="checkbox" ' + (chatLocked ? 'checked' : '') + ' onchange="bcToggleChatLock(\'' + b.id + '\',this.checked)" style="position:absolute;opacity:0;width:100%;height:100%;cursor:pointer;margin:0">' +
        '<div style="position:absolute;inset:0;border-radius:10px;transition:background 0.2s;background:' + (chatLocked ? 'var(--accent)' : 'var(--border)') + '"></div>' +
        '<div style="position:absolute;top:2px;left:' + (chatLocked ? '18px' : '2px') + ';width:16px;height:16px;border-radius:50%;background:white;transition:left 0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.15)"></div>' +
        '</label></div>';
      // Event-only: rapport
      if (isEvent) {
        adminItems += '<div style="height:1px;background:var(--glass-border-subtle);margin:0 0.75rem"></div>' +
          '<div onclick="generateEventReport(\'' + b.id + '\')" style="display:flex;align-items:center;gap:0.6rem;padding:0.65rem 0.75rem;cursor:pointer">' +
          '<span style="width:15px;height:15px;display:flex;align-items:center;justify-content:center;color:var(--muted)">' + icon('file') + '</span>' +
          '<div style="flex:1;font-size:0.8rem;color:var(--text-secondary)">' + t('bi_event_report') + '</div>' +
          '<div style="font-size:0.88rem;color:var(--muted)">›</div></div>';
      }
      // Owner: transfer
      if (isOwner) {
        adminItems += '<div style="height:1px;background:var(--glass-border-subtle);margin:0 0.75rem"></div>' +
          '<div onclick="openTransferOwnership(\'' + b.id + '\')" style="display:flex;align-items:center;gap:0.6rem;padding:0.65rem 0.75rem;cursor:pointer">' +
          '<span style="width:15px;height:15px;display:flex;align-items:center;justify-content:center;color:var(--muted)">' + icon('crown') + '</span>' +
          '<div style="flex:1;font-size:0.8rem;color:var(--text-secondary)">' + t('bi_transfer_ownership') + '</div>' +
          '<div style="font-size:0.88rem;color:var(--muted)">›</div></div>';
      }
      adminHtml = '<div style="margin-bottom:0.9rem">' +
        '<div style="font-size:0.68rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:0.35rem">' + (isEvent ? t('bi_event_admin') : t('bi_administration')) + '</div>' +
        '<div style="border-radius:12px;border:1px solid var(--glass-border-subtle);overflow:hidden">' + adminItems + '</div></div>';
    }

    // ── Bottom actions: member-aware ──
    var isMember = bcBubbleData._isMember;
    var bottomHtml = '';

    if (isMember) {
      // Check live status for checkout button
      var myCheckinLive = false;
      if (isEvent) {
        try {
          var { data: myCheckin } = await sb.from('bubble_members')
            .select('checked_in_at, checked_out_at')
            .eq('bubble_id', b.id).eq('user_id', currentUser.id).maybeSingle();
          myCheckinLive = myCheckin && myCheckin.checked_in_at && !myCheckin.checked_out_at &&
            (Date.now() - new Date(myCheckin.checked_in_at).getTime() < 6 * 3600000);
        } catch(e) {}
      }

      var checkoutBtn = '';
      if (isEvent && myCheckinLive) {
        checkoutBtn = '<button onclick="bcCheckout()" style="width:100%;padding:0.65rem;border-radius:12px;background:rgba(46,207,207,0.05);border:1px solid rgba(46,207,207,0.2);color:#085041;font-size:0.8rem;font-weight:600;cursor:pointer;font-family:var(--font)">' + t('bi_checkout') + '</button>';
      }
      bottomHtml = '<div style="display:flex;flex-direction:column;gap:0.4rem;border-top:1px solid var(--glass-border-subtle);padding-top:0.8rem">' +
        checkoutBtn +
        '<button data-action="leaveBubble" data-id="' + b.id + '" style="width:100%;padding:0.65rem;border-radius:12px;background:rgba(239,68,68,0.03);border:1px solid rgba(239,68,68,0.1);color:#A32D2D;font-size:0.8rem;font-weight:600;cursor:pointer;font-family:var(--font)">' + (isEvent ? t('bb_leave_event') : t('bb_leave_bubble')) + '</button>' +
        (isOwner ? '<button onclick="confirmPopBubble(\'' + b.id + '\')" style="width:100%;padding:0.65rem;border-radius:12px;background:rgba(239,68,68,0.03);border:1px solid rgba(239,68,68,0.1);color:#791F1F;font-size:0.8rem;font-weight:600;cursor:pointer;font-family:var(--font)">' + (isEvent ? t('bb_delete_event') : t('bb_delete_bubble')) + '</button>' : '') +
        '</div>';
    } else if (bcBubbleData._isPending) {
      bottomHtml = ''; // Banner at top (bcLoadMembership) already shows pending state
    } else {
      // Non-member: join CTA is shown at top of Info tab (topJoinHtml)
      bottomHtml = '';
    }

    // ── Assemble ──
    // Top join CTA for non-members (prominent, above accordion)
    var topJoinHtml = '';
    if (!bcBubbleData._isMember && !bcBubbleData._isPending) {
      if (b.visibility === 'hidden') {
        topJoinHtml = '<div style="text-align:center;padding:0.5rem 0 0.8rem;font-size:0.78rem;color:var(--muted)">' + icon('eye') + ' Kun via invitation</div>';
      } else if (b.visibility === 'private') {
        topJoinHtml = '<div style="padding:0.5rem 0 0.8rem"><button class="bb-cta-anmod" data-action="requestJoin" data-id="' + b.id + '"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>Anmod om medlemskab</button></div>';
      } else {
        topJoinHtml = '<div style="text-align:center;padding:0.5rem 0 0.8rem"><button class="btn-primary" onclick="joinBubble(\'' + b.id + '\')" style="font-size:0.8rem;padding:0.5rem 1.4rem">Bliv medlem</button></div>';
      }
    } else if (bcBubbleData._isPending) {
      topJoinHtml = ''; // Banner at top already handles pending state
    }

    list.innerHTML =
      parentHtml +
      '<div style="text-align:center;padding:0.25rem 0 1rem">' +
        '<div style="width:52px;height:52px;border-radius:15px;background:' + (b.icon_url ? 'transparent' : iconBg) + ';display:flex;align-items:center;justify-content:center;margin:0 auto 0.5rem;color:' + accentStroke + ';font-size:24px;position:relative"><div style="width:100%;height:100%;border-radius:15px;overflow:hidden;display:flex;align-items:center;justify-content:center">' + heroIcon + '</div>' + (bcBubbleData._isMember ? '<div style="position:absolute;bottom:-3px;right:-3px;width:18px;height:18px;border-radius:50%;background:#1A9E8E;display:flex;align-items:center;justify-content:center;border:2.5px solid var(--bg)"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg></div>' : '') + '</div>' +
        '<div style="font-size:1rem;font-weight:800;color:var(--text)">' + escHtml(b.name) + '</div>' +
        '<div style="font-size:0.75rem;color:var(--muted);margin-top:0.15rem">' + typeLabel(b.type) + (b.location ? ' · ' + escHtml(b.location) : '') + ' · ' + mc + ' ' + memberLabel + (bcBubbleData._isMember ? ' · <span style="color:#1A9E8E;font-weight:600"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#1A9E8E" stroke-width="3" stroke-linecap="round" style="vertical-align:-1px"><polyline points="20 6 9 17 4 12"/></svg> ' + (isEvent ? t('dl_attending') : t('dl_member')) + '</span>' : '') + '</div>' +
        (isEvent && b.event_date ? (function() {
          var evD = new Date(b.event_date);
          var evPast = new Date(b.event_end_date || b.event_date) < new Date();
          var evDateStr = evD.toLocaleDateString(_locale(), { weekday: 'long', day: 'numeric', month: 'long' }) +
            (evD.getHours() > 0 ? (_lang === 'da' ? ' kl. ' : ' at ') + evD.toLocaleTimeString(_locale(), { hour: '2-digit', minute: '2-digit' }) : '');
          var evEndStr = b.event_end_date
            ? (_lang === 'da' ? 'slutter kl. ' : 'ends at ') + new Date(b.event_end_date).toLocaleTimeString(_locale(), { hour: '2-digit', minute: '2-digit' })
            : '';
          var evBadge = evPast
            ? '<span style="font-size:0.62rem;padding:2px 7px;border-radius:99px;background:rgba(30,27,46,0.08);color:var(--muted);font-weight:600">Afsluttet</span>'
            : (evD <= new Date()
              ? '<span style="font-size:0.62rem;padding:2px 7px;border-radius:99px;background:rgba(46,207,207,0.2);color:#085041;font-weight:600">I gang</span>'
              : '<span style="font-size:0.62rem;padding:2px 7px;border-radius:99px;background:rgba(124,92,252,0.1);color:#534AB7;font-weight:600">' + t('bb_coming') + '</span>');
          return '<div style="background:rgba(46,207,207,0.08);border:0.5px solid rgba(46,207,207,0.25);border-radius:10px;padding:8px 12px;margin-top:0.6rem;display:flex;align-items:center;justify-content:space-between;gap:0.5rem">' +
            '<div style="text-align:left">' +
              '<div style="font-size:0.8rem;font-weight:700;color:#085041">' + evDateStr + '</div>' +
              (evEndStr ? '<div style="font-size:0.68rem;color:#0F6E56;margin-top:1px">' + evEndStr + '</div>' : '') +
            '</div>' +
            evBadge +
          '</div>';
        })() : '') +
        (b.description ? '<div style="font-size:0.8rem;color:var(--text-secondary);margin-top:0.5rem;line-height:1.6;text-align:left;padding:0.7rem 0.85rem;border-radius:10px;background:rgba(30,27,46,0.03);border:0.5px solid rgba(216,213,228,0.5);white-space:pre-line">' + escHtml(b.description) + '</div>' : '') +
        (b.external_url ? '<a href="' + escHtml(b.external_url) + '" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:0.6rem;margin-top:0.5rem;padding:0.6rem 0.85rem;border-radius:10px;background:rgba(124,92,252,0.05);border:0.5px solid rgba(124,92,252,0.15);text-decoration:none;cursor:pointer">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7C5CFC" stroke-width="2" stroke-linecap="round" style="flex-shrink:0"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>' +
          '<div style="flex:1;min-width:0"><div style="font-size:0.68rem;color:var(--muted);margin-bottom:1px">' + t('bi_link_label') + '</div>' +
          '<div style="font-size:0.78rem;font-weight:600;color:#534AB7;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escHtml(b.external_url.replace(/^https?:\/\//, '')) + '</div></div>' +
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2.5" stroke-linecap="round" style="flex-shrink:0"><path d="M9 6l6 6-6 6"/></svg>' +
        '</a>' : '') +
        (b.agenda ? '<div style="margin-top:0.7rem;padding:0.7rem 0.85rem;border-radius:10px;background:rgba(46,207,207,0.06);border:0.5px solid rgba(46,207,207,0.2);text-align:left">' +
          '<div style="font-size:0.68rem;font-weight:700;color:#0F6E56;text-transform:uppercase;letter-spacing:0.03em;margin-bottom:0.35rem">' + icon('calendar') + ' ' + t('bi_agenda') + '</div>' +
          '<div style="font-size:0.78rem;color:var(--text);line-height:1.6;white-space:pre-line">' + escHtml(b.agenda) + '</div>' +
        '</div>' : '') +
        (tagsHtml ? '<div style="display:flex;flex-wrap:wrap;gap:0.3rem;margin-top:0.5rem;justify-content:center">' + tagsHtml + '</div>' : '') +
      '</div>' +
      topJoinHtml +
      eventsHtml +
      statsHtml +
      adminHtml +
      bottomHtml;

  } catch(e) { logError("bcLoadInfo", e); errorToast("load", e); }
}

// ── Checkout from event (within bubble chat view) ──
async function bcCheckout() {
  if (!bcBubbleId || !currentUser) return;
  if (typeof _liveLock !== 'undefined' && _liveLock) return;

  // If this is the active live bubble, delegate to liveCheckout (handles all state cleanup)
  if (currentLiveBubble && (currentLiveBubble.bubble_id === bcBubbleId || currentLiveBubble.bubbleId === bcBubbleId)) {
    await liveCheckout();
    // Refresh bubble chat UI after checkout
    bcLoadBubbleInfo();
    bcLoadMembers();
    if (_bcActiveTab === 'info') bcLoadInfo();
    return;
  }

  // Non-live bubble checkout (edge case: checked in but not tracked as live)
  try {
    await sb.from('bubble_members').update({
      checked_out_at: new Date().toISOString()
    }).eq('bubble_id', bcBubbleId).eq('user_id', currentUser.id);

    showSuccessToast(t('toast_checkedout'));
    trackEvent('live_checkout', { bubble_id: bcBubbleId, via: 'bubble_chat' });

    bcLoadBubbleInfo();
    bcLoadMembers();
    if (_bcActiveTab === 'info') bcLoadInfo();
  } catch(e) {
    logError('bcCheckout', e);
    _renderToast(t('toast_generic_error'), 'error');
  }
}

// Person sheet from chat avatar


// ══════════════════════════════════════════════════════════
//  BUBBLE POSTS (Opslag) — one-way admin/owner announcements
// ══════════════════════════════════════════════════════════

var _bcPostsCache = null;
var _bcPostsProfileCache = {};

async function bcLoadPosts() {
  var list = document.getElementById('bc-posts-list');
  var fab = document.getElementById('bc-posts-fab');
  if (!list || !bcBubbleId) return;

  // Show FAB only for owner/admin
  var canPost = bcBubbleData && (bcBubbleData._isOwner || bcBubbleData._isAdmin);
  if (fab) fab.style.display = canPost ? 'flex' : 'none';

  list.innerHTML = skelCards(3);

  try {
    var { data: posts, error } = await sb.from('bubble_posts')
      .select('*')
      .eq('bubble_id', bcBubbleId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    _bcPostsCache = posts || [];

    if (_bcPostsCache.length === 0) {
      list.innerHTML = '<div class="empty-state" style="margin-top:2rem">' +
        '<div class="empty-icon">' + icon('file') + '</div>' +
        '<div class="empty-text">Ingen opslag endnu' +
        (canPost ? '<br><span style="font-size:0.72rem;color:var(--accent);cursor:pointer" onclick="bcOpenCreatePost()">Opret det første opslag →</span>' : '<br><span style="font-size:0.72rem">Administratorer kan dele nyheder og opdateringer her</span>') +
        '</div></div>';
      return;
    }

    // Fetch author profiles
    var authorIds = [...new Set(_bcPostsCache.map(function(p) { return p.author_id; }))];
    var { data: profiles } = await sb.from('profiles').select('id, name, avatar_url, title').in('id', authorIds);
    _bcPostsProfileCache = {};
    (profiles || []).forEach(function(p) { _bcPostsProfileCache[p.id] = p; });

    // Fetch linked events
    var eventIds = _bcPostsCache.filter(function(p) { return p.event_id; }).map(function(p) { return p.event_id; });
    var eventMap = {};
    if (eventIds.length > 0) {
      var { data: events } = await sb.from('bubbles').select('id, name, type').in('id', eventIds);
      (events || []).forEach(function(e) { eventMap[e.id] = e; });
    }

    // Fetch like counts + user's likes
    var postIds = _bcPostsCache.map(function(p) { return p.id; });
    var _postLikeCounts = {};
    var _postMyLikes = {};
    try {
      var { data: allLikes } = await sb.from('bubble_post_reactions').select('post_id, user_id').in('post_id', postIds);
      (allLikes || []).forEach(function(r) {
        _postLikeCounts[r.post_id] = (_postLikeCounts[r.post_id] || 0) + 1;
        if (r.user_id === currentUser.id) _postMyLikes[r.post_id] = true;
      });
    } catch(e) { /* table may not exist yet */ }
    window._postLikeCounts = _postLikeCounts;
    window._postMyLikes = _postMyLikes;

    // Render
    list.innerHTML = _bcPostsCache.map(function(post) {
      return bcRenderPostCard(post, _bcPostsProfileCache[post.author_id], eventMap[post.event_id]);
    }).join('');

  } catch(e) {
    logError('bcLoadPosts', e);
    showRetryState('bc-posts-list', 'bcLoadPosts', t('toast_load_failed'));
  }
}

function bcRenderPostCard(post, author, event) {
  var name = author ? escHtml(author.name || '') : t('misc_unknown');
  var initials = name.split(' ').map(function(w) { return w[0] || ''; }).join('').slice(0, 2).toUpperCase();
  var avatarHtml = author && author.avatar_url
    ? '<div class="bp-avatar">' + safeAvatarImg(author.avatar_url, 'width:100%;height:100%;object-fit:cover;border-radius:50%') + '</div>'
    : '<div class="bp-avatar" style="background:var(--accent)">' + initials + '</div>';

  var roleLabel = '';
  if (bcBubbleData && post.author_id === bcBubbleData.created_by) roleLabel = t('misc_owner');
  else roleLabel = t('misc_admin');

  var ago = timeAgo(post.created_at);
  var preview = escHtml((post.content || '').slice(0, 140));
  var hasMore = (post.content || '').length > 140;

  var eventChip = '';
  if (event) {
    eventChip = '<div class="bp-event-chip" onclick="event.stopPropagation();openBubbleChat(\'' + event.id + '\',\'screen-bubble-chat\')">' +
      ico('calendar') + ' ' + escHtml(event.name) + ' ›</div>';
  }

  var likeCount = (window._postLikeCounts || {})[post.id] || 0;
  var myLike = (window._postMyLikes || {})[post.id];
  var likeHtml = '<div class="bp-like-row" onclick="event.stopPropagation()">' +
    '<button class="bp-like-btn' + (myLike ? ' liked' : '') + '" id="bp-like-' + post.id + '" onclick="bcTogglePostLike(\'' + post.id + '\')">' +
    (myLike ? '❤️' : '🤍') + '</button>' +
    '<span class="bp-like-count" id="bp-like-count-' + post.id + '">' + (likeCount > 0 ? likeCount : '') + '</span></div>';

  return '<div class="bp-card" onclick="bcExpandPost(\'' + post.id + '\')">' +
    '<div class="bp-header">' +
    avatarHtml +
    '<div class="bp-meta"><div class="bp-author">' + name + ' <span style="font-size:0.6rem;color:var(--muted);font-weight:500">' + roleLabel + '</span></div>' +
    '<div class="bp-time">' + ago + '</div></div>' +
    '</div>' +
    '<div class="bp-title">' + escHtml(post.title) + '</div>' +
    '<div class="bp-preview">' + preview + '</div>' +
    (hasMore ? '<div class="bp-readmore">Læs mere ›</div>' : '') +
    eventChip +
    likeHtml +
    '</div>';
}

function bcExpandPost(postId) {
  var post = (_bcPostsCache || []).find(function(p) { return p.id === postId; });
  if (!post) return;
  var author = _bcPostsProfileCache[post.author_id];
  var name = author ? escHtml(author.name || '') : t('misc_unknown');
  var initials = name.split(' ').map(function(w) { return w[0] || ''; }).join('').slice(0, 2).toUpperCase();

  var avatarHtml = author && author.avatar_url
    ? '<div style="width:36px;height:36px;border-radius:50%;overflow:hidden;flex-shrink:0">' + safeAvatarImg(author.avatar_url, 'width:100%;height:100%;object-fit:cover') + '</div>'
    : '<div style="width:36px;height:36px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;color:white;font-size:0.6rem;font-weight:800;flex-shrink:0">' + initials + '</div>';

  // Format content: preserve newlines
  var contentHtml = escHtml(post.content || '').replace(/\n/g, '<br>');

  // Event link card
  var eventCard = '';
  if (post.event_id) {
    eventCard = '<div onclick="openBubbleChat(\'' + post.event_id + '\',\'screen-bubble-chat\')" style="padding:0.6rem 0.8rem;border-radius:12px;background:rgba(46,207,207,0.05);border:1px solid rgba(46,207,207,0.15);display:flex;align-items:center;gap:0.5rem;margin-top:1rem;cursor:pointer">' +
      '<div style="width:32px;height:32px;border-radius:10px;background:rgba(46,207,207,0.1);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--green);font-size:16px">' + ico('calendar') + '</div>' +
      '<div style="flex:1;min-width:0"><div style="font-size:0.78rem;font-weight:700;color:var(--green)" id="bp-expand-event-name">Henter event...</div></div>' +
      '<div style="font-size:0.88rem;color:var(--green)">›</div></div>';
  }

  // Delete button for owner/admin
  var deleteBtn = '';
  var expandLikeCount = (window._postLikeCounts || {})[post.id] || 0;
  var expandLiked = (window._postMyLikes || {})[post.id];
  var canDelete = bcBubbleData && (bcBubbleData._isOwner || bcBubbleData._isAdmin || post.author_id === currentUser.id);
  if (canDelete) {
    deleteBtn = '<button onclick="bcDeletePost(\'' + postId + '\')" style="width:100%;margin-top:0.6rem;padding:0.5rem;border-radius:10px;border:1px solid rgba(232,121,168,0.2);background:none;color:var(--accent2);font-family:inherit;font-size:0.72rem;font-weight:600;cursor:pointer">Slet opslag</button>';
  }

  var { overlay, sheet } = bbDynOpen();
  sheet.innerHTML = '<div style="width:36px;height:4px;border-radius:99px;background:rgba(30,27,46,0.08);margin:0 auto 1rem;cursor:pointer" onclick="bbDynClose(this.closest(\'.bb-dyn-overlay\'))"></div>' +
    '<div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:1rem">' + avatarHtml +
    '<div><div style="font-size:0.88rem;font-weight:700">' + name + '</div>' +
    '<div style="font-size:0.65rem;color:var(--muted)">' + timeAgo(post.created_at) + '</div></div></div>' +
    '<div style="font-size:1.05rem;font-weight:800;margin-bottom:0.6rem">' + escHtml(post.title) + '</div>' +
    '<div style="font-size:0.88rem;color:var(--text-secondary);line-height:1.65">' + contentHtml + '</div>' +
    eventCard +
    '<div class="bp-like-row" style="margin-top:1rem;padding-top:0.6rem;border-top:0.5px solid rgba(30,27,46,0.06)">' +
    '<button class="bp-like-btn' + (expandLiked ? ' liked' : '') + '" id="bp-expand-like-' + post.id + '" onclick="bcTogglePostLike(\'' + post.id + '\')">' + (expandLiked ? '❤️' : '🤍') + '</button>' +
    '<span class="bp-like-count" id="bp-expand-like-count-' + post.id + '">' + (expandLikeCount > 0 ? expandLikeCount : '') + '</span></div>' +
    '<button onclick="bbDynClose(this.closest(\'.bb-dyn-overlay\'))" style="width:100%;margin-top:0.8rem;padding:0.65rem;border-radius:12px;border:1px solid var(--glass-border);background:none;color:var(--text-secondary);font-family:inherit;font-size:0.78rem;font-weight:600;cursor:pointer">Luk</button>' +
    deleteBtn;

  // Fetch event name async if linked
  if (post.event_id) {
    sb.from('bubbles').select('name').eq('id', post.event_id).maybeSingle().then(function(r) {
      var el = document.getElementById('bp-expand-event-name');
      if (el && r.data) el.textContent = r.data.name;
    }).catch(function() {});
  }
}

async function bcOpenCreatePost() {
  if (!bcBubbleId || !bcBubbleData) return;

  document.getElementById('bp-title').value = '';
  document.getElementById('bp-content').value = '';

  // Build event picker: list child events of this bubble
  var picker = document.getElementById('bp-event-picker');
  picker.innerHTML = '<div style="font-size:0.72rem;color:var(--muted)">Henter events...</div>';

  openModal('sheet-create-post');

  try {
    var { data: events } = await sb.from('bubbles')
      .select('id, name, type')
      .or('parent_bubble_id.eq.' + bcBubbleId + ',id.eq.' + bcBubbleId)
      .eq('type', 'event')
      .order('created_at', { ascending: false })
      .limit(10);

    if (!events || events.length === 0) {
      picker.innerHTML = '<div style="padding:0.5rem 0.6rem;border-radius:8px;border:1px dashed var(--glass-border);font-size:0.72rem;color:var(--muted);text-align:center">Ingen events at linke til</div>';
    } else {
      picker.innerHTML = events.map(function(ev) {
        return '<label style="display:flex;align-items:center;gap:0.5rem;padding:0.45rem 0.6rem;border-radius:10px;border:1px solid var(--glass-border-subtle);margin-bottom:0.3rem;cursor:pointer;transition:border-color 0.15s" onclick="bcSelectPostEvent(this,\'' + ev.id + '\')">' +
          '<input type="radio" name="bp-event" value="' + ev.id + '" style="display:none">' +
          '<div style="width:24px;height:24px;border-radius:8px;background:rgba(46,207,207,0.08);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--green);font-size:0.7rem">' + ico('calendar') + '</div>' +
          '<div style="flex:1;font-size:0.78rem;font-weight:600;color:var(--text)">' + escHtml(ev.name) + '</div>' +
          '<div class="bp-radio-dot" style="width:16px;height:16px;border-radius:50%;border:2px solid var(--glass-border);flex-shrink:0;transition:all 0.15s"></div>' +
          '</label>';
      }).join('');
    }
  } catch(e) {
    picker.innerHTML = '<div style="font-size:0.72rem;color:var(--accent2)">Kunne ikke hente events</div>';
  }
}

function bcSelectPostEvent(label, eventId) {
  // Toggle selection
  var allLabels = label.parentElement.querySelectorAll('label');
  allLabels.forEach(function(l) {
    l.style.borderColor = '';
    l.style.background = '';
    var dot = l.querySelector('.bp-radio-dot');
    if (dot) { dot.style.borderColor = ''; dot.style.background = ''; }
    l.querySelector('input').checked = false;
  });
  var input = label.querySelector('input');
  if (input.value === label.parentElement._selectedEvent) {
    // Deselect
    label.parentElement._selectedEvent = null;
    return;
  }
  input.checked = true;
  label.style.borderColor = 'rgba(46,207,207,0.3)';
  label.style.background = 'rgba(46,207,207,0.03)';
  var dot = label.querySelector('.bp-radio-dot');
  if (dot) { dot.style.borderColor = 'var(--green)'; dot.style.background = 'var(--green)'; }
  label.parentElement._selectedEvent = eventId;
}

var _postSubmitLock = false;

async function bcSubmitPost() {
  if (_postSubmitLock) return;
  var title = document.getElementById('bp-title').value.trim();
  var content = document.getElementById('bp-content').value.trim();
  if (!title) { showWarningToast('Titel er påkrævet'); return; }

  _postSubmitLock = true;
  var picker = document.getElementById('bp-event-picker');
  var selectedEvent = picker ? picker._selectedEvent || null : null;

  showToast('Publicerer...');
  var result = await dbActions.createPost(bcBubbleId, title, content || null, selectedEvent);
  if (result.ok) {
    closeModal('sheet-create-post');
    showSuccessToast('Opslag publiceret');
    bcLoadPosts();
  } else {
    logError('bcSubmitPost', result.error);
  }
  _postSubmitLock = false;
}

async function bcDeletePost(postId) {
  try {
    var overlay = document.querySelector('.bb-dyn-overlay');
    if (!overlay) return;
    var target = overlay.querySelector('.bb-dyn-sheet');
    if (target) {
      bbConfirm(target, {
        label: t('bc_delete_post_confirm'),
        confirmText: t('misc_delete'),
        confirmClass: 'bb-confirm-btn-danger',
        onConfirm: "bcConfirmDeletePost('" + postId + "')"
      });
    }
  } catch(e) { logError('bcDeletePost', e); }
}

async function bcConfirmDeletePost(postId) {
  var result = await dbActions.deletePost(postId);
  if (result.ok) {
    var overlay = document.querySelector('.bb-dyn-overlay');
    if (overlay) bbDynClose(overlay);
    showSuccessToast('Opslag slettet');
    bcLoadPosts();
  }
}


// ── Post reactions: toggle like ──
async function bcTogglePostLike(postId) {
  if (!currentUser) return;
  var btn = document.getElementById('bp-like-' + postId);
  var countEl = document.getElementById('bp-like-count-' + postId);
  var liked = (window._postMyLikes || {})[postId];

  var result = await dbActions.toggleReaction(postId);
  if (result.ok) {
    if (!window._postMyLikes) window._postMyLikes = {};
    if (!window._postLikeCounts) window._postLikeCounts = {};
    if (result.liked) {
      window._postMyLikes[postId] = true;
      window._postLikeCounts[postId] = (window._postLikeCounts[postId] || 0) + 1;
    } else {
      delete window._postMyLikes[postId];
      window._postLikeCounts[postId] = Math.max((window._postLikeCounts[postId] || 1) - 1, 0);
    }
    // Update UI
    if (btn) btn.innerHTML = result.liked ? '❤️' : '🤍';
    if (btn) btn.classList.toggle('liked', result.liked);
    var c = window._postLikeCounts[postId] || 0;
    if (countEl) countEl.textContent = c > 0 ? c : '';
    // Update expanded view if open
    var expandBtn = document.getElementById('bp-expand-like-' + postId);
    var expandCount = document.getElementById('bp-expand-like-count-' + postId);
    if (expandBtn) expandBtn.innerHTML = result.liked ? '❤️' : '🤍';
    if (expandBtn) expandBtn.classList.toggle('liked', result.liked);
    if (expandCount) expandCount.textContent = c > 0 ? c : '';
  }
}