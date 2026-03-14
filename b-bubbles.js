// ══════════════════════════════════════════════════════════
//  BUBBLE — DISCOVER + BUBBLES + QR + PDF + INVITE
//  Auto-split from app.js · v3.7.0
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
//  DISCOVER
// ══════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════
//  BUBBLE UPVOTES / ANBEFAL
// ══════════════════════════════════════════════════════════
var bubbleUpvotes = {}; // { bubbleId: count }
var myUpvotes = {};     // { bubbleId: true }

async function loadBubbleUpvotes() {
  try {
    // Try loading from bubble_upvotes table
    var { data: all, error } = await sb.from('bubble_upvotes').select('bubble_id');
    if (error) {
      // Table might not exist yet — use localStorage fallback
      console.warn('bubble_upvotes table not found, using local fallback');
      var local = {};
      try { local = JSON.parse(localStorage.getItem('bubble_upvotes_local') || '{}'); } catch(e) {}
      bubbleUpvotes = local;
      var myLocal = {};
      try { myLocal = JSON.parse(localStorage.getItem('bubble_my_upvotes') || '{}'); } catch(e) {}
      myUpvotes = myLocal;
      return;
    }
    // Count per bubble
    bubbleUpvotes = {};
    (all || []).forEach(function(row) {
      bubbleUpvotes[row.bubble_id] = (bubbleUpvotes[row.bubble_id] || 0) + 1;
    });
    // Check which ones I upvoted
    var { data: mine } = await sb.from('bubble_upvotes').select('bubble_id').eq('user_id', currentUser.id);
    myUpvotes = {};
    (mine || []).forEach(function(row) { myUpvotes[row.bubble_id] = true; });
  } catch(e) { logError('loadBubbleUpvotes', e); }
}

async function toggleBubbleUpvote(bubbleId) {
  try {
    if (myUpvotes[bubbleId]) {
      // Remove upvote
      var { error } = await sb.from('bubble_upvotes').delete().eq('user_id', currentUser.id).eq('bubble_id', bubbleId);
      if (error) {
        // Fallback: localStorage
        delete myUpvotes[bubbleId];
        bubbleUpvotes[bubbleId] = Math.max((bubbleUpvotes[bubbleId] || 1) - 1, 0);
        try { localStorage.setItem('bubble_upvotes_local', JSON.stringify(bubbleUpvotes)); localStorage.setItem('bubble_my_upvotes', JSON.stringify(myUpvotes)); } catch(e) {}
      } else {
        delete myUpvotes[bubbleId];
        bubbleUpvotes[bubbleId] = Math.max((bubbleUpvotes[bubbleId] || 1) - 1, 0);
      }
      showToast('Anbefaling fjernet');
    } else {
      // Add upvote
      var { error } = await sb.from('bubble_upvotes').insert({ user_id: currentUser.id, bubble_id: bubbleId });
      if (error) {
        // Fallback: localStorage
        myUpvotes[bubbleId] = true;
        bubbleUpvotes[bubbleId] = (bubbleUpvotes[bubbleId] || 0) + 1;
        try { localStorage.setItem('bubble_upvotes_local', JSON.stringify(bubbleUpvotes)); localStorage.setItem('bubble_my_upvotes', JSON.stringify(myUpvotes)); } catch(e) {}
      } else {
        myUpvotes[bubbleId] = true;
        bubbleUpvotes[bubbleId] = (bubbleUpvotes[bubbleId] || 0) + 1;
      }
      showToast('Anbefalet \u2713');
    }
    // Re-render discover if visible
    if (allBubbles && allBubbles.length) renderBubbleList(allBubbles);
    // Update info panel button if open
    var recBtn = document.getElementById('bc-recommend-btn');
    if (recBtn && bcBubbleId === bubbleId) {
      recBtn.innerHTML = myUpvotes[bubbleId] ? icon('checkCircle') + ' Anbefalet' : icon('rocket') + ' Anbefal';
      recBtn.className = myUpvotes[bubbleId] ? 'chat-info-btn success' : 'chat-info-btn primary';
    }
    // Update action bar button
    var barBtn = document.getElementById('bc-upvote-bar-btn');
    if (barBtn && bcBubbleId === bubbleId) {
      var up = myUpvotes[bubbleId];
      barBtn.innerHTML = (up ? icon('checkCircle') : icon('rocket')) + ' ' + (up ? 'Anbefalet' : 'Anbefal');
      barBtn.classList.toggle('active', !!up);
    }
  } catch(e) { logError('toggleBubbleUpvote', e); showToast('Fejl: ' + (e.message || 'ukendt')); }
}

