// ══════════════════════════════════════════════════════════
//  BUBBLE — UTILITIES (helpers, toast, modals, chips)
//  Auto-split from app.js · v3.7.0
// ══════════════════════════════════════════════════════════

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
  document.querySelectorAll('.person-sheet.open,.person-sheet-overlay.open').forEach(function(el) { el.classList.remove('open'); el.style.transform = ''; });
  document.querySelectorAll('.radar-person-sheet.open,.radar-person-overlay.open').forEach(function(el) { el.classList.remove('open'); el.style.transform = ''; });
  var gifPicker = document.getElementById('gif-picker');
  var gifOverlay = document.getElementById('gif-picker-overlay');
  if (gifPicker) gifPicker.classList.remove('open');
  if (gifOverlay) gifOverlay.classList.remove('open');
  document.querySelectorAll('.context-menu.open').forEach(function(el) { el.classList.remove('open'); });
  var reportTray = document.getElementById('event-report-tray');
  if (reportTray) { try { closeReportTray(); } catch(e) { reportTray.remove(); } }
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
function escHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

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
function bubbleIcon(type) {
  var t = (type || '').toLowerCase();
  if (t === 'event' || t === 'live') return icon('calendar');
  return icon('bubble');
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
  var iconStyle = 'style="width:0.6rem;height:0.6rem;flex-shrink:0"';
  if (visibility === 'hidden') return '<span style="font-size:0.65rem;color:var(--muted);display:inline-flex;align-items:center;gap:0.15rem;vertical-align:middle">' + ico('eye').replace('<svg ', '<svg ' + iconStyle + ' ') + 'Skjult</span>';
  if (visibility === 'private') return '<span style="font-size:0.65rem;color:var(--accent);display:inline-flex;align-items:center;gap:0.15rem;vertical-align:middle">' + ico('lock').replace('<svg ', '<svg ' + iconStyle + ' ') + 'Privat</span>';
  return '<span style="font-size:0.65rem;color:var(--green);display:inline-flex;align-items:center;gap:0.15rem;vertical-align:middle">' + ico('globe').replace('<svg ', '<svg ' + iconStyle + ' ') + 'Åben</span>';
}

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

// ── Success feedback ──
function showSuccessPulse(element) {
  if (!element) return;
  element.classList.add('success-pulse');
  setTimeout(function() { element.classList.remove('success-pulse'); }, 500);
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
function showSuccessToast(message) {
  var toast = document.getElementById('toast');
  if (!toast) { showToast(message); return; }
  toast.innerHTML = '<span class="check-pop" style="display:inline-block;margin-right:0.3rem">✓</span> ' + escHtml(message);
  toast.classList.add('show');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(function() { toast.classList.remove('show'); }, 2500);
}

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
