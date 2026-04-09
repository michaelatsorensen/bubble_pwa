// ══════════════════════════════════════════════════════════
//  BUBBLE — ONBOARDING + TAG PICKER + WELCOME
//  DOMAIN: onboarding
//  SUB-DOMAINS:
//    ob* — Onboarding tag picker (new user flow)
//    ep* — Edit profile tag picker (mirrors ob* pattern)
//  OWNS: onboarding UI state, _selectedInterests, _setupSelectedLifestage
//  OWNS: saveOnboarding, skipOnboarding, abortOnboarding
//  READS: currentUser, currentProfile, flowGet/flowSet
//  NOTE: ob* and ep* share the same tag-picker pattern. Future: unify into shared picker.
//  Auto-split from app.js · v3.7.0
// ══════════════════════════════════════════════════════════

// Download external avatar (LinkedIn/Google) to Supabase Storage → permanent URL
async function _downloadAvatarToStorage(externalUrl, userId) {
  try {
    var res = await fetch(externalUrl);
    if (!res.ok) return null;
    var blob = await res.blob();
    if (!blob.type.startsWith('image/')) return null;
    var toUpload = (typeof resizeImage === 'function') ? await resizeImage(blob, 400) : blob;
    var path = 'avatars/' + userId + '/' + Date.now() + '.jpg';
    var { error: upErr } = await sb.storage.from('bubble-files').upload(path, toUpload, { cacheControl: '3600', upsert: true, contentType: 'image/jpeg' });
    if (upErr) { console.warn('[avatar] upload failed:', upErr); return null; }
    var { data: urlData } = sb.storage.from('bubble-files').getPublicUrl(path);
    return urlData?.publicUrl || null;
  } catch(e) { console.warn('[avatar] download failed:', e); return null; }
}

// Fire-and-forget avatar repair for returning users (non-blocking)
function _repairAvatarInBackground(autoAvatar) {
  setTimeout(async function() {
    try {
      if (!currentUser || !currentProfile) return;
      // Save OAuth avatar if user doesn't have one
      if (autoAvatar && !currentProfile.avatar_url) {
        var saved = await _downloadAvatarToStorage(autoAvatar, currentUser.id);
        if (saved) {
          await sb.from('profiles').update({ avatar_url: saved }).eq('id', currentUser.id);
          if (currentProfile) currentProfile.avatar_url = saved;
        }
      }
      // Repair expired external URLs
      if (currentProfile.avatar_url && !currentProfile.avatar_url.includes('supabase') && !currentProfile.avatar_url.includes('api.bubbleme')) {
        var repaired = await _downloadAvatarToStorage(currentProfile.avatar_url, currentUser.id);
        if (repaired) {
          await sb.from('profiles').update({ avatar_url: repaired }).eq('id', currentUser.id);
          currentProfile.avatar_url = repaired;
        } else {
          await sb.from('profiles').update({ avatar_url: null }).eq('id', currentUser.id);
          currentProfile.avatar_url = null;
        }
      }
    } catch(e) { console.warn('[avatar] bg repair failed:', e); }
  }, 2000);
}

// ══════════════════════════════════════════════════════════
//  ONBOARDING
// ══════════════════════════════════════════════════════════
async function maybeShowOnboarding() {
  try {
    // Don't re-trigger if user explicitly skipped
    if (currentProfile?.onboarding_skipped) return false;

    var provider = currentUser?.app_metadata?.provider || 'email';
    var meta = currentUser?.user_metadata || {};
    var autoName = meta.full_name || meta.name || '';
    var autoAvatar = meta.avatar_url || meta.picture || '';
    var autoWorkplace = meta.company || meta.organization || '';

    // Fast check: existing users with complete profiles skip instantly (no network calls)
    var hasName = currentProfile?.name && currentProfile.name !== currentProfile?.id && currentProfile.name !== currentUser?.email;
    var hasWorkplace = currentProfile?.workplace && currentProfile.workplace.trim().length > 0;
    if (hasName && hasWorkplace) {
      // Background avatar repair (non-blocking — don't delay app entry)
      _repairAvatarInBackground(autoAvatar);
      return false;
    }

    // New/incomplete user: do avatar work synchronously before showing onboarding
    if (autoAvatar && !currentProfile?.avatar_url) {
      try {
        var savedUrl = await _downloadAvatarToStorage(autoAvatar, currentUser.id);
        if (savedUrl) {
          await sb.from('profiles').update({ avatar_url: savedUrl }).eq('id', currentUser.id);
          if (currentProfile) currentProfile.avatar_url = savedUrl;
        }
      } catch(e) {}
    }

    // Auto-fill from OAuth if user is missing name/workplace
    if (!hasName && autoName) {
      try {
        await sb.from('profiles').update({ name: autoName }).eq('id', currentUser.id);
        if (currentProfile) currentProfile.name = autoName;
        hasName = true;
      } catch(e) {}
    }
    if (!hasWorkplace && autoWorkplace) {
      try {
        await sb.from('profiles').update({ workplace: autoWorkplace }).eq('id', currentUser.id);
        if (currentProfile) currentProfile.workplace = autoWorkplace;
        hasWorkplace = true;
      } catch(e) {}
    }

    if (hasName && hasWorkplace) return false; // OAuth provided enough

    // Deep-link users: show minimal onboarding (just missing fields), not full flow
    var isDeepLink = flowGet('pending_contact') || flowGet('pending_join') || flowGet('event_flow');
    if (isDeepLink) {
      _showMinimalOnboarding(hasName, hasWorkplace, autoName);
      return true;
    }

    // Pre-fill from OAuth metadata
    var obName = document.getElementById('ob-name');
    if (obName) obName.value = autoName || currentProfile?.name || '';
    var obWp = document.getElementById('ob-workplace');
    if (obWp) obWp.value = currentProfile?.workplace || '';

    // Show QR contact confirmation banner if pending
    var pendingContact = flowGet('pending_contact');
    var obQrBanner = document.getElementById('ob-qr-contact-banner');
    if (obQrBanner && pendingContact && typeof _qrContactProfile !== 'undefined' && _qrContactProfile) {
      var qrName = document.getElementById('ob-qr-contact-name');
      if (qrName) qrName.textContent = _qrContactProfile.name || 'Kontakt';
      obQrBanner.style.display = 'flex';
    } else if (obQrBanner) {
      obQrBanner.style.display = 'none';
    }

    goTo('screen-onboarding');
    setTimeout(initInputConfirmButtons, 50);
    setTimeout(obCheckProgress, 80);
    return true;
  } catch(e) { logError("maybeShowOnboarding", e); errorToast("load", e); }
}

// Track whether onboarding is being run by an existing user (vs first-time)
var _reRunningOnboarding = false;
var _miniObConsentGiven = false;

function reRunOnboarding() {
  _reRunningOnboarding = true;
  _obConsentGiven = true; // already consented as existing user
  var nameEl = document.getElementById('ob-name');
  var workEl = document.getElementById('ob-workplace');
  if (nameEl && currentProfile?.name) nameEl.value = currentProfile.name;
  if (workEl && currentProfile?.workplace) workEl.value = currentProfile.workplace;
  // Update button for re-run context
  var btn = document.getElementById('ob-save-btn');
  if (btn) { btn.textContent = 'Gem ændringer'; btn.disabled = false; }
  obCheckProgress();
  goTo('screen-onboarding');
}

// ── Minimal onboarding for deep-link users (just name + workplace) ──