async function loadDiscover() {
  try {
    var myNav = _navVersion;
    const list = document.getElementById('all-bubbles-list');
    list.innerHTML = skelCards(4);
    await loadBubbleUpvotes();
    if (_navVersion !== myNav) return; // screen changed — abort

    // Get user's memberships + saved contacts in parallel
    var myBubbleIds = [];
    var mySavedIds = [];
    if (currentUser) {
      var [membRes, savedRes] = await Promise.all([
        sb.from('bubble_members').select('bubble_id').eq('user_id', currentUser.id),
        sb.from('saved_contacts').select('contact_id').eq('user_id', currentUser.id)
      ]);
      myBubbleIds = (membRes.data || []).map(function(m) { return m.bubble_id; });
      mySavedIds = (savedRes.data || []).map(function(s) { return s.contact_id; });
    }
    if (_navVersion !== myNav) return;

    const { data: bubbles } = await sb.from('bubbles').select('*, bubble_members(count)').or('visibility.eq.public,visibility.eq.private,visibility.is.null').order('created_at', {ascending:false});
    if (_navVersion !== myNav) return;
    allBubbles = (bubbles || []).filter(function(b) {
      return b.type !== 'live' && myBubbleIds.indexOf(b.id) < 0;
    }).map(b => ({
      ...b,
      member_count: b.member_count ?? b.bubble_members?.[0]?.count ?? 0,
      type_label: typeLabel(b.type),
      upvote_count: bubbleUpvotes[b.id] || 0
    }));

    // Enrich with saved contact avatars (shared helper)
    var discoverBubbleIds = allBubbles.map(function(b) { return b.id; });
    var contactMemberMap = await fetchContactAvatarsForBubbles(discoverBubbleIds, mySavedIds);
    if (_navVersion !== myNav) return;

    // Attach contact info to bubbles
    allBubbles.forEach(function(b) { b._contacts = contactMemberMap[b.id] || []; });

    // Sort: upvotes first, then member count, then date
    allBubbles.sort(function(a, b) {
      if (b.upvote_count !== a.upvote_count) return b.upvote_count - a.upvote_count;
      if (b.member_count !== a.member_count) return b.member_count - a.member_count;
      return new Date(b.created_at) - new Date(a.created_at);
    });
    renderBubbleList(allBubbles);
  } catch(e) { logError("loadDiscover", e); showRetryState('all-bubbles-list', 'loadDiscover', 'Kunne ikke hente bobler — tjek din forbindelse'); }
}

function renderBubbleList(bubbles) {
  const list = document.getElementById('all-bubbles-list');
  if (!bubbles.length) {
    list.innerHTML = '<div class="empty-state"><div class="empty-icon">' + icon('search') + '</div><div class="empty-text">Ingen bobler endnu.<br>Opret den første!</div></div>';
    return;
  }
  list.innerHTML = bubbles.map(b => bubbleCard(b, false)).join('');
}

let _filterTimer = null;
function filterBubbles() {
  clearTimeout(_filterTimer);
  _filterTimer = setTimeout(() => {
    const q = document.getElementById('bubble-search').value.toLowerCase();
    const filtered = q ? allBubbles.filter(b =>
      b.name.toLowerCase().includes(q) || (b.keywords || []).some(k => k.toLowerCase().includes(q))
    ) : allBubbles;
    if (q && filtered.length === 0) {
      document.getElementById('all-bubbles-list').innerHTML = '<div class="empty-state" style="padding:2rem 0"><div class="empty-icon">' + icon('search') + '</div><div class="empty-text">Ingen bobler matcher "' + escHtml(q) + '"</div></div>';
    } else {
      renderBubbleList(filtered);
    }
  }, 150);
}

// ══════════════════════════════════════════════════════════
//  BUBBLE DETAIL
// ══════════════════════════════════════════════════════════
async function openBubble(bubbleId, fromScreen) {
  try {
    // Auto-detect current screen if not provided
    if (!fromScreen) fromScreen = _activeScreen || 'screen-home';
    await openBubbleChat(bubbleId, fromScreen);
  } catch(e) { logError("openBubble", e); showToast(e.message || "Ukendt fejl"); }
}

// loadBubbleMembers removed — integrated into screen-bubble-chat bcLoadMembers

async function joinBubble(bubbleId) {
  try {
    const { error } = await sb.from('bubble_members').insert({ bubble_id: bubbleId, user_id: currentUser.id });
    if (error && !String(error.message || '').includes('duplicate')) return showToast('Fejl ved joining');
    showSuccessToast('Du er nu i boblen');
    await openBubble(bubbleId);
    loadHome();
    trackEvent('bubble_joined', { bubble_id: bubbleId });
  } catch(e) { logError("joinBubble", e); showToast(e.message || "Ukendt fejl"); }
}

async function leaveBubble(bubbleId) {
  // Show inline confirm tray in the action bar area
  var bar = document.getElementById('bc-action-bar');
  if (!bar) return;
  if (bar.querySelector('.leave-confirm')) return; // already showing
  // Save original content for restore on cancel
  var originalHtml = bar.innerHTML;
  var tray = document.createElement('div');
  tray.className = 'leave-confirm';
  tray.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:0.5rem 0.6rem;background:rgba(26,122,138,0.08);border:1px solid rgba(26,122,138,0.2);border-radius:10px;gap:0.5rem;width:100%';
  tray.innerHTML = '<span style="font-size:0.72rem;color:var(--text-secondary)">Forlad boblen?</span>' +
    '<div style="display:flex;gap:0.3rem">' +
    '<button style="font-size:0.7rem;padding:0.25rem 0.6rem;background:rgba(26,122,138,0.15);color:var(--accent2);border:1px solid rgba(26,122,138,0.3);border-radius:8px;cursor:pointer;font-family:inherit;font-weight:600" onclick="confirmLeaveBubble(\'' + bubbleId + '\')">Forlad</button>' +
    '<button style="font-size:0.7rem;padding:0.25rem 0.6rem;background:none;color:var(--muted);border:1px solid var(--glass-border);border-radius:8px;cursor:pointer;font-family:inherit" onclick="cancelLeaveBubble()">Annuller</button>' +
    '</div>';
  bar.dataset.originalHtml = originalHtml;
  bar.innerHTML = '';
  bar.appendChild(tray);
}

function cancelLeaveBubble() {
  var bar = document.getElementById('bc-action-bar');
  if (bar && bar.dataset.originalHtml) {
    bar.innerHTML = bar.dataset.originalHtml;
    delete bar.dataset.originalHtml;
  }
}

