// ══════════════════════════════════════════════════════════
//  BUBBLE — GLOBAL REALTIME HUB + CHAT SUBSCRIPTIONS
//  Auto-split from app.js · v3.7.0
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
//  GLOBAL REALTIME HUB
//  Alle live opdateringer samlet ét sted.
//  Kanal 1: messages       → nav badge + conv liste preview
//  Kanal 2: bubble_members → live-boble kort + bc-members
//  Kanal 3: invitations    → notif badge + notif-skærm
//  Kanal 4: saved_contacts → notif badge
// ══════════════════════════════════════════════════════════

var _globalRtChannels = [];
var _radarRefreshTimer = null;
var _radarScreenActive = false;

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
  var el = document.getElementById('home-notif-badge');
  return el ? (parseInt(el.textContent) || 0) : 0;
}
function notifBadgeSet(n) {
  var el = document.getElementById('home-notif-badge');
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

  // If it's MY check-in/out → refresh live card
  if (m.user_id === currentUser.id) {
    loadLiveBubbleStatus();
    // Also update home screen if active
    if (document.getElementById('screen-home')?.classList.contains('active')) {
      loadHomeBubblesCard();
    }
    return;
  }

  // If bc chat is open for this bubble → reload members tab silently
  if (bcBubbleId && m.bubble_id === bcBubbleId) {
    // Only reload if members tab is visible
    var membersPanel = document.getElementById('bc-members-list');
    if (membersPanel && membersPanel.closest('.bc-panel')?.style.display !== 'none') {
      bcLoadMembers();
    }
    // Update live member count on home card
    var countEl = document.getElementById('live-bubble-count');
    if (countEl && currentLiveBubble && currentLiveBubble.bubble_id === m.bubble_id) {
      loadLiveBubbleStatus();
    }
  }

  // If it's in MY current live bubble → update member count on card
  if (currentLiveBubble && m.bubble_id === currentLiveBubble.bubble_id) {
    loadLiveBubbleStatus();
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
      loadProximityMap();
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
    .subscribe();
  _globalRtChannels.push(chMessages);

  // ── Kanal 2: Boble-medlemmer — filter på user_id så RLS virker ──
  var chMembers = sb.channel('rt-members-' + currentUser.id)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bubble_members',
      filter: 'user_id=eq.' + currentUser.id },
      function(payload) { rtHandleMemberChange(payload); })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'bubble_members',
      filter: 'user_id=eq.' + currentUser.id },
      function(payload) { rtHandleMemberChange(payload); })
    .subscribe();
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
    .subscribe();
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
    .subscribe();
  _globalRtChannels.push(chSaved);
}

// Legacy alias — some code still calls this
function subscribeToIncoming() { initGlobalRealtime(); }

async function loadMessages() {
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
      const preview = lastMsg.file_url ? '📎 Billede' : escHtml((lastMsg.content||'').slice(0,50));
      const time = timeAgo(lastMsg.created_at);
      const convAvatar = p.avatar_url ?
        '<div class="avatar" style="width:44px;height:44px;overflow:hidden;border-radius:50%"><img src="'+escHtml(p.avatar_url)+'" style="width:100%;height:100%;object-fit:cover"></div>' :
        '<div class="avatar" style="background:linear-gradient(135deg,#6366F1,#7C5CFC);width:44px;height:44px">'+initials+'</div>';
      return '<div class="card conv-card' + (isUnread ? ' unread' : '') + '" data-action="openChat" data-id="' + partnerId + '" data-conv-id="' + partnerId + '">' +
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
    const ext = m.file_name?.split('.').pop()?.toLowerCase() || '';
    const isImg = ['jpg','jpeg','png','gif','webp'].includes(ext) || (m.file_type||'').startsWith('image/');
    if (isImg) {
      bubble = `<a href="${m.file_url}" target="_blank"><img class="msg-img" src="${m.file_url}" alt="${escHtml(m.file_name||'')}"></a>`;
    } else {
      const sz = m.file_size ? (m.file_size < 1048576 ? Math.round(m.file_size/1024)+'KB' : (m.file_size/1048576).toFixed(1)+'MB') : '';
      bubble = `<a class="msg-file" href="${m.file_url}" target="_blank">${icon('clip')} ${escHtml(m.file_name||'Fil')} <span class="msg-file-sz">${sz}</span></a>`;
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
      <div class="msg-content">${bubble}${sent && !m.file_url ? `<span class="msg-actions"><button class="msg-dots" onpointerdown="event.stopPropagation()" onclick="dmOpenMsgMenu(event,'${m.id}')" title="Mere">⋯</button></span>` : ''}</div>
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

    el.innerHTML = sorted.map(m => dmRenderMsg(m)).join('');
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
      el.insertAdjacentHTML('beforeend', dmRenderMsg(m));
      el.scrollTop = el.scrollHeight;
      sb.from('messages').update({ read_at: new Date().toISOString() }).eq('id', m.id)
        .then(function(res) { if (res.error) logError('dm:read_at_changes', res.error); });
      updateUnreadBadge();
    })
    .subscribe();
}

// ── DM message context menu (⋯) ──
function dmOpenMsgMenu(e, msgId) {
  e.stopPropagation();
  // Remove any existing menu
  var existing = document.getElementById('dm-msg-menu');
  if (existing) { existing.remove(); if (existing.dataset.msgId === msgId) return; }

  var btn = e.currentTarget;
  var rect = btn.getBoundingClientRect();

  var menu = document.createElement('div');
  menu.id = 'dm-msg-menu';
  menu.dataset.msgId = msgId;
  menu.style.cssText = `position:fixed;z-index:9999;background:var(--glass-bg-strong);backdrop-filter:var(--glass-blur);border:1px solid var(--glass-border);border-radius:12px;padding:0.35rem 0;min-width:130px;box-shadow:0 8px 32px rgba(30,27,46,0.12);right:${Math.max(8, window.innerWidth - rect.right + rect.width/2 - 65)}px;top:${rect.bottom + 6}px`;

  menu.innerHTML = `
    <button onclick="dmEditMsg('${msgId}');document.getElementById('dm-msg-menu')?.remove()" style="display:flex;align-items:center;gap:0.5rem;width:100%;padding:0.55rem 1rem;background:none;border:none;color:var(--text);font-size:0.82rem;cursor:pointer;text-align:left">✎ Rediger</button>
    <div style="height:1px;background:var(--glass-border);margin:0.2rem 0"></div>
    <button onclick="dmDeleteMsg('${msgId}');document.getElementById('dm-msg-menu')?.remove()" style="display:flex;align-items:center;gap:0.5rem;width:100%;padding:0.55rem 1rem;background:none;border:none;color:var(--accent2);font-size:0.82rem;cursor:pointer;text-align:left">✕ Slet</button>
  `;

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


