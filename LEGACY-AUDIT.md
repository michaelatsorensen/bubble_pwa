# LEGACY-AUDIT — rester af gammelt prod-design i next

**Sidst opdateret:** v8.57 (maj 2026)
**Formål:** Stoppe det tilbagevendende mønster hvor gammelt mørkt-tema-design (hvid tekst /
mørke fills) dukker op på det der nu er lyse skærme efter prod→next-skiftet (hybrid-pattern,
etableret v7.95–v8.04).

---

## Roden til problemet

Prod var mørkt tema. Next bruger **hybrid-pattern**: lys backdrop (`#F0EEF5`) + mørke
glas-kort (`--n3-card` = `rgba(23,15,52,0.85)`). Da skærme blev konverteret fra mørk til lys,
blev nogle hvid-tekst-regler hængende. De er kun synlige som fejl når de sidder **direkte på
den lyse backdrop** — ikke når de sidder inde i et mørkt kort (hvor hvid stadig er korrekt).

Derfor: man kan ikke bare søge-og-erstatte hvid tekst. Hvert tilfælde skal klassificeres efter
**container**, ikke efter farve.

---

## Facit: lys/mørk-manifest

Mål-baseret (fra eksplicitte `background`-regler + v7.9x-kommentarer), ikke gættet.

### MØRKE skærme — hvid tekst er KORREKT
- `screen-chat` (`rgba(23,15,52,0.92)`)
- `screen-bubble-chat` (deler chat-mørk)
- `screen-onboarding` (`#170F34`)
- `screen-welcome` (`#170F34`)

### LYSE skærme — hvid tekst PÅ BACKDROP = legacy-bug
`screen-auth`, `screen-bubbles`, `screen-event-ready`, `screen-guest-checkin`, `screen-home`,
`screen-loading`, `screen-messages`, `screen-notifications`, `screen-person`, `screen-profile`,
`screen-qr-preview`, `screen-qr-teaser`, `screen-social-proof`.

**På lyse skærme er hvid tekst kun korrekt INDE i et mørkt kort** (`.card`, `.saved-card`,
`.conv-card`, `.welcome-card`, dynamiske sheets/trays/modals, farvede avatarer). Hvid tekst på
selve backdrop'en (mellem/uden for kort: sektion-labels, empty-states, fri tekst) = bug.

---

## Detektionsmetode (genbrug ved næste mistanke)

```bash
LIGHT="screen-auth|screen-bubbles|screen-event-ready|screen-guest-checkin|screen-home|\
screen-loading|screen-messages|screen-notifications|screen-person|screen-profile|\
screen-qr-preview|screen-qr-teaser|screen-social-proof"

# 1) CSS: hvid tekst scopet til lys skærm, ekskl. legitime mørke kort
grep -nE "#($LIGHT)" app.css | grep -iE "color:\s*(rgba\(255,255,255|#fff|white)" \
  | grep -vE "\.card|conv-card|saved-card"

# 2) Inline whites i JS — klassificér hver efter container (mørkt kort vs backdrop)
for f in b-*.js; do grep -nE "color:\s*(rgba\(255,255,255|#fff|white)" "$f"; done
```
For hvert JS-hit: find den omsluttende `background:` — er den `rgba(23,15,52…)`/`#170F34`/
`rgba(30,27,46…)` (mørkt kort → hvid OK) eller en farvet avatar/knap (OK) — eller sidder den
på backdrop (bug)?

**Den farlige slags:** screen-wide tvang på *generiske utility-klasser*
(`#screen-X .fw-600 { color:white }`, `.text-muted`, osv.), fordi de bruges både i kort OG på
backdrop. Korrekt mønster er at scope hvid til kortet: `#screen-X .card .fw-600`.

---

## Fund (fuld sweep, v8.52–v8.57)

### RETTET — hvid tekst på backdrop
- **screen-person:** hele skærmen var hvid-på-lys (display-name/title/bio/action-btn/
  section-titles/bubble-pill). Konverteret til on-light tokens (v8.52), siden fuldt redesignet
  til strandglas (v8.56).
- **Knapper (global `.btn-primary`/`.btn-secondary`):** unscoped global gjorde hvid-på-pale-
  isblå usynlig på ALLE lyse skærme. Default gjort lys-læsbar; hvid-tekst-override scopet til de
  4 mørke skærme + `#request-join-tray` (v8.52).
- **Empty-states:** `.empty-text`/`.empty-icon`/`.section-label` på profil + messages var hvid-
  på-lys. → on-light tokens (v8.54). (bubbles `.empty-text` var allerede rettet v8.00.)
