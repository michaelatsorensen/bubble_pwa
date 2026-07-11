# Bubble — Feature Ideas & Backlog

> **Levende dokument.** Samlet idé-backlog adskilt fra teknisk gæld (TECH-DEBT.md), åbne spørgsmål (OPEN-QUESTIONS.md) og arkitektur-beslutninger (ARCHITECTURE-DECISIONS.md). Seedet 28. maj 2026 via systematisk gennemgang af tidligere samtaler (marts–maj 2026) for at genfinde idéer der aldrig blev formaliseret.
>
> **Status-nøgle:** ✅ Bygget · 📋 Spec'et (klar) · 💬 Diskuteret · ⏸️ Parkeret (besluttet udskudt) · ❌ Forkastet
>
> **Ikke udtømmende.** Tilføj løbende når nye idéer dukker op, så de ikke går tabt igen.

---

## Event-features

| Idé | Status | Note |
|---|---|---|
| **Agenda/program-scan → opret event** | 📋 Spec'et (7. apr) | `scan-event` Edge Function m/ Claude Vision: foto/screenshot af program → JSON (navn, dato, tid, sted, agenda, keywords) → pre-fill opret-event-form. Klient: `scanEventImage`/`handleEventScan`/`_applyScannedEvent`. ~2 timer, ~$0.01-0.03/scan. Spec klar — byg når første event-kunde beder om det. |
| **Batch-scan: ét program → flere child-events** | 💬 Diskuteret | Ét foto af konferenceprogram (8 sessioner) → opretter alle child-events. Konkret differentiator mod Brella/Luma (de kræver manuel CMS-indtastning). Udvidelse af scan-spec: prompt returnerer array + preview/rediger-UI. Rækkefølge: pilot → event-kunde → scanner → batch. |
| **Personlig tracking-boble** | 💬 Diskuteret | Egen boble hvor man scanner møder/events ind for at holde styr på dem. Bygger på scan-featuren. |
| **URL-scan af eventside** | 💬 Diskuteret | Indsæt link → Edge Function fetcher HTML → parser til event. Fremtidig udvidelse af scan. |
| **"Opret lignende" / gentagne events** | 💬 Diskuteret | Knap der kopierer eksisterende event. |
| **Auto-keywords fra agenda** | 💬 Diskuteret | Claude foreslår tags baseret på agenda-indhold. |

## Discovery & matching

| Idé | Status | Note |
|---|---|---|
| **Live-first prioritering** | ✅ delvist (verificeret) | Live-presence + live-banner bygget (`liveCount`, `appMode.set('live')`, home-live-banner). MEN eksplicit *sortering* af boble-listen efter live-antal er ikke bekræftet i koden — kan stadig være statisk medlemstal-sortering. Verificér/byg selve sorteringen. |
| **Explore Bubbles (topic → bubble → people)** | 💬 Diskuteret (v2.5) | Discovery via bobler ("gå ind i et rum") frem for ren tag-søgning. Infrastruktur findes (bobler m/ tags, medlemmer, presence) — mangler discovery-overflade. |
| **Community graph (person → boble → boble → person)** | 💬 Diskuteret (v3+) | Discovery-paths gennem netværket. Den langsigtede "community-discovery platform"-vision. |
| **Match-forklaringer** | ✅ Bygget (verificeret) | `sharedTags` vises som chips under match i home (b-home.js:2024) + shared_interest i radar/profil. BEMÆRK: bruger deprecated lilla (`var(--accent)`) — hører under ADR-008. |
| **Match scoring v3 (tier-baseret)** | ✅ Bygget (verificeret) | b-radar.js: "SMART MATCH ALGORITHM (v3 — Tier-based) — Replaces TF-IDF". 5 tiers + completeness, cap 25, common tags belønnes. **Hukommelse rettet (sagde fejlagtigt v2 TF-IDF).** |
| **Live filtrerbar dartskive ("levende boble")** | ✅ ~60% (verificeret) — winner-kandidat, FEEL BESLUTTET | Vision (magnet-metafor): justér filter → ikke-match frastødes radialt UD over kanten (accelererende), match tiltrækkes IND fra kanten mod plads, blivende dots glider til ny position (stærkere match → tættere på centrum). FINDES: `filterRadarHome` + drip-in på `.prox-dot` + re-render ved filterændring. MANGLER: exit-animation + diff-baseret render. **FEEL BESLUTTET (prototype maj 2026): "Blød/glidende"** — exit ~650ms cubic-bezier(0.4,0,0.6,1), enter ~650ms cubic-bezier(0.25,0.9,0.4,1), move ~600ms cubic-bezier(0.4,0,0.2,1). Passer strandglas-æstetik (rolige flydende bevægelser). Prototype-kilde: mockup-magnetic-dartboard.html (outputs). Byg som egen fokuseret session. |

