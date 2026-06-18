\set ON_ERROR_STOP on
-- UIDs
-- test  = 11111111-1111-1111-1111-111111111111
-- other = 22222222-2222-2222-2222-222222222222

-- ── SETUP: two users ──
INSERT INTO auth.users(id,email) VALUES
  ('11111111-1111-1111-1111-111111111111','test@x.dk'),
  ('22222222-2222-2222-2222-222222222222','other@x.dk');
INSERT INTO public.profiles(id,name,bio,workplace,title,avatar_url,linkedin,keywords,interests,sectors,role,life_phase,lifestage,match_sector) VALUES
  ('11111111-1111-1111-1111-111111111111','Test Bruger','min bio','Danfoss','PM','avatars/11111111-1111-1111-1111-111111111111/a.jpg','linkedin.com/test',
     ARRAY['iot','b2b'],ARRAY['ai'],ARRAY['tech'],'Product Lead','founder','early','tech'),
  ('22222222-2222-2222-2222-222222222222','Anden Bruger',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL);

-- fixed ids for cross-refs
-- B1=bubble by test, M2=msg by other, P2=post by other
INSERT INTO public.bubbles(id,name,created_by) VALUES ('b1111111-1111-1111-1111-111111111111','TestBubble','11111111-1111-1111-1111-111111111111');
INSERT INTO public.bubbles(id,name,created_by,pending_owner_id) VALUES ('b2222222-2222-2222-2222-222222222222','OtherBubble','22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111');
INSERT INTO public.bubble_messages(id,bubble_id,content,user_id) VALUES
  ('a1111111-1111-1111-1111-111111111111','b1111111-1111-1111-1111-111111111111','hej fra test','11111111-1111-1111-1111-111111111111'),
  ('a2222222-2222-2222-2222-222222222222','b1111111-1111-1111-1111-111111111111','hej fra other','22222222-2222-2222-2222-222222222222');
INSERT INTO public.bubble_posts(id,bubble_id,content,author_id) VALUES
  ('c1111111-1111-1111-1111-111111111111','b1111111-1111-1111-1111-111111111111','opslag fra test','11111111-1111-1111-1111-111111111111'),
  ('c2222222-2222-2222-2222-222222222222','b1111111-1111-1111-1111-111111111111','opslag fra other','22222222-2222-2222-2222-222222222222');
-- BOTH react to M2 (tests delete of test reaction, keep other, no unique collision)
INSERT INTO public.bubble_message_reactions(message_id,user_id,emoji) VALUES
  ('a2222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111','👍'),
  ('a2222222-2222-2222-2222-222222222222','22222222-2222-2222-2222-222222222222','❤️');
INSERT INTO public.guest_checkins(claimed_by) VALUES ('11111111-1111-1111-1111-111111111111'),('22222222-2222-2222-2222-222222222222');
INSERT INTO public.bubble_members(bubble_id,user_id,role) VALUES
  ('b1111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111','admin'),
  ('b1111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','member');
INSERT INTO public.messages(sender_id,receiver_id,content) VALUES
  ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','dm fra test'),
  ('22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111','dm til test');
INSERT INTO public.profile_views(viewer_id,viewed_id) VALUES ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222');
INSERT INTO public.saved_contacts(user_id,contact_id) VALUES ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222');
INSERT INTO public.push_subscriptions(user_id) VALUES ('11111111-1111-1111-1111-111111111111');
INSERT INTO public.blocked_users(user_id,blocked_id) VALUES ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222');
INSERT INTO public.error_log(user_id,msg) VALUES ('11111111-1111-1111-1111-111111111111','en fejl');
INSERT INTO public.reports(reporter_id,reported_id) VALUES
  ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222'),  -- test reporter
  ('22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111');  -- test reported
INSERT INTO public.custom_tags(name,created_by) VALUES ('sometag','11111111-1111-1111-1111-111111111111');
INSERT INTO public.bubble_post_reactions(post_id,user_id) VALUES ('c2222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111');
INSERT INTO storage.objects(bucket_id,name,owner,owner_id) VALUES
  ('bubble-files','avatars/11111111-1111-1111-1111-111111111111/a.jpg','11111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111'), -- personal -> DELETE
  ('bubble-files','b1111111-1111-1111-1111-111111111111/photo.jpg','11111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111'),       -- group -> owner NULL
  ('bubble-files','avatars/22222222-2222-2222-2222-222222222222/b.jpg','22222222-2222-2222-2222-222222222222','22222222-2222-2222-2222-222222222222'); -- other -> intact

\echo '=== FUNKTIONENS RETUR (tællere) ==='
SELECT gdpr_delete_user('11111111-1111-1111-1111-111111111111');