function _showMinimalOnboarding(hasName, hasWorkplace, autoName) {
  var existing = document.getElementById('mini-onboarding-overlay');
  if (existing) existing.remove();

  var contextLabel = '';
  if (flowGet('event_flow')) contextLabel = 'Næsten klar — udfyld dit navn så andre kan finde dig';
  else if (flowGet('pending_contact')) contextLabel = 'Ét felt og du kan se kontakten';
  else if (flowGet('pending_join')) contextLabel = 'Ét felt og du er med i netværket';
  else contextLabel = t('ob_almost_ready');

  var nameVal = autoName || currentProfile?.name || '';
  var wpVal = currentProfile?.workplace || '';

  var ov = document.createElement('div');
  ov.id = 'mini-onboarding-overlay';
  ov.style.cssText = 'position:fixed;inset:0;z-index:550;background:var(--bg);display:flex;flex-direction:column;padding:calc(env(safe-area-inset-top,0px) + 2rem) 1.5rem 2rem;overflow-y:auto;-webkit-overflow-scrolling:touch';

  ov.innerHTML =
    '<div style="flex:1;display:flex;flex-direction:column;justify-content:center;max-width:400px;width:100%;margin:0 auto">' +
      '<div style="text-align:center;margin-bottom:0.3rem"><img src="bubble-logo-splash.png" alt="bubble" style="height:20px;width:auto"></div>' +
      '<div style="font-size:1.3rem;font-weight:800;text-align:center;margin-bottom:0.15rem">' + escHtml(contextLabel) + '</div>' +
      '<div style="font-size:0.82rem;color:var(--text-secondary);text-align:center;margin-bottom:1.5rem">Du kan udfylde resten inde i appen</div>' +
      (!hasName ? '<div class="input-group"><div class="input-label">Navn *</div><input class="input" id="mini-ob-name" maxlength="60" placeholder="" data-t-placeholder="ob_name_ph" value="' + escHtml(nameVal) + '" oninput="_miniObCheck()"></div>' : '') +
      (!hasWorkplace ? '<div class="input-group"><div class="input-label">Arbejdsplads *</div><input class="input" id="mini-ob-workplace" maxlength="80" placeholder="" data-t-placeholder="ob_workplace_ph" value="' + escHtml(wpVal) + '" oninput="_miniObCheck()"></div>' : '') +
      '<label style="display:flex;align-items:flex-start;gap:0.5rem;margin:0.6rem 0;cursor:pointer" onclick="_miniObToggleConsent()">' +
        '<div id="mini-ob-consent" style="width:18px;height:18px;border-radius:5px;border:1.5px solid var(--border);flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:all 0.15s;margin-top:1px"></div>' +
        '<span style="font-size:0.72rem;color:var(--text-secondary);line-height:1.4">Jeg accepterer Bubble\'s <a href="#" onclick="event.stopPropagation();showTerms()">betingelser</a> og <a href="#" onclick="event.stopPropagation();showTerms()">privatlivspolitik</a></span>' +
      '</label>' +
      '<button class="btn-primary" id="mini-ob-save" onclick="_miniObSave()" style="margin-top:0.8rem" disabled>' + (flowGet('event_flow') ? 'Gå til event →' : 'Fortsæt') + '</button>' +
      '<div style="text-align:center;font-size:0.72rem;color:var(--muted);margin-top:0.5rem">Du kan tilføje interesser, titel og mere bagefter</div>' +
    '</div>' +
    '<div style="min-height:350px;flex-shrink:0"></div>';

  document.body.appendChild(ov);

  // Focus first empty field
  setTimeout(function() {
    var first = document.getElementById('mini-ob-name') || document.getElementById('mini-ob-workplace');
    if (first && !first.value) first.focus();
    _miniObCheck();
  }, 100);
}

function _miniObToggleConsent() {
  _miniObConsentGiven = !_miniObConsentGiven;
  var el = document.getElementById('mini-ob-consent');
  if (el) {
    el.style.background = _miniObConsentGiven ? 'var(--accent)' : '';
    el.style.borderColor = _miniObConsentGiven ? 'var(--accent)' : '';
    el.innerHTML = _miniObConsentGiven ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>' : '';
  }
  _miniObCheck();
}

function _miniObCheck() {
  var nameEl = document.getElementById('mini-ob-name');
  var wpEl = document.getElementById('mini-ob-workplace');
  var name = nameEl ? nameEl.value.trim() : (currentProfile?.name || '');
  var wp = wpEl ? wpEl.value.trim() : (currentProfile?.workplace || '');
  var btn = document.getElementById('mini-ob-save');
  if (btn) btn.disabled = !(name && wp && _miniObConsentGiven);
}

async function _miniObSave() {
  var nameEl = document.getElementById('mini-ob-name');
  var wpEl = document.getElementById('mini-ob-workplace');
  var name = nameEl ? nameEl.value.trim() : currentProfile?.name;
  var wp = wpEl ? wpEl.value.trim() : currentProfile?.workplace;
  if (!name || !wp) return;
  if (!_miniObConsentGiven) return showWarningToast('Du skal acceptere betingelserne');

  var btn = document.getElementById('mini-ob-save');
  if (btn) { btn.textContent = 'Gemmer...'; btn.disabled = true; }

  try {
    var update = { terms_accepted_at: new Date().toISOString() };
    if (nameEl) update.name = name;
    if (wpEl) update.workplace = wp;
    var { error } = await sb.from('profiles').update(update).eq('id', currentUser.id);
    if (error) { errorToast('save', error); if (btn) { btn.textContent = 'Fortsæt'; btn.disabled = false; } return; }
    await loadCurrentProfile();
    localStorage.setItem('bubble_welcomed', '1');

    // Remove overlay
    var ov = document.getElementById('mini-onboarding-overlay');
    if (ov) ov.remove();

    // Continue to pending action
    initServices();
    await resolvePostAuthDestination();
  } catch(e) {
    logError('miniObSave', e);
    errorToast('save', e);
    if (btn) { btn.textContent = 'Fortsæt'; btn.disabled = false; }
  }
}

// ══════════════════════════════════════════════════════════
//  WELCOME & GETTING STARTED
// ══════════════════════════════════════════════════════════

// ── Progress check (simplified v8.15) ──
var _obConsentGiven = false;

function obToggleConsent() {
  _obConsentGiven = !_obConsentGiven;
  var el = document.getElementById('ob-consent-check');
  if (el) el.classList.toggle('checked', _obConsentGiven);
  obCheckProgress();
}

function obCheckProgress() {
  var name = (document.getElementById('ob-name')?.value || '').trim();
  var workplace = (document.getElementById('ob-workplace')?.value || '').trim();

  // Save button: active when name + workplace + consent
  var saveBtn = document.getElementById('ob-save-btn');
  if (saveBtn) {
    var canSave = name && workplace && _obConsentGiven;
    saveBtn.disabled = !canSave;
  }
}


// Note: skipOnboarding is no longer called from UI (v5.6 removed skip button)
// Kept for backwards compatibility if re-enabled
async function skipOnboarding() {
  var name = (document.getElementById('ob-name')?.value || '').trim();
  if (!name && currentProfile?.name) name = currentProfile.name;
  if (!name && currentUser?.email) name = currentUser.email.split('@')[0];
  var workplace = (document.getElementById('ob-workplace')?.value || '').trim();
  if (!name) { showWarningToast('Skriv dit navn først'); return; }
  if (!workplace) { showWarningToast('Tilføj arbejdsplads — det er alt der mangler'); return; }

  try {
    await sb.from('profiles').upsert({
      id: currentUser.id, name: name,
      workplace: workplace,
      is_anon: false,
      onboarding_skipped: true
    });
    await loadCurrentProfile();
    // Delegate to shared post-auth pipeline (same as saveOnboarding)
    initServices();
    await resolvePostAuthDestination();
  } catch(e) {
    logError('skipOnboarding', e);
    errorToast('save', e);
  }
}

var _abortConfirmed = false;
function abortOnboarding() {
  if (!_abortConfirmed) {
    _abortConfirmed = true;
    var { overlay } = bbDynOpen({ center: true });
    overlay.id = 'abort-confirm-overlay';
    var s = overlay.querySelector('.bb-dyn-sheet');
    s.style.textAlign = 'center';
    if (_reRunningOnboarding) {
      // Existing user — just go back, no logout
      s.innerHTML =
        '<div style="font-size:1.1rem;font-weight:800;color:var(--text);margin-bottom:0.5rem">Afbryd opsætning?</div>' +
        '<div style="font-size:0.8rem;color:var(--text-secondary);line-height:1.5;margin-bottom:1.2rem">Dine ændringer gemmes ikke. Du vender tilbage til din profil.</div>' +
        '<button onclick="cancelReRunOnboarding()" style="width:100%;padding:0.65rem;border-radius:12px;border:1px solid rgba(124,92,252,0.2);background:rgba(124,92,252,0.08);color:var(--accent);font-family:inherit;font-size:0.85rem;font-weight:700;cursor:pointer;margin-bottom:0.4rem">Tilbage til profil</button>' +
        '<button onclick="cancelAbortOnboarding()" style="width:100%;padding:0.65rem;border-radius:12px;border:1px solid var(--glass-border);background:none;color:var(--text-secondary);font-family:inherit;font-size:0.82rem;font-weight:600;cursor:pointer">Fortsæt opsætning</button>';
    } else {
      // First-time user — original behavior
      s.innerHTML =
        '<div style="font-size:1.1rem;font-weight:800;color:var(--text);margin-bottom:0.5rem">Afbryd opsætning?</div>' +
        '<div style="font-size:0.8rem;color:var(--text-secondary);line-height:1.5;margin-bottom:1.2rem">Alt du har udfyldt nulstilles og du vender tilbage til login-skærmen.</div>' +
        '<button onclick="confirmAbortOnboarding()" style="width:100%;padding:0.65rem;border-radius:12px;border:1px solid rgba(26,122,138,0.3);background:rgba(26,122,138,0.1);color:var(--accent2);font-family:inherit;font-size:0.85rem;font-weight:700;cursor:pointer;margin-bottom:0.4rem">Ja, afbryd og nulstil</button>' +
        '<button onclick="cancelAbortOnboarding()" style="width:100%;padding:0.65rem;border-radius:12px;border:1px solid var(--glass-border);background:none;color:var(--text-secondary);font-family:inherit;font-size:0.82rem;font-weight:600;cursor:pointer">Fortsæt opsætning</button>';
    }
    return;
  }
}

function cancelAbortOnboarding() {
  _abortConfirmed = false;
  var overlay = document.getElementById('abort-confirm-overlay');
  if (overlay) bbDynClose(overlay);
}

function cancelReRunOnboarding() {
  _abortConfirmed = false;
  _reRunningOnboarding = false;
  var overlay = document.getElementById('abort-confirm-overlay');
  if (overlay) bbDynClose(overlay);
  goTo('screen-profile');
}

