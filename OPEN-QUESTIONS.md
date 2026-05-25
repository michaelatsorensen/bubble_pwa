# Bubble — Open Questions (Architecture Mapping)

> **Formål:** Reelle åbne spørgsmål Claude støder på under arkitektur-kortlægning. Michael løser parallelt mens Claude fortsætter analyse.
>
> **Format:** Hver spørgsmål får ID (Q-001, Q-002...) + TYPE + PRIORITY + STATUS tags.
>
> **Vigtigt:** Dette dokument indeholder KUN reelle spørgsmål og antagelser. Beslutninger lever i `ARCHITECTURE-DECISIONS.md`. Redesigns lever i `NATIVE-MIGRATION.md`.

## Governance konventioner

### TYPE — hvad er det her egentlig?

- **A — Question:** Reel usikkerhed. Ved svar bliver det fjernet eller flyttet til ADR/redesign.
- **B — Assumption:** Midlertidig arbejdshypotese. "Jeg tror det er X, men vil verificere."
- **C — Decision:** Allerede valgt arkitektonisk retning. **Skal migreres til ARCHITECTURE-DECISIONS.md.**
- **D — Redesign candidate:** Foreslået fremtidig ændring. **Skal migreres til NATIVE-MIGRATION.md.**

> **Disciplin:** Et åbent spørgsmål må ikke være forklædt som en beslutning. Hvis svaret er "ja, det gør vi" — så er det ikke et spørgsmål længere.

### PRIORITY — hvad er konsekvensen hvis vi tager fejl?

- **P0 — Critical:** Security, data loss, auth, compliance, irreversible migration risk
- **P1 — Native blocker:** Skal løses før Q1 2027 native rewrite. Backend contract eller observability.
- **P2 — Operational:** Cleanup, maintainability, behavior clarification
- **P3 — Nice-to-have:** Documentation quality, naming consistency, low-risk

### STATUS — hvor er vi i livscyklus?

- **OPEN** — Ubesvaret
- **VERIFIED** — Svar kendt fra kode/backend (klar til migration eller fjernelse)
- **ACCEPTED** — Decision truffet, flyttes til ADR
- **REJECTED** — Eksplicit afvist (bevares som læring)
- **DEFERRED** — Udskudt til senere fase (typisk native rewrite)
- **MIGRATED** — Flyttet til ADR/NATIVE-MIGRATION/TECH-DEBT, men reference beholdes her for sporbarhed

### Prioritets-oversigt (signal extraction)

**P0 — KRITISK (6 spørgsmål):** Q-014, Q-019, Q-023, Q-050, Q-051, Q-055
*Security, GDPR compliance, data integrity. Tag stilling først.*

**P1 — Native blockers (18 spørgsmål):** Q-011, Q-012, Q-020, Q-024, Q-026, Q-029, Q-032, Q-033, Q-040, Q-042, Q-045, Q-047, Q-052, Q-054, Q-057, Q-058, Q-060, Q-061
*Skal være afklarede inden native rewrite kan starte.*

**Type-fordeling:** A (52) · B (1) · C (4 → 0 efter migration) · D (5) = 61 totalt
**Status-fordeling:** OPEN (56) · MIGRATED (4 → ADR) · VERIFIED (1, Q-061) · andre (0)

> **Næste skridt:** Type C-spørgsmål (Q-024, Q-026, Q-032, Q-033) flyttes til ARCHITECTURE-DECISIONS.md når accepted. Type D-spørgsmål (Q-011, Q-013, Q-022, Q-029, Q-035) overvejes for migration til NATIVE-MIGRATION.md når moden nok.

---

## 🟢 BESVARET

*(Tom indtil Michael svarer på første spørgsmål)*

---

## 🔴 ÅBEN

> **Bemærk om in-section totals:** Hver section ender med en historisk markering ("Q-001 til Q-XXX = XX totalt") fra det tidspunkt sectionen blev tilføjet. Disse er bevidst bevaret som breadcrumbs. **Aktuel total: se header øverst (currently 61 spørgsmål).**

### Q-001: dbActions migration scope

**TYPE:** A · **PRIORITY:** P2 · **STATUS:** OPEN

**Kontekst:** dbActions write-lag bruges af 9 filer. b-admin.js, b-auth.js, b-onboarding.js, b-realtime.js, og b-messages.js bruger det IKKE.

**Spørgsmål:** Er dette intentionelt (admin-only, auth-flows har egne mønstre) eller er nogle af dem migrations-kandidater?

**Antagelse jeg fortsætter med:** Admin og auth har egne mønstre legitimt. Onboarding kunne migreres til dbActions. Realtime er publisher (skriver ikke direkte). Messages læser kun.

**Påvirkning hvis forkert:** Vi kan misse migration-arbejde der hører til P3 cleanup.

---

### Q-002: b-boot.js sidst i load-order

**TYPE:** A · **PRIORITY:** P3 · **STATUS:** OPEN

**Kontekst:** Script-load-rækkefølge: b-boot.js indlæses som sidste (efter b-navigation.js).

**Spørgsmål:** Er det fordi den orchestrerer alle moduler og skal have dem loaded først?

**Antagelse:** Ja, b-boot.js fungerer som "main()" der starter app efter alle moduler er klar. DOMContentLoaded triggers `loadHandler` der initialiserer auth-flow.

**Påvirkning:** Lav — verificering vil kun bekræfte mønsteret.

---

### Q-003: `currentBubble` global — er den dead code?

**TYPE:** B · **PRIORITY:** P2 · **STATUS:** OPEN

**Kontekst:** `currentBubble` er deklareret i b-config.js linje 188 som `let currentBubble = null`. Jeg kan ikke umiddelbart se hvor den **sættes** (i modsætning til `currentLiveBubble` som er aktiv).

**Spørgsmål:** Bruges `currentBubble` faktisk nogen steder? Eller er det legacy fra tidligere version hvor "current bubble context" var anderledes designet?

**Antagelse:** Det er muligvis dead code eller bruges sjældent. Kræver grep at bekræfte.

**Påvirkning:** Hvis dead code, mindre cleanup i native rewrite. Hvis aktiv, vigtigt at forstå hvorfor det er separat fra `currentLiveBubble`.

---

### Q-004: Lock-konvention

**TYPE:** A · **PRIORITY:** P3 · **STATUS:** OPEN

**Kontekst:** Mange `_xLock = true/false` pattern på tværs af kodebasen. Nogle bruger timeout (`_authLockTimer`), andre er "fire and forget".

**Spørgsmål:** Er der en samlet konvention der bør følges? Eller er det grown organisk?

**Antagelse:** Grown organisk. Hvert lock løste en specifik race-condition isoleret.

**Påvirkning for native:** Skal redesignes som eksplicit state machine eller mutex-pattern. Klassificeret som REDESIGN i ARCHITECTURE-LOG.

---

### Q-005: Chip-arrays naming convention