async function confirmLeaveBubble(bubbleId) {
  try {
    await sb.from('bubble_members').delete().eq('bubble_id', bubbleId).eq('user_id', currentUser.id);
    showToast('Du har forladt boblen');
    // Navigate back using stored fromScreen
    var backBtn = document.getElementById('bc-back-btn');
    if (backBtn) { backBtn.click(); } else { goTo(_activeScreen || 'screen-home'); }
  } catch(e) { logError("confirmLeaveBubble", e); showToast(e.message || "Ukendt fejl"); }
}

// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
//  CREATE BUBBLE
// ══════════════════════════════════════════════════════════
function openCreateBubble() {
  cbChips = [];
  document.getElementById('cb-name').value = '';
  document.getElementById('cb-desc').value = '';
  document.getElementById('cb-location').value = '';
  renderChips('cb-chips', cbChips, 'cb-chips-container', 'cb-chip-input');
  openModal('modal-create-bubble');
  setTimeout(function() {
    initInputConfirmButtons();
    cbRenderPillSelect('cb-type', [
      { value: 'event',   icon: 'rocket',   label: 'Event' },
      { value: 'local',   icon: 'pin',      label: 'Lokal' },
      { value: 'theme',   icon: 'target',   label: 'Tematiseret' },
      { value: 'company', icon: 'building', label: 'Virksomhed' }
    ]);
    cbRenderPillSelect('cb-visibility', [
      { value: 'public',  icon: 'globe', label: 'Offentlig' },
      { value: 'private', icon: 'lock',  label: 'Privat' },
      { value: 'hidden',  icon: 'eye',   label: 'Skjult' }
    ]);
  }, 50);
}

function cbRenderPillSelect(selectId, options) {
  var select = document.getElementById(selectId);
  if (!select) return;
  var existingPills = document.getElementById(selectId + '-pills');
  if (existingPills) existingPills.remove();
  var current = select.value;
  var wrap = document.createElement('div');
  wrap.id = selectId + '-pills';
  wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:0.4rem;margin-top:0.25rem';
  options.forEach(function(opt) {
    var btn = document.createElement('button');
    btn.type = 'button';
    var isActive = opt.value === current;
    btn.style.cssText = 'display:flex;align-items:center;gap:0.35rem;padding:0.4rem 0.75rem;border-radius:99px;font-size:0.78rem;font-weight:600;font-family:inherit;cursor:pointer;transition:all 0.15s;border:1.5px solid ' + (isActive ? 'rgba(46,158,142,0.5)' : 'var(--glass-border)') + ';background:' + (isActive ? 'rgba(46,158,142,0.12)' : 'rgba(255,255,255,0.04)') + ';color:' + (isActive ? 'var(--accent)' : 'var(--muted)');
    var ico = document.createElement('span');
    ico.style.cssText = 'width:0.85rem;height:0.85rem;display:flex;align-items:center;justify-content:center';
    ico.innerHTML = ICONS[opt.icon] || '';
    var lbl = document.createElement('span');
    lbl.textContent = opt.label;
    btn.appendChild(ico);
    btn.appendChild(lbl);
    btn.onclick = function() {
      select.value = opt.value;
      wrap.querySelectorAll('button').forEach(function(b) {
        b.style.borderColor = 'var(--glass-border)';
        b.style.background = 'rgba(255,255,255,0.04)';
        b.style.color = 'var(--muted)';
      });
      btn.style.borderColor = 'rgba(46,158,142,0.5)';
      btn.style.background = 'rgba(46,158,142,0.12)';
      btn.style.color = 'var(--accent)';
    };
    wrap.appendChild(btn);
  });
  // Hide native select, insert pills after it
  select.style.display = 'none';
  select.parentNode.insertBefore(wrap, select.nextSibling);
}

async function createBubble() {
  try {
    const name = document.getElementById('cb-name').value.trim();
    const type = document.getElementById('cb-type').value;
    const desc = document.getElementById('cb-desc').value.trim();
    const location = document.getElementById('cb-location').value.trim();
    if (!name) return showToast('Navn er påkrævet');
    const visibility = document.getElementById('cb-visibility')?.value || 'public';
    const { data: bubble, error } = await sb.from('bubbles').insert({
      name, type, type_label: typeLabel(type), description: desc, location,
      keywords: cbChips, created_by: currentUser.id, visibility
    }).select().single();
    if (error) return showToast('Fejl: ' + error.message);
    // Auto-join
    await sb.from('bubble_members').insert({ bubble_id: bubble.id, user_id: currentUser.id });
    closeModal('modal-create-bubble');
    showToast(`"${name}" oprettet! 🫧`);
    loadHome();
    loadDiscover();
  } catch(e) { logError("createBubble", e); showToast(e.message || "Ukendt fejl"); }
}


// ══════════════════════════════════════════════════════════
//  PRIVATE BUBBLE — JOIN REQUEST
// ══════════════════════════════════════════════════════════
async function requestJoin(bubbleId) {
  try {
    const { data: b } = await sb.from('bubbles').select('name,created_by').eq('id', bubbleId).single();
    const { error } = await sb.from('bubble_members').insert({
      bubble_id: bubbleId, user_id: currentUser.id, status: 'pending'
    });
    if (error && !String(error.message || '').includes('duplicate')) return showToast('Fejl: ' + error.message);
    showToast('Anmodning sendt! Ejeren skal godkende 🔒');
    await openBubble(bubbleId);
  } catch(e) { logError("requestJoin", e); showToast(e.message || "Ukendt fejl"); }
}

// ══════════════════════════════════════════════════════════
//  EDIT BUBBLE
// ══════════════════════════════════════════════════════════
let currentEditBubbleId = null;

