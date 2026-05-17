# Bubble — Strategi & Forretningsmodel

> **Opdateret:** Maj 2026 (efter next-v8.32 / prod-v8.17.28 — continuity layer-formulering landed)
> **Status:** Pilot-readiness phase, Sønderborg går snart live
> **Author note:** Dette dokument samler forretningsmodel, produkt-vision og strategiske indsigter fra ~50 udviklings-sessioner. Erstatter tidligere `bubble-forretningsmodel.md` og `Bubble_Produktdokumentation_2026.md`.

---

## 1. Vision i én sætning

> Bubble er en hyperlokal, ad-free networking-PWA der samler mennesker omkring **bobler** (netværk + events) — drevet af radar, QR og smart matching, med organisations-verifikation som langsigtet moat.

**Differentiator:**
- Selvorganiserende (ingen central arrangør påkrævet)
- Mobile-first PWA (ingen app store-friktion)
- Hyperlokal som design-princip (ikke globalt)
- **Ad-free er en fast positioneringsbeslutning** — ikke til diskussion

---

## 1.5 Continuity layer — identitets-formulering (maj 2026)

> **Bubble er et continuity layer for lokale møder.**
> Vi binder de mennesker, du faktisk møder lokalt, sammen over tid
> — så relationer ikke forsvinder mellem møder.

**Tre tidsfaser som integreret moat:**

| Fase | Vores rolle | Built features |
|---|---|---|
| **Før** event | Overblik | Saved events, agenda, invitationer, discover |
| **Under** event | Præsens | QR check-in, radar, smart matching, in-bubble chat + DM |
| **Efter** event | Kontinuitet | Saved contacts, DM-historik, profile views, match på tværs |

**Det kritiske:** Hver fase styrker de to andre. Det er ikke tre features
— det er én sammenhængende oplevelse for lokalsamfund.

### Hvad vi IKKE er

- **Ikke "memory layer"** — for begrænset, kun bagudrettet
- **Ikke "local LinkedIn"** — defensiv positionering, importerer wrong frame
- **Ikke event-app** — Eventbrite-territorium, men kun fase 1
- **Ikke chat-app** — Slack/Discord-territorium, men kun fase 2
- **Ikke networking-platform** — LinkedIn-territorium, men kun fase 3

Vi er det der **binder de tre sammen**. Konkurrenter skal genopbygge
tre apps og integrere dem for at konkurrere.

### Vi opdager — vi designer ikke

Disse tre faser var allerede *bygget* før vi havde sproget for dem.
Sessionerne i maj 2026 var en **formulerings-landing**, ikke et
strategi-skift. Modent founder-arbejde handler om at erkende
mønstre i produktet, ikke at designe nye fra scratch.

> "Vi opdager ikke. Vi formulerer." — Michael, maj 2026

---

## 2. Forretningsmodellen — fire revenue-lag

| Lag | Kunde | Type | Pris | Status |
|---|---|---|---|---|
| **Event Bubbles** | Eventarrangører | Transaktionel B2B | 1–10K DKK / event | Defineret, ikke implementeret |
| **Corporate Bubbles** | Virksomheder | Recurring B2B | 199–2.499 DKK / måned | Defineret, ikke implementeret |
| **Profile Views** | Slutbrugere | Recurring B2C | 29–49 DKK / måned | Defineret, ikke implementeret |
| **Verified Bubbles** | Organisationer | Recurring B2B | 1–25K DKK / år | **Strategisk kerne** — se §4 |

**Flywheel-mekanik:**
```
corp content → users → profile views → events → more corp content
```

### 2.1 Event Bubbles (transaktionel B2B)

Premium feature-pakke til konferencer, meetups, festivaller:
- **Reverse QR check-in** — eventet scanner deltageren (ikke omvendt) → præcis fremmødedata
- Attendee insights og admin roller
- Differentiering "tilmeldt" vs "faktisk fremmødt"
- Tidsbegrænset (eventets varighed + nedtælling)

### 2.2 Corporate Bubbles (recurring B2B)