**TYPE:** A · **PRIORITY:** P3 · **STATUS:** OPEN

**Kontekst:** I b-config.js: `cbChips, epChips, epDynChips, ebChips, obChips, obDynChips`.

**Spørgsmål:** Bekræft at min antagelse er korrekt:
- cb = create bubble
- ep = edit profile
- ed/eb = edit bubble
- ob = onboarding
- "Dyn" = dynamiske keywords (vs static tags)

**Antagelse:** Ja — bekræftet via use-pattern i koden.

**Påvirkning:** Lav — kun for dokumentations-præcision.

---

### Q-006: `_cameFromLanding` semantik

**TYPE:** A · **PRIORITY:** P2 · **STATUS:** OPEN

**Kontekst:** I b-boot.js linje 16: `var _cameFromLanding = false; // Set true in load handler if ?auth=1 was present`

**Spørgsmål:** Hvad er den eksakte effekt af denne flag? Påvirker den auth-flow, redirect-destination, eller noget tredje?

**Antagelse:** Den styrer om brugeren returneres til landing-siden ved logout, eller direkte til auth-skærm. Skal verificeres ved at læse b-auth.js.

---

### Q-007: Test-account special handling

**TYPE:** A · **PRIORITY:** P2 · **STATUS:** OPEN

**Kontekst:** I b-admin.js linje 373: `var TEST_ACCOUNT_EMAIL = 'test@bubbleme.dk'`

**Spørgsmål:** Hvad gør test-accounts særligt? Bypass af nogle checks? Synlighed for admins?

**Antagelse:** Sandsynligvis bruges af `cleanup-test-user` edge function til at slette test-data. Måske også special case i UI for ikke at vise test-brugere i radar.

---

### Q-008: 117 direkte writes — systematisk inventering?

**TYPE:** A · **PRIORITY:** P1 · **STATUS:** PARTIALLY VERIFIED

> ✅ **Audit verified maj 2026.** Actual count: **212 direct writes** (not 117).
> Verified via grep across `*.js` for `sb.from().insert|update|delete|upsert`.
> 
> **Priority upgraded P2 → P1** — significantly larger scope than memory suggested.
> Native rewrite blocker until consolidated through dbActions or service layer.

**Kontekst:** Memory note 14 nævner "117 resterende writes kan migreres inkrementelt til dbActions". Disse er `sb.from(...).insert/update/delete()`-kald spredt over feature-filer.

**Spørgsmål:** Skal vi inventere de 117 writes systematisk i ARCHITECTURE-MAP, så vi har klar liste til migration? Eller er det P3-cleanup der ikke skal blokere arkitektur-mapping?

**Antagelse jeg fortsætter med:** Liste laves i fase 2 når jeg går per-fil dyb. Hver fil kataloges med "writes via dbActions" vs "direct writes" sektion.

**Påvirkning hvis forkert:** Hvis du vil have det hurtigere, kan jeg lave en grep-baseret rapport næste session.

---

### Q-009: Forskel mellem screen exit hooks og _navGlobalCleanup?

**TYPE:** A · **PRIORITY:** P2 · **STATUS:** OPEN

**Kontekst:** I b-navigation.js har jeg fundet:
- `_navGlobalCleanup()` (linje 219)
- `_navLeaveHome()`, `_navLeaveChat()`, `_navLeaveBubbleChat()`, `_navLeavePerson()` (specifikke screen-exit hooks)

**Spørgsmål:** Hvad er forskellen?

**Antagelse:** 
- `_navGlobalCleanup` kører på **alle** screen-changes (cleanup der er fælles for alle)
- `_navLeaveX` kører **kun** når X forlades specifikt (screen-specifik cleanup)
- Begge kaldes fra `goTo()` — global først, så screen-specifik

**Påvirkning:** Lav — hvis korrekt, dokumenteres mønsteret i fase 2.

---

### Q-010: `currentChatUser` ejerskab?

**TYPE:** A · **PRIORITY:** P2 · **STATUS:** OPEN

**Kontekst:** I b-config.js header siges "OWNS: currentChatUser, currentChatName" af **b-realtime.js**, men de er **deklareret** i b-config.js for load-order.

**Spørgsmål:** Bekræft at b-realtime.js skriver disse, ikke b-chat.js. Min analyse antyder at de **læses** i flere filer men **skrives** kun i b-realtime.js (`openChat()` linje 753).

**Antagelse:** b-realtime.js ejer dem. b-chat.js læser dem.

**Påvirkning:** For native rewrite: disse skal være del af "ChatService" eller "ConversationService" entity.

---

### Q-011: Native timeline — vælg A/B/C?

**TYPE:** D · **PRIORITY:** P1 · **STATUS:** OPEN

**Kontekst:** Ekstern research-rapport foreslår aggressiv tidsplan (native foundation start juni 2026). Vores STRATEGI.md har forsigtig plan (native foundation Q4 2026 efter pilot + verified bubbles + image-import).

**Tre muligheder:**
- **A)** Følg STRATEGI.md (pilot først, native efter feature-validering Q1 2027+)
- **B)** Følg rapportens accelererede plan (native foundation parallelt med pilot, juni 2026)
- **C)** Hybrid (kontrakter NU, pilot fortsætter, native foundation Q4 2026)

**Antagelse jeg fortsætter med:** C — kompromis mellem aggressivt og forsigtigt.

**Påvirkning:** STRUKTURELT VIGTIGT. Ændrer hele arbejdsgangen for resten af 2026.

---

### Q-012: Hvornår eksporteres backend-kontrakter?

**TYPE:** A · **PRIORITY:** P1 · **STATUS:** OPEN

**Kontekst:** Ekstern rapport identificerede at vi mangler:
- Schema dump
- RLS policies
- Triggers
- RPC-funktion-kildekode
- Edge function-kildekode i repo (ligger på Michaels PC)
- Storage bucket policies

**Spørgsmål:** Hvornår skal dette ske?

**Antagelse jeg fortsætter med:** Inden første native kode skrives. 2-4 timers arbejde for Michael.

**Påvirkning:** Hvis vi springer over, vil native rewrite have **infererede** backend-kontrakter — bugs i edge cases.

---

*Flere spørgsmål tilføjes løbende mens analysen fortsætter.*

---

## 🟡 IRRELEVANT (besvaret af kontekst)

*(Spørgsmål Claude finder svar på selv mens analysen fortsætter)*

---

*Vokser løbende. Tjek dette dokument før du svarer — sortér efter ID-nummer.*

---

## Session 2 — Entity Map (9. maj 2026)

### Q-013: Onboarding-status: heuristik → eksplicit enum?

**TYPE:** D · **PRIORITY:** P2 · **STATUS:** OPEN

**Kontekst:** Onboarding-status afgøres af `hasName && hasWorkplace && hasTerms` heuristik. Memory note nævner `onboarding_status` enum overvejes (`needs_terms`/`needs_name`/`needs_workplace`/`ready`).

