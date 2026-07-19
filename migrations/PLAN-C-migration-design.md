# C — Migration design: join-requests ud af bubble_members

> **Model (Michael, 18. jul):** `bubble_members` indeholder PRÆCIS medlemmerne —
> hverken mere eller mindre. En række = et medlem. Pending/afvist/fortrudt/forladt
> = ingen række. Så er enhver tælling korrekt automatisk, uden filtre, for evigt.
>
> **Denne fil = DESIGN. Intet køres før Michael har set planen.**
> Derefter kører vi trinvist (SQL ét statement ad gangen, bekræft, næste) som altid.

---

## Målmodel

**To tabeller, klar adskillelse (spejler bubble_invitations-mønstret):**

- `bubble_members` — KUN aktive medlemmer. `{ bubble_id, user_id, role, joined_at, ... }`.
  Ingen `status='pending'` længere. (Status-kolonnen kan blive for bagudkomp., men
  bruges IKKE til ikke-medlemmer.)
- `bubble_join_requests` (NY) — ansøgninger der afventer. `{ id, bubble_id, user_id, created_at }`.
  Afvisning/fortrydelse = DELETE (ingen historik, jf. Michaels beslutning punkt 1).

**Livscyklus efter C:**
```
Ansøg  → INSERT i bubble_join_requests
Godkend → (transaktionelt) DELETE fra join_requests + INSERT i bubble_members
Afvis  → DELETE fra join_requests
Fortryd → DELETE fra join_requests (bruger sletter sin egen)
Forlad (senere, B) → DELETE fra bubble_members
```

---

## Rækkefølge — designet så intet går i stykker undervejs

Rækkefølgen er vigtig: databasen og koden skal aldrig være i en tilstand hvor pending
"forsvinder" for brugere. Derfor bygges det additivt FØR noget skiftes.

### Fase 1 — Databasen (additiv, bryder intet)
1. **Inspicér bubble_invitations** (skabelon) — se kolonner + RLS.
2. **Opret `bubble_join_requests`** med RLS (bruger opretter/ser/sletter egen; ejer+admin ser/sletter for sin boble).
3. **Opret transaktionel godkendelses-RPC** `approve_join_request(bubble_id, user_id)`
   SECURITY DEFINER: verificér kalder er ejer/admin → DELETE request + INSERT member atomisk.
4. **Migrér eksisterende pending** — flyt `bubble_members` hvor `status='pending'` til
   `bubble_join_requests`, slet så pending-rækkerne fra bubble_members.
   (Mindst 1: Bubble Tester i House of Software.)

Efter fase 1: databasen har begge tabeller, pending er flyttet, MEN koden læser stadig
fra bubble_members. Så vi må skifte koden FØR pending-rækkerne slettes — ellers forsvinder
"AFVENTER GODKENDELSE" for ejeren. **Derfor: migrér data SIDST i fase 1, samtidig med at
koden skiftes (fase 2), eller i tæt rækkefølge.**

**REVIDERET rækkefølge for at undgå tomrum:**
- 1a. Opret tabel + RLS + RPC (ingen data endnu)
- 1b. Deploy kode der SKRIVER til ny tabel men LÆSER begge (overgang)
- 1c. Migrér pending-data til ny tabel
- 1d. Deploy kode der kun bruger ny tabel
- 1e. Slet pending-rækker fra bubble_members
Dette er sikrest men flest trin. ALTERNATIV (enklere, kort nedetid acceptabel i pilot):
alt-på-én-gang i lav-trafik-vindue siden alle brugere er kendte. **Beslut med Michael.**

## Bekræftede beslutninger (Michael, 18. jul)
1. **Rækkefølge:** Vej 2 — alt-på-én-gang i lavtrafik (kendte pilot-brugere, kort nedetid OK).
2. **"Fortryd ansøgning" FINDES ALLEREDE:** `bcCancelPending()` (b-chat.js:~1832) med
   "Annuller"-knap i pending-banneret. Skal blot FLYTTES til ny tabel, ikke bygges.
3. **Unik-constraint** `(bubble_id, user_id)` på join_requests: JA.
4. **`bubble_members.status`-kolonne:** BEHOLD ubrugt til senere B. Drop ikke.

### Fase 2 — Koden (8 steder — bcCancelPending fundet som #8)
1. `dbActions.requestJoin` (b-utils.js:1702) → insert i `bubble_join_requests`
2. `bcApproveMember` (b-chat.js:2087) → kald `approve_join_request`-RPC
3. `bcRejectMember` (b-chat.js:2109) → delete fra `bubble_join_requests`
4. `bcLoadMembers` pending-visning (b-chat.js:1936) → læs fra `bubble_join_requests`
5. `isPending`-tjek (b-chat.js:679, 852, 1116) → slå op i `bubble_join_requests`
6. Medlemsliste-filtre (b-bubbles.js:461, 564) → FJERN filter (pending er der ikke mere)
7. **`bcCancelPending` (b-chat.js:~1832)** → delete fra `bubble_join_requests` (fortryd)
8. Verificér `leaveBubble` rører KUN rigtige medlemmer nu (pending kan ikke ramme den mere)

### Fase 3 — Oprydning
- Tællinger: `bubble_members(count)`-joins bliver nu automatisk korrekte. Status-filtre
  (`.or('status.is.null,status.neq.pending')`) kan forenkles til ren count — men de er
  harmløse at lade stå. Ryd op når bekvemt.
- Overvej om `bubble_members.status` skal droppes helt (separat beslutning; behold til B?).

---

## Åbne beslutninger før vi kører
1. **Rækkefølge:** sikker fler-trins overgang (1a-1e) vs alt-på-én-gang i lavtrafik?
   (Pilot = kendte brugere, kort nedetid nok acceptabel.)
2. **RPC-navn/signatur:** `approve_join_request(p_bubble_id, p_user_id)` — OK?
3. **"Fortryd ansøgning":** bygges nu (bruger sletter egen request) eller senere?
4. **join_requests unik-constraint:** `(bubble_id, user_id)` unik, så man ikke kan ansøge to gange?

---

## Sikkerhed (RLS — spejler bubble_invitations)
- INSERT: `auth.uid() = user_id` (man ansøger kun for sig selv)
- SELECT: `auth.uid() = user_id` ELLER kalder er ejer/admin af boblen
- DELETE: `auth.uid() = user_id` (fortryd) ELLER kalder er ejer/admin (afvis)
- Godkendelse går KUN via SECURITY DEFINER RPC (ikke direkte INSERT i members),
  så member-oprettelse er kontrolleret.
