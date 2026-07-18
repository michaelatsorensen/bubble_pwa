# Bubble — Arkitektur-logbog (Native-readiness)

> **Formål:** Føre løbende oversigt over hvad nuværende kodebase **gør rigtigt** (genbrugbart i native) vs. **gør forkert** (skal redesignes). Bliver guld værd når native-rewrite begynder Q1 2027.
>
> **Format:** Hver entry har dato, kategori, finding, og status.
>
> **Opdateres:** Løbende mens vi arbejder. Ny finding → ny entry. Forbedring → opdatér entry.

---

## Kategorier

- 🟢 **GENBRUGES** — Pattern eller kode der kan portes næsten 1:1 til native
- 🟡 **REDESIGN** — Konceptet er rigtigt, men implementation skal omtænkes for native
- 🔴 **FORKAST** — Anti-pattern eller workaround der ikke skal følge med
- 💡 **LÆRING** — Indsigt fra prod/next der informerer native-design uden at være kode-relateret

---

## Logbog

### 🟢 GENBRUGES — `dbActions` write-lag pattern (b-utils.js)

**Dato tilføjet:** Maj 2026 (initial)

**Hvad:** Centraliseret write-lag der håndterer Supabase-skrivninger med konsistent error handling, auth guards, og tracking. Hver action returnerer `{ ok, data?, error?, duplicate? }`.

**Hvorfor genbruges:**
- Pattern er direkte kompatibel med React Native (samme Supabase JS klient)
- Error handling-konvention er allerede etableret
- Tracking-integration giver os analytics fra dag ét
- Return-type-pattern matcher idiomatisk TypeScript

**Status nu:** ~50% af writes går gennem dbActions. De resterende 117 direkte writes er P3 cleanup-arbejde.

**Action for native:** Komplet migration af alle writes til dbActions FØR rewrite begynder. Det giver os en clean source-of-truth at portere.

---

### 🟢 GENBRUGES — Supabase som source-of-truth med RLS

**Dato tilføjet:** Maj 2026 (initial)

**Hvad:** Hele backend-stacken (Postgres, Auth, Realtime, Storage, Edge Functions) er platform-uafhængig. Native iOS/Android bruger samme Supabase-klient som web.

**Hvorfor genbruges:**
- Backend er i praksis **færdig** (modulo schema-evolution for verified, saved events, etc.)
- Supabase JS klient virker ens på web og React Native
- RLS-policies sikrer auth korrekt uanset client
- Edge functions (send-push, checkin) er platform-agnostiske
- Realtime subscriptions virker ens

**Status nu:** Stabil og produktiv.

**Action for native:** Ingen — bare brug den. Eventuelt ekstra edge functions til billede-AI-extraction når det kommer.

---

### 🟢 GENBRUGES — i18n-system (b-i18n.js)

**Dato tilføjet:** Maj 2026 (initial)

**Hvad:** ~1.084 keys (542 DA + 542 EN) med `t('key')` og `t('key', {vars})` pattern. Statisk UI translation via `data-t` attributter.

**Hvorfor genbruges:**
- Nøgler er allerede oversat
- Pattern er direkte kompatibel med react-i18next eller lignende
- Migration vil være: kopiér JSON-struktur, skift `t()` til `useTranslation()` hook

**Status nu:** Komplet, intet hardkodet dansk i user-facing tekst.

**Action for native:** Konvertér til JSON-formatet React Native i18n-libraries forventer. Lige-fremad arbejde.

---

### 🟢 GENBRUGES — Match scoring algorithm (calcMatchScore)

**Dato tilføjet:** Maj 2026 (initial)

**Hvad:** TF-IDF + sigmoid-baseret match scoring v2 mellem brugere baseret på tags, dynamic_keywords, shared bubbles.

**Hvorfor genbruges:**
- Ren funktion uden UI-afhængigheder
- Algoritme er testet i pilot
- Performance er fin

**Status nu:** Stabil.

**Action for native:** Direct port til TypeScript. Ingen ændringer nødvendige.

---

### 🟡 REDESIGN — Realtime subscription architecture

**Dato tilføjet:** Maj 2026 (initial)

**Hvad:** Realtime subscriptions for DM, bubble chat, presence, etc. Bruger `bcReduceMsg`/`dmReduceMsg` til centralisering af inserts, og Broadcast channels for cross-user realtime (RLS workaround).

