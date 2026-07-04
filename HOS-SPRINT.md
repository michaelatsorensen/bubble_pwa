# HOS-SPRINT — Den tilbagevendende brugers audit (3. juli 2026)

Formaal: Onboarding/indgang er poleret intensivt. Dette dokument daekker DEN ANDEN halvdel —
den erfarne, tilbagevendende brugers kerneloop — som afgoer om HoS-deltagere stadig er der
ugen efter. Alt herunder er VERIFICERET I KODEN (fil:linje), ikke antaget.

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

*Vedligeholdt som sprint-reference frem mod HoS. Opdateres naar punkter lukkes.*
