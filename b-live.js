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
var _liveLock = false; // Prevents double check-in/checkout from rapid taps

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
        appMode.setCheckedInIds((liveMembers || []).map(function(m) { return m.user_id; }));
      } catch(e2) { appMode.setCheckedInIds([]); }
    } else {
      currentLiveBubble = null;
      appMode.set('normal');
      appMode.setCheckedInIds([]);
    }
    // Show/hide Live radar chip
    var liveChip = document.getElementById('radar-live-chip');
    var liveCount = document.getElementById('radar-live-count');
    if (liveChip) {
      if (currentLiveBubble && appMode.checkedInIds.length > 1) {
        liveChip.style.display = '';
        if (liveCount) liveCount.textContent = '· ' + appMode.checkedInIds.length;
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
  if (_liveLock) return;
  _liveLock = true;
  try {
    showToast(t('misc_loading'));

    // ── Try Edge Function first (single serverside transaction) ──
    try {
      var { data: { session } } = await sb.auth.getSession();
      if (session) {
        var resp = await fetch(SUPABASE_URL + '/functions/v1/checkin', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + session.access_token,
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY
          },
          body: JSON.stringify({ bubble_id: bubbleId, action: 'checkin' })
        });
        var result = await resp.json();

        if (result.success) {
          // Update live state from server response
          currentLiveBubble = {
            bubble_id: bubbleId,
            bubble_name: result.bubble_name,
            bubble_location: result.bubble_location,
            bubble_type: result.bubble_type,
            checked_in_at: result.checked_in_at,
            member_count: result.member_count
          };
          appMode.set('live', {
            bubbleId: bubbleId,
            bubbleName: result.bubble_name,
            bubbleType: result.bubble_type,
            memberCount: result.member_count
          });
          appMode.setCheckedInIds(result.checked_in_ids || []);

          _showCheckinSuccess(bubbleId, result.bubble_name);
          showToast('\uD83D\uDCCD ' + (result.bubble_name || t('toast_checkedin')));
          trackEvent('live_checkin', { bubble_id: bubbleId, bubble_name: result.bubble_name, via: 'edge' });

          loadLiveBubbleStatus().then(function() {
            if (typeof filterRadarHome === 'function' && appMode.checkedInIds.length > 0) filterRadarHome('live');
          });
          if (typeof loadLiveBanner === 'function') loadLiveBanner();
          return;
        }

        // Handle specific error codes
        if (result.error === 'invite_required') { _renderToast(t('toast_invite_required'), 'error'); return; }
        if (result.error === 'approval_required') { _renderToast(t('toast_approval_required'), 'error'); requestJoin(bubbleId); return; }
        if (resp.status === 404) { _renderToast(t('toast_bubble_not_found'), 'error'); return; }

        // Other errors — fall through to client-side fallback
        console.debug('[checkin] Edge Function error, using fallback:', result.error);
      }
    } catch (edgeErr) {
      console.debug('[checkin] Edge Function unavailable, using fallback:', edgeErr.message);
    }

    // ── Fallback: client-side check-in (for when Edge Function isn't deployed) ──
    await _liveCheckinFallback(bubbleId);

  } catch (e) {
    logError('liveCheckin', e);
    errorToast('save', e);
  } finally { _liveLock = false; }
}
async function _liveCheckinFallback(bubbleId) {
  try {
    // 0. Check visibility
    var { data: bCheck } = await sb.from('bubbles').select('visibility').eq('id', bubbleId).single();
    if (bCheck && (bCheck.visibility === 'hidden' || bCheck.visibility === 'private')) {
      var { data: memCheck } = await sb.from('bubble_members')
        .select('id').eq('bubble_id', bubbleId).eq('user_id', currentUser.id).maybeSingle();
      if (!memCheck) {
        if (bCheck.visibility === 'hidden') {
          _renderToast(t('toast_invite_required'), 'error');
        } else {
          _renderToast(t('toast_approval_required'), 'error');
          requestJoin(bubbleId);
        }
        return;
      }
    }

    // 1. Auto-checkout
    await liveAutoCheckout();

    // 2. Check membership + check-in
    const { data: existing } = await sb.from('bubble_members')
      .select('id, checked_in_at, checked_out_at')
      .eq('bubble_id', bubbleId).eq('user_id', currentUser.id).maybeSingle();

    if (existing) {
      var { error: upErr } = await sb.from('bubble_members').update({
        checked_in_at: new Date().toISOString(), checked_out_at: null
      }).eq('id', existing.id);
      if (upErr) { errorToast('save', upErr); return; }
    } else {
      var { error: insErr } = await sb.from('bubble_members').insert({
        bubble_id: bubbleId, user_id: currentUser.id, checked_in_at: new Date().toISOString()
      });
      if (insErr) { errorToast('save', insErr); return; }
    }

    // 3. Get bubble name
    var bubbleName = '';
    try {
      var { data: bData } = await sb.from('bubbles').select('name, location').eq('id', bubbleId).single();
      if (bData) bubbleName = bData.name;
    } catch(e2) {}

    _showCheckinSuccess(bubbleId, bubbleName);
    showToast('\uD83D\uDCCD ' + (bubbleName || t('toast_checkedin')));
    trackEvent('live_checkin', { bubble_id: bubbleId, bubble_name: bubbleName, via: 'fallback' });

    loadLiveBubbleStatus().then(function() {
      if (typeof filterRadarHome === 'function' && appMode.checkedInIds.length > 0) filterRadarHome('live');
    });
    if (typeof loadLiveBanner === 'function') loadLiveBanner();
  } catch(e) { logError('_liveCheckinFallback', e); errorToast('save', e); }
}

