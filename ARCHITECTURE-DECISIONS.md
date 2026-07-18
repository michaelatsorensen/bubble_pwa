# Bubble — Architecture Decisions (ADR)

> **Formål:** Registry over accepterede arkitekturbeslutninger.
>
> **Hvornår tilføjes en ADR?** Når en beslutning er truffet (ikke længere spørgsmål) og har påvirkning på flere komponenter eller fremtidig arkitektur.
>
> **Format:** Hver ADR har: id, status, context, decision, consequences.
>
> **Status:** Oprettet maj 2026. Migration fra OPEN-QUESTIONS.md sker gradvist.

---

## Architectural Tenets

> Grundsætninger der gælder for ALLE ADRs i dette dokument.
> Ikke specifikke beslutninger — præmisser som alle beslutninger skal hænge sammen med.
>
> **Hvornår bruges tenets?** Når en ADR foreslås, skal den kunne forklares mod mindst én tenet. Hvis ingen tenet bakker den op, kan tenet'en mangle — eller beslutningen være forkert.

### Tenet 1: Native = backend normalization pressure

Native rewrite må **ikke** forstås som frontend-udskiftning. Før native bygges, skal platform-contracts, event ownership, state authority og observability stabiliseres.

Frontend kan skiftes. Platform-contracts skal stabiliseres **først**.

**Implication:** Tech debt der skaber **contract ambiguity** er P0/P1. Tech debt der er rent kosmetisk er P3. Det er ikke "hvor grimt er det" der prioriterer — det er "skaber det uklar authority?".

### Tenet 2: Discover before redesign

Vi porter ikke blindt, men vi designer heller ikke greenfield.

Før vi ændrer et mønster, skal vi forstå:
- Hvorfor findes det?
- Hvad løser det operationelt?
- Skaber det faktisk risiko, eller bare visuel ubehag?

**Implication:** Redesign-forslag (Type D i OPEN-QUESTIONS) skal kunne dokumentere **konkret eksisterende problem**, ikke bare "dette ville være pænere". Q-022 (Conversation entity) er eksempel på et redesign der manglede problem-evidens.

### Tenet 3: Preserve battle-tested behavior, replace ambiguous ownership

Ikke alle hacks er dårlige. Operationelt robuste mønstre — selv de "urene" — har bevist værdi.

Det vi **skal** redesigne er primært mønstre med:
- Uklar authority (hvem ejer state?)
- Duplicate writes (samme data, multiple paths)
- Silent failure (fejler uden synlig signal)
- Security risk
- Race conditions (timing-afhængig korrekthed)

Alt andet kan ofte porteres som-er og revurderes efter native.

**Implication:** Refactor-iver skal kanaliseres mod ovenstående 5 kategorier. Naming-cleanup og kosmetik kan vente til efter pilot/native.

### Tenet 4: Grundighed over hastighed

Hellere bruge mere tid og gøre arbejdet grundigt og robust end at lave quick fixes.

Pre-pilot quick fixes er det modsatte af det vi prøver at opnå. Hver "lille fix" der ikke adresserer root cause skaber teknisk gæld der eskalerer i native-migrationen.

**Implication:**

- Når en audit afslører at problemet er større end forventet, **udvider vi scope**, vi reducerer ikke kvalitet
- En refactor er først færdig når: contract er stabil, alle callers er konsistente, dokumentation er opdateret, og test cases er identificeret
- "Det kan vente til efter pilot" gælder **kun** for ting der ikke skaber contract ambiguity eller silent failure
- Hellere fixe 1 ting grundigt end 5 ting halvt

**Bemærk forskellen til Tenet 3:** Tenet 3 siger "redesign kun ambiguous ownership". Tenet 4 siger "når du redesigner, gør det helt". De er komplementære, ikke modstridende.

**Anti-pattern denne tenet beskytter mod:**
- "Quick fix" der efterlader bugs i edge cases
- Refactor af én funktion uden at opdatere callers
- Update af kode uden at opdatere dokumentation
- "Vi tester det senere" når det aldrig sker

### Tenet 5: Distill, don't port

Native er **ikke** en rewrite af PWA. Det er en disciplineret destillering af 3-5 kerneflows, hvor:

- **Backend-kontrakter beholdes** (RLS, dbActions, data model, event model, realtime model)
- **Frontend-orchestration genopfindes** med native lifecycle som første princip
- **PWA bevares som testbed og fallback**, ikke erstattes
- **Sekundære flows kan blive i web/PWA** — de fortjener ikke native-kompleksitet

Det vi **slæber med**: hårdt-erhvervede backend-mønstre, data model, RLS, push erfaring, ADR-005 contract-pattern, flow-erfaring, dbActions-disciplinen.

Det vi **lader være**: DOM-state, sessionStorage flow flags evolved-over-time, PWA navigation restore hacks, inline onclick handlers, parallelle join flows, screen-state-machine via classList.

**Implication:**

- Native v1 skal være **fokuseret**, ikke komplet — 3-5 kerneflows max
- Lifecycle-disciplin (AppState, cold start, push routing, reconnect) er **første** ting at lære, ikke screens
- Bubble-native-lab kører **parallelt** med PWA (ikke som erstatning) under udvikling
- Mange founders opdager først efter pilot, hvad der faktisk betyder noget — vi tager den læring **ind i** native, ikke gætter den på forhånd

**Anti-pattern denne tenet beskytter mod:**

- "Feature parity"-marathon der drukner i sekundære flows
- Enterprise rewrite-fælden (12 måneders monolit-rewrite)
- At portere gammel kompleksitet 1:1 fordi "det virker jo i PWA"
- At binde sig til native før PWA-pilot har afsløret hvad der reelt betyder noget

**Bemærk samspil med Tenet 1:** Tenet 1 siger "stabiliser backend-kontrakter før native". Tenet 5 siger "destillér frontend, port kun det stabiliserede". De er to halvdele af samme strategi: hard backend, focused frontend.

---

## Konventioner

### Status-værdier

- **PROPOSED** — under overvejelse, ikke endelig
- **ACCEPTED** — besluttet, gælder fremadrettet
- **DEFERRED** — udskudt til senere fase (typisk native rewrite)
- **DEPRECATED** — tidligere accepted men erstattet af nyere ADR
- **REJECTED** — eksplicit afvist (med begrundelse)

### Skabelon

```markdown
## ADR-XXX: [Kort titel]

**Status:** PROPOSED | ACCEPTED | DEFERRED | DEPRECATED | REJECTED
**Date:** YYYY-MM-DD
**Supersedes:** ADR-YYY (hvis relevant)

### Context
Hvilken situation/problem fører til beslutningen?

### Decision
Hvad vi har besluttet at gøre.

### Consequences
- Positive (hvad bliver lettere)
- Negative (trade-offs)
- Neutral (ting der ændres uden klar plus/minus)

### Tenet alignment
Hvilke architectural tenets bakker denne ADR op?
Hvis ingen tenet bakker den op, overvej om beslutningen er for tidlig
eller om en tenet mangler at blive formaliseret.

### Related
- Open questions resolved: Q-XXX
- Files affected: ...
- Cross-reference til ARCHITECTURE-MAP.md sektion X
```

---

## ADRs

### ADR-001: Server-authoritative presence

**Status:** PROPOSED
**Date:** 2026-05-18
**Migrated from:** Q-026

#### Context

Live session state (hvem er checked in, hvem er aktiv) har i nuværende PWA-arkitektur **3 mulige sources of truth**:

1. **Frontend `appMode`** state — vinduets opfattelse af om brugeren er i live mode
2. **DB-kolonne** på bubble_members — `checked_in` boolean
3. **Edge function logic** i `checkin` function — server-side validation

Det er distributed authority. Konflikter kan opstå (frontend tror du er checked in, DB siger nej).

#### Decision

**Server is authoritative for presence state.** Frontend læser via Realtime subscriptions, skriver kun via edge functions. Frontend cache er **derived** state, ikke source of truth.

