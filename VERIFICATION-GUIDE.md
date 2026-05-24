# Verifikations-guide — Bubble Pre-Pilot Ground Truth

> **Formål:** Step-by-step guide til at verificere åbne spørgsmål mod faktisk kodebase og Supabase production.
>
> **Forventet tid:** 1-2 timer i én session, eller delt op i mindre sessioner.
>
> **Hvad du skal bruge:**
> - Supabase dashboard adgang (`https://supabase.com/dashboard`)
> - VSCode/editor med Bubble PWA kodebase åbent
> - Adgang til `C:\Users\freef\bubble-edge\supabase\functions\send-push\index.ts`
> - Dette dokument åbent som checklist
>
> **Hvordan du svarer:** Skriv dine fund direkte i dette dokument under hver "📝 Dine fund:"-sektion. Når du er færdig, send det tilbage til Claude i en ny besked.

---

## 🎯 Prioriterings-oversigt

Verificér i denne rækkefølge — hver section bygger på den forrige.

| Fase | Tid | Spørgsmål | Hvorfor først |
|---|---|---|---|
| **1. Push triggers** | 15 min | Q-050, Q-055 | Foundation — alt push afhænger af disse |
| **2. Push payload** | 15 min | Q-051, Q-052 | Forklarer silent failures |
| **3. Push observability** | 10 min | Q-053, Q-054 | Beslutter strategi (ADR-006) |
| **4. Data integrity** | 30 min | Q-014, Q-019, Q-023 | GDPR + cascade rules |

**Total estimeret tid:** ~70 min.

Du kan stoppe efter hver fase — fund er værdifulde selvom du ikke når alle.

---

## FASE 1: Push Triggers (Q-050 + Q-055)

### Q-050: Hvilke push triggers er aktive i production?

**Hvorfor det betyder noget:** Memory dokumenterer 4 trigger-navne. Hvis nogle er deaktiveret eller fjernet, ændrer det scope for vores arkitektur-beslutninger.

#### 🔍 Step-by-step:

**1. Åbn Supabase SQL Editor:**
- Gå til `https://supabase.com/dashboard`
- Vælg dit Bubble projekt
- Klik "SQL Editor" i venstre menu
- Klik "New query"

**2. Paste denne query og klik RUN:**

```sql
SELECT
  tgname AS trigger_name,
  tgrelid::regclass AS table_name,
  tgenabled AS enabled_status,
  pg_get_triggerdef(oid) AS definition_short
FROM pg_trigger
WHERE tgname LIKE '%push%'
   OR tgname LIKE '%notify%'
   OR tgname LIKE '%notification%'
ORDER BY tgname;
```

**3. Hvad du leder efter:**
- Trigger navne (forventet: 4 navne med "push" i)
- Hvilken tabel de er på (`tgrelid::regclass`)
- `tgenabled` skal være `'O'` (origin/enabled) for aktive triggers

**4. Forventede 4 triggers fra memory:**
- `on_new_message_push` (på `messages` table)
- `on_bubble_invite_push` (på `bubble_invites` eller lignende)
- `on_new_invite_push` (på invites table)
- `on_contact_saved_push` (på `saved_contacts` table)

#### 📝 Dine fund:

```
[Paste SQL output her]
```

**Min note:**
- Findes alle 4 forventede triggers? Ja / Nej / Andre fundet?
- Er der overraskelser?

---

### Q-055: Hvilke secrets er hardcoded i trigger-funktioner?

**Hvorfor det betyder noget:** Vault migration kræver at vi ved hvilke secrets der findes hvor.

#### 🔍 Step-by-step:

**1. I samme SQL Editor, kør:**

```sql
SELECT
  proname AS function_name,
  prosrc AS function_body
FROM pg_proc
WHERE proname IN (
  -- Erstat disse med faktiske navne fra Q-050 hvis de er anderledes:
  'send_message_push',
  'send_invite_push',
  'send_new_invite_push',
  'send_contact_push',
  -- Eller bredere søgning:
  'notify_push',
  'http_post_push'
)
   OR prosrc ILIKE '%pg_net.http_post%'
   OR prosrc ILIKE '%Authorization%';
```

**2. Hvad du leder efter:**

I `prosrc` (function body) — kig efter strenge der ligner:

```
'Bearer eyJhbGc...'           ← Hardcoded auth header
'Bearer ' || 'sk_...'          ← Concatenated secret
'apikey' eller 'service_role'  ← Hint om service role key brug
'http://...' eller 'https://...' ← Hardcoded edge function URLs
```

