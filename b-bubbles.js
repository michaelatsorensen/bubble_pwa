// ══════════════════════════════════════════════════════════
//  BUBBLE — DISCOVER + BUBBLES + QR + PDF + INVITE
//  DOMAIN: bubbles
//  OWNS: inviteBubbleId, inviteSelected, cbChips, currentEditBubbleId
//  OWNS: createBubble, openBubble, joinBubble, leaveBubble, openInviteModal, generateEventReport
//  READS: currentUser, bcBubbleId, bcBubbleData (from chat domain)
//  Auto-split from app.js · v3.7.0
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
//  DISCOVER
// ══════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════
//  BUBBLE UPVOTES / ANBEFAL
// ══════════════════════════════════════════════════════════
var bubbleUpvotes = {}; // { bubbleId: count }
var myUpvotes = {};     // { bubbleId: true }

async function loadBubbleUpvotes() {
  try {
    if (!currentUser) return;
    var { data: all, error } = await sb.from('bubble_upvotes').select('bubble_id');
    if (error) { logError('loadBubbleUpvotes', error); return; }
    bubbleUpvotes = {};
    (all || []).forEach(function(row) {
      bubbleUpvotes[row.bubble_id] = (bubbleUpvotes[row.bubble_id] || 0) + 1;
    });
    if (!currentUser) return;
    var { data: mine } = await sb.from('bubble_upvotes').select('bubble_id').eq('user_id', currentUser.id);
    myUpvotes = {};
    (mine || []).forEach(function(row) { myUpvotes[row.bubble_id] = true; });
  } catch(e) { logError('loadBubbleUpvotes', e); }
}

async function toggleBubbleUpvote(bubbleId) {
  try {
    if (myUpvotes[bubbleId]) {
      var { error } = await sb.from('bubble_upvotes').delete().eq('user_id', currentUser.id).eq('bubble_id', bubbleId);
      if (error) { showToast('Kunne ikke fjerne anbefaling'); return; }
      delete myUpvotes[bubbleId];
      bubbleUpvotes[bubbleId] = Math.max((bubbleUpvotes[bubbleId] || 1) - 1, 0);
      showToast('Anbefaling fjernet');
    } else {
      var { error } = await sb.from('bubble_upvotes').insert({ user_id: currentUser.id, bubble_id: bubbleId });
      if (error) { showToast('Kunne ikke anbefale'); return; }
      myUpvotes[bubbleId] = true;
      bubbleUpvotes[bubbleId] = (bubbleUpvotes[bubbleId] || 0) + 1;
      showToast('Anbefalet \u2713');
    }
    // Re-render discover if visible
    if (allBubbles && allBubbles.length) {
      var nl = document.getElementById('discover-net-list');
      var el = document.getElementById('discover-evt-list');
      if (nl && nl.offsetParent) _renderDiscoverList(nl, allBubbles.filter(function(b){return b.type!=='event';}), 'netværk');
      if (el && el.offsetParent) _renderDiscoverList(el, allBubbles.filter(function(b){return b.type==='event';}), 'events');
    }
    // Update info panel button if open
    var recBtn = document.getElementById('bc-recommend-btn');
    if (recBtn && bcBubbleId === bubbleId) {
      recBtn.innerHTML = myUpvotes[bubbleId] ? icon('checkCircle') + ' Anbefalet' : icon('rocket') + ' Anbefal';
      recBtn.className = myUpvotes[bubbleId] ? 'chat-info-btn success' : 'chat-info-btn primary';
    }
    // Update action bar button
    var barBtn = document.getElementById('bc-upvote-bar-btn');
    if (barBtn && bcBubbleId === bubbleId) {
      var up = myUpvotes[bubbleId];
      barBtn.innerHTML = (up ? icon('checkCircle') : icon('rocket')) + ' ' + (up ? 'Anbefalet' : 'Anbefal');
      barBtn.classList.toggle('active', !!up);
    }
  } catch(e) { logError('toggleBubbleUpvote', e); errorToast('save', e); }
}

var _discoverLoaded = false;

// Instant UI update after joining a bubble — removes from Discover, refreshes Mine
function _bbAfterJoin(bubbleId) {
  // 1. Remove from allBubbles array
  allBubbles = allBubbles.filter(function(b) { return b.id !== bubbleId; });
  _discoverLoaded = false;
  // 2. Remove card from visible discover lists (instant DOM removal)
  ['discover-net-list', 'discover-evt-list'].forEach(function(listId) {
    var list = document.getElementById(listId);
    if (!list) return;
    var card = list.querySelector('[data-id="' + bubbleId + '"]');
    if (card) { card.style.transition = 'opacity 0.2s,transform 0.2s'; card.style.opacity = '0'; card.style.transform = 'scale(0.95)'; setTimeout(function() { card.remove(); }, 200); }
  });
  // 3. Remove from pending invites if visible
  var invCards = document.querySelectorAll('#bb-pending-invites .card');
  invCards.forEach(function(c) {
    var btn = c.querySelector('[onclick*="' + bubbleId + '"]');
    if (btn) { c.style.transition = 'opacity 0.2s'; c.style.opacity = '0'; setTimeout(function() { c.remove(); }, 200); }
  });
}

async function _fetchDiscoverData() {
  if (_discoverLoaded && allBubbles.length > 0) return;
  try {
    if (!currentUser) return;
    var myNav = _navVersion;
    await loadBubbleUpvotes();
    if (_navVersion !== myNav) return;

    var myBubbleIds = [];
    var mySavedIds = [];
    var [membRes, savedRes] = await Promise.all([
      sb.from('bubble_members').select('bubble_id').eq('user_id', currentUser.id),
      sb.from('saved_contacts').select('contact_id').eq('user_id', currentUser.id)
    ]);
    myBubbleIds = (membRes.data || []).map(function(m) { return m.bubble_id; });
    mySavedIds = (savedRes.data || []).map(function(s) { return s.contact_id; });
    if (_navVersion !== myNav) return;

    var { data: bubbles } = await sb.from('bubbles').select('*, bubble_members(count)').or('visibility.eq.public,visibility.eq.private,visibility.is.null').order('created_at', {ascending:false});
    if (_navVersion !== myNav) return;
    allBubbles = (bubbles || []).filter(function(b) {
      return b.type !== 'live' && myBubbleIds.indexOf(b.id) < 0;
    }).map(function(b) {
      return Object.assign({}, b, {
        member_count: b.member_count ?? b.bubble_members?.[0]?.count ?? 0,
        type_label: typeLabel(b.type),
        upvote_count: bubbleUpvotes[b.id] || 0
      });
    });

    var discoverBubbleIds = allBubbles.map(function(b) { return b.id; });
    var contactMemberMap = await fetchContactAvatarsForBubbles(discoverBubbleIds, mySavedIds);
    if (_navVersion !== myNav) return;
    allBubbles.forEach(function(b) { b._contacts = contactMemberMap[b.id] || []; });

    // Resolve parent + grandparent names for child bubbles
    var parentIds = allBubbles.filter(function(b) { return b.parent_bubble_id; }).map(function(b) { return b.parent_bubble_id; }).filter(function(v, i, a) { return a.indexOf(v) === i; });
    if (parentIds.length > 0) {
      var { data: parents } = await sb.from('bubbles').select('id, name, parent_bubble_id').in('id', parentIds);
      if (_navVersion !== myNav) return;
      var parentMap = {};
      (parents || []).forEach(function(p) { parentMap[p.id] = p; });

      // Find grandparent IDs (parent's parent)
      var gpIds = (parents || []).filter(function(p) { return p.parent_bubble_id; }).map(function(p) { return p.parent_bubble_id; }).filter(function(v, i, a) { return a.indexOf(v) === i; });
      var gpMap = {};
      if (gpIds.length > 0) {
        var { data: gps } = await sb.from('bubbles').select('id, name').in('id', gpIds);
        if (_navVersion !== myNav) return;
        (gps || []).forEach(function(g) { gpMap[g.id] = g.name; });
      }

      allBubbles.forEach(function(b) {
        if (b.parent_bubble_id && parentMap[b.parent_bubble_id]) {
          var p = parentMap[b.parent_bubble_id];
          b._parentName = p.name;
          if (p.parent_bubble_id && gpMap[p.parent_bubble_id]) {
            b._grandparentName = gpMap[p.parent_bubble_id];
          }
        }
      });
    }

    allBubbles.sort(function(a, b) {
      if (b.upvote_count !== a.upvote_count) return b.upvote_count - a.upvote_count;
      if (b.member_count !== a.member_count) return b.member_count - a.member_count;
      return new Date(b.created_at) - new Date(a.created_at);
    });
    _discoverLoaded = true;
  } catch(e) { logError('_fetchDiscoverData', e); throw e; }
}

async function loadDiscoverNetworks() {
  var list = document.getElementById('discover-net-list');
  if (!list) return;
  list.innerHTML = skelCards(4);
  try {
    await _fetchDiscoverData();
    var nets = allBubbles.filter(function(b) { return b.type !== 'event'; });
    _renderDiscoverList(list, nets, 'netværk');
  } catch(e) { showRetryState('discover-net-list', 'loadDiscoverNetworks', 'Kunne ikke hente netværk'); }
}

async function loadDiscoverEvents() {
  var list = document.getElementById('discover-evt-list');
  if (!list) return;
  list.innerHTML = skelCards(4);
  try {
    await _fetchDiscoverData();
    var evts = allBubbles.filter(function(b) { return b.type === 'event'; });
    _renderDiscoverList(list, evts, 'events');
  } catch(e) { showRetryState('discover-evt-list', 'loadDiscoverEvents', 'Kunne ikke hente events'); }
}

// Compat wrapper — called from pull-to-refresh and other places
async function loadDiscover() {
  _discoverLoaded = false;
  if (_bbActiveSub === 'evt') loadDiscoverEvents();
  else loadDiscoverNetworks();
}

function _renderDiscoverList(list, bubbles, label) {
  if (!bubbles.length) {
    list.innerHTML = '<div class="empty-state"><div class="empty-icon">' + icon('search') + '</div><div class="empty-text">Ingen ' + label + ' at opdage endnu</div></div>';
    return;
  }
  list.innerHTML = bubbles.map(function(b) { return bubbleCard(b, false); }).join('');
}

let _filterTimer = null;
function filterBubbles(type) {
  clearTimeout(_filterTimer);
  _filterTimer = setTimeout(function() {
    var searchId = type === 'evt' ? 'bubble-search-evt' : 'bubble-search-net';
    var listId = type === 'evt' ? 'discover-evt-list' : 'discover-net-list';
    var list = document.getElementById(listId);
    var input = document.getElementById(searchId);
    if (!list || !input) return;
    var q = input.value.toLowerCase();
    var source = type === 'evt'
      ? allBubbles.filter(function(b) { return b.type === 'event'; })
      : allBubbles.filter(function(b) { return b.type !== 'event'; });
    var filtered = q ? source.filter(function(b) {
      return b.name.toLowerCase().indexOf(q) >= 0 || (b.keywords || []).some(function(k) { return k.toLowerCase().indexOf(q) >= 0; });
    }) : source;
    var label = type === 'evt' ? 'events' : 'netværk';
    if (q && filtered.length === 0) {
      list.innerHTML = '<div class="empty-state" style="padding:2rem 0"><div class="empty-icon">' + icon('search') + '</div><div class="empty-text">Ingen ' + label + ' matcher "' + escHtml(q) + '"</div></div>';
    } else {
      _renderDiscoverList(list, filtered, label);
    }
  }, 150);
}

// ══════════════════════════════════════════════════════════
//  BUBBLE DETAIL
// ══════════════════════════════════════════════════════════
async function openBubble(bubbleId, fromScreen) {
  try {
    // Auto-detect current screen if not provided
    if (!fromScreen) fromScreen = _activeScreen || 'screen-home';
    await openBubbleChat(bubbleId, fromScreen);
  } catch(e) { logError("openBubble", e); errorToast("load", e); }
}

// loadBubbleMembers removed — integrated into screen-bubble-chat bcLoadMembers

async function joinBubble(bubbleId) {
  try {
    const { error } = await sb.from('bubble_members').insert({ bubble_id: bubbleId, user_id: currentUser.id });
    if (error && !String(error.message || '').includes('duplicate')) return showToast('Fejl ved joining');
    showSuccessToast('Du er nu i boblen');
    _bbAfterJoin(bubbleId);
    await openBubble(bubbleId);
    loadHome();
    trackEvent('bubble_joined', { bubble_id: bubbleId });
    // Notify owner via Broadcast
    try {
      var { data: bub } = await sb.from('bubbles').select('name, created_by').eq('id', bubbleId).single();
      if (bub && bub.created_by && bub.created_by !== currentUser.id) {
        var ch = sb.channel('member-notify-' + bub.created_by);
        await ch.subscribe();
        await ch.send({ type: 'broadcast', event: 'new_member', payload: { bubbleName: bub.name || '', bubbleId: bubbleId, memberName: currentProfile?.name || '' } });
        setTimeout(function() { ch.unsubscribe(); }, 2000);
      }
    } catch(e2) { console.debug('[join] broadcast error:', e2); }
  } catch(e) { logError("joinBubble", e); errorToast("save", e); }
}

