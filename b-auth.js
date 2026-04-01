// ══════════════════════════════════════════════════════════
//  BUBBLE — AUTH + LOGIN + SIGNUP + TERMS + FEEDBACK
//  DOMAIN: auth
//  OWNS: currentUser (writes), currentProfile (writes via loadCurrentProfile)
//  OWNS: resolvePostAuth, resolvePostAuthDestination, checkPendingContact, checkPendingJoin
//  READS: flowGet/flowSet (pending states), goTo (navigation)
//  Auto-split from app.js · v3.7.0
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
//  AUTH — POST-AUTH STATE MACHINE (v5.7)
// ══════════════════════════════════════════════════════════

// Step 1: Ensure profile row exists (OAuth users may not have one)
async function ensureProfileExists(session) {
  var { data: existing } = await sb.from('profiles').select('id').eq('id', session.user.id).maybeSingle();
  if (!existing) {
    var meta = session.user.user_metadata || {};
    await sb.from('profiles').upsert({
      id: session.user.id,
      name: meta.full_name || meta.name || session.user.email,
      title: '', keywords: [], dynamic_keywords: [], bio: '', is_anon: false
    });
  }
}

// Step 2: Load essential profile data
async function loadEssentials() {
  await loadCurrentProfile();
  await loadPromotedCustomTags();
  await loadBlockedUsers();
}

// Step 3: Init background services (fire-and-forget)
function initServices() {
  preloadAllData();
  initGlobalRealtime();
  _unreadRecount();
  updateNotifNavBadge();
  loadLiveBubbleStatus();
  initPushNotifications();
}

// Step 4: Resolve pending actions + navigate to correct screen
// ══════════════════════════════════════════════════════════
//  POST-AUTH ROUTING — Single source of truth
//  Priority order (first match wins):
//  1. banned? → signOut + screen-auth (handled in loadCurrentProfile)
//  2. onboarding required? → screen-onboarding (handled in resolvePostAuth)
//  3. pending contact? → save contact (checkPendingContact)
//  4. event flow? → join event + show QR ready
//  5. pending join? → join bubble
//  6. default → screen-home
// ══════════════════════════════════════════════════════════
async function resolvePostAuthDestination() {
  // Step 3: pending contact (from QR scan before auth)
  var savedContactId = await checkPendingContact();

  // Push notification deep link
  var pushParams = new URLSearchParams(window.location.search);
  var pushAction = pushParams.get('push');
  if (pushAction) {
    // Clean URL
    history.replaceState(null, '', window.location.pathname);
    if (pushAction === 'chat' && pushParams.get('uid')) {
      var _pushUid = pushParams.get('uid');
      goTo('screen-home');
      requestAnimationFrame(function() { setTimeout(function() { openChat(_pushUid, 'screen-messages'); }, 100); });
      return;
    } else if (pushAction === 'messages') {
      goTo('screen-messages');
      return;
    } else if (pushAction === 'notifications') {
      goTo('screen-notifications');
      return;
    } else if (pushAction === 'bubble' && pushParams.get('id')) {
      var _pushBid = pushParams.get('id');
      goTo('screen-home');
      requestAnimationFrame(function() { setTimeout(function() { openBubbleChat(_pushBid, 'screen-home'); }, 100); });
      return;
    }
  }

  // Step 3b: if contact was saved from QR → navigate directly to their profile
  if (savedContactId) {
    goTo('screen-home');
    setTimeout(function() { openPerson(savedContactId, 'screen-home'); }, 400);
    return;
  }

  // Step 4: event flow (from event QR)
  var isEventFlow = flowGet('event_flow');
  var postTagsDest = flowGet('post_tags_destination');

  if (isEventFlow) {
    await checkPendingJoin(); // Step 5 inside event context
    var stillEventFlow = flowGet('event_flow');
    if (stillEventFlow) {
      flowRemove('event_flow');
      showEventReadyQR();
    }
  } else if (postTagsDest === 'event_bubble') {
    flowRemove('post_tags_destination');
    eventReadyGoToEvent();
  } else {
    // Step 5: pending join (from bubble invite link)
    await checkPendingJoin();
    // Step 6: welcome screen for first-time users
    if (!localStorage.getItem('bubble_welcomed')) {
      goTo('screen-welcome');
      flowClearAll(); // Safety: no stale flags survive into welcome
      return;
    }
    // Step 7: default
    goTo('screen-home');
  }
  // Safety: clear any unconsumed flow flags after destination resolved
  flowClearAll();
}

