\set ON_ERROR_STOP on
-- U1 = member+owner of B; U2 = NOT a member; U3 = third party
INSERT INTO public.profiles(id,name,role) VALUES
 ('11111111-1111-1111-1111-111111111111','U1','user'),
 ('22222222-2222-2222-2222-222222222222','U2','user'),
 ('33333333-3333-3333-3333-333333333333','U3','user');
INSERT INTO public.bubbles(id,name,created_by,visibility) VALUES
 ('bbbbbbbb-0000-0000-0000-000000000001','B','11111111-1111-1111-1111-111111111111','public');
INSERT INTO public.bubble_members(bubble_id,user_id,role,status) VALUES
 ('bbbbbbbb-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','admin','active');
INSERT INTO public.bubble_messages(id,bubble_id,user_id,content) VALUES
 ('aaaaaaaa-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','hemmelig boble-besked');
INSERT INTO public.bubble_posts(id,bubble_id,author_id,content) VALUES
 ('cccccccc-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','hemmeligt opslag');
INSERT INTO public.messages(id,sender_id,receiver_id,content) VALUES
 ('dddddddd-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','33333333-3333-3333-3333-333333333333','privat DM');
INSERT INTO public.guest_checkins(bubble_id,guest_name,guest_email) VALUES
 ('bbbbbbbb-0000-0000-0000-000000000001','Gaest Navn','gaest@x.dk');

CREATE TEMP TABLE _r (ord serial, name text, got int, want int);

-- POSITIVE CONTROL: member U1 CAN read the bubble message (proves data exists)
SET test.uid='11111111-1111-1111-1111-111111111111'; SET test.role='authenticated'; SET ROLE authenticated;
SELECT count(*)::int AS c FROM bubble_messages WHERE bubble_id='bbbbbbbb-0000-0000-0000-000000000001' \gset
RESET ROLE; INSERT INTO _r(name,got,want) VALUES ('[kontrol] medlem laeser boble-besked', :c, 1);

-- non-member U2 reads bubble_messages -> SHOULD be 0 (member-only)
SET test.uid='22222222-2222-2222-2222-222222222222'; SET test.role='authenticated'; SET ROLE authenticated;
SELECT count(*)::int AS c FROM bubble_messages WHERE bubble_id='bbbbbbbb-0000-0000-0000-000000000001' \gset
RESET ROLE; INSERT INTO _r(name,got,want) VALUES ('ikke-medlem laeser boble-CHAT', :c, 0);

-- non-member U2 reads bubble_posts -> SHOULD be 0
SET test.uid='22222222-2222-2222-2222-222222222222'; SET test.role='authenticated'; SET ROLE authenticated;
SELECT count(*)::int AS c FROM bubble_posts WHERE bubble_id='bbbbbbbb-0000-0000-0000-000000000001' \gset
RESET ROLE; INSERT INTO _r(name,got,want) VALUES ('ikke-medlem laeser boble-OPSLAG', :c, 0);

-- uninvolved U2 reads a DM between U1 and U3 -> SHOULD be 0
SET test.uid='22222222-2222-2222-2222-222222222222'; SET test.role='authenticated'; SET ROLE authenticated;
SELECT count(*)::int AS c FROM messages WHERE id='dddddddd-0000-0000-0000-000000000001' \gset
RESET ROLE; INSERT INTO _r(name,got,want) VALUES ('uvedkommende laeser privat DM', :c, 0);

-- uninvolved U3 reads ALL guest_checkins (PII) -> SHOULD be 0
SET test.uid='33333333-3333-3333-3333-333333333333'; SET test.role='authenticated'; SET ROLE authenticated;
SELECT count(*)::int AS c FROM guest_checkins \gset
RESET ROLE; INSERT INTO _r(name,got,want) VALUES ('uvedkommende laeser guest_checkins (PII)', :c, 0);

\echo ''
\echo '=== RLS PRIVATLIVS-RESULTAT (got vs forventet-sikker) ==='
SELECT name, got, want, CASE WHEN got=want THEN 'OK' ELSE '*** FUND ***' END AS status FROM _r ORDER BY ord;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM _r WHERE got <> want;
  IF n = 0 THEN
    RAISE NOTICE 'alle RLS-privatlivs-forventninger holdt';
  ELSE
    RAISE EXCEPTION '% RLS-FUND - laeg-laesbart paa tvaers af brugere (se tabel ovenfor)', n;
  END IF;
END $$;
