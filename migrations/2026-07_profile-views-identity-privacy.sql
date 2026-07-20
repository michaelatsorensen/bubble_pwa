-- ═══════════════════════════════════════════════════════════════════════
--  Sikkerhed: profile_views lækker HVEM-der-så-dig til direkte forespørgsler
--
--  Baggrund (verificeret 20. jul via pg_policies): politikken
--  auth_read_own_views tillader SELECT hvor viewed_id = auth.uid(). Appen
--  bruger kun count(), men RLS lader en teknisk kyndig bruger forespørge
--    select viewer_id from profile_views where viewed_id = '<mit-id>';
--  og få den fulde liste af HVEM der har set deres profil. Det bryder
--  kernegaranti: "transparent tilstedeværelse, private handlinger" —
--  hvem du kigger paa skal vaere privat.
--
--  Loesning: fjern den laekkende SELECT-politik. Erstat med (1) en politik
--  der kun lader dig laese DINE EGNE visninger (viewer_id = auth.uid), og
--  (2) SECURITY DEFINER count-funktioner der giver ANTAL uden identitet.
--
--  saved_contacts er ALLEREDE sikker (SELECT kun user_id = auth.uid), saa
--  den roeres ikke. Bemaerk sidegevinst: app-kald der taeller "hvem har
--  gemt mig" (contact_id = me) returnerer allerede 0 pga. RLS — korrekt,
--  men de boer skiftes til RPC hvis tallet oenskes (separat oprydning).
--
--  KOER TRINVIST. Bekraeft output efter hvert statement.
-- ═══════════════════════════════════════════════════════════════════════


-- ═══ STATEMENT 1 ═══
-- Inspektion foerst: bekraeft de nuvaerende politikker paa profile_views.
-- (Ingen aendring — bare saa vi ved hvad vi fjerner.)
select policyname, cmd, qual
from pg_policies
where tablename = 'profile_views'
order by cmd, policyname;


-- ═══ STATEMENT 2 ═══
-- Fjern den laekkende politik. Efter dette kan ingen laese raekker hvor de
-- er den VISTE person — dvs. viewer_id (hvem der saa dem) er ikke laengere
-- hentbar udenom app'en. Insert-politikken roeres IKKE.
drop policy if exists "auth_read_own_views" on public.profile_views;


-- ═══ STATEMENT 2b ═══
-- Fjern OGSAA admin-rapport-politikken. Verificeret 20. jul: frontend laeser
-- aldrig raa viewer_id-raekker (kun count via viewed_id = mig), og attendee-
-- rapporten bruger anonyme "Deltager #N"-numre, ikke identitet. Politikken er
-- altsaa UBRUGT af app'en, men aaben som laekage-vej: den lader en boble-ejer
-- se HVER profil deres medlemmer har kigget paa — inkl. visninger der intet
-- har med ejerens boble at goere (den filtrerer paa viewer_id, ikke paa om den
-- viste person er relevant for boblen). Det er bredere end den anden laekage og
-- i direkte spaend med "hvem du kigger paa er privat".
--
-- Hvis attendee-insights bygges som rigtigt produkt senere: genindfoer korrekt
-- AFGRAENSET (kun ejerens egen boble-kontekst, helst aggregeret via SECURITY
-- DEFINER-RPC der returnerer tal, ikke identitet).
drop policy if exists "admin_read_views_for_report" on public.profile_views;


-- ═══ STATEMENT 3 ═══
-- Tilfoej en snaever politik: du maa laese DINE EGNE visninger af andre
-- (viewer_id = dig). Det braekker intet legitimt (app'en henter aldrig
-- disse raekker for at vise identitet), men bevarer muligheden for at en
-- bruger kan se sin egen aktivitet hvis vi nogensinde bygger det.
create policy "pv_read_own_activity" on public.profile_views
  for select to authenticated
  using (viewer_id = auth.uid());


