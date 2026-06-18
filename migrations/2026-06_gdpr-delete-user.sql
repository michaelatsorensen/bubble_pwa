-- ════════════════════════════════════════════════════════════════════
-- GDPR-sletning (Q-062) — SKEMA-VERIFICERET komplet RPC + storage-oprydning
-- ════════════════════════════════════════════════════════════════════
-- Verificeret mod det FAKTISKE skema 18. juni 2026 (FK-constraints + kolonner).
-- Alle ⚠️-gæt fra det tidligere udkast er nu afklaret:
--   - messages / bubble_members / profile_views / saved_contacts har CASCADE
--     (via profiles ← auth.users) → de rydder sig selv. DMs efterlades IKKE.
--   - push_subscriptions har CASCADE på auth.users → ingen eksplicit oprydning.
--   - profiles har INGEN is_admin og INGEN email-kolonne; ingen geo-kolonner.
--   - storage.objects har BÅDE owner (uuid) OG owner_id (text).
--   - 4 tabeller peger på auth.users med NO ACTION og VILLE blokere auth-sletningen
--     (blocked_users, custom_tags, error_log, reports) → ryddes nu eksplicit her.
--   - reaktioner + guest_checkins SLETTES (re-pegning til samme sentinel ville
--     bryde en unique(message,user)-constraint ved den anden sletning).
--
-- STRATEGI: indhold ANONYMISERES, personlige records/data/filer SLETTES.
-- PROCEDURE (2 trin): 1) kør denne RPC   2) slet auth-brugeren (CASCADE rydder resten).
-- ════════════════════════════════════════════════════════════════════


-- ── 1. SENTINEL "Slettet bruger"-profil (opret ÉN gang) ──
-- VERIFICERET: profiles har INGEN email-kolonne (email ligger i auth.users).
INSERT INTO public.profiles (id, name, title, bio, workplace, avatar_url)
VALUES ('00000000-0000-0000-0000-000000000000', 'Slettet bruger', NULL, NULL, NULL, NULL)
ON CONFLICT (id) DO NOTHING;


