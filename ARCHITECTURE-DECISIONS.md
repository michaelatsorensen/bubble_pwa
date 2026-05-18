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