// ══════════════════════════════════════════════════════════
//  OWNERSHIP TRANSFER + ADMIN DESIGNATION
// ══════════════════════════════════════════════════════════
var _memberSheetEl = null;

function _buildMemberSheet(title, subtitle, members) {
  // Reusable member picker sheet
  if (_memberSheetEl) bbDynClose(_memberSheetEl);

  var { overlay, sheet } = bbDynOpen();
  overlay.id = 'member-action-overlay';

  var avColors = proxColors || ['linear-gradient(135deg,#6366F1,#7C5CFC)'];

  sheet.innerHTML = '<div style="width:36px;height:4px;border-radius:99px;background:rgba(30,27,46,0.12);margin:0 auto 1rem;cursor:pointer" onclick="closeMemberSheet()"></div>' +
    '<div style="font-size:1.05rem;font-weight:800;margin-bottom:0.3rem">' + title + '</div>' +
    '<div style="font-size:0.78rem;color:var(--text-secondary);margin-bottom:1rem">' + subtitle + '</div>' +
    '<div id="member-sheet-list">' +
    members.map(function(m, i) {
      var p = m.profiles || {};
      var ini = (p.name||'?').split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();
      var avHtml = p.avatar_url ?
        '<div style="width:40px;height:40px;border-radius:50%;overflow:hidden;flex-shrink:0"><img src="' + escHtml(p.avatar_url) + '" style="width:100%;height:100%;object-fit:cover"></div>' :
        '<div style="width:40px;height:40px;border-radius:50%;background:' + avColors[i % avColors.length] + ';display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700;color:white;flex-shrink:0">' + ini + '</div>';
      var isAdmin = m.role === 'admin';
      var adminBadge = isAdmin ? '<span class="admin-badge" style="font-size:0.55rem;background:rgba(124,92,252,0.1);color:var(--accent);padding:0.1rem 0.35rem;border-radius:6px;font-weight:600">Admin</span>' : '';
      return '<div class="member-pick-row" data-uid="' + m.user_id + '" data-name="' + escHtml(p.name||'?').replace(/"/g,'&quot;') + '" style="display:flex;align-items:center;gap:0.75rem;padding:0.75rem;border-radius:12px;border:1px solid var(--glass-border-subtle);margin-bottom:0.4rem;cursor:pointer;transition:all 0.15s">' +
        avHtml +
        '<div style="flex:1"><div style="font-weight:600;font-size:0.85rem;display:flex;align-items:center;gap:0.3rem">' + escHtml(p.name||'Ukendt') + ' ' + adminBadge + '</div><div style="font-size:0.72rem;color:var(--text-secondary)">' + escHtml(p.title||'') + '</div></div>' +
        '<div style="color:var(--accent);font-size:0.72rem;font-weight:600">Vælg</div>' +
      '</div>';
    }).join('') +
    '</div>' +
    '<div id="member-sheet-tray" style="display:none"></div>';

  _memberSheetEl = overlay;
}

function closeMemberSheet() {
  if (_memberSheetEl) { bbDynClose(_memberSheetEl); _memberSheetEl = null; }
}

function _showMemberTray(userId, userName, confirmText, cancelText, onConfirm) {
  var list = document.getElementById('member-sheet-list');
  var tray = document.getElementById('member-sheet-tray');
  if (!list || !tray) return;
  list.style.display = 'none';
  tray.style.display = 'block';
  tray.innerHTML = '<div style="text-align:center;padding:1rem 0">' +
    '<div style="font-size:0.92rem;font-weight:700;margin-bottom:0.3rem">' + confirmText.replace('{name}', '<strong>' + escHtml(userName) + '</strong>') + '</div>' +
    '<div style="font-size:0.72rem;color:var(--text-secondary);margin-bottom:1rem">Denne handling kan ikke fortrydes</div>' +
    '<div style="display:flex;gap:0.5rem;justify-content:center">' +
    '<button style="flex:1;padding:0.65rem;border-radius:12px;background:var(--gradient-primary);color:white;border:none;font-family:inherit;font-weight:700;font-size:0.82rem;cursor:pointer" onclick="' + onConfirm + '">Bekræft</button>' +
    '<button style="flex:1;padding:0.65rem;border-radius:12px;background:none;color:var(--text-secondary);border:1px solid var(--glass-border);font-family:inherit;font-weight:600;font-size:0.82rem;cursor:pointer" onclick="closeMemberSheet()">Annuller</button>' +
    '</div></div>';
}

// ── Transfer ownership ──
async function openTransferOwnership(bubbleId) {
  try {
    var { data: allMem, error: memErr } = await sb.from('bubble_members')
      .select('user_id, role, status')
      .eq('bubble_id', bubbleId)
      .neq('user_id', currentUser.id);
    if (memErr) { logError('openTransferOwnership:query', memErr); errorToast('load', memErr); return; }
    var members = (allMem || []).filter(function(m) { return m.status !== 'pending'; });
    if (members.length === 0) { showToast('Ingen medlemmer at overdrage til — inviter nogen først'); return; }
    var uIds = members.map(function(m) { return m.user_id; });
    var { data: profs } = await sb.from('profiles').select('id, name, title, avatar_url').in('id', uIds);
    var pm = {}; (profs || []).forEach(function(p) { pm[p.id] = p; });
    members.forEach(function(m) { m.profiles = pm[m.user_id] || { name: 'Ukendt' }; });

    _buildMemberSheet(
      '<span style="display:inline-flex;align-items:center;gap:0.3rem">' + ico('crown').replace('<svg ','<svg style="width:1.1rem;height:1.1rem" ') + ' Overdrag ejerskab</span>',
      'Vælg det nye medlem der skal overtage som ejer. Du mister ejer-rettigheder.',
      members
    );
    document.querySelectorAll('#member-sheet-list .member-pick-row').forEach(function(row) {
      row.onclick = function() {
        var uid = row.dataset.uid;
        var uname = row.dataset.name;
        var list = document.getElementById('member-sheet-list');
        var tray = document.getElementById('member-sheet-tray');
        list.style.display = 'none';
        tray.style.display = 'block';
        tray.innerHTML = '<div style="text-align:center;padding:1rem 0">' +
          '<div style="font-size:0.92rem;font-weight:700;margin-bottom:0.3rem">Overdrag ejerskab til <strong>' + escHtml(uname) + '</strong>?</div>' +
          '<div style="font-size:0.72rem;color:var(--text-secondary);margin-bottom:1rem">Du mister ejer-rettigheder. Denne handling kan ikke fortrydes.</div>' +
          '<div style="display:flex;gap:0.5rem;justify-content:center">' +
          '<button id="transfer-confirm-yes" style="flex:1;padding:0.65rem;border-radius:12px;background:var(--gradient-primary);color:white;border:none;font-family:inherit;font-weight:700;font-size:0.82rem;cursor:pointer">Bekræft overdragelse</button>' +
          '<button id="transfer-confirm-no" style="flex:1;padding:0.65rem;border-radius:12px;background:none;color:var(--text-secondary);border:1px solid var(--glass-border);font-family:inherit;font-weight:600;font-size:0.82rem;cursor:pointer">Annuller</button>' +
          '</div></div>';
        document.getElementById('transfer-confirm-yes').onclick = function() {
          _executeTransfer(bubbleId, uid, uname);
        };
        document.getElementById('transfer-confirm-no').onclick = function() {
          closeMemberSheet();
        };
      };
    });
  } catch(e) { logError('openTransferOwnership', e); errorToast('load', e); }
}

async function _executeTransfer(bubbleId, newOwnerId, newOwnerName) {
  try {
    var confirmBtn = document.getElementById('transfer-confirm-yes');
    if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = 'Overdrager...'; }
    var { data: updated, error } = await sb.from('bubbles').update({ created_by: newOwnerId }).eq('id', bubbleId).select();
    if (error) { errorToast('save', error); if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = 'Bekræft overdragelse'; } return; }
    if (!updated || updated.length === 0) {
      showToast('Kunne ikke overdrage — du er muligvis ikke ejer længere');
      if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = 'Bekræft overdragelse'; }
      return;
    }
    closeMemberSheet();
    showSuccessToast('Ejerskab overdraget til ' + newOwnerName);
    trackEvent('bubble_ownership_transferred', { bubble_id: bubbleId, new_owner: newOwnerId });
    if (typeof bcLoadBubbleInfo === 'function') bcLoadBubbleInfo();
    if (typeof bcLoadInfo === 'function') bcLoadInfo();
  } catch(e) { logError('_executeTransfer', e); errorToast('save', e); }
}

// ── Admin designation ──
async function openAdminDesignation(bubbleId) {
  try {
    var { data: allMem, error: memErr } = await sb.from('bubble_members')
      .select('user_id, role, status')
      .eq('bubble_id', bubbleId)
      .neq('user_id', currentUser.id);
    if (memErr) { logError('openAdminDesignation:query', memErr); errorToast('load', memErr); return; }
    var members = (allMem || []).filter(function(m) { return m.status !== 'pending'; });
    if (members.length === 0) { showToast('Ingen medlemmer at udpege'); return; }
    var uIds = members.map(function(m) { return m.user_id; });
    var { data: profs } = await sb.from('profiles').select('id, name, title, avatar_url').in('id', uIds);
    var pm = {}; (profs || []).forEach(function(p) { pm[p.id] = p; });
    members.forEach(function(m) { m.profiles = pm[m.user_id] || { name: 'Ukendt' }; });
    _buildMemberSheet(
      '<span style="display:inline-flex;align-items:center;gap:0.3rem">' + ico('crown').replace('<svg ','<svg style="width:1.1rem;height:1.1rem" ') + ' Udpeg admin</span>',
      'Admins kan redigere boblen, invitere og fjerne medlemmer.',
      members
    );
    document.querySelectorAll('#member-sheet-list .member-pick-row').forEach(function(row) {
      row.onclick = function() {
        var isAdmin = row.querySelector('.admin-badge');
        if (isAdmin) {
          _selectRemoveAdmin(bubbleId, row.dataset.uid, row.dataset.name);
        } else {
          _selectMakeAdmin(bubbleId, row.dataset.uid, row.dataset.name);
        }
      };
    });
  } catch(e) { logError('openAdminDesignation', e); errorToast('load', e); }
}

