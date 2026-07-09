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

// Ported from PROD v8.17.31 (Fix 6: registerState cleanup).
// Prevents user A's dismiss list from leaking to user B
registerState(function() {
  radarCurrentView = 'map';
  if (typeof radarDismissed !== 'undefined') radarDismissed = [];
  if (typeof radarPendingRemove !== 'undefined') radarPendingRemove = null;
  if (typeof rpCurrentUserId !== 'undefined') rpCurrentUserId = null;
  if (typeof _rpSaveLock !== 'undefined') _rpSaveLock = false;
  if (typeof matchPage !== 'undefined') matchPage = 0;
});


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
    el.innerHTML = '<div style="text-align:center;padding:2rem 0;font-size:0.78rem;color:var(--muted)">' + t('radar_no_profiles') +
      (_radarFilter !== 'all' ? ' med dette match-niveau' : ' i n\u00e6rheden') +
      (radarDismissed.length > 0 ? '<br><button class="btn-sm btn-ghost" onclick="radarResetDismissed()" style="margin-top:0.5rem;font-size:0.7rem">' + t('radar_show_all_again') + '</button>' : '') + '</div>';
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
    var name = isA ? t('ps_anonymous') : (p.name || '?');
    var ini = isA ? '?' : name.split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();
    var col = isA ? 'rgba(255,255,255,0.05)' : colors[i % colors.length];
    var bd = isA ? 'border:0.5px solid rgba(255,255,255,0.08);' : '';
    var theirKw = (p.keywords || []).map(function(k){ return k.toLowerCase(); });
    var overlap = myKw.filter(function(k){ return theirKw.indexOf(k) >= 0; });
    var matchPct = p.matchScore || Math.min(Math.round(p.relevance * 85 + 10), 99);
    var matchBadge = isA ? '' : matchBadgeHtml(matchPct);
    var bubbleInfo = p.sharedBubbles > 0 ? '<span class="fs-065 text-muted">' + p.sharedBubbles + ' f\u00e6lles boble' + (p.sharedBubbles > 1 ? 'r' : '') + '</span>' : '';
    return '<div class="radar-list-card" data-uid="' + p.id + '" data-name="' + escHtml(name) + '" style="--card-delay:' + (i * 40) + 'ms">' +
      '<div class="flex-row-center" style="gap:0.7rem">' +
        '<div class="radar-list-avatar" style="background:' + col + ';' + bd + '" onclick="openRadarPerson(\'' + p.id + '\')">' + escHtml(ini) + '</div>' +
        '<div style="flex:1;min-width:0;cursor:pointer" onclick="openRadarPerson(\'' + p.id + '\')">' +
          '<div class="fw-600 fs-085 u-ellipsis">' + escHtml(name) + '</div>' +
          (isA ? '' : '<div class="fs-072 text-muted u-ellipsis">' + escHtml([p.title, p.workplace].filter(Boolean).join(' \u00B7 ')) + '</div>') +
        '</div>' +
        matchBadge +
        '<button class="radar-list-remove" onclick="event.stopPropagation();radarConfirmRemove(\'' + p.id + '\',\'' + escHtml(name).replace(/'/g,'') + '\')" title="' + t('misc_remove') + '">' + icon('x') + '</button>' +
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
  confirm.innerHTML = '<span style="font-size:0.72rem;color:var(--text-secondary)">' + t('radar_remove_contact_q') + '</span>' +
    '<div style="display:flex;gap:0.3rem">' +
      '<button class="btn-sm btn-ghost" style="padding:0.25rem 0.6rem;font-size:0.7rem;color:var(--accent2);border-color:rgba(26,122,138,0.3)" onclick="event.stopPropagation();radarDoRemove()">' + t('misc_remove') + '</button>' +
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
    // INSTANT OPEN (pattern from openPerson): show sheet immediately with reset/skeleton
    // state, fetch everything in parallel after. Previously three SEQUENTIAL awaits ran
    // before the sheet opened -> visible tap delay, worst on conference WiFi.
    var _rpReset = function() {
      // Skeleton-bjaelker for navn/sub mens data hentes (i stedet for tom/pop-in)
      var nm = document.getElementById('rp-name'); if (nm) nm.innerHTML = '<span class="rp-skel-bar name"></span>';
      var sb = document.getElementById('rp-sub'); if (sb) sb.innerHTML = '<span class="rp-skel-bar sub"></span>';
      var av = document.getElementById('rp-avatar'); if (av) { av.innerHTML = ''; av.textContent = ''; av.style.background = ''; av.classList.add('rp-skel-pulse', 'rp-skel-avatar'); }
      ['rp-live-badge','rp-bio','rp-tags','rp-overlap','rp-shared-bubbles'].forEach(function(k) { var el = document.getElementById(k); if (el) el.style.display = 'none'; });
      var m = document.getElementById('rp-match'); if (m) { m.textContent = ''; m.style.color = 'transparent'; m.style.background = 'transparent'; }
      var li = document.getElementById('rp-linkedin-btn'); if (li) li.style.display = 'none';
      var sv = document.getElementById('rp-save-btn'); if (sv) { sv.dataset.saved = '0'; sv.style.background = 'rgba(255,255,255,0.08)'; sv.style.borderColor = 'rgba(255,255,255,0.16)'; sv.style.color = 'rgba(255,255,255,0.85)'; var svi = document.getElementById('rp-save-icon'); if (svi) svi.setAttribute('fill', 'none'); }
    };
    _rpReset();
    var _rpSheet = document.getElementById('home-preview');
    // Show overlay now (backdrop), but keep the sheet BELOW the screen (translateY
    // via .open withheld) until content is filled. The sheet is in the DOM and
    // laid out, so it can be measured, but the user sees nothing slide yet.
    // Inline preview: vis kompakt raekke, kollaps evt tidligere udvidelse
    var _hp = document.getElementById('home-preview');
    if (_hp) _hp.style.display = 'block';
    var _hpx = document.getElementById('home-preview-expand'); if (_hpx) _hpx.style.display = 'none';
    var _hpc = document.getElementById('home-preview-chev'); if (_hpc) _hpc.style.transform = 'rotate(0deg)';

    // Fetch profile + saved-state in parallel (live check needs only userId too,
    // but keeps its own conditional block below for clarity)
    var _rpExpireCutoff = new Date(Date.now() - LIVE_EXPIRE_HOURS * 3600000).toISOString();
    var _rpSharedFn = async function() {
      var r = await Promise.all([
        sb.from('bubble_members').select('bubble_id').eq('user_id', currentUser.id),
        sb.from('bubble_members').select('bubble_id').eq('user_id', userId)
      ]);
      var myB = (r[0].data || []).map(function(m){ return m.bubble_id; });
      var thB = (r[1].data || []).map(function(m){ return m.bubble_id; });
      var shared = myB.filter(function(id){ return thB.indexOf(id) >= 0; });
      if (shared.length === 0) return [];
      var res = await sb.from('bubbles').select('id, name, type').in('id', shared);
      return res.data || [];
    };
    var _rpResults = await Promise.allSettled([
      sb.from('profiles').select('*').eq('id', userId).maybeSingle(),
      sb.from('saved_contacts').select('id').eq('user_id', currentUser.id).eq('contact_id', userId).maybeSingle(),
      sb.from('bubble_members').select('checked_in_at, bubbles(name)').eq('user_id', userId)
        .not('checked_in_at', 'is', null).is('checked_out_at', null)
        .gte('checked_in_at', _rpExpireCutoff).order('checked_in_at', { ascending: false }).limit(1).maybeSingle(),
      _rpSharedFn()
    ]);
    var p = _rpResults[0].status === 'fulfilled' ? _rpResults[0].value.data : null;
    var savedCheck = _rpResults[1].status === 'fulfilled' ? _rpResults[1].value.data : null;
    var _rpLive = _rpResults[2].status === 'fulfilled' ? _rpResults[2].value.data : null;
    var _rpShared = _rpResults[3].status === 'fulfilled' ? _rpResults[3].value : [];
    // Stale guard: user tapped another person while this was loading
    if (rpCurrentUserId !== userId) return;
    if (!p) { closeRadarPerson(); return; }
    var isA = p.is_anon;
    var name = isA ? t('ps_anonymous') : (p.name || '?');
    var ini = isA ? '?' : name.split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();
    var rpAvEl = document.getElementById('rp-avatar');
    if (rpAvEl) {
      rpAvEl.classList.remove('rp-skel-pulse', 'rp-skel-avatar');
      if (p.avatar_url && !isA) {
        // Uploadet billede: vis billedet (ingen farve)
        rpAvEl.innerHTML = '<img src="'+escHtml(p.avatar_url)+'" class="u-avatar-img">';
        rpAvEl.style.overflow = 'hidden';
        rpAvEl.style.background = '';
      } else {
        // Ingen billede: forbogstaver paa SAMME farve som personens dot i radaren
        rpAvEl.textContent = ini;
        if (isA) {
          rpAvEl.style.background = 'var(--glass-border)';
        } else if (typeof _homeProxMetaFor === 'function' && typeof proxColors !== 'undefined' && proxColors) {
          var dotMeta = _homeProxMetaFor(p.id);
          rpAvEl.style.background = proxColors[dotMeta.col % proxColors.length];
        }
      }
    }
    document.getElementById('rp-name').textContent = name;
    // Subtitle: title · workplace
    var subParts = [p.title, p.workplace].filter(Boolean);
    document.getElementById('rp-sub').textContent = isA ? '' : subParts.join(' \u00B7 ');
    // Live presence
    var rpLiveEl = document.getElementById('rp-live-badge');
    if (rpLiveEl) {
      var liveCheck = _rpLive; // fetched in parallel batch above
      if (liveCheck) {
        rpLiveEl.innerHTML = '<span style="width:6px;height:6px;border-radius:50%;background:#1A9E8E;display:inline-block;animation:livePulse 1.5s infinite"></span> LIVE i ' + escHtml(liveCheck.bubbles?.name || '');
        rpLiveEl.style.display = 'inline-flex';
        rpLiveEl.style.alignItems = 'center';
        rpLiveEl.style.gap = '4px';
      } else {
        rpLiveEl.style.display = 'none';
      }
    }
    // Match score
    var myKw = (currentProfile?.keywords || []).map(function(k){ return k.toLowerCase(); });
    var theirKw = (p.keywords || []).map(function(k){ return k.toLowerCase(); });
    var overlap = myKw.filter(function(k){ return theirKw.indexOf(k) >= 0; });
    var proxData = proxAllProfiles.find(function(pp) { return pp.id === p.id; });
    var score = proxData ? proxData.matchScore : calcMatchScore(currentProfile || {}, p, 0);
    var ml = matchLabel(score);
    var matchEl = document.getElementById('rp-match');
    matchEl.textContent = ml.text;
    // Dark-context match badge colors (matchLabel uses light-mode colors)
    if (score >= 60)      { matchEl.style.color = '#34D399'; matchEl.style.background = 'rgba(26,158,142,0.18)'; }
    else if (score >= 40) { matchEl.style.color = '#FBBF24'; matchEl.style.background = 'rgba(251,191,36,0.18)'; }
    else if (score >= 20) { matchEl.style.color = '#60A5FA'; matchEl.style.background = 'rgba(59,130,246,0.18)'; }
    else if (score >= 1)  { matchEl.style.color = 'rgba(255,255,255,0.65)'; matchEl.style.background = 'rgba(255,255,255,0.08)'; }
    else                  { matchEl.style.color = 'transparent'; matchEl.style.background = 'transparent'; }
    // Bio
    document.getElementById('rp-bio').textContent = p.bio || '';
    document.getElementById('rp-bio').style.display = p.bio ? 'block' : 'none';
    // All tags: shared marked, rest greyed
    var tagsEl = document.getElementById('rp-tags');
    var allTheirTags = (p.keywords || []);
    if (allTheirTags.length > 0) {
      // Sort: shared first, then rest
      var sortedTags = allTheirTags.slice().sort(function(a, b) {
        var aShared = myKw.indexOf(a.toLowerCase()) >= 0 ? 0 : 1;
        var bShared = myKw.indexOf(b.toLowerCase()) >= 0 ? 0 : 1;
        return aShared - bShared;
      });
      var maxTags = 12;
      var visibleTags = sortedTags.slice(0, maxTags);
      var hiddenCount = sortedTags.length - maxTags;
      // Prototype: uppercase label "I HAR TILFAELLES" + piller (radius99), delte isbla, resten glas
      var tagLabel = t('rp_in_common') + (overlap.length > 0 ? ' \u00B7 ' + overlap.length : '');
      tagsEl.innerHTML = '<div style="font-size:9.5px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:rgba(255,255,255,0.4);margin-bottom:7px">' + escHtml(tagLabel) + '</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:6px">' +
        visibleTags.map(function(k) {
          var isShared = myKw.indexOf(k.toLowerCase()) >= 0;
          return isShared
            ? '<span style="font-size:10.5px;font-weight:700;color:#CFE6F7;background:rgba(100,180,230,0.14);border:0.5px solid rgba(100,180,230,0.28);border-radius:99px;padding:4px 11px">' + escHtml(k) + '</span>'
            : '<span style="font-size:10.5px;font-weight:700;color:rgba(255,255,255,0.7);background:rgba(255,255,255,0.07);border:0.5px solid rgba(255,255,255,0.14);border-radius:99px;padding:4px 11px">' + escHtml(k) + '</span>';
        }).join('') +
        (hiddenCount > 0 ? '<span style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.45);padding:4px 6px">+' + hiddenCount + '</span>' : '') +
        '</div>';
      tagsEl.style.display = 'block';
    } else {
      tagsEl.style.display = 'none';
    }
    // Hide old overlap section (merged into tags)
    document.getElementById('rp-overlap').style.display = 'none';
    // Shared bubbles (fire-and-forget, populate async)
    var sharedEl = document.getElementById('rp-shared-bubbles');
    if (sharedEl) {
      sharedEl.style.display = 'none';
      sharedEl.innerHTML = '';
      // Rendered synchronously from the parallel batch (was a late fire-and-forget
      // chain that popped in as a separate chunk after everything else)
      var bubbles = _rpShared;
      if (bubbles.length > 0) {
        sharedEl.innerHTML = '<div style="font-size:9.5px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:rgba(255,255,255,0.4);margin-bottom:7px">' + t('ps_public_bubbles') + ' \u00B7 ' + bubbles.length + '</div>' +
          '<div style="display:flex;flex-wrap:wrap;gap:4px">' +
          bubbles.slice(0, 5).map(function(b) {
            var isEvt = b.type === 'event' || b.type === 'live';
            // Rene piller (radius99) som prototypen - ingen generiske emojis.
            // Event vs almindelig boble skelnes via FARVE: event=teal, almindelig=isbla.
            return '<span style="font-size:10.5px;font-weight:700;border-radius:99px;padding:4px 11px;background:' + (isEvt ? 'rgba(46,207,207,0.14);color:#5EEAD4;border:0.5px solid rgba(46,207,207,0.28)' : 'rgba(100,180,230,0.14);color:#CFE6F7;border:0.5px solid rgba(100,180,230,0.28)') + '">' + escHtml(b.name) + '</span>';
          }).join('') +
          (bubbles.length > 5 ? '<span style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.45);padding:4px 6px">+' + (bubbles.length - 5) + '</span>' : '') +
          '</div>';
        sharedEl.style.display = 'block';
      }
    }
    // LinkedIn
    var liBtn = document.getElementById('rp-linkedin-btn');
    if (p.linkedin && !isA) { liBtn.style.display = 'inline-flex'; liBtn.href = p.linkedin.startsWith('http') ? p.linkedin : 'https://' + p.linkedin; }
    else { liBtn.style.display = 'none'; }
    // Save state (fetched in parallel above) — ikon-knap: skift fill, ikke tekst
    var saveBtn = document.getElementById('rp-save-btn');
    saveBtn.dataset.saved = savedCheck ? '1' : '0';
    var saveIcon = document.getElementById('rp-save-icon');
    if (savedCheck) {
      if (saveIcon) saveIcon.setAttribute('fill', 'currentColor');
      saveBtn.style.background = 'rgba(100,180,230,0.2)';
      saveBtn.style.borderColor = 'rgba(100,180,230,0.4)';
      saveBtn.style.color = '#CFE6F7';
    } else {
      if (saveIcon) saveIcon.setAttribute('fill', 'none');
      saveBtn.style.background = 'rgba(255,255,255,0.08)';
      saveBtn.style.borderColor = 'rgba(255,255,255,0.16)';
      saveBtn.style.color = 'rgba(255,255,255,0.85)';
    }
    // Single reveal with FLIP height glide: lock current (skeleton) height,
    // Content is now fully populated in the hidden sheet. Slide it up in its
    // correct final height — nothing resizes after it becomes visible, so no twitch.
    var _rpAv2 = document.getElementById('rp-avatar'); if (_rpAv2) _rpAv2.classList.remove('rp-skel-pulse');
    if (_rpSheet) {
      // inline preview allerede synlig (vist ved aabning)
    }
  } catch(e) {
    var _hpE = document.getElementById('home-preview'); if (_hpE) _hpE.style.display = 'none';
    var _rpAvE = document.getElementById('rp-avatar'); if (_rpAvE) _rpAvE.classList.remove('rp-skel-pulse');
    logError("openRadarPerson", e); errorToast("load", e);
  }
}

