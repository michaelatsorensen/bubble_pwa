// ══════════════════════════════════════════════════════════
//  BUBBLE — ADMIN PANEL
//  DOMAIN: admin
//  OWNS: isAdmin, adminLoadStats, adminLoadReports, adminLoadBanned
//  READS: currentUser, currentProfile (role check)
//  Auto-split from app.js · v3.7.0
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
//  ADMIN PANEL
// ══════════════════════════════════════════════════════════
// Admin check — uses DB role instead of hardcoded UID
function isAdmin() { return currentProfile && currentProfile.role === 'admin'; }

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
      return '<div style="padding:0.4rem 0;border-bottom:1px solid rgba(30,27,46,0.025)">' +
        '<div style="display:flex;justify-content:space-between;align-items:center">' +
        '<div><span style="font-weight:600">' + escHtml(reportedName) + '</span>' +
        (isBanned ? ' <span style="font-size:0.55rem;background:rgba(26,122,138,0.2);color:var(--accent2);padding:0.1rem 0.3rem;border-radius:4px">Banned</span>' : '') +
        '<div style="font-size:0.62rem;color:var(--muted)">' + escHtml(r.type || 'report') + ' · ' + escHtml(r.reason || 'Ingen grund') + ' · ' + timeAgo + '</div>' +
        '<div style="font-size:0.6rem;color:var(--muted)">Af: ' + escHtml(reporterName) + '</div></div>' +
        (!isBanned ? '<button class="btn-sm" onclick="adminBanUser(\'' + r.reported_id + '\',\'' + escHtml(reportedName).replace(/'/g,"\\'") + '\')" style="font-size:0.6rem;padding:0.2rem 0.5rem;background:rgba(124,92,252,0.12);color:var(--accent2);border:1px solid rgba(26,122,138,0.3);border-radius:6px;flex-shrink:0">Ban</button>' :
        '<button class="btn-sm" onclick="adminUnbanUser(\'' + r.reported_id + '\')" style="font-size:0.6rem;padding:0.2rem 0.5rem;background:rgba(26,158,142,0.15);color:var(--green);border:1px solid rgba(26,158,142,0.3);border-radius:6px;flex-shrink:0">Unban</button>') +
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
      return '<div style="display:flex;align-items:center;justify-content:space-between;padding:0.35rem 0;border-bottom:1px solid rgba(30,27,46,0.025)">' +
        '<div><span style="font-weight:600">' + escHtml(p.name || 'Ukendt') + '</span>' +
        '<div style="font-size:0.6rem;color:var(--muted)">' + escHtml(p.email || p.id.slice(0,8)) + '</div></div>' +
        '<button class="btn-sm" onclick="adminUnbanUser(\'' + p.id + '\')" style="font-size:0.6rem;padding:0.2rem 0.5rem;background:rgba(26,158,142,0.15);color:var(--green);border:1px solid rgba(26,158,142,0.3);border-radius:6px">Unban</button>' +
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

    // ── Activity analytics ──
    var now = new Date();
    var day1 = new Date(now - 24*3600000).toISOString();
    var day7 = new Date(now - 7*24*3600000).toISOString();
    var day30 = new Date(now - 30*24*3600000).toISOString();

    var [dauRes, wauRes, mauRes, viewsRes, connectionsRes, bcMsgRes, analyticsRes] = await Promise.all([
      sb.from('analytics').select('user_id', { count: 'exact', head: false }).eq('event_type', 'app_open').gte('created_at', day1).then(function(r) { return new Set((r.data||[]).map(function(a){return a.user_id;})).size; }).catch(function(){return 0;}),
      sb.from('analytics').select('user_id', { count: 'exact', head: false }).eq('event_type', 'app_open').gte('created_at', day7).then(function(r) { return new Set((r.data||[]).map(function(a){return a.user_id;})).size; }).catch(function(){return 0;}),
      sb.from('analytics').select('user_id', { count: 'exact', head: false }).eq('event_type', 'app_open').gte('created_at', day30).then(function(r) { return new Set((r.data||[]).map(function(a){return a.user_id;})).size; }).catch(function(){return 0;}),
      sb.from('profile_views').select('*', { count: 'exact', head: true }).gte('created_at', day7).then(function(r){return r;}).catch(function(){return {count:0};}),
      sb.from('saved_contacts').select('*', { count: 'exact', head: true }).gte('created_at', day7).then(function(r){return r;}).catch(function(){return {count:0};}),
      sb.from('bubble_messages').select('*', { count: 'exact', head: true }).gte('created_at', day7).then(function(r){return r;}).catch(function(){return {count:0};}),
      sb.from('analytics').select('event_type').gte('created_at', day7).then(function(r) { return r.data || []; }).catch(function(){return [];})
    ]);

    // Feature heatmap
    var featureCount = {};
    analyticsRes.forEach(function(a) { featureCount[a.event_type] = (featureCount[a.event_type] || 0) + 1; });
    var featureList = Object.entries(featureCount).sort(function(a,b){return b[1]-a[1];}).slice(0,8);
    var featureHtml = featureList.map(function(f) {
      var maxVal = featureList[0] ? featureList[0][1] : 1;
      var pct = Math.round((f[1]/maxVal)*100);
      return '<div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:0.2rem">' +
        '<div style="width:100px;font-size:0.62rem;color:var(--text-secondary);text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escHtml(f[0]) + '</div>' +
        '<div style="flex:1;height:12px;background:var(--glass-bg-strong);border-radius:4px;overflow:hidden"><div style="height:100%;width:'+pct+'%;background:var(--gradient-primary);border-radius:4px"></div></div>' +
        '<div style="width:24px;font-size:0.62rem;font-weight:700;color:var(--accent);text-align:right">' + f[1] + '</div></div>';
    }).join('');

    el.innerHTML = '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.3rem">' +
      adminStatCard('Brugere', userCount || 0, '#7C5CFC', 'Antal registrerede profiler.') +
      adminStatCard('Live nu', liveCount || 0, '#1A9E8E', 'Checked ind inden for de sidste 4 timer.') +
      adminStatCard('Bannede', bannedCount || 0, '#3B82F6', 'Bannede brugere.') +
      '</div>' +
      '<div style="font-size:0.58rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--accent);margin:0.6rem 0 0.3rem">Aktivitet</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.3rem">' +
      adminStatCard('DAU', dauRes, '#1A9E8E', 'Unikke brugere der åbnede appen de seneste 24 timer.') +
      adminStatCard('WAU', wauRes, '#2ECFCF', 'Unikke brugere de seneste 7 dage.') +
      adminStatCard('MAU', mauRes, '#7C5CFC', 'Unikke brugere de seneste 30 dage.') +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.3rem;margin-top:0.3rem">' +
      adminStatCard('Visninger /7d', viewsRes.count || 0, '#E879A8', 'Profilvisninger de seneste 7 dage.') +
      adminStatCard('Connections /7d', connectionsRes.count || 0, '#1A9E8E', 'Nye gemte kontakter de seneste 7 dage.') +
      adminStatCard('Boble-msg /7d', bcMsgRes.count || 0, '#7C5CFC', 'Boble-chat beskeder de seneste 7 dage.') +
      '</div>' +
      '<div style="font-size:0.58rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--accent);margin:0.6rem 0 0.3rem">Feature-brug (7 dage)</div>' +
      '<div style="background:#FFFFFF;border:1px solid var(--glass-border-subtle);border-radius:var(--radius);padding:0.6rem 0.75rem;box-shadow:0 1px 3px rgba(30,27,46,0.06)">' + (featureHtml || '<div style="font-size:0.72rem;color:var(--muted)">Ingen analytics data</div>') + '</div>' +
      '<div style="font-size:0.58rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--accent);margin:0.6rem 0 0.3rem">System</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.3rem">' +
      adminStatCard('Bobler', bubbleCount || 0, '#2ECFCF', 'Samlet antal bobler.') +
      adminStatCard('Offentlige', publicBubbles || 0, '#2ECFCF', 'Synlige for alle.') +
      adminStatCard('Private', (privateBubbles||0) + '+' + (hiddenBubbles||0), '#E879A8', 'Private + skjulte.') +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.3rem;margin-top:0.3rem">' +
      adminStatCard('DMs', msgCount || 0, '#7C5CFC', 'Direkte beskeder.') +
      adminStatCard('Medlemskaber', membershipCount || 0, '#2ECFCF', 'Boble-medlemskaber.') +
      adminStatCard('Gemte', savedCount || 0, '#2ECFCF', 'Gemte kontakter.') +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.3rem;margin-top:0.3rem">' +
      adminStatCard('Profiler m/ tags', taggedCount + '/' + (userCount||0), '#F5C35A', 'Profiler med mindst 1 tag.') +
      adminStatCard('Gns. tags', avgTags, '#F5C35A', 'Gennemsnitligt antal tags.') +
      '</div>';
  } catch(e) { el.innerHTML = '<div style="color:var(--accent2)">Fejl: ' + escHtml(e.message) + '</div>'; }
  } catch(e) { logError("adminLoadStats", e); }
}

