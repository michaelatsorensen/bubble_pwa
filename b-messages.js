// ══════════════════════════════════════════════════════════
//  BUBBLE — MESSAGES + DM COMPOSER
//  DOMAIN: messages
//  OWNS: dmSending, convSelectedIds
//  OWNS: sendMessage, startChat, convDeleteSelected
//  READS: currentUser, currentPerson, currentChatUser
//  Auto-split from app.js · v3.7.0
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
//  MESSAGES — Hybrid unread badge
//  _unreadRecount: full DB count (boot, reconnect, drift)
//  _unreadRender: DOM update from local counter
//  unreadIncrement/unreadDecrement: instant local adjustments
// ══════════════════════════════════════════════════════════
var _unreadCount = 0;

function _unreadRender() {
  var label = _unreadCount > 9 ? '9+' : (_unreadCount > 0 ? _unreadCount : '');
  document.querySelectorAll('.msg-unread-badge').forEach(function(b) {
    if (_unreadCount > 0) { b.textContent = label; b.style.display = 'flex'; }
    else { b.style.display = 'none'; }
  });
}

async function _unreadRecount() {
  try {
    if (!currentUser) return;
    var { count } = await sb.from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', currentUser.id)
      .is('read_at', null);
    _unreadCount = count || 0;
    _unreadRender();
  } catch(e) { logError('_unreadRecount', e); }
}

function unreadIncrement() { _unreadCount++; _unreadRender(); }
function unreadDecrement(n) { _unreadCount = Math.max(0, _unreadCount - (n || 1)); _unreadRender(); }

// Compat alias — old callers that did full recount now just render local
async function updateUnreadBadge() { _unreadRender(); }


// ══════════════════════════════════════════════════════════
//  CONVERSATIONS: Multi-select delete
// ══════════════════════════════════════════════════════════
var convSelectMode = false;
var convSelectedIds = [];

function convToggleSelectMode() {
  convSelectMode = !convSelectMode;
  convSelectedIds = [];
  var toolbar = document.getElementById('conv-select-toolbar');
  var selectBtn = document.getElementById('conv-select-btn');
  var list = document.getElementById('conversations-list');

  if (convSelectMode) {
    if (toolbar) toolbar.style.display = 'flex';
    if (selectBtn) { selectBtn.textContent = 'Annuller'; selectBtn.style.color = 'var(--accent2)'; }
    // Add checkboxes to conversation cards
    if (list) {
      list.querySelectorAll('.card[data-conv-id]').forEach(function(card) {
        var id = card.getAttribute('data-conv-id');
        if (!id || card.querySelector('.conv-check')) return;
        var cb = document.createElement('div');
        cb.className = 'conv-check';
        cb.setAttribute('data-id', id);
        cb.onclick = function(e) { e.stopPropagation(); convToggleConv(id, this); };
        var flexRow = card.querySelector('.flex-row-center');
        if (flexRow) { flexRow.insertBefore(cb, flexRow.firstChild); }
        else { card.prepend(cb); }
      });
    }
  } else {
    if (toolbar) toolbar.style.display = 'none';
    if (selectBtn) { selectBtn.textContent = 'V\u00e6lg'; selectBtn.style.color = ''; }
    if (list) list.querySelectorAll('.conv-check').forEach(function(el) { el.remove(); });
  }
  convUpdateSelectCount();
}

function convToggleConv(id, el) {
  var idx = convSelectedIds.indexOf(id);
  if (idx >= 0) {
    convSelectedIds.splice(idx, 1);
    if (el) el.classList.remove('checked');
  } else {
    convSelectedIds.push(id);
    if (el) el.classList.add('checked');
  }
  convUpdateSelectCount();
}

function convSelectAll() {
  var list = document.getElementById('conversations-list');
  if (!list) return;
  convSelectedIds = [];
  list.querySelectorAll('.card[data-conv-id]').forEach(function(card) {
    var id = card.getAttribute('data-conv-id');
    if (id) {
      convSelectedIds.push(id);
      var cb = card.querySelector('.conv-check');
      if (cb) cb.classList.add('checked');
    }
  });
  convUpdateSelectCount();
}

function convUpdateSelectCount() {
  var countEl = document.getElementById('conv-select-count');
  var delBtn = document.getElementById('conv-delete-btn');
  var n = convSelectedIds.length;
  if (countEl) countEl.textContent = n + ' valgt';
  if (delBtn) {
    delBtn.disabled = n === 0;
    delBtn.textContent = n > 0 ? 'Slet ' + n : 'Slet';
  }
}

async function convDeleteSelected() {
  if (convSelectedIds.length === 0) return;
  var btn = document.getElementById('conv-delete-btn');
  if (!btn) return;
  bbConfirm(btn, {
    label: convSelectedIds.length + ' samtale' + (convSelectedIds.length > 1 ? 'r' : '') + ' slettes permanent',
    confirmText: 'Slet',
    confirmClass: 'bb-confirm-btn-danger',
    onConfirm: 'convConfirmDelete()'
  });
}

async function convConfirmDelete() {
  try {
    var ids = convSelectedIds.slice();
    for (var i = 0; i < ids.length; i++) {
      var partnerId = ids[i];
      await sb.from('messages').delete().or('and(sender_id.eq.' + currentUser.id + ',receiver_id.eq.' + partnerId + '),and(sender_id.eq.' + partnerId + ',receiver_id.eq.' + currentUser.id + ')');
    }
    var list = document.getElementById('conversations-list');
    ids.forEach(function(id) {
      var card = list ? list.querySelector('[data-conv-id="' + id + '"]') : null;
      if (card) { card.style.transition = 'opacity 0.2s'; card.style.opacity = '0'; setTimeout(function() { card.remove(); }, 200); }
    });
    showToast(ids.length + (ids.length === 1 ? ' samtale slettet' : ' samtaler slettet'));
    convToggleSelectMode();
    updateUnreadBadge();
  } catch(e) { logError('convConfirmDelete', e); showToast(e.message || 'Fejl ved sletning'); }
}