function _selectMakeAdmin(bubbleId, userId, userName) {
  _showMemberTray(userId, userName, 'Gør {name} til admin?',
    'Annuller',
    '_executeSetRole(\'' + bubbleId + '\',\'' + userId + '\',\'' + escHtml(userName).replace(/'/g,"\\'") + '\',\'admin\')');
}

function _selectRemoveAdmin(bubbleId, userId, userName) {
  _showMemberTray(userId, userName, 'Fjern admin-rettigheder fra {name}?',
    'Annuller',
    '_executeSetRole(\'' + bubbleId + '\',\'' + userId + '\',\'' + escHtml(userName).replace(/'/g,"\\'") + '\',\'member\')');
}

async function _executeSetRole(bubbleId, userId, userName, role) {
  try {
    var { error } = await sb.from('bubble_members').update({ role: role }).eq('bubble_id', bubbleId).eq('user_id', userId);
    if (error) { errorToast('save', error); return; }
    closeMemberSheet();
    if (role === 'admin') {
      showSuccessToast(userName + ' er nu admin');
    } else {
      showToast(userName + ' er ikke længere admin');
    }
    trackEvent('bubble_role_changed', { bubble_id: bubbleId, user_id: userId, role: role });
    await bcLoadMembers();
  } catch(e) { logError('_executeSetRole', e); errorToast('save', e); }
}

async function leaveBubble(bubbleId, btnEl) {
  // If user is owner, warn to transfer first
  if (bcBubbleData && bcBubbleData.created_by === currentUser.id) {
    var { count } = await sb.from('bubble_members').select('*', { count: 'exact', head: true }).eq('bubble_id', bubbleId).neq('user_id', currentUser.id);
    if (count > 0) {
      showToast('Du er ejer — overdrag ejerskab først under Info-fanen');
      return;
    }
  }
  var target = btnEl || document.querySelector('[data-action="leaveBubble"]');
  if (!target) return;
  var isEvent = bcBubbleData && (bcBubbleData.type === 'event' || bcBubbleData.type === 'live');
  bbConfirm(target, {
    label: isEvent ? 'Du fjernes fra deltagerlisten' : 'Du mister adgang til chat og deltagere',
    confirmText: isEvent ? 'Ja, forlad event' : 'Ja, forlad',
    confirmClass: 'bb-confirm-btn-danger',
    onConfirm: "confirmLeaveBubble('" + bubbleId + "')"
  });
}

function cancelLeaveBubble() {
  // Legacy — bbConfirm handles cancel via its own Annuller button
}

async function confirmLeaveBubble(bubbleId) {
  try {
    // Clear live state if checked into this bubble
    if (currentLiveBubble && currentLiveBubble.bubble_id === bubbleId) {
      currentLiveBubble = null;
      appMode.clearLive();
    }
    await sb.from('bubble_members').delete().eq('bubble_id', bubbleId).eq('user_id', currentUser.id);
    var isEvent = bcBubbleData && (bcBubbleData.type === 'event' || bcBubbleData.type === 'live');
    showToast(isEvent ? 'Du har forladt eventet' : 'Du har forladt boblen');
    _discoverLoaded = false;
    loadHome();
    loadMyBubbles();
    var backBtn = document.getElementById('bc-back-btn');
    if (backBtn) { backBtn.click(); } else { goTo(_activeScreen || 'screen-home'); }
  } catch(e) { logError("confirmLeaveBubble", e); errorToast("save", e); }
}

// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
//  CREATE BUBBLE
// ══════════════════════════════════════════════════════════
function openCreateBubble() {
  openModal('modal-create-picker');
}

function openCreateEventModal() {
  // Use standard create-bubble sheet with event type pre-selected
  cbChips = [];
  document.getElementById('cb-name').value = '';
  document.getElementById('cb-desc').value = '';
  document.getElementById('cb-location').value = '';
  renderChips('cb-chips', cbChips, 'cb-chips-container', 'cb-chip-input');
  var modal = document.getElementById('bb-sheet-create-bubble');
  if (modal) delete modal.dataset.parentBubbleId;
  var parentLabel = document.getElementById('cb-parent-label');
  if (parentLabel) { parentLabel.style.display = 'none'; parentLabel.textContent = ''; }
  bbOpen('create-bubble');
  var _cbTitle = document.getElementById('cb-sheet-title');
  if (_cbTitle) _cbTitle.textContent = 'Opret event';
  setTimeout(function() {
    initInputConfirmButtons();
    var typeSelect = document.getElementById('cb-type');
    if (typeSelect) typeSelect.value = 'event';
    // Hide type selector — already chosen in picker
    var typeGroup = typeSelect?.closest('.input-group');
    if (typeGroup) typeGroup.style.display = 'none';
    var oldTypePills = document.getElementById('cb-type-pills');
    if (oldTypePills) oldTypePills.remove();
    cbRenderPillSelect('cb-visibility', [
      { value: 'public',  icon: 'globe', label: 'Offentlig' },
      { value: 'private', icon: 'lock',  label: 'Privat' },
      { value: 'hidden',  icon: 'eye',   label: 'Skjult' }
    ]);
    // Show event fields
    var cmg = document.getElementById('cb-checkin-mode-group');
    var edg = document.getElementById('cb-event-date-group');
    var etg = document.getElementById('cb-event-time-row');
    var etge = document.getElementById('cb-event-time-end-group');
    if (cmg) cmg.style.display = 'block';
    if (edg) edg.style.display = 'block';
    if (etg) etg.style.display = 'block';
    if (etge) etge.style.display = 'block';
    var dateInput = document.getElementById('cb-event-date');
    if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
  }, 50);
}

function openCreateEventFromBubble(parentBubbleId) {
  // Block creating events under events (only network bubbles can have child events)
  // Only check if we're currently in bubble-chat AND viewing the same bubble
  if (_activeScreen === 'screen-bubble-chat' && bcBubbleId === parentBubbleId && bcBubbleData && (bcBubbleData.type === 'event' || bcBubbleData.type === 'live')) {
    showToast('Events kan kun oprettes under netværksbobler');
    return;
  }
  // Pre-fill create modal as event type, with parent bubble id stored
  cbChips = [];
  document.getElementById('cb-name').value = '';
  document.getElementById('cb-desc').value = '';
  document.getElementById('cb-location').value = '';
  renderChips('cb-chips', cbChips, 'cb-chips-container', 'cb-chip-input');
  // Store parent bubble id on the modal for use in createBubble()
  var modal = document.getElementById('bb-sheet-create-bubble');
  if (modal) modal.dataset.parentBubbleId = parentBubbleId;
  bbOpen('create-bubble');
  var _cbTitle = document.getElementById('cb-sheet-title');
  if (_cbTitle) _cbTitle.textContent = 'Opret event';
  setTimeout(function() {
    initInputConfirmButtons();
    // Force event type selected, hide type picker
    var typeSelect = document.getElementById('cb-type');
    if (typeSelect) typeSelect.value = 'event';
    cbRenderPillSelect('cb-type', [
      { value: 'event', icon: 'calendar', label: 'Event' }
    ]);
    cbRenderPillSelect('cb-visibility', [
      { value: 'public',  icon: 'globe', label: 'Offentlig' },
      { value: 'private', icon: 'lock',  label: 'Privat' },
      { value: 'hidden',  icon: 'eye',   label: 'Skjult' }
    ]);
    // Show parent attribution label
    var parentLabel = document.getElementById('cb-parent-label');
    if (parentLabel) parentLabel.style.display = 'block';
    // Show checkin mode + date/time for events
    var cmg = document.getElementById('cb-checkin-mode-group');
    if (cmg) cmg.style.display = 'block';
    var edg = document.getElementById('cb-event-date-group');
    var etg = document.getElementById('cb-event-time-row');
    var etge = document.getElementById('cb-event-time-end-group');
    if (edg) edg.style.display = 'block';
    if (etg) etg.style.display = 'block';
    if (etge) etge.style.display = 'block';
    // Default date to today
    var dateInput = document.getElementById('cb-event-date');
    if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
    // Fetch parent name async
    sb.from('bubbles').select('name').eq('id', parentBubbleId).maybeSingle().then(function(r) {
      if (r.data && parentLabel) {
        parentLabel.textContent = 'Event under: ' + r.data.name;
      }
    }).catch(function() {});
  }, 50);
}

function openCreateSubBubble(parentBubbleId) {
  // Create a sub-bubble (network type) under a parent
  cbChips = [];
  document.getElementById('cb-name').value = '';
  document.getElementById('cb-desc').value = '';
  document.getElementById('cb-location').value = '';
  renderChips('cb-chips', cbChips, 'cb-chips-container', 'cb-chip-input');
  var modal = document.getElementById('bb-sheet-create-bubble');
  if (modal) modal.dataset.parentBubbleId = parentBubbleId;
  bbOpen('create-bubble');
  var _cbTitle = document.getElementById('cb-sheet-title');
  if (_cbTitle) _cbTitle.textContent = 'Opret netv\u00E6rk';
  setTimeout(function() {
    initInputConfirmButtons();
    var typeSelect = document.getElementById('cb-type');
    if (typeSelect) typeSelect.value = 'network';
    cbRenderPillSelect('cb-type', [
      { value: 'network', icon: 'bubble', label: 'Netværk' }
    ]);
    cbRenderPillSelect('cb-visibility', [
      { value: 'public',  icon: 'globe', label: 'Offentlig' },
      { value: 'private', icon: 'lock',  label: 'Privat' },
      { value: 'hidden',  icon: 'eye',   label: 'Skjult' }
    ]);
    var parentLabel = document.getElementById('cb-parent-label');
    if (parentLabel) parentLabel.style.display = 'block';
    // Hide event-specific fields
    var cmg = document.getElementById('cb-checkin-mode-group');
    if (cmg) cmg.style.display = 'none';
    var edg = document.getElementById('cb-event-date-group');
    var etg = document.getElementById('cb-event-time-row');
    var etge = document.getElementById('cb-event-time-end-group');
    if (edg) edg.style.display = 'none';
    if (etg) etg.style.display = 'none';
    if (etge) etge.style.display = 'none';
    sb.from('bubbles').select('name').eq('id', parentBubbleId).maybeSingle().then(function(r) {
      if (r.data && parentLabel) {
        parentLabel.textContent = 'Sub-boble under: ' + r.data.name;
      }
    }).catch(function() {});
  }, 50);
}

function openCreateNetworkModal() {
  cbChips = [];
  document.getElementById('cb-name').value = '';
  document.getElementById('cb-desc').value = '';
  document.getElementById('cb-location').value = '';
  renderChips('cb-chips', cbChips, 'cb-chips-container', 'cb-chip-input');
  // Clear any lingering parent bubble state
  var modal = document.getElementById('bb-sheet-create-bubble');
  if (modal) delete modal.dataset.parentBubbleId;
  var parentLabel = document.getElementById('cb-parent-label');
  if (parentLabel) { parentLabel.style.display = 'none'; parentLabel.textContent = ''; }
  // Hide checkin mode + date/time (not relevant for networks)
  var cmg = document.getElementById('cb-checkin-mode-group');
  if (cmg) cmg.style.display = 'none';
  var edg = document.getElementById('cb-event-date-group');
  var etg = document.getElementById('cb-event-time-row');
  var etge = document.getElementById('cb-event-time-end-group');
  if (edg) edg.style.display = 'none';
  if (etg) etg.style.display = 'none';
  if (etge) etge.style.display = 'none';
  bbOpen('create-bubble');
  var _cbTitle = document.getElementById('cb-sheet-title');
  if (_cbTitle) _cbTitle.textContent = 'Opret netv\u00E6rk';
  setTimeout(function() {
    initInputConfirmButtons();
    var typeSelect = document.getElementById('cb-type');
    if (typeSelect) typeSelect.value = 'network';
    // Hide type selector — already chosen in picker
    var typeGroup = typeSelect?.closest('.input-group');
    if (typeGroup) typeGroup.style.display = 'none';
    var oldTypePills = document.getElementById('cb-type-pills');
    if (oldTypePills) oldTypePills.remove();
    cbRenderPillSelect('cb-visibility', [
      { value: 'public',  icon: 'globe', label: 'Offentlig' },
      { value: 'private', icon: 'lock',  label: 'Privat' },
      { value: 'hidden',  icon: 'eye',   label: 'Skjult' }
    ]);
  }, 50);
}

function cbRenderPillSelect(selectId, options) {
  var select = document.getElementById(selectId);
  if (!select) return;
  var existingPills = document.getElementById(selectId + '-pills');
  if (existingPills) existingPills.remove();
  var current = select.value;
  var wrap = document.createElement('div');
  wrap.id = selectId + '-pills';
  wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:0.4rem;margin-top:0.25rem;max-width:100%';
  options.forEach(function(opt) {
    var btn = document.createElement('button');
    btn.type = 'button';
    var isActive = opt.value === current;
    btn.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;gap:0.35rem;padding:0.4rem 0.75rem;border-radius:99px;font-size:0.78rem;font-weight:600;font-family:inherit;cursor:pointer;transition:all 0.15s;border:1.5px solid ' + (isActive ? 'rgba(124,92,252,0.5)' : 'var(--glass-border)') + ';background:' + (isActive ? 'rgba(124,92,252,0.12)' : 'rgba(30,27,46,0.03)') + ';color:' + (isActive ? 'var(--accent)' : 'var(--muted)');
    var ico = document.createElement('span');
    ico.style.cssText = 'width:14px;height:14px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0';
    var icoSvg = ICONS[opt.icon] || '';
    if (icoSvg) ico.innerHTML = icoSvg.replace('<svg ', '<svg width="14" height="14" ');
    var lbl = document.createElement('span');
    lbl.textContent = opt.label;
    if (icoSvg) btn.appendChild(ico);
    btn.appendChild(lbl);
    btn.onclick = function() {
      select.value = opt.value;
      wrap.querySelectorAll('button').forEach(function(b) {
        b.style.borderColor = 'var(--glass-border)';
        b.style.background = 'rgba(30,27,46,0.04)';
        b.style.color = 'var(--muted)';
      });
      btn.style.borderColor = 'rgba(124,92,252,0.5)';
      btn.style.background = 'rgba(124,92,252,0.12)';
      btn.style.color = 'var(--accent)';
      // Show/hide checkin_mode for event type
      if (selectId === 'cb-type') {
        var isEvt = (opt.value === 'event' || opt.value === 'live');
        var cmg = document.getElementById('cb-checkin-mode-group');
        var edg = document.getElementById('cb-event-date-group');
        var etg = document.getElementById('cb-event-time-row');
        var etge = document.getElementById('cb-event-time-end-group');
        if (cmg) cmg.style.display = isEvt ? 'block' : 'none';
        if (edg) edg.style.display = isEvt ? 'block' : 'none';
        if (etg) etg.style.display = isEvt ? 'block' : 'none';
        if (etge) etge.style.display = isEvt ? 'block' : 'none';
      }
      if (selectId === 'eb-type') {
        var isEvt2 = (opt.value === 'event' || opt.value === 'live');
        var cmg2 = document.getElementById('eb-checkin-mode-group');
        var edg2 = document.getElementById('eb-event-date-group');
        var etg2 = document.getElementById('eb-event-time-row');
        var etge2 = document.getElementById('eb-event-time-end-group');
        if (cmg2) cmg2.style.display = isEvt2 ? 'block' : 'none';
        if (edg2) edg2.style.display = isEvt2 ? 'block' : 'none';
        if (etg2) etg2.style.display = isEvt2 ? 'block' : 'none';
        if (etge2) etge2.style.display = isEvt2 ? 'block' : 'none';
      }
    };
    wrap.appendChild(btn);
  });
  // Hide native select, insert pills after it
  select.style.display = 'none';
  select.parentNode.insertBefore(wrap, select.nextSibling);
}
var ebRenderPillSelect = cbRenderPillSelect;

async function createBubble() {
  try {
    const name = document.getElementById('cb-name').value.trim();
    const type = document.getElementById('cb-type').value;
    const desc = document.getElementById('cb-desc').value.trim();
    const location = document.getElementById('cb-location').value.trim();
    if (!name) return showToast('Navn er påkrævet');
    const visibility = document.getElementById('cb-visibility')?.value || 'public';
    // Pick up parent bubble id if set (from openCreateEventFromBubble)
    var modal = document.getElementById('bb-sheet-create-bubble');
    var parentBubbleId = (modal && modal.dataset.parentBubbleId) || null;
    if (modal) delete modal.dataset.parentBubbleId;
    var parentLabel = document.getElementById('cb-parent-label');
    if (parentLabel) { parentLabel.style.display = 'none'; parentLabel.textContent = ''; }
    const insertData = {
      name, type, type_label: typeLabel(type), description: desc, location,
      keywords: cbChips, created_by: currentUser.id, visibility
    };
    if (parentBubbleId) insertData.parent_bubble_id = parentBubbleId;
    // Event check-in mode (self = auto check-in, scan = reverse QR)
    if (type === 'event' || type === 'live') {
      var checkinMode = document.getElementById('cb-checkin-mode')?.value || 'self';
      insertData.checkin_mode = checkinMode;
      // Event date/time
      var dateVal = document.getElementById('cb-event-date')?.value;
      var timeVal = document.getElementById('cb-event-time')?.value;
      var timeEndVal = document.getElementById('cb-event-time-end')?.value;
      if (dateVal) {
        var eventDateTime = timeVal ? dateVal + 'T' + timeVal : dateVal + 'T00:00';
        insertData.event_date = new Date(eventDateTime).toISOString();
        if (timeEndVal) {
          insertData.event_end_date = new Date(dateVal + 'T' + timeEndVal).toISOString();
        }
      }
    }
    const { data: bubble, error } = await sb.from('bubbles').insert(insertData).select().single();
    if (error) return errorToast('save', error);
    // Auto-join
    await sb.from('bubble_members').insert({ bubble_id: bubble.id, user_id: currentUser.id });
    bbClose('create-bubble');
    showToast(`"${name}" oprettet! 🫧`);
    // If created as child event, refresh parent bubble's info tab
    if (parentBubbleId && typeof bcLoadInfo === 'function' && bcBubbleId === parentBubbleId) {
      bcLoadInfo();
      bcLoadEvents();
    }
    loadHome();
    loadDiscover();
    // Open the new bubble
    setTimeout(function() { openBubbleChat(bubble.id, 'screen-bubbles'); }, 400);
  } catch(e) { logError("createBubble", e); errorToast("save", e); }
}


// ══════════════════════════════════════════════════════════
//  PRIVATE BUBBLE — JOIN REQUEST
// ══════════════════════════════════════════════════════════
async function requestJoin(bubbleId) {
  try {
    const { data: b } = await sb.from('bubbles').select('name,created_by').eq('id', bubbleId).single();
    const { error } = await sb.from('bubble_members').insert({
      bubble_id: bubbleId, user_id: currentUser.id, status: 'pending'
    });
    if (error && !String(error.message || '').includes('duplicate')) return errorToast('save', error);
    showToast('Anmodning sendt! Ejeren skal godkende 🔒');
    _bbAfterJoin(bubbleId);
    await openBubble(bubbleId);
    // Notify owner via Broadcast
    try {
      if (b && b.created_by && b.created_by !== currentUser.id) {
        var ch = sb.channel('member-notify-' + b.created_by);
        await ch.subscribe();
        await ch.send({ type: 'broadcast', event: 'join_request', payload: { bubbleName: b.name || '', bubbleId: bubbleId, memberName: currentProfile?.name || '' } });
        setTimeout(function() { ch.unsubscribe(); }, 2000);
      }
    } catch(e2) { console.debug('[requestJoin] broadcast error:', e2); }
  } catch(e) { logError("requestJoin", e); errorToast("save", e); }
}

// ══════════════════════════════════════════════════════════
//  EDIT BUBBLE
// ══════════════════════════════════════════════════════════
let currentEditBubbleId = null;

async function openEditBubble(bubbleId) {
  try {
    currentEditBubbleId = bubbleId;
    const { data: b } = await sb.from('bubbles').select('*').eq('id', bubbleId).single();
    if (!b) return;
    document.getElementById('eb-name').value = b.name || '';
    document.getElementById('eb-type').value = b.type || 'event';
    document.getElementById('eb-visibility').value = b.visibility || 'public';
    document.getElementById('eb-desc').value = b.description || '';
    document.getElementById('eb-location').value = b.location || '';
    ebChips = [...(b.keywords || [])];
    renderChips('eb-chips', ebChips, 'eb-chips-container', 'eb-chip-input');
    // Icon preview
    var iconPrev = document.getElementById('eb-icon-preview');
    if (iconPrev) {
      if (b.icon_url) { iconPrev.innerHTML = '<img src="' + escHtml(b.icon_url) + '" style="width:100%;height:100%;object-fit:cover;border-radius:12px">'; }
      else { iconPrev.innerHTML = bubbleEmoji(b.type); }
    }
    // Event-specific fields
    var isEvent = b.type === 'event' || b.type === 'live';
    var cmg = document.getElementById('eb-checkin-mode-group');
    var edg = document.getElementById('eb-event-date-group');
    var etg = document.getElementById('eb-event-time-row');
    var etge = document.getElementById('eb-event-time-end-group');
    if (cmg) cmg.style.display = isEvent ? 'block' : 'none';
    if (edg) edg.style.display = isEvent ? 'block' : 'none';
    if (etg) etg.style.display = isEvent ? 'block' : 'none';
    if (etge) etge.style.display = isEvent ? 'block' : 'none';
    if (isEvent) {
      var cmEl = document.getElementById('eb-checkin-mode');
      if (cmEl) cmEl.value = b.checkin_mode || 'self';
      var edEl = document.getElementById('eb-event-date');
      var etEl = document.getElementById('eb-event-time');
      var etEndEl = document.getElementById('eb-event-time-end');
      if (b.event_date) {
        var evD = new Date(b.event_date);
        if (edEl) edEl.value = evD.toISOString().slice(0, 10);
        if (etEl && evD.getHours() > 0) etEl.value = evD.toTimeString().slice(0, 5);
      }
      if (b.event_end_date && etEndEl) {
        var evE = new Date(b.event_end_date);
        etEndEl.value = evE.toTimeString().slice(0, 5);
      }
    }

    _pendingBubbleIcon = b.icon_url || null;
    // Render pill selects for type + visibility (same as create form)
    ebRenderPillSelect('eb-type', [
      { value: 'event',   icon: 'calendar', label: 'Event' },
      { value: 'network', icon: 'bubble',   label: 'Netværk' }
    ]);
    ebRenderPillSelect('eb-visibility', [
      { value: 'public',  icon: 'globe', label: 'Offentlig' },
      { value: 'private', icon: 'lock',  label: 'Privat' },
      { value: 'hidden',  icon: 'eye',   label: 'Skjult' }
    ]);
    openModal('modal-edit-bubble');
    setTimeout(initInputConfirmButtons, 50);
  } catch(e) { logError("openEditBubble", e); errorToast("load", e); }
}

var _pendingBubbleIcon = null;

async function handleBubbleIconUpload(input) {
  try {
    var file = input.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { showToast('Maks 2MB'); input.value = ''; return; }
    var allowed = ['image/jpeg','image/png','image/webp'];
    if (allowed.indexOf(file.type) < 0) { showToast('Brug JPG, PNG eller WebP'); input.value = ''; return; }
    showToast('Uploader ikon...');
    var resized = typeof resizeImage === 'function' ? await resizeImage(file, 256) : file;
    var path = 'bubbles/' + currentEditBubbleId + '/icon-' + Date.now() + '.jpg';
    var { error: upErr } = await sb.storage.from('bubble-files').upload(path, resized, { cacheControl: '3600', upsert: true, contentType: 'image/jpeg' });
    if (upErr) { errorToast('upload', upErr); input.value = ''; return; }
    var { data: urlData } = sb.storage.from('bubble-files').getPublicUrl(path);
    _pendingBubbleIcon = urlData.publicUrl;
    var prev = document.getElementById('eb-icon-preview');
    if (prev) prev.innerHTML = '<img src="' + _pendingBubbleIcon + '" style="width:100%;height:100%;object-fit:cover;border-radius:12px">';
    showToast('Ikon uploadet! 📸');
    input.value = '';
  } catch(e) { logError('handleBubbleIconUpload', e); errorToast('upload', e); }
}



async function saveEditBubble() {
  try {
    const name       = document.getElementById('eb-name').value.trim();
    const type       = document.getElementById('eb-type').value;
    const visibility = document.getElementById('eb-visibility').value;
    const desc       = document.getElementById('eb-desc').value.trim();
    const location   = document.getElementById('eb-location').value.trim();
    if (!name) return showToast('Navn er påkrævet');
    var updateObj = {
      name, type, type_label: typeLabel(type),
      visibility, description: desc, location, keywords: ebChips
    };
    if (_pendingBubbleIcon) updateObj.icon_url = _pendingBubbleIcon;
    // Event date/time
    if (type === 'event' || type === 'live') {
      var checkinMode = document.getElementById('eb-checkin-mode')?.value;
      if (checkinMode) updateObj.checkin_mode = checkinMode;
      var dateVal = document.getElementById('eb-event-date')?.value;
      var timeVal = document.getElementById('eb-event-time')?.value;
      var timeEndVal = document.getElementById('eb-event-time-end')?.value;
      if (dateVal) {
        var eventDateTime = timeVal ? dateVal + 'T' + timeVal : dateVal + 'T00:00';
        updateObj.event_date = new Date(eventDateTime).toISOString();
        updateObj.event_end_date = timeEndVal ? new Date(dateVal + 'T' + timeEndVal).toISOString() : null;
      }
    }
    const { error } = await sb.from('bubbles').update(updateObj).eq('id', currentEditBubbleId);
    if (error) return errorToast('save', error);
    closeModal('modal-edit-bubble');
    showSuccessToast('Boble opdateret');
    await bcLoadBubbleInfo();
    await bcLoadMembers();
  } catch(e) { logError("saveEditBubble", e); errorToast("save", e); }
}

// ══════════════════════════════════════════════════════════
//  QR CODE
// ══════════════════════════════════════════════════════════
let currentQRBubble = null;

async function openQRModal(bubbleId) {
  try {
    currentQRBubble = bubbleId;
    const { data: b } = await sb.from('bubbles').select('*').eq('id', bubbleId).single();
    if (!b) return;

    document.getElementById('qr-modal-title').innerHTML = escHtml(b.name) + ' ' + icon('bubble');
    document.getElementById('qr-modal-subtitle').textContent =
      `${typeLabel(b.type)}${b.location ? ' · ' + b.location : ''} — scan for at joine`;

    // Build the join URL — opens app and auto-joins the bubble
    const joinUrl = `${window.location.origin}${window.location.pathname}?join=${bubbleId}`;

    // Clear and render QR
    const el = document.getElementById('qr-code-el');
    el.innerHTML = '';
    new QRCode(el, {
      text: joinUrl,
      width: 220,
      height: 220,
      colorDark: '#0a0a0f',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.H
    });

    openModal('modal-qr');
  } catch(e) { logError("openQRModal", e); errorToast("load", e); }
}

let _jsPdfLoaded = false;
async function loadJsPdf() {
  try {
  if (_jsPdfLoaded) return;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    s.onload = resolve;
    s.onerror = () => reject(new Error('Kunne ikke indlæse jsPDF'));
    document.head.appendChild(s);
  });
  _jsPdfLoaded = true;
  } catch(e) { logError("loadJsPdf", e); }
}

async function downloadQRPdf() {
  try {
  await loadJsPdf();
  const { data: b, error } = await sb.from('bubbles').select('*').eq('id', currentQRBubble).single();
  if (error || !b) return showToast('Kunne ikke hente boble-data');

  showToast('Genererer PDF...');

  // Wait a tick for QR to render fully
  await new Promise(r => setTimeout(r, 300));

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageW = 210, pageH = 297;

  // Dark background
  doc.setFillColor(10, 10, 15);
  doc.rect(0, 0, pageW, pageH, 'F');

  // Purple accent top bar
  doc.setFillColor(108, 99, 255);
  doc.rect(0, 0, pageW, 8, 'F');

  // Bubble logo area (purple rounded rect simulation)
  doc.setFillColor(108, 99, 255);
  doc.roundedRect(pageW/2 - 18, 28, 36, 36, 6, 6, 'F');

  // Bubble text in logo
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.text('bubble', pageW/2, 51, { align: 'center' });

  // App name
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(240, 240, 248);
  doc.text('bubble', pageW/2, 82, { align: 'center' });

  // Tagline
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(108, 108, 138);
  doc.text('Network Radar for Business', pageW/2, 91, { align: 'center' });

  // Divider
  doc.setDrawColor(42, 42, 61);
  doc.setLineWidth(0.5);
  doc.line(20, 99, pageW - 20, 99);

  // Bubble name
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(240, 240, 248);
  doc.text(b.name, pageW/2, 115, { align: 'center' });

  // Type + location
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(108, 108, 138);
  const meta = typeLabel(b.type) + (b.location ? ' · ' + b.location : '');
  doc.text(meta, pageW/2, 124, { align: 'center' });

  // Keywords
  if (b.keywords && b.keywords.length) {
    doc.setFontSize(10);
    doc.setTextColor(108, 99, 255);
    doc.text(b.keywords.slice(0,5).join('  ·  '), pageW/2, 133, { align: 'center' });
  }

  // QR code — get canvas from DOM
  const qrCanvas = document.querySelector('#qr-code-el canvas') ||
                   document.querySelector('#qr-code-el img');

  if (qrCanvas) {
    let imgData;
    if (qrCanvas.tagName === 'CANVAS') {
      imgData = qrCanvas.toDataURL('image/png');
    } else {
      // It's an img tag — draw to canvas first
      const tmpCanvas = document.createElement('canvas');
      tmpCanvas.width = 220; tmpCanvas.height = 220;
      tmpCanvas.getContext('2d').drawImage(qrCanvas, 0, 0);
      imgData = tmpCanvas.toDataURL('image/png');
    }

    // White background behind QR
    const qrSize = 80;
    const qrX = (pageW - qrSize) / 2;
    const qrY = 145;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(qrX - 6, qrY - 6, qrSize + 12, qrSize + 12, 4, 4, 'F');
    doc.addImage(imgData, 'PNG', qrX, qrY, qrSize, qrSize);
  }

  // Scan instruction
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(240, 240, 248);
  doc.text('Scan og join boblen', pageW/2, 245, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(108, 108, 138);
  doc.text('Åbn iPhone-kameraet og ret det mod QR-koden', pageW/2, 253, { align: 'center' });
  doc.text('Du bliver automatisk tilføjet til boblen', pageW/2, 260, { align: 'center' });

  // Bottom accent
  doc.setFillColor(108, 99, 255);
  doc.rect(0, pageH - 8, pageW, 8, 'F');

  // Save
  const filename = `bubble-qr-${b.name.toLowerCase().replace(/\s+/g,'-')}.pdf`;
  doc.save(filename);
  showToast('PDF downloadet! 🖨️');
  } catch(e) { errorToast('load', e); }
}

// ══════════════════════════════════════════════════════════
//  AUTO-JOIN VIA QR SCAN
// ══════════════════════════════════════════════════════════
async function checkQRJoin() {
  try {
    const params = new URLSearchParams(window.location.search);
    const joinId = params.get('join');
    if (!joinId) return;

    // Clean URL
    window.history.replaceState({}, '', window.location.pathname);

    // Wait for auth
    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
      // Save for after login
      flowSet('pending_join', joinId);
      return;
    }

    // Auto-join
    const { error } = await sb.from('bubble_members')
      .insert({ bubble_id: joinId, user_id: session.user.id });

    if (!error || String(error.message || '').includes('duplicate')) {
      showSuccessToast('Du er checket ind');
      await openBubble(joinId, 'screen-home');
    }
  } catch(e) { logError("checkQRJoin", e); errorToast("load", e); }
}

async function checkPendingJoin() {
  try {
    const joinId = flowGet('pending_join');
    if (!joinId) return;
    flowRemove('pending_join');

    // Join bubble
    const { error } = await sb.from('bubble_members')
      .insert({ bubble_id: joinId, user_id: currentUser.id });
    if (error && !String(error.message || '').includes('duplicate')) {
      errorToast('save', error);
      return;
    }

    // Check if this is an event flow
    var isEventFlow = flowGet('event_flow');

    // Fetch bubble to check type and checkin_mode
    var { data: bubble } = await sb.from('bubbles')
      .select('id, name, type, checkin_mode')
      .eq('id', joinId).maybeSingle();

    var isEvent = bubble && (bubble.type === 'event' || bubble.type === 'live');
    var isSelfCheckin = !bubble || !bubble.checkin_mode || bubble.checkin_mode === 'self';

    if (isEventFlow && isEvent && isSelfCheckin) {
      // Mode A: auto check-in
      await sb.from('bubble_members')
        .update({ checked_in_at: new Date().toISOString(), checked_out_at: null })
        .eq('bubble_id', joinId).eq('user_id', currentUser.id);
      flowRemove('event_flow');
      showSuccessToast('Du er checked ind!');
      goTo('screen-home');
      // Home will detect live context and show Live tab
    } else if (isEventFlow && isEvent) {
      // Mode B: show QR for organizer to scan
      // event_flow flag stays — handled by checkAuth → showEventReadyQR()
      showSuccessToast('Du er tilmeldt!');
    } else {
      // Normal bubble join (not event)
      if (isEventFlow) flowRemove('event_flow');
      showSuccessToast('Du er med i ' + (bubble ? bubble.name : 'boblen') + '!');
      _bbAfterJoin(joinId);
      await openBubble(joinId, 'screen-home');
    }
  } catch(e) { logError("checkPendingJoin", e); errorToast("save", e); }
}



// ══════════════════════════════════════════════════════════
//  DELTAGER PDF — boble-ejer eksport
// ══════════════════════════════════════════════════════════
async function downloadMembersPdf(bubbleId) {
  try {
    showToast('Henter deltagerliste...');
    await loadJsPdf();
    const { jsPDF } = window.jspdf;

    // ── Fetch data ──
    const { data: b } = await sb.from('bubbles').select('*').eq('id', bubbleId).single();
    if (!b) { showToast('Kunne ikke hente boble-data'); return; }

    const { data: members } = await sb.from('bubble_members')
      .select('user_id, joined_at, checked_in_at, checked_out_at')
      .eq('bubble_id', bubbleId)
      .order('checked_in_at', { ascending: true, nullsFirst: false });

    if (!members || members.length === 0) { showToast('Ingen deltagere endnu'); return; }

    const userIds = members.map(m => m.user_id);
    const { data: profiles } = await sb.from('profiles')
      .select('id, name, title, workplace').in('id', userIds);
    const profileMap = {};
    (profiles || []).forEach(p => { profileMap[p.id] = p; });

    // ── Compute stats ──
    const checkedIn = members.filter(m => m.checked_in_at);
    const totalMembers = members.length;
    const totalCheckedIn = checkedIn.length;

    function fmtTime(iso) {
      if (!iso) return '–';
      return new Date(iso).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });
    }
    function fmtDate(iso) {
      if (!iso) return '–';
      return new Date(iso).toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' });
    }
    function fmtDuration(inIso, outIso) {
      if (!inIso) return '–';
      var end = outIso ? new Date(outIso) : new Date();
      var mins = Math.round((end - new Date(inIso)) / 60000);
      if (mins < 1) return '< 1 min';
      if (mins < 60) return mins + ' min';
      return Math.floor(mins / 60) + 't ' + (mins % 60) + 'min';
    }

    // ── Build PDF ──
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pw = 210, ph = 297;
    const ml = 14, mr = 14, contentW = pw - ml - mr;

    // Dark header bar
    doc.setFillColor(10, 10, 20);
    doc.rect(0, 0, pw, ph, 'F');

    // Top accent gradient bar
    doc.setFillColor(108, 99, 255);
    doc.rect(0, 0, pw, 6, 'F');

    // Bubble logo text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(139, 127, 255);
    doc.text('bubble', ml, 16);

    // Report label top right
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(90, 90, 110);
    var today = new Date().toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' });
    doc.text('Genereret ' + today, pw - mr, 16, { align: 'right' });

    // Divider
    doc.setDrawColor(40, 40, 60);
    doc.setLineWidth(0.3);
    doc.line(ml, 20, pw - mr, 20);

    // Bubble name
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(230, 230, 245);
    doc.text(b.name, ml, 33);

    // Meta line
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 130);
    var metaParts = [typeLabel(b.type)];
    if (b.location) metaParts.push(b.location);
    if (b.description) metaParts.push(b.description.slice(0, 60) + (b.description.length > 60 ? '...' : ''));
    doc.text(metaParts.join('  ·  '), ml, 40);

    // ── Summary boxes ──
    var boxY = 46;
    var boxH = 16;
    var boxes = [
      { label: 'Tilmeldte', val: String(totalMembers), color: [108, 99, 255] },
      { label: 'Check-in', val: String(totalCheckedIn), color: [46, 207, 207] },
      { label: 'Fremmøde', val: totalMembers > 0 ? Math.round(totalCheckedIn / totalMembers * 100) + '%' : '–', color: [16, 185, 129] }
    ];
    var boxW = (contentW - 6) / 3;
    boxes.forEach(function(box, i) {
      var bx = ml + i * (boxW + 3);
      doc.setFillColor(box.color[0], box.color[1], box.color[2], 0.12);
      // Simulate transparency with a dark fill
      doc.setFillColor(20, 20, 35);
      doc.roundedRect(bx, boxY, boxW, boxH, 2, 2, 'F');
      doc.setDrawColor(box.color[0], box.color[1], box.color[2]);
      doc.setLineWidth(0.4);
      doc.roundedRect(bx, boxY, boxW, boxH, 2, 2, 'S');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(box.color[0], box.color[1], box.color[2]);
      doc.text(box.val, bx + boxW / 2, boxY + 9, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(110, 110, 140);
      doc.text(box.label, bx + boxW / 2, boxY + 14, { align: 'center' });
    });

    // ── Table header ──
    var tableY = boxY + boxH + 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(110, 110, 140);

    // Column widths (sum = contentW = 182)
    var cols = [
      { label: 'NAVN',         x: ml,      w: 44 },
      { label: 'TITEL',        x: ml + 44, w: 38 },
      { label: 'VIRKSOMHED',   x: ml + 82, w: 36 },
      { label: 'CHECK-IN',     x: ml + 118,w: 22 },
      { label: 'CHECK-OUT',    x: ml + 140,w: 22 },
      { label: 'VARIGHED',     x: ml + 162,w: 20 }
    ];

    cols.forEach(function(col) {
      doc.text(col.label, col.x, tableY);
    });

    // Header underline
    doc.setDrawColor(50, 50, 70);
    doc.setLineWidth(0.3);
    doc.line(ml, tableY + 2, pw - mr, tableY + 2);

    // ── Table rows ──
    var rowY = tableY + 7;
    var rowH = 7.5;
    var rowCount = 0;

    // Sort: checked-in first (by check-in time), then members without check-in
    var sorted = [...members].sort(function(a, b) {
      if (a.checked_in_at && !b.checked_in_at) return -1;
      if (!a.checked_in_at && b.checked_in_at) return 1;
      if (a.checked_in_at && b.checked_in_at) return new Date(a.checked_in_at) - new Date(b.checked_in_at);
      return new Date(a.joined_at) - new Date(b.joined_at);
    });

    sorted.forEach(function(m, i) {
      // New page if needed
      if (rowY + rowH > ph - 18) {
        doc.addPage();
        doc.setFillColor(10, 10, 20);
        doc.rect(0, 0, pw, ph, 'F');
        doc.setFillColor(108, 99, 255);
        doc.rect(0, 0, pw, 3, 'F');
        rowY = 14;
        // Repeat column headers
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(110, 110, 140);
        cols.forEach(function(col) { doc.text(col.label, col.x, rowY); });
        doc.setDrawColor(50, 50, 70);
        doc.line(ml, rowY + 2, pw - mr, rowY + 2);
        rowY += 7;
      }

      var p = profileMap[m.user_id] || {};
      var isCheckedIn = !!m.checked_in_at;

      // Alternating row bg
      if (i % 2 === 0) {
        doc.setFillColor(18, 18, 30);
        doc.rect(ml - 1, rowY - 5, contentW + 2, rowH, 'F');
      }

      // Live indicator dot
      var isLive = m.checked_in_at && !m.checked_out_at;
      if (isLive) {
        doc.setFillColor(46, 207, 207);
        doc.circle(ml - 4, rowY - 2, 1.2, 'F');
      }

      function truncate(str, maxLen) {
        if (!str) return '–';
        return str.length > maxLen ? str.slice(0, maxLen - 1) + '…' : str;
      }

      doc.setFont('helvetica', isCheckedIn ? 'bold' : 'normal');
      doc.setFontSize(8);
      doc.setTextColor(isCheckedIn ? 220 : 150, isCheckedIn ? 220 : 150, isCheckedIn ? 235 : 170);
      doc.text(truncate(p.name || 'Ukendt', 22), cols[0].x, rowY);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(130, 130, 155);
      doc.text(truncate(p.title || '', 20), cols[1].x, rowY);
      doc.text(truncate(p.workplace || '', 18), cols[2].x, rowY);

      doc.setTextColor(isCheckedIn ? 46 : 80, isCheckedIn ? 207 : 80, isCheckedIn ? 207 : 100);
      doc.text(fmtTime(m.checked_in_at), cols[3].x, rowY);

      doc.setTextColor(130, 130, 155);
      doc.text(fmtTime(m.checked_out_at), cols[4].x, rowY);
      doc.text(fmtDuration(m.checked_in_at, m.checked_out_at), cols[5].x, rowY);

      rowY += rowH;
      rowCount++;
    });

    // ── Footer ──
    var footerY = ph - 10;
    doc.setDrawColor(40, 40, 60);
    doc.setLineWidth(0.3);
    doc.line(ml, footerY - 4, pw - mr, footerY - 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(70, 70, 90);
    doc.text('Genereret af Bubble · bubble.app', ml, footerY);
    doc.text('Side 1 af ' + doc.getNumberOfPages(), pw - mr, footerY, { align: 'right' });

    // Bottom accent bar
    doc.setFillColor(108, 99, 255);
    doc.rect(0, ph - 3, pw, 3, 'F');

    // ── Save ──
    var safeName = b.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    var dateStr = new Date().toISOString().slice(0, 10);
    doc.save('deltagerliste-' + safeName + '-' + dateStr + '.pdf');
    showToast('PDF downloadet! 📋');
    trackEvent('members_pdf_export', { bubble_id: bubbleId, member_count: totalMembers });

  } catch(e) { logError('downloadMembersPdf', e); errorToast('load', e); }
}

// ══════════════════════════════════════════════════════════
//  EVENT RAPPORT — Interactive HTML report for event owners
// ══════════════════════════════════════════════════════════
async function generateEventReport(bubbleId) {
  try {
    showToast('Genererer event-rapport...');

    // ── 1. Fetch all data in parallel ──
    var [bubbleRes, membersRes, messagesRes, guestsRes, invitesRes] = await Promise.all([
      sb.from('bubbles').select('*').eq('id', bubbleId).maybeSingle(),
      sb.from('bubble_members').select('user_id, role, joined_at, checked_in_at, checked_out_at').eq('bubble_id', bubbleId).order('joined_at', { ascending: true }),
      sb.from('bubble_messages').select('user_id, created_at').eq('bubble_id', bubbleId),
      sb.from('guest_checkins').select('*').eq('bubble_id', bubbleId).then(function(r) { return r; }).catch(function() { return { data: [] }; }),
      sb.from('bubble_invitations').select('to_user_id, status, created_at').eq('bubble_id', bubbleId).then(function(r) { return r; }).catch(function() { return { data: [] }; })
    ]);

    var b = bubbleRes.data;
    if (!b) { showToast('Boble ikke fundet'); return; }
    var members = membersRes.data || [];
    var messages = messagesRes.data || [];
    var guests = guestsRes.data || [];
    var invites = invitesRes.data || [];

    if (members.length === 0) { showToast('Ingen deltagere endnu'); return; }

    // ── 2. Fetch profiles for all members ──
    var userIds = members.map(function(m) { return m.user_id; });
    var { data: profiles } = await sb.from('profiles').select('id, name, title, workplace, keywords, avatar_url').in('id', userIds);
    var profileMap = {};
    (profiles || []).forEach(function(p) { profileMap[p.id] = p; });

    // ── 3. Fetch connections (saved_contacts between members) ──
    var connectionCount = 0;
    var connectorsMap = {};
    try {
      var { data: connections } = await sb.from('saved_contacts').select('user_id, contact_id').in('user_id', userIds).in('contact_id', userIds);
      connectionCount = (connections || []).length;
      (connections || []).forEach(function(c) {
        connectorsMap[c.user_id] = (connectorsMap[c.user_id] || 0) + 1;
      });
    } catch(e) {}

    // ── 4. Fetch profile views between members ──
    var viewCount = 0;
    try {
      var { count } = await sb.from('profile_views').select('*', { count: 'exact', head: true }).in('viewer_id', userIds).in('viewed_id', userIds);
      viewCount = count || 0;
    } catch(e) {}

    // ── 5. Compute stats ──
    var totalMembers = members.length;
    var checkedIn = members.filter(function(m) { return m.checked_in_at; });
    var totalCheckedIn = checkedIn.length;
    var totalMessages = messages.length;
    var totalGuests = guests.length;
    var acceptedInvites = invites.filter(function(i) { return i.status === 'accepted'; }).length;
    var pendingInvites = invites.filter(function(i) { return i.status === 'pending'; }).length;

    // Connection rate
    var usersWithConnections = Object.keys(connectorsMap).length;
    var connectionRate = totalMembers > 0 ? Math.round((usersWithConnections / totalMembers) * 100) : 0;

    // Average stay duration
    var totalMins = 0;
    var stayCount = 0;
    checkedIn.forEach(function(m) {
      var end = m.checked_out_at ? new Date(m.checked_out_at) : new Date();
      var mins = Math.round((end - new Date(m.checked_in_at)) / 60000);
      if (mins > 0 && mins < 1440) { totalMins += mins; stayCount++; }
    });
    var avgStay = stayCount > 0 ? Math.round(totalMins / stayCount) : 0;
    var avgStayLabel = avgStay < 60 ? avgStay + ' min' : Math.floor(avgStay / 60) + 't ' + (avgStay % 60) + 'min';

    // Messages per user
    var msgPerUser = {};
    messages.forEach(function(m) { msgPerUser[m.user_id] = (msgPerUser[m.user_id] || 0) + 1; });

    // Top keywords across all members
    var kwCount = {};
    members.forEach(function(m) {
      var p = profileMap[m.user_id];
      if (p && p.keywords) p.keywords.forEach(function(k) { kwCount[k] = (kwCount[k] || 0) + 1; });
    });
    var topKeywords = Object.entries(kwCount).sort(function(a, b) { return b[1] - a[1]; }).slice(0, 10);

    // Top connectors
    var topConnectors = Object.entries(connectorsMap).sort(function(a, b) { return b[1] - a[1]; }).slice(0, 5).map(function(e) {
      var p = profileMap[e[0]] || {};
      return { name: p.name || 'Ukendt', title: p.title || '', connections: e[1], messages: msgPerUser[e[0]] || 0 };
    });

    // Join timeline (by hour)
    var hourBuckets = {};
    members.forEach(function(m) {
      var h = new Date(m.joined_at || m.checked_in_at || Date.now()).getHours();
      hourBuckets[h] = (hourBuckets[h] || 0) + 1;
    });

    // Event date
    var eventDate = new Date(b.created_at).toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    // ── 6. Generate HTML ──
    function statBox(label, value, sub, color) {
      return '<div style="background:white;border-radius:16px;padding:1.25rem;box-shadow:0 1px 4px rgba(0,0,0,0.06);border:1px solid rgba(0,0,0,0.04)">' +
        '<div style="font-size:2rem;font-weight:800;color:' + color + ';line-height:1">' + value + '</div>' +
        '<div style="font-size:0.85rem;font-weight:600;color:#1E1B2E;margin-top:0.3rem">' + label + '</div>' +
        (sub ? '<div style="font-size:0.72rem;color:#8C8A97;margin-top:0.15rem">' + sub + '</div>' : '') +
        '</div>';
    }

    function barChart(data, maxVal) {
      if (!data.length) return '<div style="color:#8C8A97;font-size:0.8rem">Ingen data</div>';
      var max = maxVal || Math.max.apply(null, data.map(function(d) { return d.value; }));
      return data.map(function(d) {
        var pct = max > 0 ? Math.round((d.value / max) * 100) : 0;
        return '<div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:0.35rem">' +
          '<div style="width:120px;font-size:0.75rem;color:#1E1B2E;font-weight:500;text-align:right;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + d.label + '</div>' +
          '<div style="flex:1;height:22px;background:#F4F3F9;border-radius:6px;overflow:hidden">' +
            '<div style="height:100%;width:' + pct + '%;background:linear-gradient(90deg,#7C5CFC,#6366F1);border-radius:6px;min-width:2px"></div>' +
          '</div>' +
          '<div style="width:28px;font-size:0.72rem;font-weight:700;color:#7C5CFC;text-align:right">' + d.value + '</div>' +
          '</div>';
      }).join('');
    }

    // Member table rows
    var memberRows = members.map(function(m, i) {
      var p = profileMap[m.user_id] || {};
      return '<tr style="border-bottom:1px solid #F4F3F9">' +
        '<td style="padding:0.5rem 0.6rem;font-size:0.8rem;font-weight:600">' + (p.name || 'Ukendt') + '</td>' +
        '<td style="padding:0.5rem 0.4rem;font-size:0.75rem;color:#8C8A97">' + (p.title || '–') + '</td>' +
        '<td style="padding:0.5rem 0.4rem;font-size:0.75rem;color:#8C8A97">' + (p.workplace || '–') + '</td>' +
        '</tr>';
    }).join('');

    // Timeline chart
    var timelineData = [];
    for (var h = 7; h <= 23; h++) {
      if (hourBuckets[h]) timelineData.push({ label: h + ':00', value: hourBuckets[h] });
    }

    var html = '<!DOCTYPE html><html lang="da"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>Event Rapport — ' + (b.name || 'Bubble') + '</title>' +
      '<link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">' +
      '<style>' +
        '*{margin:0;padding:0;box-sizing:border-box}' +
        'body{font-family:"Figtree",system-ui,sans-serif;background:#FAFAFA;color:#1E1B2E;line-height:1.5;-webkit-font-smoothing:antialiased}' +
        '.wrap{max-width:800px;margin:0 auto;padding:2rem 1.5rem}' +
        '.header{background:linear-gradient(135deg,#7C5CFC 0%,#6366F1 50%,#4F46E5 100%);color:white;padding:2.5rem 2rem;border-radius:20px;margin-bottom:2rem;position:relative;overflow:hidden}' +
        '.header::after{content:"";position:absolute;top:-50%;right:-20%;width:300px;height:300px;background:rgba(255,255,255,0.06);border-radius:50%}' +
        '.header::before{content:"";position:absolute;bottom:-30%;left:-10%;width:200px;height:200px;background:rgba(255,255,255,0.04);border-radius:50%}' +
        '.header h1{font-size:1.6rem;font-weight:900;letter-spacing:-0.03em;position:relative;z-index:1}' +
        '.header .meta{font-size:0.85rem;opacity:0.85;margin-top:0.3rem;position:relative;z-index:1}' +
        '.header .bubble-badge{display:inline-flex;align-items:center;gap:0.3rem;background:rgba(255,255,255,0.18);padding:0.3rem 0.7rem;border-radius:99px;font-size:0.72rem;font-weight:600;margin-top:0.75rem;position:relative;z-index:1}' +
        '.section{margin-bottom:1.75rem}' +
        '.section-title{font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#7C5CFC;margin-bottom:0.75rem}' +
        '.stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:0.75rem}' +
        '.card{background:white;border-radius:16px;padding:1.25rem;box-shadow:0 1px 4px rgba(0,0,0,0.06);border:1px solid rgba(0,0,0,0.04)}' +
        '.highlight-card{background:linear-gradient(135deg,rgba(124,92,252,0.06),rgba(99,102,241,0.04));border:1px solid rgba(124,92,252,0.12)}' +
        'table{width:100%;border-collapse:collapse}' +
        'th{text-align:left;font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#8C8A97;padding:0.5rem 0.6rem;border-bottom:2px solid #ECEAF5}' +
        '.connector-card{display:flex;align-items:center;gap:0.75rem;padding:0.6rem 0;border-bottom:1px solid #F4F3F9}' +
        '.connector-rank{width:24px;height:24px;border-radius:50%;background:linear-gradient(135deg,#7C5CFC,#6366F1);color:white;display:flex;align-items:center;justify-content:center;font-size:0.65rem;font-weight:800;flex-shrink:0}' +
        '.tag{display:inline-block;background:#F4F3F9;color:#1E1B2E;padding:0.2rem 0.55rem;border-radius:99px;font-size:0.72rem;font-weight:500;margin:0.15rem}' +
        '.footer{text-align:center;padding:2rem 0 1rem;font-size:0.72rem;color:#8C8A97;border-top:1px solid #ECEAF5;margin-top:2rem}' +
        '.footer a{color:#7C5CFC;text-decoration:none;font-weight:600}' +
        '@media print{body{background:white}.wrap{padding:1rem}.header{break-inside:avoid}.section{break-inside:avoid}.no-print{display:none!important}}' +
        '@media(max-width:600px){.stat-grid{grid-template-columns:1fr 1fr}.wrap{padding:1rem}}' +
      '</style></head><body><div class="wrap">' +

      // Header
      '<div class="header">' +
        '<h1>' + (b.name || 'Event') + '</h1>' +
        '<div class="meta">' + eventDate + (b.location ? ' · ' + b.location : '') + '</div>' +
        '<div class="bubble-badge">🫧 Rapport genereret via Bubble</div>' +
      '</div>' +

      // Key stats
      '<div class="section">' +
        '<div class="section-title">Overblik</div>' +
        '<div class="stat-grid">' +
          statBox('Deltagere', totalMembers, totalCheckedIn > 0 ? totalCheckedIn + ' checked in' : null, '#7C5CFC') +
          statBox('Connections', connectionCount, connectionRate + '% lavede min. 1', '#1A9E8E') +
          statBox('Profilvisninger', viewCount, '', '#E879A8') +
          statBox('Beskeder', totalMessages, '', '#2ECFCF') +
          (avgStay > 0 ? statBox('Gns. opholdstid', avgStayLabel, '', '#F59E0B') : '') +
          (totalGuests > 0 ? statBox('Gæster (manuel)', totalGuests, '', '#8C8A97') : '') +
        '</div>' +
      '</div>' +

      // Connection rate highlight
      '<div class="section">' +
        '<div class="card highlight-card" style="text-align:center;padding:1.5rem">' +
          '<div style="font-size:2.5rem;font-weight:900;color:#7C5CFC">' + connectionRate + '%</div>' +
          '<div style="font-size:0.9rem;font-weight:600;margin-top:0.2rem">Connection rate</div>' +
          '<div style="font-size:0.78rem;color:#8C8A97;margin-top:0.2rem">' + usersWithConnections + ' af ' + totalMembers + ' deltagere lavede mindst én ny forbindelse</div>' +
        '</div>' +
      '</div>' +

      // Top connectors
      (topConnectors.length > 0 ? '<div class="section">' +
        '<div class="section-title">Mest aktive networkere</div>' +
        '<div class="card">' +
          topConnectors.map(function(c, i) {
            return '<div class="connector-card">' +
              '<div class="connector-rank">' + (i + 1) + '</div>' +
              '<div style="flex:1;min-width:0">' +
                '<div style="font-size:0.85rem;font-weight:700">Deltager #' + (i + 1) + '</div>' +
              '</div>' +
              '<div style="text-align:right">' +
                '<div style="font-size:0.78rem;font-weight:700;color:#1A9E8E">' + c.connections + ' connections</div>' +
                '<div style="font-size:0.68rem;color:#8C8A97">' + c.messages + ' beskeder</div>' +
              '</div>' +
            '</div>';
          }).join('') +
        '</div>' +
      '</div>' : '') +

      // Interest map
      (topKeywords.length > 0 ? '<div class="section">' +
        '<div class="section-title">Interesser blandt deltagerne</div>' +
        '<div class="card">' +
          barChart(topKeywords.map(function(kw) { return { label: kw[0], value: kw[1] }; })) +
        '</div>' +
      '</div>' : '') +

      // Join timeline
      (timelineData.length > 0 ? '<div class="section">' +
        '<div class="section-title">Deltagertilgang over tid</div>' +
        '<div class="card">' +
          barChart(timelineData) +
        '</div>' +
      '</div>' : '') +

      // Full member table
      '<div class="section">' +
        '<div class="section-title">Alle deltagere (' + totalMembers + ')</div>' +
        '<div class="card" style="overflow-x:auto;padding:0.5rem">' +
          '<table><thead><tr>' +
            '<th>Navn</th><th>Titel</th><th>Virksomhed</th>' +
          '</tr></thead><tbody>' + memberRows + '</tbody></table>' +
        '</div>' +
      '</div>' +

      // Footer
      '<div class="footer">' +
        '<div>Genereret ' + new Date().toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + '</div>' +
        '<div style="margin-top:0.3rem">Powered by <a href="https://bubbleme.dk" target="_blank">Bubble</a> — Hyperlokal networking</div>' +
        '<button class="no-print" onclick="window.print()" style="margin-top:1rem;padding:0.6rem 1.5rem;background:linear-gradient(135deg,#7C5CFC,#6366F1);color:white;border:none;border-radius:10px;font-family:inherit;font-size:0.85rem;font-weight:700;cursor:pointer">Print / Gem som PDF</button>' +
      '</div>' +

      '</div></body></html>';

    // ── 7. Show in-app report tray ──
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:500;background:rgba(30,27,46,0.3);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);opacity:0;transition:opacity 0.3s';
    overlay.onclick = function() { closeReportTray(); };

    var tray = document.createElement('div');
    tray.id = 'event-report-tray';
    tray.onclick = function(e) { e.stopPropagation(); };
    tray.style.cssText = 'position:fixed;top:0;right:0;bottom:0;z-index:501;width:100%;max-width:480px;background:var(--bg);overflow-y:auto;-webkit-overflow-scrolling:touch;transform:translateX(100%);transition:transform 0.35s cubic-bezier(0.22,1,0.36,1);padding-top:env(safe-area-inset-top,0px)';

    // Build in-app HTML (reuse report structure but simplified for mobile)
    var trayHtml = '<div style="padding:1rem 1.2rem calc(1.5rem + env(safe-area-inset-bottom,0px))">' +
      // Close + export bar
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">' +
        '<button onclick="closeReportTray()" style="border:none;background:none;font-size:1.2rem;cursor:pointer;padding:0.3rem;color:var(--text)">←</button>' +
        '<div style="font-size:0.82rem;font-weight:800;color:var(--text)">Event-rapport</div>' +
        '<div style="display:flex;gap:0.3rem">' +
          '<button onclick="exportReportPdf(\'' + bubbleId + '\')" style="font-size:0.65rem;padding:0.3rem 0.5rem;background:rgba(124,92,252,0.08);color:var(--accent);border:1px solid rgba(124,92,252,0.15);border-radius:8px;cursor:pointer;font-family:inherit;font-weight:600">PDF</button>' +
          '<button onclick="exportReportEmail(\'' + bubbleId + '\')" style="font-size:0.65rem;padding:0.3rem 0.5rem;background:rgba(46,207,207,0.08);color:#085041;border:1px solid rgba(46,207,207,0.15);border-radius:8px;cursor:pointer;font-family:inherit;font-weight:600">Email</button>' +
        '</div>' +
      '</div>' +

      // Header card
      '<div style="background:var(--gradient-primary);color:white;padding:1.25rem 1rem;border-radius:16px;margin-bottom:1rem">' +
        '<div style="font-size:0.6rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;opacity:0.75">Event Rapport</div>' +
        '<div style="font-size:1.2rem;font-weight:900;letter-spacing:-0.02em;margin-top:0.2rem">' + escHtml(b.name) + '</div>' +
        '<div style="font-size:0.75rem;opacity:0.85;margin-top:0.15rem">' + eventDate + (b.location ? ' · ' + escHtml(b.location) : '') + '</div>' +
      '</div>' +

      // Stats grid
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-bottom:1rem">';

    function miniStat(label, value, color) {
      return '<div style="background:white;border-radius:12px;padding:0.75rem;border:1px solid var(--glass-border-subtle)">' +
        '<div style="font-size:1.4rem;font-weight:800;color:' + color + '">' + value + '</div>' +
        '<div style="font-size:0.68rem;font-weight:600;color:var(--text-secondary);margin-top:0.1rem">' + label + '</div></div>';
    }

    trayHtml += miniStat('Deltagere', totalMembers, '#7C5CFC');
    trayHtml += miniStat('Check-ins', totalCheckedIn, '#2ECFCF');
    trayHtml += miniStat('Connections', connectionCount, '#1A9E8E');
    trayHtml += miniStat('Beskeder', totalMessages, '#E879A8');
    if (avgStay > 0) trayHtml += miniStat('Gns. opholdstid', avgStayLabel, '#F59E0B');
    trayHtml += miniStat('Connection rate', connectionRate + '%', '#7C5CFC');
    trayHtml += '</div>';

    // Top connectors
    if (topConnectors.length > 0) {
      trayHtml += '<div style="margin-bottom:1rem">' +
        '<div style="font-size:0.62rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--accent);margin-bottom:0.4rem">Top networkere</div>';
      topConnectors.forEach(function(c, i) {
        trayHtml += '<div style="display:flex;align-items:center;gap:0.5rem;padding:0.5rem 0;border-bottom:1px solid var(--glass-border-subtle)">' +
          '<div style="width:22px;height:22px;border-radius:50%;background:var(--gradient-primary);color:white;display:flex;align-items:center;justify-content:center;font-size:0.55rem;font-weight:800;flex-shrink:0">' + (i + 1) + '</div>' +
          '<div style="flex:1;min-width:0"><div style="font-size:0.78rem;font-weight:700">Deltager #' + (i + 1) + '</div></div>' +
          '<div style="font-size:0.68rem;font-weight:700;color:#1A9E8E">' + c.connections + ' conn.</div>' +
        '</div>';
      });
      trayHtml += '</div>';
    }

    // Top interests
    if (topKeywords.length > 0) {
      trayHtml += '<div style="margin-bottom:1rem">' +
        '<div style="font-size:0.62rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--accent);margin-bottom:0.4rem">Interesser</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:0.25rem">';
      topKeywords.forEach(function(kw) {
        trayHtml += '<span class="tag">' + escHtml(kw[0]) + ' <span style="color:var(--muted);font-size:0.6rem">' + kw[1] + '</span></span>';
      });
      trayHtml += '</div></div>';
    }

    // Participant list
    trayHtml += '<div style="margin-bottom:1rem">' +
      '<div style="font-size:0.62rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--accent);margin-bottom:0.4rem">Alle deltagere (' + totalMembers + ')</div>';

    members.forEach(function(m) {
      var p = profileMap[m.user_id] || {};

      trayHtml += '<div style="display:flex;align-items:center;gap:0.5rem;padding:0.45rem 0;border-bottom:1px solid var(--glass-border-subtle)">' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-size:0.78rem;font-weight:600">' + escHtml(p.name || 'Ukendt') + '</div>' +
          '<div style="font-size:0.62rem;color:var(--muted)">' + escHtml(p.title || '') + (p.workplace ? ' · ' + escHtml(p.workplace) : '') + '</div>' +
        '</div>' +
      '</div>';
    });

    trayHtml += '</div>';

    // Footer
    trayHtml += '<div style="text-align:center;padding:1rem 0;font-size:0.68rem;color:var(--muted);border-top:1px solid var(--glass-border-subtle)">' +
      'Genereret ' + new Date().toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) +
      '<br>Powered by Bubble · bubbleme.dk</div>';

    trayHtml += '</div>';

    tray.innerHTML = trayHtml;
    document.body.appendChild(overlay);
    document.body.appendChild(tray);

    // Store full HTML report for email export
    window._lastReportHtml = html;
    window._lastReportBubble = b;
    window._lastReportStats = { totalMembers: totalMembers, totalCheckedIn: totalCheckedIn, connectionRate: connectionRate };

    // Animate in
    requestAnimationFrame(function() {
      overlay.style.opacity = '1';
      tray.style.transform = 'translateX(0)';
    });

    trackEvent('event_report_generated', { bubble_id: bubbleId, member_count: totalMembers });

  } catch(e) { logError('generateEventReport', e); errorToast('load', e); }
}

