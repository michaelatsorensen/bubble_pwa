// ══════════════════════════════════════════════════════════
//  BUBBLE — AUTH + LOGIN + SIGNUP + TERMS + FEEDBACK
//  Auto-split from app.js · v3.7.0
// ══════════════════════════════════════════════════════════

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
      const { data: existingProfile } = await sb.from('profiles').select('id').eq('id', session.user.id).maybeSingle();
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
      if (!needsOnboarding) {
        goTo('screen-home');
        preloadAllData();
        initGlobalRealtime();
        updateUnreadBadge();
        updateNotifNavBadge();
        loadLiveBubbleStatus();
        initPushNotifications();
      }
    } else {
      goTo('screen-auth');
    }
  } catch(e) {
    var el = document.getElementById('loading-msg');
    if (el) { el.textContent = 'Fejl: ' + (e.message || 'Ukendt'); el.style.color = '#6B8BFF'; }
    logError('checkAuth', e);
  }
}

function setupAuthListener() {
  sb.auth.onAuthStateChange((event, session) => {
    console.debug('[auth] state change:', event);
    if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
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
      // Check if user is banned
      if (data.banned) {
        await sb.auth.signOut();
        showToast('Din konto er blevet suspenderet. Kontakt hello@bubble.app');
        goTo('screen-auth');
        return;
      }
      currentProfile = data;
      updateHomeAvatar();
    }
  } catch(e) { logError("loadCurrentProfile", e); showToast(e.message || "Ukendt fejl"); }
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
  closeBtn.style.cssText = 'position:absolute;top:1.5rem;right:1.5rem;width:36px;height:36px;border-radius:50%;background:rgba(30,27,46,0.06);color:white;display:flex;align-items:center;justify-content:center;font-size:1rem;cursor:pointer';
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
    if (!needsOnboarding) {
      goTo('screen-home');
      preloadAllData();
      initGlobalRealtime();
      updateUnreadBadge();
      updateNotifNavBadge();
      loadLiveBubbleStatus();
      initPushNotifications();
    }
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
    if (!needsOnboarding) {
      goTo('screen-home');
      preloadAllData();
      initGlobalRealtime();
      updateUnreadBadge();
      updateNotifNavBadge();
      loadLiveBubbleStatus();
      initPushNotifications();
    }
    showSuccessToast('Velkommen til Bubble');
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
  var interests = document.getElementById('auth-interests');
  var forms = document.getElementById('auth-forms');
  if (splash) { splash.style.transition = 'opacity 0.3s'; splash.style.opacity = '0'; setTimeout(function(){ splash.style.display = 'none'; }, 300); }
  if (interests) { interests.style.transition = 'opacity 0.3s'; interests.style.opacity = '0'; setTimeout(function(){ interests.style.display = 'none'; }, 300); }
  if (forms) { forms.style.display = 'block'; forms.style.opacity = '0'; setTimeout(function(){ forms.style.transition = 'opacity 0.3s'; forms.style.opacity = '1'; }, 50); }
}

function completeInterestPicker() {
  localStorage.setItem('bubble_interests_done', '1');
  // Also save selected interests for onboarding tag recommendations
  if (_selectedInterests.length > 0) {
    localStorage.setItem('bubble_selected_interests', JSON.stringify(_selectedInterests));
  }
  showAuthForms();
}

function showInterestPicker() {
  // Skip if user has already completed interest picker
  if (localStorage.getItem('bubble_interests_done')) {
    showAuthForms();
    return;
  }
  // Try social proof screen first (opsøgende flow)
  loadSocialProofScreen().then(function(shown) {
    if (!shown) {
      // Not enough users for social proof — go to interest picker
      showInterestPickerDirect();
    }
  }).catch(function() {
    showInterestPickerDirect();
  });
}

