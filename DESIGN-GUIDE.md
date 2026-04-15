# Bubble /next/ Design Guide v6.0
## Strandglas-æstetik — mat, subtil translucens, som glas slebet af havet

---

## DESIGNPRINCIP

Alt i Bubble er havglas. Tre niveauer af glass-behandling baseret på formål og position:

| Niveau | Navn | Teknik | Hvornår |
|---|---|---|---|
| **Niveau 1** | Frostet glas | `backdrop-filter: blur()` + transparency | Elementer der flyder OVER indhold |
| **Niveau 2** | Tonet glas | Farvet `rgba()` fill, ingen blur | Elementer der kommunikerer funktion via farve |
| **Niveau 3** | Slebet glas | Solid fill + border + radius | Statiske containere, inputs, neutrale kort |

**Regel:** Maks 3-4 samtidige blur-lag synlige. Blur er dyrt — brug det kun hvor gennemsigtighed giver mening.

---

## FARVEPALETTE

### Primære farver
| Rolle | Farve | Brug |
|---|---|---|
| Midnight base | `#170F34` / `rgba(23,15,52,...)` | Baggrunde, kort, sheets |
| Page bg | `#F0EEF5` | Bag radar-kort |

### Tekst (3 niveauer — ikke flere)
| Niveau | Opacity | Brug |
|---|---|---|
| Primær | `rgba(255,255,255,0.9)` | Headings, navne, vigtig info |
| Sekundær | `rgba(255,255,255,0.4)` | Subtitles, metadata, timestamps |
| Muted | `rgba(255,255,255,0.25)` | Section labels, hints, placeholders |

### Accent farver
| Rolle | Farve | Brug |
|---|---|---|
| **Isblå** | `rgb(100,180,230)` | CTA-knapper, match badges, navbar ring, progressbars |
| **Teal** | `#1A9E8E` | Live mode, events, "Gemt" state, checkin |
| **Pink** | `#E879A8` | Notification dots KUN, toast-ikon for notifikationer |
| **Grøn** | `#2ECFCF` | Success, bekræftelse (toast-ikon) |
| **Rød** | `#EF4444` | Destruktive handlinger, fejl (toast-ikon) |
| **Brand gradient** | `#19D3C5 → #6E63FF → #FF6A9A` | Logo KUN |

### Udfaset
- `#7C5CFC` (lilac) — brug isblå eller teal
- `var(--accent)`, `var(--text)`, `var(--muted)` — brug direkte rgba

### Border farver (2 niveauer — ikke flere)
| Niveau | Farve | Brug |
|---|---|---|
| Standard | `rgba(255,255,255,0.08)` | Kort, containere, inputs |
| Subtle | `rgba(255,255,255,0.06)` | Separatorer, sektion-dividers |

---

## NIVEAU 1: FROSTET GLAS
Ægte `backdrop-filter: blur()`. Baggrunden skinner igennem.
Brug KUN på elementer der visuelt flyder over andet indhold.

### Radar-kort (hero)
```css
background: rgba(255,255,255,0.85);
backdrop-filter: blur(20px);
-webkit-backdrop-filter: blur(20px);
border: 0.5px solid rgba(0,0,0,0.06);
box-shadow: 0 2px 8px rgba(0,0,0,0.04);
border-radius: 18px;
```

### Topbar
```css
background: rgba(23,15,52,0.82);
backdrop-filter: blur(12px);
-webkit-backdrop-filter: blur(12px);
border-bottom: 0.5px solid rgba(255,255,255,0.06);
```

### Navbar
```css
background: rgba(23,15,52,0.65);
backdrop-filter: blur(20px);
-webkit-backdrop-filter: blur(20px);
border: 0.5px solid rgba(255,255,255,0.1);
box-shadow: inset 0 0.5px 0 rgba(255,255,255,0.06);
border-radius: 22px;
```

### Toasts
```css
background: rgba(23,15,52,0.85);
backdrop-filter: blur(16px);
-webkit-backdrop-filter: blur(16px);
border: 0.5px solid rgba(255,255,255,0.08);
border-radius: 14px;
box-shadow: 0 8px 32px rgba(0,0,0,0.15);
```

### Sheets / Modals
```css
background: rgba(23,15,52,0.94);
backdrop-filter: blur(20px);
-webkit-backdrop-filter: blur(20px);
border-radius: 24px 24px 0 0;
/* Højere opacity = mere læsbar tekst */
```

### Overlay / Backdrop
```css
background: rgba(23,15,52,0.35);
backdrop-filter: blur(6px);
-webkit-backdrop-filter: blur(6px);
```