function closeReportTray() {
  var tray = document.getElementById('event-report-tray');
  var overlay = tray?.previousElementSibling;
  if (tray) { tray.style.transform = 'translateX(100%)'; }
  if (overlay) { overlay.style.opacity = '0'; }
  setTimeout(function() {
    if (tray) tray.remove();
    if (overlay) overlay.remove();
  }, 350);
}

function exportReportPdf(bubbleId) {
  closeReportTray();
  downloadMembersPdf(bubbleId);
}

async function exportReportEmail(bubbleId) {
  try {
    var b = window._lastReportBubble;
    var stats = window._lastReportStats;
    if (!b || !stats) { showToast('Ingen rapport at sende'); return; }

    // Ask for email
    var email = prompt('Indtast email-adresse til rapporten:');
    if (!email || !email.includes('@')) { showToast('Ugyldig email'); return; }

    showToast('Sender rapport...');

    // Use EmailJS if available, otherwise fallback to mailto
    if (_emailjsLoaded && window.emailjs) {
      await window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
        to_email: email,
        subject: 'Event-rapport: ' + b.name,
        message: 'Event: ' + b.name + '\n' +
          'Dato: ' + new Date(b.created_at).toLocaleDateString('da-DK') + '\n' +
          'Deltagere: ' + stats.totalMembers + '\n' +
          'Check-ins: ' + stats.totalCheckedIn + '\n' +
          'Connection rate: ' + stats.connectionRate + '%\n\n' +
          'Fuld rapport er vedhæftet som PDF — download den fra appen via Event → Info → Event-rapport → PDF.'
      });
      showSuccessToast('Rapport sendt til ' + email);
    } else {
      // Fallback: open mailto
      var subject = encodeURIComponent('Event-rapport: ' + b.name);
      var body = encodeURIComponent('Event: ' + b.name + '\nDeltagere: ' + stats.totalMembers + '\nCheck-ins: ' + stats.totalCheckedIn + '\nConnection rate: ' + stats.connectionRate + '%');
      window.location.href = 'mailto:' + email + '?subject=' + subject + '&body=' + body;
      showToast('Mail-app åbnet');
    }
  } catch(e) { logError('exportReportEmail', e); errorToast('send', e); }
}

