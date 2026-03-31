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
    // Parallel count queries
    var d30 = new Date(Date.now() - 30*24*3600000).toISOString();
    var d7 = new Date(Date.now() - 7*24*3600000).toISOString();
    var d1 = new Date(Date.now() - 24*3600000).toISOString();
    var liveExpiry = new Date(Date.now() - 4*3600000).toISOString();

    var [userRes, bubbleRes, memberRes, dmRes, bmsgRes, savedRes,
         uNew, bNew, mNew, dmNew, bmNew, sNew,
         bannedRes, liveRes, viewsRes] = await Promise.all([
      sb.from('profiles').select('*', { count: 'exact', head: true }),
      sb.from('bubbles').select('*', { count: 'exact', head: true }),
      sb.from('bubble_members').select('*', { count: 'exact', head: true }),
      sb.from('messages').select('*', { count: 'exact', head: true }),
      sb.from('bubble_messages').select('*', { count: 'exact', head: true }),
      sb.from('saved_contacts').select('*', { count: 'exact', head: true }),
      sb.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', d30),
      sb.from('bubbles').select('*', { count: 'exact', head: true }).gte('created_at', d30),
      sb.from('bubble_members').select('*', { count: 'exact', head: true }).gte('created_at', d30),
      sb.from('messages').select('*', { count: 'exact', head: true }).gte('created_at', d30),
      sb.from('bubble_messages').select('*', { count: 'exact', head: true }).gte('created_at', d30),
      sb.from('saved_contacts').select('*', { count: 'exact', head: true }).gte('created_at', d30),
      sb.from('profiles').select('*', { count: 'exact', head: true }).eq('banned', true),
      sb.from('bubble_members').select('*', { count: 'exact', head: true }).gt('last_active', liveExpiry),
      sb.from('profile_views').select('*', { count: 'exact', head: true }).gte('created_at', d7)
    ]);

    var uc = userRes.count||0, bc = bubbleRes.count||0, mc = memberRes.count||0;
    var dmc = dmRes.count||0, bmc = bmsgRes.count||0, sc = savedRes.count||0;
    var fmtK = function(n) { return n > 999 ? (n/1000).toFixed(1)+'K' : n; };

    function dCard(id, iconName, icoBg, icoCol, val, label, delta, color) {
      return '<div class="dash-card" data-color="' + color + '" onclick="dashToggle(this,\'' + id + '\',this.closest(\'.dash-pair\').querySelector(\'.dash-tray\').id)">' +
        '<div class="dash-ico" style="background:' + icoBg + ';color:' + icoCol + '">' + ico(iconName) + '</div>' +
        '<div><div class="dash-val">' + val + '</div><div class="dash-label">' + label + '</div>' +
        (delta ? '<div class="dash-delta">+' + delta + ' denne md.</div>' : '') + '</div></div>';
    }
    function trayHtml(id) {
      return '<div class="dash-tray" id="dtray-' + id + '"><div class="dash-tray-collapse"><div class="dash-tray-inner" id="dti-' + id + '">' +
        '<div style="font-size:0.72rem;font-weight:700" id="dtitle-' + id + '"></div>' +
        '<div style="font-size:0.55rem;color:var(--muted)" id="dsub-' + id + '"></div>' +
        '<div class="dash-chart-wrap"><canvas id="dcv-' + id + '"></canvas></div></div></div></div>';
    }

    // DAU/WAU/MAU (quick inline)
    var [dauRes, wauRes, mauRes] = await Promise.all([
      sb.from('analytics').select('user_id').eq('event_type','app_open').gte('created_at',d1).then(function(r){return new Set((r.data||[]).map(function(a){return a.user_id})).size}).catch(function(){return 0}),
      sb.from('analytics').select('user_id').eq('event_type','app_open').gte('created_at',d7).then(function(r){return new Set((r.data||[]).map(function(a){return a.user_id})).size}).catch(function(){return 0}),
      sb.from('analytics').select('user_id').eq('event_type','app_open').gte('created_at',d30).then(function(r){return new Set((r.data||[]).map(function(a){return a.user_id})).size}).catch(function(){return 0})
    ]);

    el.innerHTML =
      // Row 1: Brugere + Bobler
      '<div class="dash-pair"><div class="dash-row">' +
        dCard('s-users','user','rgba(124,92,252,0.08)','var(--accent)', uc, 'Brugere', uNew.count, 'accent') +
        dCard('s-bubbles','bubble','rgba(46,207,207,0.08)','var(--teal)', bc, 'Bobler', bNew.count, 'teal') +
      '</div>' + trayHtml('s1') + '</div>' +
      // Row 2: Medlemskaber + Boble-beskeder
      '<div class="dash-pair"><div class="dash-row">' +
        dCard('s-members','link','rgba(124,92,252,0.08)','var(--accent)', mc, 'Medlemskaber', mNew.count, 'accent') +
        dCard('s-msgs','chat','rgba(232,121,168,0.08)','var(--pink)', fmtK(bmc), 'Boble-chat', bmNew.count, 'pink') +
      '</div>' + trayHtml('s2') + '</div>' +
      // Row 3: Gemte kontakter + DMs
      '<div class="dash-pair"><div class="dash-row">' +
        dCard('s-saved','bookmark','rgba(46,207,207,0.08)','var(--teal)', sc, 'Forbindelser', sNew.count, 'teal') +
        dCard('s-dms','send','rgba(232,121,168,0.08)','var(--pink)', fmtK(dmc), 'DMs', dmNew.count, 'pink') +
      '</div>' + trayHtml('s3') + '</div>' +
      // Summary: DAU/WAU/MAU + Live/Banned/Views
      '<div style="font-size:0.58rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--muted);margin:4px 0 6px">' + icon('target') + ' Aktivitet</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:8px">' +
        _adminMini(ico('fire'), 'DAU', dauRes, 'var(--teal)') +
        _adminMini(ico('fire'), 'WAU', wauRes, 'var(--accent)') +
        _adminMini(ico('fire'), 'MAU', mauRes, 'var(--pink)') +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">' +
        _adminMini(ico('pin'), 'Live nu', liveRes.count||0, 'var(--teal)') +
        _adminMini(ico('lock'), 'Bannede', bannedRes.count||0, '#EF4444') +
        _adminMini(ico('eye'), 'Visninger /7d', viewsRes.count||0, 'var(--accent)') +
      '</div>';

  } catch(e) { el.innerHTML = '<div style="color:var(--accent2)">Fejl: ' + escHtml(e.message) + '</div>'; }
  } catch(e) { logError("adminLoadStats", e); }
}

