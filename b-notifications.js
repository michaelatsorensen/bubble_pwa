// ══════════════════════════════════════════════════════════
//  BUBBLE — NOTIFICATIONS + PUSH
//  Auto-split from app.js · v3.7.0
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
//  BOOT
// ══════════════════════════════════════════════════════════

// TTL windows for each notification type
var NOTIF_TTL = {
  invites:    14 * 24 * 60 * 60 * 1000,  // 14 dage
  messages:   null,                        // aldrig (lever i chatten)
  savedBy:    7 * 24 * 60 * 60 * 1000,    // 7 dage
  live:       4 * 60 * 60 * 1000,          // 4 timer (live = nu)
  newMembers: 7 * 24 * 60 * 60 * 1000,    // 7 dage
  matches:    48 * 60 * 60 * 1000          // 48 timer
};

function ttlSince(type) {
  var ms = NOTIF_TTL[type];
  if (!ms) return null;
  return new Date(Date.now() - ms).toISOString();
}

async function loadNotifications() {
  try {
    var myNav = _navVersion;
    localStorage.setItem('bubble_notifs_seen', new Date().toISOString());
    const list = document.getElementById('notifications-list');
    if (!list) return;
    list.innerHTML = skelCards(4);

    // Run all 6 sections in parallel — each uses its own TTL
    var [inviteHtml, dmHtml, savedByHtml, liveHtml, matchHtml, newMemberHtml] = await Promise.all([
      _notifInvites(),
      _notifUnreadDMs(),
      _notifSavedBy(),
      _notifLiveContacts(),
      _notifStrongMatches(),
      _notifNewMembers()
    ]);

    if (_navVersion !== myNav) return; // screen changed during load

    var html = inviteHtml + dmHtml + matchHtml + liveHtml + savedByHtml + newMemberHtml;
    if (!html) {
      html = '<div class="empty-state"><div class="empty-icon">' + icon('bell') + '</div><div class="empty-text">Ingen notifikationer endnu<br><span style="font-size:0.72rem;color:var(--text-secondary);font-weight:400">Gem profiler og join bobler — så ser du aktivitet her</span></div></div>';
    }
    list.innerHTML = html;
  } catch(e) { logError("loadNotifications", e); showRetryState('notifications-list', 'loadNotifications', 'Kunne ikke hente notifikationer'); }
}

// ── Notification sub-loaders (parallelized) ──
async function _notifInvites() {
  try {
    var since = ttlSince('invites');
    var q = sb.from('bubble_invitations')
      .select('id, from_user_id, bubble_id, created_at')
      .eq('to_user_id', currentUser.id)
      .eq('status', 'pending')
      .order('created_at', {ascending:false});
    if (since) q = q.gte('created_at', since);
    var { data: invites, error: invErr } = await q;
    if (invErr) { logError('_notifInvites:query', invErr); return ''; }
    if (!invites || invites.length === 0) return '';

    // Fetch profiles + bubble names separately (no FK hints)
    var fromIds = [...new Set(invites.map(function(i) { return i.from_user_id; }))];
    var bubbleIds = [...new Set(invites.map(function(i) { return i.bubble_id; }))];
    var [profRes, bubRes] = await Promise.all([
      sb.from('profiles').select('id, name, title').in('id', fromIds),
      sb.from('bubbles').select('id, name').in('id', bubbleIds)
    ]);
    var profMap = {};
    (profRes.data || []).forEach(function(p) { profMap[p.id] = p; });
    var bubMap = {};
    (bubRes.data || []).forEach(function(b) { bubMap[b.id] = b; });

    return invites.map(function(inv) {
      var p = profMap[inv.from_user_id] || {};
      var bub = bubMap[inv.bubble_id] || {};
      var initials = (p.name||'?').split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();
      return '<div class="notif-card invite" id="invite-' + inv.id + '">' +
        '<div class="notif-header">' +
        '<div class="notif-avatar" style="background:linear-gradient(135deg,#6366F1,#7C5CFC)">' + initials + '</div>' +
        '<div>' +
        '<div class="notif-title">' + icon("bubble") + ' Invitation til boble</div>' +
        '<div class="notif-sub">' + escHtml(p.name||'Nogen') + ' inviterer dig til ' + escHtml(bub.name||'en boble') + '</div>' +
        '</div></div>' +
        '<div class="notif-actions">' +
        '<button class="notif-btn accept" onclick="acceptBubbleInvite(\'' + inv.id + '\',\'' + inv.from_user_id + '\')">Accepter</button>' +
        '<button class="notif-btn decline" onclick="declineBubbleInvite(\'' + inv.id + '\')">Afvis</button>' +
        '</div></div>';
    }).join('');
  } catch(e) { logError('_notifInvites', e); return ''; }
}

