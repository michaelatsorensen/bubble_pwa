# HOS-SPRINT — Den tilbagevendende brugers audit (3. juli 2026)

Formaal: Onboarding/indgang er poleret intensivt. Dette dokument daekker DEN ANDEN halvdel —
den erfarne, tilbagevendende brugers kerneloop — som afgoer om HoS-deltagere stadig er der
ugen efter. Alt herunder er VERIFICERET I KODEN (fil:linje), ikke antaget.

**STATUS (3. juli 2026):** Bubble er teknisk klar til kontrolleret HoS-pilot paa kode-/RLS-
niveau. Der er ikke kendte kode-blockers tilbage PAA STATISK REVIEW-/VERIFIKATIONSNIVEAU.
Endeligt go afhaenger af device-test af QR, reverse QR og DM-delete regression — kode kan
vaere logisk rigtig men stadig foele forkert paa en telefon (toast, reload, scanner-genstart,
tilbage-navigation, PWA-state). Pilotkandidat-build: **v10.09** (frys medmindre device-test
finder noget reelt).

---

## 1. Den tilbagevendende brugers kerneloop (kortet)

| Loop | Indhold | Status |
|---|---|---|
| QR | Vis min QR / scan person / reverse QR (event) | SOLID |
| Join | Links, invitationer, anmodninger | SOLID |
| Besked | DM + boblechat | SOLID (smaa gaps, se 3) |
| Radar | Aabn -> tap -> preview -> gem -> besked | SOLID (poleret v10.03-08) |
| Kontakt | Gemte, stjerner (private), opfoelgning | SOLID (opfoelgnings-motor = post-HoS, STRATEGI 16.7) |
| Live | Check-in/ud, presence | SOLID |

---

## 2. VERIFICERET SOLIDT (med evidens)

### QR-loopet
- Scanner haandterer 3 QR-typer: guest= (b-live:545), qrt= og profile= (b-live:581)
- **Sikkerhedsmodel korrekt**: kun token-verificeret identitet (qrt) kan udloese check-in
  (`userIdFromToken`-gate). Udloebet/ugyldig token AFBRYDER — falder IKKE igennem til
  profile= (tamper-beskyttelse). profile= er KUN gem-kontakt.
- Reverse QR: `checkin_mode` self/scan paa events (b-bubbles:917), Mode B host-scan
  respekterer mode (b-bubbles:1415ff)
- 5s scan-debounce mod dobbelt-scan (b-live:923)
- openMyQR: fejlet token-insert falder korrekt tilbage til profil-URL (fixet v10.02)

### Besked-systemet — DM (b-realtime.js)
- Historik: limit(100), nyeste foerst (b-realtime:1011ff)
- **Laest-markering VIRKER**: read_at saettes ved traad-aabning (806) OG for realtime-
  indkommende i aaben traad (895)
- **Laest-kvitteringer**: dobbelt-flueben via dmUpdateReceipts (485-486) — realtime-opdateret
- Rediger + slet egen besked via long-press-menu (1159/1171/1178) med iOS-selection-guard (1085)
- Ulaest-badge: unreadState = single source of truth (b-messages:11-60), recount mod
  read_at IS NULL, dot paa nav
- dmReduceMsg centraliserer alle 6 insert-stier m. dedup (arkitektur-moenster)
- GIF (Tenor) + fil-upload m. bucket-lofter

### Besked-systemet — Boblechat (b-chat.js)
- Historik: limit(50) (1021)
- Rediger MED immutabel historik (bubble_message_edits, 1257) — RLS-verificeret audit-log
- Slet m. bekraeftelse (1414/1434)
- last_read_at per boble saettes ved aabning (324/916) -> ulaest-styring
- Fejl-tilstand viser retry, ikke falsk tom chat (F3-fix v9.97)
- Realtime null-guards (F5-fix v9.97)

### Join-loopet
- joinBubble centraliseret via dbActions m. result.ok-semantik (strammet som planlagt)
- Ejer-notifikation via broadcast-moenstret (subscribe->send->unsubscribe 2s)
- Deeplink: ?bubble= -> flowSet('pending_join') ved boot (b-boot:512) — link-deling virker
- Auto-join ved oprettelse: retry + aerlig fejl (F6-fix v9.96)
- _joinInFlight mutex mod dobbelt-join (b-bubbles:1353)

---

## 3. GAPS mod "forventet standard" — aerligt klassificeret

