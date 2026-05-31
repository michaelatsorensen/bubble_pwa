// ============================================================
//  b-guides.js — "Sådan virker [skærm]" guide-sheets
//  Niveau 2: illustrerede kort. Strandglas bund-sheet.
//  Global: showGuide('home'|'bobler'|'dms'|'profil')
//  Entry-knap kobles på senere (placering endnu ikke besluttet).
// ============================================================

// Mini-visuals (custom SVG/HTML) for "scene"-agtige punkter.
// Eksisterende app-ikoner bruges via ico() hvor de findes.
var _GUIDE_VIS = {
  radar: '<span class="gv"><span class="gv-ring" style="width:46px;height:46px"></span><span class="gv-ring" style="width:28px;height:28px"></span>'
    + '<span class="gv-dot" style="width:6px;height:6px;top:14px;left:33px"></span>'
    + '<span class="gv-dot" style="width:5px;height:5px;top:34px;left:18px;background:var(--pink)"></span>'
    + '<span class="gv-dot" style="width:7px;height:7px;top:24px;left:24px;background:var(--teal)"></span></span>',
  cluster: '<svg width="38" height="38" viewBox="0 0 38 38"><line x1="19" y1="12" x2="11" y2="26" stroke="rgba(255,255,255,0.22)" stroke-width="1"/><line x1="19" y1="12" x2="27" y2="26" stroke="rgba(255,255,255,0.22)" stroke-width="1"/><circle cx="19" cy="11" r="4.5" fill="rgba(100,180,230,0.95)"/><circle cx="10" cy="26" r="3.6" fill="rgba(232,121,168,0.9)"/><circle cx="28" cy="26" r="3.6" fill="rgba(26,158,142,0.9)"/></svg>',
  tags: '<span style="display:flex;flex-direction:column;gap:4px">'
    + '<span style="font-size:0.5rem;font-weight:600;background:rgba(100,180,230,0.25);color:#cfe6f7;padding:2px 7px;border-radius:6px">design</span>'
    + '<span style="font-size:0.5rem;font-weight:600;background:rgba(26,158,142,0.25);color:#a8e4d9;padding:2px 7px;border-radius:6px">startup</span>'
    + '<span style="font-size:0.5rem;font-weight:600;background:rgba(232,121,168,0.22);color:#f3c7dc;padding:2px 7px;border-radius:6px">design</span></span>',
  live: '<span style="position:relative;width:20px;height:20px;display:inline-block"><span style="position:absolute;inset:0;border-radius:50%;background:var(--teal)"></span><span style="position:absolute;inset:-6px;border-radius:50%;border:1.5px solid var(--teal);opacity:0.45"></span></span>',
  twoBubbles: '<span style="position:relative;width:44px;height:36px;display:inline-block"><span style="position:absolute;left:0;top:5px;width:26px;height:26px;border-radius:50%;background:rgba(100,180,230,0.3);border:0.5px solid rgba(100,180,230,0.55)"></span><span style="position:absolute;right:0;top:9px;width:22px;height:22px;border-radius:50%;background:rgba(26,158,142,0.3);border:0.5px solid rgba(26,158,142,0.55)"></span></span>',
  qr: '<span style="width:32px;height:32px;border-radius:6px;background:#fff;display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(4,1fr);gap:1px;padding:3px">'
    + '<span style="background:#170F34"></span><span></span><span style="background:#170F34"></span><span style="background:#170F34"></span>'
    + '<span></span><span style="background:#170F34"></span><span></span><span></span>'
    + '<span style="background:#170F34"></span><span></span><span style="background:#170F34"></span><span style="background:#170F34"></span>'
    + '<span style="background:#170F34"></span><span></span><span style="background:#170F34"></span><span></span></span>',
  envelope: '<svg width="34" height="30" viewBox="0 0 34 30"><rect x="3" y="5" width="28" height="20" rx="3" fill="none" stroke="rgba(100,180,230,0.85)" stroke-width="1.5"/><path d="M3 7 l14 10 14-10" fill="none" stroke="rgba(100,180,230,0.85)" stroke-width="1.5"/></svg>',
  star: '<svg width="32" height="32" viewBox="0 0 32 32"><path d="M16 4 l3.2 7.4 8 0.6-6.1 5.3 1.9 7.8L16 28l-7 4.4 1.9-7.8L4.8 19l8-0.6z" fill="rgba(100,180,230,0.75)"/></svg>',
  dmBubbles: '<span style="display:flex;flex-direction:column;gap:4px;align-items:flex-start"><span style="background:rgba(100,180,230,0.28);border-radius:8px 8px 8px 2px;width:30px;height:11px;display:block"></span><span style="background:rgba(232,121,168,0.28);border-radius:8px 8px 2px 8px;width:24px;height:11px;align-self:flex-end;display:block"></span></span>',
  gif: '<span style="font-size:0.56rem;font-weight:800;color:rgba(255,255,255,0.92);background:rgba(232,121,168,0.25);border:0.5px solid rgba(232,121,168,0.45);padding:5px 9px;border-radius:8px;letter-spacing:0.5px">GIF</span>',
  groupChat: '<svg width="36" height="32" viewBox="0 0 36 32"><circle cx="12" cy="10" r="5" fill="rgba(100,180,230,0.45)"/><circle cx="24" cy="10" r="5" fill="rgba(26,158,142,0.45)"/><circle cx="18" cy="13" r="5.5" fill="rgba(232,121,168,0.45)"/><rect x="5" y="20" width="26" height="8" rx="4" fill="rgba(255,255,255,0.08)"/></svg>',
  bookmark: '<svg width="26" height="30" viewBox="0 0 26 30"><path d="M6 3 h14 v23 l-7-4.5-7 4.5z" fill="rgba(100,180,230,0.28)" stroke="rgba(100,180,230,0.65)" stroke-width="1.2"/></svg>',
  strengthBar: '<span style="width:44px;height:9px;border-radius:5px;background:rgba(255,255,255,0.12);overflow:hidden;display:block"><span style="height:100%;width:72%;background:linear-gradient(90deg,var(--isbla,rgb(100,180,230)),var(--teal));border-radius:5px;display:block"></span></span>',
  tagsWrap: '<span style="display:flex;flex-wrap:wrap;gap:3px;width:50px;justify-content:center">'
    + '<span style="font-size:0.45rem;font-weight:600;background:rgba(100,180,230,0.25);color:#cfe6f7;padding:2px 5px;border-radius:5px">tech</span>'
    + '<span style="font-size:0.45rem;font-weight:600;background:rgba(26,158,142,0.25);color:#a8e4d9;padding:2px 5px;border-radius:5px">kunst</span>'
    + '<span style="font-size:0.45rem;font-weight:600;background:rgba(232,121,168,0.22);color:#f3c7dc;padding:2px 5px;border-radius:5px">løb</span></span>',
  linkedin: '<svg width="30" height="30" viewBox="0 0 24 24" fill="#0A66C2"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>'
};

