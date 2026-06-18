/*
 * Onboarding GATING smoke test (Node, no browser / no live DB).
 *
 * Complements onboarding-terms (save payload) and onboarding-routing (routing)
 * by exercising the real maybeShowOnboarding() decision logic in a vm sandbox:
 *   - WHEN onboarding shows vs skips (onboarding_skipped, complete profile,
 *     name === id / email edge case, OAuth auto-fill)
 *   - WHICH fields the minimal overlay renders (only the missing ones)
 *
 * Runs the actual b-onboarding.js code; captures the generated overlay HTML.
 * Run:  node tests/onboarding-gating.smoke.js
 */
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const onboardingSrc = fs.readFileSync(path.join(__dirname, '..', 'next', 'b-onboarding.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  \u2713 ' + name); }
  else { fail++; console.log('  \u2717 ' + name + (detail ? '  (' + detail + ')' : '')); }
}

// captured overlay (the appended minimal-onboarding element)
let overlay = null;
function mkEl() {
  return { id: '', className: '', innerHTML: '', value: '', style: {},
    appendChild() {}, addEventListener() {}, removeEventListener() {},
    querySelector() { return null; }, querySelectorAll() { return []; },
    classList: { add() {}, remove() {}, toggle() {} }, focus() {}, remove() {} };
}

const sandbox = {
  console, Date, Promise, JSON, Object, Array, String, Math,
  setTimeout() {}, clearTimeout() {}, requestAnimationFrame() {},
  registerState() {},
  document: {
    getElementById() { return null; },               // no existing overlay; focus targets null-safe
    createElement() { return mkEl(); },
    addEventListener() {}, querySelectorAll() { return []; },
    body: { appendChild(elm) { overlay = elm; } }     // capture the overlay
  },
  localStorage: { getItem() { return null; }, setItem() {} },
  navigator: { language: 'da' },
  // app globals (mutated per scenario)
  currentUser: { id: 'test-uid-123' },
  currentProfile: null,
  _miniObConsentGiven: true, _obConsentGiven: true, _reRunningOnboarding: false,
  // collaborators
  t(k) { return k; },
  escHtml(s) { return s == null ? '' : String(s); },
  flowGet() { return null; },
  goTo() {}, initServices() {}, trackEvent() {},
  showWarningToast() {}, showSuccessToast() {}, showErrorToast() {}, errorToast() {},
  logError() {},
  _miniObCheck() {}, _repairAvatarInBackground() {},
  _downloadAvatarToStorage: async () => null,
  loadCurrentProfile: async () => {}, resolvePostAuthDestination: async () => {},
  sb: {
    from() {
      return {
        upsert() { return Promise.resolve({ error: null }); },
        update() { return { eq() { return Promise.resolve({ error: null }); } }; },
        select() { return { eq() { return { maybeSingle() { return Promise.resolve({ data: null }); } }; } }; }
      };
    },
    storage: { from() { return { upload: async () => ({ error: null }), getPublicUrl: () => ({ data: { publicUrl: '' } }) }; } }
  }
};
vm.createContext(sandbox);
vm.runInContext(onboardingSrc, sandbox, { filename: 'b-onboarding.js' });

async function run(profile, user) {
  overlay = null;
  sandbox.currentProfile = profile;
  sandbox.currentUser = Object.assign({ id: 'test-uid-123' }, user || {});
  const shown = await sandbox.maybeShowOnboarding();
  return { shown: shown, html: overlay ? overlay.innerHTML : '' };
}
const hasNameField = h => h.indexOf('mini-ob-name') >= 0;
const hasWorkField = h => h.indexOf('mini-ob-workplace') >= 0;

(async () => {
  console.log('\nonboarding gating smoke\n');
  let r;

  // A: explicitly skipped -> never show
  r = await run({ id: 'test-uid-123', onboarding_skipped: true });
  ok('onboarding_skipped -> skips', r.shown === false && r.html === '');

  // B: complete profile -> skip
  r = await run({ id: 'test-uid-123', name: 'Alice', workplace: 'Danfoss' });
  ok('complete profile (name+workplace) -> skips', r.shown === false && r.html === '');

  // C: name === id does NOT count as a real name -> show, ask name
  r = await run({ id: 'test-uid-123', name: 'test-uid-123', workplace: 'Danfoss' });
  ok('name === id -> shows and asks name', r.shown === true && hasNameField(r.html));
  ok('name === id -> workplace already present, not asked', !hasWorkField(r.html));

  // D: name === email does NOT count -> show, ask name
  r = await run({ id: 'test-uid-123', name: 'a@b.dk', workplace: 'Danfoss' }, { email: 'a@b.dk' });
  ok('name === email -> shows and asks name', r.shown === true && hasNameField(r.html));

  // E: empty profile, email signup -> show BOTH fields
  r = await run({ id: 'test-uid-123' }, { email: 'new@x.dk' });
  ok('empty profile -> shows', r.shown === true);
  ok('empty profile -> asks name AND workplace', hasNameField(r.html) && hasWorkField(r.html));

  // F: has name, missing workplace -> show ONLY workplace
  r = await run({ id: 'test-uid-123', name: 'Bob' });
  ok('name only -> shows workplace field', r.shown === true && hasWorkField(r.html));
  ok('name only -> does NOT re-ask name', !hasNameField(r.html));

  // G: has workplace, missing name -> show ONLY name
  r = await run({ id: 'test-uid-123', workplace: 'Grundfos' });
  ok('workplace only -> shows name field', r.shown === true && hasNameField(r.html));
  ok('workplace only -> does NOT re-ask workplace', !hasWorkField(r.html));

  // H: OAuth metadata fills both -> skip (no overlay)
  r = await run({ id: 'test-uid-123' }, { user_metadata: { full_name: 'Carol', company: 'Novo' } });
  ok('OAuth full_name + company -> auto-fills, skips', r.shown === false && r.html === '');

  // I: OAuth provides only name -> still ask workplace
  r = await run({ id: 'test-uid-123' }, { user_metadata: { full_name: 'Dave' } });
  ok('OAuth name only -> asks workplace, not name', r.shown === true && hasWorkField(r.html) && !hasNameField(r.html));

  console.log('\n' + '\u2500'.repeat(50));
  console.log('  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail === 0 ? 0 : 1);
})();