async function openEditBubble(bubbleId) {
  try {
    currentEditBubbleId = bubbleId;
    const { data: b } = await sb.from('bubbles').select('*').eq('id', bubbleId).single();
    if (!b) return;
    document.getElementById('eb-name').value = b.name || '';
    document.getElementById('eb-type').value = b.type || 'event';
    document.getElementById('eb-visibility').value = b.visibility || 'public';
    document.getElementById('eb-desc').value = b.description || '';
    document.getElementById('eb-location').value = b.location || '';
    ebChips = [...(b.keywords || [])];
    renderChips('eb-chips', ebChips, 'eb-chips-container', 'eb-chip-input');
    openModal('modal-edit-bubble');
    setTimeout(initInputConfirmButtons, 50);
  } catch(e) { logError("openEditBubble", e); showToast(e.message || "Ukendt fejl"); }
}

async function saveEditBubble() {
  try {
    const name       = document.getElementById('eb-name').value.trim();
    const type       = document.getElementById('eb-type').value;
    const visibility = document.getElementById('eb-visibility').value;
    const desc       = document.getElementById('eb-desc').value.trim();
    const location   = document.getElementById('eb-location').value.trim();
    if (!name) return showToast('Navn er påkrævet');
    const { error } = await sb.from('bubbles').update({
      name, type, type_label: typeLabel(type),
      visibility, description: desc, location, keywords: ebChips
    }).eq('id', currentEditBubbleId);
    if (error) return showToast('Fejl: ' + error.message);
    closeModal('modal-edit-bubble');
    showSuccessToast('Boble opdateret');
    // Reload bubble data in-place (preserves back navigation)
    await bcLoadBubbleInfo();
    await bcLoadMembers();
  } catch(e) { logError("saveEditBubble", e); showToast(e.message || "Ukendt fejl"); }
}

// ══════════════════════════════════════════════════════════
//  QR CODE
// ══════════════════════════════════════════════════════════
let currentQRBubble = null;

async function openQRModal(bubbleId) {
  try {
    currentQRBubble = bubbleId;
    const { data: b } = await sb.from('bubbles').select('*').eq('id', bubbleId).single();
    if (!b) return;

    document.getElementById('qr-modal-title').innerHTML = b.name + ' ' + icon('bubble');
    document.getElementById('qr-modal-subtitle').textContent =
      `${typeLabel(b.type)}${b.location ? ' · ' + b.location : ''} — scan for at joine`;

    // Build the join URL — opens app and auto-joins the bubble
    const joinUrl = `${window.location.origin}${window.location.pathname}?join=${bubbleId}`;

    // Clear and render QR
    const el = document.getElementById('qr-code-el');
    el.innerHTML = '';
    new QRCode(el, {
      text: joinUrl,
      width: 220,
      height: 220,
      colorDark: '#0a0a0f',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.H
    });

    openModal('modal-qr');
  } catch(e) { logError("openQRModal", e); showToast(e.message || "Ukendt fejl"); }
}

let _jsPdfLoaded = false;
async function loadJsPdf() {
  try {
  if (_jsPdfLoaded) return;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    s.onload = resolve;
    s.onerror = () => reject(new Error('Kunne ikke indlæse jsPDF'));
    document.head.appendChild(s);
  });
  _jsPdfLoaded = true;
  } catch(e) { logError("loadJsPdf", e); }
}

async function downloadQRPdf() {
  try {
  await loadJsPdf();
  const { data: b, error } = await sb.from('bubbles').select('*').eq('id', currentQRBubble).single();
  if (error || !b) return showToast('Kunne ikke hente boble-data');

  showToast('Genererer PDF...');

  // Wait a tick for QR to render fully
  await new Promise(r => setTimeout(r, 300));

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageW = 210, pageH = 297;

  // Dark background
  doc.setFillColor(10, 10, 15);
  doc.rect(0, 0, pageW, pageH, 'F');

  // Purple accent top bar
  doc.setFillColor(108, 99, 255);
  doc.rect(0, 0, pageW, 8, 'F');

  // Bubble logo area (purple rounded rect simulation)
  doc.setFillColor(108, 99, 255);
  doc.roundedRect(pageW/2 - 18, 28, 36, 36, 6, 6, 'F');

  // Bubble text in logo
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.text('bubble', pageW/2, 51, { align: 'center' });

  // App name
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(240, 240, 248);
  doc.text('bubble', pageW/2, 82, { align: 'center' });

  // Tagline
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(108, 108, 138);
  doc.text('Network Radar for Business', pageW/2, 91, { align: 'center' });

  // Divider
  doc.setDrawColor(42, 42, 61);
  doc.setLineWidth(0.5);
  doc.line(20, 99, pageW - 20, 99);

  // Bubble name
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(240, 240, 248);
  doc.text(b.name, pageW/2, 115, { align: 'center' });

  // Type + location
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(108, 108, 138);
  const meta = typeLabel(b.type) + (b.location ? ' · ' + b.location : '');
  doc.text(meta, pageW/2, 124, { align: 'center' });

  // Keywords
  if (b.keywords && b.keywords.length) {
    doc.setFontSize(10);
    doc.setTextColor(108, 99, 255);
    doc.text(b.keywords.slice(0,5).join('  ·  '), pageW/2, 133, { align: 'center' });
  }

  // QR code — get canvas from DOM
  const qrCanvas = document.querySelector('#qr-code-el canvas') ||
                   document.querySelector('#qr-code-el img');

  if (qrCanvas) {
    let imgData;
    if (qrCanvas.tagName === 'CANVAS') {
      imgData = qrCanvas.toDataURL('image/png');
    } else {
      // It's an img tag — draw to canvas first
      const tmpCanvas = document.createElement('canvas');
      tmpCanvas.width = 220; tmpCanvas.height = 220;
      tmpCanvas.getContext('2d').drawImage(qrCanvas, 0, 0);
      imgData = tmpCanvas.toDataURL('image/png');
    }

    // White background behind QR
    const qrSize = 80;
    const qrX = (pageW - qrSize) / 2;
    const qrY = 145;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(qrX - 6, qrY - 6, qrSize + 12, qrSize + 12, 4, 4, 'F');
    doc.addImage(imgData, 'PNG', qrX, qrY, qrSize, qrSize);
  }

  // Scan instruction
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(240, 240, 248);
  doc.text('Scan og join boblen', pageW/2, 245, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(108, 108, 138);
  doc.text('Åbn iPhone-kameraet og ret det mod QR-koden', pageW/2, 253, { align: 'center' });
  doc.text('Du bliver automatisk tilføjet til boblen', pageW/2, 260, { align: 'center' });

  // Bottom accent
  doc.setFillColor(108, 99, 255);
  doc.rect(0, pageH - 8, pageW, 8, 'F');

  // Save
  const filename = `bubble-qr-${b.name.toLowerCase().replace(/\s+/g,'-')}.pdf`;
  doc.save(filename);
  showToast('PDF downloadet! 🖨️');
  } catch(e) { showToast('PDF fejl: ' + (e.message || 'Ukendt')); }
}

// ══════════════════════════════════════════════════════════
//  AUTO-JOIN VIA QR SCAN
// ══════════════════════════════════════════════════════════
async function checkQRJoin() {
  try {
    const params = new URLSearchParams(window.location.search);
    const joinId = params.get('join');
    if (!joinId) return;

    // Clean URL
    window.history.replaceState({}, '', window.location.pathname);

    // Wait for auth
    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
      // Save for after login
      sessionStorage.setItem('pending_join', joinId);
      return;
    }

    // Auto-join
    const { error } = await sb.from('bubble_members')
      .insert({ bubble_id: joinId, user_id: session.user.id });

    if (!error || String(error.message || '').includes('duplicate')) {
      showSuccessToast('Du er checket ind');
      await openBubble(joinId, 'screen-home');
    }
  } catch(e) { logError("checkQRJoin", e); showToast(e.message || "Ukendt fejl"); }
}

