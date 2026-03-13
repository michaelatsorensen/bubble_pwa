// ══════════════════════════════════════════════════════════
//  BUBBLE — UTILITIES (helpers, toast, modals, chips)
//  Auto-split from app.js · v3.7.0
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
//  INPUT CONFIRM BUTTONS + KEYBOARD DISMISS
// ══════════════════════════════════════════════════════════
function confirmInput(btn) {
  var input = btn.parentElement.querySelector('input, textarea');
  if (!input) return;
  if (input.value.trim()) {
    btn.classList.add('confirmed');
    btn.innerHTML = '✓';
  }
  input.blur(); // Dismiss keyboard
}

// Auto-wrap all designated inputs with confirm buttons on boot
function initInputConfirmButtons() {
  // All text inputs that get a confirm ✓ button
  var ids = [
    'ob-name','ob-title','ob-workplace','ob-bio','ob-linkedin',
    'ep-name','ep-title','ep-workplace','ep-bio','ep-linkedin',
    'cb-name','cb-desc','cb-location',
    'eb-name','eb-desc','eb-location',
    'login-email','login-password',
    'signup-name','signup-email','signup-password','signup-title'
  ];
  ids.forEach(function(id) {
    var input = document.getElementById(id);
    if (!input || input.dataset.confirmInit) return;
    input.dataset.confirmInit = '1';
    // Wrap in input-wrap if not already
    if (!input.parentElement.classList.contains('input-wrap')) {
      var wrap = document.createElement('div');
      wrap.className = 'input-wrap';
      input.parentElement.insertBefore(wrap, input);
      wrap.appendChild(input);
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'input-confirm-btn';
      btn.innerHTML = '✓';
      btn.onclick = function() { confirmInput(btn); };
      wrap.appendChild(btn);
    }
    // Reset to grey when input changes
    input.addEventListener('input', function() {
      var b = input.parentElement.querySelector('.input-confirm-btn');
      if (b) b.classList.remove('confirmed');
    });
    // Dismiss keyboard on Enter (for single-line inputs)
    if (input.tagName === 'INPUT') {
      input.setAttribute('enterkeyhint', 'done');
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          input.blur();
          var b = input.parentElement.querySelector('.input-confirm-btn');
          if (b && input.value.trim()) { b.classList.add('confirmed'); b.innerHTML = '✓'; }
        }
      });
    }
  });

  // Also set enterkeyhint on ALL remaining inputs (chips, search, chat)
  document.querySelectorAll('input:not([enterkeyhint])').forEach(function(inp) {
    if (inp.type !== 'file' && inp.type !== 'hidden') {
      inp.setAttribute('enterkeyhint', 'done');
    }
  });
}

// ══════════════════════════════════════════════════════════
//  CHIP INPUT
// ══════════════════════════════════════════════════════════
function handleChipInput(e, arrayName) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    const val = e.target.value.trim().replace(/,/g,'');
    if (!val) { e.target.blur(); return; }
    const arr = arrayName === 'cb-chips' ? cbChips : arrayName === 'ep-chips' ? epChips : arrayName === 'eb-chips' ? ebChips : arrayName === 'ob-chips' ? obChips : arrayName === 'ob-dyn-chips' ? obDynChips : arrayName === 'ep-dyn-chips' ? epDynChips : epDynChips;
    const containerId = arrayName === 'cb-chips' ? 'cb-chips-container' : arrayName === 'ep-chips' ? 'ep-chips-container' : arrayName === 'eb-chips' ? 'eb-chips-container' : arrayName === 'ob-chips' ? 'ob-chips-container' : arrayName === 'ob-dyn-chips' ? 'ob-dyn-chips-container' : arrayName === 'ep-dyn-chips' ? 'ep-dyn-chips-container' : 'ep-dyn-chips-container';
    const inputId = arrayName === 'cb-chips' ? 'cb-chip-input' : arrayName === 'ep-chips' ? 'ep-chip-input' : arrayName === 'eb-chips' ? 'eb-chip-input' : arrayName === 'ob-chips' ? 'ob-chip-input' : arrayName === 'ob-dyn-chips' ? 'ob-dyn-chip-input' : arrayName === 'ep-dyn-chips' ? 'ep-dyn-chip-input' : 'ep-dyn-chip-input';
    if (!arr.includes(val)) arr.push(val);
    e.target.value = '';
    renderChips(arrayName, arr, containerId, inputId);
    flashConfirmBtn(e.target);
  }
}

