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
        document.getElementById('bc-messages').appendChild(bcRenderMsg(msg));
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
function bcUnsubscribe() {
  if (bcSubscription) { bcSubscription.unsubscribe(); bcSubscription = null; }
}
function dmUnsubscribe() {
  if (chatSubscription) { chatSubscription.unsubscribe(); chatSubscription = null; }
}
function incomingUnsubscribe() {
  _globalRtChannels.forEach(function(ch) { try { ch.unsubscribe(); } catch(e) {} });
  _globalRtChannels = [];
}
function bcUnsubscribeAll() {
  bcUnsubscribe();
  dmUnsubscribe();
  incomingUnsubscribe();
}

async function openBubbleChat(bubbleId, fromScreen) {
  if (!currentUser || !bubbleId) { console.warn('openBubbleChat: missing user or bubbleId'); return; }
  console.debug('[bc] openBubbleChat:', bubbleId, 'from:', fromScreen);
  try {
    bcBubbleId = bubbleId;
    const backBtn = document.getElementById('bc-back-btn');
    backBtn.onclick = () => goTo(fromScreen || _activeScreen || 'screen-home');
    goTo('screen-bubble-chat');

    // Land altid på Medlemmer-tab
    bcSwitchTab('members');

    // Hent boble-info og vis metadata + actions i topbar
    const { data: b } = await sb.from('bubbles').select('*').eq('id', bubbleId).single();
    if (!b) {
      showToast('Denne boble eksisterer ikke længere');
      goTo(fromScreen || _activeScreen || 'screen-home');
      return;
    }
    bcBubbleData = b;

    document.getElementById('bc-emoji').innerHTML = bubbleEmoji(b.type);
    document.getElementById('bc-name').textContent = b.name;
    // Hero gradient based on bubble type
    var _heroGrads = {'event':'linear-gradient(135deg,#2A7A90,#3AAA88)','live':'linear-gradient(135deg,#2ECFCF,#2E9E8E)','local':'linear-gradient(135deg,#10B981,#065F46)','topic':'linear-gradient(135deg,#2E9E8E,#164E4E)','company':'linear-gradient(135deg,#1A5A6A,#1A7A7A)'};
    var hg = document.getElementById('bc-hero-gradient');
    var hi = document.getElementById('bc-hero-icon');
    if (hg) hg.style.background = _heroGrads[b.type] || _heroGrads['topic'];
    if (hi) hi.innerHTML = bubbleEmoji(b.type);

    // Use denormalized count if available, fallback to query
    var memberCount = b.member_count;
    if (memberCount == null) {
      var { count } = await sb.from('bubble_members').select('*',{count:'exact',head:true}).eq('bubble_id', bubbleId);
      memberCount = count || 0;
    }
    document.getElementById('bc-members-count').textContent = memberCount + ' medlemmer';

    // Vis actions i topbar baseret på membership
    await loadBubbleUpvotes();
    const { data: myMembership } = await sb.from('bubble_members')
      .select('id').eq('bubble_id', bubbleId).eq('user_id', currentUser.id).maybeSingle();

    const actionArea = document.getElementById('bc-action-btns');
    const isOwner = b.created_by === currentUser.id;
    if (myMembership) {
      actionArea.innerHTML =
        (isOwner ? `<button class="btn-sm btn-ghost" data-action="openEditBubble" data-id="${b.id}" style="font-size:0.82rem;padding:0.3rem 0.4rem" title="Rediger">${icon("edit")}</button>` : '');
      // Update action bar under tabs
      var actionBar = document.getElementById('bc-action-bar');
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
      var actionBar2 = document.getElementById('bc-action-bar'); if (actionBar2) actionBar2.style.display = 'none';
    } else if (b.visibility === 'private') {
      actionArea.innerHTML = `<button class="btn-sm btn-accent" data-action="requestJoin" data-id="${b.id}">${icon("lock")} Anmod</button>`;
      var actionBar3 = document.getElementById('bc-action-bar'); if (actionBar3) actionBar3.style.display = 'none';
    } else {
      actionArea.innerHTML = `<button class="btn-sm btn-accent" data-action="joinBubble" data-id="${b.id}">+ Join</button>`;
      var actionBar4 = document.getElementById('bc-action-bar'); if (actionBar4) actionBar4.style.display = 'none';
    }

    // Load data til aktive tabs
    await bcLoadMembers();

    // Load beskeder i baggrunden + subscribe (badge vises hvis der er ulæste)
    bcLoadMessages().then(() => {
      // Tjek om der er nye beskeder siden sidst — vis badge
      const badge = document.getElementById('bc-unread-badge');
      // Badge sættes via real-time subscription når man er på en anden tab
    });
    bcSubscribe();
  } catch(e) { logError("openBubbleChat", e); bcUnsubscribe(); showToast(e.message || "Ukendt fejl"); }
}