async function _notifUnreadDMs() {
  try {
    var since = ttlSince('messages') || new Date(Date.now() - 30*24*60*60*1000).toISOString();
    var { data: unreadDMs } = await sb.from('messages')
      .select('id, sender_id, content, file_url, created_at')
      .eq('receiver_id', currentUser.id)
      .is('read_at', null)
      .gte('created_at', since)
      .order('created_at', {ascending:false})
      .limit(10);
    if (!unreadDMs || unreadDMs.length === 0) return '';
    var dmSenderIds = [...new Set(unreadDMs.map(function(m){return m.sender_id;}))];
    var { data: dmProfiles } = await sb.from('profiles').select('id,name,avatar_url').in('id', dmSenderIds);
    var dmPMap = {};
    (dmProfiles||[]).forEach(function(p) { dmPMap[p.id] = p; });
    var dmBySender = {};
    unreadDMs.forEach(function(m) {
      if (!dmBySender[m.sender_id]) dmBySender[m.sender_id] = { count: 0, latest: m };
      dmBySender[m.sender_id].count++;
    });
    return Object.keys(dmBySender).map(function(sid) {
      var d = dmBySender[sid];
      var p = dmPMap[sid] || {};
      var initials = (p.name||'?').split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();
      var time = new Date(d.latest.created_at).toLocaleDateString('da-DK', {day:'numeric',month:'short'});
      var preview = d.latest.file_url ? 'Sendte et billede' : (d.latest.content || '').slice(0, 40);
      var avatarHtml = p.avatar_url ?
        '<div class="notif-avatar" style="overflow:hidden"><img src="' + escHtml(p.avatar_url) + '" style="width:100%;height:100%;object-fit:cover"></div>' :
        '<div class="notif-avatar" style="background:linear-gradient(135deg,#6366F1,#7C5CFC)">' + initials + '</div>';
      return '<div class="notif-card" onclick="openChat(\'' + sid + '\',\'screen-notifications\')" style="cursor:pointer">' +
        '<div class="notif-header">' + avatarHtml +
        '<div>' +
        '<div class="notif-title">' + icon("chat") + ' ' + escHtml(p.name||'Ukendt') + (d.count > 1 ? ' (' + d.count + ' beskeder)' : '') + '</div>' +
        '<div class="notif-sub">' + escHtml(preview) + ' · ' + time + '</div>' +
        '</div></div></div>';
    }).join('');
  } catch(e) { logError('_notifUnreadDMs', e); return ''; }
}

async function _notifSavedBy() {
  try {
    var since = ttlSince('savedBy');
    var q = sb.from('saved_contacts')
      .select('user_id, created_at')
      .eq('contact_id', currentUser.id)
      .order('created_at', {ascending:false})
      .limit(10);
    if (since) q = q.gte('created_at', since);
    var { data: savedBy } = await q;
    if (!savedBy || savedBy.length === 0) return '';
    var saverIds = savedBy.map(function(s){return s.user_id;});
    var { data: saverProfiles } = await sb.from('profiles').select('id,name,avatar_url').in('id', saverIds);
    var sPMap = {};
    (saverProfiles||[]).forEach(function(p) { sPMap[p.id] = p; });
    return savedBy.map(function(s) {
      var p = sPMap[s.user_id] || {};
      var initials = (p.name||'?').split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();
      var time = new Date(s.created_at).toLocaleDateString('da-DK', {day:'numeric',month:'short'});
      var avatarHtml = p.avatar_url ?
        '<div class="notif-avatar" style="overflow:hidden"><img src="' + escHtml(p.avatar_url) + '" style="width:100%;height:100%;object-fit:cover"></div>' :
        '<div class="notif-avatar" style="background:linear-gradient(135deg,#1A9E8E,#10B981)">' + initials + '</div>';
      return '<div class="notif-card" onclick="openPerson(\'' + s.user_id + '\',\'screen-notifications\')" style="cursor:pointer">' +
        '<div class="notif-header">' + avatarHtml +
        '<div>' +
        '<div class="notif-title">' + icon("bookmark") + ' Nogen gemte din profil</div>' +
        '<div class="notif-sub">' + escHtml(p.name||'Ukendt') + ' · ' + time + '</div>' +
        '</div></div></div>';
    }).join('');
  } catch(e) { logError('_notifSavedBy', e); return ''; }
}

