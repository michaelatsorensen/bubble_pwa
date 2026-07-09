# V3 MIGRATION MAP — gammelt design → prototype (loven)

Kontrast-verificeret 9. juli 2026. Alle prototype-kombinationer består WCAG AA.
Prototype-scene = #0E141C. Glas-fyld 0.075 = effektiv #20252D.

## FARVE-MAPPING (gammelt → prototype)

| Gammelt (skal væk) | Prototype-erstatning | Rolle |
|---|---|---|
| #170F34 / rgba(23,15,52,*) midnight | #0E141C scene / rgba(20,22,28,*) navbar-glas | baggrund/chrome |
| #7C5CFC / #685CFC / rgba(104,92,252) lilla-fill | rgba(100,180,230,0.16) isblå-glas | UI-flader |
| #AFA9EC lilla-tekst/ikon | #CFE6F7 (isblå-lys) el. rgba(255,255,255,0.5) | tekst/ikon |
| gradient-primary (lilla) | rgb(100,180,230) solid + glow | CTA-knapper |
| rgba(255,255,255,0.055/0.06) svagt glas | rgba(255,255,255,0.075) | kort-fyld (uden blur) |

## TEKST-HIERARKI (prototype — kontrast-sikkert)
- Titler/navne: rgba(255,255,255,0.95) — 16.7:1 på scene
- Subtitler/meta: rgba(255,255,255,0.5) — 5.3:1 på scene, 4.93:1 på glas
- Hints: rgba(255,255,255,0.4) — 3.82:1 (kun stor tekst)
- CTA/accent-tekst: #CFE6F7 — 14.4:1
- Teal live/events: #A7EDE4 (13.98:1) / #2ECFCF (9.64:1)

## GLAS (prototype — 3 niveauer)
- Kort-fyld: rgba(255,255,255,0.075), border 0.5px rgba(255,255,255,0.12), inset 0 1px 0 rgba(255,255,255,0.08)
- CTA-glas: rgba(100,180,230,0.16), border rgba(100,180,230,0.3), tekst #CFE6F7
- CTA-solid: rgb(100,180,230), tekst #0E2A3C, glow 0 4px 16px rgba(100,180,230,0.35)
- Navbar: rgba(20,22,28,0.9) (hævet fra 0.55 pga fjernet blur)

## BACKDROP-FILTER (twitch-fælde på iOS!)
- 177 forekomster i nuværende v3 (125 css + 52 js)
- Prototype bruger backdrop-filter SPARSOMT
- REGEL: fjern backdrop-filter på scroll-indhold (kort/rækker). Behold KUN på: topbar, navbar, sheets (få, store, faste flader)
- Kompensér fjernet blur med hævet fyld-opacitet (0.055 → 0.075)

## SPACING (prototype/next — bekræftet ideel)
- Topbar margin-top: max(calc(env(safe-area-inset-top,0px) - 10px), 4px)
- Scroll-container: viewport-bundet (screen-wrapper SKAL være flex-column)
- Navbar bund: max(env(safe-area-inset-bottom,0px), 14px)

## RADAR (prototype-eksakt)
- maxR=132, container 344px, 25 dots (13 aktive i live), dist=0.15+(1-match/100)*0.74
- Ringe: 6 koncentriske, isblå-dybde indad (yderst 0.012 → inderst 0.15)
- ⛔ ALDRIG 100dvh i app.css — brug 100vh + visualViewport (revertet 3×)
