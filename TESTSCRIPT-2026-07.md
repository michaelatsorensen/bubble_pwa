# TESTSCRIPT — Monkey-test på enhed (pre-pilot, juli 2026)

> **Formål:** Systematisk enhedstest af ALT arbejdet fra v3.150–v3.178: medlemstal-sandhed
> (C+B), anmodningskæden, breadcrumbs, push, 3-lags-synlighed, teaser-gate, identitets-
> privatliv, keyboard-baseline — plus kaos-scenarier.
>
> **Makker-dokument:** VERIFICATION-GUIDE.md (backend/SQL). Dette script er TELEFONEN.
> **Resultater:** Udfyld log-tabellen i afsnit K. FAIL'er sendes til Claude med skærmbillede.

---

## 0. FORBEREDELSE

### Roller
| Kode | Hvem | Noter |
|---|---|---|
| **SA** | Michael Sørensen (super admin) | Ejer af House of Software. Push AKTIVERET. iPhone 15 PWA. |
| **T1** | Bubble Tester | Fast testkonto. Kan markeres `is_anon` i DB hvis den skal af radaren. |
| **T2** | Michael Weiss | Fast testkonto (pt. medlem af HoS). |
| **INC-1, INC-2, …** | Friske incognito-signups | Ubegrænset (email-bekræftelse er slået fra, Q-067). Opret efter behov. Navngiv dem "Monkey 1", "Monkey 2"… så de er lette at genkende og rydde op. |

### Enheder
- **Primær:** iPhone 15, installeret PWA (SA logget ind)
- **Sekundær:** desktop Chrome — almindeligt vindue til T1/T2, **incognito-vinduer til INC-brugere** (ét incognito-vindue pr. INC-bruger)
- Multi-device-tests kræver SA på iPhone + samme flow observeret fra Chrome

### FØR DU STARTER — tving SW-opdatering (vigtigt!)
1. Luk PWA'en helt (swipe væk i app-switcher)
2. Åbn igen → Super admin → System → **Version skal være v3-v3.178, SW = synced**
3. Hvis ældre version: luk/åbn igen (iOS henter SW i to trin)
- ⛔ Test ALDRIG push/routing på en gammel SW — det var fælden 20. jul.

### Fastlæg udgangstilstand (SQL, Supabase)
```sql
-- Hvem er medlem af HoS lige nu? (forventet: SA implicit ejer + de aktive)
select p.name, m.role, m.joined_at
from bubble_members m join profiles p on p.id = m.user_id
where m.bubble_id = 'adde6208-2f9b-4519-b96d-ef6bdf084bbe'
order by m.joined_at;

-- Åbne anmodninger? (forventet: 0 ved start)
select p.name, r.created_at
from bubble_join_requests r join profiles p on p.id = r.user_id
where r.bubble_id = 'adde6208-2f9b-4519-b96d-ef6bdf084bbe';

-- Grafens events-log (baseline + joins/leaves)
select event_type, delta, created_at from bubble_membership_events
where bubble_id = 'adde6208-2f9b-4519-b96d-ef6bdf084bbe' order by created_at;
```
Notér medlemstallet: **N₀ = ____**. Alle tal-tests refererer til det.

### Nulstillings-værktøjskasse (mellem gennemløb)
```sql
-- Fjern en INC-brugers anmodning (så flowet kan køres igen):
delete from bubble_join_requests
where bubble_id = 'adde6208-2f9b-4519-b96d-ef6bdf084bbe'
  and user_id = '<INC-uuid>';

-- Fjern et testmedlem igen (OBS: udløser korrekt et 'left'-event i grafen — det er
-- FINT, det er selve pointen med B; grafen SKAL dykke):
delete from bubble_members
where bubble_id = 'adde6208-2f9b-4519-b96d-ef6bdf084bbe'
  and user_id = '<INC-uuid>';

-- Markér en støjende testkonto usynlig på radar (dev-værktøj, ingen UI-vej):
update profiles set is_anon = true where id = '<uuid>';

-- Find en INC-brugers uuid ud fra navn:
select id, name, created_at from profiles where name ilike 'Monkey%' order by created_at desc;
```
Fuld bruger-nulstilling: `cleanup-test-user` edge function (via terminal på din PC).

---

## A. SUNDHEDSTJEK (5 min — kør FØRST)