let dmSending = false;
async function sendMessage() {
  if (dmSending) return;
  dmSending = true;
  var sendBtn = document.getElementById("chat-send-btn");
  if (sendBtn) { sendBtn.disabled = true; }
  console.debug('[dm] sendMessage');
  try {
    if (isBlocked(currentChatUser)) { showToast('Denne bruger er blokeret'); return; }
    const input = document.getElementById('chat-input');
    const content = filterChatContent(input.value.trim());
    if (!content) return;
    if (dmEditingId) {
      await sb.from('messages').update({ content, edited: true }).eq('id', dmEditingId);
      const bubble = document.getElementById('dm-bubble-' + dmEditingId);
      if (bubble) bubble.textContent = content;
      dmEditingId = null;
      input.value = '';
      var editBar = document.getElementById('dm-edit-bar');
      if (editBar) editBar.style.display = 'none';
    } else {
      const { data: newMsg, error } = await sb.from('messages').insert({
        sender_id: currentUser.id,
        receiver_id: currentChatUser,
        content
      }).select().single();
      if (error) { logError('sendMessage:insert', error); showToast('Besked fejlede: ' + (error.message || 'ukendt')); return; }
      input.value = '';
      if (newMsg) {
        const el = document.getElementById('chat-messages');
        if (el && !el.querySelector('[data-msg-id="' + newMsg.id + '"]')) {
          // Clear empty-chat hero if present
          var emptyHero = el.querySelector('[style*="flex-direction:column"]');
          if (emptyHero && !el.querySelector('.msg-row')) emptyHero.remove();
          _dmMaybeInsertDateSep(el, newMsg.created_at);
          el.insertAdjacentHTML('beforeend', dmRenderMsg(newMsg));
          el.scrollTop = el.scrollHeight;
        }
        // Broadcast to recipient for instant delivery
        if (chatSubscription) {
          try { chatSubscription.send({ type: 'broadcast', event: 'new_message', payload: newMsg }); } catch(e) { logError("dm:new_message_broadcast", e); }
        }
        trackEvent('message_sent', { type: 'dm' });
      }
      input.focus();
    }
  } catch(e) { logError("sendMessage", e); showToast(e.message || "Ukendt fejl"); }
  finally { dmSending = false; if (sendBtn) { sendBtn.disabled = false; } }
}

async function sendDirectMessage(toId, content) {
  try {
    await sb.from('messages').insert({
      sender_id: currentUser.id,
      receiver_id: toId,
      content
    });
  } catch(e) { logError("sendDirectMessage", e); showToast(e.message || "Ukendt fejl"); }
}

function startChat() {
  if (!currentPerson) return;
  openChat(currentPerson, 'screen-person');
}

// ══════════════════════════════════════════════════════════
//  DM FILE ATTACH
// ══════════════════════════════════════════════════════════
async function dmHandleFile(input) {
  try {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { showToast('Maks 10MB per fil'); return; }

    // File type blocklist — prevent stored XSS
    var blockedTypes = ['text/html','application/xhtml+xml','image/svg+xml','application/javascript','text/javascript','application/x-httpd-php'];
    var blockedExts = ['html','htm','svg','js','php','exe','bat','cmd','sh','ps1'];
    var ext = (file.name || '').split('.').pop().toLowerCase();
    if (blockedTypes.indexOf(file.type) >= 0 || blockedExts.indexOf(ext) >= 0) {
      showToast('Filtypen er ikke tilladt');
      input.value = '';
      return;
    }
    showToast('Uploader...');

    const safeFilename = file.name
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `dm/${currentUser.id}/${Date.now()}-${safeFilename}`;

    const { error: uploadErr } = await sb.storage.from('bubble-files').upload(path, file, {
      cacheControl: '3600', upsert: false, contentType: file.type
    });
    if (uploadErr) { showToast('Upload fejlede: ' + (uploadErr.message || 'ukendt')); input.value = ''; return; }

    // Use signed URL for privacy — DM files should not be publicly accessible
    const { data: urlData, error: urlErr } = await sb.storage.from('bubble-files').createSignedUrl(path, 604800); // 7 days
    if (urlErr || !urlData?.signedUrl) { showToast('Kunne ikke generere fil-link'); input.value = ''; return; }

    const { data: newMsg, error } = await sb.from('messages').insert({
      sender_id: currentUser.id,
      receiver_id: currentChatUser,
      content: '',
      file_url: urlData.signedUrl,
      file_name: file.name,
      file_type: file.type
    }).select().single();

    if (error) { logError('dmHandleFile:insert', error); showToast('Besked fejlede: ' + (error.message || 'ukendt')); input.value = ''; return; }
    if (newMsg) {
      const el = document.getElementById('chat-messages');
      if (el && !el.querySelector('[data-msg-id="' + newMsg.id + '"]')) {
        el.insertAdjacentHTML('beforeend', dmRenderMsg(newMsg));
        el.scrollTop = el.scrollHeight;
      }
      showToast('Fil sendt!');
    }
    input.value = '';
  } catch(e) { logError("dmHandleFile", e); showToast(e.message || "Ukendt fejl"); }
}


