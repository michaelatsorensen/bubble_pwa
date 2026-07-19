-- ═══════════════════════════════════════════════════════════════════════
--  C · Trin 3: approve_join_request — transaktionel godkendelse
--
--  Flytter en person fra ansøger til medlem ATOMISK (alt eller intet).
--  Uden dette ville godkendelse være to separate kald (slet request +
--  opret medlem); fejl imellem dem = person forsvinder (hverken/eller).
--
--  SECURITY DEFINER: funktionen kører med forhøjede rettigheder, så den
--  selv MÅ verificere at kalderen er ejer/admin — ellers kunne hvem som
--  helst gøre nogen til medlem. Caller-tjek er DERFOR obligatorisk.
--
--  Idempotent-venlig: hvis personen allerede ER medlem (dobbelt-godkend,
--  race), behandles det som succes frem for fejl.
--
--  KØR SOM ÉT STATEMENT.
-- ═══════════════════════════════════════════════════════════════════════

create or replace function public.approve_join_request(
  p_bubble_id uuid,
  p_user_id   uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_caller uuid := auth.uid();
  v_is_manager boolean;
begin
  -- 1. Verificér kalder er ejer ELLER admin af boblen (obligatorisk pga. DEFINER).
  select exists (
    select 1 from bubbles b
    where b.id = p_bubble_id and b.created_by = v_caller
  ) or exists (
    select 1 from bubble_members m
    where m.bubble_id = p_bubble_id
      and m.user_id = v_caller
      and m.role = 'admin'
  ) into v_is_manager;

  if not v_is_manager then
    return jsonb_build_object('ok', false, 'error', 'not_authorized');
  end if;

  -- 2. Er personen allerede medlem? (idempotent — dobbelt-godkend er ikke en fejl)
  if exists (
    select 1 from bubble_members
    where bubble_id = p_bubble_id and user_id = p_user_id
  ) then
    -- Ryd evt. efterladt request op og meld succes.
    delete from bubble_join_requests
    where bubble_id = p_bubble_id and user_id = p_user_id;
    return jsonb_build_object('ok', true, 'status', 'already_member');
  end if;

  -- 3. Findes der overhovedet en request at godkende?
  if not exists (
    select 1 from bubble_join_requests
    where bubble_id = p_bubble_id and user_id = p_user_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'no_request');
  end if;

  -- 4. ATOMISK flyt: slet request + opret medlem. Begge eller ingen (én transaktion).
  delete from bubble_join_requests
  where bubble_id = p_bubble_id and user_id = p_user_id;

  insert into bubble_members (bubble_id, user_id)
  values (p_bubble_id, p_user_id);

  return jsonb_build_object('ok', true, 'status', 'approved');
end;
$function$;
