// ══════════════════════════════════════════════════════════
//  BUBBLE — LIVE BUBBLE + QR SCANNER
//  Auto-split from app.js · v3.7.0
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
//  LIVE BUBBLE
// ══════════════════════════════════════════════════════════
const LIVE_EXPIRE_HOURS = 6;
let currentLiveBubble = null; // { bubble_id, bubble_name, bubble_location, checked_in_at, member_count }

async function loadLiveBubbleStatus() {
  try {
    const card = document.getElementById('live-bubble-card');
    const activeEl = document.getElementById('live-bubble-active');
    const idleEl = document.getElementById('live-bubble-idle');
    if (!card) return;
    card.style.display = 'block';

    // Find active check-in for current user (ANY bubble type)
    const expireCutoff = new Date(Date.now() - LIVE_EXPIRE_HOURS * 60 * 60 * 1000).toISOString();

    const { data: myLive } = await sb.from('bubble_members')
      .select('bubble_id, checked_in_at, bubbles(id, name, location, type, type_label)')
      .eq('user_id', currentUser.id)
      .not('checked_in_at', 'is', null)
      .is('checked_out_at', null)
      .gte('checked_in_at', expireCutoff)
      .order('checked_in_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (myLive && myLive.bubbles) {
      currentLiveBubble = {
        bubble_id: myLive.bubble_id,
        bubble_name: myLive.bubbles.name,
        bubble_location: myLive.bubbles.location,
        bubble_type: myLive.bubbles.type,
        checked_in_at: myLive.checked_in_at
      };

      // Count active members at same location
      const { count } = await sb.from('bubble_members')
        .select('*', { count: 'exact', head: true })
        .eq('bubble_id', myLive.bubble_id)
        .not('checked_in_at', 'is', null)
        .is('checked_out_at', null)
        .gte('checked_in_at', expireCutoff);

      currentLiveBubble.member_count = count || 1;

      document.getElementById('live-bubble-name').textContent = currentLiveBubble.bubble_name;
      // Update label to be contextual
      var labelEl = document.querySelector('.live-bubble-label');
      if (labelEl) labelEl.textContent = '📡 DU ER LIVE';
      const since = new Date(currentLiveBubble.checked_in_at);
      const mins = Math.round((Date.now() - since.getTime()) / 60000);
      const timeStr = mins < 60 ? mins + ' min' : Math.round(mins / 60) + 't ' + (mins % 60) + 'min';
      document.getElementById('live-bubble-meta').textContent =
        (currentLiveBubble.bubble_location ? currentLiveBubble.bubble_location + ' · ' : '') +
        timeStr + ' · ' + (currentLiveBubble.member_count || 1) + ' personer her';
      document.getElementById('live-bubble-count').textContent = currentLiveBubble.member_count;

      activeEl.style.display = 'block';
      idleEl.style.display = 'none';
    } else {
      currentLiveBubble = null;
      activeEl.style.display = 'none';
      idleEl.style.display = 'block';
    }
  } catch (e) {
    logError('loadLiveBubbleStatus', e);
    const card = document.getElementById('live-bubble-card');
    if (card) card.style.display = 'block';
    var a = document.getElementById('live-bubble-active');
    var b = document.getElementById('live-bubble-idle');
    if (a) a.style.display = 'none';
    if (b) b.style.display = 'block';
  }
}

function openLiveCheckin() {
  _liveListExpanded = false;
  loadLiveCheckinList();
  openModal('modal-live-checkin');
  // Reset scanner state
  var scanner = document.getElementById('live-scanner-viewport');
  if (scanner) scanner.style.display = '';
  var confirmed = document.getElementById('live-scan-confirmed');
  if (confirmed) confirmed.style.display = 'none';
  var found = document.getElementById('live-scan-found');
  if (found) found.style.display = 'none';
  var status = document.getElementById('live-scan-status');
  if (status) { status.textContent = 'Starter kamera...'; status.className = 'live-scan-status'; status.style.display = ''; }
  var toggle = document.getElementById('live-list-toggle');
  if (toggle) toggle.textContent = 'Vis mere \u2191';
  // Show manual check-in for owners/admins
  showManualCheckinIfOwner();
  startLiveCamera();
}

