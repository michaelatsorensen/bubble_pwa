# C — Flyt pending join-requests ud af bubble_members

> **Beslutning (Michael, 18. jul):** Medlemmer og antal medlemmer skal ALTID afspejle
> virkeligheden. Pending er ikke medlem og skal ikke tælles med. Vi går med den korrekte,
> grundige løsning: pending join-requests skal IKKE ligge i `bubble_members`.
>
> **Princip:** Efter C indeholder `bubble_members` KUN rigtige medlemmer. Så bliver ENHVER
> tælling korrekt automatisk — uden status-filtre, uden at huske det i hver ny forespørgsel.
> "Medlem" får én entydig betydning.

---

## Hvorfor C (ikke lappe hvert sted)

Diagnosen (18. jul) viste at pending tælles inkonsistent: nogle tællinger filtrerer
`status <> 'pending'`, andre (10+ `bubble_members(count)`-joins) gør ikke. At lappe hvert
sted er evigt vedligehold + ny fejlkilde ved næste forespørgsel. C løser det ved roden.

**Præcedens findes allerede:** `bubble_invitations` er en SEPARAT tabel for invitationer.
Join-requests kan følge samme mønster — en anmodning er konceptuelt ikke et medlemskab.

---

## FULD KORTLÆGNING — alt der rører pending i dag

### Pending er en rigtig bubble_members-række
`status = 'pending'`. Adskilt fra aktive kun via statusfeltet. Aktive har eksplicit
`status = 'active'` (verificeret i prod, ikke NULL — men gamle rækker kan være NULL).

### 1. OPRETTELSE (join-request)
- **`requestJoin(bubbleId)`** (b-bubbles.js:1099) → **`dbActions.requestJoin`** (b-utils.js:1702)
  - Gør: `sb.from('bubble_members').insert({ bubble_id, user_id, status: 'pending' })`
  - Notificerer ejer via Broadcast + push (`join_request`)

### 2. GODKENDELSE (pending → active)
- **`bcApproveMember(userId)`** (b-chat.js:2087)
  - Gør: `sb.from('bubble_members').update({ status: 'active' }).eq(bubble_id).eq(user_id)`
  - Push til bruger (`approved`, "nu medlem")
- Note: linje 2090 er den rå update.

### 3. AFVISNING (pending → væk)
- **`bcRejectMember(userId)`** (b-chat.js:2109)
  - Gør: `sb.from('bubble_members').delete().eq(bubble_id).eq(user_id).eq('status','pending')`
  - Hard-delete af pending-rækken.

### 4. VISNING — "AFVENTER GODKENDELSE"
- **`bcLoadMembers`** (b-chat.js:~1936): `pendingMembers = members.filter(m => m.status === 'pending')`
  - Vist separat under `bc_pending_approval`-label (kun for owner/admin), linje 1978-1992
  - Med Godkend- (`bcApproveMember`) og Afvis-knapper (`bcRejectMember`)

### 5. "ER JEG PENDING?"-tjek (bruger ser sin egen status)
- b-chat.js:679, 852, 1116: `isPending = myMembership && myMembership.status === 'pending'`
  - Styrer banner/UI-tilstand for en bruger der venter på godkendelse.

### 6. MEDLEMSLISTE-FILTRE (ekskluderer pending)
- b-bubbles.js:461, 564: `members = allMem.filter(m => m.status !== 'pending')`
  - Disse filtrerer korrekt pending FRA medlemslisten allerede.

### 7. TÆLLINGER
- **Korrekte** (ekskluderer pending): trigger `sync_bubble_member_count`,
  live-tællinger b-chat.js:628/1138/2149 (`.or('status.is.null,status.neq.pending')`),
  RPC'er `count_unique_members`/`count_new_unique_members` (rettet 18. jul).
- **Inkonsistente** (inkluderer pending): 10+ `bubble_members(count)`-joins
  (b-bubbles.js:134, b-chat.js:1225/2190/2209, b-home.js:1534/1551/1568/1612,
  b-live.js:995/1000, b-profile.js:1079/1914). Rammer kun som fallback når
  `member_count`-kolonnen er null, men er stadig inkonsistent.

---

## Hvad C indebærer (endnu ikke designet — dette er kortlægning)

**Ny tabel** (formentlig `bubble_join_requests` — spejler `bubble_invitations`):
`{ id, bubble_id, user_id, created_at, status? }`. Eller genbrug invitations-mønstret.

**Ændringer, sted for sted:**
1. `dbActions.requestJoin` → insert i ny tabel i stedet for bubble_members
2. `bcApproveMember` → flyt: slet fra requests-tabel + insert i bubble_members (aktivt)
   — skal være transaktionelt (RPC), ellers race/delvis-tilstand
3. `bcRejectMember` → slet fra requests-tabel (ikke bubble_members)
4. `bcLoadMembers` pending-visning → læs fra requests-tabel
5. `isPending`-tjek (3 steder) → slå op i requests-tabel
6. Medlemsliste-filtre (b-bubbles.js:461/564) → kan FJERNES (pending er der ikke længere)
7. Alle tællinger → bliver automatisk korrekte, status-filtre kan forenkles

**Datamigrering:**
- Eksisterende `bubble_members`-rækker med `status='pending'` → flyt til ny tabel
- Efter migrering: er der stadig et statusfelt på bubble_members? Aktive har 'active'/NULL.
  Overvej om status overhovedet skal blive på bubble_members efter dette.

**Synergi med bredere medlemskabs-arbejde:**
- TD-005 (forældreløse bobler) + afgangs-historik (fix 3/B) rører samme leave/delete-kode.
- Alt sammen = medlemskabets livscyklus. Bør designes sammen, ikke stykkevis.

**RLS-overvejelser:**
- Ny tabel skal have RLS: bruger kan oprette sin egen request, ejer/admin kan læse+godkende/afvise
- `bubble_invitations` RLS er en skabelon at følge.

---

## Åbne spørgsmål før design
- Skal requests-tabellen have en `status` (pending/rejected-historik), eller hard-delete ved afvisning?
- Skal godkendelse være en SECURITY DEFINER RPC (transaktionel flyt), eller to separate kald?
- Bevarer vi `bubble_members.status`-kolonnen efter dette (til fremtidig `left`-status for B)?
- Migrering: er der pending-rækker i prod nu? (Ja — mindst 1: Bubble Tester i House of Software.)