async function _notifLiveContacts() {
  try {
    var savedIds = await getSavedContactIds();
    if (savedIds.length === 0) return '';
    var liveCutoff = new Date(Date.now() - 4*60*60*1000).toISOString();
    var { data: liveContacts } = await sb.from('bubble_members')
      .select('user_id, bubble_id, checked_in_at, bubbles(name,location)')
      .in('user_id', savedIds)
      .not('checked_in_at', 'is', null)
      .is('checked_out_at', null)
      .gte('checked_in_at', liveCutoff)
      .order('checked_in_at', {ascending:false})
      .limit(10);
    if (!liveContacts || liveContacts.length === 0) return '';
    var liveUserIds = [...new Set(liveContacts.map(function(m){return m.user_id;}))];
    var { data: liveProfiles } = await sb.from('profiles').select('id,name,avatar_url').in('id', liveUserIds);
    var lPMap = {};
    (liveProfiles||[]).forEach(function(p) { lPMap[p.id] = p; });
    return liveContacts.map(function(m) {
      var p = lPMap[m.user_id] || {};
      var initials = (p.name||'?').split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();
      var bName = m.bubbles?.name || '';
      var bLoc = m.bubbles?.location || '';
      var avatarHtml = p.avatar_url ?
        '<div class="notif-avatar" style="overflow:hidden"><img src="' + escHtml(p.avatar_url) + '" style="width:100%;height:100%;object-fit:cover"></div>' :
        '<div class="notif-avatar" style="background:linear-gradient(135deg,#2ECFCF,#22B8CF)">' + initials + '</div>';
      return '<div class="notif-card">' +
        '<div class="notif-header">' + avatarHtml +
        '<div>' +
        '<div class="notif-title"><span style="color:var(--accent3)">' + icon("pin") + '</span> ' + escHtml(p.name||'Ukendt') + ' er live</div>' +
        '<div class="notif-sub">' + escHtml(bName) + (bLoc ? ' · ' + escHtml(bLoc) : '') + '</div>' +
        '</div></div></div>';
    }).join('');
  } catch(e) { logError('_notifLiveContacts', e); return ''; }
}

async function _notifNewMembers() {
  try {
    var since = ttlSince('newMembers');
    var { data: myMemberships } = await sb.from('bubble_members').select('bubble_id').eq('user_id', currentUser.id);
    if (!myMemberships || myMemberships.length === 0) return '';
    var myBubbleIds = myMemberships.map(function(m){return m.bubble_id;});
    var q = sb.from('bubble_members')
      .select('user_id, joined_at, bubble_id, bubbles(name)')
      .in('bubble_id', myBubbleIds).neq('user_id', currentUser.id)
      .order('joined_at', {ascending:false}).limit(20);
    if (since) q = q.gte('joined_at', since);
    var { data: newMembers } = await q;
    if (!newMembers || newMembers.length === 0) return '';
    var memberUserIds = [...new Set(newMembers.map(function(m){return m.user_id;}))];
    var { data: memberProfiles } = await sb.from('profiles').select('id,name,avatar_url').in('id', memberUserIds);
    var mPMap = {};
    (memberProfiles||[]).forEach(function(p) { mPMap[p.id] = p; });
    return newMembers.map(function(m) {
      var p = mPMap[m.user_id] || {};
      var initials = (p.name||'?').split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();
      var time = new Date(m.joined_at).toLocaleDateString('da-DK', {day:'numeric',month:'short'});
      var avatarHtml = p.avatar_url ?
        '<div class="notif-avatar" style="overflow:hidden"><img src="' + escHtml(p.avatar_url) + '" style="width:100%;height:100%;object-fit:cover"></div>' :
        '<div class="notif-avatar" style="background:linear-gradient(135deg,#2ECFCF,#7C5CFC)">' + initials + '</div>';
      return '<div class="notif-card">' +
        '<div class="notif-header">' + avatarHtml +
        '<div>' +
        '<div class="notif-title">' + escHtml(p.name||'Ukendt') + ' joined</div>' +
        '<div class="notif-sub">' + escHtml(m.bubbles?.name||'') + ' · ' + time + '</div>' +
        '</div></div></div>';
    }).join('');
  } catch(e) { logError('_notifNewMembers', e); return ''; }
}