#### Consequences

**Positive:**
- Eliminér distributed state race conditions
- Native migration er straightforward — samme princip
- Reconnect-scenarier bliver enkle (re-fetch fra DB)

**Negative:**
- Frontend-only optimizations (instant UI feedback) bliver sværere — kræver optimistic updates med rollback
- Edge function performance bliver hot path — skal optimeres

**Neutral:**
- Realtime subscriptions skal være pålidelige — er allerede bygget men ikke audited

#### Tenet alignment

Tenet 1 (backend normalization — server-authoritative state) + Tenet 3 (ambiguous ownership replaced with single authority)

#### Related

- Open questions resolved: Q-026
- ARCHITECTURE-MAP.md sections: 18 (Live Check-in Flow er allerede aligned med dette princip)
- Native impact: bliver fundament for live-feature i React Native

---

### ADR-002: Cross-system writes via services only

**Status:** PROPOSED
**Date:** 2026-05-18
**Migrated from:** Q-032

#### Context

Nuværende kode har **direkte cross-system database writes** — fx en messages-håndterer der direkte INSERTer i `bubble_members` (cross-system write fra Messaging til Membership domain).

Det skaber:
- Implicit coupling mellem domain systems
- Vanskelig at audit/tracking af side effects
- Native migration vil eksplodere i kompleksitet hvis vi porter dette mønster

#### Decision

**Cross-system writes må kun ske gennem service-funktioner.** Hvert domain har en service-fil (`bubble-service.js`, `messaging-service.js` etc.). Ingen direkte DB-writes fra ét domain til et andets tabeller.

Eksisterende `dbActions`-pattern i `b-utils.js` er den rigtige retning — udvides til komplette services pr. domain før native.

#### Consequences

**Positive:**
- Eksplicit kontrakt mellem domain systems
- Audit/tracking af side effects bliver muligt
- Native services kan udvikles 1:1 fra disse contracts

**Negative:**
- Refactor af eksisterende writes (117 direct writes per Q-008) — non-trivial
- Mere indirektion i koden

**Neutral:**
- Performance-impact minimal (samme DB-calls, bare wrapped)

#### Tenet alignment

Tenet 1 (contract stabilization before native) + Tenet 3 (duplicate writes eliminated via service layer)

#### Related

- Open questions resolved: Q-032
- Related questions: Q-001 (dbActions migration scope), Q-008 (117 direct writes inventory)
- Native impact: definerer service-boundaries før native build

---

### ADR-003: Platform has no domain dependencies

**Status:** PROPOSED
**Date:** 2026-05-18
**Migrated from:** Q-033

#### Context

I system-boundaries-analysen (ARCHITECTURE-MAP.md section 11) identificerede vi 5 systems: Platform, Identity, Bubble, Messaging, Discovery.

Platform er foundation-laget (auth, realtime, storage). Spørgsmålet er om Platform må importere fra domain systems (Bubble, Messaging etc.) eller om afhængigheden kun går én vej.

#### Decision

**Platform har INGEN dependency på domain systems.** Domain systems må importere fra Platform, men ikke omvendt.

Eksempel:
- ✅ `bubble-service.js` importerer `supabase-client.js` fra Platform
- ❌ `supabase-client.js` må IKKE importere `bubble-service.js`

#### Consequences

**Positive:**
- Platform forbliver rock-solid og rarely-changes
- Domain systems kan refactores uden at bryde Platform
- Native migration: Platform kan skiftes uafhængigt (fx hvis vi en dag flytter fra Supabase)

**Negative:**
- Nogle convenient shortcuts forsvinder (Platform kan ikke "vide" om bubbles)
- Cross-cutting concerns (logging, metrics) skal designes som platform-level abstractions

**Neutral:**
- I praksis allerede sådan kodebasen er strukturet — formalisering, ikke ændring

#### Tenet alignment

Tenet 1 (Platform as stable contract layer, prerequisite for native)

#### Related

- Open questions resolved: Q-033
- ARCHITECTURE-MAP.md sections: 11 (System Boundaries), 12 (Platform sub-systems)
- Native impact: Platform bliver gen-brugbart lag

---

### ADR-004: Reducer pattern as architectural invariant for realtime messages

**Status:** PROPOSED
**Date:** 2026-05-18
**Migrated from:** Q-024

#### Context

Realtime messages kan komme fra flere paths samtidigt:
- Direct DB INSERT subscription
- Optimistic update fra sender
- Refresh efter reconnect
- Pull-to-refresh
- Bubble entry initial load
- Edge function ack

Hvert path skal updatere UI **uden** at skabe duplicates. Memory dokumenterer at `bcReduceMsg()` (BC = bubble chat) håndterer 4 paths og `dmReduceMsg()` håndterer 6 paths.

Begge bruger dedup på `data-msg-id` og samme pattern.

#### Decision

**Reducer-pattern er arkitektur-invariant for alle realtime message streams.** Enhver UI update fra et realtime-event skal gå gennem en reducer der:

1. Modtager event payload
2. Dedupliker på unik ID
3. Bestemmer insert position (timestamp ordering)
4. Returnerer ny state ELLER no-op

Dette gælder: BC messages, DMs, bubble updates (fremtidig), presence updates (fremtidig).

#### Consequences

**Positive:**
- Single point of truth for "hvordan tilføjes en message"
- Lokal reasoning: hvis dedup fejler, ved vi præcis hvor
- Native React Native kan bruge samme pattern (useReducer hook)

**Negative:**
- Alle nye realtime-features skal bygges via reducer (ikke direct UI manipulation)
- Reducer-funktioner kan blive komplekse

**Neutral:**
- Bekræftelse af eksisterende pattern, ikke nybyggeri

#### Tenet alignment

Tenet 1 (event ownership contract) + Tenet 3 (race conditions / duplicate writes eliminated via reducer)

#### Related

- Open questions resolved: Q-024
- ARCHITECTURE-MAP.md sections: 17 (DM Send/Receive med 6 paths)
- Native impact: useReducer kan implementere samme contract

---

*Sidst opdateret: 18. maj 2026*

### ADR-005: joinBubble() discriminated union return contract

**Status:** ACCEPTED · Implemented in v8.17.30 (refined from v8.17.29)
**Date:** 2026-05-18
**Migrated from:** Q-061

#### Context

`dbActions.joinBubble()` had ambiguous return shape:
- Success: `{ ok: true }` OR `{ ok: true, duplicate: true }`
- Failure: `{ ok: false }` OR `{ ok: false, error: 'private_bubble' }` OR `{ ok: false, error: <Error obj> }`

**Audit of 8 call sites revealed:**
- 4 callers handled `duplicate` flag incorrectly (showed "joined" toast even when already member)
- Mixed error types (string vs Error object) made caller code fragile
- One caller's comment said "already member fine" but the logic was wrong (treated all `!ok` cases the same)

This is **ambiguous ownership** of the result interpretation — exactly what Tenet 3 warns against.

#### Decision

`joinBubble()` returns a **discriminated union with two-level taxonomy**:

```javascript
// Success cases — `status` is the category, always present
{ ok: true,  status: 'joined_now',      bubble_id: 'xxx' }
{ ok: true,  status: 'already_member',  bubble_id: 'xxx' }

// Failure cases — `status` is category, `reason` is specific cause
{ ok: false, status: 'blocked',        reason: 'private_bubble', bubble_id: 'xxx' }
{ ok: false, status: 'blocked',        reason: 'hidden_bubble',  bubble_id: 'xxx' }
{ ok: false, status: 'invalid_input',  reason: 'no_user' }
{ ok: false, status: 'invalid_input',  reason: 'missing_bubble_id' }
{ ok: false, status: 'db_error',       reason: 'db_error', error: <Error> }
```

**Contract rules (Callers MUST follow):**

