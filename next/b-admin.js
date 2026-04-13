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
      el.innerHTML = '<div style="color:rgba(255,255,255,0.25);padding:0.3rem 0">Ingen rapporter</div>';
      return;
    }
    el.innerHTML = data.map(function(r) {
      var reporterName = r.profiles ? r.profiles.name : t('misc_unknown');
      var reportedName = r.reported ? r.reported.name : t('misc_unknown');
      var isBanned = r.reported && r.reported.banned;
      var timeAgo = adminTimeAgo(r.created_at);
      return '<div style="padding:0.4rem 0;border-bottom:1px solid rgba(30,27,46,0.025)">' +
        '<div style="display:flex;justify-content:space-between;align-items:center">' +
        '<div><span style="font-weight:600">' + escHtml(reportedName) + '</span>' +
        (isBanned ? ' <span style="font-size:0.55rem;background:rgba(26,122,138,0.2);color:var(--pink);padding:0.1rem 0.3rem;border-radius:4px">Banned</span>' : '') +
        '<div style="font-size:0.62rem;color:rgba(255,255,255,0.25)">' + escHtml(r.type || 'report') + ' · ' + escHtml(r.reason || t('admin_no_reason')) + ' · ' + timeAgo + '</div>' +
        '<div style="font-size:0.6rem;color:rgba(255,255,255,0.25)">Af: ' + escHtml(reporterName) + '</div></div>' +
        (!isBanned ? '<button class="btn-sm" onclick="adminBanUser(\'' + r.reported_id + '\',\'' + escHtml(reportedName).replace(/'/g,"\\'") + '\')" style="font-size:0.6rem;padding:0.2rem 0.5rem;background:rgba(124,92,252,0.12);color:var(--pink);border:1px solid rgba(26,122,138,0.3);border-radius:6px;flex-shrink:0">Ban</button>' :
        '<button class="btn-sm" onclick="adminUnbanUser(\'' + r.reported_id + '\')" style="font-size:0.6rem;padding:0.2rem 0.5rem;background:rgba(26,158,142,0.15);color:var(--green);border:1px solid rgba(26,158,142,0.3);border-radius:6px;flex-shrink:0">Unban</button>') +
        '</div></div>';
    }).join('');
  } catch(e) { el.innerHTML = '<div style="color:var(--pink)">Fejl: ' + escHtml(e.message) + '</div>'; }
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
      el.innerHTML = '<div style="color:rgba(255,255,255,0.25);padding:0.3rem 0">Ingen bannede brugere</div>';
      return;
    }
    el.innerHTML = data.map(function(p) {
      return '<div style="display:flex;align-items:center;justify-content:space-between;padding:0.35rem 0;border-bottom:1px solid rgba(30,27,46,0.025)">' +
        '<div><span style="font-weight:600">' + escHtml(p.name || t('misc_unknown')) + '</span>' +
        '<div style="font-size:0.6rem;color:rgba(255,255,255,0.25)">' + escHtml(p.email || p.id.slice(0,8)) + '</div></div>' +
        '<button class="btn-sm" onclick="adminUnbanUser(\'' + p.id + '\')" style="font-size:0.6rem;padding:0.2rem 0.5rem;background:rgba(26,158,142,0.15);color:var(--green);border:1px solid rgba(26,158,142,0.3);border-radius:6px">Unban</button>' +
        '</div>';
    }).join('');
  } catch(e) { el.innerHTML = '<div style="color:var(--pink)">Fejl: ' + escHtml(e.message) + '</div>'; }
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
        '<div style="font-size:0.55rem;color:rgba(255,255,255,0.25)" id="dsub-' + id + '"></div>' +
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
        dCard('s-users','user','rgba(100,180,230,0.1)','rgb(100,180,230)', uc, t('admin_users_label'), uNew.count, 'accent') +
        dCard('s-bubbles','bubble','rgba(46,207,207,0.08)','var(--teal)', bc, 'Bobler', bNew.count, 'teal') +
      '</div>' + trayHtml('s1') + '</div>' +
      // Row 2: Medlemskaber + Boble-beskeder
      '<div class="dash-pair"><div class="dash-row">' +
        dCard('s-members','link','rgba(100,180,230,0.1)','rgb(100,180,230)', mc, 'Medlemskaber', mNew.count, 'accent') +
        dCard('s-msgs','chat','rgba(232,121,168,0.08)','var(--pink)', fmtK(bmc), 'Boble-chat', bmNew.count, 'pink') +
      '</div>' + trayHtml('s2') + '</div>' +
      // Row 3: Gemte kontakter + DMs
      '<div class="dash-pair"><div class="dash-row">' +
        dCard('s-saved','bookmark','rgba(46,207,207,0.08)','var(--teal)', sc, 'Forbindelser', sNew.count, 'teal') +
        dCard('s-dms','send','rgba(232,121,168,0.08)','var(--pink)', fmtK(dmc), 'DMs', dmNew.count, 'pink') +
      '</div>' + trayHtml('s3') + '</div>' +
      // Summary: DAU/WAU/MAU + Live/Banned/Views
      '<div style="font-size:0.58rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:rgba(255,255,255,0.25);margin:4px 0 6px">' + icon('target') + ' Aktivitet</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:8px">' +
        _adminMini(ico('fire'), 'DAU', dauRes, 'var(--teal)') +
        _adminMini(ico('fire'), 'WAU', wauRes, 'rgb(100,180,230)') +
        _adminMini(ico('fire'), 'MAU', mauRes, 'var(--pink)') +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">' +
        _adminMini(ico('pin'), 'Live nu', liveRes.count||0, 'var(--teal)') +
        _adminMini(ico('lock'), t('admin_banned_label'), bannedRes.count||0, '#EF4444') +
        _adminMini(ico('eye'), 'Visninger /7d', viewsRes.count||0, 'rgb(100,180,230)') +
      '</div>';

  } catch(e) { el.innerHTML = '<div style="color:var(--pink)">Fejl: ' + escHtml(e.message) + '</div>'; }
  } catch(e) { logError("adminLoadStats", e); }
}