// ══════════════════════════════════════════════════════════
//  BUBBLE INVITE SYSTEM
// ══════════════════════════════════════════════════════════
var inviteBubbleId = null;
var inviteSelected = [];

async function openInviteModal(bubbleId) {
  try {
  inviteBubbleId = bubbleId;
  inviteSelected = [];
  var list = document.getElementById('invite-list');
  if (!list) return;
  bbOpen('invite');
  list.innerHTML = '<div style="text-align:center;padding:1.5rem;font-size:0.75rem;color:var(--muted)">Henter gemte kontakter...</div>';
  var btn = document.getElementById('invite-send-btn');
  if (btn) btn.textContent = 'Send invitationer';

  try {
    var r1 = await sb.from('saved_contacts').select('contact_id').eq('user_id', currentUser.id);
    var contactIds = (r1.data || []).map(function(s) { return s.contact_id; });
    if (contactIds.length === 0) {
      list.innerHTML = '<div style="text-align:center;padding:2rem;font-size:0.78rem;color:var(--muted)">Du har ingen gemte kontakter endnu.<br>Gem profiler fra radaren f\u00f8rst.</div>';
      return;
    }
    var r2 = await sb.from('profiles').select('id,name,title,keywords,avatar_url').in('id', contactIds);
    var profiles = r2.data || [];
    var r3 = await sb.from('bubble_members').select('user_id').eq('bubble_id', bubbleId);
    var memberIds = (r3.data || []).map(function(m) { return m.user_id; });
    var r4 = await sb.from('bubble_invitations').select('to_user_id').eq('bubble_id', bubbleId).eq('status', 'pending');
    var pendingIds = (r4.data || []).map(function(inv) { return inv.to_user_id; });

    var available = profiles.filter(function(p) { return memberIds.indexOf(p.id) < 0; });
    if (available.length === 0) {
      list.innerHTML = '<div style="text-align:center;padding:2rem;font-size:0.78rem;color:var(--muted)">Alle dine gemte kontakter er allerede i denne boble.</div>';
      return;
    }
    // Sort by star rating
    available.sort(function(a, b) { return (starGet(b.id) || 0) - (starGet(a.id) || 0); });
    var colors = proxColors || ['linear-gradient(135deg,#2ECFCF,#22B8CF)'];
    list.innerHTML = available.map(function(p, i) {
      var ini = (p.name||'?').split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();
      var col = colors[i % colors.length];
      var isPending = pendingIds.indexOf(p.id) >= 0;
      var stars = starGet(p.id);
      var starHtml = stars > 0 ? ' <span style="font-size:0.55rem;color:var(--accent)">' + '\u2605'.repeat(stars) + '</span>' : '';
      var avHtml = p.avatar_url ?
        '<div class="invite-avatar" style="overflow:hidden"><img src="' + escHtml(p.avatar_url) + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%"></div>' :
        '<div class="invite-avatar" style="background:' + col + '">' + escHtml(ini) + '</div>';
      return '<label class="invite-row' + (isPending ? ' pending' : '') + '" data-uid="' + p.id + '">' +
        avHtml +
        '<div style="flex:1;min-width:0">' +
          '<div class="fw-600 fs-085">' + escHtml(p.name || '?') + starHtml + '</div>' +
          '<div class="fs-072 text-muted">' + escHtml(p.title || '') + '</div>' +
        '</div>' +
        (isPending ? '<span class="fs-065 text-muted">Afventer</span>' :
          '<input type="checkbox" class="invite-check" data-uid="' + p.id + '" onchange="toggleInvite(this)">') +
      '</label>';
    }).join('');
  } catch(e) { logError('openInviteModal', e); list.innerHTML = '<div style="padding:1rem;color:var(--accent2)">Kunne ikke hente kontakter</div>'; }
  } catch(e) { logError("openInviteModal", e); }
}

