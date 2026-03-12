// ══════════════════════════════════════════════════════════
//  BUBBLE — ADMIN PANEL
//  Auto-split from app.js · v3.7.0
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
//  ADMIN PANEL
// ══════════════════════════════════════════════════════════
var ADMIN_UID = '0015de9c-c128-477a-8110-2cbb38a625f4';

async function adminLoadReports() {
  try {
  var el = document.getElementById('admin-reports-list');
  if (!el) return;
  el.innerHTML = '<div class="spinner"></div>';
  try {
    var { data } = await sb.from('reports')
      .select('id, type, reason, created_at, reporter_id, reported_id, profiles!reports_reporter_id_fkey(name), reported:profiles!reports_reported_id_fkey(name, banned)')
      .order('created_at', { ascending: false }).limit(20);
    if (!data || data.length === 0) {
      el.innerHTML = '<div style="color:var(--muted);padding:0.3rem 0">Ingen rapporter</div>';
      return;
    }
    el.innerHTML = data.map(function(r) {
      var reporterName = r.profiles ? r.profiles.name : 'Ukendt';
      var reportedName = r.reported ? r.reported.name : 'Ukendt';
      var isBanned = r.reported && r.reported.banned;
      var timeAgo = adminTimeAgo(r.created_at);
      return '<div style="padding:0.4rem 0;border-bottom:1px solid rgba(255,255,255,0.03)">' +
        '<div style="display:flex;justify-content:space-between;align-items:center">' +
        '<div><span style="font-weight:600">' + escHtml(reportedName) + '</span>' +
        (isBanned ? ' <span style="font-size:0.55rem;background:rgba(232,93,138,0.2);color:var(--accent2);padding:0.1rem 0.3rem;border-radius:4px">Banned</span>' : '') +
        '<div style="font-size:0.62rem;color:var(--muted)">' + escHtml(r.type || 'report') + ' · ' + escHtml(r.reason || 'Ingen grund') + ' · ' + timeAgo + '</div>' +
        '<div style="font-size:0.6rem;color:var(--muted)">Af: ' + escHtml(reporterName) + '</div></div>' +
        (!isBanned ? '<button class="btn-sm" onclick="adminBanUser(\'' + r.reported_id + '\',\'' + escHtml(reportedName).replace(/'/g,"\\'") + '\')" style="font-size:0.6rem;padding:0.2rem 0.5rem;background:rgba(232,93,138,0.15);color:var(--accent2);border:1px solid rgba(232,93,138,0.3);border-radius:6px;flex-shrink:0">Ban</button>' :
        '<button class="btn-sm" onclick="adminUnbanUser(\'' + r.reported_id + '\')" style="font-size:0.6rem;padding:0.2rem 0.5rem;background:rgba(16,185,129,0.15);color:var(--green);border:1px solid rgba(16,185,129,0.3);border-radius:6px;flex-shrink:0">Unban</button>') +
        '</div></div>';
    }).join('');
  } catch(e) { el.innerHTML = '<div style="color:var(--accent2)">Fejl: ' + escHtml(e.message) + '</div>'; }
  } catch(e) { logError("adminLoadReports", e); }
}

async function adminLoadBanned() {
  try {
  var el = document.getElementById('admin-banned-list');
  if (!el) return;
  el.innerHTML = '<div class="spinner"></div>';
  try {
    var { data } = await sb.from('profiles').select('id, name, email, banned').eq('banned', true).order('name');
    if (!data || data.length === 0) {
      el.innerHTML = '<div style="color:var(--muted);padding:0.3rem 0">Ingen bannede brugere</div>';
      return;
    }
    el.innerHTML = data.map(function(p) {
      return '<div style="display:flex;align-items:center;justify-content:space-between;padding:0.35rem 0;border-bottom:1px solid rgba(255,255,255,0.03)">' +
        '<div><span style="font-weight:600">' + escHtml(p.name || 'Ukendt') + '</span>' +
        '<div style="font-size:0.6rem;color:var(--muted)">' + escHtml(p.email || p.id.slice(0,8)) + '</div></div>' +
        '<button class="btn-sm" onclick="adminUnbanUser(\'' + p.id + '\')" style="font-size:0.6rem;padding:0.2rem 0.5rem;background:rgba(16,185,129,0.15);color:var(--green);border:1px solid rgba(16,185,129,0.3);border-radius:6px">Unban</button>' +
        '</div>';
    }).join('');
  } catch(e) { el.innerHTML = '<div style="color:var(--accent2)">Fejl: ' + escHtml(e.message) + '</div>'; }
  } catch(e) { logError("adminLoadBanned", e); }
}

async function adminLoadStats() {
  try {
  var el = document.getElementById('admin-stats');
  if (!el) return;
  el.innerHTML = '<div class="spinner"></div>';
  try {
    var { count: userCount } = await sb.from('profiles').select('*', { count: 'exact', head: true });
    var { count: bannedCount } = await sb.from('profiles').select('*', { count: 'exact', head: true }).eq('banned', true);
    var { count: bubbleCount } = await sb.from('bubbles').select('*', { count: 'exact', head: true });
    var { count: publicBubbles } = await sb.from('bubbles').select('*', { count: 'exact', head: true }).eq('visibility', 'public');
    var { count: privateBubbles } = await sb.from('bubbles').select('*', { count: 'exact', head: true }).eq('visibility', 'private');
    var { count: hiddenBubbles } = await sb.from('bubbles').select('*', { count: 'exact', head: true }).eq('visibility', 'hidden');
    var { count: msgCount } = await sb.from('messages').select('*', { count: 'exact', head: true });
    var { count: reportCount } = await sb.from('reports').select('*', { count: 'exact', head: true });
    var { count: feedbackCount } = await sb.from('reports').select('*', { count: 'exact', head: true }).eq('type', 'feedback');

    // Live users (checked in within last 4 hours)
    var liveExpiry = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    var { count: liveCount } = await sb.from('bubble_members').select('*', { count: 'exact', head: true }).gt('last_active', liveExpiry);

    // Members total
    var { count: membershipCount } = await sb.from('bubble_members').select('*', { count: 'exact', head: true });

    // Profiles with tags
    var { data: profilesWithTags } = await sb.from('profiles').select('keywords');
    var taggedCount = 0;
    var totalTags = 0;
    if (profilesWithTags) {
      profilesWithTags.forEach(function(p) {
        if (p.keywords && p.keywords.length > 0) { taggedCount++; totalTags += p.keywords.length; }
      });
    }
    var avgTags = taggedCount > 0 ? (totalTags / taggedCount).toFixed(1) : '0';

    // Saved contacts count
    var { count: savedCount } = await sb.from('saved_contacts').select('*', { count: 'exact', head: true });

    el.innerHTML = '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.3rem">' +
      adminStatCard('Brugere', userCount || 0, '#8B7FFF', 'Antal registrerede profiler i Bubble. Inkluderer alle der har oprettet en konto.') +
      adminStatCard('Live nu', liveCount || 0, '#10B981', 'Brugere der er checked ind i en Live Bubble inden for de sidste 4 timer.') +
      adminStatCard('Bannede', bannedCount || 0, '#E85D8A', 'Brugere der er banned via admin panel. De kan ikke logge ind og er usynlige på radar.') +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.3rem;margin-top:0.3rem">' +
      adminStatCard('Bobler', bubbleCount || 0, '#2ECFCF', 'Samlet antal bobler (offentlige + private + skjulte). Inkluderer alle typer.') +
      adminStatCard('Offentlige', publicBubbles || 0, '#2ECFCF', 'Bobler synlige for alle på Opdag-skærmen. Alle kan joine dem.') +
      adminStatCard('Private', (privateBubbles||0) + '+' + (hiddenBubbles||0), '#F97316', 'Private + skjulte bobler. Private kræver invitation. Skjulte er usynlige i Opdag men kan joines via direkte link.') +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.3rem;margin-top:0.3rem">' +
      adminStatCard('Beskeder', msgCount || 0, '#8B7FFF', 'Samlet antal direkte beskeder (DMs) sendt mellem brugere. Inkluderer tekst, GIFs og filer.') +
      adminStatCard('Rapporter', reportCount || 0, '#E85D8A', 'Antal brugerrapporter modtaget. Se detaljer i Rapporterede brugere ovenfor.') +
      adminStatCard('Feedback', feedbackCount || 0, '#38BDF8', 'Antal feedback-beskeder sendt via Giv Feedback knappen på hjem-skærmen.') +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.3rem;margin-top:0.3rem">' +
      adminStatCard('Medlemskaber', membershipCount || 0, '#2ECFCF', 'Samlet antal boble-medlemskaber. Én bruger i 3 bobler = 3 medlemskaber. Viser engagement — jo højere ratio pr. bruger, jo mere aktive er de.') +
      adminStatCard('Gemte kontakter', savedCount || 0, '#A78BFA', 'Antal gange en bruger har gemt en andens profil. Viser hvor meget networking der sker.') +
      adminStatCard('Gns. tags', avgTags, '#10B981', 'Gennemsnitligt antal tags per profil der har tags. Højere = bedre matchkvalitet på radar.') +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.3rem;margin-top:0.3rem">' +
      adminStatCard('Profiler m/ tags', taggedCount + '/' + (userCount||0), '#F5C35A', 'Hvor mange profiler der har mindst 1 tag vs. totalt antal brugere. Profiler uden tags matcher dårligt på radar.') +
      adminStatCard('Tags i alt', totalTags, '#F5C35A', 'Samlet antal tags på tværs af alle profiler. Divideret med profiler m/ tags = gennemsnittet.') +
      '</div>';
  } catch(e) { el.innerHTML = '<div style="color:var(--accent2)">Fejl: ' + escHtml(e.message) + '</div>'; }
  } catch(e) { logError("adminLoadStats", e); }
}

function adminStatCard(label, count, color, info) {
  var infoAttr = info ? ' onclick="adminShowInfo(this,\'' + escHtml(info).replace(/'/g,"\\'") + '\')" style="cursor:pointer"' : '';
  return '<div style="background:rgba(255,255,255,0.03);border-radius:8px;padding:0.4rem 0.6rem;text-align:center;position:relative"' + infoAttr + '>' +
    (info ? '<div style="position:absolute;top:0.2rem;right:0.3rem;font-size:0.5rem;color:rgba(255,255,255,0.15)">ⓘ</div>' : '') +
    '<div style="font-size:1.1rem;font-weight:800;color:' + color + '">' + count + '</div>' +
    '<div style="font-size:0.6rem;color:var(--muted)">' + label + '</div></div>';
}

function adminShowInfo(el, text) {
  // Remove any existing info tray
  var existing = document.querySelector('.admin-info-tray');
  if (existing) existing.remove();
  // Create tray below the card
  var tray = document.createElement('div');
  tray.className = 'admin-info-tray';
  tray.innerHTML = '<div style="font-size:0.68rem;color:var(--text-secondary);line-height:1.4">' + text + '</div>' +
    '<button onclick="this.parentElement.remove()" style="position:absolute;top:0.3rem;right:0.4rem;background:none;border:none;color:var(--muted);font-size:0.7rem;cursor:pointer;font-family:inherit">✕</button>';
  tray.style.cssText = 'position:relative;background:rgba(139,127,255,0.08);border:1px solid rgba(139,127,255,0.15);border-radius:8px;padding:0.5rem 0.7rem;margin-top:0.3rem;animation:fadeIn 0.2s ease';
  // Insert after the stat grid row
  var parent = el.parentElement;
  if (parent) parent.insertAdjacentElement('afterend', tray);
}

var _pendingBanUserId = null;
var _pendingBanUserName = null;

async function adminBanUser(userId, userName) {
  // First click: show confirmation tray in the result row
  if (_pendingBanUserId !== userId) {
    _pendingBanUserId = userId;
    _pendingBanUserName = userName;
    // Find the button and show confirm inline
    var allBtns = document.querySelectorAll('[onclick*="adminBanUser(\'' + userId + '\'"]');
    allBtns.forEach(function(btn) {
      var row = btn.closest('div[style*="padding"]') || btn.parentElement;
      if (row && !row.querySelector('.admin-ban-confirm')) {
        var tray = document.createElement('div');
        tray.className = 'admin-ban-confirm';
        tray.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:0.35rem 0.5rem;margin-top:0.3rem;background:rgba(232,93,138,0.08);border:1px solid rgba(232,93,138,0.2);border-radius:8px;gap:0.4rem';
        tray.innerHTML = '<span style="font-size:0.68rem;color:var(--text-secondary)">Ban ' + escHtml(userName||'bruger') + '?</span>' +
          '<div style="display:flex;gap:0.25rem">' +
          '<button style="font-size:0.65rem;padding:0.2rem 0.5rem;background:rgba(232,93,138,0.15);color:var(--accent2);border:1px solid rgba(232,93,138,0.3);border-radius:6px;cursor:pointer;font-family:inherit;font-weight:600" onclick="adminConfirmBan()">Ban</button>' +
          '<button style="font-size:0.65rem;padding:0.2rem 0.5rem;background:none;color:var(--muted);border:1px solid var(--glass-border);border-radius:6px;cursor:pointer;font-family:inherit" onclick="adminCancelBan(this)">Annuller</button>' +
          '</div>';
        row.appendChild(tray);
      }
    });
    setTimeout(function() { _pendingBanUserId = null; document.querySelectorAll('.admin-ban-confirm').forEach(function(t) { t.remove(); }); }, 5000);
    return;
  }
  await adminConfirmBan();
}

async function adminConfirmBan() {
  var userId = _pendingBanUserId;
  var userName = _pendingBanUserName;
  _pendingBanUserId = null;
  _pendingBanUserName = null;
  document.querySelectorAll('.admin-ban-confirm').forEach(function(t) { t.remove(); });
  if (!userId) return;
  try {
    await sb.from('profiles').update({ banned: true }).eq('id', userId);
    showToast((userName||'Bruger') + ' er banned');
    adminLoadReports();
    adminLoadBanned();
    adminLoadStats();
  } catch(e) { showToast('Fejl: ' + e.message); }
}

function adminCancelBan(btn) {
  _pendingBanUserId = null;
  _pendingBanUserName = null;
  var tray = btn.closest('.admin-ban-confirm');
  if (tray) tray.remove();
}

async function adminUnbanUser(userId) {
  try {
    await sb.from('profiles').update({ banned: false }).eq('id', userId);
    showToast('Bruger unbanned');
    adminLoadReports();
    adminLoadBanned();
    adminLoadStats();
  } catch(e) { showToast('Fejl: ' + e.message); }
}

var _adminSearchTimer = null;
function adminSearchUser(query) {
  clearTimeout(_adminSearchTimer);
  var el = document.getElementById('admin-search-results');
  if (!el) return;
  if (!query || query.length < 2) { el.innerHTML = ''; return; }
  _adminSearchTimer = setTimeout(async function() {
    try {
      var { data } = await sb.from('profiles').select('id, name, email, banned, title')
        .or('name.ilike.%' + query + '%,email.ilike.%' + query + '%')
        .limit(5);
      if (!data || data.length === 0) {
        el.innerHTML = '<div style="font-size:0.68rem;color:var(--muted);padding:0.3rem 0">Ingen resultater</div>';
        return;
      }
      el.innerHTML = data.map(function(p) {
        var isBanned = p.banned;
        return '<div style="display:flex;align-items:center;justify-content:space-between;padding:0.35rem 0;border-bottom:1px solid rgba(255,255,255,0.03)">' +
          '<div style="flex:1;min-width:0">' +
          '<div style="font-size:0.75rem;font-weight:600">' + escHtml(p.name || 'Ukendt') +
          (isBanned ? ' <span style="font-size:0.55rem;background:rgba(232,93,138,0.2);color:var(--accent2);padding:0.1rem 0.3rem;border-radius:4px">Banned</span>' : '') + '</div>' +
          '<div style="font-size:0.6rem;color:var(--muted)">' + escHtml(p.title || '') + ' · ' + escHtml(p.email || p.id.slice(0,8)) + '</div>' +
          '</div>' +
          (!isBanned ?
            '<button class="btn-sm" onclick="adminBanUser(\'' + p.id + '\',\'' + escHtml(p.name||'').replace(/'/g,"\\'") + '\')" style="font-size:0.6rem;padding:0.2rem 0.5rem;background:rgba(232,93,138,0.15);color:var(--accent2);border:1px solid rgba(232,93,138,0.3);border-radius:6px;flex-shrink:0">Ban</button>' :
            '<button class="btn-sm" onclick="adminUnbanUser(\'' + p.id + '\')" style="font-size:0.6rem;padding:0.2rem 0.5rem;background:rgba(16,185,129,0.15);color:var(--green);border:1px solid rgba(16,185,129,0.3);border-radius:6px;flex-shrink:0">Unban</button>') +
          '</div>';
      }).join('');
    } catch(e) { el.innerHTML = '<div style="color:var(--accent2);font-size:0.68rem">Fejl: ' + escHtml(e.message) + '</div>'; }
  }, 300);
}

function adminTimeAgo(dateStr) {
  var diff = Date.now() - new Date(dateStr).getTime();
  var mins = Math.floor(diff / 60000);
  if (mins < 60) return mins + ' min siden';
  var hours = Math.floor(mins / 60);
  if (hours < 24) return hours + ' timer siden';
  var days = Math.floor(hours / 24);
  return days + ' dage siden';
}

