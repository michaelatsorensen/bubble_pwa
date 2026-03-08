
// Desktop detection
var isDesktop = window.matchMedia('(min-width: 600px)').matches && !('ontouchstart' in window);

// ══════════════════════════════════════════════════════════
//  CONFIGURATION
// ══════════════════════════════════════════════════════════
const BUILD_TIMESTAMP = '2026-03-09T03:30:00';
const BUILD_VERSION  = 'v1.3.9';
const SUPABASE_URL  = "https://pfxcsjjxvdtpsfltexka.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_y6BftA4RQw91dLHPXIncag_oGomBk-A";

var hsDefaults = { live: true, saved: true, bubbles: true, notifs: true, radar: true };

// ══════════════════════════════════════════════════════════
//  GLOBAL ERROR HANDLERS + ERROR LOGGING + EMAIL ALERTS
// ══════════════════════════════════════════════════════════
var _errorLog = [];
var ERROR_LOG_MAX = 50;

// ── EmailJS config (fill in your keys from emailjs.com) ──
var EMAILJS_PUBLIC_KEY  = 'obqyOwjfRAzMEr_MI';
var EMAILJS_SERVICE_ID  = 'service_Bubble_Bugs';
var EMAILJS_TEMPLATE_ID = 'template_tqt3igv';
var _emailjsLoaded = false;
var _lastErrorEmail = 0;
var ERROR_EMAIL_COOLDOWN = 60000; // Max 1 email per minut (undgår spam ved kaskade-fejl)

function loadEmailJS() {
  if (_emailjsLoaded || EMAILJS_PUBLIC_KEY === 'DIN_PUBLIC_KEY') return;
  var script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';
  script.onload = function() {
    if (window.emailjs) { window.emailjs.init(EMAILJS_PUBLIC_KEY); _emailjsLoaded = true; }
  };
  document.head.appendChild(script);
}

function sendErrorEmail(entry) {
  if (!_emailjsLoaded || !window.emailjs) return;
  if (EMAILJS_SERVICE_ID === 'DIN_SERVICE_ID') return;
  // Rate limit
  var now = Date.now();
  if (now - _lastErrorEmail < ERROR_EMAIL_COOLDOWN) return;
  _lastErrorEmail = now;

  window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
    context: entry.ctx,
    message: entry.msg,
    stack: entry.stack || 'N/A',
    extra: entry.extra ? (typeof entry.extra === 'object' ? JSON.stringify(entry.extra) : entry.extra) : 'N/A',
    user_id: entry.user || 'anonym',
    timestamp: entry.ts
  }).catch(function() { /* silent — don't log email errors to avoid loops */ });
}

function logError(context, error, extra) {
  var entry = {
    ts: new Date().toISOString(),
    ctx: context,
    msg: error?.message || String(error),
    stack: error?.stack?.split('\n').slice(0,3).join(' | ') || '',
    extra: extra || null,
    user: currentUser?.id || null
  };
  _errorLog.push(entry);
  if (_errorLog.length > ERROR_LOG_MAX) _errorLog.shift();
  console.error('[' + context + ']', error, extra || '');

  // Persist to Supabase error_log table
  if (typeof sb !== 'undefined' && sb && currentUser) {
    sb.from('error_log').insert({
      user_id: currentUser.id,
      context: context,
      message: entry.msg,
      stack: entry.stack,
      extra: typeof extra === 'object' ? JSON.stringify(extra) : extra || null
    }).then(function(){}).catch(function(){});
  }

  // Send email alert
  sendErrorEmail(entry);
}

// View error log in console: type viewErrorLog() in devtools
window.viewErrorLog = function() { console.table(_errorLog); return _errorLog; };

window.onerror = function(msg, src, line, col, err) {
  logError('global', err || msg, { src: src, line: line, col: col });
  const el = document.getElementById('loading-msg');
  if (el) {
    el.textContent = '❌ JS Fejl linje ' + line + ': ' + msg;
    el.style.color = '#E85D8A';
    el.style.fontSize = '0.75rem';
    el.style.maxWidth = '320px';
    el.style.margin = '1rem auto';
  }
  return false;
};
window.onunhandledrejection = function(e) {
  logError('promise', e.reason, null);
  const el = document.getElementById('loading-msg');
  if (el) {
    el.textContent = '❌ Promise fejl: ' + (e.reason?.message || e.reason || 'Ukendt');
    el.style.color = '#E85D8A';
  }
};

// ══════════════════════════════════════════════════════════
//  SUPABASE INIT
// ══════════════════════════════════════════════════════════
let sb;
let currentUser = null;
let currentProfile = null;
let currentBubble = null;
let currentPerson = null;
let currentChatUser = null;
let currentChatName = null;
let allBubbles = [];
let cbChips = [], epChips = [], epDynChips = [], ebChips = [], obChips = [];
let chatSubscription = null;
let isAnon = false;

function initSupabase() {
  if (SUPABASE_URL === "DIN_SUPABASE_URL_HER") {
    document.getElementById('loading-msg').textContent = '⚠️ Indsæt dine Supabase-nøgler i filen';
    document.getElementById('loading-msg').style.color = '#E85D8A';
    return false;
  }
  try {
    sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    loadEmailJS(); // Load error email alerting
    return true;
  } catch(e) {
    document.getElementById('loading-msg').textContent = 'Fejl: ' + e.message;
    return false;
  }
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
  var ids = [
    'ob-name','ob-title','ob-workplace','ob-bio','ob-linkedin',
    'ep-name','ep-title','ep-workplace','ep-bio','ep-linkedin',
    'cb-name','cb-desc','eb-name','eb-desc'
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
}

// ══════════════════════════════════════════════════════════
//  NAVIGATION
// ══════════════════════════════════════════════════════════
function goTo(screenId) {
  console.debug('[nav] goTo:', screenId);

  // Force close any lingering sheets/overlays
  document.querySelectorAll('.person-sheet.open,.person-sheet-overlay.open,.radar-person-sheet.open,.radar-person-overlay.open').forEach(function(el) { el.classList.remove('open'); el.style.transform = ''; });

  // Cleanup: unsubscribe when leaving chat screens
  const prev = document.querySelector('.screen.active');
  if (prev) {
    const prevId = prev.id;
    if (prevId === 'screen-chat' && screenId !== 'screen-chat') {
      if (chatSubscription) { chatSubscription.unsubscribe(); chatSubscription = null; }
      dmEditingId = null;
    }
    if (prevId === 'screen-bubble-chat' && screenId !== 'screen-bubble-chat') {
      if (bcSubscription) { bcSubscription.unsubscribe(); bcSubscription = null; }
      bcEditingId = null;
      bcCurrentMsgId = null;
      bcCloseContext();
    }
  }
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(screenId);
  if (!target) { console.error('[nav] screen not found:', screenId); return; }
  target.classList.add('active');

  // Reset profile tab to default when navigating to profile
  if (screenId === 'screen-profile') {
    // keep current tab
  }
  window.scrollTo(0,0);

  // Update bottom nav active state
  const navMap = {
    'screen-home': 0, 'screen-bubbles': 0,
    'screen-discover': 1,
    'screen-messages': 2, 'screen-chat': 2, 'screen-bubble-chat': 2,
    'screen-profile': 3,
    'screen-notifications': -1, 'screen-person': -1
  };
  const activeIdx = navMap[screenId];
  if (activeIdx !== undefined) {
    document.querySelectorAll('.bottom-nav').forEach(nav => {
      nav.querySelectorAll('.nav-item').forEach((btn, i) => {
        btn.classList.toggle('active', i === activeIdx);
      });
    });
  }

  // Load data for screen
  if (screenId === 'screen-home') loadHome();
  if (screenId === 'screen-bubbles') loadMyBubbles();
  if (screenId === 'screen-notifications') loadNotifications();
  if (screenId === 'screen-discover') loadDiscover();
  if (screenId === 'screen-messages') loadMessages();
  if (screenId === 'screen-profile') loadProfile();
}

// ══════════════════════════════════════════════════════════
//  AUTH
// ══════════════════════════════════════════════════════════
async function checkAuth() {
  if (!initSupabase()) return;
  setupAuthListener();
  try {
    // Handle OAuth redirect — Supabase v2 processes hash automatically
    if (window.location.hash && window.location.hash.includes('access_token')) {
      document.getElementById('loading-msg').textContent = 'Logger ind via Google...';
      // Give Supabase a moment to process the hash
      await new Promise(r => setTimeout(r, 500));
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    const { data: { session } } = await sb.auth.getSession();
    if (session) {
      currentUser = session.user;
      // Ensure profile row exists (Google users may not have one)
      const { data: existingProfile } = await sb.from('profiles').select('id').eq('id', session.user.id).single();
      if (!existingProfile) {
        const meta = session.user.user_metadata || {};
        await sb.from('profiles').upsert({
          id: session.user.id,
          name: meta.full_name || meta.name || session.user.email,
          title: '', keywords: [], dynamic_keywords: [], bio: '', is_anon: false
        });
      }
      await loadCurrentProfile();
      await loadPromotedCustomTags();
      await loadBlockedUsers();
      const needsOnboarding = await maybeShowOnboarding();
      if (!needsOnboarding) { goTo('screen-home'); preloadAllData(); }
    } else {
      goTo('screen-auth');
    }
  } catch(e) {
    var el = document.getElementById('loading-msg');
    if (el) { el.textContent = 'Fejl: ' + (e.message || 'Ukendt'); el.style.color = '#E85D8A'; }
    logError('checkAuth', e);
  }
}

function setupAuthListener() {
  sb.auth.onAuthStateChange((event, session) => {
    console.debug('[auth] state change:', event);
    if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED' && !session) {
      // User signed out (possibly in another tab)
      bcUnsubscribeAll();
      currentUser = null;
      currentProfile = null;
      _profileCache = {};
      goTo('screen-auth');
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
      currentProfile = data;
      updateHomeAvatar();
    }
  } catch(e) { logError("loadCurrentProfile", e); showToast(e.message || "Ukendt fejl"); }
}

// ── Avatar helper: returns <img> or initials ──
function avatarHtml(name, avatarUrl, size, gradient) {
  size = size || 42;
  gradient = gradient || 'linear-gradient(135deg,#8B7FFF,#E85D8A)';
  var ini = (name||'?').split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();
  if (avatarUrl) {
    return '<div style="width:'+size+'px;height:'+size+'px;border-radius:50%;overflow:hidden;flex-shrink:0"><img src="'+avatarUrl+'" style="width:100%;height:100%;object-fit:cover" alt=""></div>';
  }
  return '<div style="width:'+size+'px;height:'+size+'px;border-radius:50%;background:'+gradient+';display:flex;align-items:center;justify-content:center;font-size:'+(size*0.35)+'px;font-weight:700;color:white;flex-shrink:0">'+ini+'</div>';
}

// ── Avatar upload ──
async function handleAvatarUpload(input) {
  try {
    var file = input.files[0];
    if (!file) return;

    // Validate with clear messages
    var maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      var sizeMB = (file.size / 1024 / 1024).toFixed(1);
      showToast('Billedet er ' + sizeMB + 'MB — maks 2MB. Prøv et mindre billede.');
      input.value = '';
      return;
    }
    var allowed = ['image/jpeg','image/png','image/webp'];
    if (allowed.indexOf(file.type) < 0) {
      showToast('Format ikke understøttet (' + (file.type || 'ukendt') + '). Brug JPG, PNG eller WebP.');
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
      showToast('Upload fejlede: ' + (upErr.message || 'Tjek at bubble-files bucket er oprettet'));
      input.value = '';
      return;
    }

    var { data: urlData } = sb.storage.from('bubble-files').getPublicUrl(path);
    var avatarUrl = urlData.publicUrl;

    var { error: saveErr } = await sb.from('profiles').update({ avatar_url: avatarUrl }).eq('id', currentUser.id);
    if (saveErr) {
      logError('avatarUpload:save', saveErr);
      showToast('Gem fejl: ' + saveErr.message + ' — kør: ALTER TABLE profiles ADD COLUMN avatar_url text;');
      return;
    }

    currentProfile.avatar_url = avatarUrl;
    var img = document.getElementById('ep-avatar-img');
    if (img) { img.src = avatarUrl; img.style.display = 'block'; }
    updateAllAvatars();
    showToast('Profilbillede opdateret! 📸');
    input.value = '';
  } catch(e) { logError('handleAvatarUpload', e); showToast('Upload fejl: ' + (e.message || 'ukendt')); }
}

// Resize image to max dimension, returns Blob
function resizeImage(file, maxDim) {
  return new Promise(function(resolve) {
    var img = new Image();
    img.onload = function() {
      var w = img.width, h = img.height;
      if (w <= maxDim && h <= maxDim) { resolve(file); return; }
      var scale = Math.min(maxDim / w, maxDim / h);
      var canvas = document.createElement('canvas');
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(function(blob) { resolve(blob || file); }, 'image/jpeg', 0.85);
    };
    img.onerror = function() { resolve(file); };
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
  overlay.style.cssText = 'position:fixed;inset:0;z-index:999;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;cursor:pointer;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)';
  overlay.onclick = function() { overlay.remove(); };
  var bigImg = document.createElement('img');
  bigImg.src = img.src;
  bigImg.style.cssText = 'max-width:90vw;max-height:80vh;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,0.5);object-fit:contain';
  overlay.appendChild(bigImg);
  var closeBtn = document.createElement('div');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText = 'position:absolute;top:1.5rem;right:1.5rem;width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.1);color:white;display:flex;align-items:center;justify-content:center;font-size:1rem;cursor:pointer';
  overlay.appendChild(closeBtn);
  document.body.appendChild(overlay);
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
    if (!email || !pass) return showToast('Udfyld email og adgangskode');
    showToast('Logger ind...');
    const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
    if (error) return showToast('Fejl: ' + error.message);
    currentUser = data.user;
    await loadCurrentProfile();
    await loadPromotedCustomTags();
    await loadBlockedUsers();
    const needsOnboarding = await maybeShowOnboarding();
    if (!needsOnboarding) { goTo('screen-home'); preloadAllData(); }
  } catch(e) { logError("handleLogin", e); showToast(e.message || "Ukendt fejl"); }
}

async function handleSignup() {
  try {
    const name  = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const pass  = document.getElementById('signup-password').value;
    const title = document.getElementById('signup-title').value.trim();
    if (!name || !email || !pass) return showToast('Udfyld alle felter');
    if (pass.length < 6) return showToast('Adgangskode skal være min. 6 tegn');
    showToast('Opretter konto...');
    const { data, error } = await sb.auth.signUp({ email, password: pass });
    if (error) return showToast('Fejl: ' + error.message);
    currentUser = data.user;

    // Retry profile creation a few times — auth sometimes needs a moment to propagate
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
      showToast('Konto oprettet — udfyld profil under Rediger 👤');
    }

    await loadCurrentProfile();
    await loadPromotedCustomTags();
      await loadBlockedUsers();
    const needsOnboarding = await maybeShowOnboarding();
    if (!needsOnboarding) goTo('screen-home');
    showToast('Velkommen til Bubble! 🫧');
  } catch(e) { logError("handleSignup", e); showToast(e.message || "Ukendt fejl"); }
}

async function handleLogout() {
  try {
    bcUnsubscribeAll();
    sb.removeAllChannels();
    await sb.auth.signOut();
    currentUser = null; currentProfile = null;
    goTo('screen-auth');
  } catch(e) { logError("handleLogout", e); showToast(e.message || "Ukendt fejl"); }
}

async function handleForgotPassword() {
  var email = document.getElementById('login-email').value.trim();
  if (!email) return showToast('Indtast din email først');
  try {
    showToast('Sender nulstillingslink...');
    var { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin
    });
    if (error) return showToast('Fejl: ' + error.message);
    showToast('Tjek din indbakke for nulstillingslink ✉️');
  } catch(e) { logError('handleForgotPassword', e); showToast(e.message || 'Ukendt fejl'); }
}

function switchToSignup() {
  document.getElementById('auth-login').style.display = 'none';
  document.getElementById('auth-signup').style.display = 'block';
}
function switchToLogin() {
  document.getElementById('auth-signup').style.display = 'none';
  document.getElementById('auth-login').style.display = 'block';
}

function showAuthForms() {
  var splash = document.getElementById('auth-splash');
  var forms = document.getElementById('auth-forms');
  if (splash) { splash.style.transition = 'opacity 0.3s'; splash.style.opacity = '0'; setTimeout(function(){ splash.style.display = 'none'; }, 300); }
  if (forms) { forms.style.display = 'block'; forms.style.opacity = '0'; setTimeout(function(){ forms.style.transition = 'opacity 0.3s'; forms.style.opacity = '1'; }, 50); }
}

function showTerms() {
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:999;background:rgba(0,0,0,0.85);display:flex;align-items:flex-end;justify-content:center;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)';
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

  var sheet = document.createElement('div');
  sheet.style.cssText = 'width:100%;max-width:680px;max-height:85vh;background:rgba(12,12,25,0.95);border-radius:24px 24px 0 0;padding:1.5rem;overflow-y:auto;color:var(--text);font-family:Outfit,sans-serif';
  sheet.innerHTML = '<div style="width:36px;height:4px;border-radius:99px;background:rgba(255,255,255,0.15);margin:0 auto 1rem;cursor:pointer" onclick="this.parentElement.parentElement.remove()"></div>' +
    '<h2 style="font-size:1.2rem;font-weight:800;margin-bottom:0.8rem">Betingelser & Privatlivspolitik</h2>' +
    '<div style="font-size:0.78rem;line-height:1.7;color:var(--text-secondary)">' +
    '<h3 style="font-size:0.88rem;font-weight:700;color:var(--text);margin:1rem 0 0.4rem">1. Hvad er Bubble?</h3>' +
    '<p>Bubble er en networking-platform i lukket beta udviklet i Sønderborg, Danmark. Appen forbinder mennesker baseret på professionelle interesser og nærhed.</p>' +
    '<h3 style="font-size:0.88rem;font-weight:700;color:var(--text);margin:1rem 0 0.4rem">2. Beta-forbehold</h3>' +
    '<p>Bubble er i <strong>closed beta</strong>. Det betyder at:</p>' +
    '<p>• Funktioner kan ændres, tilføjes eller fjernes uden varsel<br>' +
    '• Der kan forekomme fejl, nedetid og datatab<br>' +
    '• Vi gør vores bedste, men giver ingen garantier for oppetid eller dataintegritet</p>' +
    '<h3 style="font-size:0.88rem;font-weight:700;color:var(--text);margin:1rem 0 0.4rem">3. Dine data (GDPR)</h3>' +
    '<p>Vi indsamler kun det du selv indtaster:</p>' +
    '<p>• Navn, email, titel, arbejdsplads, bio, tags, profilbillede<br>' +
    '• Beskeder du sender i chat og bobler<br>' +
    '• Hvilke bobler du joiner og kontakter du gemmer</p>' +
    '<p>Vi sælger <strong>aldrig</strong> dine data til tredjepart. Data opbevares i EU via Supabase (GDPR-compliant hosting).</p>' +
    '<h3 style="font-size:0.88rem;font-weight:700;color:var(--text);margin:1rem 0 0.4rem">4. Dine rettigheder</h3>' +
    '<p>Du kan til enhver tid:</p>' +
    '<p>• Redigere eller slette din profil<br>' +
    '• Blokere andre brugere<br>' +
    '• Anmode om fuld sletning af dine data ved at kontakte os</p>' +
    '<h3 style="font-size:0.88rem;font-weight:700;color:var(--text);margin:1rem 0 0.4rem">5. Adfærd</h3>' +
    '<p>Vi forventer at alle brugere opfører sig respektfuldt. Chikane, spam, hadefuldt indhold eller upassende profilbilleder tolereres ikke og kan resultere i fjernelse fra platformen.</p>' +
    '<h3 style="font-size:0.88rem;font-weight:700;color:var(--text);margin:1rem 0 0.4rem">6. Ansvarsfraskrivelse</h3>' +
    '<p>Bubble leveres "as is" uden garanti. Vi er ikke ansvarlige for:</p>' +
    '<p>• Tab af data under beta<br>' +
    '• Handlinger foretaget af andre brugere<br>' +
    '• Resultat af forbindelser skabt via platformen</p>' +
    '<p>Brug af Bubble sker på eget ansvar.</p>' +
    '<h3 style="font-size:0.88rem;font-weight:700;color:var(--text);margin:1rem 0 0.4rem">7. Kontakt</h3>' +
    '<p>Spørgsmål? Kontakt os på <strong>hello@bubble.app</strong></p>' +
    '</div>' +
    '<button onclick="this.parentElement.parentElement.remove()" style="width:100%;margin-top:1.2rem;padding:0.7rem;border-radius:12px;border:1px solid var(--glass-border);background:none;color:var(--text);font-family:inherit;font-size:0.82rem;font-weight:600;cursor:pointer">Luk</button>';

  overlay.appendChild(sheet);
  document.body.appendChild(overlay);
}

function openFeedback() {
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:999;background:rgba(0,0,0,0.85);display:flex;align-items:flex-end;justify-content:center;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)';
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

  var sheet = document.createElement('div');
  sheet.style.cssText = 'width:100%;max-width:680px;background:rgba(12,12,25,0.95);border-radius:24px 24px 0 0;padding:1.5rem;color:var(--text);font-family:Outfit,sans-serif';
  sheet.innerHTML = '<div style="width:36px;height:4px;border-radius:99px;background:rgba(255,255,255,0.15);margin:0 auto 1rem;cursor:pointer" onclick="this.parentElement.parentElement.remove()"></div>' +
    '<h2 style="font-size:1.1rem;font-weight:800;margin-bottom:0.3rem">Giv feedback</h2>' +
    '<p style="font-size:0.78rem;color:var(--text-secondary);margin-bottom:1rem">Vi er i beta — din feedback er guld værd og hjælper os med at bygge det bedste produkt.</p>' +
    '<textarea id="feedback-text" placeholder="Hvad virker godt? Hvad kan gøres bedre? Har du oplevet fejl?" style="width:100%;height:120px;background:rgba(255,255,255,0.04);border:1px solid var(--glass-border);border-radius:12px;padding:0.7rem;font-family:Outfit,sans-serif;font-size:0.82rem;color:var(--text);resize:none;outline:none"></textarea>' +
    '<button onclick="submitFeedback()" style="width:100%;margin-top:0.8rem;padding:0.7rem;border-radius:12px;border:none;background:var(--gradient-accent);color:white;font-family:inherit;font-size:0.85rem;font-weight:700;cursor:pointer">Send feedback →</button>' +
    '<button onclick="this.parentElement.parentElement.remove()" style="width:100%;margin-top:0.4rem;padding:0.5rem;border-radius:12px;border:1px solid var(--glass-border);background:none;color:var(--muted);font-family:inherit;font-size:0.78rem;cursor:pointer">Annuller</button>';

  overlay.appendChild(sheet);
  document.body.appendChild(overlay);
  setTimeout(function(){ var ta = document.getElementById('feedback-text'); if(ta) ta.focus(); }, 100);
}

async function submitFeedback() {
  var text = document.getElementById('feedback-text')?.value?.trim();
  if (!text) { showToast('Skriv noget feedback først'); return; }
  try {
    await sb.from('reports').insert({
      reporter_id: currentUser.id,
      reported_id: null,
      type: 'feedback',
      reason: text
    });
    logError('USER_FEEDBACK', new Error('Feedback modtaget'), { text: text, user: currentUser.id, name: currentProfile?.name });
    document.querySelector('[style*="backdrop-filter"]')?.remove();
    showToast('Tak for din feedback! 💜');
  } catch(e) { logError('submitFeedback', e); showToast('Fejl: ' + (e.message || 'ukendt')); }
}

// ══════════════════════════════════════════════════════════
//  HOME
// ══════════════════════════════════════════════════════════
async function loadHome() {
  try {
    if (!currentProfile) await loadCurrentProfile();
    updateHomeAvatar();

    // Greeting
    const nameEl = document.getElementById('home-greeting-name');
    if (nameEl && currentProfile?.name) {
    // Dynamic greeting
    var hour = new Date().getHours();
    var greetText = hour < 5 ? 'God nat' : hour < 12 ? 'Godmorgen' : hour < 17 ? 'Goddag' : hour < 22 ? 'God aften' : 'God nat';
    var greetLabel = nameEl?.previousElementSibling;
    if (greetLabel) greetLabel.textContent = greetText + ',';
      nameEl.innerHTML = (currentProfile.name.split(' ')[0]) + ' ' + icon('wave');
    }

    // Load all dashboard data in parallel
    var hsp = hsGetPrefs();
    var loaders = [];
    if (hsp.bubbles) loaders.push(loadHomeBubblesCard());
    if (hsp.notifs) loaders.push(loadHomeNotifCard());
    if (hsp.radar) { loaders.push(updateRadarCount()); loaders.push(loadProximityMap()); }
    if (hsp.live) loaders.push(loadLiveBubbleStatus());
    if (hsp.saved) loaders.push(loadSavedContacts());
    await Promise.all(loaders);
    hsApplyToHome();
    showGettingStarted();
  } catch(e) { logError("loadHome", e); showToast(e.message || "Ukendt fejl"); }
}

async function loadHomeBubblesCard() {
  try {
    const sub = document.getElementById('home-bubbles-sub');
    const badge = document.getElementById('home-bubbles-badge');
    const { data: memberships } = await sb.from('bubble_members').select('bubble_id').eq('user_id', currentUser.id);
    const count = memberships?.length || 0;
    if (sub) sub.textContent = count > 0 ? `${count} aktiv${count !== 1 ? 'e' : ''} boble${count !== 1 ? 'r' : ''}` : 'Du er ikke i nogen bobler endnu';
    if (badge) { badge.textContent = count; badge.style.display = count > 0 ? 'flex' : 'none'; }
  } catch(e) { logError("loadHomeBubblesCard", e); showToast(e.message || "Ukendt fejl"); }
}

// loadHomeMessagesCard removed — HTML elements no longer exist

async function loadHomeNotifCard() {
  try {
    const sub = document.getElementById('home-notif-sub');
    const badge = document.getElementById('home-notif-badge');
    // Count new bubble members since last 7 days
    const since = new Date(Date.now() - 7*24*60*60*1000).toISOString();
    const { data: memberships } = await sb.from('bubble_members').select('bubble_id').eq('user_id', currentUser.id);
    if (!memberships || memberships.length === 0) {
      if (sub) sub.textContent = 'Ingen notifikationer';
      return;
    }
    const ids = memberships.map(m => m.bubble_id);
    const { count } = await sb.from('bubble_members')
      .select('*', {count:'exact',head:true})
      .in('bubble_id', ids).neq('user_id', currentUser.id).gte('joined_at', since);
    const n = count || 0;
    if (sub) sub.textContent = n > 0 ? `${n} nye i dine bobler` : 'Ingen nye notifikationer';
    if (badge) { badge.textContent = n; badge.style.display = n > 0 ? 'flex' : 'none'; }
  } catch(e) { logError("loadHomeNotifCard", e); showToast(e.message || "Ukendt fejl"); }
}

async function loadMyBubbles() {
  try {
    const ownedList  = document.getElementById('my-owned-bubbles-list');
    const joinedList = document.getElementById('my-bubbles-list');
    ownedList.innerHTML  = '<div class="spinner"></div>';
    joinedList.innerHTML = '<div class="spinner"></div>';

    const { data: memberships } = await sb.from('bubble_members')
      .select('bubble_id').eq('user_id', currentUser.id);

    if (!memberships || memberships.length === 0) {
      ownedList.innerHTML  = '';
      joinedList.innerHTML = '<div class="empty-state" style="padding:2rem 0"><div class="empty-icon">' + icon('bubble') + '</div><div class="empty-text">Du er ikke i nogen bobler endnu</div><div style="margin-top:1rem"><button class="btn-primary" onclick="goTo(\'screen-discover\');loadDiscover()" style="font-size:0.82rem;padding:0.6rem 1.5rem">Udforsk bobler →</button></div><div style="margin-top:0.5rem"><button class="btn-secondary" onclick="openCreateBubble()" style="font-size:0.78rem;padding:0.5rem 1.2rem">+ Opret en boble</button></div></div>';
      return;
    }

    const ids = memberships.map(m => m.bubble_id);
    const { data: bubbles } = await sb.from('bubbles').select('*').in('id', ids);
    if (!bubbles || bubbles.length === 0) {
      ownedList.innerHTML = joinedList.innerHTML = '';
      return;
    }

    const owned  = bubbles.filter(b => b.created_by === currentUser.id);
    const joined = bubbles.filter(b => b.created_by !== currentUser.id);

    // Owned bubbles — show with visibility badge + edit shortcut
    if (owned.length === 0) {
      ownedList.innerHTML = '<div class="sub-muted" style="padding:0.5rem 0">Du har ikke oprettet nogen bobler endnu.</div>';
    } else {
      ownedList.innerHTML = owned.map(b => {
        const visIcon = b.visibility === 'private' ? icon('lock') : b.visibility === 'hidden' ? icon('eye') : icon('globe');
        return `<div class="card flex-row-center" data-action="openBubble" data-id="${b.id}">
          <div class="bubble-icon" style="background:${bubbleColor(b.type, 0.15)}">${bubbleEmoji(b.type)}</div>
          <div style="flex:1">
            <div class="fw-600 fs-09">${escHtml(b.name)}</div>
            <div class="fs-075 text-muted">${visIcon} ${b.type_label||b.type}${b.location ? ' · '+escHtml(b.location) : ''}</div>
          </div>
          <div style="display:flex;gap:0.4rem;align-items:center">
            <button class="btn-sm btn-ghost" data-action="openEditBubble" data-id="${b.id}" onclick="event.stopPropagation()" style="font-size:0.8rem;padding:0.3rem 0.5rem">${icon("edit")}</button>
            <div class="live-dot"></div>
          </div>
        </div>`;
      }).join('');
    }

    // Joined bubbles
    if (joined.length === 0) {
      joinedList.innerHTML = '<div class="sub-muted" style="padding:0.5rem 0">Du er ikke medlem af andres bobler endnu.</div>';
    } else {
      joinedList.innerHTML = joined.map(b => bubbleCard(b, true)).join('');
    }

    // Profile bubbles
    document.getElementById('profile-bubbles').innerHTML = bubbles.map(b =>
      `<div class="card flex-row-center" data-action="openBubble" data-id="${b.id}" style="padding:0.85rem 1.1rem">
        <div class="bubble-icon" style="background:${bubbleColor(b.type, 0.15)};flex-shrink:0">${bubbleEmoji(b.type)}</div>
        <div style="flex:1;min-width:0">
          <div class="fw-600 fs-09">${escHtml(b.name)}</div>
          <div class="fs-075 text-muted">${b.created_by === currentUser.id ? icon('crown') + ' Ejer' : 'Aktiv'}${b.location ? ' · ' + escHtml(b.location) : ''}</div>
        </div>
        <div class="icon-muted">›</div>
      </div>`).join('');
  } catch(e) { logError("loadMyBubbles", e); showToast(e.message || "Ukendt fejl"); }
}