Branded broadcast-kanal med:
- Virksomhedsprofil
- Envejs broadcast + reactions
- Analytics
- Tilknytning af events til corp

Approval-process overvejes for at undgå spam.

### 2.3 Profile Views (recurring B2C)

LinkedIn-style freemium:
- **Gratis:** "X personer har set din profil i sidste uge"
- **Premium:** Navne, kontekst (hvor / hvornår), anonym-toggle på dig selv

### 2.4 Verified Bubbles (recurring B2B) — **strategisk kerne**

Se §4 for hvorfor verified bubbles er essentielle, ikke en add-on.

---

## 3. GTM (Go-To-Market)

| Fase | Tidsramme | Mål |
|---|---|---|
| **1. Pilot** (Sønderborg) | 0–6 mdr | 500 brugere, 10 bobler |
| **2. Ekspansion** (3 byer) | 6–18 mdr | 5.000 brugere, 80 bobler |
| **3. National** (8 byer) | 18–36 mdr | 25.000 brugere, 300 bobler |
| **4. Nordisk** (20 byer) | 36+ mdr | 100.000 brugere, 1.000 bobler |

**Revenue forecast:**
- År 1: 90K DKK
- År 2: 650K DKK
- År 3: 2.1M DKK
- År 4: 5.75M DKK

**Princip:** "Replicate, don't scale" — perfektionér Sønderborg, kopier formel til næste by.

---

## 4. Verified Bubbles — den strategiske kerne

### 4.1 Det skift der ændrede tænkningen (maj 2026)

Indtil for nylig var verified bubbles en *add-on* — en organisations-feature for branding og tillid.

**Den nye indsigt:** Verified bubbles er **løsningen på et problem der vokser med succes**.

Hvis billede-import (§5) lykkes som planlagt, vil brugere oprette events lynhurtigt — også events de ikke selv arrangerer (huskeliste-funktion). Resultat:

- Anne tager billede af Energy Cluster Årsmøde → opretter "Energy Cluster Årsmøde 2026"
- Bo opretter "Energy Cluster Årsmøde" (typo)
- Carl (organisator) opretter "Energy Cluster Årsmøde 2026 - Sammen om innovation"
- Dorte (også organisator) opretter "ECD årsmøde"

= **4 duplikater** for samme event. Hvilken er den rigtige?

**Verified bubbles løser præcis dette.**

### 4.2 Hvorfor verified bubbles er uomgåelige

```
Flere user-generated bobler
        ↓
Mere støj og duplikater
        ↓
Højere værdi af verified-mærket
        ↓
Forsvarligere prissætning
        ↓
Defensible moat
```

Det er **bevidst aksepteret rod** — fordi rodet sælger verified-tier'en.

### 4.3 Verified bubbles — kernefunktioner

- **Visuelt mærke** — ✓ check, signal-of-truth
- **Org-ejerskab** — ikke bundet til personen der oprettede den (overlever staff turnover)
- **Roller** — admin, moderator, member
- **Pre-tag arv** — DigitalLead verificeres → deres tags arves automatisk til medarbejder-profiler (med fjern-mulighed)
- **Org-logo / branded** synlighed
- **Claim-mekanisme** for eksisterende duplikater

### 4.4 Pre-tag arv (eksempel)

DigitalLead verificeres som organisation. De vælger tags:
`Erhvervsklynge`, `Digitale teknologier`, `AI/ML`, `IoT`, `SaaS`

Når en medarbejder linker sig til organisationen:
- Pre-tagged automatisk med disse tags
- Tags er markeret med org-logo (vs. selvvalgte)
- Brugeren kan fjerne dem hvis irrelevante
- Hvis de forlader DigitalLead: tags bliver, mister org-mærket

**Strategisk værdi:** Stærkt salgsargument til verified-køb. "Dine medarbejdere er allerede profileret korrekt fra dag ét."

---

## 5. Billede-import — accelerator-feature

### 5.1 Vision

