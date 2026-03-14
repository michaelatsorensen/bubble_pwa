// ══════════════════════════════════════════════════════════
//  BUBBLE — NOTIFICATIONS + PUSH
//  Auto-split from app.js · v3.7.0
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
//  BOOT
// ══════════════════════════════════════════════════════════
async function loadNotifications() {
  try {
    var myNav = _navVersion;
    localStorage.setItem('bubble_notifs_seen', new Date().toISOString());
    const list = document.getElementById('notifications-list');
    if (!list) return;
    list.innerHTML = skelCards(4);

    var since30d = new Date(Date.now() - 30*24*60*60*1000).toISOString();
    var since7d = new Date(Date.now() - 7*24*60*60*1000).toISOString();

    // Run all 5 sections in parallel — each returns an HTML string
    var [inviteHtml, dmHtml, savedByHtml, liveHtml, newMemberHtml] = await Promise.all([
      _notifInvites(),
      _notifUnreadDMs(since7d),
      _notifSavedBy(since30d),
      _notifLiveContacts(),
      _notifNewMembers(since30d)
    ]);

    if (_navVersion !== myNav) return; // screen changed during load

    var html = inviteHtml + dmHtml + savedByHtml + liveHtml + newMemberHtml;
    if (!html) {
      html = '<div class="empty-state"><div class="empty-icon">' + icon('bell') + '</div><div class="empty-text">Ingen notifikationer endnu<br><span style="font-size:0.72rem;color:var(--text-secondary);font-weight:400">Gem profiler og join bobler — så ser du aktivitet her</span></div></div>';
    }
    list.innerHTML = html;
  } catch(e) { logError("loadNotifications", e); showRetryState('notifications-list', 'loadNotifications', 'Kunne ikke hente notifikationer'); }
}

// ── Notification sub-loaders (parallelized) ──
async function _notifInvites() {
  try {
    var { data: invites } = await sb.from('bubble_invitations')
      .select('id, from_user_id, bubble_id, created_at, profiles!bubble_invitations_from_user_id_fkey(name,title), bubbles(name)')
      .eq('to_user_id', currentUser.id)
      .eq('status', 'pending')
      .order('created_at', {ascending:false});
    if (!invites || invites.length === 0) return '';
    return invites.map(function(inv) {
      var p = inv.profiles || {};
      var initials = (p.name||'?').split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();
      return '<div class="notif-card invite" id="invite-' + inv.id + '">' +
        '<div class="notif-header">' +
        '<div class="notif-avatar" style="background:linear-gradient(135deg,#3AAA88,#2A7A90)">' + initials + '</div>' +
        '<div>' +
        '<div class="notif-title">' + icon("bubble") + ' Invitation til boble</div>' +
        '<div class="notif-sub">' + escHtml(p.name||'Nogen') + ' inviterer dig til ' + escHtml(inv.bubbles?.name||'en boble') + '</div>' +
        '</div></div>' +
        '<div class="notif-actions">' +
        '<button class="notif-btn accept" onclick="acceptBubbleInvite(\'' + inv.id + '\',\'' + inv.from_user_id + '\')">Accepter</button>' +
        '<button class="notif-btn decline" onclick="declineBubbleInvite(\'' + inv.id + '\')">Afvis</button>' +
        '</div></div>';
    }).join('');
  } catch(e) { logError('_notifInvites', e); return ''; }
}

async function _notifUnreadDMs(since) {
  try {
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
        '<div class="notif-avatar" style="background:linear-gradient(135deg,#3AAA88,#2A7A90)">' + initials + '</div>';
      return '<div class="notif-card" onclick="openChat(\'' + sid + '\',\'screen-notifications\')" style="cursor:pointer">' +
        '<div class="notif-header">' + avatarHtml +
        '<div>' +
        '<div class="notif-title">' + icon("chat") + ' ' + escHtml(p.name||'Ukendt') + (d.count > 1 ? ' (' + d.count + ' beskeder)' : '') + '</div>' +
        '<div class="notif-sub">' + escHtml(preview) + ' · ' + time + '</div>' +
        '</div></div></div>';
    }).join('');
  } catch(e) { logError('_notifUnreadDMs', e); return ''; }
}