async function updateRadarCount() {
  try {
    const { data: memberships } = await sb.from('bubble_members').select('bubble_id').eq('user_id', currentUser.id);
    const rcEl = document.getElementById('radar-count-home');
    if (!memberships || memberships.length === 0) {
      if (rcEl) rcEl.textContent = ' · Join en boble for at se matches';
      return;
    }
    const ids = memberships.map(m => m.bubble_id);
    const { count } = await sb.from('bubble_members').select('*', {count:'exact',head:true}).in('bubble_id', ids).neq('user_id', currentUser.id);
    if (rcEl) rcEl.textContent = ` · ${count || 0} profiler synlige i dine bobler`;
  } catch(e) { logError("updateRadarCount", e); showToast(e.message || "Ukendt fejl"); }
}

function bubbleCard(b, joined) {
  var ups = b.upvote_count || bubbleUpvotes[b.id] || 0;
  var upLabel = ups > 0 ? `<div class="fs-065" style="color:var(--accent);display:flex;align-items:center;gap:0.15rem">${icon('rocket')}<span style="font-weight:700">${ups}</span></div>` : '';
  return `<div class="card flex-row-center" data-action="openBubble" data-id="${b.id}">
    <div class="bubble-icon" style="background:${bubbleColor(b.type, 0.15)}">${bubbleIcon(b.type)}</div>
    <div style="flex:1">
      <div class="fw-600 fs-09">${escHtml(b.name)}</div>
      <div class="fs-075 text-muted">${escHtml(b.type_label || b.type)} ${b.location ? '· ' + escHtml(b.location) : ''}</div>
    </div>
    <div class="flex-col-end" style="align-items:flex-end;gap:0.15rem">
      <div class="fw-700">${b.member_count || ''}</div>
      ${upLabel}
      ${joined ? '<div class="live-dot"></div>' : '<div class="fs-09" style="color:var(--accent)">+</div>'}
    </div>
  </div>`;
}

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
    const list = document.getElementById('all-bubbles-list');
    list.innerHTML = '<div class="spinner"></div>';
    await loadBubbleUpvotes();
    const { data: bubbles } = await sb.from('bubbles').select('*, bubble_members(count)').or('visibility.eq.public,visibility.eq.private,visibility.is.null').order('created_at', {ascending:false});
    allBubbles = (bubbles || []).filter(b => b.type !== 'live').map(b => ({
      ...b,
      member_count: b.bubble_members?.[0]?.count || 0,
      type_label: typeLabel(b.type),
      upvote_count: bubbleUpvotes[b.id] || 0
    }));
    // Sort: upvotes first, then member count, then date
    allBubbles.sort(function(a, b) {
      if (b.upvote_count !== a.upvote_count) return b.upvote_count - a.upvote_count;
      if (b.member_count !== a.member_count) return b.member_count - a.member_count;
      return new Date(b.created_at) - new Date(a.created_at);
    });
    renderBubbleList(allBubbles);
  } catch(e) { logError("loadDiscover", e); showToast(e.message || "Ukendt fejl"); }
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
    renderBubbleList(filtered);
  }, 150);
}

// ══════════════════════════════════════════════════════════
//  BUBBLE DETAIL
// ══════════════════════════════════════════════════════════
async function openBubble(bubbleId, fromScreen) {
  try {
    // Kald openBubbleChat direkte — detail-siden er nu integreret i chat-skærmen
    await openBubbleChat(bubbleId, fromScreen);
  } catch(e) { logError("openBubble", e); showToast(e.message || "Ukendt fejl"); }
}

// loadBubbleMembers removed — integrated into screen-bubble-chat bcLoadMembers

async function joinBubble(bubbleId) {
  try {
    const { error } = await sb.from('bubble_members').insert({ bubble_id: bubbleId, user_id: currentUser.id });
    if (error && !String(error.message || '').includes('duplicate')) return showToast('Fejl ved joining');
    showToast('Du er nu i boblen! 🫧');
    await openBubble(bubbleId);
    loadHome();
  } catch(e) { logError("joinBubble", e); showToast(e.message || "Ukendt fejl"); }
}

async function leaveBubble(bubbleId) {
  // Show confirmation first
  if (!_leaveBubbleConfirmed) {
    _leaveBubbleConfirmed = bubbleId;
    showToast('Tryk igen for at bekræfte');
    setTimeout(function() { _leaveBubbleConfirmed = null; }, 3000);
    return;
  }
  _leaveBubbleConfirmed = null;
  try {
    await sb.from('bubble_members').delete().eq('bubble_id', bubbleId).eq('user_id', currentUser.id);
    showToast('Du har forladt boblen');
    goTo('screen-home');
  } catch(e) { logError("leaveBubble", e); showToast(e.message || "Ukendt fejl"); }
}