1. **Always branch on `status`** — never on absence of fields, never on `reason` directly
2. **`ok`** says if operation succeeded enough for flow to continue
3. **`status`** is the category of what happened — uniform across success AND failure
4. **`reason`** is only present on failure/blocking — the specific cause
5. **`error`** is only present on `db_error` — raw technical error for logging
6. **`bubble_id`** is present on success AND blocked failures — for analytics/debugging
7. **`duplicate` is REMOVED** — never re-introduce it

**Why two-level taxonomy (status + reason):**
- `status` lets callers handle broad categories ("did it block?", "was it invalid input?")
- `reason` lets callers/logs see specific cause when needed
- Together they prevent the original bug: callers can't accidentally treat `private_bubble` and `db_error` the same way

#### Consequences

**Positive:**
- Type-safe — every scenario explicit with consistent shape
- Native-portable — maps directly to TypeScript discriminated union for React Native
- Toast accuracy — users now see correct "already member" vs "joined" feedback
- Analytics integrity — `bubble_join_duplicate` vs `bubble_joined` events stay clean
- Debugging — `bubble_id` preserved on blocked failures for log correlation
- Forward extensible — new failure modes just add new `(status, reason)` pairs

**Negative:**
- Slightly more verbose than minimal shape (3 fields on most cases instead of 1-2)
- Breaking change for any future external integrations (mitigated: no public API)

**Neutral:**
- Same DB queries, same error handling — pure contract change

#### Tenet alignment

- **Tenet 1** (Native = backend normalization pressure): contract stabilized before native rewrite, can be ported 1:1 to TypeScript
- **Tenet 3** (replace ambiguous ownership): eliminated mixed-type errors and ambiguous `duplicate` flag — root cause of 4 caller bugs

#### Test cases (manual verification required)

Before pilot launch, manually verify:

1. **New user joins public bubble** → `{ ok: true, status: 'joined_now', bubble_id }`
2. **Existing member clicks join again** → `{ ok: true, status: 'already_member', bubble_id }`
3. **Direct join on private bubble** (visibility='private', not event/live) → `{ ok: false, status: 'blocked', reason: 'private_bubble', bubble_id }`
4. **Direct join on hidden bubble** → `{ ok: false, status: 'blocked', reason: 'hidden_bubble', bubble_id }`
5. **Event-flow join as existing member** → modal/toast must say "already member", NOT "you have now joined"
6. **Missing bubbleId param** → `{ ok: false, status: 'invalid_input', reason: 'missing_bubble_id' }`
7. **Not logged in** → `{ ok: false, status: 'invalid_input', reason: 'no_user' }`

#### Related

- Open questions resolved: Q-061
- Files affected: `b-utils.js` (contract), `b-bubbles.js` (4 callers), `b-home.js` (3 callers), `b-live.js` (1 caller)
- Cross-reference: ARCHITECTURE-MAP.md Section 16 (Bubble Join Flow)
- Pre-pilot priority — addressed before pilot launch

#### Iteration history

- **v8.17.29:** Initial discriminated union with asymmetric shape (`status` on success, `reason` on failure)
- **v8.17.30:** Refined to uniform `status` always present + `reason` for specifics + `bubble_id` on blocked failures (current)

---

### ADR-006: DM send consolidation + push strategy

**Status:** ✅ ACCEPTED (Option A + 3 revisioner) · maj 2026 · klar til implementering
**Date:** 2026-05-18 (accepted maj 2026 efter production-verifikation)
**Migrated from:** Q-041 + Q-042

#### ⚠️ GROUND TRUTH (verificeret mod production — korrigerer draft-antagelser)

Draft'en antog "hver DM giver 2 pushes (hvis trigger virker)". Verifikation viste
noget andet og vigtigere:

| Type | Trigger | Frontend sendPush | Faktisk net-resultat |
|---|---|---|---|
| Besked | trigger_push_on_message → **recipient_id → 400, FEJLER tavst** | virker (user_id) | **1 push (kun frontend, ved et tilfælde)** |
| Invitation | notify_bubble_invite → user_id, **virker** + trigger_push_on_invite (placeholder, død) | virker (user_id) | **2 pushes (DOBBELT)** |
| Saved contact | notify_contact_saved → user_id, **virker** | udkommenteret | **1 push (kun trigger)** |

Yderligere fund:
- **notify_new_message** sender user_id KORREKT men er **ikke koblet til nogen trigger** (død kode). Besked-fix kan være "kobl on_new_message_push til notify_new_message + slet trigger_push_on_message" frem for at reparere.
- **Ingen push-delivery-logging** (kun push_subscriptions + generel error_log). Forklarer hvorfor trigger_push_on_message har fejlet tavst uopdaget. error_log kan genbruges.
- **Secrets hardcodet:** sb_secret i notify_*, FULD service-role JWT i klartekst i trigger_push_on_message (→ SKAL ROTERES), placeholder i trigger_push_on_invite.

Konklusion: ikke ét "double-fire"-problem, men **tre konkurrerende halvfærdige systemer** (notify_*, trigger_push_*, frontend sendPush) med inkonsistent dækning pr. type.

#### Context

Audit of DM send paths revealed two interconnected problems:

**Problem 1: Multiple DM send paths bypass centralized service**

4 different code paths write DM messages to DB:

| Path | Function | Location | Side effects |
|---|---|---|---|
| 1 | `sendMessage()` | b-messages.js:200 | Direct DB insert, broadcast, trackEvent, push |
| 2 | `sendDirectMessage()` | b-messages.js:283 | Direct DB insert, push (NO broadcast, NO tracking) |
| 3 | `dmHandleFile()` | b-messages.js:303 | Direct DB insert, push (NO broadcast, NO tracking) |
| 4 | `dbActions.sendDM()` | b-utils.js:887 | Insert via dbActions, push, trackEvent (NO broadcast) |

Only `b-chat.js:110` (GIF picker) uses path 4 (the centralized service).

This violates Tenet 3 (ambiguous ownership). Each path has slightly different side effects, no path is authoritative.

**Problem 2: Push notification double-fire**

Push notifications fire from BOTH frontend AND DB trigger for every DM:
- 4 frontend `sendPush` call sites (one per send path above)
- DB trigger `on_new_message_push` on every messages INSERT

Result: Every DM produces 2 push notifications (assuming trigger works correctly — which is itself 🟡 inferred per Q-051).

#### Decision (ACCEPTED — Option A med revisioner, maj 2026)

**Canonical push = backend domænehændelser (DB-trigger), ikke frontend-klienter.**
Push er en domænehændelse ("ny besked sendt"), ikke en UI-hændelse. Web, native,
workers, integrationer skal alle kunne udløse samme push uden frontend-logik.
Native arver trigger-systemet gratis (Tenet 1) — frontend-push ville kræve parallel
genimplementering i React Native = parallel bugs/semantik/edge cases.

**Princip der styrer hele beslutningen: byg synlighed før kompleksitet.**
Vi bygger observability der *afslører* problemer (dubletter, fejl), og venter med
at bygge mekanik (dedup) til data viser at problemet er reelt. Generaliseret
"measure, don't guess".

**Revision 1 — Observability: minimal `push_events` (IKKE error_log, IKKE enterprise log).**
```sql
push_events
- id
- event_type            -- 'new_message' | 'bubble_invite' | 'contact_saved' | ...
- recipient_user_id
- source                -- 'trigger' | 'frontend' (under migration) | 'edge'
- status                -- 'sent' | 'failed' | 'no_subscription'
- error                 -- provider/edge fejlbesked, nullable
- created_at
```
Nok til at svare: hvem skulle have push, hvorfor, fra hvilken kilde, lykkedes det?
Afslører dubletter (samme event_type+recipient to gange) UDEN at vi bygger dedup.
**Pilot-diagnoseværktøj, ikke permanent audit-log** — sæt retention-politik som
bevidst senere beslutning, så tabellen ikke bliver ny teknisk gæld.