## Engagement & onboarding

| Idé | Status | Note |
|---|---|---|
| **Profil-styrke gamification** | ✅ delvist | "Styrk din profil" m/ belønningsbeskeder ("Tilføj titel → unlock 5+ matches"). Profil-styrke meter findes. |
| **Social proof før signup** | ⏸️/❌ | "238 professionelle bruger Bubble" + anonymiserede profil-kort før signup. `screen-social-proof` blev dead code (onboarding forenklet til hurtigst muligt ombord). Kan genovervejes. |
| **Event-aware home banner** | 💬 Diskuteret — IKKE bygget (verificeret) | "Du er til TechBBQ · 12 personer her · 3 stærke matches". Ingen forekomst i koden. Reelt åben idé. |
| **Event-mode radar (top 5 først)** | 💬 Diskuteret | Vis top 5 matches, resten bag "vis flere" i event-kontekst. **Bør verificeres.** |
| **"Refresh members"-knap i live-view** | 💬 Diskuteret | Eksplicit safe fallback hvis realtime svigter. |

## Chat & messaging

| Idé | Status | Note |
|---|---|---|
| **In-line chat-oversættelse (hver bruger ser tråden på sit eget sprog)** | 💬 Diskuteret (11. jul) | Hver besked gemmes på afsenders originalsprog; når du ser tråden, oversættes andres beskeder til DIT sprog (din egen vises som skrevet). "Vis original"-toggle pr. besked. **Motor:** DeepL anbefalet — markant bedre til da/sv/no end Google/LibreTranslate, passer nordisk GTM. **Model-valg:** on-demand (tap "Oversæt" = billigst, ingen unødige kald) vs auto (sømløst, dyrere, kræver cache). **Cache:** `translations`-tabel (besked-id + målsprog → tekst) så hver besked kun oversættes én gang pr. sprog. **Hook-punkt:** `filterChatContent` (ét sted, dækker BÅDE DM + boble — samme ét-system-fordel). **Mangler i dag:** ingen sprog-kolonne på `profiles` (i18n gemmer kun `bubble_lang` i localStorage da/en), edge function-proxy (skjul API-nøgle, som scan-featuren), UI til original-toggle. Sprog-detektion klarer DeepL/Google selv. **Konceptuel tvilling til agenda-scan:** begge er "intelligent input→transformation" via edge function (scan: billede→event-JSON; oversættelse: tekst→andet sprog). **Timing:** post-pilot (Sønderborg-pilot er primært dansk — behov opstår ved nordisk skalering). Omfang ~ som #5/#6 (edge fn + betalt API + DB-ændring). |

## Revenue & premium

| Idé | Status | Note |
|---|---|---|
| **Profilvisninger (B2C freemium)** | 💬 Revenue lag 3 | Gratis=antal visninger, betalt=navne+kontekst. 29-49 DKK/md. Ikke bygget. |
| **"Browse anonymt" (premium)** | ⏸️ Besluttet (11. apr) | Anonym-toggle FJERNET fra UI under pilot (`is_anon` bevaret i DB). Genintroducér post-pilot som "browse uden at efterlade spor" under Profilvisninger-abonnement — ikke som "skjul navn". |
| **Corporate Bubbles** | 💬 Revenue lag 2 | Virksomhedsprofil m/ logo, envejs broadcast+reaktioner, analytics-dashboard, push, knytter events til corp. 199-2.499/md. Approval-proces overvejes mod spam. |
| **Verified Bubbles** | 💬 Revenue lag 4 / strategisk kerne | Org-ejerskab (overlever personaleskift), roller (ejer/admin/mod), verified badge. 1-25K/år. Den langsigtede moat. |
| **Event Bubbles (reverse QR)** | ✅ delvist | Reverse QR check-in findes. Premium event-pakke (deltagerindsigt, admin, fremmøde-tracking) er revenue-laget. |