function adminStatCard(label, count, color, info) {
  var infoAttr = info ? ' onclick="adminShowInfo(this,\'' + escHtml(info).replace(/'/g,"\\'") + '\')" style="cursor:pointer"' : '';
  return '<div style="background:rgba(30,27,46,0.025);border-radius:8px;padding:0.4rem 0.6rem;text-align:center;position:relative"' + infoAttr + '>' +
    (info ? '<div style="position:absolute;top:0.2rem;right:0.3rem;font-size:0.5rem;color:rgba(30,27,46,0.08)">ⓘ</div>' : '') +
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
  tray.style.cssText = 'position:relative;background:rgba(124,92,252,0.08);border:1px solid rgba(124,92,252,0.15);border-radius:8px;padding:0.5rem 0.7rem;margin-top:0.3rem;animation:fadeIn 0.2s ease';
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
        tray.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:0.35rem 0.5rem;margin-top:0.3rem;background:rgba(26,122,138,0.08);border:1px solid rgba(26,122,138,0.2);border-radius:8px;gap:0.4rem';
        tray.innerHTML = '<span style="font-size:0.68rem;color:var(--text-secondary)">Ban ' + escHtml(userName||'bruger') + '?</span>' +
          '<div style="display:flex;gap:0.25rem">' +
          '<button style="font-size:0.65rem;padding:0.2rem 0.5rem;background:rgba(124,92,252,0.12);color:var(--accent2);border:1px solid rgba(26,122,138,0.3);border-radius:6px;cursor:pointer;font-family:inherit;font-weight:600" onclick="adminConfirmBan()">Ban</button>' +
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
        return '<div style="display:flex;align-items:center;justify-content:space-between;padding:0.35rem 0;border-bottom:1px solid rgba(30,27,46,0.025)">' +
          '<div style="flex:1;min-width:0">' +
          '<div style="font-size:0.75rem;font-weight:600">' + escHtml(p.name || 'Ukendt') +
          (isBanned ? ' <span style="font-size:0.55rem;background:rgba(26,122,138,0.2);color:var(--accent2);padding:0.1rem 0.3rem;border-radius:4px">Banned</span>' : '') + '</div>' +
          '<div style="font-size:0.6rem;color:var(--muted)">' + escHtml(p.title || '') + ' · ' + escHtml(p.email || p.id.slice(0,8)) + '</div>' +
          '</div>' +
          (!isBanned ?
            '<button class="btn-sm" onclick="adminBanUser(\'' + p.id + '\',\'' + escHtml(p.name||'').replace(/'/g,"\\'") + '\')" style="font-size:0.6rem;padding:0.2rem 0.5rem;background:rgba(124,92,252,0.12);color:var(--accent2);border:1px solid rgba(26,122,138,0.3);border-radius:6px;flex-shrink:0">Ban</button>' :
            '<button class="btn-sm" onclick="adminUnbanUser(\'' + p.id + '\')" style="font-size:0.6rem;padding:0.2rem 0.5rem;background:rgba(26,158,142,0.15);color:var(--green);border:1px solid rgba(26,158,142,0.3);border-radius:6px;flex-shrink:0">Unban</button>') +
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


// ══════════════════════════════════════════════════════════
//  ONBOARDING TEST TOOLS
// ══════════════════════════════════════════════════════════
var TEST_ACCOUNT_EMAIL = 'test@bubbleme.dk';

async function testOnboardingReset(mode) {
  if (!currentUser) { showToast('Ikke logget ind'); return; }
  if (!isAdmin()) { showToast('Kun admin kan bruge test-tools'); return; }

  try {
    showToast('Nulstiller testkonto...');

    // Call Edge Function to delete/reset test user (requires service_role)
    var { data: session } = await sb.auth.getSession();
    var resp = await fetch(SUPABASE_URL + '/functions/v1/reset-test-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + session.session.access_token,
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ mode: mode, testEmail: TEST_ACCOUNT_EMAIL })
    });
    var result = await resp.json();
    if (!resp.ok || result.error) {
      showToast('Reset fejl: ' + (result.error || 'ukendt'));
      return;
    }

    // Build redirect URL
    var baseUrl = window.location.origin + window.location.pathname;
    var redirectUrl = baseUrl;

    if (mode === 'qr') {
      var { data: adminToken } = await sb.from('qr_tokens')
        .select('token').eq('user_id', currentUser.id)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (adminToken) {
        redirectUrl = baseUrl + '?qrt=' + adminToken.token;
      } else {
        showToast('Du har ingen QR-token. Åbn "Min QR" først.');
        return;
      }
    } else if (mode === 'event') {
      var { data: events } = await sb.from('bubbles')
        .select('id, name').eq('type', 'event')
        .order('created_at', { ascending: false }).limit(5);
      if (events && events.length > 0) {
        var picked = events[0];
        if (events.length > 1) {
          var choices = events.map(function(e, i) { return (i+1) + '. ' + e.name; }).join('\n');
          var pick = prompt('Vælg event:\n' + choices + '\n\nIndtast nummer:');
          if (!pick) return;
          picked = events[parseInt(pick) - 1] || events[0];
        }
        redirectUrl = baseUrl + '?event=' + picked.id;
      } else {
        showToast('Ingen events fundet');
        return;
      }
    }

    // Log out admin → redirect
    await sb.auth.signOut();
    var actionLabel = mode === 'setup'
      ? 'Profil nulstillet. Log ind som ' + TEST_ACCOUNT_EMAIL
      : 'Testkonto slettet. Opret ny som ' + TEST_ACCOUNT_EMAIL;
    showSuccessToast(actionLabel);
    setTimeout(function() { window.location.href = redirectUrl; }, 1200);

  } catch(e) {
    logError('testOnboardingReset', e);
    showToast('Fejl: ' + (e.message || 'ukendt'));
  }
}