#### 📝 Dine fund:

```
Liste af secrets identificeret:

Function 1: [navn]
  - Hardcoded: [hvad?]

Function 2: [navn]
  - Hardcoded: [hvad?]

[osv.]
```

---

## FASE 2: Push Payload Schema (Q-051 + Q-052)

### Q-051: Hvilket payload-schema forventer `send-push/index.ts`?

**Hvorfor det betyder noget:** Memory siger "body format mismatch" forårsager silent failures. Vi har brug for at vide hvad edge function faktisk forventer.

#### 🔍 Step-by-step:

**1. Åbn filen i din editor:**

```
C:\Users\freef\bubble-edge\supabase\functions\send-push\index.ts
```

**2. Find request body parsing.** Det ligner typisk:

```typescript
const { user_id, title, body, data } = await req.json();
```

**eller:**

```typescript
const payload = await req.json();
const userId = payload.user_id || payload.recipient_id;
```

**3. Dokumentér:**
- Præcis hvilke felter destructeres fra request body?
- Bruger den `user_id` eller `recipient_id` (eller begge)?
- Hvilke felter er optional vs required?
- Er der validation?

#### 📝 Dine fund:

```typescript
// Paste den relevante kode-section fra index.ts her:

```

**Min note:**
- Forventede felter: ____________
- Optional felter: ____________
- Validation? Ja / Nej

---

### Q-052: Er `recipient_id` vs `user_id` intentional?

**Hvorfor det betyder noget:** Memory antyder 2 triggers sender `recipient_id` mens edge function forventer `user_id` → silent failure. Men det kan også være intentional naming.

#### 🔍 Step-by-step:

**1. Gå tilbage til Supabase SQL Editor. Kør:**

```sql
SELECT
  proname,
  -- Hent kun de første 500 chars af function body for læsbarhed
  substring(prosrc from 1 for 500) AS body_preview
FROM pg_proc
WHERE proname LIKE '%push%'
   OR proname LIKE '%notify%';
```

**2. For hver function body, kig efter:**

```sql
-- Sender den 'user_id' eller 'recipient_id'?
-- Eksempel hvad du leder efter:
PERFORM pg_net.http_post(
  url := '...',
  body := jsonb_build_object(
    'user_id', NEW.sender_id,    ← her er det 'user_id'
    -- ELLER:
    'recipient_id', NEW.receiver_id,  ← her er det 'recipient_id'
    'title', '...',
    'body', '...'
  )
);
```

#### 📝 Dine fund:

```
Trigger function 1: [navn]
  - Sender: user_id eller recipient_id?
  - Værdi mapped fra: NEW.[felt]

Trigger function 2: [navn]
  - Sender: user_id eller recipient_id?
  - Værdi mapped fra: NEW.[felt]

[osv. for alle 4]
```

**Konklusion (du vurderer):**
- Er forskellen intentional eller drift? ____________
- Forventer edge function `user_id`, men nogle triggers sender `recipient_id`? Ja / Nej

---

## FASE 3: Push Observability (Q-053 + Q-054)

### Q-053: Er `b-utils.js sendPush()` stadig reachable?

**Hvorfor det betyder noget:** Hvis dead code, kan vi fjerne det. Hvis still reachable, parallel dispatch path eksisterer.

#### 🔍 Step-by-step:

**1. I VSCode/editor, brug global search (Ctrl+Shift+F):**

```
Search: sendPush
Files to include: *.js, *.html
Files to exclude: next/, /node_modules/
```

**2. Kig på hver match og note:**
- Er det et function definition? (b-utils.js)
- Er det et call site? (hvor i koden?)
- Er function definition i b-utils.js, eller bruges noget andet (e.g., direct fetch)?

#### 📝 Dine fund:

```
Function definition:
- [filsti og linje]

Call sites:
- [filsti:linje] — context: [hvad gør koden her]
- [filsti:linje] — context: [...]
- [osv.]

Min konklusion:
- sendPush er aktiv kode: Ja / Nej
- Antal call sites: ___
```

---

### Q-054: Findes der push delivery logging?

**Hvorfor det betyder noget:** Determinerer om Option A (DB trigger only) er muligt — kræver observability.

#### 🔍 Step-by-step:

**1. Tjek i Supabase SQL Editor:**

```sql
-- Find tabeller med 'log' eller 'push' i navnet
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (table_name ILIKE '%log%' OR table_name ILIKE '%push%' OR table_name ILIKE '%notification%')
ORDER BY table_name;
```

**2. For hver fundet tabel, tjek schema:**