## Allerede bygget (bekræftet)

| Feature | Note |
|---|---|
| **Personlig QR + reverse-onboarding** ✅ | connect_code, screen-qr-preview, 4 rekrutteringsveje (?qrt/?event/?join/organisk). Den vigtigste growth engine — bekræftet bygget. |
| **Drag-to-reorder home** ✅ | "Flyt ✦" → wiggle → gem rækkefølge i localStorage. |
| **ADR-009 invitations-tilbagekald** ✅ | v8.50. |

## Parkerede/udskudte (tekniske, se også TECH-DEBT.md)

- **Geolokation til match-scoring** (P2) — last_lat/lng + distance-multiplier. Ikke før piloten er landet.
- **onboarding_status kolonne** — eksplicit state frem for heuristik. Post-pilot.
- **File URL strategi** — getPublicUrl vs TTL. Uafklaret, post-pilot.
- **Custom SMTP** — emails kommer stadig fra Supabase-domæne.
- **ADR-008 lilla-token-migration** — struktureret, ikke eksekveret.
- **ADR-009 punkt 2: ejerskab request-flow** — besluttet, ikke bygget.
- **Invite-modal live-refresh** (P3) — sjælden kant, bevidst udskudt.

## Chat/realtime refaktor-kandidater (se TECH-DEBT)

- Split `openBubbleChat()` → `loadChatData()` + `subscribeChatRealtime()` (timing-risiko).
- Badge dedup m/ `_localId` (ghost-badges). **Memory: dmReduceMsg/bcReduceMsg dedup bygget — afklar overlap.**
- DM typing indicator + read receipts — nævnt i realtime-arkitektur-doc, men **IKKE bygget** (verificeret: ingen typing/read_receipt/seen_at i b-chat.js/b-messages.js). Reel åben idé hvis ønsket.

---

*Seedet 28. maj 2026 fra samtale-gennemgang (marts–maj). Flere "verificér om bygget"-poster bør tjekkes mod kodebasen og opdateres. Tilføj nye idéer her løbende.*

---

## Magnetisk dartskive — v1 spec (besluttet retning, maj 2026)

Konvergeret efter prototype + to runder eksternt input. Status: retning besluttet, byg som egen fokuseret session (ikke v1 endnu).

**Låst:**
- **UI:** Tilgang B (segment-skifter "For mig | Jeg søger"), ét aktivt filter ad gangen. "+" folder filter ind/ud (eksisterende mekanik).
- **Sortering: HÅRD.** Passer en profil ikke filteret, fises den HELT ud over kanten og væk. Vil man se vedkommende igen: tilbage til "Alle" eller vælg et filter de passer. (Besluttet for nu — revisitabel, Michael åben for andre modeller.)
- **Feel:** Blød/glidende easing (exit ~650ms cubic-bezier(0.4,0,0.6,1), enter ~650ms cubic-bezier(0.25,0.9,0.4,1), move ~600ms cubic-bezier(0.4,0,0.2,1)).
- **Motion-regel:** Ingen bevægelse uden betydning (guardrail mod UI-cirkus).
- **Scope-regel:** Ét aktivt intent ad gangen. INGEN kombinationsfiltre i v1.
- **Discovery-regel:** Chips er BREDE (sektorer), ikke præcise. Skal mappe til eksisterende scoring-taksonomi (sektorer/clusters/dynamic_keywords) — ALDRIG parallel ontologi.
- **Intent-kilde:** Profil = baseline (`dynamic_keywords`), radar = live override.
- **Eksplicit UDE af v1 re-score:** geo, activity, distance — kun intent driver re-scoring (undgå "AI sorting mystery machine").

**Leaning (ikke låst — afklar før build):**
- **Akse-asymmetri:** "For mig" = passivt medlemskabs-filter (ændrer hvem der vises, re-sorterer IKKE positioner). "Jeg søger" = aktiv re-scoring (reorganiserer hele relevans-rummet, intent magnetiseres mod centrum). Stærk mental model, men ikke endeligt bekræftet af Michael.