**Revision 2 — Idempotens PARKERET (kendt fremtidig parameter, ikke pilot-arbejde).**
Design med `message_id`/event_id som dedup-key i baghovedet. Byg IKKE dedup-mekanik
før `push_events` viser reelle dubletter ved faktisk trafik. Ved pilot-skala (~500)
er pg_net retry-dubletter sandsynligvis ikke en reel kilde. Observability afslører
det hvis det sker.

**Revision 3 — Trigger-hygiejne (undgå trigger-spaghetti fra dag 1).**
- ÉN canonical trigger pr. event-type (ikke konkurrerende funktioner som nu)
- ÉT edge-entrypoint (send-push — allerede sandt)
- Dokumentér alle push-triggers ét sted (trigger-register i ARCHITECTURE-MAP §19)
- Klare ownership-regler så push-logik ikke bliver skjult distribueret forretningslogik

**Oprydning (følger af Option A):**
- **Beskeder:** kobl `on_new_message_push` → den allerede-korrekte `notify_new_message`
  (sender user_id). Slet brudte `trigger_push_on_message`. (Repair > rewrite — den
  rigtige funktion findes allerede, kun wiring er forkert.)
- **Invitationer:** behold `notify_bubble_invite` (virker). Slet døde `trigger_push_on_invite`
  (placeholder, har aldrig virket). Fjern frontend invite-push (eliminerer dobbelt).
- **Saved contact:** **DISABLE nu** (drop trigger). Default off indtil premium/privacy-
  semantik er klar. Lettere at tænde en god feature senere end fjerne en creepy folk
  har oplevet.
- **Frontend `sendPush`:** fjern for alle trigger-dækkede typer — EFTER triggers er
  repareret og verificeret leverende via push_events (sikker rækkefølge).

**Sikker implementerings-rækkefølge (cutover uden dækningshul):**
1. **Rotér** den eksponerede service-role JWT i Supabase (akut, uafhængig)
2. Opret `push_events` + edge skriver til den (observability FØR dispatch-ændring)
3. Reparér/kobl triggers korrekt → verificér levering via push_events
4. *Derefter* fjern frontend sendPush for dækkede typer
5. Migrér secrets til Vault (supabase_vault 0.3.1 aktiveret, tom)

**Phase 1 (DM send consolidation) består uændret:** konsolidér 4 DM-skrivestier til
`dbActions.sendDM()`. Men "flyt push ind i sendDM" bliver nu "FJERN push fra alle
frontend-stier" (da push ejes af trigger). Phase 3 (sendDM discriminated union)
uændret.

#### Decision (HISTORIC DRAFT — bevaret for kontekst)

**Phase 1 — DM Send Consolidation** (can proceed without ground truth):

