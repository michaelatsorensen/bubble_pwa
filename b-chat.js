// ══════════════════════════════════════════════════════════
//  BUBBLE — BUBBLE CHAT + GIF PICKER
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
  var gifUrl = window._gifResults && window._gifResults[idx];
  var mode = gifPickerMode;
  closeGifPicker();
  if (!gifUrl) { logError('selectGif', 'No GIF URL at index ' + idx); return; }
  try {
    if (mode === 'bc') {
      if (!bcBubbleId) { logError('selectGif', 'No bcBubbleId'); showToast('Fejl: ingen aktiv boble'); return; }
      var { data: msg, error } = await sb.from('bubble_messages').insert({
        bubble_id: bcBubbleId, user_id: currentUser.id,
        content: '', file_url: gifUrl, file_name: 'gif.gif', file_type: 'image/gif'
      }).select('id, bubble_id, user_id, content, file_url, file_name, file_size, file_type, edited, created_at').single();
      if (error) { logError('selectGif:bc', error); showToast('GIF fejl: ' + (error.message || 'ukendt')); return; }
      if (msg) {
        msg.profiles = { id: currentUser.id, name: currentProfile?.name || '?' };
        var msgEl2 = document.getElementById('bc-messages');
        var es2 = msgEl2.querySelector('.empty-state');
        if (es2) es2.remove();
        msgEl2.appendChild(bcRenderMsg(msg));
        bcScrollToBottom();
      }
    } else if (mode === 'dm') {
      if (!currentChatUser) { logError('selectGif', 'No currentChatUser'); showToast('Fejl: ingen aktiv chat'); return; }
      var { data: msg2, error: err2 } = await sb.from('messages').insert({
        sender_id: currentUser.id, receiver_id: currentChatUser,
        content: '', file_url: gifUrl, file_name: 'gif.gif', file_type: 'image/gif'
      }).select().single();
      if (err2) { logError('selectGif:dm', err2, { receiver: currentChatUser }); showToast('GIF fejl: ' + (err2.message || 'ukendt')); return; }
      if (msg2) {
        var el = document.getElementById('chat-messages');
        if (el && !el.querySelector('[data-msg-id="' + msg2.id + '"]')) {
          el.insertAdjacentHTML('beforeend', dmRenderMsg(msg2));
          el.scrollTop = el.scrollHeight;
        }
      }
    } else {
      logError('selectGif', 'Unknown mode: ' + mode);
      showToast('GIF fejl: ukendt kontekst');
    }
  } catch(e) { logError('selectGif', e, { mode: mode }); showToast('GIF fejl: ' + (e.message || 'ukendt')); }
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

// ── REALTIME CLEANUP HELPER ──
// v5.2: chat only cleans up its own subscriptions.
// Global channels are owned by b-realtime.js → rtUnsubscribeAll().
function bcUnsubscribe() {
  if (bcSubscription) { bcSubscription.unsubscribe(); bcSubscription = null; }
}
function dmUnsubscribe() {
  if (chatSubscription) { chatSubscription.unsubscribe(); chatSubscription = null; }
}
function bcUnsubscribeAll() {
  bcUnsubscribe();
  dmUnsubscribe();
  // NOTE: does NOT touch global realtime channels — use rtUnsubscribeAll() for full teardown
}

async function openBubbleChat(bubbleId, fromScreen) {
  if (!currentUser || !bubbleId) { console.warn('openBubbleChat: missing user or bubbleId'); return; }
  console.debug('[bc] openBubbleChat:', bubbleId, 'from:', fromScreen);

  // 1. Navigate + cleanup previous
  // If navigating from one bubble to another (e.g. parent → child event),
  // store previous bubble so back can reopen it
  var prevBubbleId = (fromScreen === 'screen-bubble-chat' && bcBubbleId) ? bcBubbleId : null;
  bcUnsubscribe();
  bcBubbleId = bubbleId;
  var backBtn = document.getElementById('bc-back-btn');
  if (prevBubbleId) {
    // Back reopens the parent bubble
    backBtn.onclick = function() { openBubbleChat(prevBubbleId, 'screen-bubbles'); };
  } else {
    backBtn.onclick = function() { goTo(fromScreen || 'screen-home'); };
  }
  goTo('screen-bubble-chat');
  bcSwitchTab('members');

  // 2. Load all data
  var backTarget = prevBubbleId ? 'screen-bubbles' : (fromScreen || 'screen-home');
  try {
    var success = await bcLoadChatData(bubbleId);
    if (!success) {
      if (prevBubbleId) { openBubbleChat(prevBubbleId, 'screen-bubbles'); }
      else { goTo(backTarget); }
      return;
    }
  } catch(e) {
    logError("openBubbleChat:load", e);
    showToast('Kunne ikke åbne boblen');
    if (prevBubbleId) { openBubbleChat(prevBubbleId, 'screen-bubbles'); }
    else { goTo(backTarget); }
    return;
  }

  // 3. Subscribe AFTER data is ready
  bcSubscribeRealtime();
}

// ── Pure data loading: fetch bubble, membership, roles, render UI ──
async function bcLoadChatData(bubbleId) {
  // Fetch bubble
  var { data: b, error: bErr } = await sb.from('bubbles').select('*').eq('id', bubbleId).maybeSingle();
  if (!b || bErr) { showToast('Denne boble eksisterer ikke længere'); return false; }
  bcBubbleData = b;

  // Render topbar
  document.getElementById('bc-emoji').innerHTML = b.icon_url ? '<img src="' + escHtml(b.icon_url) + '" style="width:1.1rem;height:1.1rem;border-radius:4px;object-fit:cover">' : bubbleEmoji(b.type);
  document.getElementById('bc-name').textContent = b.name;

  // Member count
  var memberCount = b.member_count;
  if (memberCount == null) {
    var { count } = await sb.from('bubble_members').select('*',{count:'exact',head:true}).eq('bubble_id', bubbleId);
    memberCount = count || 0;
  }
  document.getElementById('bc-members-count').textContent = memberCount + (b.type === 'event' || b.type === 'live' ? ' deltagere' : ' medlemmer');

  // Dynamic tab label
  var tabMembers = document.getElementById('bc-tab-members');
  if (tabMembers) tabMembers.textContent = (b.type === 'event' || b.type === 'live') ? 'Deltagere' : 'Medlemmer';

  // Show Events tab for network bubbles (not for events themselves)
  var isEvent = b.type === 'event' || b.type === 'live';
  var tabEvents = document.getElementById('bc-tab-events');
  var tabPosts = document.getElementById('bc-tab-posts');
  if (!isEvent) {
    // Check for child events
    var { count: evCount } = await sb.from('bubbles').select('*', { count: 'exact', head: true })
      .eq('parent_bubble_id', bubbleId).eq('type', 'event');
    if (tabEvents) tabEvents.style.display = (evCount > 0) ? '' : 'none';
    if (tabPosts) tabPosts.style.display = (evCount > 0) ? 'none' : '';
  } else {
    if (tabEvents) tabEvents.style.display = 'none';
    if (tabPosts) tabPosts.style.display = '';
  }

  // Membership + role (parallel)
  var [upvoteRes, memberRes, roleRes] = await Promise.all([
    loadBubbleUpvotes().catch(function() {}),
    sb.from('bubble_members').select('id').eq('bubble_id', bubbleId).eq('user_id', currentUser.id).maybeSingle(),
    sb.from('bubble_members').select('role').eq('bubble_id', bubbleId).eq('user_id', currentUser.id).maybeSingle()
  ]);
  var myMembership = memberRes?.data;
  var myRole = roleRes?.data;
  var isOwner = b.created_by === currentUser.id;
  var isBubbleAdmin = myRole && myRole.role === 'admin';
  var canEdit = isOwner || isBubbleAdmin;
  bcBubbleData._isOwner = isOwner;
  bcBubbleData._isAdmin = isBubbleAdmin;
  bcBubbleData._canEdit = canEdit;

  // Render action buttons
  bcRenderActions(b, myMembership, canEdit);

  // Load members tab + messages (parallel)
  await Promise.all([
    bcLoadMembers(),
    bcLoadMessages()
  ]);

  return true;
}