// Guide-definitioner. Tekster ligger i i18n (guide_*); her bindes kun struktur + visual.
var _GUIDES = {
  home: {
    icon: 'target', titleKey: 'guide_home_title', subKey: 'guide_home_sub',
    items: [
      { vis: 'radar',   tKey: 'guide_home_1_t', dKey: 'guide_home_1_d' },
      { vis: 'cluster', tKey: 'guide_home_2_t', dKey: 'guide_home_2_d' },
      { vis: 'tags',    tKey: 'guide_home_3_t', dKey: 'guide_home_3_d' },
      { vis: 'live',    tKey: 'guide_home_4_t', dKey: 'guide_home_4_d' }
    ]
  },
  bobler: {
    icon: 'bubble', titleKey: 'guide_bobler_title', subKey: 'guide_bobler_sub',
    items: [
      { vis: 'twoBubbles', tKey: 'guide_bobler_1_t', dKey: 'guide_bobler_1_d' },
      { vis: 'qr',         tKey: 'guide_bobler_2_t', dKey: 'guide_bobler_2_d' },
      { vis: 'envelope',   tKey: 'guide_bobler_3_t', dKey: 'guide_bobler_3_d' },
      { vis: 'star',       tKey: 'guide_bobler_4_t', dKey: 'guide_bobler_4_d' }
    ]
  },
  dms: {
    icon: 'chat', titleKey: 'guide_dms_title', subKey: 'guide_dms_sub',
    items: [
      { vis: 'dmBubbles', tKey: 'guide_dms_1_t', dKey: 'guide_dms_1_d' },
      { vis: 'gif',       tKey: 'guide_dms_2_t', dKey: 'guide_dms_2_d' },
      { vis: 'groupChat', tKey: 'guide_dms_3_t', dKey: 'guide_dms_3_d' },
      { vis: 'bookmark',  tKey: 'guide_dms_4_t', dKey: 'guide_dms_4_d' }
    ]
  },
  profil: {
    icon: 'user', titleKey: 'guide_profil_title', subKey: 'guide_profil_sub',
    items: [
      { vis: 'strengthBar', tKey: 'guide_profil_1_t', dKey: 'guide_profil_1_d' },
      { vis: 'tagsWrap',    tKey: 'guide_profil_2_t', dKey: 'guide_profil_2_d' },
      { vis: 'linkedin',    tKey: 'guide_profil_3_t', dKey: 'guide_profil_3_d' },
      { vis: 'qr',          tKey: 'guide_profil_4_t', dKey: 'guide_profil_4_d' }
    ]
  }
};

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
    html += '<div class="guide-card">'
      + '<div class="guide-card-vis">' + (_GUIDE_VIS[it.vis] || '') + '</div>'
      + '<div class="guide-card-body">'
      + '<div class="guide-card-t">' + t(it.tKey) + '</div>'
      + '<div class="guide-card-d">' + t(it.dKey) + '</div>'
      + '</div></div>';
  });

  html += '<button class="guide-cta" onclick="_guideClose(\'' + id + '\')">' + t('guide_understood') + '</button>'
    + '</div>';

  var ov = document.createElement('div');
  ov.id = id;
  ov.className = 'modal-overlay';
  ov.innerHTML = html;
  ov.onclick = function(e) { if (e.target === ov) _guideClose(id); };
  document.body.appendChild(ov);
  // Toggle .open på næste frame så slide-up-transition kører.
  requestAnimationFrame(function() { requestAnimationFrame(function() { ov.classList.add('open'); }); });
}