// Full orchestrator: single entry point after any successful auth
// Steps 1-2 handled here, steps 3-6 delegated to resolvePostAuthDestination
async function resolvePostAuth() {
  await loadEssentials(); // Step 1: banned check inside loadCurrentProfile
  var needsOnboarding = await maybeShowOnboarding();
  if (needsOnboarding) return; // Step 2: onboarding calls resolvePostAuthDestination when done
  initServices();
  await resolvePostAuthDestination(); // Steps 3-6
}

// ══════════════════════════════════════════════════════════
//  AUTH — SESSION CHECK
// ══════════════════════════════════════════════════════════
async function checkAuth() {
  if (!initSupabase()) return;
  setupAuthListener();
  try {
    // Handle OAuth redirect
    if (window.location.hash && window.location.hash.includes('access_token')) {
      document.getElementById('loading-msg').textContent = 'Login...';
      await new Promise(r => setTimeout(r, 500));
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    var { data: { session } } = await sb.auth.getSession();
    if (session) {
      currentUser = session.user;
      await ensureProfileExists(session);
      await resolvePostAuth();
    } else {
      // No session — redirect to landing (unless user came from landing via ?auth=1 or deep link)
      if (typeof shouldBypassLanding === 'function' && !shouldBypassLanding()) {
        redirectToLanding();
        return;
      }
      goTo('screen-auth');
    }
  } catch(e) {
    var el = document.getElementById('loading-msg');
    if (el) { el.textContent = 'Fejl: ' + (e.message || t('misc_unknown')); el.style.color = '#D06070'; }
    logError('checkAuth', e);
  }
}

function setupAuthListener() {
  sb.auth.onAuthStateChange((event, session) => {
    console.debug('[auth] state change:', event);
    if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
      // User signed out (possibly in another tab)
      bcUnsubscribeAll();
      rtUnsubscribeAll();
      currentUser = null;
      currentProfile = null;
      _profileCache = {};
      redirectToLanding();
    } else if (event === 'TOKEN_REFRESHED' && session) {
      // Token refreshed — update user reference
      currentUser = session.user;
    }
  });
}

async function loadCurrentProfile() {
  try {
    const { data } = await sb.from('profiles').select('*').eq('id', currentUser.id).single();
    if (data) {
      // Check if user is banned
      if (data.banned) {
        await sb.auth.signOut();
        _renderToast('Din konto er blevet suspenderet. Kontakt info@bubbleme.dk', 'error');
        goTo('screen-auth');
        return;
      }
      currentProfile = data;
      updateHomeAvatar();
    }
  } catch(e) { logError("loadCurrentProfile", e); errorToast("load", e); }
}

// ── Avatar helper: returns <img> or initials ──

// ── Avatar upload ──
async function handleAvatarUpload(input) {
  try {
    var file = input.files[0];
    if (!file) return;

    // Validate with clear messages
    var maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      var sizeMB = (file.size / 1024 / 1024).toFixed(1);
      showWarningToast(t('toast_upload_smaller'));
      input.value = '';
      return;
    }
    var allowed = ['image/jpeg','image/png','image/webp'];
    if (allowed.indexOf(file.type) < 0) {
      showWarningToast(t('toast_upload_failed'));
      input.value = '';
      return;
    }
    showToast('Uploader billede...');

    // Resize to max 400x400 to save storage and speed
    var resized = await resizeImage(file, 400);

    var path = 'avatars/' + currentUser.id + '/' + Date.now() + '.jpg';
    var { error: upErr } = await sb.storage.from('bubble-files').upload(path, resized, { cacheControl: '3600', upsert: true, contentType: 'image/jpeg' });
    if (upErr) {
      logError('avatarUpload:storage', upErr, { path: path, size: file.size });
      errorToast('upload', upErr);
      input.value = '';
      return;
    }

    var { data: urlData } = sb.storage.from('bubble-files').getPublicUrl(path);
    var avatarUrl = urlData.publicUrl;

    var { error: saveErr } = await sb.from('profiles').update({ avatar_url: avatarUrl }).eq('id', currentUser.id);
    if (saveErr) {
      logError('avatarUpload:save', saveErr);
      errorToast('save', saveErr);
      return;
    }

    currentProfile.avatar_url = avatarUrl;
    var img = document.getElementById('ep-avatar-img');
    if (img) { img.src = avatarUrl; img.style.display = 'block'; }
    updateAllAvatars();
    showToast(t('toast_saved'));
    input.value = '';
  } catch(e) { logError('handleAvatarUpload', e); errorToast('upload', e); }
}