```sql
-- Erstat 'table_name' med faktisk navn fra ovenstående:
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'table_name'
ORDER BY ordinal_position;
```

**3. Tjek edge function logs:**

I Supabase dashboard:
- Gå til Edge Functions → send-push
- Klik "Logs" tab
- Se om der er recent invocations
- Note om der er fejl-log entries

#### 📝 Dine fund:

```
Push-relaterede tabeller fundet:
- [navn]: [formål baseret på columns]
- [navn]: [...]

Edge function logs:
- Recent activity (sidste 24h)? Ja / Nej
- Error rate hvis synlig? ___%

Min konklusion:
- Persistent push logging eksisterer: Ja / Nej
- Kan vi spore "did this push deliver"? Ja / Nej
```

---

## FASE 4: Data Integrity (Q-014 + Q-019 + Q-023)

### Q-014: GDPR profile deletion

**Hvorfor det betyder noget:** GDPR compliance. Bruger har ret til at få slettet sin data.

#### 🔍 Step-by-step:

**1. Kør i SQL Editor:**

```sql
-- Find foreign key constraints på profiles table
SELECT
  tc.constraint_name,
  tc.table_name AS child_table,
  kcu.column_name AS child_column,
  ccu.table_name AS parent_table,
  ccu.column_name AS parent_column,
  rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = 'profiles';
```

**2. Hvad du leder efter:**
- Hvilke tabeller har FK til profiles?
- Hvad er `delete_rule`?
  - `CASCADE` = automatisk delete
  - `SET NULL` = sætter til NULL
  - `RESTRICT` = forhindrer delete
  - `NO ACTION` = same as RESTRICT

#### 📝 Dine fund:

```
Foreign keys på profiles:

Tabel 1: [navn]
  - Column: [navn]
  - Delete rule: CASCADE / SET NULL / RESTRICT

[osv.]

Min vurdering:
- Kan en bruger få deleted al sin data? Ja / Nej / Delvist
- GDPR-compliant? Ja / Nej / Usikker
```

---

### Q-019: User deletion → memberships cascade?

#### 🔍 Step-by-step:

**1. Kør:**

```sql
SELECT constraint_name, delete_rule
FROM information_schema.referential_constraints
WHERE constraint_name LIKE '%bubble_members%user%'
   OR constraint_name LIKE '%user%bubble_members%';
```

**2. Test (kun hvis du har en test-user):**

```sql
-- KØR IKKE I PRODUCTION — kun i test branch hvis du har sådan
-- Vis hvad der ville ske ved DELETE
EXPLAIN DELETE FROM auth.users WHERE id = '<test_user_id>';
```

#### 📝 Dine fund:

```
bubble_members FK til auth.users:
- Delete rule: ___________

Min note:
- Når en user slettes, sker der med deres memberships: __________
```

---

### Q-023: User deletion → DMs cascade?

#### 🔍 Step-by-step:

**1. Kør:**

```sql
SELECT
  constraint_name,
  delete_rule,
  table_name
FROM information_schema.referential_constraints rc
JOIN information_schema.table_constraints tc
  USING (constraint_name)
WHERE rc.constraint_name LIKE '%message%';
```

#### 📝 Dine fund:

```
messages FK delete rules:
- sender_id → auth.users: CASCADE / SET NULL / RESTRICT
- receiver_id → auth.users: CASCADE / SET NULL / RESTRICT

Min vurdering:
- Hvad sker der med DMs når en user slettes? __________
- Kan GDPR opretholdes? Ja / Nej / Kompliceret
```

---

## ✅ Når du er færdig

**Send mig:**

1. Dette dokument med dine fund udfyldt
2. Eventuelle screenshots af SQL output (hvis du finder det nemmest)
3. Spørgsmål du har til mig

**Du kan sende:**
- Hele dokumentet copy/paste i en besked
- Som vedhæftet fil
- Bare prose-beskrivelse af dine fund hvis det er hurtigere

**Jeg gør så:**
1. Opdaterer Q-014, Q-019, Q-023, Q-050, Q-051, Q-052, Q-053, Q-054, Q-055 fra 🟡 Inferred til ✅ Verified
2. Finaliserer ADR-006 baseret på dine fund (vælger Option A / B / C for push)
3. Opdaterer Section 19 (Push Notification Flow) med faktisk current state
4. Identificerer eventuelle nye spørgsmål din verifikation har afsløret
5. Foreslår næste skridt baseret på hvad vi nu ved

---

## 🆘 Hvis du sidder fast

