// ══════════════════════════════════════════════════════════
//  BUBBLE — UTILITIES (helpers, toast, modals, chips)
//  DOMAIN: utils
//  OWNS: getAppMode(), bbOpen/bbClose/bbCloseAll/bbConfirm, showToast, escHtml, icon/ico,
//        matchLabel, skelCards, showRetryState, showEmptyState, flowGet/flowSet/flowRemove
//  READS: currentUser, currentLiveBubble, flowState (sessionStorage)
//  Auto-split from app.js · v3.7.0
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
//  APP MODE — Single source of truth for current context
//  Returns: 'event' | 'live' | 'guest' | 'normal'
//  Usage: if (getAppMode() === 'live') { ... }
// ══════════════════════════════════════════════════════════
function getAppMode() {
  if (typeof flowGet === 'function' && flowGet('event_flow')) return 'event';
  if (typeof appMode !== 'undefined' && appMode.is('live')) return 'live';
  if (!currentUser) return 'guest';
  return 'normal';
}

// ── Match label system (v3 — tier-based thresholds) ──
// Score 0-100 from tier-based calcMatchScore
function matchLabel(score) {
  if (score >= 60) return { text: 'Stærkt match',       color: 'var(--green)',  bg: 'rgba(26,158,142,0.08)' };
  if (score >= 40) return { text: 'Godt match',          color: 'var(--accent)', bg: 'rgba(124,92,252,0.08)' };
  if (score >= 20) return { text: 'Fælles interesser',   color: '#3B82F6',       bg: 'rgba(59,130,246,0.08)' };
  if (score >= 1)  return { text: 'I dit netværk',       color: 'var(--muted)',  bg: 'rgba(30,27,46,0.04)' };
  return              { text: '',                        color: 'var(--muted)',  bg: 'transparent' };
}

function matchBadgeHtml(score) {
  var m = matchLabel(score);
  if (!m.text) return '';
  return '<span style="font-size:0.6rem;font-weight:700;color:' + m.color + ';background:' + m.bg + ';padding:0.15rem 0.45rem;border-radius:6px;white-space:nowrap">' + m.text + '</span>';
}

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
  if (btn) { btn.style.background = '#1A9E8E'; setTimeout(function(){ btn.style.background = ''; }, 600); }
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
//  MODAL HELPERS (legacy — gradually migrating to bb* system)
// ══════════════════════════════════════════════════════════
function openModal(id) { document.getElementById(id).classList.add('open'); }

// Settings sheet removed — now a tab in profile


function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  // Always stop camera when closing live checkin
  if (id === 'modal-live-checkin') stopLiveCamera();
}

// ══════════════════════════════════════════════════════════
//  STANDARDIZED OVERLAY SYSTEM (v5.9)
//  3 patterns: bb-overlay + bb-sheet, bb-confirm
//  bbOpen('name') → finds #bb-overlay-{name} + #bb-sheet-{name}
//  bbClose('name') → closes them
//  bbCloseAll() → closes every open overlay (called by goTo)
// ══════════════════════════════════════════════════════════

function bbOpen(name) {
  var overlay = document.getElementById('bb-overlay-' + name);
  var sheet = document.getElementById('bb-sheet-' + name);
  if (overlay) overlay.classList.add('open');
  if (sheet) setTimeout(function() { sheet.classList.add('open'); }, 10);
}

function bbClose(name) {
  var sheet = document.getElementById('bb-sheet-' + name);
  var overlay = document.getElementById('bb-overlay-' + name);
  if (sheet) sheet.classList.remove('open');
  setTimeout(function() { if (overlay) overlay.classList.remove('open'); }, 320);
}

