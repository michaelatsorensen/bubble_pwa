# Bubble /next/ Design Guide v5.0
## Strandglas-æstetik — mat, subtil translucens, som glas slebet af havet

---

## FARVEPALETTE

### Primære farver
| Rolle | Farve | Brug |
|---|---|---|
| Midnight base | `#170F34` / `rgba(23,15,52,...)` | Alle baggrunde, kort, sheets, modals |
| Page bg | `#F0EEF5` | Lilla-grå bag radar-kort |
| Hvid tekst | `rgba(255,255,255,0.95)` | Headings, navne |
| Sekundær tekst | `rgba(255,255,255,0.4)` | Subtitles, metadata |
| Muted tekst | `rgba(255,255,255,0.3)` | Section labels, hints |

### Accent farver
| Rolle | Farve | Brug |
|---|---|---|
| **Isblå** (primær CTA) | `rgb(100,180,230)` | Knapper, match badges, navbar ring, progressbars |
| **Teal** | `#1A9E8E` | Live mode, events, "Gemt" state, checkin |
| **Pink** | `#E879A8` | Notification dots KUN (ingen anden brug) |
| **Brand gradient** | `#19D3C5 → #6E63FF → #FF6A9A` | Logo KUN (ingen knapper/kort) |
| **Rød** | `#EF4444` | Log ud, check ud, destruktive handlinger |

### Lilac (`#7C5CFC`) er UDFASET
Brug isblå eller teal i stedet. Gradient beholder lilla som midtpunkt kun i logo.

---

## OVERFLADER

### Glass-dark (standard for alle kort/sheets)
```css
background: rgba(23,15,52,0.82);
backdrop-filter: blur(12px) saturate(130%);
border: 0.5px solid rgba(124,92,252,0.08);
/* Til sheets/modals: brug 0.94 opacity */
```

### Glass-light (KUN radar-kort)
```css
background: rgba(255,255,255,0.88);
backdrop-filter: blur(20px);
border: 0.5px solid rgba(0,0,0,0.06);
box-shadow: 0 2px 8px rgba(0,0,0,0.04);
```

### Sheet/Modal baggrund
```css
background: rgba(23,15,52,0.94);
backdrop-filter: blur(20px);
border-radius: 24px 24px 0 0;
/* Ingen box-shadow — blur er nok */
```

### Overlay/backdrop
```css
background: rgba(23,15,52,0.35);
backdrop-filter: blur(6px);
```

---

## KNAPPER (Strandglas)

### Primær CTA — "Isblå" (#5)
```css
background: rgba(100,180,230,0.18);
border: 0.5px solid rgba(100,180,230,0.25);
backdrop-filter: blur(8px);
color: rgba(255,255,255,0.9);
border-radius: 12px;
padding: 11px;
font-weight: 700;
```

### Sekundær
```css
background: rgba(255,255,255,0.06);
border: 0.5px solid rgba(255,255,255,0.08);
color: rgba(255,255,255,0.5);
border-radius: 12px;
```

### Teal (live/event CTA)
```css
background: linear-gradient(135deg, #1A9E8E, #17877A);
border: none;
color: white;
```

### Saved/Gemt state
```css
background: rgba(26,158,142,0.12);
border: 0.5px solid rgba(26,158,142,0.2);
color: #1A9E8E;
```

### Destruktiv (log ud, check ud)
```css
background: rgba(239,68,68,0.1);
border: none;
color: #EF4444;
```

---

## INPUTS (i mørk kontekst)

```css
background: rgba(255,255,255,0.06);
border: 0.5px solid rgba(255,255,255,0.1);
color: rgba(255,255,255,0.9);
border-radius: 10px;
```
```css
/* Placeholder */
color: rgba(255,255,255,0.25);
/* Focus */
border-color: rgba(100,180,230,0.3);
box-shadow: 0 0 0 3px rgba(100,180,230,0.08);
```

---

## CHIPS/TAGS/PILLS

### Inaktiv
```css
background: rgba(255,255,255,0.06);
border: 0.5px solid rgba(255,255,255,0.08);
color: rgba(255,255,255,0.5);
border-radius: 99px;
```

### Aktiv/Valgt
```css
background: rgba(100,180,230,0.15);
border: 0.5px solid rgba(100,180,230,0.3);
color: rgb(100,180,230);
```

### Match badge
```css
background: rgba(100,180,230,0.12);
color: rgb(100,180,230);
font-size: 7px;
padding: 2px 6px;
border-radius: 99px;
```

---

## NOTIFICATION DOTS

Alle dots er identiske — simpel pink cirkel, ingen tal:
```css
width: 8px;
height: 8px;
border-radius: 50%;
background: #E879A8;
box-shadow: 0 0 6px rgba(232,121,168,0.5);
```

---

## NAVBAR

