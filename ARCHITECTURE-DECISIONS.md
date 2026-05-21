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

**Status:** DRAFT · BLOCKED on Q-050, Q-051, Q-054 verification
**Date:** 2026-05-18
**Migrated from:** Q-041 + Q-042

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

#### Decision (PENDING — currently DRAFT)

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

#### Blockers

This ADR cannot be FINALIZED until:

- **Q-050:** Active DB triggers in production verified
- **Q-051:** send-push payload schema documented
- **Q-054:** Push delivery logging existence verified

#### Related

- Open questions: Q-041 (VERIFIED), Q-042 (VERIFIED), Q-050/051/054 (PENDING)
- ARCHITECTURE-MAP.md sections: 17 (DM Send/Receive Flow), 19 (Push Notification Flow)
- ADR-005 (joinBubble contract) — template for Phase 3 contract refinement

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

