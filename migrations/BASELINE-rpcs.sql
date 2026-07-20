-- ═══════════════════════════════════════════════════════════════════════
--  BASELINE: RPC'er defineret direkte i DB uden migrations-fil i repo
--
--  Dumpet 20. jul 2026 via pg_get_functiondef (audit-fund: 8 af 15
--  frontend-kaldte RPC'er manglede versionsstyret kilde). Dette er den
--  FAKTISKE produktions-definition paa dump-tidspunktet — backend-kontrakt-
--  dokumentation til native-rewrite. Aendringer FREMOVER skal ske via
--  nye migrations-filer, ikke ved at redigere denne baseline.
--
--  AUDIT-NOTER (fund ved dump, se AUDIT-2026-07-20.md):
--  1. get_bubble_teaser: SECURITY DEFINER, returnerer HOST-identitet + 5
--     medlemmer for ETHVERT bubble_id — ogsaa private/hidden. Se aabent
--     spoergsmaal om 3-lags-modellen nedenfor.
--  2. get_latest_bubble_msg_times: mangler SET search_path (haerdnings-
--     hul, lav risiko) og har intet medlemskabs-tjek (laekker aktivitets-
--     tidspunkter for vilkaarlige bubble_ids til authenticated).
--  3. get_bubble_teaser 'recent'-blok lister stadig databasens nyeste
--     profiler (TD-002-observationen) — bruges af create-first teaser.
-- ═══════════════════════════════════════════════════════════════════════

-- ── accept_ownership_transfer ──
CREATE OR REPLACE FUNCTION public.accept_ownership_transfer(p_bubble_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_bubble public.bubbles%ROWTYPE;
  v_old_owner uuid;
BEGIN
  SELECT * INTO v_bubble FROM bubbles WHERE id = p_bubble_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'bubble_not_found'); END IF;

  -- Kun den udpegede modtager maa acceptere (#7, vigtigste invariant). Idempotent (#11).
  IF v_bubble.pending_owner_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_pending_recipient');
  END IF;

  -- Modtager skal stadig vaere medlem (#1/#2: kan vaere forladt/banned siden anmodning).
  IF NOT EXISTS(SELECT 1 FROM bubble_members WHERE bubble_id = p_bubble_id AND user_id = auth.uid()) THEN
    UPDATE bubbles SET pending_owner_id = NULL, pending_owner_requested_at = NULL WHERE id = p_bubble_id;
    RETURN jsonb_build_object('ok', false, 'error', 'recipient_no_longer_member');
  END IF;

  v_old_owner := v_bubble.created_by;

  UPDATE bubbles
    SET created_by = auth.uid(), pending_owner_id = NULL, pending_owner_requested_at = NULL
    WHERE id = p_bubble_id;

  UPDATE bubble_members SET role = 'admin'
    WHERE bubble_id = p_bubble_id AND user_id = auth.uid() AND role <> 'admin';

  UPDATE bubble_members SET role = 'admin'
    WHERE bubble_id = p_bubble_id AND user_id = v_old_owner AND role <> 'admin';

  RETURN jsonb_build_object('ok', true, 'new_owner', auth.uid(), 'old_owner', v_old_owner);
END;
$function$;

-- ── decline_ownership_transfer ──
CREATE OR REPLACE FUNCTION public.decline_ownership_transfer(p_bubble_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_bubble public.bubbles%ROWTYPE;
BEGIN
  SELECT * INTO v_bubble FROM bubbles WHERE id = p_bubble_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'bubble_not_found'); END IF;

  IF v_bubble.pending_owner_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_pending_recipient');
  END IF;

  UPDATE bubbles SET pending_owner_id = NULL, pending_owner_requested_at = NULL WHERE id = p_bubble_id;
  RETURN jsonb_build_object('ok', true);
END;
$function$;

-- ── get_bubble_teaser ──
CREATE OR REPLACE FUNCTION public.get_bubble_teaser(p_bubble_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object(
    'member_count', (select count(*) from bubble_members where bubble_id = p_bubble_id),
    'members', coalesce((
      select jsonb_agg(t) from (
        select p.id, p.name, p.title, p.workplace, p.avatar_url, p.keywords
        from bubble_members m join profiles p on p.id = m.user_id
        where m.bubble_id = p_bubble_id
        order by m.joined_at asc nulls last limit 5
      ) t), '[]'::jsonb),
    'host', (
      select to_jsonb(h) from (
        select p.id, p.name, p.title, p.workplace, p.avatar_url, p.keywords
        from bubbles b join profiles p on p.id = b.created_by
        where b.id = p_bubble_id
      ) h),
    'recent', coalesce((
      select jsonb_agg(r) from (
        select p.id, p.name, p.title, p.workplace, p.avatar_url, p.keywords
        from profiles p
        where p.name is not null and p.title is not null
          and coalesce(p.banned,false)=false and coalesce(p.is_anon,false)=false
        order by p.created_at desc limit 6
      ) r), '[]'::jsonb)
  );
$function$;

-- ── get_latest_bubble_msg_times ──
CREATE OR REPLACE FUNCTION public.get_latest_bubble_msg_times(p_bubble_ids uuid[])
 RETURNS TABLE(bubble_id uuid, latest_msg_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT m.bubble_id, MAX(m.created_at) as latest_msg_at
  FROM bubble_messages m
  WHERE m.bubble_id = ANY(p_bubble_ids)
  GROUP BY m.bubble_id
$function$;

-- ── get_teaser_stats ──
CREATE OR REPLACE FUNCTION public.get_teaser_stats()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object(
    'profile_count', (select count(*) from profiles where coalesce(banned,false)=false)
  );
$function$;

-- ── request_ownership_transfer ──
CREATE OR REPLACE FUNCTION public.request_ownership_transfer(p_bubble_id uuid, p_to_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_bubble public.bubbles%ROWTYPE;
  v_is_member boolean;
BEGIN
  SELECT * INTO v_bubble FROM bubbles WHERE id = p_bubble_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'bubble_not_found'); END IF;

  IF v_bubble.created_by <> auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_owner');
  END IF;

  IF p_to_user_id = auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'cannot_transfer_to_self');
  END IF;

  SELECT EXISTS(SELECT 1 FROM bubble_members WHERE bubble_id = p_bubble_id AND user_id = p_to_user_id)
    INTO v_is_member;
  IF NOT v_is_member THEN
    RETURN jsonb_build_object('ok', false, 'error', 'recipient_not_member');
  END IF;

  IF v_bubble.pending_owner_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'transfer_already_pending');
  END IF;

  UPDATE bubbles
    SET pending_owner_id = p_to_user_id, pending_owner_requested_at = now()
    WHERE id = p_bubble_id;

  RETURN jsonb_build_object('ok', true, 'pending_owner_id', p_to_user_id);
END;
$function$;

-- ── resolve_qr_token ──
CREATE OR REPLACE FUNCTION public.resolve_qr_token(p_token text)
 RETURNS TABLE(user_id uuid, expired boolean)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select t.user_id,
         (t.expires_at is not null and t.expires_at < now()) as expired
  from public.qr_tokens t
  where t.token = p_token
  limit 1;
$function$;

-- ── withdraw_ownership_transfer ──
CREATE OR REPLACE FUNCTION public.withdraw_ownership_transfer(p_bubble_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_bubble public.bubbles%ROWTYPE;
BEGIN
  SELECT * INTO v_bubble FROM bubbles WHERE id = p_bubble_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'bubble_not_found'); END IF;

  IF v_bubble.created_by <> auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_owner');
  END IF;

  IF v_bubble.pending_owner_id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'note', 'nothing_pending');
  END IF;

  UPDATE bubbles SET pending_owner_id = NULL, pending_owner_requested_at = NULL WHERE id = p_bubble_id;
  RETURN jsonb_build_object('ok', true);
END;
$function$;