### Pilot-acceptable (dokumenteret valg, ingen handling foer HoS)
- **Ingen typing-indikator** (DM/BC). Nice-to-have; koster realtime-trafik. Post-pilot-kandidat.
- **Ingen pagination/hent-aeldre**: DM stopper ved 100, BC ved 50. Aeldre beskeder
  utilgaengelige i UI. For pilot-volumen irrelevant; MAA fixes foer boblechats bliver aktive
  over uger. -> P2-backlog: "load more"-knap.
- **Laest-kvittering findes i DM men ikke BC** — bevidst rimeligt (gruppe-receipts er stoej).
- **DM slet = slet lokalt for begge?** dmDeleteMsg sletter raekken (begge ser den forsvinde).
  Standard i 2026 er ofte "slet for mig"/"slet for alle"-valg. Pilot-ok; notér som senere UX-valg.

### Boer verificeres manuelt paa device (kan ikke laeses ud af kode)
- Scanner-genstart efter succes/fejl (kamera-loop robusthed)
- Push modtages naar app er lukket (iOS PWA-vilkaar)
- Fil-upload paa mobilnetvaerk (langsom forbindelse)

---

## 4. Polish-spoergsmaal identificeret undervejs (til overvejelse, ikke blockers)

1. DM-traaden: viser den dato-skillelinjer mellem dage? (lang historik-laesbarhed)
2. BC: kan man svare/citere en besked? (gruppe-samtale-navigation — post-pilot)
3. Notifikations-bakken: TTL-vinduer per type findes (b-notifications:13) — er de kalibreret?
4. Gemte kontakter: sorterings-/soegemuligheder ved 50+ kontakter (post-HoS naar data findes)
5. Radar: cap 25 — kommunikeres det til brugeren at der kan vaere flere?

---

## 5. Manuel device-tjekliste (Michael, foer HoS — suppleret fra eksternt review)

QR-loop:
- [ ] Min QR: aabn, scan fra anden enhed -> gem-kontakt virker
- [ ] Min QR m. udloebet token (vent 10 min) -> scanner viser udloebet, IKKE check-in
- [ ] Event scan-mode: host scanner deltagers qrt -> check-in registreres
- [ ] profile=-QR kan IKKE checke ind (kun gemme)
- [ ] Scanner genstarter korrekt efter baade succes og fejl

Besked-loop:
- [ ] DM: send/modtag realtime, dobbelt-flueben opdaterer naar modtager aabner
- [ ] DM: rediger + slet via long-press (iOS: ingen selection-konflikt)
- [ ] DM: ulaest-dot forsvinder naar traad aabnes
- [ ] BC: rediger viser "redigeret", historik intakt; slet m. bekraeftelse
- [ ] Fil + GIF sendes begge veje

Join-loop:
- [ ] Del boble-link -> ny bruger lander i pending_join -> medlem efter onboarding
- [ ] Invitation: send, accepter, afvis — alle tre stier
- [ ] Dobbelt-tap paa join giver IKKE dobbelt medlemskab

Data-oprydning (fra eksternt review):
- [ ] Fjern asdf/test-brugere og gamle test-bobler
- [ ] Opret 1 HoS-boble + 1 feedback-boble, 2-4 friske opslag m. testinstruktioner
- [ ] Skim fejl-loggen (30/30 fuld) i Super admin

---

## 6. Naeste byggetrin i sprintet (fra STRATEGI 16.10)

1. Home-widget (Kombi 1) — venter paa 2 valg: 4. tal (Matches vs Nye forbindelser/uge)
   + live-tilstand i v1?
2. profile_views.source-kolonne (log nu, vis ikke)
3. "Forbindelser skabt"-metrik (event-ejer B2B) — ren beregning
4. STRATEGI 15 (drift-modenhed) — tekst mangler fra anden traad

---

## 7. EKSTERNT REVIEW #2 — verifikation (3. juli 2026)

Review rejste 3 store hypoteser om tilbagevendende-bruger-flows. Alle verificeret mod kode
(ikke antaget). Resultat:

- **URL-inkonsistens ?event= vs ?join=**: DELVIST reel. To former findes, MEN begge
  brancher paa b.type (ikke parameter) i baade intern scanner (b-live:1030) og boot
  (b-boot:508 "not by delivery method"). Ikke troværdighedstruende bug. -> beslutning nedenfor.