async function showManualCheckinIfOwner() {
  var el = document.getElementById('live-manual-checkin');
  if (!el || !currentUser) return;
  try {
    var expCut = new Date(Date.now() - 6 * 3600000).toISOString();
    var { data: myLive } = await sb.from('bubble_members')
      .select('bubble_id, role, bubbles(created_by)')
      .eq('user_id', currentUser.id)
      .not('checked_in_at', 'is', null)
      .is('checked_out_at', null)
      .gte('checked_in_at', expCut)
      .limit(1)
      .maybeSingle();
    if (myLive) {
      var isOwner = myLive.bubbles?.created_by === currentUser.id;
      var isAdmin = myLive.role === 'admin';
      el.style.display = (isOwner || isAdmin) ? 'block' : 'none';
    } else {
      el.style.display = 'none';
    }
  } catch(e) { el.style.display = 'none'; }
}

var _liveListExpanded = false;
function liveToggleListView() {
  _liveListExpanded = !_liveListExpanded;
  var scanner = document.getElementById('live-scanner-viewport');
  var status = document.getElementById('live-scan-status');
  var found = document.getElementById('live-scan-found');
  var confirmed = document.getElementById('live-scan-confirmed');
  var toggle = document.getElementById('live-list-toggle');

  if (_liveListExpanded) {
    // Collapse scanner, expand list
    if (scanner) scanner.style.display = 'none';
    if (status) status.style.display = 'none';
    if (found) found.style.display = 'none';
    if (confirmed) confirmed.style.display = 'none';
    if (toggle) toggle.textContent = 'Vis scanner ↓';
    stopLiveCamera();
  } else {
    // Restore scanner
    if (scanner) scanner.style.display = '';
    if (status) status.style.display = '';
    if (toggle) toggle.textContent = 'Vis mere ↑';
    startLiveCamera();
  }
}

function closeLiveCheckinModal() {
  stopLiveCamera();
  closeModal('modal-live-checkin');
}

