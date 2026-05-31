// ============================================================
//  b-guides.js — "Sådan virker [skærm]" hjælp-sheets
//  Accordion: skimbare titler, udfold for fuld forklaring.
//  Flere kan være åbne samtidigt. Adgangsniveauer = to-tier.
//  Global: showGuide('home'|'bobler'|'dms'|'profil')
// ============================================================

// Line-ikoner til accordion-hoveder (matcher app-stil).
var _GI = {
  radar:'<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>',
  toggle:'<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="7" width="20" height="10" rx="5"/><circle cx="8" cy="12" r="3" fill="currentColor"/></svg>',
  filter:'<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3 5h18M6 12h12M10 19h4"/></svg>',
  person:'<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="8" r="4"/><path d="M5 21v-1a7 7 0 0114 0v1"/></svg>',
  qr:'<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="3" height="3"/></svg>',
  explore:'<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M15 9l-2 5-4 1 2-5z" fill="currentColor" stroke="none"/></svg>',
  join:'<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M15 12H3M11 8l4 4-4 4M21 4v16"/></svg>',
  plus:'<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  chat:'<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M20 11.5c0 4-3.6 7-8 7a9 9 0 01-3.2-.6L4 20l1.3-3.2A7 7 0 014 11.5C4 7.4 7.6 4 12 4s8 3.4 8 7.5z"/></svg>',
  layers:'<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/></svg>',
  send:'<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/></svg>',
  clip:'<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M21 11l-9 9a5 5 0 01-7-7l9-9a3.5 3.5 0 015 5l-9 9a1.5 1.5 0 01-2-2l8-8"/></svg>',
  edit:'<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M11 4H4v16h16v-7"/><path d="M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4z"/></svg>',
  inbox:'<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5 5h14l3 7v6a1 1 0 01-1 1H3a1 1 0 01-1-1v-6z"/></svg>',
  strength:'<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 18v-3M9 18v-7M14 18v-5M19 18V8"/></svg>',
  bookmark:'<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M6 4h12v17l-6-4-6 4z"/></svg>',
  settings:'<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></svg>',
  globe:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#9fe0d4" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18"/></svg>',
  lock:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#cfe6f7" stroke-width="1.6"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg>',
  eye:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#f3c7dc" stroke-width="1.6"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="2.5"/></svg>'
};

var _GUIDE_CHEV = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>';

// Adgangsniveauer (udfoldes under Bobler-punkt 5).
var _GUIDE_ACCESS = [
  { ico: 'globe', tKey: 'guide_access_public_t',  dKey: 'guide_access_public_d' },
  { ico: 'lock',  tKey: 'guide_access_private_t', dKey: 'guide_access_private_d' },
  { ico: 'eye',   tKey: 'guide_access_hidden_t',  dKey: 'guide_access_hidden_d' }
];

// Guide-definitioner. Tekster ligger i i18n (guide_*).
var _GUIDES = {
  home: { icon: 'target', titleKey: 'guide_home_title', subKey: 'guide_home_sub', tipKey: 'guide_home_tip',
    items: [
      { ico: 'radar',  tKey: 'guide_home_1_t', dKey: 'guide_home_1_d' },
      { ico: 'toggle', tKey: 'guide_home_2_t', dKey: 'guide_home_2_d' },
      { ico: 'filter', tKey: 'guide_home_3_t', dKey: 'guide_home_3_d' },
      { ico: 'person', tKey: 'guide_home_4_t', dKey: 'guide_home_4_d' },
      { ico: 'qr',     tKey: 'guide_home_5_t', dKey: 'guide_home_5_d' }
    ] },
  bobler: { icon: 'bubble', titleKey: 'guide_bobler_title', subKey: 'guide_bobler_sub', tipKey: 'guide_bobler_tip',
    items: [
      { ico: 'explore', tKey: 'guide_bobler_1_t', dKey: 'guide_bobler_1_d' },
      { ico: 'join',    tKey: 'guide_bobler_2_t', dKey: 'guide_bobler_2_d' },
      { ico: 'plus',    tKey: 'guide_bobler_3_t', dKey: 'guide_bobler_3_d' },
      { ico: 'chat',    tKey: 'guide_bobler_4_t', dKey: 'guide_bobler_4_d' },
      { ico: 'layers',  tKey: 'guide_bobler_5_t', hintKey: 'guide_bobler_5_hint', access: true }
    ] },
  dms: { icon: 'chat', titleKey: 'guide_dms_title', subKey: 'guide_dms_sub', tipKey: 'guide_dms_tip',
    items: [
      { ico: 'send',   tKey: 'guide_dms_1_t', dKey: 'guide_dms_1_d' },
      { ico: 'edit',   tKey: 'guide_dms_2_t', dKey: 'guide_dms_2_d' },
      { ico: 'person', tKey: 'guide_dms_3_t', dKey: 'guide_dms_3_d' },
      { ico: 'inbox',  tKey: 'guide_dms_4_t', dKey: 'guide_dms_4_d' },
      { ico: 'clip',   tKey: 'guide_dms_5_t', dKey: 'guide_dms_5_d' }
    ] },
  profil: { icon: 'user', titleKey: 'guide_profil_title', subKey: 'guide_profil_sub', tipKey: 'guide_profil_tip',
    items: [
      { ico: 'strength', tKey: 'guide_profil_1_t', dKey: 'guide_profil_1_d' },
      { ico: 'bookmark', tKey: 'guide_profil_2_t', dKey: 'guide_profil_2_d' },
      { ico: 'inbox',    tKey: 'guide_profil_3_t', dKey: 'guide_profil_3_d' },
      { ico: 'qr',       tKey: 'guide_profil_4_t', dKey: 'guide_profil_4_d' },
      { ico: 'settings', tKey: 'guide_profil_5_t', dKey: 'guide_profil_5_d' }
    ] }
};

