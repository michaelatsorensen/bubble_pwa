-- ════════════════════════════════════════════════════════════════════
-- GDPR-sletning (Q-062) — komplet RPC MED storage-oprydning
-- ════════════════════════════════════════════════════════════════════
-- Bygger på det verificerede q-062-design (Building bubble v.22, 10. juni 2026).
-- NYT i denne version: storage-oprydning af brugerens personlige filer i
-- bubble-files-bucketen. Det manglede i originalen og er det reelle hul —
-- uden det ligger en slettet brugers billeder offentligt videre via deres
-- permanente public-URL'er.
--
-- STRATEGI: 1:1-data SLETTES, gruppe-data ANONYMISERES.
--   - DMs (messages) + profil-relationer  → CASCADE-slettes ved auth-bruger-sletning
--   - Gruppe-indhold (bobble-beskeder/opslag/reaktioner/oprettede bobler)
--                                          → peges over på sentinel "Slettet bruger"
--   - Brugerens personlige storage-filer (avatars/, dm/)  → SLETTES
--   - Bevarede gruppe-filers owner-metadata               → nulstilles
--
-- ⚠️ VERIFIKATIONS-UDKAST — IKKE KØR-BLINDT.
--    Kolonnenavne markeret VERIFICERET blev tjekket mod skemaet 10. juni 2026.
--    Punkter markeret ⚠️ skal bekræftes mod dit aktuelle skema før kørsel.
-- ════════════════════════════════════════════════════════════════════


-- ── 1. SENTINEL "Slettet bruger"-profil (opret ÉN gang) ──
-- VERIFICERET: profiles har INGEN email-kolonne (email ligger i auth.users).
INSERT INTO public.profiles (id, name, title, bio, workplace, avatar_url)
VALUES (
  '00000000-0000-0000-0000-000000000000',  -- fast sentinel-UUID
  'Slettet bruger', NULL, NULL, NULL, NULL
)
ON CONFLICT (id) DO NOTHING;


