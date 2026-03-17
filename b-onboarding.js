// ══════════════════════════════════════════════════════════
//  BUBBLE — ONBOARDING + TAG PICKER + WELCOME
//  Auto-split from app.js · v3.7.0
// ══════════════════════════════════════════════════════════

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

function reRunOnboarding() {
  if (!currentProfile || !currentUser) return;
  // Pre-fill with existing data
  var obName = document.getElementById('ob-name');
  var obTitle = document.getElementById('ob-title');
  var obBio = document.getElementById('ob-bio');
  var obLinkedin = document.getElementById('ob-linkedin');
  var obWp = document.getElementById('ob-workplace');
  if (obName) obName.value = currentProfile.name || '';
  if (obTitle) obTitle.value = currentProfile.title || '';
  if (obBio) obBio.value = currentProfile.bio || '';
  if (obLinkedin) obLinkedin.value = currentProfile.linkedin || '';
  if (obWp) obWp.value = currentProfile.workplace || '';
  // Load existing tags
  obSelectedTags = Array.isArray(currentProfile.keywords) ? [...currentProfile.keywords] : [];
  obRenderSelectedTags();
  obRenderCategories();
  // Reset progress UI
  obCheckProgress();
  goTo('screen-onboarding');
  setTimeout(initInputConfirmButtons, 50);
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
  if (score >= 80) { label.textContent = 'Stærk'; label.style.color = '#1A9E8E'; bar.style.background = '#1A9E8E'; }
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

// ── Progressive section unlock ──
function obCheckProgress() {
  var name = (document.getElementById('ob-name')?.value || '').trim();
  var title = (document.getElementById('ob-title')?.value || '').trim();
  var isEventFlowOb = sessionStorage.getItem('event_flow');
  var secADone = isEventFlowOb ? !!name : (name && obLifestage);
  var secBDone = obSelectedTags.length >= 3;

  // Preview: unlock when name + livsfase
  var secPreview = document.getElementById('ob-sec-preview');
  if (secPreview) {
    if (secADone && secPreview.classList.contains('ob-sec-locked')) {
      secPreview.classList.remove('ob-sec-locked');
      obLoadPeoplePreview();
    } else if (!secADone && !secPreview.classList.contains('ob-sec-locked')) {
      secPreview.classList.add('ob-sec-locked');
    }
  }
  // Live-update preview when tags change (throttled 400ms)
  if (secADone && _obPreviewProfiles && _obPreviewProfiles.length > 0) {
    clearTimeout(_obPreviewTimer);
    _obPreviewTimer = setTimeout(obRenderPreviewProfiles, 400);
  }

  // Section B (tags): unlock when name + livsfase
  var secB = document.getElementById('ob-sec-b');
  var checkA = document.getElementById('ob-check-a');
  if (secB) {
    if (secADone && secB.classList.contains('ob-sec-locked')) {
      secB.classList.remove('ob-sec-locked');
      obRenderCategories();
    } else if (!secADone && !secB.classList.contains('ob-sec-locked')) {
      secB.classList.add('ob-sec-locked');
    }
  }
  if (checkA) {
    if (secADone) { checkA.classList.add('done'); checkA.innerHTML = '✓'; }
    else { checkA.classList.remove('done'); checkA.textContent = '1'; }
  }

  // Section C (intent): unlock when 3+ tags
  var secC = document.getElementById('ob-sec-c');
  var checkB = document.getElementById('ob-check-b');
  if (secC) {
    if (secBDone && secC.classList.contains('ob-sec-locked')) {
      secC.classList.remove('ob-sec-locked');
    } else if (!secBDone && !secC.classList.contains('ob-sec-locked')) {
      secC.classList.add('ob-sec-locked');
    }
  }
  if (checkB) {
    if (secBDone) { checkB.classList.add('done'); checkB.innerHTML = '✓'; }
    else { checkB.classList.remove('done'); checkB.textContent = '2'; }
  }

  // Save button: active when minimum requirements met
  var saveBtn = document.getElementById('ob-save-btn');
  if (saveBtn) {
    var workplace = (document.getElementById('ob-workplace')?.value || '').trim();
    var isEventFlow = sessionStorage.getItem('event_flow');
    var canSave = isEventFlow ? (name && workplace) : (name && title && secBDone);
    saveBtn.style.opacity = canSave ? '1' : '0.3';
    saveBtn.style.pointerEvents = canSave ? 'auto' : 'none';
  }

  // Step label
  var stepLabel = document.getElementById('ob-step-label');
  if (stepLabel) {
    var step = secBDone ? 3 : secADone ? 2 : 1;
    stepLabel.textContent = 'Trin ' + step + ' af 3';
  }

  // Update preview hint and CTA
  var hint = document.getElementById('ob-preview-hint');
  var cta = document.getElementById('ob-preview-cta');
  if (hint && cta) {
    if (obSelectedTags.length === 0) {
      hint.textContent = 'Baseret på din livsfase';
      cta.textContent = 'Tilføj tags for at se bedre matches ↓';
    } else if (obSelectedTags.length < 3) {
      hint.textContent = 'Baseret på ' + obSelectedTags.length + ' tag' + (obSelectedTags.length > 1 ? 's' : '');
      cta.textContent = 'Vælg ' + (3 - obSelectedTags.length) + ' mere for at fortsætte ↓';
    } else {
      hint.textContent = 'Baseret på ' + obSelectedTags.length + ' tags — bedre matches!';
      cta.textContent = 'Færdiggør din profil for at starte samtaler →';
      cta.style.color = 'var(--green)';
    }
  }

  // Tag min label
  obUpdateTagLabel();
  updateObStrength();
}


function skipOnboarding() {
  var name = (document.getElementById('ob-name')?.value || '').trim();
  if (!name && currentProfile?.name) name = currentProfile.name;
  if (!name && currentUser?.email) name = currentUser.email.split('@')[0];
  if (!name) { showToast('Skriv dit navn først — det er alt der kræves'); return; }

  // Event flow requires full profile
  var isEventFlow = sessionStorage.getItem('event_flow');
  if (isEventFlow) { showToast('Udfyld navn og virksomhed for at deltage'); return; }

  sb.from('profiles').upsert({
    id: currentUser.id, name: name,
    title: (document.getElementById('ob-title')?.value || '').trim() || 'Ikke udfyldt',
    workplace: (document.getElementById('ob-workplace')?.value || '').trim() || '',
    keywords: obSelectedTags.length > 0 ? obSelectedTags : ['Ny bruger'],
    dynamic_keywords: [], bio: '', is_anon: false,
    onboarding_skipped: true,
    life_phase: obLifestage || null,
    sectors: (_selectedInterests && _selectedInterests.length > 0) ? _selectedInterests : []
  }).then(function() {
    loadCurrentProfile();
    showToast('Du kan altid udfylde din profil senere');
    goTo('screen-home');
    preloadAllData();
    initGlobalRealtime();
    updateUnreadBadge();
    updateNotifNavBadge();
    loadLiveBubbleStatus();
    initPushNotifications();
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
    overlay.style.cssText = 'position:fixed;inset:0;z-index:999;background:rgba(30,27,46,0.2);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)';
    overlay.innerHTML = '<div style="background:rgba(255,255,255,0.98);border:1px solid var(--glass-border);border-radius:20px;padding:1.5rem;max-width:320px;text-align:center;font-family:Figtree,sans-serif">' +
      '<div style="font-size:1.1rem;font-weight:800;color:var(--text);margin-bottom:0.5rem">Afbryd opsætning?</div>' +
      '<div style="font-size:0.8rem;color:var(--text-secondary);line-height:1.5;margin-bottom:1.2rem">Alt du har udfyldt nulstilles og du vender tilbage til login-skærmen.</div>' +
      '<button onclick="confirmAbortOnboarding()" style="width:100%;padding:0.65rem;border-radius:12px;border:1px solid rgba(26,122,138,0.3);background:rgba(26,122,138,0.1);color:var(--accent2);font-family:inherit;font-size:0.85rem;font-weight:700;cursor:pointer;margin-bottom:0.4rem">Ja, afbryd og nulstil</button>' +
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
  try {
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
  } catch(e) { logError("confirmAbortOnboarding", e); }
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
  obCheckProgress();
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
    sb.from('custom_tags').select('id,usage_count').eq('label', title).maybeSingle().then(function(res) {
      if (res.data && res.data.usage_count > 1) return;
      // Already handled by upsert
    });
  }).catch(function() {});
}

// ── Apple Login ──

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
//  PROGRESSIVE ONBOARDING (v4.0)
// ══════════════════════════════════════════════════════════
async function showProgressiveOnboarding() {
  if (!currentProfile || !currentUser) return;
  var container = document.getElementById('home-progressive-onboarding');
  var cardsEl = document.getElementById('gs-v4-cards');
  if (!container || !cardsEl) return;

  // Check current profile state
  var hasPhoto = !!currentProfile.avatar_url;
  var hasTitle = !!(currentProfile.title && currentProfile.workplace);
  var hasTags = (currentProfile.keywords || []).length >= 3;

  // Check bubble membership (async)
  var hasBubble = false;
  try {
    var { count } = await sb.from('bubble_members')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', currentUser.id);
    hasBubble = (count || 0) > 0;
  } catch(e) { /* silent */ }

  var steps = [
    { key: 'tags', svgIco: 'target', color: 'var(--green)', softColor: 'rgba(26,158,142,0.08)', title: 'Vælg interesser', sub: 'Aktiverer matching', done: hasTags, action: 'reRunOnboarding()' },
    { key: 'title', svgIco: 'briefcase', color: 'var(--accent)', softColor: 'rgba(124,92,252,0.06)', title: 'Tilføj titel & arbejdsplads', sub: 'Unlock 5+ flere matches', done: hasTitle, action: "goTo('screen-profile');setTimeout(function(){profSwitchTab('edit')},200)" },
    { key: 'photo', svgIco: 'camera', color: '#3B82F6', softColor: 'rgba(59,130,246,0.06)', title: 'Tilføj profilbillede', sub: '3x flere kontakter', done: hasPhoto, action: "goTo('screen-profile');setTimeout(function(){profSwitchTab('edit')},200)" },
    { key: 'bubble', svgIco: 'bubble', color: '#E879A8', softColor: 'rgba(232,121,168,0.06)', title: 'Join din første boble', sub: 'Åbn for endnu flere profiler', done: hasBubble, action: "goTo('screen-discover')" }
  ];

  // Only show incomplete steps
  var incomplete = steps.filter(function(s) { return !s.done; });

  // All done — hide entire section
  if (incomplete.length === 0) {
    container.style.display = 'none';
    return;
  }

  // Render only incomplete steps
  cardsEl.innerHTML = incomplete.map(function(s, i) {
    var highlight = i === 0;
    return '<div class="gs-v4-card' + (highlight ? ' highlight' : '') + '" onclick="' + s.action + '">' +
      '<div class="gs-v4-icon" style="background:' + s.softColor + ';color:' + s.color + '">' + ico(s.svgIco) + '</div>' +
      '<div class="gs-v4-text"><div class="gs-v4-title">' + s.title + '</div>' +
      '<div class="gs-v4-sub">' + s.sub + '</div></div>' +
      '<div style="color:var(--accent);font-size:0.75rem;font-weight:600">\u2192</div>' +
      '</div>';
  }).join('');

  container.style.display = 'block';
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


function obGetRecommendedTags(cat) {
  var allTags = TAG_DATABASE[cat] || [];
  if (cat === 'rolle') return allTags.slice(0, 8);

  // Start with lifestage-based recommendations
  var lifestageRecs = (obLifestage && OB_LIFESTAGE_TAGS[obLifestage]) ? OB_LIFESTAGE_TAGS[obLifestage][cat] || [] : [];

  // Add interest-based recommendations
  var interestRecs = [];
  if (_selectedInterests && _selectedInterests.length > 0) {
    _selectedInterests.forEach(function(key) {
      var map = OB_INTEREST_TAGS[key];
      if (map && map[cat]) {
        map[cat].forEach(function(t) {
          if (interestRecs.indexOf(t) < 0 && allTags.indexOf(t) >= 0) interestRecs.push(t);
        });
      }
    });
  }

  // Merge: interest tags first (highest relevance), then lifestage, deduplicated
  var merged = [];
  interestRecs.forEach(function(t) { if (merged.indexOf(t) < 0) merged.push(t); });
  lifestageRecs.forEach(function(t) { if (merged.indexOf(t) < 0) merged.push(t); });

  // If still empty, fall back to first 8
  if (merged.length === 0) return allTags.slice(0, 8);

  // Cap at 12 to keep it scannable
  return merged.slice(0, 12);
}

var OB_TAGS_INITIAL = 8; // Show 8 tags initially per category
var _obExpandedCats = {};

function obRenderCategories() {
  var el = document.getElementById('ob-tag-categories');
  if (!el) return;

  el.innerHTML = Object.entries(TAG_CATEGORIES).map(function(entry) {
    var cat = entry[0], info = entry[1];
    if (cat === 'rolle') return '';
    var allTags = TAG_DATABASE[cat] || [];
    var recommended = obGetRecommendedTags(cat);
    var otherTags = allTags.filter(function(t) { return recommended.indexOf(t) < 0; });
    var expanded = _obExpandedCats[cat];
    var visibleOthers = expanded ? otherTags : otherTags.slice(0, 8);

    return '<div class="ob-cat-block">' +
      '<div class="ob-cat-header">' +
      '<span class="tag-cat-dot" style="background:' + info.color + '"></span>' +
      '<span class="tag-cat-title">' + info.label + '</span>' +
      '</div>' +
      '<div class="ob-tag-section-label recommended">For dig</div>' +
      '<div class="ob-cat-tags">' +
      recommended.map(function(t) {
        var sel = obSelectedTags.indexOf(t) >= 0;
        return '<span class="tag-pick recommended' + (sel ? ' selected' : '') + '" ' +
          'style="border-color:' + info.color + '30;' + (sel ? 'background:' + info.color + '20;color:' + info.color : 'color:' + info.color + '99') + '" ' +
          'onclick="obTogglePickTag(\'' + escHtml(t).replace(/'/g,"\\'") + '\',\'' + cat + '\',this)">' +
          escHtml(t) + '</span>';
      }).join('') +
      '</div>' +
      (otherTags.length > 0 ? '<div class="ob-tag-section-label other">Andre</div>' +
      '<div class="ob-cat-tags">' +
      visibleOthers.map(function(t) {
        var sel = obSelectedTags.indexOf(t) >= 0;
        return '<span class="tag-pick other-tag' + (sel ? ' selected' : '') + '" ' +
          'style="border-color:' + info.color + '20;' + (sel ? 'background:' + info.color + '20;color:' + info.color : 'color:' + info.color + '80') + '" ' +
          'onclick="obTogglePickTag(\'' + escHtml(t).replace(/'/g,"\\'") + '\',\'' + cat + '\',this)">' +
          escHtml(t) + '</span>';
      }).join('') +
      '</div>' +
      (otherTags.length > 8 ? '<button type="button" class="ob-show-more" onclick="obToggleExpand(\'' + cat + '\')" style="color:' + info.color + '">' +
        (expanded ? '\u2212 Vis f\u00e6rre' : '+ Vis alle ' + otherTags.length + ' andre') + '</button>' : '') : '') +
      '<div class="ob-cat-custom"><div class="ob-cat-custom-row">' +
      '<input class="ob-cat-custom-input" placeholder="+ Tilf\u00f8j egen..." onkeydown="obCustomTag(event,\'' + cat + '\',this)" data-cat="' + cat + '">' +
      '<button type="button" class="ob-cat-custom-btn" onclick="obCustomTagBtn(\'' + cat + '\',this)" title="Tilf\u00f8j">\u2713</button>' +
      '</div></div></div>';
  }).join('');

  obUpdateTagLabel();
}

function obUpdateTagLabel() {
  var label = document.getElementById('ob-tag-min-label');
  if (!label) return;
  if (obSelectedTags.length >= 3) {
    label.textContent = obSelectedTags.length + ' tags valgt \u2713';
    label.style.color = 'var(--green)';
  } else {
    label.textContent = 'V\u00e6lg mindst 3 tags (' + obSelectedTags.length + '/3)';
    label.style.color = 'var(--muted)';
  }
}

// ── People preview in onboarding ──
var _obPreviewLoaded = false;
var _obPreviewProfiles = [];
var _obPreviewPinned = []; // Pinned top 3 for stability
var _obPreviewTimer = null;
var _obPreviewColors = ['linear-gradient(135deg,#2ECFCF,#22B8CF)','linear-gradient(135deg,#6366F1,#7C5CFC)','linear-gradient(135deg,#E879A8,#EC4899)','linear-gradient(135deg,#F59E0B,#EAB308)','linear-gradient(135deg,#1A9E8E,#10B981)','linear-gradient(135deg,#8B5CF6,#A855F7)','linear-gradient(135deg,#3B82F6,#6366F1)','linear-gradient(135deg,#EF4444,#F97316)','linear-gradient(135deg,#06B6D4,#0EA5E9)','linear-gradient(135deg,#D946EF,#C026D3)'];

async function obLoadPeoplePreview() {
  if (_obPreviewLoaded) return;
  _obPreviewLoaded = true;
  try {
    var { data: profiles } = await sb.from('profiles').select('id,name,title,keywords,avatar_url')
      .neq('id', currentUser.id).limit(50);
    _obPreviewProfiles = profiles || [];
    // Pin initial top 3 based on keyword overlap (or random if no tags yet)
    _obPreviewPinned = _obPreviewProfiles.slice(0, 3).map(function(p) { return p.id; });
    obRenderPreviewProfiles();
  } catch(e) {
    var el = document.getElementById('ob-people-preview');
    if (el) el.innerHTML = '<div style="text-align:center;padding:0.5rem;font-size:0.72rem;color:var(--muted)">Kunne ikke hente profiler</div>';
  }
}

function obRenderPreviewProfiles() {
  var el = document.getElementById('ob-people-preview');
  if (!el || !_obPreviewProfiles.length) {
    if (el) el.innerHTML = '<div style="text-align:center;padding:0.5rem;font-size:0.72rem;color:var(--muted)">Ingen profiler endnu — du er en af de første! 🚀</div>';
    return;
  }
  var myTags = obSelectedTags;

  // Score all profiles
  var scored = _obPreviewProfiles.map(function(p) {
    var shared = (p.keywords || []).filter(function(t) { return myTags.indexOf(t) >= 0; });
    return { p: p, shared: shared.length };
  }).sort(function(a, b) { return b.shared - a.shared; });

  // Stable display: keep pinned profiles if they're still in top 6, otherwise swap gradually
  var topIds = scored.slice(0, 6).map(function(s) { return s.p.id; });
  var newPinned = [];
  // Keep existing pinned if still in top 6
  _obPreviewPinned.forEach(function(id) {
    if (topIds.indexOf(id) >= 0 && newPinned.length < 3) newPinned.push(id);
  });
  // Fill remaining slots from top scored
  scored.forEach(function(s) {
    if (newPinned.length < 3 && newPinned.indexOf(s.p.id) < 0) newPinned.push(s.p.id);
  });
  _obPreviewPinned = newPinned;

  // Get pinned profiles with scores, sorted by score
  var display = _obPreviewPinned.map(function(id) {
    return scored.find(function(s) { return s.p.id === id; });
  }).filter(Boolean).sort(function(a, b) { return b.shared - a.shared; });

  el.innerHTML = display.map(function(item, i) {
    var p = item.p;
    var ini = (p.name||'?').split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();
    var avHtml = p.avatar_url ?
      '<div style="width:40px;height:40px;border-radius:50%;overflow:hidden;flex-shrink:0;border:1.5px solid rgba(30,27,46,0.05)"><img src="'+escHtml(p.avatar_url)+'" style="width:100%;height:100%;object-fit:cover"></div>' :
      '<div style="width:40px;height:40px;border-radius:50%;background:'+_obPreviewColors[i%5]+';display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700;color:white;flex-shrink:0">'+ini+'</div>';

    var sharedText;
    if (myTags.length === 0) {
      sharedText = '<span style="font-size:0.6rem;color:var(--muted)">Muligt match</span>';
    } else if (item.shared === 0) {
      sharedText = '<span style="font-size:0.6rem;color:var(--muted)">Ingen fælles tags endnu</span>';
    } else if (myTags.length < 3) {
      // Qualitative at low tag count
      sharedText = '<span style="font-size:0.6rem;color:var(--accent)">' + (item.shared === 1 ? 'Ser lovende ud · 1 fælles' : 'Ser lovende ud · ' + item.shared + ' fælles') + '</span>';
    } else {
      // Quantitative at 3+ tags
      var matchPct = Math.round((item.shared / Math.max(myTags.length, (p.keywords||[]).length, 1)) * 100);
      matchPct = Math.min(matchPct, 99);
      sharedText = '<span style="font-size:0.6rem;color:var(--green);font-weight:600">' + matchPct + '% match · ' + item.shared + ' fælles</span>';
    }
    return '<div style="display:flex;align-items:center;gap:0.6rem;padding:0.4rem 0;transition:opacity 0.3s;' + (i < 2 ? 'border-bottom:1px solid rgba(30,27,46,0.025)' : '') + '">' +
      avHtml +
      '<div style="flex:1;min-width:0">' +
      '<div style="font-size:0.82rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escHtml(p.name||'Ukendt') + '</div>' +
      '<div style="font-size:0.68rem;color:var(--text-secondary)">' + escHtml(p.title||'') + '</div>' +
      sharedText +
      '</div></div>';
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
    obCheckProgress();
    return;
  }

  // New custom tag — add locally for THIS user only (not to TAG_DATABASE)
  var formatted = val.charAt(0).toUpperCase() + val.slice(1);
  obAddTag(formatted, cat);
  input.value = '';
  obRenderCategories();
  obCheckProgress();
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


function obTogglePickTag(label, cat, el) {
  if (obSelectedTags.indexOf(label) >= 0) {
    obRemoveTag(label);
    if (el) { el.classList.remove('selected'); el.style.background = ''; }
  } else {
    obAddTag(label, cat);
    var color = TAG_CATEGORIES[cat]?.color || 'var(--accent)';
    if (el) { el.classList.add('selected'); el.style.background = color + '20'; }
  }
  obCheckProgress();
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
          'onclick="epTogglePickTag(\'' + escHtml(t).replace(/'/g,"\\'") + '\',\'' + cat + '\',this)">' +
          escHtml(t) + '</span>';
      }).join('') +
      '</div>' +
      (otherTags.length > 0 ? '<div class="ob-tag-section-label other">Andre</div>' +
      '<div class="ob-cat-tags">' +
      visibleOthers.map(function(t) {
        var sel = epSelectedTags.indexOf(t) >= 0;
        return '<span class="tag-pick other-tag' + (sel ? ' selected' : '') + '" ' +
          'style="border-color:' + info.color + '20;' + (sel ? 'background:' + info.color + '20;color:' + info.color : 'color:' + info.color + '80') + '" ' +
          'onclick="epTogglePickTag(\'' + escHtml(t).replace(/'/g,"\\'") + '\',\'' + cat + '\',this)">' +
          escHtml(t) + '</span>';
      }).join('') +
      '</div>' +
      (otherTags.length > 8 ? '<button type="button" class="ob-show-more" onclick="epToggleExpand(\'' + cat + '\')" style="color:' + info.color + '">' +
        (expanded ? '− Vis færre' : '+ Vis alle ' + otherTags.length + ' andre') + '</button>' : '') : '') +
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

async function saveOnboarding() {
  try {
    const name      = document.getElementById('ob-name').value.trim();
    const title     = document.getElementById('ob-title').value.trim();
    const bio       = document.getElementById('ob-bio').value.trim();
    const linkedin  = document.getElementById('ob-linkedin').value.trim();
    const workplace = (document.getElementById('ob-workplace')?.value || '').trim();
    if (!name)            return showToast('Navn er påkrævet');
    if (!workplace)       return showToast('Virksomhed er påkrævet');
    // Tags: required in normal flow, deferred in event flow
    var isEventFlow = sessionStorage.getItem('event_flow');
    if (!isEventFlow && obSelectedTags.length < 3) return showToast('Vælg mindst 3 tags');
    const { error } = await sb.from('profiles').upsert({
      id: currentUser.id, name, title, bio, linkedin, workplace,
      keywords: obSelectedTags, dynamic_keywords: obDynChips, is_anon: false,
      life_phase: obLifestage || null,
      sectors: (_selectedInterests && _selectedInterests.length > 0) ? _selectedInterests : []
    });
    if (error) return showToast('Fejl: ' + error.message);
    persistCustomTitle(title);
    await loadCurrentProfile();
    showSuccessToast('Profil oprettet');
    trackEvent('onboarding_complete');
    preloadAllData();
    initGlobalRealtime();
    updateUnreadBadge();
    updateNotifNavBadge();
    loadLiveBubbleStatus();
    initPushNotifications();
    // If coming from event flow → auto-join + show QR
    var isEventFlow = sessionStorage.getItem('event_flow');
    var postTagsDest = sessionStorage.getItem('post_tags_destination');
    if (isEventFlow) {
      sessionStorage.removeItem('event_flow');
      await checkPendingJoin();
      showEventReadyQR();
    } else if (postTagsDest === 'event_bubble') {
      sessionStorage.removeItem('post_tags_destination');
      eventReadyGoToEvent();
    } else {
      goTo('screen-welcome');
    }
  } catch(e) { logError("saveOnboarding", e); showToast(e.message || "Ukendt fejl"); }
}