function _adminMini(icoHtml, label, val, color) {
  return '<div style="background:rgba(30,27,46,0.02);border:1px solid var(--border);border-radius:10px;padding:8px;text-align:center">' +
    '<div style="color:' + color + ';margin-bottom:2px">' + icoHtml + '</div>' +
    '<div style="font-size:1rem;font-weight:800;color:' + color + '">' + val + '</div>' +
    '<div style="font-size:0.52rem;color:var(--muted);font-weight:600;text-transform:uppercase">' + label + '</div></div>';
}

// ── Dashboard chart helpers ──
var _dashChartInstances = {};
var _dashChartData = {};
var _dashActiveChart = {};

var _dashMeta = {
  's-users': { title: 'Nye brugere', sub: 'Tilmeldinger per uge', table: 'profiles', field: 'created_at', type: 'bar', icon: 'user' },
  's-bubbles': { title: 'Bobler oprettet', sub: 'Netværk + events per uge', table: 'bubbles', field: 'created_at', type: 'bar', icon: 'bubble' },
  's-members': { title: 'Medlemskaber', sub: 'Kumulativ vækst over tid', table: 'bubble_members', field: 'created_at', type: 'line', icon: 'link' },
  's-msgs': { title: 'Boble-chat', sub: 'Beskeder per uge', table: 'bubble_messages', field: 'created_at', type: 'bar', icon: 'chat' },
  's-saved': { title: 'Forbindelser', sub: 'Gemte kontakter per uge', table: 'saved_contacts', field: 'created_at', type: 'bar', icon: 'bookmark' },
  's-dms': { title: 'DMs', sub: 'Direkte beskeder per uge', table: 'messages', field: 'created_at', type: 'bar', icon: 'send' }
};

var _dashColors = {
  accent: { solid: '#7C5CFC', bg: 'rgba(124,92,252,0.08)' },
  teal: { solid: '#1A9E8E', bg: 'rgba(46,207,207,0.08)' },
  pink: { solid: '#E879A8', bg: 'rgba(232,121,168,0.08)' }
};

