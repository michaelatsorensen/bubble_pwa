# Bubble Design System — Reference

**Sidst opdateret:** v8.16 (next-mappen)
**Formål:** Single source of truth for design-system konsolidering og konsistens-check.

---

## 1. Backdrop-princippet

App'en har **to backdrops**:

| Backdrop | Farve | Hvor |
|---|---|---|
| **Lys** | `#F0EEF5` (`--page-bg`) | Body / alle hoved-skærme efter v7.95 |
| **Mørk** | `rgba(23,15,52,0.94)` (`--n1-sheet`) | Bottom-sheets, modals |
| **Mørk-mørk** | `#170F34` (`--midnight`) | Topbar, sticky chrome, screen-welcome |

**Card-princippet:** Cards har **modsatte** baggrund af deres backdrop:
- Lys backdrop → mørk glass card (`var(--n3-card)` = `rgba(23,15,52,0.85)`)
- Mørk backdrop → forekommer kun i guest flows, hvor hvide cards er CTA-magneter

---

## 2. Tokens — single source of truth

### Backdrops & containere
```css
--page-bg          #F0EEF5          /* light backdrop for body */
--n1-sheet         rgba(23,15,52,0.94)  /* bottom-sheet bg */
--n1-topbar        rgba(23,15,52,0.82)  /* topbar bg */
--n1-navbar        rgba(23,15,52,0.65)  /* bottom nav (with own blur) */
--n3-card          rgba(23,15,52,0.85)  /* dark glass card on light bg */
--midnight         #170F34          /* deepest bg (welcome screen) */
```

### Borders
```css
--border-1         rgba(255,255,255,0.06)  /* dark glass card border */
--border-2         rgba(255,255,255,0.06)  /* separators */
```

### Text — på MØRK container (cards/sheets)
```css
--text-1           rgba(255,255,255,0.9)   /* headings, names */
--text-2           rgba(255,255,255,0.4)   /* subtitles, meta — DEPRECATED for new use */
--text-3           rgba(255,255,255,0.25)  /* hints — DEPRECATED for new use */
```
**Anbefalede værdier på mørk:**
- Headings/titler: `rgba(255,255,255,0.95)` ← **note: 0.95 er ny standard, ikke 0.9**
- Body text: `rgba(255,255,255,0.85)`
- Meta/labels: `rgba(255,255,255,0.55)`
- Subtle/hints: `rgba(255,255,255,0.35)`

### Text — på LYS backdrop
```css
--text-on-light         #170F34   /* primær (midnight) */
--text-on-light-muted   #56536E   /* meta/labels */
--text-on-light-subtle  ...        /* hints — verificer eksistens */
```

### Accents
```css
--isbla        rgb(100,180,230)    /* ice-blue — CTA, parent-link, links */
--teal         #1A9E8E             /* live, saved, success */
--teal-dark    #0F6E56             /* event status, dato */
--pink         #E879A8             /* notifications, dots */
--accent       #7C5CFC             /* network, primary purple */
--accent-soft  rgba(124,92,252,0.1)
--green        #2ECFCF             /* event/live primary */
```

---

## 3. Utility-klasser (v8.06)

### Text på LYS backdrop
```css
.text-on-light         /* mørk #170F34 */
.text-on-light-muted   /* mørk muted #56536E */
.text-on-light-subtle  /* lyseste mørk muted */
```

### Text på MØRK backdrop
```css
.t1   /* rgba(255,255,255,0.9) */
.t2   /* rgba(255,255,255,0.4)  — DEPRECATED, brug 0.55 inline */
.t3   /* rgba(255,255,255,0.25) — DEPRECATED, brug 0.35 inline */
```

### Containers
```css
.glass-dark    /* dark glass card med backdrop-filter — STANDARD for cards på lys */
.glass-light   /* light glass card med backdrop-filter */
.section-card  /* dark glass + 12px radius + 0.75 padding + 0.9 margin-bottom */
.section-card-title  /* uppercase header inde i section-card */
```

### Specielle patterns
```css
.parent-link        /* "Del af X" hierarki-reference — isblå tonet */
.parent-link-label  /* "Del af" mini-label */
.parent-link-name   /* parent navn */
.parent-link-chev   /* › chevron */

.badge-status       /* base for status badges */
.badge-ended        /* afsluttet event */
.badge-coming       /* kommende event */
.badge-live         /* live event */

.btn-danger-soft        /* sub-tonet danger button */
.btn-danger-soft-strong /* danger button med stærk accent */
```

---

## 4. Reglerne — hvornår bruger jeg hvad?

### "Jeg laver tekst på et card der er på lys backdrop"
- Card er `.glass-dark` eller `.section-card` → tekst er HVID
- Heading: `class="text-on-light"` på CARDET? **NEJ** — card er mørk, brug hvid 0.95
- Card's interne tekst: hvid `rgba(255,255,255,0.95)` for titler, `rgba(255,255,255,0.55)` for meta

### "Jeg laver tekst direkte på lys backdrop (uden card)"
- Brug `class="text-on-light"` for primær
- Brug `class="text-on-light-muted"` for meta/labels

### "Jeg laver tekst på en mørk sheet (bb-sheet, modal-sheet)"
- Sheet'en er mørk → tekst er hvid
- bb-sheet har scoped override i v8.15: `.bb-sheet { color: rgba(255,255,255,0.95); }` ← **VERIFICÉR DENNE**
- modal-sheet har scoped override: `.modal-sheet .input-label { color: rgba(255,255,255,0.85); }`