async function loadLiveCheckinList() {
  const list = document.getElementById('live-checkin-list');
  list.innerHTML = skelCards(3);
  try {
    // Get user's memberships to check access for hidden bubbles
    var { data: myMemberships } = await sb.from('bubble_members').select('bubble_id').eq('user_id', currentUser.id);
    var myBubbleIds = (myMemberships || []).map(function(m) { return m.bubble_id; });

    // Only show bubbles with a location OR type live/event — these are physical places
    var { data: placeBubbles } = await sb.from('bubbles')
      .select('id, name, location, type, visibility, created_at')
      .or('type.eq.live,type.eq.event,location.neq.')
      .order('created_at', { ascending: false })
      .limit(30);

    // Filter: remove hidden bubbles unless user is a member
    var filtered = (placeBubbles || []).filter(function(b) {
      if (!(b.type === 'live' || b.type === 'event' || (b.location && b.location.trim().length > 0))) return false;
      if (b.visibility === 'hidden' && myBubbleIds.indexOf(b.id) < 0) return false;
      return true;
    });

    if (filtered.length === 0) {
      list.innerHTML = '<div style="text-align:center;padding:1rem 0">' +
        '<div style="font-size:0.78rem;color:var(--muted);margin-bottom:0.3rem">Ingen steder i n\u00E6rheden</div>' +
        '<div style="font-size:0.68rem;color:var(--text-secondary);margin-bottom:0.6rem">Scan en QR-kode ovenfor, eller opdag bobler med lokationer</div>' +
        '<button onclick="closeModal(\'modal-live-checkin\');goTo(\'screen-discover\');loadDiscover()" style="font-size:0.75rem;padding:0.45rem 1rem;background:rgba(124,92,252,0.12);color:var(--accent);border:1px solid rgba(124,92,252,0.25);border-radius:10px;cursor:pointer;font-family:inherit;font-weight:600">Opdag bobler \u2192</button>' +
        '</div>';
      return;
    }

    // Get active check-in counts AND user IDs for avatar preview
    var bubbleIds = filtered.map(function(b) { return b.id; });
    var expireCutoff = new Date(Date.now() - LIVE_EXPIRE_HOURS * 60 * 60 * 1000).toISOString();
    var { data: activeMembers } = await sb.from('bubble_members')
      .select('bubble_id, user_id')
      .in('bubble_id', bubbleIds)
      .not('checked_in_at', 'is', null)
      .is('checked_out_at', null)
      .gte('checked_in_at', expireCutoff);

    var countMap = {};
    var memberMap = {}; // bubble_id -> [user_ids]
    (activeMembers || []).forEach(function(m) {
      countMap[m.bubble_id] = (countMap[m.bubble_id] || 0) + 1;
      if (!memberMap[m.bubble_id]) memberMap[m.bubble_id] = [];
      if (memberMap[m.bubble_id].length < 3) memberMap[m.bubble_id].push(m.user_id);
    });

    // Fetch profiles for avatar previews (max 3 per bubble, deduplicated)
    var allUserIds = [];
    Object.values(memberMap).forEach(function(ids) {
      ids.forEach(function(id) { if (allUserIds.indexOf(id) < 0) allUserIds.push(id); });
    });
    var profileMap = {};
    if (allUserIds.length > 0) {
      var { data: profiles } = await sb.from('profiles').select('id, name, avatar_url').in('id', allUserIds);
      (profiles || []).forEach(function(p) { profileMap[p.id] = p; });
    }

    // Sort: active check-ins first, then events, then by date
    filtered.sort(function(a, b) {
      var aActive = countMap[a.id] || 0;
      var bActive = countMap[b.id] || 0;
      if (bActive !== aActive) return bActive - aActive;
      var aIsEvent = (a.type === 'event' || a.type === 'live') ? 1 : 0;
      var bIsEvent = (b.type === 'event' || b.type === 'live') ? 1 : 0;
      if (bIsEvent !== aIsEvent) return bIsEvent - aIsEvent;
      return new Date(b.created_at) - new Date(a.created_at);
    });

    var colors = ['linear-gradient(135deg,#2ECFCF,#22B8CF)','linear-gradient(135deg,#6366F1,#7C5CFC)','linear-gradient(135deg,#E879A8,#EC4899)','linear-gradient(135deg,#F59E0B,#EAB308)','linear-gradient(135deg,#1A9E8E,#10B981)','linear-gradient(135deg,#8B5CF6,#A855F7)','linear-gradient(135deg,#3B82F6,#6366F1)','linear-gradient(135deg,#EF4444,#F97316)','linear-gradient(135deg,#06B6D4,#0EA5E9)','linear-gradient(135deg,#D946EF,#C026D3)'];
    list.innerHTML = filtered.map(function(b) {
      var cnt = countMap[b.id] || 0;
      var isEvent = b.type === 'event' || b.type === 'live';
      var typeLabel = isEvent ? 'Event' : 'Lokalt sted';

      // Build avatar preview HTML
      var avatarHtml = '';
      if (cnt > 0 && memberMap[b.id]) {
        var avatars = memberMap[b.id].map(function(uid, i) {
          var p = profileMap[uid];
          if (!p) return '';
          var ini = (p.name || '?').split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();
          if (p.avatar_url) {
            return '<div style="width:22px;height:22px;border-radius:50%;overflow:hidden;border:1.5px solid var(--bg);margin-left:' + (i > 0 ? '-6px' : '0') + ';position:relative;z-index:' + (3-i) + '"><img src="' + escHtml(p.avatar_url) + '" style="width:100%;height:100%;object-fit:cover"></div>';
          }
          return '<div style="width:22px;height:22px;border-radius:50%;background:' + colors[i % 10] + ';display:flex;align-items:center;justify-content:center;font-size:0.45rem;font-weight:700;color:white;border:1.5px solid var(--bg);margin-left:' + (i > 0 ? '-6px' : '0') + ';position:relative;z-index:' + (3-i) + '">' + ini + '</div>';
        }).join('');
        avatarHtml = '<div style="display:flex;align-items:center;margin-right:0.3rem">' + avatars + '</div>';
      }

      var isMember = myBubbleIds.indexOf(b.id) >= 0;
      var checkinBtn = '';
      if (isMember || b.visibility === 'public' || !b.visibility) {
        checkinBtn = '<button onclick="liveCheckin(\'' + b.id + '\')" style="font-size:0.65rem;padding:0.3rem 0.6rem;background:rgba(46,207,207,0.1);color:var(--accent3);border:1px solid rgba(46,207,207,0.2);border-radius:8px;cursor:pointer;font-family:inherit;font-weight:600;flex-shrink:0">Check ind</button>';
      } else if (b.visibility === 'private') {
        checkinBtn = '<button onclick="requestJoin(\'' + b.id + '\')" style="font-size:0.65rem;padding:0.3rem 0.6rem;background:rgba(124,92,252,0.1);color:var(--accent);border:1px solid rgba(124,92,252,0.2);border-radius:8px;cursor:pointer;font-family:inherit;font-weight:600;flex-shrink:0">' + ico('lock') + ' Anmod</button>';
      }

      return '<div class="live-checkin-item">' +
        '<div class="live-checkin-icon" style="' + (isEvent ? 'background:rgba(124,92,252,0.1);color:var(--accent)' : '') + '">' + ico(isEvent ? 'calendar' : 'pin') + '</div>' +
        '<div style="flex:1;min-width:0;cursor:pointer" onclick="closeLiveCheckinModal();openBubble(\'' + b.id + '\')">' +
        '<div class="fw-600 fs-085">' + escHtml(b.name) + '</div>' +
        '<div class="fs-072 text-muted">' + typeLabel + (b.location ? ' \u00B7 ' + escHtml(b.location) : '') + '</div>' +
        '</div>' +
        avatarHtml +
        (cnt > 0 ? '<div class="live-checkin-count" style="margin-right:0.4rem"><div class="live-dot" style="width:6px;height:6px;margin:0"></div> ' + cnt + '</div>' : '') +
        checkinBtn +
        '</div>';
    }).join('');
  } catch (e) {
    logError('loadLiveCheckinList', e);
    list.innerHTML = '<div class="sub-muted" style="padding:0.5rem 0">Kunne ikke hente steder</div>';
  }
}

