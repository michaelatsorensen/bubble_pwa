// ══════════════════════════════════════════════════════════
//  BUBBLE — GLOBAL REALTIME HUB + DM CHAT
//  DOMAIN: realtime
//  OWNS: _globalRtChannels, chatSubscription, currentChatUser, currentChatName
//  OWNS: initGlobalRealtime, rtHandleMemberChange, openChat, loadMessages
//  OWNS: _rtState, rtSetState, rtReconnect (connection lifecycle)
//  READS: currentUser, currentLiveBubble, bcBubbleId, _homeMode, _homeRadarFilter
//  Auto-split from app.js · v3.7.0
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
//  CONNECTION STATE + RECONNECT
//  States: connected | disconnected | reconnecting
//  Banner shows when not connected. Auto-hides 2s after reconnect.
// ══════════════════════════════════════════════════════════
var _rtState = 'connected';
var _rtReconnectTimer = null;
var _rtReconnectAttempt = 0;
var _rtReconnectMax = 10;
var _rtChannelStates = {};

function rtSetState(newState) {
  if (_rtState === newState) return;
  var prev = _rtState;
  _rtState = newState;
  console.debug('[rt] state:', prev, '→', newState);

  var dot = document.getElementById('rt-status-dot');
  var text = document.getElementById('rt-status-text');
  if (!dot || !text) return;

  if (newState === 'disconnected') {
    dot.style.background = '#D06070';
    text.textContent = 'Afbrudt — genopretter...';
    text.style.color = '#D06070';
  } else if (newState === 'reconnecting') {
    dot.style.background = '#F59E0B';
    text.textContent = 'Genopretter... (forsøg ' + _rtReconnectAttempt + ')';
    text.style.color = '#92400E';
  } else if (newState === 'connected') {
    dot.style.background = '#1A9E8E';
    text.textContent = 'Forbundet';
    text.style.color = '';
    _rtReconnectAttempt = 0;
  }
}

