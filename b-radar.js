// ══════════════════════════════════════════════════════════
//  BUBBLE — RADAR + SMART MATCH
//  Auto-split from app.js · v3.7.0
// ══════════════════════════════════════════════════════════

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

  var filtered = getFilteredProfiles();
  var totalPages = Math.ceil(filtered.length / RADAR_PAGE_SIZE);
  if (_radarPage >= totalPages) _radarPage = Math.max(0, totalPages - 1);
  var pageStart = _radarPage * RADAR_PAGE_SIZE;
  var fil = filtered.slice(pageStart, pageStart + RADAR_PAGE_SIZE);

  if (fil.length === 0) {
    el.innerHTML = '<div style="text-align:center;padding:2rem 0;font-size:0.78rem;color:var(--muted)">Ingen profiler' +
      (_radarFilter !== 'all' ? ' med dette match-niveau' : ' i n\u00e6rheden') +
      (radarDismissed.length > 0 ? '<br><button class="btn-sm btn-ghost" onclick="radarResetDismissed()" style="margin-top:0.5rem;font-size:0.7rem">Vis alle igen</button>' : '') + '</div>';
    if (emptyEl) emptyEl.style.display = 'none';
    var pag = document.getElementById('radar-pagination');
    if (pag) pag.style.display = 'none';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';
  var myKw = (currentProfile && currentProfile.keywords ? currentProfile.keywords : []).map(function(k){ return k.toLowerCase(); });
  var colors = proxColors;

  el.innerHTML = fil.map(function(p, i) {
    var isA = p.is_anon;
    var name = isA ? 'Anonym bruger' : (p.name || '?');
    var ini = isA ? '?' : name.split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();
    var col = isA ? 'rgba(30,27,46,0.05)' : colors[i % colors.length];
    var bd = isA ? 'border:1px solid rgba(30,27,46,0.04);' : '';
    var theirKw = (p.keywords || []).map(function(k){ return k.toLowerCase(); });
    var overlap = myKw.filter(function(k){ return theirKw.indexOf(k) >= 0; });
    var matchPct = p.matchScore || Math.min(Math.round(p.relevance * 85 + 10), 99);
    var matchBadge = isA ? '' : matchBadgeHtml(matchPct);
    var bubbleInfo = p.sharedBubbles > 0 ? '<span class="fs-065 text-muted">' + p.sharedBubbles + ' f\u00e6lles boble' + (p.sharedBubbles > 1 ? 'r' : '') + '</span>' : '';
    return '<div class="radar-list-card" data-uid="' + p.id + '" data-name="' + escHtml(name) + '" style="--card-delay:' + (i * 40) + 'ms">' +
      '<div class="flex-row-center" style="gap:0.7rem">' +
        '<div class="radar-list-avatar" style="background:' + col + ';' + bd + '" onclick="openRadarPerson(\'' + p.id + '\')">' + escHtml(ini) + '</div>' +
        '<div style="flex:1;min-width:0;cursor:pointer" onclick="openRadarPerson(\'' + p.id + '\')">' +
          '<div class="fw-600 fs-085" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escHtml(name) + '</div>' +
          (isA ? '' : '<div class="fs-072 text-muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escHtml(p.title || '') + '</div>') +
        '</div>' +
        matchBadge +
        '<button class="radar-list-remove" onclick="event.stopPropagation();radarConfirmRemove(\'' + p.id + '\',\'' + escHtml(name).replace(/'/g,'') + '\')" title="Fjern">' + icon('x') + '</button>' +
      '</div>' +
      (bubbleInfo ? '<div style="padding-left:3.2rem;margin-top:0.15rem">' + bubbleInfo + '</div>' : '') +
    '</div>';
  }).join('');

  // Pagination
  var pag = document.getElementById('radar-pagination');
  var pageInfo = document.getElementById('radar-page-info');
  var filtered = getFilteredProfiles();
  var totalPages = Math.ceil(filtered.length / RADAR_PAGE_SIZE);
  if (pag) {
    pag.style.display = totalPages > 1 ? 'block' : 'none';
    if (pageInfo) pageInfo.textContent = 'Side ' + (_radarPage + 1) + ' af ' + totalPages + ' · ' + filtered.length + ' personer i alt';
  }
}

function radarConfirmRemove(uid, name) {
  var card = document.querySelector('.radar-list-card[data-uid="' + uid + '"]');
  if (!card) return;
  if (card.querySelector('.remove-confirm')) return;
  radarPendingRemove = { uid: uid, name: name, card: card };
  var confirm = document.createElement('div');
  confirm.className = 'remove-confirm';
  confirm.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:0.5rem 0.6rem;margin-top:0.4rem;background:rgba(26,122,138,0.08);border:1px solid rgba(26,122,138,0.2);border-radius:10px;gap:0.5rem';
  confirm.innerHTML = '<span style="font-size:0.72rem;color:var(--text-secondary)">Fjern kontakt?</span>' +
    '<div style="display:flex;gap:0.3rem">' +
      '<button class="btn-sm btn-ghost" style="padding:0.25rem 0.6rem;font-size:0.7rem;color:var(--accent2);border-color:rgba(26,122,138,0.3)" onclick="event.stopPropagation();radarDoRemove()">Fjern</button>' +
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
      if (p.avatar_url && !isA) { rpAvEl.innerHTML = '<img src="'+escHtml(p.avatar_url)+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%">'; rpAvEl.style.overflow = 'hidden'; }
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
    var ml = matchLabel(score);
    document.getElementById('rp-match').textContent = ml.text;
    document.getElementById('rp-match').style.color = ml.color;
    document.getElementById('rp-bio').textContent = p.bio || '';
    document.getElementById('rp-bio').style.display = p.bio ? 'block' : 'none';
    document.getElementById('rp-tags').innerHTML = '';
    document.getElementById('rp-tags').style.display = 'none';
    if (overlap.length > 0) {
      document.getElementById('rp-overlap').innerHTML = '<div style="font-size:0.68rem;color:var(--muted);margin-bottom:0.3rem;font-weight:600">F\u00e6lles interesser \u00B7 ' + overlap.length + '</div>' +
        overlap.slice(0, 8).map(function(k){ return '<span class="tag mint">' + icon('check') + ' ' + escHtml(k) + '</span>'; }).join('') +
        (overlap.length > 8 ? '<span class="tag" style="opacity:0.5">+' + (overlap.length - 8) + ' mere</span>' : '');
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
    showSuccessToast('Kontakt gemt');
    loadSavedContacts();
    clearSavedContactIdsCache();
    // Remove from radar cache + re-render immediately
    var savedId = rpCurrentUserId;
    proxAllProfiles = proxAllProfiles.filter(function(p) { return p.id !== savedId; });
    closeRadarPerson();
    if (radarCurrentView === 'map') renderProximityDots(); else renderRadarList();
  } catch(e) { logError("rpSaveContact", e); showToast(e.message || "Ukendt fejl"); }
}
function rpFullProfile() {
  var uid = rpCurrentUserId; closeRadarPerson(); closeRadarSheet();
  setTimeout(function(){ openPerson(uid, 'screen-home'); }, 400);
}




// ══════════════════════════════════════════════════════════
//  SMART MATCH ALGORITHM (v3 — Tier-based)
//  - Tier 1: Sector overlap (interests) — 10pt per match, max 30
//  - Tier 2: Lifestage match — 15 same, 8 related
//  - Tier 3: Shared bubbles — 8pt per, max 24
//  - Tier 4: Tag cluster bonus — 5pt per cluster overlap, max 20
//  - Tier 5: Live context — same event +15
//  No TF-IDF, no sigmoid. Predictable, welcoming scores.
// ══════════════════════════════════════════════════════════
var MATCH_CAP = 25;  // Max profiles shown on radar at once
var matchPage = 0;   // For "vis flere" rotation

// Sector keys from onboarding interest picker
var ALL_SECTORS = ['startup','tech','sustainability','leadership','public','industry','health','education','creative','commerce','community'];

// Related lifestages (partial match gets 8 instead of 15)
var LIFESTAGE_RELATED = {
  entrepreneur: ['freelancer','investor','student'],
  freelancer: ['entrepreneur','employee'],
  student: ['entrepreneur','employee'],
  employee: ['freelancer','public'],
  investor: ['entrepreneur'],
  public: ['employee'],
  practical: ['employee','freelancer'],
  other: []
};

// Tag-to-cluster mapping: maps individual tags to broad clusters for bonus scoring
// Uses the sub-group comments from tag-data.js as cluster names
var TAG_CLUSTERS = {};
function _buildTagClusters() {
  if (Object.keys(TAG_CLUSTERS).length > 0) return;
  // Map each tag to its category sub-group for cluster matching
  var clusterMap = {
    rolle: {
      'leadership': ['Founder','Co-Founder','CEO','CTO','CFO','COO','CMO','CPO','VP','Director','Partner','Board Member','General Manager','Country Manager','Managing Director'],
      'management': ['Product Manager','Project Manager','Team Lead','Afdelingsleder','Program Manager','Scrum Master','Agile Coach'],
      'tech_dev': ['Developer','Software Engineer','Frontend Developer','Backend Developer','Data Scientist','Data Engineer','ML Engineer','DevOps Engineer','QA Engineer','Solutions Architect','Tech Lead'],
      'design_creative': ['Designer','UX Designer','UI Designer','Graphic Designer','Art Director','Creative Director','Content Creator','Fotograf','Journalist','Kommunikationsrådgiver'],
      'advisory': ['Consultant','Advisor','Mentor','Coach','Business Coach','Management Consultant','Strategisk Rådgiver'],
      'sales_marketing': ['Sales','Sales Manager','Account Manager','Key Account Manager','Marketing','Marketing Manager','Growth Manager','Brand Manager','Digital Marketing Manager','Social Media Manager'],
      'entrepreneurship': ['Freelancer','Iværksætter','Serial Entrepreneur','Selvstændig'],
      'education_research': ['Student','PhD','Professor','Researcher','Underviser','Lektor','Pædagog','Lærer'],
      'health_care': ['Sygeplejerske','Læge','Tandlæge','Fysioterapeut','Psykolog','Farmaceut'],
      'trades': ['Tømrer','Elektriker','VVS-installatør','Murer','Ingeniør','Maskinmester'],
    },
    branche: {
      'tech_sector': ['SaaS','Fintech','AI/ML','Cybersecurity','Cloud','Infrastructure','DevTools','IoT','Robotics','AR/VR','Blockchain','Deep Tech','Hardware'],
      'health_sector': ['Healthtech','MedTech','Pharma','Biotech','Mental Health','Sundhed','Velfærdsteknologi'],
      'green_sector': ['Cleantech','Energi','Bæredygtighed','Circular Economy','Vindenergi','Solenergi','Grøn Omstilling'],
      'education_sector': ['Edtech','Forskning','Universitet','Efteruddannelse'],
      'food_agri': ['Foodtech','Agritech','Landbrug','Økologi','Fødevarer','Restaurant'],
      'construction': ['Byggeri','Anlæg','Renovering','Produktion','Industri','Automation'],
      'commerce_retail': ['E-commerce','Retail','Fashion','D2C','B2B','B2C','Marketplace'],
      'finance_sector': ['Finans','Banking','Forsikring','Revision','Investering','Crypto'],
      'media_creative': ['Media','Publishing','Gaming','Entertainment','Reklame','Film','Musik'],
      'public_ngo': ['NGO','GovTech','Civic Tech','Impact','Kommune','Forening','Socialøkonomi'],
    }
  };
  Object.keys(clusterMap).forEach(function(cat) {
    Object.keys(clusterMap[cat]).forEach(function(cluster) {
      clusterMap[cat][cluster].forEach(function(tag) {
        TAG_CLUSTERS[tag.toLowerCase()] = cluster;
      });
    });
  });
}

// No-op: keep buildTagPopularity signature for compatibility but make it a no-op
function buildTagPopularity(allProfiles) {
  _buildTagClusters();
}

function getTagRarity(tagLower) {
  return 1.0; // Flat weight — TF-IDF disabled
}

function calcMatchScore(myProfile, theirProfile, sharedBubbleCount) {
  _buildTagClusters();
  var score = 0;

  // ── Tier 1: Sector overlap (interests from onboarding) ──
  // Stored as profile.interests (array of sector keys like 'startup','tech',...)
  var myInterests = myProfile.interests || [];
  var theirInterests = theirProfile.interests || [];
  // Fallback: extract from keywords if interests field not populated
  if (myInterests.length === 0 && myProfile.keywords) {
    myInterests = _inferSectorsFromKeywords(myProfile.keywords);
  }
  if (theirInterests.length === 0 && theirProfile.keywords) {
    theirInterests = _inferSectorsFromKeywords(theirProfile.keywords);
  }
  var sectorOverlap = 0;
  myInterests.forEach(function(s) {
    if (theirInterests.indexOf(s) >= 0) sectorOverlap++;
  });
  score += Math.min(sectorOverlap * 10, 30); // 10pt per overlap, max 30

  // ── Tier 2: Lifestage match ──
  var myLs = myProfile.lifestage || '';
  var theirLs = theirProfile.lifestage || '';
  if (myLs && theirLs) {
    if (myLs === theirLs) {
      score += 15;
    } else if (LIFESTAGE_RELATED[myLs] && LIFESTAGE_RELATED[myLs].indexOf(theirLs) >= 0) {
      score += 8;
    }
  }

  // ── Tier 3: Shared bubbles ──
  var bubbleBonus = Math.min((sharedBubbleCount || 0) * 8, 24);
  score += bubbleBonus;

  // ── Tier 4: Tag cluster overlap (bonus for filled-out profiles) ──
  var myKw = (myProfile.keywords || []).map(function(k) { return k.toLowerCase(); });
  var theirKw = (theirProfile.keywords || []).map(function(k) { return k.toLowerCase(); });
  if (myKw.length > 0 && theirKw.length > 0) {
    var myClusters = {};
    var theirClusters = {};
    myKw.forEach(function(k) { var c = TAG_CLUSTERS[k]; if (c) myClusters[c] = true; });
    theirKw.forEach(function(k) { var c = TAG_CLUSTERS[k]; if (c) theirClusters[c] = true; });
    var clusterOverlap = 0;
    Object.keys(myClusters).forEach(function(c) { if (theirClusters[c]) clusterOverlap++; });
    score += Math.min(clusterOverlap * 5, 20);
  }

  // ── Tier 5: Live context bonus (same event check-in) ──
  // Handled externally when building radar — adds 15 if both checked in to same bubble
  // (passed in as extra parameter or pre-added to sharedBubbleCount)

  // ── Minimum score: everyone visible on radar ──
  // Even with zero overlap, give 1 point so they show as "I dit netværk"
  if (score === 0 && (sharedBubbleCount || 0) === 0) {
    // Tiny bonus for having a profile at all
    score = (theirProfile.name ? 1 : 0);
  }

  return Math.min(Math.max(score, 0), 100);
}

// Infer sector keys from keywords for backwards compatibility
// Maps common keywords to their onboarding sector
function _inferSectorsFromKeywords(keywords) {
  var sectorKeywordMap = {
    startup: ['Founder','Co-Founder','Iværksætter','Startup','Serial Entrepreneur','Lean Startup','Entrepreneurship','Venture Capital','Angel Investing','Fundraising','Pitch Deck'],
    tech: ['SaaS','AI/ML','Developer','Software Engineer','Frontend','Backend','DevOps','Cloud','Cybersecurity','Data Scientist','Machine Learning','React','Python','Node.js','TypeScript','IoT','Robotics','Blockchain','Deep Tech'],
    sustainability: ['Cleantech','Bæredygtighed','Energi','Circular Economy','Vindenergi','Solenergi','Grøn Omstilling','Climate Action','ESG','Carbon','Sustainability'],
    leadership: ['CEO','CTO','CFO','COO','CMO','VP','Director','Leadership','Management','Strategy','OKR','Board Member'],
    public: ['NGO','GovTech','Civic Tech','Kommune','Region','Stat','Socialrådgiver','Embedsmand','Sagsbehandler','Social Impact'],
    industry: ['Byggeri','Produktion','Industri','Automation','Tømrer','Elektriker','VVS','Ingeniør','Maskinmester','Logistik','Transport','Håndværker'],
    health: ['Healthtech','MedTech','Pharma','Biotech','Sundhed','Sygeplejerske','Læge','Tandlæge','Fysioterapeut','Psykolog','Mental Health'],
    education: ['Edtech','Forskning','Student','PhD','Professor','Researcher','Underviser','Universitet'],
    creative: ['Designer','UX Designer','UI Designer','Graphic Designer','Content Creator','Fotograf','Journalist','Media','Publishing','Gaming','Film','Musik'],
    commerce: ['E-commerce','Retail','Fashion','B2B','B2C','Sales','Account Manager','Marketplace','Detail'],
    community: ['Networking','Community Building','Frivillig','Foreningsliv','Mentoring','Coaching','Events']
  };
  var found = [];
  var kwLower = keywords.map(function(k) { return k.toLowerCase(); });
  Object.keys(sectorKeywordMap).forEach(function(sector) {
    var sectorTags = sectorKeywordMap[sector].map(function(t) { return t.toLowerCase(); });
    var hits = kwLower.filter(function(k) { return sectorTags.indexOf(k) >= 0; });
    if (hits.length >= 1) found.push(sector);
  });
  return found.slice(0, 3); // Max 3 like onboarding
}

// Quick relevance for sorting (0-1 range, used internally)


