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
      (bubbleInfo ? '<div style="padding-left:3.2rem;margin-top:0.15rem">' + bubbleInfo + '</div>' : '') +
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
    document.getElementById('rp-match').textContent = score + '%';
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
    showToast('Kontakt gemt!'); loadSavedContacts();
  } catch(e) { logError("rpSaveContact", e); showToast(e.message || "Ukendt fejl"); }
}
function rpFullProfile() {
  var uid = rpCurrentUserId; closeRadarPerson(); closeRadarSheet();
  setTimeout(function(){ openPerson(uid, 'screen-home'); }, 400);
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