async function _notifSavedBy(since) {
  try {
    var { data: savedBy } = await sb.from('saved_contacts')
      .select('user_id, created_at')
      .eq('contact_id', currentUser.id)
      .gte('created_at', since)
      .order('created_at', {ascending:false})
      .limit(10);
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
        '<div class="notif-avatar" style="background:linear-gradient(135deg,#10B981,#065F46)">' + initials + '</div>';
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
        '<div class="notif-avatar" style="background:linear-gradient(135deg,#2ECFCF,#065F46)">' + initials + '</div>';
      return '<div class="notif-card">' +
        '<div class="notif-header">' + avatarHtml +
        '<div>' +
        '<div class="notif-title"><span style="color:var(--accent3)">' + icon("pin") + '</span> ' + escHtml(p.name||'Ukendt') + ' er live</div>' +
        '<div class="notif-sub">' + escHtml(bName) + (bLoc ? ' · ' + escHtml(bLoc) : '') + '</div>' +
        '</div></div></div>';
    }).join('');
  } catch(e) { logError('_notifLiveContacts', e); return ''; }
}

async function _notifNewMembers(since) {
  try {
    var { data: myMemberships } = await sb.from('bubble_members').select('bubble_id').eq('user_id', currentUser.id);
    if (!myMemberships || myMemberships.length === 0) return '';
    var myBubbleIds = myMemberships.map(function(m){return m.bubble_id;});
    var { data: newMembers } = await sb.from('bubble_members')
      .select('user_id, joined_at, bubble_id, bubbles(name)')
      .in('bubble_id', myBubbleIds).neq('user_id', currentUser.id)
      .gte('joined_at', since).order('joined_at', {ascending:false}).limit(20);
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
        '<div class="notif-avatar" style="background:linear-gradient(135deg,#2ECFCF,#2E9E8E)">' + initials + '</div>';
      return '<div class="notif-card">' +
        '<div class="notif-header">' + avatarHtml +
        '<div>' +
        '<div class="notif-title">' + escHtml(p.name||'Ukendt') + ' joined</div>' +
        '<div class="notif-sub">' + escHtml(m.bubbles?.name||'') + ' · ' + time + '</div>' +
        '</div></div></div>';
    }).join('');
  } catch(e) { logError('_notifNewMembers', e); return ''; }
}

async function acceptBubbleInvite(inviteId, fromUserId) {
  try {
    // Update invitation status
    await sb.from('bubble_invitations').update({status:'accepted'}).eq('id', inviteId);
    // Get the bubble_id from invitation
    const { data: inv } = await sb.from('bubble_invitations').select('bubble_id').eq('id', inviteId).single();
    if (inv?.bubble_id) {
      // Add to bubble_members
      await sb.from('bubble_members').insert({bubble_id: inv.bubble_id, user_id: currentUser.id});
      showToast('🫧 Du er nu med i boblen!');
      loadNotifications();
      // Open the bubble chat
      setTimeout(() => openBubbleChat(inv.bubble_id, 'screen-notifications'), 800);
    }
  } catch(e) { logError("acceptBubbleInvite", e); showToast(e.message || "Ukendt fejl"); }
}

async function declineBubbleInvite(inviteId) {
  try {
    await sb.from('bubble_invitations').update({status:'declined'}).eq('id', inviteId);
    document.getElementById('invite-' + inviteId)?.remove();
    showToast('Invitation afvist');
  } catch(e) { logError("declineBubbleInvite", e); showToast(e.message || "Ukendt fejl"); }
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
  btn.style.background = 'rgba(255,255,255,0.05)';
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