async function liveCheckin(bubbleId) {
  try {
    showToast('Checker ind...');

    // 0. Check visibility — hidden/private bubbles require membership
    var { data: bCheck } = await sb.from('bubbles').select('visibility').eq('id', bubbleId).single();
    if (bCheck && (bCheck.visibility === 'hidden' || bCheck.visibility === 'private')) {
      var { data: memCheck } = await sb.from('bubble_members')
        .select('id').eq('bubble_id', bubbleId).eq('user_id', currentUser.id).maybeSingle();
      if (!memCheck) {
        if (bCheck.visibility === 'hidden') {
          showToast('Denne boble kræver en invitation');
        } else {
          showToast('Denne boble kræver godkendelse');
          requestJoin(bubbleId);
        }
        return;
      }
    }

    // 1. Auto-checkout from any current live bubble
    await liveAutoCheckout();

    // 2. Check if already a member
    const { data: existing } = await sb.from('bubble_members')
      .select('id, checked_in_at, checked_out_at')
      .eq('bubble_id', bubbleId)
      .eq('user_id', currentUser.id)
      .maybeSingle();

    if (existing) {
      await sb.from('bubble_members').update({
        checked_in_at: new Date().toISOString(),
        checked_out_at: null
      }).eq('id', existing.id);
    } else {
      await sb.from('bubble_members').insert({
        bubble_id: bubbleId,
        user_id: currentUser.id,
        checked_in_at: new Date().toISOString()
      });
    }

    // 3. Get bubble name for display
    var bubbleName = '';
    try {
      var { data: bData } = await sb.from('bubbles').select('name, location').eq('id', bubbleId).single();
      if (bData) bubbleName = bData.name;
    } catch(e2) {}

    // 4. Instant UI: show confirmed state in checkin sheet
    var scanConfirmed = document.getElementById('live-scan-confirmed');
    if (scanConfirmed) {
      scanConfirmed.style.display = 'flex';
      var nameEl = document.getElementById('live-scan-confirmed-name');
      if (nameEl) nameEl.textContent = 'Checked ind' + (bubbleName ? ' — ' + bubbleName : '') + '!';
      var metaEl = document.getElementById('live-scan-confirmed-meta');
      if (metaEl) metaEl.innerHTML = '<div style="display:flex;gap:0.3rem;margin-top:0.4rem">' +
        '<button onclick="closeLiveCheckinModal();openBubble(\'' + bubbleId + '\')" style="flex:1;font-size:0.72rem;padding:0.35rem 0.8rem;background:rgba(46,207,207,0.12);color:var(--accent3);border:1px solid rgba(46,207,207,0.25);border-radius:8px;cursor:pointer;font-family:inherit;font-weight:600">Se hvem der er her \u2192</button>' +
        '<button onclick="liveCheckout();closeLiveCheckinModal()" style="font-size:0.72rem;padding:0.35rem 0.6rem;background:none;color:var(--muted);border:1px solid var(--glass-border);border-radius:8px;cursor:pointer;font-family:inherit;font-weight:600">Check ud</button>' +
        '</div>';
    }

    showToast('\uD83D\uDCCD ' + (bubbleName || 'Checked ind!'));
    trackEvent('live_checkin', { bubble_id: bubbleId, bubble_name: bubbleName });

    // 4. Refresh home card in background (non-blocking)
    loadLiveBubbleStatus();
  } catch (e) {
    logError('liveCheckin', e);
    showToast('Fejl ved check-in: ' + (e.message || 'ukendt'));
  }
}

