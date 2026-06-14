/*
 * Onboarding terms_accepted_at smoke test (Node, no browser / no live DB).
 *
 * Loads the REAL _miniObSave + saveOnboarding from next/b-onboarding.js into a
 * vm sandbox with a mock Supabase, captures the upsert payload, and asserts the
 * "set terms_accepted_at only if missing" invariant (v9.11) plus the minimal /
 * conservative payload guarantees. Exit code 0 = all pass, 1 = any fail.
 *
 * Run:  node tests/onboarding-terms.smoke.js
 */
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const NEXT = path.join(__dirname, '..', 'next');
const onboardingSrc = fs.readFileSync(path.join(NEXT, 'b-onboarding.js'), 'utf8');
const authSrc = fs.readFileSync(path.join(NEXT, 'b-auth.js'), 'utf8');

// ── capture state shared with the mock Supabase ──
let captured = null;     // { table, payload } of the last upsert
let upsertCalls = 0;
let DOM = {};            // per-test element map for document.getElementById

function el(value) {
  return { value: value, textContent: '', disabled: false,
           classList: { toggle() {}, remove() {}, add() {} } };
}

const sandbox = {
  console, Date, Promise, JSON, Object, Array, String,
  // top-level hooks in b-onboarding.js
  registerState() {},
  document: {
    getElementById(id) { return Object.prototype.hasOwnProperty.call(DOM, id) ? DOM[id] : null; },
    addEventListener() {},
    querySelectorAll() { return []; },
    body: { appendChild() {} }
  },
  localStorage: { getItem() { return null; }, setItem() {} },
  navigator: { language: 'da' },
  // app globals (mutated per test)
  currentUser: { id: 'test-uid-123' },
  currentProfile: null,
  _miniObConsentGiven: true,
  _obConsentGiven: true,
  _reRunningOnboarding: false,
  // stubbed collaborators
  t(k) { return k; },
  flowGet() { return null; },
  showWarningToast() {}, showSuccessToast() {}, showErrorToast() {}, errorToast() {},
  goTo() {}, initServices() {}, trackEvent() {},
  loadCurrentProfile: async () => {},
  resolvePostAuthDestination: async () => {},
  logError() {},
  sb: {
    from(table) {
      return {
        upsert(payload) { upsertCalls++; captured = { table, payload }; return Promise.resolve({ error: null }); },
        update() { return { eq() { return Promise.resolve({ error: null }); } }; },
        select() { return { eq() { return { maybeSingle() { return Promise.resolve({ data: null }); } }; } }; }
      };
    }
  }
};

vm.createContext(sandbox);
vm.runInContext(onboardingSrc, sandbox, { filename: 'b-onboarding.js' });

// ── tiny assert harness ──
let passed = 0, failed = 0;
function ok(name, cond, detail) {
  if (cond) { passed++; console.log('  \u2713 ' + name); }
  else { failed++; console.log('  \u2717 ' + name + (detail ? '  \u2192 ' + detail : '')); }
}
function reset(domMap, profile, consent) {
  captured = null; upsertCalls = 0; DOM = domMap;
  sandbox.currentProfile = profile;
  sandbox._miniObConsentGiven = consent !== false;
  sandbox._obConsentGiven = consent !== false;
}
const ISO = '2024-06-01T10:00:00.000Z';