async function checkPendingJoin() {
  try {
    const joinId = sessionStorage.getItem('pending_join');
    if (!joinId) return;
    sessionStorage.removeItem('pending_join');
    const { error } = await sb.from('bubble_members')
      .insert({ bubble_id: joinId, user_id: currentUser.id });
    if (!error || String(error.message || '').includes('duplicate')) {
      showSuccessToast('Du er checket ind');
      await openBubble(joinId, 'screen-home');
    }
  } catch(e) { logError("checkPendingJoin", e); showToast(e.message || "Ukendt fejl"); }
}



// ══════════════════════════════════════════════════════════
//  DELTAGER PDF — boble-ejer eksport
// ══════════════════════════════════════════════════════════
async function downloadMembersPdf(bubbleId) {
  try {
    showToast('Henter deltagerliste...');
    await loadJsPdf();
    const { jsPDF } = window.jspdf;

    // ── Fetch data ──
    const { data: b } = await sb.from('bubbles').select('*').eq('id', bubbleId).single();
    if (!b) { showToast('Kunne ikke hente boble-data'); return; }

    const { data: members } = await sb.from('bubble_members')
      .select('user_id, joined_at, checked_in_at, checked_out_at')
      .eq('bubble_id', bubbleId)
      .order('checked_in_at', { ascending: true, nullsFirst: false });

    if (!members || members.length === 0) { showToast('Ingen deltagere endnu'); return; }

    const userIds = members.map(m => m.user_id);
    const { data: profiles } = await sb.from('profiles')
      .select('id, name, title, workplace').in('id', userIds);
    const profileMap = {};
    (profiles || []).forEach(p => { profileMap[p.id] = p; });

    // ── Compute stats ──
    const checkedIn = members.filter(m => m.checked_in_at);
    const totalMembers = members.length;
    const totalCheckedIn = checkedIn.length;

    function fmtTime(iso) {
      if (!iso) return '–';
      return new Date(iso).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });
    }
    function fmtDate(iso) {
      if (!iso) return '–';
      return new Date(iso).toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' });
    }
    function fmtDuration(inIso, outIso) {
      if (!inIso) return '–';
      var end = outIso ? new Date(outIso) : new Date();
      var mins = Math.round((end - new Date(inIso)) / 60000);
      if (mins < 1) return '< 1 min';
      if (mins < 60) return mins + ' min';
      return Math.floor(mins / 60) + 't ' + (mins % 60) + 'min';
    }

    // ── Build PDF ──
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pw = 210, ph = 297;
    const ml = 14, mr = 14, contentW = pw - ml - mr;

    // Dark header bar
    doc.setFillColor(10, 10, 20);
    doc.rect(0, 0, pw, ph, 'F');

    // Top accent gradient bar
    doc.setFillColor(108, 99, 255);
    doc.rect(0, 0, pw, 6, 'F');

    // Bubble logo text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(139, 127, 255);
    doc.text('bubble', ml, 16);

    // Report label top right
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(90, 90, 110);
    var today = new Date().toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' });
    doc.text('Genereret ' + today, pw - mr, 16, { align: 'right' });

    // Divider
    doc.setDrawColor(40, 40, 60);
    doc.setLineWidth(0.3);
    doc.line(ml, 20, pw - mr, 20);

    // Bubble name
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(230, 230, 245);
    doc.text(b.name, ml, 33);

    // Meta line
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 130);
    var metaParts = [typeLabel(b.type)];
    if (b.location) metaParts.push(b.location);
    if (b.description) metaParts.push(b.description.slice(0, 60) + (b.description.length > 60 ? '...' : ''));
    doc.text(metaParts.join('  ·  '), ml, 40);

    // ── Summary boxes ──
    var boxY = 46;
    var boxH = 16;
    var boxes = [
      { label: 'Tilmeldte', val: String(totalMembers), color: [108, 99, 255] },
      { label: 'Check-in', val: String(totalCheckedIn), color: [46, 207, 207] },
      { label: 'Fremmøde', val: totalMembers > 0 ? Math.round(totalCheckedIn / totalMembers * 100) + '%' : '–', color: [16, 185, 129] }
    ];
    var boxW = (contentW - 6) / 3;
    boxes.forEach(function(box, i) {
      var bx = ml + i * (boxW + 3);
      doc.setFillColor(box.color[0], box.color[1], box.color[2], 0.12);
      // Simulate transparency with a dark fill
      doc.setFillColor(20, 20, 35);
      doc.roundedRect(bx, boxY, boxW, boxH, 2, 2, 'F');
      doc.setDrawColor(box.color[0], box.color[1], box.color[2]);
      doc.setLineWidth(0.4);
      doc.roundedRect(bx, boxY, boxW, boxH, 2, 2, 'S');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(box.color[0], box.color[1], box.color[2]);
      doc.text(box.val, bx + boxW / 2, boxY + 9, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(110, 110, 140);
      doc.text(box.label, bx + boxW / 2, boxY + 14, { align: 'center' });
    });

    // ── Table header ──
    var tableY = boxY + boxH + 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(110, 110, 140);

    // Column widths (sum = contentW = 182)
    var cols = [
      { label: 'NAVN',         x: ml,      w: 44 },
      { label: 'TITEL',        x: ml + 44, w: 38 },
      { label: 'VIRKSOMHED',   x: ml + 82, w: 36 },
      { label: 'CHECK-IN',     x: ml + 118,w: 22 },
      { label: 'CHECK-OUT',    x: ml + 140,w: 22 },
      { label: 'VARIGHED',     x: ml + 162,w: 20 }
    ];

    cols.forEach(function(col) {
      doc.text(col.label, col.x, tableY);
    });

    // Header underline
    doc.setDrawColor(50, 50, 70);
    doc.setLineWidth(0.3);
    doc.line(ml, tableY + 2, pw - mr, tableY + 2);

    // ── Table rows ──
    var rowY = tableY + 7;
    var rowH = 7.5;
    var rowCount = 0;

    // Sort: checked-in first (by check-in time), then members without check-in
    var sorted = [...members].sort(function(a, b) {
      if (a.checked_in_at && !b.checked_in_at) return -1;
      if (!a.checked_in_at && b.checked_in_at) return 1;
      if (a.checked_in_at && b.checked_in_at) return new Date(a.checked_in_at) - new Date(b.checked_in_at);
      return new Date(a.joined_at) - new Date(b.joined_at);
    });

    sorted.forEach(function(m, i) {
      // New page if needed
      if (rowY + rowH > ph - 18) {
        doc.addPage();
        doc.setFillColor(10, 10, 20);
        doc.rect(0, 0, pw, ph, 'F');
        doc.setFillColor(108, 99, 255);
        doc.rect(0, 0, pw, 3, 'F');
        rowY = 14;
        // Repeat column headers
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(110, 110, 140);
        cols.forEach(function(col) { doc.text(col.label, col.x, rowY); });
        doc.setDrawColor(50, 50, 70);
        doc.line(ml, rowY + 2, pw - mr, rowY + 2);
        rowY += 7;
      }

      var p = profileMap[m.user_id] || {};
      var isCheckedIn = !!m.checked_in_at;

      // Alternating row bg
      if (i % 2 === 0) {
        doc.setFillColor(18, 18, 30);
        doc.rect(ml - 1, rowY - 5, contentW + 2, rowH, 'F');
      }

      // Live indicator dot
      var isLive = m.checked_in_at && !m.checked_out_at;
      if (isLive) {
        doc.setFillColor(46, 207, 207);
        doc.circle(ml - 4, rowY - 2, 1.2, 'F');
      }

      function truncate(str, maxLen) {
        if (!str) return '–';
        return str.length > maxLen ? str.slice(0, maxLen - 1) + '…' : str;
      }

      doc.setFont('helvetica', isCheckedIn ? 'bold' : 'normal');
      doc.setFontSize(8);
      doc.setTextColor(isCheckedIn ? 220 : 150, isCheckedIn ? 220 : 150, isCheckedIn ? 235 : 170);
      doc.text(truncate(p.name || 'Ukendt', 22), cols[0].x, rowY);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(130, 130, 155);
      doc.text(truncate(p.title || '', 20), cols[1].x, rowY);
      doc.text(truncate(p.workplace || '', 18), cols[2].x, rowY);

      doc.setTextColor(isCheckedIn ? 46 : 80, isCheckedIn ? 207 : 80, isCheckedIn ? 207 : 100);
      doc.text(fmtTime(m.checked_in_at), cols[3].x, rowY);

      doc.setTextColor(130, 130, 155);
      doc.text(fmtTime(m.checked_out_at), cols[4].x, rowY);
      doc.text(fmtDuration(m.checked_in_at, m.checked_out_at), cols[5].x, rowY);

      rowY += rowH;
      rowCount++;
    });

    // ── Footer ──
    var footerY = ph - 10;
    doc.setDrawColor(40, 40, 60);
    doc.setLineWidth(0.3);
    doc.line(ml, footerY - 4, pw - mr, footerY - 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(70, 70, 90);
    doc.text('Genereret af Bubble · bubble.app', ml, footerY);
    doc.text('Side 1 af ' + doc.getNumberOfPages(), pw - mr, footerY, { align: 'right' });

    // Bottom accent bar
    doc.setFillColor(108, 99, 255);
    doc.rect(0, ph - 3, pw, 3, 'F');

    // ── Save ──
    var safeName = b.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    var dateStr = new Date().toISOString().slice(0, 10);
    doc.save('deltagerliste-' + safeName + '-' + dateStr + '.pdf');
    showToast('PDF downloadet! 📋');
    trackEvent('members_pdf_export', { bubble_id: bubbleId, member_count: totalMembers });

  } catch(e) { logError('downloadMembersPdf', e); showToast('PDF fejl: ' + (e.message || 'ukendt')); }
}