function bbCloseAll() {
  // Close all standardized bb-system overlays
  document.querySelectorAll('.bb-overlay.open').forEach(function(el) { el.classList.remove('open'); });
  document.querySelectorAll('.bb-sheet.open').forEach(function(el) { el.classList.remove('open'); });
  // Close legacy overlays (not yet migrated)
  document.querySelectorAll('.modal-overlay.open').forEach(function(el) { el.classList.remove('open'); });
  // Close dynamic overlays
  document.querySelectorAll('.bb-dyn-overlay').forEach(function(el) { bbDynClose(el); });
  // Close person sheets, radar sheets, gif picker, context menus
  document.querySelectorAll('.person-sheet.open,.person-sheet-overlay.open').forEach(function(el) { el.classList.remove('open'); el.style.transform = ''; });
  document.querySelectorAll('.radar-person-sheet.open,.radar-person-overlay.open').forEach(function(el) { el.classList.remove('open'); el.style.transform = ''; });
  var gifPicker = document.getElementById('gif-picker');
  var gifOverlay = document.getElementById('gif-picker-overlay');
  if (gifPicker) gifPicker.classList.remove('open');
  if (gifOverlay) gifOverlay.classList.remove('open');
  document.querySelectorAll('.context-menu.open').forEach(function(el) { el.classList.remove('open'); });
  // Legacy dynamic overlays
  document.querySelectorAll('.bb-dynamic-overlay').forEach(function(el) { el.remove(); });
  var reportTray = document.getElementById('event-report-tray');
  if (reportTray) { try { closeReportTray(); } catch(e) { reportTray.remove(); } }
}

// ── Dynamic overlay: animated create + destroy ──
// Returns { overlay, sheet } — append content to sheet, then let animation handle the rest
function bbDynOpen(opts) {
  opts = opts || {};
  var overlay = document.createElement('div');
  overlay.className = 'bb-dyn-overlay' + (opts.center ? ' bb-dyn-center' : '');
  overlay.onclick = function(e) { if (e.target === overlay) bbDynClose(overlay); };
  var sheet = document.createElement('div');
  sheet.className = 'bb-dyn-sheet';
  if (opts.center) { sheet.style.borderRadius = '20px'; sheet.style.maxWidth = '360px'; sheet.style.margin = '0 1rem'; }
  sheet.onclick = function(e) { e.stopPropagation(); };
  overlay.appendChild(sheet);
  document.body.appendChild(overlay);
  requestAnimationFrame(function() { requestAnimationFrame(function() { overlay.classList.add('open'); }); });
  return { overlay: overlay, sheet: sheet };
}

function bbDynClose(overlay) {
  if (!overlay || !overlay.classList.contains('bb-dyn-overlay')) return;
  overlay.classList.remove('open');
  setTimeout(function() { if (overlay.parentNode) overlay.remove(); }, 380);
}

// Helper: create inline confirm tray (standardized)
function bbConfirm(parentEl, options) {
  // options: { label, confirmText, cancelText, confirmClass, onConfirm }
  // confirmClass: 'bb-confirm-btn-danger' or 'bb-confirm-btn-accept'
  if (!parentEl) return;
  // Toggle: check both inside and after the element
  var existing = parentEl.querySelector('.bb-confirm') || (parentEl.nextElementSibling && parentEl.nextElementSibling.classList.contains('bb-confirm') ? parentEl.nextElementSibling : null);
  if (existing) { existing.remove(); return; }
  var tray = document.createElement('div');
  tray.className = 'bb-confirm ' + (options.confirmClass === 'bb-confirm-btn-accept' ? 'bb-confirm-accept' : 'bb-confirm-danger');
  tray.onclick = function(e) { e.stopPropagation(); };
  tray.innerHTML = '<span class="bb-confirm-label">' + (options.label || 'Er du sikker?') + '</span>' +
    '<div class="bb-confirm-actions">' +
    '<button class="bb-confirm-btn ' + (options.confirmClass || 'bb-confirm-btn-danger') + '" onclick="' + options.onConfirm + '">' + (options.confirmText || 'Ja') + '</button>' +
    '<button class="bb-confirm-btn" onclick="this.closest(\'.bb-confirm\').remove()">' + (options.cancelText || 'Annuller') + '</button>' +
    '</div>';
  // Insert after parentEl (as sibling) so it doesn't break flex layouts
  parentEl.insertAdjacentElement('afterend', tray);
  return tray;
}
// Close modal on backdrop click
document.querySelectorAll('.modal-overlay').forEach(el => {
  el.addEventListener('click', (e) => { if (e.target === el) el.classList.remove('open'); });
});


// ══════════════════════════════════════════════════════════
//  TOAST
// ══════════════════════════════════════════════════════════
let toastTimer;
// ── Toast system v2: color-coded, icon, top-positioned ──
// Types: 'info' (purple), 'success' (teal), 'error' (red), 'warn' (amber)
var _toastIconNames = { info: 'info', success: 'check', error: 'x', warn: 'warn' };
var _toastDurations = { info: 2500, success: 2500, error: 4500, warn: 3500 };