// ── "Nyt stærkt match" — people with 80+ score who joined your bubbles recently ──
async function _notifStrongMatches() {
  try {
    var since = ttlSince('matches');
    if (!since) return '';
    if (!currentProfile || !(currentProfile.keywords || []).length) return '';

    // Get user's bubbles
    var { data: myMemberships } = await sb.from('bubble_members').select('bubble_id').eq('user_id', currentUser.id);
    if (!myMemberships || myMemberships.length === 0) return '';
    var myBubbleIds = myMemberships.map(function(m){ return m.bubble_id; });

    // Get recently joined members
    var { data: recentMembers } = await sb.from('bubble_members')
      .select('user_id, joined_at, bubble_id, bubbles(name)')
      .in('bubble_id', myBubbleIds)
      .neq('user_id', currentUser.id)
      .gte('joined_at', since)
      .order('joined_at', {ascending:false})
      .limit(30);
    if (!recentMembers || recentMembers.length === 0) return '';

    // Deduplicate
    var seen = {};
    var unique = [];
    recentMembers.forEach(function(m) {
      if (!seen[m.user_id]) { seen[m.user_id] = true; unique.push(m); }
    });

    // Get profiles
    var userIds = unique.map(function(m){ return m.user_id; });
    var { data: profiles } = await sb.from('profiles')
      .select('id, name, title, workplace, keywords, dynamic_keywords, bio, linkedin, avatar_url')
      .in('id', userIds);
    if (!profiles || profiles.length === 0) return '';

    var pMap = {};
    profiles.forEach(function(p) { pMap[p.id] = p; });

    // Score and filter for strong matches (80+)
    var strong = [];
    unique.forEach(function(m) {
      var p = pMap[m.user_id];
      if (!p) return;
      var score = (typeof calcMatchScore === 'function') ? calcMatchScore(currentProfile, p, 1) : 0;
      if (score >= 80) {
        strong.push({ member: m, profile: p, score: score });
      }
    });

    if (strong.length === 0) return '';

    // Render
    return '<div style="padding:0.5rem 0 0.2rem;font-size:0.62rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--green)">Nye stærke matches</div>' +
      strong.map(function(s) {
        var p = s.profile;
        var m = s.member;
        var initials = (p.name||'?').split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();
        var time = new Date(m.joined_at).toLocaleDateString('da-DK', {day:'numeric',month:'short'});
        var myKw = (currentProfile.keywords || []).map(function(k){ return k.toLowerCase(); });
        var theirKw = (p.keywords || []).map(function(k){ return k.toLowerCase(); });
        var shared = myKw.filter(function(k){ return theirKw.indexOf(k) >= 0; }).slice(0, 3);
        var sharedHtml = shared.length > 0 ? '<div style="display:flex;gap:0.2rem;flex-wrap:wrap;margin-top:0.2rem">' +
          shared.map(function(t){ return '<span style="font-size:0.55rem;padding:0.1rem 0.35rem;background:rgba(26,158,142,0.08);color:var(--green);border-radius:99px;font-weight:600">' + escHtml(t) + '</span>'; }).join('') + '</div>' : '';
        var avatarHtml = p.avatar_url ?
          '<div class="notif-avatar" style="overflow:hidden;border:2px solid rgba(26,158,142,0.3)"><img src="' + escHtml(p.avatar_url) + '" style="width:100%;height:100%;object-fit:cover"></div>' :
          '<div class="notif-avatar" style="background:linear-gradient(135deg,#1A9E8E,#10B981);border:2px solid rgba(26,158,142,0.3)">' + initials + '</div>';
        return '<div class="notif-card" onclick="openPerson(\'' + p.id + '\',\'screen-notifications\')" style="cursor:pointer;border-left:3px solid var(--green)">' +
          '<div class="notif-header">' + avatarHtml +
          '<div style="flex:1;min-width:0">' +
          '<div class="notif-title" style="display:flex;align-items:center;gap:0.3rem">' + escHtml(p.name||'Ukendt') + ' <span style="font-size:0.58rem;font-weight:700;color:var(--green);background:rgba(26,158,142,0.08);padding:0.1rem 0.35rem;border-radius:6px">Stærkt match</span></div>' +
          '<div class="notif-sub">' + escHtml(p.title || '') + (p.workplace ? ' · ' + escHtml(p.workplace) : '') + ' · ' + escHtml(m.bubbles?.name||'') + ' · ' + time + '</div>' +
          sharedHtml +
          '</div></div></div>';
      }).join('');
  } catch(e) { logError('_notifStrongMatches', e); return ''; }
}