**Spørgsmål:** Skal vi tilføje eksplicit `onboarding_status` kolonne nu, eller vente til native?

**Antagelse:** Vente til native — det er allerede dokumenteret som REDESIGN i ARCHITECTURE-LOG.

**Påvirkning:** Heuristik kan fejle ved race conditions (fx hvis terms_accepted_at sættes før name).

---

### Q-014: GDPR profile deletion — hvordan håndteres det?

**TYPE:** A · **PRIORITY:** P0 · **STATUS:** ✅ VERIFIED (maj 2026) — afslører blokering, kræver beslutning (→ Q-062)

**Kontekst:** Profile slettes ALDRIG ifølge entity-map analysen. Kun anonymisering. Men GDPR kræver "right to be forgotten".

**SVAR (verificeret mod production — FK delete_rules):**
- **CASCADE (rent):** bubble_members, messages (begge), profile_views (begge), saved_contacts (begge)
- **SET NULL (anonymiseres):** qr_scans (scanned_by, scanned_user)
- **NO ACTION (BLOKERER sletning):** bubble_messages, bubble_message_reactions, bubble_posts, bubbles.created_by, guest_checkins.claimed_by

**Kritisk konsekvens:** En bruger der har skrevet en boble-besked / lavet reaktion / opslag / oprettet en boble / claimet et guest-checkin kan **IKKE slettes** — Postgres afviser med FK-fejl. Rammer stort set alle aktive brugere. "Slet konto" vil fejle i praksis lige nu.

**Påvirkning:** GDPR compliance risiko + funktionel mur. Kræver bevidst sletteprocedure per indholdstype (anonymisér vs slet vs overdrag ejerskab). **Beslutningen tracket som Q-062.**

---

### Q-015: Bubble status enum — kun for live, eller udvid?

**TYPE:** A · **PRIORITY:** P2 · **STATUS:** OPEN

**Kontekst:** Nuværende kode har `status` på `bubbles` table KUN for live-bubbles. Andre states (ENDED, ARCHIVED) er infereret fra `event_end_date` osv.

**Spørgsmål:** Skal vi tilføje eksplicit `bubble_status` enum til alle bubbles?

**Antagelse:** Ja, for native. Det vil forenkle state-check logic dramatisk.

**Påvirkning:** Migration arbejde + opdatering af alle queries.

---

### Q-016: Live bubble expiration mekanisme?

**TYPE:** A · **PRIORITY:** P2 · **STATUS:** OPEN

**Kontekst:** Live bubbles har `expires_at` (6 timer fra start). Hvordan håndhæves dette?

**Spørgsmål:**
- Background job/cron der sætter status='expired'?
- DB trigger på timestamp?
- Eller bare client-side check?

**Antagelse:** Sandsynligvis client-side check. Skal verificeres ved at læse `b-live.js` grundigere i Session 3.

**Påvirkning:** Hvis client-side, kan en bubble forblive "active" hvis ingen tjekker.

---

### Q-017: parent_bubble_id hierarki — max dybde?

**TYPE:** A · **PRIORITY:** P2 · **STATUS:** OPEN

**Kontekst:** Bubbles kan have `parent_bubble_id` (hierarkisk). I `createBubble` arves icon fra parent eller grandparent (2 niveauer dybt).

**Spørgsmål:** Er der explicit eller implicit max-dybde? Eller kan det blive 10 niveauer dybt?

**Antagelse:** Ingen explicit max. Implicit 2 niveauer i icon-inheritance, men bubbles selv kan nest dybere.

**Påvirkning:** Performance i discover/list views hvis hierarki bliver dybt.

---

### Q-018: Member admin i én bubble, member i en anden?

**TYPE:** A · **PRIORITY:** P2 · **STATUS:** OPEN

**Kontekst:** `role` (admin/member) er per-bubble, så teoretisk ja.

**Spørgsmål:** Bekræft at dette er korrekt og intentionalt.

**Antagelse:** Ja, korrekt. Role er per-membership ikke per-user.

**Påvirkning:** Lav — kun for dokumentations-præcision.

---

### Q-019: User deletion → memberships hvad?

**TYPE:** A · **PRIORITY:** P0 · **STATUS:** ✅ VERIFIED (maj 2026)

**Kontekst:** Hvis en bruger slettes (auth.users), hvad sker med deres bubble_members rows?

**Spørgsmål:** CASCADE delete? Anonymize?

**SVAR (verificeret mod production):** CASCADE. `bubble_members.user_id → profiles` = CASCADE, og `bubble_members.bubble_id → bubbles` = CASCADE. Medlemskaber forsvinder rent ved bruger- ELLER boble-sletning. Antagelsen var korrekt. **Blokerer ikke sletning.**

**Påvirkning:** Ingen — rent. Del af Q-014's samlede billede.

---

### Q-020: Inviter deletion → invitations hvad?

**TYPE:** A · **PRIORITY:** P1 · **STATUS:** OPEN

**Kontekst:** Hvis user_a inviterer user_b, og user_a slettes — hvad sker med invitationen?

**Spørgsmål:** Bevares invitation med null from_user_id? Eller CASCADE delete?

**Antagelse:** Sandsynligvis CASCADE — invitations er ikke kritisk historiske.

**Påvirkning:** Lav.

---

### Q-021: Invitation expiration?

**TYPE:** A · **PRIORITY:** P2 · **STATUS:** OPEN

**Kontekst:** Invitations har ingen automatisk expiration. En invitation fra 2024 kan stadig være pending i 2026.

**Spørgsmål:** Skal vi implementere expiration (fx 30 dage)?

**Antagelse:** Bør implementeres for native. Pilot kan klare sig uden.

**Påvirkning:** UI cleanup + bedre brugeroplevelse.

---

### Q-022: Eksplicit Conversation entity for DMs?

**TYPE:** D · **PRIORITY:** P2 · **STATUS:** OPEN

**Kontekst:** DMs er bare messages mellem to brugere. Der er ingen "Conversation" entity. Conversations er computed fra messages.

**Spørgsmål:** Skal vi tilføje eksplicit Conversation entity i native med metadata (last_message_at, total_messages, deleted_for_user_a/b, muted)?

**Antagelse:** Ja, vil gøre DM-listen meget mere effektiv (én row per conversation vs aggregering på hver query).

**Påvirkning:** Datamodel-ændring for native. PWA fortsætter computed approach.

---

### Q-023: User deletion → DMs hvad?

**TYPE:** A · **PRIORITY:** P0 · **STATUS:** ✅ VERIFIED (maj 2026)

**Kontekst:** Hvis user slettes, hvad sker med deres DMs?

**Spørgsmål:** Soft-anonymize (sender_id → null, content bevares)? Eller delete?