function showInterestPickerDirect() {
  var splash = document.getElementById('auth-splash');
  var interests = document.getElementById('auth-interests');
  if (splash) { splash.style.transition = 'opacity 0.3s'; splash.style.opacity = '0'; setTimeout(function(){ splash.style.display = 'none'; }, 300); }
  if (interests) { interests.style.display = 'block'; interests.style.opacity = '0'; setTimeout(function(){ interests.style.transition = 'opacity 0.3s'; interests.style.opacity = '1'; }, 50); }
  // Populate SVG icons
  var iconMap = { startup:'rocket', tech:'cpu', sustainability:'leaf', leadership:'crown', public:'building', industry:'wrench', health:'heart', education:'graduation', creative:'palette', commerce:'briefcase', community:'globe' };
  document.querySelectorAll('.interest-btn').forEach(function(btn) {
    var key = btn.dataset.interest;
    var icoEl = btn.querySelector('.interest-ico');
    if (icoEl && iconMap[key]) icoEl.innerHTML = ico(iconMap[key]);
  });
}

// ── Interest picker state ──
var _selectedInterests = (function() {
  try { var s = localStorage.getItem('bubble_selected_interests'); return s ? JSON.parse(s) : []; } catch(e) { return []; }
})();
var _interestTagMap = {
  startup: ['SaaS','Fintech','Founder','Co-Founder','Iværksætter','Lean Startup','Entrepreneurship','Skalering','Marketplace','Platform','Fundraising','Growth Hacking','Startup Økosystem','Iværksætterkultur','Serial Entrepreneur'],
  tech: ['AI/ML','SaaS','Cloud','IoT','Deep Tech','Frontend','Backend','Machine Learning','DevOps','Cybersecurity','Developer','Software Engineer','Data Scientist','Python','React','TypeScript','Robotics','Embedded','Blockchain'],
  sustainability: ['Cleantech','Energi','Climate Action','Bæredygtighed','ESG','Sustainability','Grøn Omstilling','Carbon Accounting','Vindenergi','Solenergi','Circular Economy','Biodiversitet','Regenerativt Landbrug'],
  leadership: ['Leadership','Strategy','Management','Director','CEO','Projektledelse','Operations','Consulting','People Ops','Talent Acquisition','Forretningsudvikling','OKR','Intrapreneurship'],
  public: ['GovTech','NGO','Kommune','Region','Stat','Forening','Socialøkonomi','Frivilligsektor','Velfærdsteknologi','Smart Cities','Social Impact','Civic Tech','Velfærdsinnovation'],
  industry: ['Byggeri','Produktion','Industri','Energi','Landbrug','Transport','Logistik','Automation','Lean Manufacturing','Byggeledelse','VVS','Elinstallation','Industry 4.0','Cirkulært Byggeri'],
  health: ['Healthtech','Sundhed','MedTech','Biotech','Pharma','Velfærdsteknologi','Mental Health','Sygeplejerske','Læge','Fysioterapeut','Patientpleje','Digital Health','Sundhedsfremme'],
  education: ['Edtech','Forskning','Universitet','Student','PhD','Professor','Underviser','Undervisning','E-læring','Research','Pædagogik','Livslang Læring','Faglig Udvikling','Videndeling'],
  creative: ['UX/UI Design','UX Designer','Designer','Brand Strategy','Storytelling','Content Marketing','Media','Kommunikation','Reklame','Film','Musik','Kultur','Branding','Copywriting','Fotografi','Kunst'],
  commerce: ['E-commerce','Retail','Sales','Finans','Hotel','Restaurant','Service','Catering','Turisme','Detail','Dagligvarer','Fashion','Banking','Forsikring','Key Account Management','Kundeservice'],
  community: ['Community Building','Networking','Events','Foreningsliv','Frivilligt Arbejde','Lokalt Engagement','Mentorordninger','Erfa-grupper','Branchenetværk','Frivillig','Work-Life Balance']
};
var _interestProfiles = [];

function toggleInterest(btn) {
  var interest = btn.dataset.interest;
  var idx = _selectedInterests.indexOf(interest);
  if (idx >= 0) {
    _selectedInterests.splice(idx, 1);
    btn.classList.remove('selected');
  } else if (_selectedInterests.length < 3) {
    _selectedInterests.push(interest);
    btn.classList.add('selected');
  } else {
    return; // Max 3
  }

  // Update count label
  var label = document.getElementById('interest-count');
  if (label) {
    if (_selectedInterests.length >= 3) {
      label.textContent = '3 valgt ✓';
      label.style.color = 'var(--green)';
    } else {
      label.textContent = 'Vælg 3 emner (' + _selectedInterests.length + '/3)';
      label.style.color = 'var(--muted)';
    }
  }

  // Enable/disable continue button
  var btn2 = document.getElementById('interest-continue-btn');
  if (btn2) {
    btn2.style.opacity = _selectedInterests.length >= 3 ? '1' : '0.3';
    btn2.style.pointerEvents = _selectedInterests.length >= 3 ? 'auto' : 'none';
  }

  // Load preview when 3 selected
  if (_selectedInterests.length >= 3) {
    loadInterestPreview();
  } else {
    var preview = document.getElementById('interest-preview');
    if (preview) preview.style.display = 'none';
  }
}

