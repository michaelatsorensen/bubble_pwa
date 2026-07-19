-- ═══════════════════════════════════════════════════════════════════════
--  DIAGNOSE: medlemstælling — sandheden før vi bygger B
--
--  Formål: fastslå PRÆCIST hvorfor tre tal (3 header / 5 statistik / 3 faktisk)
--  er uenige, og hvad "member_count = pålidelig sandhed" kræver.
--
--  KØR TRINVIST i Supabase SQL Editor. Rapportér output for hvert trin.
--  Dette ændrer INTET — kun SELECT + inspektion.
-- ═══════════════════════════════════════════════════════════════════════


-- ═══ TRIN 1: Findes der en trigger der vedligeholder bubbles.member_count? ═══
-- Dette er DET afgørende spørgsmål. Hvis nej → den denormaliserede tæller
-- driver ud af sync (forklarer 3 vs 5), og B skal indføre en trigger.
select
  t.tgname          as trigger_navn,
  c.relname         as paa_tabel,
  p.proname         as kalder_funktion,
  pg_get_triggerdef(t.oid) as definition
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_proc p on p.oid = t.tgfoid
where not t.tgisinternal
  and (c.relname = 'bubble_members' or c.relname = 'bubbles')
order by c.relname, t.tgname;
-- FORVENTNING hvis sundt: en trigger på bubble_members (AFTER INSERT/DELETE)
-- der opdaterer bubbles.member_count. Tom = INGEN vedligeholdelse = sync-bug.


-- ═══ TRIN 2: Hvad gør de to tælle-RPC'er? ═══
-- count_unique_members + count_new_unique_members — vi kan ikke se deres logik
-- fra frontend. Særligt: tæller de pending med? Tæller de hele netværket?
select p.proname as funktion, pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('count_unique_members', 'count_new_unique_members');
-- Kig efter: filtreres 'pending' fra? Er det DISTINCT user_id (så samme person
-- i flere sub-bobler kun tælles én gang)? Det forklarer 5-tallet.


-- ═══ TRIN 3: Faktisk sandhed for House of Software-boblen ═══
-- Erstat <BUBBLE_ID> med boblens id. Sammenlign de tre kilder side om side.
-- (Find id: select id, name from bubbles where name ilike '%House of Software%';)

-- 3a. Den GEMTE denormaliserede tæller:
select id, name, member_count as gemt_taeller
from bubbles where id = '<BUBBLE_ID>';

-- 3b. FAKTISKE rækker i bubble_members, opdelt på status:
select
  coalesce(status, '(null=aktiv)') as status,
  count(*) as antal
from bubble_members
where bubble_id = '<BUBBLE_ID>'
group by status
order by status;
-- Aktive (status null eller ikke-pending) = det SANDE medlemstal for boblen.

-- 3c. Hele netværket (boble + sub-bobler + events) — det statistik-kortet tæller:
with tree as (
  select id from bubbles where id = '<BUBBLE_ID>'
  union
  select id from bubbles where parent_bubble_id = '<BUBBLE_ID>'
  union
  select b3.id from bubbles b3
  join bubbles b2 on b3.parent_bubble_id = b2.id
  where b2.parent_bubble_id = '<BUBBLE_ID>'
)
select
  count(*) filter (where coalesce(bm.status,'') <> 'pending') as netvaerk_aktive,
  count(distinct bm.user_id) filter (where coalesce(bm.status,'') <> 'pending') as netvaerk_unikke
from bubble_members bm
where bm.bubble_id in (select id from tree);
-- Hvis 'netvaerk_unikke' = 5, er statistik-kortet ikke buggy — bare bredt/misvisende mærket.


-- ═══ TRIN 4: Hvor mange bobler har en member_count der IKKE matcher virkeligheden? ═══
-- Afdækker OMFANGET af sync-driften på tværs af HELE databasen.
select
  b.id, b.name,
  b.member_count as gemt,
  count(bm.*) filter (where coalesce(bm.status,'') <> 'pending') as faktisk_aktive
from bubbles b
left join bubble_members bm on bm.bubble_id = b.id
group by b.id, b.name, b.member_count
having b.member_count is distinct from count(bm.*) filter (where coalesce(bm.status,'') <> 'pending')
order by abs(coalesce(b.member_count,0) - count(bm.*) filter (where coalesce(bm.status,'') <> 'pending')) desc
limit 50;
-- Tomt = alle tællere er i sync (så er der en trigger, og problemet er kun mærkning).
-- Rækker = bevis på drift; jo flere, jo mere haster en pålidelig kilde.


-- ═══ TRIN 5: Findes 'joined_at' konsekvent? (grafen bruger det) ═══
-- Grafen bucketer på joined_at. Hvis nogle rækker mangler det, forsvinder de fra grafen.
select
  count(*) as total_raekker,
  count(joined_at) as har_joined_at,
  count(*) - count(joined_at) as mangler_joined_at
from bubble_members;
-- mangler_joined_at > 0 = grafen underrapporterer (og B's afgangs-historik får huller).
