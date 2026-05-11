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

## Sammenfatning per kategori

**🟢 GENBRUGES (4 entries):** Backend-stack, dbActions pattern, i18n, match algorithm

**🟡 REDESIGN (3 entries):** Realtime subscriptions, auth/onboarding flow, state management

**🔴 FORKAST (3 entries):** Inline onclick, 100vh sizing, push-arkitektur

**💡 LÆRING (5 entries):** Mockup-først, kirurgisk og additiv, pre-tag arv, replicate-not-scale, visual feedback for states

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

*Logbog vedligeholdt løbende. Sidste opdatering: Maj 2026.*