function _adminMini(icoHtml, label, val, color) {
  return '<div style="background:rgba(255,255,255,0.04);border:0.5px solid rgba(255,255,255,0.08);border-radius:10px;padding:8px;text-align:center">' +
    '<div style="color:' + color + ';margin-bottom:2px;display:flex;justify-content:center;font-size:16px;line-height:1">' + icoHtml + '</div>' +
    '<div style="font-size:1rem;font-weight:800;color:' + color + '">' + val + '</div>' +
    '<div style="font-size:0.52rem;color:rgba(255,255,255,0.25);font-weight:600;text-transform:uppercase">' + label + '</div></div>';
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
  if (titleEl) titleEl.innerHTML = (meta.icon ? '<span style="vertical-align:middle;margin-right:4px;font-size:12px;line-height:1">' + ico(meta.icon) + '</span>' : '') + escHtml(meta.title || '');
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
          '<button style="font-size:0.65rem;padding:0.2rem 0.5rem;background:rgba(124,92,252,0.12);color:var(--pink);border:1px solid rgba(26,122,138,0.3);border-radius:6px;cursor:pointer;font-family:inherit;font-weight:600" onclick="adminConfirmBan()">Ban</button>' +
          '<button style="font-size:0.65rem;padding:0.2rem 0.5rem;background:none;color:rgba(255,255,255,0.25);border:1px solid var(--glass-border);border-radius:6px;cursor:pointer;font-family:inherit" onclick="adminCancelBan(this)">Annuller</button>' +
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
        el.innerHTML = '<div style="font-size:0.68rem;color:rgba(255,255,255,0.25);padding:0.3rem 0">Ingen resultater</div>';
        return;
      }
      el.innerHTML = data.map(function(p) {
        var isBanned = p.banned;
        return '<div style="display:flex;align-items:center;justify-content:space-between;padding:0.35rem 0;border-bottom:1px solid rgba(30,27,46,0.025)">' +
          '<div style="flex:1;min-width:0">' +
          '<div style="font-size:0.75rem;font-weight:600">' + escHtml(p.name || t('misc_unknown')) +
          (isBanned ? ' <span style="font-size:0.55rem;background:rgba(26,122,138,0.2);color:var(--pink);padding:0.1rem 0.3rem;border-radius:4px">Banned</span>' : '') + '</div>' +
          '<div style="font-size:0.6rem;color:rgba(255,255,255,0.25)">' + escHtml(p.title || '') + ' · ' + escHtml(p.email || p.id.slice(0,8)) + '</div>' +
          '</div>' +
          (!isBanned ?
            '<button class="btn-sm" onclick="adminBanUser(\'' + p.id + '\',\'' + escHtml(p.name||'').replace(/'/g,"\\'") + '\')" style="font-size:0.6rem;padding:0.2rem 0.5rem;background:rgba(124,92,252,0.12);color:var(--pink);border:1px solid rgba(26,122,138,0.3);border-radius:6px;flex-shrink:0">Ban</button>' :
            '<button class="btn-sm" onclick="adminUnbanUser(\'' + p.id + '\')" style="font-size:0.6rem;padding:0.2rem 0.5rem;background:rgba(26,158,142,0.15);color:var(--green);border:1px solid rgba(26,158,142,0.3);border-radius:6px;flex-shrink:0">Unban</button>') +
          '</div>';
      }).join('');
    } catch(e) { el.innerHTML = '<div style="color:var(--pink);font-size:0.68rem">Fejl: ' + escHtml(e.message) + '</div>'; }
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
        showWarningToast(t('admin_no_events'));
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