**Hvorfor redesign:**
- Konceptet er rigtigt (centraliseret reducer-pattern)
- Men implementation har vokset organisk — flere subscription-paths
- Dobbelt-firing-bugs på push-triggers indikerer manglende klar event-flow
- React Native har anderledes lifecycle (foreground/background) der kræver eksplicit håndtering

**Status nu:** Funktionelt OK i pilot, men teknisk gæld.

**Action for native:** 
1. Definér klar event-arkitektur (UserJoinedBubble, MessageSent, PresenceUpdated, etc.)
2. Single subscription-manager der håndterer foreground/background transitions
3. Klar separation: realtime-event → reducer → state → UI

---

### 🟡 REDESIGN — Auth flow + onboarding state

**Dato tilføjet:** Maj 2026 (initial)

**Hvad:** Auth-flow har vokset til kompleks state machine: `_authLock`, `flowSet/Get/Clear`, `pending_join`, `consumeFlow`, deep-link-modal-handler, plus 4 parallelle join-handlere (kun 1 er kanonisk).

**Hvorfor redesign:**
- Vi har fået det til at virke gennem itterationer, men det er ikke designet eksplicit
- Onboarding-status er heuristik (`hasName && hasWorkplace`) i stedet for eksplicit enum
- React Native deep-linking har anderledes mekanik end PWA URL-params

**Status nu:** Virker i prod, men er teknisk gæld.

**Action for native:**
1. Eksplicit `OnboardingStatus` enum: `needs_terms | needs_name | needs_workplace | needs_consent | ready`
2. Klar state machine for auth-transitions
3. Single deep-link-handler (showDeepLinkModal er kandidaten)
4. Slet checkQRJoin definitivt før native-port

---

### 🟡 REDESIGN — State management

**Dato tilføjet:** Maj 2026 (initial)

**Hvad:** Mix af globals (`currentUser`, `currentProfile`), navState, appMode, escalator-cache på DOM, unread state, realtime shadow state. Pattern er delvist konsistent men ikke fuldstændigt.

**Hvorfor redesign:**
- Vanilla JS-implementation tvinger globals
- React Native har bedre state-tools (Zustand, Jotai, Redux Toolkit, Context)
- Centraliseret state-pattern er allerede halvt implementeret — fortjener at blive komplet

**Status nu:** Pragmatisk, men ikke ideelt.

**Action for native:**
1. Vælg state-library (sandsynligvis Zustand for solo-founder simplicity)
2. Definer slices: session, profile, bubbles, conversations, presence, ui
3. Migrer logik gradvist — UI er kun consumer, aldrig owner

---

### 🔴 FORKAST — Inline event handlers (`onclick="..."`)

**Dato tilføjet:** Maj 2026 (initial)

**Hvad:** Mange UI-elementer i index.html bruger `onclick="functionName()"` direkte i HTML.

**Hvorfor forkast:**
- React Native har ikke HTML — bruger event-props (`onPress={...}`)
- Inline strings er ikke type-safe
- Refactor-ufrendigt (grep finder ikke alle call-sites)

**Status nu:** Pragmatisk for vanilla JS, men dybt anti-pattern for native.

**Action for native:** Naturlig konsekvens af React Native — alle handlers bliver props.

---

### 🔴 FORKAST — `100vh` viewport sizing

**Dato tilføjet:** Maj 2026 (efter Ulefone-bug rollback)

**Hvad:** `html { height: 100vh }` og `body { height: 100vh }` for at fylde skærmen.

**Hvorfor forkast:**
- Mobile browsers fortolker `100vh` inkonsistent
- Ulefone-bruger oplevede nav-bar / chat-input off-screen
- Tidligere fight: v8.15.33-35 prøvede `100dvh` men måtte rulle tilbage pga. dobbelt-nav-bar i PWA
- Vi har genintroduceret samme bug i v8.17.25 (rolled back i v8.17.26)

**Status nu:** Lever som teknisk gæld i PWA. Vi accepterer at sjældne enheder kan have issues.

**Action for native:**
- React Native bruger `WindowInsets` (Android) / `SafeAreaInsets` (iOS)
- Spørger OS direkte om synligt område
- Hele kategorien af viewport-bugs forsvinder

---

### 🔴 FORKAST — Push-arkitektur (4 triggers + 9 frontend call sites)

**Dato tilføjet:** Maj 2026 (initial)

