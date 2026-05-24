# PROD vs NEXT — Drift Catalog

> **Purpose:** Track functional divergence between production (root) and next/ (design v6) codebases. Detect risk of refactor-introduced bugs before they hit users.
>
> **Triggered by:** Visibility bug discovery (maj 2026) — `next/b-home.js bubbleCard()` brugte `'open'` string i stedet for DB-værdi `'public'`. Bug fundet efter ~2 timers diagnose.
>
> **Status:** ACTIVE — opdateres ved hver PROD-fix der ikke porteres til NEXT, og ved hver NEXT-refactor af kode der findes i PROD
>
> **Related:** LÆRING #8 (Refactor skaber egne string-konstanter), Tenet 5 (Distill, don't port)

---

## Status (maj 2026)

**PROD version:** v8.17.31  
**NEXT version:** next-v8.32  
**Filer der findes begge steder:** 20  
**Filer med funktionel divergens:** 19 (kun `tag-data.js` + `bubble-icons.js` er identiske)  
**Total linje-divergens:** ~1,800 linjer på tværs af alle filer

## Drift severity klassifikation

Hver divergens klassificeres som:

- **🟢 STYLING** — Visuel forskel uden funktionel impact (forventet, OK)
- **🟡 ADDITIVE** — Ny funktionalitet i NEXT der ikke findes i PROD (bevidst, OK)
- **🟠 REGRESSION** — PROD-funktionalitet der mangler i NEXT (utilsigtet, skal portes)
- **🔴 BUG** — Funktionel forskel der giver forskellig adfærd (skal fixes)

---

## Identificeret divergens — pr. fil

### `b-home.js` (410 forskelle)

| Område | Type | Detail |
|---|---|---|
| `bubbleCard()` visibility check | 🔴 FIXED | NEXT brugte `'open'` i stedet for `'public'` — alle public bubbles vistes som "Privat". Fixet commit `95c51d1` |
| `bubbleCard()` lokal styling-logik | 🟢 STYLING | NEXT inliner pill-styling i stedet for at kalde fælles `visIcon()` |
| Tree-rendering struktur | 🟢 STYLING | NEXT bruger `bb-card-meta` class strukturer |

**Risiko-vurdering:** **HIGH**. `bubbleCard()` blev fuldt refactoret i NEXT — yderligere skjulte bugs sandsynlige. **Krævet review:** Verificér at alle bubble-types (event, network, live) rendres korrekt med alle visibility-kombinationer.

### `b-chat.js` (326 forskelle)

| Område | Type | Detail |
|---|---|---|
| Pre-check af `visibility` for join-knap | 🟢 OK | Begge tjekker `'private'` og `'hidden'` korrekt |
| Action area rendering | 🟢 STYLING | NEXT bruger nyt class-system |
| Reduktion logic (`bcReduceMsg`) | TBD | Skal verificeres |

**Risiko-vurdering:** **MEDIUM**. Mange forskelle men kerne-logik ser konsistent ud. **Krævet review:** Bubble chat scroll/load patterns, reducer logic, member sheet rendering.

### `b-bubbles.js` (124 forskelle)

| Område | Type | Detail |
|---|---|---|
| `dbActions.joinBubble()` callers | 🟠 REGRESSION | NEXT bruger kun `result.ok`, ignorerer `result.status`. ADR-005's discriminated union ikke implementeret |
| Toast handling | 🟠 REGRESSION | Mangler "Du er allerede medlem" vs "Du er nu medlem" differentiering |
| Discover rendering | 🟢 STYLING | NEXT bruger ny `bb-card-list` struktur |

**Krævet portering til NEXT:**
- ADR-005 discriminated union pattern
- `result.status === 'already_member'` / `'joined_now'` differentiering
- Mode B (event QR) `joined_now` toast logic

### `b-utils.js` (116 forskelle)

| Område | Type | Detail |
|---|---|---|
| `visIcon()` styling | 🟢 STYLING | NEXT bruger CSS classes, PROD bruger inline styles |
| `dbActions.joinBubble()` signature | 🔴 BUG | NEXT returnerer simpel `{ok: true/false}`. PROD returnerer fuld discriminated union |
| Visibility check i joinBubble | 🟢 OK | Begge tjekker `'private'` og `'hidden'` korrekt |

**Krævet portering:** Hele ADR-005 joinBubble refactor (v8.17.30, commit fra denne uge) skal portes til NEXT b-utils.js.

### `b-profile.js` (225 forskelle)

| Område | Type | Detail |
|---|---|---|
| Profile view rendering | 🟢 STYLING | NEXT bruger ny layout-struktur |
| Star rating UI | 🟢 STYLING | NEXT har anderledes visual feedback |
| TBD øvrige | TBD | Ikke audited endnu |

### `b-auth.js` (139 forskelle)

