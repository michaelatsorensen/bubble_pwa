# RADAR-MODEL.md — Radarens mentale model (backlog, kritisk)

> **Status:** Designet LANDET (maj 2026). IKKE bygget. Post-pilot.
> **Vigtighed:** Højeste. Radaren er Bubbles hovedfunktion — det første brugeren
> præsenteres for. Hvordan den filtreres og føles afgør produktets kerneoplevelse.
> **Hvorfor ikke nu:** Vi konkluderede (med ekstern feedback) at modellen skal
> testes med rigtige mennesker, ikke tænkes færdig. Pilot på nuværende radar først.

---

## Kernebeslutningen

> **Filteret definerer sættet. Match-modellen definerer rækkefølgen.**

Radaren er ikke en visualisering af data. Den er **den primære interaktionsmodel**
— et levende, intentionelt discovery-interface. Ikke en social rangliste, ikke et
score-visualiseringsværktøj.

Skiftet: fra "vis mine 25 bedste matches" → til "vis hvem der er relevante for
**det jeg leder efter lige nu**". Det matcher hvordan mennesker faktisk netværker
("hvem her arbejder med grøn energi og søger en hardware-investor?"), og det passer
til Bubbles DNA: lokal relevans, timing, kontekst, intention — ikke globale
follower-grafer eller vanity metrics.

---

## Principperne

1. **Filteret definerer sættet** — tags (samme 196-tag vokabular som profiler) afgør
   HVEM der vises. AND-logik: hvert filter er et ekstra krav → flere filtre = færre folk.
2. **Match-modellen definerer rækkefølgen** — den eksisterende `calcMatchScore`
   (sektor, lifestage, tag-cluster+overlap, delte bubbles, cross-match søger↔er)
   bestemmer positionen INDEN i det filtrerede sæt. Vi smider ikke scoring væk — vi
   gør den mere meningsfuld.
3. **Position er relativ (rang), ikke absolut score** — rang-baseret placering spreder
   folk jævnt uanset skala. Løser clustering-problemet ved roden (top-N af stor pulje
   klumper ikke længere i centrum). Brugeren oplever "de vigtigste er tættere på" —
   det er nok. Ingen matematisk afstands-renhed.
4. **Match-styrke er et perifert signal** — vises via prik-størrelse/intensitet, ALDRIG
   som afstand, ALDRIG som analytisk score-breakdown. Et blødt "denne virker ekstra
   relevant", ikke en måling man aflæser.
5. **Radaren visualiserer relevans, ikke geografi** — det er relevans-rum/socialt rum,
   ikke fysisk rum.
6. **Start bredt, snævr intentionelt ind** — uden filter: vis ALLE i puljen (udgangspunktet).
   Filtre trækker fra. Discovery → søgning.
7. **Puljen er kontekst-bundet, ikke hele platformen** — "Mit netværk" (folk i dine
   bubbles) eller "Live event" (kun event-deltagere). Aldrig "alle Bubble-brugere fladt".
   Kontekst gør puljen naturligt håndterbar.
8. **Forklaringer er menneskelige, ikke analytiske** — "fælles bubble · match på grøn
   energi · søger hardware-investor". ALDRIG procent-bjælker, tier-scores, signalvægtning.

---

## Anti-patterns (bevidst fravalgt — gen-diskutér ikke uden ny grund)

- **Pinch-to-zoom / semantisk zoom** — pinch betyder spatial/geografisk navigation;
  radaren er relevans-rum. Zoom ville lyve om hvad radaren er, og kolliderer med
  fremtidig geolokation-kort (hvor pinch SKAL betyde geo-zoom). Det brugeren
  efterspurgte var ikke zoom, men **adaptive density exploration** — noget andet.
  → Udskudt til Fase 3, KUN hvis pilot-data viser at density faktisk er et problem.
- **Absolut-score som afstand** — clusterer i toppen, kollapser ved skala, kræver at
  brugeren "afkoder UI som en hacker". Rang-baseret afløser det.
- **Analytisk "hvorfor vises denne person"-panel** (score-bjælker/tiers) — LinkedIn-ification.
  Holdt menneskeligt og let i stedet.
- **Top-25 af flad pulje uden pagination** (nuværende PROD/NEXT) — de øvrige usynlige.
  Erstattes af kontekst-pulje + filter.

---

## Faseplan

**Fase 1 (post-pilot core):** Kontekst-pools → vis alle i pool → filter-drevet
indsnævring (AND) → rang-baseret spredning → bløde størrelses-hints for match-styrke →
glidende transitions → menneskelige relevans-forklaringer. **Ingen zoom.**

**Fase 2 (hvis density kræver det):** Adaptive dot-sizing (har vi), soft clustering,
"+N mere", progressive reveal. Stadig ingen zoom.

**Fase 3 (kun efter pilot-data viser density-problem):** Test focus-lens / expandable
center / semantic magnification — som bevidst, testet beslutning, ikke gætning.

---

## Parkerede parametre (fremtidige signaler)

- **Netværks-nærhed** — booste folk forbundet til dit eksisterende netværk (fælles/
  andengrads-forbindelser). Værdifuldt i professionelt netværk, men: privatliv (aggregeret
  "3 fælles forbindelser", aldrig eksponér hvem), kold start (nye brugere = 0), beregning
  (andengrads kræver serverside ved skala), vægtning (for tungt = ekkokammer). Parkeret
  som muligt Lag-2 signal.
- **Geolokation** (P2 backlog) — som ekstra filter-lag, ikke før pilot lander.

---

## Mockups (reference, ikke produktionskode)

- `/mnt/user-data/outputs/radar-positioning-mockup.html` — 4 positioneringsmodeller
  sammenlignet (nuværende/rang/hybrid/bånd) med justérbart antal brugere; viser
  clustering-problemet og rang-løsningen.
- `/mnt/user-data/outputs/radar-filter-flow-mockup.html` — fuldt filter-drevet flow:
  tag-filter, AND-indsnævring, live-mode toggle, person-sheet med forklaring.
  (TODO hvis genoptaget: forklaringspanel bruger stadig score-bjælker — skal ændres
  til menneskelige one-liners før det matcher princip #8.)

---

## Hvorfor dette dokument findes

Vi diskuterede modellen grundigt med to runder ekstern feedback. Begge konkluderede:
freeze konceptet, byg følelsen, test med mennesker. Dette dokument fanger beslutningen
så vi ikke gen-diskuterer den om tre måneder — og så den næste der bygger radaren
(inkl. native) starter fra den landede model, ikke fra bunden.