async function loadInterestPreview() {
  try {
  var preview = document.getElementById('interest-preview');
  var el = document.getElementById('interest-people');
  if (!preview || !el) return;

  // Collect all tags from selected interests
  var matchTags = [];
  _selectedInterests.forEach(function(key) {
    var tags = _interestTagMap[key] || [];
    tags.forEach(function(t) { if (matchTags.indexOf(t) < 0) matchTags.push(t); });
  });

  try {
    // Load profiles using anon key (requires RLS policy for anon SELECT)
    if (!sb) initSupabase();
    if (_interestProfiles.length === 0) {
      var { data } = await sb.from('profiles').select('id,name,title,keywords,avatar_url').neq('banned', true).limit(50);
      _interestProfiles = data || [];
    }

    if (_interestProfiles.length === 0) {
      el.innerHTML = '<div style="text-align:center;padding:0.5rem;font-size:0.72rem;color:var(--muted)">Vær en af de første på Bubble! 🚀</div>';
      preview.style.display = 'block';
      return;
    }

    // Score profiles
    var scored = _interestProfiles.map(function(p) {
      var shared = (p.keywords || []).filter(function(t) { return matchTags.indexOf(t) >= 0; });
      return { p: p, shared: shared.length };
    }).sort(function(a, b) { return b.shared - a.shared; });

    var top = scored.slice(0, 3);
    var colors = ['linear-gradient(135deg,#2ECFCF,#3AAFDF)','linear-gradient(135deg,#6B8BFF,#8B5CF6)','linear-gradient(135deg,#8B5CF6,#A855F7)'];

    el.innerHTML = top.map(function(item, i) {
      var p = item.p;
      var ini = (p.name||'?').split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();
      var avHtml = p.avatar_url ?
        '<div style="width:40px;height:40px;border-radius:50%;overflow:hidden;flex-shrink:0;border:1.5px solid rgba(30,27,46,0.05)"><img src="'+escHtml(p.avatar_url)+'" style="width:100%;height:100%;object-fit:cover"></div>' :
        '<div style="width:40px;height:40px;border-radius:50%;background:'+colors[i%3]+';display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700;color:white;flex-shrink:0">'+ini+'</div>';
      var sharedText = item.shared > 0 ?
        '<span style="font-size:0.6rem;color:var(--accent)">' + item.shared + ' fælles interesser</span>' :
        '<span style="font-size:0.6rem;color:var(--muted)">Muligt match</span>';
      return '<div style="display:flex;align-items:center;gap:0.6rem;padding:0.4rem 0;' + (i < 2 ? 'border-bottom:1px solid rgba(30,27,46,0.025)' : '') + '">' +
        avHtml +
        '<div style="flex:1;min-width:0">' +
        '<div style="font-size:0.82rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escHtml(p.name||'Ukendt') + '</div>' +
        '<div style="font-size:0.68rem;color:var(--text-secondary)">' + escHtml(p.title||'') + '</div>' +
        sharedText +
        '</div></div>';
    }).join('');

    preview.style.display = 'block';
  } catch(e) {
    // Silently fail - preview is optional
    preview.style.display = 'none';
  }
  } catch(e) { logError("loadInterestPreview", e); }
}