(async () => {
  console.log('\nonboarding terms_accepted_at smoke (v9.11)\n');

  // ── _miniObSave: minimal onboarding path ──
  console.log('_miniObSave (minimal onboarding):');

  // A: OAuth / new user, no prior terms -> terms gets set
  reset({ 'mini-ob-name': el('Alice'), 'mini-ob-workplace': el('Danfoss'), 'mini-ob-save': el('') }, {});
  await sandbox._miniObSave();
  ok('no prior terms -> terms_accepted_at is set',
     captured && typeof captured.payload.terms_accepted_at === 'string',
     captured ? JSON.stringify(captured.payload) : 'no upsert');
  ok('id anchored to currentUser.id', captured && captured.payload.id === 'test-uid-123');
  ok('name + workplace written', captured && captured.payload.name === 'Alice' && captured.payload.workplace === 'Danfoss');

  // B: existing terms present -> preserved (NOT overwritten)
  reset({ 'mini-ob-name': el('Alice'), 'mini-ob-workplace': el('Danfoss'), 'mini-ob-save': el('') }, { terms_accepted_at: ISO });
  await sandbox._miniObSave();
  ok('existing terms -> payload omits terms_accepted_at',
     captured && !('terms_accepted_at' in captured.payload),
     captured ? JSON.stringify(captured.payload) : 'no upsert');

  // C: empty name -> guard, no upsert
  reset({ 'mini-ob-name': el(''), 'mini-ob-workplace': el('Danfoss'), 'mini-ob-save': el('') }, {});
  await sandbox._miniObSave();
  ok('empty name -> no upsert (guard)', upsertCalls === 0, 'upsertCalls=' + upsertCalls);

  // D: consent not given -> guard, no upsert
  reset({ 'mini-ob-name': el('Alice'), 'mini-ob-workplace': el('Danfoss'), 'mini-ob-save': el('') }, {}, false);
  await sandbox._miniObSave();
  ok('no consent -> no upsert (guard)', upsertCalls === 0, 'upsertCalls=' + upsertCalls);

  // E: minimal payload — only known-safe keys, no sensitive fields
  reset({ 'mini-ob-name': el('Alice'), 'mini-ob-workplace': el('Danfoss'), 'mini-ob-save': el('') }, {});
  await sandbox._miniObSave();
  const allowed = ['id', 'terms_accepted_at', 'name', 'workplace'];
  const keysE = captured ? Object.keys(captured.payload) : [];
  ok('payload keys are a safe subset', keysE.every(k => allowed.includes(k)), keysE.join(','));
  ok('no role/banned/admin/is_anon in payload',
     captured && !('role' in captured.payload) && !('banned' in captured.payload) &&
     !('is_admin' in captured.payload) && !('is_anon' in captured.payload));

  // F: name field not rendered (existing name) -> name NOT in payload (existing value untouched)
  reset({ 'mini-ob-workplace': el('Danfoss'), 'mini-ob-save': el('') }, { name: 'Existing Name', terms_accepted_at: ISO });
  await sandbox._miniObSave();
  ok('absent name field -> payload omits name (existing preserved)',
     captured && !('name' in captured.payload), captured ? JSON.stringify(captured.payload) : 'no upsert');

  // ── saveOnboarding: full / re-run path ──
  console.log('\nsaveOnboarding (full / re-run path):');

  // G: re-run with existing terms -> preserved
  reset({ 'ob-name': el('Bob'), 'ob-workplace': el('SDU'), 'ob-save-btn': el('') }, { terms_accepted_at: ISO });
  await sandbox.saveOnboarding();
  ok('re-run with terms -> payload omits terms_accepted_at',
     captured && !('terms_accepted_at' in captured.payload),
     captured ? JSON.stringify(captured.payload) : 'no upsert');
  ok('still writes id/name/workplace/is_anon',
     captured && captured.payload.id === 'test-uid-123' && captured.payload.name === 'Bob' &&
     captured.payload.workplace === 'SDU' && captured.payload.is_anon === false);

  // H: no prior terms -> set once
  reset({ 'ob-name': el('Bob'), 'ob-workplace': el('SDU'), 'ob-save-btn': el('') }, {});
  await sandbox.saveOnboarding();
  ok('no prior terms -> terms_accepted_at is set',
     captured && typeof captured.payload.terms_accepted_at === 'string',
     captured ? JSON.stringify(captured.payload) : 'no upsert');

  // ── signup path intentionally unconditional (static guard) ──
  console.log('\nsignup path (static intent guard):');
  ok('handleSignup still sets terms_accepted_at unconditionally',
     /terms_accepted_at:\s*new Date\(\)\.toISOString\(\)/.test(authSrc));
  ok('onboarding never sets terms unconditionally',
     !/terms_accepted_at:\s*new Date\(\)\.toISOString\(\)/.test(onboardingSrc));

  console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
  process.exit(failed === 0 ? 0 : 1);
})().catch(e => { console.error('HARNESS ERROR:', e); process.exit(1); });