// ── Render action buttons based on membership state ──
function bcRenderActions(b, myMembership, canEdit) {
  var actionArea = document.getElementById('bc-action-btns');
  var actionBar = document.getElementById('bc-action-bar');

  if (myMembership) {
    actionArea.innerHTML =
      (canEdit ? `<button class="btn-sm btn-ghost" data-action="openEditBubble" data-id="${b.id}" style="font-size:0.82rem;padding:0.3rem 0.4rem" title="Rediger">${icon("edit")}</button>` : '');
    if (actionBar) {
      var upvoted = myUpvotes[b.id];
      actionBar.innerHTML =
        `<button class="bc-bar-btn" onclick="openInviteModal('${b.id}')">${icon('user-plus')} Invitér</button>` +
        `<button class="bc-bar-btn${upvoted ? ' active' : ''}" id="bc-upvote-bar-btn" onclick="toggleBubbleUpvote('${b.id}')">${upvoted ? icon('checkCircle') : icon('rocket')} ${upvoted ? 'Anbefalet' : 'Anbefal'}</button>` +
        `<button class="bc-bar-btn" data-action="openQRModal" data-id="${b.id}">${icon('qrcode')} QR</button>`;
      actionBar.style.display = 'flex';
    }
  } else if (b.visibility === 'hidden') {
    actionArea.innerHTML = `<span style="font-size:0.75rem;color:var(--muted)">${icon("eye")} Kun via invitation</span>`;
    if (actionBar) actionBar.style.display = 'none';
  } else if (b.visibility === 'private') {
    actionArea.innerHTML = `<button class="btn-sm btn-accent" data-action="requestJoin" data-id="${b.id}">${icon("lock")} Anmod</button>`;
    if (actionBar) actionBar.style.display = 'none';
  } else {
    actionArea.innerHTML = `<button class="btn-sm btn-accent" data-action="joinBubble" data-id="${b.id}">+ Join</button>`;
    if (actionBar) actionBar.style.display = 'none';
  }
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
          var msgContainer = document.getElementById('bc-messages');
          var emptyS = msgContainer.querySelector('.empty-state');
          if (emptyS) emptyS.remove();
          msgContainer.appendChild(bcRenderMsg(m));
          bcScrollToBottom();
        } else {
          const badge = document.getElementById('bc-unread-badge');
          badge.textContent = parseInt(badge.textContent||0) + 1;
          badge.style.display = 'inline-flex';
        }
      })
    .on('postgres_changes', {event:'UPDATE', schema:'public', table:'bubble_messages', filter:`bubble_id=eq.${bcBubbleId}`},
      (payload) => {
        const m = payload.new;
        const bubbleEl = document.getElementById('bc-bubble-' + m.id);
        if (bubbleEl) {
          bubbleEl.textContent = m.content || '';
          const msgBody = bubbleEl.closest('.msg-body');
          const msgHead = msgBody?.querySelector('.msg-head');
          if (msgHead && !msgHead.querySelector('.msg-edited')) {
            const e = document.createElement('span');
            e.className = 'msg-edited';
            e.style.cssText = 'font-size:0.6rem;color:var(--muted);margin-left:0.3rem;cursor:pointer';
            e.textContent = 'redigeret';
            const id = m.id;
            e.onclick = () => bcShowHistory(id);
            msgHead.appendChild(e);
          }
        }
      })
    .on('postgres_changes', {event:'INSERT', schema:'public', table:'bubble_members', filter:`bubble_id=eq.${bcBubbleId}`},
      () => { bcLoadMembers(); })
    .on('postgres_changes', {event:'UPDATE', schema:'public', table:'bubble_members', filter:`bubble_id=eq.${bcBubbleId}`},
      () => { bcLoadMembers(); })
    .subscribe();
}

async function bcLoadBubbleInfo() {
  try {
    const { data: b } = await sb.from('bubbles').select('*').eq('id', bcBubbleId).maybeSingle();
    if (!b) return;
    bcBubbleData = b;
    document.getElementById('bc-emoji').innerHTML = b.icon_url ? '<img src="' + escHtml(b.icon_url) + '" style="width:1.1rem;height:1.1rem;border-radius:4px;object-fit:cover">' : bubbleEmoji(b.type);
    document.getElementById('bc-name').textContent = b.name;

    var memberCount2 = b.member_count;
    if (memberCount2 == null) {
      var { count } = await sb.from('bubble_members').select('*',{count:'exact',head:true}).eq('bubble_id', bcBubbleId);
      memberCount2 = count || 0;
    }
    // Check my LIVE status
    var statusText = memberCount2 + ' medlemmer';
    var { data: myM } = await sb.from('bubble_members').select('checked_in_at,checked_out_at').eq('bubble_id', bcBubbleId).eq('user_id', currentUser.id).maybeSingle();
    var isLive = myM && myM.checked_in_at && !myM.checked_out_at && (Date.now() - new Date(myM.checked_in_at).getTime() < 6*3600000);
    var countEl = document.getElementById('bc-members-count');
    if (countEl) {
      if (isLive) {
        var expiry = new Date(new Date(myM.checked_in_at).getTime() + 6*3600000);
        var hh = expiry.getHours().toString().padStart(2,'0');
        var mm = expiry.getMinutes().toString().padStart(2,'0');
        countEl.innerHTML = statusText + ' · <span style="color:#1A9E8E">LIVE</span> <span style="opacity:0.6">udl. ' + hh + ':' + mm + '</span>';
      } else {
        countEl.textContent = statusText + ' · Medlem ✓';
      }
    }
  } catch(e) { logError("bcLoadBubbleInfo", e); showToast(e.message || "Ukendt fejl"); }
}