-- ── 2. RPC: anonymisér indhold + slet personlige data/records/filer ──
CREATE OR REPLACE FUNCTION public.gdpr_delete_user(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sentinel uuid := '00000000-0000-0000-0000-000000000000';
  v_caller   uuid := auth.uid();
  v_counts   jsonb := '{}'::jsonb;
  n int;
BEGIN
  -- AUTORISATION: en logget-ind bruger må kun slette SIG SELV.
  -- Service-role / SQL Editor (auth.uid() = NULL) = admin-kontekst → tilladt.
  IF v_caller IS NOT NULL AND v_caller <> p_user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;
  IF p_user_id = v_sentinel THEN
    RETURN jsonb_build_object('ok', false, 'error', 'cannot_delete_sentinel');
  END IF;

  -- ── ANONYMISÉR indhold (peg over på sentinel; bevarer andres oplevelse) ──
  UPDATE bubble_messages SET user_id = v_sentinel WHERE user_id = p_user_id;
  GET DIAGNOSTICS n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('bubble_messages', n);

  UPDATE bubble_posts SET author_id = v_sentinel WHERE author_id = p_user_id;
  GET DIAGNOSTICS n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('bubble_posts', n);

  UPDATE bubbles SET created_by = v_sentinel WHERE created_by = p_user_id;
  GET DIAGNOSTICS n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('bubbles', n);

  -- ── SLET personlige records (indholdsløse + kollisions-sikkert) ──
  -- reaktioner har unique(message,user) → re-pegning til sentinel ville kollidere.
  DELETE FROM bubble_message_reactions WHERE user_id = p_user_id;
  GET DIAGNOSTICS n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('reactions_deleted', n);

  DELETE FROM guest_checkins WHERE claimed_by = p_user_id;
  GET DIAGNOSTICS n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('guest_checkins_deleted', n);

  -- ── RYD tabeller der ellers BLOKERER auth-sletningen (NO ACTION på auth.users) ──
  DELETE FROM blocked_users WHERE user_id = p_user_id OR blocked_id = p_user_id;
  GET DIAGNOSTICS n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('blocked_users_deleted', n);

  DELETE FROM error_log WHERE user_id = p_user_id;
  GET DIAGNOSTICS n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('error_log_deleted', n);

  -- custom_tags.created_by er nullable → behold tags andre bruger, sever koblingen.
  UPDATE custom_tags SET created_by = NULL WHERE created_by = p_user_id;

  -- reports.reporter_id er NOT NULL → de rækker må slettes;
  -- reports.reported_id er nullable → anonymisér (behold moderations-historik).
  DELETE FROM reports WHERE reporter_id = p_user_id;
  UPDATE reports SET reported_id = NULL WHERE reported_id = p_user_id;

  -- ── NULSTIL brugerens egen profil ──
  -- profiles.id CASCADE-slettes i trin 2; dette nuller persondata i vinduet imellem.
  UPDATE profiles SET
    name = 'Slettet bruger',
    bio = NULL, workplace = NULL, title = NULL, avatar_url = NULL, linkedin = NULL,
    keywords = NULL, dynamic_keywords = NULL, interests = NULL, sectors = NULL,
    life_phase = NULL, lifestage = NULL, role = NULL, match_sector = NULL
  WHERE id = p_user_id;

  -- ── STORAGE-OPRYDNING ──
  -- Slet personlige/1:1-filer (sti-skema verificeret mod frontend):
  --   avatars/<uid>/...  profilbilleder      dm/<uid>/...  DM-vedhæftninger (1:1)
  -- Gruppe-filer (bubbles/<bubbleId>/... + <bubbleId>/... bobble-chat) bevares.
  DELETE FROM storage.objects
  WHERE bucket_id = 'bubble-files'
    AND ( name LIKE 'avatars/' || p_user_id::text || '/%'
       OR name LIKE 'dm/'      || p_user_id::text || '/%' );
  GET DIAGNOSTICS n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('storage_deleted', n);

  -- Sever person-koblingen på BEVAREDE gruppe-filer (begge owner-kolonner findes).
  UPDATE storage.objects SET owner = NULL, owner_id = NULL
  WHERE bucket_id = 'bubble-files'
    AND ( owner = p_user_id OR owner_id = p_user_id::text );
  GET DIAGNOSTICS n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('storage_owner_cleared', n);

  RETURN jsonb_build_object('ok', true, 'anonymized_and_cleaned', v_counts);
END;
$$;

GRANT EXECUTE ON FUNCTION public.gdpr_delete_user(uuid) TO authenticated;


-- ════════════════════════════════════════════════════════════════════
-- PROCEDURE — det du gør ved en sletteanmodning:
--   1. Kør:  SELECT gdpr_delete_user('<bruger-uuid>');
--            → anonymiserer indhold, sletter personlige records + filer,
--              rydder de blokerende tabeller. Tjek tallene i returnen.
--   2. Slet auth-brugeren: Dashboard → Authentication → slet bruger
--      (ELLER service-role auth.admin.deleteUser).
--      CASCADE rydder nu automatisk: profiles, bubble_members, messages,
--      profile_views, saved_contacts, push_subscriptions, bubble_invitations,
--      bubble_post_reactions, bubble_upvotes, qr_tokens, analytics, auth.* .
--      (Trin 1 har fjernet alt der ellers ville have blokeret dette.)
--   3. Bekræft med verifikations-query nedenfor (alt = 0).
--
-- ✅ Alle tidligere ⚠️ er afklaret mod skemaet 18. juni 2026.
--    Test stadig på en THROWAWAY-bruger før første rigtige kørsel.
-- ════════════════════════════════════════════════════════════════════

-- VERIFIKATION efter BEGGE trin (alt skal returnere 0):
--   SELECT 'bubble_messages',  count(*) FROM bubble_messages         WHERE user_id    = '<uuid>'
--   UNION ALL SELECT 'bubble_posts',    count(*) FROM bubble_posts             WHERE author_id  = '<uuid>'
--   UNION ALL SELECT 'bubbles',         count(*) FROM bubbles                  WHERE created_by = '<uuid>'
--   UNION ALL SELECT 'reactions',       count(*) FROM bubble_message_reactions WHERE user_id    = '<uuid>'
--   UNION ALL SELECT 'guest_checkins',  count(*) FROM guest_checkins           WHERE claimed_by = '<uuid>'
--   UNION ALL SELECT 'messages',        count(*) FROM messages WHERE sender_id='<uuid>' OR receiver_id='<uuid>'
--   UNION ALL SELECT 'profile',         count(*) FROM profiles                 WHERE id = '<uuid>'
--   UNION ALL SELECT 'blocked_users',   count(*) FROM blocked_users WHERE user_id='<uuid>' OR blocked_id='<uuid>'
--   UNION ALL SELECT 'reports',         count(*) FROM reports WHERE reporter_id='<uuid>' OR reported_id='<uuid>'
--   UNION ALL SELECT 'storage',         count(*) FROM storage.objects
--                                       WHERE bucket_id='bubble-files'
--                                         AND (name LIKE 'avatars/<uuid>/%' OR name LIKE 'dm/<uuid>/%');