function _renderToast(msg, type) {
  var t = document.getElementById('toast');
  if (!t) return;
  t.className = 'toast toast-' + type;
  t.innerHTML = '<div class="toast-ico">' + ico(_toastIconNames[type]) + '</div><div style="flex:1;min-width:0">' + escHtml(msg) + '</div>';
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function() { t.classList.remove('show'); }, _toastDurations[type] || 2500);
}

function showToast(msg, duration) {
  _renderToast(msg, 'info');
  if (duration) { clearTimeout(toastTimer); toastTimer = setTimeout(function() { document.getElementById('toast').classList.remove('show'); }, duration); }
}

function showSuccessToast(message) {
  _renderToast(message, 'success');
}

function showWarningToast(message) {
  _renderToast(message, 'warn');
}

// ── Human-readable error toast — strips technical Supabase/JS errors ──
function errorToast(context, error) {
  var msg = (error && error.message) ? error.message : String(error || '');

  // Network check first
  if (!navigator.onLine || msg.includes('network') || msg.includes('fetch') || msg.includes('Failed to fetch') || msg.includes('ERR_INTERNET')) {
    return _renderToast(t('toast_no_connection'), 'error');
  }

  // Map known technical errors to human messages
  if (msg.includes('row-level security') || msg.includes('policy')) return _renderToast(t('toast_no_permission'), 'error');
  if (msg.includes('JWT') || msg.includes('token') || msg.includes('refresh_token') || msg.includes('session_not_found')) return _renderToast(t('toast_session_expired'), 'error');
  if (msg.includes('duplicate') || msg.includes('unique')) return _renderToast(t('toast_already_done'), 'warn');
  if (msg.includes('timeout') || msg.includes('TIMEOUT') || msg.includes('PGRST')) return _renderToast(t('toast_server_error'), 'error');
  if (msg.includes('too many') || msg.includes('rate limit') || msg.includes('429')) return _renderToast(t('toast_rate_limit'), 'warn');
  if (msg.includes('storage') || msg.includes('bucket')) return _renderToast(t('toast_upload_smaller'), 'error');
  if (msg.includes('not found') || msg.includes('404')) return _renderToast(t('toast_not_found'), 'error');
  if (msg.includes('Invalid login') || msg.includes('invalid_credentials')) return _renderToast(t('toast_wrong_credentials'), 'error');
  if (msg.includes('Email not confirmed')) return _renderToast(t('toast_confirm_email'), 'warn');
  if (msg.includes('User already registered')) return _renderToast(t('toast_already_registered'), 'warn');

  // Default: friendly context message
  var friendly = {
    'login': t('toast_login_failed'),
    'signup': t('toast_signup_failed'),
    'save': t('toast_save_failed'),
    'send': t('toast_send_failed'),
    'upload': t('toast_upload_failed'),
    'delete': t('toast_delete_failed'),
    'load': t('toast_load_failed')
  };
  _renderToast(friendly[context] || t('toast_generic_error'), 'error');
}


// ══════════════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════════════
function escHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

function linkify(text) {
  if (!text) return text;
  return text.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline">$1</a>');
}

function isEmojiOnly(text) {
  if (!text) return false;
  var stripped = text.replace(/[\uFE00-\uFE0F\u200D]/g, '');
  var emojiPattern = /^[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2702}-\u{27B0}\u{FE00}-\u{FE0F}\u{200D}\s]{1,12}$/u;
  return emojiPattern.test(stripped) && stripped.replace(/\s/g, '').length <= 12;
}

// Safe avatar <img> tag — escapes URL to prevent XSS
function safeAvatarImg(url, style) {
  if (!url) return '';
  return '<img src="' + escHtml(url) + '" style="' + (style || 'width:100%;height:100%;object-fit:cover') + '">';
}

function bubbleEmoji(type) {
  var t = (type || '').toLowerCase();
  // v5: simplified to network/event. Old types mapped for backwards compat.
  if (t === 'event' || t === 'live') return ico('calendar');
  return ico('bubble'); // network, topic, local, company, standard → all "network"
}