function bcSwitchTab(tab) {
  ['chat','members','info','posts','events'].forEach(t => {
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
  }
  if (tab === 'info') bcLoadInfo();
  if (tab === 'posts') bcLoadPosts();
  if (tab === 'events') bcLoadEvents();
}

async function bcLoadEvents() {
  var list = document.getElementById('bc-events-list');
  if (!list || !bcBubbleId) return;
  list.innerHTML = skelCards(3);
  try {
    var { data: events } = await sb.from('bubbles')
      .select('id, name, type, created_at, event_date, visibility, checkin_mode, bubble_members(count)')
      .eq('parent_bubble_id', bcBubbleId)
      .eq('type', 'event')
      .order('event_date', { ascending: true, nullsFirst: false })
      .limit(20);
    if (!events || events.length === 0) {
      var canEdit = bcBubbleData?._canEdit;
      list.innerHTML = '<div class="empty-state">' +
        '<div class="empty-icon">' + icon('calendar') + '</div>' +
        '<div class="empty-text">Ingen events endnu</div>' +
        (canEdit ? '<div class="empty-cta"><button class="btn-primary" onclick="openCreateEventFromBubble(\'' + bcBubbleId + '\')" style="font-size:0.82rem;padding:0.6rem 1.2rem">' + icon('calendar') + ' Opret event</button></div>' : '') +
        '</div>';
      return;
    }
    var now = new Date();
    var html = events.map(function(ev) {
      var mc = ev.bubble_members?.[0]?.count || 0;
      var evDate = ev.event_date ? new Date(ev.event_date) : null;
      var isPast = evDate && evDate < now;
      var dateStr = evDate
        ? evDate.toLocaleDateString('da-DK', { weekday: 'short', day: 'numeric', month: 'short' }) +
          (evDate.getHours() > 0 ? ' kl. ' + evDate.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' }) : '')
        : new Date(ev.created_at).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
      var badge = isPast
        ? '<span style="font-size:0.6rem;padding:2px 6px;border-radius:4px;background:rgba(30,27,46,0.06);color:var(--muted)">Afsluttet</span>'
        : '<span style="font-size:0.6rem;padding:2px 6px;border-radius:4px;background:rgba(46,207,207,0.1);color:#0F6E56">Kommende</span>';
      return '<div class="card" style="padding:0.75rem 0.9rem;margin-bottom:0.4rem;cursor:pointer" onclick="openBubbleChat(\'' + ev.id + '\',\'screen-bubble-chat\')">' +
        '<div style="display:flex;align-items:center;gap:0.6rem">' +
        '<div style="width:38px;height:38px;border-radius:10px;background:' + (isPast ? 'rgba(30,27,46,0.04)' : 'rgba(46,207,207,0.08)') + ';display:flex;align-items:center;justify-content:center;font-size:0.9rem;flex-shrink:0">' + icon('calendar') + '</div>' +
        '<div style="flex:1;min-width:0">' +
        '<div style="display:flex;align-items:center;gap:0.4rem"><span class="fw-600 fs-085" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escHtml(ev.name) + '</span>' + badge + '</div>' +
        '<div class="fs-072 text-muted">' + dateStr + ' · ' + mc + ' deltager' + (mc !== 1 ? 'e' : '') + '</div>' +
        '</div>' +
        '<div style="font-size:0.88rem;color:var(--muted)">›</div></div></div>';
    }).join('');
    // Add create button for owners
    if (bcBubbleData?._canEdit) {
      html += '<button onclick="openCreateEventFromBubble(\'' + bcBubbleId + '\')" style="width:100%;padding:0.6rem;border-radius:12px;background:rgba(46,207,207,0.05);border:1px solid rgba(46,207,207,0.15);color:#085041;font-size:0.78rem;font-weight:700;cursor:pointer;font-family:var(--font);display:flex;align-items:center;justify-content:center;gap:0.35rem;margin-top:0.3rem">' + icon('calendar') + ' Opret event</button>';
    }
    list.innerHTML = html;
  } catch(e) {
    logError('bcLoadEvents', e);
    showRetryState('bc-events-list', 'bcLoadEvents', 'Kunne ikke hente events');
  }
}

async function bcLoadMessages() {
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
      el.innerHTML = '<div class="empty-state" style="margin-top:2rem"><div class="empty-icon">' + icon('chat') + '</div><div class="empty-text">Ingen beskeder endnu.<br>Vær den første!</div></div>';
      return;
    }

    // Hent unikke profiler separat
    const userIds = [...new Set(msgs.map(m => m.user_id))];
    const { data: profiles } = await sb.from('profiles').select('id, name, title, avatar_url').in('id', userIds);
    const profileMap = {};
    (profiles || []).forEach(p => profileMap[p.id] = p);

    el.innerHTML = '';
    let lastDate = '';
    msgs.forEach(m => {
      m.profiles = profileMap[m.user_id] || { name: '?' };
      const d = new Date(m.created_at).toLocaleDateString('da-DK', {weekday:'long', day:'numeric', month:'short'});
      if (d !== lastDate) {
        const sep = document.createElement('div');
        sep.className = 'chat-date-sep';
        sep.textContent = d.toUpperCase();
        el.appendChild(sep);
        lastDate = d;
      }
      el.appendChild(bcRenderMsg(m));
    });
    bcScrollToBottom();
  } catch(e) { logError("bcLoadMessages", e); showToast(e.message || "Ukendt fejl"); }
}

function bcRenderMsg(m) {
  const isMe = m.user_id === currentUser.id;
  const p = m.profiles || {};
  const name = p.name || '?';
  const initials = name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  const time = new Date(m.created_at).toLocaleTimeString('da-DK', {hour:'2-digit', minute:'2-digit'});
  const gradients = ['linear-gradient(135deg,#2ECFCF,#22B8CF)','linear-gradient(135deg,#6366F1,#7C5CFC)','linear-gradient(135deg,#E879A8,#EC4899)','linear-gradient(135deg,#F59E0B,#EAB308)','linear-gradient(135deg,#1A9E8E,#10B981)','linear-gradient(135deg,#8B5CF6,#A855F7)','linear-gradient(135deg,#3B82F6,#6366F1)','linear-gradient(135deg,#EF4444,#F97316)','linear-gradient(135deg,#06B6D4,#0EA5E9)','linear-gradient(135deg,#D946EF,#C026D3)'];
  const color = gradients[Math.abs(name.charCodeAt(0)) % gradients.length];

  const row = document.createElement('div');
  row.className = 'msg-row' + (isMe ? ' me' : '');
  row.id = 'bc-msg-' + m.id;

  // Build content
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
    bubble = `<div class="msg-bubble${isMe ? ' sent' : ''}" id="bc-bubble-${m.id}">${escHtml(filterChatContent(m.content||''))}</div>`;
  }

  const editedTag = m.edited ? ` <span class="msg-edited" onclick="bcShowHistory('${m.id}')">redigeret</span>` : '';
  const nameHtml = escHtml(name);
  const safeTitle = escHtml(p.title||'');

  // Avatar: use photo if available
  const bcAvUrl = isMe ? currentProfile?.avatar_url : (p.avatar_url || null);
  const bcAvInner = bcAvUrl ? '<img src="'+bcAvUrl+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%">' : initials;

  row.innerHTML =
    `<div class="msg-avatar" style="background:${color};overflow:hidden" onclick="bcOpenPerson('${m.user_id}','${nameHtml}','${safeTitle}','${color}')">${bcAvInner}</div>` +
    `<div class="msg-body">` +
      `<div class="msg-head"><span class="msg-name">${nameHtml}</span><span class="msg-time">${time}${editedTag}</span></div>` +
      `<div class="msg-content">${bubble}<button class="msg-dots" onclick="bcOpenContext(event,this,${isMe},'${m.id}')" aria-label="Mere">⋯</button></div>` +
      `<div class="msg-reactions" id="bc-reactions-${m.id}"></div>` +
    `</div>`;

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
  var { data: p } = await sb.from('profiles').select('name,title,avatar_url').eq('id', userId).maybeSingle();
  if (p) _profileCache[userId] = p;
  return p || {};
  } catch(e) { logError("getCachedProfile", e); }
}