function acceptBubbleInvite(inviteId, fromUserId) {
  var card = document.getElementById('invite-' + inviteId);
  if (!card) return;
  var existing = card.querySelector('.notif-inv-confirm');
  if (existing) { existing.remove(); return; }
  var tray = document.createElement('div');
  tray.className = 'notif-inv-confirm';
  tray.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:0.4rem 0.5rem;margin-top:0.4rem;background:rgba(26,158,142,0.06);border:1px solid rgba(26,158,142,0.15);border-radius:10px';
  tray.innerHTML = '<span style="font-size:0.72rem;color:var(--text-secondary)">Join denne boble?</span>' +
    '<div style="display:flex;gap:0.25rem">' +
    '<button style="font-size:0.72rem;padding:0.3rem 0.65rem;background:var(--gradient-primary);color:white;border:none;border-radius:8px;cursor:pointer;font-family:inherit;font-weight:700" onclick="confirmAcceptInvite(\'' + inviteId + '\')">Ja, join</button>' +
    '<button style="font-size:0.72rem;padding:0.3rem 0.65rem;background:none;color:var(--muted);border:1px solid var(--glass-border);border-radius:8px;cursor:pointer;font-family:inherit" onclick="this.closest(\'.notif-inv-confirm\').remove()">Annuller</button>' +
    '</div>';
  card.appendChild(tray);
}

async function confirmAcceptInvite(inviteId) {
  try {
    await sb.from('bubble_invitations').update({status:'accepted'}).eq('id', inviteId);
    const { data: inv } = await sb.from('bubble_invitations').select('bubble_id').eq('id', inviteId).single();
    if (inv?.bubble_id) {
      await sb.from('bubble_members').insert({bubble_id: inv.bubble_id, user_id: currentUser.id});
      showSuccessToast('Du er nu med i boblen!');
      loadNotifications();
      setTimeout(() => openBubbleChat(inv.bubble_id, 'screen-notifications'), 800);
    }
  } catch(e) { logError("confirmAcceptInvite", e); showToast(e.message || "Ukendt fejl"); }
}

function declineBubbleInvite(inviteId) {
  var card = document.getElementById('invite-' + inviteId);
  if (!card) return;
  var existing = card.querySelector('.notif-inv-confirm');
  if (existing) { existing.remove(); return; }
  var tray = document.createElement('div');
  tray.className = 'notif-inv-confirm';
  tray.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:0.4rem 0.5rem;margin-top:0.4rem;background:rgba(232,121,168,0.06);border:1px solid rgba(232,121,168,0.15);border-radius:10px';
  tray.innerHTML = '<span style="font-size:0.72rem;color:var(--text-secondary)">Afvis invitation?</span>' +
    '<div style="display:flex;gap:0.25rem">' +
    '<button style="font-size:0.72rem;padding:0.3rem 0.65rem;background:rgba(232,121,168,0.12);color:var(--accent2);border:1px solid rgba(232,121,168,0.25);border-radius:8px;cursor:pointer;font-family:inherit;font-weight:700" onclick="confirmDeclineInvite(\'' + inviteId + '\')">Ja, afvis</button>' +
    '<button style="font-size:0.72rem;padding:0.3rem 0.65rem;background:none;color:var(--muted);border:1px solid var(--glass-border);border-radius:8px;cursor:pointer;font-family:inherit" onclick="this.closest(\'.notif-inv-confirm\').remove()">Annuller</button>' +
    '</div>';
  card.appendChild(tray);
}

async function confirmDeclineInvite(inviteId) {
  try {
    await sb.from('bubble_invitations').update({status:'declined'}).eq('id', inviteId);
    var card = document.getElementById('invite-' + inviteId);
    if (card) { card.style.transition = 'opacity 0.2s'; card.style.opacity = '0'; setTimeout(function() { card.remove(); }, 200); }
    showToast('Invitation afvist');
  } catch(e) { logError("confirmDeclineInvite", e); showToast(e.message || "Ukendt fejl"); }
}
}