function closeInviteModal() {
  bbClose('invite');
  inviteSelected = [];
}

function toggleInvite(cb) {
  var uid = cb.dataset.uid;
  if (cb.checked) { if (inviteSelected.indexOf(uid) < 0) inviteSelected.push(uid); }
  else { inviteSelected = inviteSelected.filter(function(id) { return id !== uid; }); }
  var btn = document.getElementById('invite-send-btn');
  var n = inviteSelected.length;
  if (btn) {
    btn.textContent = n > 0 ? 'Send (' + n + ')' : 'Send invitationer';
    btn.disabled = n === 0;
  }
  // Update subtitle
  var sub = document.getElementById('invite-subtitle');
  if (sub) sub.textContent = n > 0 ? n + ' valgt' : 'Vælg fra dine gemte kontakter';
}

async function sendBubbleInvites() {
  if (inviteSelected.length === 0) return showToast('Vælg mindst én kontakt');
  try {
    var btn = document.getElementById('invite-send-btn');
    if (btn) { btn.textContent = 'Sender...'; btn.disabled = true; btn.classList.add('btn-loading'); }

    // Filter out users who already have a pending invite (prevents duplicate errors)
    var { data: existing } = await sb.from('bubble_invitations')
      .select('to_user_id')
      .eq('bubble_id', inviteBubbleId)
      .eq('status', 'pending')
      .in('to_user_id', inviteSelected);
    var existingIds = (existing || []).map(function(e) { return e.to_user_id; });
    var newIds = inviteSelected.filter(function(uid) { return existingIds.indexOf(uid) < 0; });

    if (newIds.length > 0) {
      var rows = newIds.map(function(uid) {
        return { bubble_id: inviteBubbleId, from_user_id: currentUser.id, to_user_id: uid, status: 'pending' };
      });
      var { error } = await sb.from('bubble_invitations').insert(rows);
      if (error) throw error;
    }

    closeInviteModal();
    var skipped = inviteSelected.length - newIds.length;
    var msg = newIds.length > 0
      ? newIds.length + ' invitation' + (newIds.length > 1 ? 'er' : '') + ' sendt ✓'
      : 'Allerede inviteret';
    if (skipped > 0 && newIds.length > 0) msg += ' (' + skipped + ' allerede inviteret)';
    showToast(msg);
  } catch(e) {
    logError('sendBubbleInvites', e);
    closeInviteModal();
    errorToast('send', e);
  }
}