function bubbleColor(type, alpha) {
  var t = (type || '').toLowerCase();
  // Event = cyan (#2ECFCF), Network = purple (#7C5CFC)
  if (t === 'event' || t === 'live') return `rgba(46,207,207,${alpha})`;
  return `rgba(124,92,252,${alpha})`; // network + all legacy types
}

function typeLabel(type) {
  var t = (type || '').toLowerCase();
  // v5: two types. Old values mapped for backwards compat.
  if (t === 'event' || t === 'live') return 'Event';
  if (t === 'network' || t === 'topic' || t === 'local' || t === 'lokal' || t === 'theme' || t === 'tema' || t === 'standard') return 'Netværk';
  if (t === 'company' || t === 'virksomhed') return 'Virksomhed';
  return 'Netværk';
}

function visIcon(v) {
  if (v === 'hidden') return '<span style="font-size:0.55rem;padding:1px 5px;border-radius:4px;background:rgba(239,68,68,0.08);color:#A32D2D;margin-right:3px">Skjult</span>';
  if (v === 'private') return '<span style="font-size:0.55rem;padding:1px 5px;border-radius:4px;background:rgba(99,102,241,0.08);color:#534AB7;margin-right:3px">Privat</span>';
  return '<span style="font-size:0.55rem;padding:1px 5px;border-radius:4px;background:rgba(26,158,142,0.08);color:#085041;margin-right:3px">\u00C5ben</span>';
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

// Fetch first N member avatars for multiple bubbles (for preview stacks)
async function fetchMemberAvatarsForBubbles(bubbleIds, max) {
  var memberMap = {};
  if (!bubbleIds || bubbleIds.length === 0) return memberMap;
  max = max || 4;
  try {
    var { data: members } = await sb.from('bubble_members')
      .select('bubble_id, user_id')
      .in('bubble_id', bubbleIds)
      .limit(bubbleIds.length * max);
    if (!members || members.length === 0) return memberMap;
    // Group by bubble, cap at max per bubble
    var grouped = {};
    members.forEach(function(m) {
      if (!grouped[m.bubble_id]) grouped[m.bubble_id] = [];
      if (grouped[m.bubble_id].length < max) grouped[m.bubble_id].push(m.user_id);
    });
    var allUserIds = [...new Set(members.map(function(m) { return m.user_id; }))];
    var { data: profiles } = await sb.from('profiles').select('id, name, avatar_url').in('id', allUserIds);
    var pMap = {};
    (profiles || []).forEach(function(p) { pMap[p.id] = p; });
    Object.keys(grouped).forEach(function(bId) {
      memberMap[bId] = grouped[bId].map(function(uid) { return pMap[uid] || { name: '?' }; });
    });
  } catch(e) { logError('fetchMemberAvatarsForBubbles', e); }
  return memberMap;
}

// Render compact avatar stack: up to 4 faces + "+N"
function renderAvatarStack(members, totalCount) {
  if (!members || members.length === 0) return '';
  var avColors = ['linear-gradient(135deg,#2ECFCF,#22B8CF)','linear-gradient(135deg,#6366F1,#7C5CFC)','linear-gradient(135deg,#E879A8,#EC4899)','linear-gradient(135deg,#F59E0B,#EAB308)','linear-gradient(135deg,#1A9E8E,#10B981)','linear-gradient(135deg,#8B5CF6,#A855F7)'];
  var avs = members.slice(0, 4).map(function(p, i) {
    var ml = i > 0 ? 'margin-left:-6px;' : '';
    var z = 'z-index:' + (5-i) + ';position:relative;';
    if (p.avatar_url) return '<div style="width:22px;height:22px;border-radius:50%;overflow:hidden;border:1.5px solid white;' + ml + z + '"><img src="' + escHtml(p.avatar_url) + '" style="width:100%;height:100%;object-fit:cover"></div>';
    var ini = (p.name||'?').split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();
    return '<div style="width:22px;height:22px;border-radius:50%;background:' + avColors[i % 6] + ';display:flex;align-items:center;justify-content:center;font-size:0.38rem;font-weight:700;color:white;border:1.5px solid white;' + ml + z + '">' + ini + '</div>';
  }).join('');
  var extra = (totalCount || 0) > 4 ? '<div style="width:22px;height:22px;border-radius:50%;background:rgba(30,27,46,0.06);display:flex;align-items:center;justify-content:center;font-size:0.42rem;font-weight:700;color:var(--muted);border:1.5px solid white;margin-left:-6px;position:relative;z-index:0">+' + ((totalCount || 0) - 4) + '</div>' : '';
  return '<div style="display:flex;align-items:center;margin-top:0.2rem">' + avs + extra + '</div>';
}

// ── Visibility label + icon for bubbles ──

// ── Retry state: show inline error with retry button ──
function showRetryState(elementId, retryFnName, message) {
  var el = document.getElementById(elementId);
  if (!el) return;
  el.innerHTML = '<div class="state-error">' +
    '<div class="state-error-icon">' + ico('warn') + '</div>' +
    '<div class="state-error-text">' + escHtml(message) + '</div>' +
    '<button onclick="' + retryFnName + '()" class="state-error-btn">Prøv igen</button>' +
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
    // Close on outside tap — remove first to prevent stacking
    setTimeout(function() {
      document.removeEventListener('click', _closeChatMenuOutside);
      document.addEventListener('click', _closeChatMenuOutside);
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
  document.removeEventListener('click', _closeChatMenuOutside);
}

// ── Skeleton loading states ──
function skelCards(count) {
  var html = '';
  for (var i = 0; i < count; i++) {
    html += '<div class="skel-card">' +
      '<div class="skel skel-circle" style="width:40px;height:40px;flex-shrink:0"></div>' +
      '<div style="flex:1">' +
      '<div class="skel" style="width:' + (50 + Math.random()*30) + '%;height:12px;margin-bottom:6px"></div>' +
      '<div class="skel" style="width:' + (30 + Math.random()*40) + '%;height:10px"></div>' +
      '</div></div>';
  }
  return html;
}

function skelMessages(count) {
  var html = '';
  for (var i = 0; i < count; i++) {
    var isMe = i % 3 === 0;
    html += '<div class="skel-row" style="justify-content:' + (isMe ? 'flex-end' : 'flex-start') + '">' +
      (isMe ? '' : '<div class="skel skel-circle" style="width:28px;height:28px;flex-shrink:0"></div>') +
      '<div class="skel" style="width:' + (80 + Math.random()*120) + 'px;height:32px;border-radius:16px"></div>' +
      '</div>';
  }
  return html;
}

// ── Time ago helper (for conversations) ──
function timeAgo(dateStr) {
  if (!dateStr) return '';
  var diff = Date.now() - new Date(dateStr).getTime();
  var mins = Math.floor(diff / 60000);
  if (mins < 1) return 'nu';
  if (mins < 60) return mins + ' min';
  var hours = Math.floor(mins / 60);
  if (hours < 24) return hours + ' t';
  var days = Math.floor(hours / 24);
  if (days < 7) return days + ' d';
  return new Date(dateStr).toLocaleDateString('da-DK', { day:'numeric', month:'short' });
}

// ── Enhanced success toast with check animation ──
// showSuccessToast now defined in toast system v2 above

// ══════════════════════════════════════════════════════════
//  ESCALATOR SCROLL EFFECT v3
//  Only individual card-sized elements get the fall-back
//  effect as they exit the top. Large wrapper divs are
//  skipped — their children are processed instead.
// ══════════════════════════════════════════════════════════
(function initEscalator() {
  var EXIT_ZONE = 90;
  var _rafPending = false;

  function collectItems(scrollEl) {
    // Collect "leaf" content items — skip pure wrapper divs
    var containerH = scrollEl.clientHeight;
    var items = [];
    function walk(parent) {
      var kids = parent.children;
      for (var i = 0; i < kids.length; i++) {
        var el = kids[i];
        if (el.offsetHeight < 10) continue;
        // If element is taller than 60% of viewport, it's a wrapper — go deeper
        if (el.offsetHeight > containerH * 0.6 && el.children.length > 1) {
          walk(el);
        } else {
          items.push(el);
        }
      }
    }
    walk(scrollEl);
    return items;
  }

  function processScroll(scrollEl) {
    var containerTop = scrollEl.getBoundingClientRect().top;
    var items = collectItems(scrollEl);

    for (var i = 0; i < items.length; i++) {
      var el = items[i];
      var rect = el.getBoundingClientRect();

      // How much of the element is still visible below the container top edge
      var visibleBelow = rect.bottom - containerTop;

      if (rect.top < containerTop && visibleBelow > 0) {
        // Partially exiting the top — animate
        var progress = Math.min(1, visibleBelow / EXIT_ZONE);
        el.style.opacity = (0.2 + progress * 0.8).toFixed(3);
        el.style.transform = 'scale(' + (0.94 + progress * 0.06).toFixed(4) + ') perspective(800px) rotateX(' + ((1 - progress) * 4).toFixed(2) + 'deg)';
        el.style.transformOrigin = 'center bottom';
      } else if (visibleBelow <= 0) {
        // Fully gone
        el.style.opacity = '0';
        el.style.transform = 'scale(0.92) perspective(800px) rotateX(5deg)';
        el.style.transformOrigin = 'center bottom';
      } else {
        // Fully visible — crisp, no transforms
        if (el.style.opacity) {
          el.style.opacity = '';
          el.style.transform = '';
          el.style.transformOrigin = '';
        }
      }
    }
  }

  function onScroll(e) {
    if (_rafPending) return;
    _rafPending = true;
    requestAnimationFrame(function() {
      _rafPending = false;
      processScroll(e.target);
    });
  }

  function attach(el) {
    if (el._esc) return;
    if (el.closest('#screen-chat') || el.closest('#screen-bubble-chat')) return;
    el.addEventListener('scroll', onScroll, { passive: true });
    el._esc = true;
  }

  window.addEventListener('load', function() {
    document.querySelectorAll('.scroll-area').forEach(attach);
    new MutationObserver(function(muts) {
      muts.forEach(function(m) {
        m.addedNodes.forEach(function(n) {
          if (n.nodeType !== 1) return;
          if (n.classList && n.classList.contains('scroll-area')) attach(n);
          var nested = n.querySelectorAll ? n.querySelectorAll('.scroll-area') : [];
          nested.forEach(attach);
        });
      });
    }).observe(document.body, { childList: true, subtree: true });
  });
})();

// ══════════════════════════════════════════════════════════
//  RENDER HELPERS — Reusable UI components
//  Used by: b-chat.js, b-home.js, b-bubbles.js, b-notifications.js
//  Rule: new features MUST use these. Existing code migrates gradually.
// ══════════════════════════════════════════════════════════

// ── Avatar helper: returns HTML for avatar circle ──
function renderAvatar(name, color, avatarUrl, size) {
  var sz = size || 36;
  var ini = (name || '?').split(' ').map(function(w) { return w[0] || ''; }).join('').slice(0, 2).toUpperCase();
  if (avatarUrl) {
    return '<div style="width:' + sz + 'px;height:' + sz + 'px;border-radius:50%;overflow:hidden;flex-shrink:0"><img src="' + escHtml(avatarUrl) + '" style="width:100%;height:100%;object-fit:cover"></div>';
  }
  return '<div style="width:' + sz + 'px;height:' + sz + 'px;border-radius:50%;background:' + (color || 'var(--accent)') + ';display:flex;align-items:center;justify-content:center;color:white;font-size:' + (sz < 30 ? '0.5' : '0.65') + 'rem;font-weight:700;flex-shrink:0">' + escHtml(ini) + '</div>';
}

// ══════════════════════════════════════════════════════════
//  DB ACTIONS — centralized write layer for Supabase
//  All DB writes should go through dbActions for:
//  - consistent error handling
//  - dedup protection
//  - side effect management (toasts, tracking, cache)
//  Migration: callers move to dbActions.X() incrementally
// ══════════════════════════════════════════════════════════
var dbActions = {

  // ── CONTACTS ──
  async saveContact(contactId) {
    if (!currentUser || !contactId || contactId === currentUser.id) return { ok: false };
    try {
      var { error } = await sb.from('saved_contacts').upsert({
        user_id: currentUser.id,
        contact_id: contactId
      });
      if (error) { errorToast('save', error); return { ok: false, error: error }; }
      trackEvent('contact_saved', { contact_id: contactId });
      return { ok: true };
    } catch (e) { logError('dbActions.saveContact', e); errorToast('save', e); return { ok: false, error: e }; }
  },

  async removeContact(contactId) {
    if (!currentUser || !contactId) return { ok: false };
    try {
      var { error } = await sb.from('saved_contacts').delete()
        .eq('user_id', currentUser.id).eq('contact_id', contactId);
      if (error) { errorToast('save', error); return { ok: false, error: error }; }
      return { ok: true };
    } catch (e) { logError('dbActions.removeContact', e); return { ok: false, error: e }; }
  },

  // ── BUBBLE MEMBERSHIP ──
  async joinBubble(bubbleId) {
    if (!currentUser || !bubbleId) return { ok: false };
    try {
      var { error } = await sb.from('bubble_members').insert({
        bubble_id: bubbleId,
        user_id: currentUser.id
      });
      if (error && !String(error.message || '').includes('duplicate')) {
        errorToast('save', error); return { ok: false, error: error };
      }
      trackEvent('bubble_joined', { bubble_id: bubbleId });
      return { ok: true };
    } catch (e) { logError('dbActions.joinBubble', e); errorToast('save', e); return { ok: false, error: e }; }
  },

  async leaveBubble(bubbleId) {
    if (!currentUser || !bubbleId) return { ok: false };
    try {
      var { error } = await sb.from('bubble_members').delete()
        .eq('bubble_id', bubbleId).eq('user_id', currentUser.id);
      if (error) { errorToast('save', error); return { ok: false, error: error }; }
      trackEvent('bubble_left', { bubble_id: bubbleId });
      return { ok: true };
    } catch (e) { logError('dbActions.leaveBubble', e); errorToast('save', e); return { ok: false, error: e }; }
  },

  // ── PROFILE ──
  async updateProfile(fields) {
    if (!currentUser) return { ok: false };
    try {
      var { error } = await sb.from('profiles').update(fields).eq('id', currentUser.id);
      if (error) { errorToast('save', error); return { ok: false, error: error }; }
      // Update local cache
      if (currentProfile) Object.assign(currentProfile, fields);
      if (typeof _profileCache !== 'undefined' && _profileCache[currentUser.id]) {
        Object.assign(_profileCache[currentUser.id], fields);
      }
      return { ok: true };
    } catch (e) { logError('dbActions.updateProfile', e); errorToast('save', e); return { ok: false, error: e }; }
  },

  // ── DM MESSAGES ──
  async sendDM(receiverId, content, opts) {
    if (!currentUser || !receiverId) return { ok: false };
    opts = opts || {};
    try {
      var payload = {
        sender_id: currentUser.id,
        receiver_id: receiverId,
        content: content || '',
        file_url: opts.fileUrl || null,
        gif_url: opts.gifUrl || null
      };
      var { data, error } = await sb.from('messages').insert(payload).select().single();
      if (error) { errorToast('save', error); return { ok: false, error: error }; }
      trackEvent('dm_sent', { receiver_id: receiverId, has_file: !!opts.fileUrl, has_gif: !!opts.gifUrl });
      return { ok: true, message: data };
    } catch (e) { logError('dbActions.sendDM', e); errorToast('save', e); return { ok: false, error: e }; }
  },

  // ── BUBBLE MESSAGES ──
  async sendBubbleMessage(bubbleId, content, opts) {
    if (!currentUser || !bubbleId) return { ok: false };
    opts = opts || {};
    try {
      var payload = {
        bubble_id: bubbleId,
        user_id: currentUser.id,
        content: content || '',
        file_url: opts.fileUrl || null,
        gif_url: opts.gifUrl || null
      };
      var { data, error } = await sb.from('bubble_messages').insert(payload).select().single();
      if (error) { errorToast('save', error); return { ok: false, error: error }; }
      return { ok: true, message: data };
    } catch (e) { logError('dbActions.sendBubbleMessage', e); errorToast('save', e); return { ok: false, error: e }; }
  },

  // ── REPORTS ──
  async reportUser(reportedId, reason, details) {
    if (!currentUser || !reportedId) return { ok: false };
    try {
      var { error } = await sb.from('reports').insert({
        reporter_id: currentUser.id,
        reported_id: reportedId,
        reason: reason || 'other',
        details: details || ''
      });
      if (error) { errorToast('save', error); return { ok: false, error: error }; }
      return { ok: true };
    } catch (e) { logError('dbActions.reportUser', e); return { ok: false, error: e }; }
  }
};


