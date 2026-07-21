# AUDIT — Brugervenlighed, hele appen (pre-pilot, 20. jul 2026)

> **Formål (Michael):** Systematisk skærm-for-skærm brugervenligheds-gennemgang af HELE
> Bubble, så "masser af steder kunne bruge et løft" bliver til en prioriteret backlog vi
> kan arbejde fra og teste mod i piloten. Dette er KORTLÆGNING, ikke implementering.
> **Ledeprincip (Michael):** hjælp brugeren til hurtigere forståelse UDEN clutter/støj.
> Meget hører hjemme i hjælpe-guiden (nu opdateret, v3.179-180), ikke som UI-mikrocopy.

---

## 0. TVÆRGÅENDE MØNSTRE — det samlede indtryk

Disse gælder på tværs af skærme og vejer tungest, fordi de rammer overalt.

### Stærkt (fortjener at blive nævnt)
- **Fejlhåndtering er moden:** `errorToast` tjekker netværk FØRST (offline → "ingen forbindelse"
  frem for kryptisk fejl), og bruger kontekstuelle nøgler (save/send/load/upload/login/delete).
  235 fejlhåndteringssteder — konsistent brugt.
- **Bekræftelser er pæne:** custom `bbConfirm`/`confirm-modal` bruges; kun ÉT native `confirm()`
  tilbage (b-home.js:1802, live-skift) → se U-tværg-1.
- **Loading har skeletons:** 22 skeleton-forekomster — ikke bare "Indlæser…"-tekst. God oplevelse.
- **Empty states findes bredt** (37 steder) og har typisk ikon + handlingsanvisning.
- **Match-transparens findes:** radar viser fælles bobler, markerede fælles tags, overlap —
  brugeren kan se HVORFOR nogen matcher. Kerneværdi gjort synlig.
- **Welcome-kort** på home (dismissable, husker valg) — blød første-gangs-intro.

### Tværgående FUND
- **U-tværg-1 · Ét native `confirm()` tilbage** (b-home.js:1802, live-skift). Bryder det ellers
  konsistente custom-modal-look. LILLE — konvertér til bbConfirm. Pilot-OK men skæmmende.