// ══════════════════════════════════════════════════════════
//  PERSON PROFILE
// ══════════════════════════════════════════════════════════
async function openPerson(userId, fromScreen) {
  try {
    currentPerson = userId;
    const backBtn = document.getElementById('person-back-btn');
    backBtn.onclick = () => goTo(fromScreen || 'screen-home');
    goTo('screen-person');

    const { data: p } = await sb.from('profiles').select('*').eq('id', userId).single();
    if (!p) return;

    const initials = p.is_anon ? '?' : (p.name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    var personAvEl = document.getElementById('person-avatar');
    if (personAvEl) {
      if (p.avatar_url && !p.is_anon) { personAvEl.innerHTML = '<img src="'+p.avatar_url+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%">'; }
      else { personAvEl.textContent = initials; personAvEl.innerHTML = initials; }
    }
    document.getElementById('person-name').textContent = p.is_anon ? 'Anonym bruger' : (p.name || '?');
    document.getElementById('person-role').textContent = p.is_anon ? '' : ((p.title || '') + (p.workplace ? ' · ' + p.workplace : ''));

    // Check live presence
    var personLiveEl = document.getElementById('person-live-badge');
    if (personLiveEl) {
      var expCut = new Date(Date.now() - LIVE_EXPIRE_HOURS * 3600000).toISOString();
      var { data: pLive } = await sb.from('bubble_members')
        .select('checked_in_at, bubbles(name)')
        .eq('user_id', userId)
        .not('checked_in_at', 'is', null)
        .is('checked_out_at', null)
        .gte('checked_in_at', expCut)
        .order('checked_in_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (pLive) {
        personLiveEl.innerHTML = '<span class="live-badge-mini">LIVE</span> ' + escHtml(pLive.bubbles?.name || '');
        personLiveEl.style.display = 'block';
      } else {
        personLiveEl.style.display = 'none';
      }
    }

    const myKw = (currentProfile?.keywords || []).map(k => k.toLowerCase());
    const theirKw = (p.keywords || []).map(k => k.toLowerCase());
    const overlap = myKw.filter(k => theirKw.includes(k));
    // Smart match score (v2)
    const { data: sharedBubs } = await sb.from('bubble_members').select('bubble_id').eq('user_id', currentUser.id);
    var myBIds = (sharedBubs || []).map(b => b.bubble_id);
    var sharedCount = 0;
    if (myBIds.length > 0) {
      var { count: sc } = await sb.from('bubble_members').select('*',{count:'exact',head:true}).eq('user_id', userId).in('bubble_id', myBIds);
      sharedCount = sc || 0;
    }
    const score = calcMatchScore(currentProfile || {}, p, sharedCount);
    document.getElementById('person-match-label').textContent = `Match: ${score}%`;

    document.getElementById('person-tags').innerHTML = (p.keywords||[]).map(k => `<span class="tag">${escHtml(k)}</span>`).join('');
    document.getElementById('person-bio').textContent = p.bio || '';
    var bioSection = document.getElementById('person-bio-section');
    if (bioSection) bioSection.style.display = p.bio ? 'block' : 'none';

    // LinkedIn button
    const liBtn = document.getElementById('person-linkedin-btn');
    if (p.linkedin && !p.is_anon) {
      liBtn.style.display = 'flex';
      liBtn.style.flexDirection = 'column';
      liBtn.href = p.linkedin.startsWith('http') ? p.linkedin : 'https://' + p.linkedin;
    } else {
      liBtn.style.display = 'none';
    }

    const overlapEl = document.getElementById('person-overlap');
    if (overlap.length) {
      overlapEl.innerHTML = overlap.map(k => `<span class="tag mint">${icon("check")} ${escHtml(k)}</span>`).join('');
    } else {
      overlapEl.innerHTML = '<span class="fs-085 text-muted">Ingen direkte overlap fundet</span>';
    }

    const dynEl = document.getElementById('person-dynamic-keywords');
    if ((p.dynamic_keywords||[]).length) {
      dynEl.innerHTML = '<div class="section-label">Søger nu</div>' + p.dynamic_keywords.map(k => `<span class="tag gold">${icon("fire")} ${escHtml(k)}</span>`).join('');
    } else { dynEl.innerHTML = ''; }

    // Check if saved
    const { data: savedCheck } = await sb.from('saved_contacts').select('id').eq('user_id', currentUser.id).eq('contact_id', userId).maybeSingle();
    document.getElementById('save-btn').innerHTML = savedCheck ? icon('checkCircle') + '<span>Gemt</span>' : icon('bookmark') + '<span>Gem</span>';
    // Star rating section (only for saved contacts)
    var starSection = document.getElementById('person-star-section');
    var starRatingEl = document.getElementById('person-star-rating');
    if (starSection && starRatingEl) {
      if (savedCheck) {
        starSection.style.display = 'block';
        var r = starGet(userId);
        starRatingEl.innerHTML = [1,2,3].map(function(n) {
          return '<div class="ps-star ' + (n <= r ? 'filled' : 'empty') + '" onclick="personSetStar(\'' + userId + '\',' + n + ')">\u2605</div>';
        }).join('');
      } else {
        starSection.style.display = 'none';
      }
    }
    // Tags section
    var tagsSection = document.getElementById('person-tags-section');
    if (tagsSection) tagsSection.style.display = (p.keywords||[]).length ? 'block' : 'none';
  } catch(e) { logError("openPerson", e); showToast(e.message || "Ukendt fejl"); }
}

async function saveContact() {
  try {
    if (!currentPerson) return;
    const { data: existing } = await sb.from('saved_contacts').select('id').eq('user_id', currentUser.id).eq('contact_id', currentPerson).maybeSingle();
    if (existing) { showToast('Allerede gemt'); return; }
    await sb.from('saved_contacts').insert({ user_id: currentUser.id, contact_id: currentPerson });
    document.getElementById('save-btn').innerHTML = icon('checkCircle') + '<span>Gemt</span>';
    showToast('Kontakt gemt!');
    loadSavedContacts();
  } catch(e) { logError("saveContact", e); showToast(e.message || "Ukendt fejl"); }
}

let pendingRemoveSavedId = null;
let pendingRemoveBtn = null;

function removeSavedContact(savedId, btn) {
  pendingRemoveSavedId = savedId;
  pendingRemoveBtn = btn;
  // Show inline confirm on the card
  const card = btn.closest('.card');
  if (!card) return;
  // Prevent double-confirm
  if (card.querySelector('.remove-confirm')) return;
  const confirm = document.createElement('div');
  confirm.className = 'remove-confirm';
  confirm.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:0.5rem 0.6rem;margin-top:0.4rem;background:rgba(232,93,138,0.08);border:1px solid rgba(232,93,138,0.2);border-radius:10px;gap:0.5rem';
  confirm.onclick = function(e) { e.stopPropagation(); };
  confirm.innerHTML = `<span style="font-size:0.72rem;color:var(--text-secondary)">Fjern kontakt?</span>
    <div style="display:flex;gap:0.3rem">
      <button class="btn-sm btn-ghost" style="padding:0.25rem 0.6rem;font-size:0.7rem;color:var(--accent2);border-color:rgba(232,93,138,0.3)" onclick="event.stopPropagation();confirmRemoveSaved()">Fjern</button>
      <button class="btn-sm btn-ghost" style="padding:0.25rem 0.6rem;font-size:0.7rem" onclick="cancelRemoveSaved(this)">Annuller</button>
    </div>`;
  card.appendChild(confirm);
}

function cancelRemoveSaved(btn) {
  event.stopPropagation();
  var confirm = btn.closest('.remove-confirm');
  if (confirm) confirm.remove();
  pendingRemoveSavedId = null;
  pendingRemoveBtn = null;
}

async function confirmRemoveSaved() {
  if (!pendingRemoveSavedId) return;
  const savedId = pendingRemoveSavedId;
  const btn = pendingRemoveBtn;
  pendingRemoveSavedId = null;
  pendingRemoveBtn = null;
  try {
    await sb.from('saved_contacts').delete().eq('id', savedId);
    const card = btn?.closest('.card');
    if (card) {
      card.style.transition = 'opacity 0.25s, transform 0.25s';
      card.style.opacity = '0';
      card.style.transform = 'translateX(20px)';
      setTimeout(() => loadSavedContacts(), 260);
    } else {
      loadSavedContacts();
    }
    showToast('Kontakt fjernet');
  } catch(e) { logError("confirmRemoveSaved", e); showToast(e.message || "Ukendt fejl"); }
}

// proposeMeeting / sendMeetingProposal removed — feature shelved


// PROXIMITY MAP / RADAR
var proxVisible = true;
var proxRange = 5;
var proxAllProfiles = [];
var proxColors = ['linear-gradient(135deg,#8B7FFF,#A89FFF)','linear-gradient(135deg,#E85D8A,#FF8C69)','linear-gradient(135deg,#2ECFCF,#8B7FFF)','linear-gradient(135deg,#FF8C69,#E85D8A)','linear-gradient(135deg,#065F46,#10B981)','linear-gradient(135deg,#1E3A8A,#7C3AED)','linear-gradient(135deg,#0C4A6E,#38BDF8)'];
// Radar (map): relevance labels + thresholds — "who matches me?"
var proxRangeLabels = ['Nær match','Gode matches','Alle matches','Udvidet','Alle'];
var proxThresholds  = [0.6, 0.35, 0.15, 0.05, 0];
// List: proximity labels — "who is nearby?" (GPS-ready, simulated for now)
var listRangeLabels = ['50m','200m','500m','2km','10km'];

async function loadProximityMap() {
  try {
    var map = document.getElementById('proximity-map');
    var emptyEl = document.getElementById('prox-empty');
    var canvas = document.getElementById('prox-canvas');
    if (!map || !canvas) return;
    var r1 = await sb.from('profiles').select('id,name,title,keywords,dynamic_keywords,bio,linkedin,is_anon,avatar_url').neq('id', currentUser.id).limit(200);
    var allProfiles = r1.data;
    if (!allProfiles || allProfiles.length === 0) { map.style.display = 'none'; if (emptyEl) emptyEl.style.display = 'block'; return; }
    map.style.display = 'block'; if (emptyEl) emptyEl.style.display = 'none';

    // Exclude saved contacts — they've already been "discovered"
    var savedRes = await sb.from('saved_contacts').select('contact_id').eq('user_id', currentUser.id);
    var savedIds = (savedRes.data || []).map(function(s) { return s.contact_id; });
    allProfiles = allProfiles.filter(function(p) { return savedIds.indexOf(p.id) < 0 && !isBlocked(p.id); });

    if (allProfiles.length === 0) { map.style.display = 'none'; if (emptyEl) { emptyEl.innerHTML = 'Alle profiler er gemt!<br>Du har opdaget alle i nærheden.'; emptyEl.style.display = 'block'; } return; }

    // Build tag popularity index for TF-IDF
    buildTagPopularity(allProfiles);

    // Get shared bubbles
    var r2 = await sb.from('bubble_members').select('bubble_id').eq('user_id', currentUser.id);
    var myBubbleIds = (r2.data || []).map(function(m){ return m.bubble_id; });
    var bmMap = {};
    if (myBubbleIds.length > 0) {
      var r3 = await sb.from('bubble_members').select('user_id,bubble_id').in('bubble_id', myBubbleIds);
      (r3.data || []).forEach(function(bm) { if (!bmMap[bm.user_id]) bmMap[bm.user_id] = []; bmMap[bm.user_id].push(bm.bubble_id); });
    }

    // Calculate match scores using smart algorithm
    proxAllProfiles = allProfiles.map(function(p) {
      var sharedBubbles = (bmMap[p.id] || []).length;
      var matchScore = calcMatchScore(currentProfile || {}, p, sharedBubbles);
      var relevance = matchScore / 100;
      return { id:p.id, name:p.name, title:p.title, keywords:p.keywords, dynamic_keywords:p.dynamic_keywords, is_anon:p.is_anon, bio:p.bio, linkedin:p.linkedin, relevance:relevance, matchScore:matchScore, sharedBubbles:sharedBubbles };
    }).sort(function(a,b){ return b.matchScore - a.matchScore; });

    matchPage = 0; // Reset pagination
    renderProximityDots();
  } catch (e) { logError('loadProximityMap', e); }
}

// ── RADAR MAP VIEW ──
// Shows only visible (non-anon) profiles, filtered by relevance threshold
function renderProximityDots() {
  var map = document.getElementById('proximity-map');
  var av = document.getElementById('prox-avatars');
  var canvas = document.getElementById('prox-canvas');
  var emptyEl = document.getElementById('prox-empty');
  if (!map || !av || !canvas) return;

  var threshold = proxThresholds[proxRange-1] || 0;
  var allFil = proxAllProfiles.filter(function(p) { return !p.is_anon && p.relevance >= threshold; });

  // Smart cap: show MATCH_CAP profiles per page, paginated
  var start = matchPage * MATCH_CAP;
  var fil = allFil.slice(start, start + MATCH_CAP);
  var totalAvailable = allFil.length;

  // Update counter with pagination info
  var countEl = document.getElementById('radar-count-home');
  if (countEl) countEl.textContent = ' · ' + Math.min(totalAvailable, MATCH_CAP) + ' af ' + totalAvailable;

  // Show/hide "vis flere" button
  var moreBtn = document.getElementById('radar-show-more');
  if (moreBtn) moreBtn.style.display = totalAvailable > MATCH_CAP ? 'flex' : 'none';

  if (fil.length === 0) { av.innerHTML = ''; drawProxRings(canvas); if (emptyEl) emptyEl.style.display = 'block'; return; }
  if (emptyEl) emptyEl.style.display = 'none';
  drawProxRings(canvas);

  var ce = document.getElementById('prox-center');
  if (ce && currentProfile && currentProfile.name) {
    ce.textContent = currentProfile.name.split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();
  }

  var w = map.offsetWidth || 300, h = map.offsetHeight || w, cx = w/2, cy = h/2;
  var maxR = Math.min(cx, cy) - 24;
  var out = '';

  // Collision avoidance
  var placed = [];
  function findSafe(ix, iy, sz) {
    var hs = sz/2, tx = ix, ty = iy;
    for (var a = 0; a < 12; a++) {
      var hit = false;
      for (var j = 0; j < placed.length; j++) {
        var dx = (tx+hs)-(placed[j].x+placed[j].s/2), dy = (ty+hs)-(placed[j].y+placed[j].s/2);
        if (Math.sqrt(dx*dx+dy*dy) < (hs+placed[j].s/2)+3) { hit = true; break; }
      }
      if (!hit) return {x:tx, y:ty};
      var na = Math.atan2(ty+hs-cy, tx+hs-cx) + a*0.5;
      tx = ix + Math.cos(na)*(8+a*5); ty = iy + Math.sin(na)*(8+a*5);
    }
    return {x:tx, y:ty};
  }

  for (var i = 0; i < fil.length; i++) {
    var p = fil[i];
    var ini = (p.name||'?').split(' ').map(function(x){return x[0];}).join('').slice(0,2).toUpperCase();
    var col = proxColors[i % proxColors.length];
    // Match-based positioning: profiles live OUTSIDE center (your avatar)
    // 100% match = just outside center (r=0.12), 0% match = edge (r=0.88)
    var matchPct = p.matchScore || Math.round(p.relevance * 100);
    var minDist = 0.14; // Start just outside center avatar
    var maxDist = 0.88; // Edge
    var dist = minDist + (1 - matchPct / 100) * (maxDist - minDist);
    var r = dist * maxR;
    var ang = (i * 2.399) + (matchPct * 0.03); // Golden angle spread + slight match-based offset
    var ix = cx + Math.cos(ang)*r - 17, iy = cy + Math.sin(ang)*r - 17;
    var sz = matchPct >= 70 ? 38 : matchPct >= 40 ? 34 : 30; // Bigger dots for better matches
    var pos = findSafe(ix, iy, sz);
    placed.push({x:pos.x, y:pos.y, s:sz});
    var op = (0.5 + (matchPct / 100) * 0.5).toFixed(2); // More opaque for better matches
    out += '<div class="prox-dot" style="width:'+sz+'px;height:'+sz+'px;left:'+pos.x.toFixed(1)+'px;top:'+pos.y.toFixed(1)+'px;background:'+col+';opacity:'+op+';font-size:'+(sz<34?'0.48':'0.55')+'rem" onclick="openRadarPerson(\''+p.id+'\')" data-id="'+p.id+'">'+escHtml(ini)+'</div>';
  }
  av.innerHTML = out;
}


function radarShowMore() {
  var allFil = proxAllProfiles.filter(function(p) { return !p.is_anon; });
  var maxPages = Math.ceil(allFil.length / MATCH_CAP);
  matchPage = (matchPage + 1) % maxPages;
  renderProximityDots();
  showToast('Side ' + (matchPage + 1) + ' af ' + maxPages);
}

function drawProxRings(canvas) {
  if (!canvas) return;
  var par = canvas.parentElement; if (!par) return;
  var w = par.offsetWidth || 300, h = w;
  canvas.width = w*2; canvas.height = h*2; canvas.style.width = w+'px'; canvas.style.height = h+'px';
  var ctx = canvas.getContext('2d'); ctx.scale(2,2); ctx.clearRect(0,0,w,h);
  var cx = w/2, cy = h/2, maxR = Math.min(cx, cy);

  // Dartboard: center avatar (you) + 5 match rings around it
  // Center: your avatar (r=0.10)
  // Ring 1: 80-100% match (closest to you)
  // Ring 2: 60-80%
  // Ring 3: 40-60%
  // Ring 4: 20-40%
  // Ring 5: 0-20% (outer edge)
  var centerR = 0.10; // Your avatar zone
  var zones = [
    { r: centerR, fill: 'rgba(139,127,255,0.15)' },   // YOU — center
    { r: 0.26, fill: 'rgba(139,127,255,0.08)' },       // 80-100% — inner purple
    { r: 0.42, fill: 'rgba(16,185,129,0.05)' },        // 60-80% — green
    { r: 0.58, fill: 'rgba(46,207,207,0.04)' },        // 40-60% — teal
    { r: 0.74, fill: 'rgba(232,93,138,0.03)' },        // 20-40% — pink
    { r: 0.90, fill: 'rgba(255,255,255,0.02)' },       // 0-20% — faint
  ];
  // Draw filled zones from outside in so inner overlaps
  for (var i = zones.length - 1; i >= 0; i--) {
    ctx.beginPath();
    ctx.arc(cx, cy, zones[i].r * maxR, 0, Math.PI * 2);
    ctx.fillStyle = zones[i].fill;
    ctx.fill();
  }
  // Draw ring borders
  for (var i = 0; i < zones.length; i++) {
    ctx.beginPath();
    ctx.arc(cx, cy, zones[i].r * maxR, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  // Subtle center glow
  var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, zones[0].r * maxR);
  g.addColorStop(0, 'rgba(139,127,255,0.08)');
  g.addColorStop(1, 'rgba(139,127,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, zones[0].r * maxR, 0, Math.PI * 2);
  ctx.fill();
}

function updateProximityRange(val) {
  proxRange = parseInt(val);
  var el = document.getElementById('prox-range-label');
  if (radarCurrentView === 'map') {
    var threshold = proxThresholds[proxRange-1] || 0;
    var count = proxAllProfiles.filter(function(p) { return !p.is_anon && p.relevance >= threshold; }).length;
    if (el) el.textContent = count + (count === 1 ? ' person' : ' personer') + ' · ' + (proxRangeLabels[proxRange-1]||'');
    renderProximityDots();
  } else {
    var maxN = [5,10,20,35,50][proxRange-1] || 50;
    var count2 = Math.min(proxAllProfiles.length, maxN);
    if (el) el.textContent = count2 + (count2 === 1 ? ' person' : ' personer') + ' · ' + (listRangeLabels[proxRange-1]||'');
    renderRadarList();
  }
}

function toggleProximityVisibility() {
  proxVisible = !proxVisible;
  var btn = document.getElementById('prox-toggle');
  var d = document.getElementById('prox-toggle-dot');
  var l = document.getElementById('prox-toggle-label');
  var c = document.getElementById('prox-center');
  if (d) d.style.background = proxVisible ? '#10B981' : 'var(--muted)';
  if (l) l.textContent = proxVisible ? 'Synlig' : 'Skjult';
  // Restyle the whole button for clear on/off state
  if (btn) {
    if (proxVisible) {
      btn.style.background = 'rgba(16,185,129,0.12)';
      btn.style.borderColor = 'rgba(16,185,129,0.3)';
      btn.style.color = '#10B981';
    } else {
      btn.style.background = 'rgba(255,255,255,0.04)';
      btn.style.borderColor = 'rgba(255,255,255,0.08)';
      btn.style.color = 'var(--muted)';
    }
  }
  if (c) { if (proxVisible && currentProfile && currentProfile.name) { c.textContent = currentProfile.name.split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase(); c.style.background = 'var(--gradient-primary)'; } else { c.textContent = '?'; c.style.background = 'rgba(255,255,255,0.08)'; } }
  var hint = document.getElementById('prox-toggle-hint');
  if (hint) hint.textContent = proxVisible ? 'Andre kan se dig på radar' : 'Du er usynlig på radar';
  toggleAnon();
}

function openRadarSheet() {
  var overlay = document.getElementById('radar-overlay');
  var sheet = document.getElementById('radar-sheet');
  if (overlay) overlay.classList.add('open');
  if (sheet) sheet.classList.add('open');
  document.body.style.overflow = 'hidden';
  // Set initial toggle state visuals
  var btn = document.getElementById('prox-toggle');
  var d = document.getElementById('prox-toggle-dot');
  var l = document.getElementById('prox-toggle-label');
  if (d) d.style.background = proxVisible ? '#10B981' : 'var(--muted)';
  if (l) l.textContent = proxVisible ? 'Synlig' : 'Skjult';
  if (btn) {
    if (proxVisible) {
      btn.style.background = 'rgba(16,185,129,0.12)';
      btn.style.borderColor = 'rgba(16,185,129,0.3)';
      btn.style.color = '#10B981';
    } else {
      btn.style.background = 'rgba(255,255,255,0.04)';
      btn.style.borderColor = 'rgba(255,255,255,0.08)';
      btn.style.color = 'var(--muted)';
    }
  }
  // Show loading state then render
  var loadingEl = document.getElementById('prox-empty');
  if (loadingEl) { loadingEl.style.display = 'block'; loadingEl.textContent = 'Finder relevante personer…'; }
  setTimeout(function(){
    if (loadingEl) loadingEl.style.display = 'none';
    if (radarCurrentView === 'map') renderProximityDots(); else renderRadarList();
  }, 120);
  initSwipeClose(sheet, closeRadarSheet);
}

function closeRadarSheet() {
  document.body.style.overflow = '';
  var sheet = document.getElementById('radar-sheet');
  if (sheet) { sheet.style.transform = ''; sheet.classList.remove('open'); }
  var overlay = document.getElementById('radar-overlay');
  if (overlay) overlay.classList.remove('open');
}

// ── Universal swipe-down-to-close for sheets/modals ──
function initSwipeClose(sheetEl, closeFn) {
  if (isDesktop || !sheetEl || sheetEl._swipeInit) return;
  sheetEl._swipeInit = true;
  var startY = 0, currentY = 0, dragging = false;

  sheetEl.addEventListener('touchstart', function(e) {
    var touchY = e.touches[0].clientY;
    var rect = sheetEl.getBoundingClientRect();
    var inHandle = (touchY - rect.top) < 44;

    // Check if any scrollable child has scroll position > 0
    var scrollEls = sheetEl.querySelectorAll('[style*="overflow"], .scroll-area, .chat-messages, .chat-scroll, .chat-info-list, .chat-members-list');
    var anyScrolled = false;
    scrollEls.forEach(function(el) {
      if (el.scrollTop > 5) anyScrolled = true;
    });

    // Only allow drag from the handle — never from scrollable content
    if (inHandle && !anyScrolled) {
      startY = e.touches[0].clientY;
      currentY = 0;
      dragging = true;
      sheetEl.style.transition = 'none';
    }
  }, {passive: true});

  sheetEl.addEventListener('touchmove', function(e) {
    if (!dragging) return;
    currentY = e.touches[0].clientY - startY;
    if (currentY < 0) currentY = 0;
    if (currentY > 12) {
      sheetEl.style.transform = 'translateY(' + currentY + 'px)';
    }
  }, {passive: true});

  sheetEl.addEventListener('touchend', function() {
    if (!dragging) return;
    dragging = false;
    sheetEl.style.transition = '';
    if (currentY > 100) {
      closeFn();
    } else {
      sheetEl.style.transform = '';
    }
    currentY = 0;
  });
}

// Init swipe-close on all sheets/modals when they open
function initAllSwipeClose() {
  // Person sheet
  var ps = document.getElementById('person-sheet-el');
  if (ps) initSwipeClose(ps, psClose);
  // Radar person sheet
  var rps = document.getElementById('radar-person-sheet');
  if (rps) initSwipeClose(rps, closeRadarPerson);
  // GIF picker
  var gif = document.getElementById('gif-picker');
  if (gif) initSwipeClose(gif, closeGifPicker);
  // Invite sheet
  var inv = document.getElementById('invite-sheet');
  if (inv) initSwipeClose(inv, closeInviteModal);
  // Modals
  ['modal-edit-profile','modal-create-bubble','modal-edit-bubble','modal-qr','modal-edit-history','modal-live-checkin'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) {
      var sheetInner = el.querySelector('.modal-sheet');
      if (sheetInner) initSwipeClose(sheetInner, function() { closeModal(id); });
    }
  });
}

// ══════════════════════════════════════════════════════════
//  RADAR: VIEW TOGGLE (KORT / LISTE)
// ══════════════════════════════════════════════════════════
var radarCurrentView = 'map';

function radarSwitchView(view) {
  radarCurrentView = view;
  document.getElementById('radar-btn-map').classList.toggle('active', view === 'map');
  document.getElementById('radar-btn-list').classList.toggle('active', view === 'list');
  document.getElementById('radar-view-map').style.display = view === 'map' ? 'block' : 'none';
  document.getElementById('radar-view-list').style.display = view === 'list' ? 'block' : 'none';
  document.getElementById('radar-map-controls').style.display = 'flex';
  // Update range label for the new view
  updateProximityRange(proxRange);
}

// ══════════════════════════════════════════════════════════
//  LIST VIEW — "Who is nearby?" (all profiles, proximity)
// ══════════════════════════════════════════════════════════
var radarDismissed = [];
var radarPendingRemove = null;

function renderRadarList() {
  var el = document.getElementById('radar-list-content');
  var emptyEl = document.getElementById('prox-empty');
  if (!el) return;

  var maxN = [5,10,20,35,50][proxRange-1] || 50;
  var fil = proxAllProfiles.filter(function(p) { return radarDismissed.indexOf(p.id) < 0; }).slice(0, maxN);

  if (fil.length === 0) {
    el.innerHTML = '<div style="text-align:center;padding:2rem 0;font-size:0.78rem;color:var(--muted)">Ingen profiler i n\u00e6rheden' +
      (radarDismissed.length > 0 ? '<br><button class="btn-sm btn-ghost" onclick="radarResetDismissed()" style="margin-top:0.5rem;font-size:0.7rem">Vis alle igen</button>' : '') + '</div>';
    if (emptyEl) emptyEl.style.display = 'none';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';
  var myKw = (currentProfile && currentProfile.keywords ? currentProfile.keywords : []).map(function(k){ return k.toLowerCase(); });
  var colors = proxColors;

  el.innerHTML = fil.map(function(p, i) {
    var isA = p.is_anon;
    var name = isA ? 'Anonym bruger' : (p.name || '?');
    var ini = isA ? '?' : name.split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();
    var col = isA ? 'rgba(255,255,255,0.08)' : colors[i % colors.length];
    var bd = isA ? 'border:1px solid rgba(255,255,255,0.06);' : '';
    var theirKw = (p.keywords || []).map(function(k){ return k.toLowerCase(); });
    var overlap = myKw.filter(function(k){ return theirKw.indexOf(k) >= 0; });
    var matchPct = p.matchScore || Math.min(Math.round(p.relevance * 85 + 10), 99);
    var tags = (p.keywords || []).slice(0, 3).map(function(k){
      var isOv = overlap.indexOf(k.toLowerCase()) >= 0;
      return '<span class="tag' + (isOv ? ' mint' : '') + '" style="font-size:0.58rem;padding:0.15rem 0.4rem">' + escHtml(k) + '</span>';
    }).join('');
    var bubbleInfo = p.sharedBubbles > 0 ? '<span class="fs-065 text-muted">' + p.sharedBubbles + ' f\u00e6lles boble' + (p.sharedBubbles > 1 ? 'r' : '') + '</span>' : '';
    return '<div class="radar-list-card" data-uid="' + p.id + '" data-name="' + escHtml(name) + '" style="--card-delay:' + (i * 40) + 'ms">' +
      '<div class="flex-row-center" style="gap:0.7rem">' +
        '<div class="radar-list-avatar" style="background:' + col + ';' + bd + '" onclick="openRadarPerson(\'' + p.id + '\')">' + escHtml(ini) + '</div>' +
        '<div style="flex:1;min-width:0;cursor:pointer" onclick="openRadarPerson(\'' + p.id + '\')">' +
          '<div class="fw-600 fs-085" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escHtml(name) + '</div>' +
          (isA ? '' : '<div class="fs-072 text-muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escHtml(p.title || '') + '</div>') +
        '</div>' +
        (isA ? '' : '<div class="radar-list-match">' + matchPct + '%</div>') +
        '<button class="radar-list-remove" onclick="event.stopPropagation();radarConfirmRemove(\'' + p.id + '\',\'' + escHtml(name).replace(/'/g,'') + '\')" title="Fjern">' + icon('x') + '</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

function radarConfirmRemove(uid, name) {
  var card = document.querySelector('.radar-list-card[data-uid="' + uid + '"]');
  if (!card) return;
  if (card.querySelector('.remove-confirm')) return;
  radarPendingRemove = { uid: uid, name: name, card: card };
  var confirm = document.createElement('div');
  confirm.className = 'remove-confirm';
  confirm.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:0.5rem 0.6rem;margin-top:0.4rem;background:rgba(232,93,138,0.08);border:1px solid rgba(232,93,138,0.2);border-radius:10px;gap:0.5rem';
  confirm.innerHTML = '<span style="font-size:0.72rem;color:var(--text-secondary)">Fjern kontakt?</span>' +
    '<div style="display:flex;gap:0.3rem">' +
      '<button class="btn-sm btn-ghost" style="padding:0.25rem 0.6rem;font-size:0.7rem;color:var(--accent2);border-color:rgba(232,93,138,0.3)" onclick="event.stopPropagation();radarDoRemove()">Fjern</button>' +
      '<button class="btn-sm btn-ghost" style="padding:0.25rem 0.6rem;font-size:0.7rem" onclick="event.stopPropagation();radarCancelRemove()">Annuller</button>' +
    '</div>';
  card.appendChild(confirm);
}

function radarCancelRemove() {
  if (radarPendingRemove && radarPendingRemove.card) {
    var c = radarPendingRemove.card.querySelector('.remove-confirm');
    if (c) c.remove();
  }
  radarPendingRemove = null;
}

function radarDoRemove() {
  if (!radarPendingRemove) return;
  var uid = radarPendingRemove.uid;
  var name = radarPendingRemove.name;
  var card = radarPendingRemove.card;
  radarDismissed.push(uid);
  radarPendingRemove = null;
  if (card) {
    card.style.transition = 'opacity 0.25s, transform 0.25s';
    card.style.opacity = '0';
    card.style.transform = 'translateX(20px)';
    setTimeout(function() { renderRadarList(); }, 260);
  } else {
    renderRadarList();
  }
  showToast(name + ' fjernet');
}

function radarResetDismissed() { radarDismissed = []; renderRadarList(); }

// ══════════════════════════════════════════════════════════
//  RADAR: TOP-DROP PERSON SHEET
// ══════════════════════════════════════════════════════════
var rpCurrentUserId = null;
var _leaveBubbleConfirmed = null;

async function openRadarPerson(userId) {
  rpCurrentUserId = userId;
  try {
    var { data: p } = await sb.from('profiles').select('*').eq('id', userId).single();
    if (!p) return;
    var isA = p.is_anon;
    var name = isA ? 'Anonym bruger' : (p.name || '?');
    var ini = isA ? '?' : name.split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();
    var rpAvEl = document.getElementById('rp-avatar');
    if (rpAvEl) {
      if (p.avatar_url && !isA) { rpAvEl.innerHTML = '<img src="'+p.avatar_url+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%">'; rpAvEl.style.overflow = 'hidden'; }
      else { rpAvEl.textContent = ini; }
    }
    document.getElementById('rp-name').textContent = name;
    document.getElementById('rp-sub').textContent = isA ? '' : (p.title || '');
    // Check live presence
    var rpLiveEl = document.getElementById('rp-live-badge');
    if (rpLiveEl) {
      var expireCutoff = new Date(Date.now() - LIVE_EXPIRE_HOURS * 3600000).toISOString();
      var { data: liveCheck } = await sb.from('bubble_members')
        .select('checked_in_at, bubbles(name)')
        .eq('user_id', userId)
        .not('checked_in_at', 'is', null)
        .is('checked_out_at', null)
        .gte('checked_in_at', expireCutoff)
        .order('checked_in_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (liveCheck) {
        rpLiveEl.innerHTML = '<span class="live-badge-mini">LIVE</span> ' + escHtml(liveCheck.bubbles?.name || '');
        rpLiveEl.style.display = 'block';
      } else {
        rpLiveEl.style.display = 'none';
      }
    }
    var myKw = (currentProfile?.keywords || []).map(function(k){ return k.toLowerCase(); });
    var theirKw = (p.keywords || []).map(function(k){ return k.toLowerCase(); });
    var overlap = myKw.filter(function(k){ return theirKw.indexOf(k) >= 0; });
    // Use smart match from proxAllProfiles if available, otherwise calculate
    var proxData = proxAllProfiles.find(function(pp) { return pp.id === p.id; });
    var score = proxData ? proxData.matchScore : calcMatchScore(currentProfile || {}, p, 0);
    document.getElementById('rp-match').textContent = score + '%';
    document.getElementById('rp-bio').textContent = p.bio || '';
    document.getElementById('rp-bio').style.display = p.bio ? 'block' : 'none';
    document.getElementById('rp-tags').innerHTML = (p.keywords||[]).map(function(k){
      var isOv = overlap.indexOf(k.toLowerCase()) >= 0;
      return '<span class="tag' + (isOv ? ' mint' : '') + '">' + escHtml(k) + '</span>';
    }).join('');
    if (overlap.length > 0) {
      document.getElementById('rp-overlap').innerHTML = '<div style="font-size:0.68rem;color:var(--muted);margin-bottom:0.3rem;font-weight:600">F\u00e6lles interesser</div>' +
        overlap.map(function(k){ return '<span class="tag mint">' + icon('check') + ' ' + escHtml(k) + '</span>'; }).join('');
      document.getElementById('rp-overlap').style.display = 'block';
    } else { document.getElementById('rp-overlap').style.display = 'none'; }
    var liBtn = document.getElementById('rp-linkedin-btn');
    if (p.linkedin && !isA) { liBtn.style.display = 'inline-flex'; liBtn.href = p.linkedin.startsWith('http') ? p.linkedin : 'https://' + p.linkedin; }
    else { liBtn.style.display = 'none'; }
    var saveBtn = document.getElementById('rp-save-btn');
    var { data: savedCheck } = await sb.from('saved_contacts').select('id').eq('user_id', currentUser.id).eq('contact_id', userId).maybeSingle();
    saveBtn.textContent = savedCheck ? 'Gemt \u2713' : 'Gem';
    saveBtn.dataset.saved = savedCheck ? '1' : '0';
    document.getElementById('radar-person-overlay').classList.add('open');
    setTimeout(function(){ document.getElementById('radar-person-sheet').classList.add('open'); }, 10);
  } catch(e) { logError("openRadarPerson", e); showToast(e.message || "Ukendt fejl"); }
}

function closeRadarPerson() {
  document.getElementById('radar-person-sheet').classList.remove('open');
  setTimeout(function(){ document.getElementById('radar-person-overlay').classList.remove('open'); }, 320);
}
function rpMessage() { closeRadarPerson(); closeRadarSheet(); setTimeout(function(){ openChat(rpCurrentUserId, 'screen-home'); }, 400); }
async function rpSaveContact() {
  try {
    if (!rpCurrentUserId) return;
    var btn = document.getElementById('rp-save-btn');
    if (btn.dataset.saved === '1') { showToast('Allerede gemt'); return; }
    await sb.from('saved_contacts').insert({ user_id: currentUser.id, contact_id: rpCurrentUserId });
    btn.textContent = 'Gemt \u2713'; btn.dataset.saved = '1';
    showToast('Kontakt gemt!'); loadSavedContacts();
  } catch(e) { logError("rpSaveContact", e); showToast(e.message || "Ukendt fejl"); }
}
function rpFullProfile() {
  var uid = rpCurrentUserId; closeRadarPerson(); closeRadarSheet();
  setTimeout(function(){ openPerson(uid, 'screen-home'); }, 400);
}



// ══════════════════════════════════════════════════════════
//  MESSAGES
// ══════════════════════════════════════════════════════════
async function updateUnreadBadge() {
  try {
    const { count } = await sb.from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', currentUser.id)
      .is('read_at', null);
    document.querySelectorAll('.msg-unread-badge').forEach(b => {
      if (count && count > 0) {
        b.textContent = count > 9 ? '9+' : count;
        b.style.display = 'flex';
      } else {
        b.style.display = 'none';
      }
    });
  } catch(e) { logError("updateUnreadBadge", e); showToast(e.message || "Ukendt fejl"); }
}

let incomingSubscription = null;
function subscribeToIncoming() {
  if (incomingSubscription) { incomingSubscription.unsubscribe(); incomingSubscription = null; }
  incomingSubscription = sb.channel('incoming-messages')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages',
      filter: `receiver_id=eq.${currentUser.id}` }, () => {
      updateUnreadBadge();
    }).subscribe();
}

async function loadMessages() {
  try {
    const list = document.getElementById('conversations-list');
    list.innerHTML = '<div class="spinner"></div>';

    const { data: convs } = await sb.from('messages')
      .select('*')
      .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
      .order('created_at', {ascending:false})
      .limit(200);

    if (!convs || convs.length === 0) {
      list.innerHTML = '<div class="empty-state"><div class="empty-icon">' + icon('chat') + '</div><div class="empty-text">Ingen beskeder endnu</div><div style="margin-top:1rem"><button class="btn-primary" onclick="goTo(\'screen-home\')" style="font-size:0.82rem;padding:0.6rem 1.5rem">Find folk på radaren →</button></div></div>';
      return;
    }

    // Get unique conversation partners
    const seen = new Set();
    const partners = [];
    for (const m of convs) {
      const partnerId = m.sender_id === currentUser.id ? m.receiver_id : m.sender_id;
      if (!seen.has(partnerId) && !isBlocked(partnerId)) {
        seen.add(partnerId);
        partners.push({ partnerId, lastMsg: m });
      }
    }

    // Load partner profiles
    const pIds = partners.map(p => p.partnerId);
    const { data: profiles } = await sb.from('profiles').select('id,name,title,avatar_url').in('id', pIds);
    const profileMap = Object.fromEntries((profiles||[]).map(p=>[p.id,p]));

    list.innerHTML = partners.map(({ partnerId, lastMsg }) => {
      const p = profileMap[partnerId] || {};
      const initials = (p.name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
      const isUnread = lastMsg.receiver_id === currentUser.id && !lastMsg.read_at;
      const convAvatar = p.avatar_url ? '<div class="avatar" style="width:42px;height:42px;overflow:hidden;border-radius:50%"><img src="'+p.avatar_url+'" style="width:100%;height:100%;object-fit:cover"></div>' : '<div class="avatar" style="background:linear-gradient(135deg,#8B7FFF,#E85D8A)">'+initials+'</div>';
      return `<div class="card flex-row-center" data-action="openChat" data-id="${partnerId}" data-conv-id="${partnerId}">
        ${convAvatar}
        <div style="flex:1">
          <div class="${isUnread?'fw-700':'fw-600'} fs-09">${escHtml(p.name||'Ukendt')}</div>
          <div class="fs-078 text-muted text-truncate">${escHtml(lastMsg.content||'')}</div>
        </div>
        ${isUnread ? '<div class="live-dot"></div>' : ''}
      </div>`;
    }).join('');
  } catch(e) { logError("loadMessages", e); showToast(e.message || "Ukendt fejl"); }
}

async function openChat(userId, fromScreen) {
  console.debug('[dm] openChat:', userId, 'from:', fromScreen);
  if (isBlocked(userId)) { showToast('Denne bruger er blokeret'); return; }
  try {
    currentChatUser = userId;
    const { data: p } = await sb.from('profiles').select('name,title,avatar_url').eq('id', userId).single();
    currentChatName = p?.name || 'Ukendt';
    window._chatPartnerAvatar = p?.avatar_url || null;
    document.getElementById('chat-name').textContent = currentChatName;
    document.getElementById('chat-role').textContent = p?.title || '';
    var dmAvatar = document.getElementById('dm-topbar-avatar');
    if (dmAvatar) {
      if (p?.avatar_url) { dmAvatar.innerHTML = '<img src="'+p.avatar_url+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%">'; }
      else { dmAvatar.textContent = (currentChatName).split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase(); }
    }
    const backBtn = document.getElementById('dm-back-btn');
    if (backBtn) backBtn.onclick = () => goTo(fromScreen || 'screen-messages');
    goTo('screen-chat');
    await loadChatMessages();
    subscribeToChat();

    // Mark messages as read
    await sb.from('messages').update({ read_at: new Date().toISOString() })
      .eq('sender_id', userId).eq('receiver_id', currentUser.id).is('read_at', null);
    await updateUnreadBadge();
  } catch(e) { logError("openChat", e); showToast(e.message || "Ukendt fejl"); }
}


function dmRenderMsg(m) {
  const sent = m.sender_id === currentUser.id;
  const time = new Date(m.created_at).toLocaleTimeString('da-DK', {hour:'2-digit',minute:'2-digit'});
  const myInit = (currentProfile?.name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  const theirInit = (currentChatName||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  const initials = sent ? myInit : theirInit;
  const name = sent ? (currentProfile?.name||'Mig') : (currentChatName||'?');
  const edited = m.edited ? ' <span class="msg-edited">redigeret</span>' : '';

  let bubble = '';
  if (m.file_url) {
    const ext = m.file_name?.split('.').pop()?.toLowerCase() || '';
    const isImg = ['jpg','jpeg','png','gif','webp'].includes(ext) || (m.file_type||'').startsWith('image/');
    if (isImg) {
      bubble = `<a href="${m.file_url}" target="_blank"><img class="msg-img" src="${m.file_url}" alt="${escHtml(m.file_name||'')}"></a>`;
    } else {
      const sz = m.file_size ? (m.file_size < 1048576 ? Math.round(m.file_size/1024)+'KB' : (m.file_size/1048576).toFixed(1)+'MB') : '';
      bubble = `<a class="msg-file" href="${m.file_url}" target="_blank">${icon('clip')} ${escHtml(m.file_name||'Fil')} <span class="msg-file-sz">${sz}</span></a>`;
    }
  } else {
    bubble = `<div class="msg-bubble${sent?' sent':''}" id="dm-bubble-${m.id}">${escHtml(filterChatContent(m.content||''))}</div>`;
  }

  const myAvUrl = currentProfile?.avatar_url;
  const theirAvUrl = window._chatPartnerAvatar;
  const avatarGrad = sent ? 'linear-gradient(135deg,#4C1D95,#A78BFA)' : 'linear-gradient(135deg,#8B7FFF,#E85D8A)';
  const avatarClick = sent ? '' : ` onclick="dmOpenPersonSheet('${m.sender_id}')"`;

  let avatarInner;
  if (sent && myAvUrl) { avatarInner = '<img src="'+myAvUrl+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%">'; }
  else if (!sent && theirAvUrl) { avatarInner = '<img src="'+theirAvUrl+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%">'; }
  else { avatarInner = initials; }

  return `<div class="msg-row${sent?' me':''}" data-msg-id="${m.id}">
    <div class="msg-avatar"${avatarClick} style="background:${avatarGrad};overflow:hidden${sent?'':';cursor:pointer'}">${avatarInner}</div>
    <div class="msg-body">
      <div class="msg-head"><span class="msg-name">${escHtml(name)}</span><span class="msg-time">${time}${edited}</span></div>
      <div class="msg-content">${bubble}${sent && !m.file_url ?`<button class="msg-dots" onclick="dmEditMsg('${m.id}')">⋯</button>`:''}</div>
    </div>
  </div>`;
}

async function loadChatMessages() {
  try {
    const el = document.getElementById('chat-messages');
    const { data: msgs } = await sb.from('messages')
      .select('*')
      .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${currentChatUser}),and(sender_id.eq.${currentChatUser},receiver_id.eq.${currentUser.id})`)
      .order('created_at', {ascending:false})
      .limit(100);
    
    const sorted = (msgs||[]).reverse();

    el.innerHTML = sorted.map(m => dmRenderMsg(m)).join('');
    el.scrollTop = el.scrollHeight;
  } catch(e) { logError("loadChatMessages", e); showToast(e.message || "Ukendt fejl"); }
}

function subscribeToChat() {
  console.debug('[dm] subscribeToChat, user:', currentChatUser);
  if (chatSubscription) { chatSubscription.unsubscribe(); chatSubscription = null; }
  chatSubscription = sb.channel('chat-' + currentChatUser)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages',
      filter: `receiver_id=eq.${currentUser.id}` }, (payload) => {
      const m = payload.new;
      if (!m) return;
      if (m.sender_id !== currentChatUser) return;
      const el = document.getElementById('chat-messages');
      if (!el) return;
      if (el.querySelector('[data-msg-id="' + m.id + '"]')) return;
      el.insertAdjacentHTML('beforeend', dmRenderMsg(m));
      el.scrollTop = el.scrollHeight;
      // Mark as read immediately since chat is open
      sb.from('messages').update({ read_at: new Date().toISOString() }).eq('id', m.id);
      updateUnreadBadge();
    }).subscribe();
}

let dmEditingId = null;
function dmEditMsg(msgId) {
  dmEditingId = msgId;
  const bubble = document.getElementById('dm-bubble-' + msgId);
  if (!bubble) return;
  const input = document.getElementById('chat-input');
  input.value = bubble.textContent;
  input.focus();
}

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
        card.appendChild(cb);
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
    delBtn.style.opacity = n > 0 ? '1' : '0.4';
  }
}

var _convDeleteConfirmed = false;
async function convDeleteSelected() {
  if (convSelectedIds.length === 0) return;
  if (!_convDeleteConfirmed) {
    _convDeleteConfirmed = true;
    showToast('Tryk Slet igen for at bekr\u00e6fte');
    setTimeout(function() { _convDeleteConfirmed = false; }, 3000);
    return;
  }
  _convDeleteConfirmed = false;
  try {
    var ids = convSelectedIds.slice();
    for (var i = 0; i < ids.length; i++) {
      var partnerId = ids[i];
      // Delete all messages in this conversation (both directions)
      await sb.from('messages').delete().or('and(sender_id.eq.' + currentUser.id + ',receiver_id.eq.' + partnerId + '),and(sender_id.eq.' + partnerId + ',receiver_id.eq.' + currentUser.id + ')');
    }
    // Remove from DOM
    var list = document.getElementById('conversations-list');
    ids.forEach(function(id) {
      var card = list ? list.querySelector('[data-conv-id="' + id + '"]') : null;
      if (card) { card.style.transition = 'opacity 0.2s'; card.style.opacity = '0'; setTimeout(function() { card.remove(); }, 200); }
    });
    showToast(ids.length + (ids.length === 1 ? ' samtale slettet' : ' samtaler slettet'));
    convToggleSelectMode();
  } catch(e) { logError('convDeleteSelected', e); showToast(e.message || 'Fejl ved sletning'); }
}



let dmSending = false;
async function sendMessage() {
  if (dmSending) return;
  dmSending = true;
  var sendBtn = document.getElementById("chat-send-btn");
  if (sendBtn) { sendBtn.disabled = true; sendBtn.style.opacity = "0.4"; }
  console.debug('[dm] sendMessage');
  try {
    if (isBlocked(currentChatUser)) { showToast('Denne bruger er blokeret'); dmSending = false; if (sendBtn) { sendBtn.disabled = false; sendBtn.style.opacity = ''; } return; }
    const input = document.getElementById('chat-input');
    const content = filterChatContent(input.value.trim());
    if (!content) { dmSending = false; if (sendBtn) { sendBtn.disabled = false; sendBtn.style.opacity = ''; } return; }
    if (dmEditingId) {
      await sb.from('messages').update({ content, edited: true }).eq('id', dmEditingId);
      const bubble = document.getElementById('dm-bubble-' + dmEditingId);
      if (bubble) bubble.textContent = content;
      dmEditingId = null;
      input.value = '';
    } else {
      input.value = '';
      const { data: newMsg, error } = await sb.from('messages').insert({
        sender_id: currentUser.id,
        receiver_id: currentChatUser,
        content
      }).select().single();
      if (error) { console.error('sendMessage insert:', error); input.value = content; return; }
      if (newMsg) {
        const el = document.getElementById('chat-messages');
        if (el && !el.querySelector('[data-msg-id="' + newMsg.id + '"]')) {
          el.insertAdjacentHTML('beforeend', dmRenderMsg(newMsg));
          el.scrollTop = el.scrollHeight;
        }
      }
      input.focus();
    }
  } catch(e) { logError("sendMessage", e); showToast(e.message || "Ukendt fejl"); }
  finally { dmSending = false; var sb2 = document.getElementById("chat-send-btn"); if (sb2) { sb2.disabled = false; sb2.style.opacity = ""; } }
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
    showToast('Uploader...');

    const safeFilename = file.name
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `dm/${currentUser.id}/${Date.now()}-${safeFilename}`;

    const { error: uploadErr } = await sb.storage.from('bubble-files').upload(path, file, {
      cacheControl: '3600', upsert: false, contentType: file.type
    });
    if (uploadErr) { showToast('Upload fejlede: ' + (uploadErr.message || 'ukendt')); input.value = ''; return; }

    const { data: urlData } = sb.storage.from('bubble-files').getPublicUrl(path);

    const { data: newMsg, error } = await sb.from('messages').insert({
      sender_id: currentUser.id,
      receiver_id: currentChatUser,
      content: null,
      file_url: urlData.publicUrl,
      file_name: file.name,
      file_size: file.size,
      file_type: file.type
    }).select().single();

    if (error) { showToast('Besked fejlede'); input.value = ''; return; }
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

// ══════════════════════════════════════════════════════════
//  PERSON-SHEET: SAVE CONTACT
// ══════════════════════════════════════════════════════════
async function psSaveContact() {
  try {
    const userId = document.getElementById('person-sheet-el')?.dataset?.userId;
    if (!userId) return;
    if (userId === currentUser.id) { showToast('Du kan ikke gemme dig selv'); return; }
    const { data: existing } = await sb.from('saved_contacts').select('id').eq('user_id', currentUser.id).eq('contact_id', userId).maybeSingle();
    const btn = document.getElementById('ps-save-btn');
    if (existing) {
      await sb.from('saved_contacts').delete().eq('id', existing.id);
      if (btn) btn.innerHTML = icon('bookmark') + ' Gem';
      var sr = document.getElementById('ps-star-row');
      if (sr) sr.style.display = 'none';
      starSet(userId, 0);
      showToast('Kontakt fjernet');
    } else {
      await sb.from('saved_contacts').insert({ user_id: currentUser.id, contact_id: userId });
      if (btn) btn.innerHTML = icon('bookmarkFill') + ' Gemt';
      // Show star rating row
      var sr2 = document.getElementById('ps-star-row');
      var starsEl2 = document.getElementById('ps-stars');
      if (sr2 && starsEl2) {
        sr2.style.display = 'flex';
        starsEl2.innerHTML = [1,2,3].map(function(n) {
          return '<div class="ps-star empty" onclick="psSetStar(\'' + userId + '\',' + n + ')">\u2605</div>';
        }).join('');
      }
      showToast('Kontakt gemt!');
    }
    loadSavedContacts();
  } catch(e) { logError("psSaveContact", e); showToast(e.message || "Ukendt fejl"); }
}

// ══════════════════════════════════════════════════════════
//  PROFILE
// ══════════════════════════════════════════════════════════
async function loadProfile() {
  try {
    if (!currentProfile) await loadCurrentProfile();
    if (!currentProfile) return;

    const initials = (currentProfile.name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    var myAvEl = document.getElementById('my-avatar');
    if (myAvEl) {
      if (currentProfile.avatar_url) { myAvEl.innerHTML = '<img src="'+currentProfile.avatar_url+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%">'; }
      else { myAvEl.textContent = initials; }
    }
    document.getElementById('my-name').textContent = currentProfile.name || '...';
    document.getElementById('my-role').textContent = currentProfile.title || '';
    document.getElementById('my-keywords').innerHTML = (currentProfile.keywords||[]).map(k=>`<span class="tag">${escHtml(k)}</span>`).join('');

    isAnon = currentProfile.is_anon || false;
    updateAnonToggle();

    // Profile completeness nudge
    var nudge = document.getElementById('profile-nudge');
    var nudgeText = document.getElementById('profile-nudge-text');
    if (nudge && nudgeText) {
      var missing = [];
      if (!currentProfile.bio) missing.push('en bio');
      if ((currentProfile.keywords||[]).length < 5) missing.push('flere tags (har ' + (currentProfile.keywords||[]).length + ', anbefalet 5+)');
      if (!(currentProfile.dynamic_keywords||[]).length) missing.push('"søger nu" tags');
      if (!currentProfile.linkedin) missing.push('LinkedIn URL');
      if (missing.length > 0) {
        nudgeText.textContent = 'Tilføj ' + missing[0] + ' for bedre matches';
        nudge.style.display = 'flex';
      } else {
        nudge.style.display = 'none';
      }
    }

    await loadSavedContacts();
    await loadMyBubbles();
    loadProfileInvitations();
  } catch(e) { logError("loadProfile", e); showToast(e.message || "Ukendt fejl"); }
}

// Standalone saved contacts loader — called from loadProfile AND after save/remove
// ══════════════════════════════════════════════════════════
//  STAR RATING for saved contacts
// ══════════════════════════════════════════════════════════
function starGetAll() {
  try { var s = localStorage.getItem('bubble_stars'); return s ? JSON.parse(s) : {}; } catch(e) { return {}; }
}
function starGet(contactId) {
  return starGetAll()[contactId] || 0;
}
function starSet(contactId, rating) {
  var all = starGetAll();
  if (rating <= 0) { delete all[contactId]; } else { all[contactId] = Math.min(rating, 3); }
  try { localStorage.setItem('bubble_stars', JSON.stringify(all)); } catch(e) {}
}
function starCycle(contactId, el) {
  var current = starGet(contactId);
  var next = current >= 3 ? 0 : current + 1;
  starSet(contactId, next);
  if (el) el.innerHTML = starRender(contactId);
  // Re-sort saved contacts
  loadSavedContacts();
}
function starRender(contactId) {
  var r = starGet(contactId);
  if (r === 0) return '';
  return '<span class="star-badge">' + '\u2605'.repeat(r) + '</span>';
}

async function loadSavedContacts() {
  try {
    const savedEl = document.getElementById('saved-contacts');

    // Fetch saved contacts — chronological (newest first)
    const { data: saved, error: savedErr } = await sb.from('saved_contacts')
      .select('id, contact_id, created_at')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false });

    if (savedErr) { console.error('loadSavedContacts query error:', savedErr); return; }

    const countEl = document.getElementById('saved-count');
    if (countEl) {
      if (saved?.length) { countEl.textContent = saved.length; countEl.style.display = 'inline-flex'; }
      else { countEl.style.display = 'none'; }
    }

    if (!saved || saved.length === 0) {
      if (savedEl) savedEl.innerHTML = '<div class="empty-state" style="padding:1.5rem 0"><div class="empty-icon">' + icon('bookmark') + '</div><div class="empty-text">Ingen gemte kontakter endnu.<br>Tryk Gem på en profil for at huske dem.</div></div>';
      renderSavedStoryBar(null, {});
      return;
    }

    // Fetch profiles separately — no FK dependency
    const contactIds = saved.map(s => s.contact_id);
    const { data: profiles, error: profErr } = await sb.from('profiles')
      .select('id, name, title, keywords, workplace, avatar_url').in('id', contactIds);

    if (profErr) console.error('loadSavedContacts profiles error:', profErr);
    const profileMap = {};
    (profiles || []).forEach(p => { profileMap[p.id] = p; });

    // Update home screen story bar
    renderSavedStoryBar(saved, profileMap);

    const colors = ['linear-gradient(135deg,#8B7FFF,#E85D8A)','linear-gradient(135deg,#065F46,#10B981)','linear-gradient(135deg,#1E3A8A,#7C3AED)','linear-gradient(135deg,#0C4A6E,#38BDF8)','linear-gradient(135deg,#7C2D12,#F97316)'];

    // Sort by star rating (highest first), then by date
    saved.sort(function(a, b) {
      var sa = starGet(a.contact_id), sb2 = starGet(b.contact_id);
      if (sb2 !== sa) return sb2 - sa;
      return new Date(b.created_at) - new Date(a.created_at);
    });

    if (savedEl) savedEl.innerHTML = saved.map((s, i) => {
      const p = profileMap[s.contact_id];
      if (!p || s.contact_id === currentUser?.id) return '';
      const ini = (p.name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
      const col = colors[i % colors.length];
      const tags = (p.keywords||[]).slice(0,3).map(k => `<span class="tag" style="font-size:0.58rem;padding:0.15rem 0.4rem">${escHtml(k)}</span>`).join('');
      const stars = starRender(p.id);
      return `<div class="card saved-card" style="padding:0.7rem 0.9rem;margin-bottom:0.4rem;cursor:pointer" onclick="bcOpenPerson('${p.id}','${escHtml(p.name||'')}','${escHtml(p.title||'')}','${col}','screen-profile')">
        <div class="flex-row-center" style="gap:0.7rem">
          <div class="saved-avatar-wrap" style="position:relative;flex-shrink:0">
            ${p.avatar_url ? '<div class="avatar" style="width:42px;height:42px;overflow:hidden;border-radius:50%"><img src="'+p.avatar_url+'" style="width:100%;height:100%;object-fit:cover"></div>' : '<div class="avatar" style="background:'+col+';width:42px;height:42px;font-size:0.75rem">'+ini+'</div>'}
            ${stars}
          </div>
          <div style="flex:1;min-width:0">
            <div class="fw-600 fs-085" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(p.name||'Ukendt')}</div>
            <div class="fs-075 text-muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(p.title||'')}</div>
            ${tags ? `<div style="display:flex;flex-wrap:wrap;gap:0.2rem;margin-top:0.3rem">${tags}</div>` : ''}
          </div>
          <div style="display:flex;gap:0.35rem;flex-shrink:0" onclick="event.stopPropagation()">
            <button class="saved-action-btn" onclick="openChat('${p.id}','screen-profile')" title="Send besked">${icon('chat')}</button>
            <button class="saved-action-btn danger" onclick="removeSavedContact('${s.id}',this)" title="Fjern">${icon('x')}</button>
          </div>
        </div>
      </div>`;
    }).join('');
  } catch(e) { logError("loadSavedContacts", e); }
}

// Render saved contacts as story-bar on home screen
function renderSavedStoryBar(saved, profileMap) {
  var bar = document.getElementById('saved-profiles-bar');
  var list = document.getElementById('saved-story-list');
  var badge = document.getElementById('saved-count-badge');
  if (!bar || !list) return;
  if (!saved || saved.length === 0) { bar.style.display = 'none'; return; }
  bar.style.display = 'block';
  if (badge) badge.textContent = saved.length;
  // Sort by stars for story bar too
  saved = saved.slice().sort(function(a, b) {
    var sa = starGet(a.contact_id), sb2 = starGet(b.contact_id);
    return sb2 - sa;
  });
  var colors = ['linear-gradient(135deg,#8B7FFF,#E85D8A)','linear-gradient(135deg,#065F46,#10B981)','linear-gradient(135deg,#1E3A8A,#7C3AED)','linear-gradient(135deg,#0C4A6E,#38BDF8)','linear-gradient(135deg,#7C2D12,#F97316)'];
  list.innerHTML = saved.map(function(s, i) {
    var p = profileMap[s.contact_id];
    if (!p || s.contact_id === currentUser?.id) return '';
    var ini = (p.name||'?').split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();
    var col = colors[i % colors.length];
    var firstName = (p.name||'?').split(' ')[0];
    var starCount = starGet(s.contact_id);
    var starBadge = starCount > 0 ? '<span class="star-badge">' + '★'.repeat(starCount) + '</span>' : '';
    var storyAvatar = p.avatar_url ?
      '<div class="saved-story-avatar" style="overflow:hidden;position:relative"><img src="' + p.avatar_url + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%">' + starBadge + '</div>' :
      '<div class="saved-story-avatar" style="background:' + col + ';position:relative">' + escHtml(ini) + starBadge + '</div>';
    return '<div class="saved-story-item" onclick="openPerson(\'' + p.id + '\',\'screen-home\')">' +
      storyAvatar +
      '<div class="saved-story-name">' + escHtml(firstName) + '</div></div>';
  }).join('');
}

// Profile tab switching — same pattern as bcSwitchTab
function profSwitchTab(tab) {
  // Ensure settings panel exists (in case of cached HTML)
  if (tab === 'settings' && !document.getElementById('prof-panel-settings')) {
    var container = document.getElementById('prof-panel-invites');
    if (container && container.parentElement) {
      var div = document.createElement('div');
      div.id = 'prof-panel-settings';
      div.style.cssText = 'display:none;flex-direction:column;flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:0.75rem 1.1rem 6rem';
      div.innerHTML = '<div class="section-label" style="margin-bottom:0.25rem">Synlighed</div>' +
        '<div class="settings-row">' +
          '<div style="flex:1"><div style="font-size:0.85rem;font-weight:600">Anonym tilstand</div>' +
          '<div style="font-size:0.68rem;color:var(--text-secondary);margin-top:0.1rem">Skjul dit navn og billede p\u00e5 radaren</div></div>' +
          '<div id="anon-toggle" onclick="toggleAnon()" style="width:46px;height:26px;background:var(--border);border-radius:99px;cursor:pointer;position:relative;transition:background 0.2s;flex-shrink:0">' +
            '<div id="anon-knob" style="width:20px;height:20px;background:var(--muted);border-radius:50%;position:absolute;top:3px;left:3px;transition:all 0.2s"></div>' +
          '</div></div>' +
        '<div class="section-label" style="margin-top:1.25rem;margin-bottom:0.25rem">Konto</div>' +
        '<button onclick="openFeedback()" style="width:100%;padding:0.7rem;background:rgba(139,127,255,0.08);border:1px solid rgba(139,127,255,0.15);border-radius:12px;font-size:0.82rem;font-family:inherit;font-weight:600;color:var(--accent);cursor:pointer;margin-bottom:0.5rem">💬 Giv feedback</button>' +
        '<button onclick="showTerms()" style="width:100%;padding:0.7rem;background:none;border:1px solid var(--glass-border);border-radius:12px;font-size:0.82rem;font-family:inherit;font-weight:600;color:var(--text-secondary);cursor:pointer;margin-bottom:0.5rem">Betingelser & Privatlivspolitik</button>' +
        '<button onclick="handleLogout()" style="width:100%;padding:0.7rem;background:none;border:1px solid rgba(232,93,138,0.2);border-radius:12px;font-size:0.82rem;font-family:inherit;font-weight:600;color:var(--accent2);cursor:pointer">Log ud</button>' +
        '<div style="text-align:center;margin-top:2rem;font-size:0.62rem;color:var(--muted)">Bubble ' + BUILD_VERSION + ' · Build ' + BUILD_TIMESTAMP + '</div>';
      container.parentElement.insertBefore(div, container.nextSibling);
    }
  }
  ['saved','bubbles','invites','settings'].forEach(function(t) {
    var panel = document.getElementById('prof-panel-' + t);
    var tabBtn = document.getElementById('prof-tab-' + t);
    if (panel) panel.style.display = t === tab ? 'flex' : 'none';
    if (tabBtn) tabBtn.classList.toggle('active', t === tab);
  });
  if (tab === 'settings') { updateAnonToggle(); hsUpdateAllToggles(); }
}

// Load invitations into profile invitations tab
async function loadProfileInvitations() {
  try {
    const list = document.getElementById('profile-invitations');
    if (!list) return;
    list.innerHTML = '<div class="spinner"></div>';

    // Fetch pending invitations — newest first
    const { data: invites, error: invErr } = await sb.from('bubble_invitations')
      .select('id, from_user_id, bubble_id, created_at, status')
      .eq('to_user_id', currentUser.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (invErr) { console.error('loadProfileInvitations query:', invErr); list.innerHTML = ''; return; }

    // Update badge
    const countEl = document.getElementById('invite-count');
    if (countEl) {
      if (invites?.length) { countEl.textContent = invites.length; countEl.style.display = 'inline-flex'; }
      else { countEl.style.display = 'none'; }
    }

    if (!invites || invites.length === 0) {
      list.innerHTML = '<div class="empty-state" style="padding:1.5rem 0"><div class="empty-icon">' + icon('bell') + '</div><div class="empty-text">Ingen invitationer lige nu.<br>Når nogen sender dig en Bubble Up,<br>dukker den op her.</div></div>';
      return;
    }

    // Fetch sender profiles separately — no FK dependency
    const senderIds = [...new Set(invites.map(i => i.from_user_id))];
    const { data: profiles } = await sb.from('profiles').select('id, name, title, keywords, avatar_url').in('id', senderIds);
    const profileMap = {};
    (profiles || []).forEach(p => { profileMap[p.id] = p; });

    // Fetch bubble names
    const bubbleIds = [...new Set(invites.filter(i => i.bubble_id).map(i => i.bubble_id))];
    let bubbleMap = {};
    if (bubbleIds.length) {
      const { data: bubbles } = await sb.from('bubbles').select('id, name').in('id', bubbleIds);
      (bubbles || []).forEach(b => { bubbleMap[b.id] = b; });
    }

    const colors = ['linear-gradient(135deg,#8B7FFF,#E85D8A)','linear-gradient(135deg,#065F46,#10B981)','linear-gradient(135deg,#1E3A8A,#7C3AED)','linear-gradient(135deg,#0C4A6E,#38BDF8)','linear-gradient(135deg,#7C2D12,#F97316)'];

    list.innerHTML = invites.map((inv, i) => {
      const p = profileMap[inv.from_user_id] || {};
      const b = bubbleMap[inv.bubble_id] || {};
      const ini = (p.name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
      const col = colors[i % colors.length];
      const time = new Date(inv.created_at).toLocaleDateString('da-DK', { day:'numeric', month:'short' });
      const tags = (p.keywords||[]).slice(0,2).map(k => `<span class="tag" style="font-size:0.58rem;padding:0.15rem 0.4rem">${escHtml(k)}</span>`).join('');

      return `<div class="card" style="padding:0.7rem 0.9rem;margin-bottom:0.5rem" id="prof-invite-${inv.id}">
        <div class="flex-row-center" style="gap:0.7rem">
          <div class="avatar" style="background:${col};width:40px;height:40px;font-size:0.75rem;flex-shrink:0" data-action="openPerson" data-id="${inv.from_user_id}" data-from="screen-profile">${ini}</div>
          <div style="flex:1;min-width:0">
            <div class="fw-600 fs-085" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(p.name||'Ukendt')}</div>
            <div class="fs-075 text-muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(p.title||'')}</div>
            ${b.name ? `<div class="fs-065 text-muted" style="margin-top:0.15rem">${icon('bubble')} ${escHtml(b.name)} · ${time}</div>` : `<div class="fs-065 text-muted" style="margin-top:0.15rem">Bubble Up · ${time}</div>`}
            ${tags ? `<div style="display:flex;flex-wrap:wrap;gap:0.2rem;margin-top:0.25rem">${tags}</div>` : ''}
          </div>
        </div>
        <div style="display:flex;gap:0.4rem;margin-top:0.5rem">
          <button class="btn-sm" style="flex:1;padding:0.4rem;font-size:0.72rem;font-weight:600;background:var(--gradient-primary);border:1px solid var(--gradient-btn-border);color:white;border-radius:var(--radius-xs);cursor:pointer;font-family:inherit" onclick="profAcceptInvite('${inv.id}','${inv.from_user_id}')">Accepter</button>
          <button class="btn-sm btn-ghost" style="flex:1;padding:0.4rem;font-size:0.72rem" onclick="profDeclineInvite('${inv.id}',this)">Afvis</button>
        </div>
      </div>`;
    }).join('');
  } catch(e) { logError("loadProfileInvitations", e); }
}

async function profAcceptInvite(inviteId, fromUserId) {
  try {
    await sb.from('bubble_invitations').update({ status: 'accepted' }).eq('id', inviteId);
    const { data: inv } = await sb.from('bubble_invitations').select('bubble_id').eq('id', inviteId).single();
    if (inv?.bubble_id) {
      await sb.from('bubble_members').insert({ bubble_id: inv.bubble_id, user_id: currentUser.id });
      showToast('Du er nu med i boblen!');
      loadProfileInvitations();
      setTimeout(() => openBubbleChat(inv.bubble_id), 800);
    }
  } catch(e) { logError("profAcceptInvite", e); showToast(e.message || "Ukendt fejl"); }
}

let pendingDeclineInviteId = null;
let pendingDeclineBtn = null;

function profDeclineInvite(inviteId, btn) {
  pendingDeclineInviteId = inviteId;
  pendingDeclineBtn = btn;
  const card = btn.closest('.card');
  if (!card || card.querySelector('.remove-confirm')) return;
  const confirm = document.createElement('div');
  confirm.className = 'remove-confirm';
  confirm.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:0.5rem 0.6rem;margin-top:0.4rem;background:rgba(232,93,138,0.08);border:1px solid rgba(232,93,138,0.2);border-radius:10px;gap:0.5rem';
  confirm.innerHTML = `<span style="font-size:0.72rem;color:var(--text-secondary)">Afvis invitation?</span>
    <div style="display:flex;gap:0.3rem">
      <button class="btn-sm btn-ghost" style="padding:0.25rem 0.6rem;font-size:0.7rem;color:var(--accent2);border-color:rgba(232,93,138,0.3)" onclick="confirmDeclineInvite()">Afvis</button>
      <button class="btn-sm btn-ghost" style="padding:0.25rem 0.6rem;font-size:0.7rem" onclick="cancelDeclineInvite(this)">Annuller</button>
    </div>`;
  card.appendChild(confirm);
}

function cancelDeclineInvite(btn) {
  const confirm = btn.closest('.remove-confirm');
  if (confirm) confirm.remove();
  pendingDeclineInviteId = null;
  pendingDeclineBtn = null;
}

async function confirmDeclineInvite() {
  if (!pendingDeclineInviteId) return;
  const inviteId = pendingDeclineInviteId;
  pendingDeclineInviteId = null;
  pendingDeclineBtn = null;
  try {
    await sb.from('bubble_invitations').update({ status: 'declined' }).eq('id', inviteId);
    const card = document.getElementById('prof-invite-' + inviteId);
    if (card) {
      card.style.transition = 'opacity 0.25s, transform 0.25s';
      card.style.opacity = '0';
      card.style.transform = 'translateX(20px)';
      setTimeout(() => loadProfileInvitations(), 260);
    } else {
      loadProfileInvitations();
    }
    showToast('Invitation afvist');
  } catch(e) { logError("confirmDeclineInvite", e); showToast(e.message || "Ukendt fejl"); }
}

function openEditProfile() {
  if (!currentProfile) return;
  document.getElementById('ep-name').value = currentProfile.name || '';
  document.getElementById('ep-title').value = currentProfile.title || '';
  document.getElementById('ep-bio').value = currentProfile.bio || '';
  document.getElementById('ep-linkedin').value = currentProfile.linkedin || '';
  var wpEl = document.getElementById('ep-workplace');
  if (wpEl) wpEl.value = currentProfile.workplace || '';
  // Avatar preview
  var ini = (currentProfile.name||'?').split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();
  var avIni = document.getElementById('ep-avatar-initials');
  var avImg = document.getElementById('ep-avatar-img');
  if (avIni) avIni.textContent = ini;
  if (avImg) { if (currentProfile.avatar_url) { avImg.src = currentProfile.avatar_url; avImg.style.display = 'block'; } else { avImg.style.display = 'none'; } }
  // Tag picker
  epSelectedTags = [...(currentProfile.keywords || [])];
  epRenderSelectedTags();
  epRenderCategories();
  // Dynamic keywords
  epDynChips = [...(currentProfile.dynamic_keywords || [])];
  renderChips('ep-dyn-chips', epDynChips, 'ep-dyn-chips-container', 'ep-dyn-chip-input');
  openModal('modal-edit-profile');
  setTimeout(initInputConfirmButtons, 50);
}

async function saveProfile() {
  try {
    const name      = document.getElementById('ep-name').value.trim();
    const title     = document.getElementById('ep-title').value.trim();
    const bio       = document.getElementById('ep-bio').value.trim();
    const linkedin  = (document.getElementById('ep-linkedin')?.value || '').trim();
    const workplace = (document.getElementById('ep-workplace')?.value || '').trim();
    if (!name) return showToast('Navn er påkrævet');
    const { error } = await sb.from('profiles').upsert({
      id: currentUser.id, name, title, bio, linkedin, workplace,
      keywords: epSelectedTags, dynamic_keywords: epDynChips, is_anon: isAnon
    });
    if (error) return showToast('Fejl: ' + error.message);
    await loadCurrentProfile();
    closeModal('modal-edit-profile');
    loadProfile();
    showToast('Profil gemt! ✅');
  } catch(e) { logError("saveProfile", e); showToast(e.message || "Ukendt fejl"); }
}

function toggleAnon() {
  isAnon = !isAnon;
  updateAnonToggle();
  sb.from('profiles').update({ is_anon: isAnon }).eq('id', currentUser.id).then();
}


// ══════════════════════════════════════════════════════════
//  HOME SCREEN CUSTOMIZATION
// ══════════════════════════════════════════════════════════

function hsGetPrefs() {
  try {
    var stored = localStorage.getItem('bubble_hs_prefs');
    if (stored) return JSON.parse(stored);
  } catch(e) {}
  return Object.assign({}, hsDefaults);
}

function hsSavePrefs(prefs) {
  try { localStorage.setItem('bubble_hs_prefs', JSON.stringify(prefs)); } catch(e) {}
}

function hsReset() {
  hsSavePrefs(Object.assign({}, hsDefaults));
  try { localStorage.setItem('bubble_hs_notif_view', 'card'); } catch(e) {}
  hsUpdateAllToggles();
  hsApplyToHome();
  showToast('Hjem-skærm nulstillet');
}

function hsUpdatePreview() {
  var prefs = hsGetPrefs();
  var labels = { live: 'Live', saved: 'Gemte', bubbles: 'Bobler', notifs: 'Notif.', radar: 'Radar' };
  var active = [];
  ['live','saved','bubbles','notifs','radar'].forEach(function(key) {
    if (prefs[key]) active.push(labels[key]);
  });
  var el = document.getElementById('hs-preview-text');
  if (el) el.textContent = active.length > 0 ? 'Viser: ' + active.join(' \u00b7 ') : 'Alt er slået fra';
}


function hsToggle(key) {
  var prefs = hsGetPrefs();
  prefs[key] = !prefs[key];
  hsSavePrefs(prefs);
  hsUpdateToggleUI(key, prefs[key]);
  hsApplyToHome();
  hsUpdatePreview();
}

function hsUpdateToggleUI(key, isOn) {
  var el = document.getElementById('hs-toggle-' + key);
  if (el) el.setAttribute('data-on', isOn ? 'true' : 'false');
}

function hsUpdateAllToggles() {
  var prefs = hsGetPrefs();
  ['live','saved','bubbles','notifs','radar'].forEach(function(key) {
    hsUpdateToggleUI(key, prefs[key]);
  });
  // Update notif view picker
  var mode = hsGetNotifView();
  var cardBtn = document.getElementById('hs-notif-card');
  var feedBtn = document.getElementById('hs-notif-feed');
  if (cardBtn) cardBtn.classList.toggle('active', mode === 'card');
  if (feedBtn) feedBtn.classList.toggle('active', mode === 'feed');
  hsUpdatePreview();
}

function hsApplyToHome() {
  var prefs = hsGetPrefs();
  var anyVisible = false;
  ['live','saved','bubbles','notifs','radar'].forEach(function(key) {
    if (key === 'notifs') return; // Handled by hsApplyNotifView
    var els = document.querySelectorAll('[data-hs="' + key + '"]');
    els.forEach(function(el) {
      if (prefs[key]) {
        el.removeAttribute('data-hs-hidden');
      } else {
        el.setAttribute('data-hs-hidden', 'true');
      }
    });
    if (prefs[key]) anyVisible = true;
  });
  if (prefs.notifs) anyVisible = true;
  hsApplyNotifView();
  // Show empty state if nothing visible
  var emptyEl = document.getElementById('home-empty-state');
  if (emptyEl) emptyEl.style.display = anyVisible ? 'none' : 'block';
}

// Notification view mode: 'card' or 'feed'
function hsGetNotifView() {
  try { return localStorage.getItem('bubble_hs_notif_view') || 'card'; } catch(e) { return 'card'; }
}

function hsSetNotifView(mode) {
  try { localStorage.setItem('bubble_hs_notif_view', mode); } catch(e) {}
  // Update picker buttons
  var cardBtn = document.getElementById('hs-notif-card');
  var feedBtn = document.getElementById('hs-notif-feed');
  if (cardBtn) { cardBtn.classList.toggle('active', mode === 'card'); }
  if (feedBtn) { feedBtn.classList.toggle('active', mode === 'feed'); }
  hsApplyNotifView();
}

function hsApplyNotifView() {
  var mode = hsGetNotifView();
  var card = document.querySelector('.card-notif[data-hs="notifs"]');
  var feed = document.getElementById('home-notif-feed');
  var prefs = hsGetPrefs();
  if (!prefs.notifs) {
    if (card) card.setAttribute('data-hs-hidden', 'true');
    if (feed) feed.setAttribute('data-hs-hidden', 'true');
    return;
  }
  if (mode === 'feed') {
    if (card) card.setAttribute('data-hs-hidden', 'true');
    if (feed) { feed.removeAttribute('data-hs-hidden'); }
    loadHomeNotifFeed();
  } else {
    if (card) card.removeAttribute('data-hs-hidden');
    if (feed) feed.setAttribute('data-hs-hidden', 'true');
  }
}

async function loadHomeNotifFeed() {
  var list = document.getElementById('home-notif-feed-list');
  if (!list) return;
  try {
    // Get recent invitations
    var items = [];
    var { data: invites } = await sb.from('bubble_invitations')
      .select('id, from_user_id, bubble_id, created_at, status, profiles!bubble_invitations_from_user_id_fkey(name), bubbles(name)')
      .eq('to_user_id', currentUser.id)
      .order('created_at', {ascending:false})
      .limit(8);
    if (invites) {
      invites.forEach(function(inv) {
        var name = inv.profiles ? inv.profiles.name : 'Nogen';
        var bname = inv.bubbles ? inv.bubbles.name : 'en boble';
        var isNew = inv.status === 'pending';
        var ago = timeAgo(inv.created_at);
        items.push({
          html: '<strong>' + escHtml(name) + '</strong> inviterede dig til <strong>' + escHtml(bname) + '</strong>',
          time: ago,
          isNew: isNew
        });
      });
    }

    // Get recent bubble member joins (for your bubbles)
    var { data: myBubbles } = await sb.from('bubble_members').select('bubble_id').eq('user_id', currentUser.id);
    var myBubbleIds = (myBubbles || []).map(function(m) { return m.bubble_id; });
    if (myBubbleIds.length > 0) {
      var { data: recentJoins } = await sb.from('bubble_members')
        .select('user_id, bubble_id, created_at, profiles(name), bubbles(name)')
        .in('bubble_id', myBubbleIds)
        .neq('user_id', currentUser.id)
        .order('created_at', {ascending:false})
        .limit(5);
      if (recentJoins) {
        recentJoins.forEach(function(j) {
          var name = j.profiles ? j.profiles.name : 'Nogen';
          var bname = j.bubbles ? j.bubbles.name : 'en boble';
          items.push({
            html: '<strong>' + escHtml(name) + '</strong> joined <strong>' + escHtml(bname) + '</strong>',
            time: timeAgo(j.created_at),
            isNew: false
          });
        });
      }
    }

    // Sort by time (most recent first) — use original date for sort
    if (items.length === 0) {
      list.innerHTML = '<div class="fs-072 text-muted" style="text-align:center;padding:0.8rem">Ingen notifikationer endnu</div>';
      return;
    }

    list.innerHTML = items.slice(0, 6).map(function(item) {
      return '<div class="notif-feed-item">' +
        '<div class="notif-feed-dot' + (item.isNew ? '' : ' read') + '"></div>' +
        '<div class="notif-feed-text">' + item.html + '</div>' +
        '<div class="notif-feed-time">' + item.time + '</div>' +
      '</div>';
    }).join('');
  } catch(e) { logError('loadHomeNotifFeed', e); list.innerHTML = '<div class="fs-072 text-muted" style="padding:0.5rem">Kunne ikke hente</div>'; }
}

function timeAgo(dateStr) {
  var diff = Date.now() - new Date(dateStr).getTime();
  var mins = Math.floor(diff / 60000);
  if (mins < 1) return 'nu';
  if (mins < 60) return mins + 'm';
  var hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 't';
  var days = Math.floor(hrs / 24);
  return days + 'd';
}


function updateAnonToggle() {
  var toggle = document.getElementById('anon-toggle');
  var knob = document.getElementById('anon-knob');
  if (!toggle || !knob) return;
  toggle.style.background = isAnon ? 'var(--accent)' : 'var(--border)';
  knob.style.background = isAnon ? 'white' : 'var(--muted)';
  knob.style.left = isAnon ? '23px' : '3px';
}

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
  setTimeout(initInputConfirmButtons, 50);
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
//  CHIP INPUT
// ══════════════════════════════════════════════════════════
function handleChipInput(e, arrayName) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    const val = e.target.value.trim().replace(/,/g,'');
    if (!val) return;
    const arr = arrayName === 'cb-chips' ? cbChips : arrayName === 'ep-chips' ? epChips : arrayName === 'eb-chips' ? ebChips : arrayName === 'ob-chips' ? obChips : arrayName === 'ob-dyn-chips' ? obDynChips : arrayName === 'ep-dyn-chips' ? epDynChips : epDynChips;
    const containerId = arrayName === 'cb-chips' ? 'cb-chips-container' : arrayName === 'ep-chips' ? 'ep-chips-container' : arrayName === 'eb-chips' ? 'eb-chips-container' : arrayName === 'ob-chips' ? 'ob-chips-container' : arrayName === 'ob-dyn-chips' ? 'ob-dyn-chips-container' : arrayName === 'ep-dyn-chips' ? 'ep-dyn-chips-container' : 'ep-dyn-chips-container';
    const inputId = arrayName === 'cb-chips' ? 'cb-chip-input' : arrayName === 'ep-chips' ? 'ep-chip-input' : arrayName === 'eb-chips' ? 'eb-chip-input' : arrayName === 'ob-chips' ? 'ob-chip-input' : arrayName === 'ob-dyn-chips' ? 'ob-dyn-chip-input' : arrayName === 'ep-dyn-chips' ? 'ep-dyn-chip-input' : 'ep-dyn-chip-input';
    if (!arr.includes(val)) arr.push(val);
    e.target.value = '';
    renderChips(arrayName, arr, containerId, inputId);
  }
}

function addChipFromBtn(inputId, arrayName) {
  var inp = document.getElementById(inputId);
  if (!inp) return;
  var val = inp.value.trim().replace(/,/g,'');
  if (!val) { inp.focus(); return; }
  var arr = arrayName === 'cb-chips' ? cbChips : arrayName === 'ep-chips' ? epChips : arrayName === 'eb-chips' ? ebChips : arrayName === 'ob-chips' ? obChips : arrayName === 'ob-dyn-chips' ? obDynChips : arrayName === 'ep-dyn-chips' ? epDynChips : epDynChips;
  var containerId = arrayName === 'cb-chips' ? 'cb-chips-container' : arrayName === 'ep-chips' ? 'ep-chips-container' : arrayName === 'eb-chips' ? 'eb-chips-container' : arrayName === 'ob-chips' ? 'ob-chips-container' : arrayName === 'ob-dyn-chips' ? 'ob-dyn-chips-container' : arrayName === 'ep-dyn-chips' ? 'ep-dyn-chips-container' : 'ep-dyn-chips-container';
  if (!arr.includes(val)) arr.push(val);
  inp.value = '';
  renderChips(arrayName, arr, containerId, inputId);
  inp.focus();
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


function closeModal(id) { document.getElementById(id).classList.remove('open'); }
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

function bubbleEmoji(type) {
  return { event:ico('rocket'), local:ico('pin'), theme:ico('cpu'), company:ico('building'), live:ico('pin') }[type] || ico('bubble');
}
function bubbleIcon(type) {
  return { event:icon('rocket'), local:icon('pin'), theme:icon('cpu'), company:icon('building'), live:icon('pin') }[type] || icon('bubble');
}

function bubbleColor(type, alpha) {
  const map = { event:`rgba(108,99,255,${alpha})`, local:`rgba(67,232,176,${alpha})`, theme:`rgba(255,179,71,${alpha})`, company:`rgba(255,101,132,${alpha})`, live:`rgba(46,207,207,${alpha})` };
  return map[type] || `rgba(108,99,255,${alpha})`;
}

function typeLabel(type) {
  return { event:'Event', local:'Lokal', theme:'Tema', company:'Virksomhed', live:'Live' }[type] || type;
}

// Clock removed — iPhone shows native status bar

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
    showToast('Boble opdateret! ✅');
    await openBubble(currentEditBubbleId);
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
  if (_jsPdfLoaded) return;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    s.onload = resolve;
    s.onerror = () => reject(new Error('Kunne ikke indlæse jsPDF'));
    document.head.appendChild(s);
  });
  _jsPdfLoaded = true;
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
      showToast('Du er checket ind! 🫧');
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
      showToast('Du er checket ind! 🫧');
      await openBubble(joinId, 'screen-home');
    }
  } catch(e) { logError("checkPendingJoin", e); showToast(e.message || "Ukendt fejl"); }
}


// ══════════════════════════════════════════════════════════
//  ONBOARDING
// ══════════════════════════════════════════════════════════
async function maybeShowOnboarding() {
  try {
    // Don't re-trigger if user explicitly skipped
    if (currentProfile?.onboarding_skipped) return false;
    if (!currentProfile ||
        !currentProfile.name ||
        currentProfile.name === currentProfile.id ||
        currentProfile.name === currentUser.email ||
        !currentProfile.title ||
        !currentProfile.keywords ||
        currentProfile.keywords.length === 0) {
      // Pre-fill name from Google if available
      const googleName = currentUser.user_metadata?.full_name ||
                         currentUser.user_metadata?.name || '';
      if (googleName) document.getElementById('ob-name').value = googleName;
      else document.getElementById('ob-name').value = currentProfile?.name || '';
      document.getElementById('ob-title').value = currentProfile?.title || '';
      document.getElementById('ob-bio').value = currentProfile?.bio || '';
      document.getElementById('ob-linkedin').value = currentProfile?.linkedin || '';
      var obWp = document.getElementById('ob-workplace');
      if (obWp) obWp.value = currentProfile?.workplace || '';
      // Initialize tag picker with existing tags
      obSelectedTags = Array.isArray(currentProfile?.keywords) ? [...currentProfile.keywords] : [];
      obRenderSelectedTags();
      obRenderCategories();
      goTo('screen-onboarding');
      setTimeout(initInputConfirmButtons, 50);
      return true;
    }
    return false;
  } catch(e) { logError("maybeShowOnboarding", e); showToast(e.message || "Ukendt fejl"); }
}




// ══════════════════════════════════════════════════════════
//  WELCOME & GETTING STARTED
// ══════════════════════════════════════════════════════════

// ── Profile strength meter (onboarding) ──
var obDynChips = [];

function updateObStrength() {
  var name = (document.getElementById('ob-name')?.value || '').trim();
  var title = (document.getElementById('ob-title')?.value || '').trim();
  var bio = (document.getElementById('ob-bio')?.value || '').trim();
  var linkedin = (document.getElementById('ob-linkedin')?.value || '').trim();
  var tags = obSelectedTags.length;
  var dynTags = obDynChips.length;

  var score = 0;
  if (name) score += 15;
  if (obLifestage) score += 5;
  if (title) score += 15;
  if (bio && bio.length > 20) score += 20;
  else if (bio) score += 8;
  if (tags >= 5) score += 25;
  else if (tags >= 3) score += 15;
  else if (tags >= 1) score += 5;
  if (dynTags >= 1) score += 15;
  if (linkedin) score += 10;

  var bar = document.getElementById('ob-strength-bar');
  var label = document.getElementById('ob-strength-label');
  if (!bar || !label) return;
  bar.style.width = score + '%';
  if (score >= 80) { label.textContent = 'Stærk'; label.style.color = '#10B981'; bar.style.background = '#10B981'; }
  else if (score >= 50) { label.textContent = 'God'; label.style.color = 'var(--accent)'; bar.style.background = 'var(--accent)'; }
  else if (score >= 30) { label.textContent = 'OK'; label.style.color = 'var(--gold)'; bar.style.background = 'var(--gold)'; }
  else { label.textContent = 'Svag'; label.style.color = 'var(--accent2)'; bar.style.background = 'var(--accent2)'; }

  // Actionable hint
  var hint = document.getElementById('ob-strength-hint');
  if (hint) {
    if (!name) hint.textContent = 'Tilføj dit navn for at komme i gang';
    else if (!title) hint.textContent = 'Vælg en titel — den vises i radaren';
    else if (tags < 3) hint.textContent = 'Vælg ' + (3 - tags) + ' tags mere for at aktivere matching';
    else if (tags < 5) hint.textContent = 'Flere tags = bedre matches';
    else if (!bio) hint.textContent = 'Tilføj en bio under "Gør din profil stærkere"';
    else if (!linkedin) hint.textContent = 'LinkedIn gør det lettere at connecte videre';
    else hint.textContent = 'Din profil er klar til at finde de rigtige mennesker!';
  }
}


// ── Lifestage selector & role suggestions ──
var OB_LIFESTAGE_ROLES = {
  student: ['Student','PhD','Researcher','Praktikant','Studentermedhjælper','Teaching Assistant','Kandidatstuderende','Bachelorstuderende','Stipendiat','Lab Assistant','Tutor','Studenterambassadør'],
  employee: ['Developer','Designer','Product Manager','Marketing','Sales','HR','Finance','Operations','Team Lead','Director','Project Manager','Data Scientist','Engineer','Analyst','Consultant','Account Manager','Customer Success','DevOps','QA','Scrum Master','UX Researcher','Content Manager','Business Developer','Logistics','Supply Chain'],
  entrepreneur: ['Founder','Co-Founder','CEO','CTO','CFO','COO','CMO','CPO','Iværksætter','Serial Entrepreneur','Solo Founder','Startup Advisor','Growth Lead','Head of Product','Technical Lead'],
  freelancer: ['Freelancer','Consultant','Advisor','Coach','Mentor','Selvstændig','Fotograf','Grafiker','Tekstforfatter','Webudvikler','Oversætter','Illustrator','Regnskab','Virtual Assistant','Projektleder'],
  public: ['Sagsbehandler','Kommunaldirektør','Projektleder','Koordinator','Rådgiver','Leder','Analytiker','Socialrådgiver','Lærer','Pædagog','Sygeplejerske','Læge','Forsker','Jurist','Bibliotekar','Planlægger','Embedsmand'],
  practical: ['Håndværker','Tekniker','Sygeplejerske','Mekaniker','Elektriker','Tømrer','Landmand','Operatør','Montør','Murer','VVS','Smed','Maler','Gartner','Kok','Bager','Frisør','Chauffør','Lagermedarbejder'],
  investor: ['Investor','Business Angel','VC','LP','Board Member','Partner','Fund Manager','Family Office','Syndicate Lead','Due Diligence','Portfolio Manager','Impact Investor','Micro VC','Crowdfunding'],
  other: ['Pensionist','Mellem jobs','Karriereskift','Frivillig','Community Builder','Kreativ','Hjemmegående','Sabbatical','Digital Nomad','Influencer','Kunstner','Musiker','Atlet','Aktivist']
};
var obLifestage = null;


function skipOnboarding() {
  var name = (document.getElementById('ob-name')?.value || '').trim();
  if (!name && currentProfile?.name) name = currentProfile.name;
  if (!name && currentUser?.email) name = currentUser.email.split('@')[0];
  if (!name) { showToast('Skriv dit navn først — det er alt der kræves'); return; }

  sb.from('profiles').upsert({
    id: currentUser.id, name: name,
    title: (document.getElementById('ob-title')?.value || '').trim() || 'Ikke udfyldt',
    keywords: obSelectedTags.length > 0 ? obSelectedTags : ['Ny bruger'],
    dynamic_keywords: [], bio: '', is_anon: false,
    onboarding_skipped: true
  }).then(function() {
    loadCurrentProfile();
    showToast('Du kan altid udfylde din profil senere');
    goTo('screen-home');
    preloadAllData();
  }).catch(function(e) {
    showToast('Fejl: ' + (e.message || 'ukendt'));
  });
}

var _abortConfirmed = false;
function abortOnboarding() {
  if (!_abortConfirmed) {
    _abortConfirmed = true;
    // Show confirm overlay
    var overlay = document.createElement('div');
    overlay.id = 'abort-confirm-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:999;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)';
    overlay.innerHTML = '<div style="background:rgba(12,12,25,0.95);border:1px solid var(--glass-border);border-radius:20px;padding:1.5rem;max-width:320px;text-align:center;font-family:Outfit,sans-serif">' +
      '<div style="font-size:1.1rem;font-weight:800;color:var(--text);margin-bottom:0.5rem">Afbryd opsætning?</div>' +
      '<div style="font-size:0.8rem;color:var(--text-secondary);line-height:1.5;margin-bottom:1.2rem">Alt du har udfyldt nulstilles og du vender tilbage til login-skærmen.</div>' +
      '<button onclick="confirmAbortOnboarding()" style="width:100%;padding:0.65rem;border-radius:12px;border:1px solid rgba(232,93,138,0.3);background:rgba(232,93,138,0.1);color:var(--accent2);font-family:inherit;font-size:0.85rem;font-weight:700;cursor:pointer;margin-bottom:0.4rem">Ja, afbryd og nulstil</button>' +
      '<button onclick="cancelAbortOnboarding()" style="width:100%;padding:0.65rem;border-radius:12px;border:1px solid var(--glass-border);background:none;color:var(--text-secondary);font-family:inherit;font-size:0.82rem;font-weight:600;cursor:pointer">Fortsæt opsætning</button>' +
      '</div>';
    document.body.appendChild(overlay);
    return;
  }
}

function cancelAbortOnboarding() {
  _abortConfirmed = false;
  var overlay = document.getElementById('abort-confirm-overlay');
  if (overlay) overlay.remove();
}

async function confirmAbortOnboarding() {
  _abortConfirmed = false;
  var overlay = document.getElementById('abort-confirm-overlay');
  if (overlay) overlay.remove();
  try {
    // Clear onboarding inputs
    ['ob-name','ob-title','ob-bio','ob-linkedin','ob-workplace'].forEach(function(id) {
      var el = document.getElementById(id); if (el) el.value = '';
    });
    obSelectedTags = [];
    obDynChips = [];
    obLifestage = null;
    // Sign out and go to auth
    bcUnsubscribeAll();
    sb.removeAllChannels();
    await sb.auth.signOut();
    currentUser = null;
    currentProfile = null;
    goTo('screen-auth');
    showToast('Opsætning afbrudt');
  } catch(e) { logError('abortOnboarding', e); goTo('screen-auth'); }
}

function obToggleBoost() {
  var content = document.getElementById('ob-boost-content');
  var arrow = document.getElementById('ob-boost-arrow');
  if (!content) return;
  if (content.style.display === 'none') {
    content.style.display = 'block';
    if (arrow) arrow.textContent = '−';
  } else {
    content.style.display = 'none';
    if (arrow) arrow.textContent = '＋';
  }
}

function obSelectLifestage(btn) {
  // Deselect all
  document.querySelectorAll('.ob-lifestage-btn').forEach(function(b) { b.classList.remove('selected'); });
  btn.classList.add('selected');
  obLifestage = btn.dataset.stage;

  // Show role suggestions with show-more
  var roles = OB_LIFESTAGE_ROLES[obLifestage] || [];
  var container = document.getElementById('ob-role-suggestions');
  if (container) {
    var initialShow = 8;
    var visibleRoles = roles.slice(0, initialShow);
    var hiddenRoles = roles.slice(initialShow);
    container.innerHTML = visibleRoles.map(function(r) {
      return '<button type="button" class="ob-role-chip" onclick="obSetTitle(this)">' + r + '</button>';
    }).join('') +
    (hiddenRoles.length > 0 ? '<span id="ob-roles-hidden" style="display:none">' + hiddenRoles.map(function(r) {
      return '<button type="button" class="ob-role-chip" onclick="obSetTitle(this)">' + r + '</button>';
    }).join('') + '</span>' +
    '<button type="button" class="ob-show-more" id="ob-roles-toggle" onclick="obToggleRoles()" style="color:var(--accent);margin-top:0.2rem">+ Vis alle ' + roles.length + ' roller</button>' : '');
  }

  // Auto-add lifestage as first tag if relevant
  var autoTag = {student:'Student',entrepreneur:'Iværksætter',freelancer:'Freelancer',investor:'Investor',public:'GovTech',practical:'Håndværk'}[obLifestage];
  if (autoTag && obSelectedTags.indexOf(autoTag) < 0) {
    obAddTag(autoTag, getTagCategory(autoTag) || 'rolle');
  }

  // Re-render categories filtered for this lifestage
  obRenderCategories();

  updateObStrength();
}

function obSetTitle(btn) {
  var input = document.getElementById('ob-title');
  if (!input) return;
  input.value = btn.textContent;
  document.querySelectorAll('.ob-role-chip').forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active');
  // Confirm button green
  var cb = input.parentElement?.querySelector('.input-confirm-btn');
  if (cb) { cb.classList.add('confirmed'); }
  updateObStrength();
}

function obToggleRoles() {
  var hidden = document.getElementById('ob-roles-hidden');
  var toggle = document.getElementById('ob-roles-toggle');
  if (!hidden || !toggle) return;
  if (hidden.style.display === 'none') {
    hidden.style.display = 'inline';
    toggle.textContent = '− Vis færre';
  } else {
    hidden.style.display = 'none';
    var roles = OB_LIFESTAGE_ROLES[obLifestage] || [];
    toggle.textContent = '+ Vis alle ' + roles.length + ' roller';
  }
}

// Save custom-typed titles for admin review (fires on save)
function persistCustomTitle(title) {
  if (!title || !currentUser) return;
  // Check if it's a known role
  var allRoles = Object.values(OB_LIFESTAGE_ROLES).flat();
  var isKnown = allRoles.some(function(r) { return r.toLowerCase() === title.toLowerCase(); });
  if (isKnown) return; // Already in suggestions, no need to save
  // Save as custom tag candidate for admin review
  sb.from('custom_tags').upsert({
    label: title, category: 'rolle', created_by: currentUser.id, usage_count: 1
  }, { onConflict: 'label' }).then(function() {
    // Increment usage if already exists
    sb.from('custom_tags').select('id,usage_count').eq('label', title).single().then(function(res) {
      if (res.data && res.data.usage_count > 1) return;
      // Already handled by upsert
    });
  }).catch(function() {});
}

// ── Apple Login ──
async function handleAppleLogin() {
  try {
    var { error } = await sb.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo: window.location.origin }
    });
    if (error) showToast('Apple login fejlede: ' + error.message);
  } catch(e) { showToast('Apple login fejl: ' + (e.message || 'ukendt')); }
}

function welcomeGo(target) {
  localStorage.setItem('bubble_welcomed', '1');
  if (target === 'discover') {
    goTo('screen-discover');
    loadDiscover();
  } else if (target === 'radar') {
    goTo('screen-home');
    loadHome().then(function() { setTimeout(openRadarSheet, 500); });
  } else {
    goTo('screen-home');
    loadHome();
  }
}

function showGettingStarted() {
  var dismissed = localStorage.getItem('bubble_gs_dismissed');
  var el = document.getElementById('home-getting-started');
  if (!el) return;
  // Show if not dismissed and user has fewer than 2 saved contacts
  if (dismissed) { el.style.display = 'none'; return; }
  el.style.display = 'block';
}

function dismissGettingStarted() {
  localStorage.setItem('bubble_gs_dismissed', '1');
  var el = document.getElementById('home-getting-started');
  if (el) { el.style.transition = 'opacity 0.3s, transform 0.3s'; el.style.opacity = '0'; el.style.transform = 'translateY(-10px)'; setTimeout(function() { el.style.display = 'none'; }, 300); }
}

// ══════════════════════════════════════════════════════════
//  SMART MATCH ALGORITHM (v2)
//  - TF-IDF: rare shared tags score higher
//  - Category weighting: branche > kompetence > rolle > interesse
//  - Cross-match: "søger" ↔ "er" bonus
//  - Shared bubble bonus
//  - Sigmoid normalization to 0-99
// ══════════════════════════════════════════════════════════
var MATCH_CAP = 25;  // Max profiles shown on radar at once
var matchPage = 0;   // For "vis flere" rotation

// Category weights for match scoring
var CAT_WEIGHTS = { branche: 1.5, kompetence: 1.3, rolle: 1.0, interesse: 0.8, custom: 1.0 };

// Calculate tag rarity weight (TF-IDF inspired)
// tagPopularity: { tagLower: count } built from all visible profiles
var _tagPopularity = {};

function buildTagPopularity(allProfiles) {
  _tagPopularity = {};
  var total = allProfiles.length || 1;
  allProfiles.forEach(function(p) {
    (p.keywords || []).forEach(function(k) {
      var key = k.toLowerCase();
      _tagPopularity[key] = (_tagPopularity[key] || 0) + 1;
    });
  });
  // Convert counts to rarity weights: rare = high, common = low
  Object.keys(_tagPopularity).forEach(function(key) {
    var freq = _tagPopularity[key] / total;
    // Rarity: if 80% have it → ~0.3 weight; if 2% have it → ~1.7 weight
    _tagPopularity[key] = 1.0 / Math.log2((_tagPopularity[key] + 1) / total * 10 + 2);
  });
}

function getTagRarity(tagLower) {
  return _tagPopularity[tagLower] || 1.2; // Unknown tags get above-average weight
}

function calcMatchScore(myProfile, theirProfile, sharedBubbleCount) {
  var myKw = (myProfile.keywords || []).map(function(k) { return k.toLowerCase(); });
  var theirKw = (theirProfile.keywords || []).map(function(k) { return k.toLowerCase(); });
  var myDyn = (myProfile.dynamic_keywords || []).map(function(k) { return k.toLowerCase(); });
  var theirDyn = (theirProfile.dynamic_keywords || []).map(function(k) { return k.toLowerCase(); });

  if (myKw.length === 0 || theirKw.length === 0) {
    // Minimal profile — give base score with profile completeness bonus
    return Math.round(15 + (theirProfile.bio ? 8 : 0) + (theirProfile.title ? 7 : 0) + (sharedBubbleCount || 0) * 5);
  }

  // 1. Tag overlap with TF-IDF rarity weighting + category multiplier
  var overlap = myKw.filter(function(k) { return theirKw.indexOf(k) >= 0; });
  var tagScore = 0;
  overlap.forEach(function(k) {
    var rarity = getTagRarity(k);
    // Find original casing to look up category
    var original = (theirProfile.keywords || []).find(function(t) { return t.toLowerCase() === k; }) || k;
    var cat = (typeof getTagCategory === 'function') ? getTagCategory(original) : 'custom';
    var catWeight = CAT_WEIGHTS[cat] || 1.0;
    tagScore += rarity * catWeight;
  });

  // Normalize by max possible score
  var maxPossible = Math.max(myKw.length, theirKw.length);
  var normalizedTagScore = tagScore / (maxPossible * 1.0); // Typically 0-2 range

  // 2. Cross-match: my "søger" ↔ their "er" (and vice versa)
  var crossScore = 0;
  if (myDyn.length > 0) {
    myDyn.forEach(function(d) {
      if (theirKw.indexOf(d) >= 0) crossScore += 2.0; // Strong signal
      // Fuzzy: check if any of their tags contain my search term
      theirKw.forEach(function(tk) {
        if (tk !== d && (tk.indexOf(d) >= 0 || d.indexOf(tk) >= 0)) crossScore += 0.8;
      });
    });
  }
  if (theirDyn.length > 0) {
    theirDyn.forEach(function(d) {
      if (myKw.indexOf(d) >= 0) crossScore += 2.0;
      myKw.forEach(function(mk) {
        if (mk !== d && (mk.indexOf(d) >= 0 || d.indexOf(mk) >= 0)) crossScore += 0.8;
      });
    });
  }

  // 3. Shared bubble bonus (being in the same bubble = shared context)
  var bubbleScore = Math.min((sharedBubbleCount || 0) * 0.3, 1.0);

  // 4. Profile completeness bonus (small)
  var profileBonus = (theirProfile.bio ? 0.1 : 0) + (theirProfile.title ? 0.1 : 0) + (theirProfile.linkedin ? 0.05 : 0);

  // Combine: tag overlap is primary, cross-match is high value, bubbles and profile are minor
  var rawScore = normalizedTagScore * 3.0 + crossScore * 1.5 + bubbleScore + profileBonus;

  // Sigmoid normalization: maps rawScore to 5-99 range
  // sigmoid(x) = 1 / (1 + e^(-x)) mapped to our range
  var sigmoid = 1 / (1 + Math.exp(-rawScore * 0.8 + 1.5));
  var finalScore = Math.round(sigmoid * 85 + 10); // Range: ~12 to ~95
  return Math.min(Math.max(finalScore, 5), 99);
}

// Quick relevance for sorting (0-1 range, used internally)
function calcRelevance(myProfile, theirProfile, sharedBubbleCount) {
  return calcMatchScore(myProfile, theirProfile, sharedBubbleCount) / 100;
}

// ══════════════════════════════════════════════════════════
//  TAG PICKER SYSTEM
// ══════════════════════════════════════════════════════════
var obSelectedTags = [];
var epSelectedTags = [];

function obTagSearch(q) {
  var el = document.getElementById('ob-tag-suggestions');
  if (!el) return;
  if (!q || q.length < 1) {
    el.style.display = 'none';
    return;
  }
  var results = searchTags(q).filter(function(t) { return obSelectedTags.indexOf(t.label) < 0; });
  if (results.length === 0 && q.trim().length > 1) {
    // Allow custom tag
    el.innerHTML = '<div class="tag-sug-item custom" onclick="obAddTag(\'' + escHtml(q.trim()) + '\',\'custom\')">' +
      '<span class="tag-sug-label">+ \"' + escHtml(q.trim()) + '\" (nyt tag)</span></div>';
    el.style.display = 'block';
    return;
  }
  if (results.length === 0) { el.style.display = 'none'; return; }
  el.innerHTML = results.map(function(t) {
    var catInfo = TAG_CATEGORIES[t.category] || {};
    return '<div class="tag-sug-item" onclick="obAddTag(\'' + escHtml(t.label).replace(/'/g,"\\'") + '\',\'' + t.category + '\')">' +
      '<span class="tag-sug-dot" style="background:' + (catInfo.color || 'var(--accent)') + '"></span>' +
      '<span class="tag-sug-label">' + escHtml(t.label) + '</span>' +
      '<span class="tag-sug-cat">' + (catInfo.label || t.category) + '</span></div>';
  }).join('');
  el.style.display = 'block';
}

function obAddTag(label, category) {
  if (obSelectedTags.indexOf(label) >= 0) return;
  obSelectedTags.push(label);
  obRenderSelectedTags();
  var input = document.getElementById('ob-tag-search');
  if (input) { input.value = ''; }
  var sug = document.getElementById('ob-tag-suggestions');
  if (sug) sug.style.display = 'none';
  updateObStrength();
}

function obRemoveTag(label) {
  obSelectedTags = obSelectedTags.filter(function(t) { return t !== label; });
  obRenderSelectedTags();
  updateObStrength();
}

function obRenderSelectedTags() {
  var el = document.getElementById('ob-tag-selected');
  if (!el) return;
  if (obSelectedTags.length === 0) { el.innerHTML = ''; return; }
  el.innerHTML = obSelectedTags.map(function(t) {
    var cat = getTagCategory(t);
    var color = TAG_CATEGORIES[cat]?.color || 'var(--accent)';
    return '<span class="tag-chip" style="border-color:' + color + '40;background:' + color + '15">' +
      '<span class="tag-chip-dot" style="background:' + color + '"></span>' +
      escHtml(t) +
      '<span class="tag-chip-x" onclick="obRemoveTag(\'' + escHtml(t).replace(/'/g,"\\'") + '\')">×</span></span>';
  }).join('');
}

// ── Lifestage → tag filtering ──
var OB_LIFESTAGE_TAGS = {
  student: {
    rolle: ['Student','PhD','Researcher','Praktikant','Studentermedhjælper','Teaching Assistant','Developer','Designer','Data Scientist','Freelancer'],
    branche: ['Edtech','AI/ML','Healthtech','Cleantech','SaaS','Gaming','Media','Cybersecurity','Biotech','Fintech','NGO','Impact','E-commerce'],
    kompetence: ['UX/UI Design','Frontend','Backend','Full-Stack','Python','React','Data Analytics','Machine Learning','Research','Innovation','Content Marketing','Social Media','SEO/SEM','Storytelling'],
    interesse: ['Open Source','AI Ethics','Climate Action','Future of Work','Personal Development','Networking','Community Building','Design Thinking','Lean Startup','Nordic Startups','No-Code','Low-Code','Writing','Podcasting','Diversity & Inclusion','Entrepreneurship']
  },
  employee: {
    rolle: ['Developer','Designer','Product Manager','Project Manager','Team Lead','Director','VP','Engineer','Data Scientist','Sales','Marketing','Growth','HR','Legal','Operations','Consultant'],
    branche: ['SaaS','Fintech','Healthtech','E-commerce','AI/ML','Cybersecurity','Cloud','Infrastructure','DevTools','Retail','B2B','B2C','Consulting','Agency','Service','Logistik','Media','Energi','Pharma','MedTech','Banking','Finans'],
    kompetence: ['Product Development','UX/UI Design','Frontend','Backend','Full-Stack','Growth Hacking','SEO/SEM','Sales Strategy','Enterprise Sales','People Ops','Talent Acquisition','DevOps','Security','Architecture','Brand Strategy','PR/Comms','Operations','Analytics','Data Analytics','Machine Learning','Strategy','Facilitation','GDPR','Legal/Compliance'],
    interesse: ['Leadership','Management','Future of Work','Remote Work','Agile','Personal Development','Networking','Community Building','Design Thinking','Public Speaking','Diversity & Inclusion','Digital Health','AI Ethics','Nordic Startups','Entrepreneurship']
  },
  entrepreneur: {
    rolle: ['Founder','Co-Founder','CEO','CTO','CFO','COO','CMO','CPO','Iværksætter','Serial Entrepreneur','Product Manager','Developer','Designer','Advisor','Mentor'],
    branche: ['SaaS','Fintech','Healthtech','Edtech','Cleantech','Biotech','E-commerce','AI/ML','Foodtech','Proptech','Marketplace','Platform','B2B','B2C','D2C','Deep Tech','Hardware','Martech','Legaltech','Insurtech','IoT','Robotics'],
    kompetence: ['Product Development','Fundraising','Pitch Deck','Financial Modeling','Growth Hacking','Sales Strategy','Partnerships','BD','Brand Strategy','Storytelling','Innovation','Strategy','UX/UI Design','Frontend','Backend','People Ops','Talent Acquisition','Operations','Analytics'],
    interesse: ['Entrepreneurship','Venture Capital','Angel Investing','Lean Startup','Networking','Skalering','Exit Strategy','Nordic Startups','European Tech','Global Markets','Internationalisering','Climate Action','Community Building','Public Speaking','Leadership','Creator Economy']
  },
  freelancer: {
    rolle: ['Freelancer','Consultant','Advisor','Coach','Mentor','Selvstændig','Developer','Designer','Data Scientist','Engineer','Product Manager'],
    branche: ['SaaS','Consulting','Agency','Service','AI/ML','E-commerce','Media','Healthtech','Fintech','Cleantech','Edtech','B2B','B2C','Martech','Entertainment','Publishing'],
    kompetence: ['UX/UI Design','Frontend','Backend','Full-Stack','Product Development','Growth Hacking','Content Marketing','Brand Strategy','PR/Comms','Storytelling','SEO/SEM','Sales Strategy','Strategy','Facilitation','Data Analytics','Innovation','Architecture','API Design'],
    interesse: ['Remote Work','Digital Nomad','Networking','Personal Development','Public Speaking','Writing','Podcasting','Creator Economy','No-Code','Community Building','Design Thinking','Entrepreneurship','Lean Startup','Future of Work','Leadership']
  },
  public: {
    rolle: ['Project Manager','Team Lead','Director','Consultant','Advisor','Researcher','HR','Legal','Operations','Professor','Engineer'],
    branche: ['NGO','GovTech','Civic Tech','Impact','Sundhed','Energi','Bæredygtighed','Edtech','Cleantech','Mental Health','Pharma','MedTech'],
    kompetence: ['People Ops','Strategy','Facilitation','Research','Innovation','Legal/Compliance','GDPR','Operations','Brand Strategy','PR/Comms','Sustainability','ESG','Data Analytics','Content Marketing','Storytelling','Talent Acquisition'],
    interesse: ['Social Impact','Climate Action','Diversity & Inclusion','Smart Cities','Digital Health','Community Building','Future of Work','Public Speaking','Leadership','Management','Nordic Startups','Networking','Personal Development','AI Ethics','Responsible AI']
  },
  practical: {
    rolle: ['Engineer','Team Lead','Freelancer','Operations','Consultant','Project Manager','Selvstændig','Iværksætter'],
    branche: ['Energi','Logistik','Sundhed','Cleantech','Hardware','Embedded','Agritech','Foodtech','Mobility','Service','Bæredygtighed','Circular Economy','IoT','Robotics'],
    kompetence: ['Operations','Supply Chain','Procurement','DevOps','Security','Architecture','Sustainability','Innovation','Facilitation','People Ops','Talent Acquisition','Product Development'],
    interesse: ['Climate Action','Future of Work','Personal Development','Networking','Community Building','Smart Cities','Digital Health','Biohacking','Remote Work','Entrepreneurship','Leadership','Lean Startup']
  },
  investor: {
    rolle: ['Investor','Business Angel','VC','LP','Board Member','Partner','Advisor','Mentor','Director','Founder','Serial Entrepreneur'],
    branche: ['SaaS','Fintech','Healthtech','Cleantech','Biotech','AI/ML','Deep Tech','Foodtech','Proptech','E-commerce','Crypto','DeFi','SpaceTech','Impact','Hardware','Marketplace','Platform','Edtech'],
    kompetence: ['Due Diligence','Financial Modeling','Fundraising','Strategy','Partnerships','BD','Sales Strategy','Enterprise Sales','Innovation','ESG','Carbon Accounting','Pitch Deck','Operations'],
    interesse: ['Venture Capital','Angel Investing','Entrepreneurship','Nordic Startups','European Tech','Global Markets','Exit Strategy','Skalering','Internationalisering','Climate Action','Impact','Leadership','Networking','Community Building','Crowdfunding']
  }
};

var OB_TAGS_INITIAL = 8; // Show 8 tags initially per category
var _obExpandedCats = {};

function obRenderCategories() {
  var el = document.getElementById('ob-tag-categories');
  if (!el) return;

  var filterMap = obLifestage ? OB_LIFESTAGE_TAGS[obLifestage] : null;

  el.innerHTML = Object.entries(TAG_CATEGORIES).map(function(entry) {
    var cat = entry[0], info = entry[1];
    // Skip "Rolle & Titel" in onboarding — handled by titel input + livsfase suggestions
    if (cat === 'rolle') return '';
    var allTags = TAG_DATABASE[cat] || [];
    var tags = filterMap && filterMap[cat] ? filterMap[cat] : allTags;
    var expanded = _obExpandedCats[cat];
    var visibleTags = expanded ? tags : tags.slice(0, OB_TAGS_INITIAL);
    var hasMore = tags.length > OB_TAGS_INITIAL;

    // Move selected tags to front
    var selected = visibleTags.filter(function(t) { return obSelectedTags.indexOf(t) >= 0; });
    var unselected = visibleTags.filter(function(t) { return obSelectedTags.indexOf(t) < 0; });
    var ordered = selected.concat(unselected);

    return '<div class="ob-cat-block">' +
      '<div class="ob-cat-header">' +
      '<span class="tag-cat-dot" style="background:' + info.color + '"></span>' +
      '<span class="tag-cat-title">' + info.label + '</span>' +
      '<span class="tag-cat-count">' + tags.length + '</span>' +
      '</div>' +
      '<div class="ob-cat-tags">' +
      ordered.map(function(t) {
        var sel = obSelectedTags.indexOf(t) >= 0;
        return '<span class="tag-pick' + (sel ? ' selected' : '') + '" ' +
          'style="border-color:' + info.color + '30;' + (sel ? 'background:' + info.color + '20' : '') + '" ' +
          'onclick="obTogglePickTag(\'' + escHtml(t).replace(/'/g,"\\'") + '\',\'' + cat + '\',this)">' +
          escHtml(t) + '</span>';
      }).join('') +
      '</div>' +
      (hasMore ? '<button type="button" class="ob-show-more" onclick="obToggleExpand(\'' + cat + '\')" style="color:' + info.color + '">' +
        (expanded ? '− Vis færre' : '+ Vis alle ' + tags.length) + '</button>' : '') +
      '<div class="ob-cat-custom">' +
      '<div class="ob-cat-custom-row">' +
      '<input class="ob-cat-custom-input" placeholder="+ Tilføj egen..." ' +
      'onkeydown="obCustomTag(event,\'' + cat + '\',this)" ' +
      'data-cat="' + cat + '">' +
      '<button type="button" class="ob-cat-custom-btn" onclick="obCustomTagBtn(\'' + cat + '\',this)" title="Tilføj">✓</button>' +
      '</div>' +
      '</div>' +
      '</div>';
  }).join('');
}

function obToggleExpand(cat) {
  _obExpandedCats[cat] = !_obExpandedCats[cat];
  obRenderCategories();
}

// ── Custom tag creation with dedup + basic filter ──
var OB_BLOCKED_WORDS = ['fuck','shit','ass','dick','pik','lort','idiot','nazi','hitler'];
var CUSTOM_TAG_PROMOTE_THRESHOLD = 3;

// Load promoted custom tags (3+ users) into TAG_DATABASE at startup
async function loadPromotedCustomTags() {
  try {
    if (typeof sb === 'undefined') return;
    var { data } = await sb.from('custom_tags').select('label,category,usage_count')
      .gte('usage_count', CUSTOM_TAG_PROMOTE_THRESHOLD);
    if (!data || data.length === 0) return;
    data.forEach(function(t) {
      var cat = t.category;
      if (!TAG_DATABASE[cat]) return;
      // Don't add duplicates
      if (TAG_DATABASE[cat].indexOf(t.label) >= 0) return;
      TAG_DATABASE[cat].push(t.label);
      ALL_TAGS.push({ label: t.label, category: cat });
    });
  } catch(e) { console.warn('loadPromotedCustomTags:', e); }
}

function obCustomTagBtn(cat, btn) {
  var input = btn.parentElement.querySelector('.ob-cat-custom-input');
  if (!input) return;
  obCustomTag({ key: 'Enter', preventDefault: function(){} }, cat, input);
}

function obCustomTag(event, cat, input) {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  var val = input.value.trim();
  if (!val || val.length < 2 || val.length > 40) { input.value = ''; return; }

  // Block inappropriate content
  var lower = val.toLowerCase();
  if (OB_BLOCKED_WORDS.some(function(w) { return lower.includes(w); })) {
    showToast('Det tag er ikke tilladt');
    input.value = '';
    return;
  }

  // Case-insensitive dedup against existing tags (curated + promoted)
  var exists = ALL_TAGS.find(function(t) { return t.label.toLowerCase() === lower; });
  if (exists) {
    obAddTag(exists.label, exists.category);
    input.value = '';
    obRenderCategories();
    return;
  }

  // New custom tag — add locally for THIS user only (not to TAG_DATABASE)
  var formatted = val.charAt(0).toUpperCase() + val.slice(1);
  obAddTag(formatted, cat);
  input.value = '';
  obRenderCategories();
  showToast('Tag tilføjet til din profil');

  // Persist to Supabase: increment usage_count if exists, insert if new
  if (typeof sb !== 'undefined' && currentUser) {
    sb.from('custom_tags').select('id,usage_count').eq('label', formatted).maybeSingle()
      .then(function(res) {
        if (res.data) {
          // Tag exists — increment usage count
          sb.from('custom_tags').update({ usage_count: (res.data.usage_count || 0) + 1 })
            .eq('id', res.data.id).then(function() {}).catch(function() {});
        } else {
          // New tag — insert with count 1
          sb.from('custom_tags').insert({
            label: formatted, category: cat, created_by: currentUser.id, usage_count: 1
          }).then(function() {}).catch(function() {});
        }
      }).catch(function() {});
  }
}

function obToggleCat(header) {
  return; // Categories always open in onboarding
}

function obTogglePickTag(label, cat, el) {
  if (obSelectedTags.indexOf(label) >= 0) {
    obRemoveTag(label);
    if (el) { el.classList.remove('selected'); el.style.background = ''; }
  } else {
    obAddTag(label, cat);
    var color = TAG_CATEGORIES[cat]?.color || 'var(--accent)';
    if (el) { el.classList.add('selected'); el.style.background = color + '20'; }
  }
}

// Close suggestions when clicking outside
document.addEventListener('click', function(e) {
  if (!e.target.closest('.tag-search-wrap')) {
    var sug = document.getElementById('ob-tag-suggestions');
    if (sug) sug.style.display = 'none';
    var sug2 = document.getElementById('ep-tag-suggestions');
    if (sug2) sug2.style.display = 'none';
  }
});

// ── Edit Profile tag picker (mirrors OB pattern) ──
function epTagSearch(q) {
  var el = document.getElementById('ep-tag-suggestions');
  if (!el) return;
  if (!q || q.length < 1) { el.style.display = 'none'; return; }
  var results = searchTags(q).filter(function(t) { return epSelectedTags.indexOf(t.label) < 0; });
  if (results.length === 0 && q.trim().length > 1) {
    el.innerHTML = '<div class="tag-sug-item custom" onclick="epAddTag(\'' + escHtml(q.trim()) + '\',\'custom\')">' +
      '<span class="tag-sug-label">+ "' + escHtml(q.trim()) + '" (nyt tag)</span></div>';
    el.style.display = 'block'; return;
  }
  if (results.length === 0) { el.style.display = 'none'; return; }
  el.innerHTML = results.map(function(t) {
    var catInfo = TAG_CATEGORIES[t.category] || {};
    return '<div class="tag-sug-item" onclick="epAddTag(\'' + escHtml(t.label).replace(/'/g,"\\'") + '\',\'' + t.category + '\')">' +
      '<span class="tag-sug-dot" style="background:' + (catInfo.color || 'var(--accent)') + '"></span>' +
      '<span class="tag-sug-label">' + escHtml(t.label) + '</span>' +
      '<span class="tag-sug-cat">' + (catInfo.label || t.category) + '</span></div>';
  }).join('');
  el.style.display = 'block';
}
function epAddTag(label, category) {
  if (epSelectedTags.indexOf(label) >= 0) return;
  epSelectedTags.push(label);
  epRenderSelectedTags();
  var input = document.getElementById('ep-tag-search');
  if (input) input.value = '';
  var sug = document.getElementById('ep-tag-suggestions');
  if (sug) sug.style.display = 'none';
}
function epRemoveTag(label) {
  epSelectedTags = epSelectedTags.filter(function(t) { return t !== label; });
  epRenderSelectedTags();
}
function epRenderSelectedTags() {
  var el = document.getElementById('ep-tag-selected');
  if (!el) return;
  if (epSelectedTags.length === 0) { el.innerHTML = ''; return; }
  el.innerHTML = epSelectedTags.map(function(t) {
    var cat = getTagCategory(t);
    var color = TAG_CATEGORIES[cat]?.color || 'var(--accent)';
    return '<span class="tag-chip" style="border-color:' + color + '40;background:' + color + '15">' +
      '<span class="tag-chip-dot" style="background:' + color + '"></span>' +
      escHtml(t) +
      '<span class="tag-chip-x" onclick="epRemoveTag(\'' + escHtml(t).replace(/'/g,"\\'") + '\')">×</span></span>';
  }).join('');
}
var _epExpandedCats = {};

function epRenderCategories() {
  var el = document.getElementById('ep-tag-categories');
  if (!el) return;
  el.innerHTML = Object.entries(TAG_CATEGORIES).map(function(entry) {
    var cat = entry[0], info = entry[1];
    var tags = TAG_DATABASE[cat] || [];
    var expanded = _epExpandedCats[cat];
    var visibleTags = expanded ? tags : tags.slice(0, OB_TAGS_INITIAL);
    var hasMore = tags.length > OB_TAGS_INITIAL;

    var selected = visibleTags.filter(function(t) { return epSelectedTags.indexOf(t) >= 0; });
    var unselected = visibleTags.filter(function(t) { return epSelectedTags.indexOf(t) < 0; });
    var ordered = selected.concat(unselected);

    return '<div class="ob-cat-block">' +
      '<div class="ob-cat-header">' +
      '<span class="tag-cat-dot" style="background:' + info.color + '"></span>' +
      '<span class="tag-cat-title">' + info.label + '</span>' +
      '<span class="tag-cat-count">' + tags.length + '</span>' +
      '</div>' +
      '<div class="ob-cat-tags">' +
      ordered.map(function(t) {
        var sel = epSelectedTags.indexOf(t) >= 0;
        return '<span class="tag-pick' + (sel ? ' selected' : '') + '" ' +
          'style="border-color:' + info.color + '30;' + (sel ? 'background:' + info.color + '20' : '') + '" ' +
          'onclick="epTogglePickTag(\'' + escHtml(t).replace(/'/g,"\\'") + '\',\'' + cat + '\',this)">' +
          escHtml(t) + '</span>';
      }).join('') +
      '</div>' +
      (hasMore ? '<button type="button" class="ob-show-more" onclick="epToggleExpand(\'' + cat + '\')" style="color:' + info.color + '">' +
        (expanded ? '− Vis færre' : '+ Vis alle ' + tags.length) + '</button>' : '') +
      '<div class="ob-cat-custom"><div class="ob-cat-custom-row">' +
      '<input class="ob-cat-custom-input" placeholder="+ Tilføj egen..." ' +
      'onkeydown="epCustomTag(event,\'' + cat + '\',this)" data-cat="' + cat + '">' +
      '<button type="button" class="ob-cat-custom-btn" onclick="epCustomTagBtn(\'' + cat + '\',this)">✓</button>' +
      '</div></div></div>';
  }).join('');
}

function epToggleExpand(cat) {
  _epExpandedCats[cat] = !_epExpandedCats[cat];
  epRenderCategories();
}
function epCustomTagBtn(cat, btn) {
  var input = btn.parentElement.querySelector('.ob-cat-custom-input');
  if (!input) return;
  epCustomTag({ key:'Enter', preventDefault:function(){} }, cat, input);
}
function epCustomTag(event, cat, input) {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  var val = input.value.trim();
  if (!val || val.length < 2 || val.length > 40) { input.value = ''; return; }
  var lower = val.toLowerCase();
  if (OB_BLOCKED_WORDS.some(function(w) { return lower.includes(w); })) { showToast('Det tag er ikke tilladt'); input.value = ''; return; }
  var exists = ALL_TAGS.find(function(t) { return t.label.toLowerCase() === lower; });
  if (exists) { epAddTag(exists.label, exists.category); input.value = ''; epRenderCategories(); return; }
  var formatted = val.charAt(0).toUpperCase() + val.slice(1);
  epAddTag(formatted, cat);
  input.value = '';
  epRenderCategories();
  showToast('Tag tilføjet til din profil');
  if (typeof sb !== 'undefined' && currentUser) {
    sb.from('custom_tags').select('id,usage_count').eq('label', formatted).maybeSingle()
      .then(function(res) {
        if (res.data) { sb.from('custom_tags').update({ usage_count: (res.data.usage_count||0)+1 }).eq('id', res.data.id).then(function(){}).catch(function(){}); }
        else { sb.from('custom_tags').insert({ label:formatted, category:cat, created_by:currentUser.id, usage_count:1 }).then(function(){}).catch(function(){}); }
      }).catch(function(){});
  }
}
function epToggleCat(header) { return; }
function epTogglePickTag(label, cat, el) {
  if (epSelectedTags.indexOf(label) >= 0) {
    epRemoveTag(label);
    if (el) { el.classList.remove('selected'); el.style.background = ''; }
  } else {
    epAddTag(label, cat);
    var color = TAG_CATEGORIES[cat]?.color || 'var(--accent)';
    if (el) { el.classList.add('selected'); el.style.background = color + '20'; }
  }
}

async function saveOnboarding() {
  try {
    const name      = document.getElementById('ob-name').value.trim();
    const title     = document.getElementById('ob-title').value.trim();
    const bio       = document.getElementById('ob-bio').value.trim();
    const linkedin  = document.getElementById('ob-linkedin').value.trim();
    const workplace = (document.getElementById('ob-workplace')?.value || '').trim();
    if (!name)            return showToast('Navn er påkrævet');
    if (!title)           return showToast('Titel er påkrævet');
    if (obSelectedTags.length < 3) return showToast('Vælg mindst 3 tags');
    const { error } = await sb.from('profiles').upsert({
      id: currentUser.id, name, title, bio, linkedin, workplace,
      keywords: obSelectedTags, dynamic_keywords: obDynChips, is_anon: false
    });
    if (error) return showToast('Fejl: ' + error.message);
    persistCustomTitle(title);
    await loadCurrentProfile();
    showToast('Profil oprettet! 🎉');
    // Aggressively preload everything so app feels instant
    preloadAllData();
    goTo('screen-welcome');
  } catch(e) { logError("saveOnboarding", e); showToast(e.message || "Ukendt fejl"); }
}

// ══════════════════════════════════════════════════════════
//  AGGRESSIVE PRELOAD — makes app feel instant
// ══════════════════════════════════════════════════════════
async function preloadAllData() {
  try {
    await Promise.all([
      loadHome(),
      loadDiscover(),
      loadMessages(),
      loadMyBubbles(),
      loadSavedContacts(),
      loadProximityMap(),
      loadBlockedUsers(),
      loadPromotedCustomTags()
    ].map(function(p) { return p.catch(function(e) { logError('preload', e); }); }));
  } catch(e) { logError('preloadAllData', e); }
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
    if (error) showToast('Google login fejl: ' + error.message);
  } catch(e) { logError("handleGoogleLogin", e); showToast(e.message || "Ukendt fejl"); }
}


// ══════════════════════════════════════════════════════════
//  GIF PICKER (Tenor API v2)
// ══════════════════════════════════════════════════════════
// Tenor GIF API — free tier, no key required for web
var gifPickerMode = null; // 'bc' or 'dm'
var _gifSearchTimer = null;

function toggleGifPicker(mode) {
  var picker = document.getElementById('gif-picker');
  var overlay = document.getElementById('gif-picker-overlay');
  if (picker.classList.contains('open')) { closeGifPicker(); return; }
  gifPickerMode = mode;
  overlay.classList.add('open');
  setTimeout(function() { picker.classList.add('open'); }, 10);
  var input = document.getElementById('gif-search');
  if (input) { input.value = ''; input.focus(); }
  loadTrendingGifs();
}

function closeGifPicker() {
  var picker = document.getElementById('gif-picker');
  var overlay = document.getElementById('gif-picker-overlay');
  if (picker) picker.classList.remove('open');
  setTimeout(function() { if (overlay) overlay.classList.remove('open'); }, 280);
}

function gifSearchDebounce() {
  clearTimeout(_gifSearchTimer);
  _gifSearchTimer = setTimeout(function() {
    var q = (document.getElementById('gif-search')?.value || '').trim();
    if (q.length >= 2) searchGifs(q);
    else if (q.length === 0) loadTrendingGifs();
  }, 350);
}

async function loadTrendingGifs() {
  var grid = document.getElementById('gif-grid');
  if (!grid) return;
  grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:1rem"><div class="spinner"></div></div>';
  try {
    var res = await fetch('https://g.tenor.com/v1/trending?key=LIVDSRZULELA&limit=20&media_filter=minimal&contentfilter=medium');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var data = await res.json();
    renderGifs(data.results || []);
  } catch(e) {
    logError('GIF trending error', e);
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:1.5rem;font-size:0.75rem;color:var(--muted)">Kunne ikke hente GIFs.<br>Tjek din internetforbindelse.</div>';
  }
}

async function searchGifs(query) {
  var grid = document.getElementById('gif-grid');
  if (!grid) return;
  grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:1rem"><div class="spinner"></div></div>';
  try {
    var res = await fetch('https://g.tenor.com/v1/search?q=' + encodeURIComponent(query) + '&key=LIVDSRZULELA&limit=20&media_filter=minimal&contentfilter=medium');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var data = await res.json();
    renderGifs(data.results || []);
  } catch(e) {
    logError('GIF search error', e);
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:1.5rem;font-size:0.75rem;color:var(--muted)">Søgning fejlede</div>';
  }
}

function renderGifs(results) {
  var grid = document.getElementById('gif-grid');
  if (!grid) return;
  if (results.length === 0) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:1.5rem;font-size:0.78rem;color:var(--muted)">Ingen GIFs fundet</div>';
    return;
  }
  // Store GIF data and use index-based selection to avoid URL escaping issues
  window._gifResults = [];
  grid.innerHTML = results.map(function(r, idx) {
    var media = r.media && r.media[0];
    if (!media) return '';
    var preview = media.tinygif?.url || media.nanogif?.url || '';
    var full = media.gif?.url || media.mediumgif?.url || preview;
    if (!preview) return '';
    window._gifResults[idx] = full;
    return '<img src="' + preview + '" alt="GIF" loading="lazy" onclick="selectGif(' + idx + ')">';
  }).join('');
}

async function selectGif(idx) {
  var gifUrl = window._gifResults && window._gifResults[idx];
  var mode = gifPickerMode;
  closeGifPicker();
  if (!gifUrl) { logError('selectGif', 'No GIF URL at index ' + idx); return; }
  try {
    if (mode === 'bc') {
      if (!bcBubbleId) { logError('selectGif', 'No bcBubbleId'); showToast('Fejl: ingen aktiv boble'); return; }
      var { data: msg, error } = await sb.from('bubble_messages').insert({
        bubble_id: bcBubbleId, user_id: currentUser.id,
        content: '', file_url: gifUrl, file_name: 'gif.gif', file_type: 'image/gif'
      }).select('id, bubble_id, user_id, content, file_url, file_name, file_size, file_type, edited, created_at').single();
      if (error) { logError('selectGif:bc', error); showToast('GIF fejl: ' + (error.message || 'ukendt')); return; }
      if (msg) {
        msg.profiles = { id: currentUser.id, name: currentProfile?.name || '?' };
        document.getElementById('bc-messages').appendChild(bcRenderMsg(msg));
        bcScrollToBottom();
      }
    } else if (mode === 'dm') {
      if (!currentChatUser) { logError('selectGif', 'No currentChatUser'); showToast('Fejl: ingen aktiv chat'); return; }
      var { data: msg2, error: err2 } = await sb.from('messages').insert({
        sender_id: currentUser.id, receiver_id: currentChatUser,
        content: '', file_url: gifUrl, file_name: 'gif.gif', file_type: 'image/gif'
      }).select().single();
      if (err2) { logError('selectGif:dm', err2, { receiver: currentChatUser }); showToast('GIF fejl: ' + (err2.message || 'ukendt')); return; }
      if (msg2) {
        var el = document.getElementById('chat-messages');
        if (el && !el.querySelector('[data-msg-id="' + msg2.id + '"]')) {
          el.insertAdjacentHTML('beforeend', dmRenderMsg(msg2));
          el.scrollTop = el.scrollHeight;
        }
      }
    } else {
      logError('selectGif', 'Unknown mode: ' + mode);
      showToast('GIF fejl: ukendt kontekst');
    }
  } catch(e) { logError('selectGif', e, { mode: mode }); showToast('GIF fejl: ' + (e.message || 'ukendt')); }
}

// ══════════════════════════════════════════════════════════
//  BOOT
// ══════════════════════════════════════════════════════════
async function loadNotifications() {
  try {
    const list = document.getElementById('notifications-list');
    if (!list) return;
    list.innerHTML = '<div class="spinner"></div>';

    let html = '';

    // 1. Bubble-up invitations pending
    const { data: invites } = await sb.from('bubble_invitations')
      .select('id, from_user_id, bubble_id, created_at, profiles!bubble_invitations_from_user_id_fkey(name,title), bubbles(name)')
      .eq('to_user_id', currentUser.id)
      .eq('status', 'pending')
      .order('created_at', {ascending:false});

    if (invites && invites.length > 0) {
      invites.forEach(inv => {
        const p = inv.profiles || {};
        const initials = (p.name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
        html += `<div class="notif-card invite" id="invite-${inv.id}">
          <div class="notif-header">
            <div class="notif-avatar" style="background:linear-gradient(135deg,#8B7FFF,#E85D8A)">${initials}</div>
            <div>
              <div class="notif-title">${icon("bubble")} Invitation til boble</div>
              <div class="notif-sub">${escHtml(p.name||'Nogen')} inviterer dig til ${escHtml(inv.bubbles?.name||'en boble')}</div>
            </div>
          </div>
          <div class="notif-actions">
            <button class="notif-btn accept" onclick="acceptBubbleInvite('${inv.id}','${inv.from_user_id}')">Accepter</button>
            <button class="notif-btn decline" onclick="declineBubbleInvite('${inv.id}')">Afvis</button>
          </div>
        </div>`;
      });
    }

    // 2. New members in my bubbles
    const { data: memberships } = await sb.from('bubble_members').select('bubble_id').eq('user_id', currentUser.id);
    if (memberships && memberships.length > 0) {
      const ids = memberships.map(m => m.bubble_id);
      const since = new Date(Date.now() - 30*24*60*60*1000).toISOString();
      const { data: newMembers } = await sb.from('bubble_members')
        .select('user_id, joined_at, bubble_id, bubbles(name)')
        .in('bubble_id', ids).neq('user_id', currentUser.id)
        .gte('joined_at', since).order('joined_at', {ascending:false}).limit(20);

      if (newMembers && newMembers.length > 0) {
        const userIds = [...new Set(newMembers.map(m => m.user_id))];
        const { data: profiles } = await sb.from('profiles').select('id,name,avatar_url').in('id', userIds);
        const pMap = Object.fromEntries((profiles||[]).map(p=>[p.id,p]));
        newMembers.forEach(m => {
          const p = pMap[m.user_id] || {};
          const initials = (p.name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
          const time = new Date(m.joined_at).toLocaleDateString('da-DK', {day:'numeric',month:'short'});
          html += `<div class="notif-card">
            <div class="notif-header">
              <div class="notif-avatar" style="background:linear-gradient(135deg,#2ECFCF,#8B7FFF)">${initials}</div>
              <div>
                <div class="notif-title">${escHtml(p.name||'Ukendt')} joined</div>
                <div class="notif-sub">${escHtml(m.bubbles?.name||'')} · ${time}</div>
              </div>
            </div>
          </div>`;
        });
      }
    }

    if (!html) {
      html = '<div class="empty-state"><div class="empty-icon">' + icon('bell') + '</div><div class="empty-text">Ingen notifikationer endnu</div></div>';
    }
    list.innerHTML = html;
  } catch(e) { logError("loadNotifications", e); showToast(e.message || "Ukendt fejl"); }
}

async function acceptBubbleInvite(inviteId, fromUserId) {
  try {
    // Update invitation status
    await sb.from('bubble_invitations').update({status:'accepted'}).eq('id', inviteId);
    // Get the bubble_id from invitation
    const { data: inv } = await sb.from('bubble_invitations').select('bubble_id').eq('id', inviteId).single();
    if (inv?.bubble_id) {
      // Add to bubble_members
      await sb.from('bubble_members').insert({bubble_id: inv.bubble_id, user_id: currentUser.id});
      showToast('🫧 Du er nu med i boblen!');
      loadNotifications();
      // Open the bubble chat
      setTimeout(() => openBubbleChat(inv.bubble_id), 800);
    }
  } catch(e) { logError("acceptBubbleInvite", e); showToast(e.message || "Ukendt fejl"); }
}

async function declineBubbleInvite(inviteId) {
  try {
    await sb.from('bubble_invitations').update({status:'declined'}).eq('id', inviteId);
    document.getElementById('invite-' + inviteId)?.remove();
    showToast('Invitation afvist');
  } catch(e) { logError("declineBubbleInvite", e); showToast(e.message || "Ukendt fejl"); }
}

// ══════════════════════════════════════════════════════════
//  BOBLE CHAT
// ══════════════════════════════════════════════════════════
let bcBubbleId = null;
let bcCurrentMsgId = null;
let bcEditingId = null;
let bcMsgHistories = {};
let bcSubscription = null;
let bcBubbleData = null;

// ── REALTIME CLEANUP HELPER ──
function bcUnsubscribe() {
  if (bcSubscription) { bcSubscription.unsubscribe(); bcSubscription = null; }
}
function dmUnsubscribe() {
  if (chatSubscription) { chatSubscription.unsubscribe(); chatSubscription = null; }
}
function incomingUnsubscribe() {
  if (incomingSubscription) { incomingSubscription.unsubscribe(); incomingSubscription = null; }
}
function bcUnsubscribeAll() {
  bcUnsubscribe();
  dmUnsubscribe();
  incomingUnsubscribe();
}

async function openBubbleChat(bubbleId, fromScreen) {
  if (!currentUser || !bubbleId) { console.warn('openBubbleChat: missing user or bubbleId'); return; }
  console.debug('[bc] openBubbleChat:', bubbleId, 'from:', fromScreen);
  try {
    bcBubbleId = bubbleId;
    const backBtn = document.getElementById('bc-back-btn');
    backBtn.onclick = () => goTo(fromScreen || 'screen-bubbles');
    goTo('screen-bubble-chat');

    // Land altid på Medlemmer-tab
    bcSwitchTab('members');

    // Hent boble-info og vis metadata + actions i topbar
    const { data: b } = await sb.from('bubbles').select('*').eq('id', bubbleId).single();
    if (!b) return;
    bcBubbleData = b;

    document.getElementById('bc-emoji').innerHTML = bubbleEmoji(b.type);
    document.getElementById('bc-name').textContent = b.name;

    const { count } = await sb.from('bubble_members').select('*',{count:'exact',head:true}).eq('bubble_id', bubbleId);
    document.getElementById('bc-members-count').textContent = (count||0) + ' medlemmer';

    // Vis actions i topbar baseret på membership
    await loadBubbleUpvotes();
    const { data: myMembership } = await sb.from('bubble_members')
      .select('id').eq('bubble_id', bubbleId).eq('user_id', currentUser.id).single();

    const actionArea = document.getElementById('bc-action-btns');
    const isOwner = b.created_by === currentUser.id;
    if (myMembership) {
      actionArea.innerHTML =
        (isOwner ? `<button class="btn-sm btn-ghost" data-action="openEditBubble" data-id="${b.id}" style="font-size:0.82rem;padding:0.3rem 0.4rem" title="Rediger">${icon("edit")}</button>` : '');
      // Update action bar under tabs
      var actionBar = document.getElementById('bc-action-bar');
      if (actionBar) {
        var upvoted = myUpvotes[b.id];
        actionBar.innerHTML =
          `<button class="bc-bar-btn" onclick="openInviteModal('${b.id}')">${icon('user-plus')} Invitér</button>` +
          `<button class="bc-bar-btn${upvoted ? ' active' : ''}" id="bc-upvote-bar-btn" onclick="toggleBubbleUpvote('${b.id}')">${upvoted ? icon('checkCircle') : icon('rocket')} ${upvoted ? 'Anbefalet' : 'Anbefal'}</button>` +
          `<button class="bc-bar-btn" data-action="openQRModal" data-id="${b.id}">${icon('qrcode')} QR</button>`;
        actionBar.style.display = 'flex';
      }
    } else if (b.visibility === 'hidden') {
      actionArea.innerHTML = `<span style="font-size:0.75rem;color:var(--muted)">${icon("eye")} Kun via invitation</span>`;
      var actionBar2 = document.getElementById('bc-action-bar'); if (actionBar2) actionBar2.style.display = 'none';
    } else if (b.visibility === 'private') {
      actionArea.innerHTML = `<button class="btn-sm btn-accent" data-action="requestJoin" data-id="${b.id}">${icon("lock")} Anmod</button>`;
      var actionBar3 = document.getElementById('bc-action-bar'); if (actionBar3) actionBar3.style.display = 'none';
    } else {
      actionArea.innerHTML = `<button class="btn-sm btn-accent" data-action="joinBubble" data-id="${b.id}">+ Join</button>`;
      var actionBar4 = document.getElementById('bc-action-bar'); if (actionBar4) actionBar4.style.display = 'none';
    }

    // Load data til aktive tabs
    await bcLoadMembers();

    // Load beskeder i baggrunden + subscribe (badge vises hvis der er ulæste)
    bcLoadMessages().then(() => {
      // Tjek om der er nye beskeder siden sidst — vis badge
      const badge = document.getElementById('bc-unread-badge');
      // Badge sættes via real-time subscription når man er på en anden tab
    });
    bcSubscribe();
  } catch(e) { logError("openBubbleChat", e); bcUnsubscribe(); showToast(e.message || "Ukendt fejl"); }
}

async function bcLoadBubbleInfo() {
  try {
    const { data: b } = await sb.from('bubbles').select('*').eq('id', bcBubbleId).single();
    if (!b) return;
    bcBubbleData = b;
    document.getElementById('bc-emoji').innerHTML = bubbleEmoji(b.type);
    document.getElementById('bc-name').textContent = b.name;
    const { count } = await sb.from('bubble_members').select('*',{count:'exact',head:true}).eq('bubble_id', bcBubbleId);
    // Check my LIVE status
    var statusText = (count||0) + ' medlemmer';
    var { data: myM } = await sb.from('bubble_members').select('checked_in_at,checked_out_at').eq('bubble_id', bcBubbleId).eq('user_id', currentUser.id).maybeSingle();
    var isLive = myM && myM.checked_in_at && !myM.checked_out_at && (Date.now() - new Date(myM.checked_in_at).getTime() < 6*3600000);
    var countEl = document.getElementById('bc-members-count');
    if (countEl) {
      if (isLive) {
        var expiry = new Date(new Date(myM.checked_in_at).getTime() + 6*3600000);
        var hh = expiry.getHours().toString().padStart(2,'0');
        var mm = expiry.getMinutes().toString().padStart(2,'0');
        countEl.innerHTML = statusText + ' · <span style="color:#10B981">LIVE</span> <span style="opacity:0.6">udl. ' + hh + ':' + mm + '</span>';
      } else {
        countEl.textContent = statusText + ' · Medlem ✓';
      }
    }
  } catch(e) { logError("bcLoadBubbleInfo", e); showToast(e.message || "Ukendt fejl"); }
}

function bcSwitchTab(tab) {
  ['chat','members','info'].forEach(t => {
    const panel = document.getElementById('bc-panel-'+t);
    const tabBtn = document.getElementById('bc-tab-'+t);
    if (panel) {
      if (t === tab) {
        panel.style.display = 'flex';
        panel.style.flexDirection = 'column';
        panel.style.flex = '1';
        panel.style.overflow = 'hidden';
      } else {
        panel.style.display = 'none';
      }
    }
    if (tabBtn) tabBtn.classList.toggle('active', t === tab);
  });
  if (tab === 'chat') {
    const badge = document.getElementById('bc-unread-badge');
    if (badge) badge.style.display = 'none';
    setTimeout(() => bcScrollToBottom(), 100);
  }
  if (tab === 'info') bcLoadInfo();
}

async function bcLoadMessages() {
  try {
    const el = document.getElementById('bc-messages');
    el.innerHTML = '<div class="spinner"></div>';

    // Hent beskeder uden profiles join — henter profiler separat
    const { data: msgs, error: msgErr } = await sb.from('bubble_messages')
      .select('id, bubble_id, user_id, content, file_url, file_name, file_size, file_type, edited, created_at')
      .eq('bubble_id', bcBubbleId)
      .order('created_at', {ascending:true})
      .limit(50);

    if (msgErr) console.error('bcLoadMessages error:', msgErr);

    if (!msgs || msgs.length === 0) {
      el.innerHTML = '<div class="empty-state" style="margin-top:2rem"><div class="empty-icon">' + icon('chat') + '</div><div class="empty-text">Ingen beskeder endnu.<br>Vær den første!</div></div>';
      return;
    }

    // Hent unikke profiler separat
    const userIds = [...new Set(msgs.map(m => m.user_id))];
    const { data: profiles } = await sb.from('profiles').select('id, name, title, avatar_url').in('id', userIds);
    const profileMap = {};
    (profiles || []).forEach(p => profileMap[p.id] = p);

    el.innerHTML = '';
    let lastDate = '';
    msgs.forEach(m => {
      m.profiles = profileMap[m.user_id] || { name: '?' };
      const d = new Date(m.created_at).toLocaleDateString('da-DK', {weekday:'long', day:'numeric', month:'short'});
      if (d !== lastDate) {
        const sep = document.createElement('div');
        sep.className = 'chat-date-sep';
        sep.textContent = d.toUpperCase();
        el.appendChild(sep);
        lastDate = d;
      }
      el.appendChild(bcRenderMsg(m));
    });
    bcScrollToBottom();
  } catch(e) { logError("bcLoadMessages", e); showToast(e.message || "Ukendt fejl"); }
}

function bcRenderMsg(m) {
  const isMe = m.user_id === currentUser.id;
  const p = m.profiles || {};
  const name = p.name || '?';
  const initials = name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  const time = new Date(m.created_at).toLocaleTimeString('da-DK', {hour:'2-digit', minute:'2-digit'});
  const gradients = ['linear-gradient(135deg,#065F46,#10B981)','linear-gradient(135deg,#7C2D12,#F97316)','linear-gradient(135deg,#1E3A8A,#7C3AED)','linear-gradient(135deg,#4C1D95,#A78BFA)','linear-gradient(135deg,#0C4A6E,#38BDF8)'];
  const color = gradients[Math.abs(name.charCodeAt(0)) % gradients.length];

  const row = document.createElement('div');
  row.className = 'msg-row' + (isMe ? ' me' : '');
  row.id = 'bc-msg-' + m.id;

  // Build content
  let bubble = '';
  if (m.file_url) {
    const ext = m.file_name?.split('.').pop()?.toLowerCase() || '';
    const isImg = ['jpg','jpeg','png','gif','webp'].includes(ext) || (m.file_type||'').startsWith('image/');
    if (isImg) {
      bubble = `<a href="${m.file_url}" target="_blank"><img class="msg-img" src="${m.file_url}" alt="${escHtml(m.file_name||'')}"></a>`;
    } else {
      const sz = m.file_size ? (m.file_size < 1048576 ? Math.round(m.file_size/1024)+'KB' : (m.file_size/1048576).toFixed(1)+'MB') : '';
      bubble = `<a class="msg-file" href="${m.file_url}" target="_blank">${icon('clip')} ${escHtml(m.file_name||'Fil')} <span class="msg-file-sz">${sz}</span></a>`;
    }
  } else {
    bubble = `<div class="msg-bubble${isMe ? ' sent' : ''}" id="bc-bubble-${m.id}">${escHtml(filterChatContent(m.content||''))}</div>`;
  }

  const editedTag = m.edited ? ` <span class="msg-edited" onclick="bcShowHistory('${m.id}')">redigeret</span>` : '';
  const nameHtml = escHtml(name);
  const safeTitle = escHtml(p.title||'');

  // Avatar: use photo if available
  const bcAvUrl = isMe ? currentProfile?.avatar_url : (p.avatar_url || null);
  const bcAvInner = bcAvUrl ? '<img src="'+bcAvUrl+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%">' : initials;

  row.innerHTML =
    `<div class="msg-avatar" style="background:${color};overflow:hidden" onclick="bcOpenPerson('${m.user_id}','${nameHtml}','${safeTitle}','${color}')">${bcAvInner}</div>` +
    `<div class="msg-body">` +
      `<div class="msg-head"><span class="msg-name">${nameHtml}</span><span class="msg-time">${time}${editedTag}</span></div>` +
      `<div class="msg-content">${bubble}<button class="msg-dots" onclick="bcOpenContext(event,this,${isMe},'${m.id}')" aria-label="Mere">⋯</button></div>` +
      `<div class="msg-reactions" id="bc-reactions-${m.id}"></div>` +
    `</div>`;

  setTimeout(() => bcLoadReactions(m.id), 80);
  return row;
}

function bcScrollToBottom() {
  const el = document.getElementById('bc-messages');
  if (el) el.scrollTop = el.scrollHeight;
}

var _profileCache = {};

async function getCachedProfile(userId) {
  if (_profileCache[userId]) return _profileCache[userId];
  var { data: p } = await sb.from('profiles').select('name,title,avatar_url').eq('id', userId).single();
  if (p) _profileCache[userId] = p;
  return p || {};
}

function bcSubscribe() {
  if (!currentUser || !bcBubbleId) { console.warn('bcSubscribe: missing user or bubbleId'); return; }
  console.debug('[bc] bcSubscribe, bubble:', bcBubbleId);
  if (bcSubscription) bcSubscription.unsubscribe();
  bcSubscription = sb.channel('bc-' + bcBubbleId)
    .on('postgres_changes', {event:'INSERT', schema:'public', table:'bubble_messages', filter:`bubble_id=eq.${bcBubbleId}`},
      async (payload) => {
        const m = payload.new;
        if (m.user_id === currentUser.id) return;
        m.profiles = await getCachedProfile(m.user_id);
        const panel = document.getElementById('bc-panel-chat');
        if (panel.style.display !== 'none') {
          document.getElementById('bc-messages').appendChild(bcRenderMsg(m));
          bcScrollToBottom();
        } else {
          const badge = document.getElementById('bc-unread-badge');
          badge.textContent = parseInt(badge.textContent||0) + 1;
          badge.style.display = 'inline-flex';
        }
      })
    .on('postgres_changes', {event:'UPDATE', schema:'public', table:'bubble_messages', filter:`bubble_id=eq.${bcBubbleId}`},
      (payload) => {
        const m = payload.new;
        const bubbleEl = document.getElementById('bc-bubble-' + m.id);
        if (bubbleEl) {
          bubbleEl.textContent = m.content || '';
          const meta = bubbleEl.closest('.chat-msg-group')?.querySelector('.chat-msg-meta');
          if (meta && !meta.querySelector('.chat-msg-edited')) {
            const e = document.createElement('span');
            e.className = 'chat-msg-edited';
            e.textContent = '(redigeret)';
            e.onclick = () => bcShowHistory(m.id);
            meta.appendChild(e);
          }
        }
      })
    .subscribe();
}

let bcSending = false;
async function bcSendMessage() {
  if (bcSending) return;
  bcSending = true;
  var sendBtn = document.getElementById("bc-send-btn");
  if (sendBtn) { sendBtn.disabled = true; sendBtn.style.opacity = "0.4"; }
  console.debug('[bc] bcSendMessage');
  try {
    const inp = document.getElementById('bc-input');
    const text = filterChatContent(inp.value.trim());
    if (!text) { bcSending = false; if (sendBtn) { sendBtn.disabled = false; sendBtn.style.opacity = ''; } return; }

    if (bcEditingId) {
      // Save edit to history first
      const { data: orig } = await sb.from('bubble_messages').select('content').eq('id', bcEditingId).single();
      if (orig) {
        await sb.from('bubble_message_edits').insert({message_id: bcEditingId, content: orig.content});
      }
      await sb.from('bubble_messages').update({content: text, edited: true, updated_at: new Date().toISOString()}).eq('id', bcEditingId);
      // Update local
      const bubbleEl = document.getElementById('bc-bubble-' + bcEditingId);
      if (bubbleEl) {
        bubbleEl.textContent = text;
        const meta = bubbleEl.closest('.chat-msg-group')?.querySelector('.chat-msg-meta');
        if (meta && !meta.querySelector('.chat-msg-edited')) {
          const e = document.createElement('span');
          e.className = 'chat-msg-edited';
          const id = bcEditingId;
          e.textContent = '(redigeret)';
          e.onclick = () => bcShowHistory(id);
          meta.appendChild(e);
        }
      }
      bcCancelEdit();
    } else {
      inp.value = '';

      const { data: newMsg, error } = await sb.from('bubble_messages').insert({
        bubble_id: bcBubbleId,
        user_id: currentUser.id,
        content: text
      }).select('id, bubble_id, user_id, content, file_url, file_name, file_size, file_type, edited, created_at').single();

      if (error) {
        console.error('bcSendMessage insert error:', error);
        showToast('Fejl: ' + (error.message || error.code || 'ukendt'));
        inp.value = text;
        return;
      }

      if (newMsg) {
        newMsg.profiles = {
          id: currentUser.id,
          name: currentProfile?.name || currentUser.email?.split('@')[0] || '?'
        };
        document.getElementById('bc-messages').appendChild(bcRenderMsg(newMsg));
        bcScrollToBottom();
      }
    }
  } catch(e) { logError("bcSendMessage", e); showToast(e.message || "Ukendt fejl"); }
  finally { bcSending = false; var sb3 = document.getElementById("bc-send-btn"); if (sb3) { sb3.disabled = false; sb3.style.opacity = ""; } }
}

async function bcHandleFile(input) {
  try {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { showToast('Maks 10MB per fil'); return; }

    // Sørg for at filen er på chat-tab så bruger kan se progress
    bcSwitchTab('chat');
    showToast('📤 Uploader...');

    // Sanitér filnavn — fjern mellemrum og specialtegn
    const safeFilename = file.name
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // fjern accenter
      .replace(/[^a-zA-Z0-9._-]/g, '_');                 // erstat ugyldige tegn

    const path = `${bcBubbleId}/${Date.now()}-${safeFilename}`;

    const { error: uploadErr } = await sb.storage.from('bubble-files').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type
    });

    if (uploadErr) {
      console.error('Upload error:', uploadErr);
      showToast('Upload fejlede: ' + (uploadErr.message || uploadErr.error || 'ukendt fejl'));
      input.value = '';
      return;
    }

    const { data: urlData } = sb.storage.from('bubble-files').getPublicUrl(path);

    const { data: newMsg, error: msgErr } = await sb.from('bubble_messages').insert({
      bubble_id: bcBubbleId,
      user_id: currentUser.id,
      content: null,
      file_url: urlData.publicUrl,
      file_name: file.name,
      file_size: file.size,
      file_type: file.type
    }).select('id, bubble_id, user_id, content, file_url, file_name, file_size, file_type, edited, created_at').single();

    if (msgErr) {
      console.error('File message insert error:', msgErr);
      showToast('Fil uploadet men besked fejlede');
      input.value = '';
      return;
    }

    if (newMsg) {
      newMsg.profiles = {
        id: currentUser.id,
        name: currentProfile?.name || currentUser.email?.split('@')[0] || '?'
      };
      document.getElementById('bc-messages').appendChild(bcRenderMsg(newMsg));
      bcScrollToBottom();
      showToast('Fil sendt! 📎');
    }
    input.value = '';
  } catch(e) { logError("bcHandleFile", e); showToast(e.message || "Ukendt fejl"); }
}

function bcOpenContext(e, btn, isMe, msgId) {
  e.stopPropagation();
  bcCurrentMsgId = msgId;
  document.getElementById('bc-ctx-edit').style.display = isMe ? 'flex' : 'none';
  document.getElementById('bc-ctx-delete').style.display = isMe ? 'flex' : 'none';
  // Show history if message was edited
  const bubble = document.getElementById('bc-bubble-' + msgId);
  const msgGroup = document.getElementById('bc-msg-' + msgId);
  const wasEdited = msgGroup?.querySelector('.chat-msg-edited');
  document.getElementById('bc-ctx-history').style.display = wasEdited ? 'flex' : 'none';
  const menu = document.getElementById('bc-context-menu');
  menu.style.display = 'block';
  menu.classList.add('open');
  const r = btn.getBoundingClientRect();
  let top = r.bottom + 4;
  let left = isMe ? r.right - 200 : r.left - 5;
  left = Math.max(8, Math.min(left, window.innerWidth - 210));
  if (top + 200 > window.innerHeight) top = r.top - 200;
  menu.style.top = top + 'px';
  menu.style.left = left + 'px';
  setTimeout(() => document.addEventListener('click', bcCloseContext, {once:true}), 10);
}

async function bcReact(emoji) {
  bcCloseContext();
  if (!bcCurrentMsgId) return;
  try {
    // Check if user already reacted with this emoji
    const { data: existing } = await sb.from('bubble_message_reactions')
      .select('id').eq('message_id', bcCurrentMsgId).eq('user_id', currentUser.id).eq('emoji', emoji).maybeSingle();
    if (existing) {
      // Remove reaction
      await sb.from('bubble_message_reactions').delete().eq('id', existing.id);
    } else {
      // Add reaction
      await sb.from('bubble_message_reactions').insert({ message_id: bcCurrentMsgId, user_id: currentUser.id, emoji });
    }
    await bcLoadReactions(bcCurrentMsgId);
  } catch(e) { logError("bcReact", e); showToast(e.message || "Reaktion fejlede"); }
}

async function bcLoadReactions(msgId) {
  try {
    const { data: reactions } = await sb.from('bubble_message_reactions')
      .select('emoji, user_id, profiles(name)').eq('message_id', msgId);
    const el = document.getElementById('bc-reactions-' + msgId);
    if (!el) return;
    if (!reactions || reactions.length === 0) { el.innerHTML = ''; return; }
    // Group by emoji
    const groups = {};
    reactions.forEach(r => {
      if (!groups[r.emoji]) groups[r.emoji] = [];
      groups[r.emoji].push(r.profiles?.name || '?');
    });
    el.innerHTML = Object.entries(groups).map(([emoji, names]) => {
      const mine = reactions.some(r => r.emoji === emoji && r.user_id === currentUser.id);
      return `<button class="chat-reaction-pill${mine ? ' mine' : ''}" onclick="bcToggleReaction('${msgId}','${emoji}')" title="${names.join(', ')}">${emoji} ${names.length}</button>`;
    }).join('');
  } catch(e) { /* silent */ }
}

async function bcToggleReaction(msgId, emoji) {
  bcCurrentMsgId = msgId;
  await bcReact(emoji);
}

function bcCloseContext() {
  const m = document.getElementById('bc-context-menu');
  m.classList.remove('open');
  setTimeout(() => m.style.display='none', 150);
}

function bcStartEdit() {
  if (!bcCurrentMsgId) return;
  bcCloseContext();
  bcEditingId = bcCurrentMsgId;
  const bubbleEl = document.getElementById('bc-bubble-' + bcEditingId);
  if (!bubbleEl) return;
  document.getElementById('bc-input').value = bubbleEl.textContent;
  document.getElementById('bc-input').focus();
  document.getElementById('bc-edit-bar').classList.add('show');
  document.getElementById('bc-send-btn').innerHTML = icon('check');
}

function bcCancelEdit() {
  bcEditingId = null;
  document.getElementById('bc-input').value = '';
  document.getElementById('bc-edit-bar').classList.remove('show');
  document.getElementById('bc-send-btn').textContent = '→';
}

async function bcDeleteMessage() {
  try {
    if (!bcCurrentMsgId) return;
    bcCloseContext();
    await sb.from('bubble_messages').delete().eq('id', bcCurrentMsgId).eq('user_id', currentUser.id);
    document.getElementById('bc-msg-' + bcCurrentMsgId)?.remove();
    showToast('Besked slettet');
  } catch(e) { logError("bcDeleteMessage", e); showToast(e.message || "Ukendt fejl"); }
}

async function bcShowHistory(msgId) {
  try {
    const { data: edits } = await sb.from('bubble_message_edits')
      .select('content, edited_at').eq('message_id', msgId).order('edited_at', {ascending:true});
    const { data: current } = await sb.from('bubble_messages').select('content').eq('id', msgId).single();
    if (!edits || edits.length === 0) { showToast('Ingen historik'); return; }
    const modal = document.getElementById('modal-edit-history') || bcCreateHistoryModal();
    const content = document.getElementById('edit-history-content');
    content.innerHTML = edits.map((e,i) => {
      const t = new Date(e.edited_at).toLocaleTimeString('da-DK',{hour:'2-digit',minute:'2-digit'});
      return `<div style="padding:0.55rem 0;border-bottom:1px solid var(--border)">
        <div style="font-size:0.62rem;color:var(--muted);margin-bottom:0.2rem;font-family:monospace">${i===0?'Originalt':'Redigeret '+i} · ${t}</div>
        <div style="font-size:0.82rem;color:var(--muted)">${escHtml(e.content)}</div>
      </div>`;
    }).join('') + `<div style="padding:0.55rem 0"><div style="font-size:0.62rem;color:var(--muted);margin-bottom:0.2rem;font-family:monospace">Nuværende</div><div style="font-size:0.82rem">${escHtml(current?.content||'')}</div></div>`;
    openModal('modal-edit-history');
  } catch(e) { logError("bcShowHistory", e); showToast(e.message || "Ukendt fejl"); }
}

function bcCreateHistoryModal() {
  const m = document.createElement('div');
  m.id = 'modal-edit-history';
  m.className = 'modal';
  m.innerHTML = `<div class="modal-content"><div class="modal-header"><div class="modal-title">${icon("edit")} Redigeringshistorik</div><button class="modal-close" onclick="closeModal('modal-edit-history')">${icon('x')}</button></div><div id="edit-history-content" style="padding:0 1.25rem 1rem;overflow-y:auto;max-height:60vh"></div></div>`;
  document.getElementById('app-root').appendChild(m);
  return m;
}

async function bcLoadMembers() {
  try {
    const list = document.getElementById('bc-members-list');
    list.innerHTML = '<div class="spinner"></div>';

    const expireCutoff = new Date(Date.now() - LIVE_EXPIRE_HOURS * 60 * 60 * 1000).toISOString();

    const { data: members } = await sb.from('bubble_members')
      .select('user_id, joined_at, checked_in_at, checked_out_at')
      .eq('bubble_id', bcBubbleId)
      .order('joined_at', {ascending:true});

    if (!members || members.length === 0) {
      list.innerHTML = '<div class="empty-state"><div class="empty-icon">' + icon('users') + '</div><div class="empty-text">Ingen medlemmer</div></div>';
      return;
    }

    // Hent profiler separat
    const userIds = members.map(m => m.user_id);
    const { data: profiles } = await sb.from('profiles').select('id, name, title, avatar_url').in('id', userIds);
    const profileMap = {};
    (profiles || []).forEach(p => profileMap[p.id] = p);

    // Determine live status per member
    const now = Date.now();
    members.forEach(m => {
      m._isLive = m.checked_in_at && !m.checked_out_at &&
        new Date(m.checked_in_at).getTime() > (now - LIVE_EXPIRE_HOURS * 3600000);
    });

    const colors = ['linear-gradient(135deg,#065F46,#10B981)','linear-gradient(135deg,#7C2D12,#F97316)','linear-gradient(135deg,#1E3A8A,#7C3AED)','linear-gradient(135deg,#4C1D95,#A78BFA)','linear-gradient(135deg,#0C4A6E,#38BDF8)'];
    const ownerId = bcBubbleData?.created_by;
    const isOwner = currentUser && ownerId === currentUser.id;

    // Sort: owner first, then live members, then rest
    const sorted = [...members].filter(m => !isBlocked(m.user_id)).sort((a, b) => {
      if (a.user_id === ownerId) return -1;
      if (b.user_id === ownerId) return 1;
      if (a._isLive && !b._isLive) return -1;
      if (!a._isLive && b._isLive) return 1;
      return 0;
    });

    const liveCount = members.filter(m => m._isLive).length;

    let html = '';
    let prevSection = '';
    sorted.forEach((m, i) => {
      const p = profileMap[m.user_id] || {};
      const initials = (p.name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
      const color = colors[i % colors.length];
      const isOwnerRow = m.user_id === ownerId;

      // Section labels
      let section = isOwnerRow ? 'owner' : (m._isLive ? 'live' : 'members');
      if (section !== prevSection) {
        if (section === 'owner') html += `<div class="chat-section-label">Ejer</div>`;
        else if (section === 'live') html += `<div class="chat-section-label" style="margin-top:0.8rem">Her lige nu · ${liveCount}</div>`;
        else html += `<div class="chat-section-label" style="margin-top:0.8rem">Medlemmer · ${members.length - liveCount - (ownerId ? 1 : 0)}</div>`;
        prevSection = section;
      }

      const liveBadge = m._isLive ? '<span class="live-badge-mini">LIVE</span>' : '';

      html += `<div class="chat-member-row" data-member-uid="${m.user_id}" onclick="bcOpenPerson('${m.user_id}','${escHtml(p.name||'')}','${escHtml(p.title||'')}','${color}')">
        <div class="chat-member-avatar" style="background:${color}">${initials}${m._isLive ? '<span class="live-dot"></span>' : ''}</div>
        <div style="flex:1;min-width:0"><div class="chat-member-name">${escHtml(p.name||'Ukendt')} ${liveBadge}</div><div class="chat-member-status">${escHtml(p.title||'')}</div></div>
        ${isOwnerRow ? '<span class="chat-member-role">Ejer</span>' : (isOwner && !isOwnerRow ? '<button class="bc-kick-btn" onclick="event.stopPropagation();bcShowKickConfirm(this,\'' + m.user_id + '\',\'' + escHtml(p.name||'Ukendt').replace(/'/g,'') + '\')" title="Fjern fra boble">' + icon('x') + '</button>' : '')}
      </div>`;
    });
    list.innerHTML = html;
  } catch(e) { logError("bcLoadMembers", e); showToast(e.message || "Ukendt fejl"); }
}

// ── Bubble owner: kick/remove member (inline confirm tray) ──
function bcShowKickConfirm(btn, userId, userName) {
  var row = btn.closest('.chat-member-row');
  if (!row || row.querySelector('.kick-confirm')) return;
  var confirm = document.createElement('div');
  confirm.className = 'kick-confirm';
  confirm.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:0.5rem 0.6rem;margin-top:0.4rem;background:rgba(232,93,138,0.08);border:1px solid rgba(232,93,138,0.2);border-radius:10px;gap:0.5rem';
  confirm.onclick = function(e) { e.stopPropagation(); };
  confirm.innerHTML = '<span style="font-size:0.72rem;color:var(--text-secondary)">Fjern ' + userName + '?</span>' +
    '<div style="display:flex;gap:0.3rem">' +
    '<button class="btn-sm btn-ghost" style="padding:0.25rem 0.6rem;font-size:0.7rem;color:var(--accent2);border-color:rgba(232,93,138,0.3)" onclick="event.stopPropagation();bcConfirmKick(\'' + userId + '\',\'' + userName + '\')">Fjern</button>' +
    '<button class="btn-sm btn-ghost" style="padding:0.25rem 0.6rem;font-size:0.7rem" onclick="event.stopPropagation();bcCancelKick(this)">Annuller</button>' +
    '</div>';
  row.appendChild(confirm);
}

function bcCancelKick(btn) {
  var confirm = btn.closest('.kick-confirm');
  if (confirm) confirm.remove();
}

async function bcConfirmKick(userId, userName) {
  if (!bcBubbleId || !currentUser) return;
  if (bcBubbleData?.created_by !== currentUser.id) { showToast('Kun ejeren kan fjerne medlemmer'); return; }
  try {
    var { error } = await sb.from('bubble_members').delete()
      .eq('bubble_id', bcBubbleId).eq('user_id', userId);
    if (error) throw error;
    showToast(userName + ' er fjernet fra boblen');
    bcLoadMembers();
  } catch(e) { logError('bcConfirmKick', e, { bubbleId: bcBubbleId, userId: userId }); showToast('Fejl: ' + (e.message || 'ukendt')); }
}

async function bcLoadInfo() {
  try {
    const list = document.getElementById('bc-info-list');
    if (!bcBubbleData) await bcLoadBubbleInfo();
    const b = bcBubbleData;
    if (!b) return;
    const tags = (b.keywords||[]).map(k=>`<span class="tag">${escHtml(k)}</span>`).join('');
    list.innerHTML = `
      <div class="chat-info-block"><div class="chat-info-label">Beskrivelse</div><div class="chat-info-val">${escHtml(b.description||'Ingen beskrivelse')}</div></div>
      <div class="chat-info-block"><div class="chat-info-label">Interesser</div><div style="display:flex;flex-wrap:wrap;gap:0.4rem;margin-top:0.4rem">${tags||'–'}</div></div>
      <div class="chat-info-block"><div class="chat-info-label">Boble-type</div><div class="chat-info-val">${typeLabel(b.type)}</div></div>
      <div class="chat-info-block"><div class="chat-info-label">Sted</div><div class="chat-info-val">${escHtml(b.location||'Ikke angivet')}</div></div>
      <div>
        <button class="${myUpvotes[b.id] ? 'chat-info-btn success' : 'chat-info-btn primary'}" id="bc-recommend-btn" onclick="toggleBubbleUpvote('${b.id}')">${myUpvotes[b.id] ? icon('checkCircle') + ' Anbefalet' : icon('rocket') + ' Anbefal denne boble'}</button>
        <button class="chat-info-btn primary" data-action="openQRModal" data-id="${b.id}">${icon("qrcode")} Del boble / QR-kode</button>
        <button class="chat-info-btn danger" data-action="leaveBubble" data-id="${b.id}">${icon("logout")} Forlad boblen</button>
      </div>`;
  } catch(e) { logError("bcLoadInfo", e); showToast(e.message || "Ukendt fejl"); }
}

// Person sheet from chat avatar

// ══════════════════════════════════════════════════════════
//  BUBBLE INVITE SYSTEM
// ══════════════════════════════════════════════════════════
var inviteBubbleId = null;
var inviteSelected = [];

async function openInviteModal(bubbleId) {
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
    var colors = proxColors || ['linear-gradient(135deg,#8B7FFF,#E85D8A)'];
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
      psAv.innerHTML = '<img src="' + data.avatar_url + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%">';
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
    bcOpenPerson(userId, p?.name || 'Ukendt', p?.title || '', 'linear-gradient(135deg,#8B7FFF,#E85D8A)', 'screen-chat');
  } catch(e) { logError('dmOpenPersonSheet', e); }
}


function psClose() {
  var sheet = document.getElementById('person-sheet-el');
  if (sheet) { sheet.classList.remove('open'); sheet.style.transform = ''; }
  document.getElementById('ps-bubbleup-btn').style.display = 'flex';
  document.getElementById('ps-bubbleup-confirm').classList.remove('show');
  setTimeout(() => document.getElementById('ps-overlay').classList.remove('open'), 320);
}

// ══════════════════════════════════════════════════════════
//  BLOCK & REPORT
// ══════════════════════════════════════════════════════════
var _blockedUsers = [];

async function loadBlockedUsers() {
  try {
    if (!currentUser) return;
    var { data } = await sb.from('blocked_users').select('blocked_id').eq('user_id', currentUser.id);
    _blockedUsers = (data || []).map(function(r) { return r.blocked_id; });
  } catch(e) { logError('loadBlockedUsers', e); }
}

function isBlocked(userId) {
  return _blockedUsers.indexOf(userId) >= 0;
}

var _blockConfirm = null;
async function psBlockUser() {
  var userId = document.getElementById('person-sheet-el')?.dataset?.userId;
  var userName = document.getElementById('person-sheet-el')?.dataset?.userName || 'bruger';
  if (!userId || !currentUser) return;
  if (userId === currentUser.id) { showToast('Du kan ikke blokere dig selv'); return; }
  // Confirm
  if (_blockConfirm !== userId) {
    _blockConfirm = userId;
    showToast('Blokér ' + userName + '? Tryk igen for at bekræfte');
    setTimeout(function() { _blockConfirm = null; }, 3000);
    return;
  }
  _blockConfirm = null;
  try {
    await sb.from('blocked_users').upsert({
      user_id: currentUser.id, blocked_id: userId
    }, { onConflict: 'user_id,blocked_id' });
    _blockedUsers.push(userId);
    // Also remove from saved contacts if saved
    await sb.from('saved_contacts').delete().eq('user_id', currentUser.id).eq('contact_id', userId);
    psClose();
    showToast(userName + ' er blokeret');
    // Refresh visible lists
    if (typeof loadProximityMap === 'function') loadProximityMap();
    if (typeof loadSavedContacts === 'function') loadSavedContacts();
  } catch(e) { logError('psBlockUser', e, { blocked: userId }); showToast('Fejl: ' + (e.message || 'ukendt')); }
}

var _reportConfirm = null;
async function psReportUser() {
  var userId = document.getElementById('person-sheet-el')?.dataset?.userId;
  var userName = document.getElementById('person-sheet-el')?.dataset?.userName || 'bruger';
  if (!userId || !currentUser) return;
  // Confirm
  if (_reportConfirm !== userId) {
    _reportConfirm = userId;
    showToast('Rapportér ' + userName + '? Tryk igen for at bekræfte');
    setTimeout(function() { _reportConfirm = null; }, 4000);
    return;
  }
  _reportConfirm = null;
  try {
    await sb.from('reports').insert({
      reporter_id: currentUser.id,
      reported_id: userId,
      type: 'user',
      reason: 'Rapporteret fra person sheet'
    });
    // Also send email alert
    logError('USER_REPORT', new Error('Bruger rapporteret: ' + userName), { reported_id: userId, reporter_id: currentUser.id });
    showToast('Tak — ' + userName + ' er rapporteret. Vi kigger på det.');
  } catch(e) { logError('psReportUser', e); showToast('Fejl: ' + (e.message || 'ukendt')); }
}

// Report a specific message
async function reportMessage(msgId, context) {
  if (!currentUser || !msgId) return;
  try {
    await sb.from('reports').insert({
      reporter_id: currentUser.id,
      reported_id: null,
      type: 'message',
      reason: 'Besked rapporteret',
      ref_id: msgId
    });
    logError('MSG_REPORT', new Error('Besked rapporteret'), { msg_id: msgId, context: context, reporter: currentUser.id });
    showToast('Besked rapporteret. Tak!');
  } catch(e) { logError('reportMessage', e); showToast('Fejl: ' + (e.message || 'ukendt')); }
}

// Simple chat word filter
var CHAT_BLOCKED_WORDS = ['fuck','shit','dick','pik','lort','nazi','hitler','heil','kill','slut','whore','luder','bøsse'];
function filterChatContent(text) {
  if (!text) return text;
  var lower = text.toLowerCase();
  var flagged = false;
  CHAT_BLOCKED_WORDS.forEach(function(w) {
    if (lower.includes(w)) {
      flagged = true;
      var re = new RegExp(w, 'gi');
      text = text.replace(re, '***');
    }
  });
  if (flagged) {
    logError('CONTENT_FILTER', new Error('Filtreret indhold'), { original_length: text.length, user: currentUser?.id });
  }
  return text;
}

function psSetStar(userId, rating) {
  var current = starGet(userId);
  // Tap same star = remove all
  var newRating = (current === rating) ? 0 : rating;
  starSet(userId, newRating);
  // Update stars UI
  var starsEl = document.getElementById('ps-stars');
  if (starsEl) {
    starsEl.innerHTML = [1,2,3].map(function(n) {
      return '<div class="ps-star ' + (n <= newRating ? 'filled' : 'empty') + '" onclick="psSetStar(\'' + userId + '\',' + n + ')">\u2605</div>';
    }).join('');
  }
  // Refresh saved contacts list in background
  loadSavedContacts();
}

function personSetStar(userId, rating) {
  var current = starGet(userId);
  var newRating = (current === rating) ? 0 : rating;
  starSet(userId, newRating);
  var el = document.getElementById('person-star-rating');
  if (el) {
    el.innerHTML = [1,2,3].map(function(n) {
      return '<div class="ps-star ' + (n <= newRating ? 'filled' : 'empty') + '" onclick="personSetStar(\'' + userId + '\',' + n + ')">\u2605</div>';
    }).join('');
  }
  loadSavedContacts();
}


function psMessage() { const uid = document.getElementById('person-sheet-el').dataset.userId; const from = document.getElementById('person-sheet-el').dataset.fromScreen || 'screen-home'; psClose(); setTimeout(() => openChat(uid, from), 350); }
function psProfile() { const uid = document.getElementById('person-sheet-el').dataset.userId; const from = document.getElementById('person-sheet-el').dataset.fromScreen || 'screen-home'; psClose(); setTimeout(() => openPerson(uid, from), 350); }
// psMeeting removed — feature shelved

function psTriggerBubbleUp() {
  const name = document.getElementById('person-sheet-el').dataset.userName?.split(' ')[0] || 'personen';
  document.getElementById('ps-bubbleup-name').textContent = name;
  document.getElementById('ps-bubbleup-btn').style.display = 'none';
  document.getElementById('ps-bubbleup-confirm').classList.add('show');
}

function psCancelBubbleUp() {
  document.getElementById('ps-bubbleup-btn').style.display = 'flex';
  document.getElementById('ps-bubbleup-confirm').classList.remove('show');
}

async function psConfirmBubbleUp() {
  try {
    const toUserId = document.getElementById('person-sheet-el').dataset.userId;
    const name = document.getElementById('person-sheet-el').dataset.userName?.split(' ')[0] || 'personen';
    await sendBubbleUpInvitation(toUserId);
    psClose();
    showToast('🫧 Invitation sendt til ' + name + '!');
  } catch(e) { logError("psConfirmBubbleUp", e); showToast(e.message || "Ukendt fejl"); }
}

// Bubble-up from screen-person
function personTriggerBubbleUp() {
  const name = (document.getElementById('person-name')?.textContent||'').split(' ')[0] || 'personen';
  document.getElementById('person-bubbleup-name').textContent = name;
  document.getElementById('person-bubbleup-btn').style.display = 'none';
  document.getElementById('person-bubbleup-confirm').classList.add('show');
}

function personCancelBubbleUp() {
  document.getElementById('person-bubbleup-btn').style.display = 'flex';
  document.getElementById('person-bubbleup-confirm').classList.remove('show');
}

async function personConfirmBubbleUp() {
  try {
    if (!currentPerson) return;
    const name = (document.getElementById('person-name')?.textContent||'').split(' ')[0] || 'personen';
    await sendBubbleUpInvitation(currentPerson);
    personCancelBubbleUp();
    showToast('🫧 Invitation sendt til ' + name + '!');
  } catch(e) { logError("personConfirmBubbleUp", e); showToast(e.message || "Ukendt fejl"); }
}

async function sendBubbleUpInvitation(toUserId) {
  try {
    // Create a hidden private bubble first
    const myName = currentProfile?.name || 'Min boble';
    const theirName = (document.getElementById('person-name')?.textContent || document.getElementById('ps-name')?.textContent || '');
    const { data: bubble } = await sb.from('bubbles').insert({
      name: myName.split(' ')[0] + ' & ' + (theirName.split(' ')[0] || 'ven'),
      type: 'standard',
      visibility: 'hidden',
      created_by: currentUser.id,
      description: 'Privat boble'
    }).select().single();

    if (!bubble) { showToast('Noget gik galt'); return; }

    // Add creator as member
    await sb.from('bubble_members').insert({bubble_id: bubble.id, user_id: currentUser.id});

    // Send invitation
    await sb.from('bubble_invitations').insert({
      bubble_id: bubble.id,
      from_user_id: currentUser.id,
      to_user_id: toUserId
    });
  } catch(e) { logError("sendBubbleUpInvitation", e); showToast(e.message || "Ukendt fejl"); }
}


// ══════════════════════════════════════════════════════════
//  CHAT INPUT EVENT LISTENERS (bind exactly once on load)
// ══════════════════════════════════════════════════════════
window.addEventListener('load', () => {
  const bcInput = document.getElementById('bc-input');
  if (bcInput) {
    bcInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        bcSendMessage();
      }
    }, { passive: false });
  }

  const dmInput = document.getElementById('chat-input');
  if (dmInput) {
    dmInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (!currentChatUser) return;
        sendMessage();
      }
    }, { passive: false });
  }

  const dmFileInput = document.getElementById('dm-file-input');
  if (dmFileInput) {
    dmFileInput.addEventListener('change', () => dmHandleFile(dmFileInput));
  }

  // Onboarding strength meter — listen on all fields
  ['ob-name','ob-title','ob-bio','ob-linkedin','ob-workplace'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('input', updateObStrength);
  });
});
// Login/signup Enter key handling
document.getElementById('login-password')?.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') { e.preventDefault(); handleLogin(); }
});
document.getElementById('login-email')?.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') { e.preventDefault(); document.getElementById('login-password').focus(); }
});
document.getElementById('signup-password')?.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') { e.preventDefault(); handleSignup(); }
});


// ══════════════════════════════════════════════════════════
//  GLOBAL EVENT DELEGATION
// ══════════════════════════════════════════════════════════
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;
  const id = el.dataset.id;
  const from = el.dataset.from;
  switch (action) {
    case 'openBubble': openBubble(id); break;
    case 'openPerson': openPerson(id, from); break;
    case 'openChat': openChat(id, from); break;
    case 'joinBubble': joinBubble(id); break;
    case 'requestJoin': requestJoin(id); break;
    case 'openQRModal': openQRModal(id); break;
    case 'leaveBubble': leaveBubble(id); break;
    case 'openEditBubble': openEditBubble(id); break;
    case 'openBubbleChat': openBubbleChat(id, from); break;
  }
});

// ══════════════════════════════════════════════════════════
//  PULL-TO-REFRESH
// ══════════════════════════════════════════════════════════
(function initPullToRefresh() {
  if (isDesktop) return; // No PTR on desktop
  const PTR_THRESHOLD = 100;  // px to pull before triggering
  const PTR_MAX = 120;        // max indicator travel
  const PTR_RESISTANCE = 3;   // finger-to-indicator ratio

  // Map: screen ID → { scrollEl selector, refreshFn }
  const screenMap = {
    'screen-home':          { scroll: '#home-scroll', fn: loadHome },
    'screen-bubbles':       { scroll: '#screen-bubbles .scroll-area', fn: loadMyBubbles },
    'screen-discover':      { scroll: '#screen-discover .scroll-area', fn: loadDiscover },
    'screen-messages':      { scroll: '#screen-messages .scroll-area', fn: loadMessages },
    'screen-notifications': { scroll: '#screen-notifications .scroll-area', fn: loadNotifications },
    'screen-profile':       { scroll: null, fn: loadProfile }, // uses active panel
  };

  // Create the indicator element
  const indicator = document.createElement('div');
  indicator.className = 'ptr-indicator';
  indicator.innerHTML = '<div class="ptr-spinner"></div>';
  document.body.appendChild(indicator);

  let startY = 0;
  let pulling = false;
  let refreshing = false;

  function getScrollEl() {
    const active = document.querySelector('.screen.active');
    if (!active) return null;
    const cfg = screenMap[active.id];
    if (!cfg) return null;

    // Profile: find the visible panel
    if (active.id === 'screen-profile') {
      return active.querySelector('[id^="prof-panel-"]:not([style*="display:none"]):not([style*="display: none"])') ||
             active.querySelector('[id^="prof-panel-"]');
    }
    return cfg.scroll ? document.querySelector(cfg.scroll) : active.querySelector('.scroll-area');
  }

  function getRefreshFn() {
    const active = document.querySelector('.screen.active');
    if (!active) return null;
    const cfg = screenMap[active.id];
    return cfg?.fn || null;
  }

  document.addEventListener('touchstart', (e) => {
    if (refreshing) return;
    const scrollEl = getScrollEl();
    if (!scrollEl) return;
    if (scrollEl.scrollTop > 5) return; // only when at top
    startY = e.touches[0].clientY;
    pulling = true;
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (!pulling || refreshing) return;
    const scrollEl = getScrollEl();
    if (!scrollEl || scrollEl.scrollTop > 5) { pulling = false; return; }

    const dy = (e.touches[0].clientY - startY) / PTR_RESISTANCE;
    if (dy < 0) return;

    const travel = Math.min(dy, PTR_MAX);
    indicator.style.transform = `translateX(-50%) translateY(${travel - 40}px)`;
    indicator.style.opacity = Math.min(travel / PTR_THRESHOLD, 1);
    indicator.classList.add('visible');

    if (travel >= PTR_THRESHOLD) {
      indicator.classList.add('ready');
    } else {
      indicator.classList.remove('ready');
    }
  }, { passive: true });

  document.addEventListener('touchend', async () => {
    if (!pulling) return;
    pulling = false;

    if (!indicator.classList.contains('ready')) {
      resetIndicator();
      return;
    }

    const fn = getRefreshFn();
    if (!fn) { resetIndicator(); return; }

    // Trigger refresh
    refreshing = true;
    indicator.classList.add('refreshing');
    indicator.classList.remove('ready');
    indicator.style.transform = 'translateX(-50%) translateY(20px)';
    indicator.style.opacity = '1';

    try {
      await fn();
    } catch(e) { logError('PTR refresh error', e); }

    refreshing = false;
    indicator.classList.remove('refreshing');
    resetIndicator();
    showToast('Opdateret');
  }, { passive: true });

  function resetIndicator() {
    indicator.style.transition = 'transform 0.3s, opacity 0.3s';
    indicator.style.transform = 'translateX(-50%) translateY(-40px)';
    indicator.style.opacity = '0';
    setTimeout(() => {
      indicator.classList.remove('visible', 'ready', 'refreshing');
      indicator.style.transition = '';
    }, 300);
  }
})();

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
      const since = new Date(currentLiveBubble.checked_in_at);
      const mins = Math.round((Date.now() - since.getTime()) / 60000);
      const timeStr = mins < 60 ? mins + ' min' : Math.round(mins / 60) + 't ' + (mins % 60) + 'min';
      const typeLabel = myLive.bubbles.type_label || myLive.bubbles.type || '';
      document.getElementById('live-bubble-meta').textContent =
        (typeLabel ? typeLabel + ' · ' : '') +
        (currentLiveBubble.bubble_location ? currentLiveBubble.bubble_location + ' · ' : '') +
        timeStr + ' siden';
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
  loadLiveCheckinList();
  openModal('modal-live-checkin');
  // Reset scanner state
  var confirmed = document.getElementById('live-scan-confirmed');
  if (confirmed) confirmed.style.display = 'none';
  var found = document.getElementById('live-scan-found');
  if (found) found.style.display = 'none';
  var status = document.getElementById('live-scan-status');
  if (status) { status.textContent = 'Starter kamera...'; status.className = 'live-scan-status'; }
  startLiveCamera();
}

function closeLiveCheckinModal() {
  stopLiveCamera();
  closeModal('modal-live-checkin');
}

async function loadLiveCheckinList() {
  const list = document.getElementById('live-checkin-list');
  list.innerHTML = '<div class="spinner"></div>';
  try {
    const expireCutoff = new Date(Date.now() - LIVE_EXPIRE_HOURS * 60 * 60 * 1000).toISOString();

    // Get all live bubbles with recent activity
    const { data: liveBubbles } = await sb.from('bubbles')
      .select('id, name, location, created_at')
      .eq('type', 'live')
      .order('created_at', { ascending: false })
      .limit(20);

    if (!liveBubbles || liveBubbles.length === 0) {
      list.innerHTML = '<div class="sub-muted" style="padding:0.5rem 0;text-align:center">Ingen aktive steder. Opret det første!</div>';
      return;
    }

    // Get active member counts for each
    const bubbleIds = liveBubbles.map(b => b.id);
    const { data: activeMembers } = await sb.from('bubble_members')
      .select('bubble_id')
      .in('bubble_id', bubbleIds)
      .not('checked_in_at', 'is', null)
      .is('checked_out_at', null)
      .gte('checked_in_at', expireCutoff);

    const countMap = {};
    (activeMembers || []).forEach(m => {
      countMap[m.bubble_id] = (countMap[m.bubble_id] || 0) + 1;
    });

    // Filter to only show bubbles with active members OR created recently (last 24h)
    const recentCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const filtered = liveBubbles.filter(b => (countMap[b.id] || 0) > 0 || b.created_at > recentCutoff);

    if (filtered.length === 0) {
      list.innerHTML = '<div class="sub-muted" style="padding:0.5rem 0;text-align:center">Ingen aktive steder lige nu. Opret det første!</div>';
      return;
    }

    list.innerHTML = filtered.map(b => {
      const cnt = countMap[b.id] || 0;
      return `<div class="live-checkin-item" onclick="liveCheckin('${b.id}')">
        <div class="live-checkin-icon">${ico('pin')}</div>
        <div style="flex:1;min-width:0">
          <div class="fw-600 fs-085">${escHtml(b.name)}</div>
          <div class="fs-072 text-muted">${escHtml(b.location || '')}</div>
        </div>
        ${cnt > 0 ? '<div class="live-checkin-count"><div class="live-dot" style="width:6px;height:6px;margin:0"></div> ' + cnt + '</div>' : '<div class="fs-072 text-muted">0 her</div>'}
      </div>`;
    }).join('');
  } catch (e) {
    logError('loadLiveCheckinList', e);
    list.innerHTML = '<div class="sub-muted" style="padding:0.5rem 0">Kunne ikke hente steder</div>';
  }
}

async function liveCheckin(bubbleId) {
  try {
    showToast('Checker ind...');

    // 1. Auto-checkout from any current live bubble
    await liveAutoCheckout();

    // 2. Check if already a member
    const { data: existing } = await sb.from('bubble_members')
      .select('id, checked_in_at, checked_out_at')
      .eq('bubble_id', bubbleId)
      .eq('user_id', currentUser.id)
      .maybeSingle();

    if (existing) {
      // Re-check-in
      await sb.from('bubble_members').update({
        checked_in_at: new Date().toISOString(),
        checked_out_at: null
      }).eq('id', existing.id);
    } else {
      // New member + check-in
      await sb.from('bubble_members').insert({
        bubble_id: bubbleId,
        user_id: currentUser.id,
        checked_in_at: new Date().toISOString()
      });
    }

    closeLiveCheckinModal();
    showToast('📍 Du er checked ind!');
    await loadLiveBubbleStatus();
    loadHome();
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
}

function stopLiveCamera() {
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
        console.log('[QR] Using native BarcodeDetector');
        return;
      }
    } catch(e) {}
  }
  _useNativeDetector = false;
  console.log('[QR] Using jsQR fallback');
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
  _liveQrPending = true;
  var status = document.getElementById('live-scan-status');
  if (status) { status.textContent = 'QR fundet — henter info...'; status.className = 'live-scan-status found'; }
  
  // Parse QR data
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





//  APP BOOT
// ══════════════════════════════════════════════════════════
window.addEventListener('load', async () => {
  await checkAuth();
  await checkQRJoin();
  await checkPendingJoin();
  if (currentUser) {
    updateUnreadBadge();
    subscribeToIncoming();
    loadLiveBubbleStatus();
  }
  // Init swipe-to-close on all sheets/modals
  initAllSwipeClose();
  initInputConfirmButtons();

  // iOS keyboard dismiss: blur active input when tapping outside inputs
  document.addEventListener('touchstart', function(e) {
    var active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
      if (e.target !== active && !e.target.closest('.input-wrap') && !e.target.closest('.chips-container') && !e.target.closest('.ob-cat-custom-row') && !e.target.closest('.tag-suggestions')) {
        active.blur();
      }
    }
  }, { passive: true });
});