---

## NIVEAU 2: TONET GLAS
Farvet fill uden blur. Farven kommunikerer funktion.
Brug på elementer der skal skille sig ud via farve.

### Teal glass (live/event)
```css
background: rgba(26,158,142,0.07);
border: 0.5px solid rgba(26,158,142,0.12);
border-radius: 12px;
/* Tekst i teal-toner: #0D5C52 primær, rgba(26,158,142,0.5) sekundær */
```

### Isblå glass (CTA/handling)
```css
background: rgba(100,180,230,0.08);
border: 0.5px solid rgba(100,180,230,0.12);
border-radius: 14px;
/* Tekst: rgb(70,150,210) primær, rgba(100,180,230,0.5) sekundær */
```

### Pink glass (notifikation — kun toasts)
```css
/* Ikon-cirkel i toast, ikke kort-baggrund */
background: rgba(232,121,168,0.2);
border-radius: 50%;
```

### Grøn glass (success — kun toasts)
```css
background: rgba(46,207,207,0.2);
border-radius: 50%;
```

### Rød glass (fejl — kun toasts)
```css
background: rgba(239,68,68,0.2);
border-radius: 50%;
```

---

## NIVEAU 3: SLEBET GLAS
Solid fill + border + radius. Ingen blur, ingen farvetoning.
Brug på statiske containere, inputs, og neutrale kort.

### Midnight kort (standard)
```css
background: rgba(23,15,52,0.78);
border: 0.5px solid rgba(255,255,255,0.08);
border-radius: 14px;
```

### Inputs
```css
background: rgba(255,255,255,0.06);
border: 0.5px solid rgba(255,255,255,0.1);
border-radius: 10px;
color: rgba(255,255,255,0.9);
```
```css
/* Placeholder */
color: rgba(255,255,255,0.25);
/* Focus */
border-color: rgba(100,180,230,0.3);
box-shadow: 0 0 0 3px rgba(100,180,230,0.08);
```

### Sekundære knapper
```css
background: rgba(255,255,255,0.06);
border: 0.5px solid rgba(255,255,255,0.08);
color: rgba(255,255,255,0.5);
border-radius: 12px;
```

### Chips / Tags (inaktiv)
```css
background: rgba(255,255,255,0.06);
border: 0.5px solid rgba(255,255,255,0.08);
color: rgba(255,255,255,0.5);
border-radius: 99px;
```

### Chips / Tags (aktiv)
```css
background: rgba(100,180,230,0.15);
border: 0.5px solid rgba(100,180,230,0.25);
color: rgb(100,180,230);
border-radius: 99px;
```

---

## KNAPPER

### Primær CTA — Isblå strandglas
```css
background: rgba(100,180,230,0.18);
border: 0.5px solid rgba(100,180,230,0.25);
color: rgba(255,255,255,0.9);
border-radius: 12px;
padding: 11px;
font-weight: 700;
/* Niveau 3 — ingen blur, fill er nok */
```

### Teal (live/event CTA)
```css
background: linear-gradient(135deg, #1A9E8E, #17877A);
border: none;
color: white;
```

### Saved / Gemt
```css
background: rgba(26,158,142,0.12);
border: 0.5px solid rgba(26,158,142,0.2);
color: #1A9E8E;
```

### Destruktiv
```css
background: rgba(239,68,68,0.1);
border: none;
color: #EF4444;
```

---

## TOASTS

Niveau 1 glass (frostet). Farvekodet ikon signalerer type.

### Struktur
```
[ikon-cirkel 24px] [titel + body]
```

### Typer
| Type | Ikon-bg | Ikon-stroke | Titel eksempel |
|---|---|---|---|
| Success | `rgba(46,207,207,0.2)` | `#2ECFCF` | "Kontakt gemt" |
| Fejl | `rgba(239,68,68,0.2)` | `#EF4444` | "Kunne ikke gemme" |
| Notifikation | `rgba(232,121,168,0.2)` | `#E879A8` | "Ny invitation" |
| Info | `rgba(100,180,230,0.2)` | `rgb(100,180,230)` | "Ny funktion" |

### CSS
```css
/* Container — alle typer */
background: rgba(23,15,52,0.85);
backdrop-filter: blur(16px);
border: 0.5px solid rgba(255,255,255,0.08);
border-radius: 14px;
padding: 10px 12px;
box-shadow: 0 8px 32px rgba(0,0,0,0.15);

/* Titel: 0.72rem, weight 700, white */
/* Body: 0.62rem, rgba(255,255,255,0.6) */
/* Animation: toastIn 0.3s cubic-bezier(0.34,1.56,0.64,1) */
```

