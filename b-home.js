// ══════════════════════════════════════════════════════════
//  BUBBLE — HOME SCREEN + DASHBOARD + CUSTOMIZATION
//  Auto-split from app.js · v3.7.0
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
//  HOME
// ══════════════════════════════════════════════════════════
async function loadHome() {
  try {
    if (!currentProfile) await loadCurrentProfile();
    updateHomeAvatar();

    // Greeting
    const nameEl = document.getElementById('home-greeting-name');
    if (nameEl && currentProfile?.name) {
    // Dynamic greeting
    var hour = new Date().getHours();
    var greetText = hour < 5 ? 'God nat' : hour < 12 ? 'Godmorgen' : hour < 17 ? 'Goddag' : hour < 22 ? 'God aften' : 'God nat';
    var greetLabel = nameEl?.previousElementSibling;
    if (greetLabel) greetLabel.textContent = greetText + ',';
      nameEl.innerHTML = escHtml(currentProfile.name.split(' ')[0]) + '<span style="display:inline-flex;width:1.3rem;height:1.3rem">' + ico('wave') + '</span>';
    }

    // Load all dashboard data in parallel
    var hsp = hsGetPrefs();
    var loaders = [];
    if (hsp.bubbles) loaders.push(loadHomeBubblesCard());
    if (hsp.notifs) loaders.push(loadHomeNotifCard());
    if (hsp.radar) { loaders.push(updateRadarCount()); loaders.push(loadProximityMap()); loaders.push(loadTopMatches()); }
    if (hsp.live) loaders.push(loadLiveBubbleStatus());
    if (hsp.saved) loaders.push(loadSavedContacts());
    await Promise.all(loaders);
    hsApplyToHome();
    showGettingStarted();
    showProgressiveOnboarding();
  } catch(e) { logError("loadHome", e); /* Individual cards handle their own errors */ }
}

async function loadHomeBubblesCard() {
  try {
    const sub = document.getElementById('home-bubbles-sub');
    const badge = document.getElementById('home-bubbles-badge');
    const { data: memberships } = await sb.from('bubble_members').select('bubble_id').eq('user_id', currentUser.id);
    const count = memberships?.length || 0;
    if (sub) sub.textContent = count > 0 ? `${count} aktiv${count !== 1 ? 'e' : ''} boble${count !== 1 ? 'r' : ''}` : 'Du er ikke i nogen bobler endnu';
    // Badge: show count of unseen new members (since last viewed)
    if (badge) {
      var lastSeen = localStorage.getItem('bubble_bubbles_seen') || '2000-01-01';
      if (count > 0) {
        var ids = memberships.map(function(m) { return m.bubble_id; });
        var { count: newCount } = await sb.from('bubble_members')
          .select('*', {count:'exact',head:true})
          .in('bubble_id', ids).neq('user_id', currentUser.id).gt('joined_at', lastSeen);
        var n = newCount || 0;
        badge.textContent = n;
        badge.style.display = n > 0 ? 'flex' : 'none';
      } else {
        badge.style.display = 'none';
      }
    }
  } catch(e) { logError("loadHomeBubblesCard", e); showToast(e.message || "Ukendt fejl"); }
}

// ── Notification nav badge ──
async function updateNotifNavBadge() {
  try {
    var badge = document.getElementById('home-notif-badge');
    if (!badge || !currentUser) return;
    var lastSeen = localStorage.getItem('bubble_notifs_seen') || '2000-01-01';
    // Count pending invitations + new saves since last seen
    var { count: invCount } = await sb.from('bubble_invitations')
      .select('*', { count: 'exact', head: true })
      .eq('to_user_id', currentUser.id)
      .eq('status', 'pending');
    var { count: saveCount } = await sb.from('saved_contacts')
      .select('*', { count: 'exact', head: true })
      .eq('contact_id', currentUser.id)
      .gt('created_at', lastSeen);
    var n = (invCount || 0) + (saveCount || 0);
    if (badge) { badge.textContent = n > 9 ? '9+' : n; badge.style.display = n > 0 ? 'flex' : 'none'; }
  } catch(e) { /* silent */ }
}

