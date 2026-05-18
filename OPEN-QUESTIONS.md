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

---

## Session 3 — System Boundaries (15. maj 2026)

### Q-028: `signOut` spredt over 3 filer — konsolider?

**Kontekst:** `sb.auth.signOut()` kaldes fra b-auth.js, b-admin.js, OG b-onboarding.js. Det er anti-pattern — én entity (auth state) burde kontrolleres ét sted.

**Spørgsmål:** Skal vi nu (pre-native) konsolidere signOut til kun b-auth.js? Eller vente til native AuthService?

**Antagelse:** Vente til native. Risikabelt at refaktorere auth nu under pilot.

**Påvirkning:** Native AuthService SKAL være eneste sted der kalder signOut.

---

### Q-029: Identity state machine — eksplicit i native?

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

**Kontekst:** User reports (rapportering af upassende indhold) er pt. spredt mellem b-utils.js (dbActions.reportUser) og b-admin.js (admin håndtering). Det er en moderation-funktion.

**Spørgsmål:** Hører `reports` under Platform System (som tværgående moderation) eller bør den have eget "Moderation System"?

**Antagelse:** Platform System har "ModerationService" sub-domæne. Reports er for små til eget system.

**Påvirkning:** Folder structure i native.

---

### Q-031: bubble_message_edits + bubble_post_reactions — separate entities?

**Kontekst:** Disse er nævnt som relaterede entities (Entity 6: BubbleMessage). De er separate tabeller men hænger sammen med BubbleMessage.

**Spørgsmål:** I native, skal de være:
- A) Separate services (EditHistoryService, ReactionService)
- B) Sub-features af BubbleChatService
- C) Værdier embedded i BubbleMessage type

**Antagelse:** B — BubbleChatService har metoder for begge, men de er ikke separate top-level services.

**Påvirkning:** Service-design granularitet.

---

### Q-032: Cross-system writes via services only — invariant?

**Kontekst:** I architecture map sektion 15 har jeg dokumenteret at cross-system writes skal gå gennem services (fx Messaging skriver IKKE direkte til bubble_members, men kalder MembershipService.markAsRead()).

**Spørgsmål:** Bekræft dette som arkitektur-invariant for native?

**Antagelse:** Ja, klart. Ellers er service-boundaries meningsløse.

**Påvirkning:** Skal cementeres i ARCHITECTURE-LOG som GENBRUGES pattern (når implementeret i native).

---

### Q-033: Platform har INGEN dependency på domain systems — confirm?

**Kontekst:** Jeg har argumenteret at Platform er foundation — alle andre systems afhænger af det, men det skal IKKE selv kende til business logic.

**Spørgsmål:** Bekræft at dette er korrekt princip?

**Eksempel:** Skal Platform.PushService have indbygget viden om "send push når ny bubble-besked"? Eller skal Messaging trigger PushService med en generic payload?

**Antagelse:** Sidstnævnte — Platform er agnostic, domain systems triggerr.

**Påvirkning:** Hele dependency-graph for native arkitektur.

---

### Q-034: Sub-systems within Platform — egne mapper?

**Kontekst:** Platform har 7 sub-domæner (P.1 Realtime, P.2 Push, P.3 Navigation, P.4 Errors, P.5 i18n, P.6 Storage, P.7 Analytics).

**Spørgsmål:** I native, hver sub-domæne som egen mappe i `src/platform/`? Eller én flad fil per service?

**Antagelse:** Egen mappe per sub-domæne. Klar adskillelse.

**Påvirkning:** Folder structure detail.

---

### Q-035: Native folder structure proposal — passer din intuition?

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

**Kontekst:** Bubble Join Flow har 6 forskellige entry points (UI button, ?join=, ?event=, QR scan, invitation, deep-link unauthenticated).

**Spørgsmål:** Kan vi konsolidere til 3 (direct, deep-link, QR)? Event-flow vs join-flow distinction kan være unødig kompleksitet.