**ÅBENT — vend tilbage:**
- **Serendipitet:** Hård udrensning (valgt nu) vs tynd "halo" ved randen så radaren aldrig tømmes helt og bevarer uventede overlap. **Opdatering maj 2026:** efter at have testet interaktiv prototype (hård vs halo side om side) hælder Michael fortsat til HÅRD udrensning. Ikke 100% endeligt laast, men staerk og gentagen praeference — default til haard medmindre pilot viser tom-radar-problem. Feel-tuning, ikke arkitektur.

**Teknisk forudsætning (verificeret):** `calcMatchScore(myProfile, theirProfile, sharedBubbleCount)` læser intent fra `myProfile.dynamic_keywords` (Tier 5 cross-match). Live override kræver lille udvidelse: lade funktionen tage live-intent (samme mønster som planlagt geo-`distanceKm`-argument).

---

## Gemte events ("huskeliste") — afgrænset feature, ikke bygget (maj 2026)

Konvergeret efter samtale om bredere brugsscenarier. Status: idé fanget, byg som egen fokuseret session efter guide-arbejdet er landet. IKKE scope for nuværende pilot.

**Indsigten:** En bruger kan have et forhold til et event uden at deltage — "det her ser spændende ud, gem til senere". Det er ikke et nyt produkt; det er en udvidelse af den eksisterende skelnen `saved_events` vs `bubble_members` (gemme er ikke det samme som at vaere medlem). Mekanikken ligger allerede i datamodel-taenkningen, men er IKKE bygget.

**Verificeret maj 2026:** Ingen `saved_events`-tabel-brug eller UI findes i koden. Events haandteres i dag via `bubble_members` (deltag) + dato-sortering (kommende/forbi). Dette er altsaa en reel ny feature, ikke en faerdiggoerelse.

**Afgraenset scope hvis bygget:**
- `saved_events`-tabel + migration (Michael koerer SQL, ikke Claude). Felter ca.: user_id, bubble_id (event), saved_at. RLS som saved_contacts.
- Gem-knap paa event-bobler (separat fra "Bliv medlem"/"Deltag" — bevarer gemme != medlemskab).
- "Gemte events"-visning. Logisk hjem: Profil ved siden af "Gemte" kontakter (egen fane/sektion), ELLER paa Bobler. Afklar placering foer build.
- Roerer kerne-datamodel (events) — derfor egen session, ikke en hurtig tilfoejelse.

**Bevidst fravalgt (samme samtale):** Bubble som familie-/faelleskalender-app eller generel huskeliste-app for "almindelige mennesker". Begrundelse: det er et SEPARAT produkt med modsat mekanik — et lukket rum mellem mennesker der allerede kender hinanden, hvor radar-matching + QR check-in + netvaerksopdagelse er irrelevant. At forfoelge det udvander den fokuserede positionering (professionel netvaerks-PWA, ad-fri) og tvinger to historier paa en ny bruger samtidig. Den ENE genbrugelige del af ideen er "gem events" ovenfor — resten holdes ude.

---

## Social proof-discovery: foreslå bobler via gemte kontakters medlemskaber (maj 2026)

Stærk produktindsigt fra Michael. Status: idé fanget + teknisk fundament verificeret. Egen fokuseret session efter guide-arbejdet. IKKE scope nu.

**Indsigten:** Brugere vil opdage nye netværk og events gennem deres gemte kontakters bobler. "Folk jeg har gemt (= aktivt vurderet relevante) er med her" er et langt staerkere relevans-signal end ren tag-matching. Det er social proof som opdagelsesmotor — samme adfaerd der driver LinkedIn ("dine forbindelser deltager i...") og Meetup ("medlemmer du kender"). Forstaerker det eksisterende flywheel: gemte kontakter → deres bobler → nye netvaerk/events → flere relevante folk → flere gemte kontakter.

**Den centrale erkendelse — det er et OMVENDT signal, ikke nyt plumbing:** I dag bruger `calcMatchScore(myProfile, theirProfile, sharedBubbleCount)` (b-radar.js:438, Tier 4 i smart match v3) shared-bubble-count til at ranke PERSONER hoejere. Denne idé vender det om: gemte kontakters bobler → foreslaa BOBLER. Samme datagrundlag (`saved_contacts` ⋈ `bubble_members`), modsat retning.