async function loadHomeNotifCard() {
  try {
    const sub = document.getElementById('home-notif-sub');
    const badge = document.getElementById('home-notif-badge');
    var lastSeen = localStorage.getItem('bubble_notifs_seen') || '2000-01-01';
    const { data: memberships } = await sb.from('bubble_members').select('bubble_id').eq('user_id', currentUser.id);
    if (!memberships || memberships.length === 0) {
      if (sub) sub.textContent = 'Ingen notifikationer';
      if (badge) badge.style.display = 'none';
      return;
    }
    const ids = memberships.map(m => m.bubble_id);
    const { count } = await sb.from('bubble_members')
      .select('*', {count:'exact',head:true})
      .in('bubble_id', ids).neq('user_id', currentUser.id).gt('joined_at', lastSeen);
    const n = count || 0;
    if (sub) sub.textContent = n > 0 ? `${n} nye i dine bobler` : 'Ingen nye notifikationer';
    if (badge) { badge.textContent = n; badge.style.display = n > 0 ? 'flex' : 'none'; }
  } catch(e) { logError("loadHomeNotifCard", e); showToast(e.message || "Ukendt fejl"); }
}

// ── Bubbles screen tabs ──
function openCreateLiveModal() {
  var nameInput = document.getElementById('ql-name');
  var locInput = document.getElementById('ql-location');
  if (nameInput) nameInput.value = '';
  if (locInput) locInput.value = '';
  openModal('modal-create-live');
  setTimeout(function() { if (nameInput) nameInput.focus(); }, 300);
}

function showQuickLiveForm() { openCreateLiveModal(); }
function hideQuickLiveForm() { closeModal('modal-create-live'); }

async function submitQuickLive() {
  var name = (document.getElementById('ql-name')?.value || '').trim();
  if (!name) { showToast('Giv dit event et navn'); return; }
  var location = (document.getElementById('ql-location')?.value || '').trim();
  try {
    showToast('Opretter...');
    var { data: bubble, error } = await sb.from('bubbles').insert({
      name: name,
      type: 'event',
      visibility: 'public',
      location: location,
      created_by: currentUser.id
    }).select().single();
    if (error) { showToast('Fejl: ' + error.message); return; }
    // Auto-join + check-in
    await sb.from('bubble_members').upsert({
      user_id: currentUser.id,
      bubble_id: bubble.id,
      joined_at: new Date().toISOString(),
      checked_in_at: new Date().toISOString()
    });
    closeModal('modal-create-live');
    // Show confirmed state in checkin sheet
    var scanConfirmed = document.getElementById('live-scan-confirmed');
    if (scanConfirmed) {
      scanConfirmed.style.display = 'flex';
      var nameEl = document.getElementById('live-scan-confirmed-name');
      if (nameEl) nameEl.textContent = 'Checked ind \u2014 ' + name + '!';
      var metaEl = document.getElementById('live-scan-confirmed-meta');
      if (metaEl) metaEl.innerHTML = '<div style="display:flex;gap:0.3rem;margin-top:0.4rem">' +
        '<button onclick="closeLiveCheckinModal();openBubble(\'' + bubble.id + '\')" style="flex:1;font-size:0.72rem;padding:0.35rem 0.8rem;background:rgba(124,92,252,0.08);color:var(--accent);border:1px solid rgba(124,92,252,0.2);border-radius:8px;cursor:pointer;font-family:inherit;font-weight:600">Se hvem der er her \u2192</button>' +
        '<button onclick="liveCheckout();closeLiveCheckinModal()" style="font-size:0.72rem;padding:0.35rem 0.6rem;background:none;color:var(--muted);border:1px solid var(--glass-border);border-radius:8px;cursor:pointer;font-family:inherit;font-weight:600">Check ud</button>' +
        '</div>';
    }
    showToast('\uD83D\uDCCD ' + name + ' oprettet!');
    loadLiveBubbleStatus();
    loadLiveCheckinList();
  } catch(e) { logError('submitQuickLive', e); showToast('Kunne ikke oprette'); }
}

