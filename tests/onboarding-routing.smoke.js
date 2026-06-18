/*
 * Onboarding entry-routing smoke test (Node, no browser / no live DB).
 *
 * Covers the v9.13 + v9.14 entry-flow changes:
 *   PART 1  RUNS the real _routeBubblePreScreen (extracted from b-boot.js) in a
 *           vm context with mocks, asserting type-based routing end-to-end
 *           (event/live -> event-landing + event_flow ; network -> teaser, no
 *           event_flow). Mutation-verified: capture flowSet/goTo/social/teaser.
 *   PART 2  STATIC regression guards on the integration points (?join type fetch
 *           + router call, checkGuestEventRoute router call, resolver scan-mode
 *           -> showEventReadyQR wiring).
 *   PART 3  HTML guards on index.html: guest-checkin is email-first (no OAuth
 *           buttons, email is btn-primary) ; login view keeps OAuth.
 *
 * Exit code 0 = all pass, 1 = any fail.
 * Run:  node tests/onboarding-routing.smoke.js
 */
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const NEXT = path.join(__dirname, '..', 'next');
const bootSrc = fs.readFileSync(path.join(NEXT, 'b-boot.js'), 'utf8');
const authSrc = fs.readFileSync(path.join(NEXT, 'b-auth.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(NEXT, 'index.html'), 'utf8');

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; console.log('  \u2713 ' + msg); }
  else { fail++; console.log('  \u2717 ' + msg); }
}
function section(t) { console.log('\n' + t); }

// ════════════════════════════════════════════════════════════
// PART 1 — RUN _routeBubblePreScreen with mocks (type-based routing)
// ════════════════════════════════════════════════════════════
section('PART 1 \u2014 _routeBubblePreScreen k\u00f8res med mocks (type-baseret routing)');

// Cleanly delimited: closing } is at column 0, internal braces are indented,
// so non-greedy up to the first \n} captures exactly the whole function.
const fnMatch = bootSrc.match(/function _routeBubblePreScreen\(bubble\) \{[\s\S]*?\n\}/);
ok(!!fnMatch, '_routeBubblePreScreen kan ekstraheres rent');
const fnSrc = fnMatch ? fnMatch[0] : 'function _routeBubblePreScreen(){}';

let cap;
function resetCap() { cap = { flow: {}, goTo: [], social: [], teaser: [], dom: {} }; }
function makeEl() { return { textContent: '', value: '', style: {}, classList: { add() {}, remove() {}, toggle() {} } }; }
resetCap();

const sandbox = {
  console,
  flowSet: function (k, v) { cap.flow[k] = v; },
  goTo: function (s) { cap.goTo.push(s); },
  loadEventSocialProof: function (id) { cap.social.push(id); },
  loadTeaserProfiles: function (id) { cap.teaser.push(id); },
  document: { getElementById: function (id) { if (!cap.dom[id]) cap.dom[id] = makeEl(); return cap.dom[id]; } },
  _eventBubble: null
};
vm.createContext(sandbox);
vm.runInContext(fnSrc, sandbox);

function runRoute(bubble) {
  resetCap();
  sandbox._eventBubble = null;
  vm.runInContext('_routeBubblePreScreen(' + JSON.stringify(bubble) + ')', sandbox);
  return { cap: cap, eventBubble: sandbox._eventBubble };
}

// ── event ──
let r = runRoute({ id: 'b-ev', name: 'Tech Meetup', type: 'event', location: 'S\u00f8nderborg' });
ok(r.cap.flow.pending_join === 'b-ev', 'event: pending_join sat til bubble.id');
ok(r.cap.flow.event_flow === 'true', 'event: event_flow sat til "true"');
ok(r.cap.goTo.length === 1 && r.cap.goTo[0] === 'screen-guest-checkin', 'event: goTo(screen-guest-checkin)');
ok(r.cap.social.length === 1 && r.cap.social[0] === 'b-ev', 'event: loadEventSocialProof(bubble.id) kaldt');
ok(r.cap.teaser.length === 0, 'event: loadTeaserProfiles IKKE kaldt');
ok(r.eventBubble && r.eventBubble.id === 'b-ev', 'event: _eventBubble sat');
ok(r.cap.dom['guest-event-name'] && r.cap.dom['guest-event-name'].textContent === 'Tech Meetup', 'event: guest-event-name udfyldt med bubble.name');