function bcOpenPerson(userId, name, title, color, fromScreen) {
  const initials = (name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  document.getElementById('ps-avatar').style.background = color;
  document.getElementById('ps-avatar').textContent = initials;
  document.getElementById('ps-avatar').style.overflow = 'hidden';
  document.getElementById('ps-name').textContent = name || 'Ukendt';
  document.getElementById('ps-sub').textContent = title || '';
  document.getElementById('ps-bio').textContent = '';
  document.getElementById('ps-bubbleup-btn').style.display = 'flex';
  document.getElementById('ps-bubbleup-confirm').classList.remove('show');
  var psLabel = document.getElementById('ps-bubbleup-label');
  if (psLabel) psLabel.textContent = 'Opret boble med ' + ((name || '').split(' ')[0] || 'personen');
  // Fetch full profile for bio + LinkedIn + avatar
  const liBtn = document.getElementById('ps-linkedin-btn');
  liBtn.style.display = 'none';
  sb.from('profiles').select('bio,linkedin,workplace,avatar_url').eq('id', userId).single().then(({data}) => {
    if (data?.bio) document.getElementById('ps-bio').textContent = data.bio;
    var subEl = document.getElementById('ps-sub');
    if (subEl && data?.workplace) subEl.textContent = (title || '') + (title && data.workplace ? ' · ' : '') + (data.workplace || '');
    if (data?.linkedin) { liBtn.href = data.linkedin.startsWith('http') ? data.linkedin : 'https://' + data.linkedin; liBtn.style.display = 'flex'; }
    // Show avatar photo if available
    var psAv = document.getElementById('ps-avatar');
    if (psAv && data?.avatar_url) {
      psAv.innerHTML = '<img src="' + escHtml(data.avatar_url) + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%">';
    }
  }).catch(function(e) { logError('psLoadProfile', e); });
  // Store userId and fromScreen
  document.getElementById('person-sheet-el').dataset.userId = userId;
  document.getElementById('person-sheet-el').dataset.userName = name;
  document.getElementById('person-sheet-el').dataset.fromScreen = fromScreen || 'screen-bubble-chat';
  // Check if contact is already saved — update button state
  const saveBtn = document.getElementById('ps-save-btn');
  const modSection = document.querySelector('.ps-moderation');
  const isOwnProfile = userId === currentUser?.id;
  if (saveBtn) {
    if (isOwnProfile) { saveBtn.style.display = 'none'; }
    else {
      saveBtn.style.display = '';
      saveBtn.innerHTML = icon('bookmark') + ' Gem';
      sb.from('saved_contacts').select('id').eq('user_id', currentUser.id).eq('contact_id', userId).maybeSingle().then(({data}) => {
        if (data) saveBtn.innerHTML = icon('bookmarkFill') + ' Gemt';
      }).catch(function(){});
    }
  }
  if (modSection) modSection.style.display = isOwnProfile ? 'none' : '';
  // Show star rating if contact is saved
  var starRow = document.getElementById('ps-star-row');
  var starsEl = document.getElementById('ps-stars');
  if (starRow && starsEl) {
    sb.from('saved_contacts').select('id').eq('user_id', currentUser.id).eq('contact_id', userId).maybeSingle().then(function(res) {
      if (res.data) {
        starRow.style.display = 'flex';
        var r = starGet(userId);
        starsEl.innerHTML = [1,2,3].map(function(n) {
          return '<div class="ps-star ' + (n <= r ? 'filled' : 'empty') + '" onclick="psSetStar(\'' + userId + '\',' + n + ')">\u2605</div>';
        }).join('');
      } else {
        starRow.style.display = 'none';
      }
    }).catch(function(){});
  }
  document.getElementById('ps-overlay').classList.add('open');
  setTimeout(() => document.getElementById('person-sheet-el').classList.add('open'), 10);
}

async function dmOpenPersonSheet(userId) {
  try {
    var { data: p } = await sb.from('profiles').select('name,title,avatar_url').eq('id', userId).single();
    bcOpenPerson(userId, p?.name || 'Ukendt', p?.title || '', 'linear-gradient(135deg,#2ECFCF,#22B8CF)', 'screen-chat');
  } catch(e) { logError('dmOpenPersonSheet', e); }
}


function psClose() {
  var sheet = document.getElementById('person-sheet-el');
  if (sheet) { sheet.classList.remove('open'); sheet.style.transform = ''; }
  document.getElementById('ps-bubbleup-btn').style.display = 'flex';
  document.getElementById('ps-bubbleup-confirm').classList.remove('show');
  setTimeout(function() {
    document.getElementById('ps-overlay').classList.remove('open');
  }, 320);
}

// ══════════════════════════════════════════════════════════
//  SCANNER FROM BUBBLE — opens live scanner in context
// ══════════════════════════════════════════════════════════
function openBubbleScannerFromInfo(bubbleId) {
  // Store which bubble we're scanning for
  _scannerBubbleId = bubbleId;
  openLiveCheckin();
  showToast('Scanner klar — scan en deltagers QR-kode');
}

// ══════════════════════════════════════════════════════════
//  POP (DELETE) BUBBLE — owner only, with confirmation tray
// ══════════════════════════════════════════════════════════
function confirmPopBubble(bubbleId) {
  var infoList = document.getElementById('bc-info-list');
  if (!infoList) return;
  // Find the delete button and replace with confirmation tray
  var existing = document.getElementById('pop-bubble-tray');
  if (existing) return; // Already showing
  var tray = document.createElement('div');
  tray.id = 'pop-bubble-tray';
  tray.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:0.6rem 0.8rem;background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.2);border-radius:12px;margin-top:0.5rem;gap:0.5rem';
  tray.innerHTML = '<div style="flex:1"><div style="font-size:0.78rem;font-weight:700;color:#EF4444">Slet denne boble?</div><div style="font-size:0.65rem;color:var(--text-secondary)">Chat, medlemmer, tilknyttede sub-bobler og events slettes permanent</div></div>' +
    '<div style="display:flex;gap:0.3rem">' +
    '<button onclick="popBubble(\'' + bubbleId + '\')" style="font-size:0.72rem;padding:0.35rem 0.7rem;background:#EF4444;color:white;border:none;border-radius:8px;cursor:pointer;font-family:inherit;font-weight:700">Slet</button>' +
    '<button onclick="document.getElementById(\'pop-bubble-tray\').remove()" style="font-size:0.72rem;padding:0.35rem 0.7rem;background:none;color:var(--muted);border:1px solid var(--glass-border);border-radius:8px;cursor:pointer;font-family:inherit">Annuller</button>' +
    '</div>';
  infoList.appendChild(tray);
}

async function popBubble(bubbleId) {
  try {
    showToast('Sletter boble...');
    // S4: Check for child bubbles and cascade-delete
    var { data: children } = await sb.from('bubbles').select('id').eq('parent_bubble_id', bubbleId);
    if (children && children.length > 0) {
      for (var i = 0; i < children.length; i++) {
        var cid = children[i].id;
        await sb.from('bubble_messages').delete().eq('bubble_id', cid);
        await sb.from('bubble_members').delete().eq('bubble_id', cid);
        await sb.from('bubble_invitations').delete().eq('bubble_id', cid);
        await sb.from('bubbles').delete().eq('id', cid);
      }
    }
    // Delete main bubble's data
    await sb.from('bubble_messages').delete().eq('bubble_id', bubbleId);
    await sb.from('bubble_members').delete().eq('bubble_id', bubbleId);
    await sb.from('bubble_invitations').delete().eq('bubble_id', bubbleId);
    var { error } = await sb.from('bubbles').delete().eq('id', bubbleId).eq('created_by', currentUser.id);
    if (error) { errorToast('save', error); return; }
    showSuccessToast('Boble slettet');
    goTo('screen-home');
    loadHome();
  } catch(e) { logError('popBubble', e); errorToast('delete', e); }
}