- **Reverse QR ufaerdig for eksisterende brugere (P0)**: AFKRAEFTET. checkPendingJoin
  (b-bubbles:1401ff) haandterer eksplicit Mode B: joiner, behandler joined_now OG
  already_member som succes, holder event_flow -> showEventReadyQR. Kommentar siger ordret
  "join + show ready QR". Reviewet fejllaeste flow-flag-delegeringen.
- **DM-delete falsk succes (P0)**: REEL — RETTET v10.09. Begge delete-stier ignorerede
  Supabase { error } og opdaterede UI uanset (samme klasse som F6/F10/QR-token). dmDeleteMsg
  + convConfirmDelete tjekker nu error foer DOM-aendring; hel-samtale kraever BEGGE retninger ok.

Laering: statiske reviews af flow-flag-arkitektur giver plausible HYPOTESER, ikke fund —
1 af 3 P0'er var reel, 1 delvist, 1 forkert. Verificér foer fix. (Reviewet roste ogsaa
typing-indikator som styrke — den findes IKKE i koden; reviewet over- og undervurderer.)

## 8. URL-FORM BESLUTNING (3. juli 2026)

Bubble understoetter p.t. BEGGE `?join=<bubbleId>` (QR-modal + primaer boot-haandtering, 36
forekomster) og `?event=<bubbleId>` (delt link shareBubbleLink, 5 forekomster). Begge former
anvender i praksis UUID'er og routes videre efter BOBLETYPEN, ikke efter parameter-navnet.

- **Besluttet: bevidst accepteret parallelitet. Konsolideres IKKE foer HoS.** Fungerende link-/
  QR-flow prioriteres over kosmetisk URL-oprydning — at rydde op nu kan introducere regression
  i et flow der virker. Laengde er ligegyldig (links deles digitalt/QR, ingen taster UUID).
- **REGEL: Der maa IKKE tilfoejes en tredje URL-form foer de eksisterende to er konsolideret.**
  De to nuvaerende former er ikke farlige — men parallelitet BLIVER farlig naar en tredje
  variant kommer til. En tredje form uden forudgaaende konsolidering er forbudt.
- join_code-kolonnen (korte koder) findes i DB men SAETTES ALDRIG af kode — inaktiv feature
  (som guest check-in). Derfor INGEN kollisionsrisiko trods `.limit(1).maybeSingle()`-resolve.
- **Fremtidig designregel** (hvis korte koder nogensinde bygges): skal vaere AUTO-genererede,
  unikke og databasebeskyttede med UNIQUE constraint. ALDRIG frit valgte navne som "havnefest"
  (kollisionsrisiko: to "havnefest"-bobler -> forkert match). Resolver maa IKKE bruge limit(1)
  som kollisionshaandtering — databasen skal garantere unikhed.

## 9. HOS PRE-FLIGHT — P0/P1/P2 (struktur fra eksternt review)

### P0 — manuelle test-gates, SKAL vaere groenne (verificerbare tilstande)
- [ ] Gyldig QR scanner korrekt
- [ ] Udloebet QR afvises korrekt
- [ ] profile= kan IKKE checke ind
- [ ] qrt= kan checke ind
- [ ] Reverse QR viser ready-QR for eksisterende bruger
- [ ] Reverse QR virker for ny bruger efter onboarding
- [ ] DM-delete sletter IKKE visuelt hvis DB afviser (throttle netvaerk for at teste)
- [ ] Slettet DM bliver IKKE genskabt ved reload
- [ ] Hidden bubble kan IKKE aabnes af uvedkommende
- [ ] Inviteret bruger KAN aabne hidden bubble

### P1 — bør testes/fixes foer HoS
- [ ] DM-delete regression: enkeltbesked + hel samtale, normal + daarlig forbindelse + reload
- [ ] QR-state machine matrix: samme event via delt link / intern scanner / QR-modal ×
      logged-in / logged-out / allerede medlem / ikke-medlem
- [ ] Kurateret testdata: ingen asdf/test-bobler, 1 HoS-boble, 1 feedback-boble, friske
      posts, realistiske profiler
- [ ] Device-test: iPhone Safari/PWA + Android Chrome/PWA + desktop Chrome (QR, reverse QR,
      link join, DM-delete, reload)
- [ ] Pilot-script: skriv PRAECIS hvad testerne skal goere de foerste 10 min (ellers tester
      de tilfaeldigt og de rigtige flows bliver ikke ramt)

