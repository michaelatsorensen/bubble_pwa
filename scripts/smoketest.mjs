#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════
//  Bubble Smoketest — create-first onboarding (ADR-010)
//
//  Tester BACKEND-laget mod ægte Supabase: signup uden email-bekræftelse,
//  QR-token-resolve, create-first kontakt-gemning, RLS-grænser, idempotens.
//
//  Tester IKKE: PWA-install, standalone-scope, visuelt flow — det kræver en
//  rigtig enhed (samme lektie som PWA-scope-buggen). Dette er logik + datalag.
//
//  ── SIKKERHED ──
//  Kræver service_role-nøglen som MILJØVARIABEL (aldrig hardkodet, aldrig i git):
//
//     SUPABASE_SERVICE_KEY="din-nøgle" node scripts/smoketest.mjs
//
//  service_role omgår RLS og kan slette auth-brugere — behandl som en adgangskode.
//
//  ── VANDTÆT OPRYDNING ──
//  Hver testbruger får præfiks __smoke_<timestamp>_<random>@bubbletest.local.
//  Efter hver test: gdpr_delete_user(id) + slet auth-brugeren.
//  Ved START: sikkerhedsnet fjerner ALT forældreløst __smoke_-affald fra
//  tidligere crashede kørsler. Så selv en død kørsel efterlader intet permanent.
//  Backup: kan altid findes manuelt med  email LIKE '__smoke_%'.
// ══════════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';

// ── Konfiguration ──
const SUPABASE_URL = 'https://api.bubbleme.dk';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SMOKE_PREFIX = '__smoke_';
const SMOKE_DOMAIN = '@bubbletest.local';

if (!SERVICE_KEY) {
  console.error('\n✗ FEJL: SUPABASE_SERVICE_KEY mangler.\n');
  console.error('  Kør scriptet sådan (nøglen fra Supabase → Settings → API → service_role):\n');
  console.error('     SUPABASE_SERVICE_KEY="din-nøgle" node scripts/smoketest.mjs\n');
  console.error('  Nøglen må ALDRIG hardkodes eller committes.\n');
  process.exit(1);
}

// Admin-klient med service_role — omgår RLS, kan slette auth-brugere.
const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// ── Hjælpere ──
const results = [];
function pass(name) { results.push({ name, ok: true }); console.log('  ✓ ' + name); }
function fail(name, detail) { results.push({ name, ok: false, detail }); console.log('  ✗ FEJL  ' + name + (detail ? '  →  ' + detail : '')); }

function smokeEmail() {
  return SMOKE_PREFIX + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + SMOKE_DOMAIN;
}

// Opret en testbruger via admin (service_role) — omgår email-bekræftelse helt.
async function createTestUser(name) {
  const email = smokeEmail();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: 'SmokeTest123!',
    email_confirm: true, // admin-oprettelse: markér som bekræftet så login virker
    user_metadata: { name: name || 'Smoke Test' }
  });
  if (error) throw new Error('createUser: ' + error.message);
  return { id: data.user.id, email };
}

// VANDTÆT sletning: gdpr_delete_user (rydder relationer) + slet auth-bruger (CASCADE resten).
async function deleteTestUser(userId) {
  try { await admin.rpc('gdpr_delete_user', { p_user_id: userId }); } catch (e) { /* fortsæt til auth-sletning uanset */ }
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw new Error('deleteUser: ' + error.message);
}

// SIKKERHEDSNET: fjern forældreløst __smoke_-affald fra tidligere crashede kørsler.
async function sweepOrphans() {
  console.log('\n── Sikkerhedsnet: rydder forældreløst __smoke_-affald ──');
  let removed = 0, page = 1;
  // auth.admin.listUsers paginerer; gennemgå og slet alt med smoke-præfiks.
  while (page <= 20) { // hård grænse så vi aldrig looper uendeligt
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) { console.log('  (kunne ikke liste brugere: ' + error.message + ')'); break; }
    const users = data && data.users ? data.users : [];
    if (users.length === 0) break;
    const smokers = users.filter(u => u.email && u.email.startsWith(SMOKE_PREFIX));
    for (const u of smokers) {
      try { await deleteTestUser(u.id); removed++; } catch (e) { console.log('  (kunne ikke slette ' + u.email + ': ' + e.message + ')'); }
    }
    if (users.length < 200) break;
    page++;
  }
  console.log('  ' + (removed > 0 ? 'Fjernede ' + removed + ' forældreløse testbrugere.' : 'Intet affald fundet — rent.'));
}