let bcSending = false;
async function bcSendMessage() {
  try {
  if (bcSending) return;
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
      const { data: orig } = await sb.from('bubble_messages').select('content').eq('id', bcEditingId).single();
      if (orig) {
        await sb.from('bubble_message_edits').insert({message_id: bcEditingId, content: orig.content});
      }
      await sb.from('bubble_messages').update({content: text, edited: true, updated_at: new Date().toISOString()}).eq('id', bcEditingId).eq('user_id', currentUser.id);
      // Update local
      const bubbleEl = document.getElementById('bc-bubble-' + bcEditingId);
      if (bubbleEl) {
        bubbleEl.textContent = text;
        const msgBody = bubbleEl.closest('.msg-body');
        const msgHead = msgBody?.querySelector('.msg-head');
        if (msgHead && !msgHead.querySelector('.msg-edited')) {
          const e = document.createElement('span');
          e.className = 'msg-edited';
          e.style.cssText = 'font-size:0.6rem;color:var(--muted);margin-left:0.3rem;cursor:pointer';
          const id = bcEditingId;
          e.textContent = 'redigeret';
          e.onclick = () => bcShowHistory(id);
          msgHead.appendChild(e);
        }
      }
      bcCancelEdit();
    } else {
      inp.value = '';

      const { data: newMsg, error } = await sb.from('bubble_messages').insert({
        bubble_id: bcBubbleId,
        user_id: currentUser.id,
        content: text
      }).select('id, bubble_id, user_id, content, file_url, file_name, file_size, file_type, edited, created_at').single();

      if (error) {
        console.error('bcSendMessage insert error:', error);
        showToast('Fejl: ' + (error.message || error.code || 'ukendt'));
        inp.value = text;
        return;
      }

      if (newMsg) {
        newMsg.profiles = {
          id: currentUser.id,
          name: currentProfile?.name || currentUser.email?.split('@')[0] || '?'
        };
        // Clear empty state if this is the first message
        var msgEl = document.getElementById('bc-messages');
        var emptyState = msgEl.querySelector('.empty-state');
        if (emptyState) emptyState.remove();
        msgEl.appendChild(bcRenderMsg(newMsg));
        bcScrollToBottom();
      }
    }
  } catch(e) { logError("bcSendMessage", e); showToast(e.message || "Ukendt fejl"); }
  finally { bcSending = false; var sb3 = document.getElementById("bc-send-btn"); if (sb3) { sb3.disabled = false; } }
  } catch(e) { logError("bcSendMessage", e); }
}

async function bcHandleFile(input) {
  try {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { showToast('Maks 10MB per fil'); return; }

    // File type allowlist — block HTML/SVG/JS to prevent stored XSS
    var blockedTypes = ['text/html','application/xhtml+xml','image/svg+xml','application/javascript','text/javascript','application/x-httpd-php'];
    var blockedExts = ['html','htm','svg','js','php','exe','bat','cmd','sh','ps1'];
    var ext = (file.name || '').split('.').pop().toLowerCase();
    if (blockedTypes.indexOf(file.type) >= 0 || blockedExts.indexOf(ext) >= 0) {
      showToast('Filtypen er ikke tilladt');
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
      showToast('Upload fejlede: ' + (uploadErr.message || uploadErr.error || 'ukendt fejl'));
      input.value = '';
      return;
    }

    // Use signed URL for privacy
    const { data: urlData, error: urlErr } = await sb.storage.from('bubble-files').createSignedUrl(path, 604800); // 7 days
    if (urlErr || !urlData?.signedUrl) { showToast('Kunne ikke generere fil-link'); input.value = ''; return; }

    const { data: newMsg, error: msgErr } = await sb.from('bubble_messages').insert({
      bubble_id: bcBubbleId,
      user_id: currentUser.id,
      content: '',
      file_url: urlData.signedUrl,
      file_name: file.name,
      file_type: file.type
    }).select('id, bubble_id, user_id, content, file_url, file_name, file_type, edited, created_at').single();

    if (msgErr) {
      console.error('File message insert error:', msgErr);
      showToast('Fil uploadet men besked fejlede');
      input.value = '';
      return;
    }

    if (newMsg) {
      newMsg.profiles = {
        id: currentUser.id,
        name: currentProfile?.name || currentUser.email?.split('@')[0] || '?'
      };
      var msgEl3 = document.getElementById('bc-messages');
      var es3 = msgEl3.querySelector('.empty-state');
      if (es3) es3.remove();
      msgEl3.appendChild(bcRenderMsg(newMsg));
      bcScrollToBottom();
      showToast('Fil sendt! 📎');
    }
    input.value = '';
  } catch(e) { logError("bcHandleFile", e); showToast(e.message || "Ukendt fejl"); }
}

function bcOpenContext(e, btn, isMe, msgId) {
  e.stopPropagation();
  bcCurrentMsgId = msgId;
  document.getElementById('bc-ctx-edit').style.display = isMe ? 'flex' : 'none';
  document.getElementById('bc-ctx-delete').style.display = isMe ? 'flex' : 'none';
  // Show history if message was edited
  const bubble = document.getElementById('bc-bubble-' + msgId);
  const msgGroup = document.getElementById('bc-msg-' + msgId);
  const wasEdited = msgGroup?.querySelector('.msg-edited, .chat-msg-edited');
  document.getElementById('bc-ctx-history').style.display = wasEdited ? 'flex' : 'none';
  const menu = document.getElementById('bc-context-menu');
  menu.style.display = 'block';
  menu.classList.add('open');
  const r = btn.getBoundingClientRect();
  let top = r.bottom + 4;
  let left = isMe ? r.right - 200 : r.left - 5;
  left = Math.max(8, Math.min(left, window.innerWidth - 210));
  if (top + 200 > window.innerHeight) top = r.top - 200;
  menu.style.top = top + 'px';
  menu.style.left = left + 'px';
  // Remove first to prevent stacking, then add
  document.removeEventListener('click', _bcCloseContextHandler);
  setTimeout(function() { document.addEventListener('click', _bcCloseContextHandler); }, 10);
}

function _bcCloseContextHandler() {
  bcCloseContext();
  document.removeEventListener('click', _bcCloseContextHandler);
}

async function bcReact(emoji) {
  bcCloseContext();
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
  } catch(e) { logError("bcReact", e); showToast(e.message || "Reaktion fejlede"); }
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
      return `<button class="chat-reaction-pill${mine ? ' mine' : ''}" onclick="bcToggleReaction('${msgId}','${emoji}')" title="${names.join(', ')}">${emoji} ${names.length}</button>`;
    }).join('');
  } catch(e) { /* silent */ }
}

async function bcToggleReaction(msgId, emoji) {
  try {
  bcCurrentMsgId = msgId;
  await bcReact(emoji);
  } catch(e) { logError("bcToggleReaction", e); }
}