// ══════════════════════════════════════════════════════════
//  BUBBLE INVITE SYSTEM
// ══════════════════════════════════════════════════════════
var inviteBubbleId = null;
var inviteSelected = [];

async function openInviteModal(bubbleId) {
  try {
  inviteBubbleId = bubbleId;
  inviteSelected = [];
  var overlay = document.getElementById('invite-overlay');
  var sheet = document.getElementById('invite-sheet');
  var list = document.getElementById('invite-list');
  if (!overlay || !sheet || !list) return;
  overlay.classList.add('open');
  setTimeout(function() { sheet.classList.add('open'); }, 10);
  list.innerHTML = '<div style="text-align:center;padding:1.5rem;font-size:0.75rem;color:var(--muted)">Henter gemte kontakter...</div>';
  var btn = document.getElementById('invite-send-btn');
  if (btn) btn.textContent = 'Send invitationer';

  try {
    var r1 = await sb.from('saved_contacts').select('contact_id').eq('user_id', currentUser.id);
    var contactIds = (r1.data || []).map(function(s) { return s.contact_id; });
    if (contactIds.length === 0) {
      list.innerHTML = '<div style="text-align:center;padding:2rem;font-size:0.78rem;color:var(--muted)">Du har ingen gemte kontakter endnu.<br>Gem profiler fra radaren f\u00f8rst.</div>';
      return;
    }
    var r2 = await sb.from('profiles').select('id,name,title,keywords,avatar_url').in('id', contactIds);
    var profiles = r2.data || [];
    var r3 = await sb.from('bubble_members').select('user_id').eq('bubble_id', bubbleId);
    var memberIds = (r3.data || []).map(function(m) { return m.user_id; });
    var r4 = await sb.from('bubble_invitations').select('to_user_id').eq('bubble_id', bubbleId).eq('status', 'pending');
    var pendingIds = (r4.data || []).map(function(inv) { return inv.to_user_id; });

    var available = profiles.filter(function(p) { return memberIds.indexOf(p.id) < 0; });
    if (available.length === 0) {
      list.innerHTML = '<div style="text-align:center;padding:2rem;font-size:0.78rem;color:var(--muted)">Alle dine gemte kontakter er allerede i denne boble.</div>';
      return;
    }
    // Sort by star rating
    available.sort(function(a, b) { return (starGet(b.id) || 0) - (starGet(a.id) || 0); });
    var colors = proxColors || ['linear-gradient(135deg,#3AAA88,#2A7A90)'];
    list.innerHTML = available.map(function(p, i) {
      var ini = (p.name||'?').split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();
      var col = colors[i % colors.length];
      var isPending = pendingIds.indexOf(p.id) >= 0;
      var stars = starGet(p.id);
      var starHtml = stars > 0 ? ' <span style="font-size:0.55rem;color:var(--accent)">' + '\u2605'.repeat(stars) + '</span>' : '';
      return '<label class="invite-row' + (isPending ? ' pending' : '') + '" data-uid="' + p.id + '">' +
        '<div class="invite-avatar" style="background:' + col + '">' + escHtml(ini) + '</div>' +
        '<div style="flex:1;min-width:0">' +
          '<div class="fw-600 fs-085">' + escHtml(p.name || '?') + starHtml + '</div>' +
          '<div class="fs-072 text-muted">' + escHtml(p.title || '') + '</div>' +
        '</div>' +
        (isPending ? '<span class="fs-065 text-muted">Afventer</span>' :
          '<input type="checkbox" class="invite-check" data-uid="' + p.id + '" onchange="toggleInvite(this)">') +
      '</label>';
    }).join('');
  } catch(e) { logError('openInviteModal', e); list.innerHTML = '<div style="padding:1rem;color:var(--accent2)">Kunne ikke hente kontakter</div>'; }
  } catch(e) { logError("openInviteModal", e); }
}

