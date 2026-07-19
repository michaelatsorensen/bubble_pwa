# B — Medlemshistorik: events-log + graf der viser til/afmelding

> **Krav (Michael):** Grafen skal vise til- og afmeldinger som de sker, og altid
> stemme med det faktiske medlemstal. HVER boble starter på SIT eget nuværende
> medlemsantal (HoS = 3). Vi tæller fra nu af — ingen rekonstruktion af fortiden.
>
> **DESIGN — intet køres før Michael har set planen.** Derefter trinvist som C.

---

## Model

**Ren adskillelse (samme filosofi som C):**
- `bubble_members` = hvem er medlem NU (uændret — kun aktive medlemmer)
- `bubble_membership_events` (NY) = historik: hver til/afmelding som en hændelse
- En TRIGGER holder loggen opdateret automatisk (som sync_bubble_member_count)

**Grafen bygges fra events-loggen**, filtreret til KUN denne boble (ikke netværket),
så event-check-ins i sub-bobler ikke forurener boblens egen medlemsgraf.

**Baseline:** hver boble seedes med ÉT startpunkt = dens nuværende member_count på
migreringsdagen. Ærligt anker ("pr. i dag: N medlemmer") uden at lyve om fortidens datoer.

---

## Hvorfor trigger (ikke ændre kode-stier)

Til/afmelding sker MANGE steder: direkte join (b-utils 1394/1626/1729), QR-join,
approve_join_request-RPC, createBubble auto-join (b-bubbles 1036). Afmelding: leaveBubble
(b-utils 1420, b-bubbles 650), popBubble (sletter boble). En TRIGGER på bubble_members
fanger ALLE automatisk — vi rører ingen af kode-stierne. Samme mønster som den
member_count-trigger vi allerede stoler på.

---

## Migration — trinvist (som C)

### Trin 1: Events-log-tabellen
```sql
create table public.bubble_membership_events (
  id         uuid primary key default gen_random_uuid(),
  bubble_id  uuid not null references public.bubbles(id) on delete cascade,
  user_id    uuid,                          -- hvem (null for baseline-saldo)
  event_type text not null,                 -- 'joined' | 'left' | 'baseline'
  delta      int  not null,                 -- +1 joined, -1 left, N for baseline
  created_at timestamptz not null default now()
);
create index idx_membership_events_bubble on public.bubble_membership_events(bubble_id, created_at);
```
- `delta` gør grafen triviel: løbende sum af delta over tid = medlemstal på hvert tidspunkt.
- `baseline` som event_type: ét punkt per boble med delta = nuværende member_count.

### Trin 2: RLS
- SELECT: ejer/admin af boblen (samme mønster som join_requests). Grafen er admin-værktøj.
- INSERT: KUN via trigger (SECURITY DEFINER) + seed-migration. Ingen direkte klient-insert.
  (Vi giver ikke anon/authenticated INSERT — kun trigger-funktionen skriver.)

### Trin 3: Trigger-funktion + trigger
```sql
create or replace function public.log_membership_event()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if TG_OP = 'INSERT' then
    insert into bubble_membership_events (bubble_id, user_id, event_type, delta)
    values (NEW.bubble_id, NEW.user_id, 'joined', 1);
  elsif TG_OP = 'DELETE' then
    insert into bubble_membership_events (bubble_id, user_id, event_type, delta)
    values (OLD.bubble_id, OLD.user_id, 'left', -1);
  end if;
  return null;
end; $$;

create trigger trg_log_membership_event
  after insert or delete on public.bubble_members
  for each row execute function public.log_membership_event();
```
- Kun INSERT/DELETE (ikke UPDATE — status-ændringer er ikke til/afmelding efter C).
- NB: efter C laver approve_join_request en INSERT i bubble_members → fanges korrekt som 'joined'.

### Trin 4: Baseline-seed for ALLE bobler
```sql
insert into bubble_membership_events (bubble_id, user_id, event_type, delta, created_at)
select id, null, 'baseline', coalesce(member_count, 0), now()
from bubbles
where coalesce(member_count, 0) > 0;   -- kun bobler der HAR medlemmer
```
- Ét baseline-punkt per boble med medlemmer = dens nuværende member_count.
- HoS får delta=3. En boble med 12 får delta=12. Hver sin egen sandhed.
- created_at = now() (migreringstidspunkt) — det ærlige anker.

### Trin 5: Verifikation (mod prod)
- HoS baseline = 3? Et par andre bobler = deres member_count?
- Ingen bobler med member_count>0 mangler baseline?

---

## Fase 2 — Grafen (kode)

`_dashMeta['o-mem-...']` bygger i dag grafen fra bubble_members.joined_at via
_dashBucketWeeks (kumulativ, netværks-bred, kun-op). Erstattes med:

- Hent fra `bubble_membership_events` for KUN denne boble (`bubble_id = b.id`), ordnet efter created_at.
- Byg løbende sum af `delta`: baseline (3) → +1 → -1 → ... = faktisk medlemstal over tid.
- Linjen kan nu stige OG falde. Slutter på nuværende member_count.
- Undertekst ændres fra "Kumulativt for hele netværket" → noget som "Medlemmer over tid".

Det akkumulerede NETVÆRKS-tal (på tværs af sub-bobler) forbliver sin egen boks
(allerede påbegyndt i A: "N i hele netværket"), tydeligt beskrevet — vigtigt for
parent-ejer at se samlet netværks-engagement.

---

## Ærlige forbehold
- Historik starter fra NU. Grafen er flad i begyndelsen, får bevægelse som piloten kører.
- Fortidens afmeldinger er væk (hard-deletet før i dag) — kan ikke rekonstrueres.
- Baseline daterer alle nuværende medlemmer til migreringsdagen (vi kender ikke rigtige
  join-datoer historisk korrekt på tværs — baseline er ét ærligt punkt, ikke per-medlem).

## Åbne beslutninger før kørsel
1. event_type 'baseline' som separat type, eller bare en 'joined' med delta=N? (Foreslår
   'baseline' — tydeligt at det er et anker, ikke N faktiske tilmeldinger.)
2. Skal grafen vise baseline-punktet synligt, eller bare bruge det som startsaldo? (Foreslår
   startsaldo — linjen begynder ved 3, ingen mærkelig "spike" ved baseline.)
3. popBubble sletter en boble → CASCADE sletter dens events. OK? (Boblen findes ikke længere,
   så dens graf er irrelevant. Ja.)
