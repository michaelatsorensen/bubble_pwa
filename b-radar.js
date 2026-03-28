// ══════════════════════════════════════════════════════════
//  BUBBLE — RADAR + SMART MATCH
//  DOMAIN: radar
//  OWNS: rpCurrentUserId, calcMatchScore, buildTagPopularity
//  OWNS: renderRadarList, openRadarPerson, rpFullProfile, rpMessage
//  READS: currentUser, currentProfile, proxAllProfiles
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
  // If list is open, enter browse mode (prevents list from closing)
  if (document.getElementById('radar-sheet')?.classList.contains('open')) {
    _radarBrowsing = true;
  }
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
  } catch(e) { logError("openRadarPerson", e); errorToast("load", e); }
}

function closeRadarPerson() {
  document.getElementById('radar-person-sheet').classList.remove('open');
  setTimeout(function(){ document.getElementById('radar-person-overlay').classList.remove('open'); }, 320);
}

function rpMessage() { closeRadarPerson(); closeHomeTray(); exitRadarList(); setTimeout(function(){ openChat(rpCurrentUserId, 'screen-home'); }, 400); }
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
  } catch(e) { logError("rpSaveContact", e); errorToast("save", e); }
}
function rpFullProfile() {
  var uid = rpCurrentUserId;
  closeRadarPerson();
  closeHomeTray();
  // Open full person sheet
  if (typeof dmOpenPersonSheet === 'function') {
    setTimeout(function() { dmOpenPersonSheet(uid); }, 350);
  }
}




// ══════════════════════════════════════════════════════════
//  SMART MATCH ALGORITHM (v3 — Tier-based)
//  Replaces TF-IDF with predictable, welcoming scoring:
//  - Tier 1: Sector overlap (inferred from keywords) — max 30
//  - Tier 2: Lifestage match (inferred from keywords) — max 15
//  - Tier 3: Tag cluster overlap — max 30
//  - Tier 4: Shared bubbles — max 16
//  - Tier 5: Cross-match (søger↔er) — max 16
//  - Tiny: profile completeness — max 4
//  Total max: ~111 (capped at 100)
//  Key difference: common tags are REWARDED, not penalized.
// ══════════════════════════════════════════════════════════
var MATCH_CAP = 25;
var matchPage = 0;

// ── Sector inference: maps keywords → onboarding sectors ──
var _sectorMap = {
  startup: ['founder','co-founder','iværksætter','serial entrepreneur','startup','lean startup','entrepreneurship','venture capital','angel investing','fundraising','pitch deck','skalering','exit strategy','crowdfunding','startup økosystem','iværksætterkultur'],
  tech: ['saas','ai/ml','developer','software engineer','frontend','backend','devops','cloud','cybersecurity','data scientist','machine learning','react','python','node.js','typescript','iot','robotics','blockchain','deep tech','infrastructure','devtools','data engineer','ml engineer','qa engineer','solutions architect','tech lead','arduino','api design','system design','full-stack','frontend developer','backend developer'],
  sustainability: ['cleantech','bæredygtighed','energi','circular economy','vindenergi','solenergi','grøn omstilling','climate action','esg','carbon','sustainability','carbon capture','vandteknologi','affaldshåndtering','carbon accounting','lca','miljøledelse','energioptimering','grøn certificering'],
  leadership: ['ceo','cto','cfo','coo','cmo','cpo','vp','director','leadership','management','strategy','okr','board member','general manager','country manager','managing director','partner'],
  public: ['ngo','govtech','civic tech','kommune','region','stat','socialrådgiver','embedsmand','sagsbehandler','social impact','kommunaldirektør','kontorchef','forvaltningschef','socialøkonomi','frivilligsektor'],
  industry: ['byggeri','produktion','industri','automation','tømrer','elektriker','vvs','ingeniør','maskinmester','logistik','transport','håndværker','murer','maler','smed','mekaniker','cnc-operatør','procesoperatør','anlæg','renovering'],
  health: ['healthtech','medtech','pharma','biotech','sundhed','sygeplejerske','læge','tandlæge','fysioterapeut','psykolog','mental health','velfærdsteknologi','farmaceut','bioanalytiker','ergoterapeut','jordemoder'],
  education: ['edtech','forskning','student','phd','professor','researcher','underviser','universitet','efteruddannelse','pædagog','lærer','skoleleder','didaktik','e-læring'],
  creative: ['designer','ux designer','ui designer','graphic designer','content creator','fotograf','journalist','media','publishing','gaming','film','musik','art director','creative director','kommunikationsrådgiver','reklame'],
  commerce: ['e-commerce','retail','fashion','b2b','b2c','sales','account manager','marketplace','detail','dagligvarer','butiksbestyrer','ejendomsmægler','d2c'],
  community: ['networking','community building','frivillig','foreningsliv','mentoring','coaching','events','lokalt engagement','erfa-grupper','branchenetværk','frivilligt arbejde']
};