-- ── 2. RPC: anonymisér gruppe-indhold + slet personlige data/filer ──
CREATE OR REPLACE FUNCTION public.gdpr_delete_user(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sentinel uuid := '00000000-0000-0000-0000-000000000000';
  v_caller   uuid := auth.uid();
  v_is_admin boolean;
  v_counts   jsonb := '{}'::jsonb;
  n int;
BEGIN
  -- AUTORISATION: kun admin ELLER brugeren selv må slette
  -- ⚠️ VERIFICÉR: hvordan markeres admin? (her antaget: profiles.is_admin boolean)
  SELECT COALESCE(is_admin, false) INTO v_is_admin FROM profiles WHERE id = v_caller;
  IF v_caller <> p_user_id AND NOT COALESCE(v_is_admin, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;
  IF p_user_id = v_sentinel THEN
    RETURN jsonb_build_object('ok', false, 'error', 'cannot_delete_sentinel');
  END IF;

  -- ── ANONYMISÉR gruppe-indhold (peg over på sentinel) ──
  -- bubble_messages: VERIFICERET → user_id
  UPDATE bubble_messages SET user_id = v_sentinel WHERE user_id = p_user_id;
  GET DIAGNOSTICS n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('bubble_messages', n);

  -- bubble_message_reactions: VERIFICERET → user_id
  UPDATE bubble_message_reactions SET user_id = v_sentinel WHERE user_id = p_user_id;
  GET DIAGNOSTICS n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('reactions', n);

  -- bubble_posts: VERIFICERET → author_id
  UPDATE bubble_posts SET author_id = v_sentinel WHERE author_id = p_user_id;
  GET DIAGNOSTICS n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('bubble_posts', n);

  -- bubbles.created_by: oprettede bobler → ejer bliver sentinel (boble + medlemmer består)
  UPDATE bubbles SET created_by = v_sentinel WHERE created_by = p_user_id;
  GET DIAGNOSTICS n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('bubbles', n);

  -- guest_checkins.claimed_by: VERIFICERET → claimed_by
  UPDATE guest_checkins SET claimed_by = v_sentinel WHERE claimed_by = p_user_id;
  GET DIAGNOSTICS n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('guest_checkins', n);

  -- ── NULSTIL brugerens egen profil (fjern persondata) ──
  -- Profilen beholdes som tom skal (FK-mål for evt. rest), men uden identificerbare data.
  -- ⚠️ email findes IKKE i profiles (ligger i auth.users) — derfor ikke her.
  -- ⚠️ hvis geolocation-kolonner er tilføjet (P2: last_lat/last_lng/location_updated_at):
  --    tilføj dem = NULL her.
  UPDATE profiles SET
    name = 'Slettet bruger', bio = NULL, workplace = NULL,
    title = NULL, avatar_url = NULL
  WHERE id = p_user_id;

  -- ── STORAGE-OPRYDNING (NYT — manglede i original q-062) ──
  -- Slet brugerens PERSONLIGE/1:1-filer. Sti-skema VERIFICERET mod frontend-koden:
  --   avatars/<uid>/<ts>.jpg       profilbilleder (auth + onboarding)
  --   dm/<uid>/<ts>-<filnavn>      DM-vedhæftninger (1:1, privat)
  -- Gruppe-filer (bubbles/<bubbleId>/... + <bubbleId>/... = bobble-chat) bevares,
  -- konsistent med at gruppe-INDHOLD anonymiseres frem for slettes.
  DELETE FROM storage.objects
  WHERE bucket_id = 'bubble-files'
    AND ( name LIKE 'avatars/' || p_user_id::text || '/%'
       OR name LIKE 'dm/'      || p_user_id::text || '/%' );
  GET DIAGNOSTICS n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('storage_deleted', n);

  -- Fjern person-koblingen på BEVAREDE gruppe-filer (owner-metadata).
  -- Pre-empter også en evt. RESTRICT-FK på storage.objects.owner → auth.users,
  -- så auth-bruger-sletningen (trin 3) ikke blokeres.
  -- ⚠️ Nyere Supabase bruger evt. kolonnen 'owner_id' i stedet for/udover 'owner' — verificér.
  UPDATE storage.objects SET owner = NULL
  WHERE bucket_id = 'bubble-files' AND owner = p_user_id;
  GET DIAGNOSTICS n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('storage_owner_cleared', n);

  RETURN jsonb_build_object('ok', true, 'anonymized', v_counts, 'profile_reset', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.gdpr_delete_user(uuid) TO authenticated;


-- ════════════════════════════════════════════════════════════════════
-- PROCEDURE — det du gør ved en sletteanmodning:
--   1. Kør:  SELECT gdpr_delete_user('<bruger-uuid>');
--            → anonymiserer gruppe-indhold, nulstiller profil, sletter
--              personlige storage-filer. Tjek tallene i returnen.
--   2. Slet auth-brugeren (Dashboard → Authentication → slet bruger, ELLER
--      service-role auth.admin.deleteUser). Udløser CASCADE på de tabeller
--      der rydder sig selv (se ⚠️ nedenfor).
--   3. Bekræft: ingen rækker tilbage (verifikation nedenfor, skal give 0).
--
-- ⚠️ CASCADE-AFHÆNGIGHED — det vigtigste at bekræfte:
--    bubble_members, messages, profile_views, saved_contacts forudsættes at
--    have ON DELETE CASCADE FK til auth.users, så de ryddes i trin 2.
--    Bekræft det. Hvis IKKE, slet dem eksplicit i trin 1 — ellers efterlades
--    DMs = GDPR-fejl. F.eks.:
--      DELETE FROM messages       WHERE sender_id = p_user_id OR receiver_id = p_user_id;
--      DELETE FROM bubble_members WHERE user_id = p_user_id;
--      DELETE FROM saved_contacts WHERE user_id = p_user_id OR contact_id = p_user_id;
--      DELETE FROM profile_views  WHERE viewer_id = p_user_id OR viewed_id = p_user_id;
--
-- ⚠️ push-subscriptions: har den FK med CASCADE? Ellers slet eksplicit i trin 1:
--      DELETE FROM push_subscriptions WHERE user_id = p_user_id;
--    (tjek tabelnavn — kan hedde push_subscriptions / push_endpoints)
-- ════════════════════════════════════════════════════════════════════

-- VERIFIKATION efter sletning (alt skal returnere 0):
--   SELECT 'bubble_messages', count(*) FROM bubble_messages        WHERE user_id    = '<uuid>'
--   UNION ALL SELECT 'reactions',      count(*) FROM bubble_message_reactions WHERE user_id   = '<uuid>'
--   UNION ALL SELECT 'bubble_posts',   count(*) FROM bubble_posts           WHERE author_id  = '<uuid>'
--   UNION ALL SELECT 'bubbles',        count(*) FROM bubbles                WHERE created_by = '<uuid>'
--   UNION ALL SELECT 'guest_checkins', count(*) FROM guest_checkins         WHERE claimed_by = '<uuid>'
--   UNION ALL SELECT 'messages',       count(*) FROM messages WHERE sender_id='<uuid>' OR receiver_id='<uuid>'
--   UNION ALL SELECT 'storage',        count(*) FROM storage.objects
--                                      WHERE bucket_id='bubble-files'
--                                        AND (name LIKE 'avatars/<uuid>/%' OR name LIKE 'dm/<uuid>/%');