// liveCreateAndCheckin removed — UI element no longer exists

async function liveAutoCheckout() {
  try {
    // Checkout from ALL active check-ins (any bubble type)
    const { data: activeCheckins } = await sb.from('bubble_members')
      .select('id')
      .eq('user_id', currentUser.id)
      .not('checked_in_at', 'is', null)
      .is('checked_out_at', null);

    if (!activeCheckins || activeCheckins.length === 0) return;

    const ids = activeCheckins.map(m => m.id);
    await sb.from('bubble_members').update({
      checked_out_at: new Date().toISOString()
    }).in('id', ids);

    // Note: this only sets checked_out_at — user remains a member
  } catch (e) {
    logError('liveAutoCheckout', e);
  }
}

async function liveCheckout() {
  try {
    if (!currentLiveBubble) return;
    await sb.from('bubble_members').update({
      checked_out_at: new Date().toISOString()
    }).eq('bubble_id', currentLiveBubble.bubble_id).eq('user_id', currentUser.id);

    currentLiveBubble = null;
    showToast('Checked ud 👋');
    await loadLiveBubbleStatus();
  } catch (e) {
    logError('liveCheckout', e);
    showToast('Fejl ved checkout');
  }
}

function openLiveBubble() {
  if (!currentLiveBubble) return;
  closeRadarSheet();
  openBubbleChat(currentLiveBubble.bubble_id, 'screen-home');
}

// ══════════════════════════════════════════════════════════


// ══════════════════════════════════════════════════════════
//  LIVE QR SCANNER (integrated in live bubble card)
// ══════════════════════════════════════════════════════════
var _liveQrStream = null;
var _liveQrFrame = null;
var _liveQrFound = null;





async function startLiveCamera() {
  try {
  var video = document.getElementById('live-qr-video');
  if (!video) return;
  var status = document.getElementById('live-scan-status');
  try {
    // Ensure jsQR is loaded
    if (typeof jsQR === 'undefined') {
      if (status) status.textContent = 'Indlæser scanner...';
      await new Promise(function(resolve, reject) {
        var s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
        s.onload = resolve;
        s.onerror = function() { reject(new Error('Kunne ikke indlæse QR-scanner')); };
        document.head.appendChild(s);
      });
    }

    // Reuse existing stream if still active
    if (_liveQrStream && _liveQrStream.active) {
      video.srcObject = _liveQrStream;
      await video.play();
      if (status) { status.textContent = 'Peg kameraet mod en Bubble QR-kode'; status.className = 'live-scan-status'; }
      liveQrPreviewLoop();
      return;
    }

    if (status) status.textContent = 'Starter kamera...';
    await initBarcodeDetector();
    _liveQrStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 960 } }
    });
    video.srcObject = _liveQrStream;
    video.setAttribute('playsinline', '');
    video.setAttribute('autoplay', '');
    await video.play();
    if (status) { status.textContent = 'Peg kameraet mod en Bubble QR-kode'; status.className = 'live-scan-status'; }
    liveQrPreviewLoop();
  } catch(e) {
    logError('Camera error', e);
    if (status) { status.textContent = e.message || 'Kunne ikke starte kamera'; status.className = 'live-scan-status error'; }
  }
  } catch(e) { logError("startLiveCamera", e); }
}

