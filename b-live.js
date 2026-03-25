// ══════════════════════════════════════════════════════════
//  BUBBLE — LIVE BUBBLE + QR SCANNER + CHECK-IN
//  DOMAIN: live
//  SUB-DOMAINS:
//    Check-in/out — loadLiveBubbleStatus, liveCheckin, liveCheckout, checkin list
//    QR Scanner — startLiveCamera, stopLiveCamera, liveScanConfirmPersonCheckin, liveScanAutoResolve
//  OWNS: currentLiveBubble (writes), _liveCheckedInIds, _liveQrStream, _scannerBubbleId
//  READS: currentUser, bcBubbleId, bcBubbleData
//  Auto-split from app.js · v3.7.0
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
//  LIVE BUBBLE
// ══════════════════════════════════════════════════════════
const LIVE_EXPIRE_HOURS = 6;
let currentLiveBubble = null; // { bubble_id, bubble_name, bubble_location, checked_in_at, member_count }

async function loadLiveBubbleStatus() {
  try {
    if (!currentUser) return;
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
      // Count active members at same location
      const { count } = await sb.from('bubble_members')
        .select('*', { count: 'exact', head: true })
        .eq('bubble_id', myLive.bubble_id)
        .not('checked_in_at', 'is', null)
        .is('checked_out_at', null)
        .gte('checked_in_at', expireCutoff);

      currentLiveBubble = {
        bubble_id: myLive.bubble_id,
        bubble_name: myLive.bubbles.name,
        bubble_location: myLive.bubbles.location,
        bubble_type: myLive.bubbles.type,
        checked_in_at: myLive.checked_in_at,
        member_count: count || 1
      };
      // Sync appMode (single source of truth for live context)
      var _checkinTime = new Date(myLive.checked_in_at).getTime();
      var _expiryTime = new Date(_checkinTime + LIVE_EXPIRE_HOURS * 3600000);
      var _expiryStr = _expiryTime.getHours().toString().padStart(2,'0') + ':' + _expiryTime.getMinutes().toString().padStart(2,'0');
      appMode.set('live', {
        bubbleId: myLive.bubble_id,
        bubbleName: myLive.bubbles.name,
        bubbleType: myLive.bubbles.type,
        memberCount: count || 1,
        expiryStr: _expiryStr
      });
      // Fetch live member IDs for radar filtering
      try {
        var { data: liveMembers } = await sb.from('bubble_members')
          .select('user_id')
          .eq('bubble_id', myLive.bubble_id)
          .not('checked_in_at', 'is', null)
          .is('checked_out_at', null)
          .gte('checked_in_at', expireCutoff);
        window._liveCheckedInIds = (liveMembers || []).map(function(m) { return m.user_id; });
      } catch(e2) { window._liveCheckedInIds = []; }
    } else {
      currentLiveBubble = null;
      appMode.set('normal');
      window._liveCheckedInIds = [];
    }
    // Show/hide Live radar chip
    var liveChip = document.getElementById('radar-live-chip');
    var liveCount = document.getElementById('radar-live-count');
    if (liveChip) {
      if (currentLiveBubble && (window._liveCheckedInIds || []).length > 1) {
        liveChip.style.display = '';
        if (liveCount) liveCount.textContent = '· ' + window._liveCheckedInIds.length;
      } else {
        liveChip.style.display = 'none';
        // If live filter was active, reset to all
        if (typeof _homeRadarFilter !== 'undefined' && _homeRadarFilter === 'live') {
          filterRadarHome('all');
        }
      }
    }
  } catch (e) {
    logError('loadLiveBubbleStatus', e);
  }
}

function openLiveCheckin() {
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
  startLiveCamera();
}