function addChipFromBtn(inputId, arrayName) {
  var inp = document.getElementById(inputId);
  if (!inp) return;
  var val = inp.value.trim().replace(/,/g,'');
  if (!val) { inp.blur(); return; }
  var arr = arrayName === 'cb-chips' ? cbChips : arrayName === 'ep-chips' ? epChips : arrayName === 'eb-chips' ? ebChips : arrayName === 'ob-chips' ? obChips : arrayName === 'ob-dyn-chips' ? obDynChips : arrayName === 'ep-dyn-chips' ? epDynChips : epDynChips;
  var containerId = arrayName === 'cb-chips' ? 'cb-chips-container' : arrayName === 'ep-chips' ? 'ep-chips-container' : arrayName === 'eb-chips' ? 'eb-chips-container' : arrayName === 'ob-chips' ? 'ob-chips-container' : arrayName === 'ob-dyn-chips' ? 'ob-dyn-chips-container' : arrayName === 'ep-dyn-chips' ? 'ep-dyn-chips-container' : 'ep-dyn-chips-container';
  if (!arr.includes(val)) arr.push(val);
  inp.value = '';
  renderChips(arrayName, arr, containerId, inputId);
  // Flash the ✓ button green
  var btn = inp.parentElement?.querySelector('.ob-cat-custom-btn');
  if (btn) { btn.style.background = '#10B981'; setTimeout(function(){ btn.style.background = ''; }, 600); }
}

// Flash green on any nearby confirm button
function flashConfirmBtn(input) {
  var btn = input?.parentElement?.querySelector('.ob-cat-custom-btn, .input-confirm-btn');
  if (btn) {
    btn.classList.add('confirmed');
    setTimeout(function() { btn.classList.remove('confirmed'); }, 800);
  }
}


function renderChips(arrayName, arr, containerId, inputId) {
  const container = document.getElementById(containerId);
  const oldInput = document.getElementById(inputId);
  container.innerHTML = '';
  arr.forEach((chip, i) => {
    const span = document.createElement('div');
    span.className = 'chip';
    span.innerHTML = `${escHtml(chip)} <span class="chip-remove" onclick="removeChip('${arrayName}',${i},'${containerId}','${inputId}')">×</span>`;
    container.appendChild(span);
  });
  const input = document.createElement('input');
  input.className = 'chip-input';
  input.id = inputId;
  input.placeholder = arr.length ? '' : oldInput?.placeholder || 'Tilføj...';
  input.onkeydown = (e) => handleChipInput(e, arrayName);
  container.appendChild(input);
}

function removeChip(arrayName, index, containerId, inputId) {
  const arr = arrayName === 'cb-chips' ? cbChips : arrayName === 'ep-chips' ? epChips : arrayName === 'eb-chips' ? ebChips : arrayName === 'ob-chips' ? obChips : arrayName === 'ob-dyn-chips' ? obDynChips : arrayName === 'ep-dyn-chips' ? epDynChips : epDynChips;
  arr.splice(index, 1);
  renderChips(arrayName, arr, containerId, inputId);
}


// ══════════════════════════════════════════════════════════
//  MODAL HELPERS
// ══════════════════════════════════════════════════════════
function openModal(id) { document.getElementById(id).classList.add('open'); }

// Settings sheet removed — now a tab in profile