| ID | Trin | Forventet |
|---|---|---|
| A1 | Super admin → System | Version **v3-v3.178**, SW **synced**, Push **active** |
| A2 | Vent 60 sek på home, genåbn System | **RT kanaler > 0** (typisk 8–9/9. 0/9 lige efter opstart er OK — det var lærestregen) |
| A3 | Fejl-log | **INGEN nye** "cannot add postgres_changes callbacks" efter i dag (v3.175-fixet). Gamle fra 19. jul må gerne stå. |
| A4 | Super admin → System → kør in-app smoketest | Alle grønne |
| A5 | Super admin → Stats | Profil-visnings-tallet (7 dage) viser et TAL, ikke 0/fejl (get_global_view_count-RPC) |

---

## B. MEDLEMSTAL & GRAF — sandheden (C+B)

| ID | Trin | Forventet |
|---|---|---|
| B1 | SA åbner HoS. Sammenlign: header-tal, Medlemmer-fanens store tal, Info→Statistik-kortets tal | **ALLE TRE = N₀.** Ingen afvigelse, nogensinde. |
| B2 | Statistik-kortet | "+X denne md." er BOBLENS egne nye (ikke netværkets). Grå linje "Y i hele netværket" vises KUN hvis der findes sub-bobler og tallet afviger. |
| B3 | Info → Medlemsvækst-grafen | En LINJE tegnes (ikke ét ensomt punkt). Dag-akse (19/7, 20/7 …). Sidste punkt = N₀. |
| B4 | **Grafen bevæger sig OP:** Godkend en INC-anmodning (opsættes i C-flowet), genåbn Info | Nyt punkt, N₀+1. Statistik + header følger med. |
| B5 | **Grafen bevæger sig NED:** Fjern samme INC-medlem (X på Medlemmer-fanen), genåbn Info | Grafen dykker til N₀ igen. `bubble_membership_events` har +1 og -1-rækker (tjek SQL). |
| B6 | Pending tæller ALDRIG: mens en anmodning er åben (C-flowet), tjek alle tre tal | Stadig N₀ — en ansøger er IKKE et medlem, ingen steder. |

---

## C. ANMODNINGSFLOW ende-til-ende (HOVEDSCENARIET)

**Opsætning:** Chrome incognito → opret **INC-1 "Monkey 1"** (create-first eller Discover). SA's PWA lukket (i baggrunden) til at starte med — vi tester push fra kold tilstand.

| ID | Rolle | Trin | Forventet |
|---|---|---|---|
| C1 | INC-1 | Find HoS (privat) i Discover → åbn | Info-fanen. **Medlemmer-fanen er VÆK** (privat + ikke-medlem). Kun antal, ingen ansigter/ejer. |
| C2 | INC-1 | Tryk "Anmod om medlemskab" | Centreret bekræftelses-modal (design-tokens, tydelig mod baggrund). Annullér/Send i lige knapper. |
| C3 | INC-1 | Send anmodning | "⏳ Afventer godkendelse"-banner + Annuller-knap. Ingen medlemsliste synlig (stadig pending = ikke inde). |
| C4 | SA | **Push ankommer på iPhone** (app i baggrund) | Push: "Monkey 1 vil gerne være medlem…". `push_events`: nyeste række = `join_request / frontend / sent / sent_count>0`. |
| C5 | SA | **Tap på pushen** | Lander DIREKTE på HoS → **Medlemmer-fanen** med "AFVENTER GODKENDELSE · 1" øverst. IKKE forsiden. (Fejler den her: tjek A1 — gammel SW er den klassiske synder.) |
| C6 | SA | Gå til forsiden i stedet (uden at godkende) | **Breadcrumbs:** klokke-prik ✓ → Bobler: HoS-kortet har orange prik på ikonet ✓ → inde i boblen: Medlemmer-fanen har prik ✓. Hele sporet lyser. |
| C7 | SA | Åbn klokke-notifikationer | Kortet "Monkey 1 anmoder om adgang" med Godkend/Afvis. **Tap på selve kortet** (ikke knapperne) → åbner boblen på Medlemmer-fanen. |
| C8 | SA | Tilbage til notifikationer → tryk **Godkend** direkte i notifikationen | Kortet viser "Godkendt ✓". Ingen navigation udløses af knappen (stopPropagation). |
| C9 | INC-1 | **BLIV på boble-skærmen, RØR INTET, se på uret** | Inden **≤5 sek**: "Afventer"-banner forsvinder, skærmen bliver medlems-visning. INGEN refresh. (Pending-poll, v3.173 — kernen i live-garantien.) |
| C10 | INC-1 | Tjek push (hvis INC-1 har accepteret notifikationer i Chrome) | "Godkendt"-push; klik → lander i boblen. (Kan udelades hvis Chrome-push ikke er sat op.) |
| C11 | SA | Tjek alle prikker igen | ALLE prikker væk (klokke, boble-kort, medlemsfane) — intet ubehandlet. |
| C12 | SA | Ryd op: fjern Monkey 1 fra boblen (B5 gør det alligevel) | Tal + graf korrekte bagefter. |

