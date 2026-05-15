# Bubble — Open Questions (Architecture Mapping)

> **Formål:** Bunke af spørgsmål Claude støder på under arkitektur-kortlægning. Michael løser parallelt mens Claude fortsætter analyse.
>
> **Format:** Hver spørgsmål får ID (Q-001, Q-002...). Ikke-blokerende — Claude fortsætter med antagelse noteret i ARCHITECTURE-MAP.
>
> **Status:** Spørgsmål markeres ÅBEN, BESVARET, eller IRRELEVANT efter du har set dem.

---

## 🟢 BESVARET

*(Tom indtil Michael svarer på første spørgsmål)*

---

## 🔴 ÅBEN

### Q-001: dbActions migration scope

**Kontekst:** dbActions write-lag bruges af 9 filer. b-admin.js, b-auth.js, b-onboarding.js, b-realtime.js, og b-messages.js bruger det IKKE.

**Spørgsmål:** Er dette intentionelt (admin-only, auth-flows har egne mønstre) eller er nogle af dem migrations-kandidater?

**Antagelse jeg fortsætter med:** Admin og auth har egne mønstre legitimt. Onboarding kunne migreres til dbActions. Realtime er publisher (skriver ikke direkte). Messages læser kun.

**Påvirkning hvis forkert:** Vi kan misse migration-arbejde der hører til P3 cleanup.

---

### Q-002: b-boot.js sidst i load-order

**Kontekst:** Script-load-rækkefølge: b-boot.js indlæses som sidste (efter b-navigation.js).

**Spørgsmål:** Er det fordi den orchestrerer alle moduler og skal have dem loaded først?

**Antagelse:** Ja, b-boot.js fungerer som "main()" der starter app efter alle moduler er klar. DOMContentLoaded triggers `loadHandler` der initialiserer auth-flow.

**Påvirkning:** Lav — verificering vil kun bekræfte mønsteret.

---

### Q-003: `currentBubble` global — er den dead code?

**Kontekst:** `currentBubble` er deklareret i b-config.js linje 188 som `let currentBubble = null`. Jeg kan ikke umiddelbart se hvor den **sættes** (i modsætning til `currentLiveBubble` som er aktiv).

**Spørgsmål:** Bruges `currentBubble` faktisk nogen steder? Eller er det legacy fra tidligere version hvor "current bubble context" var anderledes designet?

**Antagelse:** Det er muligvis dead code eller bruges sjældent. Kræver grep at bekræfte.

**Påvirkning:** Hvis dead code, mindre cleanup i native rewrite. Hvis aktiv, vigtigt at forstå hvorfor det er separat fra `currentLiveBubble`.

---

### Q-004: Lock-konvention

**Kontekst:** Mange `_xLock = true/false` pattern på tværs af kodebasen. Nogle bruger timeout (`_authLockTimer`), andre er "fire and forget".

**Spørgsmål:** Er der en samlet konvention der bør følges? Eller er det grown organisk?

**Antagelse:** Grown organisk. Hvert lock løste en specifik race-condition isoleret.

**Påvirkning for native:** Skal redesignes som eksplicit state machine eller mutex-pattern. Klassificeret som REDESIGN i ARCHITECTURE-LOG.

---

### Q-005: Chip-arrays naming convention

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

**Kontekst:** I b-boot.js linje 16: `var _cameFromLanding = false; // Set true in load handler if ?auth=1 was present`

**Spørgsmål:** Hvad er den eksakte effekt af denne flag? Påvirker den auth-flow, redirect-destination, eller noget tredje?

**Antagelse:** Den styrer om brugeren returneres til landing-siden ved logout, eller direkte til auth-skærm. Skal verificeres ved at læse b-auth.js.

---

### Q-007: Test-account special handling

**Kontekst:** I b-admin.js linje 373: `var TEST_ACCOUNT_EMAIL = 'test@bubbleme.dk'`

**Spørgsmål:** Hvad gør test-accounts særligt? Bypass af nogle checks? Synlighed for admins?

**Antagelse:** Sandsynligvis bruges af `cleanup-test-user` edge function til at slette test-data. Måske også special case i UI for ikke at vise test-brugere i radar.

---

### Q-008: 117 direkte writes — systematisk inventering?

**Kontekst:** Memory note 14 nævner "117 resterende writes kan migreres inkrementelt til dbActions". Disse er `sb.from(...).insert/update/delete()`-kald spredt over feature-filer.

**Spørgsmål:** Skal vi inventere de 117 writes systematisk i ARCHITECTURE-MAP, så vi har klar liste til migration? Eller er det P3-cleanup der ikke skal blokere arkitektur-mapping?