function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  // Always stop camera when closing live checkin
  if (id === 'modal-live-checkin') stopLiveCamera();
}
// Close modal on backdrop click
document.querySelectorAll('.modal-overlay').forEach(el => {
  el.addEventListener('click', (e) => { if (e.target === el) el.classList.remove('open'); });
});


// ══════════════════════════════════════════════════════════
//  TOAST
// ══════════════════════════════════════════════════════════
let toastTimer;
function showToast(msg, duration) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  const isError = /^(Fejl|❌|⚠️)/.test(msg);
  const ms = duration || (isError ? 4500 : 2500);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}


// ══════════════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════════════
function escHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// Safe avatar <img> tag — escapes URL to prevent XSS
function safeAvatarImg(url, style) {
  if (!url) return '';
  return '<img src="' + escHtml(url) + '" style="' + (style || 'width:100%;height:100%;object-fit:cover') + '">';
}

function bubbleEmoji(type) {
  var t = (type || '').toLowerCase();
  return { event:ico('rocket'), local:ico('pin'), lokal:ico('pin'), theme:ico('cpu'), tema:ico('cpu'), company:ico('building'), virksomhed:ico('building'), live:ico('pin'), standard:ico('bubble') }[t] || ico('bubble');
}
function bubbleIcon(type) {
  var t = (type || '').toLowerCase();
  return { event:icon('rocket'), local:icon('pin'), lokal:icon('pin'), theme:icon('cpu'), tema:icon('cpu'), company:icon('building'), virksomhed:icon('building'), live:icon('pin'), standard:icon('bubble') }[t] || icon('bubble');
}

function bubbleColor(type, alpha) {
  var t = (type || '').toLowerCase();
  const map = { event:`rgba(108,99,255,${alpha})`, local:`rgba(67,232,176,${alpha})`, lokal:`rgba(67,232,176,${alpha})`, theme:`rgba(255,179,71,${alpha})`, tema:`rgba(255,179,71,${alpha})`, company:`rgba(255,101,132,${alpha})`, virksomhed:`rgba(255,101,132,${alpha})`, live:`rgba(46,207,207,${alpha})`, standard:`rgba(139,127,255,${alpha})` };
  return map[t] || `rgba(139,127,255,${alpha})`;
}

function typeLabel(type) {
  var t = (type || '').toLowerCase();
  return { event:'Event', local:'Lokal', lokal:'Lokal', theme:'Tema', tema:'Tema', company:'Virksomhed', virksomhed:'Virksomhed', live:'Live', standard:'Standard' }[t] || type;
}

// Clock removed — iPhone shows native status bar

// ── Shared: saved contact IDs (cached per session) ──
var _savedContactIds = null;
var _savedContactIdsTs = 0;
async function getSavedContactIds(forceRefresh) {
  // Cache for 30 seconds
  if (!forceRefresh && _savedContactIds && (Date.now() - _savedContactIdsTs < 30000)) return _savedContactIds;
  if (!currentUser) return [];
  var { data } = await sb.from('saved_contacts').select('contact_id').eq('user_id', currentUser.id);
  _savedContactIds = (data || []).map(function(s) { return s.contact_id; });
  _savedContactIdsTs = Date.now();
  return _savedContactIds;
}
function clearSavedContactIdsCache() { _savedContactIds = null; }

// ── Shared: enrich bubbles with saved contact avatars ──
// Takes array of bubble IDs + saved contact IDs → returns { bubbleId: [{name, avatar_url}] }
async function fetchContactAvatarsForBubbles(bubbleIds, savedIds) {
  var contactMap = {};
  if (!savedIds || savedIds.length === 0 || !bubbleIds || bubbleIds.length === 0) return contactMap;
  try {
    var { data: members } = await sb.from('bubble_members')
      .select('bubble_id, user_id')
      .in('bubble_id', bubbleIds)
      .in('user_id', savedIds);
    if (!members || members.length === 0) return contactMap;
    var userIds = [...new Set(members.map(function(m) { return m.user_id; }))];
    var { data: profiles } = await sb.from('profiles').select('id, name, avatar_url').in('id', userIds);
    var pMap = {};
    (profiles || []).forEach(function(p) { pMap[p.id] = p; });
    members.forEach(function(m) {
      if (!contactMap[m.bubble_id]) contactMap[m.bubble_id] = [];
      var p = pMap[m.user_id];
      if (p && contactMap[m.bubble_id].length < 3) contactMap[m.bubble_id].push(p);
    });
  } catch(e) { logError('fetchContactAvatarsForBubbles', e); }
  return contactMap;
}

