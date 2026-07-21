# AUDIT — Boble-skærmen: funktionalitet & UX (pre-pilot, 20. jul 2026)

> **Spørgsmålet (Michael):** Har vi fuldstændigt styr på layout og indhold i bobler —
> funktionalitet, mangler, og om layoutet er selvforklarende — før rigtige brugere får det?
> **Metode:** Systematisk kortlægning af koden (faner, roller, tilstande, handlinger)
> vurderet mod en førstegangsbrugers øjne. Homescreen er bevidst udeladt (vurderet OK).

---

## 1. FUNKTIONS-INVENTAR (hvad der faktisk findes)

### Struktur
- **Topbar:** tilbage · ikon · navn · "N medlemmer · rolle" · gem/bogmærke · rediger-blyant
  (kun owner/admin) · check-in-scanner (kun owner/admin på event/live/privat/hidden, skjules
  efter event-slut)
- **Faner:** Medlemmer | Opslag | Chat | Info — rolle-differentieret:
  - Aktivt medlem: alle 4, lander på **Info**
  - Ikke-medlem/pending: kun Info (+ Medlemmer hvis boblen er ÅBEN — 3-lags-modellen, v3.176)
- **Handlingsrække (medlemmer):** Invitér · Del · Anbefal/Anbefalet · QR
  (Del+QR er låst med hængelås+gennemstregning for hidden ikke-events, forklaring ved tap)

### Pr. fane
- **Medlemmer:** søgefelt, pending-kort m. Godkend/Afvis (owner/admin) + orange prik,
  person-sheet ved tap, stjerner, fjern-medlem (owner/admin)
- **Opslag:** KUN owner/admin kan skrive (envejskanal = Corporate-broadcast-primitivet).
  Likes (ingen kommentarer). Slet egne. Tomme tilstande med forklaring
  ("admins deler…" / "opret første opslag")
- **Chat:** beskeder, svar/reply, redigér, slet, GIF (Tenor), typing-indikator, ulæst-badge,
  **chat-lås** ("Luk chat for medlemmer" — owner/admin kan gøre chatten envejs, banner vises)
- **Info (rækkefølge):** stjerner → NETVÆRK & EVENTS (afholdte/kommende accordion +
  Event/Sub-boble-opret) → STATISTIK (medlemmer-kort m. "+X denne md." og netværkslinje,
  beskeder-kort, medlemsvækst-graf) → ADMINISTRATION (owner/admin: udpeg admins, download
  medlemsliste-PDF, event-rapport [kun events], luk chat, overdrag ejerskab, slet) →
  Forlad boble/event

### Tal & tilstande (efter denne uges arbejde — verificeret korrekte)
Ét sandt medlemstal alle steder; pending tæller aldrig; graf med dag-buckets; pending-poll
selvkorrigerer ansøger ≤5 sek; breadcrumbs (klokke → kort-prik → fane-prik).

---

## 2. FUND — FUNKTIONELLE HULLER

### F1 · Boble-chat er PUSH-LØS (vigtigste fund — kræver bevidst beslutning)
Verificeret: `notify_new_message`-triggeren dækker kun DM (`messages`). Der findes INGEN
push ved `bubble_messages`, hverken backend eller frontend. Konsekvens: aktivitet i en
boble opdages KUN via in-app ulæst-prikker — en bruger der ikke åbner appen, ved aldrig
at der sker noget i deres bobler.

**Vurdering:** For piloten er det formentlig det RIGTIGE (nul støj — det modsatte problem,
push ved hver besked til alle medlemmer uden mute, ville være værre). Men det skal være en
BESLUTNING, ikke en tilfældighed, for det påvirker "uopfordret brug"-målingen direkte:
uden nogen trigger udefra er al brug 100 % selvinitieret — godt for målingens renhed,
hårdt for aktiveringen.
**Anbefaling:** Dokumentér som bevidst pilot-valg. Post-pilot: overvej opt-in boble-push
eller daglig digest — og byg ALDRIG boble-push uden samtidig mute-pr.-boble (findes ikke i dag).

### F2 · Opslag mangler en svar-kanal
Envejs-opslag er designet (broadcast). Men et medlem der vil reagere ud over et like, har
ingen kobling til chatten — diskussionen om et opslag har intet sted at bo.
**Anbefaling (let, post-pilot):** "Diskutér i chatten"-link pr. opslag. Ikke pilot-blokerende.

### F3 · Den fjernede får ingen besked
Fjernes et medlem mens de IKKE kigger på boblen, opdager de det først når de selv støder
på det (boblen væk fra deres liste / "Anmod" igen). Kun live-toast hvis de står i boblen.
**Vurdering:** Acceptabelt for pilot (fjernelse er sjælden), men noteres.

