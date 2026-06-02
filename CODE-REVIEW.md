# Bubble next-v8.50 — Code Review (fusioneret)

> To uafhængige reviews (Claude + eksternt) gennemført 28. maj 2026. Dette er den dedupliderede, verificerede fusion. Alle P0'er er bekræftet mod kodebasen (mål, ikke gæt). Dominerende risikoklasse begge reviews konvergerer på: **"siger systemet én ting mens backend-state er noget andet"** (fake-success / false continuity).

**Status-nøgle:** 🔴 Åben · 🟡 I gang · ✅ Fixet

---

## P0 — kritiske (luk før bred launch / næste event)

### P0.1 ✅ — logged-in `?event=join_code` resolver ikke → "Event ikke fundet"
**Bekræftet:** b-boot.js:566. `checkGuestEventRoute()` logged-in gren gemmer RÅ `eventId` som `pending_join` uden resolution. Kun logged-out gren resolver via `.or('id.eq.X,join_code.eq.X')`. Senere slår `showDeepLinkModal('event', …)` kun op på `.eq('id', targetId)` → join_code (ikke-UUID) findes ikke.
**Konsekvens:** Logged-in bruger åbner legitimt event-link med join_code → fejl. Rammer den primære growth-sti.
**Fix:** Resolve join_code→bubble.id FØR `flowSet('pending_join', …)` også i logged-in grenen.

### P0.2 ✅ — fejlet check-in åbner stadig eventchat (false continuity)
**Bekræftet:** b-home.js:720 (medlem+live) og :740-748 (ikke-medlem+live). `openBubbleChat()` kører uanset `checkIn()`-resultat. Medlem+live-stien viser end ikke fejl ved mislykket check-in.
**Konsekvens:** Bruger tror de er checket ind (chatten åbner), men backend-state siger nej.
**Fix:** Ved fejlet check-in: vis retry/fejl, åbn IKKE chatten automatisk (eller åbn med tydelig "ikke checket ind"-tilstand).

### P0.3 🟡 — instant ownership transfer uden accept/cancel
**Bekræftet:** b-utils.js:1087 `transferBubble` gør direkte `update({created_by})`. Envejsdør, ingen pending/accept/withdraw.
**Status:** Adresseres af ADR-009 del 2 — backend-migration klar (adr009-ownership-migration.sql), frontend mangler.

### P0.4 ✅ — realtime gen-tilslutter ikke ved app-resume (iOS PWA)
**Bekræftet:** b-boot.js:1018 visibilitychange→foreground opdaterer data men trigger ingen `rtReconnect()`. Reconnect sker kun på `online`/`CHANNEL_ERROR`. iOS dræber WebSockets i baggrunden uden at fyre dem. Resume-refresh dækker ikke chat-skærme.
**Konsekvens:** Efter backgrounding midt i en chat streamer beskeder ikke ind. Rammer kerneoplevelsen ved events præcist.
**Fix:** Foreground-gren: health-check + `rtReconnect()` hvis `_rtState !== 'connected'`; inkludér chat-skærme i resume-refresh.

---

## P1 — vigtige

### P1.1 ✅ — contact deep-link tavs fejl
b-home.js:~588. Kontakt-`primaryFn`: ved `!result.ok` ingen fejl, `openPerson()` kører alligevel. Handling hedder "gem kontakt" men fejl ser ud som succes.
**Fix:** Vis fejl, bliv i modal ved fejl.

### P1.2 ✅ — OAuth-exchange-fejl uden brugerfeedback
b-auth.js:~160. `exchangeCodeForSession` fanger fejl, logger kun, falder igennem til auth-skærm uden besked.
**Fix:** Eksplicit fejl-besked ved exchange-failure.

### P1.3 🔴 — three-way join-race
`checkQRJoin` + `checkPendingJoin` deler `_joinInFlight`; `resolvePostAuthDestination` (b-auth.js) står udenfor.
**Fix:** Lad resolvePostAuthDestination respektere samme mutex, eller konsolidér til én join-resolver.

### P1.4 🔴 — inkonsistent write-lag (dbActions omgås)
~6 direkte `profiles.update` (b-profile.js) + reactions/role/creation udenom dbActions. Nogle fire-and-forget (is_anon b-profile.js:1155) → UI/DB kan divergere stille.
**Fix:** Flyt kritiske writes (især profil) til dbActions. (Sprint 3.)

### P1.5 🔴 — SW notification-click dobbelt-navigation
Service worker gør både `postMessage` og `navigate`. Test for dobbelt-routing på: iOS PWA, Android Chrome, app åben, cold start.

---

## Likely / edge