async function confirmAbortOnboarding() {
  try {
  _abortConfirmed = false;
  var overlay = document.getElementById('abort-confirm-overlay');
  if (overlay) bbDynClose(overlay);
  try {
    // Clear onboarding inputs
    ['ob-name','ob-workplace'].forEach(function(id) {
      var el = document.getElementById(id); if (el) el.value = '';
    });
    // Sign out and go to auth
    bcUnsubscribeAll();
    rtUnsubscribeAll();
    sb.removeAllChannels();
    await sb.auth.signOut();
    currentUser = null;
    currentProfile = null;
    goTo('screen-auth');
    showWarningToast(t('toast_generic_error'));
  } catch(e) { logError('abortOnboarding', e); goTo('screen-auth'); }
  } catch(e) { logError("confirmAbortOnboarding", e); }
}


function welcomeGo(target) {
  localStorage.setItem('bubble_welcomed', '1');
  if (target === 'discover') {
    goTo('screen-bubbles');bbSwitchTab('explore');
    loadDiscover();
  } else {
    goTo('screen-home');
    loadHome();
  }
}


// ══════════════════════════════════════════════════════════
//  TAG PICKER SYSTEM
// ══════════════════════════════════════════════════════════
var epSelectedTags = [];

var OB_LIFESTAGE_TAGS = {
  student: {
    branche: ['Edtech','AI/ML','Healthtech','Cleantech','SaaS','Gaming','Media','Cybersecurity','Biotech','Fintech','NGO','Forskning','Universitet'],
    kompetence: ['UX/UI Design','Frontend','Backend','Full-Stack','Python','React','Data Analytics','Machine Learning','Research','Innovation','Content Marketing','Social Media','Undervisning','E-læring'],
    interesse: ['Open Source','AI Ethics','Climate Action','Future of Work','Personal Development','Networking','Community Building','Design Thinking','Lean Startup','Nordic Startups','No-Code','Low-Code','Writing','Livslang Læring','Faglig Udvikling']
  },
  employee: {
    branche: ['SaaS','Fintech','Healthtech','E-commerce','AI/ML','Cybersecurity','Cloud','Infrastructure','DevTools','Retail','B2B','B2C','Consulting','Agency','Service','Logistik','Media','Energi','Pharma','Banking','Finans','Produktion'],
    kompetence: ['Product Development','UX/UI Design','Frontend','Backend','Full-Stack','Growth Hacking','SEO/SEM','Sales Strategy','Enterprise Sales','People Ops','Talent Acquisition','DevOps','Security','Architecture','Brand Strategy','PR/Comms','Operations','Analytics','Data Analytics','Machine Learning','Strategy','Facilitation','GDPR','Projektledelse'],
    interesse: ['Leadership','Management','Future of Work','Remote Work','Agile','Personal Development','Networking','Community Building','Design Thinking','Public Speaking','Diversity & Inclusion','Digital Health','AI Ethics','Intrapreneurship','Work-Life Balance','Faglig Udvikling']
  },
  entrepreneur: {
    branche: ['SaaS','Fintech','Healthtech','Edtech','Cleantech','Biotech','E-commerce','AI/ML','Foodtech','Proptech','Marketplace','Platform','B2B','B2C','D2C','Deep Tech','Hardware','IoT','Robotics','Abonnement'],
    kompetence: ['Product Development','Fundraising','Pitch Deck','Financial Modeling','Growth Hacking','Sales Strategy','Partnerships','BD','Brand Strategy','Storytelling','Innovation','Strategy','UX/UI Design','Frontend','Backend','People Ops','Forretningsudvikling','Prototyping'],
    interesse: ['Entrepreneurship','Venture Capital','Angel Investing','Lean Startup','Networking','Skalering','Exit Strategy','Nordic Startups','European Tech','Global Markets','Internationalisering','Climate Action','Community Building','Public Speaking','Leadership','Creator Economy','Iværksætterkultur','Startup Økosystem']
  },
  freelancer: {
    branche: ['SaaS','Consulting','Agency','Service','AI/ML','E-commerce','Media','Healthtech','Fintech','Cleantech','Edtech','B2B','B2C','Martech','Entertainment','Publishing','Kommunikation','PR','Reklame'],
    kompetence: ['UX/UI Design','Frontend','Backend','Full-Stack','Product Development','Growth Hacking','Content Marketing','Brand Strategy','PR/Comms','Storytelling','SEO/SEM','Sales Strategy','Strategy','Facilitation','Data Analytics','Innovation','Branding','Copywriting','Coaching'],
    interesse: ['Remote Work','Digital Nomad','Networking','Personal Development','Public Speaking','Writing','Podcasting','Creator Economy','No-Code','Community Building','Design Thinking','Entrepreneurship','Lean Startup','Future of Work','Work-Life Balance','Selvledelse']
  },
  public: {
    branche: ['NGO','GovTech','Civic Tech','Impact','Sundhed','Energi','Bæredygtighed','Edtech','Cleantech','Velfærdsteknologi','Kommune','Region','Stat','Forening','Socialøkonomi','Frivilligsektor'],
    kompetence: ['People Ops','Strategy','Facilitation','Research','Innovation','Legal/Compliance','GDPR','Operations','Brand Strategy','PR/Comms','Sustainability','ESG','Data Analytics','Projektledelse','Udbudsret','Krisekommunikation','Undervisning'],
    interesse: ['Social Impact','Climate Action','Diversity & Inclusion','Smart Cities','Digital Health','Community Building','Future of Work','Public Speaking','Leadership','Management','Velfærdsinnovation','Lokalt Engagement','Patientinddragelse','Tilgængelighed']
  },
  practical: {
    branche: ['Byggeri','Anlæg','Renovering','Energi','Logistik','Cleantech','Hardware','Embedded','Agritech','Foodtech','Mobility','Service','Produktion','Industri','Automation','Transport','Landbrug'],
    kompetence: ['Operations','Supply Chain','Procurement','Lean Manufacturing','Kvalitetsstyring','Vedligeholdelse','Byggeledelse','Tilbudskalkulation','Tegning/CAD','Energiinstallation','Elinstallation','VVS','Projektledelse','Innovation','Sustainability'],
    interesse: ['Climate Action','Industry 4.0','Automation','Cirkulært Byggeri','Energirenovering','Bygningskultur','Grøn Omstilling','Entrepreneurship','Networking','Personal Development','Community Building','Lean Startup']
  },
  investor: {
    branche: ['SaaS','Fintech','Healthtech','Cleantech','Biotech','AI/ML','Deep Tech','Foodtech','Proptech','E-commerce','Crypto','DeFi','SpaceTech','Impact','Hardware','Marketplace','Platform','Edtech','Kapitalforvaltning','Investering'],
    kompetence: ['Due Diligence','Financial Modeling','Fundraising','Strategy','Partnerships','BD','Sales Strategy','Enterprise Sales','Innovation','ESG','Carbon Accounting','Pitch Deck','Operations','Forretningsudvikling','Markedsanalyse'],
    interesse: ['Venture Capital','Angel Investing','Entrepreneurship','Nordic Startups','European Tech','Global Markets','Exit Strategy','Skalering','Internationalisering','Climate Action','Leadership','Networking','Community Building','Crowdfunding','Startup Økosystem']
  }
};