async function bcLoadBubbleInfo() {
  try {
    const { data: b } = await sb.from('bubbles').select('*').eq('id', bcBubbleId).single();
    if (!b) return;
    bcBubbleData = b;
    document.getElementById('bc-emoji').innerHTML = bubbleEmoji(b.type);
    document.getElementById('bc-name').textContent = b.name;
    var _heroGrads2 = {'event':'linear-gradient(135deg,#2A7A90,#3AAA88)','live':'linear-gradient(135deg,#2ECFCF,#2E9E8E)','local':'linear-gradient(135deg,#10B981,#065F46)','topic':'linear-gradient(135deg,#2E9E8E,#164E4E)','company':'linear-gradient(135deg,#1A5A6A,#1A7A7A)'};
    var hg2 = document.getElementById('bc-hero-gradient');
    var hi2 = document.getElementById('bc-hero-icon');
    if (hg2) hg2.style.background = _heroGrads2[b.type] || _heroGrads2['topic'];
    if (hi2) hi2.innerHTML = bubbleEmoji(b.type);
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
        countEl.innerHTML = statusText + ' · <span style="color:#10B981">LIVE</span> <span style="opacity:0.6">udl. ' + hh + ':' + mm + '</span>';
      } else {
        countEl.textContent = statusText + ' · Medlem ✓';
      }
    }
  } catch(e) { logError("bcLoadBubbleInfo", e); showToast(e.message || "Ukendt fejl"); }
}