// Shared UI for check-in success
function _showCheckinSuccess(bubbleId, bubbleName) {
    var scanConfirmed = document.getElementById('live-scan-confirmed');
    if (scanConfirmed) {
      scanConfirmed.style.display = 'flex';
      var nameEl = document.getElementById('live-scan-confirmed-name');
      if (nameEl) nameEl.textContent = t('bc_checked_in') + (bubbleName ? ' — ' + bubbleName : '') + '!';
      var metaEl = document.getElementById('live-scan-confirmed-meta');
      if (metaEl) metaEl.innerHTML = '<div style="display:flex;gap:0.3rem;margin-top:0.4rem">' +
        '<button onclick="closeLiveCheckinModal();openBubble(\'' + bubbleId + '\')" style="flex:1;font-size:0.72rem;padding:0.35rem 0.8rem;background:rgba(46,207,207,0.12);color:var(--accent3);border:1px solid rgba(46,207,207,0.25);border-radius:8px;cursor:pointer;font-family:inherit;font-weight:600">' + t('home_discover_networks') + ' \u2192</button>' +
        '<button onclick="liveCheckout();closeLiveCheckinModal()" style="font-size:0.72rem;padding:0.35rem 0.6rem;background:none;color:var(--muted);border:1px solid var(--glass-border);border-radius:8px;cursor:pointer;font-family:inherit;font-weight:600">' + t('live_checkout') + '</button>' +
        '</div>';
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
    var { error: coErr } = await sb.from('bubble_members').update({
      checked_out_at: new Date().toISOString()
    }).in('id', ids);
    if (coErr) logError('liveAutoCheckout:update', coErr);

    // Note: this only sets checked_out_at — user remains a member
  } catch (e) {
    logError('liveAutoCheckout', e);
  }
}

