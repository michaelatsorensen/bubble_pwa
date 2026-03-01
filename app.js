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
    el.style.color = '#ff6584';
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
    el.style.color = '#ff6584';
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
let allBubbles = [];
let cbChips = [], epChips = [], epDynChips = [], ebChips = [], obChips = [];
let chatSubscription = null;
let isAnon = false;

function initSupabase() {
  if (SUPABASE_URL === "DIN_SUPABASE_URL_HER") {
    document.getElementById('loading-msg').textContent = '⚠️ Indsæt dine Supabase-nøgler i filen';
    document.getElementById('loading-msg').style.color = '#ff6584';
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
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
  window.scrollTo(0,0);

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
    document.getElementById('loading-msg').style.color = '#ff6584';
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
    goTo('screen-home');
    showToast('Velkommen til Bubble! 🫧');
  } catch(e) { console.error("handleSignup:", e); showToast(e.message || "Ukendt fejl"); }
}

async function handleLogout() {
  try {
    // Clean up realtime subscriptions
    if (chatSubscription) { chatSubscription.unsubscribe(); chatSubscription = null; }
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
      nameEl.textContent = (currentProfile.name.split(' ')[0]) + ' 👋';
    }

    // Load all dashboard data in parallel
    await Promise.all([
      loadHomeBubblesCard(),
      loadHomeMessagesCard(),
      loadHomeNotifCard(),
      updateRadarCount(),
    ]);

    // Also load bubbles screen data if it exists
    loadMyBubbles();
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
      joinedList.innerHTML = '<div class="empty-state"><div class="empty-icon">🫧</div><div class="empty-text">Du er ikke i nogen bobler endnu.<br>Opdag eller opret en boble!</div></div>';
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
        const visIcon = b.visibility === 'private' ? '🔒' : b.visibility === 'hidden' ? '👁️' : '🌍';
        return `<div class="card flex-row-center" data-action="openBubble" data-id="${b.id}">
          <div class="bubble-icon" style="background:${bubbleColor(b.type, 0.15)}">${bubbleEmoji(b.type)}</div>
          <div style="flex:1">
            <div class="fw-600 fs-09">${escHtml(b.name)}</div>
            <div class="fs-075 text-muted">${visIcon} ${b.type_label||b.type}${b.location ? ' · '+escHtml(b.location) : ''}</div>
          </div>
          <div style="display:flex;gap:0.4rem;align-items:center">
            <button class="btn-sm btn-ghost" data-action="openEditBubble" data-id="${b.id}" onclick="event.stopPropagation()" style="font-size:0.8rem;padding:0.3rem 0.5rem">✏️</button>
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
      `<div class="card" style="padding:0.85rem 1.1rem;cursor:default">
        <div style="font-weight:600;font-size:0.9rem">${bubbleEmoji(b.type)} ${escHtml(b.name)}</div>
        <div style="font-size:0.75rem;color:var(--muted);margin-top:0.2rem">${b.created_by === currentUser.id ? '👑 Ejer' : 'Aktiv'}</div>
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
    <div class="bubble-icon" style="background:${bubbleColor(b.type, 0.15)}">${bubbleEmoji(b.type)}</div>
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
    allBubbles = (bubbles || []).map(b => ({
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
    list.innerHTML = '<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-text">Ingen bobler endnu.<br>Opret den første!</div></div>';
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

async function loadBubbleMembers(bubbleId) {
  try {
    const { data: members } = await sb.from('bubble_members')
      .select('user_id, profiles(id, name, title, keywords, is_anon)')
      .eq('bubble_id', bubbleId).neq('user_id', currentUser.id);

    const list = document.getElementById('bubble-members-list');

    // Stats
    const { count } = await sb.from('bubble_members').select('*',{count:'exact',head:true}).eq('bubble_id',bubbleId);
    document.getElementById('detail-stats').innerHTML = `
      <div class="stat-box"><div class="stat-num">${count||0}</div><div class="stat-label">Aktive</div></div>
      <div class="stat-box"><div class="stat-num">${members?.length||0}</div><div class="stat-label">Andre</div></div>
      <div class="stat-box"><div class="stat-num" style="color:var(--accent3)">${members?.length ? Math.round(60 + Math.random()*35) : 0}%</div><div class="stat-label">Din match-rate</div></div>`;

    if (!members || members.length === 0) {
      list.innerHTML = '<div class="empty-state"><div class="empty-icon">👥</div><div class="empty-text">Ingen andre i boblen endnu.</div></div>';
      return;
    }

    const myKw = (currentProfile?.keywords || []).map(k => k.toLowerCase());
    const scored = members.map(m => {
      const p = m.profiles;
      if (!p) return null;
      const theirKw = (p.keywords || []).map(k => k.toLowerCase());
      const overlap = myKw.filter(k => theirKw.includes(k));
      const score = theirKw.length ? Math.round((overlap.length / Math.max(myKw.length, theirKw.length, 1)) * 100 + 40 + Math.random()*20) : Math.round(40 + Math.random()*30);
      return { ...p, score: Math.min(score, 99), overlap };
    }).filter(Boolean).sort((a,b) => b.score - a.score);

    list.innerHTML = scored.map(p => {
      const initials = p.is_anon ? '?' : (p.name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
      const name = p.is_anon ? 'Anonym bruger' : escHtml(p.name || '?');
      const role = p.is_anon ? '' : escHtml(p.title || '');
      const colors = ['linear-gradient(135deg,#6c63ff,#8b83ff)','linear-gradient(135deg,#ff6584,#ffb347)','linear-gradient(135deg,#43e8b0,#6c63ff)','linear-gradient(135deg,#ffb347,#ff6584)'];
      const col = colors[Math.abs(p.id.charCodeAt(0)) % colors.length];
      return `<div class="card flex-row-center" data-action="openPerson" data-id="${p.id}" data-from="screen-bubble-detail">
        <div class="avatar" style="background:${col}">${initials}</div>
        <div style="flex:1">
          <div class="fw-600 fs-09">${name}</div>
          <div class="fs-075 text-muted">${role}</div>
          <div class="match-bar-wrap"><div class="match-bar" style="width:${p.score}%"></div></div>
        </div>
        <div class="fs-08 fw-700" style="color:var(--accent3)">${p.score}%</div>
      </div>`;
    }).join('');
  } catch(e) { console.error("loadBubbleMembers:", e); showToast(e.message || "Ukendt fejl"); }
}

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
    const score = theirKw.length ? Math.round((overlap.length / Math.max(myKw.length, theirKw.length, 1)) * 100 + 40 + Math.random()*20) : Math.round(40 + Math.random()*30);
    document.getElementById('person-match-label').textContent = `Match: ${Math.min(score,99)}%`;

    document.getElementById('person-tags').innerHTML = (p.keywords||[]).map(k => `<span class="tag">${escHtml(k)}</span>`).join('');
    document.getElementById('person-bio').textContent = p.bio || '';

    // LinkedIn button
    const liBtn = document.getElementById('person-linkedin-btn');
    if (p.linkedin && !p.is_anon) {
      liBtn.style.display = 'flex';
      liBtn.href = p.linkedin.startsWith('http') ? p.linkedin : 'https://' + p.linkedin;
    } else {
      liBtn.style.display = 'none';
    }

    const overlapEl = document.getElementById('person-overlap');
    if (overlap.length) {
      overlapEl.innerHTML = overlap.map(k => `<span class="tag mint">✓ ${escHtml(k)}</span>`).join('');
    } else {
      overlapEl.innerHTML = '<span class="fs-085 text-muted">Ingen direkte overlap fundet</span>';
    }

    const dynEl = document.getElementById('person-dynamic-keywords');
    if ((p.dynamic_keywords||[]).length) {
      dynEl.innerHTML = '<div class="section-label">Søger nu</div>' + p.dynamic_keywords.map(k => `<span class="tag gold">🔥 ${escHtml(k)}</span>`).join('');
    } else { dynEl.innerHTML = ''; }

    // Check if saved
    const { data: saved } = await sb.from('saved_contacts').select('id').eq('user_id', currentUser.id).eq('contact_id', userId).single();
    document.getElementById('save-btn').textContent = saved ? '✅ Gemt' : '🔖 Gem';
  } catch(e) { console.error("openPerson:", e); showToast(e.message || "Ukendt fejl"); }
}

async function saveContact() {
  try {
    if (!currentPerson) return;
    const { data: existing } = await sb.from('saved_contacts').select('id').eq('user_id', currentUser.id).eq('contact_id', currentPerson).single();
    if (existing) { showToast('Allerede gemt'); return; }
    await sb.from('saved_contacts').insert({ user_id: currentUser.id, contact_id: currentPerson });
    document.getElementById('save-btn').querySelector('.btn-icon').textContent = '✅';
    showToast('Kontakt gemt! 🔖');
  } catch(e) { console.error("saveContact:", e); showToast(e.message || "Ukendt fejl"); }
}

function proposeMeeting() {
  document.getElementById('meeting-msg').value = '';
  openModal('modal-meeting');
}

async function sendMeetingProposal() {
  try {
    const msg = document.getElementById('meeting-msg').value.trim();
    const time = document.getElementById('meeting-time').value;
    if (!msg) return showToast('Skriv en besked');
    const fullMsg = `☕ Mødeanmodning${time ? '\n📅 ' + new Date(time).toLocaleString('da-DK') : ''}\n\n${msg}`;
    await sendDirectMessage(currentPerson, fullMsg);
    closeModal('modal-meeting');
    showToast('Mødeanmodning sendt! ☕');
  } catch(e) { console.error("sendMeetingProposal:", e); showToast(e.message || "Ukendt fejl"); }
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

function subscribeToIncoming() {
  sb.channel('incoming-messages')
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
      list.innerHTML = '<div class="empty-state"><div class="empty-icon">💬</div><div class="empty-text">Ingen beskeder endnu.<br>Find en person og start en samtale!</div></div>';
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
        <div class="avatar" style="background:linear-gradient(135deg,#6c63ff,#ff6584)">${initials}</div>
        <div style="flex:1">
          <div class="${isUnread?'fw-700':'fw-600'} fs-09">${escHtml(p.name||'Ukendt')}</div>
          <div class="fs-078 text-muted text-truncate">${escHtml(lastMsg.content||'')}</div>
        </div>
        ${isUnread ? '<div class="live-dot"></div>' : ''}
      </div>`;
    }).join('');
  } catch(e) { console.error("loadMessages:", e); showToast(e.message || "Ukendt fejl"); }
}

async function openChat(userId) {
  try {
    currentChatUser = userId;
    const { data: p } = await sb.from('profiles').select('name,title').eq('id', userId).single();
    document.getElementById('chat-name').textContent = p?.name || 'Ukendt';
    document.getElementById('chat-role').textContent = p?.title || '';
    goTo('screen-chat');
    await loadChatMessages();
    subscribeToChat();

    // Mark messages as read
    await sb.from('messages').update({ read_at: new Date().toISOString() })
      .eq('sender_id', userId).eq('receiver_id', currentUser.id).is('read_at', null);
    await updateUnreadBadge();
  } catch(e) { console.error("openChat:", e); showToast(e.message || "Ukendt fejl"); }
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

    el.innerHTML = sorted.map(m => {
      const sent = m.sender_id === currentUser.id;
      const time = new Date(m.created_at).toLocaleTimeString('da-DK', {hour:'2-digit',minute:'2-digit'});
      return `<div style="display:flex;flex-direction:column;align-items:${sent?'flex-end':'flex-start'}">
        <div class="msg-bubble ${sent?'sent':'recv'}">${escHtml(m.content||'')}</div>
        <div class="msg-time" style="text-align:${sent?'right':'left'}">${time}</div>
      </div>`;
    }).join('');
    el.scrollTop = el.scrollHeight;
  } catch(e) { console.error("loadChatMessages:", e); showToast(e.message || "Ukendt fejl"); }
}

function subscribeToChat() {
  if (chatSubscription) chatSubscription.unsubscribe();
  chatSubscription = sb.channel('chat-' + currentChatUser)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
      const m = payload.new;
      if (!m) return;
      const el = document.getElementById('chat-messages');
      const sent = m.sender_id === currentUser.id;
      const time = new Date(m.created_at).toLocaleTimeString('da-DK', {hour:'2-digit',minute:'2-digit'});
      const div = document.createElement('div');
      div.style.cssText = 'display:flex;flex-direction:column;align-items:' + (sent ? 'flex-end' : 'flex-start');
      div.innerHTML = `<div class="msg-bubble ${sent?'sent':'recv'}">${escHtml(m.content||'')}</div><div class="msg-time" style="text-align:${sent?'right':'left'}">${time}</div>`;
      el.appendChild(div);
      el.scrollTop = el.scrollHeight;
      if (!sent) updateUnreadBadge();
    }).subscribe();
}

async function sendMessage() {
  try {
    const input = document.getElementById('chat-input');
    const content = input.value.trim();
    if (!content) return;
    input.value = '';
    await sendDirectMessage(currentChatUser, content);
    await loadChatMessages();
  } catch(e) { console.error("sendMessage:", e); showToast(e.message || "Ukendt fejl"); }
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
  openChat(currentPerson);
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

    // Saved contacts
    const { data: saved } = await sb.from('saved_contacts')
      .select('contact_id, profiles(id,name,title)').eq('user_id', currentUser.id);
    const savedEl = document.getElementById('saved-contacts');
    if (saved && saved.length) {
      savedEl.innerHTML = saved.map(s => {
        const p = s.profiles;
        if (!p) return '';
        const ini = (p.name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
        return `<div class="flex-col-center saved-contact" data-action="openPerson" data-id="${p.id}" data-from="screen-profile">
          <div class="avatar" style="background:linear-gradient(135deg,#6c63ff,#ff6584);width:48px;height:48px;font-size:0.85rem">${ini}</div>
          <div class="fs-065 text-muted text-center text-truncate" style="max-width:56px">${escHtml(p.name?.split(' ')[0]||'?')}</div>
        </div>`;
      }).join('');
    } else {
      savedEl.innerHTML = '<div class="fs-085 text-muted">Ingen gemte kontakter endnu</div>';
    }

    await loadMyBubbles();
  } catch(e) { console.error("loadProfile:", e); showToast(e.message || "Ukendt fejl"); }
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
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
}

// ══════════════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════════════
function escHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function bubbleEmoji(type) {
  return { event:'🚀', local:'📍', theme:'🤖', company:'🏢' }[type] || '🫧';
}

function bubbleColor(type, alpha) {
  const map = { event:`rgba(108,99,255,${alpha})`, local:`rgba(67,232,176,${alpha})`, theme:`rgba(255,179,71,${alpha})`, company:`rgba(255,101,132,${alpha})` };
  return map[type] || `rgba(108,99,255,${alpha})`;
}

function typeLabel(type) {
  return { event:'Event', local:'Lokal', theme:'Tema', company:'Virksomhed' }[type] || type;
}

function updateClock() {
  const now = new Date();
  const t = now.toLocaleTimeString('da-DK', {hour:'2-digit',minute:'2-digit'});
  document.querySelectorAll('.status-bar span:first-child').forEach(el => el.textContent = t);
}

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

    document.getElementById('qr-modal-title').textContent = b.name + ' 🫧';
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
  doc.text('🫧', pageW/2, 51, { align: 'center' });

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
        redirectTo: 'https://michaelatsorensen.github.io/bubble_pwa',
        queryParams: { access_type: 'offline', prompt: 'consent' }
      }
    });
    if (error) showToast('Google login fejl: ' + error.message);
  } catch(e) { console.error("handleGoogleLogin:", e); showToast(e.message || "Ukendt fejl"); }
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
      .select('id, from_user_id, bubble_id, created_at, profiles!bubble_invitations_from_user_id_fkey(name,title)')
      .eq('to_user_id', currentUser.id)
      .eq('status', 'pending')
      .order('created_at', {ascending:false});

    if (invites && invites.length > 0) {
      invites.forEach(inv => {
        const p = inv.profiles || {};
        const initials = (p.name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
        html += `<div class="notif-card invite" id="invite-${inv.id}">
          <div class="notif-header">
            <div class="notif-avatar" style="background:linear-gradient(135deg,#6c63ff,#ff6584)">${initials}</div>
            <div>
              <div class="notif-title">🫧 Bubble up invitation</div>
              <div class="notif-sub">${escHtml(p.name||'Nogen')} vil oprette en privat boble med dig</div>
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
              <div class="notif-avatar" style="background:linear-gradient(135deg,#43e8b0,#6c63ff)">${initials}</div>
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
      html = '<div class="empty-state"><div class="empty-icon">🔔</div><div class="empty-text">Ingen notifikationer endnu</div></div>';
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

async function openBubbleChat(bubbleId, fromScreen) {
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

    document.getElementById('bc-emoji').textContent = bubbleEmoji(b.type);
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
        (isOwner ? `<button class="btn-sm btn-ghost" data-action="openEditBubble" data-id="${b.id}" style="font-size:0.85rem;padding:0.35rem 0.55rem">✏️</button>
        <button class="btn-sm btn-ghost" data-action="openQRModal" data-id="${b.id}" style="font-size:0.85rem;padding:0.35rem 0.55rem">⬛</button>` : '') +
        `<button class="btn-sm btn-ghost" data-action="leaveBubble" data-id="${b.id}" style="font-size:0.72rem">Forlad</button>`;
    } else if (b.visibility === 'hidden') {
      actionArea.innerHTML = `<span style="font-size:0.75rem;color:var(--muted)">👁️ Kun via invitation</span>`;
    } else if (b.visibility === 'private') {
      actionArea.innerHTML = `<button class="btn-sm btn-accent" data-action="requestJoin" data-id="${b.id}">Anmod 🔒</button>`;
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
    document.getElementById('bc-emoji').textContent = bubbleEmoji(b.type);
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
      panel.style.display = t === tab ? 'flex' : 'none';
      panel.style.flexDirection = 'column';
      panel.style.flex = '1';
      panel.style.overflow = 'hidden';
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
      el.innerHTML = '<div class="empty-state" style="margin-top:2rem"><div class="empty-icon">💬</div><div class="empty-text">Ingen beskeder endnu.<br>Vær den første!</div></div>';
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
  const initials = (p.name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  const time = new Date(m.created_at).toLocaleTimeString('da-DK', {hour:'2-digit', minute:'2-digit'});
  const colors = ['linear-gradient(135deg,#065F46,#10B981)','linear-gradient(135deg,#7C2D12,#F97316)','linear-gradient(135deg,#1E3A8A,#7C3AED)','linear-gradient(135deg,#4C1D95,#A78BFA)','linear-gradient(135deg,#0C4A6E,#38BDF8)'];
  const color = colors[Math.abs((p.name||'?').charCodeAt(0)) % colors.length];

  const g = document.createElement('div');
  g.className = 'chat-msg-group ' + (isMe ? 'me' : 'them');
  g.id = 'bc-msg-' + m.id;
  g.dataset.msgId = m.id;
  g.dataset.isMe = isMe;

  if (m.file_url) {
    const ext = m.file_name?.split('.').pop()?.toLowerCase() || '';
    const isImage = ['jpg','jpeg','png','gif','webp'].includes(ext) || (m.file_type||'').startsWith('image/');
    const icon = ext === 'pdf' ? '📄' : ['zip','rar','gz'].includes(ext) ? '🗜️' : '📎';
    const size = m.file_size ? (m.file_size < 1024*1024 ? Math.round(m.file_size/1024)+'KB' : (m.file_size/1024/1024).toFixed(1)+'MB') : '';

    const fileContent = isImage
      ? `<a href="${m.file_url}" target="_blank" rel="noopener" style="display:block">
           <img src="${m.file_url}" alt="${escHtml(m.file_name||'Billede')}"
             style="max-width:220px;max-height:260px;border-radius:12px;display:block;cursor:pointer"
             onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
           <div style="display:none" class="chat-file-bubble">
             <span class="chat-file-icon">🖼️</span>
             <div><div class="chat-file-name">${escHtml(m.file_name||'Billede')}</div><div class="chat-file-size">${size} · Kan ikke vises</div></div>
           </div>
         </a>`
      : `<a class="chat-file-bubble" href="${m.file_url}" target="_blank" rel="noopener">
           <span class="chat-file-icon">${icon}</span>
           <div><div class="chat-file-name">${escHtml(m.file_name||'Fil')}</div><div class="chat-file-size">${size}</div></div>
         </a>`;

    g.innerHTML = `
      ${!isMe ? `<div class="chat-msg-avatar-row"><div class="chat-msg-avatar" style="background:${color}" onclick="bcOpenPerson('${m.user_id}','${p.name||''}','${p.title||''}','${color}')">${initials}</div><span class="chat-msg-sender">${escHtml(p.name||'')}</span></div>` : ''}
      <div class="chat-msg-wrap">
        ${isMe ? `<button class="chat-msg-actions" onclick="bcOpenContext(event,this,true,'${m.id}')">⋯</button>` : ''}
        ${fileContent}
        ${!isMe ? `<button class="chat-msg-actions" onclick="bcOpenContext(event,this,false,'${m.id}')">⋯</button>` : ''}
      </div>
      <div class="chat-msg-meta"><span class="chat-msg-time">${time}</span></div>`;
  } else {
    g.innerHTML = `
      ${!isMe ? `<div class="chat-msg-avatar-row"><div class="chat-msg-avatar" style="background:${color}" onclick="bcOpenPerson('${m.user_id}','${p.name||''}','${p.title||''}','${color}')">${initials}</div><span class="chat-msg-sender">${escHtml(p.name||'')}</span></div>` : ''}
      <div class="chat-msg-wrap">
        ${isMe ? `<button class="chat-msg-actions" onclick="bcOpenContext(event,this,true,'${m.id}')">⋯</button>` : ''}
        <div class="chat-bubble" id="bc-bubble-${m.id}">${escHtml(m.content||'')}${m.edited ? '' : ''}</div>
        ${!isMe ? `<button class="chat-msg-actions" onclick="bcOpenContext(event,this,false,'${m.id}')">⋯</button>` : ''}
      </div>
      <div class="chat-msg-meta">
        <span class="chat-msg-time">${time}</span>
        ${m.edited ? `<span class="chat-msg-edited" onclick="bcShowHistory('${m.id}')">(redigeret)</span>` : ''}
      </div>`;
  }
  return g;
}

function bcScrollToBottom() {
  const el = document.getElementById('bc-messages');
  if (el) el.scrollTop = el.scrollHeight;
}

function bcSubscribe() {
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

async function bcSendMessage() {
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
        // Injicer profil-data lokalt — undgår afhængighed af FK-join
        newMsg.profiles = {
          id: currentUser.id,
          name: currentProfile?.name || currentUser.email?.split('@')[0] || '?'
        };
        document.getElementById('bc-messages').appendChild(bcRenderMsg(newMsg));
        bcScrollToBottom();
      }
    }
  } catch(e) { console.error("bcSendMessage:", e); showToast(e.message || "Ukendt fejl"); }
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
  const menu = document.getElementById('bc-context-menu');
  menu.style.display = 'block';
  menu.classList.add('open');
  const r = btn.getBoundingClientRect();
  let top = r.bottom + 4;
  let left = isMe ? r.right - 175 : r.left - 5;
  left = Math.max(8, Math.min(left, window.innerWidth - 185));
  menu.style.top = top + 'px';
  menu.style.left = left + 'px';
  setTimeout(() => document.addEventListener('click', bcCloseContext, {once:true}), 10);
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
  document.getElementById('bc-send-btn').textContent = '✓';
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
  m.innerHTML = `<div class="modal-content"><div class="modal-header"><div class="modal-title">📝 Redigeringshistorik</div><button class="modal-close" onclick="closeModal('modal-edit-history')">✕</button></div><div id="edit-history-content" style="padding:0 1.25rem 1rem;overflow-y:auto;max-height:60vh"></div></div>`;
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
      list.innerHTML = '<div class="empty-state"><div class="empty-icon">👥</div><div class="empty-text">Ingen medlemmer</div></div>';
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
        <button class="chat-info-btn primary" data-action="openQRModal" data-id="${b.id}">🔗 Del boble / QR-kode</button>
        <button class="chat-info-btn danger" data-action="leaveBubble" data-id="${b.id}">↩ Forlad boblen</button>
      </div>`;
  } catch(e) { console.error("bcLoadInfo:", e); showToast(e.message || "Ukendt fejl"); }
}

// Person sheet from chat avatar
function bcOpenPerson(userId, name, title, color) {
  const initials = (name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  document.getElementById('ps-avatar').style.background = color;
  document.getElementById('ps-avatar').textContent = initials;
  document.getElementById('ps-name').textContent = name || 'Ukendt';
  document.getElementById('ps-sub').textContent = title || '';
  document.getElementById('ps-bio').textContent = '';
  document.getElementById('ps-bubbleup-btn').style.display = 'flex';
  document.getElementById('ps-bubbleup-confirm').classList.remove('show');
  // Store userId
  document.getElementById('person-sheet-el').dataset.userId = userId;
  document.getElementById('person-sheet-el').dataset.userName = name;
  document.getElementById('ps-overlay').classList.add('open');
  setTimeout(() => document.getElementById('person-sheet-el').classList.add('open'), 10);
}

function psClose() {
  document.getElementById('person-sheet-el').classList.remove('open');
  document.getElementById('ps-bubbleup-btn').style.display = 'flex';
  document.getElementById('ps-bubbleup-confirm').classList.remove('show');
  setTimeout(() => document.getElementById('ps-overlay').classList.remove('open'), 320);
}

function psMessage() { const uid = document.getElementById('person-sheet-el').dataset.userId; psClose(); setTimeout(() => openChat(uid), 350); }
function psProfile() { const uid = document.getElementById('person-sheet-el').dataset.userId; psClose(); setTimeout(() => openPerson(uid, 'screen-bubble-chat'), 350); }
function psMeeting() { const uid = document.getElementById('person-sheet-el').dataset.userId; psClose(); setTimeout(() => { currentPerson = uid; proposeMeeting(); }, 350); }

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


function setTheme(theme) {
  document.getElementById('app-root').setAttribute('data-theme', theme);
  localStorage.setItem('bubble-theme', theme);
  document.querySelectorAll('.theme-option').forEach(b => {
    b.classList.toggle('active', b.dataset.theme === theme);
  });
  // Update dropdown button
  const opt = document.querySelector(`.theme-option[data-theme="${theme}"]`);
  if (opt) {
    document.getElementById('theme-swatch-preview').style.background = opt.dataset.preview;
    document.getElementById('theme-label-current').textContent = opt.dataset.label;
  }
}

function toggleThemeDropdown() {
  const dd = document.getElementById('theme-dropdown');
  const chevron = document.getElementById('theme-chevron');
  const open = dd.style.display === 'block';
  dd.style.display = open ? 'none' : 'block';
  chevron.style.transform = open ? 'rotate(0deg)' : 'rotate(180deg)';
}

function selectTheme(el) {
  setTheme(el.dataset.theme);
  document.getElementById('theme-dropdown').style.display = 'none';
  document.getElementById('theme-chevron').style.transform = 'rotate(0deg)';
}

updateClock();
setInterval(updateClock, 10000);

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
    case 'openChat': openChat(id); break;
    case 'joinBubble': joinBubble(id); break;
    case 'requestJoin': requestJoin(id); break;
    case 'openQRModal': openQRModal(id); break;
    case 'leaveBubble': leaveBubble(id); break;
    case 'openEditBubble': openEditBubble(id); break;
    case 'openBubbleChat': openBubbleChat(id, from); break;
  }
});

window.addEventListener('load', async () => {
  const savedTheme = localStorage.getItem('bubble-theme') || 'midnight';
  setTheme(savedTheme);
  await checkAuth();
  await checkQRJoin();
  await checkPendingJoin();
  if (currentUser) {
    updateUnreadBadge();
    subscribeToIncoming();
  }
});