// Resize image to max dimension, returns Blob
function resizeImage(file, maxDim) {
  return new Promise(function(resolve) {
    var img = new Image();
    img.onload = function() {
      var w = img.width, h = img.height;
      if (w <= maxDim && h <= maxDim) { URL.revokeObjectURL(img.src); resolve(file); return; }
      var scale = Math.min(maxDim / w, maxDim / h);
      var canvas = document.createElement('canvas');
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(img.src);
      canvas.toBlob(function(blob) { resolve(blob || file); }, 'image/jpeg', 0.85);
    };
    img.onerror = function() { URL.revokeObjectURL(img.src); resolve(file); };
    img.src = URL.createObjectURL(file);
  });
}

function updateAllAvatars() {
  var url = currentProfile?.avatar_url;
  var ini = (currentProfile?.name||'?').split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();
  // Home avatar
  var homeAv = document.getElementById('home-avatar');
  if (homeAv) { if (url) homeAv.innerHTML = '<img src="'+url+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%">'; else homeAv.textContent = ini; }
  // Profile avatar
  var myAv = document.getElementById('my-avatar');
  if (myAv) { if (url) myAv.innerHTML = '<img src="'+url+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%">'; else myAv.textContent = ini; }
}

// Full-view avatar overlay
function viewAvatarFull(el) {
  var img = el.querySelector('img');
  if (!img || !img.src) return;
  var overlay = document.createElement('div');
  overlay.className = 'bb-dyn-overlay bb-dyn-center';
  overlay.style.cursor = 'pointer';
  overlay.onclick = function() { bbDynClose(overlay); };
  var bigImg = document.createElement('img');
  bigImg.src = img.src;
  bigImg.style.cssText = 'max-width:90vw;max-height:80vh;border-radius:16px;box-shadow:0 20px 60px rgba(30,27,46,0.15);object-fit:contain';
  overlay.appendChild(bigImg);
  var closeBtn = document.createElement('div');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText = 'position:absolute;top:1.5rem;right:1.5rem;width:36px;height:36px;border-radius:50%;background:rgba(30,27,46,0.06);color:white;display:flex;align-items:center;justify-content:center;font-size:1rem;cursor:pointer';
  overlay.appendChild(closeBtn);
  document.body.appendChild(overlay);
  requestAnimationFrame(function() { requestAnimationFrame(function() { overlay.classList.add('open'); }); });
}

function updateHomeAvatar() {
  if (!currentProfile) return;
  var ini = (currentProfile.name || '?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  var url = currentProfile.avatar_url;
  var homeAv = document.getElementById('home-avatar');
  var myAv = document.getElementById('my-avatar');
  if (homeAv) { if (url) homeAv.innerHTML = '<img src="'+url+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%">'; else homeAv.textContent = ini; }
  if (myAv) { if (url) myAv.innerHTML = '<img src="'+url+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%">'; else myAv.textContent = ini; }
}

async function handleLogin() {
  try {
    const email = document.getElementById('login-email').value.trim();
    const pass = document.getElementById('login-password').value;
    if (!email || !pass) return showWarningToast('Udfyld email og adgangskode');
    showToast(t('misc_loading'));
    const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
    if (error) return errorToast('login', error);
    currentUser = data.user;
    await resolvePostAuth();
  } catch(e) { logError("handleLogin", e); errorToast("login", e); }
}

async function handleSignup() {
  try {
    const name  = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const pass  = document.getElementById('signup-password').value;
    const title = document.getElementById('signup-title').value.trim();
    if (!name || !email || !pass) return showWarningToast('Udfyld alle felter');
    if (pass.length < 6) return showWarningToast(t('toast_password_min'));
    showToast('Opretter konto...');
    const { data, error } = await sb.auth.signUp({
      email,
      password: pass,
      options: {
        emailRedirectTo: window.location.origin + window.location.pathname,
        data: { name: name }
      }
    });
    if (error) return errorToast('login', error);

    // Check if email confirmation is required
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      // Email already exists
      showWarningToast(t('toast_already_registered'));
      return;
    }

    if (data.user && !data.session) {
      // Email confirmation required — show friendly message
      var formArea = document.getElementById('auth-forms');
      if (formArea) {
        formArea.innerHTML = '<div style="text-align:center;padding:2rem 1rem">' +
          '<div style="font-size:2rem;margin-bottom:0.8rem">📧</div>' +
          '<div style="font-size:1.1rem;font-weight:800;color:var(--text);margin-bottom:0.5rem">Tjek din email</div>' +
          '<div style="font-size:0.85rem;color:var(--text-secondary);line-height:1.6;margin-bottom:1.5rem">Vi har sendt en bekræftelsesmail til<br><strong style="color:var(--text)">' + escHtml(email) + '</strong><br><br>Klik på linket i mailen for at aktivere din konto. Tjek også spam-mappen.</div>' +
          '<button class="btn-secondary" onclick="location.reload()" style="width:100%">Jeg har bekræftet — log ind</button>' +
          '</div>';
      }
      return;
    }

    currentUser = data.user;

    // Retry profile creation — auth sometimes needs a moment to propagate
    let profileCreated = false;
    for (let i = 0; i < 5; i++) {
      await new Promise(r => setTimeout(r, 500));
      const { error: profileError } = await sb.from('profiles').upsert({
        id: currentUser.id,
        name, title, keywords: [], dynamic_keywords: [], bio: '', is_anon: false
      });
      if (!profileError) { profileCreated = true; break; }
    }

    if (!profileCreated) {
      showToast('Konto oprettet — udfyld profil under Rediger');
    }

    await resolvePostAuth();
    showSuccessToast('Velkommen til Bubble');
  } catch(e) { logError("handleSignup", e); errorToast("signup", e); }
}

async function handleLogout() {
  try {
    bcUnsubscribeAll();
    rtUnsubscribeAll();
    sb.removeAllChannels();
    // R7: Clear radar refresh timer
    if (typeof _radarRefreshTimer !== 'undefined' && _radarRefreshTimer) { clearInterval(_radarRefreshTimer); _radarRefreshTimer = null; }
    // S6: Clear push subscription for THIS device only (preserve other devices)
    try {
      if (currentUser && 'serviceWorker' in navigator) {
        var reg = await navigator.serviceWorker.ready;
        var sub = await reg.pushManager.getSubscription();
        if (sub) {
          await sb.from('push_subscriptions').delete().eq('user_id', currentUser.id).eq('endpoint', sub.endpoint);
        }
      }
    } catch(e2) { console.debug('[logout] push cleanup:', e2); }
    await sb.auth.signOut();
    currentUser = null; currentProfile = null;
    flowClearAll(); // Prevent stale flags from affecting next login
    goTo('screen-auth');
  } catch(e) { logError("handleLogout", e); errorToast("load", e); }
}

async function handleForgotPassword() {
  var email = document.getElementById('login-email').value.trim();
  if (!email) return showWarningToast(t('toast_enter_email'));
  try {
    showToast(t('toast_sending_reset'));
    var { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin
    });
    if (error) return errorToast('login', error);
    showToast(t('toast_sending_reset'));
  } catch(e) { logError('handleForgotPassword', e); errorToast('login', e); }
}

function switchToSignup() {
  document.getElementById('auth-login').style.display = 'none';
  document.getElementById('auth-signup').style.display = 'block';
}
function switchToLogin() {
  document.getElementById('auth-signup').style.display = 'none';
  document.getElementById('auth-login').style.display = 'block';
}

function showAuthForms(qrContext) {
  var splash = document.getElementById('auth-splash');
  var interests = document.getElementById('auth-interests');
  var forms = document.getElementById('auth-forms');
  if (splash) { splash.style.transition = 'opacity 0.3s'; splash.style.opacity = '0'; setTimeout(function(){ splash.style.display = 'none'; }, 300); }
  if (interests) { interests.style.display = 'none'; }
  if (forms) { forms.style.display = 'block'; forms.style.opacity = '0'; setTimeout(function(){ forms.style.transition = 'opacity 0.3s'; forms.style.opacity = '1'; }, 50); }

  // QR context: show "X vil gerne connecte" card + contextual heading
  var ctxCard = document.getElementById('auth-qr-context');
  var heading = document.getElementById('auth-heading');
  if (qrContext && typeof _qrContactProfile !== 'undefined' && _qrContactProfile) {
    var p = _qrContactProfile;
    if (ctxCard) {
      var avEl = document.getElementById('auth-qr-avatar');
      if (avEl) {
        if (p.avatar_url) {
          avEl.innerHTML = '<img src="' + escHtml(p.avatar_url) + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%">';
        } else {
          avEl.textContent = (p.name || '?').split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();
        }
      }
      var nameEl = document.getElementById('auth-qr-name');
      if (nameEl) nameEl.textContent = p.name || 'Bubble-bruger';
      ctxCard.style.display = 'block';
    }
    if (heading) {
      var titleEl = document.getElementById('auth-heading-title');
      var subEl = document.getElementById('auth-heading-sub');
      if (titleEl) titleEl.textContent = 'Opret din profil';
      if (subEl) subEl.textContent = 'Gem ' + (p.name ? p.name.split(' ')[0] : 'kontakten') + ' og opdag netværket';
      heading.style.display = 'block';
    }
  } else {
    if (ctxCard) ctxCard.style.display = 'none';
    if (heading) heading.style.display = 'none';
  }
}

// ── Interest picker state (used by b-onboarding for tag recommendations) ──
var _selectedInterests = (function() {
  try { var s = localStorage.getItem('bubble_selected_interests'); return s ? JSON.parse(s) : []; } catch(e) { return []; }
})();

function showTerms() {
  var { overlay, sheet } = bbDynOpen();
  sheet.innerHTML = '<div style="width:36px;height:4px;border-radius:99px;background:rgba(30,27,46,0.08);margin:0 auto 1rem;cursor:pointer" onclick="bbDynClose(this.closest(\'.bb-dyn-overlay\'))"></div>' +
    '<h2 style="font-size:1.2rem;font-weight:800;margin-bottom:0.8rem">Betingelser & Privatlivspolitik</h2>' +
    '<div style="font-size:0.78rem;line-height:1.7;color:var(--text-secondary)">' +
    '<h3 style="font-size:0.88rem;font-weight:700;color:var(--text);margin:1rem 0 0.4rem">1. Hvad er Bubble?</h3>' +
    '<p>Bubble er en networking-platform i lukket beta udviklet i Sønderborg, Danmark. Appen forbinder mennesker baseret på professionelle interesser og nærhed.</p>' +
    '<p style="margin-top:4px">Dataansvarlig: Bubble / Michael Brix Johansen, Sønderborg. Kontakt: info@bubbleme.dk.</p>' +
    '<h3 style="font-size:0.88rem;font-weight:700;color:var(--text);margin:1rem 0 0.4rem">2. Beta-forbehold</h3>' +
    '<p>Bubble er i <strong>closed beta</strong>. Funktioner kan ændres uden varsel. Der kan forekomme fejl, nedetid og datatab. Vi giver ingen garantier for oppetid eller dataintegritet.</p>' +
    '<h3 style="font-size:0.88rem;font-weight:700;color:var(--text);margin:1rem 0 0.4rem">3. Dine data (GDPR)</h3>' +
    '<p>Vi indsamler kun det du selv indtaster: navn, email, titel, arbejdsplads, bio, tags og profilbillede. Vi gemmer desuden hvilke bobler du joiner og kontakter du gemmer.</p>' +
    '<p style="margin-top:4px">Retsgrundlag: samtykke (art. 6, stk. 1, litra a) og berettiget interesse (art. 6, stk. 1, litra f).</p>' +
    '<p style="margin-top:4px">Beskeder opbevares krypteret og læses ikke af os. Vi sælger <strong>aldrig</strong> dine data. Data opbevares i EU via Supabase (Frankfurt).</p>' +
    '<h3 style="font-size:0.88rem;font-weight:700;color:var(--text);margin:1rem 0 0.4rem">4. Cookies og lokal lagring</h3>' +
    '<p>Bubble bruger <strong>ingen tracking-cookies</strong> og ingen tredjeparts-analyse. Vi bruger kun nødvendig lokal lagring:</p>' +
    '<p style="margin-top:4px">• <strong>Login-token</strong> — holder dig logget ind<br>' +
    '• <strong>App-præferencer</strong> — husker dine valg<br>' +
    '• <strong>Session-data</strong> — midlertidig, slettes ved browserlukning</p>' +
    '<p style="margin-top:4px">Ingen data deles med tredjepart. Ingen reklame- eller profileringscookies.</p>' +
    '<h3 style="font-size:0.88rem;font-weight:700;color:var(--text);margin:1rem 0 0.4rem">5. Dine rettigheder</h3>' +
    '<p>Du har ret til indsigt, berigtigelse, sletning, begrænsning, dataportabilitet og indsigelse. Du kan redigere/slette din profil, blokere brugere og anmode om fuld datasletning via info@bubbleme.dk. Vi svarer inden 30 dage.</p>' +
    '<h3 style="font-size:0.88rem;font-weight:700;color:var(--text);margin:1rem 0 0.4rem">6. Adfærd</h3>' +
    '<p>Chikane, spam, hadefuldt indhold eller upassende profilbilleder tolereres ikke og kan resultere i fjernelse fra platformen.</p>' +
    '<h3 style="font-size:0.88rem;font-weight:700;color:var(--text);margin:1rem 0 0.4rem">7. Ansvarsfraskrivelse</h3>' +
    '<p>Bubble leveres "as is" uden garanti. Vi er ikke ansvarlige for tab af data, handlinger af andre brugere eller resultat af forbindelser via platformen.</p>' +
    '<h3 style="font-size:0.88rem;font-weight:700;color:var(--text);margin:1rem 0 0.4rem">8. Kontakt & klage</h3>' +
    '<p>Kontakt os på <strong>info@bubbleme.dk</strong></p>' +
    '<p style="margin-top:4px">Klage: <a href="https://www.datatilsynet.dk" target="_blank" rel="noopener" style="color:var(--accent)">datatilsynet.dk</a></p>' +
    '<p style="margin-top:8px;font-size:0.68rem;color:var(--muted)">Sidst opdateret: april 2026</p>' +
    '</div>' +
    '<button onclick="bbDynClose(this.closest(\'.bb-dyn-overlay\'))" style="width:100%;margin-top:1.2rem;padding:0.7rem;border-radius:12px;border:1px solid var(--glass-border);background:none;color:var(--text);font-family:inherit;font-size:0.82rem;font-weight:600;cursor:pointer">Luk</button>';
}

function openFeedback() {
  var { overlay, sheet } = bbDynOpen();
  sheet.innerHTML = '<div style="width:36px;height:4px;border-radius:99px;background:rgba(30,27,46,0.08);margin:0 auto 1rem;cursor:pointer" onclick="bbDynClose(this.closest(\'.bb-dyn-overlay\'))"></div>' +
    '<h2 style="font-size:1.1rem;font-weight:800;margin-bottom:0.3rem">Giv feedback</h2>' +
    '<p style="font-size:0.78rem;color:var(--text-secondary);margin-bottom:1rem">Vi er i beta — din feedback er guld værd og hjælper os med at bygge det bedste produkt.</p>' +
    '<textarea id="feedback-text" placeholder="Hvad virker godt? Hvad kan gøres bedre? Har du oplevet fejl?" style="width:100%;height:120px;background:rgba(30,27,46,0.03);border:1px solid var(--glass-border);border-radius:12px;padding:0.7rem;font-family:Figtree,sans-serif;font-size:0.82rem;color:var(--text);resize:none;outline:none"></textarea>' +
    '<button onclick="submitFeedback()" style="width:100%;margin-top:0.8rem;padding:0.7rem;border-radius:12px;border:none;background:var(--gradient-accent);color:white;font-family:inherit;font-size:0.85rem;font-weight:700;cursor:pointer">Send feedback →</button>' +
    '<button onclick="bbDynClose(this.closest(\'.bb-dyn-overlay\'))" style="width:100%;margin-top:0.4rem;padding:0.5rem;border-radius:12px;border:1px solid var(--glass-border);background:none;color:var(--muted);font-family:inherit;font-size:0.78rem;cursor:pointer">Annuller</button>';

  setTimeout(function(){ var ta = document.getElementById('feedback-text'); if(ta) ta.focus(); }, 300);
}

async function submitFeedback() {
  var text = document.getElementById('feedback-text')?.value?.trim();
  if (!text) { showWarningToast('Skriv noget feedback først'); return; }
  try {
    await sb.from('reports').insert({
      reporter_id: currentUser.id,
      reported_id: null,
      type: 'feedback',
      reason: text
    });
    logError('USER_FEEDBACK', new Error('Feedback modtaget'), { text: text, user: currentUser.id, name: currentProfile?.name });
    var dyn = document.querySelector('.bb-dyn-overlay');
    if (dyn) bbDynClose(dyn);
    showToast('Tak for din feedback! 💜');
  } catch(e) { logError('submitFeedback', e); errorToast('send', e); }
}


// ══════════════════════════════════════════════════════════
//  GOOGLE LOGIN
// ══════════════════════════════════════════════════════════
async function handleGoogleLogin() {
  try {
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + window.location.pathname,
        queryParams: { access_type: 'offline', prompt: 'consent' }
      }
    });
    if (error) errorToast('login', error);
  } catch(e) { logError("handleGoogleLogin", e); errorToast("login", e); }
}

