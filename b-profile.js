// ══════════════════════════════════════════════════════════
//  BUBBLE — PROFILE + PERSON + SAVED CONTACTS + BLOCK & REPORT
//  Auto-split from app.js · v3.7.0
// ══════════════════════════════════════════════════════════

//  PERSON PROFILE
// ══════════════════════════════════════════════════════════
async function openPerson(userId, fromScreen) {
  try {
    currentPerson = userId;
    const backBtn = document.getElementById('person-back-btn');
    backBtn.onclick = () => goTo(fromScreen || 'screen-home');
    goTo('screen-person');
    var myNav = _navVersion;

    // Reset bubble-up confirmation from any previous profile
    var bupBtn = document.getElementById('person-bubbleup-btn');
    var bupConfirm = document.getElementById('person-bubbleup-confirm');
    if (bupBtn) bupBtn.style.display = 'flex';
    if (bupConfirm) bupConfirm.classList.remove('show');
    // Reset other stateful UI
    var starSec = document.getElementById('person-star-section');
    if (starSec) starSec.style.display = 'none';
    var matchEl = document.getElementById('person-match-label');
    if (matchEl) { matchEl.textContent = ''; matchEl.style.display = 'none'; }

    const { data: p } = await sb.from('profiles').select('*').eq('id', userId).single();
    if (!p || _navVersion !== myNav) {
      // Profile doesn't exist or was deleted
      if (!p && _navVersion === myNav) {
        var personAvEl = document.getElementById('person-avatar');
        if (personAvEl) personAvEl.textContent = '?';
        document.getElementById('person-name').textContent = 'Profil ikke tilgængelig';
        document.getElementById('person-role').textContent = 'Denne profil eksisterer ikke længere';
        document.getElementById('person-overlap').innerHTML = '';
        var bioS = document.getElementById('person-bio-section'); if (bioS) bioS.style.display = 'none';
        var tagS = document.getElementById('person-tags-section'); if (tagS) tagS.style.display = 'none';
        document.getElementById('person-dynamic-keywords').innerHTML = '';
      }
      return;
    }

    const initials = p.is_anon ? '?' : (p.name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    var personAvEl = document.getElementById('person-avatar');
    if (personAvEl) {
      if (p.avatar_url && !p.is_anon) { personAvEl.innerHTML = '<img src="'+escHtml(p.avatar_url)+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%">'; }
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
    var ml = matchLabel(score);
    var matchEl = document.getElementById('person-match-label');
    matchEl.textContent = ml.text;
    matchEl.style.background = ml.color;
    matchEl.style.display = ml.text ? '' : 'none';

    // Hide full tags section — only show in edit profile
    var tagsSection = document.getElementById('person-tags-section');
    if (tagsSection) tagsSection.style.display = 'none';

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

    // Shared interests — collapsible (show 6, expand to all)
    const overlapEl = document.getElementById('person-overlap');
    if (overlap.length) {
      var INITIAL_SHOW = 6;
      var allTagsHtml = overlap.map(function(k) {
        var original = (p.keywords || []).find(function(t) { return t.toLowerCase() === k; }) || k;
        return '<span class="tag mint">' + icon("check") + ' ' + escHtml(original) + '</span>';
      });
      var visibleHtml = allTagsHtml.slice(0, INITIAL_SHOW).join('');
      var hiddenHtml = allTagsHtml.slice(INITIAL_SHOW).join('');
      var hasMore = overlap.length > INITIAL_SHOW;
      
      overlapEl.innerHTML = '<div class="person-section-title" style="margin-bottom:0.4rem">Fælles interesser · ' + overlap.length + '</div>' +
        '<div id="person-tags-visible">' + visibleHtml + '</div>' +
        (hasMore ? '<div id="person-tags-hidden" style="display:none">' + hiddenHtml + '</div>' +
          '<button id="person-tags-toggle" onclick="togglePersonTags()" style="font-size:0.7rem;font-weight:600;color:var(--accent);background:none;border:none;padding:0.4rem 0;cursor:pointer;font-family:inherit">Vis alle ' + overlap.length + ' →</button>' : '');
    } else {
      overlapEl.innerHTML = '<span class="fs-085 text-muted">Ingen fælles interesser fundet</span>';
    }

    const dynEl = document.getElementById('person-dynamic-keywords');
    if ((p.dynamic_keywords||[]).length) {
      dynEl.innerHTML = '<div class="person-section-title">Søger nu</div>' + p.dynamic_keywords.map(k => `<span class="tag gold">${icon("fire")} ${escHtml(k)}</span>`).join('');
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
  } catch(e) { logError("openPerson", e); showToast(e.message || "Ukendt fejl"); }
}

async function saveContact() {
  try {
    if (!currentPerson) return;
    const { data: existing } = await sb.from('saved_contacts').select('id').eq('user_id', currentUser.id).eq('contact_id', currentPerson).maybeSingle();
    if (existing) { showToast('Allerede gemt'); return; }
    await sb.from('saved_contacts').insert({ user_id: currentUser.id, contact_id: currentPerson });
    document.getElementById('save-btn').innerHTML = icon('checkCircle') + '<span>Gemt</span>';
    showSuccessToast('Kontakt gemt');
    trackEvent('contact_saved', { contact_id: currentPerson });
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
  confirm.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:0.5rem 0.6rem;margin-top:0.4rem;background:rgba(26,122,138,0.08);border:1px solid rgba(26,122,138,0.2);border-radius:10px;gap:0.5rem';
  confirm.onclick = function(e) { e.stopPropagation(); };
  confirm.innerHTML = `<span style="font-size:0.72rem;color:var(--text-secondary)">Fjern kontakt?</span>
    <div style="display:flex;gap:0.3rem">
      <button class="btn-sm btn-ghost" style="padding:0.25rem 0.6rem;font-size:0.7rem;color:var(--accent2);border-color:rgba(26,122,138,0.3)" onclick="event.stopPropagation();confirmRemoveSaved()">Fjern</button>
      <button class="btn-sm btn-ghost" style="padding:0.25rem 0.6rem;font-size:0.7rem" onclick="cancelRemoveSaved(this)">Annuller</button>
    </div>`;
  card.appendChild(confirm);
}

function cancelRemoveSaved(btn) {
  var confirm = btn.closest('.remove-confirm');
  if (confirm) confirm.remove();
  pendingRemoveSavedId = null;
  pendingRemoveBtn = null;
}

async function confirmRemoveSaved() {
  try {
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
  } catch(e) { logError("confirmRemoveSaved", e); }
}

// proposeMeeting / sendMeetingProposal removed — feature shelved


// PROXIMITY MAP / RADAR
var proxVisible = true;
var proxRange = 5;
var proxAllProfiles = [];
var _radarFilter = 'all';    // all | strong | good | shared
var _radarPage = 0;
var RADAR_PAGE_SIZE = 25;

function setRadarFilter(filter, btn) {
  _radarFilter = filter;
  _radarPage = 0;
  matchPage = 0;  // Reset map pagination too
  // Update active button
  document.querySelectorAll('.radar-filter-btn').forEach(function(b) { b.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  // Re-render both views
  renderProximityDots();
  renderRadarList();
  // Update count label
  var filtered = getFilteredProfiles();
  var el = document.getElementById('prox-range-label');
  if (el) el.textContent = filtered.length + ' personer';
}

function getFilteredProfiles() {
  return proxAllProfiles.filter(function(p) {
    if (p.is_anon) return false;
    if (radarDismissed.indexOf(p.id) >= 0) return false;
    var score = p.matchScore || Math.round((p.relevance || 0) * 85 + 10);
    if (_radarFilter === 'strong') return score >= 80;
    if (_radarFilter === 'good') return score >= 60;
    if (_radarFilter === 'shared') return score >= 40;
    return true; // 'all'
  });
}

function radarNextPage() {
  _radarPage++;
  renderRadarList();
  // Scroll list to top
  var listEl = document.getElementById('radar-view-list');
  if (listEl) listEl.scrollTop = 0;
}
var proxColors = [
  'linear-gradient(135deg,#2ECFCF,#22B8CF)',  // cyan
  'linear-gradient(135deg,#6366F1,#7C5CFC)',  // indigo→purple
  'linear-gradient(135deg,#E879A8,#EC4899)',  // pink→rose
  'linear-gradient(135deg,#F59E0B,#EAB308)',  // amber
  'linear-gradient(135deg,#1A9E8E,#10B981)',  // teal→emerald
  'linear-gradient(135deg,#8B5CF6,#A855F7)',  // violet
  'linear-gradient(135deg,#3B82F6,#6366F1)',  // blue→indigo
  'linear-gradient(135deg,#EF4444,#F97316)',  // red→orange
  'linear-gradient(135deg,#06B6D4,#0EA5E9)',  // sky
  'linear-gradient(135deg,#D946EF,#C026D3)',  // fuchsia
];
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
    var r1 = await sb.from('profiles').select('id,name,title,keywords,dynamic_keywords,bio,linkedin,is_anon,avatar_url').neq('id', currentUser.id).neq('banned', true).limit(200);
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

  var allFil = getFilteredProfiles();

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
    if (currentProfile.avatar_url) {
      ce.innerHTML = '<img src="' + escHtml(currentProfile.avatar_url) + '">';
    } else {
      ce.textContent = currentProfile.name.split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();
    }
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
  var allFil = getFilteredProfiles();
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

  var centerR = 0.10;
  var zones = [
    { r: centerR, fill: 'rgba(124,92,252,0.18)' },
    { r: 0.26, fill: 'rgba(124,92,252,0.10)' },
    { r: 0.42, fill: 'rgba(46,207,207,0.08)' },
    { r: 0.58, fill: 'rgba(107,139,255,0.06)' },
    { r: 0.74, fill: 'rgba(139,92,246,0.04)' },
    { r: 0.90, fill: 'rgba(124,92,252,0.02)' },
  ];
  // Draw filled zones from outside in so inner overlaps
  for (var i = zones.length - 1; i >= 0; i--) {
    ctx.beginPath();
    ctx.arc(cx, cy, zones[i].r * maxR, 0, Math.PI * 2);
    ctx.fillStyle = zones[i].fill;
    ctx.fill();
  }
  // Draw ring borders — visible on light bg
  for (var i = 0; i < zones.length; i++) {
    ctx.beginPath();
    ctx.arc(cx, cy, zones[i].r * maxR, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(30,27,46,0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  // Subtle center glow
  var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, zones[0].r * maxR);
  g.addColorStop(0, 'rgba(124,92,252,0.12)');
  g.addColorStop(1, 'rgba(124,92,252,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, zones[0].r * maxR, 0, Math.PI * 2);
  ctx.fill();
}

function updateProximityRange(val) {
  // Now driven by filter buttons, not slider
  var el = document.getElementById('prox-range-label');
  var filtered = getFilteredProfiles();
  if (el) el.textContent = filtered.length + ' personer';
  if (radarCurrentView === 'map') {
    renderProximityDots();
  } else {
    renderRadarList();
  }
}

function toggleProximityVisibility() {
  proxVisible = !proxVisible;
  var btn = document.getElementById('prox-toggle');
  var d = document.getElementById('prox-toggle-dot');
  var l = document.getElementById('prox-toggle-label');
  var c = document.getElementById('prox-center');
  if (d) d.style.background = proxVisible ? '#1A9E8E' : 'var(--muted)';
  if (l) l.textContent = proxVisible ? 'Synlig' : 'Skjult';
  // Restyle the whole button for clear on/off state
  if (btn) {
    if (proxVisible) {
      btn.style.background = 'rgba(26,158,142,0.12)';
      btn.style.borderColor = 'rgba(26,158,142,0.3)';
      btn.style.color = '#1A9E8E';
    } else {
      btn.style.background = 'rgba(30,27,46,0.04)';
      btn.style.borderColor = 'var(--glass-border)';
      btn.style.color = 'var(--muted)';
    }
  }
  if (c) { if (proxVisible && currentProfile && currentProfile.name) { 
    if (currentProfile.avatar_url) { c.innerHTML = '<img src="' + escHtml(currentProfile.avatar_url) + '">'; } 
    else { c.textContent = currentProfile.name.split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase(); }
    c.style.background = 'var(--gradient-primary)'; } else { c.textContent = '?'; c.style.background = 'rgba(30,27,46,0.06)'; } }
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
  if (d) d.style.background = proxVisible ? '#1A9E8E' : 'var(--muted)';
  if (l) l.textContent = proxVisible ? 'Synlig' : 'Skjult';
  if (btn) {
    if (proxVisible) {
      btn.style.background = 'rgba(26,158,142,0.12)';
      btn.style.borderColor = 'rgba(26,158,142,0.3)';
      btn.style.color = '#1A9E8E';
    } else {
      btn.style.background = 'rgba(30,27,46,0.04)';
      btn.style.borderColor = 'var(--glass-border)';
      btn.style.color = 'var(--muted)';
    }
  }
  // Show loading state then fetch fresh data
  var loadingEl = document.getElementById('prox-empty');
  if (loadingEl) { loadingEl.style.display = 'block'; loadingEl.textContent = 'Finder relevante personer…'; }
  // Always reload fresh data — loadProximityMap handles rendering
  loadProximityMap().then(function() {
    if (loadingEl) loadingEl.style.display = 'none';
    // Ensure list view also renders if active
    if (radarCurrentView === 'list') renderRadarList();
  }).catch(function() {
    if (loadingEl) loadingEl.style.display = 'none';
    // Fallback: render from cache if fetch fails
    if (radarCurrentView === 'map') renderProximityDots(); else renderRadarList();
  });
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
      showSuccessToast('Kontakt gemt');
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
    updatePushButtonState();
    var vLabel = document.getElementById('version-label');
    if (vLabel) vLabel.textContent = 'Bubble ' + BUILD_VERSION + ' · Build ' + BUILD_TIMESTAMP;

    const initials = (currentProfile.name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    var myAvEl = document.getElementById('my-avatar');
    if (myAvEl) {
      if (currentProfile.avatar_url) { myAvEl.innerHTML = '<img src="'+escHtml(currentProfile.avatar_url)+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%">'; }
      else { myAvEl.textContent = initials; }
    }
    document.getElementById('my-name').textContent = currentProfile.name || '...';
    document.getElementById('my-role').textContent = (currentProfile.title || '') + (currentProfile.workplace ? ' · ' + currentProfile.workplace : '');

    isAnon = currentProfile.is_anon || false;
    updateAnonToggle();

    await Promise.all([loadSavedContacts(), loadMyBubbles(), loadProfileInvitations(), loadDashboard()]);

    // Admin panel — only for admin UID
    var adminPanel = document.getElementById('admin-panel');
    if (adminPanel) {
      if (currentUser && currentUser.id === ADMIN_UID) {
        adminPanel.style.display = 'block';
        adminLoadReports();
        adminLoadBanned();
        adminLoadStats();
      } else {
        adminPanel.style.display = 'none';
      }
    }
  } catch(e) { logError("loadProfile", e); showToast('Kunne ikke hente profil — tjek forbindelsen'); }
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
function starRender(contactId) {
  var r = starGet(contactId);
  if (r === 0) return '';
  return '<span class="star-badge">' + '\u2605'.repeat(r) + '</span>';
}

async function loadSavedContacts() {
  try {
    clearSavedContactIdsCache(); // Invalidate shared cache
    const savedEl = document.getElementById('saved-contacts');

    // Fetch saved contacts — chronological (newest first)
    const { data: savedRaw, error: savedErr } = await sb.from('saved_contacts')
      .select('id, contact_id, created_at')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false });

    if (savedErr) { console.error('loadSavedContacts query error:', savedErr); return; }

    // Filter out self
    var saved = (savedRaw || []).filter(function(s) { return s.contact_id !== currentUser.id; });

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

    const colors = ['linear-gradient(135deg,#2ECFCF,#22B8CF)','linear-gradient(135deg,#6366F1,#7C5CFC)','linear-gradient(135deg,#E879A8,#EC4899)','linear-gradient(135deg,#F59E0B,#EAB308)','linear-gradient(135deg,#1A9E8E,#10B981)','linear-gradient(135deg,#8B5CF6,#A855F7)','linear-gradient(135deg,#3B82F6,#6366F1)','linear-gradient(135deg,#EF4444,#F97316)','linear-gradient(135deg,#06B6D4,#0EA5E9)','linear-gradient(135deg,#D946EF,#C026D3)'];

    // Sort by star rating (highest first), then by date
    saved.sort(function(a, b) {
      var sa = starGet(a.contact_id), sb2 = starGet(b.contact_id);
      if (sb2 !== sa) return sb2 - sa;
      return new Date(b.created_at) - new Date(a.created_at);
    });

    if (savedEl) savedEl.innerHTML = saved.map((s, i) => {
      const p = profileMap[s.contact_id] || {};
      if (s.contact_id === currentUser?.id) return '';
      const ini = (p.name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
      const col = colors[i % colors.length];
      const stars = starRender(s.contact_id);
      const pid = p.id || s.contact_id;
      return `<div class="card saved-card" style="padding:0.7rem 0.9rem;margin-bottom:0.4rem;cursor:pointer" onclick="bcOpenPerson('${pid}','${escHtml(p.name||'')}','${escHtml(p.title||'')}','${col}','screen-profile')">
        <div class="flex-row-center" style="gap:0.7rem">
          <div class="saved-avatar-wrap" style="position:relative;flex-shrink:0">
            ${p.avatar_url ? '<div class="avatar" style="width:42px;height:42px;overflow:hidden;border-radius:50%"><img src="'+escHtml(p.avatar_url)+'" style="width:100%;height:100%;object-fit:cover"></div>' : '<div class="avatar" style="background:'+col+';width:42px;height:42px;font-size:0.75rem">'+ini+'</div>'}
            ${stars}
          </div>
          <div style="flex:1;min-width:0">
            <div class="fw-600 fs-085" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(p.name||'Ukendt')}</div>
            <div class="fs-075 text-muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(p.title||'')}</div>
          </div>
          <div style="display:flex;gap:0.35rem;flex-shrink:0" onclick="event.stopPropagation()">
            <button class="saved-action-btn" onclick="openChat('${pid}','screen-profile')" title="Send besked">${icon('chat')}</button>
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
  if (saved) saved = saved.filter(function(s) { return s.contact_id !== currentUser?.id; });
  if (!saved || saved.length === 0) { bar.style.display = 'none'; return; }
  bar.style.display = 'block';
  if (badge) badge.textContent = saved.length;
  // Sort by stars for story bar too
  saved = saved.slice().sort(function(a, b) {
    var sa = starGet(a.contact_id), sb2 = starGet(b.contact_id);
    return sb2 - sa;
  });
  var colors = ['linear-gradient(135deg,#2ECFCF,#22B8CF)','linear-gradient(135deg,#6366F1,#7C5CFC)','linear-gradient(135deg,#E879A8,#EC4899)','linear-gradient(135deg,#F59E0B,#EAB308)','linear-gradient(135deg,#1A9E8E,#10B981)','linear-gradient(135deg,#8B5CF6,#A855F7)','linear-gradient(135deg,#3B82F6,#6366F1)','linear-gradient(135deg,#EF4444,#F97316)','linear-gradient(135deg,#06B6D4,#0EA5E9)','linear-gradient(135deg,#D946EF,#C026D3)'];
  list.innerHTML = saved.map(function(s, i) {
    var p = profileMap[s.contact_id];
    if (s.contact_id === currentUser?.id) return '';
    var name = p ? p.name : '?';
    var ini = (name||'?').split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();
    var col = colors[i % colors.length];
    var firstName = (name||'?').split(' ')[0];
    var starCount = starGet(s.contact_id);
    var starBadge = starCount > 0 ? '<span class="star-badge">' + '★'.repeat(starCount) + '</span>' : '';
    var storyAvatar = (p && p.avatar_url) ?
      '<div style="position:relative"><div class="saved-story-avatar" style="overflow:hidden"><img src="' + escHtml(p.avatar_url) + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%"></div>' + starBadge + '</div>' :
      '<div style="position:relative"><div class="saved-story-avatar" style="background:' + col + '">' + escHtml(ini) + '</div>' + starBadge + '</div>';
    return '<div class="saved-story-item" onclick="openPerson(\'' + s.contact_id + '\',\'screen-home\')">' +
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
        '<button onclick="openFeedback()" style="width:100%;padding:0.7rem;background:rgba(124,92,252,0.08);border:1px solid rgba(124,92,252,0.15);border-radius:12px;font-size:0.82rem;font-family:inherit;font-weight:600;color:var(--accent);cursor:pointer;margin-bottom:0.5rem">💬 Giv feedback</button>' +
        '<button onclick="showTerms()" style="width:100%;padding:0.7rem;background:none;border:1px solid var(--glass-border);border-radius:12px;font-size:0.82rem;font-family:inherit;font-weight:600;color:var(--text-secondary);cursor:pointer;margin-bottom:0.5rem">Betingelser & Privatlivspolitik</button>' +
        '<button onclick="handleLogout()" style="width:100%;padding:0.7rem;background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.2);border-radius:12px;font-size:0.82rem;font-family:inherit;font-weight:600;color:#EF4444;cursor:pointer">Log ud</button>' +
        '<div style="text-align:center;margin-top:2rem;font-size:0.62rem;color:var(--muted)">Bubble ' + BUILD_VERSION + ' · Build ' + BUILD_TIMESTAMP + '</div>';
      container.parentElement.insertBefore(div, container.nextSibling);
    }
  }
  ['dashboard','saved','bubbles','invites','settings'].forEach(function(t) {
    var panel = document.getElementById('prof-panel-' + t);
    var tabBtn = document.getElementById('prof-tab-' + t);
    if (panel) panel.style.display = t === tab ? 'flex' : 'none';
    if (tabBtn) tabBtn.classList.toggle('active', t === tab);
  });
  if (tab === 'dashboard') loadDashboard();
  if (tab === 'settings') { updateAnonToggle(); hsUpdateAllToggles(); }
}

// Load invitations into profile invitations tab
async function loadProfileInvitations() {
  try {
    const list = document.getElementById('profile-invitations');
    if (!list) return;
    list.innerHTML = skelCards(3);

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

    const colors = ['linear-gradient(135deg,#2ECFCF,#22B8CF)','linear-gradient(135deg,#6366F1,#7C5CFC)','linear-gradient(135deg,#E879A8,#EC4899)','linear-gradient(135deg,#F59E0B,#EAB308)','linear-gradient(135deg,#1A9E8E,#10B981)','linear-gradient(135deg,#8B5CF6,#A855F7)','linear-gradient(135deg,#3B82F6,#6366F1)','linear-gradient(135deg,#EF4444,#F97316)','linear-gradient(135deg,#06B6D4,#0EA5E9)','linear-gradient(135deg,#D946EF,#C026D3)'];

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
  confirm.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:0.5rem 0.6rem;margin-top:0.4rem;background:rgba(26,122,138,0.08);border:1px solid rgba(26,122,138,0.2);border-radius:10px;gap:0.5rem';
  confirm.innerHTML = `<span style="font-size:0.72rem;color:var(--text-secondary)">Afvis invitation?</span>
    <div style="display:flex;gap:0.3rem">
      <button class="btn-sm btn-ghost" style="padding:0.25rem 0.6rem;font-size:0.7rem;color:var(--accent2);border-color:rgba(26,122,138,0.3)" onclick="confirmDeclineInvite()">Afvis</button>
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
  try {
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
  } catch(e) { logError("confirmDeclineInvite", e); }
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
    showSuccessToast('Profil gemt');
  } catch(e) { logError("saveProfile", e); showToast(e.message || "Ukendt fejl"); }
}

function toggleAnon() {
  isAnon = !isAnon;
  updateAnonToggle();
  sb.from('profiles').update({ is_anon: isAnon }).eq('id', currentUser.id).then();
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
  try {
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
  } catch(e) { logError("psBlockUser", e); }
}

var _reportConfirm = null;
async function psReportUser() {
  try {
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
  } catch(e) { logError("psReportUser", e); }
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

// ══════════════════════════════════════════════════════════
//  DASHBOARD — user metrics
// ══════════════════════════════════════════════════════════
async function loadDashboard() {
  var el = document.getElementById('prof-dashboard-content');
  if (!el || !currentUser) return;

  try {
    // Run all queries in parallel — each wrapped for resilience
    var safe = async function(fn) { try { return await fn(); } catch(e) { return { count: 0 }; } };

    var [viewsRes, savedByRes, savedRes, bubblesRes, matchesRes] = await Promise.all([
      safe(function() { return sb.from('profile_views').select('*', { count: 'exact', head: true }).eq('viewed_id', currentUser.id); }),
      safe(function() { return sb.from('saved_contacts').select('*', { count: 'exact', head: true }).eq('contact_id', currentUser.id); }),
      safe(function() { return sb.from('saved_contacts').select('*', { count: 'exact', head: true }).eq('user_id', currentUser.id); }),
      safe(function() { return sb.from('bubble_members').select('*', { count: 'exact', head: true }).eq('user_id', currentUser.id); }),
      safe(async function() {
        if (!currentProfile || !(currentProfile.keywords || []).length) return { count: 0 };
        var { data: myBubbles } = await sb.from('bubble_members').select('bubble_id').eq('user_id', currentUser.id);
        if (!myBubbles || myBubbles.length === 0) return { count: 0 };
        var bubbleIds = myBubbles.map(function(m) { return m.bubble_id; });
        var { data: others } = await sb.from('bubble_members')
          .select('user_id, profiles(id, keywords, dynamic_keywords, bio, title, linkedin)')
          .in('bubble_id', bubbleIds).neq('user_id', currentUser.id).limit(50);
        if (!others) return { count: 0 };
        var seen = {};
        var strong = 0;
        others.forEach(function(m) {
          if (seen[m.user_id] || !m.profiles) return;
          seen[m.user_id] = true;
          var score = (typeof calcMatchScore === 'function') ? calcMatchScore(currentProfile, m.profiles, 1) : 0;
          if (score >= 80) strong++;
        });
        return { count: strong };
      })
    ]);

    var views = viewsRes.count || 0;
    var savedBy = savedByRes.count || 0;
    var mySaved = savedRes.count || 0;
    var bubbles = bubblesRes.count || 0;
    var strongMatches = matchesRes.count || 0;

    // Profile completeness
    var completeness = 0;
    var totalFields = 6;
    if (currentProfile.name) completeness++;
    if (currentProfile.title) completeness++;
    if (currentProfile.workplace) completeness++;
    if (currentProfile.bio) completeness++;
    if (currentProfile.avatar_url) completeness++;
    if ((currentProfile.keywords || []).length >= 3) completeness++;
    var completePct = Math.round((completeness / totalFields) * 100);

    // Render
    var statCard = function(iconName, label, value, color) {
      var iconHtml = ico(iconName).replace('<svg ', '<svg style="width:18px;height:18px" ');
      return '<div style="display:flex;align-items:center;gap:0.7rem;padding:0.7rem 0.9rem;background:#FFFFFF;border:1px solid var(--glass-border-subtle);border-radius:var(--radius);box-shadow:0 1px 3px rgba(30,27,46,0.06)">' +
        '<div style="width:36px;height:36px;border-radius:10px;background:' + color + ';display:flex;align-items:center;justify-content:center;flex-shrink:0">' + iconHtml + '</div>' +
        '<div style="flex:1;min-width:0"><div style="font-size:1.1rem;font-weight:800;color:var(--text)">' + value + '</div><div style="font-size:0.68rem;color:var(--text-secondary)">' + label + '</div></div>' +
        '</div>';
    };

    // Profile CTA based on completeness
    var ctaHtml = '';
    if (completePct >= 100) {
      ctaHtml = '<div style="font-size:0.65rem;color:var(--green);margin-top:0.4rem;display:flex;align-items:center;gap:0.3rem">' + icon('check') + ' Din profil er komplet!</div>';
    } else {
      var missing = [];
      if (!currentProfile.bio) missing.push('bio');
      if (!currentProfile.avatar_url) missing.push('billede');
      if ((currentProfile.keywords||[]).length < 3) missing.push('interesser');
      if (!currentProfile.title) missing.push('titel');
      ctaHtml = '<div style="font-size:0.65rem;color:var(--text-secondary);margin-top:0.3rem">Tilføj ' + missing.join(', ') + ' for bedre matches</div>' +
        '<button onclick="openEditProfile()" style="width:100%;margin-top:0.5rem;padding:0.55rem;font-size:0.78rem;font-weight:600;font-family:inherit;background:rgba(124,92,252,0.08);color:var(--accent);border:1px solid rgba(124,92,252,0.15);border-radius:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:0.3rem">' + icon('edit') + ' Fortsæt med at forbedre din profil</button>';
    }

    el.innerHTML =
      '<div style="font-size:0.62rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--accent);margin-bottom:0.4rem">Din Bubble-uge</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.4rem">' +
        statCard('eye', 'Profilvisninger', views, 'rgba(124,92,252,0.08)') +
        statCard('bookmark', 'Har gemt dig', savedBy, 'rgba(232,121,168,0.08)') +
        statCard('heart', 'Du har gemt', mySaved, 'rgba(26,158,142,0.08)') +
        statCard('bubble', 'Bobler', bubbles, 'rgba(46,207,207,0.08)') +
      '</div>' +
      '<div style="margin-top:0.4rem">' +
        statCard('target', 'Stærke matches i dine bobler', strongMatches, 'rgba(26,158,142,0.08)') +
      '</div>' +
      '<div style="margin-top:0.6rem;background:#FFFFFF;border:1px solid var(--glass-border-subtle);border-radius:var(--radius);padding:0.7rem 0.9rem;box-shadow:0 1px 3px rgba(30,27,46,0.06)">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.4rem">' +
          '<div style="font-size:0.78rem;font-weight:700;color:var(--text)">Profilstyrke</div>' +
          '<div style="font-size:0.78rem;font-weight:800;color:' + (completePct >= 100 ? 'var(--green)' : 'var(--accent)') + '">' + completePct + '%</div>' +
        '</div>' +
        '<div style="height:6px;background:var(--glass-bg-strong);border-radius:3px;overflow:hidden">' +
          '<div style="height:100%;width:' + completePct + '%;background:' + (completePct >= 100 ? 'var(--green)' : 'var(--gradient-primary)') + ';border-radius:3px;transition:width 0.5s ease"></div>' +
        '</div>' +
        ctaHtml +
      '</div>';

  } catch(e) {
    logError('loadDashboard', e);
    el.innerHTML = '<div style="text-align:center;padding:1.5rem;font-size:0.78rem;color:var(--muted)">Kunne ikke hente dashboard-data</div>';
  }
}

function togglePersonTags() {
  var hidden = document.getElementById('person-tags-hidden');
  var btn = document.getElementById('person-tags-toggle');
  if (!hidden || !btn) return;
  var isHidden = hidden.style.display === 'none';
  hidden.style.display = isHidden ? '' : 'none';
  btn.textContent = isHidden ? '← Vis færre' : 'Vis alle →';
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
    // Dedup: check if a pending invitation already exists between these two users
    var { data: existing } = await sb.from('bubble_invitations')
      .select('id')
      .eq('from_user_id', currentUser.id)
      .eq('to_user_id', toUserId)
      .eq('status', 'pending')
      .maybeSingle();
    if (existing) { showToast('Du har allerede sendt en invitation til denne person'); return; }

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