async function liveCheckout() {
  if (_liveLock) return;
  _liveLock = true;
  try {
    if (!currentLiveBubble) return;
    var checkoutBubbleId = (appMode.live && appMode.live.bubbleId) || currentLiveBubble.bubble_id || currentLiveBubble.bubbleId;
    var { error: coErr } = await sb.from('bubble_members').update({
      checked_out_at: new Date().toISOString()
    }).eq('bubble_id', checkoutBubbleId).eq('user_id', currentUser.id);
    if (coErr) { errorToast('save', coErr); return; }

    currentLiveBubble = null;
    appMode.clearLive();
    showSuccessToast(t('toast_checkedout'));
    trackEvent('live_checkout', { bubble_id: checkoutBubbleId });
    await loadLiveBubbleStatus();

    // Reset home to 'all' mode + re-render dartboard
    if (typeof _homeViewMode !== 'undefined' && _homeViewMode === 'live') {
      homeSetMode('all');
    }
    if (typeof _homeRadarFilter !== 'undefined' && _homeRadarFilter === 'live') {
      filterRadarHome('all');
    }
    if (navState.screen === 'screen-home') {
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
    _renderToast(t('toast_generic_error'), 'error');
  } finally { _liveLock = false; }
}

function openLiveBubble() {
  if (!currentLiveBubble) return;
  var _lbId = (appMode.live && appMode.live.bubbleId) || currentLiveBubble.bubbleId || currentLiveBubble.bubble_id; if (_lbId) openBubbleChat(_lbId, 'screen-home');
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
        s.onerror = function() { reject(new Error(t('toast_generic_error'))); };
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
  if (status) { status.textContent = t('misc_loading'); status.className = 'live-scan-status found'; status.style.display = ''; }
  try {
    var { data: existingMember } = await sb.from('bubble_members')
      .select('id').eq('bubble_id', p.bubbleId).eq('user_id', p.profile.id).maybeSingle();
    if (!existingMember) {
      var { error: insErr } = await sb.from('bubble_members').insert({
        bubble_id: p.bubbleId,
        user_id: p.profile.id,
        checked_in_at: new Date().toISOString()
      });
      if (insErr) {
        logError('scanCheckin:insert', insErr);
        _renderToast(t('toast_checkin_failed'), 'error');
        if (status) { status.textContent = 'Check-in fejlede'; status.className = 'live-scan-status error'; status.style.display = ''; }
        setTimeout(function() { if (status) { status.textContent = 'Peg kameraet mod en Bubble QR-kode'; status.className = 'live-scan-status'; } liveQrPreviewLoop(); }, 3000);
        return;
      }
    } else {
      var { error: upErr } = await sb.from('bubble_members').update({
        checked_in_at: new Date().toISOString(),
        checked_out_at: null
      }).eq('bubble_id', p.bubbleId).eq('user_id', p.profile.id);
      if (upErr) {
        logError('scanCheckin:update', upErr);
        _renderToast(t('toast_checkin_failed'), 'error');
        if (status) { status.textContent = 'Check-in fejlede'; status.className = 'live-scan-status error'; status.style.display = ''; }
        setTimeout(function() { if (status) { status.textContent = 'Peg kameraet mod en Bubble QR-kode'; status.className = 'live-scan-status'; } liveQrPreviewLoop(); }, 3000);
        return;
      }
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
    showSuccessToast(t('toast_checked_in_name', {name: p.profile.name || 'User'}));
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
          showSuccessToast(t('toast_checked_in_name', {name: guest.name || 'Guest'}));
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
            showSuccessToast(t('toast_checked_in_name', {name: scannedProfile.name || 'User'}));
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
    // "Boble ikke fundet" = expected — user scanned non-Bubble or expired QR
    if (e.message === 'Boble ikke fundet') {
      console.debug('[liveScan] QR not resolved:', e.message);
    } else {
      logError('liveScanAutoResolve', e);
    }
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
      var { error: upErr } = await sb.from('bubble_members').update({
        checked_in_at: new Date().toISOString(),
        checked_out_at: null
      }).eq('id', existing.id);
      if (upErr) { errorToast('save', upErr); return; }
    } else {
      // New member + check-in
      var { error: insErr } = await sb.from('bubble_members').insert({
        bubble_id: bubble.id,
        user_id: currentUser.id,
        role: 'member',
        checked_in_at: new Date().toISOString()
      });
      if (insErr) { errorToast('save', insErr); return; }
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

    showToast(t('toast_checkedin'));
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
    if (_connectStream) closeConnectScanner();
  }
});

// ══════════════════════════════════════════════════════════
//  CONNECT SCANNER — scan a person's QR to save contact
//  Reuses jsQR / BarcodeDetector from live scanner
// ══════════════════════════════════════════════════════════
var _connectStream = null;
var _connectFrame = null;
var _connectPending = false;

function openConnectScanner() {
  if (!currentUser) { _renderToast('Log ind først', 'error'); return; }
  // Create fullscreen overlay
  var ov = document.getElementById('connect-scanner-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'connect-scanner-overlay';
    ov.style.cssText = 'position:fixed;inset:0;z-index:600;background:#000;display:flex;flex-direction:column';
    ov.innerHTML =
      '<div style="position:relative;flex:1;overflow:hidden">' +
        '<video id="connect-qr-video" playsinline autoplay style="width:100%;height:100%;object-fit:cover"></video>' +
        '<canvas id="connect-qr-canvas" style="display:none"></canvas>' +
        '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none">' +
          '<div style="width:220px;height:220px;border:2px solid rgba(255,255,255,0.4);border-radius:24px;box-shadow:0 0 0 9999px rgba(0,0,0,0.5)"></div>' +
        '</div>' +
        '<div style="position:absolute;top:calc(env(safe-area-inset-top,12px) + 12px);left:16px;right:16px;display:flex;align-items:center;justify-content:space-between">' +
          '<button onclick="closeConnectScanner()" style="width:36px;height:36px;border-radius:50%;border:none;background:rgba(255,255,255,0.15);color:white;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center">✕</button>' +
          '<div style="font-size:0.8rem;font-weight:700;color:white">Scan en profil-QR</div>' +
          '<div style="width:36px"></div>' +
        '</div>' +
        '<div id="connect-scan-status" style="position:absolute;bottom:calc(env(safe-area-inset-bottom,16px) + 80px);left:0;right:0;text-align:center;font-size:0.75rem;color:white;font-weight:600">Peg kameraet mod en Bubble QR-kode</div>' +
        '<div id="connect-scan-result" style="position:absolute;bottom:0;left:0;right:0;display:none"></div>' +
      '</div>';
    document.body.appendChild(ov);
  }
  ov.style.display = 'flex';
  _connectPending = false;
  startConnectCamera();
}

function closeConnectScanner() {
  if (_connectFrame) { cancelAnimationFrame(_connectFrame); _connectFrame = null; }
  if (_connectStream) {
    _connectStream.getTracks().forEach(function(t) { t.stop(); });
    _connectStream = null;
  }
  var ov = document.getElementById('connect-scanner-overlay');
  if (ov) ov.style.display = 'none';
  var video = document.getElementById('connect-qr-video');
  if (video) video.srcObject = null;
  _connectPending = false;
}

async function startConnectCamera() {
  var video = document.getElementById('connect-qr-video');
  var status = document.getElementById('connect-scan-status');
  if (!video) return;
  try {
    if (typeof jsQR === 'undefined') {
      if (status) status.textContent = 'Indlæser scanner...';
      await new Promise(function(resolve, reject) {
        var s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
        s.onload = resolve;
        s.onerror = function() { reject(new Error('Scanner fejlede')); };
        document.head.appendChild(s);
      });
    }
    await initBarcodeDetector();
    if (status) status.textContent = 'Starter kamera...';
    _connectStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 960 } }
    });
    video.srcObject = _connectStream;
    await video.play();
    if (status) status.textContent = 'Peg kameraet mod en Bubble QR-kode';
    _connectScanLoop();
  } catch(e) {
    logError('connectCamera', e);
    if (status) status.textContent = e.message || 'Kunne ikke starte kamera';
  }
}