**Hvad:** Push notifications fyrer fra **både** DB-triggers (4 stk.) og frontend `sendPush()`-kald (9 stk.). Resultat: dobbelt-firing på invitations.

**Hvorfor forkast:**
- Single responsibility violation — to forskellige systemer ejer samme operation
- Hardkodede secrets i triggers (skal til Vault)
- Frontend `sendPush()` er sandsynligvis dead code for trigger-dækkede typer

**Status nu:** Funktionelt OK men teknisk gæld. P2 cleanup på roadmap.

**Action for native:**
- **Kun** server-side push fra edge functions trigget af DB-events
- Frontend kalder ikke push — sender kun events der trigger server-action
- Single source of truth for push-decisions

---

### 🔴 FORKAST — DOM-baseret state caching (escalator-cache)

**Dato tilføjet:** Maj 2026 (initial)

**Hvad:** Escalator scroll v3.1 cacher elementer med `_escItems` på scrollEl, plus `_escHinted` flag på hver item.

**Hvorfor forkast:**
- DOM-baseret state er anti-pattern for native (ingen DOM)
- Workaround for vanilla JS uden state-management
- Pattern er "smart hack" der dør i React Native

**Status nu:** Virker i PWA. Performance-fix for scroll-jitter.

**Action for native:**
- React Native har FlatList/ScrollView med indbygget item-recycling
- "Escalator effect" kan implementeres med Animated API + scroll position
- Helt anden mekanik, samme visuel resultat

---

### 💡 LÆRING — Mockup-først har sparet timer

**Dato tilføjet:** Maj 2026 (initial)

**Hvad:** Vi har konsekvent lavet mockups (visualizer eller HTML-files) før vi implementerer UI-ændringer.

**Hvad det har lært os:**
- Beslutninger om dark glass / light backdrop er nemmere at træffe på mockup
- Brugere (Michael) kan give feedback før kode er skrevet
- Ofte ender mockups med at vise andre features end forventet

**Action for native:**
- Behold dette pattern aggressivt
- Figma + React Native er natural fit — design-tokens kan deles
- Strategi: Figma → komponent-prototype → integration

---

### 💡 LÆRING — Kirurgisk og additiv > store omskrivninger

**Dato tilføjet:** Maj 2026 (initial)

**Hvad:** Vores princip om at lave små batches, push hyppigt, teste, justere har holdt projektet stabilt gennem ~27 versioner uden at brække noget i lang tid.

**Hvad det har lært os:**
- Store omskrivninger er højrisiko
- Små additive changes er målbare
- Cherry-pick prod↔next har fungeret godt

**Action for native:**
- Native-rewrite skal være **vertical slices**, ikke big-bang
- Onboarding først → radar → chat → bobler → events
- PWA fortsætter live indtil native vertical slice er bevist

---

### 💡 LÆRING — Pre-tag arv via organisationer

**Dato tilføjet:** Maj 2026 (strategi-diskussion)

**Hvad:** Når en virksomhed verificeres som org, kan medarbejdere automatisk få deres tags pre-udfyldt med org-mærket.

**Hvad det har lært os:**
- Verified bubbles giver mere end branding — det giver datasets
- Pre-tag arv reducerer onboarding-friktion drastisk
- Stærkt salgsargument til verified-tier

**Action for native:**
- Designet ind i datamodellen fra dag ét
- `profile_tags` skal have `source_org_id` field
- UI skal vise org-mærke på tags der er pre-arvet

---

### 💡 LÆRING — "Replicate, don't scale"

**Dato tilføjet:** Maj 2026 (strategi-diskussion)

**Hvad:** Sønderborg → 3 byer → national → Nordic. Perfektionér hver fase før næste.

**Hvad det har lært os:**
- Hyperlokalt netværk er moat'en
- Skala er ikke målet, dybde er
- Pilot-data fra Sønderborg informerer 3-by-ekspansion

**Action for native:**
- Native-app skal designes til at fungere i én by
- Multi-by/multi-region er senere problem
- Start: Sønderborg pilot på native, så replicate

---

### 💡 LÆRING — Visual feedback for state changes (v8.17.27 / next-v8.30)

**Dato tilføjet:** 9. maj 2026

**Hvad:** Bruger oprettede konto, satte check mark i terms-checkbox, men "Kom i gang"-knappen ændrede ikke synligt tilstand fra disabled til enabled. Knappen VAR teknisk disabled (HTML disabled-attribut, `disabled=false` i JS), men så **visuelt identisk ud**.