**Antagelse:** Pilot-data afgør. Indtil da: bevar nuværende.

---

### Q-037: data-action delegated pattern vs inline onclick

**Kontekst:** b-chat.js linje 627 bruger `data-action="requestJoin"` delegated event handler. b-bubbles.js linje 2291 bruger inline `onclick="requestJoin(...)"`.

**Spørgsmål:** Standardiser på data-action pattern for alle dynamisk-genererede buttons?

**Antagelse:** Ja. Mere refactor-venligt. Native bruger React props alligevel.

---

### Q-038: checkQRJoin legacy code — fjern i næste prod release?

**Kontekst:** Memory note: "Legacy checkQRJoin() i b-bubbles.js er deprecated siden v8.17.22".

**Spørgsmål:** Kan vi fjerne det? Eller bevarer det som safety net?

**Antagelse:** Fjern når vi har 2-3 ugers stabilitet uden bugs.

---

### Q-039: event_flow branch i checkPendingJoin

**Kontekst:** checkPendingJoin har en separat event_flow branch der "peeker" på bubble før join.

**Spørgsmål:** Er separation virkelig nødvendig? Kunne unified flow med discriminator-felt.

**Antagelse:** Kan unified i native med eksplicit `JoinIntent.type`.

---

### Q-040: Push double-firing på bubble join

**Kontekst:** Push fyrer fra BÅDE frontend sendPush AND DB trigger.

**Spørgsmål:** Fix før native eller efter?

**Antagelse:** Efter. Det er ikke broken — bare ineffektivt. Native skal være server-only.

---

### Q-041: sendMessage direct DB write vs dbActions.sendDM

**Kontekst:** b-messages.js sendMessage() bruger DIRECT `sb.from(messages).insert()` mens sendDirectMessage() bruger dbActions.sendDM().

**Spørgsmål:** Hvorfor inkonsistensen? Skal konsolideres.

**Antagelse:** Historisk artefakt. dbActions.sendDM kom senere. Skal opdatere sendMessage.

---

### Q-042: Push double-firing på DM send

**Kontekst:** Samme problem som Q-040 men for DMs.

**Spørgsmål:** Fix før native?

**Antagelse:** Efter. Native skal være server-only.

---

### Q-043: _dmLastSent dedup window — configurable?

**Kontekst:** Hardcoded 3 sekunder. Native kunne have config per environment.

**Spørgsmål:** Skal det være justerbart?

**Antagelse:** Ja i native, men 3s er nok god default.

---

### Q-044: Broadcast vs CDC ordering

**Kontekst:** Broadcast arriver typisk før CDC. dmReduceMsg dedup handles det.

**Spørgsmål:** Skal native møde anderledes? Eller bevar dedup-pattern?

**Antagelse:** Bevar dedup-pattern. Det er robust.

---

### Q-045: Edge function `checkin` source i repo?

**Kontekst:** Source er på Michaels PC, IKKE i repo. Det er kritisk logik vi ikke kontrollerer i version control.

**Spørgsmål:** Hvornår skal vi committe edge function source?

**Antagelse:** Sammen med Q-012 backend-kontrakter eksport.

---

### Q-046: currentLiveBubble legacy compat object

**Kontekst:** appMode.live er nyt single-source-of-truth, men currentLiveBubble eksisterer parallelt for legacy compat.

**Spørgsmål:** Kan currentLiveBubble fjernes nu? Eller venter vi til native?

**Antagelse:** Vent til native. Risikabelt at fjerne globally-used global.

---

### Q-047: All edge function source i version control?

**Kontekst:** Generalisering af Q-045. Vi har 3 edge functions: send-push, checkin, cleanup-test-user/reset-test-user. Hvor mange er i repo?

**Antagelse:** Sandsynligvis ingen. Skal alle committes.

---

### Q-048: Bubble expiration mechanism (revisit Q-016)

**Kontekst:** Live bubbles har `expires_at` (6 timer). Edge function checkin bør validere `bubble.status=active` — men hvordan håndhæves status update?