function showTerms() {
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:999;background:rgba(0,0,0,0.85);display:flex;align-items:flex-end;justify-content:center;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)';
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

  var sheet = document.createElement('div');
  sheet.style.cssText = 'width:100%;max-width:680px;max-height:85vh;background:rgba(12,12,25,0.95);border-radius:24px 24px 0 0;padding:1.5rem;overflow-y:auto;color:var(--text);font-family:Figtree,sans-serif';
  sheet.innerHTML = '<div style="width:36px;height:4px;border-radius:99px;background:rgba(30,27,46,0.08);margin:0 auto 1rem;cursor:pointer" onclick="this.parentElement.parentElement.remove()"></div>' +
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
  sheet.style.cssText = 'width:100%;max-width:680px;background:rgba(12,12,25,0.95);border-radius:24px 24px 0 0;padding:1.5rem;color:var(--text);font-family:Figtree,sans-serif';
  sheet.innerHTML = '<div style="width:36px;height:4px;border-radius:99px;background:rgba(30,27,46,0.08);margin:0 auto 1rem;cursor:pointer" onclick="this.parentElement.parentElement.remove()"></div>' +
    '<h2 style="font-size:1.1rem;font-weight:800;margin-bottom:0.3rem">Giv feedback</h2>' +
    '<p style="font-size:0.78rem;color:var(--text-secondary);margin-bottom:1rem">Vi er i beta — din feedback er guld værd og hjælper os med at bygge det bedste produkt.</p>' +
    '<textarea id="feedback-text" placeholder="Hvad virker godt? Hvad kan gøres bedre? Har du oplevet fejl?" style="width:100%;height:120px;background:rgba(30,27,46,0.03);border:1px solid var(--glass-border);border-radius:12px;padding:0.7rem;font-family:Figtree,sans-serif;font-size:0.82rem;color:var(--text);resize:none;outline:none"></textarea>' +
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
//  PERSONAL QR CODE
// ══════════════════════════════════════════════════════════
function openMyQR() {
  if (!currentUser || !currentProfile) { showToast('Log ind først'); return; }
  var url = window.location.origin + window.location.pathname + '?profile=' + currentUser.id;
  
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:999;background:rgba(30,27,46,0.25);display:flex;align-items:flex-end;justify-content:center;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)';
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
  
  var sheet = document.createElement('div');
  sheet.style.cssText = 'width:100%;max-width:680px;background:rgba(255,255,255,0.98);backdrop-filter:blur(20px);border-radius:24px 24px 0 0;padding:1.5rem;text-align:center;color:var(--text);font-family:Figtree,sans-serif';
  sheet.innerHTML = '<div style="width:36px;height:4px;border-radius:99px;background:rgba(30,27,46,0.12);margin:0 auto 1rem;cursor:pointer" onclick="this.parentElement.parentElement.remove()"></div>' +
    '<div style="font-size:1.1rem;font-weight:800;margin-bottom:0.3rem">Min QR-kode</div>' +
    '<div style="font-size:0.78rem;color:var(--text-secondary);margin-bottom:1rem">Andre kan scanne den for at se din profil</div>' +
    '<div id="my-qr-container" style="display:flex;justify-content:center;margin-bottom:1rem"></div>' +
    '<div style="font-size:0.72rem;color:var(--muted);margin-bottom:0.8rem;word-break:break-all">' + url + '</div>' +
    '<button onclick="navigator.clipboard.writeText(\'' + url + '\');this.textContent=\'Kopieret! ✓\';setTimeout(()=>this.textContent=\'Kopiér link\',2000)" style="width:100%;padding:0.7rem;border-radius:12px;border:1px solid var(--glass-border);background:var(--glass-bg);color:var(--text);font-family:inherit;font-size:0.82rem;font-weight:600;cursor:pointer">Kopiér link</button>' +
    '<button onclick="if(navigator.share)navigator.share({title:\'Bubble\',url:\'' + url + '\'}).catch(()=>{});else{navigator.clipboard.writeText(\'' + url + '\');showToast(\'Link kopieret\')}" style="width:100%;margin-top:0.4rem;padding:0.7rem;border-radius:12px;border:none;background:linear-gradient(135deg,#2ECFCF,#6B8BFF,#8B5CF6);color:white;font-family:inherit;font-size:0.82rem;font-weight:700;cursor:pointer">Del profil →</button>';
  
  overlay.appendChild(sheet);
  document.body.appendChild(overlay);
  
  // Generate QR code
  setTimeout(function() {
    var container = document.getElementById('my-qr-container');
    if (container && typeof QRCode !== 'undefined') {
      new QRCode(container, {
        text: url,
        width: 180,
        height: 180,
        colorDark: '#1E1B2E',
        colorLight: '#FFFFFF',
        correctLevel: QRCode.CorrectLevel.M
      });
    }
  }, 100);
}