**Root cause:** Ingen CSS for `.btn-primary:disabled`, `.btn-secondary:disabled`, etc. Browseren's default `disabled` styling kunne ikke overskrive custom button styles.

**Hvad det har lært os:**
- **Visual state change skal være eksplicit** — `disabled` attribut alene er ikke nok hvis CSS overskriver
- **Klassisk UX-bug pattern** — buttons skal kommunikere state både teknisk OG visuelt
- **Brugere stoler på visuel feedback** — hvis intet ændrer sig, antager de noget er broken
- Dette var en **silent bug** der havde levet i kodebasen siden første button styles. Ingen bruger havde rapporteret det indtil nu.

**Hvor det blev fundet:** Sektion 14 i auto-generated file-stats.md viste 202 inline onclick i index.html. Mange af disse forventer disabled-state, men der var ingen styling for det.

**Action for native:**
- React Native button-komponenter skal **fra start** have eksplicit disabled-variant
- Hver interactive komponent dokumenteres med states: idle, hover, pressed, disabled, loading
- "Visible state machine" pattern — UI-state skal være tydelig på alle states, ikke kun success-path
- Storybook eller lignende component-katalog ville fange dette tidligt

**For PWA:** Fix pushed i v8.17.27 + next-v8.30. CSS-only change, ingen logic.

---

### 💡 LÆRING — "Vi opdager ikke, vi formulerer" (maj 2026)

**Dato tilføjet:** 17. maj 2026

**Hvad:** Gennem en serie sessioner i maj 2026 landede vi på en ny identitets-formulering: "Continuity layer for lokale møder". Den blev IKKE bygget — den blev erkendt. Alle tre tidsfaser (før/under/efter) var allerede implementeret i kodebasen før vi havde sproget for dem.

**Kontekst:** Indledningsvis brugte vi formuleringer som "local LinkedIn", "memory layer", "networking app". Hver var delvist rigtig, men ingen fangede det centrale: at appens unikke værdi er sammenbindingen af tre faser, ikke nogen enkelt fase.

**Root insight:** Modent founder-arbejde handler om at *erkende mønstre i produktet*, ikke at designe nye features fra scratch. Når et produkt har levet i drift i et halvt år med daglige brugere, har det allerede "sin natur". Founderens opgave er at finde sproget for den natur — ikke at omforme den til ny strategi.

**Hvad det har lært os:**
- **Strategi-skift handler ofte om sprog, ikke kode** — i dette tilfælde ændrede 0 linjer kode sig, men positioneringen blev fundamentalt anderledes
- **Lyt til produktets adfærd, ikke kun til markedet** — vores brugere brugte allerede de tre faser sammen før vi vidste det
- **Modstå presset for at "pivote"** — når noget kommer ud af venstre felt, spørg "har vi allerede bygget dette i en anden form?"
- **Pitch deck som test-mekanisme** — vi opdagede formuleringen ved at *prøve at forklare* produktet visuelt. Hvis pitch-narrativet føles ærligt, er det formentlig en korrekt formulering.

**Hvor det opstod:** Sessions med Claude maj 2026, kulminerede i pitch deck v8 (21 slides) og denne formaliseringssession.

**Action for native:**
- Ny architecture skal afspejle de tre faser som **navngivne moduler/screens**: `before/`, `during/`, `after/` (eller tilsvarende mental modeling)
- Native onboarding-flow skal introducere brugeren til alle tre faser tidligt, ikke kun til den ene fase de er ankommet via
- Match-scoring kan udnytte fase-context bedre (er vi i "før event"-fase? "under event"? "efter"?)

**For PWA:** Ingen kodemæssige ændringer påkrævet. Formaliseret i STRATEGI.md §1.5 + principper 10-15 i §11.

---

### 💡 LÆRING — "Kontraktproblem, ikke caller-problem" (maj 2026 · v8.17.30)

**Status:** Aktiv — princip cementeret efter joinBubble() refactor

**Hvad vi opdagede:**

Da audit af `dbActions.joinBubble()` viste at **4 af 8 callers håndterede return-værdien forkert**, var den umiddelbare reaktion at "fixe callers". Men det var den forkerte diagnose.

Den **faktiske** problemkilde var **kontrakten** mellem `joinBubble()` og dens callers:

- Return shape var inkonsistent (`{ ok: true }` vs `{ ok: true, duplicate: true }`)
- Error-fields blandede typer (string vs Error object)
- `duplicate`-flag var ambiguous — er det success eller warning?

Når 4 ud af 8 implementeringer er forkerte, er det ikke 8 udviklere der har misforstået. Det er kontrakten der er **ufuldstændig som specifikation**.

**Det generaliserbare princip:**

> Når en majoritet af consumers af en API/contract bruger den forkert, er kontrakten næsten altid problemet — ikke consumerne.

Dette gælder uanset om kontrakten er:
- En JavaScript funktion (joinBubble case)
- En DB trigger payload (push case fra Section 19)
- En realtime channel event format
- En REST endpoint response shape
- Et state machine state-set

**Hvorfor det er vigtigt før native:**

Native rewrite kommer til at **eksponere** alle ufuldstændige contracts. TypeScript vil insistere på eksplicit shape. Hvis kontrakten i dag er "implicit convention" (som joinBubble var), bliver det smertefuldt at porte til en typed setting.

Konsekvens: **Pre-pilot contract-stabilisering er native-arbejde forklædt som bugfix.**

**Konkret retningslinje fremadrettet:**

Når vi opdager bugs:

1. **Tæl call sites med fejlen.** Hvis 2+ callers har samme bug → mistænk kontrakten.
2. **Spørg "hvad er den underliggende kontrakt?"** Hvis svaret er "det afhænger" → kontrakten skal eksplicitiseres.
3. **Foretrukket fix:** Stram kontrakten først, lad callers følge automatisk.
4. **Anti-pattern:** Fix callers en ad gangen uden at adressere kontrakten.

**Direkte alignment med Tenets:**
- **Tenet 1** (Native = backend normalization pressure): kontrakt-stabilisering før native er ikke "bonus"-arbejde, det er **kernen** af native-forberedelse
- **Tenet 3** (replace ambiguous ownership): "ambiguous ownership" på funktions-niveau betyder uklar kontrakt mellem caller og callee

**For PWA:** Anvendt på `joinBubble()` (ADR-005, v8.17.30). Tilsvarende analyser bør køres på:
- `dbActions.sendDM()` (er dens return-shape entydig?)
- `dbActions.checkIn()` (samme spørgsmål)
- Push trigger payloads (allerede identificeret som problemområde — Section 19)
- Realtime event handlers (når Section 17/18 verifikation kører)

**For native:** Denne læring **er** Phase 0 strategien fra NATIVE-MIGRATION.md. Hver verificeret/strammet kontrakt før native = én bug class elimineret.

---

### 💡 LÆRING — "Refactor skaber egne string-konstanter" (maj 2026 · v8.17.31 / next-v8.32)

**Status:** Aktiv — princip cementeret efter visibility-bug diagnose

**Hvad vi opdagede:**

En bruger rapporterede at "Borgen Shopping" vistes som **"Privat"** i Opdag-tab, men som **"Åben"** efter join (Mine-tab). Den initielle diagnose-rejse tog ~2 timer:

1. Bekræftet med 5 SQL-queries at databasen var pur (visibility = `'public'`, ingen RLS-maskering, ingen views, ingen triggers, ingen generated columns)
2. Bekræftet at frontend brugte `b.visibility` direkte uden transformation
3. Service worker cache-bug fundet og fixet (men ikke rod-årsag)
4. iPhone reinstall test — ingen effekt
5. **Først efter brugeren afslørede at hun var logget ind på NEXT-build (ikke PROD) blev bug'en lokaliseret**

**Den faktiske bug i `next/b-home.js`:**

```javascript
var visClass = b.visibility === 'open' ? 'bb-pill-open'  // ← FORKERT: db har 'public'
             : b.visibility === 'hidden' ? 'bb-pill-hidden'
             : 'bb-pill-private';  // ← FALLBACK rammer ALLE public bubbles
```

PROD's `bubbleCard()` kaldte fælles `visIcon()`-utility som korrekt tjekkede `'private'`/`'hidden'` med fallback til "Åben". Da NEXT-build refactorede `bubbleCard()` til at have **lokal styling-logik direkte**, blev DB-konstanterne genfortolket — den **danske label "Åben" blev hentet ind som JavaScript-konstant `'open'`** i stedet for at matche DB's faktiske `'public'`.