// ══════════════════════════════════════════════════════════
//  PUSH NOTIFICATIONS
// ══════════════════════════════════════════════════════════

async function initPushNotifications() {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.debug('Push not supported');
      return;
    }

    // Register service worker
    var registration = await navigator.serviceWorker.register('./sw.js');
    console.debug('SW registered:', registration.scope);

    // Check if already subscribed
    var subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      // Already subscribed — save to DB in case it changed
      await savePushSubscription(subscription);
      return;
    }

    // Don't auto-prompt — wait for user action
    // The prompt will be shown via requestPushPermission()
  } catch(e) {
    logError('initPushNotifications', e);
  }
}

function showAddToHomescreenSheet() {
  var existing = document.getElementById('add-homescreen-sheet');
  if (existing) existing.remove();
  var sheet = document.createElement('div');
  sheet.id = 'add-homescreen-sheet';
  sheet.className = 'modal-overlay';
  sheet.style.cssText = 'display:flex;align-items:flex-end';
  sheet.innerHTML = '<div class="modal-sheet" style="padding-bottom:max(1.5rem,env(safe-area-inset-bottom))">'
    + '<div class="modal-handle"></div>'
    + '<div style="font-size:1.5rem;text-align:center;margin-bottom:0.5rem">📲</div>'
    + '<div class="modal-title" style="text-align:center">Tilføj Bubble til hjemmeskærmen</div>'
    + '<p style="color:var(--muted);font-size:0.85rem;margin:0.5rem 0 1rem;text-align:center;line-height:1.5">På iPhone kræver push-notifikationer at Bubble er installeret som app. Det tager 10 sekunder.</p>'
    + '<ol style="color:var(--text);font-size:0.85rem;line-height:2;padding-left:1.25rem;margin-bottom:1.25rem">'
    + '<li>Tryk på <strong>Del-ikonet</strong> nederst i Safari (' + String.fromCodePoint(0x1F4E4) + ')</li>'
    + '<li>Vælg <strong>"Føj til hjemmeskærm"</strong></li>'
    + '<li>Tryk <strong>Tilføj</strong> øverst til højre</li>'
    + '<li>Åbn Bubble fra hjemmeskærmen og aktivér notifikationer</li>'
    + '</ol>'
    + '<button class="btn-primary" onclick="this.closest(\'[id=add-homescreen-sheet]\').remove()">Forstået</button>'
    + '</div>';
  sheet.onclick = function(e) { if (e.target === sheet) sheet.remove(); };
  document.body.appendChild(sheet);
}

function showPushBlockedSheet() {
  var isIOS = /iP(hone|ad|od)/.test(navigator.userAgent);
  var isAndroid = /Android/.test(navigator.userAgent);
  var steps = '';
  if (isIOS) {
    steps = '<li>Gå til <strong>Indstillinger → Safari</strong></li><li>Tryk på <strong>Avanceret → Websteder → Notifikationer</strong></li><li>Find Bubble og sæt til <strong>Tillad</strong></li>';
  } else if (isAndroid) {
    steps = '<li>Gå til <strong>Indstillinger → Apps → din browser</strong></li><li>Tryk på <strong>Notifikationer → Webstedsnotifikationer</strong></li><li>Find Bubble og aktivér</li>';
  } else {
    steps = '<li>Klik på <strong>hængelåsikonet</strong> i adresselinjen</li><li>Find <strong>Notifikationer</strong> og sæt til Tillad</li><li>Genindlæs siden</li>';
  }
  var existing = document.getElementById('push-blocked-sheet');
  if (existing) existing.remove();
  var sheet = document.createElement('div');
  sheet.id = 'push-blocked-sheet';
  sheet.className = 'modal-overlay';
  sheet.style.cssText = 'display:flex;align-items:flex-end';
  sheet.innerHTML = '<div class="modal-sheet" style="padding-bottom:max(1.5rem,env(safe-area-inset-bottom))">'
    + '<div class="modal-handle"></div>'
    + '<div style="font-size:1.5rem;text-align:center;margin-bottom:0.5rem">🔔</div>'
    + '<div class="modal-title" style="text-align:center">Notifikationer er blokeret</div>'
    + '<p style="color:var(--muted);font-size:0.85rem;margin:0.5rem 0 1rem;text-align:center;line-height:1.5">Du har tidligere afvist notifikationer. Din browser tillader ikke at vi spørger igen — du skal slå det til manuelt.</p>'
    + '<ol style="color:var(--text);font-size:0.85rem;line-height:1.8;padding-left:1.25rem;margin-bottom:1.25rem">' + steps + '</ol>'
    + '<button class="btn-primary" onclick="document.getElementById(\'push-blocked-sheet\').remove()">Forstået</button>'
    + '</div>';
  sheet.onclick = function(e) { if (e.target === sheet) sheet.remove(); };
  document.body.appendChild(sheet);
}