Bruger snapper billede af program / flyer / PDF / LinkedIn-screenshot → Claude Vision API ekstraherer titel, dato, agenda → pre-udfyldt event-form til review → bruger gemmer.

**Tid:** Fra 5 minutter til 30 sekunder.

### 5.2 To use cases (samme feature, dobbelt værdi)

| Use case | Bruger | Værdi |
|---|---|---|
| **Arrangør** | "Jeg har et event jeg vil dele" | Lav friktion på event-creation = flere events |
| **Deltager** | "Jeg fandt et event jeg vil huske" | Personlig huskeliste + social discovery |

### 5.3 "Saved events" — ny entitet

Ikke alle "gemte events" skal være bobler. Nogle er bare interesse-markeringer:

- **Saved** — "Jeg har gemt dette event til senere"
- **Going (RSVP)** — "Jeg deltager (men ikke nødvendigvis tilmeldt hos arrangør)"
- **Registered** — verificeret tilmeldt (link til arrangørens system)
- **Attending** — live check-in på dagen

**Datamodel-forslag:** Separat `saved_events` tabel + auto-link til verified bubble når arrangøren senere opretter den.

### 5.4 Sekvens-strategi

**Sprint 1 (post-pilot):** Verified bubbles MVP (skal være på plads FØR billede-import går live, ellers eksploderer rodet)
**Sprint 2 (post-pilot):** Billede-import for arrangører (default privat/draft for at minimere rod)
**Sprint 3:** Saved events + social discovery ("dit netværk har gemt dette")

### 5.5 Match & decision flow — kernestilbet

Når en bruger snapper et billede, kan AI'en være tre forskellige sikre på matchet:

| Confidence | AI ser | UX-respons |
|---|---|---|
| **Højt** (Scenarie A) | Verified org's logo + match | "Verificeret arrangør fundet" + 3 valg |
| **Medium** (Scenarie B) | Kendt event-titel uden logo | "Måske er det denne bubble?" + 3 valg |
| **Lavt** (Scenarie C) | Ukendt arrangør | Privat huskeliste only |

**De 3 valg ved match (sorteret fra mindst → mest forpligtende):**

1. **🤍 Gem som huskeliste** — *default-anbefalet*. Privat, ingen forpligtelse, instant. Escape hatch: "Du kan altid joine den officielle bubble senere"
2. **🔵 Anmod om at joine** — Semi-forpligtelse. Kræver godkendelse fra bubble-admin. Få adgang til pre-event chat + se hvem der kommer
3. **➕ Lav mit eget event** — Fuld frihed. Vises som duplikat-advarsel i discover

**Princip:** Brugeren ser tydeligt hvad hvert valg medfører — vi tvinger ikke, vi inviterer.

### 5.5 Cost-analyse (Claude Vision API)

| Skala | Imports/måned | Cost/måned |
|---|---|---|
| Pilot | 50 | ~$1 |
| 3 byer | 500 | ~$10 |
| Nordisk | 5.750 | ~$100 |

Insignifikant ift. revenue-potentiale.

---

## 6. Tilmeldingslinks — vigtig design-beslutning

**Bubble's job:** "Hvem kommer? Lad os snakke før dagen."
**Arrangørens platform's job:** Tilmelding, betaling, billet.

→ Tilmeldingslink er ikke import-mekanisme. Det er **et felt på det færdige event** der lader medlemmer klikke videre til arrangørens tilmelding.

Bubble konkurrerer ikke med Eventbrite/Billetto — vi komplementerer.

---

## 7. Personlig QR — universel networking-handling

QR'en er ikke kun til bobler. Den er en **universel introduktions-handling**:

- Konferencer (uden Bubble-event)
- Cafeer / tilfældige møder
- Visit-kort erstatning
- Cold-outreach på messer
- Reverse: Eventet scanner brugerens QR (premium event bubble feature)

**QR rotation:** Statisk personlig QR, men **dynamisk token** ved reverse-scanning (60-sekunders gyldighed) for at undgå screenshot-snyd.

---

## 8. Markedspotentiale (Danmark)

### 8.1 TAM / SAM / SOM

