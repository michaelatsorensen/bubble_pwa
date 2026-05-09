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

*Flere spørgsmål tilføjes løbende mens analysen fortsætter.*

---

## 🟡 IRRELEVANT (besvaret af kontekst)

*(Spørgsmål Claude finder svar på selv mens analysen fortsætter)*

---

*Vokser løbende. Tjek dette dokument før du svarer — sortér efter ID-nummer.*
