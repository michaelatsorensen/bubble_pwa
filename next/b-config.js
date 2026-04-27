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
const BUILD_TIMESTAMP = '2026-04-06T13:08:12';
const BUILD_VERSION  = 'next-v7.67';
const SUPABASE_URL  = "https://api.bubbleme.dk";
const SUPABASE_ANON_KEY = "sb_publishable_y6BftA4RQw91dLHPXIncag_oGomBk-A";
const GIPHY_API_KEY = "5GbVR1NiodxCj61uImKnLydncCGdNGfi";

var hsDefaults = { radar: true, saved: true, feedback: true, profile_cta: true };

// ══════════════════════════════════════════════════════════
//  GLOBAL ERROR HANDLERS + ERROR LOGGING + EMAIL ALERTS
// ══════════════════════════════════════════════════════════
var _errorLog = [];
var ERROR_LOG_MAX = 50;
var _bootTs = Date.now();

// ── Client state snapshot for diagnostics ──
function getClientState() {
  var sw = 'none';
  try {
    if (navigator.serviceWorker && navigator.serviceWorker.controller) sw = 'active';
  } catch(e) { /* */ }
  var rt = {};
  if (typeof _rtChannelStates !== 'undefined') {
    Object.keys(_rtChannelStates).forEach(function(k) { rt[k] = _rtChannelStates[k]; });
  }
  var push = 'unsupported';
  try { if ('Notification' in window) push = Notification.permission; } catch(e) { /* */ }
  // Flow flags
  var flows = {};
  ['pending_contact', 'pending_join', 'event_flow', 'post_tags_destination'].forEach(function(k) {
    var v = typeof flowGet === 'function' ? flowGet(k) : null;
    if (v) flows[k] = v;
  });
  return {
    v: BUILD_VERSION,
    sw: sw,
    // Navigation
    screen: (typeof navState !== 'undefined' && navState.screen) || null,
    overlay: (typeof navState !== 'undefined' && navState.overlay) || null,
    modal: (typeof navState !== 'undefined' && navState.modal) || null,
    navStack: (typeof _navStack !== 'undefined') ? _navStack.slice(-5) : [],
    // App mode
    mode: appMode.get(),
    live: appMode.live ? appMode.live.bubbleId : null,
    checkins: appMode.checkedInIds ? appMode.checkedInIds.length : 0,
    // Chat context
    chatUser: (typeof currentChatUser !== 'undefined' && currentChatUser) || null,
    chatName: (typeof currentChatName !== 'undefined' && currentChatName) || null,
    bcId: (typeof bcBubbleId !== 'undefined' && bcBubbleId) || null,
    bcName: (typeof bcBubbleData !== 'undefined' && bcBubbleData && bcBubbleData.name) || null,
    person: (typeof currentPerson !== 'undefined' && currentPerson) || null,
    personSheet: (typeof navState !== 'undefined' && navState.personSheetId) || null,
    // Flow flags
    flows: flows,
    // Realtime
    rt: rt,
    rtRetry: (typeof _rtReconnectAttempt !== 'undefined') ? _rtReconnectAttempt : 0,
    // Device
    push: push,
    online: navigator.onLine,
    uptime: Math.round((Date.now() - _bootTs) / 1000),
    ua: _shortUA()
  };
}
function _shortUA() {
  var u = navigator.userAgent || '';
  var os = /iPhone|iPad/.test(u) ? 'iOS' : /Android/.test(u) ? 'Android' : /Mac/.test(u) ? 'Mac' : /Win/.test(u) ? 'Win' : 'Other';
  var br = /CriOS/.test(u) ? 'Chrome' : /FxiOS/.test(u) ? 'Firefox' : /Safari/.test(u) && !/Chrome/.test(u) ? 'Safari' : /Chrome/.test(u) ? 'Chrome' : 'Other';
  var ver = '';
  if (os === 'iOS') { var m = u.match(/OS (\d+[_\.]\d+)/); if (m) ver = ' ' + m[1].replace('_','.'); }
  else if (os === 'Android') { var m2 = u.match(/Android (\d+[\.\d]*)/); if (m2) ver = ' ' + m2[1]; }
  return os + ver + ' / ' + br;
}

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

  // Persist to Supabase error_log table (enriched with client state)
  if (typeof sb !== 'undefined' && sb && currentUser) {
    var cs = getClientState();
    var extraObj = extra ? (typeof extra === 'object' ? extra : { raw: extra }) : {};
    extraObj._cs = cs;
    sb.from('error_log').insert({
      user_id: currentUser.id,
      context: context,
      message: entry.msg,
      stack: entry.stack,
      extra: JSON.stringify(extraObj)
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
    el.textContent = '❌ Promise fejl: ' + (e.reason?.message || e.reason || t('misc_unknown'));
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
let cbChips = [], epChips = [], epDynChips = [], ebChips = [], obChips = [], obDynChips = [];
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
    if (typeof translateStaticUI === 'function') translateStaticUI();
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

// ── Centralized flow state ──
// Primary mechanism: URL params via OAuth redirectTo (see b-auth.js getOAuthRedirectTo)
// Fallback: localStorage with 5-min TTL (enough for OAuth + slow WiFi)
// Keys: pending_contact, pending_join, event_flow, post_tags_destination
// Single storage — sessionStorage removed (added complexity without value;
// localStorage alone is sufficient since URL params handle cross-redirect survival)
var _flowStatePrefix = 'bf_'; // bf = bubble flow
var _flowTTL = 15 * 60 * 1000; // 15 minutes — enough for email confirmation + OAuth redirect

function flowGet(key) {
  var k = _flowStatePrefix + key;
  try {
    var raw = localStorage.getItem(k);
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed.exp > Date.now()) return parsed.val;
      localStorage.removeItem(k); // expired — clean up
    }
  } catch(e) {}
  return null;
}

function flowSet(key, value) {
  var k = _flowStatePrefix + key;
  var wrapped = JSON.stringify({ val: value, exp: Date.now() + _flowTTL });
  try { localStorage.setItem(k, wrapped); } catch(e) {}
}

function flowRemove(key) {
  var k = _flowStatePrefix + key;
  try { localStorage.removeItem(k); } catch(e) {}
}

// Atomic read-and-clear — prevents flag from being read twice
function consumeFlow(key) {
  var val = flowGet(key);
  if (val) flowRemove(key);
  return val;
}

// Safety clear — removes ALL flow flags to prevent stale state
function flowClearAll() {
  ['pending_contact', 'pending_join', 'event_flow', 'post_tags_destination'].forEach(function(key) {
    flowRemove(key);
  });
}

// ══════════════════════════════════════════════════════════
//  SAFE APP RESET — clears ALL session state on logout
//  Prevents state leakage between user sessions
// ══════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════
//  STATE REGISTRY — modules register their own cleanup
//  Usage: registerState(function() { myVar = null; myFlag = false; })
//  resetAppState() iterates the registry automatically.
//  This prevents "forgot to reset" bugs when adding new state.
// ══════════════════════════════════════════════════════════
var _stateRegistry = [];
function registerState(resetFn) {
  if (typeof resetFn === 'function') _stateRegistry.push(resetFn);
}

function resetAppState() {
  // Auth / user
  currentUser = null;
  currentProfile = null;
  currentBubble = null;
  currentPerson = null;
  currentChatUser = null;
  currentChatName = null;
  currentLiveBubble = null;
  isAnon = false;
  allBubbles = [];
  cbChips = []; epChips = []; epDynChips = []; ebChips = []; obChips = []; obDynChips = [];
  // Subscriptions — unsubscribe before nullifying to prevent orphaned channels
  try { if (chatSubscription) chatSubscription.unsubscribe(); } catch(e) {}
  chatSubscription = null;

  // App mode / live
  appMode.clearLive();

  // Navigation
  _navVersion = 0;
  _activeScreen = null;
  _navStack = [];
  navState.screen = null;
  navState.overlay = null;
  navState.modal = null;
  navState.chatTarget = null;
  navState.bubbleChatId = null;
  navState.personSheetId = null;

  // Flow flags — NOT cleared here; only in explicit logout + resolvePostAuthDestination
  // (resetAppState fires on stale SIGNED_OUT events which would wipe deep-link flags)

  // Home / radar
  if (typeof _homeDartboardProfiles !== 'undefined') _homeDartboardProfiles = [];
  if (typeof _dartboardDataLoaded !== 'undefined') _dartboardDataLoaded = false;
  if (typeof _homeLoading !== 'undefined') _homeLoading = false;
  if (typeof proxAllProfiles !== 'undefined') proxAllProfiles = [];

  // Chat — unsubscribe before nullifying
  try { if (typeof bcSubscription !== 'undefined' && bcSubscription) bcSubscription.unsubscribe(); } catch(e) {}
  if (typeof bcBubbleId !== 'undefined') bcBubbleId = null;
  if (typeof bcBubbleData !== 'undefined') bcBubbleData = null;
  if (typeof bcSubscription !== 'undefined') bcSubscription = null;
  if (typeof bcEditingId !== 'undefined') bcEditingId = null;
  if (typeof bcCurrentMsgId !== 'undefined') bcCurrentMsgId = null;
  if (typeof bcMsgHistories !== 'undefined') bcMsgHistories = {};
  if (typeof dmEditingId !== 'undefined') dmEditingId = null;
  if (typeof dmSending !== 'undefined') dmSending = false;
  if (typeof _authLock !== 'undefined') _authLock = false;
  if (typeof _liveLock !== 'undefined') _liveLock = false;
  if (typeof _bbSubmitLock !== 'undefined') _bbSubmitLock = false;
  if (typeof _postSubmitLock !== 'undefined') _postSubmitLock = false;

  // Unread / badges
  if (typeof unreadState !== 'undefined') unreadState.reset();
  if (typeof _unreadCount !== 'undefined') _unreadCount = 0;

  // Profile cache
  if (typeof _profileCache !== 'undefined') _profileCache = {};
  if (typeof _blockedUsers !== 'undefined') _blockedUsers = [];

  // Timers
  if (typeof _radarRefreshTimer !== 'undefined' && _radarRefreshTimer) { clearInterval(_radarRefreshTimer); _radarRefreshTimer = null; }
  if (typeof _dmBroadcastTypingTimer !== 'undefined' && _dmBroadcastTypingTimer) { clearTimeout(_dmBroadcastTypingTimer); _dmBroadcastTypingTimer = null; }

  // Module-registered cleanup (registerState pattern)
  _stateRegistry.forEach(function(fn) { try { fn(); } catch(e) {} });

  // Admin debug cleanup
  try { if (typeof _debugChannel !== 'undefined' && _debugChannel) _debugChannel.unsubscribe(); } catch(e) {}
  if (typeof _debugChannel !== 'undefined') _debugChannel = null;
  if (typeof _debugOverlayOpen !== 'undefined') _debugOverlayOpen = false;
  var debugFab = document.getElementById('admin-debug-fab');
  if (debugFab) debugFab.remove();
  var debugOv = document.getElementById('debug-overlay');
  if (debugOv) debugOv.classList.remove('open');

  if (typeof _bubbleUnreadSet !== 'undefined') _bubbleUnreadSet = {};

  console.debug('[resetAppState] All session state cleared');
}

// ══════════════════════════════════════════════════════════
//  APP MODE — SINGLE SOURCE OF TRUTH for app state + live context
//  Modes: 'normal' | 'live' | 'event' | 'guest'
//  Live state: bubble context + checked-in user IDs
//  Writers: appMode.set() / appMode.clearLive() / appMode.setCheckedInIds()
//  Readers: appMode.is(), appMode.get(), appMode.live, appMode.checkedInIds
// ══════════════════════════════════════════════════════════
var appMode = {
  _mode: 'normal',
  _liveCtx: null, // { bubbleId, bubbleName, memberCount, expiryStr }
  _checkedInIds: [], // user IDs currently checked in to active live bubble

  // Read
  get: function() { return this._mode; },
  is: function(m) { return this._mode === m; },
  get live() { return this._liveCtx; },
  get checkedInIds() { return this._checkedInIds; },

  // Write
  set: function(mode, ctx) {
    this._mode = mode || 'normal';
    if (mode === 'live' && ctx) {
      this._liveCtx = ctx;
      // Sync legacy global — add both camelCase + snake_case aliases
      // so code reading currentLiveBubble.bubble_id OR .bubbleId both work
      currentLiveBubble = ctx;
      if (ctx.bubbleId && !ctx.bubble_id) ctx.bubble_id = ctx.bubbleId;
      if (ctx.bubbleName && !ctx.bubble_name) ctx.bubble_name = ctx.bubbleName;
      if (ctx.bubbleType && !ctx.bubble_type) ctx.bubble_type = ctx.bubbleType;
      if (ctx.memberCount != null && ctx.member_count == null) ctx.member_count = ctx.memberCount;
    } else if (mode !== 'live') {
      this._liveCtx = null;
      currentLiveBubble = null;
      this._checkedInIds = [];
    }
  },
  setCheckedInIds: function(ids) {
    this._checkedInIds = ids || [];
  },
  clearLive: function() {
    this._mode = 'normal';
    this._liveCtx = null;
    this._checkedInIds = [];
    currentLiveBubble = null;
  }
};

// ── UUID validator: used to validate IDs from URL params before storing as flow flags ──
// Prevents injection attacks via ?profile=<malicious> or ?join=<malicious>
var _uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(s) { return typeof s === 'string' && _uuidRe.test(s); }