function _connectScanLoop() {
  var video = document.getElementById('connect-qr-video');
  if (!video || !_connectStream || _connectPending) return;
  if (video.readyState < video.HAVE_ENOUGH_DATA) {
    _connectFrame = requestAnimationFrame(_connectScanLoop);
    return;
  }
  if (_useNativeDetector && _barcodeDetector) {
    _barcodeDetector.detect(video).then(function(codes) {
      if (codes && codes.length > 0 && codes[0].rawValue && !_connectPending) {
        _connectResolve(codes[0].rawValue);
        return;
      }
      setTimeout(function() { _connectFrame = requestAnimationFrame(_connectScanLoop); }, 100);
    }).catch(function() {
      setTimeout(function() { _connectFrame = requestAnimationFrame(_connectScanLoop); }, 200);
    });
  } else {
    var canvas = document.getElementById('connect-qr-canvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    if (typeof jsQR !== 'undefined') {
      var imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      var code = jsQR(imgData.data, imgData.width, imgData.height, { inversionAttempts: 'attemptBoth' });
      if (code && code.data && !_connectPending) {
        _connectResolve(code.data);
        return;
      }
    }
    setTimeout(function() { _connectFrame = requestAnimationFrame(_connectScanLoop); }, 120);
  }
}

async function _connectResolve(rawUrl) {
  _connectPending = true;
  if (_connectFrame) { cancelAnimationFrame(_connectFrame); _connectFrame = null; }
  try {
    // Parse URL to find profile ID or QR token
    var url;
    try { url = new URL(rawUrl); } catch(e) {
      _renderToast(t('toast_unknown_qr'), 'warn');
      _connectPending = false;
      _connectScanLoop();
      return;
    }
    var params = new URLSearchParams(url.search);
    var profileId = params.get('profile');
    var qrToken = params.get('qrt');
    var eventId = params.get('event');
    var joinId = params.get('join');

    // Resolve QR token → profile ID
    if (qrToken && !profileId) {
      var { data: tokenData } = await sb.from('qr_tokens').select('user_id, expires_at').eq('token', qrToken).maybeSingle();
      if (tokenData && new Date(tokenData.expires_at) > new Date()) {
        profileId = tokenData.user_id;
      } else {
        _renderToast('QR-kode er udløbet', 'warn');
        _connectPending = false;
        _connectScanLoop();
        return;
      }
    }

    // Handle profile/contact QR → show profile sheet for confirmation
    if (profileId) {
      if (profileId === currentUser.id) {
        _renderToast(t('toast_own_qr'), 'warn');
        _connectPending = false;
        _connectScanLoop();
        return;
      }
      // Fetch profile
      var { data: p } = await sb.from('profiles').select('*').eq('id', profileId).single();
      if (!p) {
        _renderToast(t('toast_not_found'), 'error');
        _connectPending = false;
        _connectScanLoop();
        return;
      }
      // Pause camera, show profile sheet
      if (_connectFrame) { cancelAnimationFrame(_connectFrame); _connectFrame = null; }
      var video = document.getElementById('connect-qr-video');
      if (video) video.pause();
      _connectShowProfileSheet(p, profileId);
      return;
    }

    // Handle event QR
    if (eventId) {
      closeConnectScanner();
      flowSet('pending_join', eventId);
      flowSet('event_flow', 'true');
      await checkPendingJoin();
      return;
    }

    // Handle join QR
    if (joinId) {
      closeConnectScanner();
      await sb.from('bubble_members').insert({ bubble_id: joinId, user_id: currentUser.id }).catch(function(){});
      showSuccessToast(t('toast_joined'));
      requestAnimationFrame(function() { requestAnimationFrame(function() { openBubbleChat(joinId, 'screen-home'); }); });
      return;
    }

    _renderToast(t('toast_not_bubble_qr'), 'warn');
    _connectPending = false;
    _connectScanLoop();
  } catch(e) {
    logError('connectResolve', e);
    _renderToast(t('toast_generic_error'), 'error');
    _connectPending = false;
    _connectScanLoop();
  }
}