- Cross-session flow-flag-læk: resetAppState rydder bevidst ikke flow-flags; delt enhed ved event + login inden for 15 min TTL kan arve pending_join/contact.
- Mode B join fejler tavst (b-bubbles.js:~1375): "du er klar"-QR uden bekræftet medlemskab (bevidst, men framingen lover for meget).
- Bubble-creation ikke-transaktionel (b-bubbles.js:903-906): fejler member-insert → boble uden ejer-medlemsrække.

---

## Bekræftede ikke-problemer (kontekst)

- **Push hybrid** (frontend approved/checkin/join_request + backend new_message/invitation) er den BESLUTTEDE slut-tilstand fra ADR-006, ikke en ufærdig transition. Dokumenteret.

---

## Prioriteret fix-rækkefølge

1. P0.1 — join_code resolution (logged-in)
2. P0.2 — stop openBubbleChat efter fejlet check-in
3. P0.4 — realtime resume reconnect
4. P0.3 — ownership request-flow (ADR-009, parallelt)
5. P1.1, P1.2, P1.3 — quick trust-fixes
6. P1.4, P1.5 — strukturelle
7. Smoke tests: event-QR (logged-in/out × UUID/join_code), logout/login-læk, check-in-fejl

*Begge P0.1+P0.2 er små, afgrænsede fixes. Ingen P0 kræver omarkitektering.*

---

*Oprettet 28. maj 2026 fra to konvergerende reviews. Verificeret mod next-v8.50.*

---

# Bubble next-v8.87 — Eksternt review (maj 2026)

> Målrettet eksternt review af v8.87 med fokus på tidligere svage områder: realtime, join/deeplink, fake-success, state, ownership, write-patterns. Alle fund nedenfor er verificeret mod koden (mål, ikke gæt). **Hovedkonklusion: v8.87 er det første build vurderet "pilot-modent" — tyngdepunktet er flyttet fra "system der skal reddes teknisk" til "produkt der skal testes med mennesker".** Det er normalt dér solo-founder-projekter falder fra hinanden, så det er et reelt fremskridt.

## Lukkede siden v8.50-review (nu verificeret ✅)
- ✅ **Realtime-resume** — `visibilitychange` + `rtReconnect()` ved `_bgMs > 8000`, eksplicit håndtering af at iOS dræber WebSockets i baggrunden + refresh af aktive chat-skærme. (Største tidligere bekymring: baggrund→død socket→falsk "chat virker".) **NB: kode-bekræftet, men skal device-verificeres på iPhone — kode-review kan ikke bevise at det virker i praksis.**
- ✅ **Kontakt deep-link fake-success** — `if (!result.ok) return` før profil åbnes.
- ✅ **Check-in fake-success** — fejlet check-in viser fejl-toast, åbner IKKE chat.
- ✅ **OAuth-fejl** — `_pkceFailed` markeres eksplicit, ikke længere tavst tilbage til login.
- ✅ **Join-races** — mutex-beskyttelse tilføjet.

## Tilbageværende fund (logget i de rette docs)
- 🔴 **P1.1 Ownership transfer er instant** — ingen accept/pending/rollback/cancel. Kaldt "største tilbageværende governance-svaghed". → logget ved ADR-009 i TECH-DEBT.md (hovedspor).
- 🟡 **P1.2 Hybrid push** — `sendPush()` frontend-kaldt ved join_request/approved/checkin mens new_message/invitation er backend-ejede. → TECH-DEBT.md (P2, dokumentér + konsolidér før native).
- 🟡 **P1.3 Deep-link flow spredt** — checkGuestEventRoute/checkQRJoin/checkPendingJoin/resolvePostAuthDestination. Bedre end før, men kompleksitet kan akkumulere. Ikke bug.
- 🟡 **P2 Direkte writes udenom dbActions** — 18 profiles.update bypasses. → TECH-DEBT.md (P1 native blocker).
- 🟡 **P2 Magic delays** — setTimeout(400) i auth/deeplink. → TECH-DEBT.md (P3).

## Launch readiness (review-vurdering)
Intern test ✅ · Kontrolleret beta ✅ · Pilot ✅ · Bred launch ⚠️ næsten.

## VIGTIGT — ikke nævnt i reviewet, men stadig åbent
- 🔴 **GDPR-sletning fejler** (OPEN-QUESTIONS Q-014/relateret): FK-relationer blokerer sletning af bruger der har skabt indhold. Pilot-brugere VIL bede om sletning. P0, ikke dækket af dette review. Et positivt review må ikke overskygge denne åbne mur.

## De 3 mest risikable flows at device-teste (review-anbefaling)
1. Event QR → signup → onboarding → event (mest komplekse flow i hele Bubble)
2. App i baggrund → tilbage → chat (især iPhone — ny løsning ser god ud, skal verificeres)
3. Ownership transfer ("hov, det var ikke det jeg mente")

*Oprettet maj 2026 fra eksternt v8.87-review. Fund verificeret mod next-v8.87.*