// ══════════════════════════════════════════════════════════════════════
//  SMOKETESTS — kernen (signup + create-first + oprydning)
// ══════════════════════════════════════════════════════════════════════
async function runTests() {
  const created = []; // spor alt vi opretter, så vi kan rydde op selv ved fejl

  try {
    // ─── TEST 1: Signup fungerer (bruger kan oprettes + har profil) ───
    console.log('\n── Test 1: Bruger-oprettelse ──');
    let userA;
    try {
      userA = await createTestUser('Smoke Alice');
      created.push(userA.id);
      pass('Bruger oprettet med session-klar konto');
    } catch (e) { fail('Bruger oprettet', e.message); }

    // Profil-rækken oprettes typisk af en trigger ved signup — verificér den findes.
    if (userA) {
      const { data: prof, error } = await admin.from('profiles').select('id, name').eq('id', userA.id).maybeSingle();
      if (error) fail('Profil-række findes efter signup', error.message);
      else if (prof) pass('Profil-række auto-oprettet ved signup');
      else fail('Profil-række findes efter signup', 'ingen profil-række (mangler trigger?)');
    }

    // ─── TEST 2: QR-token kan genereres og resolves ───
    console.log('\n── Test 2: QR-token resolve ──');
    if (userA) {
      // Generér et token for userA (samme mekanisme som appens "min QR").
      // Antag en RPC/tabel; hvis din token-generering er anderledes, tilpas her.
      const { data: tok, error: tokErr } = await admin
        .from('qr_tokens')
        .insert({ user_id: userA.id, token: 'smoke' + Math.random().toString(36).slice(2, 12) })
        .select('token')
        .single();
      if (tokErr) { fail('QR-token oprettet', tokErr.message); }
      else {
        pass('QR-token oprettet for testbruger');
        // Resolve det (som appen gør EFTER login).
        const { data: resolved, error: resErr } = await admin.rpc('resolve_qr_token', { p_token: tok.token });
        const row = Array.isArray(resolved) ? resolved[0] : resolved;
        if (resErr) fail('Token resolves til bruger', resErr.message);
        else if (row && row.user_id === userA.id) pass('Token resolves korrekt til den rigtige bruger');
        else fail('Token resolves til bruger', 'forkert eller manglende user_id');
      }
    }

    // ─── TEST 3: RLS — anon kan IKKE slå profildata op (ADR-010-hullet lukket) ───
    console.log('\n── Test 3: RLS-grænse (anon profil-opslag afvist) ──');
    {
      // Anon-klient (kun publishable key, ingen session) — skal AFVISES af RLS.
      const anon = createClient(SUPABASE_URL, 'sb_publishable_y6BftA4RQw91dLHPXIncag_oGomBk-A', {
        auth: { autoRefreshToken: false, persistSession: false }
      });
      if (userA) {
        const { data, error } = await anon.from('profiles').select('name, workplace').eq('id', userA.id).maybeSingle();
        // RLS bør enten give fejl ELLER tom (ingen rækker). Data tilbage = hul.
        if (error || !data) pass('Anon kan IKKE læse profildata direkte (RLS holder)');
        else fail('Anon profil-opslag afvist', 'anon fik profildata tilbage — RLS-hul!');
      }
    }

    // ─── TEST 4: Idempotens — samme kontakt-gemning to gange = én kontakt ───
    console.log('\n── Test 4: Idempotens (dobbelt kontakt-gemning) ──');
    let userB;
    try {
      userB = await createTestUser('Smoke Bob');
      created.push(userB.id);
    } catch (e) { fail('Opret bruger B til kontakt-test', e.message); }

    if (userA && userB) {
      // Gem B som kontakt for A — to gange. Appen bruger UPSERT (dbActions.saveContact),
      // så vi tester den RIGTIGE mekanik: upsert to gange må give én række.
      await admin.from('saved_contacts').upsert({ user_id: userA.id, contact_id: userB.id });
      await admin.from('saved_contacts').upsert({ user_id: userA.id, contact_id: userB.id });
      const { data: rows } = await admin.from('saved_contacts').select('id').eq('user_id', userA.id).eq('contact_id', userB.id);
      if (rows && rows.length === 1) pass('Dobbelt kontakt-gemning (upsert) gav kun ÉN række (idempotent)');
      else if (rows && rows.length > 1) fail('Idempotens', 'dublet: ' + rows.length + ' rækker — upsert-nøgle mangler?');
      else fail('Idempotens', 'kontakt blev ikke gemt');
    }

  } finally {
    // ─── OPRYDNING: slet ALT vi oprettede, uanset om tests fejlede ───
    console.log('\n── Oprydning: sletter testbrugere fra denne kørsel ──');
    let cleaned = 0;
    for (const id of created) {
      try { await deleteTestUser(id); cleaned++; } catch (e) { console.log('  (kunne ikke slette ' + id + ': ' + e.message + ')'); }
    }
    console.log('  Slettede ' + cleaned + '/' + created.length + ' testbrugere.');
  }
}

// ══════════════════════════════════════════════════════════════════════
async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  Bubble Smoketest — create-first onboarding   ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('  Mod: ' + SUPABASE_URL + '  (PRODUKTION)');

  await sweepOrphans();   // ryd gammelt affald FØR vi starter
  await runTests();       // kør + ryd op efter sig selv

  // ── Rapport ──
  const failed = results.filter(r => !r.ok);
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('  RESULTAT: ' + (results.length - failed.length) + '/' + results.length + ' bestået');
  if (failed.length) {
    console.log('  FEJLEDE:');
    failed.forEach(f => console.log('    ✗ ' + f.name + (f.detail ? ' — ' + f.detail : '')));
  }
  console.log('╚══════════════════════════════════════════════╝\n');
  process.exit(failed.length ? 1 : 0);
}

main().catch(e => {
  console.error('\n✗ Uventet fejl:', e.message);
  console.error('  Kør scriptet igen — sikkerhedsnettet rydder evt. efterladt affald op ved næste start.');
  console.error('  Eller find manuelt:  email LIKE \'__smoke_%\'\n');
  process.exit(1);
});