// ── Profile sheet inside scanner overlay ──
var _connectProfileId = null;

function _connectShowProfileSheet(p, profileId) {
  _connectProfileId = profileId;
  var isAnon = p.is_anon;
  var name = isAnon ? t('ps_anonymous') : (p.name || t('misc_unknown'));
  var initials = isAnon ? '?' : name.split(' ').map(function(w){return w[0]}).join('').slice(0,2).toUpperCase();
  var subtitle = [p.title, p.workplace].filter(Boolean).join(' \u00B7 ');
  var bio = p.bio || '';

  // Shared interests
  var myKw = (currentProfile?.keywords || []).map(function(k){ return k.toLowerCase(); });
  var theirKw = (p.keywords || []).map(function(k){ return k.toLowerCase(); });
  var overlap = myKw.filter(function(k){ return theirKw.indexOf(k) >= 0; });
  var tagsHtml = '';
  if (overlap.length > 0) {
    tagsHtml = '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px">' +
      overlap.slice(0, 6).map(function(k) {
        return '<span style="font-size:0.58rem;padding:2px 7px;border-radius:6px;background:rgba(46,207,207,0.1);color:#085041;font-weight:600">\u2713 ' + escHtml(k) + '</span>';
      }).join('') +
      (overlap.length > 6 ? '<span style="font-size:0.55rem;color:rgba(255,255,255,0.5)">+' + (overlap.length - 6) + ' mere</span>' : '') +
      '</div>';
  }

  // Avatar
  var avatarHtml = p.avatar_url && !isAnon
    ? '<img src="' + escHtml(p.avatar_url) + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%">'
    : '<span style="font-size:1.2rem;font-weight:700;color:white">' + initials + '</span>';

  var resultEl = document.getElementById('connect-scan-result');
  if (!resultEl) return;

  resultEl.innerHTML =
    '<div style="background:rgba(30,27,46,0.95);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border-radius:24px 24px 0 0;padding:20px 20px calc(env(safe-area-inset-bottom,16px) + 20px);animation:connectSheetUp 0.35s ease">' +
      '<div style="width:36px;height:4px;border-radius:99px;background:rgba(255,255,255,0.15);margin:0 auto 16px"></div>' +
      // Profile card
      '<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">' +
        '<div style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#7C5CFC,#6366F1);display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden">' + avatarHtml + '</div>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-size:1rem;font-weight:800;color:white">' + escHtml(name) + '</div>' +
          (subtitle ? '<div style="font-size:0.75rem;color:rgba(255,255,255,0.6);margin-top:2px">' + escHtml(subtitle) + '</div>' : '') +
          (overlap.length > 0 ? '<div style="font-size:0.65rem;color:rgba(46,207,207,0.9);font-weight:600;margin-top:3px">' + overlap.length + ' f\u00e6lles interesser</div>' : '') +
        '</div>' +
      '</div>' +
      // Bio
      (bio ? '<div style="font-size:0.75rem;color:rgba(255,255,255,0.7);line-height:1.45;margin-bottom:10px">' + escHtml(bio.length > 120 ? bio.slice(0,120) + '...' : bio) + '</div>' : '') +
      // Shared tags
      tagsHtml +
      // Actions
      '<div style="display:flex;gap:8px;margin-top:16px">' +
        '<button onclick="_connectSaveContact()" style="flex:2;padding:12px;border-radius:14px;border:none;background:linear-gradient(135deg,#7C5CFC,#6366F1);color:white;font-size:0.82rem;font-weight:700;cursor:pointer;font-family:inherit">Gem kontakt</button>' +
        '<button onclick="_connectDismissSheet()" style="flex:1;padding:12px;border-radius:14px;border:1px solid rgba(255,255,255,0.15);background:none;color:rgba(255,255,255,0.7);font-size:0.82rem;font-weight:600;cursor:pointer;font-family:inherit">Annuller</button>' +
      '</div>' +
    '</div>';
  resultEl.style.display = 'block';

  // Hide status text
  var status = document.getElementById('connect-scan-status');
  if (status) status.style.display = 'none';
}