### "Jeg laver et card på lys backdrop"
- Brug `.glass-dark` eller `.section-card`
- IKKE `background:#FFFFFF` (det er broken-mønstret vi har fixet i v8.16)

### "Jeg laver et card på mørk sheet"
- Vi har endnu ikke standardiseret card-på-mørk pattern
- Forslag: `background:rgba(255,255,255,0.04)` + `border:0.5px solid rgba(255,255,255,0.08)`
- ← **TIL DISKUSSION** — skal vi tilføje `.glass-on-dark` utility?

### "Jeg laver en CTA-knap"
- Standard CTA: `.btn-primary` (v6 override = ice-blue beach glass)
- IKKE inline `background:var(--gradient-primary)` (lilla-gradient bryder ice-blue principp)
- Send/action sub-knap: samme `.btn-primary`

### "Jeg laver en secondary/ghost knap"
- Brug `.btn-secondary` (v6 override = `rgba(255,255,255,0.06)` + lys 0.6 tekst)

### "Jeg laver en danger-knap (Slet, Forlad)"
- `.btn-danger-soft` for sub-tonet
- `.btn-danger-soft-strong` for stærk accent

---

## 5. Status — hvad er migreret? (v8.05a → v8.16)

### ✅ Færdige migreringer
- `bcLoadInfo()` (b-chat.js): hero, parent-link, description, agenda, statistik, admin
- `dm-select-toolbar`: bg → `--n3-card` (v8.07)
- `Vælg/Annuller` toggle: ikon-only (v8.08-09)
- `chat-topbar` parent-link: `#534AB7` → `--isbla` (v8.11)
- `chat-topbar-icon`: explicit white color (v8.11)
- `chat-member-row` (members tab): `--n3-card` + `--border-1` (v8.13)
- `chat-section-label`: hvid 0.25 → mørk muted på lys bg (v8.13)
- `bb-sheet` scoped overrides: title, handle, input-label (v8.15)
- `modal-create-picker` ("Hvad vil du oprette"): white cards → dark glass (v8.16)

### 🟥 Står tilbage — identificerede inkonsistenser

| Lokation | Problem | Prioritet |
|---|---|---|
| **invite-sheet** (`bb-sheet-invite`) | Titel mangler color, navne arver mørk text, send-knap har lilla gradient | **P0 — næste fix (v8.17)** |
| **Guest-flow cards** (linje 505 + 545, .qr-social-proof, .anon-card) | White cards på lys backdrop | **P0 — du har valgt A: dark glass** |
| **Edit-bubble sheet** (modal-edit-bubble, ~13 felter) | Inline-styles ikke bekræftet OK | **P1** |
| **Edit-profile sheet** (modal-edit-profile) | Inline-styles ikke bekræftet OK | **P1** |
| **Inline `var(--gradient-primary)` knapper** | 12 forekomster — bryder ice-blue princip | **P2** |
| **Inline `color:#170F34` / `#1E1B2E` hardkodet** | 9 forekomster — burde være `--text-on-light` | **P2** |
| **Inline `color:var(--text-secondary)`** | 58 forekomster — ikke alle er broken (depends on context) | **P3** |
| **Inline `color:rgba(255,255,255,0.4)` / `.25`** | 45 forekomster — kan være OK på mørk, men bumpes til 0.55/0.35 i nye | **P3** |
| **Ubrugte CSS-klasser** | `.radar-card-v4`, `.gs-v4-card`, `.qr-context-chip` — dead code | **P3 — slet i oprydning** |

### 🟡 Til diskussion
- **Card-på-mørk pattern:** Skal vi tilføje `.glass-on-dark` utility? (Edit Bubble fields-grupper er det vi netop diskuterede med N2)
- **Send-knap konsistens:** Skal `.btn-primary` overrides i v6 doc'es bedre?

---

## 6. Worktofw til at finde inkonsistenser

```bash
# Find tekst der ville være broken på mørk container
grep -rn "color:var(--text)\b" --include="*.html" --include="*.js"
grep -rn "color:#170F34\|color:#1E1B2E\|color:#56536E" --include="*.html" --include="*.js"

# Find white card bg på lys backdrop
grep -rn "background:#FFFFFF\|background: #FFFFFF\|background:#fff\b" --include="*.html" --include="*.js"

# Find lilla-gradient buttons (bryder ice-blue princip)
grep -rn "var(--gradient-primary)" --include="*.html" --include="*.js"

# Find for svag tekst på mørk (gammel default)
grep -rn "color:rgba(255,255,255,0.4)\|color:rgba(255,255,255,0.25)" --include="*.html" --include="*.js"
```

---

## 7. Næste skridt (foreslået rækkefølge)

1. **v8.17 — Invite-sheet fix** (P0, næste)
2. **v8.18 — Guest flows til variant A** (P0, godkendt af Michael)
3. **v8.19 — Edit Bubble + Edit Profile audit** (P1)
4. **v8.20+ — Lilla-gradient knap migrering** (P2, batches)
5. **v8.21+ — Hardcoded text-color cleanup** (P2)
6. **v8.22 — Ubrugte CSS-klasser slettes** (P3, oprydning)
7. **v8.23 — Final pass + dokumenter til prod** (cherry-pick til main)
