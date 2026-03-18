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
//  SMART MATCH ALGORITHM (v5 — tier-based additive model)
//  Max score ~100:
//    Sektorer      : 10pt per overlap, max 30 (3 sektorer)
//    Livsfase      : 15pt same, 8pt adjacent
//    Fælles bobler : 8pt per, max 24 (3 bobler)
//    Tag-cluster   : 5pt per cluster, max 20
//  Backwards-compatible via _inferSectorsFromKeywords()
// ══════════════════════════════════════════════════════════
var MATCH_CAP = 25;
var matchPage = 0;

var CAT_WEIGHTS = { branche: 1.5, kompetence: 1.3, rolle: 1.0, interesse: 0.8, custom: 1.0 };
var _tagPopularity = {};

// ── Sector inference: maps existing keywords to sectors ──
// Sectors: tech, kreativ, handel, sundhed, uddannelse, ledelse, service, produktion
var _SECTOR_MAP = {
  'software': 'tech', 'it': 'tech', 'programmering': 'tech', 'udvikler': 'tech', 'developer': 'tech',
  'data': 'tech', 'ai': 'tech', 'machine learning': 'tech', 'cybersikkerhed': 'tech',
  'design': 'kreativ', 'marketing': 'kreativ', 'branding': 'kreativ', 'kommunikation': 'kreativ',
  'indhold': 'kreativ', 'content': 'kreativ', 'foto': 'kreativ', 'video': 'kreativ',
  'salg': 'handel', 'økonomi': 'handel', 'finans': 'handel', 'handel': 'handel',
  'e-handel': 'handel', 'retail': 'handel', 'export': 'handel',
  'sundhed': 'sundhed', 'sygepleje': 'sundhed', 'medicin': 'sundhed', 'terapi': 'sundhed',
  'psykologi': 'sundhed', 'fysioterapi': 'sundhed', 'ernæring': 'sundhed',
  'undervisning': 'uddannelse', 'forskning': 'uddannelse', 'coaching': 'uddannelse',
  'uddannelse': 'uddannelse', 'pædagogik': 'uddannelse',
  'ledelse': 'ledelse', 'strategi': 'ledelse', 'hr': 'ledelse', 'konsulent': 'ledelse',
  'projekt': 'ledelse', 'startup': 'ledelse', 'iværksætter': 'ledelse',
  'service': 'service', 'turisme': 'service', 'event': 'service', 'hotel': 'service',
  'restaurant': 'service', 'logistik': 'service',
  'produktion': 'produktion', 'bygge': 'produktion', 'ingeniør': 'produktion',
  'arkitektur': 'produktion', 'energi': 'produktion', 'landbrug': 'produktion'
};

// Adjacent sectors (for 8pt partial match)
var _SECTOR_ADJACENT = {
  'tech': ['kreativ', 'ledelse'],
  'kreativ': ['tech', 'handel', 'service'],
  'handel': ['kreativ', 'ledelse', 'service'],
  'sundhed': ['uddannelse', 'service'],
  'uddannelse': ['sundhed', 'ledelse'],
  'ledelse': ['tech', 'handel', 'uddannelse'],
  'service': ['handel', 'kreativ', 'produktion'],
  'produktion': ['service', 'ledelse']
};

function _inferSectorsFromKeywords(keywords) {
  var sectors = [];
  (keywords || []).forEach(function(kw) {
    var k = kw.toLowerCase();
    // Direct lookup
    if (_SECTOR_MAP[k] && sectors.indexOf(_SECTOR_MAP[k]) < 0) {
      sectors.push(_SECTOR_MAP[k]);
      return;
    }
    // Partial match
    Object.keys(_SECTOR_MAP).forEach(function(key) {
      if (k.indexOf(key) >= 0 || key.indexOf(k) >= 0) {
        var s = _SECTOR_MAP[key];
        if (sectors.indexOf(s) < 0) sectors.push(s);
      }
    });
  });
  return sectors;
}

// ── Tag-cluster bonus: tags that cluster together ──
var _TAG_CLUSTERS = [
  ['salg', 'marketing', 'branding', 'kommunikation', 'indhold', 'content'],
  ['software', 'it', 'programmering', 'data', 'ai', 'developer', 'udvikler'],
  ['ledelse', 'strategi', 'konsulent', 'projekt', 'hr'],
  ['iværksætter', 'startup', 'investor', 'fundraising', 'pitch'],
  ['design', 'ux', 'ui', 'grafik', 'kreativ'],
  ['sundhed', 'velvære', 'terapi', 'coaching', 'psykologi'],
  ['undervisning', 'forskning', 'uddannelse', 'pædagogik'],
  ['økonomi', 'finans', 'regnskab', 'revision', 'investering']
];