async function requestPushPermission() {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      showToast('Push-notifikationer understøttes ikke på denne enhed');
      return false;
    }

    // iOS kræver at appen er installeret som PWA for push
    var isIOS = /iP(hone|ad|od)/.test(navigator.userAgent);
    var isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
    if (isIOS && !isStandalone) {
      showAddToHomescreenSheet();
      return false;
    }

    // Tjek om allerede blokeret — browser spørger ikke igen
    if (Notification.permission === 'denied') {
      showPushBlockedSheet();
      return false;
    }

    var permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      showPushBlockedSheet();
      return false;
    }

    var registration = await navigator.serviceWorker.ready;

    // Subscribe to push
    // NOTE: Replace this VAPID key with your own from https://web-push-codelab.glitch.me/
    var VAPID_PUBLIC_KEY = 'BH1bjuFEH_rjDqiwRgT59P55QHttJfEUhOWnIqMobE_YbFS6sQUYajtlFlTJ0dkm1drf0Y-zRUBYaW0WwopzOdA';

    var subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });

    await savePushSubscription(subscription);
    showToast('Notifikationer aktiveret!');
    trackEvent('push_enabled');
    return true;
  } catch(e) {
    logError('requestPushPermission', e);
    showToast('Kunne ikke aktivere notifikationer');
    return false;
  }
}

async function savePushSubscription(subscription) {
  try {
    var sub = subscription.toJSON();
    await sb.from('push_subscriptions').upsert({
      user_id: currentUser.id,
      endpoint: sub.endpoint,
      p256dh: sub.keys?.p256dh || '',
      auth: sub.keys?.auth || '',
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });
  } catch(e) {
    logError('savePushSubscription', e);
  }
}

function setPushBtnActive(btn) {
  if (!btn) return;
  btn.innerHTML = icon('bell') + ' Aktiveret';
  btn.style.background = 'rgba(46,207,207,0.15)';
  btn.style.borderColor = 'rgba(46,207,207,0.5)';
  btn.style.color = 'var(--accent3)';
}
function setPushBtnInactive(btn) {
  if (!btn) return;
  btn.innerHTML = icon('bell') + ' Aktivér';
  btn.style.background = 'rgba(30,27,46,0.035)';
  btn.style.borderColor = 'var(--glass-border)';
  btn.style.color = 'var(--muted)';
}

async function togglePushNotifications() {
  var btn = document.getElementById('push-toggle-btn');
  if (!btn) return;

  // Check if already subscribed
  if ('serviceWorker' in navigator && 'PushManager' in window) {
    var reg = await navigator.serviceWorker.ready;
    var sub = await reg.pushManager.getSubscription();
    if (sub) {
      // Unsubscribe
      await sub.unsubscribe();
      await sb.from('push_subscriptions').delete().eq('user_id', currentUser.id);
      setPushBtnInactive(btn);
      showToast('Notifikationer deaktiveret');
      trackEvent('push_disabled');
      return;
    }
  }

  // Subscribe
  var success = await requestPushPermission();
  if (success) {
    setPushBtnActive(btn);
  }
}

// Update push button state on settings load
async function updatePushButtonState() {
  var btn = document.getElementById('push-toggle-btn');
  if (!btn) return;
  try {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      var reg = await navigator.serviceWorker.ready;
      var sub = await reg.pushManager.getSubscription();
      if (sub) { setPushBtnActive(btn); return; }
    }
    setPushBtnInactive(btn);
  } catch(e) { setPushBtnInactive(btn); }
}

function urlBase64ToUint8Array(base64String) {
  var padding = '='.repeat((4 - base64String.length % 4) % 4);
  var base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  var rawData = atob(base64);
  var arr = new Uint8Array(rawData.length);
  for (var i = 0; i < rawData.length; ++i) arr[i] = rawData.charCodeAt(i);
  return arr;
}