- **U-tværg-2 · Accessibility er tynd** (P2, men voksende gæld). ~20 aria-labels i HELE appen;
  mange ikon-kun-knapper (topbar, handlingsrækker, FAB'er) har ingen label. Skærmlæser-brugere
  og VoiceOver-navigation rammes. IKKE pilot-blokerende, men bør på backloggen FØR native (hvor
  det er lettere at bygge rigtigt fra start end at rette bagud).
- **U-tværg-3 · Konsistens i tilbage-navigation** — kun 4 eksplicitte back-referencer; resten
  via forskellige mekanismer. Bør verificeres i enhedstest (allerede en post-pilot sprint:
  "Navigation/back-restore refactor" i memory). Ikke nyt, men bekræftet.

---

## 1. SKÆRM FOR SKÆRM

### Home / Radar — **vurderet OK (Michaels egen vurdering, bekræftet)**
Match-transparens, welcome-kort, Alle/Live-skift, filtre. Fungerer. Ingen pilot-fund.
Mindre note: tom radar i live-mode ved ingen tilstedeværende — bekræft at empty-teksten
forklarer "ingen er checket ind endnu" frem for at virke som en fejl.

### Discover (Udforsk) — solid
Empty states med ikon + tekst ("ingen at udforske"). Søgning findes.
- **U-D1 (lav):** Ved allerførste brug (få bobler i systemet) kan Discover se tom/tynd ud.
  Overvej en linje der inviterer til at OPRETTE en boble når listen er kort. Post-pilot.

### Boble-skærmen — **dækket separat** i AUDIT-BOBLE-UX-2026-07.md
Hovedfund dér: push-løs boble-chat (beslutning), Anbefal/QR/pending/stjerner selvforklaring
(nu adresseret i guiden, v3.179). Se det dokument.

### DM / Beskeder — god
Send, redigér, profiler fra samtale, filtrering, filer/GIF. Guide-dækket.
- **U-DM1 (lav):** Tom indbakke-tilstand — bekræft den peger mod radar/discover ("find nogen
  at skrive med") frem for bare "ingen beskeder". Post-pilot.

### Profil (egen) — overskuelig
~44 felt-referencer, men opdelt i sektioner. Profil-strength-meter guider udfyldning.
- **U-P1 (lav):** Profil-strength er god, men bekræft at den forklarer HVAD der mangler
  (ikke bare en procent). En procent uden "tilføj en titel for +20%" er mindre handlingsbar.

### Onboarding — kritisk sti, fortjener egen verifikation
Tag-valg i kategorier, terms-accept, navn/arbejdsplads. Dette er den ALLERFØRSTE oplevelse.
- **U-O1 (MELLEM — pilot-relevant):** Onboarding er hvor en pilotbruger enten kommer godt i
  gang eller falder fra. Den fortjener en dedikeret enheds-gennemgang med FRISKE øjne (ikke
  bare "virker det" men "føles det trygt og klart for en der aldrig har set Bubble"). Ikke en
  kodefejl — en oplevelses-verifikation. Føj til testrunden.
- Hænger sammen med Q-067 (signup-guardrails) og den kommende consent/onboarding-sprint.

---

## 2. PRIORITERET BACKLOG

### Ret før / under pilot (små, høj værdi)
1. **U-tværg-1:** konvertér sidste native `confirm()` → bbConfirm (konsistens). ~15 min.
2. **U-O1:** dedikeret onboarding-oplevelses-gennemgang med friske øjne (del af testrunden).
   Ikke kode — vurdering. Højest værdi her, fordi det er første indtryk.
3. Bekræft empty-teksterne på tom radar (live), tom indbakke, tynd Discover læser som
   invitationer, ikke fejl (U-D1, U-DM1). Mikrocopy hvis nødvendigt.

### Post-pilot backlog (rangeret)
4. **U-tværg-2 · Accessibility-pas:** aria-labels på alle ikon-knapper. FØR native-rewrite
   (billigere at bygge rigtigt fra start). P2.
5. **U-P1:** profil-strength forklarer hvad der mangler, ikke bare procent.
6. **U-tværg-3:** back-navigation-konsistens (allerede planlagt sprint).
7. Boble-UX post-pilot-punkter (se AUDIT-BOBLE-UX): opslag→chat-bro, fanerækkefølge,
   stjerne-forklaring, boble-push+mute-par.
8. **U-D1/U-DM1:** empty-state-forbedringer hvis piloten viser folk snubler.

### Bevidst IKKE gjort nu (piloten er instrumentet)
Mange finpudsninger bør vente på RIGTIGE brugeres friktion frem for vores gæt. Piloten
viser hvor folk faktisk snubler — det er mere værd end at gætte. Denne audit er et
UDGANGSPUNKT at teste mod, ikke en to-do der skal ryddes før launch.

---

## 3. KONKLUSION

Bubble er brugervenlighedsmæssigt i BEDRE stand end en typisk pre-pilot-app: fejl,
bekræftelser, loading, empty states og match-transparens er allerede gennemtænkte og
konsistente. Der er INGEN pilot-blokerende brugervenligheds-problemer.

De reelle fund fordeler sig som:
- **Én ting at RETTE før pilot** der er ren kode (sidste native confirm).
- **Én ting at VURDERE før pilot** der er høj-værdi og ikke-kode (onboarding med friske øjne).
- **Én voksende gæld** (accessibility) der bør lukkes før native, ikke før pilot.
- **En håndfuld mikrocopy-bekræftelser** på empty states.
- Resten er bevidst overladt til piloten som brugervenligheds-instrument.

Det stærkeste signal: der er ikke et clutter-problem eller et forvirrings-problem på tværs
af appen — de få selvforklarings-huller vi fandt (primært i boblen) er nu adresseret i
guiden frem for med UI-støj, præcis efter princippet om hjælp uden clutter.
