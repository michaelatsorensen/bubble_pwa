# BUBBLE v3 — FRONTEND ARKITEKTUR

Til nye udviklere: læs denne FØRST. Den forklarer hvordan styling er organiseret.

## Design-system: prototypen er loven
Al styling stammer fra prototypen (Bubble_Glass_App.html). Se MIGRATION-MAP.md
for den kontrast-verificerede værdi-mapping.

## Token-hierarki (app.css :root)
1. **★ PROTOTYPE TOKENS (--p-*)** — KILDEN TIL SANDHED. Rene, kontrast-verificerede.
   Alle nye styles SKAL referere disse. Fx: `background: var(--p-glass)`.
2. **Semantiske tokens (--text-1, --isbla, --n1-*, osv.)** — peger mod --p-* via alias.
   Bevaret for bagudkompatibilitet med de 592 eksisterende klasser.
3. **Hybrid/light tokens (--text-on-light osv.)** — HISTORISK GÆLD fra light-æraen.
   Under udfasning. Brug --p-* i stedet for nyt arbejde.

## Regler for nyt arbejde
- **INGEN nye inline-styles.** Al styling i klasser i app.css.
- Klasse-navngivning: BEM-agtig med prefix pr. domæne (.bb-* bubbles, .pp-* person-preview,
  .badge-* badges, .radar-* radar). Følg eksisterende mønster.
- Referer altid --p-* tokens, aldrig hardcodede farver.
- **Kontrast er den største faldgrube.** Verificer hver tekst-på-baggrund mod WCAG AA (4.5:1).
  Prototype-tokens er allerede verificeret — brug dem, så arver du sikkerheden.
- **backdrop-filter er en iOS-twitch-fælde.** Kun på faste flader (topbar/navbar/sheets),
  ALDRIG på scroll-indhold. Kompensér med hævet fyld (--p-glass).

## Migration-status (v3.03)
- [x] app.css farver → prototype (0 midnight-rester)
- [x] backdrop-filter 125 → 25 (twitch-fix)
- [x] Prototype-token-lag etableret
- [x] Semantiske tokens aliaset mod prototype
- [ ] index.html inline-styles → klasser (702 tilbage)
- [ ] JS-genereret HTML inline-styles → klasser (b-home, b-bubbles, b-chat, ...)
- [ ] Skærm-for-skærm prototype-tro finish

## Filstruktur
- app.css — al styling (592 klasser + tokens)
- index.html — app-shell + skærm-struktur (migreres til klasser)
- b-*.js — logik + genereret HTML (nervesystem: Supabase/auth/realtime)
- Nervesystemet (b-boot, b-auth, b-realtime, b-utils dbActions) RØRES IKKE ved styling-migration.

## Bevidst bevarede "lilla"-forekomster (IKKE gæld)
Efter migration er der 8 lilla-forekomster tilbage — alle legitime:
- **tag-data.js `rolle` #7C5CFC** — prototypen bruger SELV denne farve for rolle-tag-kategorien.
  Tag-kategori-farver er en funktionel taksonomi (rolle=lilla/branche=blå/kompetence=teal/interesse=pink).
- **Avatar-glows rgba(124,92,252,*)** — skygge på avatar-elementer, matcher prototypens
  avatar-gradient. Avatar-farver er en dokumenteret prototype-undtagelse. Token: --p-avatar-glow.
- **proximity-map** — geo-feature, urørt (aktiveres ikke før pilot).