**Antagelse jeg fortsætter med:** Liste laves i fase 2 når jeg går per-fil dyb. Hver fil kataloges med "writes via dbActions" vs "direct writes" sektion.

**Påvirkning hvis forkert:** Hvis du vil have det hurtigere, kan jeg lave en grep-baseret rapport næste session.

---

### Q-009: Forskel mellem screen exit hooks og _navGlobalCleanup?

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

**Kontekst:** I b-config.js header siges "OWNS: currentChatUser, currentChatName" af **b-realtime.js**, men de er **deklareret** i b-config.js for load-order.

**Spørgsmål:** Bekræft at b-realtime.js skriver disse, ikke b-chat.js. Min analyse antyder at de **læses** i flere filer men **skrives** kun i b-realtime.js (`openChat()` linje 753).

**Antagelse:** b-realtime.js ejer dem. b-chat.js læser dem.

**Påvirkning:** For native rewrite: disse skal være del af "ChatService" eller "ConversationService" entity.

---

### Q-011: Native timeline — vælg A/B/C?

**Kontekst:** Ekstern research-rapport foreslår aggressiv tidsplan (native foundation start juni 2026). Vores STRATEGI.md har forsigtig plan (native foundation Q4 2026 efter pilot + verified bubbles + image-import).

**Tre muligheder:**
- **A)** Følg STRATEGI.md (pilot først, native efter feature-validering Q1 2027+)
- **B)** Følg rapportens accelererede plan (native foundation parallelt med pilot, juni 2026)
- **C)** Hybrid (kontrakter NU, pilot fortsætter, native foundation Q4 2026)

**Antagelse jeg fortsætter med:** C — kompromis mellem aggressivt og forsigtigt.

**Påvirkning:** STRUKTURELT VIGTIGT. Ændrer hele arbejdsgangen for resten af 2026.

---

### Q-012: Hvornår eksporteres backend-kontrakter?

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

**Kontekst:** Onboarding-status afgøres af `hasName && hasWorkplace && hasTerms` heuristik. Memory note nævner `onboarding_status` enum overvejes (`needs_terms`/`needs_name`/`needs_workplace`/`ready`).

**Spørgsmål:** Skal vi tilføje eksplicit `onboarding_status` kolonne nu, eller vente til native?

**Antagelse:** Vente til native — det er allerede dokumenteret som REDESIGN i ARCHITECTURE-LOG.

**Påvirkning:** Heuristik kan fejle ved race conditions (fx hvis terms_accepted_at sættes før name).

---

### Q-014: GDPR profile deletion — hvordan håndteres det?

**Kontekst:** Profile slettes ALDRIG ifølge entity-map analysen. Kun anonymisering. Men GDPR kræver "right to be forgotten".

**Spørgsmål:** Findes der en delete-flow? Eller er det ikke implementeret endnu?

**Antagelse:** Ikke implementeret. Post-pilot opgave.

**Påvirkning:** GDPR compliance risiko. Skal være på roadmap.

---

### Q-015: Bubble status enum — kun for live, eller udvid?

**Kontekst:** Nuværende kode har `status` på `bubbles` table KUN for live-bubbles. Andre states (ENDED, ARCHIVED) er infereret fra `event_end_date` osv.

**Spørgsmål:** Skal vi tilføje eksplicit `bubble_status` enum til alle bubbles?

**Antagelse:** Ja, for native. Det vil forenkle state-check logic dramatisk.

**Påvirkning:** Migration arbejde + opdatering af alle queries.

---

### Q-016: Live bubble expiration mekanisme?

**Kontekst:** Live bubbles har `expires_at` (6 timer fra start). Hvordan håndhæves dette?

**Spørgsmål:**
- Background job/cron der sætter status='expired'?
- DB trigger på timestamp?
- Eller bare client-side check?

**Antagelse:** Sandsynligvis client-side check. Skal verificeres ved at læse `b-live.js` grundigere i Session 3.

**Påvirkning:** Hvis client-side, kan en bubble forblive "active" hvis ingen tjekker.

---

### Q-017: parent_bubble_id hierarki — max dybde?

**Kontekst:** Bubbles kan have `parent_bubble_id` (hierarkisk). I `createBubble` arves icon fra parent eller grandparent (2 niveauer dybt).

**Spørgsmål:** Er der explicit eller implicit max-dybde? Eller kan det blive 10 niveauer dybt?

**Antagelse:** Ingen explicit max. Implicit 2 niveauer i icon-inheritance, men bubbles selv kan nest dybere.

**Påvirkning:** Performance i discover/list views hvis hierarki bliver dybt.

---

