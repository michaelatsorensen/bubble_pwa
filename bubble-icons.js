// ════════════════════════════════════════════════════════════
//  BUBBLE ICON SYSTEM v3
//  24×24 grid · 1.5px stroke · round caps/joins
//  All icons optically centered in viewBox
//  Usage: ico('name') → raw SVG | icon('name') → wrapped
// ════════════════════════════════════════════════════════════

const _s = 'xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"';

const ICONS = {
  bubble: `<svg ${_s}><circle cx="9.5" cy="9.5" r="6" opacity="0.85"/><circle cx="16" cy="13.5" r="4.5" opacity="0.6"/><circle cx="8" cy="16" r="3" opacity="0.45"/></svg>`,
  home: `<svg ${_s}><path d="M4 11.4L12 4l8 7.4"/><path d="M6 10v8.5a1 1 0 001 1h3v-4.5a2 2 0 014 0v4.5h3a1 1 0 001-1V10"/></svg>`,
  search: `<svg ${_s}><circle cx="11" cy="11" r="6"/><path d="M16.5 16.5L21 21"/></svg>`,
  chat: `<svg ${_s}><path d="M21 12c0 4.4-4 8-9 8a10.2 10.2 0 01-3.8-.7L3 21l1.9-3.7A7.8 7.8 0 013 12c0-4.4 4-8 9-8s9 3.6 9 8z"/><circle cx="9" cy="12" r=".75" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r=".75" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r=".75" fill="currentColor" stroke="none"/></svg>`,
  user: `<svg ${_s}><circle cx="12" cy="8.5" r="3.5"/><path d="M5.5 20.5c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5"/></svg>`,
  bell: `<svg ${_s}><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>`,
  rocket: `<svg ${_s}><path d="M4.5 16.5c-1.5 1.5-2 5-2 5s3.5-.5 5-2c.8-.8 1-2 .4-2.8a2.1 2.1 0 00-3.4-.2z"/><path d="M12 15l-3-3"/><path d="M14.5 2.5c-3 2-5 5.5-5.5 9l3.5 3.5c3.5-.5 7-2.5 9-5.5L14.5 2.5z"/><path d="M14 9a1 1 0 100 2 1 1 0 000-2z" fill="currentColor"/><path d="M9 21c0-2.5.5-4 2-5.5M3 15c1.5-1.5 3-2 5.5-2"/></svg>`,
  pin: `<svg ${_s}><path d="M12 21.5c-3.5-3.5-6.5-7-6.5-10.5a6.5 6.5 0 0113 0c0 3.5-3 7-6.5 10.5z"/><circle cx="12" cy="11" r="2.5"/></svg>`,
  cpu: `<svg ${_s}><rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9.5 2.5v4M14.5 2.5v4M9.5 17.5v4M14.5 17.5v4M2.5 9.5h4M2.5 14.5h4M17.5 9.5h4M17.5 14.5h4"/></svg>`,
  building: `<svg ${_s}><rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/><path d="M10 21v-3h4v3"/></svg>`,
  coffee: `<svg ${_s}><path d="M17 8h1.5a2.5 2.5 0 010 5H17"/><path d="M5 8h12v8a4 4 0 01-4 4H9a4 4 0 01-4-4V8z"/><path d="M8 2v3M11 2v3M14 2v3"/></svg>`,
  bookmark: `<svg ${_s}><path d="M6 4a1.5 1.5 0 011.5-1.5h9A1.5 1.5 0 0118 4v17l-6-3.5L6 21V4z"/></svg>`,
  bookmarkFill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4a1.5 1.5 0 011.5-1.5h9A1.5 1.5 0 0118 4v17l-6-3.5L6 21V4z"/></svg>`,
  edit: `<svg ${_s}><path d="M16.5 3.5a2.1 2.1 0 013 3L8 18l-4 1 1-4L16.5 3.5z"/></svg>`,
  clip: `<svg ${_s}><path d="M21.4 11.1l-9.2 9.2a5.5 5.5 0 01-7.8-7.8l9.2-9.2a3.7 3.7 0 015.2 5.2l-9.2 9.2a1.8 1.8 0 01-2.6-2.6l8.5-8.4"/></svg>`,
  trash: `<svg ${_s}><path d="M4 6.5h16M9 6.5V4.5a1.5 1.5 0 011.5-1.5h3A1.5 1.5 0 0115 4.5v2"/><path d="M18.5 6.5l-.8 13a2 2 0 01-2 1.8H8.3a2 2 0 01-2-1.8L5.5 6.5"/></svg>`,
  send: `<svg ${_s}><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>`,
  calendar: `<svg ${_s}><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>`,
  plus: `<svg ${_s}><path d="M12 5v14M5 12h14"/></svg>`,
  download: `<svg ${_s}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><path d="M12 3v13M7 12l5 5 5-5"/></svg>`,
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
  crown: `<svg ${_s}><path d="M3.5 17l2-9L10 12l2-8 2 8 4.5-4 2 9H3.5z"/><rect x="3.5" y="17" width="17" height="2.5" rx="1"/></svg>`,
  users: `<svg ${_s}><circle cx="9" cy="8" r="3"/><path d="M3.5 19.5a5.5 5.5 0 0111 0"/><circle cx="17" cy="9.5" r="2.5"/><path d="M21 19.5a4 4 0 00-4.5-4"/></svg>`,
  'user-plus': `<svg ${_s}><circle cx="9" cy="7" r="4"/><path d="M3 21a6 6 0 0112 0"/><path d="M19 8v6M22 11h-6"/></svg>`,
  target: `<svg ${_s}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>`,
  qrcode: `<svg ${_s}><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="3.5" height="3.5"/><path d="M20 14h-2.5v3M14 20h3v-3M20 20h-3"/></svg>`,
  scanner: `<svg ${_s}><path d="M2 7V2h5M17 2h5v5M22 17v5h-5M7 22H2v-5"/><line x1="6" y1="12" x2="18" y2="12" stroke-dasharray="2 2"/></svg>`,
  link: `<svg ${_s}><path d="M10 13a5 5 0 007.5.5l3-3a5 5 0 00-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 00-7.5-.5l-3 3a5 5 0 007 7l1.7-1.7"/></svg>`,
  smile: `<svg ${_s}><circle cx="12" cy="12" r="9"/><path d="M8 14.5s1.5 2 4 2 4-2 4-2"/><circle cx="9" cy="10" r=".8" fill="currentColor" stroke="none"/><circle cx="15" cy="10" r=".8" fill="currentColor" stroke="none"/></svg>`,
  reply: `<svg ${_s}><path d="M9 17l-5-5 5-5"/><path d="M4 12h12a4 4 0 010 8h-1.5"/></svg>`,
  wave: `<svg ${_s}><path d="M7.5 12.5V8.5a1.5 1.5 0 013 0v4"/><path d="M10.5 9.5V7a1.5 1.5 0 013 0v4"/><path d="M13.5 10V8a1.5 1.5 0 013 0v4"/><path d="M16.5 11V9.5a1.5 1.5 0 013 0v4.5c0 3.5-2.5 6-5.5 6h-1c-3 0-5.5-2.5-5.5-5.5v-2"/></svg>`,
  file: `<svg ${_s}><path d="M14 2.5H6.5a2 2 0 00-2 2v15a2 2 0 002 2h11a2 2 0 002-2V8L14 2.5z"/><path d="M14 2.5V8h5.5"/></svg>`,
  linkedin: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#0A66C2"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>`,
  camera: `<svg ${_s}><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>`,
  settings: `<svg ${_s}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>`,
  heart: `<svg ${_s}><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z"/></svg>`,
  share: `<svg ${_s}><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98"/></svg>`,
  graduation: `<svg ${_s}><path d="M22 10l-10-5L2 10l10 5 10-5z"/><path d="M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5"/><path d="M22 10v6"/></svg>`,
  leaf: `<svg ${_s}><path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 018 20c4 0 8.5-3 10-8"/><path d="M2 12s5-2 10-2c4 0 7-2 9-6"/></svg>`,
  briefcase: `<svg ${_s}><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/><path d="M12 12v.01"/><path d="M2 12h20"/></svg>`,
  wrench: `<svg ${_s}><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>`,
  palette: `<svg ${_s}><circle cx="13.5" cy="6.5" r="1.5" fill="currentColor" stroke="none"/><circle cx="17.5" cy="10.5" r="1.5" fill="currentColor" stroke="none"/><circle cx="8.5" cy="7.5" r="1.5" fill="currentColor" stroke="none"/><circle cx="6.5" cy="12" r="1.5" fill="currentColor" stroke="none"/><path d="M12 2a10 10 0 000 20c1.1 0 2-.9 2-2v-.5c0-.5-.2-1-.5-1.4-.3-.3-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.4a6 6 0 005.6-6A10 10 0 0012 2z"/></svg>`,
};

function ico(name) { return ICONS[name] || ''; }
function icon(name) { return '<span class="ico" style="width:1em;height:1em;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;vertical-align:middle">' + (ICONS[name] || '') + '</span>'; }