// ── Interest → tag boosting for onboarding ──
var OB_INTEREST_TAGS = {
  startup: {
    branche: ['SaaS','Fintech','E-commerce','Marketplace','Platform','B2C','D2C','B2B','Abonnement'],
    kompetence: ['Fundraising','Growth Hacking','Product Development','Pitch Deck','Financial Modeling','Sales Strategy','Innovation','BD','Forretningsudvikling','Prototyping'],
    interesse: ['Entrepreneurship','Lean Startup','Venture Capital','Angel Investing','Skalering','Nordic Startups','Exit Strategy','Creator Economy','Iværksætterkultur','Startup Økosystem','Crowdfunding']
  },
  tech: {
    branche: ['AI/ML','SaaS','Cybersecurity','Cloud','DevTools','IoT','Deep Tech','Robotics','Embedded','Infrastructure','Blockchain'],
    kompetence: ['Frontend','Backend','Full-Stack','Python','React','DevOps','Machine Learning','Architecture','API Design','Data Analytics','Security','TypeScript','Cloud Architecture','System Design','Data Engineering'],
    interesse: ['Open Source','AI Ethics','Responsible AI','AI Safety','No-Code','Low-Code','Maker Culture','Digital Transformation','Automation']
  },
  sustainability: {
    branche: ['Cleantech','Energi','Bæredygtighed','Circular Economy','Vindenergi','Solenergi','Grøn Omstilling','Affaldshåndtering','Vandteknologi','Carbon Capture','Impact','Agritech','Økologi'],
    kompetence: ['Sustainability','ESG','Carbon Accounting','LCA','Miljøledelse','Energioptimering','Grøn Certificering','Innovation','Research','Strategy'],
    interesse: ['Climate Action','Social Impact','Grøn Omstilling','Regenerativt Landbrug','Biodiversitet','Havmiljø','Cirkulært Byggeri','Energirenovering']
  },
  leadership: {
    branche: ['Consulting','B2B','Service','Banking','Finans','Kapitalforvaltning','Rekruttering'],
    kompetence: ['Strategy','People Ops','Talent Acquisition','Operations','Facilitation','Sales Strategy','Enterprise Sales','Brand Strategy','PR/Comms','Forretningsudvikling','Markedsanalyse','Org Design','Medarbejderudvikling','Coaching','Mentoring','Projektledelse'],
    interesse: ['Leadership','Management','Future of Work','Public Speaking','Personal Development','Networking','Agile','OKR','Intrapreneurship','Selvledelse','Work-Life Balance','Erfa-grupper']
  },
  public: {
    branche: ['GovTech','Civic Tech','NGO','Impact','Kommune','Region','Stat','Forening','Socialøkonomi','Frivilligsektor','Sundhed','Velfærdsteknologi'],
    kompetence: ['Legal/Compliance','GDPR','Research','Facilitation','People Ops','Strategy','Operations','Sustainability','Udbudsret','Persondataret','Kontraktret','Projektledelse','Krisekommunikation'],
    interesse: ['Social Impact','Smart Cities','Digital Health','Diversity & Inclusion','AI Ethics','Community Building','Velfærdsinnovation','Patientinddragelse','Tilgængelighed','Lokalt Engagement']
  },
  industry: {
    branche: ['Byggeri','Anlæg','Renovering','Boligbyggeri','Produktion','Industri','Automation','Hardware','Energi','Transport','Logistik','Shipping','Mobility','Lager','Embedded','IoT','Robotics'],
    kompetence: ['Operations','Supply Chain','Procurement','Lagerstyring','Lean Manufacturing','Six Sigma','Kvalitetsstyring','ISO','Produktionsplanlægning','Vedligeholdelse','Byggeledelse','Tilbudskalkulation','Tegning/CAD','3D-modellering','BIM','Energiinstallation','Elinstallation','VVS','Projektledelse'],
    interesse: ['Industry 4.0','Automation','Climate Action','Smart Cities','Lean Startup','Cirkulært Byggeri','Energirenovering','Bygningskultur','Grøn Omstilling']
  },
  health: {
    branche: ['Healthtech','MedTech','Pharma','Biotech','Mental Health','Sundhed','Velfærdsteknologi','Tandpleje','Genoptræning'],
    kompetence: ['Research','Data Analytics','Innovation','Product Development','GDPR','Legal/Compliance','Klinisk Arbejde','Patientpleje','Medicinhåndtering','Rehabilitering','Tværfagligt Samarbejde','Dokumentation'],
    interesse: ['Digital Health','Biohacking','AI Ethics','Social Impact','Personal Development','Community Building','Patientinddragelse','Velfærdsinnovation','Sundhedsfremme']
  },
  education: {
    branche: ['Edtech','Forskning','Universitet','Efteruddannelse','Erhvervsskole','AI/ML','Biotech','Impact','NGO'],
    kompetence: ['Research','Machine Learning','Data Analytics','Innovation','Content Marketing','Storytelling','Facilitation','Undervisning','Kursusudvikling','E-læring','Pædagogik','Didaktik','Vejledning','Design Thinking','User Research'],
    interesse: ['Open Source','AI Ethics','Future of Work','Writing','Personal Development','Podcasting','Community Building','Design Thinking','Livslang Læring','Faglig Udvikling','Videndeling','Tværfaglighed','Forskning & Udvikling']
  },
  creative: {
    branche: ['Media','Agency','Entertainment','Publishing','Martech','E-commerce','Reklame','Film','Musik','Kultur','Kommunikation','PR','Gaming'],
    kompetence: ['UX/UI Design','Brand Strategy','Content Marketing','Storytelling','SEO/SEM','Social Media','PR/Comms','Frontend','Innovation','Branding','Copywriting','Influencer Marketing','Eventplanlægning','Prototyping','3D-modellering'],
    interesse: ['Design Thinking','Creator Economy','Writing','Podcasting','Public Speaking','Community Building','No-Code','Fotografi','Musik','Kunst','Håndarbejde','Maker Culture']
  },
  commerce: {
    branche: ['E-commerce','Retail','Fintech','B2C','Marketplace','Service','Logistik','Banking','Finans','Foodtech','Detail','Dagligvarer','Abonnement','D2C','Fashion','Restaurant','Hotel','Turisme','Catering','Forsikring'],
    kompetence: ['Sales Strategy','Enterprise Sales','Growth Hacking','SEO/SEM','Analytics','Operations','Supply Chain','Financial Modeling','Partnerships','Key Account Management','Forhandling','Kundeservice','Pipeline Management','CRM','Budgettering','Regnskab'],
    interesse: ['Networking','Entrepreneurship','Skalering','Global Markets','Internationalisering','Nordic Startups','Branchenetværk','Madkultur','Gastronomi','Fødevaresikkerhed']
  },
  community: {
    branche: ['NGO','Impact','Media','Entertainment','Service','Forening','Socialøkonomi','Frivilligsektor','Kultur','Turisme'],
    kompetence: ['Facilitation','Content Marketing','Social Media','Storytelling','PR/Comms','People Ops','Eventplanlægning','Coaching','Mentoring','Intern Kommunikation','Employer Branding'],
    interesse: ['Community Building','Networking','Diversity & Inclusion','Personal Development','Public Speaking','Writing','Podcasting','Design Thinking','Future of Work','Remote Work','Foreningsliv','Frivilligt Arbejde','Lokalt Engagement','Mentorordninger','Erfa-grupper','Branchenetværk','Events','Work-Life Balance']
  }
};


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
// Close suggestions when clicking outside
document.addEventListener('click', function(e) {
  if (!e.target.closest('.tag-search-wrap')) {
    var sug2 = document.getElementById('ep-tag-suggestions');
    if (sug2) sug2.style.display = 'none';
  }
});

