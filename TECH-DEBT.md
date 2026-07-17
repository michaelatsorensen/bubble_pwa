# Bubble — Tech Debt Registry

> **Formål:** Samlet oversigt over kendt teknisk gæld med owner, priority og påvirkning.
>
> **Hvornår tilføjes til denne fil?** Når en tech-debt-item er identificeret med tilstrækkelig dybde (ikke bare "vi burde rydde op" — skal have konkret beskrivelse, root cause hypothesis, og fix scope).
>
> **Status:** Oprettet maj 2026. Migration fra ARCHITECTURE-MAP.md "failure modes" sker gradvist.

## Konventioner

### Priority

- **P0 — Critical:** Security, data loss, irreversible migration risk
- **P1 — Native blocker:** Skal løses før Q1 2027 native rewrite
- **P2 — Operational:** Affecter daglig drift eller observability
- **P3 — Cleanup:** Nice-to-have, dead code, naming consistency

### Status

- **IDENTIFIED** — kendt men ikke planlagt
- **PLANNED** — i roadmap med rough ETA
- **IN_PROGRESS** — aktivt arbejde
- **RESOLVED** — fixed, dokumenteret som lærings-entry
- **WONT_FIX** — accepteret som permanent trade-off

### Skabelon

```markdown
## TD-XXX: [Kort titel]

**Priority:** P0 | P1 | P2 | P3
**Status:** IDENTIFIED | PLANNED | IN_PROGRESS | RESOLVED | WONT_FIX
**Owner:** Michael / TBD
**Estimated fix:** S (1-2h) | M (half day) | L (1-2 days) | XL (week+)

### Symptom
Hvordan manifesterer det sig?

### Root cause (hypothesis)
Hvad er årsagen — og hvor sikre er vi?

### Impact
- User-facing: ...
- Developer-facing: ...
- Future-facing (native): ...

### Fix sketch
Konkret approach. Ikke fuld design — bare retning.

### Related
- Open questions: Q-XXX
- ARCHITECTURE-MAP.md sektion: ...
- ADR (hvis fix kræver beslutning): ADR-XXX
```

---

## Tech Debt Items

*Ingen items migreret endnu. Første kandidater fra Section 19:*

### Candidates pending migration from ARCHITECTURE-MAP.md Section 19

Følgende failure modes er allerede dokumenteret og bør migreres til TD-format efter Q-050 til Q-055 er verificeret:

| Kandidat | Foreslået priority | Source |
|---|---|---|
| Hardcoded secrets in trigger functions | **P0** (security) | FM-3, Q-055 |
| recipient_id vs user_id mismatch | **P1** (silent failures) | FM-1, Q-051, Q-052 |
| Double triggers on invitations | **P1** (UX bug) | FM-2, Q-050 |
| Parallel dispatch via b-utils.js sendPush() | **P2** (cleanup) | FM-4, Q-053 |
| No push delivery logging | **P1** (native blocker — observability required) | FM-6, Q-054 |
| No retry/idempotency | **P2** (operational) | FM-7 |
| Body format mismatch | **P1** (silent failures) | FM-5, Q-051 |

---

*Sidst opdateret: 18. maj 2026*

---

## Opdatering 28. maj 2026

### ✅ LØST — push-gæld (ADR-006 lukket)
Hele push-tabellen ovenfor er adresseret af ADR-006: hardcodede secrets fjernet (Vej A — header unødvendig pga --no-verify-jwt, ingen Vault), recipient_id→user_id fikset, dobbelt-triggers konsolideret (3 canonical tilbage), push_events observability bygget, frontend sendPush fjernet for trigger-dækkede typer. Push er nu backend-ejet + observerbart.

### Nye poster