function pauseLiveCamera() {
  // Pause scanning but keep stream alive (avoids re-permission)
  if (_liveQrFrame) { cancelAnimationFrame(_liveQrFrame); _liveQrFrame = null; }
  var video = document.getElementById('live-qr-video');
  if (video) video.pause();
}

function stopLiveCamera() {
  // Full stop — only call when truly done (navigation away, etc.)
  if (_liveQrFrame) { cancelAnimationFrame(_liveQrFrame); _liveQrFrame = null; }
  if (_liveQrStream) {
    _liveQrStream.getTracks().forEach(function(t) { t.stop(); });
    _liveQrStream = null;
  }
  var video = document.getElementById('live-qr-video');
  if (video) video.srcObject = null;
}

var _barcodeDetector = null;
var _useNativeDetector = false;

async function initBarcodeDetector() {
  if (typeof BarcodeDetector !== 'undefined') {
    try {
      var formats = await BarcodeDetector.getSupportedFormats();
      if (formats.includes('qr_code')) {
        _barcodeDetector = new BarcodeDetector({ formats: ['qr_code'] });
        _useNativeDetector = true;
        console.debug('[QR] Using native BarcodeDetector');
        return;
      }
    } catch(e) {}
  }
  _useNativeDetector = false;
  console.debug('[QR] Using jsQR fallback');
}

function liveQrPreviewLoop() {
  var video = document.getElementById('live-qr-video');
  if (!video || !_liveQrStream || _liveQrPending) return;
  if (video.readyState < video.HAVE_ENOUGH_DATA) {
    _liveQrFrame = requestAnimationFrame(liveQrPreviewLoop);
    return;
  }

  if (_useNativeDetector && _barcodeDetector) {
    // Native BarcodeDetector — much better recognition
    _barcodeDetector.detect(video).then(function(codes) {
      if (codes && codes.length > 0 && codes[0].rawValue && !_liveQrPending) {
        _liveQrFound = codes[0].rawValue;
        liveScanAutoResolve(codes[0].rawValue);
        return;
      }
      // Throttle to ~10fps for performance
      setTimeout(function() { _liveQrFrame = requestAnimationFrame(liveQrPreviewLoop); }, 100);
    }).catch(function() {
      setTimeout(function() { _liveQrFrame = requestAnimationFrame(liveQrPreviewLoop); }, 200);
    });
  } else {
    // jsQR fallback
    var canvas = document.getElementById('live-qr-canvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    if (typeof jsQR !== 'undefined') {
      var imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      var code = jsQR(imgData.data, imgData.width, imgData.height, { inversionAttempts: 'attemptBoth' });
      if (!code && canvas.width > 200) {
        var cx = Math.floor(canvas.width * 0.15);
        var cy = Math.floor(canvas.height * 0.15);
        var cw = Math.floor(canvas.width * 0.7);
        var ch = Math.floor(canvas.height * 0.7);
        var cropData = ctx.getImageData(cx, cy, cw, ch);
        code = jsQR(cropData.data, cw, ch, { inversionAttempts: 'attemptBoth' });
      }
      if (code && code.data && !_liveQrPending) {
        _liveQrFound = code.data;
        liveScanAutoResolve(code.data);
        return;
      }
    }
    // Throttle jsQR to ~8fps
    setTimeout(function() { _liveQrFrame = requestAnimationFrame(liveQrPreviewLoop); }, 120);
  }
}

var _liveQrPending = false;
var _liveQrResolvedBubble = null;