async function _connectSaveContact() {
  if (!_connectProfileId || !currentUser) return;
  var btn = document.querySelector('#connect-scan-result button');
  if (btn) { btn.textContent = 'Gemmer...'; btn.disabled = true; }
  try {
    await sb.from('saved_contacts').upsert({ user_id: currentUser.id, contact_id: _connectProfileId });
    clearSavedContactIdsCache();
    trackEvent('qr_contact_saved', { contact_id: _connectProfileId });

    // Transform sheet to confirmation
    var resultEl = document.getElementById('connect-scan-result');
    if (resultEl) {
      var savedId = _connectProfileId;
      resultEl.querySelector('div').innerHTML =
        '<div style="width:36px;height:4px;border-radius:99px;background:rgba(255,255,255,0.15);margin:0 auto 16px"></div>' +
        '<div style="text-align:center;padding:8px 0 4px">' +
          '<div style="width:48px;height:48px;border-radius:50%;background:rgba(26,158,142,0.15);display:flex;align-items:center;justify-content:center;margin:0 auto 10px;font-size:20px;color:#1A9E8E">\u2713</div>' +
          '<div style="font-size:1rem;font-weight:800;color:white">Kontakt gemt!</div>' +
          '<div style="font-size:0.72rem;color:rgba(255,255,255,0.5);margin-top:4px">Du kan finde dem under Gemte kontakter</div>' +
        '</div>' +
        '<div style="display:flex;gap:8px;margin-top:16px">' +
          '<button onclick="closeConnectScanner();setTimeout(function(){openPerson(\'' + savedId + '\',\'screen-home\')},300)" style="flex:1;padding:12px;border-radius:14px;border:none;background:linear-gradient(135deg,#7C5CFC,#6366F1);color:white;font-size:0.82rem;font-weight:700;cursor:pointer;font-family:inherit">Se profil</button>' +
          '<button onclick="closeConnectScanner();setTimeout(function(){openChat(\'' + savedId + '\',\'screen-home\')},300)" style="flex:1;padding:12px;border-radius:14px;border:1px solid rgba(255,255,255,0.15);background:none;color:rgba(255,255,255,0.7);font-size:0.82rem;font-weight:600;cursor:pointer;font-family:inherit">Send besked</button>' +
        '</div>';
    }
  } catch(e) {
    logError('connectSave', e);
    _renderToast(t('toast_save_failed'), 'error');
  }
}

function _connectDismissSheet() {
  var resultEl = document.getElementById('connect-scan-result');
  if (resultEl) { resultEl.style.display = 'none'; resultEl.innerHTML = ''; }
  var status = document.getElementById('connect-scan-status');
  if (status) status.style.display = '';
  _connectPending = false;
  // Resume camera
  var video = document.getElementById('connect-qr-video');
  if (video && _connectStream) { video.play(); _connectScanLoop(); }
}