// ── Visibility label + icon for bubbles ──
function visibilityBadge(visibility) {
  if (visibility === 'hidden') return '<span class="fs-065" style="color:var(--muted);display:inline-flex;align-items:center;gap:0.15rem">' + ico('eye') + ' Skjult</span>';
  if (visibility === 'private') return '<span class="fs-065" style="color:var(--accent);display:inline-flex;align-items:center;gap:0.15rem">' + ico('lock') + ' Privat</span>';
  return '<span class="fs-065" style="color:var(--green);display:inline-flex;align-items:center;gap:0.15rem">' + ico('globe') + ' Åben</span>';
}

// ── Retry state: show inline error with retry button ──
function showRetryState(elementId, retryFnName, message) {
  var el = document.getElementById(elementId);
  if (!el) return;
  el.innerHTML = '<div class="retry-state">' +
    '<div style="width:36px;height:36px;margin:0 auto 0.5rem;opacity:0.4;color:var(--accent2)">' + ico('warn') + '</div>' +
    '<div style="font-size:0.78rem;color:var(--text-secondary);margin-bottom:0.6rem">' + escHtml(message) + '</div>' +
    '<button onclick="' + retryFnName + '()" class="btn-sm btn-ghost" style="font-size:0.72rem;padding:0.35rem 1rem">Prøv igen</button>' +
    '</div>';
}

// ── Empty state: show message with optional CTA ──
function showEmptyState(elementId, iconName, message, ctaText, ctaAction) {
  var el = document.getElementById(elementId);
  if (!el) return;
  var cta = ctaText ? '<div style="margin-top:0.8rem"><button onclick="' + ctaAction + '" class="btn-sm btn-accent" style="font-size:0.72rem;padding:0.4rem 1.2rem">' + escHtml(ctaText) + '</button></div>' : '';
  el.innerHTML = '<div class="empty-state" style="padding:1.5rem 0">' +
    '<div class="empty-icon">' + icon(iconName) + '</div>' +
    '<div class="empty-text">' + message + '</div>' +
    cta + '</div>';
}

// ── Chat + menu toggle (Messenger-style) ──
function toggleChatMenu(mode) {
  var menu = document.getElementById(mode + '-plus-menu');
  var btn = menu?.previousElementSibling;
  if (!menu) return;
  var isOpen = menu.classList.contains('open');
  // Close all menus first
  document.querySelectorAll('.chat-plus-menu.open').forEach(function(m) { m.classList.remove('open'); });
  document.querySelectorAll('.chat-plus-btn.open').forEach(function(b) { b.classList.remove('open'); });
  if (!isOpen) {
    menu.classList.add('open');
    if (btn) btn.classList.add('open');
    // Close on outside tap
    setTimeout(function() {
      document.addEventListener('click', _closeChatMenuOutside, { once: true });
    }, 10);
  }
}
function closeChatMenu(mode) {
  var menu = document.getElementById(mode + '-plus-menu');
  if (menu) menu.classList.remove('open');
  document.querySelectorAll('.chat-plus-btn.open').forEach(function(b) { b.classList.remove('open'); });
}
function _closeChatMenuOutside(e) {
  if (e.target.closest('.chat-plus-menu') || e.target.closest('.chat-plus-btn')) return;
  document.querySelectorAll('.chat-plus-menu.open').forEach(function(m) { m.classList.remove('open'); });
  document.querySelectorAll('.chat-plus-btn.open').forEach(function(b) { b.classList.remove('open'); });
}