function bcSwitchTab(tab) {
  ['chat','members','info'].forEach(t => {
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
  const gradients = ['linear-gradient(135deg,#065F46,#10B981)','linear-gradient(135deg,#7C2D12,#F97316)','linear-gradient(135deg,#1A5A6A,#1A7A7A)','linear-gradient(135deg,#164E4E,#4ABEAE)','linear-gradient(135deg,#0C4A6E,#38BDF8)'];
  const color = gradients[Math.abs(name.charCodeAt(0)) % gradients.length];

  const row = document.createElement('div');
  row.className = 'msg-row' + (isMe ? ' me' : '');
  row.id = 'bc-msg-' + m.id;

  // Build content
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
  var { data: p } = await sb.from('profiles').select('name,title,avatar_url').eq('id', userId).single();
  if (p) _profileCache[userId] = p;
  return p || {};
  } catch(e) { logError("getCachedProfile", e); }
}

function bcSubscribe() {
  if (!currentUser || !bcBubbleId) { console.warn('bcSubscribe: missing user or bubbleId'); return; }
  if (bcSubscription) bcSubscription.unsubscribe();
  bcSubscription = sb.channel('bc-' + bcBubbleId)
    .on('postgres_changes', {event:'INSERT', schema:'public', table:'bubble_messages', filter:`bubble_id=eq.${bcBubbleId}`},
      async (payload) => {
        const m = payload.new;
        if (m.user_id === currentUser.id) return;
        m.profiles = await getCachedProfile(m.user_id);
        const panel = document.getElementById('bc-panel-chat');
        if (panel.style.display !== 'none') {
          document.getElementById('bc-messages').appendChild(bcRenderMsg(m));
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
    // ── Realtime: member joins + check-in/out → opdater members-tab øjeblikkeligt ──
    .on('postgres_changes', {event:'INSERT', schema:'public', table:'bubble_members', filter:`bubble_id=eq.${bcBubbleId}`},
      () => { bcLoadMembers(); })
    .on('postgres_changes', {event:'UPDATE', schema:'public', table:'bubble_members', filter:`bubble_id=eq.${bcBubbleId}`},
      () => { bcLoadMembers(); })
    .subscribe();
}

let bcSending = false;
async function bcSendMessage() {
  try {
  if (bcSending) return;
  bcSending = true;
  var sendBtn = document.getElementById("bc-send-btn");
  if (sendBtn) { sendBtn.disabled = true; sendBtn.style.opacity = "0.4"; }
  console.debug('[bc] bcSendMessage');
  try {
    const inp = document.getElementById('bc-input');
    const text = filterChatContent(inp.value.trim());
    if (!text) { bcSending = false; if (sendBtn) { sendBtn.disabled = false; sendBtn.style.opacity = ''; } return; }

    if (bcEditingId) {
      // Save edit to history first
      const { data: orig } = await sb.from('bubble_messages').select('content').eq('id', bcEditingId).single();
      if (orig) {
        await sb.from('bubble_message_edits').insert({message_id: bcEditingId, content: orig.content});
      }
      await sb.from('bubble_messages').update({content: text, edited: true, updated_at: new Date().toISOString()}).eq('id', bcEditingId);
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
        document.getElementById('bc-messages').appendChild(bcRenderMsg(newMsg));
        bcScrollToBottom();
      }
    }
  } catch(e) { logError("bcSendMessage", e); showToast(e.message || "Ukendt fejl"); }
  finally { bcSending = false; var sb3 = document.getElementById("bc-send-btn"); if (sb3) { sb3.disabled = false; sb3.style.opacity = ""; } }
  } catch(e) { logError("bcSendMessage", e); }
}

async function bcHandleFile(input) {
  try {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { showToast('Maks 10MB per fil'); return; }

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
      document.getElementById('bc-messages').appendChild(bcRenderMsg(newMsg));
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
  setTimeout(() => document.addEventListener('click', bcCloseContext, {once:true}), 10);
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

    const colors = ['linear-gradient(135deg,#065F46,#10B981)','linear-gradient(135deg,#7C2D12,#F97316)','linear-gradient(135deg,#1A5A6A,#1A7A7A)','linear-gradient(135deg,#164E4E,#4ABEAE)','linear-gradient(135deg,#0C4A6E,#38BDF8)'];
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
        if (section === 'owner') html += `<div class="chat-section-label">Ejer</div>`;
        else if (section === 'live') html += `<div class="chat-section-label" style="margin-top:0.8rem">Her lige nu · ${liveCount}</div>`;
        else html += `<div class="chat-section-label" style="margin-top:0.8rem">Medlemmer · ${members.length - liveCount - (ownerId ? 1 : 0)}</div>`;
        prevSection = section;
      }

      const liveBadge = m._isLive ? '<span class="live-badge-mini">LIVE</span>' : '';

      html += `<div class="chat-member-row" data-member-uid="${m.user_id}" onclick="bcOpenPerson('${m.user_id}','${escHtml(p.name||'')}','${escHtml(p.title||'')}','${color}')">
        <div class="chat-member-avatar" style="background:${color}">${initials}${m._isLive ? '<span class="live-dot"></span>' : ''}</div>
        <div style="flex:1;min-width:0"><div class="chat-member-name">${escHtml(p.name||'Ukendt')} ${liveBadge}</div><div class="chat-member-status">${escHtml(p.title||'')}</div></div>
        ${isOwnerRow ? '<span class="chat-member-role">Ejer</span>' : (isOwner && !isOwnerRow ? '<button class="bc-kick-btn" onclick="event.stopPropagation();bcShowKickConfirm(this,\'' + m.user_id + '\',\'' + escHtml(p.name||'Ukendt').replace(/'/g,'') + '\')" title="Fjern fra boble">' + icon('x') + '</button>' : '')}
      </div>`;
    });
    list.innerHTML = html;
  } catch(e) { logError("bcLoadMembers", e); showToast(e.message || "Ukendt fejl"); }
}