**"SQL query virker ikke / fejler":** Bare send mig fejl-meddelelsen, så hjælper jeg.

**"Kan ikke finde send-push/index.ts":** Tjek `C:\Users\freef\bubble-edge\supabase\functions\send-push\`. Hvis ikke der, så er filen muligvis et andet sted — søg efter "send-push" på din PC.

**"Jeg har svaret på nogle men ikke alle":** Send dem du har. Partial fund er stadig værdifulde.

**"Jeg er ikke sikker på mit svar":** Skriv "ikke sikker" — jeg kan hjælpe med at vurdere baseret på det vi har.

**"Hvad hvis jeg finder noget uventet?":** Send det. Uventede fund er ofte de mest værdifulde.

---

*Genereret 18. maj 2026 til verifikation af Q-050 til Q-055 + Q-014, Q-019, Q-023.*

---

# ✅ VERIFIKATIONS-RESULTATER (maj 2026 — kørt mod production)

## Push-arkitektur (Q-050 til Q-055) — KOMPLET

**Q-050 — Aktive triggers (4):**
| Trigger | Tabel | Kalder | Sender | Status |
|---|---|---|---|---|
| on_new_message_push | messages | trigger_push_on_message | recipient_id ❌ | FEJLER tavst (400) |
| on_contact_saved_push | saved_contacts | notify_contact_saved | user_id ✅ | Virker |
| on_bubble_invite_push | bubble_invitations | notify_bubble_invite | user_id ✅ | Virker |
| on_new_invite_push | bubble_invitations | trigger_push_on_invite | recipient_id + placeholder-secret ❌❌ | Har aldrig virket |

**Q-051 — Edge function (./index.ts i repo):** Forventer { type, user_id, title, body, data }. KRÆVER user_id (400 ellers). Slår op i push_subscriptions på user_id. Secrets via Deno.env (ikke hardcodet i funktionen).

**Q-052 — recipient_id vs user_id:** Bekræftet drift, IKKE intentional. trigger_push_on_message + trigger_push_on_invite sender recipient_id → edge afviser. notify_* sender user_id → virker.

**Q-053 — sendPush IKKE dead code:** 9 aktive kaldesteder i NEXT (beskeder 3×, invitation, join-anmodning, godkendt 2×, check-in). Sender user_id korrekt. Fejl kun til console (tavse for bruger). Saved-contact udkommenteret.

**Q-055 — Hardcodede secrets (KRITISK):**
- notify_* (3 funktioner): sb_secret_QJ... hardcoded
- trigger_push_on_message: FULD service-role JWT i klartekst → SKAL ROTERES (kompromitteret)
- trigger_push_on_invite: placeholder Bearer DIN_SERVICE_ROLE_KEY (har aldrig virket)
- notify_new_message: korrekt (user_id) MEN ikke koblet til nogen trigger = død kode

**Q-054 — Observability:** INGEN dedikeret push-delivery-logging. Tabeller: push_subscriptions (endpoints), error_log (generel). Forklarer hvorfor trigger_push_on_message har fejlet tavst uopdaget. error_log kan genbruges til push-fejl.

### Faktisk produktions-adfærd NU:
- **Beskeder:** trigger fejler (recipient_id) → kun frontend sendPush leverer = 1 push
- **Invitationer:** notify_bubble_invite (virker) + frontend sendPush (virker) = MULIG DOBBELT push; trigger_push_on_invite fejler tavst
- **Saved contact:** notify_contact_saved trigger ER aktiv og virker — MEN memory siger feature skulle være disabled. Bekræft mod intention.

## GDPR cascade (Q-014, Q-019, Q-023) — KOMPLET

**Q-019 + Q-023 (rene):** bubble_members (user_id + bubble_id) CASCADE. messages (sender + receiver) CASCADE. Blokerer ikke sletning. ✅

**Q-014 (blandet — fem blokeringer):**
- CASCADE (rent): bubble_members, messages, profile_views, saved_contacts
- SET NULL (anonymiseres): qr_scans (scanned_by, scanned_user)
- **NO ACTION (BLOKERER sletning):** bubble_messages, bubble_message_reactions, bubble_posts, bubbles.created_by, guest_checkins.claimed_by

**Konsekvens:** En bruger der har skrevet en boble-besked / lavet reaktion / opslag / oprettet en boble / claimet guest-checkin kan IKKE slettes — DB afviser med FK-fejl. Rammer stort set alle aktive brugere. "Slet konto" vil fejle. Kræver bevidst sletteprocedure per indholdstype (anonymisér vs slet vs overdrag ejerskab for bobler).