// ══════════════════════════════════════════════════════════
//  ADMIN DEBUG PANEL — FAB + overlay + realtime error badge
//  Only renders for admin users (isAdmin())
// ══════════════════════════════════════════════════════════
var _debugErrorCount = 0;
var _debugErrors = [];
var _debugChannel = null;
var _debugOverlayOpen = false;

function initAdminDebug() {
  if (!isAdmin()) return;
  _renderDebugFab();
  _debugSubscribeErrors();
  _debugLoadRecent();
}

function _renderDebugFab() {
  if (document.getElementById('admin-debug-fab')) return;
  var fab = document.createElement('div');
  fab.id = 'admin-debug-fab';
  fab.className = 'debug-fab';
  fab.onclick = toggleDebugOverlay;
  fab.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4m-10-10h4m12 0h4"/></svg><span class="debug-fab-badge" id="debug-fab-badge" style="display:none">0</span>';
  document.body.appendChild(fab);
}

function _debugSubscribeErrors() {
  if (_debugChannel) return;
  _debugChannel = sb.channel('admin-debug-errors')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'error_log' }, function(payload) {
      var row = payload.new;
      _debugErrors.unshift(row);
      if (_debugErrors.length > 50) _debugErrors.pop();
      _debugErrorCount++;
      _updateDebugBadge();
      if (_debugOverlayOpen) _renderDebugErrorList();
    })
    .subscribe();
}

function _debugLoadRecent() {
  sb.from('error_log').select('*').order('created_at', { ascending: false }).limit(30)
    .then(function(res) {
      _debugErrors = res.data || [];
      _updateDebugBadge();
    });
}