**SVAR (verificeret mod production):** DELETE (CASCADE). Både `messages.sender_id` og `messages.receiver_id → profiles` = CASCADE. DM'er slettes helt ved bruger-sletning — IKKE anonymiseret. **Konsekvens at være opmærksom på:** hvis A sletter sin konto, forsvinder hele DM-tråden også for B (begge sider af samtalen). Det er rent GDPR-mæssigt, men B mister samtalehistorik. Bevidst at acceptere eller revurdere. **Blokerer ikke sletning.**

**Påvirkning:** Linker til Q-014. Rent cascade, men UX-konsekvens for modtager.

---

### Q-024: bcReduceMsg pattern som arkitektur-invariant?

**TYPE:** C · **PRIORITY:** P1 · **STATUS:** MIGRATED → ADR-004

> 🔄 **Migrated to ARCHITECTURE-DECISIONS.md as ADR-004: Reducer pattern as architectural invariant**
> Status there: PROPOSED. Pending Michael acceptance for final commit.

**Kontekst:** `bcReduceMsg` i b-chat.js centraliserer alle bubble message inserts fra 4 forskellige paths. Det er en GOD PATTERN.

**Spørgsmål:** Skal vi dokumentere det eksplicit som "single-reducer invariant" i ARCHITECTURE-LOG?

**Antagelse:** Ja. Det er allerede note 5.1.5, men kan forstærkes.

**Påvirkning:** Native skal bevare patternet.

---

### Q-025: Live bubble expiration mekanisme (detail)?

**TYPE:** A · **PRIORITY:** P2 · **STATUS:** OPEN

**Kontekst:** Samme som Q-016 men mere specifik.

**Spørgsmål:** Hvordan virker `expires_at` håndhævelsen i praksis? Skal vi læse hele b-live.js for at finde ud af det?

**Antagelse:** Vil blive tydeligere i Session 5-7 når vi katalogerer b-live.js.

**Påvirkning:** Defer til senere session.

---

### Q-026: Server-authoritative presence — bekræft som princip?

**TYPE:** C · **PRIORITY:** P1 · **STATUS:** MIGRATED → ADR-001

> 🔄 **Migrated to ARCHITECTURE-DECISIONS.md as ADR-001: Server-authoritative presence**
> Status there: PROPOSED. Pending Michael acceptance for final commit.

**Kontekst:** Live session state har 3 sources of truth (frontend appMode, DB column, edge function logic). Native bør konsolidere til server-authoritative.

**Spørgsmål:** Bekræft at server-authoritative er det rigtige princip for native?

**Antagelse:** Ja. Frontend læser via realtime, skriver via edge function only.

**Påvirkning:** Påvirker hele live/presence-arkitektur i native.

---

### Q-027: Rating storage — localStorage OR DB?

**TYPE:** A · **PRIORITY:** P2 · **STATUS:** OPEN

**Kontekst:** Memory note siger ratings i `bubble_stars` localStorage. Schema har også `rating` kolonne på `saved_contacts`.

**Spørgsmål:** Hvilken er autoritativ? Skal de synces? Eller bruges kun den ene?

**Antagelse:** Sandsynligvis localStorage er reelt brugt og DB-feltet er forberedt men ikke aktiveret.

**Påvirkning:** Native skal vælge én source of truth fra start. localStorage er **anti-pattern** (forsvinder ved logout, ingen sync mellem devices).

---

*Q-001 til Q-027 = 27 spørgsmål efter Session 2. Section 3+ tilføjede flere — se header øverst for nuværende total.*

---

## Session 3 — System Boundaries (15. maj 2026)

### Q-028: `signOut` spredt over 3 filer — konsolider?

**TYPE:** A · **PRIORITY:** P2 · **STATUS:** OPEN

**Kontekst:** `sb.auth.signOut()` kaldes fra b-auth.js, b-admin.js, OG b-onboarding.js. Det er anti-pattern — én entity (auth state) burde kontrolleres ét sted.

**Spørgsmål:** Skal vi nu (pre-native) konsolidere signOut til kun b-auth.js? Eller vente til native AuthService?

**Antagelse:** Vente til native. Risikabelt at refaktorere auth nu under pilot.

**Påvirkning:** Native AuthService SKAL være eneste sted der kalder signOut.

---

### Q-029: Identity state machine — eksplicit i native?

**TYPE:** D · **PRIORITY:** P1 · **STATUS:** OPEN

**Kontekst:** Identity har implicit state machine: UNAUTHENTICATED → AUTHENTICATING → PROVISIONAL → ONBOARDED (eller BANNED). Det er spredt over flere booleans og heuristikker.

**Spørgsmål:** I native, skal vi bruge TypeScript discriminated union til at gøre state machine eksplicit?

```typescript
type AuthState = 
  | { status: 'unauthenticated' }
  | { status: 'authenticating' }
  | { status: 'provisional', userId: string }
  | { status: 'onboarded', userId: string, profile: Profile }
  | { status: 'banned', userId: string };
```

**Antagelse:** Ja, eksplicit state machine i native. Eliminerer race conditions.

**Påvirkning:** Linker til Q-013 (onboarding_status enum).

---

### Q-030: `reports` table — Platform eller eget system?

**TYPE:** A · **PRIORITY:** P2 · **STATUS:** OPEN

**Kontekst:** User reports (rapportering af upassende indhold) er pt. spredt mellem b-utils.js (dbActions.reportUser) og b-admin.js (admin håndtering). Det er en moderation-funktion.

**Spørgsmål:** Hører `reports` under Platform System (som tværgående moderation) eller bør den have eget "Moderation System"?

**Antagelse:** Platform System har "ModerationService" sub-domæne. Reports er for små til eget system.

**Påvirkning:** Folder structure i native.

---

### Q-031: bubble_message_edits + bubble_post_reactions — separate entities?

**TYPE:** A · **PRIORITY:** P2 · **STATUS:** OPEN

**Kontekst:** Disse er nævnt som relaterede entities (Entity 6: BubbleMessage). De er separate tabeller men hænger sammen med BubbleMessage.

**Spørgsmål:** I native, skal de være:
- A) Separate services (EditHistoryService, ReactionService)
- B) Sub-features af BubbleChatService
- C) Værdier embedded i BubbleMessage type

**Antagelse:** B — BubbleChatService har metoder for begge, men de er ikke separate top-level services.

**Påvirkning:** Service-design granularitet.

---

### Q-032: Cross-system writes via services only — invariant?

**TYPE:** C · **PRIORITY:** P1 · **STATUS:** MIGRATED → ADR-002

> 🔄 **Migrated to ARCHITECTURE-DECISIONS.md as ADR-002: Cross-system writes via services only**
> Status there: PROPOSED. Pending Michael acceptance for final commit.

**Kontekst:** I architecture map sektion 15 har jeg dokumenteret at cross-system writes skal gå gennem services (fx Messaging skriver IKKE direkte til bubble_members, men kalder MembershipService.markAsRead()).

**Spørgsmål:** Bekræft dette som arkitektur-invariant for native?

**Antagelse:** Ja, klart. Ellers er service-boundaries meningsløse.