// ── live (behandles som event) ──
r = runRoute({ id: 'b-lv', name: 'Live Room', type: 'live' });
ok(r.cap.flow.event_flow === 'true', 'live: event_flow sat (som event)');
ok(r.cap.goTo[0] === 'screen-guest-checkin', 'live: goTo(screen-guest-checkin)');

// ── network (teaser, INGEN event_flow) ──
r = runRoute({ id: 'b-nw', name: 'Founders', type: 'network' });
ok(r.cap.flow.pending_join === 'b-nw', 'network: pending_join sat');
ok(r.cap.flow.event_flow === undefined, 'network: event_flow IKKE sat');
ok(r.cap.goTo.length === 1 && r.cap.goTo[0] === 'screen-qr-teaser', 'network: goTo(screen-qr-teaser)');
ok(r.cap.teaser.length === 1 && r.cap.teaser[0] === 'b-nw', 'network: loadTeaserProfiles(bubble.id) kaldt');
ok(r.cap.social.length === 0, 'network: loadEventSocialProof IKKE kaldt');
ok(r.eventBubble === null, 'network: _eventBubble IKKE sat');

// ── unknown type falder til teaser (fail-safe) ──
r = runRoute({ id: 'b-zz', name: 'Mystery', type: undefined });
ok(r.cap.goTo[0] === 'screen-qr-teaser' && r.cap.flow.event_flow === undefined, 'ukendt type: fail-safe til teaser uden event_flow');

// ════════════════════════════════════════════════════════════
// PART 2 — STATIC integration guards
// ════════════════════════════════════════════════════════════
section('PART 2 \u2014 integrationspunkter statisk (regressions-vagter)');

ok((bootSrc.match(/function _routeBubblePreScreen/g) || []).length === 1, 'pr\u00e6cis \u00e9n definition af _routeBubblePreScreen');
ok(/select\(['"]id, name, type, location['"]\)/.test(bootSrc), '?join: bobble-fetch henter type (id, name, type, location)');
ok(/_routeBubblePreScreen\(_jb\)/.test(bootSrc), '?join: kalder _routeBubblePreScreen(_jb)');
ok(/_routeBubblePreScreen\(bubble\);/.test(bootSrc), 'checkGuestEventRoute: kalder _routeBubblePreScreen(bubble);');

ok(/select\(['"]id, name, type, checkin_mode['"]\)/.test(authSrc), 'resolver: henter checkin_mode');
ok(/checkin_mode === ['"]scan['"]/.test(authSrc), 'resolver: tjekker checkin_mode === scan');
ok(/showEventReadyQR\(\)/.test(authSrc), 'resolver: kalder showEventReadyQR() ved scan-mode');
ok(/showDeepLinkModal\(['"]event['"]/.test(authSrc), 'resolver: falder tilbage til showDeepLinkModal(event)');

// ════════════════════════════════════════════════════════════
// PART 3 — index.html email-first (v9.13)
// ════════════════════════════════════════════════════════════
section('PART 3 \u2014 email-first event-landing + OAuth-placering (v9.13)');

const gcStart = indexHtml.indexOf('id="screen-guest-checkin"');
let gcSection = '';
if (gcStart >= 0) {
  const rest = indexHtml.slice(gcStart);
  const nxt = rest.indexOf('class="screen"', 30);
  gcSection = nxt > 0 ? rest.slice(0, nxt) : rest.slice(0, 4000);
}
ok(gcStart >= 0, 'screen-guest-checkin findes');
ok(gcSection.indexOf('eventSignupGoogle') === -1, 'guest-checkin: INGEN Google-OAuth-knap');
ok(gcSection.indexOf('eventSignupLinkedIn') === -1, 'guest-checkin: INGEN LinkedIn-OAuth-knap');
ok(/<button class="btn-primary" onclick="eventSignupEmail\(\)"/.test(gcSection), 'guest-checkin: "Opret med email" er btn-primary');
ok(/Opret med email/.test(gcSection), 'guest-checkin: email-CTA til stede');

ok(/handleGoogleLogin\(\)/.test(indexHtml), 'login-view: Google-OAuth bevaret (eksisterende brugere)');
ok(/handleLinkedInLogin\(\)/.test(indexHtml), 'login-view: LinkedIn-OAuth bevaret (eksisterende brugere)');

// ════════════════════════════════════════════════════════════
console.log('\n' + '\u2500'.repeat(50));
console.log('  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