function bcCloseContext() {
  const m = document.getElementById('bc-context-menu');
  m.classList.remove('open');
  setTimeout(() => m.style.display='none', 150);
}

function bcStartEdit() {
  if (!bcCurrentMsgId) return;
  bcCloseContext();
  bcEditingId = bcCurrentMsgId;
  const bubbleEl = document.getElementById('bc-bubble-' + bcEditingId);
  if (!bubbleEl) return;
  document.getElementById('bc-input').value = bubbleEl.textContent;
  document.getElementById('bc-input').focus();
  document.getElementById('bc-edit-bar').classList.add('show');
  document.getElementById('bc-send-btn').innerHTML = icon('check');
}

function bcCancelEdit() {
  bcEditingId = null;
  document.getElementById('bc-input').value = '';
  document.getElementById('bc-edit-bar').classList.remove('show');
  document.getElementById('bc-send-btn').textContent = '→';
}

async function bcDeleteMessage() {
  try {
    if (!bcCurrentMsgId) return;
    bcCloseContext();
    await sb.from('bubble_messages').delete().eq('id', bcCurrentMsgId).eq('user_id', currentUser.id);
    document.getElementById('bc-msg-' + bcCurrentMsgId)?.remove();
    showToast('Besked slettet');
  } catch(e) { logError("bcDeleteMessage", e); showToast(e.message || "Ukendt fejl"); }
}

async function bcShowHistory(msgId) {
  try {
    const { data: edits } = await sb.from('bubble_message_edits')
      .select('content, edited_at').eq('message_id', msgId).order('edited_at', {ascending:true});
    const { data: current } = await sb.from('bubble_messages').select('content').eq('id', msgId).single();
    if (!edits || edits.length === 0) { showToast('Ingen historik'); return; }
    const modal = document.getElementById('modal-edit-history') || bcCreateHistoryModal();
    const content = document.getElementById('edit-history-content');
    content.innerHTML = edits.map((e,i) => {
      const t = new Date(e.edited_at).toLocaleTimeString('da-DK',{hour:'2-digit',minute:'2-digit'});
      return `<div style="padding:0.55rem 0;border-bottom:1px solid var(--border)">
        <div style="font-size:0.62rem;color:var(--muted);margin-bottom:0.2rem;font-family:monospace">${i===0?'Originalt':'Redigeret '+i} · ${t}</div>
        <div style="font-size:0.82rem;color:var(--muted)">${escHtml(e.content)}</div>
      </div>`;
    }).join('') + `<div style="padding:0.55rem 0"><div style="font-size:0.62rem;color:var(--muted);margin-bottom:0.2rem;font-family:monospace">Nuværende</div><div style="font-size:0.82rem">${escHtml(current?.content||'')}</div></div>`;
    openModal('modal-edit-history');
  } catch(e) { logError("bcShowHistory", e); showToast(e.message || "Ukendt fejl"); }
}

function bcCreateHistoryModal() {
  const m = document.createElement('div');
  m.id = 'modal-edit-history';
  m.className = 'modal';
  m.innerHTML = `<div class="modal-content"><div class="modal-header"><div class="modal-title">${icon("edit")} Redigeringshistorik</div><button class="modal-close" onclick="closeModal('modal-edit-history')">${icon('x')}</button></div><div id="edit-history-content" style="padding:0 1.25rem 1rem;overflow-y:auto;max-height:60vh"></div></div>`;
  document.getElementById('app-root').appendChild(m);
  return m;
}

async function bcLoadMembers() {
  try {
    const list = document.getElementById('bc-members-list');
    list.innerHTML = skelCards(4);

    const expireCutoff = new Date(Date.now() - LIVE_EXPIRE_HOURS * 60 * 60 * 1000).toISOString();

    const { data: members } = await sb.from('bubble_members')
      .select('user_id, joined_at, checked_in_at, checked_out_at')
      .eq('bubble_id', bcBubbleId)
      .order('joined_at', {ascending:true});

    if (!members || members.length === 0) {
      list.innerHTML = '<div class="empty-state"><div class="empty-icon">' + icon('users') + '</div><div class="empty-text">Ingen medlemmer</div></div>';
      return;
    }

    // Hent profiler separat
    const userIds = members.map(m => m.user_id);
    const { data: profiles } = await sb.from('profiles').select('id, name, title, avatar_url').in('id', userIds);
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

    // Sort: owner first, then live members, then rest
    const sorted = [...members].filter(m => !isBlocked(m.user_id)).sort((a, b) => {
      if (a.user_id === ownerId) return -1;
      if (b.user_id === ownerId) return 1;
      if (a._isLive && !b._isLive) return -1;
      if (!a._isLive && b._isLive) return 1;
      return 0;
    });

    const liveCount = members.filter(m => m._isLive).length;

    // Section labels — event-aware terminology
    var isEvent = bcBubbleData?.type === 'event' || bcBubbleData?.type === 'live';
    let html = '';
    let prevSection = '';
    sorted.forEach((m, i) => {
      const p = profileMap[m.user_id] || {};
      const initials = (p.name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
      const color = colors[i % colors.length];
      const isOwnerRow = m.user_id === ownerId;

      // Section labels
      let section = isOwnerRow ? 'owner' : (m._isLive ? 'live' : 'members');
      if (section !== prevSection) {
        if (section === 'owner') html += `<div class="chat-section-label">${isEvent ? 'Arrangør' : 'Ejer'}</div>`;
        else if (section === 'live') html += `<div class="chat-section-label" style="margin-top:0.8rem">${isEvent ? 'Til stede nu' : 'Her lige nu'} · ${liveCount}</div>`;
        else {
          var restCount = members.length - liveCount - (ownerId ? 1 : 0);
          html += `<div class="chat-section-label" style="margin-top:0.8rem">${isEvent ? 'Deltagere' : 'Medlemmer'} · ${restCount}</div>`;
        }
        prevSection = section;
      }

      const liveBadge = m._isLive ? '<span class="live-badge-mini">LIVE</span>' : '';

      // Status line: for events, show check-in time; for networks, show title
      var statusText = escHtml(p.title || '');
      if (isEvent && !isOwnerRow && !m._isLive && m.checked_in_at) {
        var checkinTime = new Date(m.checked_in_at).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });
        statusText = (statusText ? statusText + ' · ' : '') + '<span style="color:var(--muted)">Var her kl. ' + checkinTime + '</span>';
      }

      // Role label
      var roleLabel = isEvent ? 'Arrangør' : 'Ejer';

      html += `<div class="chat-member-row" data-member-uid="${m.user_id}" onclick="bcOpenPerson('${m.user_id}','${escHtml(p.name||'')}','${escHtml(p.title||'')}','${color}')">
        <div class="chat-member-avatar" style="background:${color}">${initials}${m._isLive ? '<span class="live-dot"></span>' : ''}</div>
        <div style="flex:1;min-width:0"><div class="chat-member-name">${escHtml(p.name||'Ukendt')} ${liveBadge}</div><div class="chat-member-status">${statusText}</div></div>
        ${isOwnerRow ? '<span class="chat-member-role">' + roleLabel + '</span>' : (isOwner && !isOwnerRow ? '<button class="bc-kick-btn" onclick="event.stopPropagation();bcShowKickConfirm(this,\'' + m.user_id + '\',\'' + escHtml(p.name||'Ukendt').replace(/'/g,'') + '\')" title="Fjern fra boble">' + icon('x') + '</button>' : '')}
      </div>`;
    });
    list.innerHTML = html;
  } catch(e) { logError("bcLoadMembers", e); showToast(e.message || "Ukendt fejl"); }
}