// ══════════════════════════════════════════════════════════
//  EDIT PROFILE TAG PICKER (ep*)
//  Mirrors ob* pattern for the profile edit flow.
//  OWNS: epSelectedTags, epTagSearch, epAddTag, epRemoveTag, epRenderCategories
//  Future: unify ob* and ep* into a shared createTagPicker() factory.
// ══════════════════════════════════════════════════════════

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
  epRenderCategories(); // update selected state in tag list
  var input = document.getElementById('ep-tag-search');
  if (input) input.value = '';
  var sug = document.getElementById('ep-tag-suggestions');
  if (sug) sug.style.display = 'none';
}
function epRemoveTag(label) {
  epSelectedTags = epSelectedTags.filter(function(t) { return t !== label; });
  epRenderSelectedTags();
  epRenderCategories();
}
function epTogglePickTag(label, cat, el) {
  var idx = epSelectedTags.indexOf(label);
  if (idx >= 0) {
    epSelectedTags.splice(idx, 1);
  } else {
    epSelectedTags.push(label);
  }
  epRenderSelectedTags();
  epRenderCategories();
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

function epGetRecommendedTags(cat) {
  var allTags = TAG_DATABASE[cat] || [];
  if (cat === 'rolle') return allTags.slice(0, 8);

  // Infer user's interests from their existing tags
  var userTags = currentProfile ? (currentProfile.keywords || []) : [];
  var inferredInterests = [];
  if (userTags.length > 0) {
    Object.keys(OB_INTEREST_TAGS).forEach(function(interestKey) {
      var map = OB_INTEREST_TAGS[interestKey];
      var score = 0;
      ['branche','kompetence','interesse'].forEach(function(c) {
        if (map[c]) {
          map[c].forEach(function(t) {
            if (userTags.indexOf(t) >= 0) score++;
          });
        }
      });
      if (score >= 1) inferredInterests.push(interestKey);
    });
  }

  // Also use pre-auth interests if available
  if (_selectedInterests && _selectedInterests.length > 0) {
    _selectedInterests.forEach(function(key) {
      if (inferredInterests.indexOf(key) < 0) inferredInterests.push(key);
    });
  }

  // Collect recommended tags from inferred interests
  var recs = [];
  inferredInterests.forEach(function(key) {
    var map = OB_INTEREST_TAGS[key];
    if (map && map[cat]) {
      map[cat].forEach(function(t) {
        if (recs.indexOf(t) < 0 && allTags.indexOf(t) >= 0) recs.push(t);
      });
    }
  });

  // Add lifestage tags if we can infer it
  if (currentProfile && currentProfile.lifestage) {
    var lsTags = OB_LIFESTAGE_TAGS[currentProfile.lifestage];
    if (lsTags && lsTags[cat]) {
      lsTags[cat].forEach(function(t) {
        if (recs.indexOf(t) < 0 && allTags.indexOf(t) >= 0) recs.push(t);
      });
    }
  }

  // Put user's already-selected tags at top
  var selected = epSelectedTags.filter(function(t) { return allTags.indexOf(t) >= 0 && recs.indexOf(t) < 0; });
  var merged = selected.concat(recs);

  if (merged.length === 0) return allTags.slice(0, 12);
  return merged.slice(0, 16);
}

function epRenderCategories() {
  var el = document.getElementById('ep-tag-categories');
  if (!el) return;
  el.innerHTML = Object.entries(TAG_CATEGORIES).map(function(entry) {
    var cat = entry[0], info = entry[1];
    if (cat === 'rolle') return '';
    var allTags = TAG_DATABASE[cat] || [];
    var recommended = epGetRecommendedTags(cat);
    var otherTags = allTags.filter(function(t) { return recommended.indexOf(t) < 0; });
    var expanded = _epExpandedCats[cat];
    var visibleOthers = expanded ? otherTags : otherTags.slice(0, 8);

    return '<div class="ob-cat-block">' +
      '<div class="ob-cat-header">' +
      '<span class="tag-cat-dot" style="background:' + info.color + '"></span>' +
      '<span class="tag-cat-title">' + info.label + '</span>' +
      '</div>' +
      '<div class="ob-tag-section-label recommended">For dig</div>' +
      '<div class="ob-cat-tags">' +
      recommended.map(function(t) {
        var sel = epSelectedTags.indexOf(t) >= 0;
        return '<span class="tag-pick recommended' + (sel ? ' selected' : '') + '" ' +
          'style="border-color:' + info.color + '30;' + (sel ? 'background:' + info.color + '20;color:' + info.color : 'color:' + info.color + '99') + '" ' +
          'data-tag="' + escHtml(t) + '" data-cat="' + cat + '" onclick="epTogglePickTag(this.dataset.tag,this.dataset.cat,this)">' +
          escHtml(t) + '</span>';
      }).join('') +
      '</div>' +
      (otherTags.length > 0 ? '<div class="ob-tag-section-label other">Andre</div>' +
      '<div class="ob-cat-tags">' +
      visibleOthers.map(function(t) {
        var sel = epSelectedTags.indexOf(t) >= 0;
        return '<span class="tag-pick other-tag' + (sel ? ' selected' : '') + '" ' +
          'style="border-color:' + info.color + '30;' + (sel ? 'background:' + info.color + '20;color:' + info.color : 'color:' + info.color + '99') + '" ' +
          'data-tag="' + escHtml(t) + '" data-cat="' + cat + '" onclick="epTogglePickTag(this.dataset.tag,this.dataset.cat,this)">' +
          escHtml(t) + '</span>';
      }).join('') +
      '</div>' +
      (otherTags.length > 8 ? '<button type="button" class="ob-show-more" onclick="epToggleExpand(\'' + cat + '\')" style="color:' + info.color + '">' +
        (expanded ? '− Vis færre' : '+ Vis alle ' + otherTags.length + ' andre') + '</button>' : '') : '') +
      '<div class="ob-cat-custom"><div class="ob-cat-custom-row">' +
      '<input class="ob-cat-custom-input" placeholder="" data-t-placeholder="ob_custom_tag_ph" ' +
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
  if (OB_BLOCKED_WORDS.some(function(w) { return lower.includes(w); })) { showWarningToast('Det tag er ikke tilladt'); input.value = ''; return; }
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

async function saveOnboarding() {
  try {
    if (!_obConsentGiven) return showWarningToast('Du skal acceptere betingelserne');
    const name      = (document.getElementById('ob-name')?.value || '').trim();
    const workplace = (document.getElementById('ob-workplace')?.value || '').trim();
    if (!name)      return showWarningToast('Navn er påkrævet');
    if (!workplace) return showWarningToast('Virksomhed er påkrævet');
    var isEventFlow = !!flowGet('event_flow');
    var btn = document.getElementById('ob-save-btn');
    if (btn) { btn.textContent = 'Gemmer...'; btn.disabled = true; }
    const { error } = await sb.from('profiles').upsert({
      id: currentUser.id, name, workplace, is_anon: false,
      terms_accepted_at: new Date().toISOString()
    });
    if (error) {
      if (btn) { btn.textContent = isEventFlow ? t('ob_goto_event') : t('ob_get_started'); btn.disabled = false; }
      return errorToast('save', error);
    }
    await loadCurrentProfile();
    localStorage.setItem('bubble_welcomed', '1');
    showSuccessToast('Velkommen til Bubble!');
    trackEvent('onboarding_complete', { rerun: _reRunningOnboarding });
    var wasRerun = _reRunningOnboarding;
    _reRunningOnboarding = false;
    initServices();
    if (wasRerun) {
      goTo('screen-profile');
    } else {
      await resolvePostAuthDestination();
    }
  } catch(e) { logError('saveOnboarding', e); errorToast('save', e); }
}



// ══════════════════════════════════════════════════════════
//  EDIT TAGS SCREEN (et*)
//  OWNS: ET_SECTIONS, etSelected, etCustomTags, etLifestage
//  OWNS: etInit, etBuild, etRebuildSec, etToggle, etCloseSec
//  OWNS: etTgl, etShowIn, etConfirmC, etRmCustom, etUpdateUI
//  OWNS: etSelectLifestage, etGetSelectedTags, etGetLifestage
// ══════════════════════════════════════════════════════════


// ── Pre-baked icons for edit-tags screen (16px, no runtime ico() dependency) ──
var ET_ICONS = {
  building:   '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/><path d="M10 21v-3h4v3"/></svg>',
  globe:      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3.5 9h17M3.5 15h17"/><ellipse cx="12" cy="12" rx="4" ry="9"/></svg>',
  user:       '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8.5" r="3.5"/><path d="M5.5 20.5c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5"/></svg>',
  cpu:        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9.5 2.5v4M14.5 2.5v4M9.5 17.5v4M14.5 17.5v4M2.5 9.5h4M2.5 14.5h4M17.5 9.5h4M17.5 14.5h4"/></svg>',
  rocket:     '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.5-2 5-2 5s3.5-.5 5-2c.8-.8 1-2 .4-2.8a2.1 2.1 0 00-3.4-.2z"/><path d="M12 15l-3-3"/><path d="M14.5 2.5c-3 2-5 5.5-5.5 9l3.5 3.5c3.5-.5 7-2.5 9-5.5L14.5 2.5z"/><path d="M14 9a1 1 0 100 2 1 1 0 000-2z" fill="currentColor"/><path d="M9 21c0-2.5.5-4 2-5.5M3 15c1.5-1.5 3-2 5.5-2"/></svg>',
  graduation: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10l-10-5L2 10l10 5 10-5z"/><path d="M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5"/><path d="M22 10v6"/></svg>',
  coffee:     '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8h1.5a2.5 2.5 0 010 5H17"/><path d="M5 8h12v8a4 4 0 01-4 4H9a4 4 0 01-4-4V8z"/><path d="M8 2v3M11 2v3M14 2v3"/></svg>',
  target:     '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>',
  smile:      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 14.5s1.5 2 4 2 4-2 4-2"/><circle cx="9" cy="10" r=".8" fill="currentColor" stroke="none"/><circle cx="15" cy="10" r=".8" fill="currentColor" stroke="none"/></svg>'
};
function etIco(name) { return ET_ICONS[name] || ''; }

var ET_SECTIONS = [
  {id:'branche',label:'Branche & sektor',icon:'building',desc:'Hvilken industri arbejder du i',color:'#1D4ED8',bg:'#EFF6FF',groups:[
    {label:'Teknologi & digitalt',tags:['SaaS','AI/ML','Cybersecurity','Cloud','Infrastructure','DevTools','IoT','Robotics','AR/VR','Quantum','Blockchain','Deep Tech','Hardware','Embedded','Semiconductors','Fintech','Legaltech','Insurtech','SpaceTech','Martech']},
    {label:'Energi & klima',tags:['Energi','Vindenergi','Solenergi','Brint','Energilagring','Smart Grid','Offshore','Fjernvarme','Energieffektivitet','Carbon Capture','Affaldshåndtering','Vandteknologi','Grøn Omstilling','Circular Economy','Bæredygtighed','Cleantech']},
    {label:'Sundhed & life science',tags:['Healthtech','MedTech','Pharma','Biotech','Mental Health','Sundhed','Velfærdsteknologi','Tandpleje','Genoptræning']},
    {label:'Fødevarer & bioressourcer',tags:['Foodtech','Agritech','Landbrug','Økologi','Fødevarer','Restaurant','Hotel','Turisme','Catering']},
    {label:'Produktion & industri',tags:['Produktion','Industri','Automation','Transport','Logistik','Shipping','Mobility','Lager']},
    {label:'Byggeri & anlæg',tags:['Byggeri','Anlæg','Renovering','Boligbyggeri','Proptech','Ejendomme','Bolig']},
    {label:'Finans & forsikring',tags:['Finans','Banking','Forsikring','Pension','Revision','Crypto','DeFi','Investering','Kapitalforvaltning']},
    {label:'Handel & service',tags:['E-commerce','Retail','Fashion','Luxury','D2C','B2B','B2C','Marketplace','Platform','Abonnement','Detail','Dagligvarer','Consulting','Agency','Service','Advokatbranchen','Rekruttering','Vikarbranchen','Facility Management']},
    {label:'Kreativitet & medier',tags:['Media','Publishing','Gaming','Entertainment','Reklame','Film','Musik','Kultur','Kommunikation','PR']},
  ]},
  {id:'offentlig',label:'Offentlig & erhvervsfremme',icon:'globe',desc:'Myndigheder, klynger, erhvervshuse, brancheorg.',color:'#085041',bg:'#E1F5EE',groups:[
    {label:'Myndigheder',tags:['Kommune','Region','Stat','Forsyning','Statslig styrelse','EU-institution','Politi & forsvar']},
    {label:'Erhvervsfremme',tags:['Erhvervsklynge','Brancheorganisation','Erhvervshus','Handelskammer','Vækstforum','Innovationscenter','Erhvervsråd','EU-klynge','GovTech','Civic Tech','Impact']},
    {label:'Uddannelse & forskning',tags:['Universitet','Erhvervsskole','Gymnasium','Professionshøjskole','Forskning','GTS-institut','Videncenter','Efteruddannelse']},
    {label:'Civilsamfund & NGO',tags:['NGO','Humanitær','Frivilligsektor','Forening','Fond','Socialøkonomi']},
  ]},
  {id:'rolle',label:'Rolle & funktion',icon:'user',desc:'Din position og ansvarsområde',color:'#534AB7',bg:'#EEEDFE',groups:[
    {label:'Ledelse & direktion',tags:['CEO','CTO','CFO','COO','CMO','CPO','Founder','Co-Founder','VP','Director','Partner','Board Member','General Manager','Country Manager','Managing Director','Bestyrelsesmedlem','Formand','Næstformand']},
    {label:'Teknologi & produkt',tags:['Developer','Software Engineer','Frontend Developer','Backend Developer','Data Scientist','Data Engineer','ML Engineer','DevOps Engineer','QA Engineer','Solutions Architect','Tech Lead','Product Manager']},
    {label:'Design & kreativitet',tags:['Designer','UX Designer','UI Designer','Graphic Designer','Art Director','Creative Director','Content Creator','Fotograf']},
    {label:'Projektledelse & drift',tags:['Project Manager','Program Manager','Scrum Master','Agile Coach','Team Lead','Afdelingsleder','Operations Manager','Supply Chain Manager','Logistics Manager','Produktionsleder']},
    {label:'Salg, marketing & komm.',tags:['Sales Manager','Account Manager','Key Account Manager','Marketing Manager','Growth Manager','Brand Manager','Digital Marketing Manager','Social Media Manager','Journalist','Kommunikationsrådgiver']},
    {label:'Økonomi, jura & HR',tags:['HR Manager','Recruiter','People Partner','CHRO','Legal Counsel','Compliance Officer','Indkøber','Kvalitetschef']},
    {label:'Rådgivning & analyse',tags:['Consultant','Advisor','Mentor','Coach','Business Coach','Management Consultant','Strategisk Rådgiver']},
    {label:'Investering',tags:['Investor','Business Angel','VC','LP','Fund Manager']},
    {label:'Iværksætteri',tags:['Iværksætter','Serial Entrepreneur','Freelancer','Selvstændig']},
    {label:'Uddannelse & forskning',tags:['Student','PhD','Professor','Researcher','Underviser','Lektor','Pædagog','Lærer','Skoleleder']},
    {label:'Sundhed & omsorg',tags:['Sygeplejerske','Læge','Tandlæge','Fysioterapeut','Psykolog','Ergoterapeut','Jordemoder','Sundhedsplejerske','Farmaceut','Bioanalytiker','Radiograf','Sosu-assistent','Sosu-hjælper','Plejehjemsleder']},
    {label:'Offentlig forvaltning',tags:['Kommunaldirektør','Kontorchef','Sagsbehandler','Socialrådgiver','Embedsmand','Forvaltningschef']},
    {label:'Håndværk & industri',tags:['Tømrer','Elektriker','VVS-installatør','Murer','Maler','Smed','Mekaniker','Maskinmester','Ingeniør','Industritekniker','Procesoperatør','CNC-operatør','Håndværker','Mester','Installatør']},
    {label:'Service & detail',tags:['Kok','Tjener','Hotelchef','Restaurantchef','Bartender','Butiksbestyrer','Butikschef','Ejendomsmægler','Landmand','Gartner','Skovfoged']},
    {label:'Frivillig & community',tags:['Frivillig','Træner','Instruktør','Terapeut']},
  ]},
  {id:'komp',label:'Kompetencer',icon:'cpu',desc:'Hvad er du særligt god til',color:'#993556',bg:'#FBEAF0',groups:[
    {label:'Teknologi & data',tags:['Frontend','Backend','Full-Stack','Mobile (iOS)','Mobile (Android)','React','Python','Node.js','Java','C#','TypeScript','Go','Rust','PHP','Swift','API Design','Architecture','System Design','DevOps','CI/CD','Security','Cloud Architecture','Data Analytics','Machine Learning','NLP','Computer Vision','Deep Learning','Data Engineering','Data Visualization','Business Intelligence','Power BI','Excel/Sheets','UX/UI Design','Product Development']},
    {label:'Marketing & vækst',tags:['Growth Hacking','SEO/SEM','Content Marketing','Social Media','Paid Acquisition','Email Marketing','CRO','Analytics','Influencer Marketing','Branding','Copywriting','Google Ads','Meta Ads','LinkedIn Marketing']},
    {label:'Salg & forretning',tags:['Sales Strategy','Enterprise Sales','Partnerships','BD','Key Account Management','Forhandling','Kundeservice','Pipeline Management','CRM']},
    {label:'Økonomi & fundraising',tags:['Fundraising','Pitch Deck','Financial Modeling','Due Diligence','Budgettering','Regnskab','Controlling','Økonomiansvar','Bogføring','Revision']},
    {label:'People & organisation',tags:['People Ops','Talent Acquisition','Culture','Org Design','Medarbejderudvikling','Onboarding','Employer Branding','Konfliktløsning','Coaching','Mentoring']},
    {label:'Drift & supply chain',tags:['Operations','Supply Chain','Procurement','Lagerstyring','Lean Manufacturing','Six Sigma','Kvalitetsstyring','ISO','Produktionsplanlægning','Vedligeholdelse']},
    {label:'Kommunikation & brand',tags:['Brand Strategy','PR/Comms','Storytelling','Krisekommunikation','Intern Kommunikation','Pressearbejde','Eventplanlægning']},
    {label:'Jura & compliance',tags:['Legal/Compliance','IP/Patent','GDPR','Kontraktret','Persondataret','Udbudsret']},
    {label:'Innovation & research',tags:['Research','Innovation','Strategy','Facilitation','Design Thinking','Prototyping','User Research','Forretningsudvikling','Markedsanalyse','Konkurrentanalyse']},
    {label:'Bæredygtighed',tags:['Sustainability','ESG','Carbon Accounting','LCA','Miljøledelse','Energioptimering','Grøn Certificering']},
    {label:'Bygge & anlæg',tags:['Projektledelse','Byggeledelse','Tilbudskalkulation','Tegning/CAD','3D-modellering','BIM','Energiinstallation','Elinstallation','VVS']},
    {label:'Sundhed & klinik',tags:['Klinisk Arbejde','Patientpleje','Medicinhåndtering','Rehabilitering','Tværfagligt Samarbejde','Dokumentation']},
    {label:'Undervisning',tags:['Undervisning','Kursusudvikling','E-læring','Pædagogik','Didaktik','Vejledning']},
  ]},
  {id:'int',label:'Faglige interesser',icon:'rocket',desc:'Hvad driver dig fagligt',color:'#B45309',bg:'#FAEEDA',groups:[
    {label:'Teknologi & digitalt',tags:['Open Source','Web3','Decentralization','Privacy','AI Ethics','Responsible AI','AI Safety','No-Code','Low-Code','Maker Culture']},
    {label:'Klima & bæredygtighed',tags:['Climate Action','Social Impact','Grøn Omstilling','Regenerativt Landbrug','Biodiversitet','Havmiljø','Cirkulær Økonomi']},
    {label:'Arbejdsliv & ledelse',tags:['Future of Work','Remote Work','Digital Nomad','Leadership','Management','Intrapreneurship','Selvledelse','Work-Life Balance']},
    {label:'Iværksætteri & investering',tags:['Entrepreneurship','Venture Capital','Angel Investing','Crowdfunding','Nordic Startups','European Tech','Global Markets','Internationalisering','Skalering','Exit Strategy','Startup Økosystem','Iværksætterkultur']},
    {label:'Community & netværk',tags:['Networking','Community Building','Events','Foreningsliv','Frivilligt Arbejde','Lokalt Engagement','Mentorordninger','Erfa-grupper','Branchenetværk']},
    {label:'Personlig udvikling',tags:['Personal Development','Mindfulness','Biohacking','Public Speaking','Writing','Podcasting','Fotografi','Musik','Kunst','Håndarbejde']},
    {label:'Metoder & frameworks',tags:['Design Thinking','Lean Startup','Agile','Scrum','OKR','Kaizen','Systems Thinking']},
    {label:'Innovation & transformation',tags:['Smart Cities','Digital Health','Digital Transformation','Industry 4.0','Automation','PropTech Innovation','Creator Economy']},
    {label:'Diversitet & inklusion',tags:['Diversity & Inclusion','Gender Equality','Tilgængelighed']},
    {label:'Viden & læring',tags:['Livslang Læring','Faglig Udvikling','Videndeling','Tværfaglighed','Forskning & Udvikling']},
    {label:'Sektorspecifikt',tags:['Patientinddragelse','Velfærdsinnovation','Sundhedsfremme','Bygningskultur','Cirkulært Byggeri','Energirenovering','Fødevaresikkerhed','Madkultur','Gastronomi']},
  ]},
];

var etSelected = new Map();
var etCustom = {};
var etInputVis = {};
var etOpenSec = null;
var etLifestage = null;
var _etPrefix = ''; // '' for setup sheets, 'dash-' for profile dashboard
function _etEl(id) { return document.getElementById(_etPrefix + id); }

var ET_LS = [
  {id:'student',icon:'graduation',label:'Student'},
  {id:'employee',icon:'building',label:'Ansat'},
  {id:'entrepreneur',icon:'rocket',label:'Iværksætter'},
  {id:'freelancer',icon:'coffee',label:'Freelancer'},
  {id:'investor',icon:'target',label:'Investor'},
  {id:'public',icon:'globe',label:'Offentlig'},
  {id:'practical',icon:'cpu',label:'Fagperson'},
  {id:'other',icon:'smile',label:'Andet'},
];

function etInit() {
  etSelected = new Map();
  etCustom = {};
  etInputVis = {};
  etOpenSec = null;
  etLifestage = (currentProfile && currentProfile.lifestage) || null;
  ET_SECTIONS.forEach(function(s){ etCustom[s.id] = []; etInputVis[s.id] = false; });
  // Pre-load existing tags
  var kw = (currentProfile && currentProfile.keywords) || [];
  kw.forEach(function(tag) {
    var cat = (typeof getTagCategory === 'function') ? getTagCategory(tag) : 'custom';
    var secId = cat === 'branche' ? 'branche' : cat === 'rolle' ? 'rolle'
              : cat === 'kompetence' ? 'komp' : cat === 'interesse' ? 'int' : null;
    // Check offentlig
    var offSec = ET_SECTIONS.find(function(s){ return s.id === 'offentlig'; });
    if (offSec) {
      var offAll = offSec.groups.reduce(function(a,g){ return a.concat(g.tags); },[]);
      if (offAll.indexOf(tag) >= 0) secId = 'offentlig';
    }
    // Check if tag exists in any section
    var found = false;
    ET_SECTIONS.forEach(function(s) {
      s.groups.forEach(function(g) { if (g.tags.indexOf(tag) >= 0) { found = true; if (!secId) secId = s.id; } });
    });
    if (!secId) secId = 'custom';
    var sec = ET_SECTIONS.find(function(s){ return s.id === secId; }) || {color:'#6B7280',bg:'#F1EFF8'};
    if (!found && secId !== 'custom') {
      // Custom tag
      if (!etCustom[secId]) etCustom[secId] = [];
      etCustom[secId].push(tag);
    }
    etSelected.set(tag, {sec: secId, color: sec.color, bg: sec.bg});
  });
  etBuild();
  etUpdateUI();
}

function etEsc(s){ return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }

function etCountSec(id){ var n=0; etSelected.forEach(function(v){ if(v.sec===id)n++; }); return n; }

function etBuildBody(s) {
  var h = '';
  s.groups.forEach(function(g){
    h += '<div><div style="font-size:0.58rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--muted);padding:0.25rem 0 0.1rem">' + g.label + '</div><div style="display:flex;flex-wrap:wrap;gap:0.3rem">';
    g.tags.forEach(function(tag){
      var isSel = etSelected.has(tag);
      var style = isSel ? 'background:'+s.color+';border-color:'+s.color+';color:white' : 'background:'+s.bg+';border-color:'+s.bg+';color:'+s.color;
      h += '<span style="padding:0.27rem 0.65rem;border-radius:99px;font-size:0.7rem;font-weight:500;cursor:pointer;border:1.5px solid;transition:all .13s;'+style+'" onclick="etTgl(\''+etEsc(tag)+'\',\''+s.id+'\')">' + tag + '</span>';
    });
    h += '</div></div>';
  });
  // Custom tags
  h += '<div style="margin-top:0.4rem;padding-top:0.5rem;border-top:1.5px dashed var(--glass-border)">';
  var ct = etCustom[s.id] || [];
  if (ct.length > 0) {
    h += '<div style="display:flex;flex-wrap:wrap;gap:0.3rem;margin-bottom:0.35rem">';
    ct.forEach(function(tag){
      var isSel = etSelected.has(tag);
      var bg = isSel ? s.color : s.bg; var col = isSel ? 'white' : s.color;
      h += '<span style="display:inline-flex;align-items:center;gap:0.25rem;padding:0.25rem 0.55rem;border-radius:99px;font-size:0.68rem;font-weight:600;border:1.5px dashed '+s.color+'40;background:'+bg+';color:'+col+';cursor:pointer" onclick="etTgl(\''+etEsc(tag)+'\',\''+s.id+'\')">' +
        tag + '<span style="opacity:0.55;font-size:0.65rem" onclick="event.stopPropagation();etRmCustom(\''+etEsc(tag)+'\',\''+s.id+'\')">×</span></span>';
    });
    h += '</div>';
  }
  if (!etInputVis[s.id]) {
    h += '<button style="display:inline-flex;align-items:center;gap:0.3rem;padding:0.3rem 0.75rem;border-radius:99px;font-size:0.7rem;font-weight:600;cursor:pointer;border:1.5px dashed '+s.color+'40;color:'+s.color+';background:transparent;font-family:inherit" onclick="etShowIn(\''+s.id+'\')"><span style="font-size:0.9rem;line-height:1">+</span> Tilføj eget tag</button>';
  } else {
    h += '<div style="display:flex;gap:0.35rem;align-items:center;margin-top:0.4rem">' +
      '<input id="etci-'+s.id+'" style="flex:1;padding:0.35rem 0.65rem;border-radius:99px;font-size:0.72rem;font-family:inherit;border:1.5px solid var(--glass-border);background:var(--bg);outline:none;color:var(--text);min-width:0" placeholder="Skriv dit tag..." maxlength="40" oninput="etCiChk(\''+s.id+'\')" onkeydown="etCiKey(event,\''+s.id+'\')">' +
      '<button id="etci-btn-'+s.id+'" disabled style="padding:0.35rem 0.75rem;border-radius:99px;font-size:0.7rem;font-weight:700;font-family:inherit;border:none;background:'+s.color+';color:white;cursor:pointer;opacity:0.35" onclick="etConfirmC(\''+s.id+'\')">Tilføj</button>' +
      '<button style="padding:0.35rem 0.6rem;border-radius:99px;font-size:0.7rem;font-weight:600;font-family:inherit;border:1px solid var(--glass-border);background:var(--bg);cursor:pointer;color:var(--muted)" onclick="etHideIn(\''+s.id+'\')">×</button>' +
    '</div>';
  }
  h += '</div>';
  // Done row
  var n = etCountSec(s.id);
  h += '<div style="display:flex;align-items:center;justify-content:space-between;padding:0.6rem 0 0.8rem;margin-top:0.1rem">' +
    '<div style="font-size:0.7rem;font-weight:600;color:'+s.color+'">'+n+' valgt</div>' +
    '<button style="padding:0.38rem 1rem;border-radius:99px;font-size:0.72rem;font-weight:700;font-family:inherit;border:none;cursor:pointer;background:'+s.bg+';color:'+s.color+'" onclick="etCloseSec(\''+s.id+'\')">Gem &amp; luk ✓</button>' +
  '</div>';
  return h;
}

function etBuild() {
  var list = _etEl('et-acc-list'); if (!list) return;
  list.innerHTML = '';
  ET_SECTIONS.forEach(function(s){
    var div = document.createElement('div');
    div.style.cssText = 'background:var(--bg);border:1px solid var(--glass-border-subtle);border-radius:13px;margin-bottom:0.35rem' + (etOpenSec===s.id?';border-color:rgba(124,92,252,0.18);box-shadow:0 2px 10px rgba(30,27,46,0.06)':'');
    div.id = _etPrefix + 'et-acc-' + s.id;
    var n = etCountSec(s.id);
    var badgeHtml = n > 0 ? '<span style="font-size:0.6rem;font-weight:700;padding:2px 7px;border-radius:99px;background:'+s.bg+';color:'+s.color+'">'+n+'</span>' : '';
    div.innerHTML =
      '<div style="display:flex;align-items:center;gap:0.6rem;padding:0.75rem 0.85rem;cursor:pointer;user-select:none;-webkit-tap-highlight-color:transparent" onclick="etToggle(\''+s.id+'\')">' +
        '<div style="width:32px;height:32px;border-radius:9px;background:'+s.bg+';display:flex;align-items:center;justify-content:center;flex-shrink:0"><span style="display:flex;align-items:center;width:16px;height:16px;color:'+s.color+'">' + etIco(s.icon) + '</span></div>' +
        '<div style="flex:1;min-width:0"><div style="font-size:0.82rem;font-weight:700">'+s.label+'</div><div style="font-size:0.6rem;color:var(--muted);margin-top:1px">'+s.desc+'</div></div>' +
        badgeHtml +
        '<div style="color:var(--muted);font-size:0.7rem;transition:transform .22s;'+(etOpenSec===s.id?'transform:rotate(180deg)':'')+'">▼</div>' +
      '</div>' +
      (etOpenSec===s.id ? '<div style="padding:0 0.75rem;display:flex;flex-direction:column;gap:0.45rem">'+etBuildBody(s)+'</div>' : '');
    list.appendChild(div);
  });
  // Lifestage buttons
  var lsEl = _etEl('et-lifestage-btns'); if (!lsEl) return;
  lsEl.innerHTML = ET_LS.map(function(ls){
    var isSel = etLifestage === ls.id;
    var style = isSel
      ? 'background:rgba(245,158,11,0.12);border:2px solid #F59E0B;color:#B45309;font-weight:700'
      : 'background:var(--bg);border:1.5px solid var(--glass-border);color:var(--muted);font-weight:500';
    return '<span style="display:inline-flex;align-items:center;gap:0.35rem;padding:0.3rem 0.7rem;border-radius:99px;font-size:0.68rem;cursor:pointer;font-family:inherit;'+style+'" onclick="etSelectLifestage(\''+ls.id+'\')">' +
      '<span style="display:flex;align-items:center;width:14px;height:14px;flex-shrink:0">' + etIco(ls.icon) + '</span>' +
      ls.label + '</span>';
  }).join('');
}

function etRebuildSec(id){
  var s = ET_SECTIONS.find(function(x){return x.id===id;});
  var el = _etEl('et-acc-'+id);
  if (!el) return;
  var n = etCountSec(id);
  var badgeHtml = n > 0 ? '<span style="font-size:0.6rem;font-weight:700;padding:2px 7px;border-radius:99px;background:'+s.bg+';color:'+s.color+'">'+n+'</span>' : '';
  el.innerHTML =
    '<div style="display:flex;align-items:center;gap:0.6rem;padding:0.75rem 0.85rem;cursor:pointer;user-select:none;-webkit-tap-highlight-color:transparent" onclick="etToggle(\''+s.id+'\')">' +
      '<div style="width:32px;height:32px;border-radius:9px;background:'+s.bg+';display:flex;align-items:center;justify-content:center;flex-shrink:0"><span style="display:flex;align-items:center;width:16px;height:16px;color:'+s.color+'">' + etIco(s.icon) + '</span></div>' +
      '<div style="flex:1;min-width:0"><div style="font-size:0.82rem;font-weight:700">'+s.label+'</div><div style="font-size:0.6rem;color:var(--muted);margin-top:1px">'+s.desc+'</div></div>' +
      badgeHtml +
      '<div style="color:var(--muted);font-size:0.7rem;transition:transform .22s;'+(etOpenSec===id?'transform:rotate(180deg)':'')+'">▼</div>' +
    '</div>' +
    (etOpenSec===id ? '<div style="padding:0 0.75rem;display:flex;flex-direction:column;gap:0.45rem">'+etBuildBody(s)+'</div>' : '');
  el.style.cssText = 'background:var(--bg);border:1px solid var(--glass-border-subtle);border-radius:13px;margin-bottom:0.35rem' + (etOpenSec===id?';border-color:rgba(124,92,252,0.18);box-shadow:0 2px 10px rgba(30,27,46,0.06)':'');
}

function etToggle(id) {
  etOpenSec = etOpenSec === id ? null : id;
  etBuild();
  if (etOpenSec) {
    setTimeout(function(){ var el=_etEl('et-acc-'+id); if(el)el.scrollIntoView({behavior:'smooth',block:'start'}); }, 60);
  }
}

function etCloseSec(id){
  etOpenSec=null;
  etBuild();
  etUpdateUI();
  // Auto-save when closing a section — same pattern as setup sheets
  if (typeof saveTagsOnly === 'function') saveTagsOnly();
}

function etTgl(tag, secId){
  if (etSelected.has(tag)){ etSelected.delete(tag); }
  else {
    var s=ET_SECTIONS.find(function(x){return x.id===secId;});
    etSelected.set(tag,{sec:secId,color:s?s.color:'#6B7280',bg:s?s.bg:'#F1EFF8'});
  }
  etRebuildSec(secId); etUpdateUI();
}

function etShowIn(id){ etInputVis[id]=true; etRebuildSec(id); setTimeout(function(){var el=document.getElementById('etci-'+id);if(el)el.focus();},40); }
function etHideIn(id){ etInputVis[id]=false; etRebuildSec(id); }

function etCiChk(id){
  var v=(document.getElementById('etci-'+id)||{}).value||'';
  var btn=document.getElementById('etci-btn-'+id);
  if(btn){btn.disabled=v.trim().length<2;btn.style.opacity=v.trim().length<2?'0.35':'1';}
}

function etCiKey(e,id){ if(e.key==='Enter'){e.preventDefault();etConfirmC(id);} if(e.key==='Escape')etHideIn(id); }

function etConfirmC(id){
  var input=document.getElementById('etci-'+id); if(!input)return;
  var val=input.value.trim(); if(val.length<2)return;
  var fmt=val.charAt(0).toUpperCase()+val.slice(1);
  if(!(etCustom[id]||[]).includes(fmt)){
    if(!etCustom[id])etCustom[id]=[];
    etCustom[id].push(fmt);
    var s=ET_SECTIONS.find(function(x){return x.id===id;});
    etSelected.set(fmt,{sec:id,color:s?s.color:'#6B7280',bg:s?s.bg:'#F1EFF8'});
  }
  etInputVis[id]=false; etRebuildSec(id); etUpdateUI();
}

function etRmCustom(tag,id){
  etCustom[id]=(etCustom[id]||[]).filter(function(t){return t!==tag;});
  etSelected.delete(tag); etRebuildSec(id); etUpdateUI();
}

function etSelectLifestage(stage){
  etLifestage = etLifestage === stage ? null : stage;
  etBuild(); etUpdateUI();
}

function etUpdateUI(){
  var n=etSelected.size;
  var bar=_etEl('et-prog-bar'); if(bar)bar.style.width=Math.min(n/10*100,100)+'%';
  var lbl=_etEl('et-prog-lbl'); if(lbl)lbl.textContent=n+' valgt';

  // ── Tray preview (first 3 + count) ──
  var preview=_etEl('et-tray-preview');
  if(preview){
    var all=Array.from(etSelected.entries());
    var shown=all.slice(0,3);
    var rest=all.length-3;
    preview.innerHTML=shown.map(function(e){
      var v=e[1];
      return '<span style="padding:0.18rem 0.5rem;border-radius:99px;font-size:0.62rem;font-weight:600;background:'+v.bg+';color:'+v.color+';border:0.5px solid '+v.color+'30;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:80px">'+escHtml(e[0])+'</span>';
    }).join('')+(rest>0?'<span style="font-size:0.62rem;font-weight:600;color:var(--muted);white-space:nowrap">+'+rest+' mere</span>':'');
  }

  // ── Tray btn: hide if 0 tags ──
  var trayBtn=_etEl('et-tray-btn');
  if(trayBtn)trayBtn.style.display=n>0?'flex':'none';

  // ── Tray drawer (all tags with ×) ──
  var drawer=_etEl('et-tray-drawer');
  if(drawer&&drawer.style.display!=='none'){
    drawer.innerHTML=Array.from(etSelected.entries()).map(function(e){
      var tg=e[0],v=e[1];
      return '<span style="display:inline-flex;align-items:center;gap:0.2rem;padding:0.2rem 0.5rem 0.2rem 0.55rem;border-radius:99px;font-size:0.65rem;font-weight:600;background:'+v.bg+';color:'+v.color+';border:0.5px solid '+v.color+'30">' +
        escHtml(tg)+
        '<span onclick="etRemoveTag(\''+etEsc(tg)+'\')" style="cursor:pointer;opacity:0.45;font-size:0.65rem;margin-left:1px;line-height:1">×</span></span>';
    }).join('');
  }

  // ── Old chips container (kept for backward compat) ──
  var chips=_etEl('et-chips');
  if(chips)chips.innerHTML='';
}

function etToggleTray(){
  var drawer=_etEl('et-tray-drawer');
  var btn=_etEl('et-tray-btn-lbl');
  var chev=_etEl('et-tray-chev');
  if(!drawer)return;
  var open=drawer.style.display!=='none';
  drawer.style.display=open?'none':'flex';
  if(btn)btn.textContent=open?'Se alle':'Luk';
  if(chev)chev.style.transform=open?'':'rotate(180deg)';
  if(!open)etUpdateUI(); // re-render drawer contents
}

async function etRemoveTag(tag){
  etSelected.delete(tag);
  // Also remove from custom lists
  Object.keys(etCustom).forEach(function(secId){
    etCustom[secId]=(etCustom[secId]||[]).filter(function(t){return t!==tag;});
  });
  etUpdateUI();
  // Rebuild open section if any
  if(etOpenSec)etRebuildSec(etOpenSec);
  else etBuild();
  // Save immediately
  if(typeof saveTagsOnly==='function')saveTagsOnly();
}

function etGetSelectedTags(){ return Array.from(etSelected.keys()); }
function etGetLifestage(){ return etLifestage; }