// ── Lifestage inference: maps keywords → lifestage ──
var _lifestageMap = {
  student: ['student','phd','researcher','praktikant','studentermedhjælper','kandidatstuderende','bachelorstuderende','stipendiat','teaching assistant','tutor'],
  entrepreneur: ['founder','co-founder','ceo','cto','cfo','coo','cmo','cpo','iværksætter','serial entrepreneur','solo founder','startup','selvstændig'],
  freelancer: ['freelancer','consultant','selvstændig','coach','mentor','advisor','fotograf','grafiker','tekstforfatter'],
  employee: ['manager','lead','engineer','developer','designer','analyst','specialist','koordinator','rådgiver','chef','product manager','project manager','team lead','software engineer','frontend developer','backend developer','ux designer','ui designer','graphic designer','data scientist','data engineer','ml engineer','devops engineer','qa engineer','solutions architect','tech lead','sales manager','account manager','marketing manager','growth manager','brand manager','hr manager','operations manager'],
  investor: ['investor','business angel','vc','lp','fund manager','board member','partner','impact investor'],
  public: ['sagsbehandler','kommunaldirektør','embedsmand','socialrådgiver','pædagog','lærer','sygeplejerske','læge','skoleleder','forvaltningschef','kontorchef','tandlæge','fysioterapeut','psykolog'],
  practical: ['tømrer','elektriker','vvs-installatør','murer','håndværker','mester','installatør','mekaniker','smed','ingeniør','maskinmester','maler','kok','bartender','industritekniker','procesoperatør','cnc-operatør']
};

// ── Tag-to-cluster mapping (broad clusters for bonus scoring) ──
var _tagClusterMap = {
  'leadership': ['founder','co-founder','ceo','cto','cfo','coo','cmo','cpo','vp','director','partner','board member','general manager','managing director'],
  'management': ['product manager','project manager','team lead','afdelingsleder','program manager','scrum master','agile coach'],
  'tech_dev': ['developer','software engineer','frontend developer','backend developer','data scientist','data engineer','ml engineer','devops engineer','qa engineer','solutions architect','tech lead','full-stack'],
  'design': ['designer','ux designer','ui designer','graphic designer','art director','creative director','content creator','fotograf'],
  'sales_growth': ['sales','sales manager','account manager','key account manager','marketing','marketing manager','growth manager','brand manager','digital marketing manager','social media manager'],
  'advisory': ['consultant','advisor','mentor','coach','business coach','management consultant'],
  'finance': ['investor','business angel','vc','fund manager','fundraising','financial modeling','budgettering','regnskab','revision'],
  'tech_sector': ['saas','fintech','ai/ml','cybersecurity','cloud','infrastructure','devtools','iot','robotics','blockchain','deep tech','hardware'],
  'health_sector': ['healthtech','medtech','pharma','biotech','mental health','sundhed','velfærdsteknologi'],
  'green_sector': ['cleantech','energi','bæredygtighed','circular economy','vindenergi','solenergi','grøn omstilling'],
  'education_sector': ['edtech','forskning','universitet','efteruddannelse'],
  'commerce_sector': ['e-commerce','retail','fashion','b2b','b2c','marketplace','d2c'],
  'construction': ['byggeri','anlæg','renovering','produktion','industri','automation','transport','logistik'],
  'media': ['media','publishing','gaming','entertainment','reklame','film','musik','kommunikation','pr'],
  'data_ai': ['data analytics','machine learning','nlp','computer vision','deep learning','data engineering','data visualization','business intelligence'],
  'product_dev': ['product development','ux/ui design','frontend','backend','react','python','node.js','typescript','api design']
};

// Build reverse lookup once
var _tagToCluster = null;
function _ensureTagClusters() {
  if (_tagToCluster) return;
  _tagToCluster = {};
  Object.keys(_tagClusterMap).forEach(function(cluster) {
    _tagClusterMap[cluster].forEach(function(tag) {
      _tagToCluster[tag.toLowerCase()] = cluster;
    });
  });
}

