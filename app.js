// ══════════════════════════════════════════════════════════
//  CONFIGURATION
// ══════════════════════════════════════════════════════════
const SUPABASE_URL  = "https://pfxcsjjxvdtpsfltexka.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_y6BftA4RQw91dLHPXIncag_oGomBk-A";

// ══════════════════════════════════════════════════════════
//  GLOBAL ERROR HANDLERS
// ══════════════════════════════════════════════════════════
window.onerror = function(msg, src, line, col, err) {
  const el = document.getElementById('loading-msg');
  if (el) {
    el.textContent = '❌ JS Fejl linje ' + line + ': ' + msg;
    el.style.color = '#E85D8A';
    el.style.fontSize = '0.75rem';
    el.style.maxWidth = '320px';
    el.style.margin = '1rem auto';
  }
  console.error('Global error:', msg, 'line:', line, err);
  return false;
};
window.onunhandledrejection = function(e) {
  const el = document.getElementById('loading-msg');
  if (el) {
    el.textContent = '❌ Promise fejl: ' + (e.reason?.message || e.reason || 'Ukendt');
    el.style.color = '#E85D8A';
  }
  console.error('Unhandled rejection:', e.reason);
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

// ── GLOBAL ERROR HANDLER ──
window.addEventListener('error', function(e) {
  console.error('Global error:', e.message, e.filename, e.lineno);
  if (typeof showToast === 'function') showToast('Noget gik galt \u2013 pr\u00f8v igen');
});
window.addEventListener('unhandledrejection', function(e) {
  console.error('Unhandled promise:', e.reason);
  if (typeof showToast === 'function') showToast('Noget gik galt \u2013 pr\u00f8v igen');
});

function initSupabase() {
  if (SUPABASE_URL === "DIN_SUPABASE_URL_HER") {
    document.getElementById('loading-msg').textContent = '⚠️ Indsæt dine Supabase-nøgler i filen';
    document.getElementById('loading-msg').style.color = '#E85D8A';
    return false;
  }
  try {
    sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return true;
  } catch(e) {
    document.getElementById('loading-msg').textContent = 'Fejl: ' + e.message;
    return false;
  }
}

// ══════════════════════════════════════════════════════════
//  NAVIGATION
// ══════════════════════════════════════════════════════════
function goTo(screenId) {
  console.debug('[nav] goTo:', screenId);
  // Cleanup: unsubscribe when leaving chat screens
  const prev = document.querySelector('.screen.active');
  if (prev) {
    const prevId = prev.id;
    if (prevId === 'screen-chat' && screenId !== 'screen-chat') {
      if (chatSubscription) { chatSubscription.unsubscribe(); chatSubscription = null; }
      dmEditingId = null;
    }
    if (prevId === 'screen-bubble-chat' && screenId !== 'screen-bubble-chat') {
      if (bcSubscription) { bcSubscription.unsubscribe(); bcSubscription = null; }
      bcEditingId = null;
      bcCurrentMsgId = null;
      bcCloseContext();
    }
  }
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(screenId);
  if (!target) { console.error('[nav] screen not found:', screenId); return; }
  target.classList.add('active');
  window.scrollTo(0,0);

  // Update bottom nav active state
  const navMap = {
    'screen-home': 0, 'screen-bubbles': 0,
    'screen-discover': 1,
    'screen-messages': 2, 'screen-chat': 2, 'screen-bubble-chat': 2,
    'screen-profile': 3,
    'screen-notifications': -1, 'screen-person': -1
  };
  const activeIdx = navMap[screenId];
  if (activeIdx !== undefined) {
    document.querySelectorAll('.bottom-nav').forEach(nav => {
      nav.querySelectorAll('.nav-item').forEach((btn, i) => {
        btn.classList.toggle('active', i === activeIdx);
      });
    });
  }

  // Load data for screen
  if (screenId === 'screen-home') loadHome();
  if (screenId === 'screen-bubbles') loadMyBubbles();
  if (screenId === 'screen-notifications') loadNotifications();
  if (screenId === 'screen-discover') loadDiscover();
  if (screenId === 'screen-messages') loadMessages();
  if (screenId === 'screen-profile') loadProfile();
}

// ══════════════════════════════════════════════════════════
//  AUTH
// ══════════════════════════════════════════════════════════
async function checkAuth() {
  if (!initSupabase()) return;
  try {
    // Handle OAuth redirect — Supabase v2 processes hash automatically
    if (window.location.hash && window.location.hash.includes('access_token')) {
      document.getElementById('loading-msg').textContent = 'Logger ind via Google...';
      // Give Supabase a moment to process the hash
      await new Promise(r => setTimeout(r, 500));
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    const { data: { session } } = await sb.auth.getSession();
    if (session) {
      currentUser = session.user;
      // Ensure profile row exists (Google users may not have one)
      const { data: existingProfile } = await sb.from('profiles').select('id').eq('id', session.user.id).single();
      if (!existingProfile) {
        const meta = session.user.user_metadata || {};
        await sb.from('profiles').upsert({
          id: session.user.id,
          name: meta.full_name || meta.name || session.user.email,
          title: '', keywords: [], dynamic_keywords: [], bio: '', is_anon: false
        });
      }
      await loadCurrentProfile();
      const needsOnboarding = await maybeShowOnboarding();
      if (!needsOnboarding) goTo('screen-home');
    } else {
      goTo('screen-auth');
    }
  } catch(e) {
    document.getElementById('loading-msg').textContent = 'Fejl: ' + e.message;
    document.getElementById('loading-msg').style.color = '#E85D8A';
  }
}

async function loadCurrentProfile() {
  try {
    const { data } = await sb.from('profiles').select('*').eq('id', currentUser.id).single();
    if (data) {
      currentProfile = data;
      updateHomeAvatar();
    }
  } catch(e) { console.error("loadCurrentProfile:", e); showToast(e.message || "Ukendt fejl"); }
}

function updateHomeAvatar() {
  if (!currentProfile) return;
  const initials = (currentProfile.name || '?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  document.getElementById('home-avatar').textContent = initials;
  document.getElementById('my-avatar').textContent = initials;
}

async function handleLogin() {
  try {
    const email = document.getElementById('login-email').value.trim();
    const pass = document.getElementById('login-password').value;
    if (!email || !pass) return showToast('Udfyld email og adgangskode');
    showToast('Logger ind...');
    const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
    if (error) return showToast('Fejl: ' + error.message);
    currentUser = data.user;
    await loadCurrentProfile();
    const needsOnboarding = await maybeShowOnboarding();
    if (!needsOnboarding) goTo('screen-home');
  } catch(e) { console.error("handleLogin:", e); showToast(e.message || "Ukendt fejl"); }
}

async function handleSignup() {
  try {
    const name  = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const pass  = document.getElementById('signup-password').value;
    const title = document.getElementById('signup-title').value.trim();
    if (!name || !email || !pass) return showToast('Udfyld alle felter');
    if (pass.length < 6) return showToast('Adgangskode skal være min. 6 tegn');
    showToast('Opretter konto...');
    const { data, error } = await sb.auth.signUp({ email, password: pass });
    if (error) return showToast('Fejl: ' + error.message);
    currentUser = data.user;

    // Retry profile creation a few times — auth sometimes needs a moment to propagate
    let profileCreated = false;
    for (let i = 0; i < 5; i++) {
      await new Promise(r => setTimeout(r, 500));
      const { error: profileError } = await sb.from('profiles').upsert({
        id: currentUser.id,
        name, title, keywords: [], dynamic_keywords: [], bio: '', is_anon: false
      });
      if (!profileError) { profileCreated = true; break; }
    }

    if (!profileCreated) {
      showToast('Konto oprettet — udfyld profil under Rediger 👤');
    }

    await loadCurrentProfile();
    const needsOnboarding = await maybeShowOnboarding();
    if (!needsOnboarding) goTo('screen-home');
    showToast('Velkommen til Bubble! 🫧');
  } catch(e) { console.error("handleSignup:", e); showToast(e.message || "Ukendt fejl"); }
}

async function handleLogout() {
  try {
    // Clean up realtime subscriptions
    bcUnsubscribeAll();
    sb.removeAllChannels();
    await sb.auth.signOut();
    currentUser = null; currentProfile = null;
    goTo('screen-auth');
  } catch(e) { console.error("handleLogout:", e); showToast(e.message || "Ukendt fejl"); }
}

function switchToSignup() {
  document.getElementById('auth-login').style.display = 'none';
  document.getElementById('auth-signup').style.display = 'block';
}
function switchToLogin() {
  document.getElementById('auth-signup').style.display = 'none';
  document.getElementById('auth-login').style.display = 'block';
}

// ══════════════════════════════════════════════════════════
//  HOME
// ══════════════════════════════════════════════════════════
async function loadHome() {
  try {
    if (!currentProfile) await loadCurrentProfile();
    updateHomeAvatar();

    // Greeting
    const nameEl = document.getElementById('home-greeting-name');
    if (nameEl && currentProfile?.name) {
      nameEl.innerHTML = (currentProfile.name.split(' ')[0]) + ' ' + icon('wave');
    }

    // Load all dashboard data in parallel
    await Promise.all([
      loadHomeBubblesCard(),
      loadHomeMessagesCard(),
      loadHomeNotifCard(),
      updateRadarCount(),
      loadProximityMap(),
      loadLiveBubbleStatus(),
    ]);
  } catch(e) { console.error("loadHome:", e); showToast(e.message || "Ukendt fejl"); }
}

async function loadHomeBubblesCard() {
  try {
    const sub = document.getElementById('home-bubbles-sub');
    const badge = document.getElementById('home-bubbles-badge');
    const { data: memberships } = await sb.from('bubble_members').select('bubble_id').eq('user_id', currentUser.id);
    const count = memberships?.length || 0;
    if (sub) sub.textContent = count > 0 ? `${count} aktiv${count !== 1 ? 'e' : ''} boble${count !== 1 ? 'r' : ''}` : 'Du er ikke i nogen bobler endnu';
    if (badge) { badge.textContent = count; badge.style.display = count > 0 ? 'flex' : 'none'; }
  } catch(e) { console.error("loadHomeBubblesCard:", e); showToast(e.message || "Ukendt fejl"); }
}

async function loadHomeMessagesCard() {
  try {
    const sub = document.getElementById('home-messages-sub');
    const badge = document.getElementById('home-messages-badge');
    const { data: msgs } = await sb.from('messages')
      .select('*').or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
      .order('created_at', {ascending:false}).limit(1);
    const { count: unread } = await sb.from('messages')
      .select('*', {count:'exact',head:true}).eq('receiver_id', currentUser.id).is('read_at', null);
    if (sub) sub.textContent = unread > 0 ? `${unread} ulæste beskeder` : msgs?.length > 0 ? `Sidst: "${msgs[0].content?.slice(0,30)}..."` : 'Ingen beskeder endnu';
    if (badge) { badge.textContent = unread; badge.style.display = unread > 0 ? 'flex' : 'none'; }
  } catch(e) { console.error("loadHomeMessagesCard:", e); showToast(e.message || "Ukendt fejl"); }
}

async function loadHomeNotifCard() {
  try {
    const sub = document.getElementById('home-notif-sub');
    const badge = document.getElementById('home-notif-badge');
    // Count new bubble members since last 7 days
    const since = new Date(Date.now() - 7*24*60*60*1000).toISOString();
    const { data: memberships } = await sb.from('bubble_members').select('bubble_id').eq('user_id', currentUser.id);
    if (!memberships || memberships.length === 0) {
      if (sub) sub.textContent = 'Ingen notifikationer';
      return;
    }
    const ids = memberships.map(m => m.bubble_id);
    const { count } = await sb.from('bubble_members')
      .select('*', {count:'exact',head:true})
      .in('bubble_id', ids).neq('user_id', currentUser.id).gte('joined_at', since);
    const n = count || 0;
    if (sub) sub.textContent = n > 0 ? `${n} nye i dine bobler` : 'Ingen nye notifikationer';
    if (badge) { badge.textContent = n; badge.style.display = n > 0 ? 'flex' : 'none'; }
  } catch(e) { console.error("loadHomeNotifCard:", e); showToast(e.message || "Ukendt fejl"); }
}

async function loadMyBubbles() {
  try {
    const ownedList  = document.getElementById('my-owned-bubbles-list');
    const joinedList = document.getElementById('my-bubbles-list');
    ownedList.innerHTML  = '<div class="spinner"></div>';
    joinedList.innerHTML = '<div class="spinner"></div>';

    const { data: memberships } = await sb.from('bubble_members')
      .select('bubble_id').eq('user_id', currentUser.id);

    if (!memberships || memberships.length === 0) {
      ownedList.innerHTML  = '<div class="sub-muted" style="padding:0.5rem 0">Du har ikke oprettet nogen bobler endnu.</div>';
      joinedList.innerHTML = '<div class="empty-state"><div class="empty-icon">' + icon('bubble') + '</div><div class="empty-text">Du er ikke i nogen bobler endnu.<br>Opdag eller opret en boble!</div></div>';
      return;
    }

    const ids = memberships.map(m => m.bubble_id);
    const { data: bubbles } = await sb.from('bubbles').select('*').in('id', ids);
    if (!bubbles || bubbles.length === 0) {
      ownedList.innerHTML = joinedList.innerHTML = '';
      return;
    }

    const owned  = bubbles.filter(b => b.created_by === currentUser.id);
    const joined = bubbles.filter(b => b.created_by !== currentUser.id);

    // Owned bubbles — show with visibility badge + edit shortcut
    if (owned.length === 0) {
      ownedList.innerHTML = '<div class="sub-muted" style="padding:0.5rem 0">Du har ikke oprettet nogen bobler endnu.</div>';
    } else {
      ownedList.innerHTML = owned.map(b => {
        const visIcon = b.visibility === 'private' ? icon('lock') : b.visibility === 'hidden' ? icon('eye') : icon('globe');
        return `<div class="card flex-row-center" data-action="openBubble" data-id="${b.id}">
          <div class="bubble-icon" style="background:${bubbleColor(b.type, 0.15)}">${bubbleEmoji(b.type)}</div>
          <div style="flex:1">
            <div class="fw-600 fs-09">${escHtml(b.name)}</div>
            <div class="fs-075 text-muted">${visIcon} ${b.type_label||b.type}${b.location ? ' · '+escHtml(b.location) : ''}</div>
          </div>
          <div style="display:flex;gap:0.4rem;align-items:center">
            <button class="btn-sm btn-ghost" data-action="openEditBubble" data-id="${b.id}" onclick="event.stopPropagation()" style="font-size:0.8rem;padding:0.3rem 0.5rem">${icon("edit")}</button>
            <div class="live-dot"></div>
          </div>
        </div>`;
      }).join('');
    }

    // Joined bubbles
    if (joined.length === 0) {
      joinedList.innerHTML = '<div class="sub-muted" style="padding:0.5rem 0">Du er ikke medlem af andres bobler endnu.</div>';
    } else {
      joinedList.innerHTML = joined.map(b => bubbleCard(b, true)).join('');
    }

    // Profile bubbles
    document.getElementById('profile-bubbles').innerHTML = bubbles.map(b =>
      `<div class="card flex-row-center" data-action="openBubble" data-id="${b.id}" style="padding:0.85rem 1.1rem">
        <div class="bubble-icon" style="background:${bubbleColor(b.type, 0.15)};flex-shrink:0">${bubbleEmoji(b.type)}</div>
        <div style="flex:1;min-width:0">
          <div class="fw-600 fs-09">${escHtml(b.name)}</div>
          <div class="fs-075 text-muted">${b.created_by === currentUser.id ? icon('crown') + ' Ejer' : 'Aktiv'}${b.location ? ' · ' + escHtml(b.location) : ''}</div>
        </div>
        <div class="icon-muted">›</div>
      </div>`).join('');
  } catch(e) { console.error("loadMyBubbles:", e); showToast(e.message || "Ukendt fejl"); }
}

async function updateRadarCount() {
  try {
    const { data: memberships } = await sb.from('bubble_members').select('bubble_id').eq('user_id', currentUser.id);
    const rcEl = document.getElementById('radar-count-home');
    if (!memberships || memberships.length === 0) {
      if (rcEl) rcEl.textContent = ' · Join en boble for at se matches';
      return;
    }
    const ids = memberships.map(m => m.bubble_id);
    const { count } = await sb.from('bubble_members').select('*', {count:'exact',head:true}).in('bubble_id', ids).neq('user_id', currentUser.id);
    if (rcEl) rcEl.textContent = ` · ${count || 0} profiler synlige i dine bobler`;
  } catch(e) { console.error("updateRadarCount:", e); showToast(e.message || "Ukendt fejl"); }
}

function bubbleCard(b, joined) {
  return `<div class="card flex-row-center" data-action="openBubble" data-id="${b.id}">
    <div class="bubble-icon" style="background:${bubbleColor(b.type, 0.15)}">${bubbleIcon(b.type)}</div>
    <div style="flex:1">
      <div class="fw-600 fs-09">${escHtml(b.name)}</div>
      <div class="fs-075 text-muted">${escHtml(b.type_label || b.type)} ${b.location ? '· ' + escHtml(b.location) : ''}</div>
    </div>
    <div class="flex-col-end">
      <div class="fw-700">${b.member_count || ''}</div>
      ${joined ? '<div class="live-dot"></div>' : '<div class="fs-09" style="color:var(--accent)">+</div>'}
    </div>
  </div>`;
}

// ══════════════════════════════════════════════════════════
//  DISCOVER
// ══════════════════════════════════════════════════════════
async function loadDiscover() {
  try {
    const list = document.getElementById('all-bubbles-list');
    list.innerHTML = '<div class="spinner"></div>';
    const { data: bubbles } = await sb.from('bubbles').select('*, bubble_members(count)').or('visibility.eq.public,visibility.eq.private,visibility.is.null').order('created_at', {ascending:false});
    allBubbles = (bubbles || []).filter(b => b.type !== 'live').map(b => ({
      ...b,
      member_count: b.bubble_members?.[0]?.count || 0,
      type_label: typeLabel(b.type)
    }));
    renderBubbleList(allBubbles);
  } catch(e) { console.error("loadDiscover:", e); showToast(e.message || "Ukendt fejl"); }
}

function renderBubbleList(bubbles) {
  const list = document.getElementById('all-bubbles-list');
  if (!bubbles.length) {
    list.innerHTML = '<div class="empty-state"><div class="empty-icon">' + icon('search') + '</div><div class="empty-text">Ingen bobler endnu.<br>Opret den første!</div></div>';
    return;
  }
  list.innerHTML = bubbles.map(b => bubbleCard(b, false)).join('');
}

let _filterTimer = null;
function filterBubbles() {
  clearTimeout(_filterTimer);
  _filterTimer = setTimeout(() => {
    const q = document.getElementById('bubble-search').value.toLowerCase();
    const filtered = q ? allBubbles.filter(b =>
      b.name.toLowerCase().includes(q) || (b.keywords || []).some(k => k.toLowerCase().includes(q))
    ) : allBubbles;
    renderBubbleList(filtered);
  }, 150);
}

// ══════════════════════════════════════════════════════════
//  BUBBLE DETAIL
// ══════════════════════════════════════════════════════════
async function openBubble(bubbleId, fromScreen) {
  try {
    // Kald openBubbleChat direkte — detail-siden er nu integreret i chat-skærmen
    await openBubbleChat(bubbleId, fromScreen);
  } catch(e) { console.error("openBubble:", e); showToast(e.message || "Ukendt fejl"); }
}

// loadBubbleMembers removed — integrated into screen-bubble-chat bcLoadMembers

async function joinBubble(bubbleId) {
  try {
    const { error } = await sb.from('bubble_members').insert({ bubble_id: bubbleId, user_id: currentUser.id });
    if (error && !error.message.includes('duplicate')) return showToast('Fejl ved joining');
    showToast('Du er nu i boblen! 🫧');
    await openBubble(bubbleId);
    loadHome();
  } catch(e) { console.error("joinBubble:", e); showToast(e.message || "Ukendt fejl"); }
}

async function leaveBubble(bubbleId) {
  try {
    await sb.from('bubble_members').delete().eq('bubble_id', bubbleId).eq('user_id', currentUser.id);
    showToast('Du har forladt boblen');
    goTo('screen-home');
  } catch(e) { console.error("leaveBubble:", e); showToast(e.message || "Ukendt fejl"); }
}

// ══════════════════════════════════════════════════════════
//  PERSON PROFILE
// ══════════════════════════════════════════════════════════
async function openPerson(userId, fromScreen) {
  try {
    currentPerson = userId;
    const backBtn = document.getElementById('person-back-btn');
    backBtn.onclick = () => goTo(fromScreen || 'screen-home');
    goTo('screen-person');

    const { data: p } = await sb.from('profiles').select('*').eq('id', userId).single();
    if (!p) return;

    const initials = p.is_anon ? '?' : (p.name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    document.getElementById('person-avatar').textContent = initials;
    document.getElementById('person-name').textContent = p.is_anon ? 'Anonym bruger' : (p.name || '?');
    document.getElementById('person-role').textContent = p.is_anon ? '' : (p.title || '');

    const myKw = (currentProfile?.keywords || []).map(k => k.toLowerCase());
    const theirKw = (p.keywords || []).map(k => k.toLowerCase());
    const overlap = myKw.filter(k => theirKw.includes(k));
    // Deterministisk match-score: overlap-ratio + base-bonus baseret på profil-komplethed
    const overlapRatio = overlap.length / Math.max(myKw.length, theirKw.length, 1);
    const profileBonus = (p.bio ? 10 : 0) + (p.title ? 10 : 0) + (p.linkedin ? 5 : 0);
    const score = theirKw.length
      ? Math.round(overlapRatio * 60 + 30 + profileBonus)
      : Math.round(30 + profileBonus);
    document.getElementById('person-match-label').textContent = `Match: ${Math.min(score,99)}%`;

    document.getElementById('person-tags').innerHTML = (p.keywords||[]).map(k => `<span class="tag">${escHtml(k)}</span>`).join('');
    document.getElementById('person-bio').textContent = p.bio || '';

    // LinkedIn button
    const liBtn = document.getElementById('person-linkedin-btn');
    if (p.linkedin && !p.is_anon) {
      liBtn.style.display = 'flex';
      liBtn.style.flexDirection = 'column';
      liBtn.href = p.linkedin.startsWith('http') ? p.linkedin : 'https://' + p.linkedin;
    } else {
      liBtn.style.display = 'none';
    }

    const overlapEl = document.getElementById('person-overlap');
    if (overlap.length) {
      overlapEl.innerHTML = overlap.map(k => `<span class="tag mint">${icon("check")} ${escHtml(k)}</span>`).join('');
    } else {
      overlapEl.innerHTML = '<span class="fs-085 text-muted">Ingen direkte overlap fundet</span>';
    }

    const dynEl = document.getElementById('person-dynamic-keywords');
    if ((p.dynamic_keywords||[]).length) {
      dynEl.innerHTML = '<div class="section-label">Søger nu</div>' + p.dynamic_keywords.map(k => `<span class="tag gold">${icon("fire")} ${escHtml(k)}</span>`).join('');
    } else { dynEl.innerHTML = ''; }

    // Check if saved
    const { data: savedCheck } = await sb.from('saved_contacts').select('id').eq('user_id', currentUser.id).eq('contact_id', userId).maybeSingle();
    document.getElementById('save-btn').innerHTML = savedCheck ? icon('checkCircle') + '<span>Gemt</span>' : icon('bookmark') + '<span>Gem</span>';
  } catch(e) { console.error("openPerson:", e); showToast(e.message || "Ukendt fejl"); }
}

async function saveContact() {
  try {
    if (!currentPerson) return;
    const { data: existing } = await sb.from('saved_contacts').select('id').eq('user_id', currentUser.id).eq('contact_id', currentPerson).maybeSingle();
    if (existing) { showToast('Allerede gemt'); return; }
    await sb.from('saved_contacts').insert({ user_id: currentUser.id, contact_id: currentPerson });
    document.getElementById('save-btn').innerHTML = icon('checkCircle') + '<span>Gemt</span>';
    showToast('Kontakt gemt!');
    loadSavedContacts();
  } catch(e) { console.error("saveContact:", e); showToast(e.message || "Ukendt fejl"); }
}

let pendingRemoveSavedId = null;
let pendingRemoveBtn = null;

function removeSavedContact(savedId, btn) {
  pendingRemoveSavedId = savedId;
  pendingRemoveBtn = btn;
  // Show inline confirm on the card
  const card = btn.closest('.card');
  if (!card) return;
  // Prevent double-confirm
  if (card.querySelector('.remove-confirm')) return;
  const confirm = document.createElement('div');
  confirm.className = 'remove-confirm';
  confirm.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:0.5rem 0.6rem;margin-top:0.4rem;background:rgba(232,93,138,0.08);border:1px solid rgba(232,93,138,0.2);border-radius:10px;gap:0.5rem';
  confirm.innerHTML = `<span style="font-size:0.72rem;color:var(--text-secondary)">Fjern kontakt?</span>
    <div style="display:flex;gap:0.3rem">
      <button class="btn-sm btn-ghost" style="padding:0.25rem 0.6rem;font-size:0.7rem;color:var(--accent2);border-color:rgba(232,93,138,0.3)" onclick="confirmRemoveSaved()">Fjern</button>
      <button class="btn-sm btn-ghost" style="padding:0.25rem 0.6rem;font-size:0.7rem" onclick="cancelRemoveSaved(this)">Annuller</button>
    </div>`;
  card.appendChild(confirm);
}

function cancelRemoveSaved(btn) {
  const confirm = btn.closest('.remove-confirm');
  if (confirm) confirm.remove();
  pendingRemoveSavedId = null;
  pendingRemoveBtn = null;
}

async function confirmRemoveSaved() {
  if (!pendingRemoveSavedId) return;
  const savedId = pendingRemoveSavedId;
  const btn = pendingRemoveBtn;
  pendingRemoveSavedId = null;
  pendingRemoveBtn = null;
  try {
    await sb.from('saved_contacts').delete().eq('id', savedId);
    const card = btn?.closest('.card');
    if (card) {
      card.style.transition = 'opacity 0.25s, transform 0.25s';
      card.style.opacity = '0';
      card.style.transform = 'translateX(20px)';
      setTimeout(() => loadSavedContacts(), 260);
    } else {
      loadSavedContacts();
    }
    showToast('Kontakt fjernet');
  } catch(e) { console.error("confirmRemoveSaved:", e); showToast(e.message || "Ukendt fejl"); }
}

// proposeMeeting / sendMeetingProposal removed — feature shelved


// PROXIMITY MAP / RADAR
var proxVisible = true;
var proxRange = 5;
var proxAllProfiles = [];
var proxColors = ['linear-gradient(135deg,#8B7FFF,#A89FFF)','linear-gradient(135deg,#E85D8A,#FF8C69)','linear-gradient(135deg,#2ECFCF,#8B7FFF)','linear-gradient(135deg,#FF8C69,#E85D8A)','linear-gradient(135deg,#065F46,#10B981)','linear-gradient(135deg,#1E3A8A,#7C3AED)','linear-gradient(135deg,#0C4A6E,#38BDF8)'];
// Radar (map): relevance labels + thresholds — "who matches me?"
var proxRangeLabels = ['Nær match','Gode matches','Alle matches','Udvidet','Alle'];
var proxThresholds  = [0.6, 0.35, 0.15, 0.05, 0];
// List: proximity labels — "who is nearby?" (GPS-ready, simulated for now)
var listRangeLabels = ['50m','200m','500m','2km','10km'];

async function loadProximityMap() {
  try {
    var map = document.getElementById('proximity-map');
    var emptyEl = document.getElementById('prox-empty');
    var canvas = document.getElementById('prox-canvas');
    if (!map || !canvas) return;
    var r1 = await sb.from('profiles').select('id,name,title,keywords,is_anon').neq('id', currentUser.id).limit(50);
    var allProfiles = r1.data;
    if (!allProfiles || allProfiles.length === 0) { map.style.display = 'none'; if (emptyEl) emptyEl.style.display = 'block'; return; }
    map.style.display = 'block'; if (emptyEl) emptyEl.style.display = 'none';
    var r2 = await sb.from('bubble_members').select('bubble_id').eq('user_id', currentUser.id);
    var myBubbleIds = (r2.data || []).map(function(m){ return m.bubble_id; });
    var bmMap = {};
    if (myBubbleIds.length > 0) {
      var r3 = await sb.from('bubble_members').select('user_id,bubble_id').in('bubble_id', myBubbleIds);
      (r3.data || []).forEach(function(bm) { if (!bmMap[bm.user_id]) bmMap[bm.user_id] = []; bmMap[bm.user_id].push(bm.bubble_id); });
    }
    var myKw = (currentProfile && currentProfile.keywords ? currentProfile.keywords : []).map(function(k){ return k.toLowerCase(); });
    proxAllProfiles = allProfiles.map(function(p) {
      var theirKw = (p.keywords || []).map(function(k){ return k.toLowerCase(); });
      var kwOv = myKw.filter(function(k){ return theirKw.indexOf(k) >= 0; }).length;
      var maxKw = Math.max(myKw.length, theirKw.length, 1);
      var shared = (bmMap[p.id] || []).length;
      var rel = (kwOv / maxKw) * 0.6 + Math.min(shared / 3, 1) * 0.4;
      return { id:p.id, name:p.name, title:p.title, keywords:p.keywords, is_anon:p.is_anon, relevance:rel, kwOverlap:kwOv, sharedBubbles:shared };
    }).sort(function(a,b){ return b.relevance - a.relevance; });
    renderProximityDots();
  } catch (e) { console.error('loadProximityMap:', e); }
}

// ── RADAR MAP VIEW ──
// Shows only visible (non-anon) profiles, filtered by relevance threshold
function renderProximityDots() {
  var map = document.getElementById('proximity-map');
  var av = document.getElementById('prox-avatars');
  var canvas = document.getElementById('prox-canvas');
  var emptyEl = document.getElementById('prox-empty');
  if (!map || !av || !canvas) return;

  var threshold = proxThresholds[proxRange-1] || 0;
  // Radar = only visible profiles (not anonymous)
  var fil = proxAllProfiles.filter(function(p) { return !p.is_anon && p.relevance >= threshold; });

  if (fil.length === 0) { av.innerHTML = ''; drawProxRings(canvas); if (emptyEl) emptyEl.style.display = 'block'; return; }
  if (emptyEl) emptyEl.style.display = 'none';
  drawProxRings(canvas);

  var ce = document.getElementById('prox-center');
  if (ce && currentProfile && currentProfile.name) {
    ce.textContent = currentProfile.name.split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();
  }

  var w = map.offsetWidth || 300, h = map.offsetHeight || w, cx = w/2, cy = h/2;
  var maxR = Math.min(cx, cy) - 24;
  var out = '';

  // Collision avoidance
  var placed = [];
  function findSafe(ix, iy, sz) {
    var hs = sz/2, tx = ix, ty = iy;
    for (var a = 0; a < 12; a++) {
      var hit = false;
      for (var j = 0; j < placed.length; j++) {
        var dx = (tx+hs)-(placed[j].x+placed[j].s/2), dy = (ty+hs)-(placed[j].y+placed[j].s/2);
        if (Math.sqrt(dx*dx+dy*dy) < (hs+placed[j].s/2)+3) { hit = true; break; }
      }
      if (!hit) return {x:tx, y:ty};
      var na = Math.atan2(ty+hs-cy, tx+hs-cx) + a*0.5;
      tx = ix + Math.cos(na)*(8+a*5); ty = iy + Math.sin(na)*(8+a*5);
    }
    return {x:tx, y:ty};
  }

  for (var i = 0; i < fil.length; i++) {
    var p = fil[i];
    var ini = (p.name||'?').split(' ').map(function(x){return x[0];}).join('').slice(0,2).toUpperCase();
    var col = proxColors[i % proxColors.length];
    var dist = (1 - p.relevance) * 0.7 + 0.15;
    var r = dist * maxR;
    var ang = (i * 2.399) + (Math.floor(p.relevance * 3) * 0.8);
    var ix = cx + Math.cos(ang)*r - 17, iy = cy + Math.sin(ang)*r - 17;
    var sz = p.relevance > 0.4 ? 36 : p.relevance > 0.15 ? 32 : 28;
    var pos = findSafe(ix, iy, sz);
    placed.push({x:pos.x, y:pos.y, s:sz});
    var op = (0.55 + p.relevance * 0.45).toFixed(2);
    out += '<div class="prox-dot" style="width:'+sz+'px;height:'+sz+'px;left:'+pos.x.toFixed(1)+'px;top:'+pos.y.toFixed(1)+'px;background:'+col+';opacity:'+op+';font-size:'+(sz<32?'0.48':'0.52')+'rem" onclick="openRadarPerson(\''+p.id+'\')" data-id="'+p.id+'">'+escHtml(ini)+'</div>';
  }
  av.innerHTML = out;
}

function drawProxRings(canvas) {
  if (!canvas) return;
  var par = canvas.parentElement; if (!par) return;
  var w = par.offsetWidth || 300, h = w;
  canvas.width = w*2; canvas.height = h*2; canvas.style.width = w+'px'; canvas.style.height = h+'px';
  var ctx = canvas.getContext('2d'); ctx.scale(2,2); ctx.clearRect(0,0,w,h);
  var cx = w/2, cy = h/2, rings = [0.25,0.45,0.7];
  for (var i=0; i<rings.length; i++) { ctx.beginPath(); ctx.arc(cx,cy,rings[i]*Math.min(cx,cy),0,Math.PI*2); ctx.strokeStyle='rgba(255,255,255,0.04)'; ctx.lineWidth=1; ctx.stroke(); }
  var g = ctx.createRadialGradient(cx,cy,0,cx,cy,cx*0.3);
  g.addColorStop(0,'rgba(139,127,255,0.06)'); g.addColorStop(1,'rgba(139,127,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0,0,w,h);
}

function updateProximityRange(val) {
  proxRange = parseInt(val);
  var el = document.getElementById('prox-range-label');
  if (radarCurrentView === 'map') {
    var threshold = proxThresholds[proxRange-1] || 0;
    var count = proxAllProfiles.filter(function(p) { return !p.is_anon && p.relevance >= threshold; }).length;
    if (el) el.textContent = (proxRangeLabels[proxRange-1]||'') + ' \u00b7 ' + count;
    renderProximityDots();
  } else {
    // List: show all profiles at this "distance"
    var maxN = [5,10,20,35,50][proxRange-1] || 50;
    var count2 = Math.min(proxAllProfiles.length, maxN);
    if (el) el.textContent = (listRangeLabels[proxRange-1]||'') + ' \u00b7 ' + count2;
    renderRadarList();
  }
}

function toggleProximityVisibility() {
  proxVisible = !proxVisible;
  var d = document.getElementById('prox-toggle-dot');
  var l = document.getElementById('prox-toggle-label');
  var c = document.getElementById('prox-center');
  if (d) d.style.background = proxVisible ? 'var(--accent3)' : 'var(--muted)';
  if (l) l.textContent = proxVisible ? 'Synlig' : 'Anonym';
  if (c) { if (proxVisible && currentProfile && currentProfile.name) { c.textContent = currentProfile.name.split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase(); c.style.background = 'var(--gradient-primary)'; } else { c.textContent = '?'; c.style.background = 'rgba(255,255,255,0.08)'; } }
  toggleAnon();
}

function openRadarSheet() {
  var overlay = document.getElementById('radar-overlay');
  var sheet = document.getElementById('radar-sheet');
  if (overlay) overlay.classList.add('open');
  if (sheet) sheet.classList.add('open');
  setTimeout(function(){ if (radarCurrentView === 'map') renderProximityDots(); else renderRadarList(); }, 120);
}

function closeRadarSheet() {
  document.getElementById('radar-overlay').classList.remove('open');
  document.getElementById('radar-sheet').classList.remove('open');
}

// ══════════════════════════════════════════════════════════
//  RADAR: VIEW TOGGLE (KORT / LISTE)
// ══════════════════════════════════════════════════════════
var radarCurrentView = 'map';

function radarSwitchView(view) {
  radarCurrentView = view;
  document.getElementById('radar-btn-map').classList.toggle('active', view === 'map');
  document.getElementById('radar-btn-list').classList.toggle('active', view === 'list');
  document.getElementById('radar-view-map').style.display = view === 'map' ? 'block' : 'none';
  document.getElementById('radar-view-list').style.display = view === 'list' ? 'block' : 'none';
  document.getElementById('radar-map-controls').style.display = 'flex';
  // Update range label for the new view
  updateProximityRange(proxRange);
}

// ══════════════════════════════════════════════════════════
//  LIST VIEW — "Who is nearby?" (all profiles, proximity)
// ══════════════════════════════════════════════════════════
var radarDismissed = [];
var radarPendingRemove = null;

function renderRadarList() {
  var el = document.getElementById('radar-list-content');
  var emptyEl = document.getElementById('prox-empty');
  if (!el) return;

  var maxN = [5,10,20,35,50][proxRange-1] || 50;
  var fil = proxAllProfiles.filter(function(p) { return radarDismissed.indexOf(p.id) < 0; }).slice(0, maxN);

  if (fil.length === 0) {
    el.innerHTML = '<div style="text-align:center;padding:2rem 0;font-size:0.78rem;color:var(--muted)">Ingen profiler i n\u00e6rheden' +
      (radarDismissed.length > 0 ? '<br><button class="btn-sm btn-ghost" onclick="radarResetDismissed()" style="margin-top:0.5rem;font-size:0.7rem">Vis alle igen</button>' : '') + '</div>';
    if (emptyEl) emptyEl.style.display = 'none';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';
  var myKw = (currentProfile && currentProfile.keywords ? currentProfile.keywords : []).map(function(k){ return k.toLowerCase(); });
  var colors = proxColors;

  el.innerHTML = fil.map(function(p, i) {
    var isA = p.is_anon;
    var name = isA ? 'Anonym bruger' : (p.name || '?');
    var ini = isA ? '?' : name.split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();
    var col = isA ? 'rgba(255,255,255,0.08)' : colors[i % colors.length];
    var bd = isA ? 'border:1px solid rgba(255,255,255,0.06);' : '';
    var theirKw = (p.keywords || []).map(function(k){ return k.toLowerCase(); });
    var overlap = myKw.filter(function(k){ return theirKw.indexOf(k) >= 0; });
    var matchPct = Math.round(p.relevance * 60 + 30 + (p.title ? 10 : 0));
    matchPct = Math.min(matchPct, 99);
    var tags = (p.keywords || []).slice(0, 3).map(function(k){
      var isOv = overlap.indexOf(k.toLowerCase()) >= 0;
      return '<span class="tag' + (isOv ? ' mint' : '') + '" style="font-size:0.58rem;padding:0.15rem 0.4rem">' + escHtml(k) + '</span>';
    }).join('');
    var bubbleInfo = p.sharedBubbles > 0 ? '<span class="fs-065 text-muted">' + p.sharedBubbles + ' f\u00e6lles boble' + (p.sharedBubbles > 1 ? 'r' : '') + '</span>' : '';
    return '<div class="radar-list-card" data-uid="' + p.id + '" data-name="' + escHtml(name) + '" style="--card-delay:' + (i * 40) + 'ms">' +
      '<div class="radar-list-avatar" style="background:' + col + ';' + bd + '" onclick="openRadarPerson(\'' + p.id + '\')">' + escHtml(ini) + '</div>' +
      '<div style="flex:1;min-width:0;cursor:pointer" onclick="openRadarPerson(\'' + p.id + '\')">' +
        '<div class="fw-600 fs-085" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escHtml(name) + '</div>' +
        (isA ? '' : '<div class="fs-072 text-muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escHtml(p.title || '') + '</div>') +
      '</div>' +
      (isA ? '' : '<div class="radar-list-match">' + matchPct + '%</div>') +
      '<button class="radar-list-remove" onclick="event.stopPropagation();radarConfirmRemove(\'' + p.id + '\',\'' + escHtml(name).replace(/'/g,'') + '\')" title="Fjern">' + icon('x') + '</button>' +
    '</div>';
  }).join('');
}

function radarConfirmRemove(uid, name) {
  radarPendingRemove = { uid: uid, name: name };
  var tray = document.getElementById('radar-remove-tray');
  if (!tray) {
    var listEl = document.getElementById('radar-view-list');
    if (!listEl) return;
    listEl.insertAdjacentHTML('afterend',
      '<div class="radar-remove-tray" id="radar-remove-tray">' +
        '<span class="radar-remove-tray-text" id="radar-remove-tray-text"></span>' +
        '<div style="display:flex;gap:0.4rem">' +
          '<button class="radar-remove-tray-btn cancel" onclick="radarCancelRemove()">Annuller</button>' +
          '<button class="radar-remove-tray-btn confirm" onclick="radarDoRemove()">Fjern</button>' +
        '</div>' +
      '</div>');
    tray = document.getElementById('radar-remove-tray');
  }
  document.getElementById('radar-remove-tray-text').textContent = 'Fjern ' + name + '?';
  tray.classList.add('show');
}

function radarCancelRemove() {
  radarPendingRemove = null;
  var tray = document.getElementById('radar-remove-tray');
  if (tray) tray.classList.remove('show');
}

function radarDoRemove() {
  if (!radarPendingRemove) return;
  var uid = radarPendingRemove.uid;
  var name = radarPendingRemove.name;
  radarDismissed.push(uid);
  radarPendingRemove = null;
  var tray = document.getElementById('radar-remove-tray');
  if (tray) tray.classList.remove('show');
  // Animate card out
  var card = document.querySelector('.radar-list-card[data-uid="' + uid + '"]');
  if (card) {
    card.style.transition = 'opacity 0.25s, transform 0.25s';
    card.style.opacity = '0';
    card.style.transform = 'translateX(-30px)';
    setTimeout(function() { renderRadarList(); }, 280);
  } else {
    renderRadarList();
  }
  showToast(name + ' fjernet');
}

function radarResetDismissed() { radarDismissed = []; renderRadarList(); }

// ══════════════════════════════════════════════════════════
//  RADAR: TOP-DROP PERSON SHEET
// ══════════════════════════════════════════════════════════
var rpCurrentUserId = null;

async function openRadarPerson(userId) {
  rpCurrentUserId = userId;
  try {
    var { data: p } = await sb.from('profiles').select('*').eq('id', userId).single();
    if (!p) return;
    var isA = p.is_anon;
    var name = isA ? 'Anonym bruger' : (p.name || '?');
    var ini = isA ? '?' : name.split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();
    document.getElementById('rp-avatar').textContent = ini;
    document.getElementById('rp-name').textContent = name;
    document.getElementById('rp-sub').textContent = isA ? '' : (p.title || '');
    var myKw = (currentProfile?.keywords || []).map(function(k){ return k.toLowerCase(); });
    var theirKw = (p.keywords || []).map(function(k){ return k.toLowerCase(); });
    var overlap = myKw.filter(function(k){ return theirKw.indexOf(k) >= 0; });
    var overlapRatio = overlap.length / Math.max(myKw.length, theirKw.length, 1);
    var score = theirKw.length ? Math.round(overlapRatio * 60 + 30 + (p.bio?10:0) + (p.title?10:0) + (p.linkedin?5:0)) : Math.round(30 + (p.title?10:0));
    score = Math.min(score, 99);
    document.getElementById('rp-match').textContent = score + '%';
    document.getElementById('rp-bio').textContent = p.bio || '';
    document.getElementById('rp-bio').style.display = p.bio ? 'block' : 'none';
    document.getElementById('rp-tags').innerHTML = (p.keywords||[]).map(function(k){
      var isOv = overlap.indexOf(k.toLowerCase()) >= 0;
      return '<span class="tag' + (isOv ? ' mint' : '') + '">' + escHtml(k) + '</span>';
    }).join('');
    if (overlap.length > 0) {
      document.getElementById('rp-overlap').innerHTML = '<div style="font-size:0.68rem;color:var(--muted);margin-bottom:0.3rem;font-weight:600">F\u00e6lles interesser</div>' +
        overlap.map(function(k){ return '<span class="tag mint">' + icon('check') + ' ' + escHtml(k) + '</span>'; }).join('');
      document.getElementById('rp-overlap').style.display = 'block';
    } else { document.getElementById('rp-overlap').style.display = 'none'; }
    var liBtn = document.getElementById('rp-linkedin-btn');
    if (p.linkedin && !isA) { liBtn.style.display = 'inline-flex'; liBtn.href = p.linkedin.startsWith('http') ? p.linkedin : 'https://' + p.linkedin; }
    else { liBtn.style.display = 'none'; }
    var saveBtn = document.getElementById('rp-save-btn');
    var { data: savedCheck } = await sb.from('saved_contacts').select('id').eq('user_id', currentUser.id).eq('contact_id', userId).maybeSingle();
    saveBtn.textContent = savedCheck ? 'Gemt \u2713' : 'Gem';
    saveBtn.dataset.saved = savedCheck ? '1' : '0';
    document.getElementById('radar-person-overlay').classList.add('open');
    setTimeout(function(){ document.getElementById('radar-person-sheet').classList.add('open'); }, 10);
  } catch(e) { console.error("openRadarPerson:", e); showToast(e.message || "Ukendt fejl"); }
}

function closeRadarPerson() {
  document.getElementById('radar-person-sheet').classList.remove('open');
  setTimeout(function(){ document.getElementById('radar-person-overlay').classList.remove('open'); }, 320);
}
function rpMessage() { closeRadarPerson(); closeRadarSheet(); setTimeout(function(){ openChat(rpCurrentUserId, 'screen-home'); }, 400); }
async function rpSaveContact() {
  try {
    if (!rpCurrentUserId) return;
    var btn = document.getElementById('rp-save-btn');
    if (btn.dataset.saved === '1') { showToast('Allerede gemt'); return; }
    await sb.from('saved_contacts').insert({ user_id: currentUser.id, contact_id: rpCurrentUserId });
    btn.textContent = 'Gemt \u2713'; btn.dataset.saved = '1';
    showToast('Kontakt gemt!'); loadSavedContacts();
  } catch(e) { console.error("rpSaveContact:", e); showToast(e.message || "Ukendt fejl"); }
}
function rpFullProfile() {
  var uid = rpCurrentUserId; closeRadarPerson(); closeRadarSheet();
  setTimeout(function(){ openPerson(uid, 'screen-home'); }, 400);
}



// ══════════════════════════════════════════════════════════
//  MESSAGES
// ══════════════════════════════════════════════════════════
async function updateUnreadBadge() {
  try {
    const { count } = await sb.from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', currentUser.id)
      .is('read_at', null);
    document.querySelectorAll('.msg-unread-badge').forEach(b => {
      if (count && count > 0) {
        b.textContent = count > 9 ? '9+' : count;
        b.style.display = 'flex';
      } else {
        b.style.display = 'none';
      }
    });
  } catch(e) { console.error("updateUnreadBadge:", e); showToast(e.message || "Ukendt fejl"); }
}

let incomingSubscription = null;
function subscribeToIncoming() {
  if (incomingSubscription) { incomingSubscription.unsubscribe(); incomingSubscription = null; }
  incomingSubscription = sb.channel('incoming-messages')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages',
      filter: `receiver_id=eq.${currentUser.id}` }, () => {
      updateUnreadBadge();
    }).subscribe();
}

async function loadMessages() {
  try {
    const list = document.getElementById('conversations-list');
    list.innerHTML = '<div class="spinner"></div>';

    const { data: convs } = await sb.from('messages')
      .select('*')
      .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
      .order('created_at', {ascending:false})
      .limit(200);

    if (!convs || convs.length === 0) {
      list.innerHTML = '<div class="empty-state"><div class="empty-icon">' + icon('chat') + '</div><div class="empty-text">Ingen beskeder endnu.<br>Find en person og start en samtale!</div></div>';
      return;
    }

    // Get unique conversation partners
    const seen = new Set();
    const partners = [];
    for (const m of convs) {
      const partnerId = m.sender_id === currentUser.id ? m.receiver_id : m.sender_id;
      if (!seen.has(partnerId)) {
        seen.add(partnerId);
        partners.push({ partnerId, lastMsg: m });
      }
    }

    // Load partner profiles
    const pIds = partners.map(p => p.partnerId);
    const { data: profiles } = await sb.from('profiles').select('id,name,title').in('id', pIds);
    const profileMap = Object.fromEntries((profiles||[]).map(p=>[p.id,p]));

    list.innerHTML = partners.map(({ partnerId, lastMsg }) => {
      const p = profileMap[partnerId] || {};
      const initials = (p.name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
      const isUnread = lastMsg.receiver_id === currentUser.id && !lastMsg.read_at;
      return `<div class="card flex-row-center" data-action="openChat" data-id="${partnerId}">
        <div class="avatar" style="background:linear-gradient(135deg,#8B7FFF,#E85D8A)">${initials}</div>
        <div style="flex:1">
          <div class="${isUnread?'fw-700':'fw-600'} fs-09">${escHtml(p.name||'Ukendt')}</div>
          <div class="fs-078 text-muted text-truncate">${escHtml(lastMsg.content||'')}</div>
        </div>
        ${isUnread ? '<div class="live-dot"></div>' : ''}
      </div>`;
    }).join('');
  } catch(e) { console.error("loadMessages:", e); showToast(e.message || "Ukendt fejl"); }
}

async function openChat(userId, fromScreen) {
  console.debug('[dm] openChat:', userId, 'from:', fromScreen);
  try {
    currentChatUser = userId;
    const { data: p } = await sb.from('profiles').select('name,title').eq('id', userId).single();
    currentChatName = p?.name || 'Ukendt';
    document.getElementById('chat-name').textContent = currentChatName;
    document.getElementById('chat-role').textContent = p?.title || '';
    const backBtn = document.getElementById('dm-back-btn');
    if (backBtn) backBtn.onclick = () => goTo(fromScreen || 'screen-messages');
    goTo('screen-chat');
    await loadChatMessages();
    subscribeToChat();

    // Mark messages as read
    await sb.from('messages').update({ read_at: new Date().toISOString() })
      .eq('sender_id', userId).eq('receiver_id', currentUser.id).is('read_at', null);
    await updateUnreadBadge();
  } catch(e) { console.error("openChat:", e); showToast(e.message || "Ukendt fejl"); }
}


function dmRenderMsg(m) {
  const sent = m.sender_id === currentUser.id;
  const time = new Date(m.created_at).toLocaleTimeString('da-DK', {hour:'2-digit',minute:'2-digit'});
  const myInit = (currentProfile?.name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  const theirInit = (currentChatName||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  const initials = sent ? myInit : theirInit;
  const name = sent ? (currentProfile?.name||'Mig') : (currentChatName||'?');
  const edited = m.edited ? ' <span class="msg-edited">redigeret</span>' : '';

  let bubble = '';
  if (m.file_url) {
    const ext = m.file_name?.split('.').pop()?.toLowerCase() || '';
    const isImg = ['jpg','jpeg','png','gif','webp'].includes(ext) || (m.file_type||'').startsWith('image/');
    if (isImg) {
      bubble = `<a href="${m.file_url}" target="_blank"><img class="msg-img" src="${m.file_url}" alt="${escHtml(m.file_name||'')}"></a>`;
    } else {
      const sz = m.file_size ? (m.file_size < 1048576 ? Math.round(m.file_size/1024)+'KB' : (m.file_size/1048576).toFixed(1)+'MB') : '';
      bubble = `<a class="msg-file" href="${m.file_url}" target="_blank">${icon('clip')} ${escHtml(m.file_name||'Fil')} <span class="msg-file-sz">${sz}</span></a>`;
    }
  } else {
    bubble = `<div class="msg-bubble${sent?' sent':''}" id="dm-bubble-${m.id}">${escHtml(m.content||'')}</div>`;
  }

  return `<div class="msg-row${sent?' me':''}" data-msg-id="${m.id}">
    <div class="msg-avatar" style="background:linear-gradient(135deg,${sent?'#4C1D95,#A78BFA':'#8B7FFF,#E85D8A'})">${initials}</div>
    <div class="msg-body">
      <div class="msg-head"><span class="msg-name">${escHtml(name)}</span><span class="msg-time">${time}${edited}</span></div>
      <div class="msg-content">${bubble}${sent && !m.file_url ?`<button class="msg-dots" onclick="dmEditMsg('${m.id}')">⋯</button>`:''}</div>
    </div>
  </div>`;
}

async function loadChatMessages() {
  try {
    const el = document.getElementById('chat-messages');
    const { data: msgs } = await sb.from('messages')
      .select('*')
      .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${currentChatUser}),and(sender_id.eq.${currentChatUser},receiver_id.eq.${currentUser.id})`)
      .order('created_at', {ascending:false})
      .limit(100);
    
    const sorted = (msgs||[]).reverse();

    el.innerHTML = sorted.map(m => dmRenderMsg(m)).join('');
    el.scrollTop = el.scrollHeight;
  } catch(e) { console.error("loadChatMessages:", e); showToast(e.message || "Ukendt fejl"); }
}

function subscribeToChat() {
  console.debug('[dm] subscribeToChat, user:', currentChatUser);
  if (chatSubscription) { chatSubscription.unsubscribe(); chatSubscription = null; }
  chatSubscription = sb.channel('chat-' + currentChatUser)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages',
      filter: `receiver_id=eq.${currentUser.id}` }, (payload) => {
      const m = payload.new;
      if (!m) return;
      if (m.sender_id !== currentChatUser) return;
      const el = document.getElementById('chat-messages');
      if (!el) return;
      if (el.querySelector('[data-msg-id="' + m.id + '"]')) return;
      el.insertAdjacentHTML('beforeend', dmRenderMsg(m));
      el.scrollTop = el.scrollHeight;
      // Mark as read immediately since chat is open
      sb.from('messages').update({ read_at: new Date().toISOString() }).eq('id', m.id);
      updateUnreadBadge();
    }).subscribe();
}

let dmEditingId = null;
function dmEditMsg(msgId) {
  dmEditingId = msgId;
  const bubble = document.getElementById('dm-bubble-' + msgId);
  if (!bubble) return;
  const input = document.getElementById('chat-input');
  input.value = bubble.textContent;
  input.focus();
}

let dmSending = false;
async function sendMessage() {
  if (dmSending) return;
  dmSending = true;
  console.debug('[dm] sendMessage');
  try {
    const input = document.getElementById('chat-input');
    const content = input.value.trim();
    if (!content) return;
    if (dmEditingId) {
      await sb.from('messages').update({ content, edited: true }).eq('id', dmEditingId);
      const bubble = document.getElementById('dm-bubble-' + dmEditingId);
      if (bubble) bubble.textContent = content;
      dmEditingId = null;
      input.value = '';
    } else {
      input.value = '';
      const { data: newMsg, error } = await sb.from('messages').insert({
        sender_id: currentUser.id,
        receiver_id: currentChatUser,
        content
      }).select().single();
      if (error) { console.error('sendMessage insert:', error); input.value = content; return; }
      if (newMsg) {
        const el = document.getElementById('chat-messages');
        if (el && !el.querySelector('[data-msg-id="' + newMsg.id + '"]')) {
          el.insertAdjacentHTML('beforeend', dmRenderMsg(newMsg));
          el.scrollTop = el.scrollHeight;
        }
      }
      input.focus();
    }
  } catch(e) { console.error("sendMessage:", e); showToast(e.message || "Ukendt fejl"); }
  finally { dmSending = false; }
}

async function sendDirectMessage(toId, content) {
  try {
    await sb.from('messages').insert({
      sender_id: currentUser.id,
      receiver_id: toId,
      content
    });
  } catch(e) { console.error("sendDirectMessage:", e); showToast(e.message || "Ukendt fejl"); }
}

function startChat() {
  if (!currentPerson) return;
  openChat(currentPerson, 'screen-person');
}

// ══════════════════════════════════════════════════════════
//  DM FILE ATTACH
// ══════════════════════════════════════════════════════════
async function dmHandleFile(input) {
  try {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { showToast('Maks 10MB per fil'); return; }
    showToast('Uploader...');

    const safeFilename = file.name
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `dm/${currentUser.id}/${Date.now()}-${safeFilename}`;

    const { error: uploadErr } = await sb.storage.from('bubble-files').upload(path, file, {
      cacheControl: '3600', upsert: false, contentType: file.type
    });
    if (uploadErr) { showToast('Upload fejlede: ' + (uploadErr.message || 'ukendt')); input.value = ''; return; }

    const { data: urlData } = sb.storage.from('bubble-files').getPublicUrl(path);

    const { data: newMsg, error } = await sb.from('messages').insert({
      sender_id: currentUser.id,
      receiver_id: currentChatUser,
      content: null,
      file_url: urlData.publicUrl,
      file_name: file.name,
      file_size: file.size,
      file_type: file.type
    }).select().single();

    if (error) { showToast('Besked fejlede'); input.value = ''; return; }
    if (newMsg) {
      const el = document.getElementById('chat-messages');
      if (el && !el.querySelector('[data-msg-id="' + newMsg.id + '"]')) {
        el.insertAdjacentHTML('beforeend', dmRenderMsg(newMsg));
        el.scrollTop = el.scrollHeight;
      }
      showToast('Fil sendt!');
    }
    input.value = '';
  } catch(e) { console.error("dmHandleFile:", e); showToast(e.message || "Ukendt fejl"); }
}

// ══════════════════════════════════════════════════════════
//  PERSON-SHEET: SAVE CONTACT
// ══════════════════════════════════════════════════════════
async function psSaveContact() {
  try {
    const userId = document.getElementById('person-sheet-el')?.dataset?.userId;
    if (!userId) return;
    const { data: existing } = await sb.from('saved_contacts').select('id').eq('user_id', currentUser.id).eq('contact_id', userId).maybeSingle();
    const btn = document.getElementById('ps-save-btn');
    if (existing) {
      await sb.from('saved_contacts').delete().eq('id', existing.id);
      if (btn) btn.innerHTML = icon('bookmark') + ' Gem';
      showToast('Kontakt fjernet');
    } else {
      await sb.from('saved_contacts').insert({ user_id: currentUser.id, contact_id: userId });
      if (btn) btn.innerHTML = icon('bookmarkFill') + ' Gemt';
      showToast('Kontakt gemt!');
    }
    loadSavedContacts();
  } catch(e) { console.error("psSaveContact:", e); showToast(e.message || "Ukendt fejl"); }
}

// ══════════════════════════════════════════════════════════
//  PROFILE
// ══════════════════════════════════════════════════════════
async function loadProfile() {
  try {
    if (!currentProfile) await loadCurrentProfile();
    if (!currentProfile) return;

    const initials = (currentProfile.name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    document.getElementById('my-avatar').textContent = initials;
    document.getElementById('my-name').textContent = currentProfile.name || '...';
    document.getElementById('my-role').textContent = currentProfile.title || '';
    document.getElementById('my-keywords').innerHTML = (currentProfile.keywords||[]).map(k=>`<span class="tag">${escHtml(k)}</span>`).join('');

    isAnon = currentProfile.is_anon || false;
    updateAnonToggle();

    await loadSavedContacts();
    await loadMyBubbles();
    loadProfileInvitations();
  } catch(e) { console.error("loadProfile:", e); showToast(e.message || "Ukendt fejl"); }
}

// Standalone saved contacts loader — called from loadProfile AND after save/remove
async function loadSavedContacts() {
  try {
    const savedEl = document.getElementById('saved-contacts');
    if (!savedEl) return;

    // Fetch saved contacts — chronological (newest first)
    const { data: saved, error: savedErr } = await sb.from('saved_contacts')
      .select('id, contact_id, created_at')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false });

    if (savedErr) { console.error('loadSavedContacts query error:', savedErr); return; }

    const countEl = document.getElementById('saved-count');
    if (countEl) {
      if (saved?.length) { countEl.textContent = saved.length; countEl.style.display = 'inline-flex'; }
      else { countEl.style.display = 'none'; }
    }

    if (!saved || saved.length === 0) {
      savedEl.innerHTML = '<div class="empty-state" style="padding:1.5rem 0"><div class="empty-icon">' + icon('bookmark') + '</div><div class="empty-text">Ingen gemte kontakter endnu.<br>Tryk Gem på en profil for at huske dem.</div></div>';
      return;
    }

    // Fetch profiles separately — no FK dependency
    const contactIds = saved.map(s => s.contact_id);
    const { data: profiles, error: profErr } = await sb.from('profiles')
      .select('id, name, title, keywords').in('id', contactIds);

    if (profErr) console.error('loadSavedContacts profiles error:', profErr);
    const profileMap = {};
    (profiles || []).forEach(p => { profileMap[p.id] = p; });

    // Update home screen story bar
    renderSavedStoryBar(saved, profileMap);

    const colors = ['linear-gradient(135deg,#8B7FFF,#E85D8A)','linear-gradient(135deg,#065F46,#10B981)','linear-gradient(135deg,#1E3A8A,#7C3AED)','linear-gradient(135deg,#0C4A6E,#38BDF8)','linear-gradient(135deg,#7C2D12,#F97316)'];

    savedEl.innerHTML = saved.map((s, i) => {
      const p = profileMap[s.contact_id];
      if (!p) return '';
      const ini = (p.name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
      const col = colors[i % colors.length];
      const tags = (p.keywords||[]).slice(0,3).map(k => `<span class="tag" style="font-size:0.58rem;padding:0.15rem 0.4rem">${escHtml(k)}</span>`).join('');
      return `<div class="card" style="padding:0.7rem 0.9rem;margin-bottom:0.4rem">
        <div class="flex-row-center" style="gap:0.7rem">
          <div class="avatar" style="background:${col};width:40px;height:40px;font-size:0.75rem;flex-shrink:0" data-action="openPerson" data-id="${p.id}" data-from="screen-profile">${ini}</div>
          <div style="flex:1;min-width:0">
            <div class="fw-600 fs-085" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(p.name||'Ukendt')}</div>
            <div class="fs-075 text-muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(p.title||'')}</div>
            ${tags ? `<div style="display:flex;flex-wrap:wrap;gap:0.2rem;margin-top:0.3rem">${tags}</div>` : ''}
          </div>
          <div style="display:flex;gap:0.3rem;flex-shrink:0">
            <button class="btn-sm btn-ghost" style="padding:0.3rem 0.45rem;font-size:0.75rem" data-action="openChat" data-id="${p.id}" title="Send besked">${icon('chat')}</button>
            <button class="btn-sm btn-ghost" style="padding:0.3rem 0.45rem;font-size:0.75rem" data-action="openPerson" data-id="${p.id}" data-from="screen-profile" title="Se profil">${icon('user')}</button>
            <button class="btn-sm btn-ghost" style="padding:0.3rem 0.45rem;font-size:0.75rem;color:var(--accent2)" onclick="removeSavedContact('${s.id}',this)" title="Fjern">${icon('x')}</button>
          </div>
        </div>
      </div>`;
    }).join('');
  } catch(e) { console.error("loadSavedContacts:", e); }
}

// Render saved contacts as story-bar on home screen
function renderSavedStoryBar(saved, profileMap) {
  var bar = document.getElementById('saved-profiles-bar');
  var list = document.getElementById('saved-story-list');
  var badge = document.getElementById('saved-count-badge');
  if (!bar || !list) return;
  if (!saved || saved.length === 0) { bar.style.display = 'none'; return; }
  bar.style.display = 'block';
  if (badge) badge.textContent = saved.length;
  var colors = ['linear-gradient(135deg,#8B7FFF,#E85D8A)','linear-gradient(135deg,#065F46,#10B981)','linear-gradient(135deg,#1E3A8A,#7C3AED)','linear-gradient(135deg,#0C4A6E,#38BDF8)','linear-gradient(135deg,#7C2D12,#F97316)'];
  list.innerHTML = saved.map(function(s, i) {
    var p = profileMap[s.contact_id];
    if (!p) return '';
    var ini = (p.name||'?').split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();
    var col = colors[i % colors.length];
    var firstName = (p.name||'?').split(' ')[0];
    return '<div class="saved-story-item" onclick="openChat(\'' + p.id + '\',\'screen-home\')">' +
      '<div class="saved-story-avatar" style="background:' + col + '">' + escHtml(ini) + '</div>' +
      '<div class="saved-story-name">' + escHtml(firstName) + '</div></div>';
  }).join('');
}

// Profile tab switching — same pattern as bcSwitchTab
function profSwitchTab(tab) {
  ['saved','bubbles','invites'].forEach(t => {
    const panel = document.getElementById('prof-panel-' + t);
    const tabBtn = document.getElementById('prof-tab-' + t);
    if (panel) panel.style.display = t === tab ? 'flex' : 'none';
    if (tabBtn) tabBtn.classList.toggle('active', t === tab);
  });
}

// Load invitations into profile invitations tab
async function loadProfileInvitations() {
  try {
    const list = document.getElementById('profile-invitations');
    if (!list) return;
    list.innerHTML = '<div class="spinner"></div>';

    // Fetch pending invitations — newest first
    const { data: invites, error: invErr } = await sb.from('bubble_invitations')
      .select('id, from_user_id, bubble_id, created_at, status')
      .eq('to_user_id', currentUser.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (invErr) { console.error('loadProfileInvitations query:', invErr); list.innerHTML = ''; return; }

    // Update badge
    const countEl = document.getElementById('invite-count');
    if (countEl) {
      if (invites?.length) { countEl.textContent = invites.length; countEl.style.display = 'inline-flex'; }
      else { countEl.style.display = 'none'; }
    }

    if (!invites || invites.length === 0) {
      list.innerHTML = '<div class="empty-state" style="padding:1.5rem 0"><div class="empty-icon">' + icon('bell') + '</div><div class="empty-text">Ingen invitationer lige nu.<br>Når nogen sender dig en Bubble Up,<br>dukker den op her.</div></div>';
      return;
    }

    // Fetch sender profiles separately — no FK dependency
    const senderIds = [...new Set(invites.map(i => i.from_user_id))];
    const { data: profiles } = await sb.from('profiles').select('id, name, title, keywords').in('id', senderIds);
    const profileMap = {};
    (profiles || []).forEach(p => { profileMap[p.id] = p; });

    // Fetch bubble names
    const bubbleIds = [...new Set(invites.filter(i => i.bubble_id).map(i => i.bubble_id))];
    let bubbleMap = {};
    if (bubbleIds.length) {
      const { data: bubbles } = await sb.from('bubbles').select('id, name').in('id', bubbleIds);
      (bubbles || []).forEach(b => { bubbleMap[b.id] = b; });
    }

    const colors = ['linear-gradient(135deg,#8B7FFF,#E85D8A)','linear-gradient(135deg,#065F46,#10B981)','linear-gradient(135deg,#1E3A8A,#7C3AED)','linear-gradient(135deg,#0C4A6E,#38BDF8)','linear-gradient(135deg,#7C2D12,#F97316)'];

    list.innerHTML = invites.map((inv, i) => {
      const p = profileMap[inv.from_user_id] || {};
      const b = bubbleMap[inv.bubble_id] || {};
      const ini = (p.name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
      const col = colors[i % colors.length];
      const time = new Date(inv.created_at).toLocaleDateString('da-DK', { day:'numeric', month:'short' });
      const tags = (p.keywords||[]).slice(0,2).map(k => `<span class="tag" style="font-size:0.58rem;padding:0.15rem 0.4rem">${escHtml(k)}</span>`).join('');

      return `<div class="card" style="padding:0.7rem 0.9rem;margin-bottom:0.5rem" id="prof-invite-${inv.id}">
        <div class="flex-row-center" style="gap:0.7rem">
          <div class="avatar" style="background:${col};width:40px;height:40px;font-size:0.75rem;flex-shrink:0" data-action="openPerson" data-id="${inv.from_user_id}" data-from="screen-profile">${ini}</div>
          <div style="flex:1;min-width:0">
            <div class="fw-600 fs-085" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(p.name||'Ukendt')}</div>
            <div class="fs-075 text-muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(p.title||'')}</div>
            ${b.name ? `<div class="fs-065 text-muted" style="margin-top:0.15rem">${icon('bubble')} ${escHtml(b.name)} · ${time}</div>` : `<div class="fs-065 text-muted" style="margin-top:0.15rem">Bubble Up · ${time}</div>`}
            ${tags ? `<div style="display:flex;flex-wrap:wrap;gap:0.2rem;margin-top:0.25rem">${tags}</div>` : ''}
          </div>
        </div>
        <div style="display:flex;gap:0.4rem;margin-top:0.5rem">
          <button class="btn-sm" style="flex:1;padding:0.4rem;font-size:0.72rem;font-weight:600;background:var(--gradient-primary);border:1px solid var(--gradient-btn-border);color:white;border-radius:var(--radius-xs);cursor:pointer;font-family:inherit" onclick="profAcceptInvite('${inv.id}','${inv.from_user_id}')">Accepter</button>
          <button class="btn-sm btn-ghost" style="flex:1;padding:0.4rem;font-size:0.72rem" onclick="profDeclineInvite('${inv.id}',this)">Afvis</button>
        </div>
      </div>`;
    }).join('');
  } catch(e) { console.error("loadProfileInvitations:", e); }
}

async function profAcceptInvite(inviteId, fromUserId) {
  try {
    await sb.from('bubble_invitations').update({ status: 'accepted' }).eq('id', inviteId);
    const { data: inv } = await sb.from('bubble_invitations').select('bubble_id').eq('id', inviteId).single();
    if (inv?.bubble_id) {
      await sb.from('bubble_members').insert({ bubble_id: inv.bubble_id, user_id: currentUser.id });
      showToast('Du er nu med i boblen!');
      loadProfileInvitations();
      setTimeout(() => openBubbleChat(inv.bubble_id), 800);
    }
  } catch(e) { console.error("profAcceptInvite:", e); showToast(e.message || "Ukendt fejl"); }
}

let pendingDeclineInviteId = null;
let pendingDeclineBtn = null;

function profDeclineInvite(inviteId, btn) {
  pendingDeclineInviteId = inviteId;
  pendingDeclineBtn = btn;
  const card = btn.closest('.card');
  if (!card || card.querySelector('.remove-confirm')) return;
  const confirm = document.createElement('div');
  confirm.className = 'remove-confirm';
  confirm.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:0.5rem 0.6rem;margin-top:0.4rem;background:rgba(232,93,138,0.08);border:1px solid rgba(232,93,138,0.2);border-radius:10px;gap:0.5rem';
  confirm.innerHTML = `<span style="font-size:0.72rem;color:var(--text-secondary)">Afvis invitation?</span>
    <div style="display:flex;gap:0.3rem">
      <button class="btn-sm btn-ghost" style="padding:0.25rem 0.6rem;font-size:0.7rem;color:var(--accent2);border-color:rgba(232,93,138,0.3)" onclick="confirmDeclineInvite()">Afvis</button>
      <button class="btn-sm btn-ghost" style="padding:0.25rem 0.6rem;font-size:0.7rem" onclick="cancelDeclineInvite(this)">Annuller</button>
    </div>`;
  card.appendChild(confirm);
}

function cancelDeclineInvite(btn) {
  const confirm = btn.closest('.remove-confirm');
  if (confirm) confirm.remove();
  pendingDeclineInviteId = null;
  pendingDeclineBtn = null;
}

async function confirmDeclineInvite() {
  if (!pendingDeclineInviteId) return;
  const inviteId = pendingDeclineInviteId;
  pendingDeclineInviteId = null;
  pendingDeclineBtn = null;
  try {
    await sb.from('bubble_invitations').update({ status: 'declined' }).eq('id', inviteId);
    const card = document.getElementById('prof-invite-' + inviteId);
    if (card) {
      card.style.transition = 'opacity 0.25s, transform 0.25s';
      card.style.opacity = '0';
      card.style.transform = 'translateX(20px)';
      setTimeout(() => loadProfileInvitations(), 260);
    } else {
      loadProfileInvitations();
    }
    showToast('Invitation afvist');
  } catch(e) { console.error("confirmDeclineInvite:", e); showToast(e.message || "Ukendt fejl"); }
}

function openEditProfile() {
  if (!currentProfile) return;
  document.getElementById('ep-name').value = currentProfile.name || '';
  document.getElementById('ep-title').value = currentProfile.title || '';
  document.getElementById('ep-bio').value = currentProfile.bio || '';
  epChips = [...(currentProfile.keywords || [])];
  epDynChips = [...(currentProfile.dynamic_keywords || [])];
  renderChips('ep-chips', epChips, 'ep-chips-container', 'ep-chip-input');
  renderChips('ep-dyn-chips', epDynChips, 'ep-dyn-chips-container', 'ep-dyn-chip-input');
  openModal('modal-edit-profile');
}

async function saveProfile() {
  try {
    const name  = document.getElementById('ep-name').value.trim();
    const title = document.getElementById('ep-title').value.trim();
    const bio   = document.getElementById('ep-bio').value.trim();
    if (!name) return showToast('Navn er påkrævet');
    const { error } = await sb.from('profiles').upsert({
      id: currentUser.id, name, title, bio,
      keywords: epChips, dynamic_keywords: epDynChips, is_anon: isAnon
    });
    if (error) return showToast('Fejl: ' + error.message);
    await loadCurrentProfile();
    closeModal('modal-edit-profile');
    loadProfile();
    showToast('Profil gemt! ✅');
  } catch(e) { console.error("saveProfile:", e); showToast(e.message || "Ukendt fejl"); }
}

function toggleAnon() {
  isAnon = !isAnon;
  updateAnonToggle();
  sb.from('profiles').update({ is_anon: isAnon }).eq('id', currentUser.id).then();
}

function updateAnonToggle() {
  const toggle = document.getElementById('anon-toggle');
  const knob = document.getElementById('anon-knob');
  toggle.style.background = isAnon ? 'var(--accent)' : 'var(--border)';
  knob.style.background = isAnon ? 'white' : 'var(--muted)';
  knob.style.left = isAnon ? '23px' : '3px';
}

// ══════════════════════════════════════════════════════════
//  CREATE BUBBLE
// ══════════════════════════════════════════════════════════
function openCreateBubble() {
  cbChips = [];
  document.getElementById('cb-name').value = '';
  document.getElementById('cb-desc').value = '';
  document.getElementById('cb-location').value = '';
  renderChips('cb-chips', cbChips, 'cb-chips-container', 'cb-chip-input');
  openModal('modal-create-bubble');
}

async function createBubble() {
  try {
    const name = document.getElementById('cb-name').value.trim();
    const type = document.getElementById('cb-type').value;
    const desc = document.getElementById('cb-desc').value.trim();
    const location = document.getElementById('cb-location').value.trim();
    if (!name) return showToast('Navn er påkrævet');
    const visibility = document.getElementById('cb-visibility')?.value || 'public';
    const { data: bubble, error } = await sb.from('bubbles').insert({
      name, type, type_label: typeLabel(type), description: desc, location,
      keywords: cbChips, created_by: currentUser.id, visibility
    }).select().single();
    if (error) return showToast('Fejl: ' + error.message);
    // Auto-join
    await sb.from('bubble_members').insert({ bubble_id: bubble.id, user_id: currentUser.id });
    closeModal('modal-create-bubble');
    showToast(`"${name}" oprettet! 🫧`);
    loadHome();
    loadDiscover();
  } catch(e) { console.error("createBubble:", e); showToast(e.message || "Ukendt fejl"); }
}

// ══════════════════════════════════════════════════════════
//  CHIP INPUT
// ══════════════════════════════════════════════════════════
function handleChipInput(e, arrayName) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    const val = e.target.value.trim().replace(/,/g,'');
    if (!val) return;
    const arr = arrayName === 'cb-chips' ? cbChips : arrayName === 'ep-chips' ? epChips : arrayName === 'eb-chips' ? ebChips : arrayName === 'ob-chips' ? obChips : epDynChips;
    const containerId = arrayName === 'cb-chips' ? 'cb-chips-container' : arrayName === 'ep-chips' ? 'ep-chips-container' : arrayName === 'eb-chips' ? 'eb-chips-container' : arrayName === 'ob-chips' ? 'ob-chips-container' : 'ep-dyn-chips-container';
    const inputId = arrayName === 'cb-chips' ? 'cb-chip-input' : arrayName === 'ep-chips' ? 'ep-chip-input' : arrayName === 'eb-chips' ? 'eb-chip-input' : arrayName === 'ob-chips' ? 'ob-chip-input' : 'ep-dyn-chip-input';
    if (!arr.includes(val)) arr.push(val);
    e.target.value = '';
    renderChips(arrayName, arr, containerId, inputId);
  }
}

function renderChips(arrayName, arr, containerId, inputId) {
  const container = document.getElementById(containerId);
  const oldInput = document.getElementById(inputId);
  container.innerHTML = '';
  arr.forEach((chip, i) => {
    const span = document.createElement('div');
    span.className = 'chip';
    span.innerHTML = `${escHtml(chip)} <span class="chip-remove" onclick="removeChip('${arrayName}',${i},'${containerId}','${inputId}')">×</span>`;
    container.appendChild(span);
  });
  const input = document.createElement('input');
  input.className = 'chip-input';
  input.id = inputId;
  input.placeholder = arr.length ? '' : oldInput?.placeholder || 'Tilføj...';
  input.onkeydown = (e) => handleChipInput(e, arrayName);
  container.appendChild(input);
}

function removeChip(arrayName, index, containerId, inputId) {
  const arr = arrayName === 'cb-chips' ? cbChips : arrayName === 'ep-chips' ? epChips : arrayName === 'eb-chips' ? ebChips : arrayName === 'ob-chips' ? obChips : epDynChips;
  arr.splice(index, 1);
  renderChips(arrayName, arr, containerId, inputId);
}

// ══════════════════════════════════════════════════════════
//  MODAL HELPERS
// ══════════════════════════════════════════════════════════
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
// Close modal on backdrop click
document.querySelectorAll('.modal-overlay').forEach(el => {
  el.addEventListener('click', (e) => { if (e.target === el) el.classList.remove('open'); });
});

// ══════════════════════════════════════════════════════════
//  TOAST
// ══════════════════════════════════════════════════════════
let toastTimer;
function showToast(msg, duration) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  const isError = /^(Fejl|❌|⚠️)/.test(msg);
  const ms = duration || (isError ? 4500 : 2500);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

// ══════════════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════════════
function escHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function bubbleEmoji(type) {
  return { event:ico('rocket'), local:ico('pin'), theme:ico('cpu'), company:ico('building'), live:ico('pin') }[type] || ico('bubble');
}
function bubbleIcon(type) {
  return { event:icon('rocket'), local:icon('pin'), theme:icon('cpu'), company:icon('building'), live:icon('pin') }[type] || icon('bubble');
}

function bubbleColor(type, alpha) {
  const map = { event:`rgba(108,99,255,${alpha})`, local:`rgba(67,232,176,${alpha})`, theme:`rgba(255,179,71,${alpha})`, company:`rgba(255,101,132,${alpha})`, live:`rgba(46,207,207,${alpha})` };
  return map[type] || `rgba(108,99,255,${alpha})`;
}

function typeLabel(type) {
  return { event:'Event', local:'Lokal', theme:'Tema', company:'Virksomhed', live:'Live' }[type] || type;
}

// Clock removed — iPhone shows native status bar

// ══════════════════════════════════════════════════════════
//  PRIVATE BUBBLE — JOIN REQUEST
// ══════════════════════════════════════════════════════════
async function requestJoin(bubbleId) {
  try {
    const { data: b } = await sb.from('bubbles').select('name,created_by').eq('id', bubbleId).single();
    const { error } = await sb.from('bubble_members').insert({
      bubble_id: bubbleId, user_id: currentUser.id, status: 'pending'
    });
    if (error && !error.message.includes('duplicate')) return showToast('Fejl: ' + error.message);
    showToast('Anmodning sendt! Ejeren skal godkende 🔒');
    await openBubble(bubbleId);
  } catch(e) { console.error("requestJoin:", e); showToast(e.message || "Ukendt fejl"); }
}

// ══════════════════════════════════════════════════════════
//  EDIT BUBBLE
// ══════════════════════════════════════════════════════════
let currentEditBubbleId = null;

async function openEditBubble(bubbleId) {
  try {
    currentEditBubbleId = bubbleId;
    const { data: b } = await sb.from('bubbles').select('*').eq('id', bubbleId).single();
    if (!b) return;
    document.getElementById('eb-name').value = b.name || '';
    document.getElementById('eb-type').value = b.type || 'event';
    document.getElementById('eb-visibility').value = b.visibility || 'public';
    document.getElementById('eb-desc').value = b.description || '';
    document.getElementById('eb-location').value = b.location || '';
    ebChips = [...(b.keywords || [])];
    renderChips('eb-chips', ebChips, 'eb-chips-container', 'eb-chip-input');
    openModal('modal-edit-bubble');
  } catch(e) { console.error("openEditBubble:", e); showToast(e.message || "Ukendt fejl"); }
}

async function saveEditBubble() {
  try {
    const name       = document.getElementById('eb-name').value.trim();
    const type       = document.getElementById('eb-type').value;
    const visibility = document.getElementById('eb-visibility').value;
    const desc       = document.getElementById('eb-desc').value.trim();
    const location   = document.getElementById('eb-location').value.trim();
    if (!name) return showToast('Navn er påkrævet');
    const { error } = await sb.from('bubbles').update({
      name, type, type_label: typeLabel(type),
      visibility, description: desc, location, keywords: ebChips
    }).eq('id', currentEditBubbleId);
    if (error) return showToast('Fejl: ' + error.message);
    closeModal('modal-edit-bubble');
    showToast('Boble opdateret! ✅');
    await openBubble(currentEditBubbleId);
  } catch(e) { console.error("saveEditBubble:", e); showToast(e.message || "Ukendt fejl"); }
}

// ══════════════════════════════════════════════════════════
//  QR CODE
// ══════════════════════════════════════════════════════════
let currentQRBubble = null;

async function openQRModal(bubbleId) {
  try {
    currentQRBubble = bubbleId;
    const { data: b } = await sb.from('bubbles').select('*').eq('id', bubbleId).single();
    if (!b) return;

    document.getElementById('qr-modal-title').innerHTML = b.name + ' ' + icon('bubble');
    document.getElementById('qr-modal-subtitle').textContent =
      `${typeLabel(b.type)}${b.location ? ' · ' + b.location : ''} — scan for at joine`;

    // Build the join URL — opens app and auto-joins the bubble
    const joinUrl = `${window.location.origin}${window.location.pathname}?join=${bubbleId}`;

    // Clear and render QR
    const el = document.getElementById('qr-code-el');
    el.innerHTML = '';
    new QRCode(el, {
      text: joinUrl,
      width: 220,
      height: 220,
      colorDark: '#0a0a0f',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.H
    });

    openModal('modal-qr');
  } catch(e) { console.error("openQRModal:", e); showToast(e.message || "Ukendt fejl"); }
}

let _jsPdfLoaded = false;
async function loadJsPdf() {
  if (_jsPdfLoaded) return;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    s.onload = resolve;
    s.onerror = () => reject(new Error('Kunne ikke indlæse jsPDF'));
    document.head.appendChild(s);
  });
  _jsPdfLoaded = true;
}

async function downloadQRPdf() {
  try {
  await loadJsPdf();
  const { data: b, error } = await sb.from('bubbles').select('*').eq('id', currentQRBubble).single();
  if (error || !b) return showToast('Kunne ikke hente boble-data');

  showToast('Genererer PDF...');

  // Wait a tick for QR to render fully
  await new Promise(r => setTimeout(r, 300));

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageW = 210, pageH = 297;

  // Dark background
  doc.setFillColor(10, 10, 15);
  doc.rect(0, 0, pageW, pageH, 'F');

  // Purple accent top bar
  doc.setFillColor(108, 99, 255);
  doc.rect(0, 0, pageW, 8, 'F');

  // Bubble logo area (purple rounded rect simulation)
  doc.setFillColor(108, 99, 255);
  doc.roundedRect(pageW/2 - 18, 28, 36, 36, 6, 6, 'F');

  // Bubble text in logo
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.text('bubble', pageW/2, 51, { align: 'center' });

  // App name
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(240, 240, 248);
  doc.text('bubble', pageW/2, 82, { align: 'center' });

  // Tagline
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(108, 108, 138);
  doc.text('Network Radar for Business', pageW/2, 91, { align: 'center' });

  // Divider
  doc.setDrawColor(42, 42, 61);
  doc.setLineWidth(0.5);
  doc.line(20, 99, pageW - 20, 99);

  // Bubble name
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(240, 240, 248);
  doc.text(b.name, pageW/2, 115, { align: 'center' });

  // Type + location
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(108, 108, 138);
  const meta = typeLabel(b.type) + (b.location ? ' · ' + b.location : '');
  doc.text(meta, pageW/2, 124, { align: 'center' });

  // Keywords
  if (b.keywords && b.keywords.length) {
    doc.setFontSize(10);
    doc.setTextColor(108, 99, 255);
    doc.text(b.keywords.slice(0,5).join('  ·  '), pageW/2, 133, { align: 'center' });
  }

  // QR code — get canvas from DOM
  const qrCanvas = document.querySelector('#qr-code-el canvas') ||
                   document.querySelector('#qr-code-el img');

  if (qrCanvas) {
    let imgData;
    if (qrCanvas.tagName === 'CANVAS') {
      imgData = qrCanvas.toDataURL('image/png');
    } else {
      // It's an img tag — draw to canvas first
      const tmpCanvas = document.createElement('canvas');
      tmpCanvas.width = 220; tmpCanvas.height = 220;
      tmpCanvas.getContext('2d').drawImage(qrCanvas, 0, 0);
      imgData = tmpCanvas.toDataURL('image/png');
    }

    // White background behind QR
    const qrSize = 80;
    const qrX = (pageW - qrSize) / 2;
    const qrY = 145;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(qrX - 6, qrY - 6, qrSize + 12, qrSize + 12, 4, 4, 'F');
    doc.addImage(imgData, 'PNG', qrX, qrY, qrSize, qrSize);
  }

  // Scan instruction
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(240, 240, 248);
  doc.text('Scan og join boblen', pageW/2, 245, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(108, 108, 138);
  doc.text('Åbn iPhone-kameraet og ret det mod QR-koden', pageW/2, 253, { align: 'center' });
  doc.text('Du bliver automatisk tilføjet til boblen', pageW/2, 260, { align: 'center' });

  // Bottom accent
  doc.setFillColor(108, 99, 255);
  doc.rect(0, pageH - 8, pageW, 8, 'F');

  // Save
  const filename = `bubble-qr-${b.name.toLowerCase().replace(/\s+/g,'-')}.pdf`;
  doc.save(filename);
  showToast('PDF downloadet! 🖨️');
  } catch(e) { showToast('PDF fejl: ' + (e.message || 'Ukendt')); }
}

// ══════════════════════════════════════════════════════════
//  AUTO-JOIN VIA QR SCAN
// ══════════════════════════════════════════════════════════
async function checkQRJoin() {
  try {
    const params = new URLSearchParams(window.location.search);
    const joinId = params.get('join');
    if (!joinId) return;

    // Clean URL
    window.history.replaceState({}, '', window.location.pathname);

    // Wait for auth
    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
      // Save for after login
      sessionStorage.setItem('pending_join', joinId);
      return;
    }

    // Auto-join
    const { error } = await sb.from('bubble_members')
      .insert({ bubble_id: joinId, user_id: session.user.id });

    if (!error || error.message.includes('duplicate')) {
      showToast('Du er checket ind! 🫧');
      await openBubble(joinId, 'screen-home');
    }
  } catch(e) { console.error("checkQRJoin:", e); showToast(e.message || "Ukendt fejl"); }
}

async function checkPendingJoin() {
  try {
    const joinId = sessionStorage.getItem('pending_join');
    if (!joinId) return;
    sessionStorage.removeItem('pending_join');
    const { error } = await sb.from('bubble_members')
      .insert({ bubble_id: joinId, user_id: currentUser.id });
    if (!error || error.message.includes('duplicate')) {
      showToast('Du er checket ind! 🫧');
      await openBubble(joinId, 'screen-home');
    }
  } catch(e) { console.error("checkPendingJoin:", e); showToast(e.message || "Ukendt fejl"); }
}


// ══════════════════════════════════════════════════════════
//  ONBOARDING
// ══════════════════════════════════════════════════════════
async function maybeShowOnboarding() {
  try {
    if (!currentProfile ||
        !currentProfile.name ||
        currentProfile.name === currentProfile.id ||
        currentProfile.name === currentUser.email ||
        !currentProfile.title ||
        !currentProfile.keywords ||
        currentProfile.keywords.length === 0) {
      // Pre-fill name from Google if available
      const googleName = currentUser.user_metadata?.full_name ||
                         currentUser.user_metadata?.name || '';
      if (googleName) document.getElementById('ob-name').value = googleName;
      else document.getElementById('ob-name').value = currentProfile?.name || '';
      document.getElementById('ob-title').value = currentProfile?.title || '';
      document.getElementById('ob-bio').value = currentProfile?.bio || '';
      document.getElementById('ob-linkedin').value = currentProfile?.linkedin || '';
      obChips = [...(currentProfile?.keywords || [])];
      renderChips('ob-chips', obChips, 'ob-chips-container', 'ob-chip-input');
      goTo('screen-onboarding');
      return true;
    }
    return false;
  } catch(e) { console.error("maybeShowOnboarding:", e); showToast(e.message || "Ukendt fejl"); }
}

async function saveOnboarding() {
  try {
    const name     = document.getElementById('ob-name').value.trim();
    const title    = document.getElementById('ob-title').value.trim();
    const bio      = document.getElementById('ob-bio').value.trim();
    const linkedin = document.getElementById('ob-linkedin').value.trim();
    if (!name)            return showToast('Navn er påkrævet');
    if (!title)           return showToast('Titel er påkrævet');
    if (obChips.length === 0) return showToast('Tilføj mindst ét nøgleord');
    const { error } = await sb.from('profiles').upsert({
      id: currentUser.id, name, title, bio, linkedin,
      keywords: obChips, dynamic_keywords: [], is_anon: false
    });
    if (error) return showToast('Fejl: ' + error.message);
    await loadCurrentProfile();
    showToast('Profil oprettet! 🎉');
    goTo('screen-home');
  } catch(e) { console.error("saveOnboarding:", e); showToast(e.message || "Ukendt fejl"); }
}

// ══════════════════════════════════════════════════════════
//  GOOGLE LOGIN
// ══════════════════════════════════════════════════════════
async function handleGoogleLogin() {
  try {
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + window.location.pathname,
        queryParams: { access_type: 'offline', prompt: 'consent' }
      }
    });
    if (error) showToast('Google login fejl: ' + error.message);
  } catch(e) { console.error("handleGoogleLogin:", e); showToast(e.message || "Ukendt fejl"); }
}

async function handleLinkedInLogin() {
  try {
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'linkedin_oidc',
      options: {
        redirectTo: window.location.origin + window.location.pathname
      }
    });
    if (error) showToast('LinkedIn login fejl: ' + error.message);
  } catch(e) { console.error("handleLinkedInLogin:", e); showToast(e.message || "Ukendt fejl"); }
}

async function handleFacebookLogin() {
  try {
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'facebook',
      options: {
        redirectTo: window.location.origin + window.location.pathname
      }
    });
    if (error) showToast('Facebook login fejl: ' + error.message);
  } catch(e) { console.error("handleFacebookLogin:", e); showToast(e.message || "Ukendt fejl"); }
}

// ══════════════════════════════════════════════════════════
//  BOOT
// ══════════════════════════════════════════════════════════
async function loadNotifications() {
  try {
    const list = document.getElementById('notifications-list');
    if (!list) return;
    list.innerHTML = '<div class="spinner"></div>';

    let html = '';

    // 1. Bubble-up invitations pending
    const { data: invites } = await sb.from('bubble_invitations')
      .select('id, from_user_id, bubble_id, created_at, profiles!bubble_invitations_from_user_id_fkey(name,title), bubbles(name)')
      .eq('to_user_id', currentUser.id)
      .eq('status', 'pending')
      .order('created_at', {ascending:false});

    if (invites && invites.length > 0) {
      invites.forEach(inv => {
        const p = inv.profiles || {};
        const initials = (p.name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
        html += `<div class="notif-card invite" id="invite-${inv.id}">
          <div class="notif-header">
            <div class="notif-avatar" style="background:linear-gradient(135deg,#8B7FFF,#E85D8A)">${initials}</div>
            <div>
              <div class="notif-title">${icon("bubble")} Invitation til boble</div>
              <div class="notif-sub">${escHtml(p.name||'Nogen')} inviterer dig til ${escHtml(inv.bubbles?.name||'en boble')}</div>
            </div>
          </div>
          <div class="notif-actions">
            <button class="notif-btn accept" onclick="acceptBubbleInvite('${inv.id}','${inv.from_user_id}')">Accepter</button>
            <button class="notif-btn decline" onclick="declineBubbleInvite('${inv.id}')">Afvis</button>
          </div>
        </div>`;
      });
    }

    // 2. New members in my bubbles
    const { data: memberships } = await sb.from('bubble_members').select('bubble_id').eq('user_id', currentUser.id);
    if (memberships && memberships.length > 0) {
      const ids = memberships.map(m => m.bubble_id);
      const since = new Date(Date.now() - 30*24*60*60*1000).toISOString();
      const { data: newMembers } = await sb.from('bubble_members')
        .select('user_id, joined_at, bubble_id, bubbles(name)')
        .in('bubble_id', ids).neq('user_id', currentUser.id)
        .gte('joined_at', since).order('joined_at', {ascending:false}).limit(20);

      if (newMembers && newMembers.length > 0) {
        const userIds = [...new Set(newMembers.map(m => m.user_id))];
        const { data: profiles } = await sb.from('profiles').select('id,name').in('id', userIds);
        const pMap = Object.fromEntries((profiles||[]).map(p=>[p.id,p]));
        newMembers.forEach(m => {
          const p = pMap[m.user_id] || {};
          const initials = (p.name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
          const time = new Date(m.joined_at).toLocaleDateString('da-DK', {day:'numeric',month:'short'});
          html += `<div class="notif-card">
            <div class="notif-header">
              <div class="notif-avatar" style="background:linear-gradient(135deg,#2ECFCF,#8B7FFF)">${initials}</div>
              <div>
                <div class="notif-title">${escHtml(p.name||'Ukendt')} joined</div>
                <div class="notif-sub">${escHtml(m.bubbles?.name||'')} · ${time}</div>
              </div>
            </div>
          </div>`;
        });
      }
    }

    if (!html) {
      html = '<div class="empty-state"><div class="empty-icon">' + icon('bell') + '</div><div class="empty-text">Ingen notifikationer endnu</div></div>';
    }
    list.innerHTML = html;
  } catch(e) { console.error("loadNotifications:", e); showToast(e.message || "Ukendt fejl"); }
}

async function acceptBubbleInvite(inviteId, fromUserId) {
  try {
    // Update invitation status
    await sb.from('bubble_invitations').update({status:'accepted'}).eq('id', inviteId);
    // Get the bubble_id from invitation
    const { data: inv } = await sb.from('bubble_invitations').select('bubble_id').eq('id', inviteId).single();
    if (inv?.bubble_id) {
      // Add to bubble_members
      await sb.from('bubble_members').insert({bubble_id: inv.bubble_id, user_id: currentUser.id});
      showToast('🫧 Du er nu med i boblen!');
      loadNotifications();
      // Open the bubble chat
      setTimeout(() => openBubbleChat(inv.bubble_id), 800);
    }
  } catch(e) { console.error("acceptBubbleInvite:", e); showToast(e.message || "Ukendt fejl"); }
}

async function declineBubbleInvite(inviteId) {
  try {
    await sb.from('bubble_invitations').update({status:'declined'}).eq('id', inviteId);
    document.getElementById('invite-' + inviteId)?.remove();
    showToast('Invitation afvist');
  } catch(e) { console.error("declineBubbleInvite:", e); showToast(e.message || "Ukendt fejl"); }
}

// ══════════════════════════════════════════════════════════
//  BOBLE CHAT
// ══════════════════════════════════════════════════════════
let bcBubbleId = null;
let bcCurrentMsgId = null;
let bcEditingId = null;
let bcMsgHistories = {};
let bcSubscription = null;
let bcBubbleData = null;

// ── REALTIME CLEANUP HELPER ──
function bcUnsubscribeAll() {
  if (chatSubscription) { chatSubscription.unsubscribe(); chatSubscription = null; }
  if (bcSubscription) { bcSubscription.unsubscribe(); bcSubscription = null; }
  if (incomingSubscription) { incomingSubscription.unsubscribe(); incomingSubscription = null; }
}

async function openBubbleChat(bubbleId, fromScreen) {
  console.debug('[bc] openBubbleChat:', bubbleId, 'from:', fromScreen);
  try {
    bcBubbleId = bubbleId;
    const backBtn = document.getElementById('bc-back-btn');
    backBtn.onclick = () => goTo(fromScreen || 'screen-bubbles');
    goTo('screen-bubble-chat');

    // Land altid på Medlemmer-tab
    bcSwitchTab('members');

    // Hent boble-info og vis metadata + actions i topbar
    const { data: b } = await sb.from('bubbles').select('*').eq('id', bubbleId).single();
    if (!b) return;
    bcBubbleData = b;

    document.getElementById('bc-emoji').innerHTML = bubbleEmoji(b.type);
    document.getElementById('bc-name').textContent = b.name;

    const { count } = await sb.from('bubble_members').select('*',{count:'exact',head:true}).eq('bubble_id', bubbleId);
    document.getElementById('bc-members-count').textContent = (count||0) + ' medlemmer';

    // Vis actions i topbar baseret på membership
    const { data: myMembership } = await sb.from('bubble_members')
      .select('id').eq('bubble_id', bubbleId).eq('user_id', currentUser.id).single();

    const actionArea = document.getElementById('bc-action-btns');
    const isOwner = b.created_by === currentUser.id;
    if (myMembership) {
      actionArea.innerHTML =
        `<button class="btn-sm btn-ghost" onclick="openInviteModal('${b.id}')" style="font-size:0.85rem;padding:0.35rem 0.55rem" title="Invit\u00e9r">${icon("user-plus")}</button>` +
        (isOwner ? `<button class="btn-sm btn-ghost" data-action="openEditBubble" data-id="${b.id}" style="font-size:0.85rem;padding:0.35rem 0.55rem">${icon("edit")}</button>
        <button class="btn-sm btn-ghost" data-action="openQRModal" data-id="${b.id}" style="font-size:0.85rem;padding:0.35rem 0.55rem">${icon("qrcode")}</button>` : '') +
        `<button class="btn-sm btn-ghost" data-action="leaveBubble" data-id="${b.id}" style="font-size:0.72rem">Forlad</button>`;
    } else if (b.visibility === 'hidden') {
      actionArea.innerHTML = `<span style="font-size:0.75rem;color:var(--muted)">${icon("eye")} Kun via invitation</span>`;
    } else if (b.visibility === 'private') {
      actionArea.innerHTML = `<button class="btn-sm btn-accent" data-action="requestJoin" data-id="${b.id}">${icon("lock")} Anmod</button>`;
    } else {
      actionArea.innerHTML = `<button class="btn-sm btn-accent" data-action="joinBubble" data-id="${b.id}">+ Join</button>`;
    }

    // Load data til aktive tabs
    await bcLoadMembers();

    // Load beskeder i baggrunden + subscribe (badge vises hvis der er ulæste)
    bcLoadMessages().then(() => {
      // Tjek om der er nye beskeder siden sidst — vis badge
      const badge = document.getElementById('bc-unread-badge');
      // Badge sættes via real-time subscription når man er på en anden tab
    });
    bcSubscribe();
  } catch(e) { console.error("openBubbleChat:", e); showToast(e.message || "Ukendt fejl"); }
}

async function bcLoadBubbleInfo() {
  try {
    const { data: b } = await sb.from('bubbles').select('*').eq('id', bcBubbleId).single();
    if (!b) return;
    bcBubbleData = b;
    document.getElementById('bc-emoji').innerHTML = bubbleEmoji(b.type);
    document.getElementById('bc-name').textContent = b.name;
    const { count } = await sb.from('bubble_members').select('*',{count:'exact',head:true}).eq('bubble_id', bcBubbleId);
    document.getElementById('bc-members-count').textContent = (count||0) + ' medlemmer';
  } catch(e) { console.error("bcLoadBubbleInfo:", e); showToast(e.message || "Ukendt fejl"); }
}

function bcSwitchTab(tab) {
  ['chat','members','info'].forEach(t => {
    const panel = document.getElementById('bc-panel-'+t);
    const tabBtn = document.getElementById('bc-tab-'+t);
    if (panel) {
      if (t === tab) {
        panel.style.display = 'flex';
        panel.style.flexDirection = 'column';
        panel.style.flex = '1';
        panel.style.overflow = 'hidden';
      } else {
        panel.style.display = 'none';
      }
    }
    if (tabBtn) tabBtn.classList.toggle('active', t === tab);
  });
  if (tab === 'chat') {
    const badge = document.getElementById('bc-unread-badge');
    if (badge) badge.style.display = 'none';
    setTimeout(() => bcScrollToBottom(), 100);
  }
  if (tab === 'info') bcLoadInfo();
}

async function bcLoadMessages() {
  try {
    const el = document.getElementById('bc-messages');
    el.innerHTML = '<div class="spinner"></div>';

    // Hent beskeder uden profiles join — henter profiler separat
    const { data: msgs, error: msgErr } = await sb.from('bubble_messages')
      .select('id, bubble_id, user_id, content, file_url, file_name, file_size, file_type, edited, created_at')
      .eq('bubble_id', bcBubbleId)
      .order('created_at', {ascending:true})
      .limit(50);

    if (msgErr) console.error('bcLoadMessages error:', msgErr);

    if (!msgs || msgs.length === 0) {
      el.innerHTML = '<div class="empty-state" style="margin-top:2rem"><div class="empty-icon">' + icon('chat') + '</div><div class="empty-text">Ingen beskeder endnu.<br>Vær den første!</div></div>';
      return;
    }

    // Hent unikke profiler separat
    const userIds = [...new Set(msgs.map(m => m.user_id))];
    const { data: profiles } = await sb.from('profiles').select('id, name, title').in('id', userIds);
    const profileMap = {};
    (profiles || []).forEach(p => profileMap[p.id] = p);

    el.innerHTML = '';
    let lastDate = '';
    msgs.forEach(m => {
      m.profiles = profileMap[m.user_id] || { name: '?' };
      const d = new Date(m.created_at).toLocaleDateString('da-DK', {weekday:'long', day:'numeric', month:'short'});
      if (d !== lastDate) {
        const sep = document.createElement('div');
        sep.className = 'chat-date-sep';
        sep.textContent = d.toUpperCase();
        el.appendChild(sep);
        lastDate = d;
      }
      el.appendChild(bcRenderMsg(m));
    });
    bcScrollToBottom();
  } catch(e) { console.error("bcLoadMessages:", e); showToast(e.message || "Ukendt fejl"); }
}

function bcRenderMsg(m) {
  const isMe = m.user_id === currentUser.id;
  const p = m.profiles || {};
  const name = p.name || '?';
  const initials = name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  const time = new Date(m.created_at).toLocaleTimeString('da-DK', {hour:'2-digit', minute:'2-digit'});
  const gradients = ['linear-gradient(135deg,#065F46,#10B981)','linear-gradient(135deg,#7C2D12,#F97316)','linear-gradient(135deg,#1E3A8A,#7C3AED)','linear-gradient(135deg,#4C1D95,#A78BFA)','linear-gradient(135deg,#0C4A6E,#38BDF8)'];
  const color = gradients[Math.abs(name.charCodeAt(0)) % gradients.length];

  const row = document.createElement('div');
  row.className = 'msg-row' + (isMe ? ' me' : '');
  row.id = 'bc-msg-' + m.id;

  // Build content
  let bubble = '';
  if (m.file_url) {
    const ext = m.file_name?.split('.').pop()?.toLowerCase() || '';
    const isImg = ['jpg','jpeg','png','gif','webp'].includes(ext) || (m.file_type||'').startsWith('image/');
    if (isImg) {
      bubble = `<a href="${m.file_url}" target="_blank"><img class="msg-img" src="${m.file_url}" alt="${escHtml(m.file_name||'')}"></a>`;
    } else {
      const sz = m.file_size ? (m.file_size < 1048576 ? Math.round(m.file_size/1024)+'KB' : (m.file_size/1048576).toFixed(1)+'MB') : '';
      bubble = `<a class="msg-file" href="${m.file_url}" target="_blank">${icon('clip')} ${escHtml(m.file_name||'Fil')} <span class="msg-file-sz">${sz}</span></a>`;
    }
  } else {
    bubble = `<div class="msg-bubble${isMe ? ' sent' : ''}" id="bc-bubble-${m.id}">${escHtml(m.content||'')}</div>`;
  }

  const editedTag = m.edited ? ` <span class="msg-edited" onclick="bcShowHistory('${m.id}')">redigeret</span>` : '';
  const nameHtml = escHtml(name);
  const safeTitle = escHtml(p.title||'');

  row.innerHTML =
    `<div class="msg-avatar" style="background:${color}" onclick="bcOpenPerson('${m.user_id}','${nameHtml}','${safeTitle}','${color}')">${initials}</div>` +
    `<div class="msg-body">` +
      `<div class="msg-head"><span class="msg-name">${nameHtml}</span><span class="msg-time">${time}${editedTag}</span></div>` +
      `<div class="msg-content">${bubble}<button class="msg-dots" onclick="bcOpenContext(event,this,${isMe},'${m.id}')" aria-label="Mere">⋯</button></div>` +
      `<div class="msg-reactions" id="bc-reactions-${m.id}"></div>` +
    `</div>`;

  setTimeout(() => bcLoadReactions(m.id), 80);
  return row;
}

function bcScrollToBottom() {
  const el = document.getElementById('bc-messages');
  if (el) el.scrollTop = el.scrollHeight;
}

function bcSubscribe() {
  console.debug('[bc] bcSubscribe, bubble:', bcBubbleId);
  if (bcSubscription) bcSubscription.unsubscribe();
  bcSubscription = sb.channel('bc-' + bcBubbleId)
    .on('postgres_changes', {event:'INSERT', schema:'public', table:'bubble_messages', filter:`bubble_id=eq.${bcBubbleId}`},
      async (payload) => {
        const m = payload.new;
        if (m.user_id === currentUser.id) return;
        const { data: p } = await sb.from('profiles').select('name,title').eq('id', m.user_id).single();
        m.profiles = p || {};
        const panel = document.getElementById('bc-panel-chat');
        if (panel.style.display !== 'none') {
          document.getElementById('bc-messages').appendChild(bcRenderMsg(m));
          bcScrollToBottom();
        } else {
          const badge = document.getElementById('bc-unread-badge');
          badge.textContent = parseInt(badge.textContent||0) + 1;
          badge.style.display = 'inline-flex';
        }
      })
    .on('postgres_changes', {event:'UPDATE', schema:'public', table:'bubble_messages', filter:`bubble_id=eq.${bcBubbleId}`},
      (payload) => {
        const m = payload.new;
        const bubbleEl = document.getElementById('bc-bubble-' + m.id);
        if (bubbleEl) {
          bubbleEl.textContent = m.content || '';
          const meta = bubbleEl.closest('.chat-msg-group')?.querySelector('.chat-msg-meta');
          if (meta && !meta.querySelector('.chat-msg-edited')) {
            const e = document.createElement('span');
            e.className = 'chat-msg-edited';
            e.textContent = '(redigeret)';
            e.onclick = () => bcShowHistory(m.id);
            meta.appendChild(e);
          }
        }
      })
    .subscribe();
}

let bcSending = false;
async function bcSendMessage() {
  if (bcSending) return;
  bcSending = true;
  console.debug('[bc] bcSendMessage');
  try {
    const inp = document.getElementById('bc-input');
    const text = inp.value.trim();
    if (!text) return;

    if (bcEditingId) {
      // Save edit to history first
      const { data: orig } = await sb.from('bubble_messages').select('content').eq('id', bcEditingId).single();
      if (orig) {
        await sb.from('bubble_message_edits').insert({message_id: bcEditingId, content: orig.content});
      }
      await sb.from('bubble_messages').update({content: text, edited: true, updated_at: new Date().toISOString()}).eq('id', bcEditingId);
      // Update local
      const bubbleEl = document.getElementById('bc-bubble-' + bcEditingId);
      if (bubbleEl) {
        bubbleEl.textContent = text;
        const meta = bubbleEl.closest('.chat-msg-group')?.querySelector('.chat-msg-meta');
        if (meta && !meta.querySelector('.chat-msg-edited')) {
          const e = document.createElement('span');
          e.className = 'chat-msg-edited';
          const id = bcEditingId;
          e.textContent = '(redigeret)';
          e.onclick = () => bcShowHistory(id);
          meta.appendChild(e);
        }
      }
      bcCancelEdit();
    } else {
      inp.value = '';

      const { data: newMsg, error } = await sb.from('bubble_messages').insert({
        bubble_id: bcBubbleId,
        user_id: currentUser.id,
        content: text
      }).select('id, bubble_id, user_id, content, file_url, file_name, file_size, file_type, edited, created_at').single();

      if (error) {
        console.error('bcSendMessage insert error:', error);
        showToast('Fejl: ' + (error.message || error.code || 'ukendt'));
        inp.value = text;
        return;
      }

      if (newMsg) {
        newMsg.profiles = {
          id: currentUser.id,
          name: currentProfile?.name || currentUser.email?.split('@')[0] || '?'
        };
        document.getElementById('bc-messages').appendChild(bcRenderMsg(newMsg));
        bcScrollToBottom();
      }
    }
  } catch(e) { console.error("bcSendMessage:", e); showToast(e.message || "Ukendt fejl"); }
  finally { bcSending = false; }
}

async function bcHandleFile(input) {
  try {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { showToast('Maks 10MB per fil'); return; }

    // Sørg for at filen er på chat-tab så bruger kan se progress
    bcSwitchTab('chat');
    showToast('📤 Uploader...');

    // Sanitér filnavn — fjern mellemrum og specialtegn
    const safeFilename = file.name
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // fjern accenter
      .replace(/[^a-zA-Z0-9._-]/g, '_');                 // erstat ugyldige tegn

    const path = `${bcBubbleId}/${Date.now()}-${safeFilename}`;

    const { error: uploadErr } = await sb.storage.from('bubble-files').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type
    });

    if (uploadErr) {
      console.error('Upload error:', uploadErr);
      showToast('Upload fejlede: ' + (uploadErr.message || uploadErr.error || 'ukendt fejl'));
      input.value = '';
      return;
    }

    const { data: urlData } = sb.storage.from('bubble-files').getPublicUrl(path);

    const { data: newMsg, error: msgErr } = await sb.from('bubble_messages').insert({
      bubble_id: bcBubbleId,
      user_id: currentUser.id,
      content: null,
      file_url: urlData.publicUrl,
      file_name: file.name,
      file_size: file.size,
      file_type: file.type
    }).select('id, bubble_id, user_id, content, file_url, file_name, file_size, file_type, edited, created_at').single();

    if (msgErr) {
      console.error('File message insert error:', msgErr);
      showToast('Fil uploadet men besked fejlede');
      input.value = '';
      return;
    }

    if (newMsg) {
      newMsg.profiles = {
        id: currentUser.id,
        name: currentProfile?.name || currentUser.email?.split('@')[0] || '?'
      };
      document.getElementById('bc-messages').appendChild(bcRenderMsg(newMsg));
      bcScrollToBottom();
      showToast('Fil sendt! 📎');
    }
    input.value = '';
  } catch(e) { console.error("bcHandleFile:", e); showToast(e.message || "Ukendt fejl"); }
}

function bcOpenContext(e, btn, isMe, msgId) {
  e.stopPropagation();
  bcCurrentMsgId = msgId;
  document.getElementById('bc-ctx-edit').style.display = isMe ? 'flex' : 'none';
  document.getElementById('bc-ctx-delete').style.display = isMe ? 'flex' : 'none';
  // Show history if message was edited
  const bubble = document.getElementById('bc-bubble-' + msgId);
  const msgGroup = document.getElementById('bc-msg-' + msgId);
  const wasEdited = msgGroup?.querySelector('.chat-msg-edited');
  document.getElementById('bc-ctx-history').style.display = wasEdited ? 'flex' : 'none';
  const menu = document.getElementById('bc-context-menu');
  menu.style.display = 'block';
  menu.classList.add('open');
  const r = btn.getBoundingClientRect();
  let top = r.bottom + 4;
  let left = isMe ? r.right - 200 : r.left - 5;
  left = Math.max(8, Math.min(left, window.innerWidth - 210));
  if (top + 200 > window.innerHeight) top = r.top - 200;
  menu.style.top = top + 'px';
  menu.style.left = left + 'px';
  setTimeout(() => document.addEventListener('click', bcCloseContext, {once:true}), 10);
}

async function bcReact(emoji) {
  bcCloseContext();
  if (!bcCurrentMsgId) return;
  try {
    // Check if user already reacted with this emoji
    const { data: existing } = await sb.from('bubble_message_reactions')
      .select('id').eq('message_id', bcCurrentMsgId).eq('user_id', currentUser.id).eq('emoji', emoji).maybeSingle();
    if (existing) {
      // Remove reaction
      await sb.from('bubble_message_reactions').delete().eq('id', existing.id);
    } else {
      // Add reaction
      await sb.from('bubble_message_reactions').insert({ message_id: bcCurrentMsgId, user_id: currentUser.id, emoji });
    }
    await bcLoadReactions(bcCurrentMsgId);
  } catch(e) { console.error("bcReact:", e); showToast(e.message || "Reaktion fejlede"); }
}

async function bcLoadReactions(msgId) {
  try {
    const { data: reactions } = await sb.from('bubble_message_reactions')
      .select('emoji, user_id, profiles(name)').eq('message_id', msgId);
    const el = document.getElementById('bc-reactions-' + msgId);
    if (!el) return;
    if (!reactions || reactions.length === 0) { el.innerHTML = ''; return; }
    // Group by emoji
    const groups = {};
    reactions.forEach(r => {
      if (!groups[r.emoji]) groups[r.emoji] = [];
      groups[r.emoji].push(r.profiles?.name || '?');
    });
    el.innerHTML = Object.entries(groups).map(([emoji, names]) => {
      const mine = reactions.some(r => r.emoji === emoji && r.user_id === currentUser.id);
      return `<button class="chat-reaction-pill${mine ? ' mine' : ''}" onclick="bcToggleReaction('${msgId}','${emoji}')" title="${names.join(', ')}">${emoji} ${names.length}</button>`;
    }).join('');
  } catch(e) { /* silent */ }
}

async function bcToggleReaction(msgId, emoji) {
  bcCurrentMsgId = msgId;
  await bcReact(emoji);
}

function bcCloseContext() {
  const m = document.getElementById('bc-context-menu');
  m.classList.remove('open');
  setTimeout(() => m.style.display='none', 150);
}

function bcStartEdit() {
  if (!bcCurrentMsgId) return;
  bcCloseContext();
  bcEditingId = bcCurrentMsgId;
  const bubbleEl = document.getElementById('bc-bubble-' + bcEditingId);
  if (!bubbleEl) return;
  document.getElementById('bc-input').value = bubbleEl.textContent;
  document.getElementById('bc-input').focus();
  document.getElementById('bc-edit-bar').classList.add('show');
  document.getElementById('bc-send-btn').innerHTML = icon('check');
}

function bcCancelEdit() {
  bcEditingId = null;
  document.getElementById('bc-input').value = '';
  document.getElementById('bc-edit-bar').classList.remove('show');
  document.getElementById('bc-send-btn').textContent = '→';
}

async function bcDeleteMessage() {
  try {
    if (!bcCurrentMsgId) return;
    bcCloseContext();
    await sb.from('bubble_messages').delete().eq('id', bcCurrentMsgId).eq('user_id', currentUser.id);
    document.getElementById('bc-msg-' + bcCurrentMsgId)?.remove();
    showToast('Besked slettet');
  } catch(e) { console.error("bcDeleteMessage:", e); showToast(e.message || "Ukendt fejl"); }
}

async function bcShowHistory(msgId) {
  try {
    const { data: edits } = await sb.from('bubble_message_edits')
      .select('content, edited_at').eq('message_id', msgId).order('edited_at', {ascending:true});
    const { data: current } = await sb.from('bubble_messages').select('content').eq('id', msgId).single();
    if (!edits || edits.length === 0) { showToast('Ingen historik'); return; }
    const modal = document.getElementById('modal-edit-history') || bcCreateHistoryModal();
    const content = document.getElementById('edit-history-content');
    content.innerHTML = edits.map((e,i) => {
      const t = new Date(e.edited_at).toLocaleTimeString('da-DK',{hour:'2-digit',minute:'2-digit'});
      return `<div style="padding:0.55rem 0;border-bottom:1px solid var(--border)">
        <div style="font-size:0.62rem;color:var(--muted);margin-bottom:0.2rem;font-family:monospace">${i===0?'Originalt':'Redigeret '+i} · ${t}</div>
        <div style="font-size:0.82rem;color:var(--muted)">${escHtml(e.content)}</div>
      </div>`;
    }).join('') + `<div style="padding:0.55rem 0"><div style="font-size:0.62rem;color:var(--muted);margin-bottom:0.2rem;font-family:monospace">Nuværende</div><div style="font-size:0.82rem">${escHtml(current?.content||'')}</div></div>`;
    openModal('modal-edit-history');
  } catch(e) { console.error("bcShowHistory:", e); showToast(e.message || "Ukendt fejl"); }
}

function bcCreateHistoryModal() {
  const m = document.createElement('div');
  m.id = 'modal-edit-history';
  m.className = 'modal';
  m.innerHTML = `<div class="modal-content"><div class="modal-header"><div class="modal-title">${icon("edit")} Redigeringshistorik</div><button class="modal-close" onclick="closeModal('modal-edit-history')">${icon('x')}</button></div><div id="edit-history-content" style="padding:0 1.25rem 1rem;overflow-y:auto;max-height:60vh"></div></div>`;
  document.getElementById('app-root').appendChild(m);
  return m;
}

async function bcLoadMembers() {
  try {
    const list = document.getElementById('bc-members-list');
    list.innerHTML = '<div class="spinner"></div>';

    const { data: members } = await sb.from('bubble_members')
      .select('user_id, joined_at')
      .eq('bubble_id', bcBubbleId)
      .order('joined_at', {ascending:true});

    if (!members || members.length === 0) {
      list.innerHTML = '<div class="empty-state"><div class="empty-icon">' + icon('users') + '</div><div class="empty-text">Ingen medlemmer</div></div>';
      return;
    }

    // Hent profiler separat
    const userIds = members.map(m => m.user_id);
    const { data: profiles } = await sb.from('profiles').select('id, name, title').in('id', userIds);
    const profileMap = {};
    (profiles || []).forEach(p => profileMap[p.id] = p);

    const colors = ['linear-gradient(135deg,#065F46,#10B981)','linear-gradient(135deg,#7C2D12,#F97316)','linear-gradient(135deg,#1E3A8A,#7C3AED)','linear-gradient(135deg,#4C1D95,#A78BFA)','linear-gradient(135deg,#0C4A6E,#38BDF8)'];
    const ownerId = bcBubbleData?.created_by;
    const owner = members.find(m => m.user_id === ownerId);
    const others = members.filter(m => m.user_id !== ownerId);
    const all = owner ? [owner, ...others] : members;

    let html = '';
    all.forEach((m, i) => {
      const p = profileMap[m.user_id] || {};
      const initials = (p.name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
      const color = colors[i % colors.length];
      const isOwnerRow = m.user_id === ownerId;
      if (i === 0) html += `<div class="chat-section-label">${isOwnerRow ? 'Ejer' : 'Medlemmer'}</div>`;
      if (!isOwnerRow && owner && i === 1) html += `<div class="chat-section-label" style="margin-top:0.8rem">Medlemmer · ${others.length}</div>`;
      html += `<div class="chat-member-row" onclick="bcOpenPerson('${m.user_id}','${escHtml(p.name||'')}','${escHtml(p.title||'')}','${color}')">
        <div class="chat-member-avatar" style="background:${color}">${initials}</div>
        <div style="flex:1"><div class="chat-member-name">${escHtml(p.name||'Ukendt')}</div><div class="chat-member-status">${escHtml(p.title||'')}</div></div>
        ${isOwnerRow ? '<span class="chat-member-role">Ejer</span>' : ''}
      </div>`;
    });
    list.innerHTML = html;
  } catch(e) { console.error("bcLoadMembers:", e); showToast(e.message || "Ukendt fejl"); }
}

async function bcLoadInfo() {
  try {
    const list = document.getElementById('bc-info-list');
    if (!bcBubbleData) await bcLoadBubbleInfo();
    const b = bcBubbleData;
    if (!b) return;
    const tags = (b.keywords||[]).map(k=>`<span class="tag">${escHtml(k)}</span>`).join('');
    list.innerHTML = `
      <div class="chat-info-block"><div class="chat-info-label">Beskrivelse</div><div class="chat-info-val">${escHtml(b.description||'Ingen beskrivelse')}</div></div>
      <div class="chat-info-block"><div class="chat-info-label">Interesser</div><div style="display:flex;flex-wrap:wrap;gap:0.4rem;margin-top:0.4rem">${tags||'–'}</div></div>
      <div class="chat-info-block"><div class="chat-info-label">Boble-type</div><div class="chat-info-val">${typeLabel(b.type)}</div></div>
      <div class="chat-info-block"><div class="chat-info-label">Sted</div><div class="chat-info-val">${escHtml(b.location||'Ikke angivet')}</div></div>
      <div>
        <button class="chat-info-btn primary" data-action="openQRModal" data-id="${b.id}">${icon("qrcode")} Del boble / QR-kode</button>
        <button class="chat-info-btn danger" data-action="leaveBubble" data-id="${b.id}">${icon("logout")} Forlad boblen</button>
      </div>`;
  } catch(e) { console.error("bcLoadInfo:", e); showToast(e.message || "Ukendt fejl"); }
}

// Person sheet from chat avatar

// ══════════════════════════════════════════════════════════
//  BUBBLE INVITE SYSTEM
// ══════════════════════════════════════════════════════════
var inviteBubbleId = null;
var inviteSelected = [];

async function openInviteModal(bubbleId) {
  inviteBubbleId = bubbleId;
  inviteSelected = [];
  var overlay = document.getElementById('invite-modal-overlay');
  var list = document.getElementById('invite-list');
  if (!overlay || !list) return;
  overlay.style.display = 'flex';
  list.innerHTML = '<div style="text-align:center;padding:1rem;font-size:0.75rem;color:var(--muted)">Henter gemte kontakter...</div>';

  try {
    // Get saved contacts
    var r1 = await sb.from('saved_contacts').select('contact_id').eq('user_id', currentUser.id);
    var contactIds = (r1.data || []).map(function(s) { return s.contact_id; });
    if (contactIds.length === 0) {
      list.innerHTML = '<div style="text-align:center;padding:1.5rem;font-size:0.78rem;color:var(--muted)">Du har ingen gemte kontakter endnu.<br>Gem profiler fra radaren f\u00f8rst.</div>';
      return;
    }
    // Get profiles
    var r2 = await sb.from('profiles').select('id,name,title,keywords').in('id', contactIds);
    var profiles = r2.data || [];
    // Get existing members to exclude
    var r3 = await sb.from('bubble_members').select('user_id').eq('bubble_id', bubbleId);
    var memberIds = (r3.data || []).map(function(m) { return m.user_id; });
    // Get pending invites to exclude
    var r4 = await sb.from('bubble_invitations').select('to_user_id').eq('bubble_id', bubbleId).eq('status', 'pending');
    var pendingIds = (r4.data || []).map(function(inv) { return inv.to_user_id; });

    var available = profiles.filter(function(p) { return memberIds.indexOf(p.id) < 0; });
    if (available.length === 0) {
      list.innerHTML = '<div style="text-align:center;padding:1.5rem;font-size:0.78rem;color:var(--muted)">Alle dine gemte kontakter er allerede i denne boble.</div>';
      return;
    }
    var colors = proxColors || ['linear-gradient(135deg,#8B7FFF,#E85D8A)'];
    list.innerHTML = available.map(function(p, i) {
      var ini = (p.name||'?').split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();
      var col = colors[i % colors.length];
      var isPending = pendingIds.indexOf(p.id) >= 0;
      return '<label class="invite-row' + (isPending ? ' pending' : '') + '" data-uid="' + p.id + '">' +
        '<div class="invite-avatar" style="background:' + col + '">' + escHtml(ini) + '</div>' +
        '<div style="flex:1;min-width:0">' +
          '<div class="fw-600 fs-085">' + escHtml(p.name || '?') + '</div>' +
          '<div class="fs-072 text-muted">' + escHtml(p.title || '') + '</div>' +
        '</div>' +
        (isPending ? '<span class="fs-065 text-muted">Afventer</span>' :
          '<input type="checkbox" class="invite-check" data-uid="' + p.id + '" onchange="toggleInvite(this)">') +
      '</label>';
    }).join('');
  } catch(e) { console.error('openInviteModal:', e); list.innerHTML = '<div style="padding:1rem;color:var(--accent2)">Kunne ikke hente kontakter</div>'; }
}

function closeInviteModal() {
  var overlay = document.getElementById('invite-modal-overlay');
  if (overlay) overlay.style.display = 'none';
  inviteSelected = [];
}

function toggleInvite(cb) {
  var uid = cb.dataset.uid;
  if (cb.checked) { if (inviteSelected.indexOf(uid) < 0) inviteSelected.push(uid); }
  else { inviteSelected = inviteSelected.filter(function(id) { return id !== uid; }); }
  var btn = document.getElementById('invite-send-btn');
  if (btn) btn.textContent = inviteSelected.length > 0 ? 'Send (' + inviteSelected.length + ')' : 'Send invitationer';
}

async function sendBubbleInvites() {
  if (inviteSelected.length === 0) return showToast('V\u00e6lg mindst \u00e9n kontakt');
  try {
    var rows = inviteSelected.map(function(uid) {
      return { bubble_id: inviteBubbleId, from_user_id: currentUser.id, to_user_id: uid, status: 'pending' };
    });
    var { error } = await sb.from('bubble_invitations').insert(rows);
    if (error) throw error;
    closeInviteModal();
    showToast(inviteSelected.length + ' invitation' + (inviteSelected.length > 1 ? 'er' : '') + ' sendt \u2713');
  } catch(e) { console.error('sendBubbleInvites:', e); showToast('Kunne ikke sende: ' + (e.message || 'ukendt fejl')); }
}


function bcOpenPerson(userId, name, title, color) {
  const initials = (name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  document.getElementById('ps-avatar').style.background = color;
  document.getElementById('ps-avatar').textContent = initials;
  document.getElementById('ps-name').textContent = name || 'Ukendt';
  document.getElementById('ps-sub').textContent = title || '';
  document.getElementById('ps-bio').textContent = '';
  document.getElementById('ps-bubbleup-btn').style.display = 'flex';
  document.getElementById('ps-bubbleup-confirm').classList.remove('show');
  // Fetch full profile for bio + LinkedIn
  const liBtn = document.getElementById('ps-linkedin-btn');
  liBtn.style.display = 'none';
  sb.from('profiles').select('bio,linkedin').eq('id', userId).single().then(({data}) => {
    if (data?.bio) document.getElementById('ps-bio').textContent = data.bio;
    if (data?.linkedin) { liBtn.href = data.linkedin.startsWith('http') ? data.linkedin : 'https://' + data.linkedin; liBtn.style.display = 'flex'; }
  });
  // Store userId
  document.getElementById('person-sheet-el').dataset.userId = userId;
  document.getElementById('person-sheet-el').dataset.userName = name;
  // Check if contact is already saved — update button state
  const saveBtn = document.getElementById('ps-save-btn');
  if (saveBtn) {
    saveBtn.innerHTML = icon('bookmark') + ' Gem';
    sb.from('saved_contacts').select('id').eq('user_id', currentUser.id).eq('contact_id', userId).maybeSingle().then(({data}) => {
      if (data) saveBtn.innerHTML = icon('bookmarkFill') + ' Gemt';
    });
  }
  document.getElementById('ps-overlay').classList.add('open');
  setTimeout(() => document.getElementById('person-sheet-el').classList.add('open'), 10);
}

function psClose() {
  document.getElementById('person-sheet-el').classList.remove('open');
  document.getElementById('ps-bubbleup-btn').style.display = 'flex';
  document.getElementById('ps-bubbleup-confirm').classList.remove('show');
  setTimeout(() => document.getElementById('ps-overlay').classList.remove('open'), 320);
}

function psMessage() { const uid = document.getElementById('person-sheet-el').dataset.userId; psClose(); setTimeout(() => openChat(uid, 'screen-bubble-chat'), 350); }
function psProfile() { const uid = document.getElementById('person-sheet-el').dataset.userId; psClose(); setTimeout(() => openPerson(uid, 'screen-bubble-chat'), 350); }
// psMeeting removed — feature shelved

function psTriggerBubbleUp() {
  const name = document.getElementById('person-sheet-el').dataset.userName?.split(' ')[0] || 'personen';
  document.getElementById('ps-bubbleup-name').textContent = name;
  document.getElementById('ps-bubbleup-btn').style.display = 'none';
  document.getElementById('ps-bubbleup-confirm').classList.add('show');
}

function psCancelBubbleUp() {
  document.getElementById('ps-bubbleup-btn').style.display = 'flex';
  document.getElementById('ps-bubbleup-confirm').classList.remove('show');
}

async function psConfirmBubbleUp() {
  try {
    const toUserId = document.getElementById('person-sheet-el').dataset.userId;
    const name = document.getElementById('person-sheet-el').dataset.userName?.split(' ')[0] || 'personen';
    await sendBubbleUpInvitation(toUserId);
    psClose();
    showToast('🫧 Invitation sendt til ' + name + '!');
  } catch(e) { console.error("psConfirmBubbleUp:", e); showToast(e.message || "Ukendt fejl"); }
}

// Bubble-up from screen-person
function personTriggerBubbleUp() {
  const name = (document.getElementById('person-name')?.textContent||'').split(' ')[0] || 'personen';
  document.getElementById('person-bubbleup-name').textContent = name;
  document.getElementById('person-bubbleup-btn').style.display = 'none';
  document.getElementById('person-bubbleup-confirm').classList.add('show');
}

function personCancelBubbleUp() {
  document.getElementById('person-bubbleup-btn').style.display = 'flex';
  document.getElementById('person-bubbleup-confirm').classList.remove('show');
}

async function personConfirmBubbleUp() {
  try {
    if (!currentPerson) return;
    const name = (document.getElementById('person-name')?.textContent||'').split(' ')[0] || 'personen';
    await sendBubbleUpInvitation(currentPerson);
    personCancelBubbleUp();
    showToast('🫧 Invitation sendt til ' + name + '!');
  } catch(e) { console.error("personConfirmBubbleUp:", e); showToast(e.message || "Ukendt fejl"); }
}

async function sendBubbleUpInvitation(toUserId) {
  try {
    // Create a hidden private bubble first
    const myName = currentProfile?.name || 'Min boble';
    const theirName = (document.getElementById('person-name')?.textContent || document.getElementById('ps-name')?.textContent || '');
    const { data: bubble } = await sb.from('bubbles').insert({
      name: myName.split(' ')[0] + ' & ' + (theirName.split(' ')[0] || 'ven'),
      type: 'standard',
      visibility: 'hidden',
      created_by: currentUser.id,
      description: 'Privat boble'
    }).select().single();

    if (!bubble) { showToast('Noget gik galt'); return; }

    // Add creator as member
    await sb.from('bubble_members').insert({bubble_id: bubble.id, user_id: currentUser.id});

    // Send invitation
    await sb.from('bubble_invitations').insert({
      bubble_id: bubble.id,
      from_user_id: currentUser.id,
      to_user_id: toUserId
    });
  } catch(e) { console.error("sendBubbleUpInvitation:", e); showToast(e.message || "Ukendt fejl"); }
}


// ══════════════════════════════════════════════════════════
//  CHAT INPUT EVENT LISTENERS (bind exactly once on load)
// ══════════════════════════════════════════════════════════
window.addEventListener('load', () => {
  const bcInput = document.getElementById('bc-input');
  if (bcInput) {
    bcInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        bcSendMessage();
      }
    }, { passive: false });
  }

  const dmInput = document.getElementById('chat-input');
  if (dmInput) {
    dmInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (!currentChatUser) return;
        sendMessage();
      }
    }, { passive: false });
  }

  const dmFileInput = document.getElementById('dm-file-input');
  if (dmFileInput) {
    dmFileInput.addEventListener('change', () => dmHandleFile(dmFileInput));
  }
});

// ══════════════════════════════════════════════════════════
//  GLOBAL EVENT DELEGATION
// ══════════════════════════════════════════════════════════
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;
  const id = el.dataset.id;
  const from = el.dataset.from;
  switch (action) {
    case 'openBubble': openBubble(id); break;
    case 'openPerson': openPerson(id, from); break;
    case 'openChat': openChat(id, from); break;
    case 'joinBubble': joinBubble(id); break;
    case 'requestJoin': requestJoin(id); break;
    case 'openQRModal': openQRModal(id); break;
    case 'leaveBubble': leaveBubble(id); break;
    case 'openEditBubble': openEditBubble(id); break;
    case 'openBubbleChat': openBubbleChat(id, from); break;
  }
});

// ══════════════════════════════════════════════════════════
//  PULL-TO-REFRESH
// ══════════════════════════════════════════════════════════
(function initPullToRefresh() {
  const PTR_THRESHOLD = 100;  // px to pull before triggering
  const PTR_MAX = 120;        // max indicator travel
  const PTR_RESISTANCE = 3;   // finger-to-indicator ratio

  // Map: screen ID → { scrollEl selector, refreshFn }
  const screenMap = {
    'screen-home':          { scroll: '#home-scroll', fn: loadHome },
    'screen-bubbles':       { scroll: '#screen-bubbles .scroll-area', fn: loadMyBubbles },
    'screen-discover':      { scroll: '#screen-discover .scroll-area', fn: loadDiscover },
    'screen-messages':      { scroll: '#screen-messages .scroll-area', fn: loadMessages },
    'screen-notifications': { scroll: '#screen-notifications .scroll-area', fn: loadNotifications },
    'screen-profile':       { scroll: null, fn: loadProfile }, // uses active panel
  };

  // Create the indicator element
  const indicator = document.createElement('div');
  indicator.className = 'ptr-indicator';
  indicator.innerHTML = '<div class="ptr-spinner"></div>';
  document.body.appendChild(indicator);

  let startY = 0;
  let pulling = false;
  let refreshing = false;

  function getScrollEl() {
    const active = document.querySelector('.screen.active');
    if (!active) return null;
    const cfg = screenMap[active.id];
    if (!cfg) return null;

    // Profile: find the visible panel
    if (active.id === 'screen-profile') {
      return active.querySelector('[id^="prof-panel-"]:not([style*="display:none"]):not([style*="display: none"])') ||
             active.querySelector('[id^="prof-panel-"]');
    }
    return cfg.scroll ? document.querySelector(cfg.scroll) : active.querySelector('.scroll-area');
  }

  function getRefreshFn() {
    const active = document.querySelector('.screen.active');
    if (!active) return null;
    const cfg = screenMap[active.id];
    return cfg?.fn || null;
  }

  document.addEventListener('touchstart', (e) => {
    if (refreshing) return;
    const scrollEl = getScrollEl();
    if (!scrollEl) return;
    if (scrollEl.scrollTop > 5) return; // only when at top
    startY = e.touches[0].clientY;
    pulling = true;
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (!pulling || refreshing) return;
    const scrollEl = getScrollEl();
    if (!scrollEl || scrollEl.scrollTop > 5) { pulling = false; return; }

    const dy = (e.touches[0].clientY - startY) / PTR_RESISTANCE;
    if (dy < 0) return;

    const travel = Math.min(dy, PTR_MAX);
    indicator.style.transform = `translateX(-50%) translateY(${travel - 40}px)`;
    indicator.style.opacity = Math.min(travel / PTR_THRESHOLD, 1);
    indicator.classList.add('visible');

    if (travel >= PTR_THRESHOLD) {
      indicator.classList.add('ready');
    } else {
      indicator.classList.remove('ready');
    }
  }, { passive: true });

  document.addEventListener('touchend', async () => {
    if (!pulling) return;
    pulling = false;

    if (!indicator.classList.contains('ready')) {
      resetIndicator();
      return;
    }

    const fn = getRefreshFn();
    if (!fn) { resetIndicator(); return; }

    // Trigger refresh
    refreshing = true;
    indicator.classList.add('refreshing');
    indicator.classList.remove('ready');
    indicator.style.transform = 'translateX(-50%) translateY(20px)';
    indicator.style.opacity = '1';

    try {
      await fn();
    } catch(e) { console.error('PTR refresh error:', e); }

    refreshing = false;
    indicator.classList.remove('refreshing');
    resetIndicator();
    showToast('Opdateret');
  }, { passive: true });

  function resetIndicator() {
    indicator.style.transition = 'transform 0.3s, opacity 0.3s';
    indicator.style.transform = 'translateX(-50%) translateY(-40px)';
    indicator.style.opacity = '0';
    setTimeout(() => {
      indicator.classList.remove('visible', 'ready', 'refreshing');
      indicator.style.transition = '';
    }, 300);
  }
})();

// ══════════════════════════════════════════════════════════
//  LIVE BUBBLE
// ══════════════════════════════════════════════════════════
const LIVE_EXPIRE_HOURS = 6;
let currentLiveBubble = null; // { bubble_id, bubble_name, bubble_location, checked_in_at, member_count }

async function loadLiveBubbleStatus() {
  try {
    const card = document.getElementById('live-bubble-card');
    const activeEl = document.getElementById('live-bubble-active');
    const idleEl = document.getElementById('live-bubble-idle');
    if (!card) return;
    card.style.display = 'block';

    // Find active live check-in for current user
    const expireCutoff = new Date(Date.now() - LIVE_EXPIRE_HOURS * 60 * 60 * 1000).toISOString();

    const { data: myLive } = await sb.from('bubble_members')
      .select('bubble_id, checked_in_at, bubbles(id, name, location, type)')
      .eq('user_id', currentUser.id)
      .not('checked_in_at', 'is', null)
      .is('checked_out_at', null)
      .gte('checked_in_at', expireCutoff)
      .limit(1)
      .single();

    if (myLive && myLive.bubbles && myLive.bubbles.type === 'live') {
      // User is checked in
      currentLiveBubble = {
        bubble_id: myLive.bubble_id,
        bubble_name: myLive.bubbles.name,
        bubble_location: myLive.bubbles.location,
        checked_in_at: myLive.checked_in_at
      };

      // Count active members
      const { count } = await sb.from('bubble_members')
        .select('*', { count: 'exact', head: true })
        .eq('bubble_id', myLive.bubble_id)
        .not('checked_in_at', 'is', null)
        .is('checked_out_at', null)
        .gte('checked_in_at', expireCutoff);

      currentLiveBubble.member_count = count || 1;

      document.getElementById('live-bubble-name').textContent = currentLiveBubble.bubble_name;
      const since = new Date(currentLiveBubble.checked_in_at);
      const mins = Math.round((Date.now() - since.getTime()) / 60000);
      const timeStr = mins < 60 ? mins + ' min' : Math.round(mins / 60) + 't ' + (mins % 60) + 'min';
      document.getElementById('live-bubble-meta').textContent =
        (currentLiveBubble.bubble_location ? currentLiveBubble.bubble_location + ' · ' : '') + timeStr + ' siden';
      document.getElementById('live-bubble-count').textContent = currentLiveBubble.member_count;

      activeEl.style.display = 'block';
      idleEl.style.display = 'none';
    } else {
      // Not checked in — auto-expire old ones
      currentLiveBubble = null;
      activeEl.style.display = 'none';
      idleEl.style.display = 'block';
    }
  } catch (e) {
    console.error('loadLiveBubbleStatus:', e);
    // Show idle state on error
    const card = document.getElementById('live-bubble-card');
    if (card) card.style.display = 'block';
    document.getElementById('live-bubble-active').style.display = 'none';
    document.getElementById('live-bubble-idle').style.display = 'block';
  }
}

function openLiveCheckin() {
  loadLiveCheckinList();
  openModal('modal-live-checkin');
}

async function loadLiveCheckinList() {
  const list = document.getElementById('live-checkin-list');
  list.innerHTML = '<div class="spinner"></div>';
  try {
    const expireCutoff = new Date(Date.now() - LIVE_EXPIRE_HOURS * 60 * 60 * 1000).toISOString();

    // Get all live bubbles with recent activity
    const { data: liveBubbles } = await sb.from('bubbles')
      .select('id, name, location, created_at')
      .eq('type', 'live')
      .order('created_at', { ascending: false })
      .limit(20);

    if (!liveBubbles || liveBubbles.length === 0) {
      list.innerHTML = '<div class="sub-muted" style="padding:0.5rem 0;text-align:center">Ingen aktive steder. Opret det første!</div>';
      return;
    }

    // Get active member counts for each
    const bubbleIds = liveBubbles.map(b => b.id);
    const { data: activeMembers } = await sb.from('bubble_members')
      .select('bubble_id')
      .in('bubble_id', bubbleIds)
      .not('checked_in_at', 'is', null)
      .is('checked_out_at', null)
      .gte('checked_in_at', expireCutoff);

    const countMap = {};
    (activeMembers || []).forEach(m => {
      countMap[m.bubble_id] = (countMap[m.bubble_id] || 0) + 1;
    });

    // Filter to only show bubbles with active members OR created recently (last 24h)
    const recentCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const filtered = liveBubbles.filter(b => (countMap[b.id] || 0) > 0 || b.created_at > recentCutoff);

    if (filtered.length === 0) {
      list.innerHTML = '<div class="sub-muted" style="padding:0.5rem 0;text-align:center">Ingen aktive steder lige nu. Opret det første!</div>';
      return;
    }

    list.innerHTML = filtered.map(b => {
      const cnt = countMap[b.id] || 0;
      return `<div class="live-checkin-item" onclick="liveCheckin('${b.id}')">
        <div class="live-checkin-icon">${ico('pin')}</div>
        <div style="flex:1;min-width:0">
          <div class="fw-600 fs-085">${escHtml(b.name)}</div>
          <div class="fs-072 text-muted">${escHtml(b.location || '')}</div>
        </div>
        ${cnt > 0 ? '<div class="live-checkin-count"><div class="live-dot" style="width:6px;height:6px;margin:0"></div> ' + cnt + '</div>' : '<div class="fs-072 text-muted">0 her</div>'}
      </div>`;
    }).join('');
  } catch (e) {
    console.error('loadLiveCheckinList:', e);
    list.innerHTML = '<div class="sub-muted" style="padding:0.5rem 0">Kunne ikke hente steder</div>';
  }
}

async function liveCheckin(bubbleId) {
  try {
    showToast('Checker ind...');

    // 1. Auto-checkout from any current live bubble
    await liveAutoCheckout();

    // 2. Check if already a member
    const { data: existing } = await sb.from('bubble_members')
      .select('id, checked_in_at, checked_out_at')
      .eq('bubble_id', bubbleId)
      .eq('user_id', currentUser.id)
      .maybeSingle();

    if (existing) {
      // Re-check-in
      await sb.from('bubble_members').update({
        checked_in_at: new Date().toISOString(),
        checked_out_at: null
      }).eq('id', existing.id);
    } else {
      // New member + check-in
      await sb.from('bubble_members').insert({
        bubble_id: bubbleId,
        user_id: currentUser.id,
        checked_in_at: new Date().toISOString()
      });
    }

    closeModal('modal-live-checkin');
    showToast('📍 Du er checked ind!');
    await loadLiveBubbleStatus();
    loadHome();
  } catch (e) {
    console.error('liveCheckin:', e);
    showToast('Fejl ved check-in: ' + (e.message || 'ukendt'));
  }
}

async function liveCreateAndCheckin() {
  try {
    const name = document.getElementById('live-new-name').value.trim();
    const location = document.getElementById('live-new-location').value.trim();
    if (!name) return showToast('Angiv stedets navn');

    showToast('Opretter sted...');

    // Create live bubble
    const { data: bubble, error } = await sb.from('bubbles').insert({
      name,
      type: 'live',
      type_label: 'Live',
      visibility: 'public',
      location,
      created_by: currentUser.id,
      description: 'Live check-in'
    }).select().single();

    if (error) return showToast('Fejl: ' + error.message);

    // Check in
    await liveAutoCheckout();
    await sb.from('bubble_members').insert({
      bubble_id: bubble.id,
      user_id: currentUser.id,
      checked_in_at: new Date().toISOString()
    });

    // Clear form
    document.getElementById('live-new-name').value = '';
    document.getElementById('live-new-location').value = '';

    closeModal('modal-live-checkin');
    showToast('📍 ' + name + ' oprettet — du er checked ind!');
    await loadLiveBubbleStatus();
  } catch (e) {
    console.error('liveCreateAndCheckin:', e);
    showToast('Fejl: ' + (e.message || 'ukendt'));
  }
}

async function liveAutoCheckout() {
  try {
    // Checkout from ALL active live bubbles
    const expireCutoff = new Date(Date.now() - LIVE_EXPIRE_HOURS * 60 * 60 * 1000).toISOString();

    const { data: activeLive } = await sb.from('bubble_members')
      .select('id, bubble_id, bubbles(type)')
      .eq('user_id', currentUser.id)
      .not('checked_in_at', 'is', null)
      .is('checked_out_at', null)
      .gte('checked_in_at', expireCutoff);

    if (!activeLive || activeLive.length === 0) return;

    const liveIds = activeLive.filter(m => m.bubbles?.type === 'live').map(m => m.id);
    if (liveIds.length > 0) {
      await sb.from('bubble_members').update({
        checked_out_at: new Date().toISOString()
      }).in('id', liveIds);
    }
  } catch (e) {
    console.error('liveAutoCheckout:', e);
  }
}

async function liveCheckout() {
  try {
    if (!currentLiveBubble) return;
    await sb.from('bubble_members').update({
      checked_out_at: new Date().toISOString()
    }).eq('bubble_id', currentLiveBubble.bubble_id).eq('user_id', currentUser.id);

    currentLiveBubble = null;
    showToast('Checked ud 👋');
    await loadLiveBubbleStatus();
  } catch (e) {
    console.error('liveCheckout:', e);
    showToast('Fejl ved checkout');
  }
}

function openLiveBubble() {
  if (!currentLiveBubble) return;
  closeRadarSheet();
  openBubbleChat(currentLiveBubble.bubble_id, 'screen-home');
}

// ══════════════════════════════════════════════════════════
//  APP BOOT
// ══════════════════════════════════════════════════════════
window.addEventListener('load', async () => {
  await checkAuth();
  await checkQRJoin();
  await checkPendingJoin();
  if (currentUser) {
    updateUnreadBadge();
    subscribeToIncoming();
    loadLiveBubbleStatus();
  }
});