```css
/* Container */
width: 240px;
background: rgba(23,15,52,0.72);
backdrop-filter: blur(20px);
border-radius: 24px;
border: 0.5px solid rgba(255,255,255,0.12);
box-shadow: inset 0 0.5px 0 rgba(255,255,255,0.08);

/* Sliding indicator ring */
width: 36px; height: 36px;
border-radius: 50%;
border: 1.5px solid rgba(100,180,230,0.5);
background: rgba(100,180,230,0.18);
box-shadow: 0 0 0 4px rgba(100,180,230,0.08);
transition: transform 0.4s cubic-bezier(0.34,1.56,0.64,1);

/* Aktiv ikon */
stroke: rgba(255,255,255,0.9);
/* Inaktiv ikon */
stroke: rgba(255,255,255,0.3);
```

---

## TOPBAR (Home)

```css
background: rgba(23,15,52,0.92);
/* Indhold: Logo (gradient tekst) + greeting (0.72rem, rgba(255,255,255,0.5)) */
/* Ikoner: 28px runde, rgba(255,255,255,0.08) bg, rgba(255,255,255,0.6) stroke */
```

---

## SEPARATORER

```css
/* Mellem sektioner */
border-top: 0.5px solid rgba(255,255,255,0.06);
/* Mellem kort (flex gap) */
gap: 0.45rem;
```

---

## HANDLES (sheets/trays)

```css
width: 32px;
height: 3px;
border-radius: 2px;
background: rgba(255,255,255,0.15);
```

---

## CLOSE BUTTONS

```css
width: 28px; height: 28px;
border-radius: 50%;
background: rgba(255,255,255,0.08);
border: none;
color: rgba(255,255,255,0.4);
font-size: 11px;
```

---

## CHEVRONS (circle style)

```css
width: 22px; height: 22px;
border-radius: 50%;
background: rgba(255,255,255,0.1);
/* SVG: 8px, stroke rgba(255,255,255,0.5), stroke-width 2.5 */
```

---

## SKELETON LOADERS (i mørk kontekst)

```css
/* Shimmer */
background: linear-gradient(90deg,
  rgba(255,255,255,0.04) 25%,
  rgba(255,255,255,0.08) 50%,
  rgba(255,255,255,0.04) 75%);
background-size: 200% 100%;

/* Kort container */
background: rgba(255,255,255,0.04);
border: 0.5px solid rgba(124,92,252,0.06);

/* Spinner */
border-color: rgba(255,255,255,0.1);
border-top-color: rgba(100,180,230,0.6);
```

---

## RADAR

### Ringe (midnight indigo)
```
Zone opaciteter: 0.06 / 0.04 / 0.025 / 0.018 / 0.012 / 0.006
Ring strokes: rgba(23,15,52,0.06)
Center glow: rgba(23,15,52,0.08) → transparent
```

### Center avatar
```css
background: linear-gradient(135deg, rgb(100,180,230), rgb(70,150,210));
border: 2px solid white;
box-shadow: 0 2px 8px rgba(100,180,230,0.3);
```

### + og liste knapper
```css
width: 30px; height: 30px;
border-radius: 50%;
background: rgba(23,15,52,0.78);
/* SVG ikoner: 14px, stroke rgba(255,255,255,0.9) */
```

---

## ANIMATION

| Element | Easing | Duration |
|---|---|---|
| Spring-back tap | `cubic-bezier(0.34,1.56,0.64,1)` | 0.3s |
| Sheet slide-up | `cubic-bezier(0.32,0.72,0,1)` | 0.35s |
| Drip-in (radar) | `cubic-bezier(0.34,1.56,0.64,1)` | 0.45s, stagger 40ms |
| Nav slide | `cubic-bezier(0.34,1.56,0.64,1)` | 0.4s |
| Badge pop | scale(0) → scale(1) | 0.3s |

---

## HIERARKI PRINCIP

```
Mørk topbar (0.92)
  ↓
Lys radar-kort (0.88 hvid) ← HERO ELEMENT, eneste lyse
  ↓
Mørke kort (0.82) ← gemte, profilstyrke, feedback
  ↓
Mørk navbar (0.72 + 0.12 hvid kant)
```

Radaren er "vinduet af lys" i et mørkt interface.

---

## SCREENS STATUS

| Skærm | Konverteret | Noter |
|---|---|---|
| Home | ✅ | Topbar, radar, alle kort, trays |
| Onboarding | ✅ | Inputs, consent, CTA |
| Welcome | ✅ | Action-kort med farvede ikoner |
| Person sheet | ✅ CSS | Kræver deploy |
| Modal sheets | ✅ CSS | Setup, settings, QR — kræver deploy |
| Deep-link modal | ✅ JS | Kræver deploy |
| Checkin modal | ✅ JS | Kræver deploy |
| Bobler | ❌ | Næste prioritet |
| Beskeder | ❌ | |
| Profil | ❌ | Mest kompleks |
| Chat | ❌ | |
| Notifikationer (screen) | ❌ | Tray er konverteret |