// ── Bubble owner: kick/remove member (inline confirm tray) ──
function bcShowKickConfirm(btn, userId, userName) {
  var row = btn.closest('.chat-member-row');
  if (!row) return;
  bbConfirm(row, {
    label: 'Fjern ' + userName + '?',
    confirmText: 'Fjern',
    confirmClass: 'bb-confirm-btn-danger',
    onConfirm: "event.stopPropagation();bcConfirmKick('" + userId + "','" + userName + "')"
  });
}

async function bcConfirmKick(userId, userName) {
  if (!bcBubbleId || !currentUser) return;
  if (bcBubbleData?.created_by !== currentUser.id) { showToast('Kun ejeren kan fjerne medlemmer'); return; }
  try {
    var { error } = await sb.from('bubble_members').delete()
      .eq('bubble_id', bcBubbleId).eq('user_id', userId);
    if (error) throw error;
    showToast(userName + ' er fjernet fra boblen');
    bcLoadMembers();
  } catch(e) { logError('bcConfirmKick', e, { bubbleId: bcBubbleId, userId: userId }); showToast('Fejl: ' + (e.message || 'ukendt')); }
}

async function bcLoadInfo() {
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
    var mc = b.member_count;
    if (mc == null) {
      var { count: c } = await sb.from('bubble_members').select('*', { count: 'exact', head: true }).eq('bubble_id', b.id);
      mc = c || 0;
    }

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
    var heroIcon = isEvent ? icon('calendar') : ico('bubble');

    // ── Parent reference (only for events with parent_bubble_id) ──
    var parentHtml = '';
    if (isEvent && b.parent_bubble_id) {
      try {
        var { data: parent } = await sb.from('bubbles').select('id,name').eq('id', b.parent_bubble_id).maybeSingle();
        if (parent) {
          parentHtml = '<div onclick="openBubble(\'' + parent.id + '\')" style="display:flex;align-items:center;gap:0.55rem;padding:0.55rem 0.7rem;border-radius:12px;background:rgba(124,92,252,0.04);border:1px solid rgba(124,92,252,0.1);margin-bottom:0.9rem;cursor:pointer">' +
            '<div style="width:24px;height:24px;border-radius:7px;background:rgba(124,92,252,0.1);display:flex;align-items:center;justify-content:center;flex-shrink:0">' + ico('bubble') + '</div>' +
            '<div style="flex:1"><div style="font-size:0.68rem;color:var(--muted)">Del af</div><div style="font-size:0.78rem;font-weight:600;color:#534AB7">' + escHtml(parent.name) + '</div></div>' +
            '<div style="font-size:0.88rem;color:var(--muted)">›</div></div>';
        }
      } catch(e) { /* silent */ }
    }

    // ── Child events (only for network bubbles) ──
    var eventsHtml = '';
    if (!isEvent) {
      try {
        var { data: childEvents } = await sb.from('bubbles')
          .select('id, name, type, created_at, event_date, bubble_members(count)')
          .eq('parent_bubble_id', b.id)
          .eq('type', 'event')
          .order('event_date', { ascending: true, nullsFirst: false })
          .limit(10);
        if (childEvents && childEvents.length > 0) {
          var eventCards = childEvents.map(function(ev) {
            var evMc = ev.bubble_members?.[0]?.count || 0;
            var dateStr = ev.event_date
              ? new Date(ev.event_date).toLocaleDateString('da-DK', { weekday: 'short', day: 'numeric', month: 'short' }) +
                (new Date(ev.event_date).getHours() > 0 ? ' kl. ' + new Date(ev.event_date).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' }) : '')
              : new Date(ev.created_at).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
            return '<div onclick="openBubble(\'' + ev.id + '\')" style="display:flex;align-items:center;gap:0.6rem;padding:0.55rem 0.65rem;border-radius:12px;background:rgba(46,207,207,0.04);border:1px solid rgba(46,207,207,0.12);cursor:pointer">' +
              '<div style="width:34px;height:34px;border-radius:10px;background:rgba(46,207,207,0.1);display:flex;align-items:center;justify-content:center;flex-shrink:0">' + icon('calendar') + '</div>' +
              '<div style="flex:1;min-width:0"><div style="font-size:0.78rem;font-weight:600;color:var(--text)">' + escHtml(ev.name) + '</div>' +
              '<div style="font-size:0.68rem;color:var(--muted)">' + dateStr + ' · ' + evMc + ' tilmeldt</div></div>' +
              '<div style="font-size:0.88rem;color:var(--muted)">›</div></div>';
          }).join('');
          eventsHtml = '<div style="margin-bottom:0.9rem">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.4rem">' +
            '<div style="font-size:0.68rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.04em">Events</div>' +
            '<div style="font-size:0.68rem;color:#0F6E56;font-weight:600">' + childEvents.length + ' kommende</div></div>' +
            '<div style="display:flex;flex-direction:column;gap:0.4rem">' + eventCards + '</div>' +
            (canEdit ? '<button onclick="openCreateEventFromBubble(\'' + b.id + '\')" style="width:100%;padding:0.6rem;border-radius:12px;background:rgba(46,207,207,0.05);border:1px solid rgba(46,207,207,0.15);color:#085041;font-size:0.78rem;font-weight:700;cursor:pointer;font-family:var(--font);display:flex;align-items:center;justify-content:center;gap:0.35rem;margin-top:0.4rem">' + icon('calendar') + ' Opret event</button>' : '') +
            '</div>';
        } else if (canEdit) {
          eventsHtml = '<div style="margin-bottom:0.9rem">' +
            '<div style="font-size:0.68rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:0.4rem">Events</div>' +
            '<button onclick="openCreateEventFromBubble(\'' + b.id + '\')" style="width:100%;padding:0.6rem;border-radius:12px;background:rgba(46,207,207,0.05);border:1px solid rgba(46,207,207,0.15);color:#085041;font-size:0.78rem;font-weight:700;cursor:pointer;font-family:var(--font);display:flex;align-items:center;justify-content:center;gap:0.35rem">' + icon('calendar') + ' Opret event</button></div>';
        }
      } catch(e) { logError('bcLoadInfo:childEvents', e); }
    }

    // ── Quick actions ──
    var quickActions = '<div style="display:flex;gap:0.4rem;margin-bottom:0.9rem">' +
      '<div onclick="toggleBubbleUpvote(\'' + b.id + '\')" style="flex:1;display:flex;flex-direction:column;align-items:center;gap:0.25rem;padding:0.65rem 0.4rem;border-radius:14px;background:' + accentBg + '0.04);border:1px solid ' + accentBg + '0.1);cursor:pointer">' +
        '<span style="width:16px;height:16px;display:flex;align-items:center;justify-content:center;color:' + accentStroke + '">' + (myUpvotes[b.id] ? icon('checkCircle') : icon('rocket')) + '</span>' +
        '<div style="font-size:0.68rem;font-weight:600;color:' + accentTxt + '">' + (myUpvotes[b.id] ? 'Anbefalet' : 'Anbefal') + '</div></div>' +
      '<div data-action="openQRModal" data-id="' + b.id + '" style="flex:1;display:flex;flex-direction:column;align-items:center;gap:0.25rem;padding:0.65rem 0.4rem;border-radius:14px;background:' + accentBg + '0.04);border:1px solid ' + accentBg + '0.1);cursor:pointer">' +
        '<span style="width:16px;height:16px;display:flex;align-items:center;justify-content:center;color:' + accentStroke + '">' + icon('qrcode') + '</span>' +
        '<div style="font-size:0.68rem;font-weight:600;color:' + accentTxt + '">Del QR</div></div>' +
      '<div onclick="openInviteModal(\'' + b.id + '\')" style="flex:1;display:flex;flex-direction:column;align-items:center;gap:0.25rem;padding:0.65rem 0.4rem;border-radius:14px;background:' + accentBg + '0.04);border:1px solid ' + accentBg + '0.1);cursor:pointer">' +
        '<span style="width:16px;height:16px;display:flex;align-items:center;justify-content:center;color:' + accentStroke + '">' + icon('user-plus') + '</span>' +
        '<div style="font-size:0.68rem;font-weight:600;color:' + accentTxt + '">Inviter</div></div>' +
    '</div>';

    // ── Admin section (role-aware, type-aware) ──
    var adminHtml = '';
    if (canEdit) {
      var adminItems = '';
      // Event-only: scanner
      if (isEvent) {
        adminItems += '<div onclick="openBubbleScannerFromInfo(\'' + b.id + '\')" style="display:flex;align-items:center;gap:0.6rem;padding:0.65rem 0.75rem;background:rgba(26,158,142,0.03);cursor:pointer">' +
          '<span style="width:15px;height:15px;display:flex;align-items:center;justify-content:center;color:#1A9E8E">' + icon('camera') + '</span>' +
          '<div style="flex:1;font-size:0.8rem;font-weight:600;color:#085041">Scan deltagere ind</div>' +
          '<div style="font-size:0.88rem;color:var(--muted)">›</div></div>' +
          '<div style="height:1px;background:var(--glass-border-subtle);margin:0 0.75rem"></div>';
      }
      // Shared: admins
      if (isOwner) {
        adminItems += '<div onclick="openAdminDesignation(\'' + b.id + '\')" style="display:flex;align-items:center;gap:0.6rem;padding:0.65rem 0.75rem;cursor:pointer">' +
          '<span style="width:15px;height:15px;display:flex;align-items:center;justify-content:center;color:var(--muted)">' + icon('users') + '</span>' +
          '<div style="flex:1;font-size:0.8rem;color:var(--text-secondary)">Udpeg admins</div>' +
          '<div style="font-size:0.88rem;color:var(--muted)">›</div></div>' +
          '<div style="height:1px;background:var(--glass-border-subtle);margin:0 0.75rem"></div>';
      }
      // Shared: download list
      adminItems += '<div onclick="downloadMembersPdf(\'' + b.id + '\')" style="display:flex;align-items:center;gap:0.6rem;padding:0.65rem 0.75rem;cursor:pointer">' +
        '<span style="width:15px;height:15px;display:flex;align-items:center;justify-content:center;color:var(--muted)">' + icon('file') + '</span>' +
        '<div style="flex:1;font-size:0.8rem;color:var(--text-secondary)">Download ' + memberLabel + 'liste</div>' +
        '<div style="font-size:0.88rem;color:var(--muted)">›</div></div>';
      // Event-only: rapport
      if (isEvent) {
        adminItems += '<div style="height:1px;background:var(--glass-border-subtle);margin:0 0.75rem"></div>' +
          '<div onclick="generateEventReport(\'' + b.id + '\')" style="display:flex;align-items:center;gap:0.6rem;padding:0.65rem 0.75rem;cursor:pointer">' +
          '<span style="width:15px;height:15px;display:flex;align-items:center;justify-content:center;color:var(--muted)">' + icon('file') + '</span>' +
          '<div style="flex:1;font-size:0.8rem;color:var(--text-secondary)">Event-rapport</div>' +
          '<div style="font-size:0.88rem;color:var(--muted)">›</div></div>';
      }
      // Owner: transfer
      if (isOwner) {
        adminItems += '<div style="height:1px;background:var(--glass-border-subtle);margin:0 0.75rem"></div>' +
          '<div onclick="openTransferOwnership(\'' + b.id + '\')" style="display:flex;align-items:center;gap:0.6rem;padding:0.65rem 0.75rem;cursor:pointer">' +
          '<span style="width:15px;height:15px;display:flex;align-items:center;justify-content:center;color:var(--muted)">' + icon('crown') + '</span>' +
          '<div style="flex:1;font-size:0.8rem;color:var(--text-secondary)">Overdrag ejerskab</div>' +
          '<div style="font-size:0.88rem;color:var(--muted)">›</div></div>';
      }
      adminHtml = '<div style="margin-bottom:0.9rem">' +
        '<div style="font-size:0.68rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:0.35rem">' + (isEvent ? 'Event-administration' : 'Administration') + '</div>' +
        '<div style="border-radius:12px;border:1px solid var(--glass-border-subtle);overflow:hidden">' + adminItems + '</div></div>';
    }

    // ── Destructive actions ──
    var destructHtml = '<div style="display:flex;flex-direction:column;gap:0.4rem;border-top:1px solid var(--glass-border-subtle);padding-top:0.8rem">' +
      '<button data-action="leaveBubble" data-id="' + b.id + '" style="width:100%;padding:0.65rem;border-radius:12px;background:rgba(239,68,68,0.03);border:1px solid rgba(239,68,68,0.1);color:#A32D2D;font-size:0.8rem;font-weight:600;cursor:pointer;font-family:var(--font)">Forlad ' + (isEvent ? 'event' : 'boblen') + '</button>' +
      (isOwner ? '<button onclick="confirmPopBubble(\'' + b.id + '\')" style="width:100%;padding:0.65rem;border-radius:12px;background:rgba(239,68,68,0.03);border:1px solid rgba(239,68,68,0.1);color:#791F1F;font-size:0.8rem;font-weight:600;cursor:pointer;font-family:var(--font)">Slet ' + (isEvent ? 'event' : 'boble') + '</button>' : '') +
      '</div>';

    // ── Assemble ──
    list.innerHTML =
      parentHtml +
      '<div style="text-align:center;padding:0.25rem 0 1rem">' +
        '<div style="width:52px;height:52px;border-radius:15px;background:' + iconBg + ';display:flex;align-items:center;justify-content:center;margin:0 auto 0.5rem;color:' + accentStroke + '">' + heroIcon + '</div>' +
        '<div style="font-size:1rem;font-weight:800;color:var(--text)">' + escHtml(b.name) + '</div>' +
        '<div style="font-size:0.75rem;color:var(--muted);margin-top:0.15rem">' + typeLabel(b.type) + (b.location ? ' · ' + escHtml(b.location) : '') + ' · ' + mc + ' ' + memberLabel + '</div>' +
        (b.description ? '<div style="font-size:0.8rem;color:var(--text-secondary);margin-top:0.5rem;line-height:1.5;text-align:left">' + escHtml(b.description) + '</div>' : '') +
        (tagsHtml ? '<div style="display:flex;flex-wrap:wrap;gap:0.3rem;margin-top:0.5rem;justify-content:center">' + tagsHtml + '</div>' : '') +
      '</div>' +
      quickActions +
      eventsHtml +
      adminHtml +
      destructHtml;

  } catch(e) { logError("bcLoadInfo", e); showToast(e.message || "Ukendt fejl"); }
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

    // Render
    list.innerHTML = _bcPostsCache.map(function(post) {
      return bcRenderPostCard(post, _bcPostsProfileCache[post.author_id], eventMap[post.event_id]);
    }).join('');

  } catch(e) {
    logError('bcLoadPosts', e);
    showRetryState('bc-posts-list', 'bcLoadPosts', 'Kunne ikke hente opslag');
  }
}