| Niveau | Estimat |
|---|---|
| **TAM** (DK 18–55, smartphone, social) | ~1.1M |
| **SAM** (samme — DK er kompakt) | ~1.1M |
| **SOM realistisk** (5–7% penetration) | 55K–80K aktive brugere |

### 8.2 Modne revenue (DK kun)

| Driver | Antagelse | Årlig |
|---|---|---|
| Event Bubbles | 500 events á 3K DKK | 1.5M DKK |
| Verified Bubbles | 200 orgs á 8K DKK | 1.6M DKK |
| Corporate Bubbles | 100 orgs á 12K DKK/år | 1.2M DKK |
| Profile Views | 5K abonnenter á 35 DKK/md | 2.1M DKK |
| **Total DK modent** | | **~6.4M DKK/år** |

**Norden:** Ved tilsvarende penetration → 25–30M DKK/år.

---

## 9. Strategiske moat-kilder

| Moat | Type | Styrke |
|---|---|---|
| **Hyperlokalt verified-netværk** | Network effect | Stærkest — sværest at kopiere |
| **Personlig QR som habit** | Behavioral | Når først indlejret er den sticky |
| **Pre-tag arv via verified orgs** | Data | Vokser eksponentielt med verified-baseen |
| **Møde-graf (hvem mødte hvem fysisk)** | Data asset | Unikt — ingen anden app har dette |
| **Ad-free positionering** | Brand | Eksplicit kontrast til LinkedIn/Meta |

---

## 10. Hvad er bygget per maj 2026

### 10.1 Kernefunktioner (live i prod v8.17.24)

✅ **Radar** — bulls-eye visning, smart match v2 (TF-IDF + sigmoid), cap 25
✅ **Live Bubble** — QR check-in, real-time presence
✅ **Bubble chat + DM** — GIF-picker (Tenor), unread dots, long-press menu
✅ **Discover** — upvotes, verified marker (visuelt, ikke business-feature endnu)
✅ **Person Sheet** — 1–3 stjerner
✅ **196 tags i 4 kategorier**
✅ **Invite system** — deep links, modal
✅ **Pull-to-refresh + offline modal**
✅ **Profil styrke-måler**
✅ **3 sprog** (DA/EN, ~1.084 i18n keys)

### 10.2 Build-historik (next-branch)

- v8.05a → v8.27: Design-system konsolidering + 7 funktionelle bug-fixes
- DESIGN-SYSTEM.md som single source of truth
- Hybrid backdrop pattern (lys body + dark glass cards)
- 6 funktionelle backports til prod (v8.17.22, .23, .24)

### 10.3 Kendte begrænsninger / udestående

🟡 **P2 design** — 6 lilla-gradient knapper migreres til ice-blue CTA (vente på decision)
🟡 **P2 design** — hardcoded text-colors cleanup
🟡 **P3 cleanup** — slet ubrugte CSS-klasser, deprecated `checkQRJoin()`
🟡 **Push architecture** — 4 DB triggers + edge functions, secrets i Vault
🔴 **Ingen GPS-filtrering** på radar (alle profiler vises uanset afstand) — P2 backlog

### 10.4 Ikke-implementerede revenue-features

- Verified bubbles (visuel mærke kun, ingen business-logik)
- Corporate bubbles (broadcast-kanal)
- Profile views (counter + premium-tier)
- Event bubbles premium-features (reverse QR, attendee insights)

**Konklusion:** Produktet er klar til pilot på *core networking*, men revenue-features venter på post-pilot sprints.

---

## 11. Beslutninger truffet (skrevet i sten)