function _updateDebugBadge() {
  var badge = document.getElementById('debug-fab-badge');
  if (!badge) return;
  if (_debugErrorCount > 0) {
    badge.textContent = _debugErrorCount > 99 ? '99+' : _debugErrorCount;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

function toggleDebugOverlay() {
  var overlay = document.getElementById('debug-overlay');
  if (!overlay) return;
  _debugOverlayOpen = !_debugOverlayOpen;
  if (_debugOverlayOpen) {
    _renderDebugContent();
    overlay.classList.add('open');
  } else {
    overlay.classList.remove('open');
  }
}

function closeDebugOverlay() {
  _debugOverlayOpen = false;
  var overlay = document.getElementById('debug-overlay');
  if (overlay) overlay.classList.remove('open');
}

function _renderDebugContent() {
  var cs = getClientState();
  var deviceEl = document.getElementById('debug-device-info');
  if (deviceEl) {
    var rtSummary = Object.keys(cs.rt);
    var rtOk = rtSummary.filter(function(k) { return cs.rt[k] === 'SUBSCRIBED'; }).length;
    deviceEl.innerHTML =
      _debugRow('Version', cs.v) +
      _debugRow('SW', cs.sw === 'active' ? '<span class="debug-pill-ok">synced</span>' : '<span class="debug-pill-err">' + cs.sw + '</span>') +
      _debugRow('Push', cs.push === 'granted' ? '<span class="debug-pill-ok">active</span>' : '<span class="debug-pill-err">' + cs.push + '</span>') +
      _debugRow('Online', cs.online ? 'Ja' : '<span class="debug-pill-err">Offline</span>') +
      _debugRow('Uptime', _fmtUptime(cs.uptime));
  }
  // Navigation / app state
  var stateEl = document.getElementById('debug-state-info');
  if (stateEl) {
    var flowKeys = Object.keys(cs.flows);
    var flowHtml = flowKeys.length > 0
      ? flowKeys.map(function(k) { return '<span class="debug-pill-err">' + k + '</span>'; }).join(' ')
      : '<span style="color:rgba(255,255,255,0.25)">ingen</span>';
    var stackHtml = cs.navStack.length > 0 ? cs.navStack.slice(-3).join(' → ') : '-';
    var html =
      _debugRow('Screen', _debugMono(cs.screen || '-')) +
      _debugRow('Overlay', _debugMono(cs.overlay || '-')) +
      _debugRow('Modal', _debugMono(cs.modal || '-')) +
      _debugRow('Nav stack', '<span style="font-size:0.58rem">' + escHtml(stackHtml) + '</span>') +
      _debugRow('Mode', cs.mode + (cs.live ? ':' + cs.live.substring(0, 8) : '')) +
      _debugRow('Checkins', cs.checkins);
    // Chat context (only show if active)
    if (cs.chatUser || cs.bcId) {
      html += '<div style="border-top:1px solid rgba(0,0,0,0.04);margin:4px 0"></div>';
      if (cs.chatUser) html += _debugRow('DM', _debugMono(cs.chatUser.substring(0, 12)) + (cs.chatName ? ' · ' + escHtml(cs.chatName) : ''));
      if (cs.bcId) html += _debugRow('Boble chat', _debugMono(cs.bcId.substring(0, 12)) + (cs.bcName ? ' · ' + escHtml(cs.bcName) : ''));
      if (cs.personSheet) html += _debugRow('Person sheet', _debugMono(cs.personSheet.substring(0, 12)));
    }
    // Realtime
    html += '<div style="border-top:1px solid rgba(0,0,0,0.04);margin:4px 0"></div>';
    html += _debugRow('RT kanaler', '<span class="debug-pill-' + (rtOk === rtSummary.length ? 'ok' : 'err') + '">' + rtOk + '/' + rtSummary.length + '</span>');
    if (cs.rtRetry > 0) html += _debugRow('RT retry', '<span class="debug-pill-err">' + cs.rtRetry + '</span>');
    // Flow flags
    html += _debugRow('Flow flags', flowHtml);
    stateEl.innerHTML = html;
  }
  _renderDebugErrorList();
}

function _renderDebugErrorList() {
  var el = document.getElementById('debug-error-list');
  if (!el) return;
  if (_debugErrors.length === 0) {
    el.innerHTML = '<div style="text-align:center;color:rgba(255,255,255,0.25);font-size:0.72rem;padding:1rem 0">Ingen fejl</div>';
    return;
  }
  el.innerHTML = _debugErrors.slice(0, 30).map(function(e) {
    var extra = null;
    try { extra = typeof e.extra === 'string' ? JSON.parse(e.extra) : e.extra; } catch(x) { /* */ }
    var cs2 = extra && extra._cs ? extra._cs : null;
    var time = e.created_at ? new Date(e.created_at).toLocaleTimeString(_locale(), { hour: '2-digit', minute: '2-digit' }) : '?';
    var severity = (e.context || '').includes('global') || (e.context || '').includes('promise') ? 'err' : 'warn';
    var html = '<div class="debug-err-card debug-err-' + severity + '">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center"><span style="font-weight:700">' + escHtml(e.context || '?') + '</span><span>' + time + '</span></div>';
    html += '<div style="font-size:0.6rem;margin-top:2px;opacity:0.85">' + escHtml((e.message || '').substring(0, 80)) + '</div>';
    if (cs2) {
      html += '<div style="font-size:0.55rem;margin-top:3px;opacity:0.7">' +
        escHtml((e.user_id || '').substring(0, 8) + '.. | ' + (cs2.ua || '?')) + '</div>';
      if (cs2.rt) {
        var rtParts = Object.keys(cs2.rt).map(function(k) {
          var v = cs2.rt[k];
          return v === 'SUBSCRIBED' ? k + ':ok' : '<span style="font-weight:700">' + k + ':' + (v || '?') + '</span>';
        });
        html += '<div style="font-size:0.55rem;margin-top:1px;opacity:0.7">RT: ' + rtParts.join(' ') + '</div>';
      }
    }
    html += '</div>';
    return html;
  }).join('');
}

function clearDebugBadge() {
  _debugErrorCount = 0;
  _updateDebugBadge();
}

function _debugRow(label, value) {
  return '<div class="debug-row"><span class="debug-k">' + label + '</span><span class="debug-v">' + value + '</span></div>';
}

function _debugMono(val) {
  return '<code style="font-size:0.58rem;background:rgba(0,0,0,0.04);padding:1px 4px;border-radius:3px">' + escHtml(val) + '</code>';
}

function _fmtUptime(sec) {
  if (sec < 60) return sec + 's';
  if (sec < 3600) return Math.floor(sec / 60) + 'm ' + (sec % 60) + 's';
  return Math.floor(sec / 3600) + 'h ' + Math.floor((sec % 3600) / 60) + 'm';
}

// ── Export debug log via EmailJS ──
function debugExportEmail() {
  var cs = getClientState();
  var rtOk = Object.keys(cs.rt).filter(function(k) { return cs.rt[k] === 'SUBSCRIBED'; }).length;
  var rtTotal = Object.keys(cs.rt).length;
  var lines = [];
  lines.push('=== Bubble Debug Export ===');
  lines.push('Time: ' + new Date().toISOString());
  lines.push('Admin: ' + cs.v + ' | SW:' + cs.sw + ' | RT:' + rtOk + '/' + rtTotal);
  lines.push('Mode: ' + cs.mode + (cs.live ? ':' + cs.live : '') + ' | Checkins: ' + cs.checkins);
  lines.push('Push: ' + cs.push + ' | Online: ' + cs.online + ' | Uptime: ' + _fmtUptime(cs.uptime));
  lines.push('');
  lines.push('--- App state ---');
  lines.push('Screen: ' + (cs.screen || '-') + ' | Overlay: ' + (cs.overlay || '-') + ' | Modal: ' + (cs.modal || '-'));
  lines.push('Nav stack: ' + (cs.navStack.length > 0 ? cs.navStack.join(' > ') : '-'));
  if (cs.chatUser) lines.push('DM: ' + cs.chatUser.substring(0, 12) + ' (' + (cs.chatName || '?') + ')');
  if (cs.bcId) lines.push('Boble chat: ' + cs.bcId.substring(0, 12) + ' (' + (cs.bcName || '?') + ')');
  if (cs.personSheet) lines.push('Person sheet: ' + cs.personSheet.substring(0, 12));
  var flowKeys = Object.keys(cs.flows);
  if (flowKeys.length > 0) lines.push('Flow flags: ' + flowKeys.join(', '));
  if (cs.rtRetry > 0) lines.push('RT retry attempts: ' + cs.rtRetry);
  lines.push('');
  lines.push('--- Errors (' + _debugErrors.length + ') ---');

  _debugErrors.slice(0, 30).forEach(function(e) {
    var extra2 = null;
    try { extra2 = typeof e.extra === 'string' ? JSON.parse(e.extra) : e.extra; } catch(x) { /* */ }
    var cs3 = extra2 && extra2._cs ? extra2._cs : null;
    var time = e.created_at ? new Date(e.created_at).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '?';
    lines.push(time + ' ' + (e.context || '?'));
    lines.push('  msg: ' + (e.message || '').substring(0, 120));
    if (e.user_id) lines.push('  user: ' + e.user_id.substring(0, 12) + '..');
    if (cs3) {
      lines.push('  device: ' + (cs3.ua || '?') + ' | ' + (cs3.v || '?'));
      lines.push('  mode: ' + (cs3.mode || '?') + (cs3.live ? ':' + cs3.live.substring(0, 8) : '') + ' screen: ' + (cs3.screen || '?'));
      if (cs3.rt) {
        var rtLine = Object.keys(cs3.rt).map(function(k) { return k + ':' + cs3.rt[k]; }).join(' ');
        lines.push('  rt: ' + rtLine);
      }
      lines.push('  push: ' + (cs3.push || '?') + ' | online: ' + cs3.online);
    }
    lines.push('');
  });

  var body = lines.join('\n');

  // Copy to clipboard as backup
  if (navigator.clipboard) {
    navigator.clipboard.writeText(body).catch(function() {});
  }

  // Send via EmailJS
  if (_emailjsLoaded && window.emailjs) {
    window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
      context: 'DEBUG_EXPORT',
      message: 'Debug log eksporteret (' + _debugErrors.length + ' fejl)',
      stack: body,
      extra: 'Admin: ' + (currentUser?.id || '?'),
      user_id: currentUser?.id || 'unknown',
      timestamp: new Date().toISOString()
    }).then(function() {
      showSuccessToast(t('debug_email_sent'));
    }).catch(function(err) {
      showWarningToast(t('debug_email_failed'));
      console.error('EmailJS debug export failed', err);
    });
  } else {
    // Fallback: just clipboard
    showSuccessToast(t('debug_copied'));
  }
}