function bcRenderPostCard(post, author, event) {
  var name = author ? escHtml(author.name || '') : 'Ukendt';
  var initials = name.split(' ').map(function(w) { return w[0] || ''; }).join('').slice(0, 2).toUpperCase();
  var avatarHtml = author && author.avatar_url
    ? '<div class="bp-avatar">' + safeAvatarImg(author.avatar_url, 'width:100%;height:100%;object-fit:cover;border-radius:50%') + '</div>'
    : '<div class="bp-avatar" style="background:var(--accent)">' + initials + '</div>';

  var roleLabel = '';
  if (bcBubbleData && post.author_id === bcBubbleData.created_by) roleLabel = 'Ejer';
  else roleLabel = 'Admin';

  var ago = timeAgo(post.created_at);
  var preview = escHtml((post.content || '').slice(0, 140));
  var hasMore = (post.content || '').length > 140;

  var eventChip = '';
  if (event) {
    eventChip = '<div class="bp-event-chip" onclick="event.stopPropagation();openBubbleChat(\'' + event.id + '\',\'screen-bubble-chat\')">' +
      ico('calendar') + ' ' + escHtml(event.name) + ' ›</div>';
  }

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
    '</div>';
}

function bcExpandPost(postId) {
  var post = (_bcPostsCache || []).find(function(p) { return p.id === postId; });
  if (!post) return;
  var author = _bcPostsProfileCache[post.author_id];
  var name = author ? escHtml(author.name || '') : 'Ukendt';
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
      '<div style="width:32px;height:32px;border-radius:10px;background:rgba(46,207,207,0.1);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--green)">' + ico('calendar') + '</div>' +
      '<div style="flex:1;min-width:0"><div style="font-size:0.78rem;font-weight:700;color:var(--green)" id="bp-expand-event-name">Henter event...</div></div>' +
      '<div style="font-size:0.88rem;color:var(--green)">›</div></div>';
  }

  // Delete button for owner/admin
  var deleteBtn = '';
  var canDelete = bcBubbleData && (bcBubbleData._isOwner || bcBubbleData._isAdmin || post.author_id === currentUser.id);
  if (canDelete) {
    deleteBtn = '<button onclick="bcDeletePost(\'' + postId + '\')" style="width:100%;margin-top:0.6rem;padding:0.5rem;border-radius:10px;border:1px solid rgba(232,121,168,0.2);background:none;color:var(--accent2);font-family:inherit;font-size:0.72rem;font-weight:600;cursor:pointer">Slet opslag</button>';
  }

  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:999;background:rgba(30,27,46,0.25);display:flex;align-items:flex-end;justify-content:center;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)';
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

  var sheet = document.createElement('div');
  sheet.style.cssText = 'width:100%;max-width:680px;max-height:85vh;overflow-y:auto;background:rgba(255,255,255,0.98);backdrop-filter:blur(20px);border-radius:24px 24px 0 0;padding:1.5rem;color:var(--text);font-family:Figtree,sans-serif';
  sheet.innerHTML = '<div style="width:36px;height:4px;border-radius:99px;background:rgba(30,27,46,0.08);margin:0 auto 1rem;cursor:pointer" onclick="this.closest(\'[style*=backdrop-filter]\').remove()"></div>' +
    '<div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:1rem">' + avatarHtml +
    '<div><div style="font-size:0.88rem;font-weight:700">' + name + '</div>' +
    '<div style="font-size:0.65rem;color:var(--muted)">' + timeAgo(post.created_at) + '</div></div></div>' +
    '<div style="font-size:1.05rem;font-weight:800;margin-bottom:0.6rem">' + escHtml(post.title) + '</div>' +
    '<div style="font-size:0.88rem;color:var(--text-secondary);line-height:1.65">' + contentHtml + '</div>' +
    eventCard +
    '<button onclick="this.closest(\'[style*=backdrop-filter]\').remove()" style="width:100%;margin-top:1.2rem;padding:0.65rem;border-radius:12px;border:1px solid var(--glass-border);background:none;color:var(--text-secondary);font-family:inherit;font-size:0.78rem;font-weight:600;cursor:pointer">Luk</button>' +
    deleteBtn;

  overlay.appendChild(sheet);
  document.body.appendChild(overlay);

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