async function liveScanAutoResolve(data) {
  try {
  _liveQrPending = true;
  var status = document.getElementById('live-scan-status');
  if (status) { status.textContent = 'QR fundet — henter info...'; status.className = 'live-scan-status found'; }
  
  // ── Check if it's a guest QR ──
  if (data.includes('guest=')) {
    try {
      var url = new URL(data);
      var guestId = url.searchParams.get('guest');
      var bubbleId = url.searchParams.get('bubble');
      if (guestId) {
        // Look up guest record
        var { data: guest } = await sb.from('guest_checkins').select('*').eq('id', guestId).maybeSingle();
        if (guest) {
          // Mark as checked in
          if (!guest.checked_in_at) {
            await sb.from('guest_checkins').update({ checked_in_at: new Date().toISOString() }).eq('id', guestId);
          }
          // Show confirmation
          if (status) status.style.display = 'none';
          var confirmed = document.getElementById('live-scan-confirmed');
          var cName = document.getElementById('live-scan-confirmed-name');
          var cMeta = document.getElementById('live-scan-confirmed-meta');
          if (cName) cName.textContent = '✓ ' + (guest.name || 'Gæst') + ' checked ind!';
          if (cMeta) cMeta.textContent = (guest.title || 'Gæst') + ' · via Guest QR';
          if (confirmed) confirmed.style.display = 'flex';
          showSuccessToast((guest.name || 'Gæst') + ' checked ind! ✓');
          _liveQrPending = false;
          // Resume scanning after 3s
          setTimeout(function() {
            if (confirmed) confirmed.style.display = 'none';
            if (status) { status.textContent = 'Peg kameraet mod en Bubble QR-kode'; status.className = 'live-scan-status'; status.style.display = ''; }
            liveQrPreviewLoop();
          }, 3000);
          return;
        }
      }
    } catch(e) {}
  }
  
  // ── Check if it's a personal QR token ──
  if (data.includes('qrt=') || data.includes('profile=')) {
    try {
      var url2 = new URL(data);
      var qrt = url2.searchParams.get('qrt');
      var profileParam = url2.searchParams.get('profile');
      var userId = null;
      
      if (qrt) {
        var { data: tokenData } = await sb.from('qr_tokens')
          .select('user_id, expires_at')
          .eq('token', qrt)
          .maybeSingle();
        if (tokenData && new Date(tokenData.expires_at) > new Date()) {
          userId = tokenData.user_id;
        } else if (tokenData) {
          if (status) { status.textContent = 'QR-kode udløbet — bed personen åbne en ny'; status.className = 'live-scan-status error'; }
          _liveQrPending = false;
          setTimeout(function() { if (status) { status.textContent = 'Peg kameraet mod en Bubble QR-kode'; status.className = 'live-scan-status'; status.style.display = ''; } liveQrPreviewLoop(); }, 3000);
          return;
        }
      } else if (profileParam) {
        userId = profileParam;
      }
      
      if (userId) {
        // Look up profile
        var { data: scannedProfile } = await sb.from('profiles')
          .select('id, name, title, workplace')
          .eq('id', userId)
          .maybeSingle();
        
        if (scannedProfile) {
          if (status) status.style.display = 'none';
          var confirmed = document.getElementById('live-scan-confirmed');
          var cName = document.getElementById('live-scan-confirmed-name');
          var cMeta = document.getElementById('live-scan-confirmed-meta');
          if (cName) cName.textContent = '✓ ' + (scannedProfile.name || 'Bruger') + ' fundet!';
          if (cMeta) cMeta.textContent = (scannedProfile.title || '') + (scannedProfile.workplace ? ' · ' + scannedProfile.workplace : '');
          if (confirmed) confirmed.style.display = 'flex';
          showSuccessToast((scannedProfile.name || 'Bruger') + ' scannet! ✓');
          _liveQrPending = false;
          setTimeout(function() {
            if (confirmed) confirmed.style.display = 'none';
            if (status) { status.textContent = 'Peg kameraet mod en Bubble QR-kode'; status.className = 'live-scan-status'; status.style.display = ''; }
            liveQrPreviewLoop();
          }, 3000);
          return;
        }
      }
    } catch(e) {}
  }
  
  // ── Standard bubble QR ──
  var joinCode = data;
  if (data.includes('join=')) {
    try { joinCode = new URL(data).searchParams.get('join') || data; } catch(e) {}
  } else if (data.includes('/b/')) {
    joinCode = data.split('/b/').pop().split('?')[0];
  }
  
  try {
    // Try multiple lookup strategies
    var bubble = null;
    // 1. Try by join_code or id
    var r1 = await sb.from('bubbles').select('id, name, type, location')
      .or('join_code.eq.' + joinCode + ',id.eq.' + joinCode).limit(1).maybeSingle();
    if (r1.data) bubble = r1.data;
    
    // 2. If full URL, try extracting UUID pattern
    if (!bubble && data.length > 30) {
      var uuidMatch = data.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
      if (uuidMatch) {
        var r2 = await sb.from('bubbles').select('id, name, type, location').eq('id', uuidMatch[0]).maybeSingle();
        if (r2.data) bubble = r2.data;
      }
    }
    
    if (!bubble) throw new Error('Boble ikke fundet');
    _liveQrResolvedBubble = bubble;
    
    // Show confirmation card
    if (status) status.style.display = 'none';
    var found = document.getElementById('live-scan-found');
    var fName = document.getElementById('live-scan-found-name');
    var fMeta = document.getElementById('live-scan-found-meta');
    if (fName) fName.textContent = bubble.name;
    if (fMeta) fMeta.textContent = (bubble.location ? bubble.location : '') + (bubble.type ? ' · ' + bubble.type : '');
    if (found) found.style.display = 'block';
  } catch(e) {
    logError('liveScanAutoResolve', e);
    if (status) { status.textContent = e.message || 'QR ikke genkendt'; status.className = 'live-scan-status error'; }
    _liveQrPending = false;
    _liveQrFound = null;
    // Resume scanning after delay
    setTimeout(function() {
      if (status) { status.textContent = 'Peg kameraet mod en Bubble QR-kode'; status.className = 'live-scan-status'; status.style.display = ''; }
      liveQrPreviewLoop();
    }, 2000);
  }
  } catch(e) { logError("liveScanAutoResolve", e); }
}