- **Onboarding confirm-knap:** ready-state var hvid-på-pale → teal CTA (v8.53).

### HÆRDET — skrøbeligt men ikke aktivt brudt (v8.57)
- `#screen-profile .fw-600` / `.text-muted` og `#screen-bubbles .fw-600` / `.text-muted` var
  tvunget hvide på hele skærmen. Faktisk brug er kun inde i mørke kort (saved-cards, invite-
  cards) — så ikke synligt brudt — men de kunne blø ud på backdrop ved enhver ny brug.
  **Re-scopet til `.card`-kontekst** (`#screen-X .card .fw-600` osv.) så de aldrig kan ramme
  backdrop. Nul regression: kort-brug bevaret.

### BEKRÆFTET KORREKT — hvid tekst i legitim mørk container (rør IKKE)
- Mørke skærme: chat, bubble-chat, onboarding, welcome.
- Dynamiske sheets/trays/modals: `_buildMemberSheet` (hvid handle på mørk sheet),
  `request-join-tray` ("Anmod om medlemskab", `n3-card`), workplace-prompt, connect-scanner.
- Kort på lyse skærme: `home-welcome-card` (`rgba(23,15,52,0.85)`), b-live connect-card
  (`rgba(30,27,46,0.95)`), saved-cards, invite-cards.
- Farvede avatar-initialer + farvede knapper (rød decline, gradient-CTA).

### IKKE FUNDET
- Ingen forced-white CSS scopet til home/notifications/qr-*/guest-checkin/event-ready/
  social-proof.
- Ingen backdrop-whites i static HTML på nogen lys skærm.
- b-notifications.js: nul inline whites.

---

## Status

Efter v8.57 er der **ingen kendte aktive backdrop-hvid-tekst-bugs**, og den strukturelle rod
(generiske utilities tvunget hvide screen-wide) er hærdet. Dukker et nyt tilfælde op: kør
detektions-snippet ovenfor, klassificér efter container, og — hvis det er en generisk utility —
scope hvid til `.card` frem for til skærmen.

> Bemærk: dette er en statisk kode-audit. Den fanger ikke noget der kun viser sig ved bestemt
> runtime-data. Device-test på de redesignede/rettede skærme er stadig værd at gøre.

---

## Runde 2 — fuld sweep af modaler, sheets, DMs, settings, onboarding (v8.70)

**Token-reference (roden):**
- DARK tekst-tokens (til LYSE flader): `--text` #1E1B2E, `--text-secondary` #56536E
- WHITE tekst-tokens (til MØRKE flader): `--text-1/2/3` rgba(255,255,255,…)
- LYSE flader: `--surface`/`--glass-bg` #FFFFFF, `--bg`/`--page-bg` #F0EEF5
- MØRKE flader: `--midnight` #170F34, `--n3-card` rgba(23,15,52,.85), `.modal-sheet`/`.person-sheet` rgba(23,15,52,.94)

Migrerings-rest = et DARK tekst-token brugt inde i en MØRK flade (dark-on-dark), eller et
WHITE token / `--glass-bg` brugt på en lys backdrop.

**RETTET (dark-on-dark i mørke modaler/sheets):**
- Create-post modal labels (Synligt/Titel/Indhold/Link til event) — `--text-secondary` på `.modal-sheet` → rgba(255,255,255,.55)
- "Prioritet"-label i person-sheet (DM) — `--text-secondary` på mørkt sheet → rgba(255,255,255,.55)
- Admin Debug-header + Opdater/Ryd-knapper — `--text` / hvide `--surface`-knapper på mørk modal → on-dark

**BEKRÆFTET KORREKT (rør ikke):**
- qr-preview / qr-teaser / social-proof / guest-checkin: `--text`/`--text-secondary` = mørk tekst på LYSE skærme ✓
- chat-plus-menu (Billede/Giphy): mørk tekst på HVIDE knapper (lyst popup) ✓
- Hvide confirm-modaler (checkin/showConfirmDialog): mørk tekst på hvidt kort ✓
- mini-onboarding: `var(--bg)` = lys flade, `--text-secondary` læsbar ✓
- Alle `color:var(--text)`-forekomster i JS sidder på lyse kort/modaler/backdrop ✓

**Metode-tilføjelse:** Klassificér ALTID efter flade, ikke farve. Et dark-token er kun en bug
hvis dets nærmeste container er en mørk flade. Tjek `background:` på den omsluttende node.