| Område | Type | Detail |
|---|---|---|
| Auth listener events | 🟠 REGRESSION? | PROD har SIGNED_IN/USER_UPDATED handlers (v8.17.31). NEXT status: TBD |
| `resolvePostAuthDestination` | 🟠 REGRESSION? | PROD bruger flowGet, NEXT status: TBD |
| consent management | TBD | Ikke audited endnu |

**Krævet check:** Verify alle Phase 1 reliability fixes (v8.17.31) er porteret eller bevidst udeladt.

### `sw.js` (77 forskelle)

| Område | Type | Detail |
|---|---|---|
| CACHE_NAME version | 🟢 OK | Forskellige versions (bubble-v8.17.31 vs next-cache) |
| User-prompted update (`SKIP_WAITING`) | 🟠 REGRESSION? | PROD har det (v8.17.31). NEXT status: TBD |
| `api.bubbleme.dk` filter | 🟠 REGRESSION? | PROD har det (v8.17.31). NEXT status: TBD |
| Notification routing | 🟠 REGRESSION? | PROD har wrong-tab focus fix (v8.17.31). NEXT status: TBD |

**Krævet check:** Alle SW fixes fra v8.17.31 skal verificeres i NEXT.

### Øvrige filer — TBD

`b-admin.js` (98), `b-onboarding.js` (96), `b-boot.js` (68), `b-messages.js` (61), `b-radar.js` (49), `b-live.js` (46), `b-config.js` (41), `b-realtime.js` (29), `b-notifications.js` (23), `b-i18n.js` (22), `b-navigation.js` (19)

**Status:** Ikke audited systematisk endnu. Disse er sandsynligvis mest styling + 1-2 logiske ændringer hver.

---

## Patterns identificeret

### Pattern 1: Local re-implementation af shared utilities

**Eksempel:** `bubbleCard()` flyttede fra at kalde `visIcon()` til at have lokal logik.

**Risiko:** Hver gang shared utility re-implementeres lokalt, gen-introduceres alle constants. Hvis constants ikke matches mod DB, opstår bugs.

**Mitigation:** Behold shared utilities som single source of truth. Hvis styling skal ændres, ændre `visIcon()` selv — ikke kopier dens logik.

### Pattern 2: Manglende portering af PROD-fixes til NEXT

**Eksempel:** ADR-005 joinBubble refactor (v8.17.30) er ikke i NEXT.

**Risiko:** NEXT bygger på gammel kontrakt-logik. Når NEXT bliver primary, kommer alle bugs vi løste i PROD tilbage.

**Mitigation:** Hver PROD-fix bør have eksplicit beslutning: port til NEXT, eller dokumentér hvorfor ikke.

### Pattern 3: NEXT-specifik additive features

**Eksempler:** 
- `closeNotifTray` / `openNotifTray` (kun NEXT — nyt notification panel)
- `_slideNavIndicator` (kun NEXT — ny nav animation)

**Risiko:** Lav (er bevidst ny funktionalitet)

**Mitigation:** Dokumentér disse som "NEXT-only" så de ikke ved et uheld porteres tilbage til PROD eller deletes.

---

## Drift-håndtering fremover

### Når PROD får en fix:

1. **Tjek om koden findes i NEXT** — diff den relevante funktion
2. **Hvis koden findes i NEXT** og fix er funktionel:
   - **Port fixet til NEXT** (ikke valgfri for bug-fixes)
   - Eller **eksplicit dokumentér** i denne fil hvorfor det ikke portes
3. **Hvis koden er omskrevet i NEXT**:
   - Verificér at NEXT-versionen ikke har samme bug
   - Tilføj NEXT-test til samme regression-suite

### Når NEXT får en refactor:

1. **Identificér alle shared utilities** der refaktoren erstatter
2. **List eksplicit hvilke constants/DB-værdier** der gen-introduceres
3. **Verificér mod DB schema** at constants matcher faktiske værdier
4. **Tilføj entry til denne fil** under "Pattern 1" hvis applicable

### Når NEXT bliver primary (post-pilot):

1. **Komplet audit af denne fil** — hver "TBD" skal være afklaret
2. **Alle 🟠 REGRESSION items** skal være portet eller eksplicit accepteret
3. **Pattern 1 cases** skal vurderes: behold local logic eller revert til shared utility?

---

## Strategisk implikation for native

Denne fil dokumenterer hvad der sker når **frontend-rendering refactores uden underliggende contract-disciplin**. Det er **direkte forudsigelse** af hvad der vil ske i native rewrite hvis vi ikke har:

1. **TypeScript enums for DB-værdier** (per LÆRING #8)
2. **Central konstant-definition** ud over enums
3. **Exhaustive switch-checks** der fanger missing cases
4. **Cross-version diff workflow** der fanger drift før prod

Native gør ikke disse problemer mindre — det gør dem **større** fordi:
- Refactor-scope vil være større (port af flere flows samtidig)
- Skader er sværere at fixe (App Store review cycles)
- Solo founder kan ikke gennemgå alt manuelt

**Konkret beslutning post-pilot:** Inden native development starter, beslut hvordan denne klasse af bugs forhindres.

---

## Hvordan auditere systematisk?

For at færdiggøre denne fil (estimat: 2-3 timer):

1. **For hver fil med 🟠 REGRESSION? eller TBD:**
   - Kør `diff <fil>.js next/<fil>.js > drift-<fil>.txt`
   - Identificér linje-for-linje funktionelle forskelle (ignorér whitespace/styling)
   - Klassificér hver forskel som STYLING/ADDITIVE/REGRESSION/BUG

2. **For hver REGRESSION:**
   - Beslut: port til NEXT (priority?) eller acceptér drift
   - Hvis port: åbn ny commit med fix
   - Hvis accept: dokumentér rationale her

3. **For hver BUG:**
   - Fix med det samme (per Tenet 4: grundighed)
   - Add post-mortem entry til ARCHITECTURE-LOG.md
   - Verify ikke samme bug findes andre steder

---

*Sidste opdatering: Maj 2026 (initial creation post visibility-bug fix)*
*Næste planlagte review: Når PWA går i maintenance mode (juli 2026)*

---

## Design-konsistens oprydning — deprecated lilac CTA (maj 2026)

NEXT design v6 (DESIGN-GUIDE.md line 46) forbyder lilac `#7C5CFC` som CTA/handlingsfarve — brug isblå `rgba(100,180,230,...)` eller teal `#1A9E8E`. Brand-gradienten (`#19D3C5→#6E63FF→#FF6A9A`) er KUN til logo.

**Vigtig skelnen:** Lilac som én blandt mange tilfældige *avatar-farver* er OK (ikke CTA). Kun lilac som CTA/handlings-element er fejl.

**Rettet:**
- ✅ `.radar-filter-chip.active` (CSS + updateFilterChipStyle) → isblå/teal · commit pending

**Tilbage at vurdere (Kategori 2 — CTA-agtige, sandsynlige fejl):**
- `index.html:104` `.sp-filter-chip.active` — search/profil-filter chip (samme bug som radar)
- `index.html:99` `.gs-v4-check.done` — "færdig"-tilstand indikator
- `index.html:74` `.qr-profile-avatar` — stor profil-avatar (grænsetilfælde)
- `b-home.js:582,890` — profil-setup ikon-baggrunde (CTA-agtige)

**Behold (Kategori 1 — avatar-farve-paletter, ikke CTA):**
- `b-home.js:2015,2438,2441,2518` — lilac som én af mange tilfældige prik/avatar-farver

**Anbefaling:** Gå Kategori 2 igennem sammen og afgør hver enkelt. Ikke bulk-ret — nogle er grænsetilfælde.

---

## Join/CTA-knap konsistens scan (maj 2026)

Anledning: Medlemmer-fanens "Bliv medlem" var lille + venstrestillet (introduceret i kontrast-fix aa32857 med fejlagtig width:auto override).

**Rettet:**
- ✅ b-chat.js:1542 Medlemmer-fane "Bliv medlem" → fuld-bredde bb-cta-join (matcher bb-cta-anmod lige over). Commit pending.

**Korrekte (følger mønster):**
- b-chat.js:2079/2081 Info-fane: bb-cta-anmod (privat) / bb-cta-join (offentlig) — begge fuld bredde ✓
- b-bubbles.js:2326 "Send anmodning" btn-primary — sidder i MØRK tray (var(--n3-card), hvid tekst) = læsbar ✓

**Tilbage at vurdere (samme klasse kontrast-bug som join-knappen):**
- b-chat.js:897 "Opret event" btn-primary i .empty-state på LYS boble-detalje (kun ejer) — hvid tekst på lys isblå = samme læsbarhedsproblem. Ikke en join-knap, men samme btn-primary-på-lys mønster.

**Systemisk note (bredere, ikke bulk-ret):**
- btn-accent (b-chat.js:645/647 kompakte "+ Join"/"Anmod" i liste) bruger brand-gradient (var(--gradient-primary)). DESIGN-GUIDE siger gradient = logo KUN. Læsbar (hvid på vibrant gradient), men teknisk afvigelse. Mange steder bruger btn-accent — kræver systematisk vurdering, ikke ad-hoc.

**Rod-årsag:** Global .btn-primary (app.css:1239) sætter hvid tekst (antager mørk kontekst). Lyse kontekster bryder. bb-cta-join løser join-knapperne; resten (Opret event + evt. andre) bør håndteres i en fokuseret btn-primary-på-lys oprydning.