**Påvirkning:** Skal cementeres i ARCHITECTURE-LOG som GENBRUGES pattern (når implementeret i native).

---

### Q-033: Platform har INGEN dependency på domain systems — confirm?

**TYPE:** C · **PRIORITY:** P1 · **STATUS:** MIGRATED → ADR-003

> 🔄 **Migrated to ARCHITECTURE-DECISIONS.md as ADR-003: Platform has no domain dependencies**
> Status there: PROPOSED. Pending Michael acceptance for final commit.

**Kontekst:** Jeg har argumenteret at Platform er foundation — alle andre systems afhænger af det, men det skal IKKE selv kende til business logic.

**Spørgsmål:** Bekræft at dette er korrekt princip?

**Eksempel:** Skal Platform.PushService have indbygget viden om "send push når ny bubble-besked"? Eller skal Messaging trigger PushService med en generic payload?

**Antagelse:** Sidstnævnte — Platform er agnostic, domain systems triggerr.

**Påvirkning:** Hele dependency-graph for native arkitektur.

---

### Q-034: Sub-systems within Platform — egne mapper?

**TYPE:** A · **PRIORITY:** P2 · **STATUS:** OPEN

**Kontekst:** Platform har 7 sub-domæner (P.1 Realtime, P.2 Push, P.3 Navigation, P.4 Errors, P.5 i18n, P.6 Storage, P.7 Analytics).

**Spørgsmål:** I native, hver sub-domæne som egen mappe i `src/platform/`? Eller én flad fil per service?

**Antagelse:** Egen mappe per sub-domæne. Klar adskillelse.

**Påvirkning:** Folder structure detail.

---

### Q-035: Native folder structure proposal — passer din intuition?

**TYPE:** D · **PRIORITY:** P2 · **STATUS:** OPEN

**Kontekst:** Sektion 15.10 foreslår denne struktur:

```
src/
├── systems/
│   ├── identity/
│   ├── social-graph/
│   ├── messaging/
│   └── presence/
├── platform/
│   ├── supabase/
│   ├── push/
│   ├── navigation/
│   ├── i18n/
│   ├── error-handling/
│   ├── analytics/
│   └── ui/
├── screens/
└── components/
```

**Spørgsmål:** Passer det din intuition om hvordan Bubble bør organiseres? Mangler der noget? Er noget unødigt?

**Antagelse:** Det er starting point. Vi justerer baseret på pilot-data.

**Påvirkning:** Hele native projekt-organisering.

---

*Q-001 til Q-035 = 35 åbne spørgsmål totalt.*

---

## Session 4 — Critical Flows (16. maj 2026)

### Q-036: 6 entry points for bubble join — consolidate?

**TYPE:** A · **PRIORITY:** P2 · **STATUS:** OPEN

**Kontekst:** Bubble Join Flow har 6 forskellige entry points (UI button, ?join=, ?event=, QR scan, invitation, deep-link unauthenticated).

**Spørgsmål:** Kan vi konsolidere til 3 (direct, deep-link, QR)? Event-flow vs join-flow distinction kan være unødig kompleksitet.

**Antagelse:** Pilot-data afgør. Indtil da: bevar nuværende.

---

### Q-037: data-action delegated pattern vs inline onclick

**TYPE:** A · **PRIORITY:** P3 · **STATUS:** OPEN

**Kontekst:** b-chat.js linje 627 bruger `data-action="requestJoin"` delegated event handler. b-bubbles.js linje 2291 bruger inline `onclick="requestJoin(...)"`.

**Spørgsmål:** Standardiser på data-action pattern for alle dynamisk-genererede buttons?

**Antagelse:** Ja. Mere refactor-venligt. Native bruger React props alligevel.

---

### Q-038: checkQRJoin legacy code — fjern i næste prod release?

**TYPE:** A · **PRIORITY:** P3 · **STATUS:** OPEN

**Kontekst:** Memory note: "Legacy checkQRJoin() i b-bubbles.js er deprecated siden v8.17.22".

**Spørgsmål:** Kan vi fjerne det? Eller bevarer det som safety net?

**Antagelse:** Fjern når vi har 2-3 ugers stabilitet uden bugs.

---

### Q-039: event_flow branch i checkPendingJoin

**TYPE:** A · **PRIORITY:** P2 · **STATUS:** OPEN

**Kontekst:** checkPendingJoin har en separat event_flow branch der "peeker" på bubble før join.

**Spørgsmål:** Er separation virkelig nødvendig? Kunne unified flow med discriminator-felt.

**Antagelse:** Kan unified i native med eksplicit `JoinIntent.type`.

---

### Q-040: Push double-firing på bubble join

**TYPE:** A · **PRIORITY:** P1 · **STATUS:** OPEN

**Kontekst:** Push fyrer fra BÅDE frontend sendPush AND DB trigger.

**Spørgsmål:** Fix før native eller efter?

**Antagelse:** Efter. Det er ikke broken — bare ineffektivt. Native skal være server-only.

---

### Q-041: sendMessage direct DB write vs dbActions.sendDM

**TYPE:** A · **PRIORITY:** P1 · **STATUS:** VERIFIED → ADR-006 (DRAFT, BLOCKED)

> ✅ **Audit verified maj 2026.** Antagelsen bekræftet: 3 DM-send paths bypasser `dbActions.sendDM`:
> - `sendMessage()` (b-messages.js:200) — chat input, direct DB insert
> - `sendDirectMessage()` (b-messages.js:283) — programmatic, direct DB insert
> - `dmHandleFile()` (b-messages.js:303) — file uploads, direct DB insert
>
> Kun `b-chat.js:110` (GIF picker) bruger den centraliserede `dbActions.sendDM`.
>
> **Konsolidering blokeret** på Q-050, Q-051, Q-054 (push strategi beslutning).
> Se ADR-006 (DRAFT) for full plan.
>
> **Priority opgraderet fra P2 til P1** — det er en native blocker, ikke kosmetisk cleanup.

---

### Q-042: Push double-firing på DM send

**TYPE:** A · **PRIORITY:** P1 · **STATUS:** VERIFIED → ADR-006 (DRAFT, BLOCKED)

> ✅ **Audit verified maj 2026.** Double-fire problem kvantificeret:
> - Frontend sendPush calls: 4 (b-messages.js:276, :291, :349 + b-utils.js:906)
> - DB trigger: `on_new_message_push` fyrer på alle messages INSERT
> - **Resultat:** 2 pushes for hver DM (1 frontend + 1 trigger)
>
> **Beslutning blokeret** på push-strategi-valg (Option A: trigger only / Option B: frontend only / Option C: both with dedup).
> Push-strategi beslutning kræver Q-050, Q-051, Q-054 verifikation først.

**Kontekst:** Samme problem som Q-040 men for DMs.

**Spørgsmål:** Fix før native?

**Antagelse:** Efter. Native skal være server-only.

---

### Q-043: _dmLastSent dedup window — configurable?

