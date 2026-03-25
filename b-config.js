// ══════════════════════════════════════════════════════════
//  BUBBLE — CONFIGURATION + ERROR HANDLING + SUPABASE
//  DOMAIN: config
//  OWNS: sb, currentUser, currentProfile, SUPABASE_URL, SUPABASE_ANON_KEY, BUILD_VERSION
//  SETS: currentUser (declared), currentProfile (declared)
//  NOTE: currentUser/currentProfile are SET by b-auth.js, declared here for load-order
//  Auto-split from app.js · v3.7.0
// ══════════════════════════════════════════════════════════


// Desktop detection
var isDesktop = window.matchMedia('(min-width: 600px)').matches && !('ontouchstart' in window);

// ══════════════════════════════════════════════════════════
//  CONFIGURATION
// ══════════════════════════════════════════════════════════
const BUILD_TIMESTAMP = '2026-03-19T18:00:00';
const BUILD_VERSION  = 'v6.3.1';
const SUPABASE_URL  = "https://pfxcsjjxvdtpsfltexka.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_y6BftA4RQw91dLHPXIncag_oGomBk-A";
const GIPHY_API_KEY = "5GbVR1NiodxCj61uImKnLydncCGdNGfi";

var hsDefaults = { radar: true, saved: true, feedback: true };

// ══════════════════════════════════════════════════════════
//  GLOBAL ERROR HANDLERS + ERROR LOGGING + EMAIL ALERTS
// ══════════════════════════════════════════════════════════
var _errorLog = [];
var ERROR_LOG_MAX = 50;

// ── EmailJS config (fill in your keys from emailjs.com) ──
var EMAILJS_PUBLIC_KEY  = 'obqyOwjfRAzMEr_MI';
var EMAILJS_SERVICE_ID  = 'service_Bubble_Bugs';
var EMAILJS_TEMPLATE_ID = 'template_tqt3igv';
var _emailjsLoaded = false;
var _lastErrorEmail = 0;
var ERROR_EMAIL_COOLDOWN = 60000; // Max 1 email per minut (undgår spam ved kaskade-fejl)

function loadEmailJS() {
  if (_emailjsLoaded || EMAILJS_PUBLIC_KEY === 'DIN_PUBLIC_KEY') return;
  var script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';
  script.onload = function() {
    if (window.emailjs) { window.emailjs.init(EMAILJS_PUBLIC_KEY); _emailjsLoaded = true; }
  };
  document.head.appendChild(script);
}

function sendErrorEmail(entry) {
  if (!_emailjsLoaded || !window.emailjs) return;
  if (EMAILJS_SERVICE_ID === 'DIN_SERVICE_ID') return;
  // Rate limit
  var now = Date.now();
  if (now - _lastErrorEmail < ERROR_EMAIL_COOLDOWN) return;
  _lastErrorEmail = now;

  window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
    context: entry.ctx,
    message: entry.msg,
    stack: entry.stack || 'N/A',
    extra: entry.extra ? (typeof entry.extra === 'object' ? JSON.stringify(entry.extra) : entry.extra) : 'N/A',
    user_id: entry.user || 'anonym',
    timestamp: entry.ts
  }).catch(function() { /* silent — don't log email errors to avoid loops */ });
}

function logError(context, error, extra) {
  var entry = {
    ts: new Date().toISOString(),
    ctx: context,
    msg: error?.message || String(error),
    stack: error?.stack?.split('\n').slice(0,3).join(' | ') || '',
    extra: extra || null,
    user: currentUser?.id || null
  };
  _errorLog.push(entry);
  if (_errorLog.length > ERROR_LOG_MAX) _errorLog.shift();
  console.error('[' + context + ']', error, extra || '');

  // Persist to Supabase error_log table
  if (typeof sb !== 'undefined' && sb && currentUser) {
    sb.from('error_log').insert({
      user_id: currentUser.id,
      context: context,
      message: entry.msg,
      stack: entry.stack,
      extra: typeof extra === 'object' ? JSON.stringify(extra) : extra || null
    }).then(function(){}).catch(function(){});
  }

  // Send email alert
  sendErrorEmail(entry);
}

// View error log in console: type viewErrorLog() in devtools
window.viewErrorLog = function() { console.table(_errorLog); return _errorLog; };

window.onerror = function(msg, src, line, col, err) {
  logError('global', err || msg, { src: src, line: line, col: col });
  const el = document.getElementById('loading-msg');
  if (el) {
    el.textContent = '❌ JS Fejl linje ' + line + ': ' + msg;
    el.style.color = '#D06070';
    el.style.fontSize = '0.75rem';
    el.style.maxWidth = '320px';
    el.style.margin = '1rem auto';
  }
  return false;
};
window.onunhandledrejection = function(e) {
  logError('promise', e.reason, null);
  const el = document.getElementById('loading-msg');
  if (el) {
    el.textContent = '❌ Promise fejl: ' + (e.reason?.message || e.reason || 'Ukendt');
    el.style.color = '#D06070';
  }
};

// ══════════════════════════════════════════════════════════
//  SUPABASE INIT
// ══════════════════════════════════════════════════════════
let sb;
let currentUser = null;
let currentProfile = null;
let currentBubble = null;
let currentPerson = null;
let currentChatUser = null;
let currentChatName = null;
let allBubbles = [];
let cbChips = [], epChips = [], epDynChips = [], ebChips = [], obChips = [];
let chatSubscription = null;
let isAnon = false;

function initSupabase() {
  if (SUPABASE_URL === "DIN_SUPABASE_URL_HER") {
    document.getElementById('loading-msg').textContent = '⚠️ Indsæt dine Supabase-nøgler i filen';
    document.getElementById('loading-msg').style.color = '#3B82F6';
    return false;
  }
  try {
    sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    loadEmailJS(); // Load error email alerting
    return true;
  } catch(e) {
    document.getElementById('loading-msg').textContent = 'Fejl: ' + e.message;
    return false;
  }
}

// ── Navigation version counter (request cancellation) ──
// Incremented on every goTo(). Async loaders check this to abort stale renders.
var _navVersion = 0;
var _activeScreen = null;

// ── Centralized flow state (sessionStorage-backed for OAuth redirect survival) ──
// Keys: pending_contact, pending_join, event_flow, post_tags_destination
// Clean API wrapping sessionStorage — survives page reloads from OAuth redirects
var _flowStatePrefix = 'bf_'; // bf = bubble flow

function flowGet(key) {
  try { return sessionStorage.getItem(_flowStatePrefix + key) || null; }
  catch(e) { return null; }
}
function flowSet(key, value) {
  try { sessionStorage.setItem(_flowStatePrefix + key, value); }
  catch(e) { /* silent — private browsing may block storage */ }
}
function flowRemove(key) {
  try { sessionStorage.removeItem(_flowStatePrefix + key); }
  catch(e) {}
}
function flowClear() {
  try {
    ['pending_contact','pending_join','event_flow','post_tags_destination'].forEach(function(k) {
      sessionStorage.removeItem(_flowStatePrefix + k);
    });
  } catch(e) {}
}

