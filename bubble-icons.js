// ════════════════════════════════════════════════════════════
//  BUBBLE ICON SYSTEM v2
//  24×24 grid · 1.5px stroke · round caps/joins
//  All icons optically centered in viewBox
//  Usage: ico('name') → raw SVG | icon('name') → wrapped
// ════════════════════════════════════════════════════════════

const _s = 'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"';

const ICONS = {
  bubble: `<svg ${_s}><circle cx="9.5" cy="9.5" r="6" opacity="0.85"/><circle cx="16" cy="13.5" r="4.5" opacity="0.6"/><circle cx="8" cy="16" r="3" opacity="0.45"/></svg>`,
  home: `<svg ${_s}><path d="M4 11.4L12 4l8 7.4"/><path d="M6 10v8.5a1 1 0 001 1h3v-4.5a2 2 0 014 0v4.5h3a1 1 0 001-1V10"/></svg>`,
  search: `<svg ${_s}><circle cx="11" cy="11" r="6"/><path d="M16.5 16.5L21 21"/></svg>`,
  chat: `<svg ${_s}><path d="M20 11.5c0 4-3.6 7-8 7a9.4 9.4 0 01-3.2-.55L4 20l1.3-3.2A7.5 7.5 0 014 11.5c0-4 3.6-7.5 8-7.5s8 3.5 8 7.5z"/><circle cx="9.5" cy="11.5" r=".8" fill="currentColor" stroke="none"/><circle cx="12" cy="11.5" r=".8" fill="currentColor" stroke="none"/><circle cx="14.5" cy="11.5" r=".8" fill="currentColor" stroke="none"/></svg>`,
  user: `<svg ${_s}><circle cx="12" cy="8.5" r="3.5"/><path d="M5.5 20.5c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5"/></svg>`,
  bell: `<svg ${_s}><path d="M18 8.5A6 6 0 006 8.5c0 6-2.5 8.5-2.5 8.5h17S18 14.5 18 8.5"/><path d="M13.73 20a2 2 0 01-3.46 0"/></svg>`,
  rocket: `<svg ${_s}><path d="M12 3c-3 3.5-5 7.5-5 11l5 4 5-4c0-3.5-2-7.5-5-11z"/><circle cx="12" cy="11.5" r="2"/><path d="M7 14l-2.5 2.5M17 14l2.5 2.5"/></svg>`,
  pin: `<svg ${_s}><path d="M12 21.5c-3.5-3.5-6.5-7-6.5-10.5a6.5 6.5 0 0113 0c0 3.5-3 7-6.5 10.5z"/><circle cx="12" cy="11" r="2.5"/></svg>`,
  cpu: `<svg ${_s}><rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9.5 2.5v4M14.5 2.5v4M9.5 17.5v4M14.5 17.5v4M2.5 9.5h4M2.5 14.5h4M17.5 9.5h4M17.5 14.5h4"/></svg>`,
  building: `<svg ${_s}><rect x="4.5" y="3" width="15" height="18" rx="1.5"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/><path d="M10 21v-3h4v3"/></svg>`,
  coffee: `<svg ${_s}><path d="M17 8.5h1.5a2.5 2.5 0 010 5H17"/><path d="M5 8.5h12v7.5a4 4 0 01-4 4H9a4 4 0 01-4-4V8.5z"/><path d="M8 3v3M11 3v3M14 3v3"/></svg>`,
  bookmark: `<svg ${_s}><path d="M6 4a1.5 1.5 0 011.5-1.5h9A1.5 1.5 0 0118 4v17l-6-3.5L6 21V4z"/></svg>`,
  bookmarkFill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4a1.5 1.5 0 011.5-1.5h9A1.5 1.5 0 0118 4v17l-6-3.5L6 21V4z"/></svg>`,
  edit: `<svg ${_s}><path d="M16.5 3.5a2.1 2.1 0 013 3L8 18l-4 1 1-4L16.5 3.5z"/></svg>`,
  clip: `<svg ${_s}><path d="M21.4 11.1l-9.2 9.2a5.5 5.5 0 01-7.8-7.8l9.2-9.2a3.7 3.7 0 015.2 5.2l-9.2 9.2a1.8 1.8 0 01-2.6-2.6l8.5-8.4"/></svg>`,
  trash: `<svg ${_s}><path d="M4 6.5h16M9 6.5V4.5a1.5 1.5 0 011.5-1.5h3A1.5 1.5 0 0115 4.5v2"/><path d="M18.5 6.5l-.8 13a2 2 0 01-2 1.8H8.3a2 2 0 01-2-1.8L5.5 6.5"/></svg>`,
  send: `<svg ${_s}><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>`,
  calendar: `<svg ${_s}><rect x="3.5" y="4.5" width="17" height="16" rx="2"/><path d="M16 2.5v4M8 2.5v4M3.5 10h17"/></svg>`,
  plus: `<svg ${_s}><path d="M12 5v14M5 12h14"/></svg>`,
  download: `<svg ${_s}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><path d="M12 3.5v12M7.5 10.5l4.5 5 4.5-5"/></svg>`,
  logout: `<svg ${_s}><path d="M9 21H5.5a2 2 0 01-2-2V5a2 2 0 012-2H9"/><path d="M16 17l5-5-5-5M21 12H9"/></svg>`,
  check: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l5 5L20 7"/></svg>`,
  checkCircle: `<svg ${_s}><circle cx="12" cy="12" r="9"/><path d="M8.5 12l2.5 3 5-5.5"/></svg>`,
  x: `<svg ${_s}><path d="M17 7L7 17M7 7l10 10"/></svg>`,
  xCircle: `<svg ${_s}><circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/></svg>`,
  lock: `<svg ${_s}><rect x="5.5" y="11" width="13" height="9.5" rx="2"/><path d="M8.5 11V7.5a3.5 3.5 0 017 0V11"/></svg>`,
  globe: `<svg ${_s}><circle cx="12" cy="12" r="9"/><path d="M3.5 9h17M3.5 15h17"/><ellipse cx="12" cy="12" rx="4" ry="9"/></svg>`,
  eye: `<svg ${_s}><path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></svg>`,
  fire: `<svg ${_s}><path d="M12 2.5c-2 4-5.5 6-5.5 10.5a5.5 5.5 0 0011 0c0-4.5-3.5-6.5-5.5-10.5z"/><path d="M12 21.5c-1.5 0-2.5-1.3-2.5-3 0-2.5 2.5-3.5 2.5-5.5 0 2 2.5 3 2.5 5.5s-1 3-2.5 3z"/></svg>`,
  warn: `<svg ${_s}><path d="M12 3L2.5 20h19L12 3z"/><path d="M12 9.5v4M12 17h.01"/></svg>`,
  info: `<svg ${_s}><circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/></svg>`,
  arrowLeft: `<svg ${_s}><path d="M19 12H5M12 19l-7-7 7-7"/></svg>`,
  chevronRight: `<svg ${_s}><path d="M9 18l6-6-6-6"/></svg>`,
  crown: `<svg ${_s}><path d="M3 18l2.5-11 4.5 4.5L12 4l2 7.5L18.5 7 21 18H3z"/><path d="M4.5 21h15"/></svg>`,
  users: `<svg ${_s}><circle cx="9" cy="7.5" r="3.5"/><path d="M2.5 20c0-3.3 2.9-6 6.5-6s6.5 2.7 6.5 6"/><circle cx="17.5" cy="9" r="2.5"/><path d="M21.5 20a4.5 4.5 0 00-5-4.5"/></svg>`,
  'user-plus': `<svg ${_s}><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>`,
  target: `<svg ${_s}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>`,
  qrcode: `<svg ${_s}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="3.5" height="3.5"/><path d="M21 14h-3v3.5M14 21h3.5v-3.5M21 21h-3.5"/></svg>`,
  link: `<svg ${_s}><path d="M10 13a5 5 0 007.5.5l3-3a5 5 0 00-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 00-7.5-.5l-3 3a5 5 0 007 7l1.7-1.7"/></svg>`,
  smile: `<svg ${_s}><circle cx="12" cy="12" r="9"/><path d="M8 14.5s1.5 2 4 2 4-2 4-2"/><circle cx="9" cy="10" r=".8" fill="currentColor" stroke="none"/><circle cx="15" cy="10" r=".8" fill="currentColor" stroke="none"/></svg>`,
  reply: `<svg ${_s}><path d="M9 17l-5-5 5-5"/><path d="M4 12h12a4 4 0 010 8h-1.5"/></svg>`,
  wave: `<svg ${_s}><path d="M7.5 11.5L6 6.5a1.5 1.5 0 013 0L10.5 11"/><path d="M10.5 11L9.5 6a1.5 1.5 0 013 0l1 5"/><path d="M13.5 10.5L13 8a1.5 1.5 0 013 0l.5 3"/><path d="M16.5 11l-.2-2a1.5 1.5 0 013 .4l.2 2.5c.2 2.5-.8 5-2.5 6.5-1.5 1.2-4 1.8-6 .8a5 5 0 01-3-5l1-3"/></svg>`,
  file: `<svg ${_s}><path d="M14 2.5H6.5a2 2 0 00-2 2v15a2 2 0 002 2h11a2 2 0 002-2V8L14 2.5z"/><path d="M14 2.5V8h5.5"/></svg>`,
  linkedin: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#0A66C2"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>`,
};

function ico(name) { return ICONS[name] || ''; }
function icon(name) { return `<span class="ico">${ICONS[name] || ''}</span>`; }