**Verificeret fundament (maj 2026):**
- `saved_contacts` findes og bruges (b-profile.js).
- `savedBmMap` bygger allerede mapping over delte bobler pr. gemt kontakt (b-profile.js:835-841) — naesten praecis den join der skal bruges, bare aggregeret pr. boble i stedet for pr. person.
- `bubble_members` har status/role; `bubbles` har visibility (public/private/hidden).
- **Udforsk er i dag REN kronologisk** (`order('created_at')`, b-bubbles.js:134) — INGEN relevans-ranking. Der er et tomt felt at fylde; idéen kaemper ikke mod et eksisterende system.

**Afgraenset scope hvis bygget:**
- Query: for hver boble bruger ikke er medlem af, tael hvor mange af brugerens gemte kontakter der er aktive medlemmer.
- Brug tallet som ranking-signal i Udforsk (erstatter/supplerer kronologi) ELLER som egen "Fordi du kender X"-sektion.
- Roerer kerne-discovery — derfor egen session.

**MAA AFKLARES FOER BUILD (privacy):**
1. Navngivet social proof ("Anna er med her") vs aggregeret ("3 af dine kontakter er med"). Navngivet er staerkere men mere foelsomt.
2. **Haard regel:** en gemt kontakts medlemskab af en SKJULT eller PRIVAT boble maa ALDRIG laekke den bobles eksistens til brugeren. Social-proof-signalet maa kun gaelde bobler brugeren allerede selv kan se (offentlige, eller private brugeren har adgang til). Skjulte bobler er helt ude.
3. Skal en kontakt kunne fravaelge at optraede som social proof?

---

## Privat note på gemt kontakt (maj 2026)

Michaels idé. Status: fanget, lille afgrænset feature — kan passes ind ved siden af hovedsporet. IKKE bygget.

**Indsigten:** Lad brugeren skrive en PRIVAT note på en gemt kontakt — fx "mødte til Gate21-event, arbejder med solceller, ville intro'e mig til Lars". Kun synlig for brugeren selv, deles ALDRIG med personen. Gør netvaerket brugbart over tid (huske HVORFOR man mødte nogen) frem for bare en liste af navne. Passer praecist til Bubbles formaal.

**Verificeret maj 2026:** Ingen private_note/personal_note/contact_note findes i koden. Helt ny feature.

**Afgraenset scope hvis bygget:**
- `note` tekst-kolonne paa `saved_contacts` (Michael koerer SQL). RLS: kun ejer kan laese/skrive sin egen note.
- Tekstfelt paa person-sheet / gemte-kontakt-visning (rediger inline).
- Write gennem dbActions (nyt: updateContactNote, eller udvid saveContact).
- Privacy triviel: noten lever paa brugerens side af relationen, deles aldrig. Roerer IKKE kerne (radar/matching).

**Mulig kobling:** Hvis social-proof-discovery (gemte kontakters bobler) bygges, kunne noten vises som kontekst dér ogsaa. Men start simpelt — bare noten paa kontakten.

---

## Profil-dashboard med tidslinjer (som admin-panel) — VENTER på data (jun 2026)

Michaels idé: byg brugerens eget Dashboard (Profilvisninger/Du har gemt/Bobler/Stærke matches) med tidslinjer som admin-panelet — vis HVORNÅR aktiviteten skete, ikke kun totaler.

**Bevidst udskudt (jun 2026):** En enkelt brugers egne tal er små (fx 13 profilvisninger over måneder). Uge-grafer over så små tal ser næsten tomme ud = ringere oplevelse end totalen "13". Admin-grafer virker fordi de aggregerer ALLE brugere (store tal). Beslutning: VENT til pilot-aktivitet er stor nok til at per-bruger-grafer er meningsfulde. Genovervej når brugere har nok historik.

**Når det bygges:** genbrug `_dashBucketWeeks` (admin, nu kontinuerlig tidslinje med nul-uger pr. v8.97). Overvej måned- frem for uge-granularitet for per-bruger. Afklar hvilke metrics der egner sig (visninger + gemte har timestamps; bobler/matches er mere tilstand end aktivitet).

---

## VISION-SPOR: Bubble som personligt arrangeret rum (én tile-skærm) — udforsket jun 2026