function closeInviteModal() {
  var sheet = document.getElementById('invite-sheet');
  var overlay = document.getElementById('invite-overlay');
  if (sheet) sheet.classList.remove('open');
  setTimeout(function() { if (overlay) overlay.classList.remove('open'); }, 320);
  inviteSelected = [];
}

function toggleInvite(cb) {
  var uid = cb.dataset.uid;
  if (cb.checked) { if (inviteSelected.indexOf(uid) < 0) inviteSelected.push(uid); }
  else { inviteSelected = inviteSelected.filter(function(id) { return id !== uid; }); }
  var btn = document.getElementById('invite-send-btn');
  var n = inviteSelected.length;
  if (btn) {
    btn.textContent = n > 0 ? 'Send (' + n + ')' : 'Send invitationer';
    btn.disabled = n === 0;
    btn.style.opacity = n > 0 ? '1' : '0.4';
  }
  // Update subtitle
  var sub = document.getElementById('invite-subtitle');
  if (sub) sub.textContent = n > 0 ? n + ' valgt' : 'Vælg fra dine gemte kontakter';
}

async function sendBubbleInvites() {
  if (inviteSelected.length === 0) return showToast('Vælg mindst én kontakt');
  try {
    var btn = document.getElementById('invite-send-btn');
    if (btn) { btn.textContent = 'Sender...'; btn.disabled = true; btn.style.opacity = '0.5'; }
    var rows = inviteSelected.map(function(uid) {
      return { bubble_id: inviteBubbleId, from_user_id: currentUser.id, to_user_id: uid, status: 'pending' };
    });
    var { error } = await sb.from('bubble_invitations').insert(rows);
    if (error) throw error;
    closeInviteModal();
    showToast(inviteSelected.length + ' invitation' + (inviteSelected.length > 1 ? 'er' : '') + ' sendt \u2713');
  } catch(e) { logError('sendBubbleInvites', e); showToast('Kunne ikke sende: ' + (e.message || 'ukendt fejl'));
    var btn2 = document.getElementById('invite-send-btn');
    if (btn2) { btn2.textContent = 'Send (' + inviteSelected.length + ')'; btn2.disabled = false; btn2.style.opacity = '1'; }
  }
}


