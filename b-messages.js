// ══════════════════════════════════════════════════════════
//  BUBBLE — MESSAGES + DM COMPOSER
//  DOMAIN: messages
//  OWNS: dmSending, convSelectedIds
//  OWNS: sendMessage, startChat, convDeleteSelected
//  READS: currentUser, currentPerson, currentChatUser
//  Auto-split from app.js · v3.7.0
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
//  UNREAD STATE — single source of truth for all badges
//  Consolidates DM unread + notification badge management
//  Writers: unreadState.dm* / unreadState.notif*
//  Readers: unreadState.dm / unreadState.notif
//  Compat: old function names (_unreadRecount, unreadIncrement, etc.) still work
// ══════════════════════════════════════════════════════════
var unreadState = {
  dm: 0,
  notif: 0,

  // ── Render all badges ──
  render: function() {
    // DM dot (messages nav tab — simple dot, no number)
    var self = this;
    document.querySelectorAll('.msg-unread-badge').forEach(function(b) {
      b.style.display = self.dm > 0 ? 'block' : 'none';
    });
    // Notification dot (topbar bell — simple dot, no number)
    var notifEl = document.getElementById('topbar-notif-badge');
    if (notifEl) {
      notifEl.style.display = this.notif > 0 ? 'block' : 'none';
    }
    // Home nav dot (persistent until notifications cleared)
    var homeDot = document.getElementById('home-notif-dot');
    if (homeDot) {
      homeDot.style.display = (this.notif > 0) ? 'block' : 'none';
    }
  },

  // ── DM operations ──
  dmRecount: async function() {
    try {
      if (!currentUser) return;
      var { count } = await sb.from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', currentUser.id)
        .is('read_at', null);
      this.dm = count || 0;
      this.render();
    } catch(e) { logError('unreadState.dmRecount', e); }
  },
  dmIncrement: function() { this.dm++; this.render(); },
  dmDecrement: function(n) { this.dm = Math.max(0, this.dm - (n || 1)); this.render(); },

  // ── Notification operations ──
  notifSet: function(n) { this.notif = n || 0; this.render(); },

  // ── Reset (logout) ──
  reset: function() { this.dm = 0; this.notif = 0; this.render(); }
};

// ── Compat aliases — old callers keep working ──
var _unreadCount = 0; // Legacy read (not authoritative — use unreadState.dm)
async function _unreadRecount() { await unreadState.dmRecount(); }
function unreadIncrement() { unreadState.dmIncrement(); }
function unreadDecrement(n) { unreadState.dmDecrement(n); }
async function renderUnreadBadge() { unreadState.render(); }


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

  // SVG icons for the toggle button
  var SELECT_ICON = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>';
  var CANCEL_ICON = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#FCA5A5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  if (convSelectMode) {
    if (toolbar) toolbar.style.display = 'flex';
    if (selectBtn) {
      selectBtn.innerHTML = CANCEL_ICON;
      selectBtn.style.background = 'rgba(232,121,168,0.15)';
      selectBtn.style.borderColor = 'rgba(232,121,168,0.3)';
      selectBtn.title = t('misc_cancel');
    }
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
    if (selectBtn) {
      selectBtn.innerHTML = SELECT_ICON;
      selectBtn.style.background = 'rgba(255,255,255,0.1)';
      selectBtn.style.borderColor = 'rgba(255,255,255,0.12)';
      selectBtn.title = t('misc_select');
    }
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
  if (countEl) countEl.textContent = t('dm_n_selected', { n: n });
  if (delBtn) {
    delBtn.disabled = n === 0;
    delBtn.textContent = n > 0 ? t('misc_delete') + ' ' + n : t('misc_delete');
  }
}

async function convDeleteSelected() {
  if (convSelectedIds.length === 0) return;
  var btn = document.getElementById('conv-delete-btn');
  if (!btn) return;
  bbConfirm(btn, {
    label: convSelectedIds.length > 1 ? t('dm_conv_delete_many', { n: convSelectedIds.length }) : t('dm_conv_delete_one', { n: convSelectedIds.length }),
    confirmText: t('misc_delete'),
    confirmClass: 'bb-confirm-btn-danger',
    onConfirm: 'convConfirmDelete()'
  });
}