function _rtEvalState() {
  var states = Object.values(_rtChannelStates);
  if (states.length === 0) return;
  var subscribed = states.filter(function(s) { return s === 'SUBSCRIBED'; }).length;
  var errored = states.filter(function(s) { return s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED'; }).length;

  if (subscribed === states.length) {
    rtSetState('connected');
  } else if (errored > 0 && subscribed === 0) {
    rtSetState('disconnected');
    _rtScheduleReconnect();
  } else if (errored > 0) {
    rtSetState('reconnecting');
    _rtScheduleReconnect();
  }
}

function _rtScheduleReconnect() {
  if (_rtReconnectTimer) return;
  if (_rtReconnectAttempt >= _rtReconnectMax) {
    console.warn('[rt] max reconnect attempts reached');
    var text = document.getElementById('rt-status-text');
    if (text) { text.textContent = 'Ikke forbundet'; text.style.color = '#D06070'; }
    return;
  }
  var delay = Math.min(2000 * Math.pow(2, _rtReconnectAttempt), 30000);
  _rtReconnectAttempt++;
  rtSetState('reconnecting');
  console.debug('[rt] reconnect in', delay, 'ms (attempt', _rtReconnectAttempt, ')');
  _rtReconnectTimer = setTimeout(function() {
    _rtReconnectTimer = null;
    rtReconnect();
  }, delay);
}

function rtReconnect() {
  console.debug('[rt] reconnecting...');
  if (!currentUser) return;
  rtUnsubscribeAll();
  _rtChannelStates = {};
  initGlobalRealtime();
  // Re-subscribe DM chat if open
  if (chatSubscription && currentChatUser) subscribeToChat();
  // Re-subscribe bubble chat if open
  if (typeof bcSubscription !== 'undefined' && bcSubscription && typeof bcBubbleId !== 'undefined' && bcBubbleId) {
    if (typeof bcSubscribeRealtime === 'function') bcSubscribeRealtime();
  }
}

// Subscribe status callback — shared by all channels
function _rtStatusCallback(channelName) {
  return function(status) {
    console.debug('[rt] channel', channelName, ':', status);
    _rtChannelStates[channelName] = status;
    _rtEvalState();
  };
}

// Browser online/offline — fast path for network changes
window.addEventListener('online', function() {
  console.debug('[rt] browser online');
  if (_rtState !== 'connected') {
    _rtReconnectAttempt = 0;
    clearTimeout(_rtReconnectTimer);
    _rtReconnectTimer = null;
    rtReconnect();
  }
});
window.addEventListener('offline', function() {
  console.debug('[rt] browser offline');
  rtSetState('disconnected');
});

// ══════════════════════════════════════════════════════════
//  GLOBAL REALTIME HUB
//  Kanal 1: messages       → nav badge + conv liste preview
//  Kanal 2: bubble_members → live-boble kort + bc-members
//  Kanal 3: invitations    → notif badge + notif-skærm
//  Kanal 4: saved_contacts → notif badge
//  Kanal 5: checkin        → broadcast greeting
// ══════════════════════════════════════════════════════════

var _globalRtChannels = [];
var _radarRefreshTimer = null;
var _radarScreenActive = false;

// ── Teardown: only b-realtime owns this cleanup ──
function rtUnsubscribeAll() {
  _globalRtChannels.forEach(function(ch) { try { ch.unsubscribe(); } catch(e) {} });
  _globalRtChannels = [];
  _rtChannelStates = {};
  if (_rtReconnectTimer) { clearTimeout(_rtReconnectTimer); _rtReconnectTimer = null; }
  rtStopRadarPolling();
}

// ── Helpers: instant badge manipulation (no DB query needed) ──
function dmBadgeGet() {
  var el = document.querySelector('.msg-unread-badge');
  return el ? (parseInt(el.textContent) || 0) : 0;
}
function dmBadgeSet(n) {
  document.querySelectorAll('.msg-unread-badge').forEach(function(b) {
    if (n > 0) { b.textContent = n > 9 ? '9+' : String(n); b.style.display = 'flex'; }
    else { b.style.display = 'none'; }
  });
}
function dmBadgeIncrement() { dmBadgeSet(dmBadgeGet() + 1); }
function dmBadgeClear()     { dmBadgeSet(0); }

function notifBadgeGet() {
  var el = document.getElementById('topbar-notif-badge');
  return el ? (parseInt(el.textContent) || 0) : 0;
}
function notifBadgeSet(n) {
  var el = document.getElementById('topbar-notif-badge');
  if (!el) return;
  if (n > 0) { el.textContent = n > 9 ? '9+' : String(n); el.style.display = 'flex'; }
  else { el.style.display = 'none'; }
}
function notifBadgeIncrement() { notifBadgeSet(notifBadgeGet() + 1); }

// ── Conversations list: update preview row without full reload ──
function rtUpdateConversationPreview(msg) {
  var list = document.getElementById('conversations-list');
  if (!list) return;
  var partnerId = msg.sender_id === currentUser.id ? msg.receiver_id : msg.sender_id;
  var row = list.querySelector('[data-conv-id="' + partnerId + '"]');
  if (row) {
    // Update preview text + unread dot
    var preview = row.querySelector('.fs-078');
    if (preview) preview.textContent = msg.content || '';
    var isUnread = msg.receiver_id === currentUser.id && !msg.read_at;
    if (isUnread && !row.querySelector('.live-dot')) {
      var dot = document.createElement('div');
      dot.className = 'live-dot';
      row.appendChild(dot);
      row.querySelector('.fw-600, .fw-700')?.classList.replace('fw-600', 'fw-700');
    }
    // Move row to top
    list.prepend(row);
  } else {
    // New conversation — reload list
    if (document.getElementById('screen-messages')?.classList.contains('active')) {
      loadMessages();
    }
  }
}

// ── Live bubble card: fast update on check-in/out ──
function rtHandleMemberChange(payload) {
  var m = payload.new || payload.old;
  if (!m) return;

  // If it's MY check-in/out → refresh live status + home banner + show toast
  if (m.user_id === currentUser.id) {
    loadLiveBubbleStatus().then(function() {
      // Auto-activate live filter on home radar when I check in
      if (m.checked_in_at && !m.checked_out_at) {
        if (document.getElementById('screen-home')?.classList.contains('active')) {
          if (typeof filterRadarHome === 'function' && (window._liveCheckedInIds || []).length > 0) {
            filterRadarHome('live');
          }
        }
      }
    });
    if (document.getElementById('screen-home')?.classList.contains('active')) {
      loadLiveBanner();
    }
    // Show check-in confirmation to the user who was scanned in
    if (m.checked_in_at && !m.checked_out_at) {
      sb.from('bubbles').select('name').eq('id', m.bubble_id).maybeSingle().then(function(r) {
        if (r.data) showSuccessToast('Du er checket ind i ' + r.data.name + ' — velkommen! ✓');
      }).catch(function() {});
    }
    return;
  }

  // If bc chat is open for this bubble → reload members tab
  if (bcBubbleId && m.bubble_id === bcBubbleId) {
    bcLoadMembers();
  }

  // If it's in MY current live bubble → update member count + radar
  if (currentLiveBubble && m.bubble_id === currentLiveBubble.bubble_id) {
    loadLiveBubbleStatus().then(function() {
      // Re-render home radar if live filter is active
      if (document.getElementById('screen-home')?.classList.contains('active') &&
          typeof _homeRadarFilter !== 'undefined' && _homeRadarFilter === 'live') {
        renderHomeDartboard();
      }
    });
    // Re-render dartboard if in live mode
    if (typeof _homeMode !== 'undefined' && _homeMode === 'live') {
      loadEventDartboard();
    }
  }
}

// ── Radar: soft refresh when screen is active ──
function rtStartRadarPolling() {
  rtStopRadarPolling(); // clear old interval first
  _radarScreenActive = true; // set flag AFTER stop (stop resets it)
  _radarRefreshTimer = setInterval(function() {
    if (!_radarScreenActive) { rtStopRadarPolling(); return; }
    if (!document.hidden) {
      console.debug('[rt] radar soft refresh');
      if (typeof _homeMode !== 'undefined' && _homeMode === 'live') {
        // In live mode: refresh event dartboard + live status
        loadLiveBubbleStatus();
        loadEventDartboard();
      } else {
        loadProximityMap();
      }
    }
  }, 20000);
}
function rtStopRadarPolling() {
  _radarScreenActive = false;
  if (_radarRefreshTimer) { clearInterval(_radarRefreshTimer); _radarRefreshTimer = null; }
}

// ── Main init ──
function initGlobalRealtime() {
  // Clean up previous channels
  _globalRtChannels.forEach(function(ch) { try { ch.unsubscribe(); } catch(e) {} });
  _globalRtChannels = [];

  // ── Kanal 1: Indkommende beskeder ──
  var chMessages = sb.channel('rt-messages-' + currentUser.id)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages',
      filter: 'receiver_id=eq.' + currentUser.id }, function(payload) {
      var m = payload.new;
      if (!m) return;

      // Nav badge: instant increment (no DB roundtrip)
      var messagesScreenActive = document.getElementById('screen-messages')?.classList.contains('active');
      var chatScreenActive = document.getElementById('screen-chat')?.classList.contains('active');
      var chatIsOpenWithSender = chatScreenActive && currentChatUser === m.sender_id;

      if (!chatIsOpenWithSender) {
        // Invalidate → recount from DB (handles missed events, drift)
        updateUnreadBadge();
      }

      // Update conversations preview instantly
      rtUpdateConversationPreview(m);

      // If messages screen is open → update list
      if (messagesScreenActive) loadMessages();
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages',
      filter: 'sender_id=eq.' + currentUser.id }, function(payload) {
      var m = payload.new;
      // read_at just got set → update ✓✓ in open DM
      if (m && m.read_at) dmUpdateReceipts([m.id]);
    })
    .subscribe(_rtStatusCallback('rt-messages'));
  _globalRtChannels.push(chMessages);

  // ── Kanal 2: Boble-medlemmer — filter på user_id så RLS virker ──
  var chMembers = sb.channel('rt-members-' + currentUser.id)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bubble_members',
      filter: 'user_id=eq.' + currentUser.id },
      function(payload) { rtHandleMemberChange(payload); })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'bubble_members',
      filter: 'user_id=eq.' + currentUser.id },
      function(payload) { rtHandleMemberChange(payload); })
    .subscribe(_rtStatusCallback('rt-members'));
  _globalRtChannels.push(chMembers);

  // ── Kanal 3: Invitationer ──
  var chInvites = sb.channel('rt-invites-' + currentUser.id)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bubble_invitations',
      filter: 'to_user_id=eq.' + currentUser.id }, function() {
      updateNotifNavBadge(); // recount from DB
      if (document.getElementById('screen-notifications')?.classList.contains('active')) {
        loadNotifications();
      }
    })
    .subscribe(_rtStatusCallback('rt-invites'));
  _globalRtChannels.push(chInvites);

  // ── Kanal 4: Gemte kontakter (nogen gemte dig) ──
  var chSaved = sb.channel('rt-saved-' + currentUser.id)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'saved_contacts',
      filter: 'contact_id=eq.' + currentUser.id }, function() {
      updateNotifNavBadge(); // recount from DB
      if (document.getElementById('screen-notifications')?.classList.contains('active')) {
        loadNotifications();
      }
    })
    .subscribe(_rtStatusCallback('rt-saved'));
  _globalRtChannels.push(chSaved);

  // ── Kanal 5: Check-in broadcast (bypasses RLS — direct user notification) ──
  var chCheckin = sb.channel('checkin-notify-' + currentUser.id)
    .on('broadcast', { event: 'checkin' }, function(msg) {
      var data = msg.payload || {};
      showSuccessToast('Du er checket ind i ' + (data.bubbleName || 'et event') + ' — velkommen! ✓');
      // Refresh live status so home banner + radar update
      loadLiveBubbleStatus().then(function() {
        if (document.getElementById('screen-home')?.classList.contains('active')) {
          loadLiveBanner();
        }
      });
    })
    .subscribe(_rtStatusCallback('rt-checkin'));
  _globalRtChannels.push(chCheckin);
}