**Status:** UDFORSKET (4 prototyper bygget), bevidst IKKE planlagt til build. Vision-spor, ikke build-spor.

**Idéen:** I stedet for fire faste skærme (Home/Bobler/Beskeder/Profil) → én skærm hvor hver funktion er en widget/tile. Bruger vælger blandt ~5 layout-skeletter (Fokus/Balance/Liste/Galleri/Kompakt) og kan selv placere widgets via træk-og-slip. Radaren som dominerende, levende hero-widget der ekspanderer til fuldskærm. Æstetik inspireret af monokromatisk moodboard ("how to look expensive — no visual noise"), men i Bubbles palet (isblå/teal/strandglas, ægte gradient-wordmark).

**Prototyper (i /mnt/user-data/outputs/, ikke i repo):**
1. `bubble-tile-home-prototype.html` — rolige ikon-tiles, åbner fuldskærm
2. `bubble-tile-brickwork-prototype.html` — blandede størrelser (forbandt-mur), dominerende radar m. ægte preview
3. `bubble-moodboard-style-prototype.html` — tro mod moodboard (mørke brand-tiles, foto, hex-palet, lyse kort) — bedst som LANDING PAGE-udtryk
4. `bubble-custom-layout-prototype.html` — 5 skeletter + træk-og-slip widget-placering

**Hvorfor det er værd at huske:** Nu (lille brugerskare) er radikale navigations-ændringer billige — ingen stor brugerbase låst til den nuværende form. Modenheden i forståelsen af Bubble (efter prod→next-iteration) gør idéen klar at se. Personligt layout giver ejerskab + løser at forskellige brugertyper vil have forskellige ting forrest (event-bruger=radar stor; netværker=beskeder/gemte forrest).

**Hvorfor det er POST-PILOT (ikke "ikke godt nok"):**
- Forudsætter at vi VED hvad folk gør med Bubble. Personligt layout giver kun mening hvis brugere har præferencer at arrangere efter — dem kender vi først efter pilot. Pilot kan vise: alle bruger kun radar (→ 5 skeletter er overkill) ELLER vildt forskellige mønstre (→ personligt layout er perfekt).
- Ægte stor ny funktion: layout-skeletter + widget-placering + gemme valg + alle kombinationer × skærmstørrelser. Ikke en tilføjelse — nærmest ny app-arkitektur.
- Ville erstatte hele den nuværende fire-skærms-navigation (navState.screen, nav-stack, back-håndtering, loadX-funktioner er alle bygget om de fire skærme).
- Bryder no-new-features-før-pilot disciplinen hvis bygget nu.

**Risiko at undgå:** at udforskning bliver til "omskriv alt før launch" → så får vi aldrig den pilot-data der skal afgøre om idéen er rigtig. Pilot er IKKE forhindring på vejen mod det egentlige produkt — pilot er det der FORTÆLLER os hvordan det egentlige produkt skal se ud.

**Hvis det genoptages:** kræver standard-layout der virker uden tilpasning (valg-byrde-fælde: mange vil ikke indrette, de vil bare have noget der virker). Teknisk kerne at validere først: kan radar-hero rendere ægte realtids-radar OG ekspandere glat til fuldskærm uden gen-tegning.

---

## Beriget forside (v5) — additiv, IKKE ny arkitektur — QR-quick-access mest pilot-relevant

**Status:** UDFORSKET (prototype `bubble-enriched-home-prototype.html`). Adskilt fra det store vision-spor ovenfor — DETTE rører IKKE navigationen.

**Idéen:** Berig den eksisterende Home-skærm med widgets oven på radaren, UDEN at røre fire-skærms-navigationen:
- **Radar dominerer** (live-puls + ægte preview) → tap åbner fuld radar med filtre. Bevarer Bubbles sjæl: mennesker først.
- **QR-bånd:** to separate widgets — "Scan" (isblå) + "Min QR" (teal) — lige under radaren.
- **Stats-bånd:** "Din Bubble-uge" overblik (visninger/har gemt dig/du har gemt/profilstyrke).
- **Quick-bånd:** Bobler + Beskeder nøgletal.
- Bundnav + de fire skærme UÆNDRET.