async function bcSubmitPost() {
  var title = document.getElementById('bp-title').value.trim();
  var content = document.getElementById('bp-content').value.trim();
  if (!title) { showToast('Titel er påkrævet'); return; }

  var picker = document.getElementById('bp-event-picker');
  var selectedEvent = picker ? picker._selectedEvent || null : null;

  try {
    showToast('Publicerer...');
    var { error } = await sb.from('bubble_posts').insert({
      bubble_id: bcBubbleId,
      author_id: currentUser.id,
      title: title,
      content: content || null,
      event_id: selectedEvent
    });
    if (error) throw error;

    closeModal('sheet-create-post');
    showSuccessToast('Opslag publiceret');
    trackEvent('post_created', { bubble_id: bcBubbleId });
    bcLoadPosts();
  } catch(e) {
    logError('bcSubmitPost', e);
    showToast('Fejl: ' + (e.message || 'ukendt'));
  }
}

async function bcDeletePost(postId) {
  try {
    var overlay = document.querySelector('[style*="backdrop-filter"]');
    if (!overlay) return;
    var target = overlay.querySelector('.modal-sheet, div[style*="border-radius:24px"]');
    if (target) {
      bbConfirm(target, {
        label: 'Slet dette opslag?',
        confirmText: 'Slet',
        confirmClass: 'bb-confirm-btn-danger',
        onConfirm: "bcConfirmDeletePost('" + postId + "')"
      });
    }
  } catch(e) { logError('bcDeletePost', e); }
}

async function bcConfirmDeletePost(postId) {
  try {
    await sb.from('bubble_posts').delete().eq('id', postId);
    // Close expand tray
    var overlay = document.querySelector('[style*="backdrop-filter"]');
    if (overlay) overlay.remove();
    showSuccessToast('Opslag slettet');
    bcLoadPosts();
  } catch(e) {
    logError('bcConfirmDeletePost', e);
    showToast('Fejl: ' + (e.message || 'ukendt'));
  }
}