function _calcClusterBonus(myKw, theirKw) {
  var bonus = 0;
  _TAG_CLUSTERS.forEach(function(cluster) {
    var myHits = myKw.filter(function(k) { return cluster.indexOf(k) >= 0; }).length;
    var theirHits = theirKw.filter(function(k) { return cluster.indexOf(k) >= 0; }).length;
    if (myHits >= 1 && theirHits >= 1) bonus += 5;
  });
  return Math.min(bonus, 20);
}

// ── Life-phase detection ──
var _LIFE_PHASE_TAGS = {
  student:    ['studerende', 'bachelor', 'kandidat', 'phd', 'praktikant'],
  early:      ['nyuddannet', 'junior', 'trainee', 'entry level'],
  mid:        ['specialist', 'seniorkonsulent', 'projektleder', 'manager'],
  senior:     ['direktør', 'ceo', 'cto', 'partner', 'founder', 'leder', 'chef', 'vp'],
  freelance:  ['freelancer', 'selvstændig', 'konsulent', 'iværksætter', 'solopreneur']
};

function _inferLifePhase(keywords) {
  var kw = (keywords || []).map(function(k) { return k.toLowerCase(); });
  var phases = Object.keys(_LIFE_PHASE_TAGS);
  for (var i = 0; i < phases.length; i++) {
    var phase = phases[i];
    if (_LIFE_PHASE_TAGS[phase].some(function(t) { return kw.some(function(k) { return k.indexOf(t) >= 0; }); })) {
      return phase;
    }
  }
  return null;
}

var _PHASE_ADJACENT = {
  student: ['early'],
  early:   ['student', 'mid'],
  mid:     ['early', 'senior', 'freelance'],
  senior:  ['mid', 'freelance'],
  freelance: ['mid', 'senior']
};

function buildTagPopularity(allProfiles) {
  _tagPopularity = {};
  var total = allProfiles.length || 1;
  allProfiles.forEach(function(p) {
    (p.keywords || []).forEach(function(k) {
      var key = k.toLowerCase();
      _tagPopularity[key] = (_tagPopularity[key] || 0) + 1;
    });
  });
  Object.keys(_tagPopularity).forEach(function(key) {
    _tagPopularity[key] = 1.0 / Math.log2((_tagPopularity[key] + 1) / total * 10 + 2);
  });
}

function getTagRarity(tagLower) {
  return _tagPopularity[tagLower] || 1.2;
}

function calcMatchScore(myProfile, theirProfile, sharedBubbleCount) {
  var myKw    = (myProfile.keywords    || []).map(function(k) { return k.toLowerCase(); });
  var theirKw = (theirProfile.keywords || []).map(function(k) { return k.toLowerCase(); });

  // Minimal profiles — base score only
  if (myKw.length === 0 || theirKw.length === 0) {
    return Math.min(8 + Math.min((sharedBubbleCount || 0) * 8, 24) +
      (theirProfile.bio ? 4 : 0) + (theirProfile.title ? 4 : 0), 40);
  }

  var score = 0;

  // 1. Sector overlap — 10pt per sector match, max 30
  var mySectors    = myProfile.sectors    || _inferSectorsFromKeywords(myProfile.keywords);
  var theirSectors = theirProfile.sectors || _inferSectorsFromKeywords(theirProfile.keywords);
  var sectorScore = 0;
  mySectors.forEach(function(s) {
    if (theirSectors.indexOf(s) >= 0) {
      sectorScore += 10;
    } else {
      // Adjacent sector: 5pt
      var adj = _SECTOR_ADJACENT[s] || [];
      if (adj.some(function(a) { return theirSectors.indexOf(a) >= 0; })) {
        sectorScore += 5;
      }
    }
  });
  score += Math.min(sectorScore, 30);

  // 2. Life phase — 15pt same, 8pt adjacent
  var myPhase    = myProfile.life_phase    || _inferLifePhase(myProfile.keywords);
  var theirPhase = theirProfile.life_phase || _inferLifePhase(theirProfile.keywords);
  if (myPhase && theirPhase) {
    if (myPhase === theirPhase) {
      score += 15;
    } else {
      var adjPhases = _PHASE_ADJACENT[myPhase] || [];
      if (adjPhases.indexOf(theirPhase) >= 0) score += 8;
    }
  }

  // 3. Shared bubbles — 8pt per, max 24
  score += Math.min((sharedBubbleCount || 0) * 8, 24);

  // 4. Tag-cluster bonus — 5pt per cluster, max 20
  score += _calcClusterBonus(myKw, theirKw);

  // 5. Direct tag overlap bonus (for profiles that haven't migrated to sectors yet)
  var overlap = myKw.filter(function(k) { return theirKw.indexOf(k) >= 0; });
  if (overlap.length > 0 && sectorScore === 0) {
    // Fallback: give tag overlap some weight if sector detection yielded nothing
    score += Math.min(overlap.length * 4, 16);
  }

  return Math.min(Math.max(Math.round(score), 1), 99);
}

// Quick relevance for sorting (0-1 range, used internally)