**Hvorfor anderledes størrelse end vision-sporet:** Additiv forbedring af Home, ikke omskrivning. Kunne bygges uden at vælte navState.screen/nav-stack/loadX-funktioner.

**Mest pilot-relevante del = QR-quick-access.** Begrundelse: i fysisk event-situation (stå foran nogen, forbind NU) er scan/vis i dag gemt i lille topbar-ikon. Egen widget på forsiden = ét tryk. Løser reel friktion i præcis den situation Bubble er bygget til. Stats + quick-bånd er mere "nice to have". **Overvej QR-quick-access tæt på pilot** (lille, additiv, høj værdi i kernescenariet) — men respektér stadig no-new-features-disciplinen; beslut bevidst.

**Forhold til vision-sporet:** v5 er det pragmatiske mellemtrin. Den store vision (sløjfe de fire skærme → customizable home-miljø) er destinationen; v5 er et skridt der kan tages additivt nu/snart uden at committe til hele omskrivningen.

### Reference & case study: Windows Phone / Live Tiles (tilføjet jun 2026)
Konceptet stammer (uden at det var bevidst) fra Windows Phones Live Tiles: hjemskærm af forskellige-størrelse fliser, hver et levende vindue ind i en funktion, tap → fuld visning. Præcis "radar-widget viser faktisk situation, tap for fuldskærm".

**Læring — men med VIGTIG skalering-forskel (Michaels pointe):** Windows Phone var et OPERATIVSYSTEM → bad folk genlære HELE telefonen (alle vaner, hele app-økosystemet) = enorm barriere, og det dræbte platformen trods rosende anmeldelser af selve designet. **Bubble er en APP** → beder kun om at folk lærer ÉN apps navigation, noget de gør ved enhver ny app. Risikoen er IKKE samme størrelsesorden. Man kan ikke "floppe som platform"; i værste fald en app-navigation der ikke faldt i smag — som kan rettes.

**Hvad der STADIG holder (dæmpet):** De to risici (intuitivt vs. forvirrende; anderledes-for-anderledeshedens-skyld) gælder på app-niveau, men som LAV barriere (ét øjebliks orientering), ikke Windows Phones HØJE (hele din digitale hverdag). Førstegangsbruger skal stadig forstå tiles straks, ellers bounce.

**Revideret indramning:** Idéen er mere rimelig end en ren Windows-Phone-sammenligning antyder. Stadig post-pilot — men fordi den fortjener at blive INFORMERET af pilot-data (hvordan bruger folk faktisk Bubble), IKKE fordi den er farlig. "Post-pilot fordi vi vil vide mere", ikke "post-pilot fordi det er risikabelt". At teste nu mens brugerskaren er lille er billigt.

---

## Guest check-in / gaest-registrering (halvbygget infrastruktur — IKKE del af loesningen nu)

**Besluttet 3. juli 2026:** Ikke en del af Bubble pt. Anon-INSERT-policyen paa guest_checkins
droppes (ubrugt aaben doer — ingen oprettelses-flow findes).

**Use case (hvis den genoptages):** Event-deltagere UDEN Bubble-konto taelles med i eventets
fremmoede og deltager-rapport. Passer i Event Bubbles B2B-laget (attendee insights daekker
hele salen, ikke kun app-brugere).

**Status i kodebasen:** HALVBYGGET.
- FINDES: scanner-flow (b-live: `?guest=<id>` QR -> opslag -> saet checked_in_at -> "checket ind via Guest QR")
- FINDES: rapport-integration (b-bubbles download medlemmerliste henter ogsaa guest_checkins)
- MANGLER: oprettelse (ingen formular/side/kode skaber gaest-raekker med navn + QR)
- RLS: owner_admin (ALL for boble-ejer/admin) staar og daekker scan+rapport. Anon-INSERT droppet.

**Hvis featuren bygges faerdig:** Gaest-oprettelse boer ske af VAERTEN (authenticated admin —
allerede daekket af owner_admin) ELLER via maalrettet ny policy med `checked_in_at IS NULL`
i WITH CHECK (registrering maa aldrig kunne forud-checke sig selv — check-in-tal er pilot/
event-metrik og skal kun saettes af vaertens scan).

## Boble-tags fra taggdatabasen + tag-baseret boble-eksponering (jul 2026, fra device-test-session)