1. **Ad-free for evigt** — fast positioneringsbeslutning
2. **Replicate, don't scale** — perfektionér Sønderborg før vi går videre
3. **Hyperlokal som princip** — ikke globalt, ikke nationalt-fra-start
4. **Stabilitet → data → features** — sprint-prioriteringsfilosofi
5. **Mockup → kode** — ingen UI bygges uden visuel review
6. **Kirurgisk og additiv** — refactor i små batches, aldrig "store omskrivninger"
7. **Aldrig forced membership** — saved events og bubble membership er separate states. Brugeren ejer beslutningen. Vi tvinger ikke, vi inviterer.
8. **Aldrig halvt på fundamentet, ofte halvt på toppen** — foundation (datamodel, sikkerhed, async-flows) bygges med livrem og seler. Features (UI, copy, animationer) itereres hurtigt.
9. **Architecture documentation is part of the product** — ingen foundational ændring er komplet før architecture-map er opdateret. Dokumentation er ikke "efter koden" — det er en del af leverancen.
10. **Adgang skal være let. Tillid bygges gradvist.** — Email-signup er friktionsløst. LinkedIn er optional verifier efter onboarding, ikke krav for adgang.
11. **Tillid optjenes — ikke importeres.** — Verifikation kommer fra reel kontekst (delte bubbles, fælles events), ikke fra LinkedIn-imports eller abstrakte trust-scores.
12. **Kontekst slår status.** — "Vi mødtes ved ECD" er stærkere signal end "CEO hos firma X". Fælles erfaring slår CV.
13. **Tilstedeværelse betyder mere end profil-perfektion.** — At være der er nok. Du behøver ikke optimere din bio for at være værdifuld i en bubble.
14. **Continuity layer, ikke memory layer.** — Vi binder før/under/efter sammen. Memory layer ville kun være efter. Se §1.5.
15. **Bubble's natur: relationer forsvinder ikke mellem møder.** — Det er det fundamentale problem vi løser. Alt andet er taktik.

### 11.1 Saved events vs bubble membership — to mentale modeller

| Kontekst | Forventning |
|---|---|
| **Saved events** | Min liste. Min privatliv. Mit valg. |
| **Bubble membership** | Fælles rum. Fælles synlighed. Aktiv deltagelse. |

Hvis vi tvinger sammenfald, ødelægger vi begge. Datamodellen skal afspejle adskillelsen:

```
saved_events                ← privat, ingen forpligtelse
   ↓ optional upgrade
bubble_members.pending      ← anmodet om at joine
   ↓ approval
bubble_members.active       ← rigtig medlem
```

`saved_events` kan `link_til` en bubble via `linked_bubble_id`, men er ikke det samme som membership.

### 11.2 Livrem og seler-domæner

Der hvor vi **aldrig gætter** og **altid dokumenterer eksplicit**:

- **Datamodel** — hver entity har eksplicit state-machine
- **Security** — hver authorization-decision er dokumenteret
- **RLS policies** — eksporteret og versioneret i repo
- **Auth flows** — eksplicit state machine, ikke heuristik
- **Realtime** — event-katalog er autoritativ
- **Async flows** — race conditions er kortlagt
- **State ownership** — hver state-variable har én ejer
- **Write paths** — hver tabel har defineret service
- **Migration boundaries** — clear cuts mellem PWA og native

Der hvor vi **iterer hurtigt** og **gerne lærer ved at fejle**:

- UI-design og polish
- Copy og marketing-tekst
- Animationer og overgange
- Feature-prioritering (pilot-data informerer)
- Visual experimenter

---

## 12. Roadmap — næste 18 måneder

### Q3 2026 (pilot)
- Lukke P0-P1 fra rapport ✅ DONE
- Sønderborg lancering
- Smoke-test af 4 revenue-streams *konceptuelt* (ikke implementeret)
- Indsamle pilot-data — **fokus: kerne-produkt-fit, ikke PWA-friktion**

### Q4 2026 (post-pilot, sprint 1)
- **Verified Bubbles MVP** — visuelt mærke, admin-process, pricing
- Push-arkitektur cleanup (P2)
- GPS-filtrering på radar
- Onboarding/consent rewrite
- **Begynde native-readiness arkitektur-arbejde** (se §14)

### Q1 2027 (sprint 2)
- **Billede-import** for arrangører
- Default draft/privat for nye user-generated events
- Saved events (deltager-use-case)
- **Native-rewrite vertical slice begynder parallelt** (onboarding + radar + chat)