Resultat: **100% af public bubbles vistes forkert som "Privat" i NEXT-bygget.**

**Det generaliserbare princip:**

> Når en refactor flytter logik fra fælles utility ind i lokal kode, **gen-introducerer den enhver string-konstant** som den oprindelige utility havde abstraheret væk. Hvis konstanterne ikke er centralt defineret, gen-fortolkes de fra hukommelse/intuition — og afdrifter fra DB-værdier.

**Hvorfor det skete:**

1. **PROD's `visIcon()` var en sort boks** — designeren der lavede NEXT-refactor så funktionens output (badge-styling), ikke dens input-konstanter
2. **DB-konstanter findes kun i koden** — ingen TypeScript-types, ingen shared enum, ingen central konstant-definition
3. **Refactor-scope var "styling"** — så designeren rørte ved render-logikken uden at tjekke om string-værdier matchede
4. **Ingen runtime-validering** — en visibility = `'public'` returnerer ikke en fejl, den falder bare gennem switch-statement

**Det var heller ikke en enkeltstående hændelse:**

Cross-check sweep efter fundet afslørede yderligere divergens:
- NEXT's `joinBubble()` returnerer simpel `{ ok: true/false }` — ikke PROD's ADR-005 discriminated union (`{ ok, status: 'joined_now'/'already_member' }`)
- 19 filer divergerer mellem PROD og NEXT, flere med 100+ linjer forskelle
- Ingen central sporing af hvilke divergenser er **funktionelle** vs **styling**

**Hvorfor det er vigtigt før native:**

Native rewrite er **i sig selv** en stor refactor der vil skabe samme klasse af bugs i skala. Hver eneste string-konstant der dublikeres i ny kode er en potentiel afdriftspunkt.

Specifikt for native:
- TypeScript-types vil **delvist** beskytte mod dette — men kun hvis vi definerer enums for DB-værdier
- React Native komponenter vil naturligt have lokal styling-logik → høj risiko for "lokal genfortolkning"
- Observability fra dag 1 (Sentry/PostHog) vil fange forkerte fallbacks i produktion — men fanger ikke "alle public bubbles vises som private" som anomali

**Konkret retningslinje fremadrettet:**

**For PWA:**
1. **Cross-check PROD og NEXT systematisk** (igangværende → PROD-NEXT-DRIFT.md)
2. **Identificér alle DB-værdi-konstanter** der bruges i frontend
3. **Centralisér konstanter** — ikke spredt magic strings
4. **Refactor-PR'er bør liste hvilke konstanter de gen-introducerer**

**For native:**
1. **TypeScript enums for ALLE DB-værdi-konstanter** før første brug:
   ```typescript
   export enum BubbleVisibility {
     Public = 'public',
     Private = 'private',
     Hidden = 'hidden'
   }
   ```
2. **Exhaustive switch-checks** så TypeScript fejler ved manglende cases
3. **Single source of truth for DB-konstanter** — gerne genereret fra Supabase schema
4. **Aldrig magic strings i komponenter** — altid importeret konstant