async function openQuickLiveBubble() {
  openCreateLiveModal();
}

function bbSwitchTab(tab) {
  var networkPanel = document.getElementById('bb-panel-network');
  var livePanel = document.getElementById('bb-panel-live');
  var networkTab = document.getElementById('bb-tab-network');
  var liveTab = document.getElementById('bb-tab-live');
  if (tab === 'live') {
    if (networkPanel) networkPanel.style.display = 'none';
    if (livePanel) livePanel.style.display = 'block';
    if (networkTab) networkTab.classList.remove('active');
    if (liveTab) liveTab.classList.add('active');
    bbLoadLivePanel();
  } else {
    if (networkPanel) networkPanel.style.display = 'block';
    if (livePanel) livePanel.style.display = 'none';
    if (networkTab) networkTab.classList.add('active');
    if (liveTab) liveTab.classList.remove('active');
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
    var myNav = _navVersion;
    // Mark bubbles as seen — clears badge on home screen
    localStorage.setItem('bubble_bubbles_seen', new Date().toISOString());
    const ownedList  = document.getElementById('my-owned-bubbles-list');
    const joinedList = document.getElementById('my-bubbles-list');
    ownedList.innerHTML = skelCards(2);
    joinedList.innerHTML = skelCards(2);

    const { data: memberships } = await sb.from('bubble_members')
      .select('bubble_id').eq('user_id', currentUser.id);
    if (_navVersion !== myNav) return;

    if (!memberships || memberships.length === 0) {
      ownedList.innerHTML  = '';
      joinedList.innerHTML = '<div class="empty-state" style="padding:2rem 0"><div class="empty-icon">' + icon('bubble') + '</div><div class="empty-text">Du er ikke med i nogen bobler endnu</div><div style="margin-top:1rem"><button class="btn-primary" onclick="goTo(\'screen-discover\');loadDiscover()" style="font-size:0.82rem;padding:0.6rem 1.5rem">Opdag bobler →</button></div><div style="margin-top:0.5rem"><button class="btn-secondary" onclick="openCreateBubble()" style="font-size:0.78rem;padding:0.5rem 1.2rem">+ Opret en boble</button></div></div>';
      var profBubblesEl = document.getElementById('profile-bubbles');
      if (profBubblesEl) {
        profBubblesEl.innerHTML = '<div style="text-align:center;padding:2rem 1rem">' +
          '<div style="width:44px;height:44px;margin:0 auto 0.7rem;opacity:0.4;color:var(--accent)">' + ico('bubble') + '</div>' +
          '<div style="font-size:0.85rem;font-weight:700;margin-bottom:0.25rem">Ingen bobler endnu</div>' +
          '<div style="font-size:0.72rem;color:var(--text-secondary);margin-bottom:1rem;line-height:1.4">Bobler er fællesskaber og events. Udforsk og join din første!</div>' +
          '<button onclick="goTo(\'screen-discover\');loadDiscover()" style="font-size:0.78rem;padding:0.55rem 1.3rem;background:rgba(124,92,252,0.12);color:var(--accent);border:1px solid rgba(124,92,252,0.25);border-radius:12px;cursor:pointer;font-family:inherit;font-weight:600">Opdag bobler →</button>' +
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
          '<button onclick="goTo(\'screen-discover\');loadDiscover()" style="font-size:0.78rem;padding:0.55rem 1.3rem;background:rgba(124,92,252,0.12);color:var(--accent);border:1px solid rgba(124,92,252,0.25);border-radius:12px;cursor:pointer;font-family:inherit;font-weight:600">Opdag bobler →</button>' +
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
              cHtml +
            '</div>' +
            '<div class="icon-muted">›</div>' +
          '</div>';
        }).join('');
      }
    }
  } catch(e) { logError("loadMyBubbles", e); showRetryState('my-bubbles-list', 'loadMyBubbles', 'Kunne ikke hente bobler'); }
}