Consolidate all 4 paths to use `dbActions.sendDM()` as single source of write:
- Extend `dbActions.sendDM()` to handle: content-only, file uploads, GIF uploads, edits
- Refactor `sendMessage()`, `sendDirectMessage()`, `dmHandleFile()` to call `dbActions.sendDM()`
- Keep optimistic UI in callers (sendMessage's tempMsg pattern)
- Move broadcast + trackEvent + push into `dbActions.sendDM()`

**Phase 2 — Push Strategy Decision** (BLOCKED on Q-050/Q-051/Q-054):

Must decide one of three strategies:

- **Option A — DB Trigger only:** Disable frontend push, rely on `on_new_message_push`. Single source of dispatch. Requires push_delivery_log for observability.
- **Option B — Frontend only:** Disable DB trigger, rely on frontend `sendPush`. More debuggable but loses notifications if frontend crashes between insert and push.
- **Option C — Both with deduplication:** Edge function dedupliker on `message_id + recipient_id`. Resilient but complex. Requires push_events table (per Section 19.6).

**Recommendation pending verification:** Option A if Q-050 confirms trigger is active AND Q-051 confirms schema matches. Otherwise Option B as fallback.

**Phase 3 — sendDM Contract Stabilization:**

After consolidation + push strategy, stram `dbActions.sendDM()` to discriminated union (matching joinBubble pattern from ADR-005):

```javascript
{ ok: true,  status: 'sent',           message_id, message }
{ ok: false, status: 'invalid_input',  reason: 'no_user' | 'no_receiver' }
{ ok: false, status: 'blocked',        reason: 'blocked_user' | 'rate_limited' }
{ ok: false, status: 'db_error',       reason: 'db_error', error }
```

#### Consequences

**Positive (when implemented):**
- Single source of write for DMs (Tenet 1: contract stabilization)
- Eliminates push double-fire (Tenet 3: replace ambiguous ownership)
- Consistent side effects across all DM paths (broadcast, tracking, push)
- Native-ready (clear contract for React Native to consume)

**Negative:**
- Larger refactor than joinBubble (4 callers vs 8, but each has more logic)
- Push strategy decision has architectural implications
- Cannot proceed without ground truth verification

**Neutral:**
- Same DB writes, same UX (no user-facing changes expected)

#### Tenet alignment

- **Tenet 1** (Native = backend normalization pressure): contract stabilization + observability before native
- **Tenet 3** (replace ambiguous ownership): 4 send paths → 1 authoritative path
- **Tenet 4** (grundighed over hastighed): we're not implementing this until we have ground truth, even though it's tempting to "just fix it"

#### Blockers — ALLE LØST (maj 2026)

- **Q-050:** ✅ Verificeret — 4 triggers aktive (2 brudte recipient_id, 2 virkende user_id)
- **Q-051:** ✅ Verificeret — edge kræver user_id, slår op i push_subscriptions
- **Q-054:** ✅ Verificeret — ingen push-delivery-logging (→ Revision 1: push_events)
- **Q-052, Q-053, Q-055:** ✅ Verificeret (se VERIFICATION-GUIDE.md resultater)

#### Related

- Open questions: Q-041 (VERIFIED), Q-042 (VERIFIED), Q-050/051/054 (PENDING)
- ARCHITECTURE-MAP.md sections: 17 (DM Send/Receive Flow), 19 (Push Notification Flow)
- ADR-005 (joinBubble contract) — template for Phase 3 contract refinement

#### Implementerings-sekvens — "Close ADR-006: make push backend-owned and observable"

> **STATUS maj 2026: trin 0-4 GJORT og verificeret. Trin 5 (Vault) åben — ikke gate.**
> Native gate 1 er reelt lukket: push er backend-ejet, observerbart, NEXT uden dubletter.

**0. ✅ VERIFICÉR NUVÆRENDE STATE — GJORT.**
Verificeret mod virkeligheden: 5 triggers fundet, funktions-kroppe inspiceret. Bekræftede at `notify_new_message` fandtes korrekt men UKOBLET, `trigger_push_on_message` brugte recipient_id + legacy-JWT, `trigger_push_on_invite` var placeholder + double-fire. `push_events` fandtes ikke endnu. (Lektie holdt: antag ikke — flere bugs i dag havde forkert antaget rod.)

**1. ✅ Deploy observability — GJORT.**
`push_events` + edge v2 deployet. Verificeret: loggen fangede straks de tavse fejl (`new_invite → invalid → user_id required`) og double-fire. Synlighed før kompleksitet betalte sig.

**2. ✅ Reparér trigger-routing — GJORT.**
`on_new_message_push` koblet til `notify_new_message`, `source='trigger'` tilføjet, `trigger_push_on_message` + `trigger_push_on_invite` slettet (legacy-JWT fjernet som sidegevinst), `on_contact_saved_push` disabled. Ren trigger-liste: 3 canonical tilbage.

**3. ✅ Verificér delivery — GJORT.**
push_events viste `new_message | source: trigger | sent | 2 enheder`. Ikke længere `invalid`. Synligt bekræftet.

**4. ✅ Fjern frontend `sendPush` (v8.44) — GJORT.**
Fjernet for new_message (4 sites) + invitation (1 site). Behold approved/checkin/join_request (ingen backend-trigger — frontend-drevne, post-pilot kandidater). Den "double-fire" på telefonen var PROD-genvejen (gammel kode) parallelt mod samme DB — NEXT var ren.

**5. ✅ Secrets fjernet via Vej A — GJORT (ADR-006 LUKKET).**
Vej A bekræftet: edge accepterer kald UDEN Authorization-header (deployet `--no-verify-jwt`) — testet via push_events (`source: trigger_test → sent`). Så headeren var unødvendig, og den hardcodede `sb_secret` blev fjernet HELT fra alle 3 funktioner (notify_new_message, notify_bubble_invite, notify_contact_saved). Verificeret: `har_secret=false, har_header=false` for alle tre. Ingen Vault nødvendig — den simpleste løsning var også den reneste. Lektie: vi testede behovet (Vej A) før vi tilføjede kompleksitet (Vault) — Vault ville have virket men var unødvendigt arbejde.

**ADR-006 status: FULDT LUKKET.** Push backend-ejet, observerbart (push_events), ingen dubletter, ingen hardcodede secrets. Native gate 1 lukket.

**Afgrænsning:** Playwright/chaos er separat (Q-064). GDPR (Q-062) og privacy (Q-063) er separate arbejdspakker.

---


### ADR-007: Native development as primary strategic direction

**Status:** ACCEPTED
**Date:** 2026-05-21 · Reframed 2026-05-21 (v2)
**Strategic anchor:** VL Døgnet 27. maj 2027 (Alsik Hotel, Sønderborg)

> **Tagline:** *"Native bygges på PWA's læring, ikke PWA's kode."*

#### Framing — language matters

This ADR uses the framing **"native is now primary strategic direction"** — NOT **"point of no return"**.

The distinction matters psychologically and professionally:

- **"Point of no return"** removes optionality, creates emotional commitment to scope decisions made today, makes course-correction feel like failure
- **"Primary strategic direction"** preserves optionality, allows scope adjustment without strategy collapse, enables realistic mid-flight changes

**Optionality preserved:**

- Native scope can be **reduced** if pilot reveals different priorities (cut features, not quality)
- Launch strategy can be **adjusted** if timeline pressure exceeds buffer (soft launch, beta-extended, etc.)
- PWA remains **fallback** in maintenance mode — not abandoned
- Individual flows can be **paused** or **deferred** without restarting strategy
- VL Døgnet is **target date**, not contract — partial native + PWA fallback is acceptable scenario

The commitment is to **direction**, not to specific delivery configuration.

#### Context

Bubble's PWA er ved at vokse sig kompleks (~23K LOC, 23 filer, multiple critical flows). Vi har en konkret native deadline (VL Døgnet 2027) der giver 12 måneder + 1 uge fra beslutning til launch.

Den umiddelbare reaktion på "vi skal have native til VL" er at planlægge en **rewrite med feature parity**: portere alle eksisterende flows, alle skærme, al funktionalitet til React Native og lancere som komplet erstatning for PWA.

**Det er forkert tankegang.** Det fører til:

- Enterprise rewrite-fælden (12 måneders monolit-projekt)
- Feature parity-marathon der drukner i sekundære flows
- Portering af PWA's hårdt erhvervede kompleksitet 1:1 (DOM-state, flow flags evolved-over-time, navigation hacks)
- Binding til scope **før** PWA-pilot har afsløret hvad der reelt betyder noget

Ekstern arkitektur-review (maj 2026) krystalliserede den rigtige tilgang:

> *"Native er ikke et rewrite. Det er en destillering."*

#### Decision

Native development køres som **parallelt distillation-lab**, ikke som erstatning af PWA. Konkret:

**1. Repo-strategi:**
- Separat repo: `bubble-native-lab` (ikke i bubble_pwa main)
- Psykologisk og teknisk uafhængigt fra PWA
- Giver plads til eksperimentering uden at true PWA-stabilitet

**2. Scope-disciplin:**
- Native v1 = **3-5 kerneflows max**, ikke feature parity
- Konkrete kerneflows defineres separat (TBD i kommende session)
- Sekundære flows (admin, settings detail, avancerede moderation) forbliver i PWA på sigt
- "Det vi ikke porterer" dokumenteres eksplicit, ikke implicit

**3. Hvad beholdes vs genopfindes:**

**Beholdes (slæbes med):**
- Supabase backend (data model, RLS, edge functions)
- dbActions kontrakter (joinBubble pattern fra ADR-005 som template)
- Realtime model
- Auth providers (samme OAuth + email setup)
- Push infrastructure (decision pending ADR-006)
- Analytics/event model
- Design language (Bubble Design v6)
- i18n keys (1,084 keys porterbare)

**Genopfindes (lader være):**
- Frontend navigation (DOM classList → Expo Router)
- Flow-state orchestration (sessionStorage hacks → Zustand store med eksplicit state machine)
- Auth orchestration (spredt mellem 4 filer → centraliseret auth context)
- Realtime lifecycle (manuelle subscribers → React Native AppState-aware)
- Push/deeplink handling (web push → native push + Universal Links + App Links)
- DOM-state og inline onclick handlers (→ React state + onPress)
- Service worker (→ native caching strategy)

**4. Lifecycle først, screens bagefter:**

Bubble's største native-risiko er ikke "byg screens" — det er lifecycle:
- App backgroundes → OS dræber process
- Push åbner cold start uden state
- Permissions ændres udenfor appen
- Network reconnect mens app sover
- Deeplink kommer uden context

Første native-arbejde er **lifecycle-discipline**, ikke UI. Sekvens:

1. Auth + session restore
2. AppState transitions (background/foreground/inactive)
3. Push routing fra cold start
4. Deeplink resolution + auth orchestration
5. Realtime reconnect efter sleep
6. Derefter: skærme på solid lifecycle-fundament

**5. Pilot-drevet roadmap:**

Sønderborg-pilot (planlagt sommer 2026, ~500 brugere) er ikke "valgfri læring". Den er **forudsætning** for native scope-beslutninger:

- Pilot afslører hvilke flows brugere faktisk bruger
- Pilot afslører hvilke bugs der reelt rammer brugere
- Pilot afslører hvor performance bottlenecks ligger
- Pilot afslører hvilken onboarding-friktion der koster konvertering

Native v1's "3-5 kerneflows" defineres **delvist baseret på pilot data**, ikke kun a priori arkitektur-analyse.

**6. Stack-beslutning:**

- **Framework:** React Native + Expo
- **Routing:** Expo Router (file-based, matcher web mental model)
- **State:** Zustand (matcher reducer-pattern fra ADR-004)
- **Language:** TypeScript fra dag 1 (lærer fra PWA's typeløse evolution)
- **Backend:** Supabase JS client (uændret)
- **Build:** EAS Build (skybaseret, ingen lokal Mac nødvendig til builds)

Begrundelse for React Native (ikke "fordi JS"):
- Bubble er flow/state-tung, ikke graphics-tung — RN passer naturligt
- Realtime + Supabase er allerede event-driven (mental model matcher)
- Solo founder + 12 måneder = ikke tid til Swift+Kotlin dobbelt udvikling
- Eksisterende JS-erfaring er bonus, ikke primær begrundelse

#### Consequences

**Positive:**
- Reduceret risiko: native fejl kan ske uden at true PWA-pilot
- Hurtigere learning loop: lab eksperimenter uden production-pres
- Bedre scope-disciplin: "3-5 flows" tvinger prioritering
- PWA forbliver fallback hvis native ikke når VL-deadline
- Backend-investering forrentet på tværs af både PWA og native

**Negative:**
- To kodebaser at vedligeholde i overgangsperiode
- Risk for divergens hvis ikke disciplineret om "hvad er kerneflow"
- Solo founder skal håndtere context-switching mellem repos

**Neutral:**
- Bubble-native-lab navn signalerer eksperimenter — kan opfattes som "ikke seriøst" af nogle, men det er **strategisk fordel** internt (psykologisk lavere risiko at iterate)

#### Tenet alignment

- **Tenet 1** (Native = backend normalization pressure): backend forbliver stabilisering-fokus, native bygger på den
- **Tenet 2** (Discover before redesign): pilot-drevet kerneflow-definition, ikke gætteværk
- **Tenet 3** (Replace ambiguous ownership): native chance for at fjerne PWA's DOM-coupling og flow-state-spaghetti
- **Tenet 4** (Grundighed over hastighed): destillering = grundighed, ikke quick rewrite
- **Tenet 5** (Distill, don't port): direkte materialisering af denne tenet

#### Related

- VL Døgnet 2027 som strategic launch event
- NATIVE-MIGRATION.md (opdateres separat fra skeleton til actionable roadmap)
- ADR-005 (joinBubble contract) — template for native dbActions
- ADR-006 (DM send + push strategy, DRAFT) — must finalize before native push design

#### Open scope decisions (active todos before code begins)

These are **not** "we'll figure it out later" — they are **prerequisites** to native development kickoff. Each gets its own document.

**1. Negative scope definition** → `NEGATIVE-SCOPE.md`
- What is explicitly NOT in native v1
- What features remain web-only
- What admin/moderation tools are deferred
- What flows are allowed to be lower-quality in v1

**2. Lifecycle architecture** → `LIFECYCLE-ARCHITECTURE.md`
- AppState model (foreground/background/inactive transitions)
- Restore model (resumption after kill/sleep)
- Deeplink model (Universal Links + App Links resolution)
- Push navigation model (cold start from notification)
- Realtime reconnect model (post-sleep behavior)
- Offline assumptions (what works, what doesn't)
- Auth/session orchestration (single source of truth)

**3. Observability stack** → `OBSERVABILITY.md`
- Crash reporting (Sentry vs alternatives)
- Flow tracing (PostHog vs alternatives)
- Error visibility (logError pattern → active monitoring)
- Analytics events (port from PWA + native-specific)
- **Dag 1 requirement**, not "add later"

**4. Realistic timeline**
- Baseline: **6-9 months focused fulltime** (not 5-6 — that was optimistic)
- Realistic with solo founder split focus: **9-12 months**
- Buffer for VL Døgnet (27. maj 2027): tight but achievable if kickoff ~august 2026
- App Store review cycles (2x à 3-14 days) included in timeline

**5. Pilot strategy refinement**
- Native v1 launches as pilot in Sønderborg (oktober-november 2026)
- **Optional parallel:** small PWA soft launch (20-30 testers) summer 2026 for discovery/retention signal without committing to PWA development
- Not "either/or" — both can provide value

**6. Definition of "PWA maintenance mode"**
- Feature freeze date: **31. juli 2026** (proposed, final TBD)
- Fallback rule: PWA never more than 2-4 weeks of critical hardening away from deployable
- "Critical bug" criteria: blocks core auth, blocks core flow, security issue, GDPR concern
- All other PWA issues: documented but not fixed

#### Practical blockers (calendar-bound, must start this week)

These have lead times independent of code:

- Apple Developer Program enrollment (1-2 weeks approval)
- DUNS Number if business registration needed (2-4 weeks via Dun & Bradstreet)
- Google Play Console (15 min, but must be done)
- Mac availability for iOS local testing (or EAS Build commitment for cloud)

**Status of these unknown** — Michael needs to confirm before native kickoff is scheduled.

---

### ADR-008: Lilac token migration — structural, role-based (PLAN)

**Status:** PROPOSED (plan, ikke eksekveret) · maj 2026
**Kontekst:** Design-konsistens, IKKE en native-gate. Eksekveres efter ADR-006.

#### Problem

`--accent: #7C5CFC` (lilac) og `--gradient-primary` er stadig lilla-baserede. Design v6 (DESIGN-GUIDE) udfasede lilla *som CTA* — men selve tokens er uændrede. Resultat: al kode der bruger `var(--accent)` genskaber lilla, og vi har rettet kontrast-bugs symptom-for-symptom (bubble-up v8.45, join-knap, "Opret event"...). Det er whack-a-mole, fordi roden — tokenets betydning — aldrig blev ændret.

Scan (maj 2026): ~179 lilla-forekomster. Fordeling efter rolle: ~9 identitet/avatar, ~47 gradient, ~33 tekst-farve, ~62 border, ~75 bg-fill, ~12 shadow (tal overlapper).

#### Beslutning

**Omdefiner IKKE `--accent` globalt til isblå.** Det ville bryde kontekster hvor lilla virker (mørke skærme: onboarding #170F34) og identitets-farver (avatarer). At trække i én tråd og håbe = ny kontrast-bug et andet sted.

I stedet: **semantiske tokens + migrér per ROLLE, kontrast-verificeret per visning.**

- `--cta` = isblå (handling/CTA) — guidens regel. Tekst-på-lys = `rgb(70,150,210)`.
- Lilla beholdes KUN som identitet/dekoration (avatarer, prikker), ikke som handling.
- Gradient (logo + btn-primary/accent) = separat beslutning (gradient = logo-only er sit eget drift-item).

Princippet: ændr tokenets *betydning*, og migrér brug for brug — aldrig bulk-erstat efter farve.

#### Roller (fra scan)

1. **Identitet/dekoration** (avatarer, prikker, fx b-boot.js:335 dotCol, notif-avatarer): BEHOLD lilla. Ikke handling, ikke kontrast-kritisk.
2. **Gradient** (`--gradient-primary`, .btn-primary ×14, .btn-accent ×3, notif-avatarer): SEPARAT. Hvid tekst på gradient er læsbar; afvigelsen er "gradient = logo-only", ikke kontrast. Egen sub-beslutning.
3. **Handling/CTA** (lilla tekst/border/bg på interaktive elementer): MIGRÉR til `--cta`. Her bor bugs.
4. **Subtile dekorative tints** (border/bg rgba 0.06-0.18, mange i mørke modaler): mest BEHOLD/neutralisér — lav risiko.

#### Faser (eksekvering, IKKE nu)

- **Fase 0:** Definér tokens. `--cta-bg`/`--cta-border` findes allerede; tilføj `--cta-text-light: rgb(70,150,210)`. Overvej at omdøbe identitets-lilla til `--identity` så intent er eksplicit (forhindrer fremtidig CTA-misbrug).
- **Fase 1:** Migrér bekræftede handling-på-lys: bubble-up (✅ v8.45), bubbles-toggle (b-bubbles.js:794), "Opret event" (b-chat.js:897).
- **Fase 2:** Gennemgå de ~33 tekst-farve-brug: klassificér handling vs dekoration, migrér handling, verificér kontrast mod hver visnings baggrund (lys #F0EEF5 vs mørk chrome).
- **Fase 3:** Gradient-beslutning (btn-primary/accent): behold for logo, beslut for knapper. Egen vurdering pga ~17+ brug.
- **Fase 4:** Visuel QA per skærm (lys + mørk) — bekræft ingen kontrast er svækket.

#### Verifikation (kravet fra Michael)

Hver migration holdes op mod den faktiske visning: er baggrunden lys eller mørk? Holder kontrasten? Ingen bulk-ændring uden kontekst-tjek. Det er forskellen på at rette roden klogt vs. at bytte én bug for flere.

#### Afgrænsning

Design-konsistens, ikke native-blocker. Identitets-lilla og gradient-logo BEVARES. Eksekveres som fokuseret session efter ADR-006 er lukket. Whack-a-mole stopper når Fase 0-2 er gjort (tokenet bærer da korrekt betydning).

---

### ADR-009: Pending request lifecycle — withdrawable actions between users

**Status:** ACCEPTED (besluttet maj 2026) · build planlagt
**Beslutning af:** Michael

#### Princip

> Enhver handling hvor én bruger pålægger en anden bruger ansvar eller adgang skal kunne være **pending** og kunne **trækkes tilbage**.

Det er governance, ikke UX-detalje. To konkrete anvendelser nu; admin-roller måske senere. Vi bygger IKKE en generisk "pending actions engine" — princippet er fælles, implementeringen forbliver konkret per tilfælde (undgår præmatur abstraktion).

#### Problem

To steder bryder princippet i dag:
1. **Invitationer** har pending (accept/afvis findes) men kan IKKE trækkes tilbage af afsender. Hul: afsender der inviterer forkert person kan ikke fortryde.
2. **Ejerskabsoverdragelse er ØJEBLIKKELIG.** `transferBubble` kører `UPDATE bubbles SET created_by=X` straks ved bekræftelse. Den nye ejer accepterer ikke — de notificeres blot. Det gør overdragelse til en **énvejsdør**: i det øjeblik du overdrager, mister du ejerskabet og kan ikke trække tilbage eller vælge en anden — kun den nye ejer kan overdrage videre. Hvis modtageren ikke er klar/reagerer, sidder afsenderen fast.

#### Beslutning A — Invitations-tilbagekald

- UI: invite-modalens "Afventer"-række (b-bubbles.js:2131) gøres fuldt læsbar (ikke nedtonet) + tekstknap "Tilbagekald" (variant A fra mockup). Farve besluttes (blød rød vs neutral) ved build.
- Handling: **slet** invitations-rækken (ikke ny status). Matcher "det var en fejl, lad som om det ikke skete" — modtagerens notifikation forsvinder bare.
- RLS: afsender (`from_user_id = auth.uid()`) skal kunne DELETE sin egen pending invitation. Verificér policy findes; tilføj hvis ikke.
- Realtime: hvis modtager har notifikationen åben, fjernes den ideelt via realtime — acceptabel kant hvis ikke.

#### Beslutning B — Ejerskab bliver request-baseret

**Datamodel: kolonne på `bubbles`** (ikke separat tabel — matcher "ingen generisk engine"-grænsen, én pending overdragelse per boble ad gangen er korrekt begrænsning):
- `pending_owner_id uuid NULL` (FK profiles)
- `pending_owner_requested_at timestamptz NULL`

**KRITISK INVARIANT:** `created_by` ændres ALDRIG før accept. Mens overdragelsen pender er den oprindelige ejer **stadig fuld ejer** — det er hele pointen (ingen énvejsdør). Modellen skal garantere dette.

**Livscyklus:**
1. **Anmod** (ejer): `UPDATE bubbles SET pending_owner_id=X, pending_owner_requested_at=now() WHERE created_by=auth.uid()`. Notificér modtager (broadcast + push, genbrug invite-mønster).
2. **Træk tilbage** (ejer, mens pending): `UPDATE bubbles SET pending_owner_id=NULL, pending_owner_requested_at=NULL WHERE created_by=auth.uid()`.
3. **Afvis** (modtager): rydder pending-felterne. Via SECURITY DEFINER RPC `decline_ownership(bubble_id)` der tjekker `auth.uid()=pending_owner_id`.
4. **Accept** (modtager): den privilegerede, atomiske swap. SECURITY DEFINER RPC `accept_ownership(bubble_id)`: tjekker `auth.uid()=pending_owner_id`, sætter `created_by=pending_owner_id`, rydder pending-felter — alt i én transaktion. RPC frem for løs RLS, så ingen ikke-ejer nogensinde kan sætte `created_by` direkte.

**RLS:** anmod/træk-tilbage = ejer-only direkte UPDATE (`created_by=auth.uid()`, og `with_check` forhindrer at ændre `created_by` ad den vej). Accept/afvis = via RPC (SECURITY DEFINER, tjekker pending_owner_id). Aldrig løs nok til at en ikke-ejer kan røre `created_by`.

**Kant-tilfælde at håndtere:**
- Modtager forlader/fjernes fra boblen mens pending → ryd pending.
- Boble slettes → moot (kolonner forsvinder med rækken).
- Ejer prøver at overdrage til en der ikke er medlem → bør blokeres (kun medlemmer kan modtage, som i dag).
- Kun én pending overdragelse ad gangen (kolonne-model håndhæver det naturligt).
- **Gammel ejer efter accept → bliver `admin`** (LÅST jun 2026, Michael). Ikke-destruktivt: ny ejer (eller gammel selv) kan ændre derfra. Gammel ejer fjernes IKKE automatisk.
- **Ny ejer auto-forfremmes til `admin`** ved accept hvis kun 'member' (en ejer der ikke er admin giver ikke mening). Sker i samme RPC-transaktion som `created_by`-swap.
- **Idempotens:** accept/afvis-RPC virker KUN hvis `pending_owner_id` stadig matcher tilstanden. Dobbelt-accept eller accept-efter-fortryd fejler pænt uden bivirkning. Håndhæves i RPC, ikke frontend.
- **Notifikation efter afgørelse:** accepteret/afvist/annulleret anmodning skal ikke længere vises som handlingsbar hos modtager.
- **Ejer sletter konto mens pending:** annullér anmodning. NB: ejer-sletning fejler i forvejen (GDPR-bug, separat P0-spor) — løses IKKE her.
- **Udløbet/slut boble mens pending:** anmodning forbliver gyldig (ejerskab handler om kontrol, ikke aktiv-status). Lav-risiko.
- **Kun ejer må anmode** (ikke admins). **Kun udpeget modtager må acceptere** (ikke admins) — vigtigste RLS-invariant.

> **PARKERET jun 2026:** Kant-tilfældene ovenfor er gennemgået og låst. Næste skridt når vi genoptager: Claude skriver migration (pending_owner-kolonner) + 2 RPC'er (accept/decline, SECURITY DEFINER) + RLS-udkast → Michael kører SQL + invariant-test → Claude bygger frontend-split (requestTransfer/accept/decline/withdraw + modtager-UI, broadcast via subscribe→send→unsubscribe(2s)).

**Frontend-ændring:** `transferBubble` (b-utils.js:1084) deles op: `requestOwnershipTransfer` (sætter pending) erstatter den øjeblikkelige `UPDATE created_by`. Ny accept/afvis-UI hos modtager (genbrug notifikations-/invite-mønster). Ny "Afventer overdragelse — Træk tilbage"-tilstand hos afsender.

#### Build-rækkefølge

1. **Invitations-tilbagekald** (lille: UI + delete + RLS-tjek). Lavthængende, pending findes allerede.
2. **Ejerskab request-flow** (større: migration for kolonner + 2 RPC'er + RLS + frontend-split + modtager-UI). Bygges på modellen ovenfor.

#### Afgrænsning

Ingen generisk pending-engine. Admin-rolle-tildeling kan følge samme princip senere, men er IKKE i scope nu. Dette er produkt-governance, ikke en native-gate — men det forbedrer en kontrakt native arver (ejerskab-livscyklus).

---



---

## ADR-010: Foer adgang viser Bubble kontekst — efter adgang viser Bubble mennesker

**Status:** ACCEPTED
**Date:** 2026-07-17

### Context
Teaser-flowet (QR-scanning foer login) var aldrig gennemtaenkt som produktbeslutning.
Det voksede organisk med "social proof" som uudtalt ambition, og endte med at vise
medlemsansigter, personers netvaerk (5 kontakter) og — som fallback ved tomme bobler —
systemets 6 nyeste profiler. Det blev afdaekket 17. juli 2026 under backend truth pack
(se TD-001, TD-002) som anon-dataeksponering.

Erkendelsen (Michael): naar nogen scanner en boble-QR, er interessen BOBLEN, ikke
medlemmerne. Brugeren staar allerede i lokalet. Medlemmerne er noget man opdager EFTER
man er inde — det er hele produktets vaerdi og maa ikke gives vaek paa doerklokken.

Nuance vi ikke selv fangede: en scanning betyder hoej HANDLINGS-intention, men ikke
noedvendigvis hoej FORSTAAELSE. Nogen scanner fordi koden staar paa en skaerm, fordi de
tror det er wifi, eller af ren nysgerrighed. Teaseren skal derfor stadig forklare
vaerdien kort — den skal bare ikke BEVISE den ved at udstille mennesker.

### Decision
**Foer adgang viser Bubble kontekst og trovaerdighed. Efter adgang viser Bubble
mennesker og relevans.**

Konkret:

**Boble-teaser (get_bubble_teaser)** viser: boblens navn, formaal, vaert/organisation
(institutionelt social proof — "Hosted by House of Software" er staerkere end fem
ansigter, og goer Verified Bubbles synligt vaerdifuldt), tid/sted, aktivitetsniveau,
én klar CTA. Viser IKKE: medlemsprofiler, ansigter, nyeste brugere, radar-resultater.

**Profil-teaser (get_profile_preview)** viser: den scannede persons navn, titel,
organisation, avatar, keywords + CTA "Forbind". Viser IKKE: personens netvaerk,
forbindelser, aktivitet i andre bobler, matchdata.

**Profil-opslag bindes til QR-token**, ikke raat user_id. En anonym kan kun se preview
for et token de faktisk har scannet. Lukker enumerering ved roden.

### Consequences
**Positive**
- Lukker TD-001 og TD-002 ved roden frem for med lapper.
- Produktets dramaturgi bevares: radaren gives ikke vaek foer login.
- Verified Bubbles faar synlig vaerdi paa teaseren (vaert = trovaerdighed).
- Reglen er operationel: den afgoer fremtidige spoergsmaal uden ny diskussion.

**Negative**
- Teaseren bliver mindre "rig" visuelt. Accepteret: den skal vaere en doer, ikke en
  gratis miniudgave af produktet.
- Token-binding kraever aendring i baade RPC-signatur og frontend-flow.

**Neutral**
- Aggregeret sammensaetning (anonyme tags/sektor) er en SEPARAT feature-idé, ikke en
  del af denne ADR. Se FEATURE-IDEAS.md. Den foelger reglen (sammensaetning = kontekst,
  ikke mennesker), men bygges bevidst — ikke som sikkerhedslap.

### Rejected alternatives
- **Anonymisering som sikkerhedsloesning:** at fjerne navne lukker ikke hullet. Hullet
  er at hvem som helst kan spoerge om hvem som helst uden login — ikke hvilke felter
  der returneres. Ved 500 brugere i Soenderborg er "produktionschef i baeredygtighed"
  ofte én person: aggregeret data er IKKE automatisk anonymt ved lille skala.
- **LinkedIn-analogien som praecedens:** LinkedIn viser dig hvem der saa DIN profil
  (dine data, dit samtykke, hundreder af millioner at gemme sig i). Vores hul var at
  en fremmed kunne slaa ANDRE op. Ikke samme situation. Analogien holder derimod fint
  for Profile Views-laget (se FEATURE-IDEAS).
- **Monetiseringsargumentet som designprincip:** "det I giver vaek foer login kan I
  ikke tage betaling for" er retorisk staerkt men forkert som princip — det optimerer
  efter hvad man kan holde tilbage frem for hvad brugeren har brug for. De rigtige
  grunde er privatlivsforventning, dramaturgi og datasikkerhed. Monetisering er en
  sidegevinst, ikke en begrundelse.

### Tenet alignment
- **Tenet 3 (Preserve battle-tested behavior, replace ambiguous ownership):** teaserens
  "social proof" var netop tvetydigt ejerskab — en ambition ingen havde besluttet.
  Reglen giver den et ejerskab.
- **Tenet 4 (Grundighed over hastighed):** vi retter ikke bare SQL'en; vi afgoer hvad
  flowet SKAL vaere foerst.

### Related
- TD-001, TD-002 (hullerne denne ADR lukker)
- FEATURE-IDEAS.md: anonym sammensaetnings-teaser
- b-boot.js: loadQRProfilePreview (283), get_bubble_teaser-kald (418, 604)

---

### ADR-010 REVISION (18. juli 2026): "opret foerst" erstatter anonymt preview helt

**Hvad aendrede sig:** Den oprindelige ADR-010 (17. jul) beholdt et anonymt profil-preview
men trimmede det (token-binding, fjern network). Under implementering + storyboarding blev
en enklere og sikrere model tydelig: **fjern det anonyme preview HELT. Opret foerst.**

**Udloeser (Michael):** Hvis en ny bruger alligevel skal scanne to gange (preview kunne
ikke auto-gemme gennem OAuth uden skroebelig token-bevaring), saa er det sikre og enkle at
kraeve oprettelse FOERST. Et engangsflow hver bruger oplever én gang.

**Den endelige model:**
```
Scan QR
  -> Gem token + type persistent (INGEN data resolveres)
  -> "Log ind eller opret profil for at fortsaette"
  -> Auth + onboarding
  -> Token resolves som authenticated bruger (foerste opslag — nu trygt)
  -> Vis destination + bekraeftelses-CTA
  -> Bruger trykker: gem kontakt / check ind / deltag
```

**Fire praeciseringer (fra ekstern gennemgang, alle vedtaget):**

1. **Token gemmes PERSISTENT, ikke i JS-hukommelse.** Ved OAuth forlader brugeren Bubble
   og kommer tilbage via redirect — almindelig variabel er vaek. Gem `{token, type,
   createdAt}` i kontrolleret storage (genbrug flowSet/consumeFlow + 15min TTL). Kort
   udloeb, ryd ved afsluttet flow OG ved logout. ALDRIG persondata eller user-ID.

2. **Ingen entity-navne foer login.** KRITISK RETTELSE: at vise "Baeredygtighedskonferencen"
   kraever et anonymt token-opslag for at finde navnet — dvs. stadig en anonym
   teaser-arkitektur, bare uden personer. Foerste version viser KUN type: "et event paa
   Bubble" / "et netvaerk" / "en personlig Bubble-kode". Nul anonyme opslag for NOGEN type.
   Navngivne events kan komme senere HVIS de beviseligt konverterer — men da som bevidst
   offentligt teaser-endpoint, ikke som biprodukt.

3. **CTA daekker eksisterende brugere.** Ikke "opret en bruger" (udelukker udloggede/anden
   telefon) men **"Log ind eller opret profil for at fortsaette"**.

4. **Bekraeftelse frem for automatik.** Efter login FOERER tokenet til handlingen med en
   CTA ("Du scannede Michaels kode -> [Gem som kontakt]"), frem for at gemme/checke ind
   som skjult konsekvens af onboarding. Mere transparent, ét ekstra tryk der koeber
   tydelighed.

**Konsekvens for TD-001/TD-002:** De lukkes nu ved at **fjerne det anonyme opslag helt**,
ikke ved at bygge en token-baseret preview-RPC. `resolve_qr_token` kaldes udelukkende EFTER
login (authenticated kontekst — altid trygt). Angrebsfladen FORSVINDER frem for at bevogtes.

**Konsekvens for allerede-skrevet kode:** Migrationen `2026-07_adr010-teaser-token-binding.sql`
(get_profile_preview_by_token) bliver OVERFLOEDIG — der er intet anonymt preview at vise.
Laegges vaek. get_bubble_teaser's trim (fjern recent/members) er stadig relevant HVIS teaser
bruges efter login, men det anonyme foer-login-opslag udgaar.

**Produktprincip (skarpere formulering):** *Foer login bevarer Bubble brugerens intention,
men afsloerer ingen entity-data. Efter login resolver Bubble scanningen og lader brugeren
gennemfoere handlingen.*

**Restsikring (Release 2, uaendret):** Den gamle anon `get_profile_preview(p_user_id)` skal
stadig have anon-execute tilbagekaldt efter verificeret PWA-udrulning — ellers er den gamle
enumereringsvej aaben uanset det nye flow.