**Direkte alignment med Tenets:**
- **Tenet 1** (Native = backend normalization pressure): central konstant-definition er **del af** backend-normalization — DB-værdier bør være typed, ikke implicit
- **Tenet 5** (Distill, don't port): NEXT's bubbleCard-refactor er klassisk eksempel på "port frontend-rendering uden at porte underliggende contract" — det modsatte af destillering

**Det her er heller ikke kun en NEXT-bug:**

Vi har **også fundet** en stor mængde duplikerede RLS policies på `bubbles`-tabellen (12 policies, mange duplikater for SELECT/INSERT/DELETE — kun UPDATE har én clean policy). Det er separat tech debt der bør håndteres post-pilot.

**Læringsmæssig meta-observation:**

Diagnose-rejsen tog 2 timer fordi jeg systematisk **eksluderede** `next/`-mappen fra alle mine søgninger (`grep -v "^next/"`). Antagelsen "next/ er ikke i produktion" var forkert — du tester next/ på rigtige enheder. Det er en proces-fejl: **at antage at en kodesti er irrelevant uden at verificere det**. Næste gang: spørg "hvilket build kører på hvilken enhed?" som første diagnostik-skridt når bug rapporteres.

---

## Sammenfatning per kategori

**🟢 GENBRUGES (4 entries):** Backend-stack, dbActions pattern, i18n, match algorithm

**🟡 REDESIGN (3 entries):** Realtime subscriptions, auth/onboarding flow, state management

**🔴 FORKAST (3 entries):** Inline onclick, 100vh sizing, push-arkitektur

**💡 LÆRING (8 entries):** Mockup-først, kirurgisk og additiv, pre-tag arv, replicate-not-scale, visual feedback for states, formulerings-landing, kontraktproblem-ikke-caller-problem, refactor-skaber-egne-string-konstanter

---

## Sådan opdaterer vi denne logbog

**Når Claude og Michael arbejder sammen:**

1. **Ny finding identificeret?** → Tilføj entry med dato + kategori
2. **Eksisterende pattern forbedret?** → Opdatér Status nu
3. **Pattern bevæger sig mellem kategorier?** → Eksempel: REDESIGN → GENBRUGES når vi har komplet implementeret det. Opdatér.
4. **Vigtig læring der ikke er kode?** → Tilføj som 💡 LÆRING

**Mål:** Når Q1 2027 kommer og rewrite begynder, har vi et komplet kort over:
- Hvad vi kan bare kopiere
- Hvad vi skal redesigne
- Hvad vi skal forkaste
- Hvad vi skal huske som meta-læring

Det her er **det vigtigste dokument** for at gøre native-rewrite effektiv. Investerer vi 30 min nu, sparer vi uger senere.

---

### 🟢 GENBRUGES — Chat message dedup + own-echo exclusion (verificeret maj 2026)

**Dato tilføjet:** Maj 2026

**Hvad:** Mønster der forhindrer dublet-beskeder ved optimistisk UI + realtime echo. Verificeret via statisk analyse efter ekstern review flaggede potentiel race i dmReduceMsg/bcReduceMsg.

**To beskyttelseslag (begge stier):**
1. **Egne beskeder echoes aldrig tilbage.** DM: kanalen bruger broadcast self:false + postgres-fallback filtreret til receiver_id = currentUser.id. Bubble: eksplicit "if m.user_id === currentUser.id return" i subscription. Det klassiske "optimistisk insert + eget echo kolliderer"-race kan derfor ikke ske.
2. **Indgående dedup på msg-id.** DM på data-msg-id, bubble på data-bc-msg-id. JS single-threaded, så to næsten-samtidige events eksekverer sekventielt (første inserter, anden dedup'es). markRead fyrer kun én gang (dedup-return sker før markRead).

**Reconnect-hygiejne:** loadChatMessages laver fuld innerHTML-genopbygning, ikke append, så forældet pending-række fra tabt ack ryddes ved refetch.

**Hvorfor genbruges:** Native skal replikere begge lag — own-echo-exclusion + id-baseret dedup. Det er den korrekte måde at håndtere optimistisk UI mod en realtime-kilde uanset klient.

**Ét residual (lav prioritet, kosmetisk):** Hvis egen insert lykkes server-side men ack tabes, hænger beskeden som "pending" indtil chat-genåbning/reconnect genopbygger listen. Ingen dublet eller datatab — selv-heler. Kan hærdes senere (fx timeout der re-fetcher), men ikke pilot-blocker.

**Forbehold:** Dette er STATISK analyse — beviser at beskyttelserne findes (capability). Fuld behavioral-bekræftelse under al timing (dårligt net, hurtige sends, background/foreground) kommer fra pilot. Krydsreference: realtime-subscription-modellen er separat flagget 🟡 REDESIGN for native.

---

### 🟢 GENBRUGES — Push endpoint = én bruger (cross-user fix, maj 2026)

**Dato tilføjet:** Maj 2026

**Hvad:** Strukturel fix af tilbagevendende cross-user push-bug. UNIQUE(user_id, endpoint) tillod ét fysisk endpoint at tilhøre flere brugere → forrige brugers notifikationer landede hos ny bruger på samme enhed (verificeret: 4 brugere på ét iPhone-endpoint i prod).

**Rod (verificeret, IKKE som først antaget):** Vi havde set en lignende bug før og antog "logout-cleanup mangler igen". Verifikation viste at logout-fixet FANDTES i NEXT — roden var login-side: constraint tillod flere ejere, og RLS (`auth.uid()=user_id` ALL) blokerede klienten fra at rydde anden brugers række. **Læring: verificér roden selv når bug'en føles bekendt — vi havde ellers fikset det forkerte sted igen.**

**Fix (server-side, RLS-sikker):** BEFORE INSERT trigger `trg_evict_stale_push_endpoint` (SECURITY DEFINER) sletter andre brugeres rækker for samme endpoint ved ny subscription. Migration: `migrations/2026-05_push-endpoint-eviction.sql`.

**Hvorfor trigger (vs ADR-006 minimér-triggers):** Dette er en **data-integritets-trigger** (håndhæver invariant "ét endpoint = én bruger"), ikke en side-effekt/notifikations-trigger. Kan ikke udtrykkes som simpel UNIQUE (vi vil slette gammel, ikke afvise ny) og klienten kan ikke gøre det pga RLS. Legitim trigger-brug. Registreret her så den er kendt.

**Hvorfor genbruges:** Native arver samme push_subscriptions-tabel. Invarianten "seneste login ejer endpointet eksklusivt" + den robuste server-side håndhævelse (afhænger ikke af at logout kører) porteres direkte. Logout-cleanup er nu kun en optimering, ikke den eneste vagt.

---

*Logbog vedligeholdt løbende. Sidste opdatering: Maj 2026.*

---

## 💡 LÆRING: En installeret standalone-PWA kan ikke redirecte sig selv ud af sit scope (18. jul 2026)

**Kontekst:** Da vi konsoliderede alt til root (16.-17. jul), retirerede vi de gamle
stier `/next/` og `/v3/` til en redirect-shim (`meta refresh` + `location.replace` til
root) + en kill-switch service worker. Det bestod vores browser-test i går. Men da det
ramte en RIGTIG installeret iOS-PWA (genvej oprettet fra `/next/` eller `/v3/`), opstod
en loekke: evigt opdaterings-banner, Safari-overlay paa en "installeret" app, og appen
kunne aldrig fuldfoere en opdatering.

**Root cause:** En installeret standalone-PWA har sit scope bundet til sin sti (`/next/`).
`location.replace('https://bubbleme.dk/')` forsoeger at navigere UD af det scope — hvilket
iOS enten blokerer eller haandterer ved at smide brugeren ud i Safari (deraf overlayet).
Manifestets `start_url` peger stadig paa den gamle sti, saa genvejen kommer tilbage til
shim'en naeste gang. En PWA kan vise indhold PAA sin egen sti, men kan ikke permanent
"blive til" en PWA paa en anden sti. **Auto-redirect ud af scope er umuligt i standalone.**

**Hvorfor testen i gaar ikke fangede det:** browser-faner har ikke scope-bindingen. Det
ene miljoe hvor det betyder noget — en installeret iOS standalone-PWA — var praecis det
sandkassen ikke kan teste. Lektie: for SW/PWA-scope-adfaerd er browser-test noedvendig men
ikke tilstraekkelig; kun en rigtig enhed bekraefter.

**Loesning (kill-switch v2, verificeret paa rigtig iPhone):** Hold op med at forsoege
redirect. Vis i stedet en aerlig besked ("Denne version er foraeldet — slet genvejen og
opret en ny gennem bubbleme.dk"). Den nye SW serverer ALDRIG cache (fetch-handler med
`no-store`), saa den gamle cachede shim ikke kan blive haengende. `updateViaCache:'none'`
paa den gamle registrering lod den nye SW bryde igennem. Bekraeftet: virker paa alle gamle
genveje, root uroert.

**Vigtig nuance om alvor:** Paa dette tidspunkt er ALLE rigtige brugere familie/venner/
taette samarbejdspartnere der ved Bubble er i test. En "geninstallér"-besked skraemmer
dem ikke. Havde brugerbasen vaeret fremmede, ville en loekkende app vaeret alvorlig — men
her var det en overgang haandteret blandt folk der forventer bumps. Risiko reelt lav.

**Konsekvens fremadrettet (beslutning, Michael):** Root er den ENESTE tilgaengelige
version. Uanset fremtidige versioner eller stier deployes intet som en parallel
installerbar PWA-sti igen. Nye brugere kan derfor aldrig komme i denne tilstand.

**Native-relevans:** Native apps har ikke dette problem (App Store haandterer versioner).
Men lektien om at scope/installation er STATEFUL paa klienten — og ikke kan aendres
serverside — gaelder generelt for enhver PWA-fallback vi maatte beholde.