**TYPE:** A · **PRIORITY:** P3 · **STATUS:** OPEN

**Kontekst:** Hardcoded 3 sekunder. Native kunne have config per environment.

**Spørgsmål:** Skal det være justerbart?

**Antagelse:** Ja i native, men 3s er nok god default.

---

### Q-044: Broadcast vs CDC ordering

**TYPE:** A · **PRIORITY:** P2 · **STATUS:** OPEN

**Kontekst:** Broadcast arriver typisk før CDC. dmReduceMsg dedup handles det.

**Spørgsmål:** Skal native møde anderledes? Eller bevar dedup-pattern?

**Antagelse:** Bevar dedup-pattern. Det er robust.

---

### Q-045: Edge function `checkin` source i repo?

**TYPE:** A · **PRIORITY:** P1 · **STATUS:** OPEN

**Kontekst:** Source er på Michaels PC, IKKE i repo. Det er kritisk logik vi ikke kontrollerer i version control.

**Spørgsmål:** Hvornår skal vi committe edge function source?

**Antagelse:** Sammen med Q-012 backend-kontrakter eksport.

---

### Q-046: currentLiveBubble legacy compat object

**TYPE:** A · **PRIORITY:** P3 · **STATUS:** OPEN

**Kontekst:** appMode.live er nyt single-source-of-truth, men currentLiveBubble eksisterer parallelt for legacy compat.

**Spørgsmål:** Kan currentLiveBubble fjernes nu? Eller venter vi til native?

**Antagelse:** Vent til native. Risikabelt at fjerne globally-used global.

---

### Q-047: All edge function source i version control?

**TYPE:** A · **PRIORITY:** P1 · **STATUS:** OPEN

**Kontekst:** Generalisering af Q-045. Vi har 3 edge functions: send-push, checkin, cleanup-test-user/reset-test-user. Hvor mange er i repo?

**Antagelse:** Sandsynligvis ingen. Skal alle committes.

---

### Q-048: Bubble expiration mechanism (revisit Q-016)

**TYPE:** A · **PRIORITY:** P2 · **STATUS:** OPEN

**Kontekst:** Live bubbles har `expires_at` (6 timer). Edge function checkin bør validere `bubble.status=active` — men hvordan håndhæves status update?

**Spørgsmål:** Background job? Pg_cron? Frontend-only?

**Antagelse:** Sandsynligvis pg_cron eller frontend-check ved hver checkin. Verificer ved at læse edge function source.

---

### Q-049: Client-side checkin fallback — fjern i PWA cleanup?

**TYPE:** A · **PRIORITY:** P2 · **STATUS:** OPEN

**Kontekst:** _liveCheckinFallback() er ikke atomic — 3 separate DB calls. Race conditions possible.

**Spørgsmål:** Skal vi fjerne fallback nu, eller bevare til native?

**Antagelse:** Bevar. Edge function har høj uptime, men fallback er safety net for udkanter af reach.

---

*Q-001 til Q-049 = 49 åbne spørgsmål totalt.*

---

## Section 19: Push Notification Flow (Session 4 batch 2)

### Q-050: Which DB triggers are currently active in Supabase production?

**TYPE:** A · **PRIORITY:** P0 · **STATUS:** OPEN

**Kontekst:** Memory dokumenterer 4 trigger-navne (`on_new_message_push`, `on_bubble_invite_push`, `on_new_invite_push`, `on_contact_saved_push`), men deres faktiske status i produktion er ikke verificeret i denne mapping-session.

**Spørgsmål:** Kør `SELECT tgname, tgrelid::regclass FROM pg_trigger WHERE tgname LIKE '%push%';` i Supabase SQL editor og dokumentér resultatet.

**Antagelse:** Alle 4 er aktive. Hvis ikke, scope for arkitekturændring reduceres.

**Blokerer:** Q-051, Q-052, Q-055. Vault migration kan ikke starte før vi ved hvilke trigger-bodies vi skal redigere.

---

### Q-051: What payload schema does send-push/index.ts expect?

**TYPE:** A · **PRIORITY:** P0 · **STATUS:** OPEN

**Kontekst:** Memory dokumenterer "body format mismatch" og at 2 funktioner sender `recipient_id` mens edge function forventer `user_id`. Eksakt mismatch ikke retraceret.

**Spørgsmål:** Åbn `C:\Users\freef\bubble-edge\supabase\functions\send-push\index.ts` og dokumentér:
1. Hvilke felter destructeres fra request body
2. Hvor `user_id` vs `recipient_id` bruges
3. Hvilke titel/body-formater accepteres

**Antagelse:** Edge function forventer `{ user_id, title, body }`. To triggers sender `{ recipient_id, title, body }` → silent failure.

**Blokerer:** Q-052 og fix af failure mode #1.

---

### Q-052: Are recipient_id and user_id intentionally different concepts?

**TYPE:** A · **PRIORITY:** P1 · **STATUS:** OPEN

**Kontekst:** Det er **muligt** at distinktionen var intentional på et tidspunkt:
- `user_id` = den der **udførte** handlingen (afsender af DM, opretter af bubble)
- `recipient_id` = den der skal **modtage** notification

Hvis ja, er fix at omdøbe edge function parameter til `recipient_id` overalt.

**Spørgsmål:** Gennemgå trigger-funktionernes SQL-bodies og afgør om naming reflekterer en bevidst skelnen, eller blot er drift mellem to udviklere/tidspunkter.

**Antagelse:** Det er drift. Standardisér på `recipient_id` (det er det mere præcise navn — den der modtager pushen er ikke nødvendigvis identisk med `user_id` i triggerens kontekst).

**Blokerer:** Beslutning om naming convention før refactor.

---

### Q-053: Is b-utils.js sendPush() still reachable?

**TYPE:** A · **PRIORITY:** P2 · **STATUS:** OPEN

**Kontekst:** Memory: "sendPush() i b-utils.js eksisterer i parallel — sandsynligvis dead code for trigger-covered types". Hvis dead, kan vi fjerne den; hvis ikke, kræver migration.

**Spørgsmål:** Søg i kodebasen:
```bash
grep -rn "sendPush" --include="*.js" --include="*.html"
```
Dokumentér alle call sites og afgør om hver enkelt er dækket af en trigger.

**Antagelse:** Dead code. Fjernelse kan ske sammen med Vault-migration.