async function updateRadarCount() {
  try {
    const { data: memberships } = await sb.from('bubble_members').select('bubble_id').eq('user_id', currentUser.id);
    const rcEl = document.getElementById('radar-count-home');
    if (!memberships || memberships.length === 0) {
      if (rcEl) rcEl.textContent = 'Join en boble for at se matches';
      return;
    }
    const ids = memberships.map(m => m.bubble_id);
    // Use denormalized member_count if available, fallback to count query
    const { data: myBubbles } = await sb.from('bubbles').select('member_count').in('id', ids);
    var total = 0;
    if (myBubbles && myBubbles[0]?.member_count != null) {
      total = myBubbles.reduce(function(sum, b) { return sum + (b.member_count || 0); }, 0) - memberships.length;
    } else {
      var { count } = await sb.from('bubble_members').select('*', {count:'exact',head:true}).in('bubble_id', ids).neq('user_id', currentUser.id);
      total = count || 0;
    }
    if (rcEl) rcEl.textContent = total + ' profiler synlige i dine bobler';

    // Load preview avatars for radar card (deduplicated by user_id)
    var previewEl = document.getElementById('radar-preview-avatars');
    if (previewEl && total > 0) {
      var { data: previewProfiles } = await sb.from('bubble_members')
        .select('user_id, profiles(name, avatar_url)')
        .in('bubble_id', ids).neq('user_id', currentUser.id)
        .limit(20);
      // Deduplicate by user_id
      var seen = {};
      var unique = [];
      (previewProfiles || []).forEach(function(m) {
        if (!seen[m.user_id]) { seen[m.user_id] = true; unique.push(m); }
      });
      var deduped = unique.slice(0, 5);
      var uniqueTotal = Object.keys(seen).length;
      if (deduped.length > 0) {
        var avColors = ['linear-gradient(135deg,#2ECFCF,#22B8CF)','linear-gradient(135deg,#6366F1,#7C5CFC)','linear-gradient(135deg,#E879A8,#EC4899)','linear-gradient(135deg,#F59E0B,#EAB308)','linear-gradient(135deg,#1A9E8E,#10B981)','linear-gradient(135deg,#8B5CF6,#A855F7)','linear-gradient(135deg,#3B82F6,#6366F1)','linear-gradient(135deg,#EF4444,#F97316)','linear-gradient(135deg,#06B6D4,#0EA5E9)','linear-gradient(135deg,#D946EF,#C026D3)'];
        previewEl.innerHTML = deduped.map(function(m, i) {
          var p = m.profiles || {};
          var ini = (p.name||'?').split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();
          if (p.avatar_url) return '<div class="avatar" style="background:' + avColors[i % 10] + ';overflow:hidden"><img src="' + escHtml(p.avatar_url) + '" style="width:100%;height:100%;object-fit:cover"></div>';
          return '<div class="avatar" style="background:' + avColors[i % 10] + '">' + ini + '</div>';
        }).join('') + (uniqueTotal > 5 ? '<div class="avatar" style="background:var(--glass-bg);color:var(--text-secondary);font-size:0.5rem;border:1px solid var(--glass-border-subtle)">+' + (uniqueTotal - 5) + '</div>' : '');
      }
    }
  } catch(e) { logError("updateRadarCount", e); }
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

  return `<div class="card flex-row-center" data-action="openBubble" data-id="${b.id}">
    <div class="bubble-icon" style="background:${bubbleColor(b.type, 0.15)};color:${bubbleColor(b.type, 0.9)}">${bubbleEmoji(b.type)}</div>
    <div style="flex:1;min-width:0">
      <div class="fw-600 fs-09">${escHtml(b.name)}</div>
      <div style="font-size:0.75rem;color:var(--text-secondary);display:flex;align-items:center;gap:0.25rem;flex-wrap:wrap">${escHtml(b.type_label || b.type)} ${b.location ? '<span>·</span> <span>' + escHtml(b.location) + '</span>' : ''} <span>·</span> ${visBadge}</div>
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

function hsReset() {
  hsSavePrefs(Object.assign({}, hsDefaults));
  try { localStorage.setItem('bubble_hs_notif_view', 'card'); } catch(e) {}
  hsUpdateAllToggles();
  hsApplyToHome();
  showToast('Hjem-skærm nulstillet');
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
  ['live','saved','bubbles','notifs','radar'].forEach(function(key) {
    hsUpdateToggleUI(key, prefs[key]);
  });
  // Update notif view picker
  var mode = hsGetNotifView();
  var cardBtn = document.getElementById('hs-notif-card');
  var feedBtn = document.getElementById('hs-notif-feed');
  if (cardBtn) cardBtn.classList.toggle('active', mode === 'card');
  if (feedBtn) feedBtn.classList.toggle('active', mode === 'feed');
  hsUpdatePreview();
}

function hsApplyToHome() {
  var prefs = hsGetPrefs();
  var anyVisible = false;
  ['live','saved','bubbles','notifs','radar'].forEach(function(key) {
    if (key === 'notifs') return;
    var els = document.querySelectorAll('[data-hs="' + key + '"]');
    els.forEach(function(el) {
      if (prefs[key]) {
        el.removeAttribute('data-hs-hidden');
      } else {
        el.setAttribute('data-hs-hidden', 'true');
      }
    });
    if (prefs[key]) anyVisible = true;
  });
  if (prefs.notifs) anyVisible = true;
  hsApplyNotifView();
  var emptyEl = document.getElementById('home-empty-state');
  if (emptyEl) emptyEl.style.display = anyVisible ? 'none' : 'block';
}



// Notification view mode: 'card' or 'feed'
function hsGetNotifView() {
  try { return localStorage.getItem('bubble_hs_notif_view') || 'card'; } catch(e) { return 'card'; }
}

function hsSetNotifView(mode) {
  try { localStorage.setItem('bubble_hs_notif_view', mode); } catch(e) {}
  // Update picker buttons
  var cardBtn = document.getElementById('hs-notif-card');
  var feedBtn = document.getElementById('hs-notif-feed');
  if (cardBtn) { cardBtn.classList.toggle('active', mode === 'card'); }
  if (feedBtn) { feedBtn.classList.toggle('active', mode === 'feed'); }
  hsApplyNotifView();
}

function hsApplyNotifView() {
  var mode = hsGetNotifView();
  var card = document.querySelector('.card-notif[data-hs="notifs"]');
  var feed = document.getElementById('home-notif-feed');
  var prefs = hsGetPrefs();
  if (!prefs.notifs) {
    if (card) card.setAttribute('data-hs-hidden', 'true');
    if (feed) feed.setAttribute('data-hs-hidden', 'true');
    return;
  }
  if (mode === 'feed') {
    if (card) card.setAttribute('data-hs-hidden', 'true');
    if (feed) { feed.removeAttribute('data-hs-hidden'); }
    loadHomeNotifFeed();
  } else {
    if (card) card.removeAttribute('data-hs-hidden');
    if (feed) feed.setAttribute('data-hs-hidden', 'true');
  }
}

async function loadHomeNotifFeed() {
  var list = document.getElementById('home-notif-feed-list');
  if (!list) return;
  try {
    // Get recent invitations
    var items = [];
    var { data: invites } = await sb.from('bubble_invitations')
      .select('id, from_user_id, bubble_id, created_at, status, profiles!bubble_invitations_from_user_id_fkey(name), bubbles(name)')
      .eq('to_user_id', currentUser.id)
      .order('created_at', {ascending:false})
      .limit(8);
    if (invites) {
      invites.forEach(function(inv) {
        var name = inv.profiles ? inv.profiles.name : 'Nogen';
        var bname = inv.bubbles ? inv.bubbles.name : 'en boble';
        var isNew = inv.status === 'pending';
        items.push({
          html: '<strong>' + escHtml(name) + '</strong> inviterede dig til <strong>' + escHtml(bname) + '</strong>',
          time: timeAgo(inv.created_at),
          isNew: isNew,
          date: new Date(inv.created_at).getTime()
        });
      });
    }

    // Get recent bubble member joins (for your bubbles)
    var { data: myBubbles } = await sb.from('bubble_members').select('bubble_id').eq('user_id', currentUser.id);
    var myBubbleIds = (myBubbles || []).map(function(m) { return m.bubble_id; });
    if (myBubbleIds.length > 0) {
      var { data: recentJoins } = await sb.from('bubble_members')
        .select('user_id, bubble_id, created_at, profiles(name), bubbles(name)')
        .in('bubble_id', myBubbleIds)
        .neq('user_id', currentUser.id)
        .order('created_at', {ascending:false})
        .limit(5);
      if (recentJoins) {
        recentJoins.forEach(function(j) {
          var name = j.profiles ? j.profiles.name : 'Nogen';
          var bname = j.bubbles ? j.bubbles.name : 'en boble';
          items.push({
            html: '<strong>' + escHtml(name) + '</strong> joined <strong>' + escHtml(bname) + '</strong>',
            time: timeAgo(j.created_at),
            isNew: false,
            date: new Date(j.created_at).getTime()
          });
        });
      }
    }

    // Sort by date (most recent first)
    items.sort(function(a, b) { return b.date - a.date; });

    if (items.length === 0) {
      list.innerHTML = '<div class="fs-072 text-muted" style="text-align:center;padding:0.8rem">Ingen notifikationer endnu</div>';
      return;
    }

    list.innerHTML = items.slice(0, 6).map(function(item) {
      return '<div class="notif-feed-item">' +
        '<div class="notif-feed-dot' + (item.isNew ? '' : ' read') + '"></div>' +
        '<div class="notif-feed-text">' + item.html + '</div>' +
        '<div class="notif-feed-time">' + item.time + '</div>' +
      '</div>';
    }).join('');
  } catch(e) { logError('loadHomeNotifFeed', e); list.innerHTML = '<div class="fs-072 text-muted" style="padding:0.5rem">Kunne ikke hente</div>'; }
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
//  HOME TRAY — fuld liste over matches
// ══════════════════════════════════════════════════════════
function openHomeTray() {
  var overlay = document.getElementById('home-tray-overlay');
  var tray    = document.getElementById('home-tray');
  if (!overlay || !tray) {
    // Build tray HTML if not yet in DOM
    _buildHomeTrayDOM();
    overlay = document.getElementById('home-tray-overlay');
    tray    = document.getElementById('home-tray');
    if (!overlay || !tray) return;
  }
  // Populate tray with current proxAllProfiles sorted by score
  _renderHomeTrayList();
  overlay.style.display = 'block';
  requestAnimationFrame(function() {
    overlay.style.opacity = '1';
    tray.style.transform  = 'translateY(0)';
  });
}

function closeHomeTray() {
  var overlay = document.getElementById('home-tray-overlay');
  var tray    = document.getElementById('home-tray');
  if (!overlay || !tray) return;
  overlay.style.opacity = '0';
  tray.style.transform  = 'translateY(100%)';
  setTimeout(function() { overlay.style.display = 'none'; }, 320);
}

function _buildHomeTrayDOM() {
  var div = document.createElement('div');
  div.innerHTML =
    '<div id="home-tray-overlay" style="display:none;opacity:0;position:fixed;inset:0;background:rgba(0,0,0,0.35);z-index:900;transition:opacity 0.3s" onclick="closeHomeTray()">' +
      '<div id="home-tray" style="position:absolute;bottom:0;left:0;right:0;background:#fff;border-radius:20px 20px 0 0;max-height:82vh;overflow:hidden;display:flex;flex-direction:column;transform:translateY(100%);transition:transform 0.32s cubic-bezier(.32,1,.56,1)" onclick="event.stopPropagation()">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:1rem 1rem 0.6rem">' +
          '<span style="font-size:0.9rem;font-weight:700;color:var(--text)">Alle matches i nærheden</span>' +
          '<button onclick="closeHomeTray()" style="background:none;border:none;cursor:pointer;padding:0.25rem;color:var(--muted);font-size:1.1rem">✕</button>' +
        '</div>' +
        '<div id="home-tray-list" style="overflow-y:auto;padding:0 0.75rem 1.5rem;flex:1"></div>' +
      '</div>' +
    '</div>';
  document.body.appendChild(div.firstChild);
}

function _renderHomeTrayList() {
  var el = document.getElementById('home-tray-list');
  if (!el) return;
  var profiles = (typeof proxAllProfiles !== 'undefined' ? proxAllProfiles : [])
    .slice().sort(function(a, b) { return (b.matchScore || 0) - (a.matchScore || 0); });
  if (profiles.length === 0) {
    el.innerHTML = '<div style="text-align:center;padding:2rem;font-size:0.8rem;color:var(--muted)">Ingen i nærheden lige nu</div>';
    return;
  }
  var colors = ['#7C5CFC','#E879A8','#2ECFCF','#F59E0B','#10B981','#3B82F6','#EF4444','#8B5CF6','#06B6D4','#84CC16'];
  el.innerHTML = profiles.map(function(p, i) {
    var name = p.is_anon ? 'Anonym' : (p.name || '?');
    var ini  = p.is_anon ? '?' : name.split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();
    var col  = colors[i % colors.length];
    var ml   = (typeof matchLabel === 'function') ? matchLabel(p.matchScore || 0) : { text: '', color: 'var(--muted)' };
    return '<div style="display:flex;align-items:center;gap:0.75rem;padding:0.65rem 0.25rem;border-bottom:1px solid var(--border);cursor:pointer" onclick="closeHomeTray();setTimeout(function(){openRadarPerson(\'' + p.id + '\')},350)">' +
      '<div style="width:2.4rem;height:2.4rem;border-radius:50%;background:' + col + ';display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700;color:#fff;flex-shrink:0">' + escHtml(ini) + '</div>' +
      '<div style="flex:1;min-width:0">' +
        '<div style="font-size:0.85rem;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escHtml(name) + '</div>' +
        '<div style="font-size:0.7rem;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escHtml(p.title || '') + '</div>' +
      '</div>' +
      (ml.text ? '<span style="font-size:0.58rem;font-weight:700;color:' + ml.color + ';background:' + ml.bg + ';padding:0.15rem 0.45rem;border-radius:6px;white-space:nowrap">' + ml.text + '</span>' : '') +
    '</div>';
  }).join('');
}

// ══════════════════════════════════════════════════════════
//  HOME MINI-DARTBOARD
//  Renders a small bulls-eye with dots positioned by score
// ══════════════════════════════════════════════════════════
function renderHomeDartboard(containerId) {
  var el = document.getElementById(containerId);
  if (!el) return;
  var profiles = (typeof proxAllProfiles !== 'undefined' ? proxAllProfiles : []).slice(0, 20);
  var size = 180;
  var cx = size / 2, cy = size / 2, r = size / 2 - 6;
  var colors = ['#7C5CFC','#E879A8','#2ECFCF','#F59E0B','#10B981','#3B82F6','#EF4444','#8B5CF6','#06B6D4','#84CC16'];

  // Rings: 3 zones (inner=60+, mid=40+, outer=1+)
  var rings = [
    { pct: 0.30, fill: 'rgba(124,92,252,0.07)', stroke: 'rgba(124,92,252,0.2)' },
    { pct: 0.58, fill: 'rgba(124,92,252,0.04)', stroke: 'rgba(124,92,252,0.12)' },
    { pct: 0.90, fill: 'rgba(124,92,252,0.02)', stroke: 'rgba(124,92,252,0.07)' }
  ];

  var svgRings = rings.map(function(ring) {
    var rr = r * ring.pct;
    return '<circle cx="' + cx + '" cy="' + cy + '" r="' + rr + '" fill="' + ring.fill + '" stroke="' + ring.stroke + '" stroke-width="1"/>';
  }).join('');

  // Cross-hair lines
  var crosshair = '<line x1="' + cx + '" y1="' + (cy - r * 0.92) + '" x2="' + cx + '" y2="' + (cy + r * 0.92) + '" stroke="rgba(124,92,252,0.08)" stroke-width="1"/>' +
    '<line x1="' + (cx - r * 0.92) + '" y1="' + cy + '" x2="' + (cx + r * 0.92) + '" y2="' + cy + '" stroke="rgba(124,92,252,0.08)" stroke-width="1"/>';

  // Dots: position based on score + random angle
  var dots = profiles.map(function(p, i) {
    var score  = p.matchScore || 5;
    // Higher score = closer to center
    var dist   = r * 0.90 * (1 - (score / 100) * 0.85);
    var angle  = (i / Math.max(profiles.length, 1)) * 2 * Math.PI + (p.id ? (p.id.charCodeAt(0) * 0.4) : 0);
    var x = cx + dist * Math.cos(angle);
    var y = cy + dist * Math.sin(angle);
    var col = colors[i % colors.length];
    var dotR = score >= 60 ? 5 : score >= 40 ? 4 : 3;
    var ini  = p.is_anon ? '?' : (p.name || '?').split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase().charAt(0);
    return '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + dotR + '" fill="' + col + '" opacity="0.9"/>';
  }).join('');

  // Centre dot (you)
  var centre = '<circle cx="' + cx + '" cy="' + cy + '" r="5" fill="var(--accent)"/>' +
    '<circle cx="' + cx + '" cy="' + cy + '" r="2" fill="white"/>';

  el.innerHTML = '<svg viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" xmlns="http://www.w3.org/2000/svg">' +
    svgRings + crosshair + dots + centre + '</svg>';
}

// ══════════════════════════════════════════════════════════
//  PROFILE NUDGE — contextual hint with progress bar
// ══════════════════════════════════════════════════════════
function showProfileNudge() {
  var el = document.getElementById('home-profile-nudge');
  if (!el || !currentProfile) return;
  var p = currentProfile;
  var fields = [
    { done: !!(p.name && p.name.trim()),     hint: 'Tilføj dit navn' },
    { done: !!(p.title && p.title.trim()),   hint: 'Tilføj din titel' },
    { done: !!(p.bio && p.bio.trim()),       hint: 'Skriv en kort bio' },
    { done: !!(p.keywords && p.keywords.length >= 3), hint: 'Tilføj mindst 3 interesser' },
    { done: !!(p.avatar_url),                hint: 'Upload et profilbillede' }
  ];
  var done = fields.filter(function(f) { return f.done; }).length;
  var total = fields.length;
  var pct = Math.round((done / total) * 100);
  if (pct >= 100) { el.style.display = 'none'; return; }
  var nextHint = fields.find(function(f) { return !f.done; });
  el.style.display = 'block';
  el.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.4rem">' +
      '<span style="font-size:0.72rem;font-weight:600;color:var(--text)">Profil ' + pct + '% komplet</span>' +
      '<button onclick="openEditProfile()" style="font-size:0.65rem;font-weight:600;color:var(--accent);background:none;border:none;cursor:pointer;padding:0">Udfyld →</button>' +
    '</div>' +
    '<div style="height:5px;background:var(--border);border-radius:3px;overflow:hidden;margin-bottom:0.35rem">' +
      '<div style="height:100%;width:' + pct + '%;background:linear-gradient(90deg,var(--accent),var(--accent2));border-radius:3px;transition:width 0.5s"></div>' +
    '</div>' +
    '<div style="font-size:0.68rem;color:var(--muted)">' + (nextHint ? nextHint.hint : '') + '</div>';
}