| Post | Priority | Note |
|---|---|---|
| Invite-modal live-refresh | **P3** | Afsenders åbne invite-modal opdaterer ikke "Afventer" når modtager afviser et andet sted. Luk+åbn fikser det. Bevidst udskudt (ADR-009) — sjælden kant, realtime-kompleksitet dårlig bytte. Byg kun hvis pilot viser det generer. |
| Dobbelt DELETE-policy på bubble_invitations | **P3** | "Owner can delete invitations" + "bubble_invitations_delete" overlapper (begge tillader sletning, OR-baseret = harmløs redundans). Ryd op ved generel policy-oprydning. |
| ADR-009 punkt 2 — ejerskab request-flow | **(feature, ikke debt)** | Migration (pending_owner kolonner) + 2 RPC'er (accept/afvis) + frontend-split + modtager-UI. Besluttet, ikke bygget. **Ekstern v8.87-review (maj 2026) bekræfter:** instant `transferBubble()` + straks success-toast, ingen accept/pending/rollback/cancel — kaldt "den største tilbageværende governance-svaghed" og reel risiko for "hov, det var ikke det jeg mente". Validerer at dette er rette hovedspor. |
| Password-recovery virker ikke (glemt password) | **P1 — bruger-kritisk** | Reset-flow lukker bare brugeren IND i appen uden at bede om nyt password. Bruger der har glemt password får adgang, men kan ALDRIG ændre password → reelt en bruger uden vej tilbage hvis de ikke husker det. **Diagnose (jun 2026, bekræftet i kode):** `handleForgotPassword` (b-auth.js:573) kalder `resetPasswordForEmail` med `redirectTo: getOAuthRedirectTo()` (samme som normalt login). Auth-listener (b-auth.js:187 `onAuthStateChange`) håndterer `SIGNED_IN` men har INGEN `PASSWORD_RECOVERY`-case. Supabase etablerer recovery-session + udløser PASSWORD_RECOVERY-event → appen lytter ikke → falder igennem til normal SIGNED_IN → ind i appen uden password-skift. **Ikke et åbent hul** (token er engangs, udløber, kræver mail-adgang — konto ikke kompromitteret) MEN funktionelt brudt + recovery-session burde være begrænset tilstand (kun password-skift), ikke fuld adgang. **Fix (auth-kritisk, gør grundigt — IKKE hastes):** (1) fang `PASSWORD_RECOVERY` i onAuthStateChange, (2) ny "vælg nyt password"-skærm, (3) `updateUser({password})`, (4) så ind i app. SKAL koordineres med `_cameFromLanding`/`shouldBypassLanding`-guard + flow-flags (forgot-password bevarer allerede flow-flags pr. v8.17.15) så recovery-redirect ikke kolliderer. Mockup-først på password-skærm. Test: rigtig reset-mail → skærm tvinger nyt password → login med nyt virker. |
| Tastatur skubber UI i chat (iOS PWA) | **P2 — kendt, ikke-blokerende** | Når input fokuseres i boble-chat/DM skubber tastaturet hele layoutet (ses v8.90 og før — IKKE introduceret af en ændring, det er oprindelig adfærd). **⛔ FORBUDT ZONE:** må IKKE løses via viewport-meta (`interactive-widget`) eller vh/dvh/100dvh — det er det lag I har kæmpet hårdt for at stabilisere over flere builds (v3/v6/v21 + Ulefone-sagen). v8.91 prøvede `interactive-widget=resizes-visual` → genintroducerede 100dvh-layout-kollaps, rullet tilbage i v8.92. **Allerede prøvet/på plads (virker, men løser ikke skubbet):** composer er flex-shrink:0 i normal flow (ikke fixed), `padding-bottom: calc(+env(safe-area-inset-bottom))`, `enterkeyhint=send`. **Uudforsket spor (eneste tilbage):** `window.visualViewport` resize/scroll-listener der KUN flytter chat-composer (translateY) så den følger tastaturets top — uden at røre html/body/viewport. Isoleret til chat-skærm. KRÆVER mockup-først + grundig undersøgelse + multi-device-test FØR deploy — ikke et hurtigt gæt midt i pilot. Ikke-blokerende (man kan stadig skrive+sende), så lav prioritet trods irritation. |
| Sheet-animation harmonisering | **P3** | Bund-sheets bruger uensartet open-easing: de fleste (modal-sheet, person-sheet) har bounce `cubic-bezier(0.34,1.56,0.64,1)`; list-view (home-tray) + guide-sheet (v8.84) bruger ren glid `cubic-bezier(0.32,0.72,0,1)`. **Indsigt (maj 2026):** den rene glid er referencen — den føles mest gennemarbejdet OG bounce-overshootet kan løfte sheetens bund over skærmkanten = kortvarigt hvidt gab (set+fikset på guide-sheet i v8.84). JS-open-mekanik er også uensartet (setTimeout(10) vs void offsetHeight vs double-rAF vs bare classList — alle virker, ingen er knækket). Harmonisér ALLE bund-sheets til ren glid + ét open-mønster. Rører person-sheet/gif-picker/bb-sheet m.fl. — tag som egen fokuseret opgave EFTER pilot, ikke midt i test. |
| Hybrid push-ownership (frontend + backend) | **P2** | Eksternt v8.87-review (maj 2026), verificeret i kode: `sendPush()` kaldes stadig fra frontend ved join_request (b-bubbles:942), approved (b-chat:1725, b-notifications:325), checkin (b-live:511) — mens new_message + invitation er backend-ejede via DB-triggers (ADR-006). Resultat: nogle notifikationer backend-ejede, andre frontend-ejede. Ikke launch-blocker, ikke nødvendigvis forkert — men kontrakten skal DOKUMENTERES (hvilke er hvilke + hvorfor), og helst konsolideres mod backend-ejet før native (samme grund som ADR-006). |
| Direkte writes udenom dbActions | **P1 (native blocker)** | Eksternt v8.87-review + verificeret: 18 `profiles.update`-kald går udenom dbActions write-laget. Ikke kritisk i drift, men native-migration bliver markant lettere med ÉT canonical write-lag (kontrakt-enforcement før frontend skiftes). Migrér de 18 inkrementelt til dbActions før Q1 2027. |
| Magic delays i auth/deeplink | **P3** | Eksternt v8.87-review + verificeret: `setTimeout(..., 400)` wrapper deep-link-modaler i b-auth (linje 84/91/100), plus 300ms diverse steder. Ikke bugs (virker), men skrøbeligt — timing-afhængighed frem for event-drevet. Hold øje med; ryd op hvis et deeplink-flow viser race i pilot. |

*Sidst opdateret: 28. maj 2026*

---

## Sanity-check fund (jun 2026) — P3, lad ligge, fokuseret oprydningsrunde senere

Fra tværgående sanity check efter v9.01. Intet kritisk, intet i stykker — kosmetisk/konsistens, samlet til én oprydningsrunde.