**Blokerer:** Cleanup af parallel dispatch path (failure mode #4).

---

### Q-054: Are push deliveries logged anywhere?

**TYPE:** A · **PRIORITY:** P1 · **STATUS:** OPEN

**Kontekst:** Memory: ingen specifik mention af `push_delivery_log` eller lignende tabel. pg_net.http_post er fire-and-forget. Edge function kan logge til console, men det er flygtigt.

**Spørgsmål:** Tjek:
1. Findes en tabel som `push_delivery_log`, `notification_log`, eller lignende?
2. Logger edge function til Supabase logs (kan ses i dashboard)?
3. Findes nogen client-side push ack-mekanisme?

**Antagelse:** Ingen persistent logging. Det er en stor del af "silent failure"-problemet.

**Blokerer:** Phase 2 i arkitektur-redesign (Section 19.6).

---

### Q-055: Which secrets remain hardcoded outside vault.secrets?

**TYPE:** A · **PRIORITY:** P0 · **STATUS:** OPEN

**Kontekst:** Memory: "migrate all 4 trigger functions' hardcoded secrets to Vault (supabase_vault 0.3.1 activated, empty)". Enumeration ikke gjort.

**Spørgsmål:** For hver af de 4 trigger-funktioner:
1. Hvilke secrets er hardcoded i SQL-body?
2. Typisk: Edge function authorization header (anon key eller service role key?)
3. URL til edge function (mindre kritisk men bør være konfigurérbar)

```sql
SELECT proname, prosrc FROM pg_proc 
WHERE proname IN (
  'send_message_push', 'send_invite_push', 
  'send_new_invite_push', 'send_contact_push'
);
```
(Erstat med faktiske navne fra Q-050.)

**Antagelse:** Service role key er hardcoded. Skal i vault.

**Blokerer:** Phase 1 i arkitektur-redesign (Vault migration).

---

*Q-001 til Q-055 = 55 åbne spørgsmål totalt. 6 nye fra Section 19.*

---

## Section 20: Deep-link Auth Flow (Session 4 batch 2 part 2)

### Q-056: What is the complete flow-flag inventory?

**TYPE:** A · **PRIORITY:** P2 · **STATUS:** OPEN

**Kontekst:** Memory mentions `_cameFromLanding`, `shouldBypassLanding`. Også `consumeFlow()` atomic pattern, `flowClearAll()` med 15min TTL. Men fuld liste af alle flow-flags ikke enumeret.

**Spørgsmål:** Søg i kodebasen:
```bash
grep -rn "sessionStorage\." --include="*.js" --include="*.html" | grep -i "flow\|landing\|deep\|auth"
```
Dokumentér hver flow-flag: navn, hvor den sættes, hvor den læses, hvor den ryddes.

**Antagelse:** ~5-8 flow-flags totalt. Hver har klart ejerskab.

**Påvirkning:** Foundation for evt. redesign til explicit state machine (Section 20.6).

---

### Q-057: What happens if deep-link arrives mid-signup?

**TYPE:** A · **PRIORITY:** P1 · **STATUS:** OPEN

**Kontekst:** Scenario: bruger klikker deep-link → ikke logget ind → starter signup → email confirmation → klikker confirm-link → app åbner igen. Bevares deep-link intent gennem email confirmation?

**Spørgsmål:** Test flowet manuelt:
1. Klik en `?event=<uuid>` link uden at være logget ind
2. Gennemfør signup → modtag confirmation email
3. Klik confirmation link i email
4. Verificér: åbner app'en stadig event-modalen? Eller lander brugeren på default home?

**Antagelse:** sessionStorage persisterer hvis samme browser-tab. Hvis ny tab åbnes fra email-klient, mistes intent.

**Påvirkning:** Hvis intent mistes → konvertering droppes på P1-niveau. Fix kræver server-side `pending_invites` table eller email-confirmation link med embedded intent.

---

### Q-058: How does flow handle logged-in-as-different-account?

**TYPE:** A · **PRIORITY:** P1 · **STATUS:** OPEN

**Kontekst:** Bruger A er logget ind. Modtager deep-link (fx i email) sendt til bruger B. Klikker linket. Hvad sker der?

**Spørgsmål:** Test flowet:
1. Log ind som bruger A
2. Send selv et invite-link til en anden email
3. Åbn linket i samme browser (stadig logget ind som A)
4. Verificér: prompts app'en for konto-skift? Eller fortsætter den som A?

**Antagelse:** Ingen eksplicit konto-skift prompt. Joinen sker som nuværende bruger (A) — hvilket er korrekt for "forwarded invite"-scenario men forvirrende for "wrong account"-scenario.

**Påvirkning:** UX decision, ikke kun teknisk. Native rewrite skal afgøre policy: prompt vs auto-accept.

---

### Q-059: Is `_authLock` 30s sufficient on slow mobile networks?

**TYPE:** A · **PRIORITY:** P2 · **STATUS:** OPEN

**Kontekst:** v8.17.15 introducerede 30s timeout på `_authLock` for at undgå dead-locks. Mobile pilot-brugere kan have langsomme netværk (Sønderborg landområder).

**Spørgsmål:** Tjek timeout-implementation i koden. Findes der observability for timeout-events? (fx error_log INSERT når timeout udløses?)

**Antagelse:** 30s er sufficient på 4G+. Kan være tight på 3G. Logging er sandsynligvis ikke implementeret.

**Påvirkning:** Hvis timeout fejler silently på slow networks → bruger sidder fast i auth-lock → P1-eskalering.

---

### Q-060: What is exact race condition between setupAuthListener and deep-link processor?

**TYPE:** A · **PRIORITY:** P1 · **STATUS:** OPEN

**Kontekst:** v8.17.19-20 fixede én variant af redirect-loop (sessionStorage persist + `shouldBypassLanding` guard). Men er andre race conditions stadig possible?

Hypotetiske scenarier:
- Auth listener fires FØR sessionStorage er læst → flag overskrives
- Deep-link processor fires TO gange (e.g. visibility change events)
- Multiple tabs med samme deep-link → conflict

**Spørgsmål:** Manual test med Chrome DevTools throttling (Slow 3G) + verbose logging af auth listener / deep-link processor invocations. Find om der er edge cases der reproducerer redirect-loop eller modal-double-open.

**Antagelse:** Nuværende implementation er stabil i 95% af tilfælde. Resterende 5% kræver explicit state machine (Section 20.6).

**Påvirkning:** Foundation for redesign-beslutning.

---

### Q-061: Should `joinBubble()` return semantics be tightened?

**TYPE:** A · **PRIORITY:** P1 · **STATUS:** VERIFIED → ADR-005 (ACCEPTED)

> ✅ **Resolved in v8.17.29, refined in v8.17.30.**
> Discriminated union contract enforced with two-level taxonomy (status + reason).
> Audit found 4 of 8 callers handled `duplicate` flag incorrectly.
> See ARCHITECTURE-DECISIONS.md ADR-005 for final contract spec.
> See ARCHITECTURE-LOG.md LÆRING "Kontraktproblem, ikke caller-problem" for generalized principle.

**Kontekst:** Listed som pre-pilot priority i memory:

> Pending fix: tighten `joinBubble()` return semantics (`joined_now`/`already_member`/`failed`) + event-flow success handling

Nuværende implementation returnerer formentlig boolean eller throws — inkonsistent håndtering af "already member"-tilfælde.

**Spørgsmål:** Læs `dbActions.joinBubble()` i `b-utils.js`:
1. Hvad returnerer den nu?
2. Hvor er den kaldt fra?
3. Håndterer hver call site distinktionen mellem "joined_now" og "already_member"?

**Antagelse:** Inkonsistent. Pre-pilot stramning skal definere kontrakt:
```typescript
type JoinBubbleResult = 
  | { ok: true; status: 'joined_now'; member_id: UUID }
  | { ok: true; status: 'already_member'; member_id: UUID }
  | { ok: false; status: 'failed'; reason: string };
```

**Påvirkning:** Pre-pilot blocker. Event-flow success handling skal vise korrekt feedback til bruger (toast vs. silent vs. error).

---

### Q-062: GDPR-sletteprocedure for NO ACTION-relationer

**TYPE:** A · **PRIORITY:** P0 · **STATUS:** OPEN (følger af Q-014 verifikation)

**Kontekst:** Q-014 afslørede at 5 FK-relationer har `NO ACTION` delete_rule, så bruger-sletning **fejler** i Postgres hvis brugeren har skabt indhold. Rammer stort set alle aktive brugere. "Slet konto" virker ikke i praksis lige nu.

**De 5 blokerende relationer + produktspørgsmål per type:**
| Tabel.kolonne | Indhold | Beslutning der skal træffes |
|---|---|---|
| `bubble_messages.user_id` | Boble-chatbeskeder | Anonymisér ("Slettet bruger") eller slet? |
| `bubble_message_reactions.user_id` | Reaktioner | Slet (lavværdi, ingen historik-tab) |
| `bubble_posts.author_id` | Boble-opslag | Anonymisér eller slet? |
| `bubbles.created_by` | **Oprettede bobler** | Sværest: overdrag ejerskab, eller slet boble + alle medlemmer? |
| `guest_checkins.claimed_by` | Claimede guest-checkins | Anonymisér (SET NULL) sandsynligvis nok |

**Spørgsmål:** Hvad er den bevidste sletteprocedure per indholdstype? Det er IKKE "ret cascade på alt" — fx vil man sandsynligvis ikke slette en hel boble med medlemmer bare fordi opretteren forlader. Det er samme dilemma som ethvert socialt produkt: hvad sker der med indhold en slettet bruger har skabt?

**Mulige mønstre:**
- **Anonymisér** (behold indhold, erstat identitet med "Slettet bruger") — bevarer samtale-/boble-integritet, opfylder GDPR hvis user_id nulstilles
- **Slet** (fjern indhold) — renere GDPR, men efterlader huller i samtaler
- **Overdrag** (kun bobler — overfør created_by til en anden admin) — bevarer boblen

**Antagelse:** Sandsynligvis blanding: reactions+checkins → slet/null, boble-beskeder+opslag → anonymisér, bobler → overdrag eller behold med system-ejerskab. Kræver bevidst beslutning + en delete-procedure (Postgres-funktion der håndterer rækkefølgen før profil-sletning).

**Påvirkning:** P0 — GDPR compliance + funktionel mur (sletning fejler nu). Pre-pilot: brugere VIL anmode om sletning. Ikke native-blokerende (samme backend uanset klient), men skal løses før eller tidligt i pilot. Når besluttet → migreres til ADR.

---

### Q-063: Skal bubble-privacy være backend-sandhed eller UI-konvention?

**TYPE:** A · **PRIORITY:** P1 (native blocker) · **STATUS:** OPEN (rejst af ekstern review maj 2026)

**Kontekst:** Privacy for private/hidden bubbles håndhæves **client-side**, ikke i RLS. Backend Contract Smoke Test bekræfter: en direkte `INSERT` i `bubble_members` for en private/hidden bubble **lykkes** — RLS blokerer ikke (kun `auth.uid() = user_id`). joinBubble-source-param bypasser privacy-gaten bevidst for QR/invite.

**Spørgsmål:** Skal privacy forblive en UI-konvention (client-side), eller blive en backend-sandhed (RLS/policy)?

**Hvorfor native-kritisk:** En second client (native) der laver direkte insert kan **omgå privacy fuldstændigt** — privacy eksisterer kun hvis hver klient frivilligt håndhæver den. Det er præcis den "frontend-authoritative"-risiko reviews har peget på. To klienter = to steder privacy skal implementeres korrekt, ellers lækage.

**Afvejning:**
- **Client-side (nuværende):** fleksibelt — QR/invite-bypass er let. Men skrøbeligt og ikke-håndhævet på tværs af klienter.
- **Backend (RLS/policy):** robust, én sandhed. Men QR/invite-bypass kræver så en eksplicit mekanisme (fx en SECURITY DEFINER join-funktion der validerer invite-token server-side).

**Antagelse:** Sandsynligvis skal join gå gennem en server-side funktion (RPC/edge) der validerer adgang (invite-token, event-medlemskab, public-status) frem for direkte table-insert. Det ville gøre privacy til backend-sandhed OG bevare QR/invite-flow. Stor beslutning — migreres til ADR når besluttet.

---

### Q-064: NEXT Pilot Smoke — app-flow/lifecycle test-lag

**TYPE:** D (redesign/tooling) · **PRIORITY:** P1 (pre-pilot) · **STATUS:** OPEN (rejst af ekstern review maj 2026)

**Kontekst:** Backend Contract Smoke Test (v6) dækker DB/RLS/kontrakter ved at skrive direkte til Supabase — den kan bestå selvom appens egne flows fejler (navigation, toasts, optimistic UI, reconnect, flow-flags, deeplinks, onboarding-gate).

**Spørgsmål:** Hvordan bygger vi et app-flow-test-lag der dækker det backend-testen ikke kan?

**Kandidat-dækning (fra review):**
- `joinBubble()` return-kontrakt (joined_now/already_member/failed) — app-niveau
- DM/bubble send via app-helper (ikke direkte insert)
- errorToast/logError-path
- deeplink `?event=` / `?join=` (logget-ud + logget-ind)
- onboarding/terms-gate
- render-XSS (`textContent` vs `innerHTML`) — `<img onerror=>`, navn med html
- reconnect-simulation: subscribe → send → unsubscribe → send → resubscribe → verificér readback fanger missed message

**Hvorfor separat:** Kræver et browser/DOM-harness (headless eller in-app test-mode), ikke det rene SQL-harness. Må IKKE presses ind i Backend Contract-testen.

**Antagelse:** Bygges som separat artefakt efter ADR-006 (push delivery-test giver først mening efter trigger-only er implementeret). Ikke native-blocker, men pre-pilot for at fange app-flow-regressioner. **Vigtigt: dette må ikke blive til "fem nye test-lag før native må starte" — det er et pilot-hardening-spor, ikke en native-gate.**

---

*Q-001 til Q-064 = 64 spørgsmål totalt. Q-014/019/023 VERIFIED, Q-062 GDPR-sletning, Q-063 privacy-kontrakt (native blocker), Q-064 app-flow smoke (pre-pilot).*