async function dashToggle(card, chartId, trayId) {
  var tray = document.getElementById(trayId);
  var row = card.closest('.dash-row');
  if (!tray || !row) return;
  var wasActive = card.classList.contains('active-dash');
  row.querySelectorAll('.dash-card').forEach(function(c) { c.classList.remove('active-dash'); });
  if (wasActive) { tray.classList.remove('open'); _dashActiveChart[trayId] = null; return; }
  card.classList.add('active-dash');
  _dashActiveChart[trayId] = chartId;
  var color = card.dataset.color || 'accent';
  var inner = tray.querySelector('.dash-tray-inner');
  if (inner) { inner.className = 'dash-tray-inner dtray-' + color; }
  var meta = _dashMeta[chartId] || {};
  var titleEl = tray.querySelector('[id^="dtitle"]');
  var subEl = tray.querySelector('[id^="dsub"]');
  if (titleEl) titleEl.innerHTML = (meta.icon ? '<span style="vertical-align:middle;margin-right:4px">' + ico(meta.icon) + '</span>' : '') + escHtml(meta.title || '');
  if (subEl) subEl.textContent = meta.sub || '';
  tray.classList.add('open');
  // Destroy old chart
  var cvId = tray.querySelector('canvas').id;
  if (_dashChartInstances[cvId]) { _dashChartInstances[cvId].destroy(); _dashChartInstances[cvId] = null; }
  // Fetch data if not cached
  if (!_dashChartData[chartId]) {
    try {
      var cutoff = new Date(Date.now() - 90 * 24 * 3600000).toISOString();
      var q = sb.from(meta.table).select(meta.field).gte(meta.field, cutoff).order(meta.field, { ascending: true });
      if (meta.filter) q = q.in('bubble_id', meta.filter);
      var { data } = await q;
      _dashChartData[chartId] = _dashBucketWeeks(data || [], meta.field);
    } catch(e) { _dashChartData[chartId] = { labels: [], values: [] }; }
  }
  setTimeout(function() { _dashRenderChart(cvId, chartId, color); }, 120);
}

function _dashBucketWeeks(rows, field) {
  var buckets = {};
  rows.forEach(function(r) {
    var d = new Date(r[field]);
    var weekStart = new Date(d);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
    var key = weekStart.toISOString().slice(0, 10);
    buckets[key] = (buckets[key] || 0) + 1;
  });
  var keys = Object.keys(buckets).sort();
  var labels = keys.map(function(k) {
    var d = new Date(k);
    return d.getDate() + '/' + (d.getMonth() + 1);
  });
  return { labels: labels, values: keys.map(function(k) { return buckets[k]; }) };
}

function _dashRenderChart(canvasId, chartId, color) {
  var el = document.getElementById(canvasId);
  if (!el || typeof Chart === 'undefined') return;
  var d = _dashChartData[chartId] || { labels: [], values: [] };
  var c = _dashColors[color] || _dashColors.accent;
  var meta = _dashMeta[chartId] || {};
  var cfg;
  var baseOpts = {
    responsive: true, maintainAspectRatio: false, animation: { duration: 400 },
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 9 }, color: '#9996A8' } },
      y: { grid: { color: 'rgba(0,0,0,0.03)' }, ticks: { font: { size: 9 }, color: '#9996A8' }, beginAtZero: true }
    }
  };
  if (meta.type === 'line') {
    var cumValues = []; var sum = 0;
    d.values.forEach(function(v) { sum += v; cumValues.push(sum); });
    cfg = { type: 'line', data: { labels: d.labels, datasets: [{ data: cumValues, fill: true, backgroundColor: c.bg, borderColor: c.solid, borderWidth: 2, tension: 0.35, pointRadius: 3, pointBackgroundColor: c.solid }] }, options: baseOpts };
  } else {
    cfg = { type: 'bar', data: { labels: d.labels, datasets: [{ data: d.values, backgroundColor: c.solid, borderRadius: 4, barPercentage: 0.55 }] }, options: baseOpts };
  }
  _dashChartInstances[canvasId] = new Chart(el, cfg);
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
  } catch(e) { _renderToast('Fejl: ' + e.message, 'error'); }
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
  } catch(e) { _renderToast('Fejl: ' + e.message, 'error'); }
}

var _adminSearchTimer = null;
function adminSearchUser(query) {
  clearTimeout(_adminSearchTimer);
  var el = document.getElementById('admin-search-results');
  if (!el) return;
  if (!query || query.length < 2) { el.innerHTML = ''; return; }
  _adminSearchTimer = setTimeout(async function() {
    try {
      // S3: Sanitize query — remove characters that could alter PostgREST filter
      var safeQ = query.replace(/[%,().'"\\\s]/g, '');
      if (!safeQ) { el.innerHTML = ''; return; }
      var { data } = await sb.from('profiles').select('id, name, email, banned, title')
        .or('name.ilike.%' + safeQ + '%,email.ilike.%' + safeQ + '%')
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
  if (!currentUser) { _renderToast('Ikke logget ind', 'error'); return; }
  if (!isAdmin()) { showWarningToast('Kun admin kan bruge test-tools'); return; }

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
        showWarningToast('Du har ingen QR-token. Åbn "Min QR" først.');
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
        showWarningToast('Ingen events fundet');
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
    _renderToast('Fejl: ' + (e.message || 'ukendt'), 'error');
  }
}