- **4 lilla-legacy-rester (`var(--gradient-primary)`):** overlevede design v6-migrationen. (1) b-home.js:228 radar-toggle "Alle"-fane aktiv-tilstand — MEST synlig. (2) b-bubbles.js:376 generisk confirm-dialog-knap. (3+4) b-bubbles.js:1964+1993 event-rapport header-kort + nummer-cirkler (måske bevidst, det er print/PDF-agtig rapport — afklar før fix). Skift til Isblå CTA-tokens hvor ikke bevidst.
- **Hardcoded danske strenge i b-auth.js:** bekræftelsesmail-skærmen (linje ~509-527: "Jeg har bekræftet — log ind", "Vi har sendt en bekræftelsesmail...") + beta-beskrivelse (~721). Ikke i i18n → engelske brugere ser dansk. Flyt til t()-nøgler.
- **P3-tællere (allerede kendt):** ~35 console.debug/log spredt (b-realtime 9, b-bubbles 7, b-live 6 størst), 43 `transition:all` i app.css. Står allerede på P3-backlog.
- **Døde localStorage-stjernenøgler efter DB-migration (v3.132, jul 2026):** Da bubble- + kontakt-stjerner blev flyttet til DB (`bubble_stars` + `contact_stars`-tabeller), holdt koden op med at LÆSE de to gamle localStorage-nøgler `bubble_bubblestars` (bobler) + `bubble_stars` (kontakter — forvirrende genbrug af navnet som DB-tabellen, men det er en localStorage-key). Ingen aktiv sletning → nøglerne bliver liggende ubrugt i alle eksisterende brugeres browsere. Harmløst (koden rører dem aldrig igen), rent kosmetisk hygiejne. **Fix:** engangs-oprydning ved boot der kalder `localStorage.removeItem('bubble_bubblestars')` + `localStorage.removeItem('bubble_stars')`. Kan evt. gates bag et migrations-flag så den kun kører én gang. Lav sammen med resten af oprydningsrunden — ingen hast.

Verificeret RENT samme check: alle 21 .js syntaks-OK, CSS brace −1, dvh-guard rent, version konsistent v9.01, i18n 679/679 balanceret, dagens ADR-009 + recovery-funktioner alle forbundet (ingen døde referencer).

---

## Sikkerheds-audit fund (19. juni 2026) — RLS lint på live DB

Tværgående RLS-audit af ALLE policies via genbrugelig lint-query (nederst). Kørt mod live `pg_policies` → 13 flag, men de fleste var **med vilje** (offentlige profiler, reaktioner, gæste-INSERT). Reelle fund: 4. **Alle 4 tunge lukket i dag** (cross-user beskedlæsning, guest_checkins PII, INSERT-rolle-eskalering — verificeret LIVE; + bubble_message_edits, se nedenfor). Tilbage = **2 ægte men lav-risiko-ved-pilotskala** (qr_tokens, hidden) + 1 P3 + 1 falsk-positiv-at-verificere.

> **Vigtigt — skal adresseres senere:** qr_tokens og hidden er IKKE pilot-blokkere ved ~500 betroede brugere i Sønderborg. Men de **SKAL lukkes før betalt event-check-in / national skalering**, hvor der er motiv + penge på check-in. Designet er fanget herunder så intet går tabt — de kan bygges koldt uden at re-undersøge.

### ✅ LØST i dag — bubble_message_edits (var reel beskedindhold-læk)
Redigerings-historik holdt original beskedtekst; SELECT + INSERT begge `true` → enhver kunne læse beskedindhold i ALLE bobler (også de private vi netop medlems-gatede på bubble_messages) + forfalske historik. Lukket: medlems-gate læsning + forfatter-kun skrivning. Migration `migrations/2026-06_message-edits-hardening.sql`, verificeret LIVE (3 policies, ingen `true`) + replica-test `tests/db/run-bubble-message-edits-test.sh` (7/7, neg-kontrol rød mod gamle policies). Commit b860827.

### Tilbageværende