async function convConfirmDelete() {
  try {
    var ids = convSelectedIds.slice();
    var succeeded = [];
    var anyFailed = false;
    for (var i = 0; i < ids.length; i++) {
      var partnerId = ids[i];
      // Delete both directions. supabase-js returns { error } instead of throwing
      // on DB/RLS failure, so an unchecked await would drop the conversation from
      // the list even when a direction was rejected (half the thread would survive
      // and reappear). Only treat a conversation as deleted if BOTH directions ok.
      var { error: e1 } = await sb.from('messages').delete()
        .eq('sender_id', currentUser.id)
        .eq('receiver_id', partnerId);
      var { error: e2 } = await sb.from('messages').delete()
        .eq('sender_id', partnerId)
        .eq('receiver_id', currentUser.id);
      if (e1 || e2) { logError('convConfirmDelete', e1 || e2); anyFailed = true; continue; }
      succeeded.push(partnerId);
      // Notify receiver so their conversation list updates too
      try {
        await sb.channel('dm-notify-' + partnerId).send({
          type: 'broadcast', event: 'conv_deleted',
          payload: { from: currentUser.id }
        });
      } catch(e) { /* silent — notification is best-effort */ }
    }
    var list = document.getElementById('conversations-list');
    succeeded.forEach(function(id) {
      var card = list ? list.querySelector('[data-conv-id="' + id + '"]') : null;
      if (card) { card.style.transition = 'opacity 0.2s'; card.style.opacity = '0'; setTimeout(function() { card.remove(); }, 200); }
    });
    if (succeeded.length > 0) {
      showToast(succeeded.length > 1 ? t('dm_conv_deleted_many', { n: succeeded.length }) : t('dm_conv_deleted_one', { n: succeeded.length }));
    }
    if (anyFailed) errorToast('delete', new Error('partial'));
    convToggleSelectMode();
    renderUnreadBadge();
  } catch(e) { logError('convConfirmDelete', e); errorToast('delete', e); }
}



let dmSending = false;
var _dmLastSent = {}; // { receiverId+content: timestamp } — prevents duplicate sends on reconnect
registerState(function() { dmSending = false; dmEditingId = null; _dmLastSent = {}; });

async function sendMessage() {
  if (dmSending) return;
  dmSending = true;
  var sendBtn = document.getElementById("chat-send-btn");
  if (sendBtn) { sendBtn.disabled = true; }
  console.debug('[dm] sendMessage');
  try {
    if (isBlocked(currentChatUser)) { _renderToast(t('msg_user_blocked'), 'error'); return; }
    const input = document.getElementById('chat-input');
    const content = filterChatContent(input.value.trim());
    if (!content) return;
    if (tooLong(content, 'message')) return; // dmSending + button reset by finally block

    // Dedup guard: prevent identical message to same receiver within 3s (reconnect safety)
    if (!dmEditingId) {
      var _dedupKey = currentChatUser + '|' + content;
      var _now = Date.now();
      if (_dmLastSent[_dedupKey] && (_now - _dmLastSent[_dedupKey]) < 3000) {
        console.debug('[dm] dedup: identical message within 3s, skipping');
        input.value = '';
        return;
      }
      _dmLastSent[_dedupKey] = _now;
      var _dkeys = Object.keys(_dmLastSent);
      if (_dkeys.length > 20) { delete _dmLastSent[_dkeys[0]]; }
    }

    if (dmEditingId) {
      var { error: dmEditErr } = await sb.from('messages').update({ content, edited: true }).eq('id', dmEditingId);
      if (dmEditErr) {
        logError('sendMessage:edit', dmEditErr);
        errorToast('save', dmEditErr);
        return; // dmSending + button reset by finally block
      }
      const bubble = document.getElementById('dm-bubble-' + dmEditingId);
      if (bubble) bubble.textContent = content;
      dmEditingId = null;
      input.value = '';
      var editBar = document.getElementById('dm-edit-bar');
      if (editBar) editBar.style.display = 'none';
    } else {
      // Optimistic UI: show message instantly with pending state
      var tempId = '_pending_' + Date.now();
      var _replyTo = replyState.dm ? replyState.dm.id : null;
      var _replyMeta = replyState.dm ? { name: replyState.dm.name, text: replyState.dm.text } : null;
      var tempMsg = {
        id: tempId, sender_id: currentUser.id, receiver_id: currentChatUser,
        content: content, created_at: new Date().toISOString(),
        _gp: 'single', file_url: null, edited: false, read_at: null,
        reply_to: _replyTo, _replyMeta: _replyMeta
      };
      dmReduceMsg(tempMsg, { pending: true });
      input.value = '';
      input.blur();
      if (replyState.dm) cancelReply('dm'); // ryd svar-bjaelken

      // DB insert
      const { data: newMsg, error } = await sb.from('messages').insert({
        sender_id: currentUser.id, receiver_id: currentChatUser, content, reply_to: _replyTo
      }).select().single();

      if (error) {
        // Complete rollback on failure — ported from PROD v8.17.31 (Fix 2).
        // 1. Remove optimistic DOM element
        var failEl = document.getElementById('dm-msg-' + tempId);
        if (failEl) failEl.remove();
        // 2. Clear dedup guard so user can immediately retry (not blocked for 3s)
        if (typeof _dedupKey !== 'undefined') delete _dmLastSent[_dedupKey];
        // 3. Restore input value so user doesn't have to retype
        if (input && !input.value) input.value = content;
        logError('sendMessage:insert', error);
        errorToast('send', error);
        return;
      }

      if (newMsg) {
        // Replace pending message with confirmed via reducer
        dmReduceMsg(newMsg, { replaceTempId: tempId });
        // Broadcast to recipient
        if (chatSubscription) {
          try { chatSubscription.send({ type: 'broadcast', event: 'new_message', payload: newMsg }); } catch(e) { logError("dm:new_message_broadcast", e); }
        }
        trackEvent('message_sent', { type: 'dm' });
        // Push håndteres nu af backend-trigger notify_new_message (ADR-006 trin 4)
      }
    }
  } catch(e) { logError("sendMessage", e); errorToast("send", e); }
  finally { dmSending = false; if (sendBtn) { sendBtn.disabled = false; } }
}