var _messagesLoading = false;
async function loadMessages() {
  if (_messagesLoading) return;
  _messagesLoading = true;
  try {
    var myNav = _navVersion;
    const list = document.getElementById('conversations-list');
    list.innerHTML = skelCards(5);

    const { data: convs } = await sb.from('messages')
      .select('*')
      .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
      .order('created_at', {ascending:false})
      .limit(200);

    if (_navVersion !== myNav) return;

    if (!convs || convs.length === 0) {
      list.innerHTML = '<div class="empty-state"><div class="empty-icon">' + icon('chat') + '</div><div class="empty-text">Ingen beskeder endnu</div><div style="margin-top:1rem"><button class="btn-primary" onclick="goTo(\'screen-home\')" style="font-size:0.82rem;padding:0.6rem 1.5rem">Find folk på radaren →</button></div></div>';
      return;
    }

    const partnerMap = new Map();
    for (const m of convs) {
      const partnerId = m.sender_id === currentUser.id ? m.receiver_id : m.sender_id;
      if (partnerId === currentUser.id) continue;
      if (isBlocked(partnerId)) continue;
      if (!partnerMap.has(partnerId)) {
        partnerMap.set(partnerId, { partnerId, lastMsg: m });
      }
    }
    const partners = Array.from(partnerMap.values());

    const pIds = partners.map(p => p.partnerId);
    const { data: profiles } = await sb.from('profiles').select('id,name,title,avatar_url').in('id', pIds);
    if (_navVersion !== myNav) return;
    const profileMap = Object.fromEntries((profiles||[]).map(p=>[p.id,p]));

    list.innerHTML = partners.map(({ partnerId, lastMsg }) => {
      const p = profileMap[partnerId] || {};
      const initials = (p.name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
      const isUnread = lastMsg.receiver_id === currentUser.id && !lastMsg.read_at;
      const isMine = lastMsg.sender_id === currentUser.id;
      const previewText = lastMsg.file_url ? '📎 Billede' : escHtml((lastMsg.content||'').slice(0,50));
      const preview = isMine ? '<span style="color:var(--muted)">Du:</span> ' + previewText : previewText;
      const time = timeAgo(lastMsg.created_at);
      const convAvatar = p.avatar_url ?
        '<div class="avatar" style="width:44px;height:44px;overflow:hidden;border-radius:50%"><img src="'+escHtml(p.avatar_url)+'" style="width:100%;height:100%;object-fit:cover"></div>' :
        '<div class="avatar" style="background:linear-gradient(135deg,#6366F1,#7C5CFC);width:44px;height:44px">'+initials+'</div>';
      return '<div class="card conv-card' + (isUnread ? ' unread' : '') + '" data-action="openChat" data-id="' + partnerId + '" data-from="screen-messages" data-conv-id="' + partnerId + '">' +
        '<div class="flex-row-center" style="gap:0.75rem">' + convAvatar +
        '<div style="flex:1;min-width:0">' +
        '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:0.5rem">' +
        '<div class="conv-name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escHtml(p.name||'Ukendt') + '</div>' +
        '<div class="conv-time">' + time + '</div></div>' +
        '<div class="conv-preview" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:0.75rem;margin-top:0.1rem">' + preview + '</div>' +
        '</div>' + (isUnread ? '<div class="conv-unread-dot"></div>' : '') +
        '</div></div>';
    }).join('');
  } catch(e) { logError("loadMessages", e); showRetryState('conversations-list', 'loadMessages', 'Kunne ikke hente beskeder'); }
  finally { _messagesLoading = false; }
}

async function openChat(userId, fromScreen) {
  console.debug('[dm] openChat:', userId, 'from:', fromScreen);
  if (isBlocked(userId)) { showToast('Denne bruger er blokeret'); return; }
  try {
    currentChatUser = userId;
    const { data: p } = await sb.from('profiles').select('name,title,avatar_url').eq('id', userId).single();
    currentChatName = p?.name || 'Ukendt';
    window._chatPartnerAvatar = p?.avatar_url || null;
    document.getElementById('chat-name').textContent = currentChatName;
    document.getElementById('chat-role').textContent = p?.title || '';
    var dmAvatar = document.getElementById('dm-topbar-avatar');
    if (dmAvatar) {
      if (p?.avatar_url) { dmAvatar.innerHTML = '<img src="'+escHtml(p.avatar_url)+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%">'; }
      else { dmAvatar.textContent = (currentChatName).split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase(); }
    }
    const backBtn = document.getElementById('dm-back-btn');
    if (backBtn) backBtn.onclick = () => goTo(fromScreen || 'screen-messages');
    goTo('screen-chat');
    await loadChatMessages();
    subscribeToChat();

    // Mark messages as read + update ✓✓ on sender's side
    var { data: unread } = await sb.from('messages')
      .select('id').eq('sender_id', userId).eq('receiver_id', currentUser.id).is('read_at', null);
    if (unread && unread.length > 0) {
      var unreadIds = unread.map(function(m) { return m.id; });
      await sb.from('messages').update({ read_at: new Date().toISOString() })
        .in('id', unreadIds);
      // Notify sender that their messages were read
      if (chatSubscription) {
        try { chatSubscription.send({ type: 'broadcast', event: 'read_receipt', payload: { msgIds: unreadIds } }); } catch(e) { logError("dm:read_receipt_broadcast", e); }
      }
    }
    await updateUnreadBadge();
  } catch(e) { logError("openChat", e); showToast(e.message || "Ukendt fejl"); }
}


// ── Date separator: insert if last message in DOM is from a different day ──
function _dmMaybeInsertDateSep(container, createdAt) {
  if (!container || !createdAt) return;
  var newDate = new Date(createdAt).toLocaleDateString('da-DK', {weekday:'long', day:'numeric', month:'short'});
  var lastSep = container.querySelector('.chat-date-sep:last-of-type');
  var lastDate = lastSep ? lastSep.textContent : '';
  if (newDate.toUpperCase() !== lastDate) {
    container.insertAdjacentHTML('beforeend', '<div class="chat-date-sep">' + newDate.toUpperCase() + '</div>');
  }
}

function dmRenderMsg(m) {
  const sent = m.sender_id === currentUser.id;
  const time = new Date(m.created_at).toLocaleTimeString('da-DK', {hour:'2-digit',minute:'2-digit'});
  const myInit = (currentProfile?.name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  const theirInit = (currentChatName||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  const initials = sent ? myInit : theirInit;
  const name = sent ? (currentProfile?.name||'Mig') : (currentChatName||'?');
  const edited = m.edited ? ' <span class="msg-edited">redigeret</span>' : '';

  // Read receipt: ✓ sent, ✓✓ read (teal)
  let receipt = '';
  if (sent && !m.file_url) {
    if (m.read_at) {
      receipt = `<span class="msg-receipt read" id="dm-receipt-${m.id}" title="Læst ${new Date(m.read_at).toLocaleTimeString('da-DK',{hour:'2-digit',minute:'2-digit'})}">✓✓</span>`;
    } else {
      receipt = `<span class="msg-receipt" id="dm-receipt-${m.id}" title="Sendt">✓</span>`;
    }
  }

  let bubble = '';
  if (m.file_url) {
    const safeUrl = escHtml(m.file_url);
    const ext = m.file_name?.split('.').pop()?.toLowerCase() || '';
    const isImg = ['jpg','jpeg','png','gif','webp'].includes(ext) || (m.file_type||'').startsWith('image/');
    if (isImg) {
      bubble = `<a href="${safeUrl}" target="_blank" rel="noopener"><img class="msg-img" src="${safeUrl}" alt="${escHtml(m.file_name||'')}"></a>`;
    } else {
      const sz = m.file_size ? (m.file_size < 1048576 ? Math.round(m.file_size/1024)+'KB' : (m.file_size/1048576).toFixed(1)+'MB') : '';
      bubble = `<a class="msg-file" href="${safeUrl}" target="_blank" rel="noopener">${icon('clip')} ${escHtml(m.file_name||'Fil')} <span class="msg-file-sz">${sz}</span></a>`;
    }
  } else {
    bubble = `<div class="msg-bubble${sent?' sent':''}" id="dm-bubble-${m.id}">${escHtml(filterChatContent(m.content||''))}</div>`;
  }

  const myAvUrl = currentProfile?.avatar_url;
  const theirAvUrl = window._chatPartnerAvatar;
  const avatarGrad = sent ? 'linear-gradient(135deg,#6366F1,#7C5CFC)' : 'linear-gradient(135deg,#2ECFCF,#22B8CF)';
  const avatarClick = sent ? '' : ` onclick="dmOpenPersonSheet('${m.sender_id}')"`;

  let avatarInner;
  if (sent && myAvUrl) { avatarInner = '<img src="'+myAvUrl+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%">'; }
  else if (!sent && theirAvUrl) { avatarInner = '<img src="'+theirAvUrl+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%">'; }
  else { avatarInner = initials; }

  return `<div class="msg-row${sent?' me':''}" id="dm-msg-${m.id}" data-msg-id="${m.id}">
    <div class="msg-avatar"${avatarClick} style="background:${avatarGrad};overflow:hidden${sent?'':';cursor:pointer'}">${avatarInner}</div>
    <div class="msg-body">
      <div class="msg-head"><span class="msg-name">${escHtml(name)}</span><span class="msg-time">${time}${edited}${receipt}</span></div>
      <div class="msg-content">${bubble}<span class="msg-actions"><button class="msg-dots" onpointerdown="event.stopPropagation()" onclick="dmOpenMsgMenu(event,'${m.id}',${sent})" title="Mere">⋯</button></span></div>
    </div>
  </div>`;
}

async function loadChatMessages() {
  try {
    const el = document.getElementById('chat-messages');
    const { data: msgs } = await sb.from('messages')
      .select('*')
      .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${currentChatUser}),and(sender_id.eq.${currentChatUser},receiver_id.eq.${currentUser.id})`)
      .order('created_at', {ascending:false})
      .limit(100);
    
    const sorted = (msgs||[]).reverse();

    if (sorted.length === 0) {
      // Empty chat hero
      var partnerName = currentChatName || 'Ukendt';
      var partnerAvatar = window._chatPartnerAvatar;
      var partnerInit = partnerName.split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();
      var avHtml = partnerAvatar
        ? '<img src="' + escHtml(partnerAvatar) + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%">'
        : partnerInit;
      el.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;padding:3rem 1.5rem 1rem;text-align:center">' +
        '<div style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#6366F1,#7C5CFC);display:flex;align-items:center;justify-content:center;font-size:1.1rem;font-weight:700;color:white;overflow:hidden">' + avHtml + '</div>' +
        '<div style="font-size:0.92rem;font-weight:700;margin-top:0.6rem">' + escHtml(partnerName) + '</div>' +
        '<div style="font-size:0.72rem;color:var(--muted);margin-top:0.2rem">Skriv den første besked</div>' +
        '</div>';
      return;
    }

    // Render with date separators
    var html = '';
    var lastDate = '';
    sorted.forEach(function(m) {
      var d = new Date(m.created_at).toLocaleDateString('da-DK', {weekday:'long', day:'numeric', month:'short'});
      if (d !== lastDate) {
        html += '<div class="chat-date-sep">' + d.toUpperCase() + '</div>';
        lastDate = d;
      }
      html += dmRenderMsg(m);
    });
    el.innerHTML = html;
    el.scrollTop = el.scrollHeight;
  } catch(e) { logError("loadChatMessages", e); showToast(e.message || "Ukendt fejl"); }
}

// ── DM Realtime: Broadcast for instant delivery + typing indicator ──
var _dmTypingTimer = null;

function dmChannelName() {
  var ids = [currentUser.id, currentChatUser].sort();
  return 'dm-' + ids[0] + '-' + ids[1];
}

function dmShowTyping(name) {
  var el = document.getElementById('dm-typing-indicator');
  var nameEl = document.getElementById('dm-typing-name');
  if (!el || !nameEl) return;
  nameEl.textContent = name + ' skriver';
  el.style.display = 'block';
  clearTimeout(_dmTypingTimer);
  _dmTypingTimer = setTimeout(function() { if (el) el.style.display = 'none'; }, 3000);
}

function dmHideTyping() {
  clearTimeout(_dmTypingTimer);
  var el = document.getElementById('dm-typing-indicator');
  if (el) el.style.display = 'none';
}

var _dmBroadcastTypingTimer = null;
function dmOnInput() {
  if (!chatSubscription) return;
  clearTimeout(_dmBroadcastTypingTimer);
  _dmBroadcastTypingTimer = setTimeout(function() {
    try {
      chatSubscription.send({ type: 'broadcast', event: 'typing',
        payload: { userId: currentUser.id, name: currentProfile?.name || 'Nogen' } });
    } catch(e) { /* typing is fire-and-forget, log silently */ if (window._debugRt) console.warn('typing broadcast:', e); }
  }, 300);
}

function dmUpdateReceipts(msgIds) {
  (msgIds || []).forEach(function(id) {
    var el = document.getElementById('dm-receipt-' + id);
    if (el && !el.classList.contains('read')) {
      el.classList.add('read'); el.textContent = '✓✓'; el.title = 'Læst';
    }
  });
}

function subscribeToChat() {
  if (chatSubscription) { try { chatSubscription.unsubscribe(); } catch(e) {} chatSubscription = null; }

  chatSubscription = sb.channel(dmChannelName(), { config: { broadcast: { self: false } } })
    // Instant new message via Broadcast
    .on('broadcast', { event: 'new_message' }, function(payload) {
      var m = payload.payload;
      if (!m) return;
      if (m.sender_id !== currentChatUser && m.receiver_id !== currentChatUser) return;
      var el = document.getElementById('chat-messages');
      if (!el || el.querySelector('[data-msg-id="' + m.id + '"]')) return;
      dmHideTyping();
      _dmMaybeInsertDateSep(el, m.created_at);
      el.insertAdjacentHTML('beforeend', dmRenderMsg(m));
      el.scrollTop = el.scrollHeight;
      if (m.receiver_id === currentUser.id) {
        sb.from('messages').update({ read_at: new Date().toISOString() }).eq('id', m.id)
          .then(function(res) { if (res.error) logError('dm:read_at_broadcast', res.error); });
        updateUnreadBadge();
        try { chatSubscription.send({ type: 'broadcast', event: 'read_receipt', payload: { msgIds: [m.id] } }); } catch(e) { logError("dm:inline_read_receipt", e); }
      }
    })
    // Typing indicator
    .on('broadcast', { event: 'typing' }, function(payload) {
      var p = payload.payload;
      if (!p || p.userId === currentUser.id) return;
      dmShowTyping(p.name || 'Den anden');
    })
    // Read receipt feedback to sender
    .on('broadcast', { event: 'read_receipt' }, function(payload) {
      var p = payload.payload;
      if (p && p.msgIds) dmUpdateReceipts(p.msgIds);
    })
    // Fallback: Postgres Changes (covers edge cases like push notifications)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages',
      filter: 'receiver_id=eq.' + currentUser.id }, function(payload) {
      var m = payload.new;
      if (!m || m.sender_id !== currentChatUser) return;
      var el = document.getElementById('chat-messages');
      if (!el || el.querySelector('[data-msg-id="' + m.id + '"]')) return;
      dmHideTyping();
      _dmMaybeInsertDateSep(el, m.created_at);
      el.insertAdjacentHTML('beforeend', dmRenderMsg(m));
      el.scrollTop = el.scrollHeight;
      sb.from('messages').update({ read_at: new Date().toISOString() }).eq('id', m.id)
        .then(function(res) { if (res.error) logError('dm:read_at_changes', res.error); });
      updateUnreadBadge();
    })
    .subscribe(_rtStatusCallback('dm-chat'));
}

// ── DM message context menu (⋯) ──
function dmOpenMsgMenu(e, msgId, isMine) {
  e.stopPropagation();
  var existing = document.getElementById('dm-msg-menu');
  if (existing) { existing.remove(); if (existing.dataset.msgId === msgId) return; }

  var btn = e.currentTarget;
  var rect = btn.getBoundingClientRect();

  var menu = document.createElement('div');
  menu.id = 'dm-msg-menu';
  menu.dataset.msgId = msgId;
  menu.style.cssText = `position:fixed;z-index:9999;background:var(--glass-bg-strong);backdrop-filter:var(--glass-blur);border:1px solid var(--glass-border);border-radius:12px;padding:0.35rem 0;min-width:130px;box-shadow:0 8px 32px rgba(30,27,46,0.12);right:${Math.max(8, window.innerWidth - rect.right + rect.width/2 - 65)}px;top:${rect.bottom + 6}px`;

  var items = '';
  if (isMine) {
    items += `<button onclick="dmEditMsg('${msgId}');document.getElementById('dm-msg-menu')?.remove()" style="display:flex;align-items:center;gap:0.5rem;width:100%;padding:0.55rem 1rem;background:none;border:none;color:var(--text);font-size:0.82rem;cursor:pointer;text-align:left">✎ Rediger</button>`;
    items += '<div style="height:1px;background:var(--glass-border);margin:0.2rem 0"></div>';
  }
  items += `<button onclick="dmCopyMsg('${msgId}');document.getElementById('dm-msg-menu')?.remove()" style="display:flex;align-items:center;gap:0.5rem;width:100%;padding:0.55rem 1rem;background:none;border:none;color:var(--text);font-size:0.82rem;cursor:pointer;text-align:left">📋 Kopiér</button>`;
  if (isMine) {
    items += '<div style="height:1px;background:var(--glass-border);margin:0.2rem 0"></div>';
    items += `<button onclick="dmDeleteMsg('${msgId}');document.getElementById('dm-msg-menu')?.remove()" style="display:flex;align-items:center;gap:0.5rem;width:100%;padding:0.55rem 1rem;background:none;border:none;color:var(--accent2);font-size:0.82rem;cursor:pointer;text-align:left">✕ Slet</button>`;
  }
  menu.innerHTML = items;

  document.body.appendChild(menu);

  // Close on outside tap
  setTimeout(() => {
    document.addEventListener('pointerdown', function closeMenu(ev) {
      if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('pointerdown', closeMenu); }
    });
  }, 50);
}

let dmEditingId = null;
function dmEditMsg(msgId) {
  dmEditingId = msgId;
  const bubble = document.getElementById('dm-bubble-' + msgId);
  if (!bubble) return;
  const input = document.getElementById('chat-input');
  input.value = bubble.textContent;
  input.focus();
  var editBar = document.getElementById('dm-edit-bar');
  if (editBar) editBar.style.display = 'flex';
}

function dmCancelEdit() {
  dmEditingId = null;
  var input = document.getElementById('chat-input');
  if (input) input.value = '';
  var editBar = document.getElementById('dm-edit-bar');
  if (editBar) editBar.style.display = 'none';
}

function dmCopyMsg(msgId) {
  var bubble = document.getElementById('dm-bubble-' + msgId);
  if (!bubble) return;
  var text = bubble.textContent || '';
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(function() { showToast('Kopieret'); }).catch(function() { showToast('Kunne ikke kopiere'); });
  } else {
    showToast('Kopiering ikke understøttet');
  }
}

async function dmDeleteMsg(msgId) {
  try {
    var el = document.getElementById('dm-msg-' + msgId);
    if (!el) return;
    // Use inline confirm tray instead of window.confirm()
    if (el.querySelector('.dm-delete-confirm')) return; // already showing
    var tray = document.createElement('div');
    tray.className = 'dm-delete-confirm';
    tray.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:0.35rem 0.5rem;margin-top:0.25rem;background:rgba(26,122,138,0.08);border:1px solid rgba(26,122,138,0.2);border-radius:8px;gap:0.4rem';
    tray.innerHTML = '<span style="font-size:0.7rem;color:var(--text-secondary)">Slet besked?</span>' +
      '<div style="display:flex;gap:0.25rem">' +
      '<button style="font-size:0.68rem;padding:0.2rem 0.55rem;background:rgba(124,92,252,0.12);color:var(--accent2);border:1px solid rgba(26,122,138,0.3);border-radius:6px;cursor:pointer;font-family:inherit;font-weight:600" onclick="dmConfirmDelete(\'' + msgId + '\')">Slet</button>' +
      '<button style="font-size:0.68rem;padding:0.2rem 0.55rem;background:none;color:var(--muted);border:1px solid var(--glass-border);border-radius:6px;cursor:pointer;font-family:inherit" onclick="this.closest(\'.dm-delete-confirm\').remove()">Annuller</button>' +
      '</div>';
    el.appendChild(tray);
  } catch(e) { logError("dmDeleteMsg", e); showToast('Kunne ikke slette besked'); }
}

async function dmConfirmDelete(msgId) {
  try {
    await sb.from('messages').delete().eq('id', msgId).eq('sender_id', currentUser.id);
    var el = document.getElementById('dm-msg-' + msgId);
    if (el) el.remove();
    showToast('Besked slettet');
  } catch(e) { logError("dmConfirmDelete", e); showToast('Kunne ikke slette besked'); }
}