async function liveScanConfirmJoin() {
  if (!_liveQrResolvedBubble) return;
  var bubble = _liveQrResolvedBubble;
  try {
    // Auto-checkout from any current check-in first
    await liveAutoCheckout();

    // Check if already a member
    var { data: existing } = await sb.from('bubble_members')
      .select('id, checked_in_at, checked_out_at')
      .eq('bubble_id', bubble.id).eq('user_id', currentUser.id).maybeSingle();

    if (existing) {
      // Already member — just re-check-in
      await sb.from('bubble_members').update({
        checked_in_at: new Date().toISOString(),
        checked_out_at: null
      }).eq('id', existing.id);
    } else {
      // New member + check-in
      await sb.from('bubble_members').insert({
        bubble_id: bubble.id,
        user_id: currentUser.id,
        role: 'member',
        checked_in_at: new Date().toISOString()
      });
    }

    stopLiveCamera();
    // Show confirmation
    document.getElementById('live-scan-found').style.display = 'none';
    var confirmed = document.getElementById('live-scan-confirmed');
    var cName = document.getElementById('live-scan-confirmed-name');
    var cMeta = document.getElementById('live-scan-confirmed-meta');
    if (cName) cName.textContent = bubble.name;
    if (cMeta) cMeta.textContent = (existing ? 'Checked ind igen' : 'Joined + checked ind') + ' ✓';
    if (confirmed) confirmed.style.display = 'flex';

    showToast('Checked ind i ' + bubble.name + ' ✓');
    loadMyBubbles();
    loadLiveBubbleStatus();
    setTimeout(function() { closeLiveCheckinModal(); }, 2500);
  } catch(e) {
    logError('liveScanConfirmJoin', e);
    showToast(e.message || 'Fejl ved check-in');
  }
  _liveQrPending = false;
  _liveQrResolvedBubble = null;
}

function liveScanReset() {
  _liveQrPending = false;
  _liveQrFound = null;
  _liveQrResolvedBubble = null;
  document.getElementById('live-scan-found').style.display = 'none';
  var status = document.getElementById('live-scan-status');
  if (status) { status.textContent = 'Peg kameraet mod en Bubble QR-kode'; status.className = 'live-scan-status'; status.style.display = ''; }
  liveQrPreviewLoop();
}







// ── Release camera when app goes to background, restore on return ──
document.addEventListener('visibilitychange', function() {
  if (document.hidden) {
    // App backgrounded — truly release camera to save battery
    if (_liveQrStream) stopLiveCamera();
  }
});