### P2 — accepteret til HoS, staar i backlog
- Konsolidér ?event=/?join= (besluttet: ikke noedvendigt, se 8)
- Chat/DM pagination (DM >100, BC >50)
- Typing-indikator findes IKKE — maa ikke loves
- Public file URLs for DM/chatfiler -> private bucket + signed URLs
- select('*') teknisk gaeld
- CSP/inline handlers
- Search i DM/bobler
- Tilbagevendende-bruger shortcuts: seneste boble/event/kontakter

*Vedligeholdt som sprint-reference frem mod HoS. Opdateres naar punkter lukkes.*

---

## 10. EVENT JOIN+CHECKIN FLOW (besluttet 5. juli 2026, device-test)

**Beslutning: gaester joiner + checker ind i ÉT trin for events. INGEN anmodning foerst.**

Spoergsmaal der opstod: skal en gaest til et PRIVAT event foerst anmode om medlemskab,
saa checke ind? Svar: NEJ.

**Hvorfor:** Til et fysisk event maa der ikke vaere godkendelses-ventetid ved doeren. Koden
loeser det allerede: joinBubble har `_openJoin = ... || _isEventLike` (b-utils.js) — event-typen
omgaar anmodnings-kravet, saa selv et PRIVAT event joiner direkte. Kun private NETVAERK
(ikke-events) kraever anmodning (requestJoin).

**Betydning af synlighed FOR EVENTS:**
- Privat event = vises ikke offentligt i Discover, men gaester med link/QR joiner direkte
  (IKKE "kraever godkendelse" som for netvaerk).
- Offentlig event = synlig i Discover + direkte join.
- Skjult event = kun via invitation.

**Deltager-flow (self-checkin event):** gaest moeder event via QR/link -> _renderEventDeepLink-
Modal -> "Join and go live" (ikke-medlem) joiner + checker ind samlet, ELLER "Check ind"
(allerede medlem). Fejl haandteres korrekt (fejlet checkin aabner IKKE chat som checket ind —
P0.2). Ingen to-trins-friktion.

**NB efterladt uklarhed (ikke blocker):** en arrangoer der vaelger "Privat" til et event
forventer maaske at godkende folk — men for events betyder privat kun "skjult fra Discover".
Overvej post-pilot om synligheds-labels boer vaere event-specifikke for at undgaa forvirring.

---

## 11. LILLA-SWEEP (planlagt, EFTER test-scenarierne — 5. juli 2026)

