-- ═══════════════════════════════════════════════════════════════════════
--  Rettelse: statistik-RPC'er skal ekskludere pending-medlemmer
--
--  Baggrund (verificeret 18. jul via diagnose): begge tælle-RPC'er tæller
--  DISTINCT user_id over et sæt bubble_ids, men filtrerer IKKE pending fra.
--  Trigger-funktionen sync_bubble_member_count gør det korrekt
--  (status IS NULL OR status <> 'pending') — RPC'erne skal bruge samme regel.
--
--  Effekt: House of Software statistik-kort går fra 5 → 4 (fjerner den ene
--  pending Bubble Tester der ikke burde tælle som medlem).
--
--  KØR TRINVIST. Bekræft output efter hvert statement.
--  Signaturer uændrede → ingen frontend-ændring nødvendig for RPC-kaldene.
-- ═══════════════════════════════════════════════════════════════════════


-- ═══ STATEMENT 1 ═══
-- count_unique_members: tilføj pending-filter (samme regel som triggeren).
create or replace function public.count_unique_members(bubble_ids uuid[])
returns bigint
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce(count(distinct user_id), 0)
  from bubble_members
  where bubble_id = any(bubble_ids)
    and (status is null or status <> 'pending');
$function$;


-- ═══ STATEMENT 2 ═══
-- count_new_unique_members: samme pending-filter, behold since-parameteren.
create or replace function public.count_new_unique_members(bubble_ids uuid[], since timestamptz)
returns bigint
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce(count(distinct user_id), 0)
  from bubble_members
  where bubble_id = any(bubble_ids)
    and joined_at >= since
    and (status is null or status <> 'pending');
$function$;


-- ═══ STATEMENT 3 (VERIFIKATION — ikke en ændring) ═══
-- Bekræft at House of Software-netværket nu tæller 4 (ikke 5).
-- Skal give 4 efter statement 1.
with tree as (
  select id from bubbles where id = 'adde6208-2f9b-4519-b96d-ef6bdf084bbe'
  union
  select id from bubbles where parent_bubble_id = 'adde6208-2f9b-4519-b96d-ef6bdf084bbe'
  union
  select b3.id from bubbles b3
  join bubbles b2 on b3.parent_bubble_id = b2.id
  where b2.parent_bubble_id = 'adde6208-2f9b-4519-b96d-ef6bdf084bbe'
)
select public.count_unique_members(array(select id from tree)) as skal_vaere_4;