### Q2 2027 (sprint 3 + native)
- Profile Views (counter + premium)
- Corporate Bubbles MVP
- Ekspansion til 2-3 nye byer
- **Native rewrite hovedarbejde** (resterende features porteret)

### H2 2027 (native release + scale)
- **Native iOS + Android release på App Store / Play Store**
- National udrulning (8 byer)
- Event Bubbles premium-features (reverse QR, insights)
- Pre-tag arv via verified orgs
- **PWA continueres som fallback / desktop-experience**

---

## 13. Hvad jeg skal huske som dev-sparring

- **Spørg altid:** Understøtter denne feature en af de fire revenue streams? Hvis ikke — er det stadig værd at bygge?
- **Verified bubbles** er ikke en "senere"-feature. Den er kernen.
- **Billede-import** vil generere rod. Verified skal være på plads først.
- **Hyperlokal moat** er det vigtigste at beskytte — ikke skala.
- **Møde-graf** (hvem mødte hvem fysisk) er det skjulte data-asset — værn om datakvaliteten.
- **Native er besluttet** — nye features bør bygges med portability i tankerne (se §14).

---

## 14. Native distribution — bekræftet strategisk path

### 14.1 Beslutning truffet (maj 2026)

Bubble flytter til native iOS + Android distribution i H2 2027. PWA fortsætter som fallback og desktop-experience, men native bliver primær mobile platform.

**Beslutningsgrundlag:**

1. **Word-of-mouth skalerbarhed** kræver App Store-distribution
   Bubble's revenue forecast (90K → 5.75M DKK over 4 år) forudsætter organisk vækst. PWA's installations-friktion (~50% drop-off på "Add to Home Screen") er strukturelt inkompatibel med denne vækstmodel.

2. **Tillidsbarriere ved PWA**
   "Søg efter Bubble i App Store" er drastisk lavere friktion end "gå til bubbleme.dk og installer som PWA". Hver friktions-step koster eksponentielt i konversion.

3. **Discovery-økosystem**
   App Store giver adgang til discovery-mekanismer der **ikke eksisterer** for PWA: kategorier, anmeldelser, søgning, "også populært i Danmark", cross-installation suggestions. PWA har kun direkte URL-share + SEO + word-of-mouth.

4. **Strukturelle PWA-begrænsninger**
   - iOS push (flaky, kræver Safari-installation)
   - Background location (praktisk talt umulig)
   - Bluetooth/NFC for reverse-QR (ikke tilgængelig)
   - iOS storage cleanup efter 7 dages inaktivitet
   - Inkonsistent kameraintegration for billede-import

5. **Native løser device-bugs strukturelt**
   Eksempel: Ulefone-bruger oplevede nav-bar / chat-input off-screen pga. `100vh` browser-fortolkning. Native frameworks bruger `WindowInsets` (Android) / `SafeAreaInsets` (iOS) og spørger OS direkte. Hele kategorien af viewport-bugs forsvinder.

### 14.2 Hvad native ikke løser

For balance — native er ikke et silver bullet:

- **Foldable phones** kræver explicit håndtering
- **Tablet layout** kræver explicit design
- **App Store/Play Store reviews** tager 1-7 dage per opdatering
- **Apple's 30% provision** på in-app payments (relevant for Profile Views, Verified Bubbles)
- **Specifikke producent-bugs** kan stadig opstå (Samsung One UI, Xiaomi MIUI)
- **App Store discovery** kræver ASO-arbejde (egen disciplin)
- **Hyperlokal discovery** er svag i App Store (ingen "apps for Sønderborg"-kategori)

### 14.3 Tech-stack valg (foreløbig)

**Anbefaling: React Native + Expo + TypeScript**

**Argumenter:**
- Én kodebase til iOS + Android + Web
- Genbrug af Supabase-klient
- Genbrug af forretningslogik fra prod/next
- Stærkt ecosystem til realtime, navigation, state
- Solo-founder venligt (ikke dobbelt vedligehold)
- Lettere at hyre senere (større dev-pool end Swift+Kotlin)