function closeRadarPerson() {
  var hp = document.getElementById('home-preview');
  if (hp) hp.style.display = 'none';
}

// Udvid/kollaps inline preview (prototype: toggleMatch)
function toggleHomePreview() {
  var ex = document.getElementById('home-preview-expand');
  var chev = document.getElementById('home-preview-chev');
  if (!ex) return;
  var isOpen = ex.style.display !== 'none';
  ex.style.display = isOpen ? 'none' : 'block';
  if (chev) chev.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
}

function rpMessage() { closeRadarPerson(); closeHomeTray(); setTimeout(function(){ openChat(rpCurrentUserId, 'screen-home'); }, 400); }
var _rpSaveLock = false;
async function rpSaveContact() {
  if (_rpSaveLock) return;
  try {
    if (!rpCurrentUserId) return;
    var btn = document.getElementById('rp-save-btn');
    if (btn && btn.dataset.saved === '1') { showWarningToast(t('toast_already_saved')); return; }
    _rpSaveLock = true;
    if (btn) { btn.disabled = true; }
    var result = await dbActions.saveContact(rpCurrentUserId);
    if (!result.ok) return;
    if (btn) {
      btn.dataset.saved = '1';
      // Skift bookmark-ikon til fyldt + isbla (gemt-tilstand) - IKKE tekst (ikon-knap)
      var svg = document.getElementById('rp-save-icon');
      if (svg) svg.setAttribute('fill', 'currentColor');
      btn.style.background = 'rgba(100,180,230,0.2)';
      btn.style.borderColor = 'rgba(100,180,230,0.4)';
      btn.style.color = '#CFE6F7';
    }
    showSuccessToast(t('toast_saved'));
    loadSavedContacts();
    clearSavedContactIdsCache();
    // Remove from radar cache + re-render immediately
    var savedId = rpCurrentUserId;
    proxAllProfiles = proxAllProfiles.filter(function(p) { return p.id !== savedId; });
    closeRadarPerson();
    if (radarCurrentView === 'map') renderProximityDots(); else renderRadarList();
  } catch(e) { logError("rpSaveContact", e); errorToast("save", e); }
  finally { _rpSaveLock = false; var btn2 = document.getElementById('rp-save-btn'); if (btn2) btn2.disabled = false; }
}
function rpFullProfile() {
  var uid = rpCurrentUserId;
  closeRadarPerson();
  closeHomeTray();
  setTimeout(function() { openPerson(uid, 'screen-home'); }, 350);
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