function bcOpenPerson(userId, name, title, color, fromScreen) {
  const initials = (name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  document.getElementById('ps-avatar').style.background = color;
  document.getElementById('ps-avatar').textContent = initials;
  document.getElementById('ps-avatar').style.overflow = 'hidden';
  document.getElementById('ps-name').textContent = name || 'Ukendt';
  document.getElementById('ps-sub').textContent = title || '';
  document.getElementById('ps-bio').textContent = '';
  document.getElementById('ps-bubbleup-btn').style.display = 'flex';
  document.getElementById('ps-bubbleup-confirm').classList.remove('show');
  // Fetch full profile for bio + LinkedIn + avatar
  const liBtn = document.getElementById('ps-linkedin-btn');
  liBtn.style.display = 'none';
  sb.from('profiles').select('bio,linkedin,workplace,avatar_url').eq('id', userId).single().then(({data}) => {
    if (data?.bio) document.getElementById('ps-bio').textContent = data.bio;
    var subEl = document.getElementById('ps-sub');
    if (subEl && data?.workplace) subEl.textContent = (title || '') + (title && data.workplace ? ' · ' : '') + (data.workplace || '');
    if (data?.linkedin) { liBtn.href = data.linkedin.startsWith('http') ? data.linkedin : 'https://' + data.linkedin; liBtn.style.display = 'flex'; }
    // Show avatar photo if available
    var psAv = document.getElementById('ps-avatar');
    if (psAv && data?.avatar_url) {
      psAv.innerHTML = '<img src="' + escHtml(data.avatar_url) + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%">';
    }
  });
  // Store userId and fromScreen
  document.getElementById('person-sheet-el').dataset.userId = userId;
  document.getElementById('person-sheet-el').dataset.userName = name;
  document.getElementById('person-sheet-el').dataset.fromScreen = fromScreen || 'screen-bubble-chat';
  // Check if contact is already saved — update button state
  const saveBtn = document.getElementById('ps-save-btn');
  const modSection = document.querySelector('.ps-moderation');
  const isOwnProfile = userId === currentUser?.id;
  if (saveBtn) {
    if (isOwnProfile) { saveBtn.style.display = 'none'; }
    else {
      saveBtn.style.display = '';
      saveBtn.innerHTML = icon('bookmark') + ' Gem';
      sb.from('saved_contacts').select('id').eq('user_id', currentUser.id).eq('contact_id', userId).maybeSingle().then(({data}) => {
        if (data) saveBtn.innerHTML = icon('bookmarkFill') + ' Gemt';
      });
    }
  }
  if (modSection) modSection.style.display = isOwnProfile ? 'none' : '';
  // Show star rating if contact is saved
  var starRow = document.getElementById('ps-star-row');
  var starsEl = document.getElementById('ps-stars');
  if (starRow && starsEl) {
    sb.from('saved_contacts').select('id').eq('user_id', currentUser.id).eq('contact_id', userId).maybeSingle().then(function(res) {
      if (res.data) {
        starRow.style.display = 'flex';
        var r = starGet(userId);
        starsEl.innerHTML = [1,2,3].map(function(n) {
          return '<div class="ps-star ' + (n <= r ? 'filled' : 'empty') + '" onclick="psSetStar(\'' + userId + '\',' + n + ')">\u2605</div>';
        }).join('');
      } else {
        starRow.style.display = 'none';
      }
    });
  }
  document.getElementById('ps-overlay').classList.add('open');
  setTimeout(() => document.getElementById('person-sheet-el').classList.add('open'), 10);
}

async function dmOpenPersonSheet(userId) {
  try {
    var { data: p } = await sb.from('profiles').select('name,title,avatar_url').eq('id', userId).single();
    bcOpenPerson(userId, p?.name || 'Ukendt', p?.title || '', 'linear-gradient(135deg,#3AAA88,#2A7A90)', 'screen-chat');
  } catch(e) { logError('dmOpenPersonSheet', e); }
}


function psClose() {
  var sheet = document.getElementById('person-sheet-el');
  if (sheet) { sheet.classList.remove('open'); sheet.style.transform = ''; }
  document.getElementById('ps-bubbleup-btn').style.display = 'flex';
  document.getElementById('ps-bubbleup-confirm').classList.remove('show');
  setTimeout(() => document.getElementById('ps-overlay').classList.remove('open'), 320);
}