async function sendDirectMessage(toId, content) {
  try {
    await sb.from('messages').insert({
      sender_id: currentUser.id,
      receiver_id: toId,
      content
    });
    // Push håndteres nu af backend-trigger notify_new_message (ADR-006 trin 4)
  } catch(e) { logError("sendDirectMessage", e); errorToast("send", e); }
}

function startChat() {
  if (!currentPerson) return;
  var uid = currentPerson;
  var origin = (typeof navState !== 'undefined' && navState.screen) ? navState.screen : 'screen-home';
  if (typeof closePersonSheet === 'function') closePersonSheet();
  openChat(uid, origin);
}

// ══════════════════════════════════════════════════════════
//  DM FILE ATTACH
// ══════════════════════════════════════════════════════════
async function dmHandleFile(input) {
  // PILOT-VAERN (jul 2026): DM-fil-upload deaktiveret. Private DM-filer laa i den
  // offentlige bubble-files bucket med permanente getPublicUrl-links = databrud-risiko.
  // Slukket paa BAADE UI (knap skjult i index.html) og her (tidlig afvisning), saa et
  // manuelt kald heller ikke kan uploade. GIF-deling i DM er UAENDRET (separat knap,
  // gemmer kun en Giphy-URL, ingen upload). Genaktiveres naar DM-filer serveres fra
  // privat bucket med kortlivede signed URLs (Ring 2).
  if (input) input.value = '';
  showWarningToast(t('toast_generic_error'));
  return;
}
async function _dmHandleFileDisabled(input) {
  try {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { showWarningToast(t('toast_max_file')); return; }

    // File type blocklist — prevent stored XSS
    var blockedTypes = ['text/html','application/xhtml+xml','image/svg+xml','application/javascript','text/javascript','application/x-httpd-php'];
    var blockedExts = ['html','htm','svg','js','php','exe','bat','cmd','sh','ps1'];
    var ext = (file.name || '').split('.').pop().toLowerCase();
    if (blockedTypes.indexOf(file.type) >= 0 || blockedExts.indexOf(ext) >= 0) {
      showWarningToast(t('toast_generic_error'));
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
    if (uploadErr) { errorToast('upload', uploadErr); input.value = ''; return; }

    // Public URL — permanent, no expiry. Requires bubble-files bucket to be public in Supabase.
    const { data: urlData } = sb.storage.from('bubble-files').getPublicUrl(path);
    if (!urlData?.publicUrl) { _renderToast(t('msg_file_link_fail'), 'error'); input.value = ''; return; }

    const { data: newMsg, error } = await sb.from('messages').insert({
      sender_id: currentUser.id,
      receiver_id: currentChatUser,
      content: '',
      file_url: urlData.publicUrl,
      file_name: file.name,
      file_type: file.type
    }).select().single();

    if (error) { logError('dmHandleFile:insert', error); errorToast('upload', error); input.value = ''; return; }
    if (newMsg) {
      const el = document.getElementById('chat-messages');
      dmReduceMsg(newMsg);
      showToast(t('toast_sent'));
      // Push håndteres nu af backend-trigger notify_new_message (ADR-006 trin 4)
    }
    input.value = '';
  } catch(e) { logError("dmHandleFile", e); errorToast("upload", e); }
}