### Q-018: Member admin i én bubble, member i en anden?

**Kontekst:** `role` (admin/member) er per-bubble, så teoretisk ja.

**Spørgsmål:** Bekræft at dette er korrekt og intentionalt.

**Antagelse:** Ja, korrekt. Role er per-membership ikke per-user.

**Påvirkning:** Lav — kun for dokumentations-præcision.

---

### Q-019: User deletion → memberships hvad?

**Kontekst:** Hvis en bruger slettes (auth.users), hvad sker med deres bubble_members rows?

**Spørgsmål:** CASCADE delete? Anonymize?

**Antagelse:** CASCADE delete er sandsynligvis sat op via FK constraints på auth.users.

**Påvirkning:** Påvirker GDPR-deletion design.

---

### Q-020: Inviter deletion → invitations hvad?

**Kontekst:** Hvis user_a inviterer user_b, og user_a slettes — hvad sker med invitationen?

**Spørgsmål:** Bevares invitation med null from_user_id? Eller CASCADE delete?

**Antagelse:** Sandsynligvis CASCADE — invitations er ikke kritisk historiske.

**Påvirkning:** Lav.

---

### Q-021: Invitation expiration?

**Kontekst:** Invitations har ingen automatisk expiration. En invitation fra 2024 kan stadig være pending i 2026.

**Spørgsmål:** Skal vi implementere expiration (fx 30 dage)?

**Antagelse:** Bør implementeres for native. Pilot kan klare sig uden.

**Påvirkning:** UI cleanup + bedre brugeroplevelse.

---

### Q-022: Eksplicit Conversation entity for DMs?

**Kontekst:** DMs er bare messages mellem to brugere. Der er ingen "Conversation" entity. Conversations er computed fra messages.

**Spørgsmål:** Skal vi tilføje eksplicit Conversation entity i native med metadata (last_message_at, total_messages, deleted_for_user_a/b, muted)?

**Antagelse:** Ja, vil gøre DM-listen meget mere effektiv (én row per conversation vs aggregering på hver query).

**Påvirkning:** Datamodel-ændring for native. PWA fortsætter computed approach.

---

### Q-023: User deletion → DMs hvad?

**Kontekst:** Hvis user slettes, hvad sker med deres DMs?

**Spørgsmål:** Soft-anonymize (sender_id → null, content bevares)? Eller delete?

**Antagelse:** Sandsynligvis ikke implementeret endnu. GDPR-relevant.

**Påvirkning:** Linker til Q-014.

---

### Q-024: bcReduceMsg pattern som arkitektur-invariant?

**Kontekst:** `bcReduceMsg` i b-chat.js centraliserer alle bubble message inserts fra 4 forskellige paths. Det er en GOD PATTERN.

**Spørgsmål:** Skal vi dokumentere det eksplicit som "single-reducer invariant" i ARCHITECTURE-LOG?

**Antagelse:** Ja. Det er allerede note 5.1.5, men kan forstærkes.

**Påvirkning:** Native skal bevare patternet.

---

### Q-025: Live bubble expiration mekanisme (detail)?

**Kontekst:** Samme som Q-016 men mere specifik.

**Spørgsmål:** Hvordan virker `expires_at` håndhævelsen i praksis? Skal vi læse hele b-live.js for at finde ud af det?

**Antagelse:** Vil blive tydeligere i Session 5-7 når vi katalogerer b-live.js.

**Påvirkning:** Defer til senere session.

---

### Q-026: Server-authoritative presence — bekræft som princip?

**Kontekst:** Live session state har 3 sources of truth (frontend appMode, DB column, edge function logic). Native bør konsolidere til server-authoritative.

**Spørgsmål:** Bekræft at server-authoritative er det rigtige princip for native?

**Antagelse:** Ja. Frontend læser via realtime, skriver via edge function only.

**Påvirkning:** Påvirker hele live/presence-arkitektur i native.

---

### Q-027: Rating storage — localStorage OR DB?

**Kontekst:** Memory note siger ratings i `bubble_stars` localStorage. Schema har også `rating` kolonne på `saved_contacts`.

**Spørgsmål:** Hvilken er autoritativ? Skal de synces? Eller bruges kun den ene?

**Antagelse:** Sandsynligvis localStorage er reelt brugt og DB-feltet er forberedt men ikke aktiveret.

**Påvirkning:** Native skal vælge én source of truth fra start. localStorage er **anti-pattern** (forsvinder ved logout, ingen sync mellem devices).

---

*Q-001 til Q-027 = 27 åbne spørgsmål totalt. Disse besvares parallelt mens Claude fortsætter med Session 3 (System Boundaries).*