**Konsekvenser at acceptere:**
- Real-time animation-performance kan være lavere end native-native
- Visse libraries (Bluetooth, NFC, Camera) kan være halvfærdige
- Cross-platform consistency kræver disciplin

**Beslutning bekræftes** efter pilot-data og før Q1 2027 vertical slice.

### 14.4 Pilot-data der informerer native-prioritering

Vi måler **ikke** længere "om native er rigtigt" (det er besluttet). Vi måler **hvad vi skal bygge native** og **i hvilken prioritet**.

**Konkrete pilot-måleparametre:**

#### A. Kerne-loop adoption
- **Bobler oprettet** per uge — vækstrate
- **Events oprettet** per uge
- **Bubble-medlemskaber** per bruger (gennemsnit)
- **Active days** per bruger over 30 dage
- **Drop-off i onboarding** — hvor mange færdiggør profil?

#### B. Feature-engagement
- **QR scans** per uge (live event check-in)
- **DM-beskeder** sendt per uge
- **Bubble chat-beskeder** per uge
- **Radar-tap rate** — hvor ofte åbner brugere radar?
- **Saved contacts** per bruger

#### C. Word-of-mouth signaler
- **Invitations sendt** per bruger
- **Invitation conversion** — hvor mange klikker linket?
- **Conversion fra klik → installeret PWA** — hovedfokus
- **Signups med "indbudt af"** felt udfyldt
- **Sønderborg-only retention vs. udefra-trafik**

#### D. Friktion og fejl
- **Crashes** per session
- **Push notifications received vs. expected**
- **Device-specifikke issues** (logbog over Ulefone-style bugs)
- **Browser-specifikke issues** (Chrome vs. Safari vs. Samsung Internet)

**Hvad disse data fortæller os:**

- **A** → Hvilke features skal være KERNE i v1 native
- **B** → Hvilke features kan vente til v1.1+
- **C** → Hvor stor er PWA-friktionen reelt? Bekræfter eller udfordrer beslutningen
- **D** → Hvilke device-edge-cases skal native specifikt håndtere

**Datavalidering før native-rewrite:**

Hvis pilot viser:
- Kerne-loop fungerer (A er solid)
- Word-of-mouth virker trods PWA-friktion (C er positiv)
- Ingen kritiske strukturelle problemer (D er manageable)

→ Native-rewrite er bekræftet path med høj sikkerhed.

Hvis pilot overrasker:
- Lavt engagement på kerne-loop (A er svag)
- Ingen word-of-mouth selv blandt aktive (C signaler andet problem)
- Mange producent-bugs vi ikke kan fixe i PWA (D er kritisk)

→ Vi reviderer beslutning. Måske skal kerne-produkt fixes før rewrite. Måske er native-prioritet endnu højere.

**Praktisk:** Pilot-målingerne implementeres via `trackEvent()` der allerede er etableret i kodebasen. Vi tilføjer manglende events der mangler tracking, men ændrer ikke produktet for målingens skyld.

### 14.5 Arkitektur-principper for native-readiness

Nye features bygges med native-portability i tankerne:

1. **Forretningslogik må aldrig leve i UI-kode**
   Skal kunne flyttes til React Native uden refactor.

2. **Single source of truth for state**
   appState pattern fortsætter, ikke spredte globals.

3. **Dataflow: Supabase → service → state → UI**
   UI er rendering-lag, ikke data-fetcher.

4. **Realtime abstraktion**
   Subscriptions går gennem central handler, ikke direkte i screens.

5. **Skema-stabilitet**
   Undgå breaking schema changes der gør native-migration svær.

6. **Domain types eksplicit**
   Hver entity har klar shape (User, Bubble, Event, SavedEvent, etc.).

Disse principper er **også** god hygiejne for nuværende kodebase. Vi taber intet ved at følge dem nu.

---

*Dokument vedligeholdt som levende reference. Opdateres når strategiske beslutninger ændres.*