// ── Bubble owner: kick/remove member (inline confirm tray) ──
function bcShowKickConfirm(btn, userId, userName) {
  var row = btn.closest('.chat-member-row');
  if (!row || row.querySelector('.kick-confirm')) return;
  var confirm = document.createElement('div');
  confirm.className = 'kick-confirm';
  confirm.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:0.5rem 0.6rem;margin-top:0.4rem;background:rgba(26,122,138,0.08);border:1px solid rgba(26,122,138,0.2);border-radius:10px;gap:0.5rem';
  confirm.onclick = function(e) { e.stopPropagation(); };
  confirm.innerHTML = '<span style="font-size:0.72rem;color:var(--text-secondary)">Fjern ' + userName + '?</span>' +
    '<div style="display:flex;gap:0.3rem">' +
    '<button class="btn-sm btn-ghost" style="padding:0.25rem 0.6rem;font-size:0.7rem;color:var(--accent2);border-color:rgba(26,122,138,0.3)" onclick="event.stopPropagation();bcConfirmKick(\'' + userId + '\',\'' + userName + '\')">Fjern</button>' +
    '<button class="btn-sm btn-ghost" style="padding:0.25rem 0.6rem;font-size:0.7rem" onclick="event.stopPropagation();bcCancelKick(this)">Annuller</button>' +
    '</div>';
  row.appendChild(confirm);
}

function bcCancelKick(btn) {
  var confirm = btn.closest('.kick-confirm');
  if (confirm) confirm.remove();
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
    const tags = (b.keywords||[]).map(k=>`<span class="tag">${escHtml(k)}</span>`).join('');
    const isOwner = currentUser && b.created_by === currentUser.id;

    // Member count — use denormalized if available
    var memberCount3 = b.member_count;
    if (memberCount3 == null) {
      var { count: mc } = await sb.from('bubble_members').select('*', { count: 'exact', head: true }).eq('bubble_id', b.id);
      memberCount3 = mc || 0;
    }

    list.innerHTML = `
      <div class="chat-info-block"><div class="chat-info-label">Beskrivelse</div><div class="chat-info-val">${escHtml(b.description||'Ingen beskrivelse')}</div></div>
      <div class="chat-info-block"><div class="chat-info-label">Interesser</div><div style="display:flex;flex-wrap:wrap;gap:0.4rem;margin-top:0.4rem">${tags||'–'}</div></div>
      <div class="chat-info-block"><div class="chat-info-label">Boble-type</div><div class="chat-info-val">${typeLabel(b.type)}</div></div>
      <div class="chat-info-block"><div class="chat-info-label">Sted</div><div class="chat-info-val">${escHtml(b.location||'Ikke angivet')}</div></div>
      <div class="chat-info-block"><div class="chat-info-label">Medlemmer</div><div class="chat-info-val">${memberCount3 || 0} personer</div></div>
      <div>
        <button class="${myUpvotes[b.id] ? 'chat-info-btn success' : 'chat-info-btn primary'}" id="bc-recommend-btn" onclick="toggleBubbleUpvote('${b.id}')">${myUpvotes[b.id] ? icon('checkCircle') + ' Anbefalet' : icon('rocket') + ' Anbefal denne boble'}</button>
        <button class="chat-info-btn primary" data-action="openQRModal" data-id="${b.id}">${icon("qrcode")} Del boble / QR-kode</button>
        ${isOwner ? `<button class="chat-info-btn primary" onclick="downloadMembersPdf('${b.id}')" style="background:rgba(46,158,142,0.12);border-color:rgba(46,158,142,0.3);color:var(--accent)">${icon('users')} Download deltagerliste (PDF)</button>` : ''}
        <button class="chat-info-btn danger" data-action="leaveBubble" data-id="${b.id}">${icon("logout")} Forlad boblen</button>
      </div>`;
  } catch(e) { logError("bcLoadInfo", e); showToast(e.message || "Ukendt fejl"); }
}

// Person sheet from chat avatar