### F4 · Rapport findes kun for events
Netværks-ejere har statistik-sektionen (fint), men ingen samlet rapport. Post-pilot —
hænger sammen med Corporate Bubbles-laget.

### F5 · Småting (bevidst udeladt? — bekræft)
Ingen søgning i chat · ingen pin af besked/opslag · ingen rolle-badges (EJER/admin) synlige
for menige medlemmer i listen. Alle tre er fint at udelade i pilot — men bekræft at det er valg.

---

## 3. FUND — UX / SELVFORKLARING (førstegangsbrugerens øjne)

### U1 · "Anbefal"-knappen forklarer ikke sig selv ⚠ (største UX-fund)
Den sidder i den primære handlingsrække, men hvad sker der når man trykker? (Upvote i
Discover.) En ny bruger kan ikke gætte det — og den ligner en handling på niveau med
Invitér/Del. **Anbefaling (pilot):** én mikrotekst-linje i en toast ved første tryk
("Boblen fremhæves i Discover") ELLER flyt den ud af primærrækken. Lille indsats, fjerner
et "hvad gjorde jeg lige?"-øjeblik.

### U2 · To QR-begreber med modsat retning i samme skærm ⚠
Topbar-ikonet = SCAN andres QR (check-in). Handlingsrækkens "QR" = VIS boblens egen QR.
To QR-ikoner, modsatte retninger, ingen sproglig skelnen. Ved et fysisk event — præcis
dér QR er kernen — er forvekslingsrisikoen størst.
**Anbefaling (pilot):** omdøb handlingsrækkens knap til "Vis QR" og giv scanner-ikonet
tooltip/label "Check-in". Ren tekstændring.

### U3 · Pending-banneret afstemmer ikke forventninger
"⏳ Afventer godkendelse" — men hvad sker der nu? **Anbefaling (pilot, én linje):**
"Ejeren har fået besked — du får en notifikation når du er godkendt." Fjerner usikkerheden
i produktets vigtigste ventetid.

### U4 · Stjernerne (1–3) er uforklarede
De vises prominent (boble + medlemmer), men betydningen (privat prioritering/rating) er
ikke tilgængelig nogen steder i UI'et. **Anbefaling:** tooltip/første-gangs-toast, eller
accepter som "opdages socialt" i pilot og observér om folk spørger.

### U5 · Man lander på fanen længst til højre
Info-først er det RIGTIGE valg (kontekst før handling) — men Info ligger sidst i fanerækken,
så den aktive fane ved åbning er den fjerneste. Let kognitiv skævhed.
**Anbefaling (post-pilot, sammen med v3-uplift):** overvej fanerækkefølgen
Info | Opslag | Chat | Medlemmer. IKKE pilot-blokerende.

### U6 · "Sub-boble" er et nyt begreb uden forklaring
Knappen står ved siden af "Event" uden kontekst. **Vurdering:** kun ejere ser den; pilot-OK.
Notér til onboarding-sprinten.

### Fungerer godt (fortjener at blive nævnt)
Rolle-differentieret synlighed er ren og korrekt · empty states har handlingsanvisninger ·
hidden-lås på Del/QR forklarer sig ved tap · pending-kortenes Godkend/Afvis med breadcrumbs
er et stærkt flow · chat-låsen er et reelt Corporate-primitiv · event vs netværk har
konsekvent farvesprog (teal/blå) · statistik+graf er nu troværdige.

---

## 4. PRIORITERET ANBEFALING

**Før pilot (små, høj værdi — alle er tekst/mikrocopy på nær beslutningen):**
1. F1-beslutningen: bekræft "boble-chat pusher ikke i pilot" som bevidst valg (dokumentér)
2. U2: "Vis QR" + "Check-in"-skelnen (tekstændring)
3. U3: forventnings-linjen i pending-banneret (tekstændring)
4. U1: første-tryk-toast på Anbefal (én toast)

**Post-pilot backlog:** F2 (opslag→chat-bro), U4 (stjerne-forklaring), U5 (fanerækkefølge),
F4 (netværks-rapport), F5-punkterne, boble-push+mute-parret (F1's anden halvdel).

**Konklusion:** Boblen er funktionelt KOMPLET til en pilot — der mangler ikke bærende
funktionalitet, og ugens arbejde har gjort fundamentet (tal, tilstande, privatliv) solidt.
Manglerne er (a) én strategisk beslutning der skal TRÆFFES bevidst (push-løs boble-chat),
og (b) en håndfuld selvforklarings-huller hvor 3 af 4 kan lukkes med ren mikrocopy på
under en time. Det er en usædvanlig billig vej til "nemt at forstå".
