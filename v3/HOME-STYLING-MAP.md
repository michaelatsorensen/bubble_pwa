# Home styling-map: v3 vs prototype

**Formaal:** Systematisk sammenligning af home-skaerm mod prototypen for at finde hvorfor
v3 ser moerkere/anderledes ud. Ting vi ALLEREDE har rettet roeres IKKE.

## Prototype-standard for glas-cards (kilden til sandhed)
```
background: rgba(255,255,255,0.055-0.06)   <- LYST glas (ikke moerkt)
border: 0.5px solid rgba(255,255,255,0.12)
box-shadow: inset 0 1px 0 rgba(255,255,255,0.08-0.09)   <- LYS TOP-KANT (loefter card'et)
backdrop-filter: blur(20-24px)
border-radius: 14-24px
```
INGEN moerk drop-shadow. Lyset kommer fra den INSET top-kant, ikke fra en skygge.

---

## Fundne systematiske forskelle

### 1. `.card` inset-lys virker kun i webkit
- **Nu:** `-webkit-box-shadow:inset 0 1px 0 rgba(255,255,255,0.09)` — KUN webkit-prefix,
  mangler den almindelige `box-shadow`. Samme prefix-fejl som de 8 ugyldige vi rettede.
- **Fix:** Tilfoej `box-shadow:inset 0 1px 0 rgba(255,255,255,0.09)` (uden prefix).

### 2. `.glass-dark` (feedback-card) er MOERK
- **Nu:** `background:rgba(20,22,28,0.85)` — moerk baggrund + blur12.
- **Prototype:** cards er LYST glas `rgba(255,255,255,0.055)` + blur20.
- **Fix:** Skift til lyst glas (dette er en stor kilde til "moerkere" udseende).

### 3. Radar-kort har MOERK drop-shadow
- **Nu:** `box-shadow:0 2px 8px rgba(0,0,0,0.3)` — moerk skygge under kortet.
- **Prototype:** `inset 0 1px 0 rgba(255,255,255,0.09)` (lys top-kant), INGEN moerk skygge.
- **Fix:** Erstat moerk drop-shadow med lys inset top-kant.

### 4. Radar-kort radius for lille
- **Nu:** `20px`  |  **Prototype:** `24px`
- **Fix:** 20 -> 24px.

### 5. Radar-kort mangler blur
- **Nu:** ingen backdrop-filter  |  **Prototype:** `blur(24px)`
- **Fix:** Tilfoej `backdrop-filter:blur(24px)`.

---

## Moenster
Hovedaarsagen til "moerkere" udseende:
1. **Moerke skygger i stedet for lys inset top-kant** (radar-kort)
2. **Moerke card-baggrunde** (glass-dark) hvor prototypen bruger lyst glas
3. **Inset-lys der kun virker i webkit** (manglende alm. box-shadow)
4. **Manglende backdrop-blur** paa nogle containere

Prototypens glas "loefter" sig via lys top-kant + blur. Vores bruger moerke skygger +
nogle moerke baggrunde, hvilket giver et tungere, moerkere udtryk.

## Roeres IKKE (allerede rettet + verificeret)
- Backdrop issfaerer (v3.19)
- Topbar transparent (v3.18)
- Navbar let glas 0.55 (v3.18)
- Dots tier-ringe (v3.16-17)
- Filter-taleboble placering (v3.27-28)
- Filter/liste-knap placering + lys glas (v3.30)
- Radar stoerrelse + rykket op (v3.21, v3.24)