function _guideAccessHTML() {
  var h = '<div class="guide-access">';
  _GUIDE_ACCESS.forEach(function(a) {
    h += '<div class="guide-access-row"><div class="guide-access-ico">' + (_GI[a.ico] || '') + '</div>'
      + '<div><div class="guide-access-t">' + t(a.tKey) + '</div>'
      + '<div class="guide-access-d">' + t(a.dKey) + '</div></div></div>';
  });
  return h + '</div>';
}

function _guideToggle(el) { el.classList.toggle('open'); }

function _guideClose(id) {
  var ov = document.getElementById(id);
  if (!ov) return;
  ov.classList.remove('open');
  setTimeout(function() { if (ov && ov.parentNode) ov.remove(); }, 350);
}

function showGuide(key) {
  var g = _GUIDES[key];
  if (!g) return;
  var id = 'guide-sheet-' + key;
  var existing = document.getElementById(id);
  if (existing) existing.remove();

  var safeIco = (typeof ico === 'function') ? ico(g.icon) : '';
  var html = '<div class="modal-sheet guide-sheet">'
    + '<div class="modal-handle"></div>'
    + '<div class="guide-head"><div class="guide-head-ico">' + safeIco + '</div>'
    + '<div class="guide-head-title">' + t(g.titleKey) + '</div></div>'
    + '<div class="guide-sub">' + t(g.subKey) + '</div>';

  g.items.forEach(function(it) {
    var body = it.access ? _guideAccessHTML() : '<div class="guide-ac-d">' + t(it.dKey) + '</div>';
    html += '<div class="guide-ac" onclick="_guideToggle(this)">'
      + '<div class="guide-ac-head"><div class="guide-ac-ico">' + (_GI[it.ico] || '') + '</div>'
      + '<div class="guide-ac-titles"><div class="guide-ac-t">' + t(it.tKey) + '</div>'
      + (it.hintKey ? '<div class="guide-ac-hint">' + t(it.hintKey) + '</div>' : '')
      + '</div><div class="guide-ac-chev">' + _GUIDE_CHEV + '</div></div>'
      + '<div class="guide-ac-body"><div class="guide-ac-body-inner">' + body + '</div></div></div>';
  });

  html += '<div class="guide-tip"><span class="guide-tip-badge">' + t('guide_tip_label') + '</span>'
    + '<div class="guide-tip-text">' + t(g.tipKey) + '</div></div>';
  html += '<button class="guide-cta" onclick="_guideClose(\'' + id + '\')">' + t('guide_understood') + '</button>'
    + '</div>';

  var ov = document.createElement('div');
  ov.id = id;
  ov.className = 'modal-overlay guide-overlay';
  ov.innerHTML = html;
  ov.onclick = function(e) { if (e.target === ov) _guideClose(id); };
  document.body.appendChild(ov);
  requestAnimationFrame(function() { requestAnimationFrame(function() { ov.classList.add('open'); }); });
}