// ══════════════════════════════════════════════════════════
//  LINKEDIN LOGIN
// ══════════════════════════════════════════════════════════
async function handleLinkedInLogin() {
  try {
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'linkedin_oidc',
      options: {
        redirectTo: window.location.origin + window.location.pathname
      }
    });
    if (error) errorToast('login', error);
  } catch(e) { logError("handleLinkedInLogin", e); errorToast("login", e); }
}

// ══════════════════════════════════════════════════════════
//  APPLE LOGIN
// ══════════════════════════════════════════════════════════
async function handleAppleLogin() {
  try {
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: window.location.origin + window.location.pathname
      }
    });
    if (error) errorToast('login', error);
  } catch(e) { logError("handleAppleLogin", e); errorToast("login", e); }
}

// ══════════════════════════════════════════════════════════
//  PERSONAL QR CODE
// ══════════════════════════════════════════════════════════
async function openMyQR() {
  if (!currentUser || !currentProfile) { _renderToast('Log ind først', 'error'); return; }
  
  // Generate short-lived token (10 min)
  var token = crypto.randomUUID ? crypto.randomUUID().split('-')[0] : Math.random().toString(36).slice(2,10);
  var expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  
  try {
    await sb.from('qr_tokens').insert({
      token: token,
      user_id: currentUser.id,
      expires_at: expiresAt
    });
  } catch(e) {
    logError('openMyQR:token', e);
    // Fallback to static URL if token creation fails
    token = null;
  }
  
  var url = token
    ? window.location.origin + window.location.pathname + '?qrt=' + token
    : window.location.origin + window.location.pathname + '?profile=' + currentUser.id;
  
  var { overlay, sheet } = bbDynOpen();
  sheet.style.textAlign = 'center';
  sheet.innerHTML = '<div style="width:36px;height:4px;border-radius:99px;background:rgba(30,27,46,0.12);margin:0 auto 1rem;cursor:pointer" onclick="bbDynClose(this.closest(\'.bb-dyn-overlay\'))"></div>' +
    '<div style="font-size:1.1rem;font-weight:800;margin-bottom:0.3rem">Min QR-kode</div>' +
    '<div style="font-size:0.78rem;color:var(--text-secondary);margin-bottom:1rem">Gyldig i 10 minutter · opdateres automatisk</div>' +
    '<div id="my-qr-container" style="display:flex;justify-content:center;margin-bottom:1rem"></div>' +
    '<div style="font-size:0.65rem;color:var(--muted);margin-bottom:0.8rem">' + escHtml(currentProfile.name) + ' · ' + escHtml(currentProfile.title || '') + '</div>' +
    '<button onclick="navigator.clipboard.writeText(\'' + url + '\');this.textContent=\'Kopieret! ✓\';setTimeout(()=>this.textContent=\'Del profil\',2000)" style="width:100%;padding:0.7rem;border-radius:12px;border:none;background:linear-gradient(135deg,#7C5CFC,#6366F1);color:white;font-family:inherit;font-size:0.82rem;font-weight:700;cursor:pointer">Del profil</button>';
  
  setTimeout(function() {
    var container = document.getElementById('my-qr-container');
    if (container && typeof QRCode !== 'undefined') {
      new QRCode(container, {
        text: url,
        width: 200,
        height: 200,
        colorDark: '#1E1B2E',
        colorLight: '#FFFFFF',
        correctLevel: QRCode.CorrectLevel.M
      });
    }
  }, 100);
}