function closeLiveCheckinModal() {
  stopLiveCamera();
  _scannerBubbleId = null;
  _pendingScanCheckin = null;
  closeModal('modal-live-checkin');
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

    // 4. Refresh home in background — auto-switch to live mode
    loadLiveBubbleStatus().then(function() {
      if (typeof filterRadarHome === 'function' && (window._liveCheckedInIds || []).length > 0) {
        filterRadarHome('live');
      }
    });
    if (typeof loadLiveBanner === 'function') loadLiveBanner();
  } catch (e) {
    logError('liveCheckin', e);
    errorToast('save', e);
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
    var checkoutBubbleId = currentLiveBubble.bubble_id;
    await sb.from('bubble_members').update({
      checked_out_at: new Date().toISOString()
    }).eq('bubble_id', checkoutBubbleId).eq('user_id', currentUser.id);

    currentLiveBubble = null;
    appMode.clearLive();
    showSuccessToast('Du er checket ud');
    await loadLiveBubbleStatus();

    // Reset home to 'all' mode + re-render dartboard
    if (typeof _homeViewMode !== 'undefined' && _homeViewMode === 'live') {
      homeSetMode('all');
    }
    if (typeof _homeRadarFilter !== 'undefined' && _homeRadarFilter === 'live') {
      filterRadarHome('all');
    }
    if (document.getElementById('screen-home')?.classList.contains('active')) {
      loadLiveBanner();
    }

    // Refresh bubble chat if viewing this event
    if (typeof bcBubbleId !== 'undefined' && bcBubbleId === checkoutBubbleId) {
      bcLoadBubbleInfo();
      bcLoadMembers();
      if (typeof _bcActiveTab !== 'undefined' && _bcActiveTab === 'info') bcLoadInfo();
    }
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
//  QR SCANNER SUB-DOMAIN
//  OWNS: _liveQrStream, _liveQrFrame, _liveQrFound, _barcodeDetector
//  OWNS: startLiveCamera, stopLiveCamera, pauseLiveCamera, liveQrPreviewLoop
//  OWNS: liveScanConfirmPersonCheckin, liveScanAutoResolve, liveScanConfirmJoin, liveScanReset
//  READS: currentUser, bcBubbleId, bcBubbleData
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
var _scannerBubbleId = null; // Set when scanning from bubble info tab
var _pendingScanCheckin = null; // { profile, bubbleId } — awaiting confirmation

async function liveScanConfirmPersonCheckin() {
  if (!_pendingScanCheckin) return;
  var p = _pendingScanCheckin;
  _pendingScanCheckin = null;
  var found = document.getElementById('live-scan-found');
  if (found) found.style.display = 'none';
  var status = document.getElementById('live-scan-status');
  if (status) { status.textContent = 'Checker ind...'; status.className = 'live-scan-status found'; status.style.display = ''; }
  try {
    var { data: existingMember } = await sb.from('bubble_members')
      .select('id').eq('bubble_id', p.bubbleId).eq('user_id', p.profile.id).maybeSingle();
    if (!existingMember) {
      await sb.from('bubble_members').insert({
        bubble_id: p.bubbleId,
        user_id: p.profile.id,
        checked_in_at: new Date().toISOString()
      });
    } else {
      await sb.from('bubble_members').update({
        checked_in_at: new Date().toISOString(),
        checked_out_at: null
      }).eq('bubble_id', p.bubbleId).eq('user_id', p.profile.id);
    }
    // Log scan
    try { sb.from('qr_scans').insert({ bubble_id: p.bubbleId, scanned_by: currentUser.id, scanned_user: p.profile.id, scan_type: 'event_checkin' }); } catch(e2) {}
    // Get event name for notifications
    var eventName = 'et event';
    try {
      var { data: bName } = await sb.from('bubbles').select('name').eq('id', p.bubbleId).single();
      if (bName?.name) eventName = bName.name;
    } catch(e2b) {}
    // Broadcast check-in notification directly to scanned user (bypasses RLS)
    try {
      var notifyChannel = sb.channel('checkin-notify-' + p.profile.id);
      await notifyChannel.subscribe();
      await notifyChannel.send({
        type: 'broadcast',
        event: 'checkin',
        payload: { bubbleName: eventName, bubbleId: p.bubbleId }
      });
      setTimeout(function() { notifyChannel.unsubscribe(); }, 2000);
    } catch(e4) { console.debug('[scan] broadcast notify error:', e4); }
    // Send push notification to scanned user (backup for when app is closed)
    try {
      var { data: pushSub } = await sb.from('push_subscriptions').select('endpoint,p256dh,auth').eq('user_id', p.profile.id).maybeSingle();
      if (pushSub && pushSub.endpoint) {
        fetch(SUPABASE_URL + '/functions/v1/send-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (await sb.auth.getSession()).data.session?.access_token },
          body: JSON.stringify({
            subscription: { endpoint: pushSub.endpoint, keys: { p256dh: pushSub.p256dh, auth: pushSub.auth } },
            title: 'Velkommen! ✓',
            body: 'Du er checket ind i ' + eventName,
            data: { type: 'checkin', bubble_id: p.bubbleId }
          })
        }).catch(function() {});
      }
    } catch(e3) { console.debug('[scan] push notify error:', e3); }
    // Show success
    var confirmed = document.getElementById('live-scan-confirmed');
    var cName = document.getElementById('live-scan-confirmed-name');
    var cMeta = document.getElementById('live-scan-confirmed-meta');
    if (status) status.style.display = 'none';
    if (cName) cName.textContent = '✓ ' + (p.profile.name || 'Bruger') + ' checked ind!';
    if (cMeta) cMeta.textContent = (p.profile.title || '') + (p.profile.workplace ? ' · ' + p.profile.workplace : '');
    if (confirmed) confirmed.style.display = 'flex';
    showSuccessToast((p.profile.name || 'Bruger') + ' checked ind! ✓');
    // Refresh member list if viewing this bubble
    if (bcBubbleId === p.bubbleId && typeof bcLoadMembers === 'function') bcLoadMembers();
    setTimeout(function() {
      if (confirmed) confirmed.style.display = 'none';
      if (status) { status.textContent = 'Peg kameraet mod en Bubble QR-kode'; status.className = 'live-scan-status'; status.style.display = ''; }
      liveQrPreviewLoop();
    }, 3000);
  } catch(e) {
    errorToast('save', e);
    if (status) { status.textContent = 'Fejl ved check-in'; status.className = 'live-scan-status error'; status.style.display = ''; }
    setTimeout(function() { if (status) { status.textContent = 'Peg kameraet mod en Bubble QR-kode'; status.className = 'live-scan-status'; status.style.display = ''; } liveQrPreviewLoop(); }, 3000);
  }
}

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
        var { data: tokenData, error: tokenErr } = await sb.from('qr_tokens')
          .select('user_id, expires_at')
          .eq('token', qrt)
          .maybeSingle();
        if (tokenErr) console.error('[scan] qr_tokens lookup error:', tokenErr);
        if (tokenData && new Date(tokenData.expires_at) > new Date()) {
          userId = tokenData.user_id;
        } else if (tokenData) {
          if (status) { status.textContent = 'QR-kode udløbet — bed personen åbne en ny'; status.className = 'live-scan-status error'; }
          _liveQrPending = false;
          setTimeout(function() { if (status) { status.textContent = 'Peg kameraet mod en Bubble QR-kode'; status.className = 'live-scan-status'; status.style.display = ''; } liveQrPreviewLoop(); }, 3000);
          return;
        } else {
          // Token not found in DB — try to extract user ID from URL as fallback
          console.warn('[scan] QR token not found in DB:', qrt);
        }
      }
      
      if (!userId && profileParam) {
        userId = profileParam;
      }
      
      if (userId) {
        // Look up profile
        var { data: scannedProfile, error: profErr } = await sb.from('profiles')
          .select('id, name, title, workplace')
          .eq('id', userId)
          .maybeSingle();
        if (profErr) console.error('[scan] profile lookup error:', profErr);
        
        if (scannedProfile) {
          if (status) status.style.display = 'none';

          // If scanning from a specific bubble → show confirmation first
          if (_scannerBubbleId) {
            // Store pending data for confirm button
            _pendingScanCheckin = { profile: scannedProfile, bubbleId: _scannerBubbleId };
            var found = document.getElementById('live-scan-found');
            var fName = document.getElementById('live-scan-found-name');
            var fMeta = document.getElementById('live-scan-found-meta');
            var fBtn = document.getElementById('live-scan-confirm-btn');
            if (fName) fName.textContent = scannedProfile.name || 'Bruger';
            if (fMeta) fMeta.textContent = (scannedProfile.title || '') + (scannedProfile.workplace ? ' · ' + scannedProfile.workplace : '');
            if (fBtn) { fBtn.textContent = 'Check ' + (scannedProfile.name || 'bruger').split(' ')[0] + ' ind'; fBtn.onclick = function() { liveScanConfirmPersonCheckin(); }; }
            if (found) found.style.display = 'block';
            _liveQrPending = false;
            return;
          } else {
            // No bubble context — just save as contact
            var confirmed = document.getElementById('live-scan-confirmed');
            var cName = document.getElementById('live-scan-confirmed-name');
            var cMeta = document.getElementById('live-scan-confirmed-meta');
            if (cName) cName.textContent = '✓ ' + (scannedProfile.name || 'Bruger') + ' fundet!';
            if (cMeta) cMeta.textContent = (scannedProfile.title || '') + (scannedProfile.workplace ? ' · ' + scannedProfile.workplace : '');
            showSuccessToast((scannedProfile.name || 'Bruger') + ' scannet! ✓');
            // Auto-save as contact
            try { await sb.from('saved_contacts').upsert({ user_id: currentUser.id, contact_id: scannedProfile.id }, { onConflict: 'user_id,contact_id' }); } catch(e2) {}
          }

          if (confirmed) confirmed.style.display = 'flex';
          _liveQrPending = false;
          setTimeout(function() {
            if (confirmed) confirmed.style.display = 'none';
            if (status) { status.textContent = 'Peg kameraet mod en Bubble QR-kode'; status.className = 'live-scan-status'; status.style.display = ''; }
            liveQrPreviewLoop();
          }, 3000);
          return;
        } else {
          // userId found but no profile in DB
          if (status) { status.textContent = 'Bruger ikke fundet i Bubble'; status.className = 'live-scan-status error'; }
          _liveQrPending = false;
          setTimeout(function() { if (status) { status.textContent = 'Peg kameraet mod en Bubble QR-kode'; status.className = 'live-scan-status'; status.style.display = ''; } liveQrPreviewLoop(); }, 3000);
          return;
        }
      } else {
        // Could not resolve userId from QR
        if (status) { status.textContent = 'QR-kode ikke genkendt — prøv igen'; status.className = 'live-scan-status error'; }
        _liveQrPending = false;
        setTimeout(function() { if (status) { status.textContent = 'Peg kameraet mod en Bubble QR-kode'; status.className = 'live-scan-status'; status.style.display = ''; } liveQrPreviewLoop(); }, 3000);
        return;
      }
    } catch(e) {
      console.error('[scan] personal QR error:', e);
      if (status) { status.textContent = 'Fejl ved scanning: ' + (e.message || 'ukendt'); status.className = 'live-scan-status error'; }
      _liveQrPending = false;
      setTimeout(function() { if (status) { status.textContent = 'Peg kameraet mod en Bubble QR-kode'; status.className = 'live-scan-status'; status.style.display = ''; } liveQrPreviewLoop(); }, 3000);
      return;
    }
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
    errorToast('save', e);
  }
  _liveQrPending = false;
  _liveQrResolvedBubble = null;
}

function liveScanReset() {
  _liveQrPending = false;
  _liveQrFound = null;
  _liveQrResolvedBubble = null;
  _pendingScanCheckin = null;
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