Prod-rest: lilla (#7C5CFC / rgba(124,92,252) / #6366F1 / --gradient-primary) findes ~135
steder. Guiden udfaser lilla i UI-chrome (brug isblaa eller teal). ALLEREDE rettet loebende
under test: pill-accent (v10.27), radar center-node (v10.29), Alle-tab (v10.30).

**VIGTIGT — ikke en blind find-replace.** Kortlaegning viste at lilla har FIRE roller der
skal behandles forskelligt:
1. Fladefarve (knapper/badges) -> isblaa er rigtigt
2. Tekstfarve (color:var(--accent), ~29 steder, ofte paa lys baggrund) -> isblaa er FOR LYS
   (daarlig kontrast) -> moerkere nuance eller behold
3. Avatar/identitet (person-avatar-ring, pp-avatar, avColors/proxColors) -> TILLADT
   UNDTAGELSE, roeres IKKE (guiden: avatar-identitetspaletter er ok)
4. PDF/rapport (generateEventReport .header/.section-title) -> TILLADT UNDTAGELSE

**Naegle-variabler:** --accent (#7C5CFC) bruges baade som flade OG tekst -> kan ikke bare
skiftes. --gradient-primary/--gradient-btn-border bruges bredt men nogle steder er teal
kontekstuelt rigtigere (events/live).

**Metode naar udfoert:** gennemgaa hver forekomst efter ROLLE (ikke farve), foreslaa
isblaa/teal/moerk-nuance per kontekst, mockup de tvivlsomme foer deploy (MOCKUP-FIRST),
ret samlet i eet bump. Est. ~1 time veludfoert. IKKE midt i device-test.

---

## 12. BOBLE-BESKED PUSH (åben — model ikke afklaret, 5. juli 2026)

**Observation (device-test):** medlemmer får INGEN notifikation ved nye boble-beskeder.

**Teknisk diagnose (høj sikkerhed, mangler DB-verifikation):**
- DM'er = `messages`-tabel (sender_id/receiver_id, ÉN modtager).
- Boble-beskeder = `bubble_messages`-tabel (user_id/bubble_id, MANGE modtagere).
- ADR-006 koblede `on_new_message_push` -> `notify_new_message`, men den funktion er
  bygget til ÉN-til-ÉN DM (receiver_id). Boble-push kræver en ANDEN funktion der looper
  over boble-medlemmer og sender til hver undtagen afsender. Derfor virker det ikke —
  det blev aldrig bygget (ADR-006 fokuserede på DM).
- IKKE en quick fix: kan ikke bare koble samme trigger på bubble_messages (ingen
  receiver_id). Kræver ny SECURITY DEFINER-funktion + trigger på bubble_messages.

**UAFKLARET: hvilken notifikations-MODEL?** (afgør kompleksiteten — afklar før byg)
Store platforme:
- Facebook/WhatsApp: push ved HVER besked + mute-muligheder (opt-out af støj).
- Slack: push kun ved @mentions/DM som standard (opt-in til støj).
STRATEGI 16.8 siger netvaerks-CHAT-push = "stoejkatastrofe". Sandsynlig skelnen:
- Live event (fysisk til stede, kort): maaske INGEN besked-push — presence/radar er den
  vigtige realtidsting, folk har appen aaben.
- Netvaerk (vedvarende, spredt): Slack-model (kun @mentions/admin-opslag) frem for hver
  besked.

**Beslutning: afklar model foerst, byg ikke endnu.** Arbejd videre paa andet; vend
tilbage naar modellen er moden. Naar bygget: ny per-medlem push-funktion + mute-kontrol
sandsynligt noedvendig. Ogsaa uafklaret: virker DM-push overhovedet? (test naar naturligt).

---

## 13. VISUELT UDTRYK-LØFT fra Claude Design (planlagt — jul 2026)

**Status:** Michael bygger et FÆRDIGT nyt visuelt udtryk i Claude Design (mørkt glas,
premium look). Teaser set: markant modnet udseende, men STRUKTUR bevaret 1:1 (radar-bullseye,
boble-træ med foraeldre-forbindelser + fold, Mine/Opdag-faner, live-banner, beskeder-blanding
— alt genkendeligt fra nuvaerende build).

**Natur: ren VISUEL tilpasning, ikke omstrukturering.** Kun udtrykket aendres (farver, glas,
spacing, radius) + FÅ steder hvor workflow/funktionalitet er strammet op. Logik/struktur
roeres ikke.

**BESLUTTET plan (Michaels valg):**
1. Vent til Design-udtrykket er HELT faerdigt (ikke stykkevis).
2. Naar klar: byg en ISOLERET test hvor det nye look laegges paa nuvaerende build i
   /home/claude (rører IKKE next/ prod). Test live paa rigtig struktur + data.
3. Kun ved eksplicit godkendelse migreres til next/.

**To mulige migrations-veje (afgoeres naar udtrykket ses fuldt):**
- Vej 1 TOKEN-SWAP (kirurgisk): nyt udtryk = aendringer i CSS-variabler + komponent-styles.
  Redefiner eksisterende :root-variabler + ~210 klasser UDEN at roere HTML/JS. Hurtigst/
  sikrest HVIS udtrykket kan udtrykkes gennem eksisterende klasser. Teaser tyder paa at
  DET MESTE er denne vej (samme komponent-struktur, nyt look).
- Vej 2 KOMPONENT-FOR-KOMPONENT (grundig): hvis udtrykket aendrer selve komponent-OPBYGNING
  (nye elementer, andet indre layout), migreres hver komponent enkeltvis mod eksisterende
  markup. Kun for de faa steder hvor workflow er strammet.

**Arbejdsgang naar Design leverer:** Michael bringer udtrykket herind (kode/screenshots) →
Claude analyserer forskelle mod eksisterende klasser → bygger isoleret override-lag
(test-app.css) → laegger paa KOPI af build → Michael tester live → beslutning.

**UI-bibliotek-prompt + kravspec findes allerede** (ui-bibliotek-kravspec-og-prompt.md) —
kan bruges til at faa Design til at levere i det format der mapper til eksisterende klasser.

Glas-UI = besluttet retning. Ikke implementeret. Separat fra feature-arbejde.