-- ═══ STATEMENT 4 ═══
-- Count-RPC: "hvor mange har set mig" (evt. filtreret til et saet viewers
-- for tilstedevaerelses-tilfaeldet paa forsiden). SECURITY DEFINER, saa den
-- kan taelle raekkerne uden at app'en har SELECT-adgang til dem. Returnerer
-- KUN et tal — aldrig viewer_id.
create or replace function public.get_my_view_count(p_viewer_ids uuid[] default null)
returns bigint
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce(count(*), 0)
  from profile_views
  where viewed_id = auth.uid()
    and (p_viewer_ids is null or viewer_id = any(p_viewer_ids));
$function$;


-- ═══ STATEMENT 5 ═══
-- Grants: authenticated skal kunne kalde count-RPC'en. anon skal IKKE.
revoke all on function public.get_my_view_count(uuid[]) from public, anon;
grant execute on function public.get_my_view_count(uuid[]) to authenticated;


-- ═══ STATEMENT 5b ═══
-- Boble-ejer-statistik BEVARES — men anonymt OG uden smaa-saet-laekage.
-- Rapporten viser "N profil-visninger skete blandt jeres medlemmer"
-- (engagement-niveau) — vaerdifuld Event/Corporate-indsigt, allerede bare et
-- TAL i UI'et.
--
-- VIGTIGT design: RPC'en tager et BOBLE-ID, ikke et vilkaarligt id-saet.
-- Havde den taget et id-saet, kunne en ejer forespoerge fx [Alice, Bob] og
-- udlede af tallet om DE TO har set hinanden (aggregat-laekage ved smaa saet).
-- Ved at binde til en boble og selv finde medlemmerne, kan ejeren KUN faa
-- aggregatet for hele deres egen boble — aldrig et konstrueret lille saet.
-- Verificerer ejerskab af PRAECIS den boble. Returnerer et tal, ingen identitet.
create or replace function public.get_bubble_view_count(p_bubble_id uuid)
returns bigint
language sql
stable
security definer
set search_path to 'public'
as $function$
  select case
    when exists (
      select 1 from bubbles b
      where b.id = p_bubble_id and b.created_by = auth.uid()
    ) or exists (
      select 1 from bubble_members m
      where m.bubble_id = p_bubble_id and m.user_id = auth.uid() and m.role in ('owner','admin')
    )
    then coalesce((
      select count(*) from profile_views
      where viewer_id in (select user_id from bubble_members where bubble_id = p_bubble_id)
        and viewed_id in (select user_id from bubble_members where bubble_id = p_bubble_id)
    ), 0)
    else 0
  end;
$function$;

revoke all on function public.get_bubble_view_count(uuid) from public, anon;
grant execute on function public.get_bubble_view_count(uuid) to authenticated;


-- ═══ STATEMENT 5c ═══
-- Super-admin platform-metrik: globalt antal profil-visninger i en periode.
-- Legitim platform-drift (ikke privatliv — aggregeret tal, ingen identitet),
-- men den brede count-forespoergsel braekker naar vi strammer RLS. Gated til
-- super-admin (profiles.role = 'admin'). Returnerer et tal for de sidste
-- p_days dage.
create or replace function public.get_global_view_count(p_days int default 7)
returns bigint
language sql
stable
security definer
set search_path to 'public'
as $function$
  select case
    when exists (
      select 1 from profiles where id = auth.uid() and role = 'admin'
    )
    then coalesce((
      select count(*) from profile_views
      where created_at >= (now() - make_interval(days => p_days))
    ), 0)
    else 0
  end;
$function$;

revoke all on function public.get_global_view_count(int) from public, anon;
grant execute on function public.get_global_view_count(int) to authenticated;


-- ═══ STATEMENT 6 ═══
-- Verifikation: bekraeft at den laekkende laesning nu er blokeret.
-- Koer som en ALMINDELIG bruger (ikke service role) for at teste RLS:
--   select viewer_id from profile_views where viewed_id = auth.uid();
-- Skal returnere 0 rows (eller fejle) — IKKE en liste af viewers.
-- Og count-RPC'en skal virke:
--   select public.get_my_view_count();
-- Skal returnere et tal.
--
-- (Disse er manuelle tjek — koeres separat i app-brugerens kontekst,
--  ikke i SQL-editoren som service role, ellers omgaas RLS.)