**Spørgsmål:** Background job? Pg_cron? Frontend-only?

**Antagelse:** Sandsynligvis pg_cron eller frontend-check ved hver checkin. Verificer ved at læse edge function source.

---

### Q-049: Client-side checkin fallback — fjern i PWA cleanup?

**Kontekst:** _liveCheckinFallback() er ikke atomic — 3 separate DB calls. Race conditions possible.

**Spørgsmål:** Skal vi fjerne fallback nu, eller bevare til native?

**Antagelse:** Bevar. Edge function har høj uptime, men fallback er safety net for udkanter af reach.

---

*Q-001 til Q-049 = 49 åbne spørgsmål totalt.*

---

## Section 19: Push Notification Flow (Session 4 batch 2)

### Q-050: Which DB triggers are currently active in Supabase production?

**Kontekst:** Memory dokumenterer 4 trigger-navne (`on_new_message_push`, `on_bubble_invite_push`, `on_new_invite_push`, `on_contact_saved_push`), men deres faktiske status i produktion er ikke verificeret i denne mapping-session.

**Spørgsmål:** Kør `SELECT tgname, tgrelid::regclass FROM pg_trigger WHERE tgname LIKE '%push%';` i Supabase SQL editor og dokumentér resultatet.

**Antagelse:** Alle 4 er aktive. Hvis ikke, scope for arkitekturændring reduceres.

**Blokerer:** Q-051, Q-052, Q-055. Vault migration kan ikke starte før vi ved hvilke trigger-bodies vi skal redigere.

---

### Q-051: What payload schema does send-push/index.ts expect?

**Kontekst:** Memory dokumenterer "body format mismatch" og at 2 funktioner sender `recipient_id` mens edge function forventer `user_id`. Eksakt mismatch ikke retraceret.

**Spørgsmål:** Åbn `C:\Users\freef\bubble-edge\supabase\functions\send-push\index.ts` og dokumentér:
1. Hvilke felter destructeres fra request body
2. Hvor `user_id` vs `recipient_id` bruges
3. Hvilke titel/body-formater accepteres

**Antagelse:** Edge function forventer `{ user_id, title, body }`. To triggers sender `{ recipient_id, title, body }` → silent failure.

**Blokerer:** Q-052 og fix af failure mode #1.

---

### Q-052: Are recipient_id and user_id intentionally different concepts?

**Kontekst:** Det er **muligt** at distinktionen var intentional på et tidspunkt:
- `user_id` = den der **udførte** handlingen (afsender af DM, opretter af bubble)
- `recipient_id` = den der skal **modtage** notification

Hvis ja, er fix at omdøbe edge function parameter til `recipient_id` overalt.

**Spørgsmål:** Gennemgå trigger-funktionernes SQL-bodies og afgør om naming reflekterer en bevidst skelnen, eller blot er drift mellem to udviklere/tidspunkter.

**Antagelse:** Det er drift. Standardisér på `recipient_id` (det er det mere præcise navn — den der modtager pushen er ikke nødvendigvis identisk med `user_id` i triggerens kontekst).

**Blokerer:** Beslutning om naming convention før refactor.

---

### Q-053: Is b-utils.js sendPush() still reachable?

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

**Kontekst:** Memory: ingen specifik mention af `push_delivery_log` eller lignende tabel. pg_net.http_post er fire-and-forget. Edge function kan logge til console, men det er flygtigt.

**Spørgsmål:** Tjek:
1. Findes en tabel som `push_delivery_log`, `notification_log`, eller lignende?
2. Logger edge function til Supabase logs (kan ses i dashboard)?
3. Findes nogen client-side push ack-mekanisme?

**Antagelse:** Ingen persistent logging. Det er en stor del af "silent failure"-problemet.

**Blokerer:** Phase 2 i arkitektur-redesign (Section 19.6).

---

### Q-055: Which secrets remain hardcoded outside vault.secrets?

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
