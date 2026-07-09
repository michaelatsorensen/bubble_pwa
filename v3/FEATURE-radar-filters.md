# Feature: Brugerkuraterede radar-filtre

**Status:** Designet (workshoppet 9. juli 2026), IKKE bygget. Afventer main quest (styling-refaktor) er faerdig.
**Type:** Ny produktfeature — roerer datamodel, filter-logik OG to skaerme. IKKE bare styling.
**Naeste skridt naar vi vender tilbage:** Mockup-first (interaktiv HTML af HELE flowet) FOER produktkode.

---

## Vision

Brugeren skal selv **kuratere** hvilke tags/filtre der er tilgaengelige paa radaren — ikke se
alle databasens tags (som prototypens mock viser). Fuld kontrol over hvilke profiler og
interesser man leder efter.

Dette matcher Bubbles kerne-DNA: brugeren i kontrol, ikke tvunget. Modeksempel = prototypens
taleboble der viser ALLE tags; hensigten er brugerens EGNE valgte.

## To dele

### 1. Profil-sektion (ny)
En sektion under Profil hvor brugeren vaelger hvilke tags fra databasen der er "aktive" som
radar-filtre. Naturligt sted: den eksisterende "Hjem-skaerm"-sektion i indstillinger
(index.html ~linje 1777).

### 2. Filter-taleboble paa radaren (udvid eksisterende)
Taleboblen (bygget v3.22) viser i dag kun match-niveau-filtre. Skal udvides med en
"INTERESSER"-sektion der viser KUN brugerens valgte tags som chips (ikke alle databasens).

---

## Afklarede designbeslutninger

### Filter-logik: ALL / snaever
Flere valgte filtre **indsnaevrer** (folk der matcher ALLE valgte tags).
- Raesonnering (Michael): filtre er til at snaevre ind. ANY ville goere feltet bredere,
  hvilket er det modsatte af hvad et filter er til.

### Nul-match-haandtering: BEGGE lag
Fordi ALL/snaever kan give nul matches, to lag der arbejder sammen:

1. **Live-taellere PAA hvert filter i taleboblen** (proaktivt): hver filter-chip viser hvor
   mange der matcher HVIS man tilfoejer den. 0 = graatonet/deaktiveret. Saa konsekvensen ses
   FOER man vaelger.

2. **Hjaelpsom tom-tilstand** (reaktivt sikkerhedsnet): rammer man alligevel 0, en tydelig
   besked "Ingen matcher alle X filtre — fjern et for at se flere" med tap-for-at-fjerne.

Michaels mentale model: hvis kombinationen giver nul, tapper man nogle filtre fra. Tom-tilstanden
skal goere det TYDELIGT at det er det man skal goere (ikke en fejl).

### Endnu IKKE afklaret
- Hvilke tags brugeren kan vaelge FRA: egne keywords / alle databasens / begge.
  Michael leaner mod at det handler om indsnaevring; praecis kilde ikke laast.
  Foreslaaet start: brugerens egne `profiles.keywords`, med mulighed for at udvide senere.

---

## Datamodel (skal designes)

- Brugerens EGNE tags: `profiles.keywords` (array) — findes allerede.
- Tag-database: `TAG_DATABASE` (4 kategorier, ~196-400 tags) i tag-data.js — findes allerede.
- **MANGLER:** felt til brugerens VALGTE radar-filtre. Kandidat: ny kolonne
  `profiles.radar_filter_tags` (array), adskilt fra `keywords`.

## Filter-logik (skal udvides)

- Nu: `_getFilteredProfiles()` (b-home.js ~2329) haandterer KUN match-niveau
  (all/interest/good/strong/live via matchScore-taerskler 20/40/60).
- INGEN tag-filtrering paa radaren i dag.
- Skal udvides til: tag-baseret indsnaevring (ALL-logik) oven paa/kombineret med match-niveau.
- Profiler har `sharedTags` tilgaengeligt — data er der.

## Reference

- Prototypens taleboble-markup (til visuel reference): SCREEN HOME, FILTER-POPOVER-sektion.
  Har "VIS"-label + match-raekker + "INTERESSER"-label + interest-chips + Ryd/Vis-knap.
- MEN prototypens interest-chips er ALLE tags (mock-begraensning). Vores hensigt = brugerens
  valgte. Prototype = rettesnor for UDSEENDE, ikke for hvilke tags der vises.
- Prototypens `interestChips` (proto_script.js): aegte tag-filtrering via `tagCounts` +
  `_toggleRadarTag` — bekraefter at chip-mekanikken er reel, ikke bare kosmetik.

## Tilgang naar vi bygger

1. **Mockup-first:** interaktiv HTML af HELE flowet (profil-valg + radar-taleboble +
   indsnaevring + live-taellere + tom-tilstand). Workshop retningen.
2. Byg oven paa den FAERDIGMIGREREDE taleboble-styling (undgaa at bygge feature-logik nu
   og re-style senere).
3. Datamodel foerst, saa profil-UI, saa taleboble-udvidelse, saa filter-logik.