function _inferSectors(keywords) {
  var found = {};
  var kwLower = keywords.map(function(k) { return k.toLowerCase(); });
  Object.keys(_sectorMap).forEach(function(sector) {
    var hits = 0;
    _sectorMap[sector].forEach(function(tag) {
      if (kwLower.indexOf(tag) >= 0) hits++;
    });
    if (hits >= 1) found[sector] = hits;
  });
  // Return top 3 by hit count
  return Object.keys(found).sort(function(a,b) { return found[b] - found[a]; }).slice(0, 3);
}

function _inferLifestage(keywords) {
  var kwLower = keywords.map(function(k) { return k.toLowerCase(); });
  var best = null;
  var bestHits = 0;
  Object.keys(_lifestageMap).forEach(function(ls) {
    var hits = 0;
    _lifestageMap[ls].forEach(function(tag) {
      if (kwLower.indexOf(tag) >= 0) hits++;
    });
    if (hits > bestHits) { best = ls; bestHits = hits; }
  });
  return best;
}

// Related lifestages (partial match)
var _lifestageRelated = {
  entrepreneur: ['freelancer','investor','student'],
  freelancer: ['entrepreneur','employee'],
  student: ['entrepreneur','employee'],
  employee: ['freelancer','public'],
  investor: ['entrepreneur'],
  public: ['employee'],
  practical: ['employee','freelancer']
};

// Keep buildTagPopularity signature — called from b-profile.js
function buildTagPopularity(allProfiles) {
  _ensureTagClusters();
}

function calcMatchScore(myProfile, theirProfile, sharedBubbleCount) {
  _ensureTagClusters();
  var score = 0;
  var myKw = (myProfile.keywords || []);
  var theirKw = (theirProfile.keywords || []);

  // ── Tier 1: Sector overlap (max 30) ──
  var mySectors = _inferSectors(myKw);
  var theirSectors = _inferSectors(theirKw);
  var sectorOverlap = 0;
  mySectors.forEach(function(s) {
    if (theirSectors.indexOf(s) >= 0) sectorOverlap++;
  });
  score += Math.min(sectorOverlap * 10, 30);

  // ── Tier 2: Lifestage match (max 15) ──
  var myLs = myProfile.lifestage || _inferLifestage(myKw);
  var theirLs = theirProfile.lifestage || _inferLifestage(theirKw);
  if (myLs && theirLs) {
    if (myLs === theirLs) {
      score += 15;
    } else if (_lifestageRelated[myLs] && _lifestageRelated[myLs].indexOf(theirLs) >= 0) {
      score += 8;
    }
  }

  // ── Tier 3: Tag cluster overlap (max 30) ──
  var myKwL = myKw.map(function(k) { return k.toLowerCase(); });
  var theirKwL = theirKw.map(function(k) { return k.toLowerCase(); });
  if (myKwL.length > 0 && theirKwL.length > 0) {
    var myClusters = {};
    var theirClusters = {};
    myKwL.forEach(function(k) { var c = _tagToCluster[k]; if (c) myClusters[c] = true; });
    theirKwL.forEach(function(k) { var c = _tagToCluster[k]; if (c) theirClusters[c] = true; });
    var clusterOverlap = 0;
    Object.keys(myClusters).forEach(function(c) { if (theirClusters[c]) clusterOverlap++; });
    score += Math.min(clusterOverlap * 6, 30);

    // Also count direct tag matches as small bonus
    var directOverlap = myKwL.filter(function(k) { return theirKwL.indexOf(k) >= 0; });
    score += Math.min(directOverlap.length * 2, 10);
  }

  // ── Tier 4: Shared bubbles (max 16) ──
  score += Math.min((sharedBubbleCount || 0) * 8, 16);

  // ── Tier 5: Cross-match — søger ↔ er (max 16) ──
  var myDyn = (myProfile.dynamic_keywords || []).map(function(k) { return k.toLowerCase(); });
  var theirDyn = (theirProfile.dynamic_keywords || []).map(function(k) { return k.toLowerCase(); });
  var crossHits = 0;
  if (myDyn.length > 0) {
    myDyn.forEach(function(d) { if (theirKwL.indexOf(d) >= 0) crossHits++; });
  }
  if (theirDyn.length > 0) {
    theirDyn.forEach(function(d) { if (myKwL.indexOf(d) >= 0) crossHits++; });
  }
  score += Math.min(crossHits * 8, 16);

  // ── Tiny: profile completeness (max 4) ──
  score += (theirProfile.bio ? 2 : 0) + (theirProfile.title ? 1 : 0) + (theirProfile.linkedin ? 1 : 0);

  // Everyone visible: minimum 1 if they have a name
  if (score === 0 && theirProfile.name) score = 1;

  return Math.min(Math.max(score, 0), 100);
}

// Quick relevance for sorting (0-1 range, used internally)