---

## TEAL GLASS LIVE-SEKTION

Niveau 2 glass. Inde i radar-kortets container, under +/liste-knapper.
Kun synlig når brugeren er checked ind.

```css
background: rgba(26,158,142,0.07);
border: 0.5px solid rgba(26,158,142,0.12);
border-radius: 12px;
margin: 6px 8px 2px;
padding: 8px 10px;
/* Niveau 2 — ingen blur */
```

### Indhold
- Pulserende teal dot (7px, `box-shadow: 0 0 0 3px rgba(26,158,142,0.12)`)
- Event-navn: `0.72rem; weight 700; color #0D5C52`
- Meta: `0.6rem; color rgba(26,158,142,0.5)`
- Chevron-cirkel: `background rgba(26,158,142,0.08)`
- Alle/Live toggle med teal fill på aktiv tab

### Toggle pills
```css
/* Container */
background: rgba(26,158,142,0.06);
border: 0.5px solid rgba(26,158,142,0.08);
border-radius: 7px;

/* Aktiv: bg rgba(26,158,142,0.12), border rgba(26,158,142,0.15), color #0D5C52, weight 700 */
/* Inaktiv: transparent, color rgba(26,158,142,0.4), weight 500 */
```

---

## HANDLES, CLOSE, CHEVRONS, SEPARATORER

```css
/* Handle */
width: 32px; height: 3px; border-radius: 2px;
background: rgba(255,255,255,0.15);

/* Close */
width: 28px; height: 28px; border-radius: 50%;
background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.4);

/* Chevron */
width: 20px; height: 20px; border-radius: 50%;
background: rgba(255,255,255,0.08);
/* SVG: 6px, stroke rgba(255,255,255,0.4), width 2.5 */

/* Separator */
border-top: 0.5px solid rgba(255,255,255,0.06);
```

---

## ANIMATION

| Element | Easing | Duration |
|---|---|---|
| Spring-back tap | `cubic-bezier(0.34,1.56,0.64,1)` | 0.3s |
| Sheet slide-up | `cubic-bezier(0.32,0.72,0,1)` | 0.35s |
| Toast slide-in | `cubic-bezier(0.34,1.56,0.64,1)` | 0.3s |
| Drip-in (radar) | `cubic-bezier(0.34,1.56,0.64,1)` | 0.45s, stagger 40ms |
| Nav slide | `cubic-bezier(0.34,1.56,0.64,1)` | 0.4s |

---

## PERFORMANCE REGLER

1. Maks 3-4 samtidige `backdrop-filter` lag synlige
2. Sheets/modals: blur OK (dækker hele skærmen, kun 1 lag)
3. Home screen: radar + topbar + navbar = 3 blur-lag (grænsen)
4. Kort under radar: Niveau 3 (ingen blur)
5. Toasts: blur OK (kortvarigt, ét lag ovenpå)
6. Knapper: ALDRIG blur
7. Test på iPhone SE / iPhone 8 ved 60fps som baseline

---

## HIERARKI

```
N1: Topbar (blur, 0.82)
  ↓
N1: Radar-kort (blur, 0.85 hvid) ← HERO
  ↓ inde i radar:
  N2: Teal glass live-sektion (fill, 0.07 teal)
  ↓
N3: Midnight kort (solid, 0.78) ← gemte, feedback
N2: Isblå kort (fill, 0.08 isblå) ← profilstyrke
  ↓
N1: Navbar (blur, 0.65)
  ↑ ovenpå alt:
N1: Toasts (blur, 0.85)
N1: Sheets/modals (blur, 0.94)
```

---

## SCREENS STATUS

| Skærm | Konverteret | Glass-niveau |
|---|---|---|
| Home | ✅ | N1: topbar+radar+navbar. N2: teal live, isblå profil. N3: kort |
| Onboarding | ✅ | N3: inputs, knapper. Solid midnight bg |
| Welcome | ✅ | N3: action-kort |
| Person sheet | ✅ CSS | N1: sheet bg. N3: knapper, tags |
| Modal sheets | ✅ CSS | N1: sheet bg. N3: inputs, knapper |
| Deep-link modal | ✅ JS | N1: modal bg |
| Checkin modal | ✅ JS | N1: modal bg |
| Toasts | ❌ | N1: blur + farvekodet ikon |
| Bobler | ❌ | Næste prioritet |
| Beskeder | ❌ | |
| Profil | ❌ | Mest kompleks |
| Chat | ❌ | |