**Idé (Michael):** Brug de eksisterende 196 tags (4 kategorier, tag-data.js) som valgbare
noegleord ved boble-oprettelse i stedet for/sammen med fri tekst. Boble-tags kan saa overlappe
med personers valgte tags, og bobler med hoejt overlap fremhaeves/eksponeres som mere
relevante end andre.

**Hvorfor staerk:**
1. Lukker semantisk hul: boble-keywords er i dag fri tekst (cbChips), person-tags er
   strukturerede — de kan ikke tale sammen. Samme database goer boble<->person-overlap
   beregneligt med den EKSISTERENDE cluster-logik i calcMatchScore (tier 3).
2. Genbruger onboarding-tag-vaelgeren — ingen ny interaktionsmodel.
3. Eksponering = organisk relevans-ranking (ikke pay-to-win) — passer tillids-positionering
   og forlaenger STRATEGI 16.7's "ny-relevans"-spor til bobler.

**Designvalg besluttet ved idé-fangst:**
- HYBRID: tag-vaelger primaer ("vaelg 3-5 tags") + valgfri fri-tekst-chips til det unikke
  (fx "Havnefest 2026"). Kun strukturerede tags indgaar i scoring.
- Eksponering virker i Discover-ranking + Home-anbefalinger. IKKE radaren (person<->person).

**Timing: POST-PILOT.** To grunde: (1) create-flowet er netop device-testet — ombygning nu
invaliderer testen; (2) det er reelt en match-motor-aendring (ny scoring-dimension), og
piloten skal maale den NUVAERENDE motor. Byg efter HoS-data er i hus.

**Teknisk skitse:** keywords-kolonnen kan beholdes (text[]), tags gemmes samme sted men
valideres mod tag-databasen ved oprettelse. Discover-query scorer overlap mod currentProfile
tags via _tagToCluster. Migration: eksisterende fri-tekst-keywords beholdes som fri tekst.

## Personlige radar-filtre (custom filters) — jul 2026, fra design-session

**Idé (Michael):** Valgfri profil-sektion hvor brugeren udpeger interesser/tags de gerne vil
MØDE hos andre ("interesser jeg vil matche på"). Hvert udpeget tag bliver til et individuelt
taend/sluk-filter paa radaren, saa brugeren selv styrer praecist hvilke profiler der vises.

**Afklaret ved idé-fangst:**
- Tag-kilde: HYBRID — vaelg fra de 196 eksisterende tags + tilfoej egne i fri tekst.
- Radar-adfaerd: ét filter PER tag (taend/sluk hvert enkelt uafhaengigt). Radaren viser kun
  profiler der matcher mindst ét taendt filter.
- KUN VISNING — filtrerer radaren, paavirker IKKE match-scoren. Bevidst valg: forudsigelig,
  gennemskuelig adfaerd, ingen skjult algoritme-effekt.

**Hvorfor staerk:** giver brugeren AGENCY over radaren uden at komplicere matching-logikken.
"Jeg bestemmer selv hvem der er relevant" passer Bubbles positionering (bruger i kontrol,
ikke algoritmen). Udvider et moenster der ALLEREDE findes visuelt (radar-filter-panel:
Alle/Faelles interesser/Staerke matches + interesse-chips).

**Design-prompt skrevet** (glas-aestetik, DEL 1 profil-sektion tom+fyldt, DEL 2 radar-filtre
taendt/slukket med adskillelse mellem indbyggede og personlige). Afventer mockup fra Design.

**Teknisk skitse (naar godkendt):** ny valgfri profiles-kolonne `match_interests` text[];
profil-sektion genbruger onboarding-tag-vaelger + fri-tekst-chips; radar-filter-udvidelse der
filtrerer _homeDartboardProfiles paa tag-overlap. Roerer IKKE calcMatchScore.

**Relateret:** roerer samme underliggende tema (tag-baseret relevans) som "Boble-tags fra
tag-database" ovenfor. Post-pilot kunne de to taenkes sammen til et sammenhaengende
interesse-graf-system — men hver idé staar fint alene. Begge POST-PILOT.

**UI-retning:** glas-design (mörk glasmorfisme) er den besluttede vej for UI fremover
(design-vaerktoej-eksploration jul 2026). Ikke implementeret endnu — separat beslutning.