| Post | Priority | Note |
|---|---|---|
| **qr_tokens — verdens-læsbar token→bruger-mapping** | **P2 — før betalt check-in / skalering** | `anyone_can_read_qr_tokens` (SELECT `true`) → enhver kan dumpe HELE token→user_id-mappingen for alle aktive QR-koder. Bryder bærer-token-modellen (pointen er at SCANNE QR'en for at få den; verdens-læsbar = man kan forfalske check-ins uden at scanne). **Adgangskort (verificeret i kode jun 2026):** 3 læsninger af FREMMEDE tokens (scanner b-live.js:585, connect-scan b-live.js:947, boot-resolve fra `?qrt=` b-boot.js:225) = hullet → skal gennem RPC. 1 EGEN-læsning (b-admin.js:483, `.eq('user_id', currentUser.id)`) → dækkes af egen-læs-policy. INSERT (b-utils.js:1081 + b-auth.js:877, begge `user_id: currentUser.id`) → allerede scopet, INGEN ændring. Tokens er korte random strings (`^[a-z0-9]+$` ≤40) + expiry → brute-force mod RPC urealistisk. **FIX (DB):** `CREATE FUNCTION resolve_qr_token(p_token text) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT user_id FROM qr_tokens WHERE token=p_token AND expires_at>now() LIMIT 1 $$;` + `REVOKE ALL FROM public` + `GRANT EXECUTE TO anon,authenticated`. Returnerer ÉN user_id for præsenteret token = ingen enumeration. Lås tabel: `DROP POLICY anyone_can_read_qr_tokens` + `CREATE POLICY qr_tokens_owner_read FOR SELECT USING (user_id=auth.uid())`. **FIX (frontend, prod+next):** de 3 fremmed-opslag → `sb.rpc('resolve_qr_token',{p_token:qrt})`. UX-konsekvens: RPC returnerer `null` for både udløbet OG ikke-fundet → den specifikke "QR udløbet"-besked smelter til generisk "ugyldig/udløbet" (eller byg status-returnerende variant hvis vigtigt). Behold b-live.js:585-fallback til `profileParam` ved null. **⚠️ KRITISK DEPLOY-RÆKKEFØLGE (ellers dør scanneren for live-brugere):** (1) Kør KUN `CREATE FUNCTION` + grants — additivt, live-frontend kører uændret. (2) Deploy frontend der bruger RPC (prod-root, det live brugere rammer). (3) Kør lås (drop true-policy + egen-læs). ALDRIG lås før frontend bruger RPC. **Estimat:** M (koordineret DB+frontend, men afgrænset). Byg replica-test: resolve gyldig→user_id, udløbet→null, enumeration blokeret efter lås. |
| **bubbles "hidden" — ulistede bobler verdens-læsbare** | **P2 — før skalering; afklar FØRST om hidden bruges** | `bubbles` SELECT OR-DEFEAT: `true`-policies ("Alle kan se bobler", "bubbles_select") sameksisterer med den visibility-baserede → slår scopingen ud. App klient-filtrerer bevidst `hidden` væk i liste-query (b-bubbles.js:134, `.or('visibility.eq.public,visibility.eq.private,visibility.is.null')`) MEN RLS er `true` → hidden-bobler er IKKE skjult på API-niveau, kun i standard-UI. Eye-off-ikon + eksplicit filter (3 værdier private/public/hidden, b-bubbles.js:629) viser INTENTIONEN er ulistet — RLS håndhæver den ikke. **BLOKERET PÅ BESLUTNING:** Hvad lover "hidden" brugeren — hemmeligt/ulistet rum? Og skal MEDLEMMER af et hidden-rum stadig kunne se det? (Styrer subquery'en.) Afklar OGSÅ om hidden overhovedet bruges i piloten — hvis stort set ikke, intet at gøre før skalering. **FIX-FORM (når besluttet):** DROP true-policierne; `CREATE` visibility-scopet SELECT: `visibility IN ('public','private') OR created_by=auth.uid() OR EXISTS(medlem af boblen)`. `bubble_members` SELECT `true` hænger sammen — bør scopes til synlige bobler i samme ombæring, ellers kan man se hvem der er i et hidden-rum. Replica-test: hidden synlig for ejer+medlem, usynlig for udenforstående; public/private uændret. **Estimat:** M. Cross-ref OPEN-QUESTIONS (hidden-semantik). |
| custom_tags UPDATE `true` — tag-hærværk | **P3 — post-pilot policy-oprydning** | `custom_tags_update` USING `true` → enhver kan UPDATE enhver tag (omdøbe/ændre andres). Global tag-katalog (`created_by` sat i onboarding b-onboarding.js:736). Eneste legitime UPDATE er `usage_count++` (b-onboarding.js:735) når tag genbruges → kan IKKE bare scopes til created_by (ville bryde usage_count på andres tags). Ingen læk/eskalering — kun hærværks-potentiale. **Fix:** SECURITY DEFINER `increment_tag_usage(tag_id)` (bumper kun usage_count) + lås UPDATE (eller trigger der afviser ændring af alt andet end usage_count). **Estimat:** S-M. |
| bubbles UPDATE "owner_can_update" — verificér | **Verificér (sandsynligvis falsk positiv)** | Flagget AABEN SKRIVNING KUN fordi `WITH CHECK (true)`. For UPDATE gater `USING`-klausulen HVEM; `WITH CHECK true` = ingen begrænsning på nye værdier = normalt. Hvis `USING` er `created_by=auth.uid()` (navnet siger det), er det IKKE et hul. **Verificér:** `SELECT qual FROM pg_policies WHERE policyname='owner_can_update'`. Linten over-flagger UPDATE med `with_check=true` — kendt grænse. **Estimat:** 5 min. |
| profiles SELECT `true` før geolocation | **Forward-looking — BLOKER geo-aktivering** | profiles SELECT `true` = offentligt katalog by design (hele appen er at finde folk) — IKKE en bug. MEN: når geolocation `last_lat/last_lng` lander fra P2-backloggen, eksponerer verdens-læsbare profiler PRÆCIS position for alle. **BLOKER geo-aktivering på at scope profiles SELECT først** (ellers lækker du position dag ét). Overvej også: skal anon (udlogget) kunne læse hele kataloget? Bevidst valg, ikke haste. Cross-ref P2 geolocation-spec. |

### Genbrugelig RLS-audit lint (kør når som helst mod live `pg_policies`)

Flagger hver tabel+kommando hvor en `true`-policy enten slår en stram policy ud (OR-DEFEAT) eller står alene på data der måske er privat. **Dømmer ikke** — kun du ved hvad der er privat-by-design (et `true` på en reaktion er fint; på en privat boble er det et hul). Verificeret mod plantede mønstre. Kan flyttes til VERIFICATION-GUIDE.md ved lejlighed.

```sql
WITH p AS (
  SELECT tablename, cmd, policyname,
         (qual       IS NOT DISTINCT FROM 'true') AS read_true,
         (with_check IS NOT DISTINCT FROM 'true') AS write_true
  FROM pg_policies
  WHERE schemaname='public' AND permissive='PERMISSIVE'
)
SELECT tablename AS tabel, cmd AS kommando,
       string_agg(DISTINCT policyname, ' | ') AS policies,
       CASE
         WHEN bool_or(read_true OR write_true) AND bool_or(NOT (read_true OR write_true))
              THEN '1 OR-DEFEAT (true slaar stram policy ud)'
         WHEN bool_or(read_true)  THEN '2 AABEN LAESNING (er data privat?)'
         WHEN bool_or(write_true) THEN '3 AABEN SKRIVNING (integritet?)'
       END AS risiko
FROM p
GROUP BY tablename, cmd
HAVING bool_or(read_true) OR bool_or(write_true)
ORDER BY risiko, tabel;
```

*Sidst opdateret: 19. juni 2026*

---

## Ekstern v3.131-review + self-audit (11. juli 2026)

Grundigt eksternt review af v3.131 gav NO-GO til HoS-pilot i nuvaerende form. Self-audit
mod faktisk kode (v3.135) + live Supabase bekraeftede/afkraeftede punkterne. Kernefund:
reviewets metode ("kan ikke se forsvaret i git-buildet") overvurderede systematisk
risiko, fordi de reelle sikkerhedsgraenser lever i Supabase, ikke i repo.

### VERIFICERET SIKKER — kritisk punkt allerede lukket
- **Privilegie-eskalering (reviewets skarpeste P0-9):** IKKE et hul. `profiles` UPDATE-policy
  tillader en bruger at forsoege at aendre egen raekke, MEN triggeren `trg_protect_profile_privs`
  (funktion `protect_profile_privs`) tvinger `role` + `banned` tilbage til gamle vaerdier for
  ikke-admins. `is_admin()` afgor status fra DB (umulig at narre fra klient), SECURITY DEFINER.
  En pilotbruger kan IKKE goere sig selv til admin eller af-banne sig selv. Kaeden holder.

### FIKSET i denne runde
- **Bubble-chat hentede aeldste 50 (P0-7):** FIKSET v3.136. Hentede `ascending:true limit 50`
  = aabnede paa de aeldste 50 = frossen-udseende chat i aktive events. Nu nyeste 50 desc +
  reverse til kronologisk, samme moenster som DM-load. (DM var allerede korrekt; posts-feed
  er bevidst desc — ikke en bug.)

### BACKLOG — reelt men ikke kritisk (pilotvaern nu, ordentligt post-pilot)
- **Push-autorisationshul (P0-3) — LUKKET 11. juli 2026 (v4 edge function):** `send-push` deployet med `--no-verify-jwt` = hele
  internettet kan sende push til en bruger hvis de kender UUID'et. IKKE databrud — kan kun
  SENDE en notifikation (spam/phishing-tekst), ikke laese/aendre/eskalere. **Kompleksitet:**
  3 DB-triggers (`notify_new_message`, `notify_bubble_invite`, `notify_contact_saved`) kalder
  funktionen via `net.http_post` UDEN auth-header — saa flaget kan ikke bare fjernes uden at
  braekke alle notifikationer (tavst, pga `EXCEPTION WHEN OTHERS`). **Fuld fix (Ring 2):** 3
  koordinerede skridt — (1) giv triggere shared-secret header, (2) deploy haerdet index.ts der
  accepterer BAADE JWT og trigger-secret + server-genereret tekst + caller-relation-check, (3)
  redeploy uden flaget. Haerdet `index.ts` allerede skrevet (edge_prep). **Pilotvaern:** slaa 4
  frontend-sendPush-kald fra (join_request/approved/checkin) — fjerner frontend-vektor, aabne-
  internet-hul bestaar. Acceptabel risiko for kontrolleret HoS-pilot.

  **LOEST:** Deployet v4 edge function med tillidsmodel — DB-triggere autentificerer
  via `x-push-trigger` shared-secret (PUSH_TRIGGER_SECRET) og beholder personlig tekst;
  frontend-kald kraever gyldigt JWT + faste servergenererede typer (kan ikke injicere fri
  tekst); alt andet afvises 401. Deployet UDEN `--no-verify-jwt` saa Supabase-gateway'en
  haandhaever JWT. Verificeret: push_events viser trigger-kald som `sent` efter laasning,
  ingen nedetid. Aabne-internet-hul lukket. Backup: index.ts.backup-foer-v4 paa PC.
- **Private filer offentlige (P0-4) — DELVIST 11. juli 2026:** DM + bubble-chat filer bruger
  permanent `getPublicUrl()`. Reelt databrud-potentiale (private samtaler/filer laekker via URL
  efter forladt boble/slettet besked/slettet konto). Avatar/ikon-brug er legitimt offentlig.
  **Pilotvaern:** slaa attachments fra. **Fix (Ring 2):** privat bucket + object path + kortlivede
  signed URLs efter medlemskabs/DM-check. Cross-ref memory "File URL-strategi uafklaret".

  **STATUS 11. juli 2026:**
  - DM-fil-upload SLUKKET (b-messages.js dmHandleFile tidlig afvisning + knap skjult i
    index.html). Mest foelsomme vektor (privat 1-til-1) lukket paa begge lag. GIF i DM
    uaendret (Giphy-URL, ingen upload). BEMAERK: kun frontend-slukket for pilot —
    backend storage-policy paa dm/-sti bevidst UDSKUDT og samlet med boble-migrering
    i Ring 2 (Michaels beslutning: laas hele fil-laget samlet, ikke én sti ad gangen).
  - Boble-fil-upload BEVIDST UDSKUDT / accepteret pilotrisiko. Nye boble-filer faar
    fortsat permanent getPublicUrl. Michaels beslutning: boblerne er smaa/personlige,
    kontrolleret pilot, kendte deltagere. MAA IKKE beskrives som "lukket" over for
    reviewer — det er accepteret risiko, ikke afhjaelpning.
  - 8 eksisterende boble-filer i private/skjulte bobler, ladt ligge (Michaels egne:
    familie/venner). Til gennemgang ved fuld migrering:
      * gif.gif — Michael & Frederik (hidden)
      * gif.gif — Drikkeklubben paa Bubble (hidden)
      * IMG_0703.jpeg — Koebenhavn 30.03.26 (hidden)
      * IMG_7400.jpeg + IMG_7401.jpeg — Familien Weiss Soerensen (hidden)
      * 2. Sal.jpg + 2. Sal_1.jpg + 2. Sal_2.jpg — Bubble (private)
  - FULD FIX (Ring 2): privat bucket + object paths + kortlivede signed URLs efter
    medlemskabskontrol for BAADE dm/ og boble-stier; migrér/gennemgaa de 8 filer;
    genaktivér DM-upload + behold boble-upload paa sikker grund. Avatars/ikoner
    (avatars/ + bubbles/*/icon-) forbliver offentlige — roer dem ikke.
- **external_url uvalideret (P0-6) — P3:** bubble `external_url` saettes direkte i href;
  escHtml beskytter markup men ikke protokol → `javascript:` passerer. Fix: whitelist kun
  `https:` klient+server. Hurtig frontend-fix.
- **QR .or()-injection i b-live.js (P0 fejlliste) — P3:** `joinCode` koncateneres direkte i
  `.or('join_code.eq.' + joinCode + ...)` uden validering. b-boot.js validerer ALLEREDE samme
  moenster (linje 539) — kopiér validerings-guard til b-live.js:681.
- **Consent-timestamp ikke entydig (P0-10) — P2:** email-signup stempler `terms_accepted_at`
  foer checkbox; OAuth-brugere m. fuldt navn+arbejdsplads springer onboarding-checkbox over. Gem
  terms/privacy-version + method, gate paa version ikke blot timestamp-eksistens. Post-pilot.
- **Ingen kill switches / allowlist (P0-1/P0-2) — P2:** ingen runtime-flags (registrering,
  push, uploads, maintenance) + ingen verificerbar server-side pilotadgang i build. Minimum foer
  bredere vaekst: allowlist + ét flag (registrering til/fra). Kontrolleret HoS-pilot kan koere
  uden, men aldrig ukontrolleret invitationsvaekst.

### BACKLOG — konkrete fejl (P3, oprydningsrunde)
- Admin ban/unban viser succes selv ved Supabase-fejl (ingen throw) — b-admin.js.
- `popBubble` ikke-transaktionel delete-kaede, ejerskabscheck kun paa hoved-boble (boern slettes
  foer ejer-verifikation). Byd RPC med transaktion post-pilot.
- Read-receipt broadcaster selv hvis `read_at`-write fejlede.
- Invitations (b-profile.js-sti) insert uden fejlcheck.
- 2 lilla-rester (`#6366F1`) i DM-empty-state + approved-modal + manifest theme-color er nu
  DOBBELT forkert efter midnight-retrofit (lilla #170F34 + hvid bg #FFFFFF). Ret ved designrunde.
- Skaleringslofter (alle P2, post-pilot): radar 200-profil-cap uden stabil sort, samtaleliste
  200-besked-afledning, DM 100-besked ingen aeldre-navigation, storage-cleanup 100-fil-cap.

### Skaleringsberedskab — Ring 2 foer NAESTE pilot (ikke HoS)
Server-side/pagineret profmatch, quotas/rate-limits, RPC-baseret invitation/join/checkin,
private realtime channels, storage lifecycle, incident playbook. Se reviewets Ring 2/3.

*Self-audit gennemfoert 11. juli 2026. Kritisk punkt (privilegie-eskalering) verificeret sikker.*


---

## TD-001: get_profile_preview ignorerer p_bubble_id — anon kan slaa enhver profil op

**Priority:** P0
**Status:** PLANNED — beslutning truffet 17. juli 2026, se ADR-010.
**Fundet:** 17. juli 2026, backend truth pack (review gate 3), verificeret mod produktion.

### BESLUTNING (ADR-010)
Profil-opslag **bindes til QR-token** i stedet for raat p_user_id — en anonym kan kun se
preview for et token de faktisk har scannet. Lukker enumerering ved roden (loeser ogsaa
det p_bubble_id-tjek der aldrig blev implementeret; parameteren udgaar).
`network`-feltet **fjernes** fra svaret: personens 5 kontakter hoerer til EFTER man er
forbundet, ikke paa doerklokken.
Beholdes: navn, titel, organisation, avatar, keywords + CTA "Forbind".
Princip: *foer adgang viser Bubble kontekst — efter adgang viser Bubble mennesker.*

### Symptom
`get_profile_preview(p_user_id uuid, p_bubble_id uuid DEFAULT NULL)` tager imod
`p_bubble_id`, men parameteren optraeder INTET sted i funktionskroppen. Frontend
SENDER den korrekt (b-boot.js:283), saa begraensningen var tydeligvis tiltaenkt —
serveren ignorerer den bare.

### Root cause (hypothesis)
Boble-kontekst-tjekket blev aldrig implementeret serverside. Signaturen antyder
intentionen "vis kun preview i konteksten af DENNE boble", men SQL'en filtrerer
aldrig paa den.

### Impact
Funktionen er SECURITY DEFINER med `anon=X` (bevidst — QR-scanning skal virke foer
login, se loadQRProfilePreview/checkQRAnonPreview). Men uden bubble-tjek kan en
IKKE-logget-ind kalder sende et vilkaarligt p_user_id og faa:
- navn, titel, arbejdsplads, avatar, keywords
- antal gemte kontakter
- offentlige bobler personen er medlem af
- **de 6 personer i vedkommendes netvaerk** (saved_contacts join profiles)

Dvs. hele brugerbasen kan enumereres af en anonym kalder der gaetter/kender UUIDs.
Ikke bare den QR-scannede person.

### Fix sketch
Beslut foerst hvad teaser-flowet FAKTISK skal vise (produktbeslutning, ikke kun
teknisk). Derefter enten:
(a) brug p_bubble_id: kraev at p_user_id er medlem af p_bubble_id, ELLER
(b) kraev et gyldigt QR-token som parameter i stedet for raa user_id, ELLER
(c) fjern `network`-feltet fra anon-svar (mindst indgribende).
MAA IKKE aendres blindt — QR-gaesteflowet braekker hvis anon-adgang fjernes helt.

### Related
- TD-002 (samme moenster i get_bubble_teaser)
- b-boot.js:283 (loadQRProfilePreview), b-boot.js:~250 (checkQRAnonPreview)
- Eksternt review 17. juli 2026 fandt IKKE dette — kraever laesning af funktionskrop
  mod produktion, ikke kun pakke-review.

---

## TD-002: get_bubble_teaser 'recent' lister hele databasens nyeste profiler

**Priority:** P0
**Status:** PLANNED — beslutning truffet 17. juli 2026, se ADR-010.
**Fundet:** 17. juli 2026, backend truth pack (review gate 3), verificeret mod produktion.

### BESLUTNING (ADR-010)
`recent`-feltet **fjernes helt**. Det var fallback-fyld ved tynde bobler (b-boot.js:423:
"Fallback: recent active profiles" naar boblen har <3 medlemmer) — men det serverede
systemets nyeste brugere som om de var i boblen. Baade misvisende OG laekkende.
`members`-feltet (boblens foerste 5) **fjernes ogsaa**: ansigter hoerer til efter adgang.
Boble-teaseren viser i stedet: navn, formaal, vaert/organisation (institutionelt social
proof — "Hosted by House of Software" er staerkere end fem ansigter og goer Verified
Bubbles synligt vaerdifuldt), tid/sted, aktivitetsniveau, én CTA.
Tom boble faar fallback: *"Vaer den foerste til at joine denne boble"* — et aerligt
loefte i stedet for laant fyld.
Princip: *foer adgang viser Bubble kontekst — efter adgang viser Bubble mennesker.*

### Symptom
`get_bubble_teaser(p_bubble_id uuid)` returnerer et `recent`-felt der henter de 6
senest oprettede profiler i HELE databasen — uafhaengigt af p_bubble_id:

    select p.id, p.name, p.title, p.workplace, p.avatar_url, p.keywords
    from profiles p
    where p.name is not null and p.title is not null
      and coalesce(p.banned,false)=false and coalesce(p.is_anon,false)=false
    order by p.created_at desc limit 6

Ingen join til bubble_members. Ingen reference til p_bubble_id i det subquery.

### Root cause (hypothesis)
Sandsynligvis tiltaenkt som "nye ansigter i denne boble", men implementeret som
"nyeste profiler i systemet" — muligvis bevidst som fyld da pilotdata var tyndt.

### Impact
SECURITY DEFINER + `anon=X`. En anonym kalder faar loebende udleveret navn, titel og
arbejdsplads paa systemets nyeste brugere, uanset hvilken boble der spoerges om.
Kombineret med TD-001 kan brugerbasen kortlaegges uden login.
`member_count`, `members` og `host` er derimod korrekt bundet til p_bubble_id.

### Fix sketch
Afklar om `recent` skal vaere (a) boblens nyeste medlemmer (join bubble_members paa
p_bubble_id), (b) fjernes helt, eller (c) beholdes men kun for authenticated.
Bemaerk: `members`-feltet giver allerede boblens foerste 5 medlemmer — `recent` er
muligvis redundant.

### Related
- TD-001 (samme klasse af fejl)
- b-boot.js:418, b-boot.js:604 (get_bubble_teaser-kald)

---

## TD-003: bubble_messages INSERT — medlemskabskrav sat ud af kraft af loesere dubletter

**Priority:** P0
**Status:** IDENTIFIED
**Fundet:** 17. juli 2026, backend truth pack (review gate 3), verificeret mod produktion.

### Symptom
`bubble_messages` har TRE permissive INSERT-policies i produktion:

| Policy | Krav |
|---|---|
| "Medlemmer kan sende boble-beskeder" | user_id = auth.uid() **AND** EXISTS(bubble_members) |
| bubble_messages_insert | user_id = auth.uid() |
| "Users can insert own bubble messages" | user_id = auth.uid() |

Postgres OR-kombinerer permissive policies — den LOESESTE vinder. Medlemskabskravet
er derfor reelt doedt.

### Root cause (hypothesis)
Praecis samme faelde som 2026-06_rls-privacy-hardening.sql selv beskriver ("Postgres
OR-combines permissive policies so the loosest wins"). Den migration lukkede
dubletterne for SELECT, men de samme dubletter overlevede paa INSERT.

### Impact
Enhver logget-ind bruger kan skrive i ENHVER boble-chat — ogsaa bobler de ikke er
medlem af — hvis de kender bubble_id. Ikke datalaekage (laesning ER medlemsbegraenset,
verificeret), men uautoriseret skrivning.

### Fix sketch
Drop `bubble_messages_insert` og "Users can insert own bubble messages", behold
medlems-gaten. MEN: bevis foerst paa replica at den stramme policy daekker ALLE
legitime skrivestier (dbActions.sendBubbleMessage, bcHandleFile, evt. andre).
Den loese policy findes maaske netop fordi en sti braekkede uden den.

### Related
- migrations/2026-06_rls-privacy-hardening.sql (samme klasse, lukket for SELECT)
- Bemaerk: saved_contacts har 9 dublerede policies, men alle udtrykker SAMME regel —
  rod, ikke hul. Kun bubble_messages har DIVERGERENDE dubletter.

---

## TD-004: send-push v4 — frontend-typer mangler relations-tjek

**Priority:** P2
**Status:** IDENTIFIED
**Fundet:** 17. juli 2026, ved commit af den rigtige v4-kilde.

### Symptom
v4 verificerer at frontend-kaldere har gyldigt JWT og begraenser dem til faste
servergenererede typer (join_request/approved/checkin) — men tjekker IKKE om
kalderen har en legitim relation til modtageren.

### Impact
En autentificeret bruger kan kalde send-push direkte med vilkaarligt user_id og
udloese generiske notifikationer, gentagne gange. Spam-vektor, ikke datalaekage.
Teksten er servergenereret, saa der kan ikke injiceres indhold.

### Fix sketch
Foer frontend-typer honoreres: verificér relation (fx join_request kraever at
kalderen har en pending request paa den boble; approved kraever at kalderen er
owner/admin). Alternativt rate-limit pr. (caller, recipient).

### Related
- index.ts (v4-kilde, committet 17. juli 2026)
- ADR-006 / push_events observability


---

## TD-005: Foraeldreloese bobler — ingen oprydning, ingen vej tilbage

**Priority:** P2
**Status:** IDENTIFIED
**Fundet:** 17. juli 2026 (Michael: "en boble vil aldrig vaere tom... der vil altid vaere
en ejer?"). Verificeret i kode.

### Symptom
En boble kan ende med NUL medlemmer, men stadig eksistere i `bubbles` med `created_by`
pegende paa en person der ikke er medlem. Den bliver liggende i Discover med
`member_count = 0`, og INGEN kan overtage den.

### Root cause
To veje derhen:

1. **Ejeren som sidste medlem forlader.** `leaveBubble` (b-bubbles.js:546) blokerer
   korrekt ejeren i at forlade saa laenge der er ANDRE medlemmer (`count > 0` ->
   `toast_owner_leave`, "overdrag foerst", jf. ADR-009). Men er ejeren alene, er
   `count = 0` og de faar lov. Boblen mister sit sidste medlem.

2. **Auto-join fejler ved oprettelse.** `createBubble` (b-bubbles.js:961) opretter
   boblen, forsoeger derefter `bubble_members.insert` med ét retry. Fejler begge,
   logges det aerligt (`bb_created_join_retry`) og boblen bliver staaende — uden
   medlemmer. Den fejlhaandtering er i sig selv god (aerlig frem for tavs), men
   efterlader en foraeldreloes boble.

### Impact
- Doed boble i Discover (member_count 0) — kosmetisk stoej, daarligt foerstehaandsindtryk.
- **Kan ikke reddes:** ADR-009's `accept_ownership_transfer` kraever at modtageren ER
  medlem (verificeret i produktions-funktionskroppen: `IF NOT EXISTS(SELECT 1 FROM
  bubble_members ...) THEN ... recipient_no_longer_member`). Uden medlemmer er der ingen
  at overdrage til.
- Kun den oprindelige ejer kan slette den (`bubbles_delete`: `auth.uid() = created_by`) —
  men de ser den ikke laengere i "Mine bobler", da de ikke er medlem.
- Ikke katastrofalt ved pilot-skala. Men det er en tilstand INGEN har besluttet skal
  eksistere.

### Relation til ADR-009
ADR-009 loeste overdragelse MELLEM to ejere (request-baseret, ingen énvejsdoer) og er
bygget + verificeret live. Den behandlede IKKE hvad der sker naar ejeren FORLADER.
Michaels antagelse ("forlader ejeren, saa lukker den eller overdrages til admin") er
IKKE implementeret — der er kun blokeringen ved count > 0.

### Fix sketch
Beslut foerst produktreglen (ikke kun teknisk):
- (a) **Ejeren kan aldrig forlade** — heller ikke alene. Skal slette boblen i stedet.
      Simplest, matcher "en boble har altid en ejer".
- (b) **Auto-slet ved sidste medlem ud** — boblen doer med sit sidste medlem.
      Bemaerk: sletning er i forvejen en ikke-transaktionel slettekaede (popBubble,
      staar i eksternt review 17. jul som aabent punkt) — ryd op dér foerst.
- (c) **Auto-overdrag til aeldste admin** hvis en saadan findes, ellers (a)/(b).
      Michaels oprindelige antagelse. Mest arbejde, men blidest.
- Uanset valg: en oprydningsrutine for EKSISTERENDE foraeldreloese bobler (tjek foerst
  om der er nogen i prod: `select id, name, created_by from bubbles b where not exists
  (select 1 from bubble_members m where m.bubble_id = b.id)`).

### Related
- ADR-009 (ownership transfer — loeste nabo-problemet, ikke dette)
- FEATURE-IDEAS: anonym sammensaetnings-teaser (teaser-tilstande antager 1+ medlem)
- Eksternt review 17. juli 2026: popBubble ikke-transaktionel slettekaede (aabent)