\echo '=== TRIN 2: slet auth-brugeren (skal IKKE fejle paa FK = blokerende tabeller ryddet) ==='
DELETE FROM auth.users WHERE id = '11111111-1111-1111-1111-111111111111';
\echo 'auth-bruger slettet uden FK-fejl'

-- ── VERIFIKATION ──
DO $$
DECLARE
  uid uuid := '11111111-1111-1111-1111-111111111111';
  oth uuid := '22222222-2222-2222-2222-222222222222';
  leftover int;
  fails text := '';
BEGIN
  -- alt der refererer test skal vaere 0
  leftover :=
    (SELECT count(*) FROM bubble_messages WHERE user_id=uid)
   +(SELECT count(*) FROM bubble_posts WHERE author_id=uid)
   +(SELECT count(*) FROM bubbles WHERE created_by=uid)
   +(SELECT count(*) FROM bubble_message_reactions WHERE user_id=uid)
   +(SELECT count(*) FROM guest_checkins WHERE claimed_by=uid)
   +(SELECT count(*) FROM bubble_members WHERE user_id=uid)
   +(SELECT count(*) FROM messages WHERE sender_id=uid OR receiver_id=uid)
   +(SELECT count(*) FROM profile_views WHERE viewer_id=uid OR viewed_id=uid)
   +(SELECT count(*) FROM saved_contacts WHERE user_id=uid OR contact_id=uid)
   +(SELECT count(*) FROM push_subscriptions WHERE user_id=uid)
   +(SELECT count(*) FROM blocked_users WHERE user_id=uid OR blocked_id=uid)
   +(SELECT count(*) FROM error_log WHERE user_id=uid)
   +(SELECT count(*) FROM reports WHERE reporter_id=uid OR reported_id=uid)
   +(SELECT count(*) FROM custom_tags WHERE created_by=uid)
   +(SELECT count(*) FROM bubble_post_reactions WHERE user_id=uid)
   +(SELECT count(*) FROM profiles WHERE id=uid)
   +(SELECT count(*) FROM auth.users WHERE id=uid)
   +(SELECT count(*) FROM storage.objects WHERE owner=uid OR owner_id=uid::text)
   +(SELECT count(*) FROM storage.objects WHERE bucket_id='bubble-files' AND name LIKE 'avatars/'||uid::text||'/%');
  IF leftover <> 0 THEN fails := fails || format('[%s rester af test-id] ', leftover); END IF;

  -- indhold BEVARET (anonymiseret, ikke slettet)
  IF (SELECT count(*) FROM bubble_messages WHERE content='hej fra test' AND user_id IS NULL) <> 1
     THEN fails := fails || '[test-besked ikke bevaret-anonymiseret] '; END IF;
  IF (SELECT count(*) FROM bubble_posts WHERE content='opslag fra test' AND author_id IS NULL) <> 1
     THEN fails := fails || '[test-opslag ikke bevaret-anonymiseret] '; END IF;
  IF (SELECT count(*) FROM bubbles WHERE name='TestBubble' AND created_by IS NULL) <> 1
     THEN fails := fails || '[test-boble ikke bevaret-anonymiseret] '; END IF;
  IF (SELECT count(*) FROM storage.objects WHERE name LIKE 'b1111111%/photo.jpg' AND owner IS NULL AND owner_id IS NULL) <> 1
     THEN fails := fails || '[gruppe-fil owner ikke nulstillet] '; END IF;

  -- ANDEN brugers data INTAKT (ingen over-sletning)
  IF (SELECT count(*) FROM profiles WHERE id=oth) <> 1 THEN fails := fails || '[anden bruger slettet!] '; END IF;
  IF (SELECT count(*) FROM bubble_messages WHERE user_id=oth) <> 1 THEN fails := fails || '[anden besked ramt] '; END IF;
  IF (SELECT count(*) FROM bubble_posts WHERE author_id=oth) <> 1 THEN fails := fails || '[anden opslag ramt] '; END IF;
  IF (SELECT count(*) FROM bubble_message_reactions WHERE user_id=oth) <> 1 THEN fails := fails || '[anden reaktion ramt] '; END IF;
  IF (SELECT count(*) FROM storage.objects WHERE name LIKE 'avatars/'||oth::text||'/%') <> 1 THEN fails := fails || '[anden avatar ramt] '; END IF;
  IF (SELECT count(*) FROM reports WHERE reported_id IS NULL) <> 1 THEN fails := fails || '[reported_id ikke SET NULL] '; END IF;

  IF fails = '' THEN
    RAISE NOTICE '  ✅  ALLE TJEK BESTAaET — bruger fuldt anonymiseret/slettet, anden bruger intakt';
  ELSE
    RAISE EXCEPTION '  ❌  FAIL: %', fails;
  END IF;
END $$;