### C-varianter (kør efter hovedscenariet)
| ID | Trin | Forventet |
|---|---|---|
| C13 | INC-2 anmoder → INC-2 **annullerer** selv (mens SA har boblen ÅBEN på Medlemmer-fanen) | Anmodningen forsvinder fra SA's pending-liste **live** (join_change-broadcast) ELLER senest ved SA's næste navigation ind (DB-pull). Aldrig en død anmodning. |
| C14 | INC-2 anmoder igen → SA trykker **Afvis** | Kortet forsvinder. INC-2's skærm viser "Anmod om medlemskab" igen (senest efter forgrund/genåbning). Ingen medlemsrække opstod (SQL: 0 rækker). |
| C15 | Anmod → annullér → anmod igen (hurtigt, samme bruger) | Ingen fejl, ingen dubletter (unique-constraint). Én pending hos SA. |
| C16 | INC-3 anmoder mens SA's app er HELT lukket → SA åbner appen normalt (uden push-tap) | Klokke-prik + notifikation venter. Intet gik tabt uden realtime. |

---

## D. PUSH-MATRIX (alle typer + routing)

| ID | Fra → Til | Handling | Forventet push + tap-destination |
|---|---|---|---|
| D1 | T1 → SA | T1 sender DM (SA's app i baggrund) | Push med beskedtekst → tap åbner **den DM-tråd** |
| D2 | INC → SA | Anmodning (= C4/C5) | → **Medlemmer-fanen** |
| D3 | SA → INC/T | Godkendelse | → **boblen** |
| D4 | Efter hver | `select event_type, source, status, sent_count from push_events order by created_at desc limit 5;` | Alle nye = `sent`, sent_count ≥ 1. **INGEN** `invalid / type required` (det var v3.161-fejlen). |

---

## E. 3-LAGS SYNLIGHED + TEASER-GATE (kritisk nyt, v3.176/178)

**Opsætning:** SA opretter 3 midlertidige test-bobler: "Monkey Åben" (åben), "Monkey Privat" (privat), "Monkey Skjult" (hidden). Slet dem efter E-blokken.

| ID | Rolle | Trin | Forventet |
|---|---|---|---|
| E1 | T1 (ikke-medlem) | Åbn "Monkey Åben" | Medlemmer-fanen SYNLIG, fuld medlemsliste inkl. ejer. Join-knap. Alt åbent. |
| E2 | T1 | Åbn "Monkey Privat" | **Medlemmer-fanen VÆK.** Kun Info + antal. Ejer IKKE synlig nogen steder. "Anmod"-knap. |
| E3 | T1 | Discover | "Monkey Privat" VISES i Discover (privat = synlig, medlemmer skjult). "Monkey Skjult" vises IKKE. |
| E4 | T1 (pending på Privat) | Anmod → mens pending, led efter medlemmer | Stadig ingen medlemsliste. Pending ≠ inde. |
| E5 | **HELT frisk incognito, IKKE logget ind** | Åbn QR/dele-link til "Monkey Privat" (pre-auth teaser-landing) | Teaser viser **kun antal** — INGEN ansigter, INGEN vært. (Teaser-gaten — det store audit-fund. Fejler denne: STOP og rapportér.) |
| E6 | Samme frisk incognito | Åbn QR-link til et **event** (opret evt. "Monkey Event") | FULD teaser: ansigter + vært. (QR = invitationen for events — hiddenNonEvent-logikken.) |
| E7 | SA (ejer) | Åbn egen "Monkey Privat" | Fuld adgang: Medlemmer-fane, liste. **ALDRIG "Anmod om medlemskab"** på egen boble (v3.170-regressionen). |

---

## F. IDENTITETS-PRIVATLIV — tal, aldrig navne

| ID | Trin | Forventet |
|---|---|---|
| F1 | Notér SA's "har set din profil"-tal. T1 åbner SA's fulde profil. SA genindlæser profil | Tallet **+1**. INTET navn nogen steder. (get_my_view_count) |
| F2 | Notér SA's "har gemt dig"-tal (Min profil). T1 gemmer SA som kontakt. SA genindlæser | Tallet **+1** — **dette var 0 for evigt før i dag** (get_my_saved_by_count). Vises der stadig 0 efter T1 gemmer: rapportér. |
| F3 | SA åbner event-rapporten på en boble med aktivitet | "Profilvisninger"-statkortet viser et tal (get_bubble_view_count). "Mest aktive" = **Deltager #1/#2** (anonyme numre). |
| F4 | Gem-kontakt-notifikation hos SA (hvis en vises) | IKKE klikbar (beskytter identitet — bevidst). |

---

## G. KEYBOARD-BASELINE (v3.172 — accepteret begrænsning)

| ID | Trin | Forventet | IKKE forventet |
|---|---|---|---|
| G1 | Åbn en DM, tryk i feltet | Keyboard op, **indhold/composer skubbes op** (intet overlap) | Keyboard OVER indholdet (det var v3.171-regressionen) |
| G2 | Skriv + send 3 beskeder i træk | Glat. **INTET twitch** (luk-og-åbn-blink) | Twitch |
| G3 | Efter send | Keyboardet **må** falde ned — det er den accepterede iOS-PWA-begrænsning. Notér blot om det sker. | — |
| G4 | Samme i boble-chat | Samme baseline | — |

---

## H. MONKEY / KAOS (fri leg — men notér ALT mærkeligt)

| ID | Scenarie | Kig efter |
|---|---|---|
| H1 | **To enheder, samme SA** (iPhone + Chrome): godkend en anmodning på Chrome mens iPhone står på Medlemmer-fanen | iPhone opdaterer (live eller ved forgrund/navigation). Ingen spøgelses-pending. |
| H2 | INC pending på boble-skærm → send appen i baggrund 30 sek → SA godkender imens → INC forgrund | INC er medlem ved forgrund UDEN refresh (visibilitychange-refresh). |
| H3 | Hammer-tryk: Godkend-knappen 5× hurtigt | Én godkendelse, ingen fejl-toasts, tal +1 (RPC er idempotent). |
| H4 | Skift lynhurtigt mellem 2 bobler frem/tilbage 10× | Ingen frys, ingen "cannot add postgres_changes" i fejl-loggen (v3.175-guarden). |
| H5 | Anmod fra 3 INC-brugere samtidig | SA ser "· 3", alle 3 kan behandles enkeltvis, tal ender korrekt. |
| H6 | Flystilstand PÅ → prøv at anmode → flystilstand AF | Pæn fejl/ingen handling offline; virker efter. Ingen halv-tilstand. |
| H7 | Log ud/ind som SA midt i det hele | Prikker og tal korrekte efter login (resetAppState + frisk load). |
| H8 | Åbn appen via gammelt push (fra i går) | Ingen crash — lander et fornuftigt sted. |

---

## K. RESULTATLOG

| ID | ✅/❌ | Note (kort — skærmbillede ved ❌) |
|---|---|---|
| A1–A5 | | |
| B1–B6 | | |
| C1–C16 | | |
| D1–D4 | | |
| E1–E7 | | |
| F1–F4 | | |
| G1–G4 | | |
| H1–H8 | | |

**Stop-kriterier (rapportér STRAKS, test ikke videre på området):**
- E5 fejler (teaser viser ansigter/vært for privat boble) → privatlivshul
- B1 fejler (tallene afviger) → datamodel-problem
- C9 fejler (ansøger sidder fast som pending) → live-garantien brudt

**Efter endt runde:** ryd op (INC-medlemmer ud, Monkey-bobler slettet, evt. `is_anon` på støjende
testkonti), og send K-tabellen + eventuelle skærmbilleder til Claude.
